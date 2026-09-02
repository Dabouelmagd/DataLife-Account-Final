// useDocumentActions.js — Document Lifecycle Button State Machine
// TC-UI-01 to TC-UI-05: controls which buttons are enabled per status

export const INVOICE_STATUSES = {
  DRAFT:     'draft',
  APPROVED:  'approved',
  POSTED:    'posted',
  VOIDED:    'voided',
  CANCELLED: 'cancelled',
};

export const STATUS_AR = {
  draft:     'مسودة',
  approved:  'معتمدة',
  posted:    'مرحَّلة',
  voided:    'ملغاة',
  cancelled: 'مُلغاة',
};

/**
 * Document Lifecycle State Machine
 *
 * TC-UI-01 Draft:    حفظ✅  اعتماد✅  ترحيل❌  إلغاء❌  حذف✅
 * TC-UI-02 Approved: اعتماد❌ ترحيل✅  إلغاء✅  حذف❌
 * TC-UI-03 Posted:   تعديل❌ حذف❌    عكس✅    طباعة✅
 * TC-UI-04 Voided:   جميع الأزرار❌ ما عدا طباعة✅
 * TC-UI-05 Posted:   زر الإلغاء لا يظهر
 */
export function getDocumentActions(status) {
  switch (status) {
    case 'draft':
      return {
        canEdit:    true,
        canSave:    true,
        canApprove: true,   // TC-UI-01: ✅
        canPost:    false,  // TC-UI-01: ❌
        canVoid:    false,  // TC-UI-01: ❌ (إلغاء)
        canDelete:  true,
        canReverse: false,
        canPrint:   true,
        canExport:  true,
        showCancel: false,  // TC-UI-01: ❌
        showVoid:   false,
      };

    case 'approved':
      return {
        canEdit:    false,  // TC-UI-02: ❌ (معطَّل)
        canSave:    false,
        canApprove: false,  // TC-UI-02: ❌
        canPost:    true,   // TC-UI-02: ✅
        canVoid:    true,   // TC-UI-02: ✅
        canDelete:  false,  // TC-UI-02: ❌
        canReverse: false,
        canPrint:   true,
        canExport:  true,
        showCancel: true,
        showVoid:   true,
      };

    case 'posted':
      return {
        canEdit:    false,  // TC-UI-03: ❌ تعديل معطَّل
        canSave:    false,
        canApprove: false,
        canPost:    false,
        canVoid:    false,
        canDelete:  false,  // TC-UI-03: ❌ حذف معطَّل
        canReverse: true,   // TC-UI-03: ✅ عكس
        canPrint:   true,   // TC-UI-03: ✅ طباعة
        canExport:  true,
        showCancel: false,  // TC-UI-05: لا يظهر
        showVoid:   false,  // TC-UI-05: لا يظهر
      };

    case 'voided':
    case 'cancelled':
      return {
        canEdit:    false,
        canSave:    false,
        canApprove: false,
        canPost:    false,
        canVoid:    false,   // TC-UI-04: ❌
        canDelete:  false,   // TC-UI-04: ❌
        canReverse: false,
        canPrint:   true,    // TC-UI-04: ✅ فقط
        canExport:  true,
        showCancel: false,
        showVoid:   false,
      };

    default:
      return {
        canEdit: false, canSave: false, canApprove: false,
        canPost: false, canVoid: false, canDelete: false,
        canReverse: false, canPrint: true, canExport: true,
        showCancel: false, showVoid: false,
      };
  }
}

/** React hook — useDocumentActions(invoice)
 *  Returns action flags + double-click guard handlers
 */
export function useDocumentActions(invoice, onAction) {
  const status  = invoice?.status || 'draft';
  const actions = getDocumentActions(status);

  // Double-click prevention: track in-flight action
  const [loading, setLoading] = window.React?.useState
    ? window.React.useState({})
    : [{ _mock: true }, () => {}];

  const guard = (actionName, fn) => async (...args) => {
    if (loading[actionName]) return;           // ← TC-UI-06 double-click guard
    setLoading(prev => ({ ...prev, [actionName]: true }));
    try {
      await fn(...args);
    } finally {
      setLoading(prev => ({ ...prev, [actionName]: false }));
    }
  };

  return {
    actions,
    loading,
    handlers: {
      onApprove: guard('approve', () => onAction('approve')),
      onPost:    guard('post',    () => onAction('post')),
      onVoid:    guard('void',    () => onAction('void')),
      onReverse: guard('reverse', () => onAction('reverse')),
    },
  };
}
