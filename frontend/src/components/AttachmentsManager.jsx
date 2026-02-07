import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { toast } from 'sonner';
import axios from 'axios';
import { 
  Paperclip, Upload, Download, Trash2, FileText, Image, 
  File, FileSpreadsheet, FileVideo, FileAudio, X, Eye,
  RefreshCw, Plus
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// File type icons
const getFileIcon = (contentType, extension) => {
  if (contentType?.startsWith('image/')) return Image;
  if (contentType?.includes('pdf')) return FileText;
  if (contentType?.includes('spreadsheet') || ['xlsx', 'xls', 'csv'].includes(extension)) return FileSpreadsheet;
  if (contentType?.startsWith('video/')) return FileVideo;
  if (contentType?.startsWith('audio/')) return FileAudio;
  return File;
};

// Format file size
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const AttachmentsManager = ({ entityType, entityId, readOnly = false }) => {
  const { token } = useAuth();
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadDescription, setUploadDescription] = useState('');
  const fileInputRef = useRef(null);

  const t = {
    attachments: isRTL ? 'المرفقات' : 'Attachments',
    upload: isRTL ? 'رفع ملف' : 'Upload File',
    download: isRTL ? 'تحميل' : 'Download',
    delete: isRTL ? 'حذف' : 'Delete',
    preview: isRTL ? 'معاينة' : 'Preview',
    noAttachments: isRTL ? 'لا توجد مرفقات' : 'No attachments',
    dragDrop: isRTL ? 'اسحب الملفات هنا أو انقر للاختيار' : 'Drag files here or click to select',
    description: isRTL ? 'الوصف' : 'Description',
    optional: isRTL ? 'اختياري' : 'optional',
    uploading: isRTL ? 'جاري الرفع...' : 'Uploading...',
    uploadSuccess: isRTL ? 'تم رفع الملف بنجاح' : 'File uploaded successfully',
    deleteConfirm: isRTL ? 'هل أنت متأكد من حذف هذا المرفق؟' : 'Are you sure you want to delete this attachment?',
    deleteSuccess: isRTL ? 'تم حذف المرفق' : 'Attachment deleted',
    maxSize: isRTL ? 'الحد الأقصى للحجم: 10 ميجابايت' : 'Max size: 10 MB',
    cancel: isRTL ? 'إلغاء' : 'Cancel',
    uploadedBy: isRTL ? 'رفع بواسطة' : 'Uploaded by'
  };

  useEffect(() => {
    if (entityId) {
      fetchAttachments();
    }
  }, [entityId]);

  const fetchAttachments = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${API_URL}/api/attachments/entity/${entityType}/${entityId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAttachments(response.data || []);
    } catch (error) {
      console.error('Error fetching attachments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(isRTL ? 'حجم الملف يتجاوز الحد المسموح (10 ميجابايت)' : 'File size exceeds limit (10 MB)');
        return;
      }
      setUploadFile(file);
      setShowUploadDialog(true);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(isRTL ? 'حجم الملف يتجاوز الحد المسموح (10 ميجابايت)' : 'File size exceeds limit (10 MB)');
        return;
      }
      setUploadFile(file);
      setShowUploadDialog(true);
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) return;
    
    try {
      setUploading(true);
      
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('entity_type', entityType);
      formData.append('entity_id', entityId);
      if (uploadDescription) {
        formData.append('description', uploadDescription);
      }
      
      await axios.post(
        `${API_URL}/api/attachments/upload`,
        formData,
        { 
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          } 
        }
      );
      
      toast.success(t.uploadSuccess);
      setShowUploadDialog(false);
      setUploadFile(null);
      setUploadDescription('');
      fetchAttachments();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (attachment) => {
    try {
      const response = await axios.get(
        `${API_URL}/api/attachments/${attachment.id}/download`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Convert base64 to blob and download
      const byteCharacters = atob(response.data.file_data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: response.data.content_type });
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = response.data.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      toast.error('Download failed');
    }
  };

  const handlePreview = async (attachment) => {
    try {
      const response = await axios.get(
        `${API_URL}/api/attachments/${attachment.id}/download`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setPreviewAttachment(attachment);
      setPreviewData(response.data);
      setShowPreviewDialog(true);
    } catch (error) {
      toast.error('Preview failed');
    }
  };

  const handleDelete = async (attachmentId) => {
    if (!window.confirm(t.deleteConfirm)) return;
    
    try {
      await axios.delete(
        `${API_URL}/api/attachments/${attachmentId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(t.deleteSuccess);
      fetchAttachments();
    } catch (error) {
      toast.error('Delete failed');
    }
  };

  const canPreview = (contentType) => {
    return contentType?.startsWith('image/') || contentType?.includes('pdf');
  };

  return (
    <div className="space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Paperclip className="h-5 w-5 text-gray-500" />
          <span className="font-medium">{t.attachments}</span>
          {attachments.length > 0 && (
            <Badge variant="secondary">{attachments.length}</Badge>
          )}
        </div>
        
        {!readOnly && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => fileInputRef.current?.click()}
            data-testid="upload-attachment-btn"
          >
            <Plus className="h-4 w-4 mr-1" />
            {t.upload}
          </Button>
        )}
        
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelect}
          data-testid="file-input"
        />
      </div>

      {/* Drop Zone (when no attachments) */}
      {!readOnly && attachments.length === 0 && (
        <div
          className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors cursor-pointer"
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-10 w-10 mx-auto text-gray-400 mb-3" />
          <p className="text-gray-500">{t.dragDrop}</p>
          <p className="text-xs text-gray-400 mt-2">{t.maxSize}</p>
        </div>
      )}

      {/* Attachments List */}
      {loading ? (
        <div className="text-center py-4">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto text-gray-400" />
        </div>
      ) : attachments.length > 0 ? (
        <div className="space-y-2">
          {attachments.map((attachment) => {
            const FileIcon = getFileIcon(attachment.content_type, attachment.file_extension);
            return (
              <Card key={attachment.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <FileIcon className="h-5 w-5 text-gray-600" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{attachment.filename}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>{formatFileSize(attachment.file_size)}</span>
                        <span>•</span>
                        <span>{attachment.created_at?.slice(0, 10)}</span>
                        {attachment.uploaded_by_name && (
                          <>
                            <span>•</span>
                            <span>{attachment.uploaded_by_name}</span>
                          </>
                        )}
                      </div>
                      {attachment.description && (
                        <p className="text-xs text-gray-400 mt-1 truncate">{attachment.description}</p>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-1">
                      {canPreview(attachment.content_type) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePreview(attachment)}
                          data-testid={`preview-${attachment.id}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownload(attachment)}
                        data-testid={`download-${attachment.id}`}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      {!readOnly && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(attachment.id)}
                          className="text-red-500 hover:text-red-600"
                          data-testid={`delete-${attachment.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : null}

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              {t.upload}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {uploadFile && (
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <File className="h-8 w-8 text-gray-400" />
                <div className="flex-1">
                  <p className="font-medium">{uploadFile.name}</p>
                  <p className="text-sm text-gray-500">{formatFileSize(uploadFile.size)}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setUploadFile(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            <div className="space-y-2">
              <Label>{t.description} ({t.optional})</Label>
              <Input
                value={uploadDescription}
                onChange={(e) => setUploadDescription(e.target.value)}
                placeholder={isRTL ? 'وصف الملف...' : 'File description...'}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadDialog(false)}>
              {t.cancel}
            </Button>
            <Button onClick={handleUpload} disabled={!uploadFile || uploading}>
              {uploading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  {t.uploading}
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  {t.upload}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh]" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{previewAttachment?.filename}</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-auto">
            {previewData && previewAttachment?.content_type?.startsWith('image/') && (
              <img
                src={`data:${previewAttachment.content_type};base64,${previewData.file_data}`}
                alt={previewAttachment.filename}
                className="max-w-full h-auto mx-auto rounded"
              />
            )}
            {previewData && previewAttachment?.content_type?.includes('pdf') && (
              <iframe
                src={`data:application/pdf;base64,${previewData.file_data}`}
                className="w-full h-[70vh]"
                title={previewAttachment.filename}
              />
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => handleDownload(previewAttachment)}>
              <Download className="h-4 w-4 mr-2" />
              {t.download}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AttachmentsManager;
