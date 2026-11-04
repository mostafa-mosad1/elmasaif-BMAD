'use client';

import React, { useState } from 'react';
import {
  PropertyType,
  PROPERTY_TYPE_LABELS_AR,
  createDemandSchema,
  DEMAND_EXPIRY_DAYS,
} from '@elmasaif/shared';
import { FileQuestion } from 'lucide-react';
import { CityDistrictSelector } from '../geo';
import { Button, Card, CardContent, CardHeader, CardTitle } from '../ui';
import { apiClient, ApiError } from '../../lib/api-client';
import { BuyerDemandItem } from './demand-item';

export interface DemandSubmitFormProps {
  onSubmitted?: (demand: BuyerDemandItem) => void;
}

type FieldErrors = Partial<Record<string, string>>;

const inputClass =
  'w-full px-3.5 py-2.5 rounded-lg border-[1.5px] border-surface-border dark:border-dark-surface-border bg-white dark:bg-dark-surface-base text-sm text-ink-primary dark:text-dark-ink-primary focus:outline-none focus:ring-2 focus:ring-primary';

const labelClass =
  'block text-sm font-medium text-ink-primary dark:text-dark-ink-primary mb-1.5';

/**
 * Structured demand submission (Story 3.6 / FR-21, AD-9). Geography comes only from the
 * cascading `CityDistrictSelector` (city required, district optional) — no free-text city
 * is ever sent. Client-side validation reuses the shared `createDemandSchema` so the rules
 * (and Arabic messages) match the API exactly.
 */
export function DemandSubmitForm({ onSubmitted }: DemandSubmitFormProps) {
  const [propertyType, setPropertyType] = useState<PropertyType>(PropertyType.VILLA);
  const [cityId, setCityId] = useState<string | null>(null);
  const [districtId, setDistrictId] = useState<string | null>(null);
  const [minBudget, setMinBudget] = useState('');
  const [maxBudget, setMaxBudget] = useState('');
  const [minArea, setMinArea] = useState('');
  const [maxArea, setMaxArea] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const buildPayload = () => ({
    propertyType,
    cityId,
    districtId: districtId || null,
    minBudget: minBudget.trim(),
    maxBudget: maxBudget.trim(),
    minArea: minArea.trim() === '' ? undefined : Number(minArea),
    maxArea: maxArea.trim() === '' ? undefined : Number(maxArea),
    notes: notes.trim() ? notes.trim() : null,
  });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setServerError(null);

    const payload = buildPayload();
    const parsed = createDemandSchema.safeParse(payload);
    if (!parsed.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? 'form');
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setSubmitting(true);

    try {
      const response = await apiClient.post<{ statusCode: number; data: BuyerDemandItem }>(
        '/demands',
        parsed.data,
      );
      const created = (response?.data ?? (response as unknown as BuyerDemandItem)) as BuyerDemandItem;
      setPropertyType(PropertyType.VILLA);
      setCityId(null);
      setDistrictId(null);
      setMinBudget('');
      setMaxBudget('');
      setMinArea('');
      setMaxArea('');
      setNotes('');
      onSubmitted?.(created);
    } catch (err) {
      setServerError(
        err instanceof ApiError && err.message
          ? err.message
          : 'تعذر حفظ طلب الشراء. يرجى المحاولة مرة أخرى.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card data-testid="demand-submit-form">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileQuestion className="w-4 h-4 text-primary" />
          <span>إعلان طلب شراء عقار</span>
        </CardTitle>
        <p className="text-xs text-ink-muted dark:text-dark-ink-muted">
          يُنشر الطلب فوراً لمدة {DEMAND_EXPIRY_DAYS} يوماً ويصل للمطابقين المؤهلين دون حاجة لموافقة الإدارة.
        </p>
      </CardHeader>

      <CardContent>
        <form className="space-y-5" onSubmit={handleSubmit} dir="rtl">
          <CityDistrictSelector
            selectedCityId={cityId}
            selectedDistrictId={districtId}
            onCityChange={setCityId}
            onDistrictChange={setDistrictId}
            required
            cityLabel="المدينة"
            districtLabel="الحي (اختياري)"
            cityError={errors.cityId}
            districtError={errors.districtId}
          />

          <div>
            <label htmlFor="demand-property-type" className={labelClass}>
              نوع العقار <span className="text-red-500">*</span>
            </label>
            <select
              id="demand-property-type"
              value={propertyType}
              onChange={(e) => setPropertyType(e.target.value as PropertyType)}
              className={inputClass}
              data-testid="demand-property-type"
            >
              {Object.values(PropertyType).map((type) => (
                <option key={type} value={type}>
                  {PROPERTY_TYPE_LABELS_AR[type] || type}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="demand-min-budget" className={labelClass}>
                أدنى ميزانية (ر.س)
              </label>
              <input
                id="demand-min-budget"
                type="text"
                inputMode="decimal"
                value={minBudget}
                onChange={(e) => setMinBudget(e.target.value)}
                placeholder="800000"
                className={inputClass}
                data-testid="demand-min-budget"
              />
            </div>
            <div>
              <label htmlFor="demand-max-budget" className={labelClass}>
                أقصى ميزانية (ر.س)
              </label>
              <input
                id="demand-max-budget"
                type="text"
                inputMode="decimal"
                value={maxBudget}
                onChange={(e) => setMaxBudget(e.target.value)}
                placeholder="1500000"
                className={inputClass}
                data-testid="demand-max-budget"
              />
              {errors.maxBudget ? (
                <p className="mt-1 text-xs text-red-500 font-medium">{errors.maxBudget}</p>
              ) : null}
            </div>
          </div>
          {errors.minBudget ? (
            <p className="-mt-3 text-xs text-red-500 font-medium">{errors.minBudget}</p>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="demand-min-area" className={labelClass}>
                أدنى مساحة (م²)
              </label>
              <input
                id="demand-min-area"
                type="number"
                min="1"
                step="1"
                value={minArea}
                onChange={(e) => setMinArea(e.target.value)}
                placeholder="250"
                className={inputClass}
                data-testid="demand-min-area"
              />
            </div>
            <div>
              <label htmlFor="demand-max-area" className={labelClass}>
                أقصى مساحة (م²)
              </label>
              <input
                id="demand-max-area"
                type="number"
                min="1"
                step="1"
                value={maxArea}
                onChange={(e) => setMaxArea(e.target.value)}
                placeholder="450"
                className={inputClass}
                data-testid="demand-max-area"
              />
              {errors.maxArea ? (
                <p className="mt-1 text-xs text-red-500 font-medium">{errors.maxArea}</p>
              ) : null}
            </div>
          </div>
          {errors.minArea ? (
            <p className="-mt-3 text-xs text-red-500 font-medium">{errors.minArea}</p>
          ) : null}

          <div>
            <label htmlFor="demand-notes" className={labelClass}>
              مواصفات إضافية (اختياري)
            </label>
            <textarea
              id="demand-notes"
              rows={3}
              maxLength={1000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: فيلا شمال الطائف مع حوش واسع"
              className={`${inputClass} resize-none`}
              data-testid="demand-notes"
            />
            <div className="flex items-center justify-between text-[11px] text-ink-muted dark:text-dark-ink-muted mt-1">
              <span>{errors.notes}</span>
              <span>{notes.length}/1000</span>
            </div>
          </div>

          {serverError ? (
            <div
              role="alert"
              className="rounded-xl border border-status-rejected/20 bg-status-rejected/10 p-3 text-sm text-status-rejected"
              data-testid="demand-submit-error"
            >
              {serverError}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-3">
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={submitting}
              data-testid="demand-submit-btn"
            >
              {submitting ? 'جاري حفظ الطلب...' : 'نشر طلب الشراء'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
