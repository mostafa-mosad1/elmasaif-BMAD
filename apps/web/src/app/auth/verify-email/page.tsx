'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { VerifyEmailView } from '../../../components/auth/verify-email-view';
import { apiClient, ApiError } from '../../../lib/api-client';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [state, setState] = useState<'loading' | 'success' | 'error'>('loading');
  const [verifiedEmail, setVerifiedEmail] = useState<string | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [errorCode, setErrorCode] = useState<string | undefined>();

  useEffect(() => {
    if (!token) {
      setState('error');
      setErrorMessage(
        'رابط التحقق غير مكتمل أو مفقود. يرجى التأكد من الضغط على الرابط كاملاً من بريدك الإلكتروني.'
      );
      return;
    }

    let isMounted = true;

    apiClient<{
      code: string;
      message: string;
      data: { email: string; emailVerifiedAt: string };
    }>('/users/email/verify', {
      method: 'POST',
      body: JSON.stringify({ token })
    })
      .then((res) => {
        if (isMounted) {
          setState('success');
          setVerifiedEmail(res.data?.email);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setState('error');
          if (err instanceof ApiError) {
            setErrorCode(err.code);
            if (err.code === 'AUTH_EMAIL_VERIFICATION_EXPIRED') {
              setErrorMessage(
                'انتهت صلاحية رابط التحقق (24 ساعة). يرجى تسجيل الدخول وطلب رابط جديد من إعدادات الحساب.'
              );
            } else if (err.code === 'AUTH_EMAIL_VERIFICATION_STALE') {
              setErrorMessage('تم إلغاء هذا الطلب أو تم تحديث البريد الإلكتروني بطلب أحدث.');
            } else if (err.code === 'AUTH_EMAIL_IN_USE') {
              setErrorMessage('البريد الإلكتروني مستخدم بالفعل في حساب آخر.');
            } else {
              setErrorMessage(err.message || 'رابط التحقق غير صالح أو قد تم التلاعب به.');
            }
          } else {
            setErrorMessage('تعذر الاتصال بالخادم لإتمام التحقق من البريد الإلكتروني.');
          }
        }
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  return (
    <VerifyEmailView
      state={state}
      verifiedEmail={verifiedEmail}
      errorMessage={errorMessage}
      errorCode={errorCode}
    />
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<VerifyEmailView state="loading" />}>
      <VerifyEmailContent />
    </Suspense>
  );
}

