import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { AdminLoginForm } from '../../../components/admin/admin-login-form';

export const metadata: Metadata = {
  title: 'بوابة الإدارة السيادية | منصة المصايف العقارية',
  description: 'بوابة تسجيل دخول المشرفين ومنسوبي إدارة منصة المصايف العقارية المعتمدة برخصة فال',
};

export default function AdminLoginPage() {
  return (
    <div
      dir="rtl"
      className="min-h-screen flex flex-col justify-between bg-[#F8F9FA] dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100 py-6 sm:py-10 px-4 transition-colors"
    >
      {/* Top Bar: Brand Logo & Return Home */}
      <header className="w-full max-w-[440px] mx-auto flex items-center justify-between mb-4 sm:mb-6">
        <Link href="/" className="inline-flex items-center group focus:outline-none">
          <img
            src="/images/logo-header.png"
            alt="المصايف"
            className="h-10 w-auto object-contain transition-transform group-hover:scale-105"
          />
        </Link>

        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white py-2 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:shadow-xs transition-all"
        >
          <span>الرئيسية</span>
          <ArrowLeft className="w-3.5 h-3.5" />
        </Link>
      </header>

      {/* Main Content: Clean Centered Card */}
      <main className="w-full max-w-[440px] mx-auto my-auto">
        <AdminLoginForm />
      </main>

      {/* Empty bottom spacer to keep the card perfectly centered vertically */}
      <div className="w-full max-w-[440px] mx-auto h-8" />
    </div>
  );
}
