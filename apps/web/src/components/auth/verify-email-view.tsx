'use client';

import React from 'react';
import Link from 'next/link';
import { CheckCircle2, AlertCircle, Loader2, ArrowLeft, MailCheck } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';

export interface VerifyEmailViewProps {
  state: 'loading' | 'success' | 'error';
  verifiedEmail?: string;
  errorMessage?: string;
  errorCode?: string;
}

export function VerifyEmailView({
  state,
  verifiedEmail,
  errorMessage
}: VerifyEmailViewProps) {
  return (
    <div dir="rtl" className="min-h-[60vh] flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-md border-border">
        {state === 'loading' && (
          <CardContent className="pt-10 pb-10 text-center space-y-4">
            <div className="flex justify-center">
              <div className="relative">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              </div>
            </div>
            <h2 className="text-lg font-bold text-ink-primary dark:text-dark-ink-primary">
              جاري التحقق من صلاحية رابط البريد الإلكتروني...
            </h2>
            <p className="text-sm text-ink-secondary dark:text-dark-ink-secondary">
              يرجى الانتظار بينما نؤكد ملكية بريدك الإلكتروني ونربطه بحسابك.
            </p>
          </CardContent>
        )}

        {state === 'success' && (
          <CardContent className="pt-8 pb-8 text-center space-y-5">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center">
                <CheckCircle2 className="h-9 w-9 text-emerald-500" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-ink-primary dark:text-dark-ink-primary">
                تم تأكيد البريد الإلكتروني بنجاح
              </h2>
              <p className="text-sm text-ink-secondary dark:text-dark-ink-secondary leading-relaxed">
                أصبح بريدك الإلكتروني الجديد معتمداً ورسمياً لاستلام إشعارات الصفقات والوثائق التعاقدية.
              </p>
              {verifiedEmail && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted text-xs font-mono text-ink-primary">
                  <MailCheck className="h-3.5 w-3.5 text-emerald-600" />
                  <span>{verifiedEmail}</span>
                </div>
              )}
            </div>
            <div className="pt-2 flex flex-col gap-2">
              <Link href="/app/settings/profile">
                <Button className="w-full gap-2">
                  الذهاب إلى إعدادات الحساب
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        )}

        {state === 'error' && (
          <CardContent className="pt-8 pb-8 text-center space-y-5">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-center justify-center">
                <AlertCircle className="h-9 w-9 text-rose-500" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-ink-primary dark:text-dark-ink-primary">
                تعذر التحقق من البريد الإلكتروني
              </h2>
              <p className="text-sm text-rose-600 dark:text-rose-400 font-medium leading-relaxed">
                {errorMessage || 'رابط التحقق غير صالح أو قد انتهت صلاحيته.'}
              </p>
            </div>
            <div className="pt-2 flex flex-col gap-2">
              <Link href="/app/settings/profile">
                <Button variant="outline" className="w-full gap-2">
                  العودة إلى إعدادات الحساب
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/auth/login">
                <Button variant="ghost" className="w-full text-xs text-ink-secondary">
                  تسجيل الدخول بحساب آخر
                </Button>
              </Link>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
