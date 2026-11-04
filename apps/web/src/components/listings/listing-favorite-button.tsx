'use client';

import React, { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { FAVORITES_LIMIT_REACHED } from '@elmasaif/shared';
import { apiClient, ApiError } from '../../lib/api-client';
import { useAuth } from '../providers/auth-provider';

export interface ListingFavoriteButtonProps {
  listingId: string;
  initialFavorited: boolean;
  initialTotalFavorites?: number;
}

/**
 * Prominent favorite toggle for the listing detail screen (Story 3.5 / AC#2, AC#4).
 *
 * Mirrors `PropertyCard.handleFavoriteClick` exactly: optimistic flip against the
 * same `POST /listings/:id/favorite`, anonymous clickers get the login-confirm +
 * redirect flow, and a failed toggle reverts to the previous state. The only detail
 * addition is the 100-cap (`FAVORITES_LIMIT_REACHED`) surfaced as a small inline
 * notice under the button, auto-hidden like the preferences-editor toast pattern.
 */
export function ListingFavoriteButton({
  listingId,
  initialFavorited,
  initialTotalFavorites,
}: ListingFavoriteButtonProps) {
  let user: any = null;
  try {
    const auth = useAuth();
    user = auth.user;
  } catch {
    user = null;
  }

  const [favorited, setFavorited] = useState(Boolean(initialFavorited));
  const [totalFavorites, setTotalFavorites] = useState<number | null>(
    initialTotalFavorites ?? null,
  );
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setFavorited(Boolean(initialFavorited));
  }, [listingId, initialFavorited]);

  useEffect(() => {
    setTotalFavorites(initialTotalFavorites ?? null);
  }, [listingId, initialTotalFavorites]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (!user) {
      if (typeof window !== 'undefined') {
        const confirmLogin = window.confirm(
          'يرجى تسجيل الدخول أو إنشاء حساب لإضافة العقار إلى قائمة المفضلة.',
        );
        if (confirmLogin) {
          window.location.href = `/auth/login?redirect=${encodeURIComponent(
            window.location.pathname,
          )}`;
        }
      }
      return;
    }

    const previousState = favorited;
    const nextState = !previousState;
    setFavorited(nextState);

    try {
      const response = await apiClient.post<{
        data: { isFavorited: boolean; totalFavorites: number };
      }>(`/listings/${listingId}/favorite`);
      if (response?.data) {
        setFavorited(response.data.isFavorited);
        setTotalFavorites(response.data.totalFavorites);
      }
    } catch (err) {
      // Revert to the last known state (AC#1 — no crash, state restored).
      setFavorited(previousState);
      if (err instanceof ApiError && err.code === FAVORITES_LIMIT_REACHED) {
        setNotice(err.message);
      } else {
        console.error('Failed to toggle favorite', err);
      }
    }
  };

  return (
    <div className="flex flex-col items-end gap-1 shrink-0">
      <button
        type="button"
        aria-label={favorited ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'}
        onClick={handleClick}
        data-testid="listing-favorite-button"
        className="w-8 h-8 rounded-full bg-black/55 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-sm transition-colors"
      >
        <Heart
          className={`w-4 h-4 ${
            favorited ? 'fill-red-500 text-red-500' : 'text-white'
          }`}
        />
      </button>

      {notice ? (
        <span
          role="status"
          aria-live="polite"
          className="max-w-[12rem] text-[11px] leading-tight text-status-rejected text-start"
        >
          {notice}
        </span>
      ) : null}
    </div>
  );
}
