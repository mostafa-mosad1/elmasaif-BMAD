'use client';

import React from 'react';
import { Home, Building2, Trees, Landmark, Store, BedDouble } from 'lucide-react';
import { PropertyType } from '@elmasaif/shared';
import { ListingWizardFormState } from '../types';

interface BasicInfoStepProps {
  formData: ListingWizardFormState;
  updateForm: (updates: Partial<ListingWizardFormState>) => void;
  errors: Record<string, string>;
}

const PROPERTY_TYPES: Array<{
  type: PropertyType;
  label: string;
  icon: React.ReactNode;
}> = [
  { type: PropertyType.VILLA, label: 'فيلا', icon: <Home className="w-6 h-6" /> },
  { type: PropertyType.APARTMENT, label: 'شقة', icon: <Building2 className="w-6 h-6" /> },
  { type: PropertyType.LAND, label: 'أرض', icon: <Landmark className="w-6 h-6" /> },
  { type: PropertyType.BUILDING, label: 'عمارة', icon: <Building2 className="w-6 h-6" /> },
  { type: PropertyType.COMMERCIAL, label: 'تجاري / مكاتب', icon: <Store className="w-6 h-6" /> },
  { type: PropertyType.FARM, label: 'مزرعة', icon: <Trees className="w-6 h-6" /> },
];

export function BasicInfoStep({ formData, updateForm, errors }: BasicInfoStepProps) {
  const currentYear = new Date().getFullYear();

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h2 className="text-xl font-bold text-ink-primary dark:text-dark-ink-primary">البيانات الأساسية للعقار</h2>
        <p className="text-sm text-ink-secondary dark:text-dark-ink-secondary mt-1">
          حدد نوع العقار وتفاصيله الفنية الأساسية بدقة لجذب المشترين الجادين.
        </p>
      </div>

      {/* Property Type Grid Selector */}
      <div>
        <label className="block text-sm font-semibold text-ink-primary dark:text-dark-ink-primary mb-2">
          نوع العقار <span className="text-status-danger">*</span>
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {PROPERTY_TYPES.map(({ type, label, icon }) => {
            const isSelected = formData.propertyType === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => updateForm({ propertyType: type })}
                className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                  isSelected
                    ? 'border-accent bg-accent-light/40 dark:bg-amber-950/30 text-accent-dark dark:text-accent font-bold shadow-sm'
                    : 'border-surface-border dark:border-dark-surface-border hover:border-surface-borderStrong dark:hover:border-dark-surface-borderStrong text-ink-secondary dark:text-dark-ink-secondary bg-surface-sunken dark:bg-dark-surface-raised'
                }`}
              >
                <div className={`mb-2 ${isSelected ? 'text-accent' : 'text-ink-muted dark:text-dark-ink-muted'}`}>
                  {icon}
                </div>
                <span className="text-sm">{label}</span>
              </button>
            );
          })}
        </div>
        {errors.propertyType && <p className="text-xs text-status-danger mt-1">{errors.propertyType}</p>}
      </div>

      {/* Title Input */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <label htmlFor="listing-title" className="block text-sm font-semibold text-ink-primary dark:text-dark-ink-primary">
            عنوان الإعلان <span className="text-status-danger">*</span>
          </label>
          <span className="text-xs text-ink-muted dark:text-dark-ink-muted">
            {formData.title.length} / 150 حرفاً (الحد الأدنى 5)
          </span>
        </div>
        <input
          id="listing-title"
          type="text"
          value={formData.title}
          maxLength={150}
          onChange={(e) => updateForm({ title: e.target.value })}
          placeholder="مثال: فيلا فاخرة بتصميم مودرن في حي النرجس"
          className={`w-full px-4 py-2.5 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-2 bg-surface-sunken dark:bg-dark-surface-sunken text-ink-primary dark:text-dark-ink-primary placeholder:text-ink-muted dark:placeholder:text-dark-ink-muted ${
            errors.title
              ? 'border-status-danger focus:ring-status-danger/20'
              : 'border-surface-border dark:border-dark-surface-border focus:border-accent focus:ring-accent/20'
          }`}
        />
        {errors.title && <p className="text-xs text-status-danger mt-1">{errors.title}</p>}
      </div>

      {/* Description Textarea */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <label htmlFor="listing-description" className="block text-sm font-semibold text-ink-primary dark:text-dark-ink-primary">
            الوصف التفصيلي <span className="text-status-danger">*</span>
          </label>
          <span className="text-xs text-ink-muted dark:text-dark-ink-muted">
            {formData.description.length} / 3000 حرفاً (الحد الأدنى 10)
          </span>
        </div>
        <textarea
          id="listing-description"
          rows={5}
          maxLength={3000}
          value={formData.description}
          onChange={(e) => updateForm({ description: e.target.value })}
          placeholder="اكتب وصفاً شاملاً يبرز مزايا العقار والموقع والتشطيبات وتوفر الخدمات والضمانات..."
          className={`w-full px-4 py-2.5 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-2 resize-y bg-surface-sunken dark:bg-dark-surface-sunken text-ink-primary dark:text-dark-ink-primary placeholder:text-ink-muted dark:placeholder:text-dark-ink-muted ${
            errors.description
              ? 'border-status-danger focus:ring-status-danger/20'
              : 'border-surface-border dark:border-dark-surface-border focus:border-accent focus:ring-accent/20'
          }`}
        />
        {errors.description && <p className="text-xs text-status-danger mt-1">{errors.description}</p>}
      </div>

      {/* Technical Specifications Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Area Square Meters */}
        <div>
          <label htmlFor="area-sqm" className="block text-sm font-semibold text-ink-primary dark:text-dark-ink-primary mb-1">
            المساحة (م²) <span className="text-status-danger">*</span>
          </label>
          <input
            id="area-sqm"
            type="number"
            min={1}
            max={10000000}
            step="any"
            value={formData.areaSquareMeters}
            onChange={(e) => updateForm({ areaSquareMeters: e.target.value ? Number(e.target.value) : '' })}
            placeholder="مثال: 450"
            className={`w-full px-4 py-2.5 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-2 bg-surface-sunken dark:bg-dark-surface-sunken text-ink-primary dark:text-dark-ink-primary placeholder:text-ink-muted dark:placeholder:text-dark-ink-muted ${
              errors.areaSquareMeters
                ? 'border-status-danger focus:ring-status-danger/20'
                : 'border-surface-border dark:border-dark-surface-border focus:border-accent focus:ring-accent/20'
            }`}
          />
          {errors.areaSquareMeters && <p className="text-xs text-status-danger mt-1">{errors.areaSquareMeters}</p>}
        </div>

        {/* Bedrooms Counter - strictly no bathrooms */}
        <div>
          <label htmlFor="bedrooms-count" className="block text-sm font-semibold text-ink-primary dark:text-dark-ink-primary mb-1">
            عدد غرف النوم (اختياري)
          </label>
          <div className="relative">
            <input
              id="bedrooms-count"
              type="number"
              min={0}
              max={100}
              value={formData.bedrooms}
              onChange={(e) => updateForm({ bedrooms: e.target.value ? Number(e.target.value) : '' })}
              placeholder="0"
              className="w-full px-4 py-2.5 rounded-lg border border-surface-border dark:border-dark-surface-border bg-surface-sunken dark:bg-dark-surface-sunken text-ink-primary dark:text-dark-ink-primary placeholder:text-ink-muted dark:placeholder:text-dark-ink-muted text-sm transition-colors focus:outline-none focus:ring-2 focus:border-accent focus:ring-accent/20 pr-9"
            />
            <BedDouble className="w-4 h-4 text-ink-muted dark:text-dark-ink-muted absolute left-3 top-3" />
          </div>
          {errors.bedrooms && <p className="text-xs text-status-danger mt-1">{errors.bedrooms}</p>}
        </div>

        {/* Year Built */}
        <div>
          <label htmlFor="year-built" className="block text-sm font-semibold text-ink-primary dark:text-dark-ink-primary mb-1">
            سنة البناء (اختياري)
          </label>
          <input
            id="year-built"
            type="number"
            min={1900}
            max={currentYear + 1}
            value={formData.yearBuilt}
            onChange={(e) => updateForm({ yearBuilt: e.target.value ? Number(e.target.value) : '' })}
            placeholder={String(currentYear)}
            className="w-full px-4 py-2.5 rounded-lg border border-surface-border dark:border-dark-surface-border bg-surface-sunken dark:bg-dark-surface-sunken text-ink-primary dark:text-dark-ink-primary placeholder:text-ink-muted dark:placeholder:text-dark-ink-muted text-sm transition-colors focus:outline-none focus:ring-2 focus:border-accent focus:ring-accent/20"
          />
          {errors.yearBuilt && <p className="text-xs text-status-danger mt-1">{errors.yearBuilt}</p>}
        </div>
      </div>
    </div>
  );
}

