import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Upload, Building2, Mail, Phone, MapPin, Edit3, Save, X, Globe, FileText } from 'lucide-react';
import axios from 'axios';

const CompanyTab = ({ company, language, canUploadLogo, uploading, handleLogoUpload, message }) => {
  const ar = language === 'ar';
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [form, setForm] = useState({
    name: company?.name || '',
    contact_email: company?.contact_email || '',
    phone: company?.phone || '',
    address: company?.address || '',
    city: company?.city || '',
    country: company?.country || '',
    website: company?.website || '',
    tax_number: company?.tax_number || '',
    commercial_register: company?.commercial_register || '',
    description: company?.description || '',
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${process.env.REACT_APP_BACKEND_URL}/api/companies/${company.id}`,
        form,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSaveMsg(ar ? '✅ تم الحفظ بنجاح' : '✅ Saved successfully');
      setEditing(false);
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (e) {
      setSaveMsg(ar ? '❌ فشل الحفظ' : '❌ Save failed');
    }
    setSaving(false);
  };

  const Field = ({ label, field, type='text' }) => (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-500">{label}</label>
      {editing ? (
        <input
          type={type}
          value={form[field] || ''}
          onChange={e => setForm(f => ({...f, [field]: e.target.value}))}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#28376B]"
        />
      ) : (
        <p className="font-medium text-gray-800">{company?.[field] || <span className="text-gray-400 text-xs">{ar ? 'غير محدد' : 'Not set'}</span>}</p>
      )}
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Logo */}
      <Card>
        <CardHeader>
          <CardTitle>{ar ? 'شعار الشركة' : 'Company Logo'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center space-y-4">
            {company?.logo_url ? (
              <img src={company.logo_url} alt="Logo" className="w-40 h-40 object-contain border-2 border-gray-200 rounded-lg p-2" />
            ) : (
              <div className="w-40 h-40 bg-gray-100 flex items-center justify-center rounded-lg">
                <Building2 className="h-20 w-20 text-gray-300" />
              </div>
            )}
            {canUploadLogo && (
              <>
                <Button disabled={uploading} className="bg-[#28376B]" onClick={() => document.getElementById('logo-upload').click()}>
                  <Upload className="h-4 w-4 mr-2" />
                  {uploading ? (ar ? 'جاري الرفع...' : 'Uploading...') : (ar ? 'رفع شعار' : 'Upload Logo')}
                </Button>
                <input id="logo-upload" type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
              </>
            )}
            {message && <p className={`text-sm ${message.includes('نجاح') || message.includes('success') ? 'text-green-600' : 'text-red-600'}`}>{message}</p>}
          </div>
        </CardContent>
      </Card>

      {/* Company Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{ar ? 'معلومات الشركة' : 'Company Information'}</CardTitle>
            {canUploadLogo && !editing && (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                <Edit3 className="h-3.5 w-3.5 mr-1" />{ar ? 'تعديل' : 'Edit'}
              </Button>
            )}
            {editing && (
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave} disabled={saving} className="bg-[#28376B]">
                  <Save className="h-3.5 w-3.5 mr-1" />{saving ? '...' : (ar ? 'حفظ' : 'Save')}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {saveMsg && <p className={`text-sm p-2 rounded ${saveMsg.includes('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{saveMsg}</p>}
          <div className="grid grid-cols-1 gap-3">
            <Field label={ar ? 'اسم الشركة' : 'Company Name'} field="name" />
            <Field label={ar ? 'البريد الإلكتروني' : 'Email'} field="contact_email" type="email" />
            <Field label={ar ? 'الهاتف' : 'Phone'} field="phone" />
            <Field label={ar ? 'العنوان' : 'Address'} field="address" />
            <Field label={ar ? 'المدينة' : 'City'} field="city" />
            <Field label={ar ? 'الموقع الإلكتروني' : 'Website'} field="website" />
            <Field label={ar ? 'الرقم الضريبي' : 'Tax Number'} field="tax_number" />
            <Field label={ar ? 'السجل التجاري' : 'Commercial Register'} field="commercial_register" />
          </div>
          <div className="pt-4 border-t">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">{ar ? 'حالة الاشتراك' : 'Subscription'}</span>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                company?.subscription_status === 'active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {company?.subscription_status === 'active' ? (ar ? 'نشط' : 'Active') : (ar ? 'تجريبي' : 'Trial')}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CompanyTab;
