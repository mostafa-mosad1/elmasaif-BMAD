'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../providers/auth-provider';
import { UserRole, ProfileStatus } from '@elmasaif/shared';
import { UserCheck, Building, Shield, Lock, Loader2 } from 'lucide-react';

interface WorkspaceRoleSwitcherProps {
  defaultOpen?: boolean;
}

export function WorkspaceRoleSwitcher({ defaultOpen = false }: WorkspaceRoleSwitcherProps) {
  const { user, activeRole, profiles, switchRole, attachOwnerRole } = useAuth();
  const [switchingRole, setSwitchingRole] = useState<UserRole | null>(null);

  if (!user) {
    return null;
  }

  const hasOwner = profiles.some((p) => p.role === UserRole.OWNER);
  const marketerProfile = profiles.find((p) => p.role === UserRole.MARKETER);
  const hasActiveMarketer = Boolean(
    marketerProfile &&
      marketerProfile.status === ProfileStatus.ACTIVE &&
      marketerProfile.falStatus === ProfileStatus.ACTIVE
  );

  const handleRoleClick = async (role: UserRole) => {
    if (role === activeRole || switchingRole) return;

    if (role === UserRole.OWNER && !hasOwner) {
      try {
        setSwitchingRole(UserRole.OWNER);
        await attachOwnerRole();
      } finally {
        setSwitchingRole(null);
      }
      return;
    }

    try {
      setSwitchingRole(role);
      await switchRole(role);
    } finally {
      setSwitchingRole(null);
    }
  };

  const ROLES = [
    {
      id: UserRole.BUYER,
      label: 'مشتري',
      icon: UserCheck,
      isAvailable: true,
      hint: 'تبديل لمساحة المشتري',
      linkHref: null,
    },
    {
      id: UserRole.OWNER,
      label: 'مالك',
      icon: Building,
      isAvailable: hasOwner,
      hint: hasOwner ? 'تبديل لمساحة المالك' : 'تفعيل حساب المالك',
      linkHref: null,
    },
    {
      id: UserRole.MARKETER,
      label: 'مسوق',
      icon: Shield,
      isAvailable: hasActiveMarketer,
      hint: hasActiveMarketer ? 'تبديل لمساحة الوسيط' : 'ترقية لحساب مسوق معتمد',
      linkHref: hasActiveMarketer ? null : '/app/marketer/onboarding',
    },
  ];

  return (
    <div
      role="group"
      aria-label="تبديل مساحة العمل"
      title="تبديل مساحة العمل"
      className="inline-flex items-center p-1 rounded-xl bg-surface-sunken dark:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border shadow-sm"
    >
      <span className="sr-only">تبديل مساحة العمل</span>
      {ROLES.map((r) => {
        const isActive = activeRole === r.id;
        const Icon = r.icon;
        const isBusy = switchingRole === r.id;

        const baseClasses = `relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 select-none ${
          isActive
            ? 'bg-surface-base dark:bg-dark-surface-base text-ink-primary dark:text-dark-ink-primary shadow-sm border border-surface-border/60 dark:border-dark-surface-border font-bold'
            : 'text-ink-secondary dark:text-dark-ink-secondary hover:text-ink-primary dark:hover:text-dark-ink-primary hover:bg-surface-base/50 dark:hover:bg-dark-surface-base/50 cursor-pointer'
        }`;

        const content = (
          <>
            {isBusy ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
            ) : (
              <Icon
                className={`w-3.5 h-3.5 transition-colors ${
                  isActive
                    ? r.id === UserRole.BUYER
                      ? 'text-primary dark:text-primary-light'
                      : 'text-accent'
                    : 'text-ink-muted dark:text-dark-ink-muted'
                }`}
              />
            )}
            <span>{r.label}</span>
            {!r.isAvailable && r.id === UserRole.MARKETER && (
              <Lock className="w-2.5 h-2.5 text-accent opacity-80 ms-0.5" />
            )}
            {!r.isAvailable && r.id === UserRole.OWNER && (
              <span className="text-[10px] text-accent font-bold opacity-80">+</span>
            )}
          </>
        );

        if (r.linkHref) {
          return (
            <Link
              key={r.id}
              href={r.linkHref}
              title={r.hint}
              className={baseClasses}
            >
              {content}
            </Link>
          );
        }

        return (
          <button
            key={r.id}
            type="button"
            onClick={() => handleRoleClick(r.id)}
            disabled={isBusy}
            title={r.hint}
            aria-pressed={isActive}
            className={baseClasses}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}
