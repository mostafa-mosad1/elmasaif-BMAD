'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { LayoutShell } from '../../../components/layout/layout-shell';
import { Card, Button, Badge } from '../../../components/ui';
import {
  Phone,
  Mail,
  MapPin,
  Clock,
  Send,
  CheckCircle2,
  HelpCircle,
  ShieldCheck,
  Building2,
  MessageSquare,
  ArrowRight,
  FileCheck,
} from 'lucide-react';

export default function ContactSupportPage() {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [userRole, setUserRole] = useState('BUYER');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !phone || !message) return;

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSubmitted(true);
    }, 600);
  };

  return (
    <LayoutShell>
      <div className="max-w-6xl mx-auto py-10 px-4 sm:px-6 lg:px-8 space-y-12" dir="rtl">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-ink-muted dark:text-dark-ink-muted">
          <Link href="/" className="hover:text-primary transition-colors">
            الرئيسية
          </Link>
          <span>/</span>
          <span className="text-ink-primary dark:text-dark-ink-primary font-medium">
            مركز مساعدة المستفيدين وقنوات الاتصال
          </span>
        </div>

        {/* Hero Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2">
            <Badge
              variant="verified"
              size="md"
              icon={<ShieldCheck className="w-4 h-4 text-accent" />}
            >
              قنوات خدمة العملاء المعتمدة رسمياً
            </Badge>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-ink-primary dark:text-dark-ink-primary tracking-tight">
            مركز مساعدة المستفيدين وقنوات الاتصال
          </h1>
          <p className="text-sm sm:text-base text-ink-secondary dark:text-dark-ink-secondary leading-relaxed">
            فريق متخصص من خبراء الدعم الفني والامتثال العقاري متواجد للإجابة عن استفساراتكم وتقديم الدعم المباشر لكافة أطراف الصفقات العقارية.
          </p>
        </div>

        {/* Contact Info Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="p-6 space-y-3 border-surface-border dark:border-dark-surface-border shadow-xs hover:border-primary/40 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Phone className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary">
              الهاتف الموحد
            </h3>
            <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary">
              مركز الاتصال وخدمة العملاء الموحد لجميع مناطق المملكة.
            </p>
            <div className="pt-2">
              <a
                href="tel:920000000"
                dir="ltr"
                className="text-sm font-bold text-primary hover:underline font-mono inline-block"
              >
                9200 00000
              </a>
            </div>
          </Card>

          <Card className="p-6 space-y-3 border-surface-border dark:border-dark-surface-border shadow-xs hover:border-primary/40 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Mail className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary">
              البريد الإلكتروني
            </h3>
            <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary">
              فريق الدعم الفني والامتثال القانوني والمالي.
            </p>
            <div className="pt-2">
              <a
                href="mailto:support@elmasaif.com"
                className="text-xs font-semibold text-primary hover:underline font-mono"
              >
                support@elmasaif.com
              </a>
            </div>
          </Card>

          <Card className="p-6 space-y-3 border-surface-border dark:border-dark-surface-border shadow-xs hover:border-primary/40 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <MapPin className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary">
              المقر الرئيسي
            </h3>
            <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary">
              طريق الملك فهد، حي الصحافة، الرياض، المملكة العربية السعودية.
            </p>
            <div className="pt-2 text-[11px] text-ink-muted">
              العنوان الوطني المسجل
            </div>
          </Card>

          <Card className="p-6 space-y-3 border-surface-border dark:border-dark-surface-border shadow-xs hover:border-primary/40 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-accent-light text-accent-dark flex items-center justify-center">
              <Clock className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary">
              أوقات العمل الرسمية
            </h3>
            <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary">
              الأحد إلى الخميس: 8:00 صباحاً – 6:00 مساءً
            </p>
            <div className="pt-2 text-xs font-semibold text-accent-dark dark:text-accent">
              دعم فوري للطوارئ 24/7
            </div>
          </Card>
        </div>

        {/* Contact Form Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7 bg-surface dark:bg-dark-surface-raised rounded-2xl border border-surface-border dark:border-dark-surface-border p-6 sm:p-8 shadow-sm">
            <div className="space-y-2 mb-6">
              <h2 className="text-xl font-bold text-ink-primary dark:text-dark-ink-primary flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                <span>إرسال استفسار أو بلاغ مباشر</span>
              </h2>
              <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary">
                املأ النموذج التالي وسيصلك الرد الرسمي من ممثلي خدمة العملاء في أقرب وقت.
              </p>
            </div>

            {isSubmitted ? (
              <div className="py-12 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-accent/15 text-accent-dark dark:bg-accent/20 dark:text-accent flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-ink-primary dark:text-dark-ink-primary">
                  تم استلام رسالتك بنجاح
                </h3>
                <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary max-w-sm mx-auto">
                  شكراً لتواصلك معنا. رقم التذكرة تم إرساله إلى جوالك وسيتم الرد خلال ساعات العمل الرسمية.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsSubmitted(false);
                    setFullName('');
                    setPhone('');
                    setEmail('');
                    setMessage('');
                    setSubject('');
                  }}
                >
                  إرسال استفسار آخر
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-ink-secondary dark:text-dark-ink-secondary">
                      الاسم الكامل <span className="text-status-danger">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="أدخل اسمك الكريم"
                      className="w-full bg-surface-sunken dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border rounded-lg px-3.5 py-2.5 text-xs text-ink-primary dark:text-dark-ink-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-ink-secondary dark:text-dark-ink-secondary">
                      رقم الجوال <span className="text-status-danger">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      dir="ltr"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+966 5X XXX XXXX"
                      className="w-full bg-surface-sunken dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border rounded-lg px-3.5 py-2.5 text-xs text-ink-primary dark:text-dark-ink-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-ink-secondary dark:text-dark-ink-secondary">
                      البريد الإلكتروني
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full bg-surface-sunken dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border rounded-lg px-3.5 py-2.5 text-xs text-ink-primary dark:text-dark-ink-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-ink-secondary dark:text-dark-ink-secondary">
                      صفتك في المنصة
                    </label>
                    <select
                      value={userRole}
                      onChange={(e) => setUserRole(e.target.value)}
                      className="w-full bg-surface-sunken dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border rounded-lg px-3.5 py-2.5 text-xs text-ink-primary dark:text-dark-ink-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="BUYER">مشتري / باحث عن عقار</option>
                      <option value="OWNER">مالك عقار مباشر</option>
                      <option value="MARKETER">وسيط / مسوق عقاري مرخص</option>
                      <option value="OTHER">أخرى</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-ink-secondary dark:text-dark-ink-secondary">
                    موضوع الرسالة
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="مثال: استفسار عن توثيق رخصة فال / استفسار عن صفقة"
                    className="w-full bg-surface-sunken dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border rounded-lg px-3.5 py-2.5 text-xs text-ink-primary dark:text-dark-ink-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-ink-secondary dark:text-dark-ink-secondary">
                    نص الرسالة أو الاستفسار <span className="text-status-danger">*</span>
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="اكتب تفاصيل استفسارك أو طلبك هنا..."
                    className="w-full bg-surface-sunken dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border rounded-lg p-3.5 text-xs text-ink-primary dark:text-dark-ink-primary focus:outline-none focus:ring-2 focus:ring-primary/20 leading-relaxed"
                  />
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={isSubmitting}
                  className="w-full py-3"
                >
                  <Send className="w-4 h-4" />
                  <span>{isSubmitting ? 'جارٍ الإرسال...' : 'إرسال الاستفسار الآن'}</span>
                </Button>
              </form>
            )}
          </div>

          {/* Quick Help & FAQ Links */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-surface-sunken dark:bg-dark-surface-sunken rounded-2xl border border-surface-border dark:border-dark-surface-border p-6 space-y-4">
              <h3 className="text-base font-bold text-ink-primary dark:text-dark-ink-primary flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-accent" />
                <span>روابط وإرشادات سريعة</span>
              </h3>
              <p className="text-xs text-ink-secondary dark:text-dark-ink-secondary leading-relaxed">
                قد تجد إجابة استفسارك بشكل فوري عبر أحد الأدلة المعتمدة التالية:
              </p>

              <div className="space-y-2.5 pt-2">
                <Link
                  href="/pages/faq"
                  className="flex items-center justify-between p-3 rounded-xl bg-surface dark:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border hover:border-primary/40 text-xs font-bold text-ink-primary transition-colors group"
                >
                  <span className="flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-primary" />
                    الأسئلة الشائعة والمتكررة
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-ink-muted group-hover:text-primary transition-colors rotate-180" />
                </Link>

                <Link
                  href="/pages/rega-licenses"
                  className="flex items-center justify-between p-3 rounded-xl bg-surface dark:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border hover:border-primary/40 text-xs font-bold text-ink-primary transition-colors group"
                >
                  <span className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-accent" />
                    تراخيص الهيئة العامة للعقار
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-ink-muted group-hover:text-primary transition-colors rotate-180" />
                </Link>

                <Link
                  href="/pages/marketer-guide"
                  className="flex items-center justify-between p-3 rounded-xl bg-surface dark:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border hover:border-primary/40 text-xs font-bold text-ink-primary transition-colors group"
                >
                  <span className="flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-blue-600" />
                    دليل الوسيط والمسوق العقاري
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-ink-muted group-hover:text-primary transition-colors rotate-180" />
                </Link>

                <Link
                  href="/pages/buyer-guide"
                  className="flex items-center justify-between p-3 rounded-xl bg-surface dark:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border hover:border-primary/40 text-xs font-bold text-ink-primary transition-colors group"
                >
                  <span className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-purple-600" />
                    دليل المشتري والمستثمر العقاري
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-ink-muted group-hover:text-primary transition-colors rotate-180" />
                </Link>
              </div>
            </div>

            {/* Regulatory Notice Banner */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs text-ink-secondary dark:text-dark-ink-secondary space-y-1.5">
              <div className="font-bold text-primary flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                <span>حماية الخصوصية والبيانات</span>
              </div>
              <p className="leading-relaxed text-[11px]">
                كافة المحادثات والمراسلات مشفرة وخاضعة لضوابط الهيئة الوطنية للأمن السيبراني ونظام حماية البيانات الشخصية بالمملكة.
              </p>
            </div>
          </div>
        </div>
      </div>
    </LayoutShell>
  );
}

