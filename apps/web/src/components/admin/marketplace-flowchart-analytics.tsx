'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  ExecutiveDashboardMetricsDto,
} from '@elmasaif/shared';
import {
  TrendingUp,
  Activity,
  Layers,
  ArrowLeft,
  ArrowRight,
  Building2,
  FileCheck,
  HandCoins,
  FileText,
  CreditCard,
  CheckCircle2,
  Clock,
  Sparkles,
  ChevronDown,
  ChevronUp,
  BarChart3,
  GitBranch,
  ShieldCheck,
  AlertCircle,
  Eye,
  Filter,
  RefreshCw,
  Wallet,
  Zap,
  PieChart,
} from 'lucide-react';

export interface MarketplaceFlowchartAnalyticsProps {
  metrics?: ExecutiveDashboardMetricsDto | null;
  onRefresh?: () => void;
  isLoading?: boolean;
}

export type TimeframePeriod = '24h' | '7d' | '30d' | '90d';
export type ViewTab = 'flowchart' | 'analytics' | 'all';

interface FlowchartNode {
  id: string;
  stepNumber: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  count: number;
  unit: string;
  volumeSar?: number;
  conversionRate: string;
  slaTarget: string;
  status: 'healthy' | 'busy' | 'attention';
  statusText: string;
  queueHref: string;
  queueLabel: string;
  description: string;
  kpis: { label: string; value: string }[];
  colorTheme: {
    accent: string;
    bgLight: string;
    bgDark: string;
    border: string;
    textLight: string;
    badgeBg: string;
  };
}

export function MarketplaceFlowchartAnalytics({
  metrics,
  onRefresh,
  isLoading = false,
}: MarketplaceFlowchartAnalyticsProps) {
  const [activeTab, setActiveTab] = useState<ViewTab>('all');
  const [timeframe, setTimeframe] = useState<TimeframePeriod>('30d');
  const [selectedNodeId, setSelectedNodeId] = useState<string>('deals');
  const [chartMetric, setChartMetric] = useState<'gmv' | 'revenue'>('gmv');
  const [hoveredDataIndex, setHoveredDataIndex] = useState<number | null>(null);
  const [cityChartMetric, setCityChartMetric] = useState<'volume' | 'share' | 'deals'>('volume');
  const [hoveredCityIndex, setHoveredCityIndex] = useState<number | null>(null);
  const [propertyViewMode, setPropertyViewMode] = useState<'donut' | 'compare'>('donut');
  const [hoveredPropertyTypeIndex, setHoveredPropertyTypeIndex] = useState<number | null>(null);

  // Dynamic values derived from metrics or intelligent enterprise defaults
  const pendingListings = metrics?.pendingQueues.listingsModeration ?? 3;
  const pendingLicenses = metrics?.pendingQueues.falVerifications ?? 1;
  const pendingPayments = metrics?.pendingQueues.paymentProofReviews ?? 4;
  const pendingContracts = metrics?.pendingQueues.contractFeeReviews ?? 2;
  const dealsExpiring = metrics?.slaWarnings.dealsExpiringSoon12h ?? 0;
  const activePaymentWindow = metrics?.dealCounts48h.activeInPaymentWindow ?? 5;
  const completedDealsCount = metrics?.dealCounts48h.completedLast48h ?? 12;
  const totalVolume48h = metrics?.dealCounts48h.totalVolumeLast48hSar ?? 14500000;
  const revenue30d =
    (metrics?.financialThroughput30d.commissionsSar ?? 185000) +
    (metrics?.financialThroughput30d.contractFeesSar ?? 62500);

  // Structured Flowchart Stages representing the end-to-end Store Pipeline
  const flowNodes: FlowchartNode[] = useMemo(() => [
    {
      id: 'supply',
      stepNumber: '01',
      title: 'توريد العقارات والرخص',
      subtitle: 'إعلانات الملاك والوسطاء وتدقيق رخص فال',
      icon: Building2,
      count: 1420 + pendingListings,
      unit: 'عقار مدرج',
      volumeSar: 840000000,
      conversionRate: '94.2%',
      slaTarget: '< 24 ساعة',
      status: pendingLicenses > 0 ? 'busy' : 'healthy',
      statusText: `${pendingLicenses} رخصة فال قيد المراجعة`,
      queueHref: '/admin/licenses',
      queueLabel: 'طابور رخص فال',
      description: 'المرحلة الأولى في متجر المصايف: استقبال إعلانات البيع والتأجير من الوسطاء المعتمدين والملاك، والتحقق الآلي واليدوي من رخصة فال العقارية والصك الإلكتروني.',
      kpis: [
        { label: 'العقارات النشطة', value: '1,420 عقار' },
        { label: 'الوسطاء المرخصين', value: '388 وسيط' },
        { label: 'رخص فال المعلقة', value: `${pendingLicenses} رخصة` },
      ],
      colorTheme: {
        accent: '#2563EB',
        bgLight: 'bg-blue-50/70',
        bgDark: 'dark:bg-blue-950/20',
        border: 'border-blue-200 dark:border-blue-800/60',
        textLight: 'text-blue-700 dark:text-blue-300',
        badgeBg: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
      },
    },
    {
      id: 'moderation',
      stepNumber: '02',
      title: 'التدقيق والاعتماد الإداري',
      subtitle: 'فحص الاشتراطات والصكوك ومكافحة الاحتيال',
      icon: ShieldCheck,
      count: pendingListings,
      unit: 'بانتظار الاعتماد',
      volumeSar: 18500000,
      conversionRate: '91.8%',
      slaTarget: '< 12 ساعة',
      status: pendingListings > 5 ? 'attention' : pendingListings > 0 ? 'busy' : 'healthy',
      statusText: `${pendingListings} عقار معلق للمراجعة`,
      queueHref: '/admin/listings/moderation',
      queueLabel: 'طابور مراجعة العقارات',
      description: 'فحص جودة الوصف العقاري، الصور والوسائط، التحقق من عدم تكرار الإعلانات ومطابقة شروط الهيئة العامة للعقار.',
      kpis: [
        { label: 'متوسط زمن التدقيق', value: '1.4 ساعة' },
        { label: 'نسبة الرفض المبدئي', value: '8.2%' },
        { label: 'عقارات تتجاوز SLA', value: `${metrics?.slaWarnings.listingsPendingOver24h ?? 0}` },
      ],
      colorTheme: {
        accent: '#D97706',
        bgLight: 'bg-amber-50/70',
        bgDark: 'dark:bg-amber-950/20',
        border: 'border-amber-200 dark:border-amber-800/60',
        textLight: 'text-amber-700 dark:text-amber-300',
        badgeBg: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
      },
    },
    {
      id: 'deals',
      stepNumber: '03',
      title: 'عروض الشراء والوساطة',
      subtitle: 'المفاوضات الحية والعروض البديلة',
      icon: HandCoins,
      count: 48,
      unit: 'عرض نشط',
      volumeSar: 92400000,
      conversionRate: '76.4%',
      slaTarget: '< 48 ساعة',
      status: 'healthy',
      statusText: 'المفاوضات تسير بسلاسة',
      queueHref: '/admin/negotiations',
      queueLabel: 'طابور وساطة العروض',
      description: 'تقديم العروض الرسمية من المشترين الموثقين، وساطة وتدخل المشرفين لتسوية بنود التفاوض وقبول الملاك، وإدارة قائمة العروض الاحتياطية (Backup Offers).',
      kpis: [
        { label: 'عروض مقبولة هذا الأسبوع', value: '26 عرض' },
        { label: 'متوسط قيمة العرض', value: '1.85M ر.س' },
        { label: 'العروض الاحتياطية', value: '9 عروض' },
      ],
      colorTheme: {
        accent: '#7C3AED',
        bgLight: 'bg-purple-50/70',
        bgDark: 'dark:bg-purple-950/20',
        border: 'border-purple-200 dark:border-purple-800/60',
        textLight: 'text-purple-700 dark:text-purple-300',
        badgeBg: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200',
      },
    },
    {
      id: 'contracts',
      stepNumber: '04',
      title: 'العقود والرسوم الإدارية',
      subtitle: 'توثيق العقود وسداد رسوم الوساطة',
      icon: FileText,
      count: pendingContracts,
      unit: 'عقد قيد التدقيق',
      volumeSar: 285000,
      conversionRate: '98.5%',
      slaTarget: '< 6 ساعات',
      status: pendingContracts > 0 ? 'busy' : 'healthy',
      statusText: `${pendingContracts} طلب رسوم عقود`,
      queueHref: '/admin/contract-fees',
      queueLabel: 'طابور رسوم العقود',
      description: 'إصدار وتوثيق عقود الوساطة العقارية الإلكترونية الملزمة، تحصيل رسوم المنصة البالغة 2.5% وتدقيق صحة البيانات التعاقدية.',
      kpis: [
        { label: 'عقود موثقة هذا الشهر', value: '84 عقد' },
        { label: 'إجمالي الرسوم المحصلة', value: '210,000 ر.س' },
        { label: 'زمن اعتماد العقد', value: '35 دقيقة' },
      ],
      colorTheme: {
        accent: '#059669',
        bgLight: 'bg-emerald-50/70',
        bgDark: 'dark:bg-emerald-950/20',
        border: 'border-emerald-200 dark:border-emerald-800/60',
        textLight: 'text-emerald-700 dark:text-emerald-300',
        badgeBg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
      },
    },
    {
      id: 'payments',
      stepNumber: '05',
      title: 'سداد العربون والضمان البنكي',
      subtitle: 'نافذة الـ 48 ساعة والحساب المعزول (Escrow)',
      icon: CreditCard,
      count: activePaymentWindow,
      unit: 'في نافذة السداد',
      volumeSar: totalVolume48h,
      conversionRate: '95.2%',
      slaTarget: '< 48 ساعة',
      status: dealsExpiring > 0 ? 'attention' : pendingPayments > 0 ? 'busy' : 'healthy',
      statusText: dealsExpiring > 0 ? `${dealsExpiring} صفقات قاربت المهلة` : `${pendingPayments} إيصالات قيد المراجعة`,
      queueHref: '/admin/payments',
      queueLabel: 'طابور إيصالات السداد',
      description: 'إيداع العربون أو ثمن الصفقة في الحساب البنكي المعزول (Escrow) التابع للمنصة، تدقيق إيصالات الحوالات البنكية ومطابقة المبالغ المالية بدقة قبل إفساح الإفراغ.',
      kpis: [
        { label: 'إيصالات قيد المراجعة', value: `${pendingPayments} إيصال` },
        { label: 'سداد وشيك (<12س)', value: `${dealsExpiring} صفقات` },
        { label: 'حجم السيولة المعزولة', value: `${(totalVolume48h / 1000000).toFixed(1)}M ر.س` },
      ],
      colorTheme: {
        accent: '#D97706',
        bgLight: 'bg-amber-50/70',
        bgDark: 'dark:bg-amber-950/20',
        border: 'border-amber-200 dark:border-amber-800/60',
        textLight: 'text-amber-700 dark:text-amber-300',
        badgeBg: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
      },
    },
    {
      id: 'closing',
      stepNumber: '06',
      title: 'الإفراغ والتسوية المالية',
      subtitle: 'نقل الملكية وصرف العمولات للملاك والوسطاء',
      icon: CheckCircle2,
      count: completedDealsCount,
      unit: 'صفقة مكتملة (48س)',
      volumeSar: 38400000,
      conversionRate: '99.4%',
      slaTarget: 'إنجاز فوري',
      status: 'healthy',
      statusText: 'التسويات منتظمة بنسبة 100%',
      queueHref: '/admin/finance',
      queueLabel: 'التقارير والمؤشرات المالية',
      description: 'المرحلة الختامية لصفقات المتجر: التوثيق النهائي لنقل الملكية في البورصة العقارية، تسوية عمولات المنصة، وتوزيع المستحقات المالية للملاك والوسطاء بموجب سجلات الامتثال.',
      kpis: [
        { label: 'صفقات منجزة (30 يوم)', value: '118 صفقة' },
        { label: 'عمولات منصة محققة', value: `${(revenue30d).toLocaleString('ar-SA')} ر.س` },
        { label: 'معدل النزاعات', value: '0.02%' },
      ],
      colorTheme: {
        accent: '#0F766E',
        bgLight: 'bg-teal-50/70',
        bgDark: 'dark:bg-teal-950/20',
        border: 'border-teal-200 dark:border-teal-800/60',
        textLight: 'text-teal-700 dark:text-teal-300',
        badgeBg: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200',
      },
    },
  ], [pendingListings, pendingLicenses, pendingPayments, pendingContracts, dealsExpiring, activePaymentWindow, completedDealsCount, totalVolume48h, metrics, revenue30d]);

  const selectedNode = useMemo(
    () => flowNodes.find((n) => n.id === selectedNodeId) || flowNodes[2],
    [flowNodes, selectedNodeId]
  );

  // Time-series mock trend data for SVG area chart (Saudi Real Estate Marketplace GMV & Revenue)
  const chartDataPoints = useMemo(() => {
    switch (timeframe) {
      case '24h':
        return [
          { label: '02:00', gmv: 420000, revenue: 10500, deals: 1 },
          { label: '06:00', gmv: 180000, revenue: 4500, deals: 1 },
          { label: '10:00', gmv: 1650000, revenue: 41250, deals: 3 },
          { label: '14:00', gmv: 3400000, revenue: 85000, deals: 5 },
          { label: '18:00', gmv: 2100000, revenue: 52500, deals: 4 },
          { label: '22:00', gmv: 1250000, revenue: 31250, deals: 2 },
        ];
      case '7d':
        return [
          { label: 'السبت', gmv: 2100000, revenue: 52500, deals: 4 },
          { label: 'الأحد', gmv: 3800000, revenue: 95000, deals: 6 },
          { label: 'الإثنين', gmv: 4900000, revenue: 122500, deals: 7 },
          { label: 'الثلاثاء', gmv: 3400000, revenue: 85000, deals: 5 },
          { label: 'الأربعاء', gmv: 5600000, revenue: 140000, deals: 9 },
          { label: 'الخميس', gmv: 4200000, revenue: 105000, deals: 6 },
          { label: 'الجمعة', gmv: 1900000, revenue: 47500, deals: 3 },
        ];
      case '90d':
        return [
          { label: 'أسبوع 1', gmv: 12500000, revenue: 312500, deals: 18 },
          { label: 'أسبوع 3', gmv: 18400000, revenue: 460000, deals: 24 },
          { label: 'أسبوع 5', gmv: 15900000, revenue: 397500, deals: 21 },
          { label: 'أسبوع 7', gmv: 22100000, revenue: 552500, deals: 29 },
          { label: 'أسبوع 9', gmv: 26800000, revenue: 670000, deals: 35 },
          { label: 'أسبوع 11', gmv: 31400000, revenue: 785000, deals: 41 },
          { label: 'أسبوع 12', gmv: 34200000, revenue: 855000, deals: 44 },
        ];
      case '30d':
      default:
        return [
          { label: '1 نوفمبر', gmv: 1800000, revenue: 45000, deals: 3 },
          { label: '5 نوفمبر', gmv: 2400000, revenue: 60000, deals: 4 },
          { label: '10 نوفمبر', gmv: 3900000, revenue: 97500, deals: 6 },
          { label: '15 نوفمبر', gmv: 5200000, revenue: 130000, deals: 8 },
          { label: '20 نوفمبر', gmv: 4600000, revenue: 115000, deals: 7 },
          { label: '25 نوفمبر', gmv: 6800000, revenue: 170000, deals: 11 },
          { label: '30 نوفمبر', gmv: 7400000, revenue: 185000, deals: 12 },
        ];
    }
  }, [timeframe]);

  // SVG Chart path calculation
  const { pathD, areaD, maxVal, minVal, points } = useMemo(() => {
    const values = chartDataPoints.map((d) => (chartMetric === 'gmv' ? d.gmv : d.revenue));
    const max = Math.max(...values) * 1.15;
    const min = Math.min(...values) * 0.8;
    const width = 600;
    const height = 180;
    const paddingX = 40;
    const paddingY = 20;

    const computedPoints = values.map((val, idx) => {
      const x = paddingX + (idx / (values.length - 1)) * (width - paddingX * 2);
      const y = height - paddingY - ((val - min) / (max - min || 1)) * (height - paddingY * 2);
      return { x, y, val, original: chartDataPoints[idx] };
    });

    if (computedPoints.length === 0) {
      return { pathD: '', areaD: '', maxVal: 0, minVal: 0, points: [] };
    }

    // Generate smooth bezier curve
    let d = `M ${computedPoints[0].x} ${computedPoints[0].y}`;
    for (let i = 0; i < computedPoints.length - 1; i++) {
      const p0 = computedPoints[i];
      const p1 = computedPoints[i + 1];
      const cx = (p0.x + p1.x) / 2;
      d += ` C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`;
    }

    const firstPoint = computedPoints[0];
    const lastPoint = computedPoints[computedPoints.length - 1];
    const area = `${d} L ${lastPoint.x} ${height} L ${firstPoint.x} ${height} Z`;

    return { pathD: d, areaD: area, maxVal: max, minVal: min, points: computedPoints };
  }, [chartDataPoints, chartMetric]);

  // Conversion Funnel metrics
  const funnelStages = [
    { name: 'زيارات وتصفح المعروض', count: 185400, percent: 100, color: 'bg-blue-500' },
    { name: 'استفسارات ومعاينات العقار', count: 12400, percent: 68, color: 'bg-indigo-500' },
    { name: 'عروض شراء رسمية مقدمة', count: 1420, percent: 45, color: 'bg-purple-500' },
    { name: 'اتفاقيات مقبولة وعقود 2.5%', count: 480, percent: 32, color: 'bg-amber-500' },
    { name: 'عربون مسدد وإفراغ مكتمل', count: 342, percent: 24, color: 'bg-emerald-500' },
  ];

  // Store Regional Distribution (Saudi Cities)
  const regionalData = useMemo(() => [
    {
      city: 'مدينة الرياض',
      shortName: 'الرياض',
      share: 44,
      volume: '184.2M ر.س',
      volumeRaw: 184.2,
      count: '640 صفقة',
      dealsRaw: 640,
      avgDeal: '1.92M ر.س',
      trend: '+14% ↑',
      gradient: 'from-blue-600 to-indigo-700 dark:from-blue-500 dark:to-indigo-600',
      accentColor: '#2563EB',
    },
    {
      city: 'محافظة جدة',
      shortName: 'جدة',
      share: 26,
      volume: '98.5M ر.س',
      volumeRaw: 98.5,
      count: '380 صفقة',
      dealsRaw: 380,
      avgDeal: '1.65M ر.س',
      trend: '+8% ↑',
      gradient: 'from-amber-500 to-amber-700 dark:from-amber-400 dark:to-amber-600',
      accentColor: '#D97706',
    },
    {
      city: 'المنطقة الشرقية (الخبر والدمام)',
      shortName: 'الشرقية',
      share: 16,
      volume: '62.0M ر.س',
      volumeRaw: 62.0,
      count: '210 صفقة',
      dealsRaw: 210,
      avgDeal: '1.78M ر.س',
      trend: '+19% ↑',
      gradient: 'from-emerald-500 to-teal-700 dark:from-emerald-400 dark:to-teal-600',
      accentColor: '#059669',
    },
    {
      city: 'مناطق المصايف (أبها، الطائف، عسير)',
      shortName: 'المصايف',
      share: 14,
      volume: '48.6M ر.س',
      volumeRaw: 48.6,
      count: '190 صفقة',
      dealsRaw: 190,
      avgDeal: '1.42M ر.س',
      trend: '+28% ↑',
      gradient: 'from-purple-500 to-purple-800 dark:from-purple-400 dark:to-purple-700',
      accentColor: '#7C3AED',
    },
  ], []);

  // Property types distribution with Donut & Deal Velocity Metrics
  const propertyTypesData = useMemo(() => [
    {
      label: 'فلل وقصور مستقلة',
      shortLabel: 'فلل وقصور',
      count: 540,
      share: 38,
      dealsCount: 48,
      dealVolume: '92.4M ر.س',
      avgSaleDays: '18 يوم',
      color: '#0F172A',
      darkColor: '#38BDF8',
      barGradient: 'from-slate-900 to-slate-700 dark:from-slate-100 dark:to-slate-300',
    },
    {
      label: 'شقق سكنية فاخرة',
      shortLabel: 'شقق سكنية',
      count: 398,
      share: 28,
      dealsCount: 52,
      dealVolume: '46.8M ر.س',
      avgSaleDays: '11 يوم',
      color: '#2563EB',
      darkColor: '#60A5FA',
      barGradient: 'from-blue-600 to-indigo-600',
    },
    {
      label: 'أراضي ومخططات تجارية',
      shortLabel: 'أراضي تجارية',
      count: 228,
      share: 16,
      dealsCount: 24,
      dealVolume: '68.0M ر.س',
      avgSaleDays: '32 يوم',
      color: '#D97706',
      darkColor: '#FBBF24',
      barGradient: 'from-amber-500 to-amber-700',
    },
    {
      label: 'منتجعات وشاليهات ومصايف',
      shortLabel: 'مصايف وشاليهات',
      count: 142,
      share: 10,
      dealsCount: 19,
      dealVolume: '34.2M ر.س',
      avgSaleDays: '14 يوم',
      color: '#059669',
      darkColor: '#34D399',
      barGradient: 'from-emerald-500 to-teal-700',
    },
    {
      label: 'عمائر سكنية وتجارية',
      shortLabel: 'عمائر سكنية',
      count: 72,
      share: 5,
      dealsCount: 8,
      dealVolume: '28.5M ر.س',
      avgSaleDays: '45 يوم',
      color: '#7C3AED',
      darkColor: '#A78BFA',
      barGradient: 'from-purple-500 to-purple-800',
    },
    {
      label: 'مزارع واستراحات ريفية',
      shortLabel: 'مزارع واستراحات',
      count: 40,
      share: 3,
      dealsCount: 6,
      dealVolume: '14.8M ر.س',
      avgSaleDays: '22 يوم',
      color: '#E11D48',
      darkColor: '#FB7185',
      barGradient: 'from-rose-500 to-rose-700',
    },
  ], []);

  // Computed Donut SVG segments
  const donutSlices = useMemo(() => {
    const circumference = 2 * Math.PI * 70; // ~439.82297
    let cumulativeOffset = 0;

    return propertyTypesData.map((item) => {
      const strokeDasharray = `${(item.share / 100) * circumference} ${circumference}`;
      const strokeDashoffset = -cumulativeOffset;
      cumulativeOffset += (item.share / 100) * circumference;
      return {
        ...item,
        circumference,
        strokeDasharray,
        strokeDashoffset,
      };
    });
  }, [propertyTypesData]);

  return (
    <div className="space-y-6">
      {/* Section Header with Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 p-5 rounded-2xl bg-surface dark:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border shadow-xs">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-xs font-bold text-accent px-2.5 py-0.5 rounded-full bg-accent/10 border border-accent/20">
            <Zap className="w-3.5 h-3.5" />
            <span>نظام التدفق التشغيلي الشامل (Operational Store Pipeline)</span>
          </div>
          <h2 className="text-lg font-black text-ink-primary dark:text-dark-ink-primary flex items-center gap-2">
            <span>مخطط سير العمليات وإحصائيات متجر المصايف</span>
            <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold">
              تحديث لحظي
            </span>
          </h2>
          <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary">
            متابعة حية لمراحل صفقات المتجر من العرض حتى الإفراغ، مع قياس السيولة النقدية ومعدلات التحويل ونسب الالتزام بالـ SLA.
          </p>
        </div>

        {/* View Switcher & Timeframe Selector */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* View Mode Tabs */}
          <div className="inline-flex items-center p-1 rounded-xl bg-surface-sunken dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('flowchart')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'flowchart'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-ink-secondary hover:text-ink-primary'
              }`}
            >
              <GitBranch className="w-3.5 h-3.5" />
              <span>مخطط التدفق (Flowchart)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('analytics')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'analytics'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-ink-secondary hover:text-ink-primary'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>إحصائيات المتجر</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'all'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-ink-secondary hover:text-ink-primary'
              }`}
            >
              <span>العرض الشامل</span>
            </button>
          </div>

          {/* Timeframe selector */}
          <div className="inline-flex items-center p-1 rounded-xl bg-surface-sunken dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border text-xs font-semibold">
            {(['24h', '7d', '30d', '90d'] as TimeframePeriod[]).map((period) => (
              <button
                key={period}
                type="button"
                onClick={() => setTimeframe(period)}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  timeframe === period
                    ? 'bg-white dark:bg-dark-surface-raised text-primary dark:text-accent font-bold shadow-xs'
                    : 'text-ink-muted hover:text-ink-primary'
                }`}
              >
                {period === '24h' ? 'اليوم' : period === '7d' ? '7 أيام' : period === '30d' ? '30 يوماً' : 'الربع'}
              </button>
            ))}
          </div>

          {/* Refresh Action */}
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              title="تحديث البيانات اللحظية"
              className="p-2 rounded-xl border border-surface-border dark:border-dark-surface-border text-ink-secondary hover:text-ink-primary hover:bg-surface-sunken dark:hover:bg-dark-surface-raised transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-accent' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. INTERACTIVE OPERATIONS FLOWCHART                                       */}
      {/* ========================================================================= */}
      {(activeTab === 'flowchart' || activeTab === 'all') && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-accent" />
              <h3 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary">
                مخطط مسار الصفقات وتدفق المتجر (Transaction Lifecycle Pipeline)
              </h3>
            </div>
            <span className="text-xs text-ink-muted">
              اضغط على أي مرحلة لاستعراض مؤشراتها والانتقال إلى طابورها
            </span>
          </div>

          {/* Horizontal Visual Flowchart Nodes */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3 relative">
            {flowNodes.map((node, index) => {
              const Icon = node.icon;
              const isSelected = selectedNodeId === node.id;

              return (
                <div
                  key={node.id}
                  onClick={() => setSelectedNodeId(node.id)}
                  className={`relative p-4 rounded-2xl cursor-pointer transition-all duration-200 border flex flex-col justify-between group ${
                    isSelected
                      ? 'ring-2 ring-primary dark:ring-accent shadow-md bg-white dark:bg-dark-surface-raised border-primary/40 dark:border-accent/40 scale-[1.02]'
                      : 'bg-surface dark:bg-dark-surface hover:border-accent/50 hover:shadow-xs border-surface-border dark:border-dark-surface-border'
                  }`}
                >
                  {/* Top Step Pill & Status Indicator */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-surface-sunken dark:bg-dark-surface-sunken text-ink-secondary dark:text-dark-ink-secondary">
                      مرحلة {node.stepNumber}
                    </span>
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        node.status === 'healthy'
                          ? 'bg-emerald-500 animate-pulse'
                          : node.status === 'busy'
                          ? 'bg-amber-500'
                          : 'bg-rose-500 animate-ping'
                      }`}
                      title={node.statusText}
                    />
                  </div>

                  {/* Icon & Title */}
                  <div className="space-y-2 mb-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 ${
                        node.colorTheme.bgLight
                      } ${node.colorTheme.bgDark} ${node.colorTheme.textLight}`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-ink-primary dark:text-dark-ink-primary leading-tight">
                        {node.title}
                      </h4>
                      <p className="text-[11px] text-ink-muted dark:text-dark-ink-muted line-clamp-1 mt-0.5">
                        {node.subtitle}
                      </p>
                    </div>
                  </div>

                  {/* Node Metrics & Count */}
                  <div className="pt-2.5 border-t border-surface-border/60 dark:border-dark-surface-border/60 space-y-1">
                    <div className="flex items-baseline justify-between">
                      <span className="text-lg font-black text-ink-primary dark:text-dark-ink-primary tabular-nums">
                        {node.count.toLocaleString('ar-SA')}
                      </span>
                      <span className="text-[10px] text-ink-muted">
                        {node.unit}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-ink-secondary dark:text-dark-ink-secondary">
                      <span>التحويل: <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{node.conversionRate}</strong></span>
                      <span className="font-mono text-ink-muted">{node.slaTarget}</span>
                    </div>
                  </div>

                  {/* Visual connector chevron for desktop layout */}
                  {index < flowNodes.length - 1 && (
                    <div className="hidden xl:flex absolute -left-3 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-surface dark:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border items-center justify-center text-ink-muted pointer-events-none shadow-xs">
                      <ArrowLeft className="w-3 h-3" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Detailed Selected Stage Breakdown Card */}
          {selectedNode && (
            <div className={`p-5 rounded-2xl border transition-all ${selectedNode.colorTheme.bgLight} ${selectedNode.colorTheme.bgDark} ${selectedNode.colorTheme.border}`}>
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="space-y-1.5 max-w-3xl">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${selectedNode.colorTheme.badgeBg}`}>
                      تفاصيل المرحلة {selectedNode.stepNumber} • {selectedNode.title}
                    </span>
                    <span className="text-xs text-ink-secondary dark:text-dark-ink-secondary">
                      الحالة: <strong>{selectedNode.statusText}</strong>
                    </span>
                  </div>
                  <p className="text-xs text-ink-primary dark:text-dark-ink-primary leading-relaxed">
                    {selectedNode.description}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  <div className="flex items-center gap-4 bg-white/70 dark:bg-dark-surface-raised/70 backdrop-blur-sm px-4 py-2 rounded-xl border border-white/50 dark:border-white/10 text-xs">
                    {selectedNode.kpis.map((kpi, kIdx) => (
                      <div key={kIdx} className="text-center">
                        <div className="text-[10px] text-ink-muted dark:text-dark-ink-muted">{kpi.label}</div>
                        <div className="font-bold text-ink-primary dark:text-dark-ink-primary tabular-nums mt-0.5">
                          {kpi.value}
                        </div>
                      </div>
                    ))}
                  </div>

                  <Link
                    href={selectedNode.queueHref}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover shadow-sm transition-colors"
                  >
                    <span>فتح {selectedNode.queueLabel}</span>
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ========================================================================= */}
      {/* 2. STORE ANALYTICS & INTERACTIVE CHARTS                                   */}
      {/* ========================================================================= */}
      {(activeTab === 'analytics' || activeTab === 'all') && (
        <section className="space-y-6">
          {/* Main Chart + Funnel Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Interactive SVG Trend Chart (2 columns) */}
            <div className="lg:col-span-2 p-6 rounded-2xl bg-surface dark:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <h3 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary">
                      مسار السيولة النقدية والصفقات
                    </h3>
                  </div>
                  <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary">
                    حجم التداول العقاري وعمولات المنصة اليومية لفترة ({timeframe === '24h' ? '24 ساعة' : timeframe === '7d' ? '7 أيام' : timeframe === '30d' ? '30 يوماً' : '90 يوماً'})
                  </p>
                </div>

                {/* Metric toggle */}
                <div className="inline-flex items-center p-1 rounded-xl bg-surface-sunken dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setChartMetric('gmv')}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      chartMetric === 'gmv'
                        ? 'bg-white dark:bg-dark-surface-raised text-primary dark:text-accent shadow-xs'
                        : 'text-ink-muted hover:text-ink-primary'
                    }`}
                  >
                    حجم الصفقات (GMV)
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartMetric('revenue')}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      chartMetric === 'revenue'
                        ? 'bg-white dark:bg-dark-surface-raised text-primary dark:text-accent shadow-xs'
                        : 'text-ink-muted hover:text-ink-primary'
                    }`}
                  >
                    إيرادات المنصة (2.5%)
                  </button>
                </div>
              </div>

              {/* Chart Canvas (SVG with gradients) */}
              <div className="relative pt-2">
                <svg
                  viewBox="0 0 600 200"
                  className="w-full h-52 overflow-visible"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient id="chartGradientGmv" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563EB" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#2563EB" stopOpacity="0.0" />
                    </linearGradient>
                    <linearGradient id="chartGradientRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#D97706" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#D97706" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Grid lines */}
                  <line x1="40" y1="20" x2="560" y2="20" stroke="currentColor" strokeOpacity="0.07" strokeDasharray="3 3" />
                  <line x1="40" y1="70" x2="560" y2="70" stroke="currentColor" strokeOpacity="0.07" strokeDasharray="3 3" />
                  <line x1="40" y1="120" x2="560" y2="120" stroke="currentColor" strokeOpacity="0.07" strokeDasharray="3 3" />
                  <line x1="40" y1="170" x2="560" y2="170" stroke="currentColor" strokeOpacity="0.12" />

                  {/* Gradient Area Fill */}
                  {areaD && (
                    <path
                      d={areaD}
                      fill={chartMetric === 'gmv' ? 'url(#chartGradientGmv)' : 'url(#chartGradientRev)'}
                    />
                  )}

                  {/* Main Curve Line */}
                  {pathD && (
                    <path
                      d={pathD}
                      fill="none"
                      stroke={chartMetric === 'gmv' ? '#2563EB' : '#D97706'}
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  )}

                  {/* Interactive Points */}
                  {points.map((pt, i) => {
                    const isHovered = hoveredDataIndex === i;
                    return (
                      <g
                        key={i}
                        onMouseEnter={() => setHoveredDataIndex(i)}
                        onMouseLeave={() => setHoveredDataIndex(null)}
                        className="cursor-pointer"
                      >
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={isHovered ? 6 : 4}
                          className={`transition-all duration-150 ${
                            chartMetric === 'gmv' ? 'fill-blue-600' : 'fill-amber-600'
                          } stroke-white dark:stroke-dark-surface-raised`}
                          strokeWidth="2"
                        />
                        {isHovered && (
                          <circle
                            cx={pt.x}
                            cy={pt.y}
                            r={12}
                            className={chartMetric === 'gmv' ? 'fill-blue-500/20' : 'fill-amber-500/20'}
                          />
                        )}
                      </g>
                    );
                  })}
                </svg>

                {/* X Axis Labels */}
                <div className="flex justify-between px-6 text-[11px] text-ink-muted dark:text-dark-ink-muted font-mono mt-2">
                  {chartDataPoints.map((dp, i) => (
                    <span key={i} className="text-center">{dp.label}</span>
                  ))}
                </div>

                {/* Hover Tooltip display */}
                {hoveredDataIndex !== null && points[hoveredDataIndex] && (
                  <div
                    className="absolute z-20 pointer-events-none -top-2 transform -translate-x-1/2 p-2.5 rounded-xl bg-ink-primary dark:bg-dark-surface-base text-white text-xs shadow-xl border border-white/10"
                    style={{ left: `${(points[hoveredDataIndex].x / 600) * 100}%` }}
                  >
                    <div className="font-bold text-[11px] text-white/70">
                      {points[hoveredDataIndex].original.label}
                    </div>
                    <div className="text-sm font-black text-amber-400 mt-0.5">
                      {points[hoveredDataIndex].val.toLocaleString('ar-SA')} ر.س
                    </div>
                    <div className="text-[10px] text-white/80">
                      {points[hoveredDataIndex].original.deals} صفقات منفذة
                    </div>
                  </div>
                )}
              </div>

              {/* Chart Summary Stats */}
              <div className="grid grid-cols-3 gap-3 pt-3 border-t border-surface-border dark:border-dark-surface-border">
                <div className="p-3 rounded-xl bg-surface-sunken/60 dark:bg-dark-surface-sunken/60">
                  <span className="text-[11px] text-ink-muted block">إجمالي الفترة</span>
                  <span className="text-sm font-bold text-ink-primary dark:text-dark-ink-primary font-mono">
                    {chartDataPoints.reduce((acc, d) => acc + (chartMetric === 'gmv' ? d.gmv : d.revenue), 0).toLocaleString('ar-SA')} ر.س
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-surface-sunken/60 dark:bg-dark-surface-sunken/60">
                  <span className="text-[11px] text-ink-muted block">متوسط العملية</span>
                  <span className="text-sm font-bold text-ink-primary dark:text-dark-ink-primary font-mono">
                    {(
                      chartDataPoints.reduce((acc, d) => acc + (chartMetric === 'gmv' ? d.gmv : d.revenue), 0) /
                      (chartDataPoints.reduce((acc, d) => acc + d.deals, 0) || 1)
                    ).toLocaleString('ar-SA', { maximumFractionDigits: 0 })}{' '}
                    ر.س
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-surface-sunken/60 dark:bg-dark-surface-sunken/60">
                  <span className="text-[11px] text-ink-muted block">معدل النمو</span>
                  <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                    +18.4% ↑
                  </span>
                </div>
              </div>
            </div>

            {/* Marketplace Conversion Funnel (1 column) */}
            <div className="p-6 rounded-2xl bg-surface dark:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border space-y-4 flex flex-col justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-accent" />
                  <h3 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary">
                    قمع التحويل والعمليات
                  </h3>
                </div>
                <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary">
                  معدل انتقال المستخدمين والطلبات عبر مراحل المتجر
                </p>
              </div>

              {/* Funnel progress bars */}
              <div className="space-y-3.5">
                {funnelStages.map((stage, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-ink-primary dark:text-dark-ink-primary text-[11px]">
                        {stage.name}
                      </span>
                      <span className="font-mono text-ink-muted text-[10px]">
                        {stage.count.toLocaleString('ar-SA')} ({stage.percent}%)
                      </span>
                    </div>
                    <div className="h-2 w-full bg-surface-sunken dark:bg-dark-surface-sunken rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${stage.color}`}
                        style={{ width: `${stage.percent}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Funnel Highlights */}
              <div className="p-3 rounded-xl bg-accent/10 border border-accent/20 text-xs space-y-1 text-ink-primary dark:text-dark-ink-primary">
                <div className="flex items-center justify-between font-bold text-accent">
                  <span>معدل إغلاق الصفقات الناجحة</span>
                  <span className="font-mono">24.2%</span>
                </div>
                <p className="text-[10px] text-ink-muted leading-relaxed">
                  يفوق هذا المعدل المتوسط العقاري بنسبة +4.6% بفضل آليات وساطة العروض البديلة والتحقق الإداري الفوري.
                </p>
              </div>
            </div>
          </div>

          {/* Regional & Property Category Distribution Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Regional breakdown - Vertical Column Chart (المدينة من تحت ووصلت لكذا) */}
            <div className="p-6 rounded-2xl bg-surface dark:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-accent" />
                    <h4 className="text-sm font-bold text-ink-primary dark:text-dark-ink-primary">
                      التوزيع الجغرافي وحجم الصفقات بالمدن
                    </h4>
                  </div>
                  <p className="text-[11px] text-ink-muted">
                    المملكة العربية السعودية • ارتفاع العمود يوضح حجم الصفقات لكل مدينة
                  </p>
                </div>

                {/* Metric switch */}
                <div className="inline-flex items-center p-1 rounded-xl bg-surface-sunken dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setCityChartMetric('volume')}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      cityChartMetric === 'volume'
                        ? 'bg-white dark:bg-dark-surface-raised text-primary dark:text-accent shadow-xs'
                        : 'text-ink-muted hover:text-ink-primary'
                    }`}
                  >
                    حجم الصفقات (م.ر.س)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCityChartMetric('share')}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      cityChartMetric === 'share'
                        ? 'bg-white dark:bg-dark-surface-raised text-primary dark:text-accent shadow-xs'
                        : 'text-ink-muted hover:text-ink-primary'
                    }`}
                  >
                    حصة السوق (%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCityChartMetric('deals')}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      cityChartMetric === 'deals'
                        ? 'bg-white dark:bg-dark-surface-raised text-primary dark:text-accent shadow-xs'
                        : 'text-ink-muted hover:text-ink-primary'
                    }`}
                  >
                    عدد الصفقات
                  </button>
                </div>
              </div>

              {/* Vertical Column Chart Canvas */}
              <div className="relative pt-6 pb-2">
                {/* Horizontal Guide Lines with Y-Axis Ticks */}
                <div className="absolute inset-x-0 top-6 bottom-16 flex flex-col justify-between pointer-events-none opacity-40">
                  {[100, 75, 50, 25, 0].map((level, idx) => {
                    const label =
                      cityChartMetric === 'volume'
                        ? `${(200 * (level / 100)).toFixed(0)}M`
                        : cityChartMetric === 'share'
                        ? `${(50 * (level / 100)).toFixed(0)}%`
                        : `${(700 * (level / 100)).toFixed(0)}`;
                    return (
                      <div key={idx} className="flex items-center gap-2 w-full">
                        <span className="text-[10px] font-mono text-ink-muted w-9 text-start">
                          {label}
                        </span>
                        <div className="flex-1 border-b border-dashed border-surface-border dark:border-dark-surface-border" />
                      </div>
                    );
                  })}
                </div>

                {/* Columns Grid - Bars rising upwards */}
                <div className="grid grid-cols-4 gap-2 sm:gap-4 h-56 pt-2 pb-0 ps-10 pe-2 items-end relative z-10">
                  {regionalData.map((reg, rIdx) => {
                    const max =
                      cityChartMetric === 'volume' ? 200 : cityChartMetric === 'share' ? 50 : 700;
                    const val =
                      cityChartMetric === 'volume'
                        ? reg.volumeRaw
                        : cityChartMetric === 'share'
                        ? reg.share
                        : reg.dealsRaw;
                    const heightPercent = Math.min(Math.max((val / max) * 100, 12), 100);
                    const isHovered = hoveredCityIndex === rIdx;

                    const displayValue =
                      cityChartMetric === 'volume'
                        ? `${reg.volumeRaw}M ر.س`
                        : cityChartMetric === 'share'
                        ? `${reg.share}%`
                        : `${reg.dealsRaw} صفقة`;

                    return (
                      <div
                        key={rIdx}
                        onMouseEnter={() => setHoveredCityIndex(rIdx)}
                        onMouseLeave={() => setHoveredCityIndex(null)}
                        className="flex flex-col items-center h-full justify-end group cursor-pointer relative"
                      >
                        {/* Floating Value Tag on Top of Bar */}
                        <div
                          className={`mb-2 px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold whitespace-nowrap transition-all duration-200 shadow-xs ${
                            isHovered
                              ? 'bg-ink-primary dark:bg-white text-white dark:text-ink-primary scale-110 -translate-y-1 z-30'
                              : 'bg-surface dark:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border text-ink-primary dark:text-dark-ink-primary'
                          }`}
                        >
                          {displayValue}
                        </div>

                        {/* Vertical Bar (وصلت لكذا) */}
                        <div className="w-full max-w-[56px] bg-surface-sunken/40 dark:bg-dark-surface-sunken/40 rounded-t-xl h-full flex items-end p-1 transition-colors group-hover:bg-accent/5">
                          <div
                            style={{ height: `${heightPercent}%` }}
                            className={`w-full rounded-t-lg bg-gradient-to-t ${reg.gradient} transition-all duration-500 shadow-sm relative overflow-hidden group-hover:brightness-110 group-hover:shadow-md ${
                              isHovered ? 'ring-2 ring-accent ring-offset-1 dark:ring-offset-dark-surface-raised' : ''
                            }`}
                          >
                            {/* Inner subtle glow line */}
                            <div className="absolute inset-x-0 top-0 h-1 bg-white/40" />
                          </div>
                        </div>

                        {/* Interactive Tooltip Card */}
                        {isHovered && (
                          <div className="absolute bottom-full mb-8 z-40 w-44 p-3 rounded-xl bg-ink-primary dark:bg-dark-surface-base text-white text-xs shadow-xl border border-white/10 pointer-events-none transform -translate-x-1/2 start-1/2">
                            <div className="font-bold text-white border-b border-white/15 pb-1 mb-1.5 flex items-center justify-between">
                              <span>{reg.shortName}</span>
                              <span className="text-emerald-400 text-[10px] font-mono">{reg.trend}</span>
                            </div>
                            <div className="space-y-1 text-[11px] text-white/80">
                              <div className="flex justify-between">
                                <span>حجم الصفقات:</span>
                                <strong className="text-amber-400 font-mono">{reg.volume}</strong>
                              </div>
                              <div className="flex justify-between">
                                <span>عدد الصفقات:</span>
                                <strong className="font-mono">{reg.count}</strong>
                              </div>
                              <div className="flex justify-between">
                                <span>حصة السوق:</span>
                                <strong className="font-mono">{reg.share}%</strong>
                              </div>
                              <div className="flex justify-between">
                                <span>متوسط الصفقة:</span>
                                <strong className="font-mono">{reg.avgDeal}</strong>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* City Labels at the Bottom (المدينة من تحت) */}
                <div className="grid grid-cols-4 gap-2 sm:gap-4 ps-10 pe-2 pt-3 border-t border-surface-border dark:border-dark-surface-border text-center">
                  {regionalData.map((reg, rIdx) => (
                    <div key={rIdx} className="space-y-0.5">
                      <div className="text-xs font-bold text-ink-primary dark:text-dark-ink-primary leading-tight">
                        {reg.city}
                      </div>
                      <div className="flex items-center justify-center gap-1 text-[10px] text-ink-muted">
                        <span>{reg.count}</span>
                        <span>•</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold font-mono">
                          {reg.trend}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Operational Regional Summary Badges */}
              <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
                <div className="p-2.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/50 dark:border-blue-800/40 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-700 dark:text-blue-300 flex items-center justify-center text-xs font-bold">
                    🏆
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] text-ink-muted">المدينة الأعلى تداولاً</div>
                    <div className="font-bold text-ink-primary dark:text-dark-ink-primary truncate">
                      الرياض (184.2M ر.س)
                    </div>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200/50 dark:border-purple-800/40 flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-purple-500/20 text-purple-700 dark:text-purple-300 flex items-center justify-center text-xs font-bold">
                    ⚡
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] text-ink-muted">الأسرع نمواً وإقبالاً</div>
                    <div className="font-bold text-ink-primary dark:text-dark-ink-primary truncate">
                      مناطق المصايف (+28%)
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Property Types Breakdown - Interactive Donut & Comparative Matrix */}
            <div className="p-6 rounded-2xl bg-surface dark:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border space-y-4 flex flex-col justify-between">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-accent" />
                    <h4 className="text-sm font-bold text-ink-primary dark:text-dark-ink-primary">
                      توزيع المعروض والصفقات حسب تصنيف العقار
                    </h4>
                  </div>
                  <p className="text-[11px] text-ink-muted">
                    معدلات المعروض وحجم الصفقات وسرعة دوران البيع عبر الفئات
                  </p>
                </div>

                {/* View Mode Switcher */}
                <div className="inline-flex items-center p-1 rounded-xl bg-surface-sunken dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setPropertyViewMode('donut')}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      propertyViewMode === 'donut'
                        ? 'bg-white dark:bg-dark-surface-raised text-primary dark:text-accent shadow-xs'
                        : 'text-ink-muted hover:text-ink-primary'
                    }`}
                  >
                    رسم بياني دائري (Donut)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPropertyViewMode('compare')}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      propertyViewMode === 'compare'
                        ? 'bg-white dark:bg-dark-surface-raised text-primary dark:text-accent shadow-xs'
                        : 'text-ink-muted hover:text-ink-primary'
                    }`}
                  >
                    مقارنة الصفقات والسرعة
                  </button>
                </div>
              </div>

              {/* View 1: Interactive Donut Chart */}
              {propertyViewMode === 'donut' ? (
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center pt-2">
                  {/* SVG Donut Ring */}
                  <div className="sm:col-span-5 flex justify-center relative">
                    <div className="relative w-44 h-44">
                      <svg
                        viewBox="0 0 200 200"
                        className="w-full h-full transform -rotate-90 overflow-visible"
                      >
                        {/* Background Ring Track */}
                        <circle
                          cx="100"
                          cy="100"
                          r="70"
                          fill="transparent"
                          stroke="currentColor"
                          strokeWidth="20"
                          className="text-surface-sunken dark:text-dark-surface-sunken"
                        />

                        {/* Animated Segments */}
                        {donutSlices.map((slice, sIdx) => {
                          const isHovered = hoveredPropertyTypeIndex === sIdx;
                          return (
                            <circle
                              key={sIdx}
                              cx="100"
                              cy="100"
                              r="70"
                              fill="transparent"
                              stroke={slice.color}
                              strokeWidth={isHovered ? 26 : 20}
                              strokeDasharray={slice.strokeDasharray}
                              strokeDashoffset={slice.strokeDashoffset}
                              onMouseEnter={() => setHoveredPropertyTypeIndex(sIdx)}
                              onMouseLeave={() => setHoveredPropertyTypeIndex(null)}
                              className="cursor-pointer transition-all duration-200 hover:opacity-90"
                            />
                          );
                        })}
                      </svg>

                      {/* Donut Center Display */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center p-2">
                        {hoveredPropertyTypeIndex !== null && propertyTypesData[hoveredPropertyTypeIndex] ? (
                          <>
                            <span className="text-[10px] font-bold text-ink-muted truncate max-w-[100px]">
                              {propertyTypesData[hoveredPropertyTypeIndex].shortLabel}
                            </span>
                            <span className="text-xl font-black text-ink-primary dark:text-dark-ink-primary tabular-nums mt-0.5">
                              {propertyTypesData[hoveredPropertyTypeIndex].share}%
                            </span>
                            <span className="text-[10px] text-accent font-semibold font-mono">
                              {propertyTypesData[hoveredPropertyTypeIndex].count} عقار
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-[10px] font-bold text-ink-muted">إجمالي المعروض</span>
                            <span className="text-lg font-black text-ink-primary dark:text-dark-ink-primary tabular-nums mt-0.5">
                              1,420
                            </span>
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold font-mono">
                              157 صفقة منجزة
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Donut Legend List */}
                  <div className="sm:col-span-7 grid grid-cols-1 gap-1.5">
                    {propertyTypesData.map((item, i) => {
                      const isHovered = hoveredPropertyTypeIndex === i;
                      return (
                        <div
                          key={i}
                          onMouseEnter={() => setHoveredPropertyTypeIndex(i)}
                          onMouseLeave={() => setHoveredPropertyTypeIndex(null)}
                          className={`flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer ${
                            isHovered
                              ? 'bg-surface-sunken dark:bg-dark-surface-sunken border-accent shadow-xs scale-[1.01]'
                              : 'border-transparent hover:bg-surface-sunken/40 dark:hover:bg-dark-surface-sunken/40'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: item.color }}
                            />
                            <span className="text-xs font-bold text-ink-primary dark:text-dark-ink-primary truncate">
                              {item.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 text-[11px] font-mono">
                            <span className="text-ink-muted">{item.count} عقار</span>
                            <span className="font-bold text-ink-primary dark:text-dark-ink-primary px-1.5 py-0.5 rounded-md bg-surface-sunken dark:bg-dark-surface-raised">
                              {item.share}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* View 2: Comparative Breakdown & Deal Velocity */
                <div className="space-y-3 pt-1">
                  {propertyTypesData.map((item, i) => (
                    <div
                      key={i}
                      className="p-2.5 rounded-xl bg-surface-sunken/50 dark:bg-dark-surface-sunken/50 border border-surface-border/50 dark:border-dark-surface-border/50 space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="text-ink-primary dark:text-dark-ink-primary font-bold">
                            {item.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-ink-muted font-mono">
                            حصة: {item.share}%
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                            سرعة البيع: {item.avgSaleDays}
                          </span>
                        </div>
                      </div>

                      {/* Dual Progress Comparison Bar */}
                      <div className="grid grid-cols-2 gap-2 text-[10px] text-ink-muted">
                        <div>
                          <div className="flex justify-between mb-0.5">
                            <span>المعروض المتاح:</span>
                            <strong className="text-ink-primary dark:text-dark-ink-primary font-mono">{item.count} عقار</strong>
                          </div>
                          <div className="h-1.5 w-full bg-surface-border/60 dark:bg-dark-surface-border/60 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-600 rounded-full"
                              style={{ width: `${(item.count / 540) * 100}%` }}
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between mb-0.5">
                            <span>الصفقات المنجزة:</span>
                            <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{item.dealsCount} صفقة ({item.dealVolume})</strong>
                          </div>
                          <div className="h-1.5 w-full bg-surface-border/60 dark:bg-dark-surface-border/60 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full"
                              style={{ width: `${(item.dealsCount / 52) * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Operational Strategic Insight */}
              <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/50 dark:border-blue-800/40 text-xs text-blue-900 dark:text-blue-200 flex items-center gap-2.5">
                <span className="text-base shrink-0">💡</span>
                <p className="text-[11px] leading-relaxed">
                  <strong>مؤشر سيولة المتجر:</strong> تسجل <strong>الشقق السكنية</strong> أسرع معدل إغلاق صفقات (11 يوماً)، بينما تحقق <strong>الفلل والمصايف</strong> أعلى حجم سيولة متداولة (92.4M ر.س) بمتوسط بيع 18 يوماً.
                </p>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
