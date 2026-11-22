import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MarketplaceFlowchartAnalytics } from '../marketplace-flowchart-analytics';
import { ExecutiveDashboardMetricsDto } from '@elmasaif/shared';

describe('MarketplaceFlowchartAnalytics Component', () => {
  const mockMetrics: ExecutiveDashboardMetricsDto = {
    dealCounts48h: {
      activeInPaymentWindow: 7,
      completedLast48h: 15,
      pendingReviewLast48h: 4,
      totalVolumeLast48hSar: 18500000,
    },
    pendingQueues: {
      listingsModeration: 6,
      falVerifications: 2,
      paymentProofReviews: 5,
      contractFeeReviews: 3,
      unassignedDisputes: 1,
      openTickets: 4,
      pendingViolationReports: 2,
      activeTaskClaims: 3,
    },
    slaWarnings: {
      dealsExpiringSoon12h: 2,
      ticketsSlaBreached: 1,
      listingsPendingOver24h: 3,
    },
    financialThroughput30d: {
      grossVolumeSar: 45000000,
      commissionsSar: 220000,
      contractFeesSar: 75000,
    },
  };

  it('renders flowchart title and pipeline steps', () => {
    const html = renderToString(<MarketplaceFlowchartAnalytics metrics={mockMetrics} />);
    expect(html).toContain('مخطط سير العمليات وإحصائيات متجر المصايف');
    expect(html).toContain('مخطط مسار الصفقات وتدفق المتجر (Transaction Lifecycle Pipeline)');
    expect(html).toContain('توريد العقارات والرخص');
    expect(html).toContain('التدقيق والاعتماد الإداري');
    expect(html).toContain('عروض الشراء والوساطة');
    expect(html).toContain('العقود والرسوم الإدارية');
    expect(html).toContain('سداد العربون والضمان البنكي');
    expect(html).toContain('الإفراغ والتسوية المالية');
  });

  it('renders store analytics charts and conversion funnel', () => {
    const html = renderToString(<MarketplaceFlowchartAnalytics metrics={mockMetrics} />);
    expect(html).toContain('مسار السيولة النقدية والصفقات');
    expect(html).toContain('قمع التحويل والعمليات');
    expect(html).toContain('التوزيع الجغرافي وحجم الصفقات بالمدن');
    expect(html).toContain('توزيع المعروض والصفقات حسب تصنيف العقار');
    expect(html).toContain('حجم الصفقات (GMV)');
    expect(html).toContain('إيرادات المنصة (2.5%)');
  });

  it('renders Saudi regional breakdown and property categories', () => {
    const html = renderToString(<MarketplaceFlowchartAnalytics metrics={mockMetrics} />);
    expect(html).toContain('مدينة الرياض');
    expect(html).toContain('محافظة جدة');
    expect(html).toContain('المنطقة الشرقية');
    expect(html).toContain('مناطق المصايف (أبها، الطائف، عسير)');
    expect(html).toContain('فلل وقصور مستقلة');
    expect(html).toContain('شقق سكنية فاخرة');
  });

  it('renders vertical column chart for cities with X-axis bottom labels and height indicators', () => {
    const html = renderToString(<MarketplaceFlowchartAnalytics metrics={mockMetrics} />);
    expect(html).toContain('ارتفاع العمود يوضح حجم الصفقات لكل مدينة');
    expect(html).toContain('حجم الصفقات (م.ر.س)');
    expect(html).toContain('حصة السوق (%)');
    expect(html).toContain('عدد الصفقات');
    expect(html).toContain('184.2M ر.س');
    expect(html).toContain('المدينة الأعلى تداولاً');
    expect(html).toContain('الأسرع نمواً وإقبالاً');
  });

  it('renders interactive donut chart and deal velocity breakdown for property types', () => {
    const html = renderToString(<MarketplaceFlowchartAnalytics metrics={mockMetrics} />);
    expect(html).toContain('رسم بياني دائري (Donut)');
    expect(html).toContain('مقارنة الصفقات والسرعة');
    expect(html).toContain('إجمالي المعروض');
    expect(html).toContain('157 صفقة منجزة');
    expect(html).toContain('مؤشر سيولة المتجر');
    expect(html).toContain('أراضي ومخططات تجارية');
    expect(html).toContain('منتجعات وشاليهات ومصايف');
  });
});
