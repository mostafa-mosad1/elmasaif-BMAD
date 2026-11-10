'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../providers/auth-provider';
import { UserRole, ProfileStatus } from '@elmasaif/shared';
import { roleConfig } from './role-config';
import {
  ChevronDown,
  Check,
  Lock,
  PlusCircle,
  Sparkles
} from 'lucide-react';

interface WorkspaceRoleSwitcherProps {
  defaultOpen?: boolean;
}

export function WorkspaceRoleSwitcher({ defaultOpen = false }: WorkspaceRoleSwitcherProps) {
  const { user, activeRole, profiles, switchRole, attachOwnerRole } = useAuth();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isAttachingOwner, setIsAttachingOwner] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  if (!user) {
    return null;
  }

  const currentRoleInfo = roleConfig[activeRole] || roleConfig[UserRole.BUYER];
  const CurrentIcon = currentRoleInfo.icon;

  const hasOwner = profiles.some((p) => p.role === UserRole.OWNER);
  const marketerProfile = profiles.find((p) => p.role === UserRole.MARKETER);
  const hasActiveMarketer = Boolean(
    marketerProfile &&
      marketerProfile.status === ProfileStatus.ACTIVE &&
      marketerProfile.falStatus === ProfileStatus.ACTIVE
  );

  const attachedRoles = [UserRole.BUYER];
  if (hasOwner) attachedRoles.push(UserRole.OWNER);
  if (hasActiveMarketer) attachedRoles.push(UserRole.MARKETER);

  const handleSwitch = async (role: UserRole) => {
    if (role === activeRole) {
      setIsOpen(false);
      return;
    }
    await switchRole(role);
    setIsOpen(false);
  };

  const handleAttachOwner = async () => {
    try {
      setIsAttachingOwner(true);
      await attachOwnerRole();
      setIsOpen(false);
    } finally {
      setIsAttachingOwner(false);
    }
  };

  return (
    <div className="relative inline-block text-start" ref={dropdownRef}>
      {/* Switcher Pill Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all shadow-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary/20 bg-surface dark:bg-dark-surface border-surface-border dark:border-dark-surface-border"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold border ${currentRoleInfo.badgeClass}`}
        >
          <CurrentIcon className="w-3.5 h-3.5" />
          <span>{currentRoleInfo.label}</span>
        </span>
        <span className="hidden sm:inline text-xs text-ink-secondary dark:text-dark-ink-secondary font-normal">
          تبديل مساحة العمل
        </span>
        <ChevronDown
          className={`w-4 h-4 text-ink-muted transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Popover Menu */}
      {isOpen && (
        <div
          className="absolute start-0 mt-2 w-72 rounded-xl shadow-xl bg-surface-raised dark:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border z-50 overflow-hidden divide-y divide-surface-border dark:divide-dark-surface-border"
          role="menu"
        >
          {/* Section 1: Active Roles */}
          <div className="p-2">
            <div className="px-2 py-1 text-[11px] font-semibold text-ink-muted dark:text-dark-ink-muted uppercase tracking-wider">
              المساحات المفعلة
            </div>
            <div className="space-y-1 mt-1">
              {attachedRoles.map((role) => {
                const info = roleConfig[role];
                const Icon = info.icon;
                const isActive = role === activeRole;
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => handleSwitch(role)}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-primary/10 text-primary dark:bg-primary-dark/20 dark:text-primary-light font-bold'
                        : 'text-ink-primary dark:text-dark-ink-primary hover:bg-surface-sunken dark:hover:bg-dark-surface-border'
                    }`}
                    role="menuitem"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-6 h-6 rounded-md flex items-center justify-center ${info.badgeClass}`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <span>{info.title}</span>
                    </div>
                    {isActive && <Check className="w-4 h-4 text-primary dark:text-primary-light" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Available Roles to Activate */}
          {(!hasOwner || !hasActiveMarketer) && (
            <div className="p-2 bg-surface-sunken/40 dark:bg-dark-surface/40">
              <div className="px-2 py-1 text-[11px] font-semibold text-ink-muted dark:text-dark-ink-muted uppercase tracking-wider">
                المساحات المتاحة للتفعيل
              </div>
              <div className="space-y-1.5 mt-1">
                {/* Instant Owner Activation */}
                {!hasOwner && (
                  <button
                    type="button"
                    disabled={isAttachingOwner}
                    onClick={handleAttachOwner}
                    className="w-full text-start p-2 rounded-lg border border-dashed border-primary/40 hover:border-primary hover:bg-primary/5 transition-colors group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-semibold text-primary dark:text-primary-light">
                        <PlusCircle className="w-4 h-4 group-hover:scale-110 transition-transform" />
                        <span>تفعيل حساب المالك</span>
                      </div>
                      <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5" />
                        فوري
                      </span>
                    </div>
                    <p className="text-[10px] text-ink-muted dark:text-dark-ink-muted mt-1 leading-snug">
                      تفعيل فوري لإدارة وعرض عقاراتك مباشرة
                    </p>
                  </button>
                )}

                {/* Marketer Activation (Requires Fal License) */}
                {!hasActiveMarketer && (
                  <Link
                    href="/app/marketer/onboarding"
                    onClick={() => setIsOpen(false)}
                    className="block p-2 rounded-lg border border-surface-border dark:border-dark-surface-border bg-surface-sunken dark:bg-dark-surface hover:border-[#C69C45]/60 hover:bg-[#C69C45]/5 transition-colors group cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-medium text-ink-secondary dark:text-dark-ink-secondary group-hover:text-primary">
                        <Lock className="w-3.5 h-3.5 text-[#C69C45]" />
                        <span>ترقية لحساب مسوق معتمد</span>
                      </div>
                      <span className="text-[9px] bg-[#C69C45]/20 text-[#9A7328] dark:text-[#E0B865] px-1 py-0.5 rounded font-medium">
                        رخصة فال
                      </span>
                    </div>
                    <p className="text-[10px] text-ink-muted dark:text-dark-ink-muted mt-1 leading-snug">
                      يتطلب رخصة فال سارية من الهيئة العامة للعقار (اضغط لبدء التحقق)
                    </p>
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
