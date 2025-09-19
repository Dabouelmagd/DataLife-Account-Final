import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { CheckCircle, BarChart3, Users, DollarSign, Shield, Cloud, Bell, Calculator, PieChart, FileText, Database, Zap, Globe, TrendingUp, Lock, HeadphonesIcon, Workflow, Building2, ClipboardList, CreditCard, Timer, Target, Award } from 'lucide-react';

const LandingPage = () => {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const features = [
    {
      icon: <Users className="h-8 w-8" />,
      title: "HR Management",
      description: "Complete employee data management, attendance tracking, automated salary calculations, and health insurance records with fingerprint integration."
    },
    {
      icon: <Calculator className="h-8 w-8" />,
      title: "Financial Management",
      description: "Track daily transactions, manage accounts payable/receivable, monitor fixed assets, and record all business expenses seamlessly."
    },
    {
      icon: <PieChart className="h-8 w-8" />,
      title: "Production & Inventory",
      description: "Monitor inventory movement, manage production orders, track material needs, and optimize supply chain operations."
    },
    {
      icon: <BarChart3 className="h-8 w-8" />,
      title: "Cost Management",
      description: "Calculate production and service costs accurately with detailed profit and loss reports for informed decision-making."
    },
    {
      icon: <Building2 className="h-8 w-8" />,
      title: "Accounts & Banking",
      description: "Comprehensive management of company accounts, check processing, and debt tracking for suppliers and customers."
    },
    {
      icon: <FileText className="h-8 w-8" />,
      title: "Analytics & Reports",
      description: "Generate accurate financial statements, visual reports with graphs, and automated VAT breakdowns for strategic insights."
    }
  ];

  const benefits = [
    {
      icon: <Zap className="h-6 w-6" />,
      title: "Ease of Use",
      description: "Simple and flexible interface with clear menus for daily operations"
    },
    {
      icon: <Globe className="h-6 w-6" />,
      title: "Seamless Integration",
      description: "Easily integrate with existing CRM and inventory management systems"
    },
    {
      icon: <Shield className="h-6 w-6" />,
      title: "Robust Security",
      description: "High-level security layers to protect your sensitive financial data"
    },
    {
      icon: <HeadphonesIcon className="h-6 w-6" />,
      title: "24/7 Support",
      description: "Continuous updates and around-the-clock technical support"
    },
    {
      icon: <Cloud className="h-6 w-6" />,
      title: "Cloud Computing",
      description: "Access your data from anywhere, anytime with cloud flexibility"
    },
    {
      icon: <Bell className="h-6 w-6" />,
      title: "Automated Notifications",
      description: "Get alerts for important financial matters and pending payments"
    }
  ];

  const modules = [
    {
      title: "Full Customization",
      features: ["Personalized setup for each client", "Company logo and user photo integration", "Remote control and updates"]
    },
    {
      title: "HR Management",
      features: ["Complete employee database", "Attendance and leave tracking", "Automated salary calculations", "Fingerprint device integration", "Health insurance management"]
    },
    {
      title: "Financial Operations",
      features: ["Production & inventory monitoring", "Cost management and analysis", "Banking and payment processing", "Online obligation settlements", "Automatic payment reminders"]
    },
    {
      title: "Analytics & Control",
      features: ["Permission-based access control", "Visual reports with graphs", "Automated financial statements", "Custom report generation", "VAT breakdown automation"]
    }
  ];

  const testimonials = [
    {
      name: "Ahmed Hassan",
      role: "CEO, Manufacturing Co.",
      content: "DataLife Account transformed our business operations. The integrated approach saved us countless hours and improved our financial accuracy."
    },
    {
      name: "Fatima Al-Zahra",
      role: "HR Director",
      content: "The HR module is exceptional. Employee management, attendance tracking, and salary calculations are now completely automated."
    },
    {
      name: "Omar Rashid",
      role: "Finance Manager",
      content: "Finally, a system that handles everything from inventory to financial reporting. The visual reports make decision-making so much easier."
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Navigation */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${isScrolled ? 'bg-white/95 backdrop-blur-md shadow-lg' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-[#28376B] rounded-lg flex items-center justify-center">
                <Database className="h-6 w-6 text-white" />
              </div>
              <span className="text-xl font-bold text-[#28376B]">DataLife Account</span>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-gray-600 hover:text-[#28376B] transition-colors">Features</a>
              <a href="#modules" className="text-gray-600 hover:text-[#28376B] transition-colors">Modules</a>
              <a href="#pricing" className="text-gray-600 hover:text-[#28376B] transition-colors">Pricing</a>
              <Button className="bg-[#28376B] hover:bg-[#1e2a5a] text-white">
                Get Started
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <Badge className="mb-6 bg-[#28376B]/10 text-[#28376B] border-[#28376B]/20">
              All-in-One Business Management Solution
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
              Your Complete Solution for
              <span className="block text-[#28376B]">Business Management</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
              Say goodbye to fragmented programs and scattered data. DataLife Account combines HR, production, accounting, and cost management into one powerful platform for maximum efficiency and control.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Button size="lg" className="bg-[#28376B] hover:bg-[#1e2a5a] text-white px-8 py-4 text-lg">
                Start Free Trial
              </Button>
              <Button size="lg" variant="outline" className="border-[#28376B] text-[#28376B] hover:bg-[#28376B] hover:text-white px-8 py-4 text-lg">
                Watch Demo
              </Button>
            </div>
            <div className="flex flex-wrap justify-center gap-8 text-sm text-gray-500">
              <div className="flex items-center">
                <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                No Setup Fees
              </div>
              <div className="flex items-center">
                <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                24/7 Support
              </div>
              <div className="flex items-center">
                <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                Cloud-Based
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              Everything Your Business Needs
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              From HR management to financial reporting, DataLife Account provides comprehensive tools to streamline every aspect of your business operations.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="group hover:shadow-xl transition-all duration-300 border-0 shadow-lg hover:-translate-y-2">
                <CardHeader>
                  <div className="w-12 h-12 bg-[#28376B]/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-[#28376B] transition-colors duration-300">
                    <div className="text-[#28376B] group-hover:text-white transition-colors duration-300">
                      {feature.icon}
                    </div>
                  </div>
                  <CardTitle className="text-xl text-gray-900">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-gray-600 leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-[#28376B] to-[#1e2a5a]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
              Why Choose DataLife Account?
            </h2>
            <p className="text-xl text-blue-100 max-w-3xl mx-auto">
              Built for businesses that demand excellence, reliability, and comprehensive functionality.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {benefits.map((benefit, index) => (
              <div key={index} className="bg-white/10 backdrop-blur-sm rounded-xl p-6 hover:bg-white/20 transition-all duration-300">
                <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center mb-4">
                  <div className="text-white">{benefit.icon}</div>
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">{benefit.title}</h3>
                <p className="text-blue-100 leading-relaxed">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Modules Section */}
      <section id="modules" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              Key Program Features
            </h2>
            <p className="text-xl text-gray-600">
              Explore the comprehensive modules that make DataLife Account your complete business solution.
            </p>
          </div>
          <Accordion type="single" collapsible className="space-y-4">
            {modules.map((module, index) => (
              <AccordionItem key={index} value={`item-${index}`} className="border rounded-lg px-6 shadow-sm">
                <AccordionTrigger className="text-lg font-semibold text-gray-900 hover:text-[#28376B] py-6">
                  {module.title}
                </AccordionTrigger>
                <AccordionContent className="pb-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {module.features.map((feature, featureIndex) => (
                      <div key={featureIndex} className="flex items-center space-x-3">
                        <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                        <span className="text-gray-600">{feature}</span>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              Trusted by Business Leaders
            </h2>
            <p className="text-xl text-gray-600">
              See how DataLife Account has transformed businesses across various industries.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="border-0 shadow-lg">
                <CardContent className="p-6">
                  <p className="text-gray-600 mb-6 leading-relaxed">"{testimonial.content}"</p>
                  <div>
                    <p className="font-semibold text-gray-900">{testimonial.name}</p>
                    <p className="text-sm text-gray-500">{testimonial.role}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-[#28376B] to-[#1e2a5a]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to Transform Your Business?
          </h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Join thousands of businesses that have streamlined their operations with DataLife Account. Start your free trial today.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-white text-[#28376B] hover:bg-gray-100 px-8 py-4 text-lg">
              Start Free Trial
            </Button>
            <Button size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-[#28376B] px-8 py-4 text-lg">
              Contact Sales
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-8 h-8 bg-[#28376B] rounded-lg flex items-center justify-center">
                  <Database className="h-5 w-5 text-white" />
                </div>
                <span className="text-lg font-bold">DataLife Account</span>
              </div>
              <p className="text-gray-400">
                Your partner in business success through comprehensive management solutions.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Demo</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Support</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Documentation</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Help Center</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">About</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Privacy</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2025 DataLife Account. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;