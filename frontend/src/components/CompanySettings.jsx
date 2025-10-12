import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Upload, Building2, Mail, Phone, MapPin } from 'lucide-react';
import axios from 'axios';

const CompanySettings = () => {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [company, setCompany] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const isRTL = language === 'ar';

  useEffect(() => {
    fetchCompanyData();
  }, []);

  const fetchCompanyData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/api/companies/${user.company_id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCompany(response.data);
    } catch (error) {
      console.error('Error fetching company:', error);
    }
  };

  const handleLogoUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setMessage(language === 'ar' ? 'يرجى اختيار ملف صورة فقط' : 'Please select an image file only');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setMessage(language === 'ar' ? 'حجم الملف كبير جداً (الحد الأقصى 5 ميجابايت)' : 'File size too large (max 5MB)');
      return;
    }

    setUploading(true);
    setMessage('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/api/companies/${user.company_id}/upload-logo`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      setMessage(language === 'ar' ? 'تم رفع الشعار بنجاح!' : 'Logo uploaded successfully!');
      fetchCompanyData(); // Refresh company data
    } catch (error) {
      console.error('Error uploading logo:', error);
      setMessage(language === 'ar' ? 'فشل رفع الشعار' : 'Failed to upload logo');
    } finally {
      setUploading(false);
    }
  };

  if (!company) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl">{language === 'ar' ? 'جاري التحميل...' : 'Loading...'}</div>
      </div>
    );
  }

  // Check if user can upload logo
  const canUploadLogo = ['General Manager', 'CEO', 'Board Chairman', 'مدير عام', 'المدير التنفيذي', 'رئيس مجلس الإدارة'].includes(user.role);

  return (
    <div className="container mx-auto p-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <h1 className="text-3xl font-bold text-[#28376B] mb-6">
        {language === 'ar' ? 'إعدادات الشركة' : 'Company Settings'}
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Company Logo */}
        <Card>
          <CardHeader>
            <CardTitle>{language === 'ar' ? 'شعار الشركة' : 'Company Logo'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center space-y-4">
              {company.logo_url ? (
                <img
                  src={company.logo_url}
                  alt="Company Logo"
                  className="w-40 h-40 object-contain border-2 border-gray-200 rounded-lg p-2"
                />
              ) : (
                <div className="w-40 h-40 bg-gray-100 flex items-center justify-center rounded-lg">
                  <Building2 className="h-20 w-20 text-gray-400" />
                </div>
              )}

              {canUploadLogo && (
                <>
                  <label htmlFor="logo-upload">
                    <Button
                      disabled={uploading}
                      className="bg-[#28376B] cursor-pointer"
                      onClick={() => document.getElementById('logo-upload').click()}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {uploading
                        ? (language === 'ar' ? 'جاري الرفع...' : 'Uploading...')
                        : (language === 'ar' ? 'رفع شعار' : 'Upload Logo')}
                    </Button>
                  </label>
                  <input
                    id="logo-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                </>
              )}

              {message && (
                <p className={`text-sm ${message.includes('نجاح') || message.includes('success') ? 'text-green-600' : 'text-red-600'}`}>
                  {message}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Company Information */}
        <Card>
          <CardHeader>
            <CardTitle>{language === 'ar' ? 'معلومات الشركة' : 'Company Information'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start space-x-3">
              <Building2 className="h-5 w-5 text-[#28376B] mt-1" />
              <div>
                <p className="text-sm text-gray-600">{language === 'ar' ? 'اسم الشركة' : 'Company Name'}</p>
                <p className="font-semibold text-lg">{company.name}</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Mail className="h-5 w-5 text-[#28376B] mt-1" />
              <div>
                <p className="text-sm text-gray-600">{language === 'ar' ? 'البريد الإلكتروني' : 'Email'}</p>
                <p className="font-semibold">{company.contact_email}</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Phone className="h-5 w-5 text-[#28376B] mt-1" />
              <div>
                <p className="text-sm text-gray-600">{language === 'ar' ? 'الهاتف' : 'Phone'}</p>
                <p className="font-semibold">{company.phone}</p>
              </div>
            </div>

            {company.address && (
              <div className="flex items-start space-x-3">
                <MapPin className="h-5 w-5 text-[#28376B] mt-1" />
                <div>
                  <p className="text-sm text-gray-600">{language === 'ar' ? 'العنوان' : 'Address'}</p>
                  <p className="font-semibold">{company.address}</p>
                </div>
              </div>
            )}

            <div className="pt-4 border-t">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">{language === 'ar' ? 'حالة الاشتراك' : 'Subscription Status'}</span>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  company.subscription_status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {company.subscription_status === 'active' 
                    ? (language === 'ar' ? 'نشط' : 'Active')
                    : (language === 'ar' ? 'تجريبي' : 'Trial')}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CompanySettings;
