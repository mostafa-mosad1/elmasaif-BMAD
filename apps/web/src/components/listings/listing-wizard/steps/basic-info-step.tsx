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
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">البيانات الأساسية للعقار</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          حدد نوع العقار وتفاصيله الفنية الأساسية بدقة لجذب المشترين الجادين.
        </p>
      </div>

      {/* Property Type Grid Selector */}
      <div>
        <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">
          نوع العقار <span className="text-red-500">*</span>
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
                    ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-bold shadow-sm'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800'
                }`}
              >
                <div className={`mb-2 ${isSelected ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                  {icon}
                </div>
                <span className="text-sm">{label}</span>
              </button>
            );
          })}
        </div>
        {errors.propertyType && <p className="text-xs text-red-500 mt-1">{errors.propertyType}</p>}
      </div>

      {/* Title Input */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <label htmlFor="listing-title" className="block text-sm font-semibold text-slate-800 dark:text-slate-200">
            عنوان الإعلان <span className="text-red-500">*</span>
          </label>
          <span className="text-xs text-slate-400">
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
          className={`w-full px-4 py-2.5 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-2 ${
            errors.title
              ? 'border-red-500 focus:ring-red-200'
              : 'border-slate-300 dark:border-slate-700 focus:border-emerald-600 focus:ring-emerald-100 dark:bg-slate-800 dark:text-white'
          }`}
        />
        {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title}</p>}
      </div>

      {/* Description Textarea */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <label htmlFor="listing-description" className="block text-sm font-semibold text-slate-800 dark:text-slate-200">
            الوصف التفصيلي <span className="text-red-500">*</span>
          </label>
          <span className="text-xs text-slate-400">
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
          className={`w-full px-4 py-2.5 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-2 resize-y ${
            errors.description
              ? 'border-red-500 focus:ring-red-200'
              : 'border-slate-300 dark:border-slate-700 focus:border-emerald-600 focus:ring-emerald-100 dark:bg-slate-800 dark:text-white'
          }`}
        />
        {errors.description && <p className="text-xs text-red-500 mt-1">{errors.description}</p>}
      </div>

      {/* Technical Specifications Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Area Square Meters */}
        <div>
          <label htmlFor="area-sqm" className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">
            المساحة (م²) <span className="text-red-500">*</span>
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
            className={`w-full px-4 py-2.5 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-2 ${
              errors.areaSquareMeters
                ? 'border-red-500 focus:ring-red-200'
                : 'border-slate-300 dark:border-slate-700 focus:border-emerald-600 focus:ring-emerald-100 dark:bg-slate-800 dark:text-white'
            }`}
          />
          {errors.areaSquareMeters && <p className="text-xs text-red-500 mt-1">{errors.areaSquareMeters}</p>}
        </div>

        {/* Bedrooms Counter - strictly no bathrooms */}
        <div>
          <label htmlFor="bedrooms-count" className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">
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
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-sm transition-colors focus:outline-none focus:ring-2 focus:border-emerald-600 focus:ring-emerald-100 dark:bg-slate-800 dark:text-white pr-9"
            />
            <BedDouble className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          </div>
          {errors.bedrooms && <p className="text-xs text-red-500 mt-1">{errors.bedrooms}</p>}
        </div>

        {/* Year Built */}
        <div>
          <label htmlFor="year-built" className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">
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
            className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-sm transition-colors focus:outline-none focus:ring-2 focus:border-emerald-600 focus:ring-emerald-100 dark:bg-slate-800 dark:text-white"
          />
          {errors.yearBuilt && <p className="text-xs text-red-500 mt-1">{errors.yearBuilt}</p>}
        </div>
      </div>
    </div>
  );
}

