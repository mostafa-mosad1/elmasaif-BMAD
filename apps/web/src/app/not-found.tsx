import React from 'react';
import Link from 'next/link';
import { LayoutShell } from '../components/layout/layout-shell';
import { Button } from '../components/ui/button';

export default function NotFound() {
  return (
    <LayoutShell containerClassName="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-extrabold text-ink-primary dark:text-dark-ink-primary">404</h1>
        <h2 className="text-xl font-bold text-ink-secondary dark:text-dark-ink-secondary">
          الصفحة المطلوبة غير موجودة
        </h2>
        <p className="text-sm text-ink-tertiary dark:text-dark-ink-tertiary max-w-md mx-auto">
          عذراً، لم نتمكن من العثور على الصفحة التي تبحث عنها. قد تكون الصفحة قد حُذفت أو تم نقلها.
        </p>
        <div className="pt-4">
          <Link href="/">
            <Button variant="primary">العودة للرئيسية</Button>
          </Link>
        </div>
      </div>
    </LayoutShell>
  );
}

