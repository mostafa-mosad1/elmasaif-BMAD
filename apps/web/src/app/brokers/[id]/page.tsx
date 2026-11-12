'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { useParams } from 'next/navigation';
import { BrokerPublicProfileDto } from '@elmasaif/shared';
import { LayoutShell } from '../../../components/layout';
import {
  BrokerProfileHeader,
  BrokerRatingsBreakdown,
  BrokerReviewsList,
  BrokerListingsGrid,
} from '../../../components/brokers';
import { apiClient, ApiError } from '../../../lib/api-client';
import { EmptyState, Button } from '../../../components/ui';
import { AlertCircle, UserX, Loader2, Building2, Star, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { ViolationReportModal } from '../../../components/support/violation-report-modal';

export default function BrokerPublicProfilePage() {
  const params = useParams();
  const brokerId = String(params?.id || '');

  const [profile, setProfile] = useState<BrokerPublicProfileDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'listings' | 'reviews'>('listings');
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!brokerId) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    apiClient
      .get<{ statusCode: number; data: BrokerPublicProfileDto } | BrokerPublicProfileDto>(
        `/brokers/${brokerId}`,
      )
      .then((res: any) => {
        if (!isMounted) return;
        const profileData = res?.data || res;
        setProfile(profileData);
      })
      .catch((err: any) => {
        if (!isMounted) return;
        if (err instanceof ApiError && err.statusCode === 404) {
          setError('ملف الوسيط العقاري غير موجود أو قد تم إلغاء تنشيطه.');
        } else {
          setError(err?.message || 'تعذر تحميل بيانات الوسيط العقاري، يرجى المحاولة لاحقاً.');
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [brokerId]);

  return (
    <LayoutShell>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8" dir="rtl">
        {loading ? (
          <div className="min-h-[400px] flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm text-ink-secondary dark:text-dark-ink-secondary">
              جاري تحميل ملف الوسيط العقاري...
            </p>
          </div>
        ) : error || !profile ? (
          <div className="min-h-[400px] flex flex-col items-center justify-center p-8 bg-surface-base dark:bg-dark-surface-base rounded-card border border-surface-border dark:border-dark-surface-border text-center">
            <UserX className="w-12 h-12 text-ink-muted/50 mb-3" />
            <h2 className="text-lg font-bold text-ink-primary dark:text-dark-ink-primary mb-1">
              تعذر العثور على الوسيط
            </h2>
            <p className="text-sm text-ink-secondary dark:text-dark-ink-secondary max-w-md mb-6">
              {error || 'ملف الوسيط العقاري غير متاح حالياً.'}
            </p>
            <Link href="/properties">
              <Button variant="secondary">العودة لتصفح العقارات</Button>
            </Link>
          </div>
        ) : (
          <>
            {/* Header Banner */}
            <BrokerProfileHeader profile={profile} />

            {/* Main Tabs Navigation */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 border-b border-surface-border dark:border-dark-surface-border pb-4">
                <button
                  type="button"
                  onClick={() => startTransition(() => setActiveTab('listings'))}
                  className={`inline-flex items-center gap-2.5 px-5 py-2.5 text-sm font-bold rounded-pill transition-all cursor-pointer ${
                    activeTab === 'listings'
                      ? 'bg-primary text-white shadow-sm ring-2 ring-primary/20'
                      : 'bg-surface-base dark:bg-dark-surface-base text-ink-secondary dark:text-dark-ink-secondary border border-surface-border dark:border-dark-surface-border hover:text-ink-primary dark:hover:text-dark-ink-primary hover:bg-surface-sunken dark:hover:bg-dark-surface-sunken'
                  }`}
                >
                  <Building2 className="w-4 h-4 shrink-0" />
                  <span>العقارات المعروضة</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-mono font-semibold ${
                      activeTab === 'listings'
                        ? 'bg-white/20 text-white'
                        : 'bg-surface-sunken dark:bg-dark-surface-sunken text-ink-secondary dark:text-dark-ink-secondary border border-surface-border dark:border-dark-surface-border'
                    }`}
                  >
                    {profile.activeListings.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => startTransition(() => setActiveTab('reviews'))}
                  className={`inline-flex items-center gap-2.5 px-5 py-2.5 text-sm font-bold rounded-pill transition-all cursor-pointer ${
                    activeTab === 'reviews'
                      ? 'bg-primary text-white shadow-sm ring-2 ring-primary/20'
                      : 'bg-surface-base dark:bg-dark-surface-base text-ink-secondary dark:text-dark-ink-secondary border border-surface-border dark:border-dark-surface-border hover:text-ink-primary dark:hover:text-dark-ink-primary hover:bg-surface-sunken dark:hover:bg-dark-surface-sunken'
                  }`}
                >
                  <Star className="w-4 h-4 shrink-0" />
                  <span>التقييمات والمراجعات</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-mono font-semibold ${
                      activeTab === 'reviews'
                        ? 'bg-white/20 text-white'
                        : 'bg-surface-sunken dark:bg-dark-surface-sunken text-ink-secondary dark:text-dark-ink-secondary border border-surface-border dark:border-dark-surface-border'
                    }`}
                  >
                    {profile.reviews.length}
                  </span>
                <button
                  type="button"
                  onClick={() => setIsReportModalOpen(true)}
                  className="mr-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors border border-red-200 dark:border-red-900/50"
                  data-testid="report-broker-button"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>إبلاغ عن وسيط مخالف</span>
                </button>
              </div>

              {/* Tab Content Panes */}
              {activeTab === 'listings' ? (
                <BrokerListingsGrid
                  listings={profile.activeListings}
                  brokerName={profile.commercialName}
                />
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  <div className="lg:col-span-5 space-y-6">
                    <BrokerRatingsBreakdown stats={profile.stats} />
                  </div>
                  <div className="lg:col-span-7 space-y-6">
                    <BrokerReviewsList reviews={profile.reviews} />
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {profile && (
        <ViolationReportModal
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
          targetType="BROKER"
          targetUserId={profile.userId}
          targetBrokerName={profile.commercialName}
        />
      )}
    </LayoutShell>
  );
}

