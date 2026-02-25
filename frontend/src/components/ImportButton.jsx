import React, { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Upload, Loader2, CheckCircle, AlertCircle, X, Download, Info, FileWarning, Table, Eye, EyeOff } from 'lucide-react';

const ImportButton = ({ 
  language, 
  importType,
  dataType,
  onSuccess,
  buttonVariant = 'default' // 'default' or 'compact'
}) => {
  const isRTL = language === 'ar';
  const [showModal, setShowModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [showFormat, setShowFormat] = useState(true);
  const [templateData, setTemplateData] = useState(null);
  const fileInputRef = useRef(null);

  const API_URL = process.env.REACT_APP_BACKEND_URL;

  // Import type labels
  const typeLabels = {
    employees: { ar: 'الموظفين', en: 'Employees' },
    customers: { ar: 'العملاء', en: 'Customers' },
    suppliers: { ar: 'الموردين', en: 'Suppliers' },
    inventory: { ar: 'المخزون', en: 'Inventory' },
    invoices: { ar: 'الفواتير', en: 'Invoices' },
    purchases: { ar: 'المشتريات', en: 'Purchases' },
    revenue: { ar: 'الإيرادات', en: 'Revenues' },
    expense: { ar: 'المصروفات', en: 'Expenses' }
  };

  // Column requirements for each type
  const columnRequirements = {
    employees: [
      { key: 'name', ar: 'الاسم', en: 'Name', required: true, example: 'أحمد محمد', exampleEn: 'Ahmed Mohamed' },
      { key: 'position', ar: 'الوظيفة', en: 'Position', required: true, example: 'مهندس برمجيات', exampleEn: 'Software Engineer' },
      { key: 'department', ar: 'القسم', en: 'Department', required: false, example: 'تكنولوجيا المعلومات', exampleEn: 'IT' },
      { key: 'email', ar: 'البريد الإلكتروني', en: 'Email', required: false, example: 'ahmed@example.com', exampleEn: 'ahmed@example.com' },
      { key: 'phone', ar: 'الهاتف', en: 'Phone', required: false, example: '01234567890', exampleEn: '01234567890' },
      { key: 'hire_date', ar: 'تاريخ التعيين', en: 'Hire Date', required: false, example: '2024-01-15', exampleEn: '2024-01-15' },
      { key: 'basic_salary', ar: 'الراتب الأساسي', en: 'Basic Salary', required: false, example: '15000', exampleEn: '15000' }
    ],
    customers: [
      { key: 'name', ar: 'الاسم', en: 'Name', required: true, example: 'شركة ABC', exampleEn: 'ABC Company' },
      { key: 'email', ar: 'البريد الإلكتروني', en: 'Email', required: false, example: 'info@abc.com', exampleEn: 'info@abc.com' },
      { key: 'phone', ar: 'الهاتف', en: 'Phone', required: false, example: '01234567890', exampleEn: '01234567890' },
      { key: 'address', ar: 'العنوان', en: 'Address', required: false, example: 'القاهرة', exampleEn: 'Cairo' },
      { key: 'balance', ar: 'الرصيد', en: 'Balance', required: false, example: '5000', exampleEn: '5000' }
    ],
    suppliers: [
      { key: 'name', ar: 'الاسم', en: 'Name', required: true, example: 'مورد XYZ', exampleEn: 'XYZ Supplier' },
      { key: 'email', ar: 'البريد الإلكتروني', en: 'Email', required: false, example: 'info@xyz.com', exampleEn: 'info@xyz.com' },
      { key: 'phone', ar: 'الهاتف', en: 'Phone', required: false, example: '01234567890', exampleEn: '01234567890' },
      { key: 'address', ar: 'العنوان', en: 'Address', required: false, example: 'الجيزة', exampleEn: 'Giza' },
      { key: 'balance', ar: 'الرصيد', en: 'Balance', required: false, example: '10000', exampleEn: '10000' }
    ],
    inventory: [
      { key: 'name', ar: 'الاسم', en: 'Name', required: true, example: 'منتج 1', exampleEn: 'Product 1' },
      { key: 'category', ar: 'الفئة', en: 'Category', required: false, example: 'مواد خام', exampleEn: 'Raw Materials' },
      { key: 'quantity', ar: 'الكمية', en: 'Quantity', required: false, example: '100', exampleEn: '100' },
      { key: 'unit', ar: 'الوحدة', en: 'Unit', required: false, example: 'كيلو', exampleEn: 'kg' },
      { key: 'unit_price', ar: 'سعر الوحدة', en: 'Unit Price', required: false, example: '50', exampleEn: '50' },
      { key: 'min_stock', ar: 'الحد الأدنى', en: 'Min Stock', required: false, example: '20', exampleEn: '20' }
    ],
    invoices: [
      { key: 'invoice_number', ar: 'رقم الفاتورة', en: 'Invoice Number', required: false, example: 'INV-001', exampleEn: 'INV-001' },
      { key: 'customer_name', ar: 'اسم العميل', en: 'Customer Name', required: true, example: 'عميل 1', exampleEn: 'Customer 1' },
      { key: 'date', ar: 'التاريخ', en: 'Date', required: false, example: '2024-01-15', exampleEn: '2024-01-15' },
      { key: 'due_date', ar: 'تاريخ الاستحقاق', en: 'Due Date', required: false, example: '2024-02-15', exampleEn: '2024-02-15' },
      { key: 'amount', ar: 'المبلغ', en: 'Amount', required: true, example: '5000', exampleEn: '5000' },
      { key: 'status', ar: 'الحالة', en: 'Status', required: false, example: 'pending', exampleEn: 'pending' }
    ],
    purchases: [
      { key: 'purchase_number', ar: 'رقم الشراء', en: 'Purchase Number', required: false, example: 'PO-001', exampleEn: 'PO-001' },
      { key: 'supplier_name', ar: 'اسم المورد', en: 'Supplier Name', required: true, example: 'مورد 1', exampleEn: 'Supplier 1' },
      { key: 'date', ar: 'التاريخ', en: 'Date', required: false, example: '2024-01-15', exampleEn: '2024-01-15' },
      { key: 'amount', ar: 'المبلغ', en: 'Amount', required: true, example: '10000', exampleEn: '10000' },
      { key: 'status', ar: 'الحالة', en: 'Status', required: false, example: 'pending', exampleEn: 'pending' }
    ],
    revenue: [
      { key: 'date', ar: 'التاريخ', en: 'Date', required: true, example: '2024-01-15', exampleEn: '2024-01-15' },
      { key: 'description', ar: 'الوصف', en: 'Description', required: true, example: 'مبيعات منتجات', exampleEn: 'Product Sales' },
      { key: 'amount', ar: 'المبلغ', en: 'Amount', required: true, example: '25000', exampleEn: '25000' },
      { key: 'category', ar: 'الفئة', en: 'Category', required: false, example: 'مبيعات', exampleEn: 'Sales' }
    ],
    expense: [
      { key: 'date', ar: 'التاريخ', en: 'Date', required: true, example: '2024-01-15', exampleEn: '2024-01-15' },
      { key: 'description', ar: 'الوصف', en: 'Description', required: true, example: 'إيجار مكتب', exampleEn: 'Office Rent' },
      { key: 'amount', ar: 'المبلغ', en: 'Amount', required: true, example: '5000', exampleEn: '5000' },
      { key: 'category', ar: 'الفئة', en: 'Category', required: false, example: 'إيجارات', exampleEn: 'Rent' }
    ]
  };

  const getCurrentColumns = () => {
    const type = dataType || importType;
    return columnRequirements[type] || [];
  };

  const getEndpoint = () => {
    if (importType === 'revenue' || importType === 'expense') {
      return '/api/import/financial';
    }
    return `/api/import/${importType}`;
  };

  const handleFileUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setUploadResult(null);

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', selectedFile);
      
      if (dataType) {
        formData.append('data_type', dataType);
      }

      const response = await fetch(`${API_URL}${getEndpoint()}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const result = await response.json();
      
      if (response.ok) {
        setUploadResult({
          success: true,
          ...result
        });
        if (onSuccess) {
          onSuccess(result);
        }
      } else {
        setUploadResult({
          success: false,
          message: result.detail || 'Import failed'
        });
      }
    } catch (error) {
      setUploadResult({
        success: false,
        message: error.message
      });
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = async () => {
    try {
      const token = localStorage.getItem('token');
      const templateType = dataType || importType;
      const response = await fetch(`${API_URL}/api/import/template/${templateType}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const template = await response.json();
        
        // Create CSV content with Arabic headers
        const headers = template.columns_ar.join(',');
        const sampleRow = template.sample.length > 0 
          ? Object.values(template.sample[0]).join(',')
          : '';
        
        const csvContent = `\uFEFF${headers}\n${sampleRow}`;
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `template_${templateType}.csv`;
        link.click();
      }
    } catch (error) {
      console.error('Error downloading template:', error);
    }
  };

  // Download errors as CSV
  const downloadErrors = () => {
    if (!uploadResult?.error_details?.length) return;
    
    const errorContent = uploadResult.error_details.map((error, idx) => 
      `${idx + 1},${error}`
    ).join('\n');
    
    const headers = language === 'ar' ? 'رقم,الخطأ' : 'Number,Error';
    const csvContent = `\uFEFF${headers}\n${errorContent}`;
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `import_errors_${importType}_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
  };

  const label = typeLabels[importType] || { ar: importType, en: importType };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setShowModal(true);
          setSelectedFile(null);
          setUploadResult(null);
        }}
        className="flex items-center gap-2 text-blue-600 border-blue-300 hover:bg-blue-50"
        data-testid={`import-btn-${importType}`}
      >
        <Upload className="h-4 w-4" />
        <span>{language === 'ar' ? 'استيراد' : 'Import'}</span>
      </Button>

      {/* Import Modal */}
      {showModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowModal(false)}
        >
          <div 
            className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            dir={isRTL ? 'rtl' : 'ltr'}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500 text-white">
                  <Upload className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                    {language === 'ar' 
                      ? `استيراد ${label.ar}`
                      : `Import ${label.en}`}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {language === 'ar' 
                      ? 'اختر ملف Excel أو CSV'
                      : 'Select an Excel or CSV file'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* File Format Section */}
            <div className="mb-4">
              <button
                onClick={() => setShowFormat(!showFormat)}
                className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-200 dark:border-purple-800 rounded-lg hover:from-purple-100 hover:to-indigo-100 dark:hover:from-purple-900/30 dark:hover:to-indigo-900/30 transition-all"
              >
                <div className="flex items-center gap-2">
                  <Table className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  <span className="text-sm font-medium text-purple-800 dark:text-purple-300">
                    {language === 'ar' ? 'شكل الملف المطلوب' : 'Required File Format'}
                  </span>
                </div>
                {showFormat ? (
                  <EyeOff className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                ) : (
                  <Eye className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                )}
              </button>

              {showFormat && (
                <div className="mt-3 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-100 dark:bg-gray-700">
                        <th className="px-3 py-2 text-start font-semibold text-gray-700 dark:text-gray-200">
                          {language === 'ar' ? 'العمود' : 'Column'}
                        </th>
                        <th className="px-3 py-2 text-center font-semibold text-gray-700 dark:text-gray-200">
                          {language === 'ar' ? 'مطلوب؟' : 'Required?'}
                        </th>
                        <th className="px-3 py-2 text-start font-semibold text-gray-700 dark:text-gray-200">
                          {language === 'ar' ? 'مثال' : 'Example'}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {getCurrentColumns().map((col, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          <td className="px-3 py-2">
                            <span className="font-medium text-gray-900 dark:text-white">
                              {language === 'ar' ? col.ar : col.en}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            {col.required ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                {language === 'ar' ? 'نعم' : 'Yes'}
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                                {language === 'ar' ? 'لا' : 'No'}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                            <code className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-xs">
                              {language === 'ar' ? col.example : col.exampleEn}
                            </code>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="p-2 bg-amber-50 dark:bg-amber-900/20 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1">
                      <Info className="h-3 w-3" />
                      {language === 'ar' 
                        ? 'يمكن استخدام الأسماء العربية أو الإنجليزية للأعمدة'
                        : 'You can use Arabic or English column names'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Template Download */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-500 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-blue-800 dark:text-blue-300 mb-2">
                    {language === 'ar' 
                      ? 'قم بتحميل القالب للتعرف على الأعمدة المطلوبة'
                      : 'Download template to see required columns'}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={downloadTemplate}
                    className="text-blue-600 border-blue-300 hover:bg-blue-100 h-7 text-xs"
                  >
                    <Download className="h-3 w-3 mr-1" />
                    {language === 'ar' ? 'تحميل القالب' : 'Download Template'}
                  </Button>
                </div>
              </div>
            </div>

            {/* File Upload Area */}
            <div className="mb-4">
              <div 
                className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
                  selectedFile 
                    ? 'border-green-300 bg-green-50' 
                    : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                }`}
                onClick={() => fileInputRef.current?.click()}
              >
                {selectedFile ? (
                  <div className="space-y-1">
                    <CheckCircle className="h-8 w-8 mx-auto text-green-500" />
                    <p className="font-medium text-green-700 text-sm">{selectedFile.name}</p>
                    <p className="text-xs text-gray-500">
                      {(selectedFile.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                ) : (
                  <>
                    <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                    <p className="text-gray-600 text-sm">
                      {language === 'ar' 
                        ? 'انقر لاختيار ملف'
                        : 'Click to select a file'}
                    </p>
                    <p className="text-xs text-gray-400">
                      .xlsx, .xls, .csv
                    </p>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => setSelectedFile(e.target.files[0])}
                />
              </div>
            </div>

            {/* Upload Result */}
            {uploadResult && (
              <div className={`rounded-lg p-3 mb-4 ${
                uploadResult.success && uploadResult.errors === 0 
                  ? 'bg-green-50 border border-green-200' 
                  : uploadResult.success && uploadResult.errors > 0
                  ? 'bg-yellow-50 border border-yellow-200'
                  : 'bg-red-50 border border-red-200'
              }`}>
                <div className="flex items-start gap-2">
                  {uploadResult.success && uploadResult.errors === 0 ? (
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                  ) : uploadResult.success && uploadResult.errors > 0 ? (
                    <FileWarning className="h-4 w-4 text-yellow-600 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-500 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className={`font-medium text-sm ${
                      uploadResult.success && uploadResult.errors === 0 
                        ? 'text-green-700' 
                        : uploadResult.success && uploadResult.errors > 0
                        ? 'text-yellow-700'
                        : 'text-red-700'
                    }`}>
                      {uploadResult.success && uploadResult.errors === 0
                        ? (language === 'ar' ? 'تم الاستيراد بنجاح!' : 'Import completed!')
                        : uploadResult.success && uploadResult.errors > 0
                        ? (language === 'ar' ? 'تم الاستيراد مع بعض الأخطاء' : 'Import completed with errors')
                        : (language === 'ar' ? 'فشل الاستيراد' : 'Import failed')}
                    </p>
                    {uploadResult.success && (
                      <div className="text-xs text-gray-600 mt-1 space-y-1">
                        <p>{language === 'ar' ? 'الإجمالي:' : 'Total:'} {uploadResult.total}</p>
                        <p className="text-green-600">{language === 'ar' ? 'نجح:' : 'Success:'} {uploadResult.success}</p>
                        {uploadResult.errors > 0 && (
                          <p className="text-red-600">{language === 'ar' ? 'فشل:' : 'Failed:'} {uploadResult.errors}</p>
                        )}
                      </div>
                    )}
                    {!uploadResult.success && uploadResult.message && (
                      <p className="text-xs text-red-600 mt-1">{uploadResult.message}</p>
                    )}
                    {/* Download Errors Button */}
                    {uploadResult.error_details?.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={downloadErrors}
                        className="mt-2 text-red-600 border-red-300 hover:bg-red-50 h-7 text-xs"
                      >
                        <Download className="h-3 w-3 mr-1" />
                        {language === 'ar' ? 'تحميل الأخطاء' : 'Download Errors'}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                onClick={handleFileUpload}
                disabled={!selectedFile || uploading}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {language === 'ar' ? 'جاري...' : 'Importing...'}
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'استيراد' : 'Import'}
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowModal(false)}
              >
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ImportButton;
