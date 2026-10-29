'use client';

import React from 'react';
import { Button } from '../ui/button';
import { ShieldCheck, X } from 'lucide-react';

export interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TermsModal({ isOpen, onClose }: TermsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface-base dark:bg-dark-surface-base border border-surface-border dark:border-dark-surface-border rounded-card max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl text-ink-primary dark:text-dark-ink-primary overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border dark:border-dark-surface-border">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <h3 className="text-base sm:text-lg font-bold">
              شروط الاستخدام وسياسة حماية البيانات (PDPL)
            </h3>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1 rounded-DEFAULT text-ink-muted hover:text-ink-primary hover:bg-surface-sunken dark:hover:bg-dark-surface-raised transition-colors"
            aria-label="إغلاق النافذة"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-sm leading-relaxed text-ink-secondary dark:text-dark-ink-secondary">
          <section className="space-y-2">
            <h4 className="font-bold text-ink-primary dark:text-dark-ink-primary text-base">
              أولاً: شروط الاستخدام والوساطة العقارية المنظمة
            </h4>
            <p>
              منصة المصايف هي منصة وساطة عقارية مؤسسية تعمل بموجب الأنظمة واللوائح الصادرة عن الهيئة العامة للعقار بالمملكة العربية السعودية، وتلتزم بالضوابط التنظيمية لممارسة أنشطة الوساطة والتسويق العقاري (نظام الوساطة العقارية ولائحته التنفيذية).
            </p>
            <p>
              يقر المستخدم بأن جميع المعلومات المدخلة بما فيها الاسم الكامل ورقم الهوية الوطنية أو الإقامة ورقم الجوال صحيحة ومطابقة للسجلات الرسمية، ويتحمل كامل المسؤولية النظامية عن أي بيانات غير دقيقة.
            </p>
          </section>

          <section className="space-y-2">
            <h4 className="font-bold text-ink-primary dark:text-dark-ink-primary text-base">
              ثانياً: سياسة حماية البيانات الشخصية وفقاً لنظام (PDPL) السعودي
            </h4>
            <p>
              التزاماً بنظام حماية البيانات الشخصية الصادر بالمرسوم الملكي رقم (م/19) وتعديلاته ولائحته التنفيذية، تلتزم منصة المصايف بحماية خصوصية بياناتك ومعالجتها بالوسائل المشروعة والنظامية فقط:
            </p>
            <ul className="list-disc list-inside space-y-1 ps-2">
              <li>يتم جمع البيانات الشخصية (الاسم، الهوية، الجوال، البريد، الحساب البنكي) لأغراض التحقق النظامي وتنفيذ الصفقات العقارية والامتثال لمتطلبات هيئة العقار وهيئة الزكاة والضريبة والجمارك.</li>
              <li>تُحفظ كافة البيانات داخل النطاق الجغرافي والسيادي للمملكة العربية السعودية على خوادم آمنة ومحمية، ولا تُنقل خارج المملكة إلا وفق الضوابط والاشتراطات النظامية المعتمدة.</li>
              <li>يحق للمستخدم طلب الوصول إلى بياناته الشخصية، أو تصحيحها، أو إتلافها بما لا يتعارض مع التزامات المنصة النظامية بحفظ السجلات المالية والتعاقدية المنصوص عليها نظاماً.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h4 className="font-bold text-ink-primary dark:text-dark-ink-primary text-base">
              ثالثاً: تسجيل الموافقة القانونية الصريحة
            </h4>
            <p>
              تأكيد التسجيل والموافقة على هذه الشروط يُعد موافقة صريحة موثقة قانونياً يتم تسجيلها إلكترونياً وتوثيقها ببيانات الطابع الزمني الموحد (Timestamp) وعنوان بروتوكول الإنترنت (IP) ومعرّف الجهاز وفقاً لنظام التعاملات الإلكترونية ونظام حماية البيانات الشخصية.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-surface-border dark:border-dark-surface-border flex justify-end">
          <Button variant="primary" size="md" onClick={onClose}>
            فهمت وموافق
          </Button>
        </div>
      </div>
    </div>
  );
}

