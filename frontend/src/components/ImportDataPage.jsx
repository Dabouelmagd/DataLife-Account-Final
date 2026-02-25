import React, { useState, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import {
  Upload, FileSpreadsheet, Users, Building2, Package, FileText,
  ShoppingCart, Wallet, Download, CheckCircle, XCircle, Clock,
  AlertCircle, Loader2, X, Info, ChevronDown, ChevronUp, Eye, EyeOff
} from 'lucide-react';

const ImportDataPage = ({ language }) => {
  const isRTL = language === 'ar';
  const [importHistory, setImportHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedType, setSelectedType] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [expandedRow, setExpandedRow] = useState(null);
  const [showFormat, setShowFormat] = useState(true);

  const API_URL = process.env.REACT_APP_BACKEND_URL;

  // Column requirements for each type
  const columnRequirements = {
    employees: [
      { key: 'name', ar: 'الاسم', en: 'Name', required: true, example: 'أحمد محمد' },
      { key: 'position', ar: 'الوظيفة', en: 'Position', required: true, example: 'مهندس برمجيات' },
      { key: 'department', ar: 'القسم', en: 'Department', required: false, example: 'تكنولوجيا المعلومات' },
      { key: 'email', ar: 'البريد الإلكتروني', en: 'Email', required: false, example: 'ahmed@example.com' },
      { key: 'phone', ar: 'الهاتف', en: 'Phone', required: false, example: '01234567890' },
      { key: 'hire_date', ar: 'تاريخ التعيين', en: 'Hire Date', required: false, example: '2024-01-15' },
      { key: 'basic_salary', ar: 'الراتب الأساسي', en: 'Basic Salary', required: false, example: '15000' }
    ],
    customers: [
      { key: 'name', ar: 'الاسم', en: 'Name', required: true, example: 'شركة ABC' },
      { key: 'email', ar: 'البريد الإلكتروني', en: 'Email', required: false, example: 'info@abc.com' },
      { key: 'phone', ar: 'الهاتف', en: 'Phone', required: false, example: '01234567890' },
      { key: 'address', ar: 'العنوان', en: 'Address', required: false, example: 'القاهرة' },
      { key: 'balance', ar: 'الرصيد', en: 'Balance', required: false, example: '5000' }
    ],
    suppliers: [
      { key: 'name', ar: 'الاسم', en: 'Name', required: true, example: 'مورد XYZ' },
      { key: 'email', ar: 'البريد الإلكتروني', en: 'Email', required: false, example: 'info@xyz.com' },
      { key: 'phone', ar: 'الهاتف', en: 'Phone', required: false, example: '01234567890' },
      { key: 'address', ar: 'العنوان', en: 'Address', required: false, example: 'الجيزة' },
      { key: 'balance', ar: 'الرصيد', en: 'Balance', required: false, example: '10000' }
    ],
    inventory: [
      { key: 'name', ar: 'الاسم', en: 'Name', required: true, example: 'منتج 1' },
      { key: 'category', ar: 'الفئة', en: 'Category', required: false, example: 'مواد خام' },
      { key: 'quantity', ar: 'الكمية', en: 'Quantity', required: false, example: '100' },
      { key: 'unit', ar: 'الوحدة', en: 'Unit', required: false, example: 'كيلو' },
      { key: 'unit_price', ar: 'سعر الوحدة', en: 'Unit Price', required: false, example: '50' },
      { key: 'min_stock', ar: 'الحد الأدنى', en: 'Min Stock', required: false, example: '20' }
    ],
    invoices: [
      { key: 'invoice_number', ar: 'رقم الفاتورة', en: 'Invoice Number', required: false, example: 'INV-001' },
      { key: 'customer_name', ar: 'اسم العميل', en: 'Customer Name', required: true, example: 'عميل 1' },
      { key: 'date', ar: 'التاريخ', en: 'Date', required: false, example: '2024-01-15' },
      { key: 'due_date', ar: 'تاريخ الاستحقاق', en: 'Due Date', required: false, example: '2024-02-15' },
      { key: 'amount', ar: 'المبلغ', en: 'Amount', required: true, example: '5000' },
      { key: 'status', ar: 'الحالة', en: 'Status', required: false, example: 'pending' }
    ],
    purchases: [
      { key: 'purchase_number', ar: 'رقم الشراء', en: 'Purchase Number', required: false, example: 'PO-001' },
      { key: 'supplier_name', ar: 'اسم المورد', en: 'Supplier Name', required: true, example: 'مورد 1' },
      { key: 'date', ar: 'التاريخ', en: 'Date', required: false, example: '2024-01-15' },
      { key: 'amount', ar: 'المبلغ', en: 'Amount', required: true, example: '10000' },
      { key: 'status', ar: 'الحالة', en: 'Status', required: false, example: 'pending' }
    ],
    revenue: [
      { key: 'date', ar: 'التاريخ', en: 'Date', required: true, example: '2024-01-15' },
      { key: 'description', ar: 'الوصف', en: 'Description', required: true, example: 'مبيعات منتجات' },
      { key: 'amount', ar: 'المبلغ', en: 'Amount', required: true, example: '25000' },
      { key: 'category', ar: 'الفئة', en: 'Category', required: false, example: 'مبيعات' }
    ],
    expenses: [
      { key: 'date', ar: 'التاريخ', en: 'Date', required: true, example: '2024-01-15' },
      { key: 'description', ar: 'الوصف', en: 'Description', required: true, example: 'إيجار مكتب' },
      { key: 'amount', ar: 'المبلغ', en: 'Amount', required: true, example: '5000' },
      { key: 'category', ar: 'الفئة', en: 'Category', required: false, example: 'إيجارات' }
    ]
  };

  const getCurrentColumns = () => {
    if (!selectedType) return [];
    return columnRequirements[selectedType.dataType || selectedType.id] || [];
  };

  // Import types configuration
  const importTypes = [
    {
      id: 'employees',
      name: language === 'ar' ? 'الموظفين' : 'Employees',
      icon: <Users className="h-6 w-6" />,
      color: 'bg-blue-500',
      description: language === 'ar' ? 'استيراد بيانات الموظفين' : 'Import employee data',
      endpoint: '/api/import/employees'
    },
    {
      id: 'customers',
      name: language === 'ar' ? 'العملاء' : 'Customers',
      icon: <Building2 className="h-6 w-6" />,
      color: 'bg-green-500',
      description: language === 'ar' ? 'استيراد بيانات العملاء' : 'Import customer data',
      endpoint: '/api/import/customers'
    },
    {
      id: 'suppliers',
      name: language === 'ar' ? 'الموردين' : 'Suppliers',
      icon: <ShoppingCart className="h-6 w-6" />,
      color: 'bg-orange-500',
      description: language === 'ar' ? 'استيراد بيانات الموردين' : 'Import supplier data',
      endpoint: '/api/import/suppliers'
    },
    {
      id: 'inventory',
      name: language === 'ar' ? 'المخزون' : 'Inventory',
      icon: <Package className="h-6 w-6" />,
      color: 'bg-purple-500',
      description: language === 'ar' ? 'استيراد بيانات المخزون' : 'Import inventory data',
      endpoint: '/api/import/inventory'
    },
    {
      id: 'invoices',
      name: language === 'ar' ? 'الفواتير' : 'Invoices',
      icon: <FileText className="h-6 w-6" />,
      color: 'bg-cyan-500',
      description: language === 'ar' ? 'استيراد الفواتير' : 'Import invoices',
      endpoint: '/api/import/invoices'
    },
    {
      id: 'purchases',
      name: language === 'ar' ? 'المشتريات' : 'Purchases',
      icon: <ShoppingCart className="h-6 w-6" />,
      color: 'bg-pink-500',
      description: language === 'ar' ? 'استيراد المشتريات' : 'Import purchases',
      endpoint: '/api/import/purchases'
    },
    {
      id: 'revenue',
      name: language === 'ar' ? 'الإيرادات' : 'Revenues',
      icon: <Wallet className="h-6 w-6" />,
      color: 'bg-emerald-500',
      description: language === 'ar' ? 'استيراد الإيرادات' : 'Import revenues',
      endpoint: '/api/import/financial',
      dataType: 'revenue'
    },
    {
      id: 'expenses',
      name: language === 'ar' ? 'المصروفات' : 'Expenses',
      icon: <Wallet className="h-6 w-6" />,
      color: 'bg-red-500',
      description: language === 'ar' ? 'استيراد المصروفات' : 'Import expenses',
      endpoint: '/api/import/financial',
      dataType: 'expense'
    }
  ];

  // Fetch import history
  const fetchHistory = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/import/history`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setImportHistory(data);
      }
    } catch (error) {
      console.error('Error fetching import history:', error);
    } finally {
      setLoading(false);
    }
  }, [API_URL]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Handle file upload
  const handleFileUpload = async () => {
    if (!selectedFile || !selectedType) return;

    setUploading(true);
    setUploadResult(null);

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', selectedFile);
      
      if (selectedType.dataType) {
        formData.append('data_type', selectedType.dataType);
      }

      const response = await fetch(`${API_URL}${selectedType.endpoint}`, {
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
        fetchHistory();
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

  // Download template
  const downloadTemplate = async (typeId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/import/template/${typeId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const template = await response.json();
        
        // Create CSV content
        const headers = template.columns_ar.join(',');
        const sampleRow = template.sample.length > 0 
          ? Object.values(template.sample[0]).join(',')
          : '';
        
        const csvContent = `\uFEFF${headers}\n${sampleRow}`;
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `template_${typeId}.csv`;
        link.click();
      }
    } catch (error) {
      console.error('Error downloading template:', error);
    }
  };

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {language === 'ar' ? 'استيراد البيانات' : 'Data Import'}
          </h1>
          <p className="text-gray-500 mt-1">
            {language === 'ar' 
              ? 'استيراد البيانات من ملفات Excel أو CSV'
              : 'Import data from Excel or CSV files'}
          </p>
        </div>
      </div>

      {/* Import Type Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {importTypes.map((type) => (
          <Card 
            key={type.id} 
            className="cursor-pointer hover:shadow-lg transition-all border-2 hover:border-blue-300"
            onClick={() => {
              setSelectedType(type);
              setShowImportModal(true);
              setSelectedFile(null);
              setUploadResult(null);
            }}
            data-testid={`import-card-${type.id}`}
          >
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${type.color} text-white`}>
                  {type.icon}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{type.name}</h3>
                  <p className="text-sm text-gray-500">{type.description}</p>
                </div>
                <Upload className="h-5 w-5 text-gray-400" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Import History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            {language === 'ar' ? 'سجل الاستيراد' : 'Import History'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : importHistory.length === 0 ? (
            <div className="text-center py-12">
              <FileSpreadsheet className="h-16 w-16 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">
                {language === 'ar' 
                  ? 'لا توجد عمليات استيراد سابقة'
                  : 'No import history yet'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{language === 'ar' ? 'النوع' : 'Type'}</TableHead>
                  <TableHead>{language === 'ar' ? 'اسم الملف' : 'Filename'}</TableHead>
                  <TableHead>{language === 'ar' ? 'التاريخ' : 'Date'}</TableHead>
                  <TableHead>{language === 'ar' ? 'الإجمالي' : 'Total'}</TableHead>
                  <TableHead>{language === 'ar' ? 'نجح' : 'Success'}</TableHead>
                  <TableHead>{language === 'ar' ? 'أخطاء' : 'Errors'}</TableHead>
                  <TableHead>{language === 'ar' ? 'بواسطة' : 'By'}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importHistory.map((record) => (
                  <React.Fragment key={record.id}>
                    <TableRow className="hover:bg-gray-50">
                      <TableCell>
                        <Badge variant="outline">
                          {language === 'ar' ? record.type_ar : record.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {record.filename}
                      </TableCell>
                      <TableCell>
                        {new Date(record.created_at).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US')}
                      </TableCell>
                      <TableCell>{record.total_rows}</TableCell>
                      <TableCell>
                        <span className="text-green-600 font-semibold flex items-center gap-1">
                          <CheckCircle className="h-4 w-4" />
                          {record.success_count}
                        </span>
                      </TableCell>
                      <TableCell>
                        {record.error_count > 0 ? (
                          <span className="text-red-600 font-semibold flex items-center gap-1">
                            <XCircle className="h-4 w-4" />
                            {record.error_count}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-gray-500 text-sm">
                        {record.imported_by}
                      </TableCell>
                      <TableCell>
                        {record.error_count > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpandedRow(expandedRow === record.id ? null : record.id)}
                          >
                            {expandedRow === record.id ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                    {expandedRow === record.id && record.errors?.length > 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="bg-red-50 p-4">
                          <div className="text-sm">
                            <p className="font-semibold text-red-700 mb-2">
                              {language === 'ar' ? 'تفاصيل الأخطاء:' : 'Error Details:'}
                            </p>
                            <ul className="list-disc list-inside space-y-1 text-red-600">
                              {record.errors.map((error, idx) => (
                                <li key={idx}>{error}</li>
                              ))}
                            </ul>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Import Modal */}
      {showImportModal && selectedType && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowImportModal(false)}
        >
          <div 
            className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            dir={isRTL ? 'rtl' : 'ltr'}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${selectedType.color} text-white`}>
                  {selectedType.icon}
                </div>
                <div>
                  <h2 className="text-xl font-bold">
                    {language === 'ar' ? `استيراد ${selectedType.name}` : `Import ${selectedType.name}`}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {language === 'ar' 
                      ? 'اختر ملف Excel أو CSV'
                      : 'Select an Excel or CSV file'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowImportModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Template Download */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-500 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-blue-800 mb-2">
                    {language === 'ar' 
                      ? 'قم بتحميل القالب للتعرف على الأعمدة المطلوبة'
                      : 'Download the template to see required columns'}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadTemplate(selectedType.dataType || selectedType.id)}
                    className="text-blue-600 border-blue-300 hover:bg-blue-100"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {language === 'ar' ? 'تحميل القالب' : 'Download Template'}
                  </Button>
                </div>
              </div>
            </div>

            {/* File Upload Area */}
            <div className="mb-6">
              <div 
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                  selectedFile 
                    ? 'border-green-300 bg-green-50' 
                    : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                }`}
              >
                {selectedFile ? (
                  <div className="space-y-2">
                    <FileSpreadsheet className="h-12 w-12 mx-auto text-green-500" />
                    <p className="font-medium text-green-700">{selectedFile.name}</p>
                    <p className="text-sm text-gray-500">
                      {(selectedFile.size / 1024).toFixed(2)} KB
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedFile(null)}
                      className="text-red-500"
                    >
                      {language === 'ar' ? 'إزالة الملف' : 'Remove file'}
                    </Button>
                  </div>
                ) : (
                  <label className="cursor-pointer block">
                    <Upload className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                    <p className="text-gray-600 mb-2">
                      {language === 'ar' 
                        ? 'اسحب الملف هنا أو انقر للاختيار'
                        : 'Drag file here or click to select'}
                    </p>
                    <p className="text-sm text-gray-400">
                      {language === 'ar' 
                        ? 'الصيغ المدعومة: .xlsx, .xls, .csv'
                        : 'Supported formats: .xlsx, .xls, .csv'}
                    </p>
                    <input
                      type="file"
                      className="hidden"
                      accept=".xlsx,.xls,.csv"
                      onChange={(e) => setSelectedFile(e.target.files[0])}
                      data-testid="file-input"
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Upload Result */}
            {uploadResult && (
              <div className={`rounded-lg p-4 mb-4 ${
                uploadResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
              }`}>
                <div className="flex items-start gap-3">
                  {uploadResult.success ? (
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className={`font-medium ${uploadResult.success ? 'text-green-700' : 'text-red-700'}`}>
                      {uploadResult.success 
                        ? (language === 'ar' ? 'تم الاستيراد بنجاح!' : 'Import completed!')
                        : (language === 'ar' ? 'فشل الاستيراد' : 'Import failed')}
                    </p>
                    {uploadResult.success && (
                      <div className="mt-2 text-sm text-gray-600">
                        <p>{language === 'ar' ? 'الإجمالي:' : 'Total:'} {uploadResult.total}</p>
                        <p className="text-green-600">{language === 'ar' ? 'نجح:' : 'Success:'} {uploadResult.success}</p>
                        {uploadResult.errors > 0 && (
                          <p className="text-red-600">{language === 'ar' ? 'أخطاء:' : 'Errors:'} {uploadResult.errors}</p>
                        )}
                      </div>
                    )}
                    {!uploadResult.success && uploadResult.message && (
                      <p className="mt-1 text-sm text-red-600">{uploadResult.message}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                onClick={handleFileUpload}
                disabled={!selectedFile || uploading}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                data-testid="import-submit-btn"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {language === 'ar' ? 'جاري الاستيراد...' : 'Importing...'}
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
                onClick={() => setShowImportModal(false)}
                className="flex-1"
              >
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportDataPage;
