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
  ArrowRight,
  Award,
  Zap,
  TrendingUp,
  FileText,
  HelpCircle,
  PhoneCall,
  Check,
  RotateCcw,
} from 'lucide-react';
import { LayoutShell } from '../components/layout';
import { Button, Badge, Card } from '../components/ui';
import { PropertyCard } from '../components/listings';
import { MarketplaceAppHero } from '../components/home/marketplace-app-hero';
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

interface CityOption {
  id: string;
  nameAr: string;
}

const FALLBACK_CITIES: CityOption[] = [
  { id: '11111111-0000-4000-8000-000000000001', nameAr: 'الرياض' },
  { id: '11111111-0000-4000-8000-000000000002', nameAr: 'جدة' },
  { id: '11111111-0000-4000-8000-000000000003', nameAr: 'الدمام' },
  { id: '11111111-0000-4000-8000-000000000004', nameAr: 'مكة المكرمة' },
  { id: '11111111-0000-4000-8000-000000000005', nameAr: 'المدينة المنورة' },
  { id: '11111111-0000-4000-8000-000000000006', nameAr: 'الطائف' },
  { id: '11111111-0000-4000-8000-000000000007', nameAr: 'الخبر' },
];

export default function HomePage() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState(0);
  const [liveListings, setLiveListings] = useState<ListingSummaryItem[]>([]);
  const [cities, setCities] = useState<CityOption[]>(FALLBACK_CITIES);
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [selectedPropertyType, setSelectedPropertyType] = useState<string>('');
  const [selectedPriceMax, setSelectedPriceMax] = useState<string>('');

  useEffect(() => {
    // 1. Fetch live listings
    apiClient
      .get<{ statusCode: number; data: { items: ListingSummaryItem[] } }>('/listings?limit=50')
      .then((res) => {
        if (res?.data?.items && res.data.items.length > 0) {
          setLiveListings(res.data.items);
        }
      })
      .catch(() => {});

    // 2. Fetch real cities
    apiClient
      .get<CityOption[]>('/geo/cities')
      .then((res: any) => {
        const list = Array.isArray(res) ? res : res?.data;
        if (Array.isArray(list) && list.length > 0) {
          setCities(list);
        }
      })
      .catch(() => {});
  }, []);

  const categories = useMemo(
    () => [
      { label: 'كافة العقارات', type: '' },
      { label: 'فلل وقصور', type: PropertyType.VILLA },
      { label: 'أراضي استثمارية', type: PropertyType.LAND },
      { label: 'شقق تمليك', type: PropertyType.APARTMENT },
      { label: 'عمائر سكنية', type: PropertyType.BUILDING },
      { label: 'عقارات تجارية', type: PropertyType.COMMERCIAL },
    ],
    [],
  );

  const handleCategorySelect = (idx: number, type: string) => {
    setSelectedCategory(idx);
    setSelectedPropertyType(type);
  };

  const handlePropertyTypeChange = (type: string) => {
    setSelectedPropertyType(type);
    const foundIdx = categories.findIndex((c) => c.type === type);
    setSelectedCategory(foundIdx !== -1 ? foundIdx : 0);
  };

  const handleResetFilters = () => {
    setSelectedCategory(0);
    setSelectedPropertyType('');
    setSelectedCity('');
    setSelectedPriceMax('');
  };

  const activePropertyType = selectedPropertyType || categories[selectedCategory]?.type;
  const hasActiveFilters = Boolean(activePropertyType || selectedCity || selectedPriceMax);

  // Pool of all available showcase listings merged with live API listings
  const allListingsPool = useMemo(() => {
    const map = new Map<string, ListingSummaryItem>();
    for (const item of FEATURED_SHOWCASE_LISTINGS) {
      map.set(item.id, item);
    }
    for (const item of liveListings) {
      map.set(item.id, item);
    }
    return Array.from(map.values());
  }, [liveListings]);

  // Live filtered listings for the homepage section
  const filteredListings = useMemo(() => {
    return allListingsPool.filter((item) => {
      if (activePropertyType && item.propertyType !== activePropertyType) return false;
      if (selectedCity && item.cityId !== selectedCity) return false;
      if (selectedPriceMax && item.askPrice > Number(selectedPriceMax)) return false;
      return true;
    });
  }, [allListingsPool, activePropertyType, selectedCity, selectedPriceMax]);

  const searchParamsString = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedCity) params.set('cityId', selectedCity);
    if (activePropertyType) params.set('propertyType', activePropertyType);
    if (selectedPriceMax) params.set('priceMax', selectedPriceMax);
    return params.toString();
  }, [selectedCity, activePropertyType, selectedPriceMax]);

  const handleSearch = () => {
    router.push(searchParamsString ? `/properties?${searchParamsString}` : '/properties');
  };

  return (
    <LayoutShell>
      {/* Dynamic Interactive App Hero (الهيرو التفاعلي الجديد في البداية) */}
      <MarketplaceAppHero />

      {/* Search & Property Explorer Section (محرك البحث واستعراض المعروض) */}
      <section id="search-explore-section" className="relative pt-6 pb-12 sm:pt-8 sm:pb-16 text-center border-t border-surface-border/60 dark:border-dark-surface-border/60 mt-4 sm:mt-6">
        {/* Ambient Radial Background Glow */}
        <div className="absolute inset-0 -top-24 -z-10 bg-ambient-radial opacity-70 pointer-events-none" />

        <div className="max-w-4xl mx-auto px-4 mb-4 sm:mb-6 text-center space-y-1.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-sunken dark:bg-dark-surface-sunken text-ink-secondary dark:text-dark-ink-secondary text-xs font-semibold border border-surface-border dark:border-dark-surface-border">
            <Search className="w-3.5 h-3.5 text-accent" />
            <span>محرك البحث والفلترة المباشرة</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-ink-primary dark:text-dark-ink-primary tracking-tight">
            ابحث في معروض الصفقات والعقارات المعتمدة
          </h2>
          <p className="text-xs sm:text-sm text-ink-muted max-w-xl mx-auto">
            فلترة فورية ومخصصة حسب المدينة، تصنيف العقار، ونطاق السعر المستهدف.
          </p>
        </div>

        {/* Main Search Panel with Glassmorphism */}
        <div className="max-w-4xl mx-auto glass-panel rounded-2xl shadow-level3 p-4 sm:p-6 text-start luxury-card">
          {/* Category Tabs */}
          <div className="flex items-center justify-between border-b border-surface-border dark:border-dark-surface-border pb-4 mb-5 gap-2">
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1">
              {categories.map((cat, idx) => (
                <button
                  key={cat.label}
                  type="button"
                  onClick={() => handleCategorySelect(idx, cat.type)}
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
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 shrink-0 px-2 py-1 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                title="إعادة تعيين الفلاتر"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">إعادة ضبط</span>
              </button>
            )}
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
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nameAr}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-ink-secondary dark:text-dark-ink-secondary flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-primary dark:text-primary-light" />
                نوع العقار
              </label>
              <select
                value={selectedPropertyType}
                onChange={(e) => handlePropertyTypeChange(e.target.value)}
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
              {hasActiveFilters ? 'العقارات المطابقة للبحث' : 'أحدث صفقات البيع المتاحة حالياً'}
            </h2>
            <p className="text-xs sm:text-sm text-ink-secondary dark:text-dark-ink-secondary mt-1">
              {hasActiveFilters
                ? `تم العثور على (${filteredListings.length}) عقار مطابق لمعايير التصفية المحددة`
                : 'عقارات تم التحقق من صكوكها ورخص تسويقها بموجب عقود وساطة سارية'}
            </p>
          </div>
          <div className="flex items-center gap-3 self-start sm:self-auto">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>إلغاء الفلترة</span>
              </button>
            )}
            <Link
              href={searchParamsString ? `/properties?${searchParamsString}` : '/properties'}
              className="text-sm font-bold text-primary dark:text-primary-light hover:underline flex items-center gap-1.5 group"
            >
              <span>استعراض كافة النتائج ({filteredListings.length})</span>
              <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>

        {filteredListings.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {filteredListings.slice(0, 6).map((item) => (
              <PropertyCard
                key={item.id}
                listing={item}
                href={`/properties/${item.id}`}
                actionLabel="استعراض العقار والتفاصيل"
              />
            ))}
          </div>
        ) : (
          <div className="py-12 px-4 text-center rounded-2xl border border-surface-border dark:border-dark-surface-border bg-surface-sunken/40 dark:bg-dark-surface-sunken/40 max-w-xl mx-auto space-y-3">
            <Building2 className="w-10 h-10 text-ink-muted mx-auto opacity-50" />
            <h3 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary">
              لا توجد عقارات تطابق هذه المعايير حالياً
            </h3>
            <p className="text-xs text-ink-muted">
              جرّب تغيير تصنيف العقار أو المدينة أو توسيع الميزانية، أو تصفير الفلاتر لاستعراض باقي المعروض.
            </p>
            <div className="pt-2 flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" onClick={handleResetFilters}>
                <RotateCcw className="w-3.5 h-3.5" />
                <span>إعادة تعيين الفلاتر</span>
              </Button>
              <Button variant="primary" size="sm" onClick={() => router.push('/properties')}>
                <span>تصفح سوق العقارات بالكامل</span>
              </Button>
            </div>
          </div>
        )}
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

      {/* High-Converting Institutional CTA Banner (تصميم فخم، مقسم لعمودين مع بطاقة استعراض وبصمة ذهبية) */}
      <section className="py-12 border-t border-surface-border dark:border-dark-surface-border">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0B0F19] via-[#111827] to-[#07090E] text-white p-8 sm:p-12 lg:p-14 shadow-2xl border border-white/10">
          {/* Subtle Grid Pattern Overlay */}
          <div className="absolute inset-0 bg-[radial-gradient(#d97706_1px,transparent_1px)] [background-size:24px_24px] opacity-10 pointer-events-none" />

          {/* Decorative ambient glowing orbs */}
          <div className="absolute -left-20 -bottom-20 w-96 h-96 rounded-full bg-amber-500/20 blur-3xl pointer-events-none" />
          <div className="absolute right-0 -top-20 w-96 h-96 rounded-full bg-amber-600/15 blur-3xl pointer-events-none" />

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Right Column: High-Impact Typography & Action CTA */}
            <div className="lg:col-span-7 space-y-6 text-start">
              <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-bold shadow-xs">
                <Award className="w-4 h-4 text-amber-400" />
                <span>انضم لمنظومة المصايف العقارية المعتمدة</span>
              </span>

              <h2 className="text-2xl sm:text-4xl lg:text-4xl font-black text-white leading-tight">
                هل أنت مالك عقار أو{' '}
                <span className="bg-gradient-to-l from-amber-400 via-amber-300 to-amber-200 bg-clip-text text-transparent">
                  وسيط عقاري معتمد
                </span>{' '}
                بهيئة العقار؟
              </h2>

              <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
                ابدأ إدارة صفقاتك وعروضك العقارية عبر منصة موثوقة تحمي حقوق السعي كاملة، وتوفر لك مفاوضات رقمية ملزمة وإشرافاً إدارياً فورياً على كل صفقة.
              </p>

              {/* 3 Core Trust Badges / Value Props */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>حفظ السعي (2.5%)</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>عقود وساطة موثقة فورياً</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>تحويل بنكي مباشر للبائع</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-wrap items-center gap-3.5">
                <Link
                  href="/listings/new"
                  className="px-7 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black text-sm shadow-lg shadow-amber-500/25 transition-all duration-200 flex items-center gap-2 group hover:scale-[1.02]"
                >
                  <span>إضافة عقار جديد للبيع</span>
                  <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                </Link>

                <Link
                  href="/pages/marketer-guide"
                  className="px-6 py-3.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-bold text-sm transition-all duration-200 flex items-center gap-2 backdrop-blur-xs"
                >
                  <span>دليل المسوقين والوسطاء</span>
                </Link>

                <Link
                  href="/pages/contact"
                  className="px-4 py-3 text-slate-300 hover:text-white text-xs sm:text-sm font-semibold transition-colors flex items-center gap-2"
                >
                  <PhoneCall className="w-4 h-4 text-amber-400" />
                  <span>مركز الدعم المباشر</span>
                </Link>
              </div>
            </div>

            {/* Left Column: Premium Floating Mockup Showcase */}
            <div className="lg:col-span-5 relative mt-6 lg:mt-0">
              <div className="relative mx-auto max-w-sm rounded-2xl bg-gradient-to-b from-white/15 via-white/5 to-white/10 backdrop-blur-xl border border-white/20 p-5 sm:p-6 shadow-2xl space-y-4">
                {/* Header of Mockup Card */}
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500/30 to-amber-600/10 text-amber-400 flex items-center justify-center border border-amber-500/30 shadow-inner">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-white">منصة المصايف المعتمدة</div>
                      <div className="text-[11px] text-slate-400">بوابة الملاك والوسطاء المرخصين</div>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>فال نشطة ✓</span>
                  </span>
                </div>

                {/* Micro Item 1 */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 hover:border-amber-500/30 transition-colors">
                  <div className="flex items-center gap-2 text-xs text-slate-200 font-semibold">
                    <Building2 className="w-4 h-4 text-amber-400" />
                    <span>حماية سعي الوساطة</span>
                  </div>
                  <span className="text-xs font-black text-amber-300">2.5% بضمان بنكي</span>
                </div>

                {/* Micro Item 2 */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 hover:border-amber-500/30 transition-colors">
                  <div className="flex items-center gap-2 text-xs text-slate-200 font-semibold">
                    <FileCheck className="w-4 h-4 text-emerald-400" />
                    <span>تدقيق الصكوك العقارية</span>
                  </div>
                  <span className="text-xs font-black text-emerald-400">فحص فوري 100%</span>
                </div>

                {/* Micro Item 3 */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 hover:border-amber-500/30 transition-colors">
                  <div className="flex items-center gap-2 text-xs text-slate-200 font-semibold">
                    <Lock className="w-4 h-4 text-sky-400" />
                    <span>قناة تفاوض محمية</span>
                  </div>
                  <span className="text-xs font-black text-sky-300">عروض رسمية ملزمة</span>
                </div>

                {/* Micro Footer Badge */}
                <div className="pt-1 text-center">
                  <span className="text-[11px] text-slate-400">
                    مرخص من الهيئة العامة للعقار • رقم وساطة 1200028491
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </LayoutShell>
  );
}
