'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import {
  ShieldCheck,
  Search,
  Eye,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  FileText,
  User,
  Phone,
  AlertTriangle,
  X,
  Sparkles,
} from 'lucide-react';
import { apiClient, normalizeStorageUrl } from '../../../lib/api-client';

interface PendingIdentityItem {
  id: string;
  userId: string;
  fullName: string;
  mobileNumber: string;
  idNumber: string;
  documentType: string;
  status: string;
  submittedAt: string;
}

interface PendingResponse {
  code: string;
  data: {
    data: PendingIdentityItem[];
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  };
}

export default function AdminIdentityReviewPage() {
  const [items, setItems] = useState<PendingIdentityItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [verifyingItem, setVerifyingItem] = useState<PendingIdentityItem | null>(null);
  const [rejectingItem, setRejectingItem] = useState<PendingIdentityItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchPending = useCallback(async () => {
    try {
      setLoading(true);
      setMessage(null);
      const res = await apiClient.get<PendingResponse>(
        `/admin/identity/pending?page=${page}&limit=20`
      );
      if (res?.data) {
        setItems(res.data.data || []);
        setTotal(res.data.meta?.total || 0);
      }
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err?.message || 'فشل في تحميل وثائق الهوية المعلقة للمراجعة',
      });
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  const handlePreview = async (docId: string) => {
    try {
      const previewWindow = window.open('about:blank', '_blank');
      if (previewWindow) previewWindow.opener = null;

      const res = await apiClient.get<{ code: string; data: { downloadUrl: string } }>(
        `/admin/identity/${docId}/download-url`
      );

      const targetUrl = normalizeStorageUrl(res.data.downloadUrl);
      if (previewWindow) {
        previewWindow.location.href = targetUrl;
      }
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err?.message || 'تعذر فتح وثيقة الهوية للمعاينة',
      });
    }
  };

  const handleVerifyClick = (item: PendingIdentityItem) => {
    setVerifyingItem(item);
  };

  const executeVerify = async () => {
    if (!verifyingItem) return;
    try {
      setActionLoadingId(verifyingItem.id);
      await apiClient.post(`/admin/identity/${verifyingItem.id}/verify`, {});
      setMessage({
        type: 'success',
        text: `تم توثيق واعتماد الهوية الوطنية للمستخدم (${verifyingItem.fullName}) بنجاح.`
      });
      setVerifyingItem(null);
      fetchPending();
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err?.message || 'تعذر اعتماد الهوية الوطنية.',
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRejectClick = (item: PendingIdentityItem) => {
    setRejectingItem(item);
    setRejectReason('');
    setRejectError(null);
  };

  const handleRejectSubmit = async () => {
    if (!rejectingItem) return;
    if (!rejectReason.trim()) {
      setRejectError('يرجى توضيح سبب الرفض لإرشاد المستخدم لتصحيح المشكلة.');
      return;
    }

    try {
      setActionLoadingId(rejectingItem.id);
      await apiClient.post(`/admin/identity/${rejectingItem.id}/reject`, {
        reason: rejectReason.trim(),
      });
      setMessage({
        type: 'success',
        text: `تم رفض وثيقة المستخدم (${rejectingItem.fullName}) وإرسال إشعار فوري بالسبب.`
      });
      setRejectingItem(null);
      setRejectReason('');
      setRejectError(null);
      fetchPending();
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err?.message || 'تعذر رفض الوثيقة.',
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const filteredItems = items.filter(
    (item) =>
      item.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.mobileNumber?.includes(searchTerm) ||
      item.idNumber?.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-surface-border dark:border-dark-surface-border">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="p-2 rounded-xl border border-surface-border dark:border-dark-surface-border hover:bg-surface-sunken dark:hover:bg-dark-surface-sunken transition-colors"
          >
            <ArrowRight className="w-5 h-5 text-ink-secondary" />
          </Link>
          <div>
            <h1 className="text-xl font-black text-ink-primary dark:text-dark-ink-primary flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-primary dark:text-accent" />
              مراجعة وتوثيق الهويات الوطنية ({total})
            </h1>
            <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary mt-0.5">
              تدقيق ومطابقة وثائق الهوية الوطنية والإقامة للمستخدمين والوسطاء
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchPending}
          disabled={loading}
          className="shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          تحديث القائمة
        </Button>
      </div>

      {/* Alert banner */}
      {message && (
        <div
          className={`p-4 rounded-xl text-sm flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800'
              : 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Filter bar */}
      <div className="p-4 rounded-2xl bg-surface dark:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="بحث بالاسم أو الجوال أو رقم الهوية..."
            className="w-full pr-9 pl-3 py-2 text-xs rounded-xl bg-surface-sunken dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border text-ink-primary dark:text-dark-ink-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="text-xs text-ink-muted">
          عرض {filteredItems.length} من أصل {total} وثيقة معلقة
        </div>
      </div>

      {/* Content list */}
      {loading ? (
        <div className="p-12 text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-primary animate-spin mx-auto" />
          <p className="text-sm text-ink-muted">جاري تحميل وثائق الهوية المعلقة...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <h3 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary">
              لا توجد وثائق هوية معلقة للمراجعة حالياً
            </h3>
            <p className="text-xs text-ink-muted">
              تم تدقيق ومطابقة كافة وثائق الهوية المرفوعة بنجاح.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredItems.map((item) => (
            <Card key={item.id} className="overflow-hidden border-surface-border dark:border-dark-surface-border">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-primary" />
                      <span className="font-bold text-sm text-ink-primary dark:text-dark-ink-primary">
                        {item.fullName || 'مستخدم غير محدد الاسم'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-ink-secondary dark:text-dark-ink-secondary">
                      <Phone className="w-3.5 h-3.5" />
                      <span dir="ltr">{item.mobileNumber}</span>
                    </div>
                  </div>
                  <Badge variant="pending" size="sm">
                    قيد المراجعة
                  </Badge>
                </div>

                <div className="p-3 rounded-xl bg-surface-sunken dark:bg-dark-surface-sunken space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-ink-muted">نوع الوثيقة:</span>
                    <span className="font-bold text-ink-primary dark:text-dark-ink-primary">
                      {item.documentType === 'NATIONAL_ID' ? 'هوية وطنية' : 'إقامة نظامية'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-ink-muted">رقم الهوية المدخل:</span>
                    <span className="font-mono font-bold text-ink-primary dark:text-dark-ink-primary">
                      {item.idNumber || 'غير متوفر'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-ink-muted">تاريخ الرفع:</span>
                    <span className="text-ink-secondary">
                      {new Date(item.submittedAt).toLocaleString('ar-SA')}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2 border-t border-surface-border dark:border-dark-surface-border">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handlePreview(item.id)}
                    className="flex-1"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    معاينة الوثيقة
                  </Button>

                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    disabled={actionLoadingId === item.id}
                    onClick={() => handleVerifyClick(item)}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    اعتماد وتوثيق
                  </Button>

                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    disabled={actionLoadingId === item.id}
                    onClick={() => handleRejectClick(item)}
                    className="px-3"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    رفض
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Verify Confirmation Modal */}
      {verifyingItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-surface dark:bg-dark-surface-raised rounded-2xl max-w-md w-full p-6 space-y-5 border border-surface-border dark:border-dark-surface-border shadow-2xl relative">
            <button
              type="button"
              disabled={Boolean(actionLoadingId)}
              onClick={() => setVerifyingItem(null)}
              className="absolute top-4 start-4 text-ink-muted hover:text-ink-primary p-1 rounded-lg hover:bg-surface-sunken dark:hover:bg-dark-surface-sunken transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-2 pt-2">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-inner ring-8 ring-emerald-500/5">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-ink-primary dark:text-dark-ink-primary">
                اعتماد وتوثيق الهوية الوطنية
              </h3>
              <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary leading-relaxed">
                هل أنت متأكد من مطابقة بيانات الهوية وترقية حساب المستخدم إلى موثق رسمياً؟
              </p>
            </div>

            {/* User Identity Details Card */}
            <div className="p-3.5 rounded-xl bg-surface-sunken dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-ink-muted flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  اسم المستخدم:
                </span>
                <span className="font-semibold text-ink-primary dark:text-dark-ink-primary">
                  {verifyingItem.fullName}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-muted flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  رقم الهوية الوطنية:
                </span>
                <span className="font-mono font-semibold text-ink-primary dark:text-dark-ink-primary" dir="ltr">
                  {verifyingItem.idNumber || 'غير مسجل'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-muted flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" />
                  رقم الجوال:
                </span>
                <span className="font-mono text-ink-secondary" dir="ltr">
                  {verifyingItem.mobileNumber}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-700 dark:text-emerald-300 flex items-start gap-2">
              <Sparkles className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
              <span>
                سيتم تحويل حالة الحساب فوراً إلى <strong>موثق بالهوية الوطنية</strong> وإتاحة كامل ميزات وتراخيص النشر وإرسال إشعار فوري للمستخدم.
              </span>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={Boolean(actionLoadingId)}
                onClick={() => setVerifyingItem(null)}
                className="flex-1"
              >
                إلغاء
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={Boolean(actionLoadingId)}
                onClick={executeVerify}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm"
              >
                {actionLoadingId === verifyingItem.id ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    جاري التوثيق...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    تأكيد الاعتماد والتوثيق
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectingItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-surface dark:bg-dark-surface-raised rounded-2xl max-w-md w-full p-6 space-y-4 border border-surface-border dark:border-dark-surface-border shadow-2xl relative">
            <button
              type="button"
              disabled={Boolean(actionLoadingId)}
              onClick={() => setRejectingItem(null)}
              className="absolute top-4 start-4 text-ink-muted hover:text-ink-primary p-1 rounded-lg hover:bg-surface-sunken dark:hover:bg-dark-surface-sunken transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-2 pt-2">
              <div className="w-14 h-14 rounded-2xl bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto shadow-inner ring-8 ring-rose-500/5">
                <XCircle className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-ink-primary dark:text-dark-ink-primary">
                رفض وثيقة الهوية الوطنية
              </h3>
              <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary">
                المستخدم: <strong>{rejectingItem.fullName}</strong> ({rejectingItem.mobileNumber})
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-ink-primary dark:text-dark-ink-primary block">
                سبب الرفض الموجه للمستخدم <span className="text-rose-500">*</span>:
              </label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => {
                  setRejectReason(e.target.value);
                  if (rejectError) setRejectError(null);
                }}
                placeholder="مثال: الصورة غير واضحة، أو البيانات لا تطابق الاسم المسجل ورقم الهوية..."
                className={`w-full p-3 rounded-xl bg-surface-sunken dark:bg-dark-surface-sunken border text-xs text-ink-primary dark:text-dark-ink-primary focus:outline-none focus:ring-2 ${
                  rejectError
                    ? 'border-rose-500 focus:ring-rose-500/30'
                    : 'border-surface-border dark:border-dark-surface-border focus:ring-primary/30'
                }`}
              />
              {rejectError && (
                <p className="text-[11px] text-rose-500 flex items-center gap-1 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {rejectError}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={Boolean(actionLoadingId)}
                onClick={() => setRejectingItem(null)}
                className="flex-1"
              >
                إلغاء
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                disabled={Boolean(actionLoadingId)}
                onClick={handleRejectSubmit}
                className="flex-1 font-semibold"
              >
                {actionLoadingId === rejectingItem.id ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    جاري المعالجة...
                  </>
                ) : (
                  <>
                    <XCircle className="w-3.5 h-3.5" />
                    تأكيد الرفض
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

