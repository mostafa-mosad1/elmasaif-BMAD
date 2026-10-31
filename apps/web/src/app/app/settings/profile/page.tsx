import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck, Building2 } from 'lucide-react';
import { Button } from '../../../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card';

export default function ProfileSettingsPage() {
  return (
    <div dir="rtl" className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-ink-primary dark:text-dark-ink-primary">إعدادات الحساب</h1>
        <p className="mt-1 text-sm text-ink-secondary dark:text-dark-ink-secondary">
          إدارة معلومات الحساب والمتطلبات المالية والتحقق.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
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
            <CardTitle className="flex items-center gap-2">
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
    </div>
  );
}
