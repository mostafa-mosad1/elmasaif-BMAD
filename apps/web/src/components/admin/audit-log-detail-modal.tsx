'use client';

import React, { useState } from 'react';
import {
  AuditLogDetailDto,
  AUDIT_ACTION_LABELS_AR,
  AUDIT_ACTION_CATEGORY_MAP,
  AUDIT_CATEGORY_STYLES,
} from '@elmasaif/shared';
import {
  Check,
  Clock,
  Copy,
  FileCode,
  Globe,
  Lock,
  ScrollText,
  Shield,
  User,
  X,
} from 'lucide-react';

export interface AuditLogDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  log: AuditLogDetailDto | null;
  isLoading?: boolean;
}

export function AuditLogDetailModal({
  isOpen,
  onClose,
  log,
  isLoading = false,
}: AuditLogDetailModalProps) {
  const [copied, setCopied] = useState(false);
  const [activeDiffTab, setActiveDiffTab] = useState<'both' | 'before' | 'after'>('both');

  if (!isOpen) return null;

  const handleCopyJson = async () => {
    if (!log) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(log, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const actionCategory = log?.action
    ? AUDIT_ACTION_CATEGORY_MAP[log.action] || 'system'
    : 'system';
  const categoryStyle = AUDIT_CATEGORY_STYLES[actionCategory];
  const actionLabel = log?.action
    ? AUDIT_ACTION_LABELS_AR[log.action] || log.action
    : '';

  const formatSaudiDate = (isoString?: string) => {
    if (!isoString) return '—';
    try {
      const date = new Date(isoString);
      return new Intl.DateTimeFormat('ar-SA', {
        timeZone: 'Asia/Riyadh',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      }).format(date);
    } catch {
      return isoString;
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="audit-detail-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[90vh] bg-surface dark:bg-dark-surface-raised rounded-2xl shadow-2xl border border-surface-border dark:border-dark-surface-border flex flex-col overflow-hidden text-ink-primary dark:text-dark-ink-primary"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-surface-border dark:border-dark-surface-border flex items-center justify-between gap-4 bg-surface-sunken/40 dark:bg-dark-surface/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <ScrollText className="w-5 h-5 text-[#1B4332] dark:text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2
                  id="audit-detail-title"
                  className="text-base font-bold text-ink-primary dark:text-dark-ink-primary"
                >
                  تفاصيل سجل التدقيق الرقابي
                </h2>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                  <Lock className="w-3 h-3" />
                  <span>سجل غير قابل للتعديل (Append-Only)</span>
                </span>
              </div>
              <p className="text-xs text-ink-muted dark:text-dark-ink-muted mt-0.5">
                معرف السجل:{' '}
                <span className="font-mono text-ink-primary dark:text-dark-ink-primary">
                  {log?.id || '—'}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyJson}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-surface-border dark:border-dark-surface-border text-xs font-medium hover:bg-surface-sunken dark:hover:bg-dark-surface transition-colors"
              title="نسخ السجل كاملاً بصيغة JSON"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-600 font-semibold">تم النسخ</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>نسخ السجل (JSON)</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-surface-sunken dark:hover:bg-dark-surface transition-colors"
              aria-label="إغلاق النافذة"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-ink-muted">
              <div className="w-8 h-8 border-3 border-primary/20 border-t-primary rounded-full animate-spin" />
              <p className="text-sm">جاري تحميل تفاصيل السجل الرقابي...</p>
            </div>
          ) : !log ? (
            <div className="py-8 text-center text-ink-muted text-sm">
              لا توجد بيانات متاحة لهذا السجل.
            </div>
          ) : (
            <>
              {/* Action Banner */}
              <div className="p-4 rounded-xl border border-surface-border dark:border-dark-surface-border bg-surface-sunken/30 dark:bg-dark-surface/30 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border ${categoryStyle.badgeClass}`}
                  >
                    <span className={`w-2 h-2 rounded-full ${categoryStyle.dotClass}`} />
                    <span>{actionLabel}</span>
                  </span>
                  <span className="text-xs font-mono text-ink-secondary dark:text-dark-ink-secondary">
                    {log.action}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-ink-muted dark:text-dark-ink-muted">
                  <Clock className="w-3.5 h-3.5" />
                  <span className="font-mono">{formatSaudiDate(log.createdAt)}</span>
                </div>
              </div>

              {/* Forensic Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Actor Info */}
                <div className="p-4 rounded-xl border border-surface-border dark:border-dark-surface-border space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-ink-secondary dark:text-dark-ink-secondary">
                    <User className="w-3.5 h-3.5 text-primary" />
                    <span>معلومات المنفذ (Actor)</span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-ink-muted">الاسم:</span>
                      <span className="font-semibold">{log.actorName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-ink-muted">الدور / النوع:</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {log.actorRole}
                        </span>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                          {log.actorType}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-ink-muted">معرف المنفذ:</span>
                      <span className="font-mono text-xs">{log.actorId}</span>
                    </div>
                  </div>
                </div>

                {/* Entity & Network Info */}
                <div className="p-4 rounded-xl border border-surface-border dark:border-dark-surface-border space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-ink-secondary dark:text-dark-ink-secondary">
                    <Shield className="w-3.5 h-3.5 text-primary" />
                    <span>الكيان المستهدف والشبكة</span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-ink-muted">نوع الكيان:</span>
                      <span className="font-semibold">{log.entityType}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-ink-muted">معرف الكيان:</span>
                      <span className="font-mono text-xs">{log.entityId}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-ink-muted">عنوان IP:</span>
                      <span className="font-mono text-xs">{log.ipAddress || '—'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Justification Reason Callout */}
              <div className="p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 space-y-1">
                <span className="text-xs font-bold text-amber-900 dark:text-amber-300">
                  سبب الإجراء / المبرر الرقابي (Justification Reason):
                </span>
                <p className="text-sm text-amber-950 dark:text-amber-200 leading-relaxed">
                  {log.justificationReason || 'لم يتم تقديم سبب إضافي لهذا الإجراء.'}
                </p>
              </div>

              {/* Changed Keys Badges */}
              {log.changedKeys && log.changedKeys.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-ink-secondary dark:text-dark-ink-secondary">
                    الحقول المعدلة في هذه العملية ({log.changedKeys.length}):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {log.changedKeys.map((key) => (
                      <span
                        key={key}
                        className="px-2.5 py-1 rounded-md text-xs font-mono font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                      >
                        {key}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* State Diff Viewer */}
              {(log.beforeSnapshot || log.afterSnapshot) && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-surface-border dark:border-dark-surface-border pb-2">
                    <div className="flex items-center gap-2 text-sm font-bold text-ink-primary dark:text-dark-ink-primary">
                      <FileCode className="w-4 h-4 text-primary" />
                      <span>فاحص تغير الحالة (State Transition Diff)</span>
                    </div>
                    <div className="flex items-center gap-1 bg-surface-sunken dark:bg-dark-surface p-1 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setActiveDiffTab('both')}
                        className={`px-2.5 py-1 text-xs rounded-md font-semibold transition-colors ${
                          activeDiffTab === 'both'
                            ? 'bg-surface dark:bg-dark-surface-raised text-primary shadow-xs'
                            : 'text-ink-muted hover:text-ink-primary'
                        }`}
                      >
                        جنباً إلى جنب
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveDiffTab('before')}
                        className={`px-2.5 py-1 text-xs rounded-md font-semibold transition-colors ${
                          activeDiffTab === 'before'
                            ? 'bg-surface dark:bg-dark-surface-raised text-primary shadow-xs'
                            : 'text-ink-muted hover:text-ink-primary'
                        }`}
                      >
                        الحالة السابقة
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveDiffTab('after')}
                        className={`px-2.5 py-1 text-xs rounded-md font-semibold transition-colors ${
                          activeDiffTab === 'after'
                            ? 'bg-surface dark:bg-dark-surface-raised text-primary shadow-xs'
                            : 'text-ink-muted hover:text-ink-primary'
                        }`}
                      >
                        الحالة الجديدة
                      </button>
                    </div>
                  </div>

                  {activeDiffTab === 'both' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Before Snapshot */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-semibold text-rose-700 dark:text-rose-400">
                          <span>الحالة السابقة (Before)</span>
                          <span className="text-[10px] text-ink-muted font-mono">
                            {log.beforeSnapshot ? 'JSON' : 'غير متوفر'}
                          </span>
                        </div>
                        <pre
                          dir="ltr"
                          className="p-3 rounded-xl bg-slate-950 text-slate-200 text-xs font-mono overflow-x-auto max-h-64 border border-slate-800"
                        >
                          {log.beforeSnapshot
                            ? JSON.stringify(log.beforeSnapshot, null, 2)
                            : '// لا توجد لقطة سابقة (إنشاء جديد)'}
                        </pre>
                      </div>

                      {/* After Snapshot */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                          <span>الحالة الجديدة (After)</span>
                          <span className="text-[10px] text-ink-muted font-mono">
                            {log.afterSnapshot ? 'JSON' : 'غير متوفر'}
                          </span>
                        </div>
                        <pre
                          dir="ltr"
                          className="p-3 rounded-xl bg-slate-950 text-slate-200 text-xs font-mono overflow-x-auto max-h-64 border border-slate-800"
                        >
                          {log.afterSnapshot
                            ? JSON.stringify(log.afterSnapshot, null, 2)
                            : '// لا توجد لقطة جديدة'}
                        </pre>
                      </div>
                    </div>
                  ) : activeDiffTab === 'before' ? (
                    <div className="space-y-1.5">
                      <span className="text-xs font-semibold text-rose-700 dark:text-rose-400">
                        الحالة السابقة (Before)
                      </span>
                      <pre
                        dir="ltr"
                        className="p-4 rounded-xl bg-slate-950 text-slate-200 text-xs font-mono overflow-x-auto max-h-80 border border-slate-800"
                      >
                        {log.beforeSnapshot
                          ? JSON.stringify(log.beforeSnapshot, null, 2)
                          : '// لا توجد لقطة سابقة'}
                      </pre>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                        الحالة الجديدة (After)
                      </span>
                      <pre
                        dir="ltr"
                        className="p-4 rounded-xl bg-slate-950 text-slate-200 text-xs font-mono overflow-x-auto max-h-80 border border-slate-800"
                      >
                        {log.afterSnapshot
                          ? JSON.stringify(log.afterSnapshot, null, 2)
                          : '// لا توجد لقطة جديدة'}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {/* Additional Metadata */}
              {log.metadata && Object.keys(log.metadata).length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-ink-secondary dark:text-dark-ink-secondary">
                    بيانات السياق الإضافية (Metadata):
                  </span>
                  <pre
                    dir="ltr"
                    className="p-3 rounded-xl bg-surface-sunken dark:bg-dark-surface text-ink-primary dark:text-dark-ink-primary text-xs font-mono overflow-x-auto max-h-40 border border-surface-border dark:border-dark-surface-border"
                  >
                    {JSON.stringify(log.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer (Strict Read-Only) */}
        <div className="px-6 py-4 border-t border-surface-border dark:border-dark-surface-border bg-surface-sunken/40 dark:bg-dark-surface/40 flex items-center justify-between text-xs text-ink-muted dark:text-dark-ink-muted">
          <div className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-emerald-700" />
            <span>
              سجل تدقيق رقابي غير قابل للتعديل بموجب لائحة الهيئة العامة للعقار (REGA) وقواعد الامتثال
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-surface dark:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border text-xs font-bold hover:bg-surface-sunken dark:hover:bg-dark-surface transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}

