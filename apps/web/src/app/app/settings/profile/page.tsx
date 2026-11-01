import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck, Building2, KeyRound, Smartphone } from 'lucide-react';
import { Button } from '../../../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card';
import { ProfileEditor } from '../../../../components/auth/profile-editor';

export default function ProfileSettingsPage() {
  return (
    <div dir="rtl" className="space-y-8">
      {/* Breadcrumbs & Header */}
      <div>
        <nav className="flex items-center gap-2 text-xs text-ink-tertiary mb-2" aria-label="Breadcrumb">
          <Link href="/app" className="hover:text-primary transition">
            لوحة التحكم
          </Link>
          <span>/</span>
          <span className="text-ink-secondary">إعدادات الحساب</span>
          <span>/</span>
          <span className="text-ink-primary font-medium">البيانات الشخصية</span>
        </nav>
        <h1 className="text-2xl font-bold text-ink-primary dark:text-dark-ink-primary">
          إعدادات الحساب
        </h1>
        <p className="mt-1 text-sm text-ink-secondary dark:text-dark-ink-secondary">
          إدارة الاسم والبريد الإلكتروني والبيانات المعتمدة والمتطلبات النظامية.
        </p>
      </div>

      {/* Main Profile Editor Form Card */}
      <section aria-labelledby="profile-editor-heading">
        <ProfileEditor />
      </section>

      {/* Preserved Sub-navigation Cards */}
      <section className="space-y-4 pt-4 border-t border-border/40">
        <h2 className="text-lg font-semibold text-ink-primary dark:text-dark-ink-primary">
          إجراءات الأمان والتحقق والخدمات المالية
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <Smartphone className="h-5 w-5 text-primary" aria-hidden="true" />
                رقم الجوال المعتمد
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-ink-secondary dark:text-dark-ink-secondary">
                تحديث رقم الجوال المسجل بحسابك عبر التحقق المزدوج الآمن.
              </p>
              <Link href="/app/settings/mobile">
                <Button variant="outline" className="gap-2">
                  تحديث رقم الجوال
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <KeyRound className="h-5 w-5 text-primary" aria-hidden="true" />
                كلمة المرور والأمان
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-ink-secondary dark:text-dark-ink-secondary">
                تغيير كلمة المرور وتأمين حسابك وإدارة الجلسات النشطة عبر الأجهزة.
              </p>
              <Link href="/app/settings/password">
                <Button variant="outline" className="gap-2">
                  إدارة كلمة المرور
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
                التحقق من الهوية
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-ink-secondary dark:text-dark-ink-secondary">
                ارفع هويتك الوطنية أو الإقامة لإتمام التعاملات المالية في المنصة.
              </p>
              <Link href="/app/settings/identity">
                <Button className="gap-2">
                  توثيق الهوية
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <Building2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                حسابات التحويل البنكي (IBAN)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-ink-secondary dark:text-dark-ink-secondary">
                إدارة وتوثيق حسابات الآيبان السعودية المعتمدة لاستلام عوائد المبيعات والسعي العقاري.
              </p>
              <Link href="/app/settings/payout">
                <Button variant="outline" className="gap-2">
                  إدارة الحسابات البنكية
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
