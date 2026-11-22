import React from 'react';
import { Metadata } from 'next';
import { AuthPageLayout } from '../../../components/auth/auth-page-layout';
import { LoginForm } from '../../../components/auth/login-form';

export const metadata: Metadata = {
  title: 'تسجيل الدخول | منصة المصايف العقارية',
  description: 'تسجيل الدخول إلى منصة المصايف للصفقات العقارية المعتمدة والمنظمة برخصة فال'
};

export default function LoginPage() {
  return (
    <AuthPageLayout
      mode="login"
      title="تسجيل الدخول إلى منصة المصايف"
      subtitle="أدخل بيانات الدخول المعتمدة لمتابعة صفقاتك العقارية ومتابعة العروض والرخص"
    >
      <React.Suspense
        fallback={
          <div className="h-48 flex items-center justify-center">
            <div className="w-8 h-8 border-3 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        }
      >
        <LoginForm />
      </React.Suspense>
    </AuthPageLayout>
  );
}
