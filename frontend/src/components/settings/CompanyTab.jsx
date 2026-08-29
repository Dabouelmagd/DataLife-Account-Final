import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Upload, Building2, Edit3, Save, X } from 'lucide-react';
import axios from 'axios';

const CompanyTab = ({ company, language, canUploadLogo, uploading, handleLogoUpload, message }) => {
  const ar = language === 'ar';
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [form, setForm] = useState({
    name: '', contact_email: '', phone: '', address: '',
    city: '', country: '', website: '', tax_number: '',
    commercial_register: '', description: '',
  });

  // Sync form when company data loads
  useEffect(() => {
    if (company) {
      setForm({
        name:                company.name || '',
        contact_email:       company.contact_email || '',
        phone:               company.phone || '',
        address:             company.address || '',
        city:                company.city || '',
        country:             company.country || '',
        website:             company.website || '',
        tax_number:          company.tax_number || '',
        commercial_register: company.commercial_register || '',
        description:         company.description || '',
      });
    }
  }, [company]);

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
    } catch {
      setSaveMsg(ar ? '❌ فشل الحفظ' : '❌ Save failed');
    }
    setSaving(false);
  };

  const inputClass = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#28376B]";
  const labelClass = "text-xs font-medium text-gray-500 mb-1 block";
  const valueClass = "font-medium text-gray-800 text-sm py-1";

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Logo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{ar ? 'شعار الشركة' : 'Company Logo'}</CardTitle>
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
            <CardTitle className="text-base">{ar ? 'معلومات الشركة' : 'Company Information'}</CardTitle>
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
                <Button size="sm" variant="outline" onClick={() => { setEditing(false); }}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {saveMsg && <p className={`text-sm p-2 rounded ${saveMsg.includes('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{saveMsg}</p>}

          {/* اسم الشركة */}
          <div>
            <label className={labelClass}>{ar ? 'اسم الشركة' : 'Company Name'}</label>
            {editing ? (
              <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}
                className={inputClass} dir="auto" placeholder={ar ? 'اسم الشركة' : 'Company name'} />
            ) : <p className={valueClass}>{company?.name || <span className="text-gray-400 text-xs">{ar ? 'غير محدد' : 'Not set'}</span>}</p>}
          </div>

          {/* البريد الإلكتروني */}
          <div>
            <label className={labelClass}>{ar ? 'البريد الإلكتروني' : 'Email'}</label>
            {editing ? (
              <input value={form.contact_email} onChange={e => setForm(f => ({...f, contact_email: e.target.value}))}
                className={inputClass} type="email" dir="ltr" />
            ) : <p className={valueClass}>{company?.contact_email || <span className="text-gray-400 text-xs">{ar ? 'غير محدد' : 'Not set'}</span>}</p>}
          </div>

          {/* الهاتف */}
          <div>
            <label className={labelClass}>{ar ? 'الهاتف' : 'Phone'}</label>
            {editing ? (
              <input value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))}
                className={inputClass} dir="ltr" />
            ) : <p className={valueClass}>{company?.phone || <span className="text-gray-400 text-xs">{ar ? 'غير محدد' : 'Not set'}</span>}</p>}
          </div>

          {/* العنوان */}
          <div>
            <label className={labelClass}>{ar ? 'العنوان' : 'Address'}</label>
            {editing ? (
              <input value={form.address} onChange={e => setForm(f => ({...f, address: e.target.value}))}
                className={inputClass} dir="auto" />
            ) : <p className={valueClass}>{company?.address || <span className="text-gray-400 text-xs">{ar ? 'غير محدد' : 'Not set'}</span>}</p>}
          </div>

          {/* المدينة */}
          <div>
            <label className={labelClass}>{ar ? 'المدينة' : 'City'}</label>
            {editing ? (
              <input value={form.city} onChange={e => setForm(f => ({...f, city: e.target.value}))}
                className={inputClass} dir="auto" />
            ) : <p className={valueClass}>{company?.city || <span className="text-gray-400 text-xs">{ar ? 'غير محدد' : 'Not set'}</span>}</p>}
          </div>

          {/* الموقع الإلكتروني */}
          <div>
            <label className={labelClass}>{ar ? 'الموقع الإلكتروني' : 'Website'}</label>
            {editing ? (
              <input value={form.website} onChange={e => setForm(f => ({...f, website: e.target.value}))}
                className={inputClass} dir="ltr" />
            ) : <p className={valueClass}>{company?.website || <span className="text-gray-400 text-xs">{ar ? 'غير محدد' : 'Not set'}</span>}</p>}
          </div>

          {/* الرقم الضريبي */}
          <div>
            <label className={labelClass}>{ar ? 'الرقم الضريبي' : 'Tax Number'}</label>
            {editing ? (
              <input value={form.tax_number} onChange={e => setForm(f => ({...f, tax_number: e.target.value}))}
                className={inputClass} dir="ltr" />
            ) : <p className={valueClass}>{company?.tax_number || <span className="text-gray-400 text-xs">{ar ? 'غير محدد' : 'Not set'}</span>}</p>}
          </div>

          {/* السجل التجاري */}
          <div>
            <label className={labelClass}>{ar ? 'السجل التجاري' : 'Commercial Register'}</label>
            {editing ? (
              <input value={form.commercial_register} onChange={e => setForm(f => ({...f, commercial_register: e.target.value}))}
                className={inputClass} dir="ltr" />
            ) : <p className={valueClass}>{company?.commercial_register || <span className="text-gray-400 text-xs">{ar ? 'غير محدد' : 'Not set'}</span>}</p>}
          </div>

          {/* حالة الاشتراك */}
          <div className="pt-3 border-t">
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
