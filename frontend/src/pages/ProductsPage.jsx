import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import ModernSidebar from '../components/ModernSidebar';
import AppFooter from '../components/AppFooter';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Badge } from '../components/ui/badge';
import { Card, CardContent } from '../components/ui/card';
import { Checkbox } from '../components/ui/checkbox';
import { 
  Plus, Search, Package, Wrench, Edit
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api/invoice`;

const ProductsPage = () => {
  const { language } = useLanguage();
  const { isDark } = useTheme();
  const isRTL = language === 'ar';

  const [products, setProducts] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    name_en: '',
    description: '',
    unit: 'EA',
    unit_price: 0,
    cost_price: 0,
    tax_type: 'vat',
    tax_rate: 14,
    eta_code: '',
    is_service: false
  });

  const t = {
    ar: {
      products: 'المنتجات والخدمات',
      addProduct: 'إضافة منتج',
      addService: 'إضافة خدمة',
      editProduct: 'تعديل منتج',
      search: 'بحث...',
      code: 'الكود',
      name: 'الاسم',
      nameEn: 'الاسم بالإنجليزية',
      description: 'الوصف',
      unit: 'الوحدة',
      unitPrice: 'سعر البيع',
      costPrice: 'سعر التكلفة',
      taxType: 'نوع الضريبة',
      taxRate: 'نسبة الضريبة',
      etaCode: 'كود ETA',
      isService: 'خدمة',
      vat: 'ضريبة القيمة المضافة',
      exempt: 'معفى',
      zeroRated: 'صفري',
      save: 'حفظ',
      cancel: 'إلغاء',
      actions: 'الإجراءات',
      noProducts: 'لا يوجد منتجات',
      created: 'تم الإنشاء بنجاح',
      error: 'حدث خطأ',
      product: 'منتج',
      service: 'خدمة',
      totalProducts: 'إجمالي المنتجات',
      totalServices: 'إجمالي الخدمات'
    },
    en: {
      products: 'Products & Services',
      addProduct: 'Add Product',
      addService: 'Add Service',
      editProduct: 'Edit Product',
      search: 'Search...',
      code: 'Code',
      name: 'Name',
      nameEn: 'English Name',
      description: 'Description',
      unit: 'Unit',
      unitPrice: 'Sale Price',
      costPrice: 'Cost Price',
      taxType: 'Tax Type',
      taxRate: 'Tax Rate',
      etaCode: 'ETA Code',
      isService: 'Service',
      vat: 'VAT',
      exempt: 'Exempt',
      zeroRated: 'Zero Rated',
      save: 'Save',
      cancel: 'Cancel',
      actions: 'Actions',
      noProducts: 'No products found',
      created: 'Created successfully',
      error: 'An error occurred',
      product: 'Product',
      service: 'Service',
      totalProducts: 'Total Products',
      totalServices: 'Total Services'
    }
  };

  const text = t[language] || t.ar;
  const getToken = () => localStorage.getItem('token');

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const token = getToken();
      const response = await fetch(`${API}/products`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setProducts(data.products || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error(text.error);
    } finally {
      setLoading(false);
    }
  }, [text.error]);

  const fetchUnits = useCallback(async () => {
    try {
      const token = getToken();
      const response = await fetch(`${API}/units`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setUnits(data.units || []);
    } catch (error) {
      console.error('Error fetching units:', error);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchUnits();
  }, [fetchProducts, fetchUnits]);

  const handleSubmit = async () => {
    try {
      const token = getToken();
      const response = await fetch(`${API}/products`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        toast.success(text.created);
        setShowModal(false);
        resetForm();
        fetchProducts();
      } else {
        const error = await response.json();
        toast.error(error.detail || text.error);
      }
    } catch (error) {
      console.error('Error saving product:', error);
      toast.error(text.error);
    }
  };

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      name_en: '',
      description: '',
      unit: 'EA',
      unit_price: 0,
      cost_price: 0,
      tax_type: 'vat',
      tax_rate: 14,
      eta_code: '',
      is_service: false
    });
    setEditingProduct(null);
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      code: product.code || '',
      name: product.name || '',
      name_en: product.name_en || '',
      description: product.description || '',
      unit: product.unit || 'EA',
      unit_price: product.unit_price || 0,
      cost_price: product.cost_price || 0,
      tax_type: product.tax_type || 'vat',
      tax_rate: product.tax_rate || 14,
      eta_code: product.eta_code || '',
      is_service: product.is_service || false
    });
    setShowModal(true);
  };

  const filteredProducts = products.filter(product => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        product.name?.toLowerCase().includes(search) ||
        product.code?.toLowerCase().includes(search) ||
        product.description?.toLowerCase().includes(search)
      );
    }
    return true;
  });

  const productsCount = products.filter(p => !p.is_service).length;
  const servicesCount = products.filter(p => p.is_service).length;

  return (
    <div className={`flex min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <ModernSidebar />
      
      <div className="flex-1 flex flex-col">
        <main className={`flex-1 p-6 ${isRTL ? 'mr-64' : 'ml-64'}`}>
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {text.products}
            </h1>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <Card className={isDark ? 'bg-gray-800 border-gray-700' : ''}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {text.totalProducts}
                    </p>
                    <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {productsCount}
                    </p>
                  </div>
                  <Package className="w-10 h-10 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card className={isDark ? 'bg-gray-800 border-gray-700' : ''}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {text.totalServices}
                    </p>
                    <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {servicesCount}
                    </p>
                  </div>
                  <Wrench className="w-10 h-10 text-green-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search and Add Button */}
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 transform -translate-y-1/2 w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                <Input
                  placeholder={text.search}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`${isRTL ? 'pr-10' : 'pl-10'} ${isDark ? 'bg-gray-800 border-gray-700 text-white' : ''}`}
                  data-testid="search-input"
                />
              </div>
            </div>

            <Button 
              onClick={() => { resetForm(); setShowModal(true); }}
              className="bg-[#28376B] hover:bg-[#1e2a52] text-white"
              data-testid="add-product-btn"
            >
              <Plus className="w-4 h-4 mr-2" />
              {text.addProduct}
            </Button>
          </div>

          {/* Table */}
          <Card className={isDark ? 'bg-gray-800 border-gray-700' : ''}>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className={isDark ? 'border-gray-700' : ''}>
                    <TableHead className={isDark ? 'text-gray-300' : ''}>{text.code}</TableHead>
                    <TableHead className={isDark ? 'text-gray-300' : ''}>{text.name}</TableHead>
                    <TableHead className={isDark ? 'text-gray-300' : ''}>{text.unit}</TableHead>
                    <TableHead className={isDark ? 'text-gray-300' : ''}>{text.unitPrice}</TableHead>
                    <TableHead className={isDark ? 'text-gray-300' : ''}>{text.taxRate}</TableHead>
                    <TableHead className={isDark ? 'text-gray-300' : ''}>{text.isService}</TableHead>
                    <TableHead className={isDark ? 'text-gray-300' : ''}>{text.actions}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#28376B] mx-auto"></div>
                      </TableCell>
                    </TableRow>
                  ) : filteredProducts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className={`text-center py-8 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {text.noProducts}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredProducts.map((product) => (
                      <TableRow key={product.id} className={isDark ? 'border-gray-700 hover:bg-gray-750' : 'hover:bg-gray-50'}>
                        <TableCell className={`font-mono ${isDark ? 'text-gray-300' : ''}`}>
                          {product.code}
                        </TableCell>
                        <TableCell className={`font-medium ${isDark ? 'text-white' : ''}`}>
                          {product.name}
                          {product.name_en && (
                            <span className={`block text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                              {product.name_en}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className={isDark ? 'text-gray-300' : ''}>
                          {units.find(u => u.code === product.unit)?.[language === 'ar' ? 'name_ar' : 'name_en'] || product.unit}
                        </TableCell>
                        <TableCell className={isDark ? 'text-gray-300' : ''}>
                          {product.unit_price?.toLocaleString()} EGP
                        </TableCell>
                        <TableCell className={isDark ? 'text-gray-300' : ''}>
                          {product.tax_rate}%
                        </TableCell>
                        <TableCell>
                          <Badge className={product.is_service ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}>
                            {product.is_service ? (
                              <><Wrench className="w-3 h-3 mr-1" />{text.service}</>
                            ) : (
                              <><Package className="w-3 h-3 mr-1" />{text.product}</>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(product)}
                            data-testid={`edit-product-${product.id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </main>

        <AppFooter />
      </div>

      {/* Add/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className={`max-w-2xl ${isDark ? 'bg-gray-800 text-white' : ''}`}>
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? text.editProduct : (formData.is_service ? text.addService : text.addProduct)}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {text.code} *
                </label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                  className={isDark ? 'bg-gray-700 border-gray-600 text-white' : ''}
                  placeholder="PRD-001"
                  data-testid="product-code"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {text.name} *
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className={isDark ? 'bg-gray-700 border-gray-600 text-white' : ''}
                  data-testid="product-name"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {text.nameEn}
                </label>
                <Input
                  value={formData.name_en}
                  onChange={(e) => setFormData(prev => ({ ...prev, name_en: e.target.value }))}
                  className={isDark ? 'bg-gray-700 border-gray-600 text-white' : ''}
                  data-testid="product-name-en"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {text.unit}
                </label>
                <Select 
                  value={formData.unit} 
                  onValueChange={(val) => setFormData(prev => ({ ...prev, unit: val }))}
                >
                  <SelectTrigger className={isDark ? 'bg-gray-700 border-gray-600 text-white' : ''} data-testid="product-unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map(unit => (
                      <SelectItem key={unit.code} value={unit.code}>
                        {language === 'ar' ? unit.name_ar : unit.name_en} ({unit.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {text.unitPrice}
                </label>
                <Input
                  type="number"
                  value={formData.unit_price}
                  onChange={(e) => setFormData(prev => ({ ...prev, unit_price: parseFloat(e.target.value) || 0 }))}
                  className={isDark ? 'bg-gray-700 border-gray-600 text-white' : ''}
                  data-testid="product-price"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {text.costPrice}
                </label>
                <Input
                  type="number"
                  value={formData.cost_price}
                  onChange={(e) => setFormData(prev => ({ ...prev, cost_price: parseFloat(e.target.value) || 0 }))}
                  className={isDark ? 'bg-gray-700 border-gray-600 text-white' : ''}
                  data-testid="product-cost"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {text.taxType}
                </label>
                <Select 
                  value={formData.tax_type} 
                  onValueChange={(val) => setFormData(prev => ({ ...prev, tax_type: val }))}
                >
                  <SelectTrigger className={isDark ? 'bg-gray-700 border-gray-600 text-white' : ''} data-testid="product-tax-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vat">{text.vat}</SelectItem>
                    <SelectItem value="exempt">{text.exempt}</SelectItem>
                    <SelectItem value="zero_rated">{text.zeroRated}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {text.taxRate} (%)
                </label>
                <Input
                  type="number"
                  value={formData.tax_rate}
                  onChange={(e) => setFormData(prev => ({ ...prev, tax_rate: parseFloat(e.target.value) || 0 }))}
                  className={isDark ? 'bg-gray-700 border-gray-600 text-white' : ''}
                  disabled={formData.tax_type !== 'vat'}
                  data-testid="product-tax-rate"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {text.etaCode}
                </label>
                <Input
                  value={formData.eta_code}
                  onChange={(e) => setFormData(prev => ({ ...prev, eta_code: e.target.value }))}
                  className={isDark ? 'bg-gray-700 border-gray-600 text-white' : ''}
                  placeholder="EG-123456789"
                  data-testid="product-eta-code"
                />
              </div>

              <div className="flex items-center space-x-2 pt-6">
                <Checkbox
                  id="is_service"
                  checked={formData.is_service}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_service: checked }))}
                  data-testid="product-is-service"
                />
                <label htmlFor="is_service" className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {text.isService}
                </label>
              </div>

              <div className="md:col-span-2">
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {text.description}
                </label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className={isDark ? 'bg-gray-700 border-gray-600 text-white' : ''}
                  data-testid="product-description"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowModal(false)} data-testid="cancel-btn">
                {text.cancel}
              </Button>
              <Button 
                onClick={handleSubmit} 
                className="bg-[#28376B] hover:bg-[#1e2a52] text-white"
                disabled={!formData.code || !formData.name}
                data-testid="save-product-btn"
              >
                {text.save}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProductsPage;
