import type { Metadata } from 'next';
import './globals.css';
import { AppProviders } from '../components/providers';

export const metadata: Metadata = {
  title: 'المصايف | منصة الصفقات العقارية المعتمدة في المملكة العربية السعودية',
  description: 'سوق عقاري مؤسسي موثوق لبيع وشراء العقارات في المملكة العربية السعودية تحت إشراف الهيئة العامة للعقار ورخص فال المعتمدة.',
  keywords: ['عقارات السعودية', 'صفقات عقارية', 'رخصة فال', 'فلل للبيع الرياض', 'أراضي للبيع جدة', 'منصة المصايف'],
  openGraph: {
    title: 'المصايف | منصة الصفقات العقارية المعتمدة',
    description: 'الوساطة العقارية المؤسسية الموثوقة بالمملكة العربية السعودية.',
    locale: 'ar_SA',
    type: 'website',
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className="min-h-screen flex flex-col bg-surface-background dark:bg-dark-background text-ink-primary dark:text-dark-ink-primary font-sans antialiased transition-colors duration-200"
      >
        <AppProviders>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
