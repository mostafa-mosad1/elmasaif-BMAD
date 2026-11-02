'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronDown, Search, X, MapPin } from 'lucide-react';
import { City, District } from '@elmasaif/shared';
import { apiClient } from '../../lib/api-client';

export interface CityDistrictSelectorProps {
  selectedCityId?: string | null;
  selectedDistrictId?: string | null;
  onCityChange: (cityId: string | null) => void;
  onDistrictChange: (districtId: string | null) => void;
  disabled?: boolean;
  required?: boolean;
  cityLabel?: string;
  districtLabel?: string;
  cityError?: string;
  districtError?: string;
  includeInactive?: boolean;
  className?: string;
  initialCities?: City[];
  initialDistricts?: District[];
}

export function CityDistrictSelector({
  selectedCityId,
  selectedDistrictId,
  onCityChange,
  onDistrictChange,
  disabled = false,
  required = false,
  cityLabel = 'المدينة',
  districtLabel = 'الحي',
  cityError,
  districtError,
  includeInactive = false,
  className = '',
  initialCities,
  initialDistricts
}: CityDistrictSelectorProps) {
  const [cities, setCities] = useState<City[]>(initialCities || []);
  const [districts, setDistricts] = useState<District[]>(initialDistricts || []);
  const [loadingCities, setLoadingCities] = useState(false);
  const [loadingDistricts, setLoadingDistricts] = useState(false);

  const [cityOpen, setCityOpen] = useState(false);
  const [districtOpen, setDistrictOpen] = useState(false);
  const [citySearch, setCitySearch] = useState('');
  const [districtSearch, setDistrictSearch] = useState('');

  const cityDropdownRef = useRef<HTMLDivElement>(null);
  const districtDropdownRef = useRef<HTMLDivElement>(null);

  // Close popovers when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        cityDropdownRef.current &&
        !cityDropdownRef.current.contains(event.target as Node)
      ) {
        setCityOpen(false);
      }
      if (
        districtDropdownRef.current &&
        !districtDropdownRef.current.contains(event.target as Node)
      ) {
        setDistrictOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Fetch cities on mount if not provided via initialCities
  useEffect(() => {
    if (initialCities && initialCities.length > 0) {
      setCities(initialCities);
      return;
    }
    let isMounted = true;
    setLoadingCities(true);
    const query = includeInactive ? '?includeInactive=true' : '';
    apiClient
      .get<City[]>(`/geo/cities${query}`)
      .then((data) => {
        if (isMounted) {
          setCities(data || []);
        }
      })
      .catch(() => {
        if (isMounted) setCities([]);
      })
      .finally(() => {
        if (isMounted) setLoadingCities(false);
      });
    return () => {
      isMounted = false;
    };
  }, [includeInactive, initialCities]);

  // Fetch districts when selectedCityId changes
  useEffect(() => {
    if (!selectedCityId) {
      setDistricts([]);
      return;
    }
    // If initialDistricts match the selectedCityId, use them
    if (initialDistricts && initialDistricts.length > 0 && initialDistricts[0]?.cityId === selectedCityId) {
      setDistricts(initialDistricts);
      return;
    }
    let isMounted = true;
    setLoadingDistricts(true);
    const query = includeInactive ? '?includeInactive=true' : '';
    apiClient
      .get<District[]>(`/geo/cities/${selectedCityId}/districts${query}`)
      .then((data) => {
        if (isMounted) {
          setDistricts(data || []);
        }
      })
      .catch(() => {
        if (isMounted) setDistricts([]);
      })
      .finally(() => {
        if (isMounted) setLoadingDistricts(false);
      });
    return () => {
      isMounted = false;
    };
  }, [selectedCityId, includeInactive, initialDistricts]);

  // Active or selected items
  const selectedCity = useMemo(
    () => cities.find((c) => c.id === selectedCityId) || null,
    [cities, selectedCityId]
  );

  const selectedDistrict = useMemo(
    () => districts.find((d) => d.id === selectedDistrictId) || null,
    [districts, selectedDistrictId]
  );

  // Filtered lists based on search
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

  const handleCitySelect = (city: City) => {
    if (selectedCityId !== city.id) {
      onCityChange(city.id);
      onDistrictChange(null);
    }
    setCityOpen(false);
    setCitySearch('');
  };

  const handleDistrictSelect = (district: District) => {
    onDistrictChange(district.id);
    setDistrictOpen(false);
    setDistrictSearch('');
  };

  const handleClearCity = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCityChange(null);
    onDistrictChange(null);
  };

  const handleClearDistrict = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDistrictChange(null);
  };

  const isDistrictDisabled = disabled || !selectedCityId;

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${className}`} dir="rtl">
      {/* City Dropdown */}
      <div className="relative" ref={cityDropdownRef}>
        <label className="block text-sm font-medium text-ink-primary dark:text-dark-ink-primary mb-1.5">
          {cityLabel} {required && <span className="text-red-500">*</span>}
        </label>
        <button
          type="button"
          disabled={disabled || loadingCities}
          onClick={() => {
            if (!disabled && !loadingCities) setCityOpen((prev) => !prev);
          }}
          role="combobox"
          aria-expanded={cityOpen}
          aria-haspopup="listbox"
          aria-controls="city-listbox"
          aria-label={cityLabel}
          className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm transition-all duration-150 border-[1.5px] bg-white dark:bg-dark-surface-base ${
            cityError
              ? 'border-red-500 dark:border-red-500'
              : 'border-surface-border dark:border-dark-surface-border'
          } ${
            disabled
              ? 'opacity-60 cursor-not-allowed bg-surface-sunken dark:bg-dark-surface-sunken'
              : 'hover:border-primary/60 dark:hover:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary focus:shadow-[0_0_0_3px_rgba(27,67,50,0.15)]'
          }`}
        >
          <div className="flex items-center gap-2 truncate">
            <MapPin className="w-4 h-4 text-ink-muted shrink-0" />
            <span
              className={`truncate ${
                selectedCity
                  ? 'text-ink-primary dark:text-dark-ink-primary font-medium'
                  : 'text-ink-muted dark:text-dark-ink-muted'
              }`}
            >
              {selectedCity ? selectedCity.nameAr : loadingCities ? 'جاري التحميل...' : 'اختر المدينة...'}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {selectedCity && !disabled && (
              <span
                onClick={handleClearCity}
                aria-label="مسح اختيار المدينة"
                className="p-1 hover:bg-surface-sunken dark:hover:bg-dark-surface-sunken rounded-full text-ink-muted hover:text-ink-primary"
              >
                <X className="w-3.5 h-3.5" />
              </span>
            )}
            <ChevronDown
              className={`w-4 h-4 text-ink-muted transition-transform duration-200 ${
                cityOpen ? 'rotate-180' : ''
              }`}
            />
          </div>
        </button>

        {cityError && (
          <p className="mt-1 text-xs text-red-500 dark:text-red-400 font-medium">
            {cityError}
          </p>
        )}

        {/* City Popover */}
        {cityOpen && !disabled && (
          <div
            id="city-listbox"
            role="listbox"
            className="absolute z-30 mt-1.5 w-full bg-white dark:bg-dark-surface-base border border-surface-border dark:border-dark-surface-border rounded-lg shadow-lg overflow-hidden"
          >
            <div className="p-2 border-b border-surface-border dark:border-dark-surface-border bg-surface-background dark:bg-dark-surface-sunken">
              <div className="relative">
                <Search className="w-4 h-4 text-ink-muted absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={citySearch}
                  onChange={(e) => setCitySearch(e.target.value)}
                  placeholder="ابحث بالاسم العربي أو الإنجليزي..."
                  className="w-full pr-9 pl-3 py-1.5 text-xs rounded-md bg-white dark:bg-dark-surface-base border border-surface-border dark:border-dark-surface-border focus:outline-none focus:ring-1 focus:ring-primary text-ink-primary dark:text-dark-ink-primary"
                  autoFocus
                />
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto p-1">
              {filteredCities.length === 0 ? (
                <div className="p-3 text-center text-xs text-ink-muted">
                  لا توجد مدن مطابقة للبحث
                </div>
              ) : (
                filteredCities.map((city) => {
                  const isSelected = city.id === selectedCityId;
                  return (
                    <button
                      key={city.id}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleCitySelect(city)}
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-md text-right transition-colors ${
                        isSelected
                          ? 'bg-primary/10 text-primary font-semibold'
                          : 'hover:bg-surface-sunken dark:hover:bg-dark-surface-sunken text-ink-primary dark:text-dark-ink-primary'
                      }`}
                    >
                      <span className="truncate">{city.nameAr}</span>
                      <span className="text-[11px] text-ink-muted mr-2 truncate">
                        {city.nameEn}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* District Dropdown */}
      <div className="relative" ref={districtDropdownRef}>
        <label className="block text-sm font-medium text-ink-primary dark:text-dark-ink-primary mb-1.5">
          {districtLabel} {required && <span className="text-red-500">*</span>}
        </label>
        <button
          type="button"
          disabled={isDistrictDisabled || loadingDistricts}
          onClick={() => {
            if (!isDistrictDisabled && !loadingDistricts) setDistrictOpen((prev) => !prev);
          }}
          role="combobox"
          aria-expanded={districtOpen}
          aria-haspopup="listbox"
          aria-controls="district-listbox"
          aria-label={districtLabel}
          className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm transition-all duration-150 border-[1.5px] bg-white dark:bg-dark-surface-base ${
            districtError
              ? 'border-red-500 dark:border-red-500'
              : 'border-surface-border dark:border-dark-surface-border'
          } ${
            isDistrictDisabled
              ? 'opacity-60 cursor-not-allowed bg-surface-sunken dark:bg-dark-surface-sunken'
              : 'hover:border-primary/60 dark:hover:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary focus:shadow-[0_0_0_3px_rgba(27,67,50,0.15)]'
          }`}
        >
          <div className="flex items-center gap-2 truncate">
            <span
              className={`truncate ${
                selectedDistrict
                  ? 'text-ink-primary dark:text-dark-ink-primary font-medium'
                  : 'text-ink-muted dark:text-dark-ink-muted'
              }`}
            >
              {!selectedCityId
                ? 'يرجى اختيار المدينة أولاً'
                : selectedDistrict
                ? selectedDistrict.nameAr
                : loadingDistricts
                ? 'جاري التحميل...'
                : 'اختر الحي...'}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {selectedDistrict && !isDistrictDisabled && (
              <span
                onClick={handleClearDistrict}
                aria-label="مسح اختيار الحي"
                className="p-1 hover:bg-surface-sunken dark:hover:bg-dark-surface-sunken rounded-full text-ink-muted hover:text-ink-primary"
              >
                <X className="w-3.5 h-3.5" />
              </span>
            )}
            <ChevronDown
              className={`w-4 h-4 text-ink-muted transition-transform duration-200 ${
                districtOpen ? 'rotate-180' : ''
              }`}
            />
          </div>
        </button>

        {districtError && (
          <p className="mt-1 text-xs text-red-500 dark:text-red-400 font-medium">
            {districtError}
          </p>
        )}

        {/* District Popover */}
        {districtOpen && !isDistrictDisabled && (
          <div
            id="district-listbox"
            role="listbox"
            className="absolute z-30 mt-1.5 w-full bg-white dark:bg-dark-surface-base border border-surface-border dark:border-dark-surface-border rounded-lg shadow-lg overflow-hidden"
          >
            <div className="p-2 border-b border-surface-border dark:border-dark-surface-border bg-surface-background dark:bg-dark-surface-sunken">
              <div className="relative">
                <Search className="w-4 h-4 text-ink-muted absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={districtSearch}
                  onChange={(e) => setDistrictSearch(e.target.value)}
                  placeholder="ابحث بالاسم العربي أو الإنجليزي..."
                  className="w-full pr-9 pl-3 py-1.5 text-xs rounded-md bg-white dark:bg-dark-surface-base border border-surface-border dark:border-dark-surface-border focus:outline-none focus:ring-1 focus:ring-primary text-ink-primary dark:text-dark-ink-primary"
                  autoFocus
                />
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto p-1">
              {filteredDistricts.length === 0 ? (
                <div className="p-3 text-center text-xs text-ink-muted">
                  لا توجد أحياء مطابقة للبحث
                </div>
              ) : (
                filteredDistricts.map((district) => {
                  const isSelected = district.id === selectedDistrictId;
                  return (
                    <button
                      key={district.id}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleDistrictSelect(district)}
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-md text-right transition-colors ${
                        isSelected
                          ? 'bg-primary/10 text-primary font-semibold'
                          : 'hover:bg-surface-sunken dark:hover:bg-dark-surface-sunken text-ink-primary dark:text-dark-ink-primary'
                      }`}
                    >
                      <span className="truncate">{district.nameAr}</span>
                      <span className="text-[11px] text-ink-muted mr-2 truncate">
                        {district.nameEn}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

