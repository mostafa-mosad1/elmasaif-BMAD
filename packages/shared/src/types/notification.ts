import { NotificationCategory, NotificationChannel } from '../enums/notifications';

export interface NotificationDto {
  id: string;
  userId: string;
  eventKey: string;
  channel: NotificationChannel;
  category: NotificationCategory;
  title: string;
  message: string;
  entityType?: string | null;
  entityId?: string | null;
  deepLink?: string | null;
  metadata?: Record<string, unknown> | null;
  isRead: boolean;
  readAt?: string | null;
  isCritical: boolean;
  createdAt: string;
}

export interface PaginatedNotificationsDto {
  items: NotificationDto[];
  total: number;
  unreadCount: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface UnreadNotificationCountDto {
  unreadCount: number;
}

export interface SendNotificationInput {
  userId: string;
  eventKey: string;
  title: string;
  message: string;
  channels?: NotificationChannel[];
  category?: NotificationCategory;
  entityType?: string;
  entityId?: string;
  deepLink?: string;
  metadata?: Record<string, unknown>;
  isCritical?: boolean;
  recipientEmail?: string;
  recipientName?: string;
}

