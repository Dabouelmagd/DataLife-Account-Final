"""
مساعد الدعم بالذكاء الاصطناعي — the chat bubble's brain.

The bubble answered from six keyword rules, so almost every real question
("ازاي أعمل قيد؟", "فين سند الصرف؟") got "لم أجد إجابة". This sends the
conversation to whichever AI provider the server has a key for (the same
keys the interview-question suggestions use), with a guide to the product's
screens and rules. It never raises: no key, a timeout or an error returns
None and the caller falls back to the keyword answers.
"""
import asyncio
import json
import logging
import os
from typing import AsyncIterator, List, Optional

from services.interview_ai import _provider, ANTHROPIC_URL

logger = logging.getLogger(__name__)
ANTHROPIC_MODEL = os.environ.get("ANTHROPIC_SUPPORT_MODEL",
                                 os.environ.get("ANTHROPIC_INTERVIEW_MODEL", "claude-haiku-4-5-20251001"))
OPENAI_MODEL = os.environ.get("OPENAI_SUPPORT_MODEL", "gpt-4o-mini")
TIMEOUT = 25

GUIDE = """أنت مساعد الدعم داخل برنامج «داتا لايف أكاونت» (DataLife Account) — نظام محاسبة وموارد بشرية سحابي عربي/إنجليزي للشركات في مصر، من شركة داتا لايف لخدمات الذكاء الصناعي.

أسلوبك: عربي مصري مهذب وبسيط (أو إنجليزي إذا كتب المستخدم بالإنجليزية)، إجابات قصيرة وعملية بخطوات مرقّمة، واذكر مكان الشاشة بالمسار: القائمة ← القسم.
لا تخترع ميزات أو أسعاراً أو أرقاماً غير مذكورة هنا. إن لم تعرف أو احتاج الأمر بيانات حساب المستخدم فقل ذلك واقترح زر «التحدث مع الدعم». لا تطلب كلمات مرور أو بيانات بطاقات. لا تقدّم فتوى قانونية أو ضريبية قاطعة — اذكر القاعدة العامة وانصح بمراجعة المحاسب.

القائمة الجانبية:
- الرئيسية (لوحة التحكم): النقدية والبنوك، المستحق للعملاء وللموردين، جاري الشركاء والإدارة، نتيجة الشهر، الموقف الضريبي — كلها من دفتر الأستاذ؛ اضغط أي رقم لفتح تفاصيله.
- الموارد البشرية: نظرة عامة، الموظفون (ملف الموظف: صورة الموظف بزر الكاميرا، السيرة الذاتية «رفع السيرة الذاتية»، المستندات، بوابة الموظف)، التوظيف والمقابلات (الوظائف، المرشحون، بنك الأسئلة، اختبار الشخصية والقدرات، تقييم كل سؤال من 1 إلى 5، تقرير المرشح)، الرواتب، البدلات، الخصومات، الحضور والانصراف، الورديات، الإجازات، إنهاء الخدمة، تقارير HR.
- الإدارة المالية: القيود اليومية، دفتر الأستاذ، ميزان المراجعة، قائمة الدخل، الميزانية العمومية، العملاء والموردين، المنتجات، المخزون، البنوك والخزائن، الخزينة والشيكات، العملات، التقارير المالية.
- المبيعات، الفواتير الإلكترونية (مربوطة بمنظومة ETA)، المشتريات، المشاريع، الأصول الثابتة، الضرائب، التقارير والتحليلات، الموافقات، استيراد البيانات، الإعدادات، الاشتراك.

قواعد وطرق العمل:
- القيد اليومي اليدوي: الإدارة المالية ← القيود اليومية ← «قيد جديد» ← «حفظ وإرسال للمراجعة». يظهر «تحت المراجعة»، ثم يعتمده المدير المالي أو رئيس الحسابات أو رئيس مجلس الإدارة («اعتماد» أو «رفض» مع السبب)، ثم يُرحَّل آخر الشهر بزر «ترحيل قيود الشهر المعتمدة». لا يراجع كاتب القيد قيده (إلا رئيس مجلس الإدارة). أي تعديل بعد الاعتماد يعيده للمراجعة. القيد المرحّل لا يُعدَّل ولا يُحذف — يُصحَّح بقيد عكسي.
- صرف مبلغ: الإدارة المالية ← البنوك والخزائن ← «سند صرف» (أو زر «صرف» على كارت البنك): الصرف من الخزينة أو بنك معيّن، المستفيد، الحساب المقابل، المبلغ — يُرحَّل القيد فوراً ويُطبع السند. لا يُصرف من الخزينة أكثر من رصيدها.
- سند قبض وشيكات واردة/صادرة: الإدارة المالية ← الخزينة والشيكات.
- البنوك: إضافة حساب بنكي برصيده الافتتاحي (يُسجَّل بقيد تلقائي)، والحركات البنكية تُرحَّل تلقائياً.
- المشاريع: افتح المشروع ← «+ مصروف» أو «+ إيراد»: النوع، المبلغ، التاريخ، البيان، و«دُفع من»: الخزينة، بنك، «دفعها: جاري رئيس مجلس الإدارة / الشركاء»، أو آجل على المورد/العميل. القيد يُرحَّل فوراً ويظهر رقمه بجانب البند. الإلغاء بقيد عكسي مع ذكر السبب.
- استيراد البيانات (موظفين، عملاء، موردين، مخزون، فواتير، مشتريات، إيرادات، مصروفات): نزّل القالب من صفحة الاستيراد واملأه؛ الملف الناقص أو الخاطئ يُرفض كله مع قائمة بالأخطاء حتى يُعدَّل، ولا يُقبل نفس الملف مرتين.
- الأرقام في البرنامج بالأرقام الإنجليزية.
- الدفع للاشتراك: إنستاباي أو فودافون كاش ثم إدخال رقم العملية من صفحة الاشتراك، أو كود تفعيل. استرداد كامل إذا أُلغي الاشتراك خلال أول 7 أيام، ولا يوجد تجديد تلقائي.
- الدعم البشري: زر «التحدث مع الدعم» في المحادثة، أو info@datalifeai.com.

أسئلة المحاسبة والضرائب المصرية — هكذا يقيّد البرنامج تلقائياً (أكواد دليل الحسابات الافتراضي):
- فاتورة شراء (المشتريات ← فاتورة جديدة): ضريبة الخصم والتحصيل تُحسب على قيمة الشراء قبل ضريبة القيمة المضافة: 1% توريدات (الافتراضي)، 3% خدمات/استشارات/أعمال هندسية، 5% مهن حرة (محاماة، محاسبة، طب). لا يستقطعها البرنامج إذا كانت قيمة الشراء قبل الضريبة 300 ج.م أو أقل. القيد:
  من ح/ المشتريات 311 (أو المخزون 125 لو الشركة على الجرد المستمر) بالقيمة قبل الضريبة
  من ح/ ضريبة المدخلات 137 بقيمة ضريبة القيمة المضافة 14%
  إلى ح/ الموردون 251 بصافي المستحق للمورد = الإجمالي شامل الضريبة − الخصم والتحصيل
  إلى ح/ ضريبة الخصم والتحصيل المستقطعة 261 (التزام يورَّد لمصلحة الضرائب بنموذج 41).
  مثال: بضاعة 10,000 + ضريبة 14% = 1,400: من 311 = 10,000، من 137 = 1,400، إلى 251 = 11,300، إلى 261 = 100 (1% من 10,000). المدين = الدائن = 11,400.
- سداد المورد: من ح/ الموردون 251 إلى ح/ الخزينة أو البنك بصافي المستحق فقط — مبلغ الخصم والتحصيل لا يُدفع للمورد.
- فاتورة بيع: من ح/ العملاء 131 بالصافي بعد ما يستقطعه العميل، ومن ح/ ضريبة الخصم والتحصيل المحتجزة لدى الغير 138 (إذا حُدّدت نسبة خصم العميل على الفاتورة)، إلى ح/ إيراد المبيعات 411 (أو إيراد الخدمات) بالقيمة قبل الضريبة، وإلى ح/ ضريبة المخرجات 260 بقيمة 14%.
- صافي ضريبة القيمة المضافة عن الشهر = المخرجات (260) − المدخلات القابلة للخصم (137).
- هذه قواعد البرنامج والقاعدة العامة. الحالات الخاصة (سلع معفاة أو بنسبة أخرى، ضريبة الجدول، أنشطة غير مذكورة) يراجعها محاسب الشركة.
"""


def available() -> bool:
    return bool(_provider()[0])


async def _anthropic(key: str, history: List[dict]) -> str:
    import httpx
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        res = await client.post(ANTHROPIC_URL, headers={
            "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json",
        }, json={"model": ANTHROPIC_MODEL, "max_tokens": 700, "temperature": 0.3,
                 "system": GUIDE, "messages": history})
    res.raise_for_status()
    return "".join(b.get("text", "") for b in res.json().get("content", []) if b.get("type") == "text").strip()


async def _openai(key: str, history: List[dict]) -> str:
    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=key, timeout=TIMEOUT)
    res = await client.chat.completions.create(
        model=OPENAI_MODEL, temperature=0.3, max_tokens=700,
        messages=[{"role": "system", "content": GUIDE}] + history)
    return (res.choices[0].message.content or "").strip()


def _turns(history: List[dict]) -> List[dict]:
    """The API wants alternating turns starting with the user; keep the last
    12 messages, each capped at 2,000 characters, so a long public session
    can't grow the prompt (and the bill) without limit."""
    turns = []
    for m in history[-12:]:
        role = "assistant" if m.get("role") == "assistant" else "user"
        text = str(m.get("content") or "")[:2000]
        if turns and turns[-1]["role"] == role:
            turns[-1]["content"] += "\n" + text
        else:
            turns.append({"role": role, "content": text})
    while turns and turns[0]["role"] != "user":
        turns.pop(0)
    return turns


async def answer(history: List[dict]) -> Optional[str]:
    """history: [{role: user|assistant, content}], ending with the user's
    message. Returns the reply, or None when no AI answer is possible."""
    provider, key = _provider()
    if not provider:
        return None
    turns = _turns(history)
    if not turns:
        return None
    try:
        call = _anthropic if provider == "anthropic" else _openai
        reply = await asyncio.wait_for(call(key, turns), timeout=TIMEOUT + 5)
        return reply or None
    except Exception as e:                       # key, quota, network, timeout
        logger.warning("support AI failed (%s): %s", provider, e)
        return None


# ── Streaming ───────────────────────────────────────────────
# The landing page promises streamed answers, but /send waited for the whole
# reply (several seconds of a spinner). stream() yields the text as the model
# writes it. Same rules as answer(): it never raises — on no key or an error
# it simply stops, and the caller falls back to the keyword answer when
# nothing at all came through.

async def _anthropic_stream(key: str, turns: List[dict]) -> AsyncIterator[str]:
    import httpx
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        async with client.stream("POST", ANTHROPIC_URL, headers={
            "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json",
        }, json={"model": ANTHROPIC_MODEL, "max_tokens": 700, "temperature": 0.3,
                 "system": GUIDE, "messages": turns, "stream": True}) as res:
            res.raise_for_status()
            async for line in res.aiter_lines():
                if not line.startswith("data:"):
                    continue
                try:
                    ev = json.loads(line[5:].strip())
                except ValueError:
                    continue
                if ev.get("type") == "content_block_delta" and (ev.get("delta") or {}).get("type") == "text_delta":
                    yield ev["delta"].get("text", "")
                elif ev.get("type") == "error":
                    raise RuntimeError((ev.get("error") or {}).get("message", "stream error"))


async def _openai_stream(key: str, turns: List[dict]) -> AsyncIterator[str]:
    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=key, timeout=TIMEOUT)
    res = await client.chat.completions.create(
        model=OPENAI_MODEL, temperature=0.3, max_tokens=700, stream=True,
        messages=[{"role": "system", "content": GUIDE}] + turns)
    async for chunk in res:
        if chunk.choices and chunk.choices[0].delta and chunk.choices[0].delta.content:
            yield chunk.choices[0].delta.content


async def stream(history: List[dict]) -> AsyncIterator[str]:
    provider, key = _provider()
    turns = _turns(history) if provider else []
    if not turns:
        return
    gen = _anthropic_stream(key, turns) if provider == "anthropic" else _openai_stream(key, turns)
    loop = asyncio.get_running_loop()
    deadline = loop.time() + TIMEOUT + 5          # whole-answer cap, like answer()
    try:
        while True:
            left = deadline - loop.time()
            if left <= 0:
                raise asyncio.TimeoutError()
            try:
                piece = await asyncio.wait_for(gen.__anext__(), timeout=left)
            except StopAsyncIteration:
                break
            if piece:
                yield piece
    except Exception as e:                       # key, quota, network, timeout
        logger.warning("support AI stream failed (%s): %s", provider, e)
    finally:
        try:
            await gen.aclose()
        except Exception:
            pass
