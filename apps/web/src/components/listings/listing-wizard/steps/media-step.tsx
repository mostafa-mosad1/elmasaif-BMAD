'use client';

import React, { useRef, useState } from 'react';
import {
  UploadCloud,
  Image as ImageIcon,
  Trash2,
  Star,
  CheckCircle,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import {
  MIN_LISTING_PHOTOS,
  MAX_LISTING_PHOTOS,
  MAX_LISTING_FILE_SIZE_BYTES,
} from '@elmasaif/shared';
import { apiClient } from '../../../../lib/api-client';
import { ListingWizardFormState, WizardPhotoItem } from '../types';

interface MediaStepProps {
  formData: ListingWizardFormState;
  updateForm: (updates: Partial<ListingWizardFormState>) => void;
  errors: Record<string, string>;
}

export function MediaStep({ formData, updateForm, errors }: MediaStepProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const photos = formData.photos;

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    setUploadError(null);
    const availableSlots = MAX_LISTING_PHOTOS - photos.length;
    if (availableSlots <= 0) {
      setUploadError(`وصلت إلى الحد الأقصى للصور (${MAX_LISTING_PHOTOS} صورة).`);
      return;
    }

    const filesToUpload = Array.from(fileList).slice(0, availableSlots);
    setIsUploading(true);

    try {
      const uploadedItems: WizardPhotoItem[] = [];

      for (const file of filesToUpload) {
        // Validate size
        if (file.size > MAX_LISTING_FILE_SIZE_BYTES) {
          throw new Error(`الملف '${file.name}' يتجاوز الحد الأقصى المسموح (10 ميجابايت)`);
        }

        // Validate type
        const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!validTypes.includes(file.type)) {
          throw new Error(`الملف '${file.name}' غير مدعوم. يرجى اختيار JPEG أو PNG أو WebP`);
        }

        // Upload through backend quarantine scanner
        const form = new FormData();
        form.append('file', file);

        const res = await apiClient<{
          fileUrl: string;
          key: string;
          originalName: string;
          mimeType: string;
          fileSize: number;
          scanStatus: string;
        }>('/listings/upload?purpose=photo', {
          method: 'POST',
          body: form,
        });

        const previewUrl = URL.createObjectURL(file);

        uploadedItems.push({
          fileUrl: res.fileUrl || res.key,
          mimeType: res.mimeType,
          fileSize: res.fileSize,
          originalName: file.name,
          previewUrl,
          isPrimary: photos.length === 0 && uploadedItems.length === 0, // first photo is primary by default
        });
      }

      const updatedPhotos = [...photos, ...uploadedItems];
      // Ensure at least one primary
      if (!updatedPhotos.some((p) => p.isPrimary) && updatedPhotos.length > 0) {
        updatedPhotos[0].isPrimary = true;
      }
      updateForm({ photos: updatedPhotos });
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'حدث خطأ أثناء رفع الصور');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeletePhoto = (index: number) => {
    const updated = [...photos];
    const wasPrimary = updated[index]?.isPrimary;
    updated.splice(index, 1);

    if (wasPrimary && updated.length > 0) {
      updated[0].isPrimary = true;
    }
    updateForm({ photos: updated });
  };

  const handleSetPrimary = (index: number) => {
    const updated = photos.map((p, i) => ({
      ...p,
      isPrimary: i === index,
    }));
    updateForm({ photos: updated });
  };

  const isCountValid = photos.length >= MIN_LISTING_PHOTOS && photos.length <= MAX_LISTING_PHOTOS;

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">الصور والوسائط</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          ارفع صوراً حقيقية عالية الجودة تظهر كافة جوانب العقار (الحد الأدنى 3 صور، الحد الأقصى 20 صورة).
        </p>
      </div>

      {/* Progress & Counter Pill */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            تم رفع {photos.length} من أصل {MAX_LISTING_PHOTOS} صورة
          </span>
        </div>

        {isCountValid ? (
          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold">
            <CheckCircle className="w-3.5 h-3.5" />
            العدد مطابق للشروط (3 صور على الأقل)
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 font-semibold">
            <AlertTriangle className="w-3.5 h-3.5" />
            يلزم إضافة {Math.max(0, MIN_LISTING_PHOTOS - photos.length)} صور إضافية على الأقل
          </span>
        )}
      </div>

      {/* Drag & Drop Upload Dropzone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFiles(e.dataTransfer.files);
        }}
        className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
          photos.length >= MAX_LISTING_PHOTOS
            ? 'border-slate-200 bg-slate-50 dark:bg-slate-900 opacity-60 cursor-not-allowed'
            : 'border-emerald-300 dark:border-emerald-800 hover:border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/20'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          disabled={isUploading || photos.length >= MAX_LISTING_PHOTOS}
          onChange={(e) => handleFiles(e.target.files)}
        />

        {isUploading ? (
          <div className="flex flex-col items-center justify-center py-2">
            <Loader2 className="w-10 h-10 text-emerald-600 animate-spin mb-3" />
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              جاري فحص الصور أمنياً ورفعها إلى السيرفر...
            </p>
            <p className="text-xs text-slate-500 mt-1">يتم إجراء فحص الحماية من البرمجيات الخبيثة تلقائياً</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center mb-3">
              <UploadCloud className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
              اضغط لاختيار الصور أو اسحبها وأفلتها هنا
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              يدعم تنسيقات JPEG, PNG, WebP بحجم أقصى 10 ميجابايت للصورة الواحدة
            </p>
          </div>
        )}
      </div>

      {uploadError && (
        <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs rounded-xl flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {errors.photos && <p className="text-xs text-red-500">{errors.photos}</p>}

      {/* Uploaded Photos Grid */}
      {photos.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            الصور المرفوعة ({photos.length})
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {photos.map((photo, index) => (
              <div
                key={photo.fileUrl || index}
                className={`relative group rounded-xl overflow-hidden border-2 transition-all bg-slate-100 dark:bg-slate-800 ${
                  photo.isPrimary
                    ? 'border-emerald-600 ring-2 ring-emerald-600/30 shadow-md'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                {/* Image Preview */}
                <div className="aspect-[4/3] w-full overflow-hidden bg-slate-200 dark:bg-slate-700">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.previewUrl || photo.fileUrl}
                    alt={`Property photo ${index + 1}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>

                {/* Primary Tag / Toggle Button */}
                <div className="absolute top-2 right-2">
                  {photo.isPrimary ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-600 text-white text-[11px] font-bold rounded-md shadow-sm">
                      <Star className="w-3 h-3 fill-current" />
                      الرئيسية
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSetPrimary(index)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity px-2 py-0.5 bg-slate-900/80 hover:bg-emerald-700 text-white text-[11px] font-semibold rounded-md backdrop-blur-sm shadow-sm"
                    >
                      تعيين كرئيسية
                    </button>
                  )}
                </div>

                {/* Delete Action Button */}
                <button
                  type="button"
                  onClick={() => handleDeletePhoto(index)}
                  className="absolute top-2 left-2 p-1.5 bg-red-600/80 hover:bg-red-700 text-white rounded-md backdrop-blur-sm shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                  title="حذف الصورة"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
