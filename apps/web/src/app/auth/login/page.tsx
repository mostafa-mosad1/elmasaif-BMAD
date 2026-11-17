import React from 'react';
import Link from 'next/link';
import { Metadata } from 'next';
import { Building2, ShieldCheck } from 'lucide-react';
import { LayoutShell } from '../../../components/layout/layout-shell';
import { Card, CardHeader, CardContent, CardFooter } from '../../../components/ui/card';
import { LoginForm } from '../../../components/auth/login-form';

export const metadata: Metadata = {
  title: 'تسجيل الدخول | منصة المصايف العقارية',
  description: 'تسجيل الدخول إلى منصة المصايف للصفقات العقارية المعتمدة والمنظمة برخصة فال'
};

export default function LoginPage() {
  return (
    <LayoutShell containerClassName="flex items-center justify-center py-10 sm:py-16">
      <div className="w-full max-w-lg">
        <Card className="p-6 sm:p-8 border-surface-border dark:border-dark-surface-border shadow-level2">
          <CardHeader className="text-center space-y-3 mb-6">
            <div className="mx-auto w-14 h-14 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-md">
              <Building2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-ink-primary dark:text-dark-ink-primary tracking-tight">
                تسجيل الدخول إلى منصة المصايف
              </h1>
              <p className="text-sm text-ink-secondary dark:text-dark-ink-secondary">
                منصة الصفقات العقارية المؤسسية المعتمدة برخصة فال
              </p>
            </div>

            <div className="pt-1 flex items-center justify-center gap-1.5 text-xs text-accent font-medium">
              <ShieldCheck className="w-4 h-4 text-accent" />
              <span>دخول آمن عبر الجلسات المعتمدة ورمز التحقق الإضافي</span>
            </div>
          </CardHeader>

          <CardContent>
            <React.Suspense fallback={<div className="h-48 flex items-center justify-center"><div className="w-8 h-8 border-3 border-primary/20 border-t-primary rounded-full animate-spin" /></div>}>
              <LoginForm />
            </React.Suspense>
          </CardContent>

          <CardFooter className="justify-center border-t border-surface-border dark:border-dark-surface-border pt-6 mt-6">
            <p className="text-sm text-ink-secondary dark:text-dark-ink-secondary">
              ليس لديك حساب؟{' '}
              <Link
                href="/auth/register"
                className="font-bold text-primary hover:text-primary-hover underline underline-offset-4 transition-colors"
              >
                إنشاء حساب جديد
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </LayoutShell>
  );
}

