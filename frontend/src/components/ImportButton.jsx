import React, { useState, useRef } from 'react';
import { Button } from './ui/button';
import { Upload, Loader2, CheckCircle, AlertCircle, X, Download, Info, FileWarning } from 'lucide-react';

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
            className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            dir={isRTL ? 'rtl' : 'ltr'}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500 text-white">
                  <Upload className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">
                    {language === 'ar' 
                      ? `استيراد ${label.ar}`
                      : `Import ${label.en}`}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {language === 'ar' 
                      ? 'اختر ملف Excel أو CSV'
                      : 'Select an Excel or CSV file'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Template Download */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-500 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-blue-800 mb-2">
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
