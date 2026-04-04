import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
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
import { Plus, Search, Package, Wrench, Edit } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api/invoice`;

const ProductsPage = () => {
  const { language } = useLanguage();
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
    } finally {
      setLoading(false);
    }
  }, []);

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
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{text.products}</h1>
        <p className="text-gray-500 text-sm mt-1">
          {language === 'ar' ? 'إدارة المنتجات والخدمات' : 'Manage products and services'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{text.totalProducts}</p>
                <p className="text-2xl font-bold text-gray-900">{productsCount}</p>
              </div>
              <Package className="w-10 h-10 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{text.totalServices}</p>
                <p className="text-2xl font-bold text-gray-900">{servicesCount}</p>
              </div>
              <Wrench className="w-10 h-10 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500`} />
            <Input
              placeholder={text.search}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={isRTL ? 'pr-10' : 'pl-10'}
            />
          </div>
        </div>
        <Button 
          onClick={() => { resetForm(); setShowModal(true); }}
          className="bg-[#28376B] hover:bg-[#1e2a52] text-white"
        >
          <Plus className="w-4 h-4 mr-2" />{text.addProduct}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{text.code}</TableHead>
                <TableHead>{text.name}</TableHead>
                <TableHead>{text.unit}</TableHead>
                <TableHead>{text.unitPrice}</TableHead>
                <TableHead>{text.taxRate}</TableHead>
                <TableHead>{text.isService}</TableHead>
                <TableHead>{text.actions}</TableHead>
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
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">{text.noProducts}</TableCell>
                </TableRow>
              ) : (
                filteredProducts.map((product) => (
                  <TableRow key={product.id} className="hover:bg-gray-50">
                    <TableCell className="font-mono">{product.code}</TableCell>
                    <TableCell className="font-medium">
                      {product.name}
                      {product.name_en && <span className="block text-xs text-gray-500">{product.name_en}</span>}
                    </TableCell>
                    <TableCell>
                      {units.find(u => u.code === product.unit)?.[language === 'ar' ? 'name_ar' : 'name_en'] || product.unit}
                    </TableCell>
                    <TableCell>{product.unit_price?.toLocaleString()} EGP</TableCell>
                    <TableCell>{product.tax_rate}%</TableCell>
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
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(product)}>
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

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? text.editProduct : (formData.is_service ? text.addService : text.addProduct)}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">{text.code} *</label>
                <Input value={formData.code} onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))} placeholder="PRD-001" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">{text.name} *</label>
                <Input value={formData.name} onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">{text.nameEn}</label>
                <Input value={formData.name_en} onChange={(e) => setFormData(prev => ({ ...prev, name_en: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">{text.unit}</label>
                <Select value={formData.unit} onValueChange={(val) => setFormData(prev => ({ ...prev, unit: val }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
                <label className="block text-sm font-medium mb-1 text-gray-700">{text.unitPrice}</label>
                <Input type="number" value={formData.unit_price} onChange={(e) => setFormData(prev => ({ ...prev, unit_price: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">{text.costPrice}</label>
                <Input type="number" value={formData.cost_price} onChange={(e) => setFormData(prev => ({ ...prev, cost_price: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">{text.taxType}</label>
                <Select value={formData.tax_type} onValueChange={(val) => setFormData(prev => ({ ...prev, tax_type: val }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vat">{text.vat}</SelectItem>
                    <SelectItem value="exempt">{text.exempt}</SelectItem>
                    <SelectItem value="zero_rated">{text.zeroRated}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">{text.taxRate} (%)</label>
                <Input type="number" value={formData.tax_rate} onChange={(e) => setFormData(prev => ({ ...prev, tax_rate: parseFloat(e.target.value) || 0 }))} disabled={formData.tax_type !== 'vat'} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">{text.etaCode}</label>
                <Input value={formData.eta_code} onChange={(e) => setFormData(prev => ({ ...prev, eta_code: e.target.value }))} placeholder="EG-123456789" />
              </div>
              <div className="flex items-center space-x-2 pt-6">
                <Checkbox
                  id="is_service"
                  checked={formData.is_service}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_service: checked }))}
                />
                <label htmlFor="is_service" className="text-sm font-medium text-gray-700">{text.isService}</label>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1 text-gray-700">{text.description}</label>
                <Input value={formData.description} onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))} />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowModal(false)}>{text.cancel}</Button>
              <Button 
                onClick={handleSubmit} 
                className="bg-[#28376B] hover:bg-[#1e2a52] text-white"
                disabled={!formData.code || !formData.name}
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
