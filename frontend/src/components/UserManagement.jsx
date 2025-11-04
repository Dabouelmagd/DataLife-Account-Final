import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { 
  Plus, Edit, Trash2, Eye, Upload, ArrowLeft, Users, 
  Mail, Shield, Calendar, CheckCircle, AlertCircle, Camera
} from 'lucide-react';
import axios from 'axios';

const UserManagement = ({ language = 'ar' }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isRTL = language === 'ar';
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [profileImage, setProfileImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [toast, setToast] = useState({ show: false, message: '', type: '' });

  // Show toast notification
  const showToast = (message, type = 'error') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: '', type: '' });
    }, 5000);
  };

  const [newUser, setNewUser] = useState({
    full_name: '',
    email: '',
    password: '',
    role: ''
  });

  const [editUser, setEditUser] = useState({
    id: '',
    full_name: '',
    email: '',
    role: ''
  });

  // Check if current user can manage users
  const canManageUsers = ['General Manager', 'CEO', 'Board Chairman', 
                          'مدير عام', 'المدير التنفيذي', 'رئيس مجلس الإدارة'].includes(user?.role);

  // Roles list
  const roles = [
    { value: 'Board Chairman', label: language === 'ar' ? 'رئيس مجلس الإدارة' : 'Board Chairman' },
    { value: 'CEO', label: language === 'ar' ? 'المدير التنفيذي' : 'CEO' },
    { value: 'General Manager', label: language === 'ar' ? 'المدير العام' : 'General Manager' },
    { value: 'Financial Manager', label: language === 'ar' ? 'المدير المالي' : 'Financial Manager' },
    { value: 'Chief Accountant', label: language === 'ar' ? 'رئيس الحسابات' : 'Chief Accountant' },
    { value: 'HR Manager', label: language === 'ar' ? 'مدير الموارد البشرية' : 'HR Manager' },
    { value: 'Accountant', label: language === 'ar' ? 'محاسب' : 'Accountant' }
  ];

  // Fetch users
  useEffect(() => {
    if (!canManageUsers) {
      navigate('/dashboard');
      return;
    }
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle image selection
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProfileImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle add user
  const handleAddUser = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/api/users`,
        newUser,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Upload profile image if selected
      if (profileImage && response.data.id) {
        const formData = new FormData();
        formData.append('file', profileImage);
        
        await axios.post(
          `${process.env.REACT_APP_BACKEND_URL}/api/users/${response.data.id}/upload-photo`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'multipart/form-data'
            }
          }
        );
      }

      setShowAddModal(false);
      setNewUser({ full_name: '', email: '', password: '', role: '' });
      setProfileImage(null);
      setImagePreview(null);
      fetchUsers();
    } catch (error) {
      console.error('Error adding user:', error);
      alert(error.response?.data?.detail || 'Error adding user');
    }
  };

  // Handle edit user
  const handleEditUser = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${process.env.REACT_APP_BACKEND_URL}/api/users/${editUser.id}`,
        editUser,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Upload profile image if selected
      if (profileImage) {
        const formData = new FormData();
        formData.append('file', profileImage);
        
        await axios.post(
          `${process.env.REACT_APP_BACKEND_URL}/api/users/${editUser.id}/upload-photo`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'multipart/form-data'
            }
          }
        );
      }

      setShowEditModal(false);
      setEditUser({ id: '', full_name: '', email: '', role: '' });
      setProfileImage(null);
      setImagePreview(null);
      fetchUsers();
    } catch (error) {
      console.error('Error updating user:', error);
      alert(error.response?.data?.detail || 'Error updating user');
    }
  };

  // Handle delete user
  const handleDeleteUser = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(
        `${process.env.REACT_APP_BACKEND_URL}/api/users/${selectedUser.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setShowDeleteModal(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      alert(error.response?.data?.detail || 'Error deleting user');
    }
  };

  // Get role color
  const getRoleColor = (role) => {
    if (['CEO', 'المدير التنفيذي', 'Board Chairman', 'رئيس مجلس الإدارة'].includes(role)) {
      return 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white';
    } else if (['General Manager', 'مدير عام'].includes(role)) {
      return 'bg-gradient-to-r from-purple-400 to-pink-500 text-white';
    } else if (['Financial Manager', 'المدير المالي', 'Chief Accountant', 'رئيس الحسابات'].includes(role)) {
      return 'bg-gradient-to-r from-green-400 to-teal-500 text-white';
    } else if (['HR Manager', 'مدير الموارد البشرية'].includes(role)) {
      return 'bg-gradient-to-r from-blue-400 to-cyan-500 text-white';
    }
    return 'bg-gray-500 text-white';
  };

  if (!canManageUsers) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => navigate('/dashboard')}
              className="rounded-xl"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {language === 'ar' ? 'العودة' : 'Back'}
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {language === 'ar' ? 'إدارة المستخدمين' : 'User Management'}
              </h1>
              <p className="text-gray-600">
                {language === 'ar' ? 'إدارة المستخدمين والصلاحيات' : 'Manage users and permissions'}
              </p>
            </div>
          </div>
          <Button
            onClick={() => setShowAddModal(true)}
            className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-xl h-12"
          >
            <Plus className="h-5 w-5 mr-2" />
            {language === 'ar' ? 'إضافة مستخدم' : 'Add User'}
          </Button>
        </div>

        {/* Users Table */}
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {language === 'ar' ? 'قائمة المستخدمين' : 'Users List'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-2 text-gray-600">{language === 'ar' ? 'جارٍ التحميل...' : 'Loading...'}</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-bold">{language === 'ar' ? 'الصورة' : 'Photo'}</TableHead>
                    <TableHead className="font-bold">{language === 'ar' ? 'الاسم' : 'Name'}</TableHead>
                    <TableHead className="font-bold">{language === 'ar' ? 'البريد الإلكتروني' : 'Email'}</TableHead>
                    <TableHead className="font-bold">{language === 'ar' ? 'الدور' : 'Role'}</TableHead>
                    <TableHead className="font-bold">{language === 'ar' ? 'تاريخ الإنشاء' : 'Created'}</TableHead>
                    <TableHead className="font-bold">{language === 'ar' ? 'إجراءات' : 'Actions'}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((usr) => (
                    <TableRow key={usr.id} className="hover:bg-gray-50 transition-colors">
                      <TableCell>
                        {usr.profile_photo_url ? (
                          <img 
                            src={usr.profile_photo_url} 
                            alt={usr.full_name}
                            className="w-10 h-10 rounded-full object-cover border-2 border-gray-200"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center text-white font-bold">
                            {usr.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{usr.full_name}</TableCell>
                      <TableCell>{usr.email}</TableCell>
                      <TableCell>
                        <Badge className={getRoleColor(usr.role)}>
                          {usr.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {new Date(usr.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditUser(usr);
                              setImagePreview(usr.profile_photo_url);
                              setShowEditModal(true);
                            }}
                          >
                            <Edit className="h-4 w-4 text-blue-600" />
                          </Button>
                          {usr.id !== user?.id && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedUser(usr);
                                setShowDeleteModal(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Add User Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowAddModal(false)}>
            <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl transform transition-all" onClick={(e) => e.stopPropagation()} dir={isRTL ? 'rtl' : 'ltr'}>
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-6 rounded-t-2xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                      <Plus className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-white">
                        {language === 'ar' ? 'إضافة مستخدم جديد' : 'Add New User'}
                      </h3>
                      <p className="text-blue-100 text-sm">
                        {language === 'ar' ? 'املأ البيانات أدناه' : 'Fill in the details below'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-all"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-5">
                {/* Profile Photo Upload */}
                <div className="flex flex-col items-center">
                  <div className="relative">
                    {imagePreview ? (
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-24 h-24 rounded-full object-cover border-4 border-blue-200"
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center text-white text-3xl font-bold">
                        <Camera className="h-10 w-10" />
                      </div>
                    )}
                    <label className="absolute bottom-0 right-0 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center cursor-pointer hover:bg-blue-600 transition-all shadow-lg">
                      <Upload className="h-4 w-4 text-white" />
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageChange}
                      />
                    </label>
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
                    {language === 'ar' ? 'اضغط لرفع صورة' : 'Click to upload photo'}
                  </p>
                </div>

                {/* Full Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <Users className="h-4 w-4 inline mr-2" />
                    {language === 'ar' ? 'الاسم الكامل' : 'Full Name'}
                  </label>
                  <input
                    type="text"
                    value={newUser.full_name}
                    onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                    className="w-full p-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-gray-50"
                    placeholder={language === 'ar' ? 'أدخل الاسم الكامل' : 'Enter full name'}
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <Mail className="h-4 w-4 inline mr-2" />
                    {language === 'ar' ? 'البريد الإلكتروني' : 'Email'}
                  </label>
                  <input
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    className="w-full p-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-gray-50"
                    placeholder={language === 'ar' ? 'أدخل البريد الإلكتروني' : 'Enter email'}
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <Shield className="h-4 w-4 inline mr-2" />
                    {language === 'ar' ? 'كلمة المرور' : 'Password'}
                  </label>
                  <input
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    className="w-full p-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-gray-50"
                    placeholder={language === 'ar' ? 'أدخل كلمة المرور' : 'Enter password'}
                  />
                </div>

                {/* Role */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <Shield className="h-4 w-4 inline mr-2" />
                    {language === 'ar' ? 'الدور' : 'Role'}
                  </label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                    className="w-full p-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-gray-50"
                  >
                    <option value="">{language === 'ar' ? 'اختر الدور' : 'Select role'}</option>
                    {roles.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-6 bg-gray-50 rounded-b-2xl flex gap-3">
                <Button
                  onClick={handleAddUser}
                  className="flex-1 h-12 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold rounded-xl shadow-lg"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  {language === 'ar' ? 'إضافة المستخدم' : 'Add User'}
                </Button>
                <Button
                  onClick={() => {
                    setShowAddModal(false);
                    setImagePreview(null);
                    setProfileImage(null);
                  }}
                  variant="outline"
                  className="flex-1 h-12 border-2 rounded-xl font-semibold"
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Edit User Modal - Similar structure */}
        {showEditModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowEditModal(false)}>
            <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl transform transition-all" onClick={(e) => e.stopPropagation()} dir={isRTL ? 'rtl' : 'ltr'}>
              {/* Similar to Add Modal but for editing */}
              <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6 rounded-t-2xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                      <Edit className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-white">
                        {language === 'ar' ? 'تعديل المستخدم' : 'Edit User'}
                      </h3>
                      <p className="text-green-100 text-sm">
                        {language === 'ar' ? 'قم بتحديث البيانات' : 'Update user information'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-all"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-5">
                {/* Profile Photo Upload */}
                <div className="flex flex-col items-center">
                  <div className="relative">
                    {imagePreview ? (
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-24 h-24 rounded-full object-cover border-4 border-green-200"
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-white text-2xl font-bold">
                        {editUser.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                      </div>
                    )}
                    <label className="absolute bottom-0 right-0 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center cursor-pointer hover:bg-green-600 transition-all shadow-lg">
                      <Upload className="h-4 w-4 text-white" />
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageChange}
                      />
                    </label>
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
                    {language === 'ar' ? 'اضغط لتغيير الصورة' : 'Click to change photo'}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <Users className="h-4 w-4 inline mr-2" />
                    {language === 'ar' ? 'الاسم الكامل' : 'Full Name'}
                  </label>
                  <input
                    type="text"
                    value={editUser.full_name}
                    onChange={(e) => setEditUser({ ...editUser, full_name: e.target.value })}
                    className="w-full p-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all bg-gray-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <Mail className="h-4 w-4 inline mr-2" />
                    {language === 'ar' ? 'البريد الإلكتروني' : 'Email'}
                  </label>
                  <input
                    type="email"
                    value={editUser.email}
                    onChange={(e) => setEditUser({ ...editUser, email: e.target.value })}
                    className="w-full p-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all bg-gray-50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <Shield className="h-4 w-4 inline mr-2" />
                    {language === 'ar' ? 'الدور' : 'Role'}
                  </label>
                  <select
                    value={editUser.role}
                    onChange={(e) => setEditUser({ ...editUser, role: e.target.value })}
                    className="w-full p-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all bg-gray-50"
                  >
                    {roles.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-6 bg-gray-50 rounded-b-2xl flex gap-3">
                <Button
                  onClick={handleEditUser}
                  className="flex-1 h-12 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold rounded-xl shadow-lg"
                >
                  <CheckCircle className="h-5 w-5 mr-2" />
                  {language === 'ar' ? 'حفظ التغييرات' : 'Save Changes'}
                </Button>
                <Button
                  onClick={() => {
                    setShowEditModal(false);
                    setImagePreview(null);
                    setProfileImage(null);
                  }}
                  variant="outline"
                  className="flex-1 h-12 border-2 rounded-xl font-semibold"
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && selectedUser && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl" dir={isRTL ? 'rtl' : 'ltr'}>
              <div className="p-6">
                <div className="flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mx-auto mb-4">
                  <AlertCircle className="h-8 w-8 text-red-600" />
                </div>
                <h3 className="text-xl font-bold text-center mb-2">
                  {language === 'ar' ? 'تأكيد الحذف' : 'Confirm Delete'}
                </h3>
                <p className="text-gray-600 text-center mb-6">
                  {language === 'ar' 
                    ? `هل أنت متأكد من حذف المستخدم "${selectedUser.full_name}"؟`
                    : `Are you sure you want to delete user "${selectedUser.full_name}"?`
                  }
                </p>
                <div className="flex gap-3">
                  <Button
                    onClick={handleDeleteUser}
                    className="flex-1 bg-red-500 hover:bg-red-600 text-white h-12 rounded-xl"
                  >
                    {language === 'ar' ? 'حذف' : 'Delete'}
                  </Button>
                  <Button
                    onClick={() => {
                      setShowDeleteModal(false);
                      setSelectedUser(null);
                    }}
                    variant="outline"
                    className="flex-1 h-12 rounded-xl"
                  >
                    {language === 'ar' ? 'إلغاء' : 'Cancel'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserManagement;
