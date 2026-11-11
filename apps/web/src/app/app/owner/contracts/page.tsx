'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { Badge } from '../../../../components/ui/badge';
import {
  FileText,
  Building,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  RefreshCw,
  CreditCard,
  ExternalLink,
  ShieldCheck,
  Calendar,
} from 'lucide-react';
import { apiClient } from '../../../../lib/api-client';
import {
  OwnerListingRequestItem,
  OwnerListingRequestStatus,
  OwnerContractStatus,
} from '@elmasaif/shared';
import { PROPERTY_TYPE_MAP } from '../../../admin/owner-requests/contracts-helpers';

interface OwnerContractsPageProps {
  initialRequests?: OwnerListingRequestItem[];
}

export default function OwnerContractsPage({ initialRequests }: OwnerContractsPageProps = {}) {
  const [requests, setRequests] = useState<OwnerListingRequestItem[]>(initialRequests || []);
  const [loading, setLoading] = useState(!initialRequests);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const fetchContracts = useCallback(async () => {
    try {
      setLoading(true);
      setErrorBanner(null);
      const res = await apiClient<OwnerListingRequestItem[]>('/owner/listing-requests');
      if (Array.isArray(res)) {
        setRequests(res);
      }
    } catch (err: any) {
      setErrorBanner(err?.message || 'فشل في تحميل عقود الوساطة');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialRequests) {
      fetchContracts();
    }
  }, [fetchContracts, initialRequests]);

  // Filter requests that have contracts dispatched
  const contractItems = requests.filter(
    (r) => r.contractId || r.status === OwnerListingRequestStatus.APPROVED_PENDING_SIGNATURE,
  );

  return (
    <div dir="rtl" className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl bg-[#1B4332] text-white p-6 shadow-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 text-xs font-semibold bg-white/15 text-[#D8F3DC] px-3 py-1 rounded-full">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>عقود الوساطة والتسويق الإلكترونية • نظام الهيئة العامة للعقار</span>
          </div>
          <h1 className="text-2xl font-bold">عقود الوساطة العقارية الإلكترونية</h1>
          <p className="text-xs text-white/80 max-w-2xl leading-relaxed">
            استعراض وتوقيع عقود الوساطة الرسمية الصادرة من إدارة المنصة لعقاراتك، ومتابعة سداد رسوم العقد والتسويق.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchContracts()}
          disabled={loading}
          className="bg-white/10 hover:bg-white/20 text-white border-white/20 gap-2 text-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>تحديث</span>
        </Button>
      </div>

      {errorBanner && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{errorBanner}</span>
        </div>
      )}

      {/* Contracts List */}
      <Card>
        <CardHeader className="p-5 border-b">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <span>العقود الصادرة وقيد الإجراء ({contractItems.length})</span>
          </CardTitle>
          <CardDescription className="text-xs">
            كل عقد ملزم نظاماً بموجب اللائحة التنفيذية لنظام الوساطة العقارية في المملكة العربية السعودية.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-5">
          {loading ? (
            <div className="py-12 text-center text-muted-foreground flex flex-col items-center gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-primary" />
              <span className="text-xs">جاري تحميل العقود...</span>
            </div>
          ) : contractItems.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground flex flex-col items-center gap-3">
              <FileText className="w-10 h-10 text-muted-foreground/40" />
              <p className="text-sm font-bold text-foreground">لا توجد عقود وساطة صادرة حتى الآن</p>
              <p className="text-xs max-w-md">
                عند تقديم طلب عرض عقار مباشر واعتماده من المشرفين، سيتم إرسال العقد الرسمي هنا لتتمكن من مراجعته وتوقيعه إلكترونياً.
              </p>
              <Link href="/app/owner/listings/new">
                <Button size="sm" className="mt-2 text-xs gap-1.5 bg-[#1B4332] hover:bg-[#2D6A4F] text-white">
                  <span>تقديم طلب عرض عقار جديد</span>
                  <ArrowLeft className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {contractItems.map((item) => {
                const isPendingSignature =
                  item.status === OwnerListingRequestStatus.APPROVED_PENDING_SIGNATURE ||
                  item.contractStatus === OwnerContractStatus.PENDING_SIGNATURE;

                return (
                  <div
                    key={item.id}
                    className="p-5 rounded-xl border bg-card hover:border-primary/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[11px] font-bold">
                          {PROPERTY_TYPE_MAP[item.propertyType] || item.propertyType}
                        </span>
                        <h3 className="text-base font-bold text-foreground">{item.propertyTitle}</h3>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{item.cityName} — حي {item.districtName}</span>
                        <span>•</span>
                        <span>السعر المطلوب: {item.askPrice.toLocaleString()} ر.س</span>
                        <span>•</span>
                        <span>تاريخ الإرسال: {new Date(item.createdAt).toLocaleDateString('ar-SA')}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {isPendingSignature ? (
                        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            <span>بانتظار التوقيع الإلكتروني</span>
                          </span>
                          <Link href={`/app/owner/contracts/${item.contractId || item.id}`}>
                            <Button
                              size="sm"
                              className="bg-[#1B4332] hover:bg-[#2D6A4F] text-white text-xs font-bold gap-1.5 shadow-sm"
                            >
                              <span>مراجعة وتوقيع العقد</span>
                              <ArrowLeft className="w-3.5 h-3.5" />
                            </Button>
                          </Link>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{item.contractStatus || 'عقد معتمد'}</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
