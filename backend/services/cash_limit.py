"""
حد السداد النقدي — قانون تنظيم المدفوعات غير النقدية 18 لسنة 2019.

The law restricts settling obligations in cash above a threshold: payments to
suppliers, dividends and similar must go through a bank channel. A payment
made in cash above the limit is refused as a deductible expense at
inspection — the money is spent and the deduction is lost.

The threshold is NOT hard-coded here on purpose. It is set by decision and
has changed; a wrong number baked into the code would either block legitimate
payments or quietly permit ones that lose their deduction. It is configured
per deployment (CASH_PAYMENT_LIMIT) and the guard stays off until it is set,
so nothing changes for anyone who has not chosen a figure with their
accountant.
"""

import os

BANK_METHODS = {"bank", "bank_transfer", "transfer", "check", "cheque", "card",
                "credit_card", "mobile_wallet", "instapay", "wallet"}


def limit() -> float:
    """0 = the guard is off (no limit configured)."""
    try:
        return max(float(os.environ.get("CASH_PAYMENT_LIMIT", "0")), 0.0)
    except ValueError:
        return 0.0


def is_cash(method) -> bool:
    text = str(method or "cash").strip().lower()
    return text not in BANK_METHODS


def check(amount: float, method, what: str = "هذه المعاملة") -> None:
    """Raise ValueError when a cash payment exceeds the configured limit."""
    cap = limit()
    if not cap or not is_cash(method):
        return
    amount = round(float(amount or 0), 2)
    if amount > cap:
        raise ValueError(
            f"لا يمكن سداد {what} نقداً بمبلغ {amount:,.2f} — الحد المسموح به نقداً "
            f"{cap:,.2f} (قانون 18/2019). استخدم تحويلاً بنكياً أو شيكاً أو بطاقة، "
            f"وإلا لن تُعتمد كمصروف عند الفحص الضريبي.")
