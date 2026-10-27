import React from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Building2,
  MapPin,
  Search,
  CheckCircle2,
  Clock,
  ArrowLeft,
  FileCheck,
  Banknote,
  Lock,
  Layers,
  Sparkles,
  ChevronLeft
} from 'lucide-react';

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Top Institutional Bar */}
      <header className="sticky top-0 z-50 nav-blur border-b border-surface-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-10">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-md shadow-primary/20">
                <Building2 className="w-6 h-6 text-accent-dark" />
              </div>
              <div>
                <span className="text-2xl font-bold tracking-tight text-primary block leading-none">
                  المصايف
                </span>
                <span className="text-xs text-ink-secondary tracking-wider block mt-1">
                  منصة الصفقات العقارية المعتمدة
                </span>
              </div>
            </Link>

            {/* Navigation */}
            <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-ink-secondary">
              <Link href="/properties" className="text-primary hover:text-primary-hover font-semibold transition">
                العقارات المتاحة
              </Link>
              <Link href="/demands" className="hover:text-primary transition">
                طلبات الشراء
              </Link>
              <Link href="/fal-compliance" className="hover:text-primary transition flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-status-verified" />
                التحقق من رخصة فال
              </Link>
            </nav>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-semibold text-primary hover:bg-primary-light rounded-DEFAULT transition"
            >
              تسجيل الدخول
            </Link>
            <Link
              href="/register"
              className="px-5 py-2.5 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary-hover rounded-DEFAULT shadow-sm shadow-primary/20 transition flex items-center gap-2"
            >
              <span>إنشاء حساب</span>
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-16 pb-24 bg-gradient-to-b from-primary/5 via-surface-background to-surface-background overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-light border border-primary/20 text-primary text-xs font-semibold mb-6">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <span>مرخص ومعتمد وفق أنظمة الهيئة العامة للعقار (REGA)</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-ink-primary leading-tight tracking-tight">
              السوق المؤسسي الموثوق <br />
              <span className="text-primary">لصفقات بيع العقارات</span> في السعودية
            </h1>

            <p className="mt-6 text-lg text-ink-secondary leading-relaxed">
              منظومة وساطة عقارية محكومة لحماية المشترين والملاك والوسطاء المرخصين. مفاوضات رسمية ملزمة، تدقيق حكومي فوري، وتحويلات بنكية مباشرة بدون حجز أموال.
            </p>
          </div>

          {/* Main Search Panel */}
          <div className="mt-12 max-w-4xl mx-auto bg-surface-base rounded-2xl shadow-xl shadow-primary/5 border border-surface-border p-4 sm:p-6">
            <div className="flex items-center gap-3 border-b border-surface-border pb-4 mb-5 overflow-x-auto">
              {['الكل', 'فلل وقصور', 'أراضي استثمارية', 'شقق تمليك', 'عمائر سكنية', 'عقارات تجارية'].map((tab, idx) => (
                <button
                  key={tab}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition whitespace-nowrap ${
                    idx === 0
                      ? 'bg-primary text-primary-foreground'
                      : 'text-ink-secondary hover:bg-surface-sunken'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-ink-secondary flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-primary" />
                  المدينة أو المنطقة
                </label>
                <select className="w-full bg-surface-sunken border border-surface-border rounded-lg px-3 py-2.5 text-sm text-ink-primary focus:outline-none focus:border-primary">
                  <option>الرياض (العاصمة)</option>
                  <option>جدة (عروس البحر)</option>
                  <option>الدمام والخبر</option>
                  <option>مكة المكرمة</option>
                  <option>المدينة المنورة</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-ink-secondary flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-primary" />
                  نوع العقار
                </label>
                <select className="w-full bg-surface-sunken border border-surface-border rounded-lg px-3 py-2.5 text-sm text-ink-primary focus:outline-none focus:border-primary">
                  <option>فيلا سكنية</option>
                  <option>قطعة أرض</option>
                  <option>شقة فاخرة</option>
                  <option>عمارة تجارية</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-ink-secondary flex items-center gap-1.5">
                  <Banknote className="w-3.5 h-3.5 text-primary" />
                  الميزانية التقريبية
                </label>
                <select className="w-full bg-surface-sunken border border-surface-border rounded-lg px-3 py-2.5 text-sm text-ink-primary focus:outline-none focus:border-primary">
                  <option>أي سعر</option>
                  <option>1,000,000 - 3,000,000 ر.س</option>
                  <option>3,000,000 - 6,000,000 ر.س</option>
                  <option>أكثر من 6,000,000 ر.س</option>
                </select>
              </div>

              <div className="flex items-end">
                <button className="w-full bg-primary hover:bg-primary-hover text-primary-foreground font-semibold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition shadow-md shadow-primary/20">
                  <Search className="w-4 h-4" />
                  <span>بحث في العقارات</span>
                </button>
              </div>
            </div>
          </div>

          {/* Pillars Row */}
          <div className="mt-14 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="bg-surface-base/80 backdrop-blur rounded-xl p-5 border border-surface-border flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-status-verifiedBg text-status-verified flex items-center justify-center shrink-0">
                <FileCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-ink-primary">رخص فال المعتمدة</h3>
                <p className="text-xs text-ink-secondary mt-1 leading-relaxed">
                  حظر الوسطاء غير المرخصين وحصر التسويق على رخص الهيئة العامة للعقار الرسمية.
                </p>
              </div>
            </div>

            <div className="bg-surface-base/80 backdrop-blur rounded-xl p-5 border border-surface-border flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-accent-light text-accent-dark flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-ink-primary">قناة وساطة محمية</h3>
                <p className="text-xs text-ink-secondary mt-1 leading-relaxed">
                  حجب قنوات الاتصال الشخصية لمنع الصيد والتخطي حتى يتم توثيق واعتماد الصفقة.
                </p>
              </div>
            </div>

            <div className="bg-surface-base/80 backdrop-blur rounded-xl p-5 border border-surface-border flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary-light text-primary flex items-center justify-center shrink-0">
                <Banknote className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-ink-primary">تحويل بنكي مباشر</h3>
                <p className="text-xs text-ink-secondary mt-1 leading-relaxed">
                  قيمة العقار تتحول مباشرة لحساب البائع بدون احتجاز أموال الملايين في وسيط رقمي.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Verified Listings */}
      <section className="py-16 bg-surface-base border-t border-surface-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-10">
            <div>
              <div className="flex items-center gap-2 text-primary text-sm font-semibold mb-2">
                <Sparkles className="w-4 h-4 text-accent" />
                <span>عقارات مميزة ومدققة</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-ink-primary">
                أحدث صفقات البيع المتاحة حالياً
              </h2>
            </div>
            <Link
              href="/properties"
              className="text-sm font-semibold text-primary hover:text-primary-hover flex items-center gap-1 group"
            >
              <span>استعراض كافة العقارات</span>
              <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Card 1 */}
            <div className="luxury-card bg-surface-base border border-surface-border rounded-2xl overflow-hidden shadow-sm flex flex-col">
              <div className="relative aspect-[16/10] bg-surface-sunken overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent z-10" />
                <div className="w-full h-full bg-emerald-950 flex items-center justify-center text-primary-light text-sm font-medium">
                  صورة العقار (فيلا مودرن في النرجس)
                </div>
                <div className="absolute top-3 right-3 z-20 bg-status-verified text-white px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 shadow-sm">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>معلن مرخص (فال)</span>
                </div>
                <div className="absolute top-3 left-3 z-20 bg-black/60 backdrop-blur text-white px-2.5 py-1 rounded-full text-xs font-mono">
                  1/12
                </div>
                <div className="absolute bottom-3 right-3 z-20 text-white font-mono text-xl font-bold">
                  3,200,000 <span className="text-xs font-sans font-normal">ر.س</span>
                </div>
              </div>

              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-xs text-ink-secondary mb-2">
                    <MapPin className="w-3.5 h-3.5 text-primary" />
                    <span>الرياض، حي النرجس</span>
                  </div>
                  <h3 className="text-base font-bold text-ink-primary line-clamp-1">
                    فيلا درج صالة مودرن مع مسبح ومصعد
                  </h3>
                  <div className="mt-4 pt-3 border-t border-surface-border grid grid-cols-3 gap-2 text-center text-xs text-ink-secondary">
                    <div>
                      <span className="block font-bold text-ink-primary text-sm">450 م²</span>
                      المساحة
                    </div>
                    <div>
                      <span className="block font-bold text-ink-primary text-sm">5 غرف</span>
                      الغرف
                    </div>
                    <div>
                      <span className="block font-bold text-ink-primary text-sm">6 دورات</span>
                      المياه
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-surface-border flex items-center justify-between">
                  <div className="text-xs text-ink-secondary">
                    سعي المنصة التقريبي: <span className="font-bold text-primary font-mono">80,000 ر.س</span> (2.5%)
                  </div>
                  <Link
                    href="/properties/demo-1"
                    className="px-3.5 py-1.5 bg-primary-light text-primary hover:bg-primary hover:text-white rounded-lg text-xs font-semibold transition"
                  >
                    تقديم عرض
                  </Link>
                </div>
              </div>
            </div>

            {/* Card 2 */}
            <div className="luxury-card bg-surface-base border border-surface-border rounded-2xl overflow-hidden shadow-sm flex flex-col">
              <div className="relative aspect-[16/10] bg-surface-sunken overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent z-10" />
                <div className="w-full h-full bg-slate-900 flex items-center justify-center text-primary-light text-sm font-medium">
                  صورة العقار (أرض تجارية بالخبر)
                </div>
                <div className="absolute top-3 right-3 z-20 bg-status-verified text-white px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 shadow-sm">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>معلن مرخص (فال)</span>
                </div>
                <div className="absolute top-3 left-3 z-20 bg-black/60 backdrop-blur text-white px-2.5 py-1 rounded-full text-xs font-mono">
                  1/6
                </div>
                <div className="absolute bottom-3 right-3 z-20 text-white font-mono text-xl font-bold">
                  4,850,000 <span className="text-xs font-sans font-normal">ر.س</span>
                </div>
              </div>

              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-xs text-ink-secondary mb-2">
                    <MapPin className="w-3.5 h-3.5 text-primary" />
                    <span>الخبر، حي الشاطئ</span>
                  </div>
                  <h3 className="text-base font-bold text-ink-primary line-clamp-1">
                    أرض تجارية سكنية على شارعين رئيسيين
                  </h3>
                  <div className="mt-4 pt-3 border-t border-surface-border grid grid-cols-3 gap-2 text-center text-xs text-ink-secondary">
                    <div>
                      <span className="block font-bold text-ink-primary text-sm">920 م²</span>
                      المساحة
                    </div>
                    <div>
                      <span className="block font-bold text-ink-primary text-sm">تجاري/سكني</span>
                      الاستخدام
                    </div>
                    <div>
                      <span className="block font-bold text-ink-primary text-sm">30 م</span>
                      عرض الشارع
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-surface-border flex items-center justify-between">
                  <div className="text-xs text-ink-secondary">
                    سعي المنصة التقريبي: <span className="font-bold text-primary font-mono">121,250 ر.س</span> (2.5%)
                  </div>
                  <Link
                    href="/properties/demo-2"
                    className="px-3.5 py-1.5 bg-primary-light text-primary hover:bg-primary hover:text-white rounded-lg text-xs font-semibold transition"
                  >
                    تقديم عرض
                  </Link>
                </div>
              </div>
            </div>

            {/* Card 3 */}
            <div className="luxury-card bg-surface-base border border-surface-border rounded-2xl overflow-hidden shadow-sm flex flex-col">
              <div className="relative aspect-[16/10] bg-surface-sunken overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent z-10" />
                <div className="w-full h-full bg-stone-900 flex items-center justify-center text-primary-light text-sm font-medium">
                  صورة العقار (مكتب تجاري في جدة)
                </div>
                <div className="absolute top-3 right-3 z-20 bg-accent text-accent-foreground px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 shadow-sm">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>عرض مالك مباشر</span>
                </div>
                <div className="absolute top-3 left-3 z-20 bg-black/60 backdrop-blur text-white px-2.5 py-1 rounded-full text-xs font-mono">
                  1/8
                </div>
                <div className="absolute bottom-3 right-3 z-20 text-white font-mono text-xl font-bold">
                  1,850,000 <span className="text-xs font-sans font-normal">ر.س</span>
                </div>
              </div>

              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-xs text-ink-secondary mb-2">
                    <MapPin className="w-3.5 h-3.5 text-primary" />
                    <span>جدة، حي الروضة</span>
                  </div>
                  <h3 className="text-base font-bold text-ink-primary line-clamp-1">
                    مكتب تجاري مؤثث بالكامل في برج تنفيذي
                  </h3>
                  <div className="mt-4 pt-3 border-t border-surface-border grid grid-cols-3 gap-2 text-center text-xs text-ink-secondary">
                    <div>
                      <span className="block font-bold text-ink-primary text-sm">210 م²</span>
                      المساحة
                    </div>
                    <div>
                      <span className="block font-bold text-ink-primary text-sm">الدور 6</span>
                      الطابق
                    </div>
                    <div>
                      <span className="block font-bold text-ink-primary text-sm">3 مواقف</span>
                      المواقف
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-surface-border flex items-center justify-between">
                  <div className="text-xs text-ink-secondary">
                    سعي المنصة التقريبي: <span className="font-bold text-primary font-mono">46,250 ر.س</span> (2.5%)
                  </div>
                  <Link
                    href="/properties/demo-3"
                    className="px-3.5 py-1.5 bg-primary-light text-primary hover:bg-primary hover:text-white rounded-lg text-xs font-semibold transition"
                  >
                    تقديم عرض
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Dual Wire Transfer Transparency Banner */}
      <section className="py-16 bg-surface-sunken border-t border-surface-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-surface-base rounded-2xl border border-surface-border p-8 sm:p-10 shadow-sm">
            <div className="text-center max-w-2xl mx-auto mb-8">
              <span className="text-xs font-bold text-primary bg-primary-light px-3 py-1 rounded-full border border-primary/20">
                هندسة الأمان المالي
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-ink-primary mt-3">
                نموذج التحويل البنكي المزدوج (Dual Transfer)
              </h2>
              <p className="text-sm text-ink-secondary mt-2">
                حرصاً على الامتثال للأنظمة المالية السعودية، لا تحتجز منصة المصايف أموال شراء العقار في محافظ إلكترونية، بل تتم الحوالات مباشرة بين الحسابات البنكية الرسمية:
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Payment 1 */}
              <div className="p-5 rounded-xl border border-primary/30 bg-primary-light/40 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-primary bg-primary text-white px-2 py-0.5 rounded">
                      الدفعة الأولى
                    </span>
                    <span className="text-xs font-bold text-primary">سعي المنصة (2.5%)</span>
                  </div>
                  <h4 className="text-base font-bold text-ink-primary mt-3">حوالة إلى حساب منصة المصايف</h4>
                  <p className="text-xs text-ink-secondary mt-1 leading-relaxed">
                    يتم تحويل نسبة عمولة الوساطة (2.5%) مباشرة إلى آيبان المنصة الرسمي مع تضمين رمز مرجع الصفقة الصادر إلكترونياً (مثل: <code className="font-mono bg-white px-1 py-0.5 rounded border text-primary">ELM-408-C</code>).
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-primary/20 flex items-center gap-2 text-xs text-primary font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>تدقيق إداري فوري لإيصال السعي</span>
                </div>
              </div>

              {/* Payment 2 */}
              <div className="p-5 rounded-xl border border-surface-border bg-surface-sunken flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-ink-secondary bg-surface-border px-2 py-0.5 rounded">
                      الدفعة الثانية
                    </span>
                    <span className="text-xs font-bold text-ink-primary">قيمة العقار الصافية</span>
                  </div>
                  <h4 className="text-base font-bold text-ink-primary mt-3">حوالة مباشرة إلى حساب البائع</h4>
                  <p className="text-xs text-ink-secondary mt-1 leading-relaxed">
                    يقوم المشتري بتحويل قيمة العقار المتفق عليها مباشرة من حسابه البنكي إلى آيبان البائع المعتمد والموثق لدى المنصة (مالك مباشر أو وسيط مرخص).
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-surface-border flex items-center gap-2 text-xs text-ink-secondary font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-status-verified" />
                  <span>فك حجب بيانات البائع بعد اكتمال التدقيق للإفراغ</span>
                </div>
              </div>
            </div>

            <div className="mt-6 text-center">
              <span className="text-xs text-ink-muted">
                مهلة إيداع الإيصالات هي 48 ساعة من تاريخ الموافقة النهائية مع تمديد إداري تلقائي فور رفع الإيصالات.
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto bg-primary text-primary-foreground pt-12 pb-8 border-t border-primary-hover">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-8 border-b border-white/10">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-6 h-6 text-accent-dark" />
                <span className="text-xl font-bold">المصايف</span>
              </div>
              <p className="text-xs text-primary-light/80 leading-relaxed">
                المنصة المؤسسية الأولى لوساطة وبيع العقارات في المملكة العربية السعودية تحت إشراف وتراخيص الهيئة العامة للعقار.
              </p>
            </div>

            <div>
              <h4 className="text-sm font-bold text-white mb-3">بوابات المستخدمين</h4>
              <ul className="space-y-2 text-xs text-primary-light/80">
                <li><Link href="/app/buyer" className="hover:text-white transition">بوابة المشترين والمستثمرين</Link></li>
                <li><Link href="/app/marketer" className="hover:text-white transition">مساحة عمل الوسطاء (رخص فال)</Link></li>
                <li><Link href="/app/owner" className="hover:text-white transition">بوابة الملاك والعقود الإلكترونية</Link></li>
                <li><Link href="/admin" className="hover:text-white transition">لوحة إدارة العمليات المركزية</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-bold text-white mb-3">الأنظمة والامتثال</h4>
              <ul className="space-y-2 text-xs text-primary-light/80">
                <li>الهيئة العامة للعقار (REGA)</li>
                <li>رخصة فال للوساطة والتسويق</li>
                <li>العقود الإلكترونية الموحدة</li>
                <li>سياسة الخصوصية وسرية البيانات</li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-bold text-white mb-3">المساعدة والدعم</h4>
              <p className="text-xs text-primary-light/80 leading-relaxed">
                فريق التدقيق والوساطة متاح على مدار الساعة لمتابعة الصفقات والتحقق من التراخيص.
              </p>
              <div className="mt-4 text-xs font-mono text-accent-dark">
                support@elmasaif.sa
              </div>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-primary-light/60 gap-4">
            <div>
              جميع الحقوق محفوظة لمنصة المصايف العقارية © 2026.
            </div>
            <div className="flex items-center gap-6">
              <span>المملكة العربية السعودية</span>
              <span>•</span>
              <span>سجل تجاري معتمد</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
