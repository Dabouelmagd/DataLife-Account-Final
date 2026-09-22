"""Read an upload without letting its size exhaust memory.

nginx accepts bodies up to 50 MB, and several handlers did `await file.read()`
with no limit — a few concurrent large uploads could exhaust the 4 GB server.
read_limited reads in chunks and stops as soon as the limit is passed.
"""
from fastapi import HTTPException, UploadFile

MB = 1024 * 1024
PHOTO_LIMIT = 5 * MB
IMPORT_LIMIT = 20 * MB
IMAGE_EXT = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif"}


async def read_limited(file: UploadFile, max_bytes: int) -> bytes:
    chunks, total = [], 0
    while True:
        chunk = await file.read(1 * MB)
        if not chunk:
            break
        total += len(chunk)
        if total > max_bytes:
            raise HTTPException(status_code=413,
                                detail=f"حجم الملف أكبر من الحد المسموح ({max_bytes // MB} ميجابايت)")
        chunks.append(chunk)
    return b"".join(chunks)
