import React from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { MapPin, Phone, Mail, Clock, Calendar, MessageCircle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { getTranslation } from '../data/translations';

const ContactSection = () => {
  const { language, isRTL } = useLanguage();
  const t = (key) => getTranslation(language, key);

  const contactMethods = [
    {
      icon: <Phone className="h-6 w-6" />,
      title: t('contact.callUs'),
      content: t('contact.phone'),
      description: t('contact.businessHours'),
      action: () => window.open(`tel:${t('contact.phone').replace(/\s/g, '')}`, '_self'),
      color: 'bg-blue-500 hover:bg-blue-600'
    },
    {
      icon: <Mail className="h-6 w-6" />,
      title: t('contact.emailUs'),
      content: t('contact.email'),
      description: language === 'ar' ? 'رد خلال 24 ساعة' : 'Response within 24 hours',
      action: () => window.open(`mailto:${t('contact.email')}?subject=DataLife Account Inquiry`, '_blank'),
      color: 'bg-green-500 hover:bg-green-600'
    },
    {
      icon: <MapPin className="h-6 w-6" />,
      title: t('contact.visitOffice'),
      content: t('contact.address'),
      description: t('contact.businessHours'),
      action: () => window.open('https://maps.google.com/?q=59+Lebanon+Street,+Mohandessin,+Giza,+Egypt', '_blank'),
      color: 'bg-purple-500 hover:bg-purple-600'
    }
  ];

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
            {t('contact.getInTouch')}
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            {language === 'ar' 
              ? 'نحن هنا لمساعدتك في اختيار أفضل حل لعملك. تواصل معنا اليوم وابدأ رحلتك نحو إدارة أعمال أكثر كفاءة.'
              : 'We\'re here to help you choose the best solution for your business. Contact us today and start your journey towards more efficient business management.'
            }
          </p>
        </div>

        {/* Contact Methods Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {contactMethods.map((method, index) => (
            <Card 
              key={index} 
              className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-2"
            >
              <CardHeader className="text-center pb-4">
                <div className={`w-16 h-16 ${method.color} rounded-full flex items-center justify-center mx-auto mb-4 text-white transition-all duration-300`}>
                  {method.icon}
                </div>
                <CardTitle className="text-xl font-bold text-gray-900">
                  {method.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-lg font-semibold text-gray-800 mb-2">
                  {method.content}
                </p>
                <p className="text-sm text-gray-600 mb-6">
                  {method.description}
                </p>
                <Button 
                  onClick={method.action}
                  className={`w-full ${method.color} text-white border-0`}
                >
                  {method.title}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Action Buttons */}
        <div className="bg-gradient-to-r from-[#28376B] to-[#1e2a5a] rounded-2xl p-8 text-center">
          <h3 className="text-2xl font-bold text-white mb-4">
            {language === 'ar' ? 'هل أنت مستعد لبدء رحلتك مع داتا لايف؟' : 'Ready to Start Your DataLife Journey?'}
          </h3>
          <p className="text-blue-100 mb-8 max-w-2xl mx-auto">
            {language === 'ar' 
              ? 'احجز عرضاً توضيحياً مجانياً أو تحدث مع فريق المبيعات لدينا لمعرفة كيف يمكن لداتا لايف أكاونت تحويل عملك.'
              : 'Schedule a free demo or speak with our sales team to learn how DataLife Account can transform your business.'
            }
          </p>
          <div className={`flex flex-col sm:flex-row gap-4 justify-center ${isRTL ? 'sm:flex-row-reverse' : ''}`}>
            <Button 
              size="lg" 
              className="bg-white text-[#28376B] hover:bg-gray-100 px-8 py-4 text-lg"
              onClick={() => window.open(`tel:${t('contact.phone').replace(/\s/g, '')}`, '_self')}
            >
              <Phone className={`h-5 w-5 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {t('contact.contactSales')}
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="border-white text-white hover:bg-white hover:text-[#28376B] px-8 py-4 text-lg"
              onClick={() => window.open(`mailto:${t('contact.email')}?subject=Schedule DataLife Account Demo`, '_blank')}
            >
              <Calendar className={`h-5 w-5 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {t('contact.scheduleDemo')}
            </Button>
          </div>
        </div>

        {/* Business Hours Card */}
        <div className="mt-12">
          <Card className="max-w-2xl mx-auto border-gray-200">
            <CardHeader className="text-center">
              <div className="w-12 h-12 bg-[#28376B]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="h-6 w-6 text-[#28376B]" />
              </div>
              <CardTitle className="text-xl font-bold text-gray-900">
                {language === 'ar' ? 'ساعات العمل' : 'Business Hours'}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-lg text-gray-700 mb-2">{t('contact.businessHours')}</p>
              <p className="text-sm text-gray-500">
                {language === 'ar' 
                  ? 'نحن مغلقون أيام الجمعة والسبت' 
                  : 'Closed on Fridays and Saturdays'
                }
              </p>
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600">
                  {language === 'ar' 
                    ? 'للاستفسارات العاجلة خارج ساعات العمل، يرجى إرسال بريد إلكتروني وسنرد في أقرب وقت ممكن.' 
                    : 'For urgent inquiries outside business hours, please send an email and we\'ll respond as soon as possible.'
                  }
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};

export default ContactSection;