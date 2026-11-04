'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '../providers/auth-provider';
import { UserRole, ProfileStatus } from '@elmasaif/shared';
import { roleConfig } from './role-config';
import {
  Check,
  LayoutDashboard,
  Lock,
  PlusCircle,
  Sparkles,
} from 'lucide-react';

export function ProfileMenu() {
  const { user, activeRole, profiles, switchRole, attachOwnerRole } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isAttachingOwner, setIsAttachingOwner] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const open = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setIsOpen(true);
  }, []);

  const scheduleClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setIsOpen(false), 150);
  }, []);

  // Close on outside click (covers tap/click-opened state on touch devices).
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  if (!user) {
    return null;
  }

  const currentRoleInfo = roleConfig[activeRole] || roleConfig[UserRole.BUYER];
  const CurrentIcon = currentRoleInfo.icon;

  const initials = user.fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('');

  const hasOwner = profiles.some((p) => p.role === UserRole.OWNER);
  const marketerProfile = profiles.find((p) => p.role === UserRole.MARKETER);
  const hasActiveMarketer = Boolean(
    marketerProfile &&
      marketerProfile.status === ProfileStatus.ACTIVE &&
      marketerProfile.falStatus === ProfileStatus.ACTIVE,
  );

  const attachedRoles = [UserRole.BUYER];
  if (hasOwner) attachedRoles.push(UserRole.OWNER);
  if (hasActiveMarketer) attachedRoles.push(UserRole.MARKETER);

  const handleSwitch = async (role: UserRole) => {
    setIsOpen(false);
    if (role === activeRole) return;
    await switchRole(role);
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
    <div
      ref={wrapperRef}
      className="relative"
      onMouseEnter={open}
      onMouseLeave={scheduleClose}
    >
      {/* Compact avatar trigger */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label={user.fullName}
        className="relative inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 dark:bg-primary-dark/25 text-primary dark:text-primary-light text-sm font-bold ring-1 ring-surface-border dark:ring-dark-surface-border hover:ring-primary/40 dark:hover:ring-primary/40 transition focus:outline-none focus:ring-2 focus:ring-primary/30"
      >
        <span className="select-none">{initials}</span>
        <span
          className="absolute -bottom-0.5 -end-0.5 w-4 h-4 rounded-full flex items-center justify-center border-2 border-surface dark:border-dark-background"
          title={currentRoleInfo.label}
        >
          <span className="w-4 h-4 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
            <CurrentIcon className="w-2.5 h-2.5" />
          </span>
        </span>
      </button>

      {/* Dropdown (invisible pt-2 bridge keeps hover continuous across the gap) */}
      {isOpen && (
        <div className="absolute end-0 top-full pt-2 z-50">
          <div className="w-72 rounded-xl shadow-xl bg-surface-raised dark:bg-dark-surface-raised border border-surface-border dark:border-dark-surface-border overflow-hidden divide-y divide-surface-border dark:divide-dark-surface-border">
            {/* Profile header */}
            <div className="p-3 flex items-center gap-3">
              <div className="w-10 h-10 shrink-0 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-bold">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink-primary dark:text-dark-ink-primary truncate">
                  {user.fullName}
                </p>
                <p className="text-xs text-ink-muted dark:text-dark-ink-muted truncate">
                  {user.email || user.username}
                </p>
              </div>
            </div>

            {/* Workspace link */}
            <div className="p-2">
              <Link href={`/app/${activeRole.toLowerCase()}`} onClick={() => setIsOpen(false)}>
                <span className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm font-semibold text-primary dark:text-primary-light bg-primary/5 dark:bg-primary/15 hover:bg-primary/10 dark:hover:bg-primary/25 transition-colors">
                  <LayoutDashboard className="w-4 h-4" />
                  <span>مساحة العمل</span>
                  <span className={`ms-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${currentRoleInfo.badgeClass}`}>
                    <CurrentIcon className="w-3 h-3" />
                    {currentRoleInfo.label}
                  </span>
                </span>
              </Link>
            </div>

            {/* Active spaces */}
            <div className="p-2">
              <div className="px-2 py-1 text-[11px] font-semibold text-ink-muted dark:text-dark-ink-muted uppercase tracking-wider">
                <span>تبديل مساحة العمل</span>
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
                        <div className={`w-6 h-6 rounded-md flex items-center justify-center ${info.badgeClass}`}>
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

            {/* Available roles to activate */}
            {(!hasOwner || !hasActiveMarketer) && (
              <div className="p-2 bg-surface-sunken/40 dark:bg-dark-surface-sunken/40">
                <div className="px-2 py-1 text-[11px] font-semibold text-ink-muted dark:text-dark-ink-muted uppercase tracking-wider">
                  المساحات المتاحة للتفعيل
                </div>
                <div className="space-y-1.5 mt-1">
                  {!hasOwner && (
                    <button
                      type="button"
                      disabled={isAttachingOwner}
                      onClick={handleAttachOwner}
                      className="w-full text-start p-2 rounded-lg border border-dashed border-primary/40 hover:border-primary hover:bg-primary/5 transition-colors group disabled:opacity-60"
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

                  {!hasActiveMarketer && (
                    <div className="p-2 rounded-lg border border-surface-border dark:border-dark-surface-border bg-surface-sunken dark:bg-dark-surface-base opacity-85">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-medium text-ink-secondary dark:text-dark-ink-secondary">
                          <Lock className="w-3.5 h-3.5 text-[#C69C45]" />
                          <span>ترقية لحساب مسوق معتمد</span>
                        </div>
                        <span className="text-[9px] bg-[#C69C45]/20 text-[#9A7328] dark:text-[#E0B865] px-1 py-0.5 rounded font-medium">
                          رخصة فال
                        </span>
                      </div>
                      <p className="text-[10px] text-ink-muted dark:text-dark-ink-muted mt-1 leading-snug">
                        يتطلب رخصة فال سارية من الهيئة العامة للعقار
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
