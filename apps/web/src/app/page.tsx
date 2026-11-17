'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  Building2,
  MapPin,
  Search,
  CheckCircle2,
  FileCheck,
  Banknote,
  Lock,
  Sparkles,
  ChevronLeft,
  RotateCcw,
  SlidersHorizontal,
  ArrowRight,
  Calculator,
  Award,
  Zap,
  TrendingUp,
  FileText,
  HelpCircle,
  PhoneCall,
  Check,
} from 'lucide-react';
import { LayoutShell } from '../components/layout';
import { Button, Badge, Card, EmptyState } from '../components/ui';
import { PropertyCard } from '../components/listings';
import {
  UserRole,
  PropertyType,
  ListingStatus,
  ListingSummaryItem,
} from '@elmasaif/shared';
import { apiClient } from '../lib/api-client';

const FEATURED_SHOWCASE_LISTINGS: ListingSummaryItem[] = [
  {
    id: '88888888-0000-4000-8000-000000000001',
    title: 'فيلا مودرن مع مسبح خاص في النرجس',
    propertyType: PropertyType.VILLA,
    cityId: '11111111-0000-4000-8000-000000000001',
    districtId: '22222222-0001-4000-8000-000000000002',
    cityName: 'الرياض',
    districtName: 'النرجس',
    askPrice: 3200000,
    areaSquareMeters: 450,
    bedrooms: 5,
    yearBuilt: 2024,
    status: ListingStatus.ACTIVE,
    sellerRole: UserRole.MARKETER,
    isFalVerified: true,
    photoCount: 12,
    photos: [],
    createdAt: '2026-11-01T10:00:00.000Z',
  },
  {
    id: '57206afe-e915-4c10-bd47-b033c892017a',
    title: 'فيلا سكنية فاخرة في المدينة المنورة',
    propertyType: PropertyType.VILLA,
    cityId: '11111111-0000-4000-8000-000000000005',
    districtId: '22222222-0005-4000-8000-000000000005',
    cityName: 'المدينة المنورة',
    districtName: 'الحرم',
    askPrice: 3000000,
    areaSquareMeters: 250,
    bedrooms: 10,
    yearBuilt: 2020,
    status: ListingStatus.ACTIVE,
    sellerRole: UserRole.OWNER,
    isFalVerified: false,
    photoCount: 4,
    photos: [
      'http://localhost:4000/api/v1/storage/raw?key=listings%2Fa3121057-21ca-4534-8599-89c004694850%2F00b1f5a7-890a-4f29-98cd-3c976a820b56-d40439a3-c226-4d9c-bab1-daa55de6ba67-1777546365210_j9xjc.png',
    ],
    primaryPhotoUrl: 'http://localhost:4000/api/v1/storage/raw?key=listings%2Fa3121057-21ca-4534-8599-89c004694850%2F00b1f5a7-890a-4f29-98cd-3c976a820b56-d40439a3-c226-4d9c-bab1-daa55de6ba67-1777546365210_j9xjc.png',
    createdAt: '2026-11-01T10:00:00.000Z',
  },
  {
    id: 'f814c417-ab37-4cdc-962d-b51f82b242cc',
    title: 'فيلا تجارية واستثمارية في حي الزهور',
    propertyType: PropertyType.VILLA,
    cityId: '11111111-0000-4000-8000-000000000003',
    districtId: '22222222-0003-4000-8000-000000000005',
    cityName: 'الدمام',
    districtName: 'الزهور',
    askPrice: 2850000,
    areaSquareMeters: 400,
    bedrooms: 6,
    yearBuilt: 2023,
    status: ListingStatus.ACTIVE,
    sellerRole: UserRole.MARKETER,
    isFalVerified: true,
    photoCount: 6,
    photos: [
      'http://localhost:4000/api/v1/storage/raw?key=listings%2Ffde2ed3f-ffc6-4b93-86db-45666e240682%2F34991582-386f-4102-a30c-9e225872a99b-dd1b925d-3775-4e28-a3ec-a80e06128a23-8065d83b935b20576cf696d618179f7e5a5bc333.jpg',
    ],
    primaryPhotoUrl: 'http://localhost:4000/api/v1/storage/raw?key=listings%2Ffde2ed3f-ffc6-4b93-86db-45666e240682%2F34991582-386f-4102-a30c-9e225872a99b-dd1b925d-3775-4e28-a3ec-a80e06128a23-8065d83b935b20576cf696d618179f7e5a5bc333.jpg',
    createdAt: '2026-11-01T10:00:00.000Z',
  },
];

export default function HomePage() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState(0);
  const [showEmptyStateDemo, setShowEmptyStateDemo] = useState(false);
  const [liveListings, setLiveListings] = useState<ListingSummaryItem[]>([]);
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [selectedPropertyType, setSelectedPropertyType] = useState<string>('');
  const [selectedPriceMax, setSelectedPriceMax] = useState<string>('');

  // Quick commission calculator mini-state
  const [calcAmount, setCalcAmount] = useState<number>(2000000);

  const calcResults = useMemo(() => {
    const commission = calcAmount * 0.025;
    const vat = commission * 0.15;
    const totalBuyerCost = calcAmount + commission + vat;
    return {
      commission,
      vat,
      totalCommissionWithVat: commission + vat,
      totalBuyerCost,
    };
  }, [calcAmount]);

  useEffect(() => {
    apiClient
      .get<{ statusCode: number; data: { items: ListingSummaryItem[] } }>('/listings?limit=12')
      .then((res) => {
        if (res?.data?.items && res.data.items.length > 0) {
          setLiveListings(res.data.items);
        }
      })
      .catch(() => {});
  }, []);

  const categories = [
    { label: 'كافة العقارات', type: '' },
    { label: 'فلل وقصور', type: PropertyType.VILLA },
    { label: 'أراضي استثمارية', type: PropertyType.LAND },
    { label: 'شقق تمليك', type: PropertyType.APARTMENT },
    { label: 'عمائر سكنية', type: PropertyType.BUILDING },
    { label: 'عقارات تجارية', type: PropertyType.COMMERCIAL },
  ];

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (selectedCity) params.set('cityId', selectedCity);
    const type = selectedPropertyType || categories[selectedCategory]?.type;
    if (type) params.set('propertyType', type);
    if (selectedPriceMax) params.set('priceMax', selectedPriceMax);
    router.push(`/properties?${params.toString()}`);
  };

  return (
    <LayoutShell>
      {/* Hero Section with Ambient Glow */}
      <section className="relative pt-6 pb-12 sm:pt-12 sm:pb-16 text-center">
        {/* Ambient Radial Background Glow */}
        <div className="absolute inset-0 -top-24 -z-10 bg-ambient-radial opacity-70 pointer-events-none" />

        <div className="max-w-4xl mx-auto px-4">
          {/* Institutional Trust Live Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent-light dark:bg-accent/15 border border-accent/30 text-accent-dark dark:text-accent text-xs sm:text-sm font-semibold shadow-sm mb-6">
            <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
            <ShieldCheck className="w-4 h-4 shrink-0 text-accent" />
            <span>نظام وساطة رقمي متكامل وفق أنظمة الهيئة العامة للعقار (REGA)</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-ink-primary dark:text-dark-ink-primary leading-[1.2] sm:leading-[1.15] tracking-tight">
            السوق العقاري المؤسسي الأوثق <br className="hidden sm:inline" />
            <span className="bg-gradient-to-l from-primary via-primary-dark to-accent bg-clip-text text-transparent">
              لصفقات البيع والاستثمار الكبرى
            </span>
          </h1>

          <p className="mt-5 text-sm sm:text-lg text-ink-secondary dark:text-dark-ink-secondary leading-relaxed max-w-2xl mx-auto">
            منظومة بيع وتفاوض محكومة تحمي حقوق المشتري والمالك والمسوّق المرخص. عقود وساطة نظامية، تدقيق صكوك فوري، وتحويلات بنكية مباشرة بدون احتجاز أموال.
          </p>
        </div>

        {/* Main Search Panel with Glassmorphism */}
        <div className="mt-8 sm:mt-12 max-w-4xl mx-auto glass-panel rounded-2xl shadow-level3 p-4 sm:p-6 text-start luxury-card">
          {/* Category Tabs */}
          <div className="flex items-center gap-2 border-b border-surface-border dark:border-dark-surface-border pb-4 mb-5 overflow-x-auto scrollbar-none">
            {categories.map((cat, idx) => (
              <button
                key={cat.label}
                type="button"
                onClick={() => {
                  setSelectedCategory(idx);
                  setSelectedPropertyType(cat.type);
                }}
                className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                  selectedCategory === idx
                    ? 'bg-primary text-white shadow-md'
                    : 'text-ink-secondary dark:text-dark-ink-secondary hover:bg-surface-sunken dark:hover:bg-dark-surface-raised'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Search Inputs Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-ink-secondary dark:text-dark-ink-secondary flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-primary dark:text-primary-light" />
                المدينة أو المنطقة
              </label>
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="w-full bg-surface-sunken dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border rounded-lg px-3 py-2.5 text-sm text-ink-primary dark:text-dark-ink-primary focus:outline-none focus:ring-2 focus:ring-primary/25 font-medium"
              >
                <option value="">كافة مدن المملكة</option>
                <option value="city-riyadh">الرياض (العاصمة)</option>
                <option value="city-jeddah">جدة (عروس البحر)</option>
                <option value="city-khobar">الخبر والدمام</option>
                <option value="city-makkah">مكة المكرمة</option>
                <option value="city-madinah">المدينة المنورة</option>
                <option value="city-taif">الطائف</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-ink-secondary dark:text-dark-ink-secondary flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-primary dark:text-primary-light" />
                نوع العقار
              </label>
              <select
                value={selectedPropertyType}
                onChange={(e) => setSelectedPropertyType(e.target.value)}
                className="w-full bg-surface-sunken dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border rounded-lg px-3 py-2.5 text-sm text-ink-primary dark:text-dark-ink-primary focus:outline-none focus:ring-2 focus:ring-primary/25 font-medium"
              >
                <option value="">كافة أنواع العقارات</option>
                <option value="VILLA">فيلا سكنية فاخرة</option>
                <option value="LAND">قطعة أرض تجارية/سكنية</option>
                <option value="APARTMENT">شقة تمليك مودرن</option>
                <option value="BUILDING">عمارة سكنية استثمارية</option>
                <option value="COMMERCIAL">مكتب أو معرض تجاري</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-ink-secondary dark:text-dark-ink-secondary flex items-center gap-1.5">
                <Banknote className="w-3.5 h-3.5 text-primary dark:text-primary-light" />
                الحد الأقصى للميزانية
              </label>
              <select
                value={selectedPriceMax}
                onChange={(e) => setSelectedPriceMax(e.target.value)}
                className="w-full bg-surface-sunken dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border rounded-lg px-3 py-2.5 text-sm text-ink-primary dark:text-dark-ink-primary focus:outline-none focus:ring-2 focus:ring-primary/25 font-medium"
              >
                <option value="">أي ميزانية</option>
                <option value="1500000">حتى 1.5 مليون ر.س</option>
                <option value="3000000">حتى 3.0 مليون ر.س</option>
                <option value="6000000">حتى 6.0 مليون ر.س</option>
                <option value="12000000">حتى 12.0 مليون ر.س</option>
              </select>
            </div>

            <div className="flex items-end">
              <Button
                variant="primary"
                size="md"
                className="w-full py-3 font-bold shadow-md sheen-effect flex items-center justify-center gap-2 text-sm"
                onClick={handleSearch}
              >
                <Search className="w-4 h-4" />
                <span>بحث في العقارات الموثقة</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Platform Key Institutional Metrics Bar */}
        <div className="mt-10 max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 px-2">
          <div className="p-4 rounded-xl bg-surface-base dark:bg-dark-surface-base border border-surface-border dark:border-dark-surface-border shadow-sm flex flex-col items-center text-center">
            <span className="text-2xl sm:text-3xl font-extrabold text-primary dark:text-primary-light font-bold" dir="ltr">
              100%
            </span>
            <span className="text-xs font-semibold text-ink-secondary dark:text-dark-ink-secondary mt-1">
              امتثال كامل للائحة فال
            </span>
          </div>

          <div className="p-4 rounded-xl bg-surface-base dark:bg-dark-surface-base border border-surface-border dark:border-dark-surface-border shadow-sm flex flex-col items-center text-center">
            <span className="text-2xl sm:text-3xl font-extrabold text-accent-dark font-bold" dir="ltr">
              +14,500
            </span>
            <span className="text-xs font-semibold text-ink-secondary dark:text-dark-ink-secondary mt-1">
              صك وعقد وساطة مدقق
            </span>
          </div>

          <div className="p-4 rounded-xl bg-surface-base dark:bg-dark-surface-base border border-surface-border dark:border-dark-surface-border shadow-sm flex flex-col items-center text-center">
            <div className="flex items-baseline gap-1 text-2xl sm:text-3xl font-extrabold text-accent-dark dark:text-accent font-bold" dir="ltr">
              <span>0</span>
              <span className="text-sm font-sans font-semibold">ر.س</span>
            </div>
            <span className="text-xs font-semibold text-ink-secondary dark:text-dark-ink-secondary mt-1">
              أموال محتجزة (تحويل بنكي مباشر)
            </span>
          </div>

          <div className="p-4 rounded-xl bg-surface-base dark:bg-dark-surface-base border border-surface-border dark:border-dark-surface-border shadow-sm flex flex-col items-center text-center">
            <span className="text-2xl sm:text-3xl font-extrabold text-ink-primary dark:text-dark-ink-primary font-bold" dir="ltr">
              +50
            </span>
            <span className="text-xs font-semibold text-ink-secondary dark:text-dark-ink-secondary mt-1">
              مدينة ومحافظة في المملكة
            </span>
          </div>
        </div>

        {/* 3 Core Pillars */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto text-start px-2">
          <div className="p-6 rounded-2xl bg-surface-base dark:bg-dark-surface-base border border-surface-border dark:border-dark-surface-border shadow-sm luxury-card">
            <div className="w-12 h-12 rounded-xl bg-accent-light dark:bg-accent/20 border border-accent/30 text-accent-dark dark:text-accent flex items-center justify-center mb-4">
              <FileCheck className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary">
              رخص فال وصكوك موثقة
            </h3>
            <p className="text-xs sm:text-sm text-ink-secondary dark:text-dark-ink-secondary mt-2 leading-relaxed">
              حظر السماسرة غير المرخصين وحصر التسويق على رخص الهيئة العامة للعقار مع التحقق الآلي الفوري من صحة الصكوك العقارية.
            </p>
            <div className="mt-4 pt-3 border-t border-surface-border dark:border-dark-surface-border">
              <Link href="/pages/rega-licenses" className="text-xs font-bold text-primary dark:text-primary-light flex items-center gap-1 hover:underline">
                <span>تعرف على معايير التحقق</span>
                <ChevronLeft className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-surface-base dark:bg-dark-surface-base border border-surface-border dark:border-dark-surface-border shadow-sm luxury-card">
            <div className="w-12 h-12 rounded-xl bg-accent-light border border-accent/20 text-accent-dark flex items-center justify-center mb-4">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary">
              قناة تفاوض ووساطة محمية
            </h3>
            <p className="text-xs sm:text-sm text-ink-secondary dark:text-dark-ink-secondary mt-2 leading-relaxed">
              حجب أرقام الاتصال الشخصية وعناوين الصكوك لمنع التخطي والصيد العشوائي، مع حفظ كامل حقوق السعي للمسوّق والمالك.
            </p>
            <div className="mt-4 pt-3 border-t border-surface-border dark:border-dark-surface-border">
              <Link href="/pages/brokerage-contracts" className="text-xs font-bold text-accent-dark flex items-center gap-1 hover:underline">
                <span>ضمانات حماية الوسيط والمالك</span>
                <ChevronLeft className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-surface-base dark:bg-dark-surface-base border border-surface-border dark:border-dark-surface-border shadow-sm luxury-card">
            <div className="w-12 h-12 rounded-xl bg-primary-light border border-primary/20 text-primary dark:text-primary-light flex items-center justify-center mb-4">
              <Banknote className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary">
              تحويل بنكي مباشر 100%
            </h3>
            <p className="text-xs sm:text-sm text-ink-secondary dark:text-dark-ink-secondary mt-2 leading-relaxed">
              ثمن العقار يحوّل مباشرة من الحساب البنكي للمشتري إلى حساب البائع دون احتجاز الملايين في وسيط رقمي، لامتثال مالي تام.
            </p>
            <div className="mt-4 pt-3 border-t border-surface-border dark:border-dark-surface-border">
              <Link href="/pages/buyer-guide" className="text-xs font-bold text-primary dark:text-primary-light flex items-center gap-1 hover:underline">
                <span>دليل إجراءات التحويل البنكي</span>
                <ChevronLeft className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Verified Listings */}
      <section id="listings" className="py-12 border-t border-surface-border dark:border-dark-surface-border">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 text-primary dark:text-primary-light text-sm font-bold mb-2">
              <Sparkles className="w-4 h-4 text-accent" />
              <span>عقارات مميزة ومدققة نظامياً</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-ink-primary dark:text-dark-ink-primary">
              أحدث صفقات البيع المتاحة حالياً
            </h2>
            <p className="text-xs sm:text-sm text-ink-secondary dark:text-dark-ink-secondary mt-1">
              عقارات تم التحقق من صكوكها ورخص تسويقها بموجب عقود وساطة سارية
            </p>
          </div>
          <Link
            href="/properties"
            className="text-sm font-bold text-primary dark:text-primary-light hover:underline flex items-center gap-1.5 self-start sm:self-auto group"
          >
            <span>استعراض كافة العقارات ({liveListings.length > 0 ? liveListings.length : FEATURED_SHOWCASE_LISTINGS.length})</span>
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          {(liveListings.length > 0 ? liveListings.slice(0, 6) : FEATURED_SHOWCASE_LISTINGS).map((item) => (
            <PropertyCard
              key={item.id}
              listing={item}
              href={`/properties/${item.id}`}
              actionLabel="استعراض العقار والتفاصيل"
            />
          ))}
        </div>
      </section>

      {/* Visual Pipeline: Dual Wire Transfer Architecture */}
      <section className="py-12 border-t border-surface-border dark:border-dark-surface-border">
        <div className="bg-surface-base dark:bg-dark-surface-base rounded-3xl border border-surface-border dark:border-dark-surface-border p-6 sm:p-10 shadow-level2">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-bold text-primary dark:text-primary-light bg-primary-light dark:bg-primary-dark/30 px-3.5 py-1 rounded-full border border-primary/20">
              هندسة الأمان المالي والسيادي
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-ink-primary dark:text-dark-ink-primary mt-3">
              نموذج التحويل البنكي المزدوج (Dual Wire Transfer)
            </h2>
            <p className="text-xs sm:text-sm text-ink-secondary dark:text-dark-ink-secondary mt-2 leading-relaxed">
              امتثالاً للأنظمة المالية الصادرة عن البنك المركزي وهيئة العقار، تتم التسوية مباشرة عبر القنوات البنكية الرسمية في مسارين منفصلين:
            </p>
          </div>

          {/* Interactive Steps Pipeline */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
            {/* Step 1 */}
            <div className="p-5 rounded-2xl border border-surface-border dark:border-dark-surface-border bg-surface-sunken dark:bg-dark-surface-sunken flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-3.5">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full bg-primary text-white text-sm font-extrabold flex items-center justify-center shrink-0 shadow-sm leading-none">
                      1
                    </span>
                    <span className="text-xs font-bold text-ink-primary dark:text-dark-ink-primary">
                      الخطوة 1
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-ink-secondary dark:text-dark-ink-secondary bg-surface-base dark:bg-dark-surface-base px-2.5 py-1 rounded-full border border-surface-border dark:border-dark-surface-border">
                    المفاوضة
                  </span>
                </div>
                <h4 className="text-sm font-bold text-ink-primary dark:text-dark-ink-primary">
                  قبول العرض الإلكتروني
                </h4>
                <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary mt-1.5 leading-relaxed">
                  اتفاق المشتري والبائع على السعر والشروط وتوثيق الصفقة برقم مرجعي ملزم.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-surface-border dark:border-dark-surface-border text-[11px] text-primary dark:text-primary-light font-semibold flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                <span>حظر التراجع غير المبرر</span>
              </div>
            </div>

            {/* Step 2 */}
            <div className="p-5 rounded-2xl border border-primary/30 bg-primary-light/40 dark:bg-primary-dark/15 flex flex-col justify-between shadow-sm">
              <div>
                <div className="flex items-center justify-between gap-2 mb-3.5">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full bg-primary text-white text-sm font-extrabold flex items-center justify-center shrink-0 shadow-sm leading-none">
                      2
                    </span>
                    <span className="text-xs font-bold text-primary dark:text-primary-light">
                      الدفعة الأولى
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-primary dark:text-primary-light bg-primary-light dark:bg-primary-dark/40 px-2.5 py-1 rounded-full border border-primary/20">
                    سعي المنصة 2.5%
                  </span>
                </div>
                <h4 className="text-sm font-bold text-ink-primary dark:text-dark-ink-primary">
                  حوالة سعي المنصة (2.5%)
                </h4>
                <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary mt-1.5 leading-relaxed">
                  تحويل سعي الوساطة لحساب المصايف مع تضمين كود الصفقة المرجعي الصادر آلياً.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-primary/20 text-[11px] text-primary dark:text-primary-light font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-accent" />
                <span>تدقيق إداري فوري للإيصال</span>
              </div>
            </div>

            {/* Step 3 */}
            <div className="p-5 rounded-2xl border border-accent/40 bg-accent-light/40 dark:bg-accent/10 flex flex-col justify-between shadow-sm">
              <div>
                <div className="flex items-center justify-between gap-2 mb-3.5">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full bg-accent-dark text-white text-sm font-extrabold flex items-center justify-center shrink-0 shadow-sm leading-none">
                      3
                    </span>
                    <span className="text-xs font-bold text-accent-dark">
                      الدفعة الثانية
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-accent-dark bg-accent-light px-2.5 py-1 rounded-full border border-accent/30">
                    ثمن العقار
                  </span>
                </div>
                <h4 className="text-sm font-bold text-ink-primary dark:text-dark-ink-primary">
                  حوالة ثمن العقار للبائع
                </h4>
                <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary mt-1.5 leading-relaxed">
                  حوالة مباشرة من حساب المشتري لآيبان البائع المعتمد دون أي احتجاز لأموال العقار.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-accent/20 text-[11px] text-accent-dark font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-accent" />
                <span>ضمان استلام الثمن</span>
              </div>
            </div>

            {/* Step 4 */}
            <div className="p-5 rounded-2xl border border-accent/30 bg-accent-light/20 dark:bg-accent/5 flex flex-col justify-between shadow-sm">
              <div>
                <div className="flex items-center justify-between gap-2 mb-3.5">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full bg-primary text-white text-sm font-extrabold flex items-center justify-center shrink-0 shadow-sm leading-none">
                      4
                    </span>
                    <span className="text-xs font-bold text-accent-dark dark:text-accent">
                      المرحلة الأخيرة
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-accent-dark dark:text-accent bg-accent-light dark:bg-accent/20 px-2.5 py-1 rounded-full border border-accent/30">
                    الإفراغ الرسمي
                  </span>
                </div>
                <h4 className="text-sm font-bold text-ink-primary dark:text-dark-ink-primary">
                  فك الحجب ونقل الملكية
                </h4>
                <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary mt-1.5 leading-relaxed">
                  فك حجب بيانات البائع والصك، وإتمام الإفراغ الإلكتروني عبر البورصة العقارية / ناجز.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-surface-border dark:border-dark-surface-border text-[11px] text-accent-dark dark:text-accent font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-accent" />
                <span>إصدار الصك باسم المشتري</span>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-surface-border dark:border-dark-surface-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-ink-secondary dark:text-dark-ink-secondary">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary dark:text-primary-light shrink-0" />
              <span>مهلة إيداع الإيصالات هي 48 ساعة من تاريخ الموافقة النهائية مع تمديد إداري تلقائي فور رفع الإيصالات.</span>
            </div>
            <Link href="/pages/buyer-guide" className="text-primary dark:text-primary-light font-bold hover:underline shrink-0 flex items-center gap-1">
              <span>تفاصيل دورة الدفع</span>
              <ChevronLeft className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Quick Interactive Commission Calculator Teaser */}
      <section className="py-12 border-t border-surface-border dark:border-dark-surface-border">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center bg-gradient-to-br from-surface-base via-surface-sunken to-surface-base dark:from-dark-surface-base dark:via-dark-surface-sunken dark:to-dark-surface-base p-6 sm:p-10 rounded-3xl border border-surface-border dark:border-dark-surface-border shadow-level1">
          <div className="lg:col-span-1 space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent-light border border-accent/20 text-accent-dark text-xs font-bold">
              <Calculator className="w-3.5 h-3.5" />
              <span>حاسبة السعي والضريبة السريعة</span>
            </div>
            <h3 className="text-2xl font-extrabold text-ink-primary dark:text-dark-ink-primary">
              احسب سعي وساطة الصفقة بدقة نظامية
            </h3>
            <p className="text-xs sm:text-sm text-ink-secondary dark:text-dark-ink-secondary leading-relaxed">
              وفقاً لنظام الوساطة العقارية ولائحته التنفيذية، تبلغ نسبة السعي 2.5% بحد أقصى، وتخضع لضريبة القيمة المضافة 15%.
            </p>
            <div className="pt-2">
              <Link
                href="/pages/calculator"
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-primary dark:text-primary-light hover:underline"
              >
                <span>الانتقال للحاسبة التفاعلية الشاملة</span>
                <ChevronLeft className="w-4 h-4" />
              </Link>
            </div>
          </div>

          <div className="lg:col-span-2 bg-surface-base dark:bg-dark-surface-base p-5 sm:p-6 rounded-2xl border border-surface-border dark:border-dark-surface-border shadow-sm">
            <div className="mb-4">
              <label className="text-xs font-bold text-ink-secondary dark:text-dark-ink-secondary block mb-1.5">
                قيمة العقار المتوقعة (ر.س)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="100000"
                  step="50000"
                  value={calcAmount}
                  onChange={(e) => setCalcAmount(Math.max(0, Number(e.target.value)))}
                  className="w-full bg-surface-sunken dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border rounded-xl px-4 py-3 text-base sm:text-lg font-bold font-mono-numbers text-ink-primary dark:text-dark-ink-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-ink-muted dark:text-dark-ink-muted">
                  ريال سعودي
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="p-3.5 rounded-xl bg-surface-sunken dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border">
                <span className="text-[11px] font-semibold text-ink-secondary dark:text-dark-ink-secondary block">
                  عمولة الوساطة (2.5%)
                </span>
                <div className="flex items-baseline gap-1 text-base sm:text-lg font-extrabold text-primary dark:text-primary-light mt-1" dir="ltr">
                  <span>{calcResults.commission.toLocaleString('en-US')}</span>
                  <span className="text-xs font-sans font-semibold">ر.س</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-sunken dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border">
                <span className="text-[11px] font-semibold text-ink-secondary dark:text-dark-ink-secondary block">
                  ضريبة السعي (15%)
                </span>
                <div className="flex items-baseline gap-1 text-base sm:text-lg font-extrabold text-accent-dark mt-1" dir="ltr">
                  <span>{calcResults.vat.toLocaleString('en-US')}</span>
                  <span className="text-xs font-sans font-semibold">ر.س</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-primary-light/50 dark:bg-primary-dark/20 border border-primary/20">
                <span className="text-[11px] font-semibold text-primary dark:text-primary-light block">
                  إجمالي التكلفة على المشتري
                </span>
                <div className="flex items-baseline gap-1 text-base sm:text-lg font-extrabold text-ink-primary dark:text-dark-ink-primary mt-1" dir="ltr">
                  <span>{calcResults.totalBuyerCost.toLocaleString('en-US')}</span>
                  <span className="text-xs font-sans font-semibold">ر.س</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Institutional Zero-Result State Preview */}
      <section className="py-8 border-t border-surface-border dark:border-dark-surface-border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="text-xs font-bold text-ink-secondary dark:text-dark-ink-secondary flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-accent" />
              <span>محددات البحث والتصفية الموسعة</span>
            </span>
            <h4 className="text-sm sm:text-base font-bold text-ink-primary dark:text-dark-ink-primary mt-0.5">
              معاينة حالات البحث الصفري وتصفير الفلاتر
            </h4>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowEmptyStateDemo(!showEmptyStateDemo)}
            className="text-xs"
          >
            <RotateCcw className="w-3 h-3" />
            <span>{showEmptyStateDemo ? 'إخفاء المعاينة' : 'عرض حالة البحث الصفري'}</span>
          </Button>
        </div>

        {showEmptyStateDemo ? (
          <EmptyState
            title="لا توجد صفقات مطابقة للمحددات الحالية"
            description="لم نتمكن من العثور على أي عقارات تطابق معايير التصفية المحددة. يرجى تجربة توسيع نطاق البحث أو إعادة تعيين الفلاتر."
            actionLabel="إعادة ضبط الفلاتر"
            onAction={() => {
              setSelectedCategory(0);
              setSelectedCity('');
              setSelectedPropertyType('');
              setSelectedPriceMax('');
              setShowEmptyStateDemo(false);
            }}
            secondaryActionLabel="استعراض كافة العقارات"
            secondaryActionHref="/properties"
          />
        ) : (
          <div className="text-center py-4 px-4 rounded-xl border border-dashed border-surface-border dark:border-dark-surface-border text-xs text-ink-muted dark:text-dark-ink-muted">
            انقر على «عرض حالة البحث الصفري» لمعاينة المكون المؤسسي عند عدم وجود نتائج متطابقة.
          </div>
        )}
      </section>

      {/* High-Converting Institutional CTA Banner */}
      <section className="py-12 border-t border-surface-border dark:border-dark-surface-border">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#07090C] text-white p-8 sm:p-14 shadow-level3 border border-surface-border dark:border-dark-surface-border">
          {/* Subtle decorative warm bronze glow */}
          <div className="absolute -left-20 -bottom-20 w-80 h-80 rounded-full bg-accent/20 blur-3xl pointer-events-none" />
          <div className="absolute right-0 top-0 w-96 h-96 rounded-full bg-accent/10 blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-3xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-accent text-xs font-bold mb-4">
              <Award className="w-3.5 h-3.5" />
              <span>انضم لمنظومة المصايف العقارية</span>
            </span>

            <h2 className="text-2xl sm:text-4xl font-extrabold text-white leading-tight">
              هل أنت مالك عقار أو وسيط عقاري معتمد بهيئة العقار؟
            </h2>

            <p className="mt-3 text-sm sm:text-base text-white/80 leading-relaxed max-w-2xl">
              ابدأ إدارة صفقاتك وعروضك العقارية عبر منصة موثوقة تحمي حقوق السعي كاملة، وتوفر لك مفاوضات رقمية ملزمة وإشرافاً إدارياً فورياً على كل صفقة.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/listings/new"
                className="px-6 py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-bold text-sm shadow-lg transition-all sheen-effect flex items-center gap-2 glow-bronze"
              >
                <span>إضافة عقار جديد للبيع</span>
                <ChevronLeft className="w-4 h-4" />
              </Link>

              <Link
                href="/pages/marketer-guide"
                className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-sm transition-all flex items-center gap-2"
              >
                <span>دليل المسوقين والوسطاء</span>
              </Link>

              <Link
                href="/pages/contact"
                className="px-4 py-3 text-white/70 hover:text-white text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5"
              >
                <PhoneCall className="w-4 h-4" />
                <span>مركز المساعدة والدعم المباشر</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </LayoutShell>
  );
}
