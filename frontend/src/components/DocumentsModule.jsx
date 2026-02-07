import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { toast } from 'sonner';
import axios from 'axios';
import { 
  FileText, Folder, Upload, Search, Grid, List, Download, Trash2, Edit,
  Eye, Plus, RefreshCw, Filter, FolderPlus, File, Image, FileSpreadsheet,
  Presentation, Archive, Music, Video, MoreVertical, Share2, Clock,
  HardDrive, FolderOpen, Tag, Star, ChevronRight, Home, ArrowLeft
} from 'lucide-react';
import useRealTimeSync from '../hooks/useRealTimeSync';

const DocumentsModule = () => {
  const { token } = useAuth();
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  const API_URL = process.env.REACT_APP_BACKEND_URL;

  const [viewMode, setViewMode] = useState('grid');
  const [folders, setFolders] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedFileType, setSelectedFileType] = useState('');
  const [currentFolder, setCurrentFolder] = useState(null);
  const [folderPath, setFolderPath] = useState([]);

  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showFolderDialog, setShowFolderDialog] = useState(false);
  const [showDocumentDialog, setShowDocumentDialog] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [folderForm, setFolderForm] = useState({ name: '', description: '', color: '#6366f1' });
  const [uploadForm, setUploadForm] = useState({ category: 'other', tags: '' });

  const t = {
    documents: isRTL ? 'المستندات' : 'Documents',
    folders: isRTL ? 'المجلدات' : 'Folders',
    upload: isRTL ? 'رفع ملف' : 'Upload',
    newFolder: isRTL ? 'مجلد جديد' : 'New Folder',
    search: isRTL ? 'بحث...' : 'Search...',
    allCategories: isRTL ? 'جميع التصنيفات' : 'All Categories',
    allTypes: isRTL ? 'جميع الأنواع' : 'All Types',
    name: isRTL ? 'الاسم' : 'Name',
    description: isRTL ? 'الوصف' : 'Description',
    category: isRTL ? 'التصنيف' : 'Category',
    tags: isRTL ? 'الوسوم' : 'Tags',
    size: isRTL ? 'الحجم' : 'Size',
    type: isRTL ? 'النوع' : 'Type',
    uploadedBy: isRTL ? 'رفع بواسطة' : 'Uploaded By',
    uploadedAt: isRTL ? 'تاريخ الرفع' : 'Uploaded At',
    download: isRTL ? 'تحميل' : 'Download',
    delete: isRTL ? 'حذف' : 'Delete',
    save: isRTL ? 'حفظ' : 'Save',
    cancel: isRTL ? 'إلغاء' : 'Cancel',
    noDocuments: isRTL ? 'لا توجد مستندات' : 'No documents',
    noFolders: isRTL ? 'لا توجد مجلدات' : 'No folders',
    totalDocs: isRTL ? 'إجمالي المستندات' : 'Total Documents',
    totalSize: isRTL ? 'إجمالي الحجم' : 'Total Size',
    recentUploads: isRTL ? 'المرفوعات الأخيرة' : 'Recent Uploads',
    dragDrop: isRTL ? 'اسحب وأفلت الملفات هنا أو' : 'Drag and drop files here or',
    browse: isRTL ? 'تصفح' : 'Browse',
    contracts: isRTL ? 'العقود' : 'Contracts',
    invoices: isRTL ? 'الفواتير' : 'Invoices',
    hr: isRTL ? 'الموارد البشرية' : 'HR Documents',
    financial: isRTL ? 'المالية' : 'Financial',
    legal: isRTL ? 'القانونية' : 'Legal',
    policies: isRTL ? 'السياسات' : 'Policies',
    reports: isRTL ? 'التقارير' : 'Reports',
    other: isRTL ? 'أخرى' : 'Other',
    pdf: 'PDF',
    document: isRTL ? 'مستند' : 'Document',
    spreadsheet: isRTL ? 'جدول بيانات' : 'Spreadsheet',
    presentation: isRTL ? 'عرض تقديمي' : 'Presentation',
    image: isRTL ? 'صورة' : 'Image',
    video: isRTL ? 'فيديو' : 'Video',
    audio: isRTL ? 'صوت' : 'Audio',
    archive: isRTL ? 'ملف مضغوط' : 'Archive'
  };

  const fileTypeIcons = {
    pdf: <FileText className="h-8 w-8 text-red-500" />,
    document: <FileText className="h-8 w-8 text-blue-500" />,
    spreadsheet: <FileSpreadsheet className="h-8 w-8 text-green-500" />,
    presentation: <Presentation className="h-8 w-8 text-orange-500" />,
    image: <Image className="h-8 w-8 text-purple-500" />,
    video: <Video className="h-8 w-8 text-pink-500" />,
    audio: <Music className="h-8 w-8 text-cyan-500" />,
    archive: <Archive className="h-8 w-8 text-amber-500" />,
    other: <File className="h-8 w-8 text-gray-500" />
  };

  const categoryColors = {
    contracts: 'bg-blue-100 text-blue-700',
    invoices: 'bg-green-100 text-green-700',
    hr: 'bg-purple-100 text-purple-700',
    financial: 'bg-amber-100 text-amber-700',
    legal: 'bg-red-100 text-red-700',
    policies: 'bg-cyan-100 text-cyan-700',
    reports: 'bg-indigo-100 text-indigo-700',
    other: 'bg-gray-100 text-gray-700'
  };

  const handleRealTimeUpdate = useCallback((message) => {
    if (message.type?.includes('document') || message.type?.includes('folder')) {
      fetchDocuments();
      fetchFolders();
      fetchStats();
    }
  }, []);

  const { isConnected } = useRealTimeSync(handleRealTimeUpdate);

  useEffect(() => {
    fetchFolders();
    fetchDocuments();
    fetchCategories();
    fetchStats();
  }, [currentFolder, selectedCategory, selectedFileType, searchQuery]);

  const fetchFolders = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/documents/folders`,
        { 
          headers: { Authorization: `Bearer ${token}` },
          params: { parent_id: currentFolder?.id || null }
        }
      );
      setFolders(response.data || []);
    } catch (error) {
      console.error('Error fetching folders:', error);
    }
  };

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const params = {};
      if (currentFolder) params.folder_id = currentFolder.id;
      if (selectedCategory) params.category = selectedCategory;
      if (selectedFileType) params.file_type = selectedFileType;
      if (searchQuery) params.search = searchQuery;

      const response = await axios.get(
        `${API_URL}/api/documents/`,
        { headers: { Authorization: `Bearer ${token}` }, params }
      );
      setDocuments(response.data || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/documents/categories`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCategories(response.data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/documents/stats`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleCreateFolder = async () => {
    try {
      await axios.post(
        `${API_URL}/api/documents/folders`,
        { ...folderForm, parent_id: currentFolder?.id || null },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(isRTL ? 'تم إنشاء المجلد' : 'Folder created');
      setShowFolderDialog(false);
      setFolderForm({ name: '', description: '', color: '#6366f1' });
      fetchFolders();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error creating folder');
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) return;

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('folder_id', currentFolder?.id || '');
      formData.append('category', uploadForm.category);
      formData.append('tags', uploadForm.tags);

      await axios.post(
        `${API_URL}/api/documents/upload`,
        formData,
        { 
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          },
          onUploadProgress: (e) => {
            setUploadProgress(Math.round((e.loaded * 100) / e.total));
          }
        }
      );

      toast.success(isRTL ? 'تم رفع الملف بنجاح' : 'File uploaded successfully');
      setShowUploadDialog(false);
      setUploadFile(null);
      setUploadProgress(0);
      setUploadForm({ category: 'other', tags: '' });
      fetchDocuments();
      fetchStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error uploading file');
    }
  };

  const handleDownload = async (doc) => {
    try {
      const response = await axios.get(
        `${API_URL}/api/documents/${doc.id}/download`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      const { filename, content, mime_type } = response.data;
      const byteCharacters = atob(content);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mime_type });
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(url);
      
      toast.success(isRTL ? 'تم تحميل الملف' : 'File downloaded');
    } catch (error) {
      toast.error('Error downloading file');
    }
  };

  const handleDelete = async (doc) => {
    if (!window.confirm(isRTL ? 'هل تريد حذف هذا الملف؟' : 'Delete this file?')) return;
    
    try {
      await axios.delete(
        `${API_URL}/api/documents/${doc.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(isRTL ? 'تم حذف الملف' : 'File deleted');
      fetchDocuments();
      fetchStats();
    } catch (error) {
      toast.error('Error deleting file');
    }
  };

  const handleDeleteFolder = async (folder) => {
    if (!window.confirm(isRTL ? 'هل تريد حذف هذا المجلد؟' : 'Delete this folder?')) return;
    
    try {
      await axios.delete(
        `${API_URL}/api/documents/folders/${folder.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(isRTL ? 'تم حذف المجلد' : 'Folder deleted');
      fetchFolders();
    } catch (error) {
      toast.error('Error deleting folder');
    }
  };

  const navigateToFolder = (folder) => {
    if (folder) {
      setFolderPath([...folderPath, currentFolder].filter(Boolean));
      setCurrentFolder(folder);
    }
  };

  const navigateBack = () => {
    const newPath = [...folderPath];
    const parentFolder = newPath.pop();
    setFolderPath(newPath);
    setCurrentFolder(parentFolder || null);
  };

  const navigateToRoot = () => {
    setFolderPath([]);
    setCurrentFolder(null);
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.documents}</h1>
          <p className="text-gray-500">
            {isRTL ? 'إدارة وأرشفة المستندات' : 'Manage and archive documents'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowFolderDialog(true)} className="gap-2">
            <FolderPlus className="h-4 w-4" />
            {t.newFolder}
          </Button>
          <Button onClick={() => setShowUploadDialog(true)} className="gap-2">
            <Upload className="h-4 w-4" />
            {t.upload}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500 rounded-lg">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-blue-600">{t.totalDocs}</p>
                <p className="text-2xl font-bold text-blue-900">{stats?.total_documents || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500 rounded-lg">
                <HardDrive className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-green-600">{t.totalSize}</p>
                <p className="text-2xl font-bold text-green-900">{stats?.total_size_mb || 0} MB</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500 rounded-lg">
                <Folder className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-purple-600">{t.folders}</p>
                <p className="text-2xl font-bold text-purple-900">{folders.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500 rounded-lg">
                <Clock className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-amber-600">{t.recentUploads}</p>
                <p className="text-2xl font-bold text-amber-900">{stats?.recent_uploads?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 flex-1">
              <Button variant="ghost" size="sm" onClick={navigateToRoot} className="gap-1">
                <Home className="h-4 w-4" />
              </Button>
              {folderPath.map((folder, idx) => (
                <React.Fragment key={folder?.id || idx}>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                  <Button variant="ghost" size="sm" onClick={() => {
                    setFolderPath(folderPath.slice(0, idx));
                    setCurrentFolder(folder);
                  }}>
                    {folder?.name}
                  </Button>
                </React.Fragment>
              ))}
              {currentFolder && (
                <>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                  <span className="font-medium">{currentFolder.name}</span>
                </>
              )}
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input 
                placeholder={t.search}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-64"
              />
            </div>

            {/* Category Filter */}
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder={t.allCategories} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.allCategories}</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {isRTL ? cat.name_ar : cat.name_en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* View Mode */}
            <div className="flex gap-1 border rounded-lg p-1">
              <Button 
                variant={viewMode === 'grid' ? 'default' : 'ghost'} 
                size="sm"
                onClick={() => setViewMode('grid')}
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button 
                variant={viewMode === 'list' ? 'default' : 'ghost'} 
                size="sm"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Back Button */}
      {currentFolder && (
        <Button variant="ghost" onClick={navigateBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          {isRTL ? 'رجوع' : 'Back'}
        </Button>
      )}

      {/* Folders */}
      {folders.length > 0 && (
        <div>
          <h3 className="font-semibold mb-3">{t.folders}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {folders.map(folder => (
              <Card 
                key={folder.id} 
                className="cursor-pointer hover:shadow-md transition-shadow group"
                onClick={() => navigateToFolder(folder)}
              >
                <CardContent className="p-4 text-center">
                  <div 
                    className="w-12 h-12 mx-auto mb-2 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: folder.color + '20' }}
                  >
                    <FolderOpen className="h-6 w-6" style={{ color: folder.color }} />
                  </div>
                  <p className="font-medium text-sm truncate">{folder.name}</p>
                  <p className="text-xs text-gray-500">{folder.document_count || 0} {isRTL ? 'ملف' : 'files'}</p>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="opacity-0 group-hover:opacity-100 mt-2"
                    onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder); }}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Documents */}
      <div>
        <h3 className="font-semibold mb-3">{t.documents}</h3>
        {loading ? (
          <div className="flex justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : documents.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">{t.noDocuments}</p>
            </CardContent>
          </Card>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {documents.map(doc => (
              <Card key={doc.id} className="hover:shadow-md transition-shadow group">
                <CardContent className="p-4">
                  <div className="text-center mb-3">
                    {fileTypeIcons[doc.file_type] || fileTypeIcons.other}
                  </div>
                  <p className="font-medium text-sm truncate mb-1" title={doc.name}>{doc.name}</p>
                  <p className="text-xs text-gray-500 mb-2">{formatFileSize(doc.file_size)}</p>
                  <Badge className={categoryColors[doc.category]} variant="outline">
                    {t[doc.category] || doc.category}
                  </Badge>
                  <div className="flex justify-center gap-1 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="sm" onClick={() => handleDownload(doc)}>
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => { setSelectedDocument(doc); setShowDocumentDialog(true); }}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(doc)} className="text-red-500">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-start p-3 font-medium">{t.name}</th>
                    <th className="text-start p-3 font-medium">{t.category}</th>
                    <th className="text-start p-3 font-medium">{t.size}</th>
                    <th className="text-start p-3 font-medium">{t.uploadedAt}</th>
                    <th className="text-start p-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map(doc => (
                    <tr key={doc.id} className="border-t hover:bg-gray-50">
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          {fileTypeIcons[doc.file_type] || fileTypeIcons.other}
                          <span className="truncate max-w-xs">{doc.name}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge className={categoryColors[doc.category]} variant="outline">
                          {t[doc.category] || doc.category}
                        </Badge>
                      </td>
                      <td className="p-3 text-gray-500">{formatFileSize(doc.file_size)}</td>
                      <td className="p-3 text-gray-500">{doc.created_at?.slice(0, 10)}</td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleDownload(doc)}>
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(doc)} className="text-red-500">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-md" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{t.upload}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div 
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => document.getElementById('file-input').click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files[0]) setUploadFile(e.dataTransfer.files[0]);
              }}
            >
              <Upload className="h-10 w-10 mx-auto text-gray-400 mb-3" />
              <p className="text-gray-600">
                {t.dragDrop} <span className="text-blue-600 underline">{t.browse}</span>
              </p>
              {uploadFile && (
                <p className="mt-2 text-sm font-medium text-green-600">{uploadFile.name}</p>
              )}
              <input 
                id="file-input"
                type="file" 
                className="hidden" 
                onChange={(e) => setUploadFile(e.target.files[0])}
              />
            </div>

            {uploadProgress > 0 && uploadProgress < 100 && (
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
              </div>
            )}

            <div className="space-y-2">
              <Label>{t.category}</Label>
              <Select value={uploadForm.category} onValueChange={(v) => setUploadForm({...uploadForm, category: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {isRTL ? cat.name_ar : cat.name_en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t.tags}</Label>
              <Input 
                placeholder={isRTL ? 'اكتب الوسوم مفصولة بفواصل' : 'Enter tags separated by commas'}
                value={uploadForm.tags}
                onChange={(e) => setUploadForm({...uploadForm, tags: e.target.value})}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadDialog(false)}>{t.cancel}</Button>
            <Button onClick={handleUpload} disabled={!uploadFile}>{t.upload}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Folder Dialog */}
      <Dialog open={showFolderDialog} onOpenChange={setShowFolderDialog}>
        <DialogContent className="max-w-md" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{t.newFolder}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t.name} *</Label>
              <Input 
                value={folderForm.name}
                onChange={(e) => setFolderForm({...folderForm, name: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <Label>{t.description}</Label>
              <Textarea 
                value={folderForm.description}
                onChange={(e) => setFolderForm({...folderForm, description: e.target.value})}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>{isRTL ? 'اللون' : 'Color'}</Label>
              <div className="flex gap-2">
                {['#6366f1', '#ef4444', '#22c55e', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899'].map(color => (
                  <button
                    key={color}
                    className={`w-8 h-8 rounded-full border-2 ${folderForm.color === color ? 'border-gray-900' : 'border-transparent'}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setFolderForm({...folderForm, color})}
                  />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFolderDialog(false)}>{t.cancel}</Button>
            <Button onClick={handleCreateFolder} disabled={!folderForm.name}>{t.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document Details Dialog */}
      <Dialog open={showDocumentDialog} onOpenChange={setShowDocumentDialog}>
        <DialogContent className="max-w-lg" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{selectedDocument?.name}</DialogTitle>
          </DialogHeader>

          {selectedDocument && (
            <div className="space-y-4 py-4">
              <div className="flex justify-center">
                {fileTypeIcons[selectedDocument.file_type] || fileTypeIcons.other}
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-gray-500">{t.size}</p>
                  <p className="font-medium">{formatFileSize(selectedDocument.file_size)}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-gray-500">{t.type}</p>
                  <p className="font-medium">{selectedDocument.file_extension?.toUpperCase()}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-gray-500">{t.category}</p>
                  <Badge className={categoryColors[selectedDocument.category]}>
                    {t[selectedDocument.category] || selectedDocument.category}
                  </Badge>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-gray-500">{t.uploadedAt}</p>
                  <p className="font-medium">{selectedDocument.created_at?.slice(0, 10)}</p>
                </div>
              </div>

              {selectedDocument.tags?.length > 0 && (
                <div>
                  <p className="text-sm text-gray-500 mb-2">{t.tags}</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedDocument.tags.map((tag, idx) => (
                      <Badge key={idx} variant="outline">{tag}</Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-center gap-2 pt-4">
                <Button onClick={() => handleDownload(selectedDocument)} className="gap-2">
                  <Download className="h-4 w-4" />
                  {t.download}
                </Button>
                <Button variant="destructive" onClick={() => { handleDelete(selectedDocument); setShowDocumentDialog(false); }} className="gap-2">
                  <Trash2 className="h-4 w-4" />
                  {t.delete}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DocumentsModule;
