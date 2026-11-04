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
      'bg-[#1B4332]/10 text-[#1B4332] border-[#1B4332]/30 dark:bg-[#1B4332]/30 dark:text-[#52B788] dark:border-[#52B788]/40',
  },
  [UserRole.OWNER]: {
    label: 'مالك عقار',
    title: 'مساحة المالك',
    icon: Building,
    badgeClass:
      'bg-[#132018]/10 text-stone-800 border-stone-400 dark:bg-[#132018]/50 dark:text-stone-200 dark:border-stone-600',
  },
  [UserRole.MARKETER]: {
    label: 'مسوق معتمد',
    title: 'مساحة الوسيط',
    icon: Shield,
    badgeClass:
      'bg-[#C69C45]/15 text-[#9A7328] border-[#C69C45]/40 dark:bg-[#C69C45]/25 dark:text-[#E0B865] dark:border-[#C69C45]/50',
  },
  [UserRole.ADMIN]: {
    label: 'مشرف النظام',
    title: 'لوحة الإشراف',
    icon: Shield,
    badgeClass: 'bg-red-500/10 text-red-700 border-red-300',
  },
};
