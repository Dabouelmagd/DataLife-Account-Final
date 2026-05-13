"""
Mapping of subscription plans to allowed modules.
Used for feature-gating the UI/sidebar based on the company's subscription plan.
"""

# Modules each subscription plan unlocks
PLAN_MODULES = {
    "starter": [
        "dashboard", "hr", "financial", "reports", "settings"
    ],
    "professional": [
        "dashboard", "hr", "financial", "reports", "settings",
        "inventory", "invoices", "purchases", "analytics", "projects"
    ],
    "enterprise": [
        "dashboard", "hr", "financial", "reports", "settings",
        "inventory", "invoices", "purchases", "analytics", "projects",
        "approvals", "users", "import"
    ],
    "hr-only": [
        "dashboard", "hr", "settings"
    ],
    "financial-only": [
        "dashboard", "financial", "invoices", "purchases", "settings"
    ],
    "inventory-only": [
        "dashboard", "inventory", "settings"
    ],
    "lifetime": [
        "dashboard", "hr", "financial", "reports", "settings",
        "inventory", "invoices", "purchases", "analytics", "projects",
        "approvals", "users", "import"
    ],
    # Trial users get full access for evaluation
    "trial": [
        "dashboard", "hr", "financial", "reports", "settings",
        "inventory", "invoices", "purchases", "analytics", "projects",
        "approvals", "users", "import"
    ],
}

# Display labels for the plans
PLAN_DISPLAY = {
    "starter":         {"en": "Starter",        "ar": "الباقة المبتدئة"},
    "professional":    {"en": "Professional",   "ar": "الباقة الاحترافية"},
    "enterprise":      {"en": "Enterprise",     "ar": "باقة الشركات"},
    "hr-only":         {"en": "HR Only",        "ar": "الموارد البشرية فقط"},
    "financial-only":  {"en": "Financial Only", "ar": "المالية فقط"},
    "inventory-only":  {"en": "Inventory Only", "ar": "المخزون فقط"},
    "lifetime":        {"en": "Lifetime",       "ar": "اشتراك دائم"},
    "trial":           {"en": "Free Trial",     "ar": "تجربة مجانية"},
}


def get_allowed_modules(plan: str) -> list:
    """Return the list of module IDs unlocked for the given plan."""
    if not plan:
        return PLAN_MODULES["trial"]
    plan = plan.lower().strip()
    return PLAN_MODULES.get(plan, PLAN_MODULES["trial"])


def get_plan_display(plan: str, language: str = "en") -> str:
    """Return the human-readable name of a plan in the requested language."""
    if not plan:
        return PLAN_DISPLAY["trial"][language]
    plan = plan.lower().strip()
    info = PLAN_DISPLAY.get(plan, PLAN_DISPLAY["trial"])
    return info.get(language, info["en"])
