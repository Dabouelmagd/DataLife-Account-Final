// Mock data for DataLife Account landing page

export const mockFeatures = [
  {
    id: 1,
    icon: "Users",
    title: "HR Management",
    description: "Complete employee data management, attendance tracking, automated salary calculations, and health insurance records with fingerprint integration.",
    details: [
      "Employee database with documents and photos",
      "Attendance and leave tracking system",
      "Automated salary calculations with tax compliance",
      "Fingerprint device integration",
      "Health insurance and medical records"
    ]
  },
  {
    id: 2,
    icon: "Calculator",
    title: "Financial Management",
    description: "Track daily transactions, manage accounts payable/receivable, monitor fixed assets, and record all business expenses seamlessly.",
    details: [
      "Daily transaction tracking",
      "Accounts payable and receivable management",
      "Fixed asset monitoring",
      "Expense recording and categorization",
      "Financial statement generation"
    ]
  },
  {
    id: 3,
    icon: "PieChart",
    title: "Production & Inventory",
    description: "Monitor inventory movement, manage production orders, track material needs, and optimize supply chain operations.",
    details: [
      "Real-time inventory tracking",
      "Production order management",
      "Material requirement planning",
      "Supply chain optimization",
      "Stock level alerts and notifications"
    ]
  },
  {
    id: 4,
    icon: "BarChart3",
    title: "Cost Management",
    description: "Calculate production and service costs accurately with detailed profit and loss reports for informed decision-making.",
    details: [
      "Accurate cost calculations",
      "Production cost analysis",
      "Service cost tracking",
      "Profit and loss reporting",
      "Cost optimization recommendations"
    ]
  },
  {
    id: 5,
    icon: "Building2",
    title: "Accounts & Banking",
    description: "Comprehensive management of company accounts, check processing, and debt tracking for suppliers and customers.",
    details: [
      "Bank account management",
      "Check processing system",
      "Supplier debt tracking",
      "Customer credit management",
      "Payment reconciliation"
    ]
  },
  {
    id: 6,
    icon: "FileText",
    title: "Analytics & Reports",
    description: "Generate accurate financial statements, visual reports with graphs, and automated VAT breakdowns for strategic insights.",
    details: [
      "Visual financial reports",
      "Automated financial statements",
      "VAT breakdown and compliance",
      "Custom report generation",
      "Strategic business insights"
    ]
  }
];

export const mockBenefits = [
  {
    id: 1,
    icon: "Zap",
    title: "Ease of Use",
    description: "Simple and flexible interface with clear menus for daily operations",
    stats: "95% user satisfaction rate"
  },
  {
    id: 2,
    icon: "Globe",
    title: "Seamless Integration",
    description: "Easily integrate with existing CRM and inventory management systems",
    stats: "50+ supported integrations"
  },
  {
    id: 3,
    icon: "Shield",
    title: "Robust Security",
    description: "High-level security layers to protect your sensitive financial data",
    stats: "Bank-grade encryption"
  },
  {
    id: 4,
    icon: "HeadphonesIcon",
    title: "24/7 Support",
    description: "Continuous updates and around-the-clock technical support",
    stats: "Average 2-minute response time"
  },
  {
    id: 5,
    icon: "Cloud",
    title: "Cloud Computing",
    description: "Access your data from anywhere, anytime with cloud flexibility",
    stats: "99.9% uptime guarantee"
  },
  {
    id: 6,
    icon: "Bell",
    title: "Automated Notifications",
    description: "Get alerts for important financial matters and pending payments",
    stats: "Real-time notifications"
  }
];

export const mockTestimonials = [
  {
    id: 1,
    name: "Ahmed Hassan",
    role: "CEO, Manufacturing Co.",
    company: "Hassan Industries",
    content: "DataLife Account transformed our business operations. The integrated approach saved us countless hours and improved our financial accuracy by 40%.",
    rating: 5,
    image: "/api/placeholder/64/64"
  },
  {
    id: 2,
    name: "Fatima Al-Zahra",
    role: "HR Director",
    company: "Tech Solutions Ltd",
    content: "The HR module is exceptional. Employee management, attendance tracking, and salary calculations are now completely automated. Our HR efficiency increased by 60%.",
    rating: 5,
    image: "/api/placeholder/64/64"
  },
  {
    id: 3,
    name: "Omar Rashid",
    role: "Finance Manager",
    company: "Rashid Trading",
    content: "Finally, a system that handles everything from inventory to financial reporting. The visual reports make decision-making so much easier and faster.",
    rating: 5,
    image: "/api/placeholder/64/64"
  },
  {
    id: 4,
    name: "Layla Mohamed",
    role: "Operations Manager",
    company: "Modern Logistics",
    content: "The production and inventory management features are outstanding. We reduced our operational costs by 25% in the first quarter of implementation.",
    rating: 5,
    image: "/api/placeholder/64/64"
  }
];

export const mockModules = [
  {
    id: 1,
    title: "Full Customization",
    description: "Personalize your system according to your business needs",
    features: [
      "Personalized setup for each client",
      "Company logo and user photo integration",
      "Remote control and updates from developer",
      "Custom branding options",
      "Flexible user interface configuration"
    ],
    icon: "Settings"
  },
  {
    id: 2,
    title: "HR Management",
    description: "Complete human resources management solution",
    features: [
      "Complete employee database with documents",
      "Attendance and leave tracking system",
      "Automated salary calculations with Egyptian law compliance",
      "Fingerprint device integration support",
      "Health insurance and medical treatment records"
    ],
    icon: "Users"
  },
  {
    id: 3,
    title: "Financial Operations",
    description: "Comprehensive financial and administrative management",
    features: [
      "Production & inventory monitoring",
      "Accurate cost management and analysis",
      "Banking and payment processing",
      "Online obligation settlements",
      "Automatic payment reminders and alerts"
    ],
    icon: "DollarSign"
  },
  {
    id: 4,
    title: "Analytics & Control",
    description: "Advanced reporting and permission management",
    features: [
      "Permission-based access control system",
      "Visual reports with illustrative graphs",
      "Automated monthly and annual financial statements",
      "Custom report generation and printing",
      "VAT breakdown and compliance automation"
    ],
    icon: "BarChart3"
  }
];

export const mockPricingPlans = [
  {
    id: 1,
    name: "Starter",
    price: 299,
    currency: "EGP",
    period: "month",
    description: "Perfect for small businesses getting started",
    features: [
      "Up to 10 employees",
      "Basic HR management",
      "Financial tracking",
      "Monthly reports",
      "Email support",
      "Cloud storage (5GB)"
    ],
    highlighted: false,
    buttonText: "Start Free Trial"
  },
  {
    id: 2,
    name: "Professional",
    price: 599,
    currency: "EGP",
    period: "month",
    description: "Ideal for growing businesses with advanced needs",
    features: [
      "Up to 50 employees",
      "Complete HR & payroll",
      "Advanced financial management",
      "Production & inventory tracking",
      "Priority support",
      "Cloud storage (25GB)",
      "Custom reports",
      "API integrations"
    ],
    highlighted: true,
    buttonText: "Most Popular"
  },
  {
    id: 3,
    name: "Enterprise",
    price: 1299,
    currency: "EGP",
    period: "month",
    description: "Comprehensive solution for large organizations",
    features: [
      "Unlimited employees",
      "Full system access",
      "Advanced analytics",
      "Multi-location support",
      "24/7 phone support",
      "Unlimited cloud storage",
      "Custom integrations",
      "Dedicated account manager",
      "On-site training"
    ],
    highlighted: false,
    buttonText: "Contact Sales"
  }
];

export const mockStats = [
  {
    id: 1,
    value: "10,000+",
    label: "Active Users",
    description: "Businesses trust DataLife Account"
  },
  {
    id: 2,
    value: "99.9%",
    label: "Uptime",
    description: "Reliable service guarantee"
  },
  {
    id: 3,
    value: "40%",
    label: "Cost Savings",
    description: "Average operational cost reduction"
  },
  {
    id: 4,
    value: "24/7",
    label: "Support",
    description: "Round-the-clock assistance"
  }
];

export const mockFAQs = [
  {
    id: 1,
    question: "What makes DataLife Account different from other accounting software?",
    answer: "DataLife Account is a comprehensive business management solution that integrates HR, financial management, production, inventory, and analytics into one platform. Unlike traditional accounting software that focuses on financial tracking only, we provide end-to-end business management capabilities."
  },
  {
    id: 2,
    question: "Can I integrate DataLife Account with my existing systems?",
    answer: "Yes, DataLife Account supports seamless integration with existing CRM systems, inventory management software, and other business tools. Our API allows for custom integrations, and our support team assists with the integration process."
  },
  {
    id: 3,
    question: "Is my data secure with DataLife Account?",
    answer: "Absolutely. We use bank-grade encryption and maintain high-level security layers to protect your sensitive financial and business data. All data is backed up regularly and stored in secure cloud servers with 99.9% uptime guarantee."
  },
  {
    id: 4,
    question: "Do you provide training for my team?",
    answer: "Yes, we provide comprehensive training for your team. This includes online tutorials, documentation, webinars, and for Enterprise customers, we offer on-site training sessions to ensure your team can maximize the system's potential."
  },
  {
    id: 5,
    question: "Can I access DataLife Account from mobile devices?",
    answer: "Yes, DataLife Account is cloud-based and fully responsive, allowing you to access your business data from any device, anywhere, anytime. We also offer dedicated mobile apps for iOS and Android devices."
  },
  {
    id: 6,
    question: "What kind of support do you provide?",
    answer: "We provide 24/7 technical support with multiple channels including email, phone, and live chat. Our support team offers continuous updates, troubleshooting assistance, and guidance to help you get the most out of the system."
  }
];

// Mock API responses for future backend integration
export const mockApiResponses = {
  // Contact form submission
  contactSubmission: {
    success: true,
    message: "Thank you for your interest! Our team will contact you within 24 hours.",
    ticket_id: "DLA-2025-001"
  },
  
  // Newsletter subscription
  newsletterSubscription: {
    success: true,
    message: "Successfully subscribed to our newsletter!"
  },
  
  // Demo request
  demoRequest: {
    success: true,
    message: "Demo scheduled successfully! You will receive a confirmation email shortly.",
    demo_id: "DEMO-2025-001",
    scheduled_date: "2025-01-15T10:00:00Z"
  },
  
  // Free trial signup
  freeTrialSignup: {
    success: true,
    message: "Your free trial account has been created!",
    trial_id: "TRIAL-2025-001",
    access_url: "https://app.datalife.com/trial",
    expires_at: "2025-02-14T23:59:59Z"
  }
};

export default {
  mockFeatures,
  mockBenefits,
  mockTestimonials,
  mockModules,
  mockPricingPlans,
  mockStats,
  mockFAQs,
  mockApiResponses
};