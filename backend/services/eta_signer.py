"""
توقيع مستند الفاتورة الإلكترونية — CAdES-BES كما تطلبه مصلحة الضرائب.

The structure follows the authority's own parsed sample
(sdk.invoicing.eta.gov.eg/files/parsed-cades-bes.txt):

  ContentInfo signedData
    SignedData v3
      digestAlgorithms   { sha-256 }
      encapContentInfo   eContentType 1.2.840.113549.1.7.5, no eContent (detached)
      certificates       [ the eSeal certificate ]
      SignerInfo v1, sid = issuerAndSerialNumber, digest sha-256
        signedAttrs (in this order)
          contentType            1.2.840.113549.1.7.5
          signingTime            UTC
          messageDigest          sha-256(canonical string, UTF-8)
          signingCertificateV2   ESSCertIDv2 { certHash sha-256, issuerSerial } (no hashAlgorithm)
        signatureAlgorithm rsaEncryption, signature over DER(signedAttrs as SET)

The old code put an HMAC of the hash, wrapped in base64 JSON, where the CMS
signature goes — the authority can only reject that.

The private key lives either in a PKCS#12 file (an eSeal exported as .pfx,
kept encrypted in the database) or on a PKCS#11 token/HSM. Both use the same
builder; only the final RSA operation differs.
"""
import base64
import hashlib
import os
from datetime import datetime, timezone
from typing import Callable, Optional

from asn1crypto import cms, core, x509, algos, tsp


class ETASigningError(ValueError):
    pass


# The authority's sample has AlgorithmIdentifiers with no parameters at all
# (sha-256, rsaEncryption). asn1crypto always writes a NULL there, so these
# variants of its classes leave the parameters out.
class _Digest(core.Sequence):
    _fields = [("algorithm", algos.DigestAlgorithmId), ("parameters", core.Any, {"optional": True})]


class _Digests(core.SetOf):
    _child_spec = _Digest


class _SigAlg(core.Sequence):
    _fields = [("algorithm", algos.SignedDigestAlgorithmId), ("parameters", core.Any, {"optional": True})]


def _swap(fields, mapping):
    return [(name, mapping.get(name, spec), *rest) for name, spec, *rest in fields]


class _SignerInfo(cms.SignerInfo):
    _fields = _swap(cms.SignerInfo._fields, {"digest_algorithm": _Digest, "signature_algorithm": _SigAlg})


class _SignerInfos(core.SetOf):
    _child_spec = _SignerInfo


class _SignedData(cms.SignedData):
    _fields = _swap(cms.SignedData._fields, {"digest_algorithms": _Digests, "signer_infos": _SignerInfos})


CONTENT_TYPE_OID = "1.2.840.113549.1.7.5"


def _signed_attrs(content: bytes, cert: x509.Certificate, when: datetime) -> cms.CMSAttributes:
    cert_hash = hashlib.sha256(cert.dump()).digest()
    ess = tsp.ESSCertIDv2({
        "cert_hash": cert_hash,
        "issuer_serial": {
            "issuer": [x509.GeneralName({"directory_name": cert.issuer})],
            "serial_number": cert.serial_number,
        },
    })
    # sha-256 is the default hashAlgorithm of ESSCertIDv2 — leave it out, as the sample does
    if "hash_algorithm" in ess:
        try:
            del ess["hash_algorithm"]
        except Exception:
            pass
    return cms.CMSAttributes([
        cms.CMSAttribute({"type": "content_type", "values": [CONTENT_TYPE_OID]}),
        cms.CMSAttribute({"type": "signing_time", "values": [cms.Time({"utc_time": core.UTCTime(when)})]}),
        cms.CMSAttribute({"type": "message_digest", "values": [hashlib.sha256(content).digest()]}),
        cms.CMSAttribute({"type": "signing_certificate_v2",
                          "values": [tsp.SigningCertificateV2({"certs": [ess]})]}),
    ])


def build_cades(content: bytes, cert_der: bytes, rsa_sign: Callable[[bytes], bytes],
                when: Optional[datetime] = None) -> bytes:
    """DER CMS. rsa_sign(data) must return an RSA PKCS#1 v1.5 signature of
    sha-256(data) — data is the DER of the signed attributes."""
    cert = x509.Certificate.load(cert_der)
    when = (when or datetime.now(timezone.utc)).replace(microsecond=0)
    attrs = _signed_attrs(content, cert, when)
    signature = rsa_sign(attrs.dump())          # SET OF tag: what is signed (RFC 5652 5.4)

    signer = _SignerInfo({
        "version": "v1",
        "sid": cms.SignerIdentifier({"issuer_and_serial_number": cms.IssuerAndSerialNumber({
            "issuer": cert.issuer, "serial_number": cert.serial_number})}),
        "digest_algorithm": _Digest({"algorithm": "sha256"}),
        "signed_attrs": attrs,
        "signature_algorithm": _SigAlg({"algorithm": "rsassa_pkcs1v15"}),
        "signature": signature,
    })
    signed_data = _SignedData({
        "version": "v3",
        "digest_algorithms": [_Digest({"algorithm": "sha256"})],
        "encap_content_info": {"content_type": CONTENT_TYPE_OID},
        "certificates": [cert],
        "signer_infos": [signer],
    })
    return _content_info(signed_data)


def _content_info(signed_data) -> bytes:
    """ContentInfo { signedData OID, [0] EXPLICIT SignedData }, built by hand
    so the parameter-less SignedData above is not re-validated by cms.ContentInfo."""
    oid = core.ObjectIdentifier("1.2.840.113549.1.7.2").dump()
    body = signed_data.dump(force=True)
    explicit = _tlv(0xA0, body)
    return _tlv(0x30, oid + explicit)


def _tlv(tag: int, value: bytes) -> bytes:
    n = len(value)
    if n < 0x80:
        length = bytes([n])
    else:
        b = n.to_bytes((n.bit_length() + 7) // 8, "big")
        length = bytes([0x80 | len(b)]) + b
    return bytes([tag]) + length + value


# ── key holders ───────────────────────────────────────────────

def pkcs12_signer(pfx: bytes, password: Optional[str]) -> tuple:
    """(cert_der, rsa_sign) from a .pfx/.p12 eSeal."""
    from cryptography.hazmat.primitives.serialization import pkcs12, Encoding
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.asymmetric import padding, rsa
    try:
        key, cert, _ = pkcs12.load_key_and_certificates(pfx, (password or "").encode() or None)
    except Exception:
        raise ETASigningError("تعذّر فتح ملف الشهادة — تأكد من الملف وكلمة المرور")
    if key is None or cert is None:
        raise ETASigningError("ملف الشهادة لا يحتوي على المفتاح الخاص والشهادة معاً")
    if not isinstance(key, rsa.RSAPrivateKey):
        raise ETASigningError("الشهادة ليست RSA — المنظومة تعتمد RSA")
    now = datetime.now(timezone.utc)
    if cert.not_valid_after_utc < now:
        raise ETASigningError(f"الشهادة منتهية في {cert.not_valid_after_utc.date()} — جدّدها من الجهة المصدرة")

    def sign(data: bytes) -> bytes:
        return key.sign(data, padding.PKCS1v15(), hashes.SHA256())
    return cert.public_bytes(Encoding.DER), sign


def pkcs11_signer(library: str, pin: str, token_label: Optional[str] = None,
                  key_label: Optional[str] = None) -> tuple:
    """(cert_der, rsa_sign) from a USB token / HSM through its PKCS#11 library.
    Needs python-pkcs11 and the vendor's middleware on the machine that holds
    the token."""
    try:
        import pkcs11
        from pkcs11 import Attribute, ObjectClass, Mechanism
    except ImportError:
        raise ETASigningError("التوقيع بالتوكن يحتاج مكتبة python-pkcs11 وبرنامج الجهة المصدرة على نفس الجهاز")
    lib = pkcs11.lib(library)
    token = lib.get_token(token_label=token_label) if token_label else next(iter(lib.get_tokens()))
    session = token.open(user_pin=pin)
    key = session.get_key(object_class=ObjectClass.PRIVATE_KEY, label=key_label) if key_label \
        else next(session.get_objects({Attribute.CLASS: ObjectClass.PRIVATE_KEY}))
    cert_obj = next(session.get_objects({Attribute.CLASS: ObjectClass.CERTIFICATE}))
    cert_der = bytes(cert_obj[Attribute.VALUE])

    def sign(data: bytes) -> bytes:
        return bytes(key.sign(data, mechanism=Mechanism.SHA256_RSA_PKCS))
    return cert_der, sign


def sign_canonical(canonical: str, cert_der: bytes, rsa_sign: Callable[[bytes], bytes]) -> str:
    """Base64 CAdES-BES of the canonical string — the value of signatures[0]."""
    return base64.b64encode(build_cades(canonical.encode("utf-8"), cert_der, rsa_sign)).decode()


def certificate_info(cert_der: bytes) -> dict:
    from cryptography import x509 as cx509
    c = cx509.load_der_x509_certificate(cert_der)
    return {"subject": c.subject.rfc4514_string(), "issuer": c.issuer.rfc4514_string(),
            "serial": str(c.serial_number),
            "valid_from": c.not_valid_before_utc.date().isoformat(),
            "valid_to": c.not_valid_after_utc.date().isoformat()}


# ── secrets at rest ──────────────────────────────────────────

def _fernet():
    from cryptography.fernet import Fernet
    key = os.environ.get("ETA_SECRET_KEY")
    if not key:
        seed = os.environ.get("JWT_SECRET_KEY") or os.environ.get("SECRET_KEY")
        if not seed:
            raise ETASigningError("ETA_SECRET_KEY غير مضبوط على الخادم")
        key = base64.urlsafe_b64encode(hashlib.sha256(("eta:" + seed).encode()).digest())
    return Fernet(key)


def encrypt(data: bytes) -> str:
    return _fernet().encrypt(data).decode()


def decrypt(token: str) -> bytes:
    return _fernet().decrypt(token.encode())
