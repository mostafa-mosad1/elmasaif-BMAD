'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  MapPin,
  Plus,
  Search,
  Building,
  CheckCircle2,
  AlertCircle,
  X,
  ChevronLeft
} from 'lucide-react';
import {
  AdminCityListItem,
  AdminDistrictListItem,
  createCitySchema,
  createDistrictSchema
} from '@elmasaif/shared';
import { apiClient } from '../../../lib/api-client';

interface AdminGeoPageProps {
  initialCities?: AdminCityListItem[];
  initialSelectedCityId?: string | null;
  initialDistricts?: AdminDistrictListItem[];
}

export default function AdminGeoPage({
  initialCities,
  initialSelectedCityId = null,
  initialDistricts
}: AdminGeoPageProps) {
  const [cities, setCities] = useState<AdminCityListItem[]>(initialCities || []);
  const [selectedCityId, setSelectedCityId] = useState<string | null>(initialSelectedCityId);
  const [districts, setDistricts] = useState<AdminDistrictListItem[]>(initialDistricts || []);

  const [loadingCities, setLoadingCities] = useState(!initialCities);
  const [loadingDistricts, setLoadingDistricts] = useState(false);

  const [citySearch, setCitySearch] = useState('');
  const [districtSearch, setDistrictSearch] = useState('');

  // Modals state
  const [showAddCityModal, setShowAddCityModal] = useState(false);
  const [showAddDistrictModal, setShowAddDistrictModal] = useState(false);

  // Modal form states
  const [cityForm, setCityForm] = useState({ nameAr: '', nameEn: '', isActive: true });
  const [cityFormErrors, setCityFormErrors] = useState<Record<string, string>>({});
  const [submittingCity, setSubmittingCity] = useState(false);

  const [districtForm, setDistrictForm] = useState({ nameAr: '', nameEn: '', isActive: true });
  const [districtFormErrors, setDistrictFormErrors] = useState<Record<string, string>>({});
  const [submittingDistrict, setSubmittingDistrict] = useState(false);

  // Toast / Feedback state
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4000);
  };

  // Fetch cities on mount
  useEffect(() => {
    if (initialCities) return;
    setLoadingCities(true);
    apiClient
      .get<AdminCityListItem[]>('/admin/geo/cities')
      .then((data) => {
        setCities(data || []);
      })
      .catch((err) => {
        showToast('error', err.message || 'فشل في تحميل قائمة المدن');
      })
      .finally(() => {
        setLoadingCities(false);
      });
  }, [initialCities]);

  // Fetch districts when selectedCityId changes
  useEffect(() => {
    if (!selectedCityId) {
      setDistricts([]);
      return;
    }
    if (initialDistricts && initialSelectedCityId === selectedCityId) {
      setDistricts(initialDistricts);
      return;
    }

    setLoadingDistricts(true);
    apiClient
      .get<AdminDistrictListItem[]>(`/admin/geo/cities/${selectedCityId}/districts`)
      .then((data) => {
        setDistricts(data || []);
      })
      .catch((err) => {
        showToast('error', err.message || 'فشل في تحميل قائمة الأحياء');
      })
      .finally(() => {
        setLoadingDistricts(false);
      });
  }, [selectedCityId, initialDistricts, initialSelectedCityId]);

  const selectedCity = useMemo(
    () => cities.find((c) => c.id === selectedCityId) || null,
    [cities, selectedCityId]
  );

  // Search filters
  const filteredCities = useMemo(() => {
    const term = citySearch.trim().toLowerCase();
    if (!term) return cities;
    return cities.filter(
      (c) =>
        c.nameAr.toLowerCase().includes(term) ||
        c.nameEn.toLowerCase().includes(term)
    );
  }, [cities, citySearch]);

  const filteredDistricts = useMemo(() => {
    const term = districtSearch.trim().toLowerCase();
    if (!term) return districts;
    return districts.filter(
      (d) =>
        d.nameAr.toLowerCase().includes(term) ||
        d.nameEn.toLowerCase().includes(term)
    );
  }, [districts, districtSearch]);

  // City active toggle
  const handleToggleCity = async (cityId: string, currentActive: boolean) => {
    const newStatus = !currentActive;
    // Optimistic update
    setCities((prev) =>
      prev.map((c) => (c.id === cityId ? { ...c, isActive: newStatus } : c))
    );

    try {
      await apiClient.patch(`/admin/geo/cities/${cityId}`, { isActive: newStatus });
      showToast('success', 'تم تحديث حالة التفعيل بنجاح');
    } catch (err: any) {
      // Revert optimistic update
      setCities((prev) =>
        prev.map((c) => (c.id === cityId ? { ...c, isActive: currentActive } : c))
      );
      showToast('error', err.message || 'فشل في تحديث حالة المدينة');
    }
  };

  // District active toggle
  const handleToggleDistrict = async (districtId: string, currentActive: boolean) => {
    const newStatus = !currentActive;
    // Optimistic update
    setDistricts((prev) =>
      prev.map((d) => (d.id === districtId ? { ...d, isActive: newStatus } : d))
    );

    try {
      await apiClient.patch(`/admin/geo/districts/${districtId}`, { isActive: newStatus });
      showToast('success', 'تم تحديث حالة التفعيل بنجاح');
    } catch (err: any) {
      // Revert optimistic update
      setDistricts((prev) =>
        prev.map((d) => (d.id === districtId ? { ...d, isActive: currentActive } : d))
      );
      showToast('error', err.message || 'فشل في تحديث حالة الحي');
    }
  };

  // Submit new city
  const handleCreateCity = async (e: React.FormEvent) => {
    e.preventDefault();
    setCityFormErrors({});

    const parseResult = createCitySchema.safeParse(cityForm);
    if (!parseResult.success) {
      const errors: Record<string, string> = {};
      parseResult.error.errors.forEach((err) => {
        if (err.path[0]) errors[err.path[0] as string] = err.message;
      });
      setCityFormErrors(errors);
      return;
    }

    setSubmittingCity(true);
    try {
      const createdCity = await apiClient.post<AdminCityListItem>(
        '/admin/geo/cities',
        parseResult.data
      );
      const formattedCity: AdminCityListItem = {
        ...createdCity,
        _count: { districts: 0 },
        activeDistrictsCount: 0,
        inactiveDistrictsCount: 0
      };
      setCities((prev) => [...prev, formattedCity].sort((a, b) => a.nameAr.localeCompare(b.nameAr)));
      setShowAddCityModal(false);
      setCityForm({ nameAr: '', nameEn: '', isActive: true });
      showToast('success', 'تمت إضافة المدينة بنجاح');
      setSelectedCityId(createdCity.id);
    } catch (err: any) {
      showToast('error', err.message || 'فشل في إضافة المدينة');
    } finally {
      setSubmittingCity(false);
    }
  };

  // Submit new district
  const handleCreateDistrict = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCityId) return;
    setDistrictFormErrors({});

    const payload = {
      cityId: selectedCityId,
      nameAr: districtForm.nameAr,
      nameEn: districtForm.nameEn,
      isActive: districtForm.isActive
    };

    const parseResult = createDistrictSchema.safeParse(payload);
    if (!parseResult.success) {
      const errors: Record<string, string> = {};
      parseResult.error.errors.forEach((err) => {
        if (err.path[0]) errors[err.path[0] as string] = err.message;
      });
      setDistrictFormErrors(errors);
      return;
    }

    setSubmittingDistrict(true);
    try {
      const createdDistrict = await apiClient.post<AdminDistrictListItem>(
        '/admin/geo/districts',
        parseResult.data
      );
      setDistricts((prev) =>
        [...prev, createdDistrict].sort((a, b) => a.nameAr.localeCompare(b.nameAr))
      );
      // Update city counts
      setCities((prev) =>
        prev.map((c) =>
          c.id === selectedCityId
            ? {
                ...c,
                _count: { districts: c._count.districts + 1 },
                activeDistrictsCount:
                  c.activeDistrictsCount + (createdDistrict.isActive ? 1 : 0),
                inactiveDistrictsCount:
                  c.inactiveDistrictsCount + (!createdDistrict.isActive ? 1 : 0)
              }
            : c
        )
      );
      setShowAddDistrictModal(false);
      setDistrictForm({ nameAr: '', nameEn: '', isActive: true });
      showToast('success', 'تمت إضافة الحي بنجاح');
    } catch (err: any) {
      showToast('error', err.message || 'فشل في إضافة الحي');
    } finally {
      setSubmittingDistrict(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6" dir="rtl">
      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium transition-all ${
            toast.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200'
              : 'bg-red-50 dark:bg-red-950/80 border-red-300 dark:border-red-700 text-red-800 dark:text-red-200'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
          )}
          <span>{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="p-1 hover:opacity-70 rounded-full"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="text-xs text-ink-muted flex items-center gap-1.5">
        <Link href="/admin/dashboard" className="hover:text-primary transition-colors">
          لوحة التحكم الإدارية
        </Link>
        <ChevronLeft className="w-3.5 h-3.5" />
        <span>البيانات الأساسية</span>
        <ChevronLeft className="w-3.5 h-3.5" />
        <span className="text-ink-primary dark:text-dark-ink-primary font-medium">
          إدارة المدن والأحياء
        </span>
      </nav>

      {/* Page Header */}
      <div className="border-b border-surface-border dark:border-dark-surface-border pb-5">
        <h1 className="text-2xl font-bold text-ink-primary dark:text-dark-ink-primary flex items-center gap-2.5">
          <MapPin className="w-6 h-6 text-primary" />
          إدارة البيانات الجغرافية الرئيسية (المناطق، المدن، والأحياء)
        </h1>
        <p className="mt-2 text-sm text-ink-secondary dark:text-dark-ink-secondary max-w-3xl leading-relaxed">
          إدارة وتحديث المدن والأحياء في المملكة العربية السعودية، والتحكم في حالة التفعيل والإيقاف لضمان ارتباط العقارات والطلبات ببيانات جغرافية معتمدة دون المساس بسجلات المعاملات التاريخية.
        </p>
      </div>

      {/* Master-Detail Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left/Master: Cities Table (7 cols on lg) */}
        <div className="lg:col-span-7 bg-white dark:bg-dark-surface-base border border-surface-border dark:border-dark-surface-border rounded-xl shadow-sm overflow-hidden flex flex-col">
          {/* Table Header Controls */}
          <div className="p-4 border-b border-surface-border dark:border-dark-surface-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-background dark:bg-dark-surface-sunken">
            <div className="flex items-center gap-2">
              <Building className="w-5 h-5 text-primary" />
              <h2 className="font-semibold text-ink-primary dark:text-dark-ink-primary text-base">
                المدن السعودية
              </h2>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                {cities.length}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowAddCityModal(true)}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-medium shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة مدينة جديدة</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="p-3 border-b border-surface-border dark:border-dark-surface-border bg-white dark:bg-dark-surface-base">
            <div className="relative">
              <Search className="w-4 h-4 text-ink-muted absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={citySearch}
                onChange={(e) => setCitySearch(e.target.value)}
                placeholder="البحث في المدن..."
                className="w-full pr-9 pl-3 py-1.5 text-xs rounded-lg bg-surface-background dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border focus:outline-none focus:ring-1 focus:ring-primary text-ink-primary dark:text-dark-ink-primary"
              />
            </div>
          </div>

          {/* Cities Table */}
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-xs text-right border-collapse">
              <thead className="bg-surface-background dark:bg-dark-surface-sunken text-ink-secondary dark:text-dark-ink-secondary border-b border-surface-border dark:border-dark-surface-border sticky top-0">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">اسم المدينة</th>
                  <th className="py-2.5 px-3 font-semibold">الاسم بالإنجليزية</th>
                  <th className="py-2.5 px-3 font-semibold text-center">الأحياء</th>
                  <th className="py-2.5 px-3 font-semibold text-center">الحالة</th>
                  <th className="py-2.5 px-3 font-semibold text-center">التفعيل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border dark:divide-dark-surface-border">
                {loadingCities ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-ink-muted">
                      جاري تحميل المدن...
                    </td>
                  </tr>
                ) : filteredCities.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-ink-muted">
                      لا توجد مدن مسجلة أو مطابقة للبحث
                    </td>
                  </tr>
                ) : (
                  filteredCities.map((city) => {
                    const isSelected = city.id === selectedCityId;
                    return (
                      <tr
                        key={city.id}
                        onClick={() => setSelectedCityId(city.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-primary/10 dark:bg-primary/20 font-medium'
                            : 'hover:bg-surface-sunken/60 dark:hover:bg-dark-surface-sunken/60'
                        }`}
                      >
                        <td className="py-2.5 px-3 text-ink-primary dark:text-dark-ink-primary">
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                            <span>{city.nameAr}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-ink-secondary dark:text-dark-ink-secondary">
                          {city.nameEn}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="font-semibold text-ink-primary dark:text-dark-ink-primary">
                            {city._count?.districts ?? 0}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {city.isActive ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              نشط
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              معطل
                            </span>
                          )}
                        </td>
                        <td
                          className="py-2.5 px-3 text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <label className="inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={city.isActive}
                              onChange={() => handleToggleCity(city.id, city.isActive)}
                              className="sr-only peer"
                              aria-label={`تغيير حالة تفعيل مدينة ${city.nameAr}`}
                            />
                            <div className="w-8 h-4 bg-surface-borderStrong peer-focus:outline-none rounded-full peer dark:bg-dark-surface-border peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-surface-borderStrong after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-primary" />
                          </label>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right/Detail: Districts Table (5 cols on lg) */}
        <div className="lg:col-span-5 bg-white dark:bg-dark-surface-base border border-surface-border dark:border-dark-surface-border rounded-xl shadow-sm overflow-hidden flex flex-col">
          {!selectedCity ? (
            <div className="p-8 my-auto flex flex-col items-center justify-center text-center text-ink-muted">
              <MapPin className="w-12 h-12 text-ink-disabled dark:text-dark-ink-disabled mb-3 stroke-[1.5]" />
              <h3 className="font-semibold text-ink-secondary dark:text-dark-ink-secondary text-sm mb-1">
                اختر مدينة من القائمة لعرض وإدارة أحيائها
              </h3>
              <p className="text-xs max-w-xs">
                انقر فوق أي صف من جدول المدن على اليمين للتحكم في الأحياء التابعة لها وإضافة أحياء جديدة.
              </p>
            </div>
          ) : (
            <>
              {/* Detail Header Controls */}
              <div className="p-4 border-b border-surface-border dark:border-dark-surface-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-background dark:bg-dark-surface-sunken">
                <div>
                  <h2 className="font-semibold text-ink-primary dark:text-dark-ink-primary text-base">
                    {`أحياء مدينة ${selectedCity.nameAr}`}
                  </h2>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-ink-muted">
                    <span>{`إجمالي الأحياء: ${districts.length}`}</span>
                    <span>•</span>
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {`النشطة: ${districts.filter((d) => d.isActive).length}`}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAddDistrictModal(true)}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-medium shadow-sm transition-colors shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة حي جديد</span>
                </button>
              </div>

              {/* District Search */}
              <div className="p-3 border-b border-surface-border dark:border-dark-surface-border bg-white dark:bg-dark-surface-base">
                <div className="relative">
                  <Search className="w-4 h-4 text-ink-muted absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={districtSearch}
                    onChange={(e) => setDistrictSearch(e.target.value)}
                    placeholder="البحث في الأحياء..."
                    className="w-full pr-9 pl-3 py-1.5 text-xs rounded-lg bg-surface-background dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border focus:outline-none focus:ring-1 focus:ring-primary text-ink-primary dark:text-dark-ink-primary"
                  />
                </div>
              </div>

              {/* District Table */}
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-xs text-right border-collapse">
                  <thead className="bg-surface-background dark:bg-dark-surface-sunken text-ink-secondary dark:text-dark-ink-secondary border-b border-surface-border dark:border-dark-surface-border sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold">اسم الحي</th>
                      <th className="py-2.5 px-3 font-semibold">الاسم بالإنجليزية</th>
                      <th className="py-2.5 px-3 font-semibold text-center">الحالة</th>
                      <th className="py-2.5 px-3 font-semibold text-center">التفعيل</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border dark:divide-dark-surface-border">
                    {loadingDistricts ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-ink-muted">
                          جاري تحميل الأحياء...
                        </td>
                      </tr>
                    ) : filteredDistricts.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-ink-muted">
                          لا توجد أحياء مسجلة لهذه المدينة حالياً
                        </td>
                      </tr>
                    ) : (
                      filteredDistricts.map((district) => (
                        <tr
                          key={district.id}
                          className="hover:bg-surface-sunken/60 dark:hover:bg-dark-surface-sunken/60 transition-colors"
                        >
                          <td className="py-2.5 px-3 font-medium text-ink-primary dark:text-dark-ink-primary">
                            {district.nameAr}
                          </td>
                          <td className="py-2.5 px-3 text-ink-secondary dark:text-dark-ink-secondary">
                            {district.nameEn}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {district.isActive ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                نشط
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                معطل
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <label className="inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={district.isActive}
                                onChange={() => handleToggleDistrict(district.id, district.isActive)}
                                className="sr-only peer"
                                aria-label={`تغيير حالة تفعيل حي ${district.nameAr}`}
                              />
                              <div className="w-8 h-4 bg-surface-borderStrong peer-focus:outline-none rounded-full peer dark:bg-dark-surface-border peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-surface-borderStrong after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-primary" />
                            </label>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Add City Modal */}
      {showAddCityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-dark-surface-base border border-surface-border dark:border-dark-surface-border rounded-xl shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-surface-border dark:border-dark-surface-border flex items-center justify-between bg-surface-background dark:bg-dark-surface-sunken">
              <h3 className="font-semibold text-ink-primary dark:text-dark-ink-primary text-base">
                إضافة مدينة جديدة
              </h3>
              <button
                type="button"
                onClick={() => setShowAddCityModal(false)}
                className="p-1 rounded-full text-ink-muted hover:text-ink-primary hover:bg-surface-sunken"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCity} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink-primary dark:text-dark-ink-primary mb-1">
                  اسم المدينة بالعربية <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={cityForm.nameAr}
                  onChange={(e) => setCityForm({ ...cityForm, nameAr: e.target.value })}
                  placeholder="مثال: الرياض"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-surface-border dark:border-dark-surface-border bg-white dark:bg-dark-surface-base focus:ring-2 focus:ring-primary focus:outline-none text-ink-primary dark:text-dark-ink-primary"
                />
                {cityFormErrors.nameAr && (
                  <p className="mt-1 text-xs text-red-500 font-medium">{cityFormErrors.nameAr}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-primary dark:text-dark-ink-primary mb-1">
                  اسم المدينة بالإنجليزية <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={cityForm.nameEn}
                  onChange={(e) => setCityForm({ ...cityForm, nameEn: e.target.value })}
                  placeholder="مثال: Riyadh"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-surface-border dark:border-dark-surface-border bg-white dark:bg-dark-surface-base focus:ring-2 focus:ring-primary focus:outline-none text-ink-primary dark:text-dark-ink-primary"
                />
                {cityFormErrors.nameEn && (
                  <p className="mt-1 text-xs text-red-500 font-medium">{cityFormErrors.nameEn}</p>
                )}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="cityIsActive"
                  checked={cityForm.isActive}
                  onChange={(e) => setCityForm({ ...cityForm, isActive: e.target.checked })}
                  className="rounded border-surface-border text-primary focus:ring-primary w-4 h-4"
                />
                <label
                  htmlFor="cityIsActive"
                  className="text-xs text-ink-primary dark:text-dark-ink-primary cursor-pointer font-medium"
                >
                  تفعيل المدينة مباشرة لاستقبال العقارات والطلبات
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-border dark:border-dark-surface-border">
                <button
                  type="button"
                  onClick={() => setShowAddCityModal(false)}
                  className="px-3.5 py-1.5 text-xs font-medium rounded-lg border border-surface-border text-ink-secondary hover:bg-surface-sunken transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submittingCity}
                  className="px-4 py-1.5 text-xs font-medium rounded-lg bg-primary hover:bg-primary-hover text-white shadow-sm transition-colors disabled:opacity-50"
                >
                  {submittingCity ? 'جاري الحفظ...' : 'حفظ المدينة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add District Modal */}
      {showAddDistrictModal && selectedCity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-dark-surface-base border border-surface-border dark:border-dark-surface-border rounded-xl shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-surface-border dark:border-dark-surface-border flex items-center justify-between bg-surface-background dark:bg-dark-surface-sunken">
              <h3 className="font-semibold text-ink-primary dark:text-dark-ink-primary text-base">
                إضافة حي جديد
              </h3>
              <button
                type="button"
                onClick={() => setShowAddDistrictModal(false)}
                className="p-1 rounded-full text-ink-muted hover:text-ink-primary hover:bg-surface-sunken"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateDistrict} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink-muted mb-1">
                  المدينة التابع لها
                </label>
                <div className="px-3 py-2 text-xs rounded-lg bg-surface-sunken dark:bg-dark-surface-sunken border border-surface-border dark:border-dark-surface-border text-ink-primary dark:text-dark-ink-primary font-semibold flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-primary" />
                  <span>{selectedCity.nameAr}</span>
                  <span className="text-ink-muted">({selectedCity.nameEn})</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-primary dark:text-dark-ink-primary mb-1">
                  اسم الحي بالعربية <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={districtForm.nameAr}
                  onChange={(e) => setDistrictForm({ ...districtForm, nameAr: e.target.value })}
                  placeholder="مثال: الملقا"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-surface-border dark:border-dark-surface-border bg-white dark:bg-dark-surface-base focus:ring-2 focus:ring-primary focus:outline-none text-ink-primary dark:text-dark-ink-primary"
                />
                {districtFormErrors.nameAr && (
                  <p className="mt-1 text-xs text-red-500 font-medium">{districtFormErrors.nameAr}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-primary dark:text-dark-ink-primary mb-1">
                  اسم الحي بالإنجليزية <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={districtForm.nameEn}
                  onChange={(e) => setDistrictForm({ ...districtForm, nameEn: e.target.value })}
                  placeholder="مثال: Al-Malqa"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-surface-border dark:border-dark-surface-border bg-white dark:bg-dark-surface-base focus:ring-2 focus:ring-primary focus:outline-none text-ink-primary dark:text-dark-ink-primary"
                />
                {districtFormErrors.nameEn && (
                  <p className="mt-1 text-xs text-red-500 font-medium">{districtFormErrors.nameEn}</p>
                )}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="districtIsActive"
                  checked={districtForm.isActive}
                  onChange={(e) => setDistrictForm({ ...districtForm, isActive: e.target.checked })}
                  className="rounded border-surface-border text-primary focus:ring-primary w-4 h-4"
                />
                <label
                  htmlFor="districtIsActive"
                  className="text-xs text-ink-primary dark:text-dark-ink-primary cursor-pointer font-medium"
                >
                  تفعيل الحي مباشرة
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-border dark:border-dark-surface-border">
                <button
                  type="button"
                  onClick={() => setShowAddDistrictModal(false)}
                  className="px-3.5 py-1.5 text-xs font-medium rounded-lg border border-surface-border text-ink-secondary hover:bg-surface-sunken transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submittingDistrict}
                  className="px-4 py-1.5 text-xs font-medium rounded-lg bg-primary hover:bg-primary-hover text-white shadow-sm transition-colors disabled:opacity-50"
                >
                  {submittingDistrict ? 'جاري الحفظ...' : 'حفظ الحي'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
