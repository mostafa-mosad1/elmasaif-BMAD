'use client';

import React from 'react';
import { MapPin, Navigation, Compass } from 'lucide-react';
import { CityDistrictSelector } from '../../../geo/city-district-selector';
import { SAUDI_BOUNDS } from '@elmasaif/shared';
import { ListingWizardFormState } from '../types';

interface LocationStepProps {
  formData: ListingWizardFormState;
  updateForm: (updates: Partial<ListingWizardFormState>) => void;
  errors: Record<string, string>;
}

export function LocationStep({ formData, updateForm, errors }: LocationStepProps) {
  const isLatValid =
    formData.latitude !== '' &&
    Number(formData.latitude) >= SAUDI_BOUNDS.minLat &&
    Number(formData.latitude) <= SAUDI_BOUNDS.maxLat;

  const isLngValid =
    formData.longitude !== '' &&
    Number(formData.longitude) >= SAUDI_BOUNDS.minLng &&
    Number(formData.longitude) <= SAUDI_BOUNDS.maxLng;

  const handleUseCurrentLocation = () => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          updateForm({
            latitude: Number(position.coords.latitude.toFixed(6)),
            longitude: Number(position.coords.longitude.toFixed(6)),
          });
        },
        () => {
          // Fallback or permission denied
        },
      );
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">الموقع الجغرافي للعقار</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          اختر المدينة والحي من القوائم الرسمية المعتمدة وحدد الإحداثيات الدقيقة لموقع العقار.
        </p>
      </div>

      {/* Cascading City and District Selector */}
      <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
        <CityDistrictSelector
          selectedCityId={formData.cityId || null}
          selectedDistrictId={formData.districtId || null}
          onCityChange={(cityId) => updateForm({ cityId: cityId || '', districtId: '' })}
          onDistrictChange={(districtId) => updateForm({ districtId: districtId || '' })}
          cityError={errors.cityId}
          districtError={errors.districtId}
          required
        />
      </div>

      {/* Street Name Input (Optional) */}
      <div>
        <label htmlFor="street-name" className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">
          اسم الشارع (اختياري)
        </label>
        <div className="relative">
          <input
            id="street-name"
            type="text"
            maxLength={150}
            value={formData.streetName}
            onChange={(e) => updateForm({ streetName: e.target.value })}
            placeholder="مثال: شارع العليا العام / طريق أنس بن مالك"
            className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-sm transition-colors focus:outline-none focus:ring-2 focus:border-emerald-600 focus:ring-emerald-100 dark:bg-slate-800 dark:text-white"
          />
          <Compass className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
        </div>
        {errors.streetName && <p className="text-xs text-red-500 mt-1">{errors.streetName}</p>}
      </div>

      {/* Geographic Coordinates with Saudi Range Validation */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-white dark:bg-slate-850">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div>
            <label className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              إحداثيات الموقع على الخريطة <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              ضمن النطاق الجغرافي للمملكة العربية السعودية (العرض: 16.0 - 32.5 | الطول: 34.5 - 55.7)
            </p>
          </div>
          <button
            type="button"
            onClick={handleUseCurrentLocation}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-lg border border-emerald-200 dark:border-emerald-800 transition-colors w-fit"
          >
            <Navigation className="w-3.5 h-3.5" />
            تحديد موقعي الحالي
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="listing-lat" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              خط العرض (Latitude) <span className="text-red-500">*</span>
            </label>
            <input
              id="listing-lat"
              type="number"
              step="any"
              value={formData.latitude}
              onChange={(e) => updateForm({ latitude: e.target.value ? Number(e.target.value) : '' })}
              placeholder="مثال: 24.7136"
              className={`w-full px-3 py-2 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-2 ${
                errors.latitude || (formData.latitude !== '' && !isLatValid)
                  ? 'border-red-500 focus:ring-red-200'
                  : 'border-slate-300 dark:border-slate-700 focus:border-emerald-600 focus:ring-emerald-100 dark:bg-slate-800 dark:text-white'
              }`}
            />
            {errors.latitude && <p className="text-xs text-red-500 mt-1">{errors.latitude}</p>}
          </div>

          <div>
            <label htmlFor="listing-lng" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              خط الطول (Longitude) <span className="text-red-500">*</span>
            </label>
            <input
              id="listing-lng"
              type="number"
              step="any"
              value={formData.longitude}
              onChange={(e) => updateForm({ longitude: e.target.value ? Number(e.target.value) : '' })}
              placeholder="مثال: 46.6753"
              className={`w-full px-3 py-2 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-2 ${
                errors.longitude || (formData.longitude !== '' && !isLngValid)
                  ? 'border-red-500 focus:ring-red-200'
                  : 'border-slate-300 dark:border-slate-700 focus:border-emerald-600 focus:ring-emerald-100 dark:bg-slate-800 dark:text-white'
              }`}
            />
            {errors.longitude && <p className="text-xs text-red-500 mt-1">{errors.longitude}</p>}
          </div>
        </div>

        {isLatValid && isLngValid && (
          <div className="mt-3 p-2.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 rounded-lg flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300">
            <span>تم التحقق من صحة الإحداثيات الجغرافية داخل المملكة العربية السعودية.</span>
            <span className="font-mono font-semibold" dir="ltr">
              {Number(formData.latitude).toFixed(4)}, {Number(formData.longitude).toFixed(4)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
