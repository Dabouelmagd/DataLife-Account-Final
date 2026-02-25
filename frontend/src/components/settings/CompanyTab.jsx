import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Upload, Building2, Mail, Phone, MapPin } from 'lucide-react';

const CompanyTab = ({ 
  company, 
  language, 
  canUploadLogo, 
  uploading, 
  handleLogoUpload, 
  message 
}) => {
  return (
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
                src={company.logo_url.startsWith('http') ? company.logo_url : `${process.env.REACT_APP_BACKEND_URL}${company.logo_url}`}
                alt="Company Logo"
                className="w-40 h-40 object-contain border-2 border-gray-200 rounded-lg p-2"
                onError={(e) => {
                  // Hide failed image and show placeholder
                  e.target.style.display = 'none';
                  const placeholder = e.target.parentElement.querySelector('.logo-placeholder');
                  if (placeholder) placeholder.style.display = 'flex';
                }}
              />
            ) : null}
            <div 
              className={`logo-placeholder w-40 h-40 bg-gray-100 items-center justify-center rounded-lg ${company.logo_url ? 'hidden' : 'flex'}`}
              style={{ display: company.logo_url ? 'none' : 'flex' }}
            >
              <Building2 className="h-20 w-20 text-gray-400" />
            </div>

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
  );
};

export default CompanyTab;
