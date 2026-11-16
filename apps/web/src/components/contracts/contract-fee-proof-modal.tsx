'use client';

import React, { useState, useRef, useCallback } from 'react';
import { UploadCloud, FileText, CheckCircle2, AlertCircle, X, ShieldAlert, Loader2 } from 'lucide-react';
import { Modal } from '../ui/modal';
import { Button } from '../ui/button';
import { apiClient } from '../../lib/api-client';

export interface ContractFeeProofModalProps {
  open: boolean;
  onClose: () => void;
  contractId: string;
  onSuccess: () => void;
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

export function ContractFeeProofModal({
  open,
  onClose,
  contractId,
  onSuccess,
}: ContractFeeProofModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [bankReferenceCode, setBankReferenceCode] = useState('');
  const [senderBankName, setSenderBankName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (selectedFile: File): string | null => {
    if (!ALLOWED_MIME_TYPES.includes(selectedFile.type)) {
      return 'صيغة الملف غير مدعومة. يرجى رفع ملف بصيغة PDF أو JPG أو PNG';
    }
    if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
      return 'حجم الملف يتجاوز الحد الأقصى المسموح به (10 ميجابايت)';
    }
    return null;
  };

  const handleFileSelect = (selectedFile: File) => {
    const error = validateFile(selectedFile);
    if (error) {
      setErrorMsg(error);
      setFile(null);
    } else {
      setErrorMsg(null);
      setFile(selectedFile);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setErrorMsg('يرجى اختيار ملف إشعار التحويل البنكي');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      const formData = new FormData();
      formData.append('file', file);
      if (bankReferenceCode.trim()) {
        formData.append('bankReferenceCode', bankReferenceCode.trim());
      }
      if (senderBankName.trim()) {
        formData.append('senderBankName', senderBankName.trim());
      }

      await apiClient(`/owner/contracts/${contractId}/fee-proof`, {
        method: 'POST',
        body: formData,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'فشل في رفع إشعار التحويل البنكي. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      ariaLabel="رفع إشعار سداد رسوم العقد والتسويق"
      panelClassName="max-w-xl"
    >
      <div className="p-6">
        <div className="border-b border-border pb-4 mb-5 text-right">
          <h2 className="text-lg font-bold text-foreground">
            رفع إشعار سداد رسوم العقد والتسويق
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            يرجى إرفاق إشعار التحويل البنكي الرسمي الصادر من حسابك البنكي لمطابقته وتفعيل العقد.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5" data-testid="fee-proof-upload-form">
          {errorMsg && (
            <div
              className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2"
              role="alert"
              data-testid="upload-error-alert"
            >
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
              <span className="leading-relaxed">{errorMsg}</span>
            </div>
          )}

        {/* Dropzone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
            isDragging
              ? 'border-accent bg-accent/10'
              : file
              ? 'border-accent bg-accent/5'
              : 'border-surface-borderStrong hover:border-accent bg-surface-sunken'
          }`}
          data-testid="file-dropzone"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) {
                handleFileSelect(e.target.files[0]);
              }
            }}
            data-testid="file-input"
          />

          {file ? (
            <div className="flex items-center justify-between p-3 rounded-lg bg-surface-base border border-surface-border text-right">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent-light text-accent-dark flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-xs text-foreground truncate max-w-xs">{file.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {(file.size / (1024 * 1024)).toFixed(2)} ميجابايت • {file.type || 'مستند'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                }}
                className="p-1 rounded-md text-ink-muted hover:text-red-600 transition-colors"
                title="إلغاء الملف"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="w-12 h-12 rounded-full bg-surface-sunken text-ink-muted mx-auto flex items-center justify-center">
                <UploadCloud className="w-6 h-6" />
              </div>
              <p className="font-bold text-xs text-foreground">
                اسحب وأفلت إشعار التحويل هنا، أو <span className="text-accent underline">تصفح من جهازك</span>
              </p>
              <p className="text-[11px] text-muted-foreground">
                الصيغ المدعومة: PDF, PNG, JPG (الحد الأقصى: 10 ميجابايت)
              </p>
            </div>
          )}
        </div>

        {/* Bank transfer metadata inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5 text-right">
            <label className="text-xs font-bold text-foreground">
              رقم العملية / مرجع التحويل البنكي <span className="text-muted-foreground font-normal">(اختياري)</span>
            </label>
            <input
              type="text"
              value={bankReferenceCode}
              onChange={(e) => setBankReferenceCode(e.target.value)}
              placeholder="مثال: TXN-12345678"
              maxLength={64}
              className="w-full px-3 py-2 rounded-lg border border-surface-border bg-surface-sunken text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-accent font-mono text-left"
              dir="ltr"
              data-testid="bank-reference-input"
            />
          </div>

          <div className="space-y-1.5 text-right">
            <label className="text-xs font-bold text-foreground">
              اسم البنك المحول منه <span className="text-muted-foreground font-normal">(اختياري)</span>
            </label>
            <input
              type="text"
              value={senderBankName}
              onChange={(e) => setSenderBankName(e.target.value)}
              placeholder="مثال: مصرف الراجحي، البنك الأهلي"
              maxLength={100}
              className="w-full px-3 py-2 rounded-lg border border-surface-border bg-surface-sunken text-xs text-ink-primary focus:outline-none focus:ring-2 focus:ring-accent"
              data-testid="sender-bank-input"
            />
          </div>
        </div>

        {/* Security reassurance banner */}
        <div className="p-3 rounded-lg bg-surface-sunken border border-surface-border flex items-start gap-2.5 text-[11px] text-ink-secondary">
          <ShieldAlert className="w-4 h-4 text-accent shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            يتم فحص جميع الإيصالات والمستندات آلياً ضد البرمجيات الخبيثة وتخزينها في خوادم سيادية مشفرة ومطابقة لمعايير الأمن السيبراني السعودية.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-xs h-9 px-4"
          >
            إلغاء
          </Button>

          <Button
            type="submit"
            disabled={!file || isSubmitting}
            className="bg-primary hover:bg-primary-hover text-white text-xs font-bold h-9 px-5 gap-2"
            data-testid="submit-fee-proof-btn"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>جاري الفحص والرفع...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>تأكيد ورفع الإشعار</span>
              </>
            )}
          </Button>
        </div>
      </form>
      </div>
    </Modal>
  );
}
