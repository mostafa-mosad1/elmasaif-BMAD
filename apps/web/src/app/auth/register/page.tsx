import React from 'react';
import { Metadata } from 'next';
import { AuthPageLayout } from '../../../components/auth/auth-page-layout';
import { RegisterForm } from '../../../components/auth/register-form';

export const metadata: Metadata = {
  title: 'إنشاء حساب جديد | منصة المصايف العقارية',
  description: 'سجّل حسابك في منصة المصايف للصفقات العقارية المعتمدة والمنظمة برخصة فال'
};

export default function RegisterPage() {
  return (
    <AuthPageLayout
      mode="register"
      title="إنشاء حساب جديد في المصايف"
      subtitle="سجل بياناتك المعتمدة للبدء في إدارة وعرض الصفقات وتوثيق العقود والرخص"
    >
      <RegisterForm />
    </AuthPageLayout>
  );
}
