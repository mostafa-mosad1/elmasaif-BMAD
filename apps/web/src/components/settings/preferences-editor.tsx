'use client';

import React, { useState, useEffect } from 'react';
import { useDirection } from '../providers/direction-provider';
import { useTheme } from '../providers/theme-provider';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { apiClient, ApiError } from '../../lib/api-client';
import {
  SupportedLocale,
  ThemeMode,
  UserPreferences,
  UserPreferencesResponse
} from '@elmasaif/shared';
import {
  Globe,
  Sun,
  Moon,
  Laptop,
  Mail,
  MessageSquare,
  Bell,
  Sparkles,
  ShieldCheck,
  Lock,
  CheckCircle2,
  AlertCircle,
  FileCheck2,
  Clock,
  ShieldAlert,
  Save,
  Check
} from 'lucide-react';

interface PreferencesEditorProps {
  initialPreferences?: Partial<UserPreferences>;
}

export function PreferencesEditor({ initialPreferences }: PreferencesEditorProps) {
  const { locale, setLocale } = useDirection();
  const { theme, setTheme } = useTheme();

  // Local state for preferences
  const [preferredLanguage, setPreferredLanguage] = useState<string>(
    initialPreferences?.preferredLanguage || locale || 'ar'
  );
  const [themeMode, setThemeMode] = useState<string>(
    initialPreferences?.themeMode || theme || 'light'
  );
  const [emailNotifications, setEmailNotifications] = useState<boolean>(
    initialPreferences?.emailNotifications ?? true
  );
  const [smsNotifications, setSmsNotifications] = useState<boolean>(
    initialPreferences?.smsNotifications ?? true
  );
  const [inquiryAlerts, setInquiryAlerts] = useState<boolean>(
    initialPreferences?.inquiryAlerts ?? true
  );
  const [marketingAlerts, setMarketingAlerts] = useState<boolean>(
    initialPreferences?.marketingAlerts ?? false
  );

  const [savingNotifications, setSavingNotifications] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Sync with providers on mount or changes
  useEffect(() => {
    if (initialPreferences?.preferredLanguage) {
      setPreferredLanguage(initialPreferences.preferredLanguage);
    }
    if (initialPreferences?.themeMode) {
      setThemeMode(initialPreferences.themeMode);
    }
  }, [initialPreferences]);

  // Fetch from API if mounted and no initial data provided
  useEffect(() => {
    let isMounted = true;
    apiClient<UserPreferencesResponse>('/users/preferences')
      .then((res) => {
        if (isMounted && res.data) {
          const data = res.data;
          setPreferredLanguage(data.preferredLanguage);
          setThemeMode(data.themeMode);
          setEmailNotifications(data.emailNotifications);
          setSmsNotifications(data.smsNotifications);
          setInquiryAlerts(data.inquiryAlerts);
          setMarketingAlerts(data.marketingAlerts);
        }
      })
      .catch(() => {
        // Fallback to local defaults if unauthenticated or offline
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Immediate language toggle handler
  const handleLanguageChange = async (newLocale: SupportedLocale) => {
    setPreferredLanguage(newLocale);
    setLocale(newLocale);
    setSyncStatus('جاري حفظ لغة الواجهة...');

    try {
      await apiClient<UserPreferencesResponse>('/users/preferences', {
        method: 'PATCH',
        body: JSON.stringify({ preferredLanguage: newLocale })
      });
      setSyncStatus(null);
      showToast('success', 'تم تحديث لغة الواجهة ومزامنتها بنجاح');
    } catch {
      setSyncStatus(null);
    }
  };

  // Immediate theme change handler
  const handleThemeChange = async (newTheme: ThemeMode) => {
    setThemeMode(newTheme);
    setTheme(newTheme);
    setSyncStatus('جاري تطبيق المظهر...');

    try {
      await apiClient<UserPreferencesResponse>('/users/preferences', {
        method: 'PATCH',
        body: JSON.stringify({ themeMode: newTheme })
      });
      setSyncStatus(null);
      showToast('success', 'تم تحديث المظهر المفضل ومزامنته بنجاح');
    } catch {
      setSyncStatus(null);
    }
  };

  // Notification channels explicit save
  const handleSaveNotifications = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingNotifications(true);

    try {
      const res = await apiClient<UserPreferencesResponse>('/users/preferences', {
        method: 'PATCH',
        body: JSON.stringify({
          emailNotifications,
          smsNotifications,
          inquiryAlerts,
          marketingAlerts
        })
      });

      if (res.data) {
        setEmailNotifications(res.data.emailNotifications);
        setSmsNotifications(res.data.smsNotifications);
        setInquiryAlerts(res.data.inquiryAlerts);
        setMarketingAlerts(res.data.marketingAlerts);
      }

      showToast('success', 'تم حفظ تفضيلات الإشعارات بنجاح');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'تعذر حفظ التفضيلات';
      showToast('error', msg);
    } finally {
      setSavingNotifications(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className={`p-4 rounded-xl flex items-center justify-between border transition-all ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
          }`}
        >
          <div className="flex items-center gap-3">
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span className="text-sm font-medium">{toastMessage.text}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-xs text-ink-muted hover:text-ink-primary dark:hover:text-dark-ink-primary"
          >
            إغلاق
          </button>
        </div>
      )}

      {syncStatus && (
        <div className="text-xs text-primary font-medium animate-pulse flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary" />
          {syncStatus}
        </div>
      )}

      {/* Card 1: Language & Direction Selection */}
      <Card className="p-6 sm:p-8 rounded-2xl border border-surface-border dark:border-dark-surface-border shadow-xs bg-surface-base dark:bg-dark-surface-base">
        <CardHeader className="p-0 mb-6 pb-4 border-b border-surface-border dark:border-dark-surface-border">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-ink-primary dark:text-dark-ink-primary">
              <Globe className="w-5 h-5 text-primary" aria-hidden="true" />
              لغة الواجهة والاتجاه (Language & Direction)
            </CardTitle>
            <Badge variant="neutral" size="sm">
              {preferredLanguage === 'ar' ? 'العربية (RTL)' : 'English (LTR)'}
            </Badge>
          </div>
          <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary mt-1">
            اختر لغة العرض الأساسية للمنصة. يتم تكييف الاتجاه والخطوط فورياً وبشكل هندسي متكامل.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Arabic Tile */}
            <button
              type="button"
              onClick={() => handleLanguageChange(SupportedLocale.AR)}
              className={`p-4 rounded-xl border text-start transition-all relative flex flex-col justify-between ${
                preferredLanguage === 'ar'
                  ? 'border-primary bg-primary/5 dark:border-primary-light dark:bg-primary-950/20 shadow-level1 ring-2 ring-primary/20'
                  : 'border-surface-border dark:border-dark-surface-border bg-surface dark:bg-dark-surface-base hover:border-primary/50'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-lg font-bold">العربية</span>
                  <Badge variant="verified" size="sm">
                    RTL
                  </Badge>
                </div>
                {preferredLanguage === 'ar' && (
                  <span className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </span>
                )}
              </div>
              <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary leading-relaxed">
                الاتجاه من اليمين إلى اليسار والخط العربي المؤسسي المعتمد (IBM Plex Sans Arabic).
              </p>
            </button>

            {/* English Tile */}
            <button
              type="button"
              onClick={() => handleLanguageChange(SupportedLocale.EN)}
              className={`p-4 rounded-xl border text-start transition-all relative flex flex-col justify-between ${
                preferredLanguage === 'en'
                  ? 'border-primary bg-primary/5 dark:border-primary-light dark:bg-primary-950/20 shadow-level1 ring-2 ring-primary/20'
                  : 'border-surface-border dark:border-dark-surface-border bg-surface dark:bg-dark-surface-base hover:border-primary/50'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-lg font-bold">English</span>
                  <Badge variant="info" size="sm">
                    LTR
                  </Badge>
                </div>
                {preferredLanguage === 'en' && (
                  <span className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </span>
                )}
              </div>
              <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary leading-relaxed">
                Left-to-right institutional layout with Inter typography and sovereign styling.
              </p>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Card 2: Theme Mode Selection */}
      <Card className="p-6 sm:p-8 rounded-2xl border border-surface-border dark:border-dark-surface-border shadow-xs bg-surface-base dark:bg-dark-surface-base">
        <CardHeader className="p-0 mb-6 pb-4 border-b border-surface-border dark:border-dark-surface-border">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-ink-primary dark:text-dark-ink-primary">
              <Sun className="w-5 h-5 text-amber-500" aria-hidden="true" />
              المظهر ونمط العرض (Theme & Display Mode)
            </CardTitle>
            <Badge variant="neutral" size="sm">
              {themeMode === 'light'
                ? 'الوضع الفاتح'
                : themeMode === 'dark'
                ? 'الوضع الداكن'
                : 'تلقائي (حسب النظام)'}
            </Badge>
          </div>
          <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary mt-1">
            اختر نمط الألوان المفضل لديك؛ تتوافق جميع الخيارات مع معايير الوصول والتباين القياسية (WCAG AAA).
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Light Mode Tile */}
            <button
              type="button"
              onClick={() => handleThemeChange(ThemeMode.LIGHT)}
              className={`p-4 rounded-xl border text-start transition-all relative flex flex-col justify-between ${
                themeMode === 'light'
                  ? 'border-primary bg-primary/5 dark:border-primary-light dark:bg-primary-950/20 shadow-level1 ring-2 ring-primary/20'
                  : 'border-surface-border dark:border-dark-surface-border bg-surface dark:bg-dark-surface-base hover:border-primary/50'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-3">
                <div className="flex items-center gap-2">
                  <Sun className="w-5 h-5 text-amber-500" />
                  <span className="text-sm font-bold">الوضع الفاتح</span>
                </div>
                {themeMode === 'light' && (
                  <span className="w-4 h-4 rounded-full bg-primary text-white flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </span>
                )}
              </div>
              <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary">
                أسطح ناصعة وألوان واضحة للاستخدام المكتبي والنهاري.
              </p>
            </button>

            {/* Dark Mode Tile */}
            <button
              type="button"
              onClick={() => handleThemeChange(ThemeMode.DARK)}
              className={`p-4 rounded-xl border text-start transition-all relative flex flex-col justify-between ${
                themeMode === 'dark'
                  ? 'border-primary bg-primary/5 dark:border-primary-light dark:bg-primary-950/20 shadow-level1 ring-2 ring-primary/20'
                  : 'border-surface-border dark:border-dark-surface-border bg-surface dark:bg-dark-surface-base hover:border-primary/50'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-3">
                <div className="flex items-center gap-2">
                  <Moon className="w-5 h-5 text-accent" />
                  <span className="text-sm font-bold">الوضع الداكن</span>
                </div>
                {themeMode === 'dark' && (
                  <span className="w-4 h-4 rounded-full bg-primary text-white flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </span>
                )}
              </div>
              <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary">
                أسطح حجر السج السيادي المعتمة لحماية العين والراحة البصرية.
              </p>
            </button>

            {/* System Mode Tile */}
            <button
              type="button"
              onClick={() => handleThemeChange(ThemeMode.SYSTEM)}
              className={`p-4 rounded-xl border text-start transition-all relative flex flex-col justify-between ${
                themeMode === 'system'
                  ? 'border-primary bg-primary/5 dark:border-primary-light dark:bg-primary-950/20 shadow-level1 ring-2 ring-primary/20'
                  : 'border-surface-border dark:border-dark-surface-border bg-surface dark:bg-dark-surface-base hover:border-primary/50'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-3">
                <div className="flex items-center gap-2">
                  <Laptop className="w-5 h-5 text-ink-muted" />
                  <span className="text-sm font-bold">حسب إعدادات النظام</span>
                </div>
                {themeMode === 'system' && (
                  <span className="w-4 h-4 rounded-full bg-primary text-white flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </span>
                )}
              </div>
              <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary">
                مزامنة تلقائية ديناميكية تتبع إعداد مظهر جهازك ونظام التشغيل.
              </p>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Card 3: Optional Notification Channels & Topics */}
      <Card className="p-6 sm:p-8 rounded-2xl border border-surface-border dark:border-dark-surface-border shadow-xs bg-surface-base dark:bg-dark-surface-base">
        <CardHeader className="p-0 mb-6 pb-4 border-b border-surface-border dark:border-dark-surface-border">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-ink-primary dark:text-dark-ink-primary">
              <Bell className="w-5 h-5 text-primary" aria-hidden="true" />
              قنوات الإشعارات الاختيارية (Optional Notification Channels)
            </CardTitle>
            <Badge variant="neutral" size="sm">
              إعدادات قابلة للتخصيص
            </Badge>
          </div>
          <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary mt-1">
            خصص القنوات والموضوعات التسويقية والتشغيلية الاختيارية التي ترغب في استلام تحديثاتها.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <form onSubmit={handleSaveNotifications} className="space-y-5">
            <div className="divide-y divide-surface-border dark:divide-dark-surface-border">
              {/* Channel 1: Email */}
              <div className="py-3.5 flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-surface-sunken dark:bg-dark-surface text-ink-secondary dark:text-dark-ink-secondary mt-0.5">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <label
                      htmlFor="emailNotificationsToggle"
                      className="text-sm font-semibold text-ink-primary dark:text-dark-ink-primary block cursor-pointer"
                    >
                      إشعارات البريد الإلكتروني (Email Notifications)
                    </label>
                    <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary mt-0.5">
                      استلام الملخصات الدورية وتحديثات العروض على بريدك الإلكتروني المسجل والمعتمد.
                    </p>
                  </div>
                </div>
                <input
                  id="emailNotificationsToggle"
                  type="checkbox"
                  checked={emailNotifications}
                  onChange={(e) => setEmailNotifications(e.target.checked)}
                  className="w-5 h-5 rounded border-surface-border text-primary focus:ring-primary cursor-pointer"
                />
              </div>

              {/* Channel 2: SMS */}
              <div className="py-3.5 flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-surface-sunken dark:bg-dark-surface text-ink-secondary dark:text-dark-ink-secondary mt-0.5">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <label
                      htmlFor="smsNotificationsToggle"
                      className="text-sm font-semibold text-ink-primary dark:text-dark-ink-primary block cursor-pointer"
                    >
                      الرسائل النصية القصيرة (SMS Notifications)
                    </label>
                    <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary mt-0.5">
                      استلام رسائل التنبيه العادية على رقم جوالك السعودي المسجل في المنصة.
                    </p>
                  </div>
                </div>
                <input
                  id="smsNotificationsToggle"
                  type="checkbox"
                  checked={smsNotifications}
                  onChange={(e) => setSmsNotifications(e.target.checked)}
                  className="w-5 h-5 rounded border-surface-border text-primary focus:ring-primary cursor-pointer"
                />
              </div>

              {/* Topic 1: Inquiry & Demand Matches */}
              <div className="py-3.5 flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-surface-sunken dark:bg-dark-surface text-ink-secondary dark:text-dark-ink-secondary mt-0.5">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div>
                    <label
                      htmlFor="inquiryAlertsToggle"
                      className="text-sm font-semibold text-ink-primary dark:text-dark-ink-primary block cursor-pointer"
                    >
                      تنبيهات الاستفسارات ومطابقة الطلبات (Inquiry & Matching Alerts)
                    </label>
                    <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary mt-0.5">
                      تنبيهك فور ورود استفسار جديد من عميل مهتم أو توفر عقار جديد يطابق طلباتك النشطة.
                    </p>
                  </div>
                </div>
                <input
                  id="inquiryAlertsToggle"
                  type="checkbox"
                  checked={inquiryAlerts}
                  onChange={(e) => setInquiryAlerts(e.target.checked)}
                  className="w-5 h-5 rounded border-surface-border text-primary focus:ring-primary cursor-pointer"
                />
              </div>

              {/* Topic 2: Marketing & Insights */}
              <div className="py-3.5 flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-surface-sunken dark:bg-dark-surface text-ink-secondary dark:text-dark-ink-secondary mt-0.5">
                    <Sparkles className="w-4 h-4 text-accent" />
                  </div>
                  <div>
                    <label
                      htmlFor="marketingAlertsToggle"
                      className="text-sm font-semibold text-ink-primary dark:text-dark-ink-primary block cursor-pointer"
                    >
                      النشرات الإعلانية والتسويقية (Marketing & Promotional Updates)
                    </label>
                    <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary mt-0.5">
                      استلام تحليلات المؤشرات العقارية، والفرص الاستثمارية الموسمية والنشرات البريدية.
                    </p>
                  </div>
                </div>
                <input
                  id="marketingAlertsToggle"
                  type="checkbox"
                  checked={marketingAlerts}
                  onChange={(e) => setMarketingAlerts(e.target.checked)}
                  className="w-5 h-5 rounded border-surface-border text-primary focus:ring-primary cursor-pointer"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Button type="submit" disabled={savingNotifications} className="gap-2">
                <Save className="w-4 h-4" />
                {savingNotifications ? 'جاري الحفظ...' : 'حفظ تفضيلات الإشعارات'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Card 4: Mandatory Regulatory & Security Alerts (Locked Guardrail A-09, FR-60) */}
      <Card className="p-6 sm:p-8 rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/20 dark:bg-amber-950/10 shadow-xs">
        <CardHeader className="p-0 mb-6 pb-4 border-b border-amber-200/60 dark:border-amber-900/40">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-amber-900 dark:text-amber-400">
              <ShieldCheck className="w-5 h-5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
              التنبيهات النظامية والأمنية الإلزامية (Mandatory Regulatory & Security Alerts)
            </CardTitle>
            <Badge variant="pending" size="sm" icon={<Lock className="w-3 h-3" />}>
              إلزامي ونظامي
            </Badge>
          </div>
          <p className="text-xs text-amber-900/80 dark:text-amber-300/80 mt-1 leading-relaxed">
            وفقاً لضوابط الهيئة العامة للعقار (REGA) ونظام التعاملات الإلكترونية السعودي، فإن تنبيهات الصفقات
            العقارية، ومواعيد مهلة السداد (نافذة الـ 48 ساعة)، ورموز التحقق الثنائية، والإشعارات الأمنية
            والنظامية مفعلة دائماً بشكل غير قابل للتعطيل لضمان سلامة التعاملات المالية وحماية حقوق المتعاقدين
            (A-09, FR-60).
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Mandatory Group 1: Deal Milestones */}
            <div className="p-3.5 rounded-xl border border-amber-200/60 dark:border-amber-900/40 bg-white/60 dark:bg-dark-surface/60 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <FileCheck2 className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-1 shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-ink-primary dark:text-dark-ink-primary">
                    محطات الصفقات والتسوية المالية
                  </h4>
                  <p className="text-[11px] text-ink-secondary dark:text-dark-ink-secondary mt-0.5 leading-snug">
                    إنشاء الصفقة، اعتماد إشعار التحويل، إتمام الشراء، أو إشعارات النزاع والتعليق.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                  مفعل دائماً
                </span>
              </div>
            </div>

            {/* Mandatory Group 2: Payment Deadline Countdown */}
            <div className="p-3.5 rounded-xl border border-amber-200/60 dark:border-amber-900/40 bg-white/60 dark:bg-dark-surface/60 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-1 shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-ink-primary dark:text-dark-ink-primary">
                    مهلة السداد المالي (48 ساعة)
                  </h4>
                  <p className="text-[11px] text-ink-secondary dark:text-dark-ink-secondary mt-0.5 leading-snug">
                    تنبيهات العد التنازلي الإلزامية قبل 12 ساعة وقبل ساعتين من انتهاء مهلة إيداع العربون.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                  مفعل دائماً
                </span>
              </div>
            </div>

            {/* Mandatory Group 3: Account Security & Step-Up */}
            <div className="p-3.5 rounded-xl border border-amber-200/60 dark:border-amber-900/40 bg-white/60 dark:bg-dark-surface/60 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-1 shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-ink-primary dark:text-dark-ink-primary">
                    أمان الحساب والتحقق ورموز الدخول
                  </h4>
                  <p className="text-[11px] text-ink-secondary dark:text-dark-ink-secondary mt-0.5 leading-snug">
                    تنبيهات الدخول من أجهزة جديدة، وتغيير كلمة المرور، وتحديث الجوال وإجراءات الحذف.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                  مفعل دائماً
                </span>
              </div>
            </div>

            {/* Mandatory Group 4: FAL Licensing & Compliance */}
            <div className="p-3.5 rounded-xl border border-amber-200/60 dark:border-amber-900/40 bg-white/60 dark:bg-dark-surface/60 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-1 shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-ink-primary dark:text-dark-ink-primary">
                    الامتثال والتراخيص العقارية
                  </h4>
                  <p className="text-[11px] text-ink-secondary dark:text-dark-ink-secondary mt-0.5 leading-snug">
                    صلاحية رخصة فال للوساطة العقارية وعقود الوساطة وحالة التوثيق المالي.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                  مفعل دائماً
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

