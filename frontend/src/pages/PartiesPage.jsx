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
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { 
  Plus, Search, Users, Building, Edit, Trash2, Phone, Mail, MapPin
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api/invoice`;

const PartiesPage = () => {
  const { language } = useLanguage();
  const { isDark } = useTheme();
  const isRTL = language === 'ar';

  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('customer');
  const [showModal, setShowModal] = useState(false);
  const [editingParty, setEditingParty] = useState(null);

  const [formData, setFormData] = useState({
    party_type: 'customer',
    name: '',
    name_en: '',
    tax_id: '',
    commercial_register: '',
    address: '',
    city: '',
    country: 'EG',
    phone: '',
    email: '',
    contact_person: '',
    credit_limit: 0,
    payment_terms: 'cash'
  });

  const t = {
    ar: {
      parties: 'العملاء والموردين',
      customers: 'العملاء',
      suppliers: 'الموردين',
      addCustomer: 'إضافة عميل',
      addSupplier: 'إضافة مورد',
      editCustomer: 'تعديل عميل',
      editSupplier: 'تعديل مورد',
      search: 'بحث...',
      name: 'الاسم',
      nameEn: 'الاسم بالإنجليزية',
      taxId: 'الرقم الضريبي',
      commercialRegister: 'السجل التجاري',
      address: 'العنوان',
      city: 'المدينة',
      phone: 'الهاتف',
      email: 'البريد الإلكتروني',
      contactPerson: 'شخص التواصل',
      creditLimit: 'حد الائتمان',
      paymentTerms: 'شروط الدفع',
      cash: 'نقداً',
      net7: '7 أيام',
      net15: '15 يوم',
      net30: '30 يوم',
      net60: '60 يوم',
      save: 'حفظ',
      cancel: 'إلغاء',
      actions: 'الإجراءات',
      noParties: 'لا يوجد بيانات',
      created: 'تم الإنشاء بنجاح',
      updated: 'تم التحديث بنجاح',
      error: 'حدث خطأ',
      totalCustomers: 'إجمالي العملاء',
      totalSuppliers: 'إجمالي الموردين'
    },
    en: {
      parties: 'Customers & Suppliers',
      customers: 'Customers',
      suppliers: 'Suppliers',
      addCustomer: 'Add Customer',
      addSupplier: 'Add Supplier',
      editCustomer: 'Edit Customer',
      editSupplier: 'Edit Supplier',
      search: 'Search...',
      name: 'Name',
      nameEn: 'English Name',
      taxId: 'Tax ID',
      commercialRegister: 'Commercial Register',
      address: 'Address',
      city: 'City',
      phone: 'Phone',
      email: 'Email',
      contactPerson: 'Contact Person',
      creditLimit: 'Credit Limit',
      paymentTerms: 'Payment Terms',
      cash: 'Cash',
      net7: 'Net 7 Days',
      net15: 'Net 15 Days',
      net30: 'Net 30 Days',
      net60: 'Net 60 Days',
      save: 'Save',
      cancel: 'Cancel',
      actions: 'Actions',
      noParties: 'No data found',
      created: 'Created successfully',
      updated: 'Updated successfully',
      error: 'An error occurred',
      totalCustomers: 'Total Customers',
      totalSuppliers: 'Total Suppliers'
    }
  };

  const text = t[language] || t.ar;
  const getToken = () => localStorage.getItem('token');

  const fetchParties = useCallback(async () => {
    try {
      setLoading(true);
      const token = getToken();
      const response = await fetch(`${API}/parties?party_type=${activeTab}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setParties(data.parties || []);
    } catch (error) {
      console.error('Error fetching parties:', error);
      toast.error(text.error);
    } finally {
      setLoading(false);
    }
  }, [activeTab, text.error]);

  useEffect(() => {
    fetchParties();
  }, [fetchParties]);

  const handleSubmit = async () => {
    try {
      const token = getToken();
      const url = editingParty 
        ? `${API}/parties/${editingParty.id}`
        : `${API}/parties`;
      
      const response = await fetch(url, {
        method: editingParty ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ...formData, party_type: activeTab })
      });

      if (response.ok) {
        toast.success(editingParty ? text.updated : text.created);
        setShowModal(false);
        setEditingParty(null);
        resetForm();
        fetchParties();
      } else {
        const error = await response.json();
        toast.error(error.detail || text.error);
      }
    } catch (error) {
      console.error('Error saving party:', error);
      toast.error(text.error);
    }
  };

  const resetForm = () => {
    setFormData({
      party_type: activeTab,
      name: '',
      name_en: '',
      tax_id: '',
      commercial_register: '',
      address: '',
      city: '',
      country: 'EG',
      phone: '',
      email: '',
      contact_person: '',
      credit_limit: 0,
      payment_terms: 'cash'
    });
  };

  const handleEdit = (party) => {
    setEditingParty(party);
    setFormData({
      party_type: party.party_type,
      name: party.name || '',
      name_en: party.name_en || '',
      tax_id: party.tax_id || '',
      commercial_register: party.commercial_register || '',
      address: party.address || '',
      city: party.city || '',
      country: party.country || 'EG',
      phone: party.phone || '',
      email: party.email || '',
      contact_person: party.contact_person || '',
      credit_limit: party.credit_limit || 0,
      payment_terms: party.payment_terms || 'cash'
    });
    setShowModal(true);
  };

  const filteredParties = parties.filter(party => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        party.name?.toLowerCase().includes(search) ||
        party.tax_id?.toLowerCase().includes(search) ||
        party.phone?.toLowerCase().includes(search) ||
        party.email?.toLowerCase().includes(search)
      );
    }
    return true;
  });

  return (
    <div className={`flex min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <ModernSidebar />
      
      <div className="flex-1 flex flex-col">
        <main className={`flex-1 p-6 ${isRTL ? 'mr-64' : 'ml-64'}`}>
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {text.parties}
            </h1>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
            <TabsList className="grid grid-cols-2 w-full max-w-md">
              <TabsTrigger value="customer" data-testid="tab-customers">
                <Users className="w-4 h-4 mr-2" />
                {text.customers}
              </TabsTrigger>
              <TabsTrigger value="supplier" data-testid="tab-suppliers">
                <Building className="w-4 h-4 mr-2" />
                {text.suppliers}
              </TabsTrigger>
            </TabsList>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <Card className={isDark ? 'bg-gray-800 border-gray-700' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {text.totalCustomers}
                      </p>
                      <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {activeTab === 'customer' ? parties.length : '-'}
                      </p>
                    </div>
                    <Users className="w-10 h-10 text-blue-500" />
                  </div>
                </CardContent>
              </Card>

              <Card className={isDark ? 'bg-gray-800 border-gray-700' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {text.totalSuppliers}
                      </p>
                      <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {activeTab === 'supplier' ? parties.length : '-'}
                      </p>
                    </div>
                    <Building className="w-10 h-10 text-green-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Search and Add Button */}
            <div className="flex flex-wrap gap-4 mt-6 mb-4">
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
                onClick={() => { resetForm(); setEditingParty(null); setShowModal(true); }}
                className="bg-[#28376B] hover:bg-[#1e2a52] text-white"
                data-testid="add-party-btn"
              >
                <Plus className="w-4 h-4 mr-2" />
                {activeTab === 'customer' ? text.addCustomer : text.addSupplier}
              </Button>
            </div>

            {/* Table */}
            <Card className={isDark ? 'bg-gray-800 border-gray-700' : ''}>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className={isDark ? 'border-gray-700' : ''}>
                      <TableHead className={isDark ? 'text-gray-300' : ''}>{text.name}</TableHead>
                      <TableHead className={isDark ? 'text-gray-300' : ''}>{text.taxId}</TableHead>
                      <TableHead className={isDark ? 'text-gray-300' : ''}>{text.phone}</TableHead>
                      <TableHead className={isDark ? 'text-gray-300' : ''}>{text.email}</TableHead>
                      <TableHead className={isDark ? 'text-gray-300' : ''}>{text.city}</TableHead>
                      <TableHead className={isDark ? 'text-gray-300' : ''}>{text.actions}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#28376B] mx-auto"></div>
                        </TableCell>
                      </TableRow>
                    ) : filteredParties.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className={`text-center py-8 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          {text.noParties}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredParties.map((party) => (
                        <TableRow key={party.id} className={isDark ? 'border-gray-700 hover:bg-gray-750' : 'hover:bg-gray-50'}>
                          <TableCell className={`font-medium ${isDark ? 'text-white' : ''}`}>
                            {party.name}
                            {party.name_en && (
                              <span className={`block text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                {party.name_en}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className={isDark ? 'text-gray-300' : ''}>
                            {party.tax_id || '-'}
                          </TableCell>
                          <TableCell className={isDark ? 'text-gray-300' : ''}>
                            {party.phone && (
                              <div className="flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {party.phone}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className={isDark ? 'text-gray-300' : ''}>
                            {party.email && (
                              <div className="flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                {party.email}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className={isDark ? 'text-gray-300' : ''}>
                            {party.city && (
                              <div className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {party.city}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(party)}
                              data-testid={`edit-party-${party.id}`}
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
          </Tabs>
        </main>

        <AppFooter />
      </div>

      {/* Add/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className={`max-w-2xl ${isDark ? 'bg-gray-800 text-white' : ''}`}>
          <DialogHeader>
            <DialogTitle>
              {editingParty 
                ? (activeTab === 'customer' ? text.editCustomer : text.editSupplier)
                : (activeTab === 'customer' ? text.addCustomer : text.addSupplier)
              }
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {text.name} *
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className={isDark ? 'bg-gray-700 border-gray-600 text-white' : ''}
                  data-testid="party-name"
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
                  data-testid="party-name-en"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {text.taxId}
                </label>
                <Input
                  value={formData.tax_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, tax_id: e.target.value }))}
                  className={isDark ? 'bg-gray-700 border-gray-600 text-white' : ''}
                  placeholder="123-456-789"
                  data-testid="party-tax-id"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {text.commercialRegister}
                </label>
                <Input
                  value={formData.commercial_register}
                  onChange={(e) => setFormData(prev => ({ ...prev, commercial_register: e.target.value }))}
                  className={isDark ? 'bg-gray-700 border-gray-600 text-white' : ''}
                  data-testid="party-cr"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {text.phone}
                </label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  className={isDark ? 'bg-gray-700 border-gray-600 text-white' : ''}
                  data-testid="party-phone"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {text.email}
                </label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className={isDark ? 'bg-gray-700 border-gray-600 text-white' : ''}
                  data-testid="party-email"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {text.contactPerson}
                </label>
                <Input
                  value={formData.contact_person}
                  onChange={(e) => setFormData(prev => ({ ...prev, contact_person: e.target.value }))}
                  className={isDark ? 'bg-gray-700 border-gray-600 text-white' : ''}
                  data-testid="party-contact"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {text.city}
                </label>
                <Input
                  value={formData.city}
                  onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                  className={isDark ? 'bg-gray-700 border-gray-600 text-white' : ''}
                  data-testid="party-city"
                />
              </div>

              <div className="md:col-span-2">
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {text.address}
                </label>
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  className={isDark ? 'bg-gray-700 border-gray-600 text-white' : ''}
                  data-testid="party-address"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {text.creditLimit}
                </label>
                <Input
                  type="number"
                  value={formData.credit_limit}
                  onChange={(e) => setFormData(prev => ({ ...prev, credit_limit: parseFloat(e.target.value) || 0 }))}
                  className={isDark ? 'bg-gray-700 border-gray-600 text-white' : ''}
                  data-testid="party-credit-limit"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {text.paymentTerms}
                </label>
                <Select 
                  value={formData.payment_terms} 
                  onValueChange={(val) => setFormData(prev => ({ ...prev, payment_terms: val }))}
                >
                  <SelectTrigger className={isDark ? 'bg-gray-700 border-gray-600 text-white' : ''} data-testid="party-payment-terms">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">{text.cash}</SelectItem>
                    <SelectItem value="net_7">{text.net7}</SelectItem>
                    <SelectItem value="net_15">{text.net15}</SelectItem>
                    <SelectItem value="net_30">{text.net30}</SelectItem>
                    <SelectItem value="net_60">{text.net60}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowModal(false)} data-testid="cancel-btn">
                {text.cancel}
              </Button>
              <Button 
                onClick={handleSubmit} 
                className="bg-[#28376B] hover:bg-[#1e2a52] text-white"
                disabled={!formData.name}
                data-testid="save-party-btn"
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

export default PartiesPage;
