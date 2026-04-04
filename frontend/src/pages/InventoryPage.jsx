import React, { useState, useEffect, useCallback } from 'react';
import { 
  Package, Warehouse, Tags, Ruler, Plus, Search, Filter,
  ArrowRightLeft, ClipboardCheck, AlertTriangle, TrendingDown,
  BarChart3, Edit, Trash2, Eye, CheckCircle, XCircle,
  ChevronDown, ChevronRight, Upload, Download, RefreshCw
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import { useLanguage } from '../contexts/LanguageContext';

const API = process.env.REACT_APP_BACKEND_URL + '/api/inventory';

const getToken = () => localStorage.getItem('token');

export default function InventoryPage() {
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState('products');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Data states
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [movements, setMovements] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const [summary, setSummary] = useState(null);
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);

  const text = {
    ar: {
      inventory: 'إدارة المخزون',
      products: 'المنتجات',
      warehouses: 'المخازن',
      categories: 'التصنيفات',
      units: 'الوحدات',
      movements: 'الحركات',
      transfers: 'التحويلات',
      adjustments: 'التسويات',
      reports: 'التقارير',
      search: 'بحث...',
      add: 'إضافة',
      addProduct: 'إضافة منتج',
      addWarehouse: 'إضافة مخزن',
      addCategory: 'إضافة تصنيف',
      addMovement: 'إضافة حركة',
      addTransfer: 'تحويل مخزني',
      addAdjustment: 'تسوية مخزنية',
      code: 'الكود',
      name: 'الاسم',
      category: 'التصنيف',
      unit: 'الوحدة',
      quantity: 'الكمية',
      cost: 'التكلفة',
      price: 'السعر',
      value: 'القيمة',
      status: 'الحالة',
      actions: 'الإجراءات',
      totalValue: 'إجمالي قيمة المخزون',
      totalProducts: 'إجمالي المنتجات',
      lowStock: 'مخزون منخفض',
      expiringSoon: 'قارب على الانتهاء',
      inStock: 'متوفر',
      lowStockStatus: 'منخفض',
      outOfStock: 'نفذ',
      save: 'حفظ',
      cancel: 'إلغاء',
      edit: 'تعديل',
      delete: 'حذف',
      view: 'عرض',
      approve: 'اعتماد',
      draft: 'مسودة',
      approved: 'معتمد',
      pending: 'قيد الانتظار',
      completed: 'مكتمل',
      from: 'من',
      to: 'إلى',
      date: 'التاريخ',
      type: 'النوع',
      reference: 'المرجع',
      notes: 'ملاحظات',
      barcode: 'الباركود',
      sku: 'SKU',
      reorderLevel: 'حد إعادة الطلب',
      minStock: 'الحد الأدنى',
      maxStock: 'الحد الأقصى',
      taxRate: 'نسبة الضريبة',
      hasExpiry: 'له صلاحية',
      shelfLife: 'مدة الصلاحية (يوم)',
      movementTypes: {
        purchase: 'شراء',
        sales: 'بيع',
        transfer_in: 'تحويل وارد',
        transfer_out: 'تحويل صادر',
        adjustment_in: 'تسوية إضافة',
        adjustment_out: 'تسوية نقص',
        return_in: 'مرتجع من عميل',
        return_out: 'مرتجع لمورد',
        damage: 'تالف',
        expired: 'منتهي الصلاحية',
        opening: 'رصيد افتتاحي'
      }
    },
    en: {
      inventory: 'Inventory Management',
      products: 'Products',
      warehouses: 'Warehouses',
      categories: 'Categories',
      units: 'Units',
      movements: 'Movements',
      transfers: 'Transfers',
      adjustments: 'Adjustments',
      reports: 'Reports',
      search: 'Search...',
      add: 'Add',
      addProduct: 'Add Product',
      addWarehouse: 'Add Warehouse',
      addCategory: 'Add Category',
      addMovement: 'Add Movement',
      addTransfer: 'Stock Transfer',
      addAdjustment: 'Stock Adjustment',
      code: 'Code',
      name: 'Name',
      category: 'Category',
      unit: 'Unit',
      quantity: 'Quantity',
      cost: 'Cost',
      price: 'Price',
      value: 'Value',
      status: 'Status',
      actions: 'Actions',
      totalValue: 'Total Stock Value',
      totalProducts: 'Total Products',
      lowStock: 'Low Stock',
      expiringSoon: 'Expiring Soon',
      inStock: 'In Stock',
      lowStockStatus: 'Low',
      outOfStock: 'Out of Stock',
      save: 'Save',
      cancel: 'Cancel',
      edit: 'Edit',
      delete: 'Delete',
      view: 'View',
      approve: 'Approve',
      draft: 'Draft',
      approved: 'Approved',
      pending: 'Pending',
      completed: 'Completed',
      from: 'From',
      to: 'To',
      date: 'Date',
      type: 'Type',
      reference: 'Reference',
      notes: 'Notes',
      barcode: 'Barcode',
      sku: 'SKU',
      reorderLevel: 'Reorder Level',
      minStock: 'Min Stock',
      maxStock: 'Max Stock',
      taxRate: 'Tax Rate',
      hasExpiry: 'Has Expiry',
      shelfLife: 'Shelf Life (days)',
      movementTypes: {
        purchase: 'Purchase',
        sales: 'Sales',
        transfer_in: 'Transfer In',
        transfer_out: 'Transfer Out',
        adjustment_in: 'Adjustment In',
        adjustment_out: 'Adjustment Out',
        return_in: 'Customer Return',
        return_out: 'Supplier Return',
        damage: 'Damage',
        expired: 'Expired',
        opening: 'Opening Balance'
      }
    }
  }[language];

  // Fetch functions
  const fetchSummary = useCallback(async () => {
    try {
      const token = getToken();
      const response = await fetch(`${API}/stocks/summary`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setSummary(data);
    } catch (error) {
      console.error('Error fetching summary:', error);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const token = getToken();
      const response = await fetch(`${API}/products?limit=200`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setProducts(data.products || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  }, []);

  const fetchWarehouses = useCallback(async () => {
    try {
      const token = getToken();
      const response = await fetch(`${API}/warehouses`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setWarehouses(data.warehouses || []);
    } catch (error) {
      console.error('Error fetching warehouses:', error);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const token = getToken();
      const response = await fetch(`${API}/categories`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setCategories(data.categories || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
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

  const fetchMovements = useCallback(async () => {
    try {
      const token = getToken();
      const response = await fetch(`${API}/movements?limit=100`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setMovements(data.movements || []);
    } catch (error) {
      console.error('Error fetching movements:', error);
    }
  }, []);

  const fetchTransfers = useCallback(async () => {
    try {
      const token = getToken();
      const response = await fetch(`${API}/transfers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setTransfers(data.transfers || []);
    } catch (error) {
      console.error('Error fetching transfers:', error);
    }
  }, []);

  const fetchAdjustments = useCallback(async () => {
    try {
      const token = getToken();
      const response = await fetch(`${API}/adjustments`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setAdjustments(data.adjustments || []);
    } catch (error) {
      console.error('Error fetching adjustments:', error);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchSummary(),
        fetchProducts(),
        fetchWarehouses(),
        fetchCategories(),
        fetchUnits(),
        fetchMovements(),
        fetchTransfers(),
        fetchAdjustments()
      ]);
      setLoading(false);
    };
    loadData();
  }, [fetchSummary, fetchProducts, fetchWarehouses, fetchCategories, fetchUnits, fetchMovements, fetchTransfers, fetchAdjustments]);

  // Form state
  const [formData, setFormData] = useState({});

  const openModal = (type, item = null) => {
    setModalType(type);
    setSelectedItem(item);
    
    if (type === 'product') {
      setFormData(item || {
        code: '',
        name: '',
        name_en: '',
        barcode: '',
        sku: '',
        category_id: '',
        base_unit_id: '',
        cost_price: 0,
        sale_price: 0,
        tax_rate: 14,
        reorder_level: 0,
        min_stock: 0,
        max_stock: 0,
        has_expiry: false,
        shelf_life_days: 0
      });
    } else if (type === 'warehouse') {
      setFormData(item || {
        code: '',
        name: '',
        name_en: '',
        address: '',
        phone: '',
        is_default: false,
        allow_negative: false
      });
    } else if (type === 'category') {
      setFormData(item || {
        code: '',
        name: '',
        name_en: '',
        parent_id: ''
      });
    } else if (type === 'movement') {
      setFormData({
        movement_date: new Date().toISOString().split('T')[0],
        movement_type: 'purchase',
        product_id: '',
        warehouse_id: '',
        quantity: 0,
        unit_id: '',
        unit_cost: 0,
        notes: ''
      });
    } else if (type === 'transfer') {
      setFormData({
        transfer_date: new Date().toISOString().split('T')[0],
        from_warehouse_id: '',
        to_warehouse_id: '',
        lines: [{ product_id: '', quantity: 0 }],
        notes: ''
      });
    } else if (type === 'adjustment') {
      setFormData({
        adjustment_date: new Date().toISOString().split('T')[0],
        warehouse_id: '',
        adjustment_type: 'count',
        lines: [{ product_id: '', actual_qty: 0, reason: 'count' }],
        notes: ''
      });
    }
    
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      const token = getToken();
      let url = API;
      let method = selectedItem ? 'PUT' : 'POST';
      
      if (modalType === 'product') {
        url += selectedItem ? `/products/${selectedItem.id}` : '/products';
      } else if (modalType === 'warehouse') {
        url += selectedItem ? `/warehouses/${selectedItem.id}` : '/warehouses';
      } else if (modalType === 'category') {
        url += selectedItem ? `/categories/${selectedItem.id}` : '/categories';
      } else if (modalType === 'movement') {
        url += '/movements';
        method = 'POST';
      } else if (modalType === 'transfer') {
        url += '/transfers';
        method = 'POST';
      } else if (modalType === 'adjustment') {
        url += '/adjustments';
        method = 'POST';
      }
      
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        toast.success(language === 'ar' ? 'تم الحفظ بنجاح' : 'Saved successfully');
        setShowModal(false);
        
        // Refresh data
        if (modalType === 'product') fetchProducts();
        else if (modalType === 'warehouse') fetchWarehouses();
        else if (modalType === 'category') fetchCategories();
        else if (modalType === 'movement') { fetchMovements(); fetchSummary(); }
        else if (modalType === 'transfer') fetchTransfers();
        else if (modalType === 'adjustment') fetchAdjustments();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Error saving');
      }
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Error saving');
    }
  };

  const handleDelete = async (type, id) => {
    if (!window.confirm(language === 'ar' ? 'هل أنت متأكد من الحذف؟' : 'Are you sure you want to delete?')) return;
    
    try {
      const token = getToken();
      const response = await fetch(`${API}/${type}/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        toast.success(language === 'ar' ? 'تم الحذف بنجاح' : 'Deleted successfully');
        if (type === 'products') fetchProducts();
        else if (type === 'warehouses') fetchWarehouses();
        else if (type === 'categories') fetchCategories();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Error deleting');
      }
    } catch (error) {
      console.error('Error deleting:', error);
    }
  };

  const handleApprove = async (type, id) => {
    try {
      const token = getToken();
      const response = await fetch(`${API}/${type}/${id}/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        toast.success(language === 'ar' ? 'تم الاعتماد بنجاح' : 'Approved successfully');
        if (type === 'transfers') fetchTransfers();
        else if (type === 'adjustments') fetchAdjustments();
        fetchSummary();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Error approving');
      }
    } catch (error) {
      console.error('Error approving:', error);
    }
  };

  const tabs = [
    { id: 'products', icon: Package, label: text.products },
    { id: 'warehouses', icon: Warehouse, label: text.warehouses },
    { id: 'categories', icon: Tags, label: text.categories },
    { id: 'units', icon: Ruler, label: text.units },
    { id: 'movements', icon: ArrowRightLeft, label: text.movements },
    { id: 'transfers', icon: ArrowRightLeft, label: text.transfers },
    { id: 'adjustments', icon: ClipboardCheck, label: text.adjustments },
    { id: 'reports', icon: BarChart3, label: text.reports }
  ];

  const getStatusBadge = (product) => {
    const qty = product.total_stock || 0;
    const reorder = product.reorder_level || 0;
    
    if (qty === 0) {
      return <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs">{text.outOfStock}</span>;
    } else if (qty <= reorder) {
      return <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs">{text.lowStockStatus}</span>;
    }
    return <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">{text.inStock}</span>;
  };

  const filteredProducts = products.filter(p => 
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.barcode?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-[#28376B]" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="inventory-page">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">{text.inventory}</h1>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-80">{text.totalValue}</p>
                <p className="text-2xl font-bold">{(summary?.total_value || 0).toLocaleString()}</p>
              </div>
              <Package className="w-10 h-10 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-80">{text.totalProducts}</p>
                <p className="text-2xl font-bold">{summary?.total_products || 0}</p>
              </div>
              <Tags className="w-10 h-10 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-500 to-yellow-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-80">{text.lowStock}</p>
                <p className="text-2xl font-bold">{summary?.low_stock_count || 0}</p>
              </div>
              <TrendingDown className="w-10 h-10 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-80">{text.expiringSoon}</p>
                <p className="text-2xl font-bold">{summary?.expiring_soon || 0}</p>
              </div>
              <AlertTriangle className="w-10 h-10 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b pb-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-lg transition-colors ${
              activeTab === tab.id
                ? 'bg-[#28376B] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            data-testid={`tab-${tab.id}`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg shadow p-6">
        {/* Search and Actions */}
        <div className="flex justify-between items-center mb-4">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder={text.search}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex gap-2">
            {activeTab === 'products' && (
              <Button onClick={() => openModal('product')} data-testid="add-product-btn">
                <Plus className="w-4 h-4 mr-2" />
                {text.addProduct}
              </Button>
            )}
            {activeTab === 'warehouses' && (
              <Button onClick={() => openModal('warehouse')} data-testid="add-warehouse-btn">
                <Plus className="w-4 h-4 mr-2" />
                {text.addWarehouse}
              </Button>
            )}
            {activeTab === 'categories' && (
              <Button onClick={() => openModal('category')} data-testid="add-category-btn">
                <Plus className="w-4 h-4 mr-2" />
                {text.addCategory}
              </Button>
            )}
            {activeTab === 'movements' && (
              <Button onClick={() => openModal('movement')} data-testid="add-movement-btn">
                <Plus className="w-4 h-4 mr-2" />
                {text.addMovement}
              </Button>
            )}
            {activeTab === 'transfers' && (
              <Button onClick={() => openModal('transfer')} data-testid="add-transfer-btn">
                <Plus className="w-4 h-4 mr-2" />
                {text.addTransfer}
              </Button>
            )}
            {activeTab === 'adjustments' && (
              <Button onClick={() => openModal('adjustment')} data-testid="add-adjustment-btn">
                <Plus className="w-4 h-4 mr-2" />
                {text.addAdjustment}
              </Button>
            )}
          </div>
        </div>

        {/* Products Tab */}
        {activeTab === 'products' && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">{text.code}</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">{text.name}</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">{text.category}</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">{text.quantity}</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">{text.cost}</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">{text.price}</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">{text.status}</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">{text.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredProducts.map(product => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">{product.code}</td>
                    <td className="px-4 py-3 text-sm font-medium">{product.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{product.category_name || '-'}</td>
                    <td className="px-4 py-3 text-sm">{product.total_stock || 0} {product.base_unit_symbol}</td>
                    <td className="px-4 py-3 text-sm">{product.cost_price?.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm">{product.sale_price?.toLocaleString()}</td>
                    <td className="px-4 py-3">{getStatusBadge(product)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openModal('product', product)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete('products', product.id)} className="text-red-500">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredProducts.length === 0 && (
              <p className="text-center py-8 text-gray-500">
                {language === 'ar' ? 'لا توجد منتجات' : 'No products found'}
              </p>
            )}
          </div>
        )}

        {/* Warehouses Tab */}
        {activeTab === 'warehouses' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {warehouses.map(warehouse => (
              <Card key={warehouse.id} className={`${warehouse.is_default ? 'border-[#28376B] border-2' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-lg">{warehouse.name}</h3>
                      <p className="text-sm text-gray-500">{warehouse.code}</p>
                      {warehouse.address && <p className="text-sm text-gray-400 mt-1">{warehouse.address}</p>}
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openModal('warehouse', warehouse)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete('warehouses', warehouse.id)} className="text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  {warehouse.is_default && (
                    <span className="mt-2 inline-block px-2 py-1 bg-[#28376B] text-white text-xs rounded">
                      {language === 'ar' ? 'افتراضي' : 'Default'}
                    </span>
                  )}
                </CardContent>
              </Card>
            ))}
            {warehouses.length === 0 && (
              <p className="col-span-3 text-center py-8 text-gray-500">
                {language === 'ar' ? 'لا توجد مخازن' : 'No warehouses found'}
              </p>
            )}
          </div>
        )}

        {/* Categories Tab */}
        {activeTab === 'categories' && (
          <div className="space-y-2">
            {categories.map(category => (
              <div key={category.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Tags className="w-5 h-5 text-gray-400" />
                  <span className="font-medium">{category.name}</span>
                  {category.path && <span className="text-sm text-gray-400">({category.path})</span>}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openModal('category', category)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete('categories', category.id)} className="text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
            {categories.length === 0 && (
              <p className="text-center py-8 text-gray-500">
                {language === 'ar' ? 'لا توجد تصنيفات' : 'No categories found'}
              </p>
            )}
          </div>
        )}

        {/* Units Tab */}
        {activeTab === 'units' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {units.map(unit => (
              <div key={unit.id} className="p-4 bg-gray-50 rounded-lg text-center">
                <div className="text-2xl font-bold text-[#28376B]">{unit.symbol}</div>
                <div className="font-medium">{unit.name}</div>
                <div className="text-sm text-gray-400">{unit.code}</div>
              </div>
            ))}
          </div>
        )}

        {/* Movements Tab */}
        {activeTab === 'movements' && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">{text.date}</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">{text.type}</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">{text.products}</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">{text.warehouses}</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">{text.quantity}</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">{text.cost}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {movements.map(mov => (
                  <tr key={mov.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">{mov.movement_date}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded text-xs ${
                        mov.movement_type?.includes('in') || mov.movement_type === 'purchase' || mov.movement_type === 'opening'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {text.movementTypes[mov.movement_type] || mov.movement_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">{mov.product_name}</td>
                    <td className="px-4 py-3 text-sm">{mov.warehouse_name}</td>
                    <td className="px-4 py-3 text-sm">{mov.quantity} {mov.unit_name}</td>
                    <td className="px-4 py-3 text-sm">{mov.total_cost?.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Transfers Tab */}
        {activeTab === 'transfers' && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">#</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">{text.date}</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">{text.from}</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">{text.to}</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">{text.status}</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">{text.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {transfers.map(transfer => (
                  <tr key={transfer.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium">{transfer.transfer_number}</td>
                    <td className="px-4 py-3 text-sm">{transfer.transfer_date}</td>
                    <td className="px-4 py-3 text-sm">{transfer.from_warehouse_name}</td>
                    <td className="px-4 py-3 text-sm">{transfer.to_warehouse_name}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        transfer.status === 'completed' ? 'bg-green-100 text-green-700' :
                        transfer.status === 'draft' ? 'bg-gray-100 text-gray-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {text[transfer.status] || transfer.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {transfer.status === 'draft' && (
                        <Button size="sm" onClick={() => handleApprove('transfers', transfer.id)}>
                          <CheckCircle className="w-4 h-4 mr-1" />
                          {text.approve}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Adjustments Tab */}
        {activeTab === 'adjustments' && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">#</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">{text.date}</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">{text.warehouses}</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">{text.type}</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">{text.status}</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">{text.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {adjustments.map(adj => (
                  <tr key={adj.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium">{adj.adjustment_number}</td>
                    <td className="px-4 py-3 text-sm">{adj.adjustment_date}</td>
                    <td className="px-4 py-3 text-sm">{adj.warehouse_name}</td>
                    <td className="px-4 py-3 text-sm">{adj.adjustment_type}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        adj.status === 'approved' ? 'bg-green-100 text-green-700' :
                        adj.status === 'draft' ? 'bg-gray-100 text-gray-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {text[adj.status] || adj.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {adj.status === 'draft' && (
                        <Button size="sm" onClick={() => handleApprove('adjustments', adj.id)}>
                          <CheckCircle className="w-4 h-4 mr-1" />
                          {text.approve}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Reports Tab */}
        {activeTab === 'reports' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => window.open(`${API}/reports/stock-balance`, '_blank')}>
              <CardContent className="p-6 text-center">
                <Package className="w-12 h-12 mx-auto text-[#28376B] mb-3" />
                <h3 className="font-semibold">{language === 'ar' ? 'تقرير رصيد المخزون' : 'Stock Balance Report'}</h3>
              </CardContent>
            </Card>
            
            <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => window.open(`${API}/reports/movement-history`, '_blank')}>
              <CardContent className="p-6 text-center">
                <ArrowRightLeft className="w-12 h-12 mx-auto text-[#28376B] mb-3" />
                <h3 className="font-semibold">{language === 'ar' ? 'تقرير حركة المخزون' : 'Movement History Report'}</h3>
              </CardContent>
            </Card>
            
            <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => window.open(`${API}/reports/low-stock`, '_blank')}>
              <CardContent className="p-6 text-center">
                <TrendingDown className="w-12 h-12 mx-auto text-yellow-500 mb-3" />
                <h3 className="font-semibold">{language === 'ar' ? 'تقرير المخزون المنخفض' : 'Low Stock Report'}</h3>
              </CardContent>
            </Card>
            
            <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => window.open(`${API}/reports/valuation`, '_blank')}>
              <CardContent className="p-6 text-center">
                <BarChart3 className="w-12 h-12 mx-auto text-green-500 mb-3" />
                <h3 className="font-semibold">{language === 'ar' ? 'تقرير تقييم المخزون' : 'Stock Valuation Report'}</h3>
              </CardContent>
            </Card>
            
            <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => window.open(`${API}/reports/expiry`, '_blank')}>
              <CardContent className="p-6 text-center">
                <AlertTriangle className="w-12 h-12 mx-auto text-red-500 mb-3" />
                <h3 className="font-semibold">{language === 'ar' ? 'تقرير الصلاحية' : 'Expiry Report'}</h3>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold">
                {modalType === 'product' && (selectedItem ? text.edit : text.addProduct)}
                {modalType === 'warehouse' && (selectedItem ? text.edit : text.addWarehouse)}
                {modalType === 'category' && (selectedItem ? text.edit : text.addCategory)}
                {modalType === 'movement' && text.addMovement}
                {modalType === 'transfer' && text.addTransfer}
                {modalType === 'adjustment' && text.addAdjustment}
              </h2>
            </div>
            
            <div className="p-6 space-y-4">
              {/* Product Form */}
              {modalType === 'product' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">{text.code} *</label>
                      <Input value={formData.code || ''} onChange={e => setFormData({...formData, code: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">{text.barcode}</label>
                      <Input value={formData.barcode || ''} onChange={e => setFormData({...formData, barcode: e.target.value})} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">{text.name} *</label>
                      <Input value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">{text.name} (EN)</label>
                      <Input value={formData.name_en || ''} onChange={e => setFormData({...formData, name_en: e.target.value})} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">{text.category}</label>
                      <select 
                        className="w-full p-2 border rounded-md"
                        value={formData.category_id || ''} 
                        onChange={e => setFormData({...formData, category_id: e.target.value})}
                      >
                        <option value="">--</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">{text.unit} *</label>
                      <select 
                        className="w-full p-2 border rounded-md"
                        value={formData.base_unit_id || ''} 
                        onChange={e => setFormData({...formData, base_unit_id: e.target.value})}
                      >
                        <option value="">--</option>
                        {units.map(u => <option key={u.id} value={u.id}>{u.name} ({u.symbol})</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">{text.cost}</label>
                      <Input type="number" value={formData.cost_price || 0} onChange={e => setFormData({...formData, cost_price: parseFloat(e.target.value)})} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">{text.price}</label>
                      <Input type="number" value={formData.sale_price || 0} onChange={e => setFormData({...formData, sale_price: parseFloat(e.target.value)})} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">{text.taxRate} %</label>
                      <Input type="number" value={formData.tax_rate || 14} onChange={e => setFormData({...formData, tax_rate: parseFloat(e.target.value)})} />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">{text.reorderLevel}</label>
                      <Input type="number" value={formData.reorder_level || 0} onChange={e => setFormData({...formData, reorder_level: parseFloat(e.target.value)})} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">{text.minStock}</label>
                      <Input type="number" value={formData.min_stock || 0} onChange={e => setFormData({...formData, min_stock: parseFloat(e.target.value)})} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">{text.maxStock}</label>
                      <Input type="number" value={formData.max_stock || 0} onChange={e => setFormData({...formData, max_stock: parseFloat(e.target.value)})} />
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={formData.has_expiry || false} onChange={e => setFormData({...formData, has_expiry: e.target.checked})} />
                      {text.hasExpiry}
                    </label>
                    {formData.has_expiry && (
                      <div className="flex-1">
                        <label className="block text-sm font-medium mb-1">{text.shelfLife}</label>
                        <Input type="number" value={formData.shelf_life_days || 0} onChange={e => setFormData({...formData, shelf_life_days: parseInt(e.target.value)})} />
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Warehouse Form */}
              {modalType === 'warehouse' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">{text.code} *</label>
                      <Input value={formData.code || ''} onChange={e => setFormData({...formData, code: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">{text.name} *</label>
                      <Input value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">{language === 'ar' ? 'العنوان' : 'Address'}</label>
                    <Input value={formData.address || ''} onChange={e => setFormData({...formData, address: e.target.value})} />
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={formData.is_default || false} onChange={e => setFormData({...formData, is_default: e.target.checked})} />
                      {language === 'ar' ? 'مخزن افتراضي' : 'Default Warehouse'}
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={formData.allow_negative || false} onChange={e => setFormData({...formData, allow_negative: e.target.checked})} />
                      {language === 'ar' ? 'السماح بالسالب' : 'Allow Negative'}
                    </label>
                  </div>
                </>
              )}

              {/* Category Form */}
              {modalType === 'category' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">{text.code} *</label>
                      <Input value={formData.code || ''} onChange={e => setFormData({...formData, code: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">{text.name} *</label>
                      <Input value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">{language === 'ar' ? 'التصنيف الأب' : 'Parent Category'}</label>
                    <select 
                      className="w-full p-2 border rounded-md"
                      value={formData.parent_id || ''} 
                      onChange={e => setFormData({...formData, parent_id: e.target.value})}
                    >
                      <option value="">--</option>
                      {categories.filter(c => c.id !== selectedItem?.id).map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {/* Movement Form */}
              {modalType === 'movement' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">{text.date} *</label>
                      <Input type="date" value={formData.movement_date || ''} onChange={e => setFormData({...formData, movement_date: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">{text.type} *</label>
                      <select 
                        className="w-full p-2 border rounded-md"
                        value={formData.movement_type || ''} 
                        onChange={e => setFormData({...formData, movement_type: e.target.value})}
                      >
                        {Object.entries(text.movementTypes).map(([key, val]) => (
                          <option key={key} value={key}>{val}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">{text.products} *</label>
                      <select 
                        className="w-full p-2 border rounded-md"
                        value={formData.product_id || ''} 
                        onChange={e => {
                          const product = products.find(p => p.id === e.target.value);
                          setFormData({
                            ...formData, 
                            product_id: e.target.value,
                            unit_id: product?.base_unit_id || ''
                          });
                        }}
                      >
                        <option value="">--</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.code} - {p.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">{text.warehouses} *</label>
                      <select 
                        className="w-full p-2 border rounded-md"
                        value={formData.warehouse_id || ''} 
                        onChange={e => setFormData({...formData, warehouse_id: e.target.value})}
                      >
                        <option value="">--</option>
                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">{text.quantity} *</label>
                      <Input type="number" value={formData.quantity || 0} onChange={e => setFormData({...formData, quantity: parseFloat(e.target.value)})} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">{text.unit}</label>
                      <select 
                        className="w-full p-2 border rounded-md"
                        value={formData.unit_id || ''} 
                        onChange={e => setFormData({...formData, unit_id: e.target.value})}
                      >
                        {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">{text.cost}</label>
                      <Input type="number" value={formData.unit_cost || 0} onChange={e => setFormData({...formData, unit_cost: parseFloat(e.target.value)})} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">{text.notes}</label>
                    <Input value={formData.notes || ''} onChange={e => setFormData({...formData, notes: e.target.value})} />
                  </div>
                </>
              )}

              {/* Transfer Form */}
              {modalType === 'transfer' && (
                <>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">{text.date} *</label>
                      <Input type="date" value={formData.transfer_date || ''} onChange={e => setFormData({...formData, transfer_date: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">{text.from} *</label>
                      <select 
                        className="w-full p-2 border rounded-md"
                        value={formData.from_warehouse_id || ''} 
                        onChange={e => setFormData({...formData, from_warehouse_id: e.target.value})}
                      >
                        <option value="">--</option>
                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">{text.to} *</label>
                      <select 
                        className="w-full p-2 border rounded-md"
                        value={formData.to_warehouse_id || ''} 
                        onChange={e => setFormData({...formData, to_warehouse_id: e.target.value})}
                      >
                        <option value="">--</option>
                        {warehouses.filter(w => w.id !== formData.from_warehouse_id).map(w => (
                          <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="border rounded-lg p-4">
                    <h3 className="font-medium mb-3">{text.products}</h3>
                    {formData.lines?.map((line, idx) => (
                      <div key={idx} className="grid grid-cols-3 gap-2 mb-2">
                        <select 
                          className="p-2 border rounded-md col-span-2"
                          value={line.product_id} 
                          onChange={e => {
                            const newLines = [...formData.lines];
                            newLines[idx].product_id = e.target.value;
                            setFormData({...formData, lines: newLines});
                          }}
                        >
                          <option value="">--</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.code} - {p.name}</option>)}
                        </select>
                        <Input 
                          type="number" 
                          placeholder={text.quantity}
                          value={line.quantity} 
                          onChange={e => {
                            const newLines = [...formData.lines];
                            newLines[idx].quantity = parseFloat(e.target.value);
                            setFormData({...formData, lines: newLines});
                          }} 
                        />
                      </div>
                    ))}
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setFormData({...formData, lines: [...formData.lines, {product_id: '', quantity: 0}]})}
                    >
                      <Plus className="w-4 h-4 mr-1" /> {text.add}
                    </Button>
                  </div>
                </>
              )}

              {/* Adjustment Form */}
              {modalType === 'adjustment' && (
                <>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">{text.date} *</label>
                      <Input type="date" value={formData.adjustment_date || ''} onChange={e => setFormData({...formData, adjustment_date: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">{text.warehouses} *</label>
                      <select 
                        className="w-full p-2 border rounded-md"
                        value={formData.warehouse_id || ''} 
                        onChange={e => setFormData({...formData, warehouse_id: e.target.value})}
                      >
                        <option value="">--</option>
                        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">{text.type}</label>
                      <select 
                        className="w-full p-2 border rounded-md"
                        value={formData.adjustment_type || 'count'} 
                        onChange={e => setFormData({...formData, adjustment_type: e.target.value})}
                      >
                        <option value="count">{language === 'ar' ? 'جرد' : 'Count'}</option>
                        <option value="increase">{language === 'ar' ? 'زيادة' : 'Increase'}</option>
                        <option value="decrease">{language === 'ar' ? 'نقص' : 'Decrease'}</option>
                      </select>
                    </div>
                  </div>
                  <div className="border rounded-lg p-4">
                    <h3 className="font-medium mb-3">{text.products}</h3>
                    {formData.lines?.map((line, idx) => (
                      <div key={idx} className="grid grid-cols-3 gap-2 mb-2">
                        <select 
                          className="p-2 border rounded-md"
                          value={line.product_id} 
                          onChange={e => {
                            const newLines = [...formData.lines];
                            newLines[idx].product_id = e.target.value;
                            setFormData({...formData, lines: newLines});
                          }}
                        >
                          <option value="">--</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.code} - {p.name}</option>)}
                        </select>
                        <Input 
                          type="number" 
                          placeholder={language === 'ar' ? 'الكمية الفعلية' : 'Actual Qty'}
                          value={line.actual_qty} 
                          onChange={e => {
                            const newLines = [...formData.lines];
                            newLines[idx].actual_qty = parseFloat(e.target.value);
                            setFormData({...formData, lines: newLines});
                          }} 
                        />
                        <select 
                          className="p-2 border rounded-md"
                          value={line.reason || 'count'} 
                          onChange={e => {
                            const newLines = [...formData.lines];
                            newLines[idx].reason = e.target.value;
                            setFormData({...formData, lines: newLines});
                          }}
                        >
                          <option value="count">{language === 'ar' ? 'جرد' : 'Count'}</option>
                          <option value="damage">{language === 'ar' ? 'تلف' : 'Damage'}</option>
                          <option value="expired">{language === 'ar' ? 'انتهاء صلاحية' : 'Expired'}</option>
                          <option value="theft">{language === 'ar' ? 'سرقة' : 'Theft'}</option>
                          <option value="other">{language === 'ar' ? 'أخرى' : 'Other'}</option>
                        </select>
                      </div>
                    ))}
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setFormData({...formData, lines: [...formData.lines, {product_id: '', actual_qty: 0, reason: 'count'}]})}
                    >
                      <Plus className="w-4 h-4 mr-1" /> {text.add}
                    </Button>
                  </div>
                </>
              )}
            </div>
            
            <div className="p-6 border-t flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowModal(false)}>{text.cancel}</Button>
              <Button onClick={handleSave}>{text.save}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
