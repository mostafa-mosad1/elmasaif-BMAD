import type { LucideIcon } from 'lucide-react';
import { Building, UserCheck, Shield } from 'lucide-react';
import { UserRole } from '@elmasaif/shared';

export interface RoleMeta {
  label: string;
  title: string;
  icon: LucideIcon;
  badgeClass: string;
}

// Single source of truth for workspace role presentation, shared by
// WorkspaceRoleSwitcher (sidebar) and ProfileMenu (header).
export const roleConfig: Record<string, RoleMeta> = {
  [UserRole.BUYER]: {
    label: 'مشتري',
    title: 'مساحة المشتري',
    icon: UserCheck,
    badgeClass:
      'bg-primary/10 text-primary border-primary/25 dark:bg-primary-light/10 dark:text-primary-light dark:border-primary-light/30',
  },
  [UserRole.OWNER]: {
    label: 'مالك عقار',
    title: 'مساحة المالك',
    icon: Building,
    badgeClass:
      'bg-surface-sunken text-ink-primary border-surface-border dark:bg-dark-surface-raised dark:text-dark-ink-primary dark:border-dark-surface-border',
  },
  [UserRole.MARKETER]: {
    label: 'مسوق معتمد',
    title: 'مساحة الوسيط',
    icon: Shield,
    badgeClass:
      'bg-accent/15 text-accent-dark border-accent/30 dark:bg-accent/20 dark:text-accent dark:border-accent/40',
  },
  [UserRole.ADMIN]: {
    label: 'مشرف النظام',
    title: 'لوحة الإشراف',
    icon: Shield,
    badgeClass: 'bg-red-500/10 text-red-700 border-red-300 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800/60',
  },
};
