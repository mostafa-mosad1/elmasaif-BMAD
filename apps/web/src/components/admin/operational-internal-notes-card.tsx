'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { NoteEntityType, OperationalInternalNoteDto } from '@elmasaif/shared';
import {
  Lock,
  MessageSquare,
  Send,
  User,
  Clock,
  Shield,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { apiClient, describeApiError } from '../../lib/api-client';

export interface OperationalInternalNotesCardProps {
  entityType: NoteEntityType;
  entityId: string;
  title?: string;
  className?: string;
}

export function OperationalInternalNotesCard({
  entityType,
  entityId,
  title = 'الملاحظات التشغيلية الداخلية (Internal Staff Notes)',
  className = '',
}: OperationalInternalNotesCardProps) {
  const [notes, setNotes] = useState<OperationalInternalNoteDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newContent, setNewContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const maxChars = 1000;

  const fetchNotes = useCallback(async () => {
    if (!entityId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res: any = await apiClient.get(
        `/admin/notes?entityType=${entityType}&entityId=${entityId}`,
      );
      setNotes(res?.data || res || []);
    } catch (err) {
      const parsed = describeApiError(err);
      setError(parsed.message || 'حدث خطأ أثناء تحميل الملاحظات الداخلية');
    } finally {
      setIsLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const handleSubmitNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim()) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res: any = await apiClient.post('/admin/notes', {
        entityType,
        entityId,
        content: newContent.trim(),
      });

      const createdNote = res?.data || res;
      setNotes((prev) => [createdNote, ...prev]);
      setNewContent('');
    } catch (err) {
      const parsed = describeApiError(err);
      setSubmitError(parsed.message || 'فشل حفظ الملاحظة الداخلية');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={`bg-surface dark:bg-dark-surface-base rounded-xl border border-amber-200/80 dark:border-amber-900/40 shadow-xs overflow-hidden ${className}`}
    >
      {/* Card Header with Confidentiality Notice */}
      <div className="p-4 bg-amber-50/70 dark:bg-amber-950/20 border-b border-amber-200/60 dark:border-amber-900/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 rounded-md">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-ink-primary dark:text-dark-ink-primary flex items-center gap-1.5">
              <span>{title}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200">
                سري - للموظفين فقط
              </span>
            </h3>
            <p className="text-[11px] text-ink-secondary dark:text-dark-ink-secondary">
              هذه الملاحظات مخصصة لمشرفي وموظفي المنصة ولا يمكن للعميل أو المسوق الاطلاع عليها إطلاقاً.
            </p>
          </div>
        </div>

        <button
          onClick={fetchNotes}
          disabled={isLoading}
          className="p-1.5 text-ink-secondary hover:text-ink-primary rounded-md self-end sm:self-auto"
          title="تحديث الملاحظات"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Error notification */}
        {error && (
          <div className="p-2.5 bg-rose-50 text-rose-800 text-xs rounded-lg border border-rose-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* New Note Form */}
        <form onSubmit={handleSubmitNote} className="space-y-2">
          {submitError && (
            <div className="p-2 bg-rose-50 text-rose-800 text-xs rounded-md">
              {submitError}
            </div>
          )}
          <div className="relative">
            <textarea
              rows={3}
              maxLength={maxChars}
              placeholder="اكتب ملاحظة تشغيلية داخلية جديدة (مثال: تم التواصل هاتفياً مع المسوق وجارٍ التحقق من رخصة فال)..."
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              className="w-full p-3 text-xs bg-surface dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border rounded-xl text-ink-primary dark:text-dark-ink-primary placeholder:text-ink-muted focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-hidden resize-none"
            />
            <div className="flex items-center justify-between mt-1 text-[11px] text-ink-muted dark:text-dark-ink-muted">
              <span>
                {newContent.length} / {maxChars} حرف
              </span>
              <button
                type="submit"
                disabled={isSubmitting || !newContent.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium text-xs disabled:opacity-40 transition-colors"
              >
                {isSubmitting ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>إضافة الملاحظة</span>
              </button>
            </div>
          </div>
        </form>

        {/* Existing Notes Feed */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between text-xs font-semibold text-ink-secondary dark:text-dark-ink-secondary border-b border-surface-border dark:border-dark-surface-border pb-1">
            <span>سجل الملاحظات ({notes.length})</span>
          </div>

          {isLoading && notes.length === 0 ? (
            <div className="py-6 text-center text-xs text-ink-secondary dark:text-dark-ink-secondary flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-amber-600" />
              <span>جارٍ تحميل الملاحظات...</span>
            </div>
          ) : notes.length === 0 ? (
            <div className="py-6 text-center text-xs text-ink-muted dark:text-dark-ink-muted">
              <MessageSquare className="w-8 h-8 mx-auto mb-1 opacity-40" />
              <span>لا توجد ملاحظات داخلية مدونة حتى الآن</span>
            </div>
          ) : (
            notes.map((note) => (
              <div
                key={note.id}
                className="p-3 bg-surface dark:bg-dark-surface-sunken rounded-lg border border-surface-border dark:border-dark-surface-border space-y-1.5 text-xs"
              >
                <div className="flex items-center justify-between gap-2 text-ink-secondary dark:text-dark-ink-secondary">
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span className="font-semibold text-ink-primary dark:text-dark-ink-primary">
                      {note.authorAdminName}
                    </span>
                    <span className="text-[10px] text-ink-muted dark:text-dark-ink-muted">
                      ({note.authorAdminRole})
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-ink-muted dark:text-dark-ink-muted">
                    <Clock className="w-3 h-3" />
                    <span>
                      {new Date(note.createdAt).toLocaleString('ar-SA', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>

                <p className="text-ink-primary dark:text-dark-ink-primary whitespace-pre-wrap leading-relaxed pr-5">
                  {note.content}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

