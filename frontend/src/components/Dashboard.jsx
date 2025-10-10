import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import axios from 'axios';
import { 
  Users, UserPlus, LogOut, Settings, LayoutDashboard,
  Briefcase, DollarSign, Package, FileText, TrendingUp,
  Shield, Edit2, Trash2
} from 'lucide-react';
import CompanyLogo from './CompanyLogo';

const Dashboard = () => {
  const { user, logout, hasModule, token } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  
  const [activeSection, setActiveSection] = useState('overview');
  const [users, setUsers] = useState([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '',
    full_name: '',
    password: '',
    role: 'Accountant'
  });

  const isRTL = language === 'ar';
  const API_URL = process.env.REACT_APP_BACKEND_URL;

  const roles = ['General Manager', 'HR Manager', 'Financial Manager', 'Accountant'];

  const modules = [
    { id: 'dashboard', name: 'Dashboard', nameAr: 'لوحة القيادة', icon: LayoutDashboard },
    { id: 'hr', name: 'HR', nameAr: 'الموارد البشرية', icon: Briefcase },
    { id: 'financial', name: 'Financial', nameAr: 'المالية', icon: DollarSign },
    { id: 'inventory', name: 'Inventory', nameAr: 'المخزون', icon: Package },
    { id: 'reports', name: 'Reports', nameAr: 'التقارير', icon: FileText },
    { id: 'analytics', name: 'Analytics', nameAr: 'التحليلات', icon: TrendingUp },
  ];

  useEffect(() => {
    if (activeSection === 'users') {
      fetchUsers();
    }
  }, [activeSection]);

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/users/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    try {
      await axios.post(
        `${API_URL}/api/users/`,
        newUser,
        {
          params: { password: newUser.password },
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setShowAddUser(false);
      setNewUser({ email: '', full_name: '', password: '', role: 'Accountant' });
      fetchUsers();
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to add user');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm(language === 'ar' ? 'هل تريد حذف هذا المستخدم؟' : 'Delete this user?')) return;
    
    try {
      await axios.delete(`${API_URL}/api/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchUsers();
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to delete user');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="flex items-center justify-between px-6 py-4">
          <CompanyLogo />
          <div className="flex items-center gap-4">
            <div className={`text-${isRTL ? 'left' : 'right'}`}>
              <p className="text-sm font-medium text-gray-900">{user?.full_name}</p>
              <p className="text-xs text-gray-500">{user?.role}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r min-h-screen p-4">
          <nav className="space-y-2">
            <button
              onClick={() => setActiveSection('overview')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                activeSection === 'overview' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <LayoutDashboard size={20} />
              <span>{language === 'ar' ? 'نظرة عامة' : 'Overview'}</span>
            </button>

            {modules.map((module) => (
              hasModule(module.id) && (
                <button
                  key={module.id}
                  onClick={() => navigate('/demo')}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <module.icon size={20} />
                  <span>{language === 'ar' ? module.nameAr : module.name}</span>
                </button>
              )
            ))}

            {user?.role === 'General Manager' && (
              <button
                onClick={() => setActiveSection('users')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  activeSection === 'users' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Users size={20} />
                <span>{language === 'ar' ? 'إدارة المستخدمين' : 'User Management'}</span>
              </button>
            )}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          {activeSection === 'overview' && (
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-6">
                {language === 'ar' ? 'مرحباً، ' + user?.full_name : 'Welcome, ' + user?.full_name}
              </h1>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-gray-600">
                      {language === 'ar' ? 'دورك' : 'Your Role'}
                    </h3>
                    <Shield className="text-blue-600" size={24} />
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{user?.role}</p>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-gray-600">
                      {language === 'ar' ? 'الوحدات المتاحة' : 'Available Modules'}
                    </h3>
                    <Package className="text-green-600" size={24} />
                  </div>
                  <p className="text-2xl font-bold text-gray-900">
                    {modules.filter(m => hasModule(m.id)).length}
                  </p>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-gray-600">
                      {language === 'ar' ? 'الحالة' : 'Status'}
                    </h3>
                    <TrendingUp className="text-purple-600" size={24} />
                  </div>
                  <p className="text-2xl font-bold text-green-600">
                    {language === 'ar' ? 'نشط' : 'Active'}
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                  {language === 'ar' ? 'الوحدات المتاحة لك' : 'Your Available Modules'}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {modules.map((module) => (
                    hasModule(module.id) && (
                      <div
                        key={module.id}
                        onClick={() => navigate('/demo')}
                        className="border-2 border-gray-200 rounded-lg p-4 hover:border-blue-500 hover:shadow-md transition-all cursor-pointer"
                      >
                        <module.icon className="text-blue-600 mb-3" size={32} />
                        <h3 className="font-semibold text-gray-900">
                          {language === 'ar' ? module.nameAr : module.name}
                        </h3>
                      </div>
                    )
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeSection === 'users' && user?.role === 'General Manager' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-3xl font-bold text-gray-900">
                  {language === 'ar' ? 'إدارة المستخدمين' : 'User Management'}
                </h1>
                <button
                  onClick={() => setShowAddUser(!showAddUser)}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <UserPlus size={20} />
                  {language === 'ar' ? 'إضافة مستخدم' : 'Add User'}
                </button>
              </div>

              {showAddUser && (
                <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                  <h3 className="text-lg font-semibold mb-4">{language === 'ar' ? 'مستخدم جديد' : 'New User'}</h3>
                  <form onSubmit={handleAddUser} className="grid grid-cols-2 gap-4">
                    <input
                      type="text"
                      placeholder={language === 'ar' ? 'الاسم الكامل' : 'Full Name'}
                      value={newUser.full_name}
                      onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                      required
                      className="px-4 py-2 border rounded-lg"
                    />
                    <input
                      type="email"
                      placeholder={language === 'ar' ? 'البريد الإلكتروني' : 'Email'}
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                      required
                      className="px-4 py-2 border rounded-lg"
                    />
                    <input
                      type="password"
                      placeholder={language === 'ar' ? 'كلمة المرور' : 'Password'}
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      required
                      className="px-4 py-2 border rounded-lg"
                    />
                    <select
                      value={newUser.role}
                      onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                      className="px-4 py-2 border rounded-lg"
                    >
                      {roles.map(role => <option key={role} value={role}>{role}</option>)}
                    </select>
                    <div className="col-span-2 flex gap-4">
                      <button type="submit" className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">
                        {language === 'ar' ? 'إضافة' : 'Add'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAddUser(false)}
                        className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300"
                      >
                        {language === 'ar' ? 'إلغاء' : 'Cancel'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        {language === 'ar' ? 'الاسم' : 'Name'}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        {language === 'ar' ? 'البريد' : 'Email'}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        {language === 'ar' ? 'الدور' : 'Role'}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        {language === 'ar' ? 'الحالة' : 'Status'}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        {language === 'ar' ? 'إجراءات' : 'Actions'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{u.full_name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{u.email}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{u.role}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs rounded-full ${u.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {u.is_active ? (language === 'ar' ? 'نشط' : 'Active') : (language === 'ar' ? 'غير نشط' : 'Inactive')}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {u.id !== user.id && (
                            <button
                              onClick={() => handleDeleteUser(u.id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
