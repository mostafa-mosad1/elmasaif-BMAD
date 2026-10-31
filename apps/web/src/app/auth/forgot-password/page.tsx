import React from 'react';
import Link from 'next/link';
import { Metadata } from 'next';
import { KeyRound } from 'lucide-react';
import { LayoutShell } from '../../../components/layout/layout-shell';
import { Card, CardHeader, CardContent, CardFooter } from '../../../components/ui/card';
import { ForgotPasswordForm } from '../../../components/auth/forgot-password-form';

export const metadata: Metadata = {
  title: 'استعادة كلمة المرور | منصة المصايف العقارية',
  description: 'استعادة كلمة المرور عبر التحقق المعتمد بالهاتف لمنصة المصايف'
};

export default function ForgotPasswordPage() {
  return (
    <LayoutShell containerClassName="flex items-center justify-center py-10 sm:py-16">
      <div className="w-full max-w-lg">
        <Card className="p-6 sm:p-8 border-surface-border dark:border-dark-surface-border shadow-level2">
          <CardHeader className="text-center space-y-3 mb-6">
            <div className="mx-auto w-14 h-14 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-md">
              <KeyRound className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-ink-primary dark:text-dark-ink-primary tracking-tight">
                استعادة كلمة المرور
              </h1>
              <p className="text-sm text-ink-secondary dark:text-dark-ink-secondary">
                منصة الصفقات العقارية المؤسسية المعتمدة برخصة فال
              </p>
            </div>
          </CardHeader>

          <CardContent>
            <ForgotPasswordForm />
          </CardContent>

          <CardFooter className="justify-center border-t border-surface-border dark:border-dark-surface-border pt-6 mt-6">
            <p className="text-sm text-ink-secondary dark:text-dark-ink-secondary">
              تذكرت كلمة المرور؟{' '}
              <Link
                href="/auth/login"
                className="font-bold text-primary hover:text-primary-hover underline underline-offset-4 transition-colors"
              >
                تسجيل الدخول
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </LayoutShell>
  );
}

