import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { EmptyState } from '../empty-state';
import { Button } from '../button';
import { Badge } from '../badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../card';

describe('Sovereign UI Primitives', () => {
  describe('EmptyState component (AC 5)', () => {
    it('should render institutional zero-result layout with title and description', () => {
      const html = renderToString(
        React.createElement(EmptyState, {
          title: 'لا توجد نتائج مطابقة',
          description: 'يرجى تجربة معايير بحث أخرى أو إعادة ضبط الفلاتر للحصول على نتائج.',
          actionLabel: 'إعادة ضبط الفلاتر',
          secondaryActionLabel: 'تصفح كل العقارات',
        })
      );

      expect(html).toContain('لا توجد نتائج مطابقة');
      expect(html).toContain('يرجى تجربة معايير بحث أخرى أو إعادة ضبط الفلاتر');
      expect(html).toContain('إعادة ضبط الفلاتر');
      expect(html).toContain('تصفح كل العقارات');
      // Sunken surface class check
      expect(html).toContain('bg-surface-sunken');
    });

    it('should render custom icon container when provided', () => {
      const html = renderToString(
        React.createElement(EmptyState, {
          title: 'سجل الطلبات فارغ',
          description: 'لم تقم بإرسال أي طلب شراء حتى الآن.',
          icon: React.createElement('span', { id: 'custom-icon' }, '★'),
        })
      );

      expect(html).toContain('سجل الطلبات فارغ');
      expect(html).toContain('custom-icon');
    });
  });

  describe('Button primitive (AC 6)', () => {
    it('should render primary variant with default styles', () => {
      const html = renderToString(
        React.createElement(Button, { variant: 'primary', size: 'md' }, 'تأكيد الحجز')
      );
      expect(html).toContain('تأكيد الحجز');
      expect(html).toContain('bg-primary');
    });

    it('should render secondary, outline, ghost, and danger variants', () => {
      const secondaryHtml = renderToString(
        React.createElement(Button, { variant: 'secondary' }, 'تراجع')
      );
      expect(secondaryHtml).toContain('تراجع');

      const dangerHtml = renderToString(
        React.createElement(Button, { variant: 'danger' }, 'حذف')
      );
      expect(dangerHtml).toContain('bg-status-danger');
    });

    it('should display loading spinner when isLoading is true', () => {
      const html = renderToString(
        React.createElement(Button, { isLoading: true }, 'جاري المعالجة')
      );
      expect(html).toContain('animate-spin');
      expect(html).toContain('disabled');
    });
  });

  describe('Badge primitive (AC 6)', () => {
    it('should render verified status variant with correct colors', () => {
      const html = renderToString(
        React.createElement(Badge, { variant: 'verified' }, 'معتمد من فال')
      );
      expect(html).toContain('معتمد من فال');
      expect(html).toContain('bg-status-verifiedBg');
    });

    it('should render pending, danger, info, and neutral variants', () => {
      const pendingHtml = renderToString(
        React.createElement(Badge, { variant: 'pending' }, 'قيد المراجعة')
      );
      expect(pendingHtml).toContain('bg-status-pendingBg');

      const dangerHtml = renderToString(
        React.createElement(Badge, { variant: 'danger' }, 'مرفوض')
      );
      expect(dangerHtml).toContain('bg-status-dangerBg');
    });
  });

  describe('Card primitive (AC 6)', () => {
    it('should render composite card with header, title, content and footer', () => {
      const html = renderToString(
        React.createElement(
          Card,
          { hoverEffect: true },
          React.createElement(CardHeader, null,
            React.createElement(CardTitle, null, 'فيلا راقية بحي الملقا'),
            React.createElement(CardDescription, null, 'مساحة ٤٥٠ م٢')
          ),
          React.createElement(CardContent, null, 'تفاصيل العقار'),
          React.createElement(CardFooter, null, 'السعر: ٣,٥٠٠,٠٠٠ ر.س')
        )
      );

      expect(html).toContain('فيلا راقية بحي الملقا');
      expect(html).toContain('مساحة ٤٥٠ م٢');
      expect(html).toContain('تفاصيل العقار');
      expect(html).toContain('السعر: ٣,٥٠٠,٠٠٠ ر.س');
      expect(html).toContain('luxury-card');
    });
  });
});
