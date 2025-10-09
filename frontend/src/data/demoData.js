// Demo data for DataLife Account interactive demo
import { DollarSign, Calculator, TrendingUp, BarChart3, PieChart, AlertCircle } from 'lucide-react';

export const demoData = {
  summary: {
    totalEmployees: 45,
    monthlyRevenue: 285000,
    activeProjects: 12,
    efficiency: 92
  },

  recentActivity: [
    {
      title: "New employee Ahmed Hassan added to HR system",
      time: "2 minutes ago",
      type: "success",
      module: "HR"
    },
    {
      title: "Monthly payroll processed successfully",
      time: "1 hour ago", 
      type: "success",
      module: "HR"
    },
    {
      title: "Inventory alert: Office supplies running low",
      time: "3 hours ago",
      type: "warning", 
      module: "Inventory"
    },
    {
      title: "Financial report generated",
      time: "5 hours ago",
      type: "info",
      module: "Reports"
    },
    {
      title: "New supplier contract added",
      time: "1 day ago",
      type: "success",
      module: "Financial"
    }
  ],

  upcomingTasks: [
    {
      title: "Process monthly payroll",
      dueDate: "Due tomorrow",
      priority: "high"
    },
    {
      title: "Review supplier invoices",
      dueDate: "Due in 2 days",
      priority: "medium"
    },
    {
      title: "Update inventory levels",
      dueDate: "Due in 3 days",
      priority: "medium"
    },
    {
      title: "Generate quarterly report",
      dueDate: "Due next week",
      priority: "low"
    }
  ],

  hr: {
    totalEmployees: 45,
    presentToday: 42,
    onLeave: 3,
    
    employees: [
      {
        name: "Ahmed Mohamed Hassan",
        email: "ahmed.hassan@company.com",
        position: "Senior Developer",
        department: "IT",
        status: "Present",
        avatar: "/api/placeholder/40/40",
        salary: 15000,
        joinDate: "2023-01-15"
      },
      {
        name: "Fatima Al-Zahra Ali",
        email: "fatima.ali@company.com", 
        position: "HR Manager",
        department: "HR",
        status: "Present",
        avatar: "/api/placeholder/40/40",
        salary: 18000,
        joinDate: "2022-08-20"
      },
      {
        name: "Omar Rashid Mohamed",
        email: "omar.rashid@company.com",
        position: "Finance Director",
        department: "Finance", 
        status: "On Leave",
        avatar: "/api/placeholder/40/40",
        salary: 25000,
        joinDate: "2021-03-10"
      },
      {
        name: "Layla Mahmoud Khaled",
        email: "layla.mahmoud@company.com",
        position: "Operations Manager",
        department: "Operations",
        status: "Present",
        avatar: "/api/placeholder/40/40",
        salary: 20000,
        joinDate: "2022-11-05"
      },
      {
        name: "Youssef Ibrahim Said",
        email: "youssef.ibrahim@company.com",
        position: "Sales Manager",
        department: "Sales",
        status: "Present",
        avatar: "/api/placeholder/40/40",
        salary: 17000,
        joinDate: "2023-02-28"
      }
    ],

    attendance: [
      { date: "2025-01-15", present: 43, absent: 2, late: 0 },
      { date: "2025-01-14", present: 45, absent: 0, late: 1 },
      { date: "2025-01-13", present: 44, absent: 1, late: 2 },
      { date: "2025-01-12", present: 42, absent: 3, late: 0 },
      { date: "2025-01-11", present: 45, absent: 0, late: 0 }
    ]
  },

  financial: {
    overview: [
      {
        label: "Total Revenue",
        value: "2.8M EGP",
        change: "+23%",
        icon: DollarSign,
        color: "text-green-500"
      },
      {
        label: "Total Expenses", 
        value: "1.9M EGP",
        change: "+12%",
        icon: Calculator,
        color: "text-red-500"
      },
      {
        label: "Net Profit",
        value: "890K EGP", 
        change: "+35%",
        icon: TrendingUp,
        color: "text-blue-500"
      },
      {
        label: "Cash Flow",
        value: "450K EGP",
        change: "+18%", 
        icon: BarChart3,
        color: "text-purple-500"
      }
    ],

    transactions: [
      {
        date: "2025-01-15",
        description: "Client payment - ABC Corporation",
        category: "Revenue",
        type: "income",
        amount: 85000,
        status: "Completed"
      },
      {
        date: "2025-01-15",
        description: "Office rent payment",
        category: "Operating Expenses",
        type: "expense", 
        amount: 25000,
        status: "Completed"
      },
      {
        date: "2025-01-14",
        description: "Equipment purchase",
        category: "Capital Expenditure",
        type: "expense",
        amount: 45000,
        status: "Pending"
      },
      {
        date: "2025-01-14",
        description: "Service fees - XYZ Ltd",
        category: "Revenue",
        type: "income",
        amount: 32000,
        status: "Completed"
      },
      {
        date: "2025-01-13",
        description: "Employee salaries",
        category: "Payroll",
        type: "expense",
        amount: 180000,
        status: "Completed"
      }
    ]
  },

  inventory: {
    overview: [
      {
        label: "Total Items",
        value: "1,247",
        icon: PieChart,
        color: "text-blue-500"
      },
      {
        label: "Low Stock Items",
        value: "23",
        icon: AlertCircle,
        color: "text-orange-500"
      },
      {
        label: "Total Value",
        value: "890K EGP",
        icon: DollarSign,
        color: "text-green-500"
      }
    ],

    items: [
      {
        product: "Office Paper A4",
        category: "Office Supplies",
        sku: "OFF-001",
        quantity: 150,
        maxQuantity: 500,
        value: 4500,
        status: "Low Stock"
      },
      {
        product: "Laptop Dell Inspiron",
        category: "Equipment", 
        sku: "EQP-045",
        quantity: 25,
        maxQuantity: 50,
        value: 875000,
        status: "In Stock"
      },
      {
        product: "Printer Cartridges",
        category: "Office Supplies",
        sku: "OFF-018", 
        quantity: 8,
        maxQuantity: 50,
        value: 2400,
        status: "Critical"
      },
      {
        product: "Desk Chairs",
        category: "Furniture",
        sku: "FUR-012",
        quantity: 35,
        maxQuantity: 60,
        value: 105000,
        status: "In Stock"
      },
      {
        product: "Coffee Machine",
        category: "Appliances", 
        sku: "APP-003",
        quantity: 2,
        maxQuantity: 5,
        value: 8000,
        status: "In Stock"
      }
    ]
  },

  reports: {
    monthlyRevenue: [
      { month: "Jan 2025", revenue: 285000 },
      { month: "Dec 2024", revenue: 252000 },
      { month: "Nov 2024", revenue: 231000 },
      { month: "Oct 2024", revenue: 198000 },
      { month: "Sep 2024", revenue: 187000 },
      { month: "Aug 2024", revenue: 203000 }
    ],

    expenses: [
      { category: "Salaries", amount: 180000 },
      { category: "Rent", amount: 25000 },
      { category: "Utilities", amount: 8000 },
      { category: "Marketing", amount: 15000 },
      { category: "Equipment", amount: 12000 },
      { category: "Other", amount: 7000 }
    ]
  },

  analytics: {
    productivity: [
      { metric: "Task Completion Rate", value: 94, target: 90 },
      { metric: "Employee Satisfaction", value: 87, target: 85 },
      { metric: "Customer Satisfaction", value: 92, target: 90 },
      { metric: "Revenue Growth", value: 23, target: 20 }
    ],

    trends: [
      { period: "Q4 2024", revenue: 756000, growth: 18 },
      { period: "Q3 2024", revenue: 641000, growth: 15 },
      { period: "Q2 2024", revenue: 557000, growth: 22 },
      { period: "Q1 2024", revenue: 456000, growth: 12 }
    ]
  }
};

export default demoData;