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
  const [rejectingDocId, setRejectingDocId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
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

  const handleVerify = async (docId: string) => {
    if (!confirm('هل أنت متأكد من اعتماد وتوثيق هذه الهوية الوطنية؟')) return;
    try {
      setActionLoadingId(docId);
      await apiClient.post(`/admin/identity/${docId}/verify`, {});
      setMessage({ type: 'success', text: 'تم توثيق واعتماد الهوية الوطنية بنجاح.' });
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

  const handleRejectSubmit = async () => {
    if (!rejectingDocId) return;
    if (!rejectReason.trim()) {
      alert('يرجى كتابة سبب الرفض لتوضيحه للمستخدم.');
      return;
    }

    try {
      setActionLoadingId(rejectingDocId);
      await apiClient.post(`/admin/identity/${rejectingDocId}/reject`, {
        reason: rejectReason.trim(),
      });
      setMessage({ type: 'success', text: 'تم رفض الوثيقة وإشعار المستخدم بالسبب.' });
      setRejectingDocId(null);
      setRejectReason('');
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
                    onClick={() => handleVerify(item.id)}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    اعتماد وتوثيق
                  </Button>

                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={actionLoadingId === item.id}
                    onClick={() => {
                      setRejectingDocId(item.id);
                      setRejectReason('');
                    }}
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

      {/* Reject Modal */}
      {rejectingDocId && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-surface dark:bg-dark-surface-raised rounded-2xl max-w-md w-full p-6 space-y-4 border border-surface-border dark:border-dark-surface-border shadow-2xl">
            <h3 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary flex items-center gap-2">
              <XCircle className="w-5 h-5 text-status-danger" />
              سبب رفض وثيقة الهوية
            </h3>
            <p className="text-xs text-ink-secondary">
              يرجى توضيح سبب الرفض بدقة ليصل إلى المستخدم ويتمكن من تصحيحه وإعادة الرفع:
            </p>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="مثال: الصورة غير واضحة أو البيانات لا تطابق الاسم المسجل..."
              className="w-full p-3 rounded-xl bg-surface-sunken dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border text-xs text-ink-primary dark:text-dark-ink-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRejectingDocId(null)}
              >
                إلغاء
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={actionLoadingId === rejectingDocId}
                onClick={handleRejectSubmit}
              >
                تأكيد الرفض
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

