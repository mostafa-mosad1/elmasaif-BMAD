'use client';

import React, { useRef, useState } from 'react';
import {
  FileText,
  Lock,
  Eye,
  Trash2,
  AlertCircle,
  UploadCloud,
  Loader2,
} from 'lucide-react';
import {
  DocumentVisibility,
  UserRole,
  MAX_LISTING_FILE_SIZE_BYTES,
} from '@elmasaif/shared';
import { apiClient } from '../../../../lib/api-client';
import { ListingWizardFormState, WizardDocumentItem } from '../types';

interface DocumentsStepProps {
  formData: ListingWizardFormState;
  updateForm: (updates: Partial<ListingWizardFormState>) => void;
  errors: Record<string, string>;
  userRole: UserRole.MARKETER | UserRole.OWNER;
}

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  TITLE_DEED: 'صك الملكية الإلكتروني',
  OWNER_AUTHORIZATION: 'عقد تفويض المالك / اتفاقية الوساطة',
  FLOOR_PLAN: 'مخطط هندسي / رسم معماري',
  COMMERCIAL_REGISTRATION: 'سجل تجاري',
  OTHER: 'مستند آخر',
};

export function DocumentsStep({ formData, updateForm, errors, userRole }: DocumentsStepProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedDocType, setSelectedDocType] = useState<WizardDocumentItem['documentType']>(
    userRole === UserRole.MARKETER ? 'OWNER_AUTHORIZATION' : 'TITLE_DEED',
  );
  const [selectedVisibility, setSelectedVisibility] = useState<DocumentVisibility>(
    DocumentVisibility.ADMIN_ONLY,
  );
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const documents = formData.documents;

  const isMandatoryRequirementSatisfied =
    userRole === UserRole.MARKETER
      ? documents.some((d) => d.documentType === 'OWNER_AUTHORIZATION')
      : documents.some((d) => d.documentType === 'TITLE_DEED');

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    setUploadError(null);

    if (file.size > MAX_LISTING_FILE_SIZE_BYTES) {
      setUploadError(`الملف '${file.name}' يتجاوز الحد الأقصى المسموح (10 ميجابايت)`);
      return;
    }

    const validMimes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!validMimes.includes(file.type)) {
      setUploadError('نوع الملف غير مدعوم. يرجى اختيار ملف PDF أو صورة (JPEG, PNG, WebP)');
      return;
    }

    setIsUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);

      const res = await apiClient<{
        fileUrl: string;
        key: string;
        mimeType: string;
        fileSize: number;
        originalName: string;
      }>('/listings/upload?purpose=document', {
        method: 'POST',
        body: form,
      });

      // Sensitive docs must always be ADMIN_ONLY
      const isSensitive = ['TITLE_DEED', 'OWNER_AUTHORIZATION', 'COMMERCIAL_REGISTRATION'].includes(
        selectedDocType,
      );
      const enforcedVisibility = isSensitive ? DocumentVisibility.ADMIN_ONLY : selectedVisibility;

      const newDoc: WizardDocumentItem = {
        documentType: selectedDocType,
        fileUrl: res.fileUrl || res.key,
        mimeType: res.mimeType,
        fileSize: res.fileSize,
        visibility: enforcedVisibility,
        originalName: file.name,
        isLocked: isSensitive,
      };

      updateForm({ documents: [...documents, newDoc] });
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'فشل رفع المستند وفحصه أمنياً');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteDocument = (index: number) => {
    const updated = [...documents];
    updated.splice(index, 1);
    updateForm({ documents: updated });
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">المستندات والوثائق الرسمية</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          ارفع الوثائق القانونية للتحقق من ملكية العقار وصلاحية الإعلان مع التحكم في خصوصيتها.
        </p>
      </div>

      {/* Role-Specific Mandatory Requirement Banner */}
      <div
        className={`p-4 rounded-xl border flex items-start gap-3 ${
          isMandatoryRequirementSatisfied
            ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
            : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'
        }`}
      >
        <Lock className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
        <div className="text-xs">
          <div className="font-bold text-sm mb-0.5">
            {userRole === UserRole.MARKETER
              ? 'مستند إلزامي: عقد تفويض المالك أو اتفاقية الوساطة'
              : 'مستند إلزامي: صك الملكية الإلكتروني'}
          </div>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            {userRole === UserRole.MARKETER
              ? 'بموجب تنظيمات الهيئة العامة للعقار، يجب إرفاق عقد تفويض وساطة رسمي. هذا المستند محمي تلقائياً بتصنيف (خاص بالإدارة) ولن يتم كشفه للمشترين أو الزوار مطلقاً.'
              : 'يجب إرفاق صك الملكية الإلكتروني المعتمد للتحقق من هوية العقار. هذا المستند مصنف تلقائياً كـ (خاص بالإدارة) ويحظر عرضه للمشترين.'}
          </p>
        </div>
      </div>

      {/* Add Document Section */}
      <div className="p-5 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-850 space-y-4">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
          إرفاق وثيقة جديدة
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Document Type Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              نوع الوثيقة
            </label>
            <select
              value={selectedDocType}
              onChange={(e) => {
                const nextType = e.target.value as WizardDocumentItem['documentType'];
                setSelectedDocType(nextType);
                if (['TITLE_DEED', 'OWNER_AUTHORIZATION', 'COMMERCIAL_REGISTRATION'].includes(nextType)) {
                  setSelectedVisibility(DocumentVisibility.ADMIN_ONLY);
                }
              }}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:border-emerald-600 dark:bg-slate-800 dark:text-white"
            >
              {userRole === UserRole.MARKETER && (
                <option value="OWNER_AUTHORIZATION">عقد تفويض المالك / وساطة (إلزامي للوسطاء)</option>
              )}
              {userRole === UserRole.OWNER && (
                <option value="TITLE_DEED">صك الملكية الإلكتروني (إلزامي للملاك)</option>
              )}
              <option value="FLOOR_PLAN">مخطط هندسي / رسم معماري</option>
              <option value="COMMERCIAL_REGISTRATION">سجل تجاري للمنشأة</option>
              <option value="OTHER">مستند أو ترخيص آخر</option>
            </select>
          </div>

          {/* Visibility Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              تصنيف الخصوصية والظهور
            </label>
            {['TITLE_DEED', 'OWNER_AUTHORIZATION', 'COMMERCIAL_REGISTRATION'].includes(selectedDocType) ? (
              <div className="px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                  <Lock className="w-3.5 h-3.5" />
                  خاص بالإدارة فقط (إلزامي للمستندات السيادية)
                </span>
                <span className="text-[10px] text-slate-400">مغلق</span>
              </div>
            ) : (
              <select
                value={selectedVisibility}
                onChange={(e) => setSelectedVisibility(e.target.value as DocumentVisibility)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:border-emerald-600 dark:bg-slate-800 dark:text-white"
              >
                <option value={DocumentVisibility.PUBLIC}>عام (Public - يظهر للمشترين)</option>
                <option value={DocumentVisibility.ADMIN_ONLY}>خاص بالإدارة (AdminOnly - للإدارة فقط)</option>
              </select>
            )}
          </div>
        </div>

        {/* Upload Button */}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,image/jpeg,image/png,image/webp"
            className="hidden"
            disabled={isUploading}
            onChange={(e) => handleFileUpload(e.target.files)}
          />

          <button
            type="button"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-3 px-4 border-2 border-dashed border-emerald-300 dark:border-emerald-800 hover:border-emerald-500 rounded-xl bg-emerald-50/40 dark:bg-emerald-950/20 text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                <span>جاري فحص المستند أمنياً ورفعه...</span>
              </>
            ) : (
              <>
                <UploadCloud className="w-4 h-4" />
                <span>اختر ملف الوثيقة (PDF أو صورة حتى 10 ميجابايت)</span>
              </>
            )}
          </button>
        </div>

        {uploadError && (
          <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{uploadError}</span>
          </div>
        )}
      </div>

      {errors.documents && <p className="text-xs text-red-500">{errors.documents}</p>}

      {/* List of Uploaded Documents */}
      {documents.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            الوثائق المرفوعة ({documents.length})
          </h3>

          <div className="space-y-2">
            {documents.map((doc, idx) => {
              const isAdminOnly = doc.visibility === DocumentVisibility.ADMIN_ONLY;
              return (
                <div
                  key={doc.fileUrl || idx}
                  className="p-3 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                          {DOCUMENT_TYPE_LABELS[doc.documentType] || doc.documentType}
                        </span>
                        {isAdminOnly ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            <Lock className="w-3 h-3" />
                            خاص بالإدارة (محمي)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            <Eye className="w-3 h-3" />
                            عام (يظهر للمشتري)
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {doc.originalName || doc.fileUrl} &bull; {(doc.fileSize / 1024).toFixed(1)} كيلوبايت
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteDocument(idx)}
                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                    title="حذف الوثيقة"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
