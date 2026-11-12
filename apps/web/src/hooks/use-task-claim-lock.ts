'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ClaimLockInfo,
  OperationalQueueSlug,
  OperationalQueueType,
  OPERATIONAL_QUEUE_METADATA,
  TASK_CLAIM_HEARTBEAT_INTERVAL_MS,
  TASK_CLAIM_LEASE_DURATION_SECONDS,
  resolveOperationalQueueType,
} from '@elmasaif/shared';
import { apiClient, describeApiError } from '../lib/api-client';

export function formatLockCountdown(remainingSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(remainingSeconds || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function buildIfMatchHeaders(
  version?: number | null,
): Record<string, string> {
  if (typeof version === 'number' && Number.isInteger(version) && version > 0) {
    return { 'If-Match': `"${version}"` };
  }
  return {};
}

export interface UseTaskClaimLockOptions {
  queue: OperationalQueueType | OperationalQueueSlug | string;
  entityId: string | null | undefined;
  initialLockInfo?: ClaimLockInfo | null;
  initialVersion?: number | null;
  enableAutoHeartbeat?: boolean;
  onLockChange?: (nextLockInfo: ClaimLockInfo | null, nextVersion?: number) => void;
}

export interface UseTaskClaimLockResult {
  lockInfo: ClaimLockInfo | null;
  version: number | null;
  remainingSeconds: number;
  formattedCountdown: string;
  isLocked: boolean;
  isLockedByCurrentAdmin: boolean;
  isLockedByOtherAdmin: boolean;
  isActionDisabled: boolean;
  isLoading: boolean;
  error: string | null;
  errorCode: string | null;
  claim: () => Promise<ClaimLockInfo | null>;
  heartbeat: () => Promise<ClaimLockInfo | null>;
  release: () => Promise<ClaimLockInfo | null>;
  forceUnlock: (reason: string) => Promise<ClaimLockInfo | null>;
  syncLockInfo: (nextLockInfo: ClaimLockInfo | null, nextVersion?: number | null) => void;
  getIfMatchHeaders: () => Record<string, string>;
}

interface QueueLockApiResponse {
  code: string;
  message?: string;
  data?: {
    queue?: OperationalQueueType;
    entityId?: string;
    version?: number;
    lockInfo?: ClaimLockInfo;
  };
}

export function useTaskClaimLock({
  queue,
  entityId,
  initialLockInfo = null,
  initialVersion = null,
  enableAutoHeartbeat = true,
  onLockChange,
}: UseTaskClaimLockOptions): UseTaskClaimLockResult {
  const [lockInfo, setLockInfo] = useState<ClaimLockInfo | null>(initialLockInfo);
  const [version, setVersion] = useState<number | null>(initialVersion);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(
    initialLockInfo?.remainingSeconds ?? 0,
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const onLockChangeRef = useRef(onLockChange);
  onLockChangeRef.current = onLockChange;

  useEffect(() => {
    setLockInfo(initialLockInfo ?? null);
    setRemainingSeconds(initialLockInfo?.remainingSeconds ?? 0);
  }, [
    entityId,
    initialLockInfo?.isLocked,
    initialLockInfo?.lockedByAdminId,
    initialLockInfo?.lockExpiresAt,
    initialLockInfo?.remainingSeconds,
    initialLockInfo?.isLockedByCurrentAdmin,
  ]);

  useEffect(() => {
    if (initialVersion !== undefined) {
      setVersion(initialVersion);
    }
  }, [entityId, initialVersion]);

  // 1-second local countdown decrement when locked
  useEffect(() => {
    if (!lockInfo?.isLocked || remainingSeconds <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          setLockInfo((curr) =>
            curr
              ? {
                  ...curr,
                  isLocked: false,
                  lockedByAdminId: null,
                  lockedByAdminName: null,
                  lockedAt: null,
                  lockExpiresAt: null,
                  remainingSeconds: 0,
                  isLockedByCurrentAdmin: false,
                }
              : null,
          );
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [lockInfo?.isLocked, remainingSeconds]);

  const resolveQueueSlug = useCallback((): string => {
    const queueType = resolveOperationalQueueType(String(queue));
    if (queueType && OPERATIONAL_QUEUE_METADATA[queueType]) {
      const meta = OPERATIONAL_QUEUE_METADATA[queueType];
      return meta.slug || meta.primarySlug;
    }
    return String(queue).trim().toLowerCase();
  }, [queue]);

  const applyLockUpdate = useCallback(
    (nextLock: ClaimLockInfo | null, nextVer?: number) => {
      setLockInfo(nextLock);
      setRemainingSeconds(nextLock?.remainingSeconds ?? 0);
      if (typeof nextVer === 'number') {
        setVersion(nextVer);
      }
      onLockChangeRef.current?.(nextLock, nextVer);
    },
    [],
  );

  const handleLockError = useCallback(
    (err: unknown) => {
      const envelope = describeApiError(err);
      setError(envelope.message || 'تعذر تنفيذ عملية القفل التشغيلي');
      setErrorCode(envelope.code || null);

      const conflictLockInfo = (
        envelope.details as { lockInfo?: ClaimLockInfo } | undefined
      )?.lockInfo;
      if (conflictLockInfo) {
        applyLockUpdate(conflictLockInfo);
      }
    },
    [applyLockUpdate],
  );

  const claim = useCallback(async (): Promise<ClaimLockInfo | null> => {
    if (!entityId) return null;
    setIsLoading(true);
    setError(null);
    setErrorCode(null);

    try {
      const slug = resolveQueueSlug();
      const response = await apiClient.post<QueueLockApiResponse>(
        `/admin/queues/${slug}/${entityId}/claim`,
      );
      const nextLock =
        response?.data?.lockInfo ?? {
          isLocked: true,
          lockedByAdminId: null,
          lockedByAdminName: null,
          lockedAt: null,
          lockExpiresAt: null,
          remainingSeconds: TASK_CLAIM_LEASE_DURATION_SECONDS,
          isLockedByCurrentAdmin: true,
        };
      applyLockUpdate(nextLock, response?.data?.version);
      return nextLock;
    } catch (err) {
      handleLockError(err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [entityId, resolveQueueSlug, applyLockUpdate, handleLockError]);

  const heartbeat = useCallback(async (): Promise<ClaimLockInfo | null> => {
    if (!entityId) return null;
    try {
      const slug = resolveQueueSlug();
      const response = await apiClient.post<QueueLockApiResponse>(
        `/admin/queues/${slug}/${entityId}/heartbeat`,
      );
      if (response?.data?.lockInfo) {
        applyLockUpdate(response.data.lockInfo, response.data.version);
        return response.data.lockInfo;
      }
      return null;
    } catch (err) {
      handleLockError(err);
      return null;
    }
  }, [entityId, resolveQueueSlug, applyLockUpdate, handleLockError]);

  const release = useCallback(async (): Promise<ClaimLockInfo | null> => {
    if (!entityId) return null;
    setIsLoading(true);
    setError(null);
    setErrorCode(null);

    try {
      const slug = resolveQueueSlug();
      const response = await apiClient.post<QueueLockApiResponse>(
        `/admin/queues/${slug}/${entityId}/release`,
      );
      const nextLock =
        response?.data?.lockInfo ?? {
          isLocked: false,
          lockedByAdminId: null,
          lockedByAdminName: null,
          lockedAt: null,
          lockExpiresAt: null,
          remainingSeconds: 0,
          isLockedByCurrentAdmin: false,
        };
      applyLockUpdate(nextLock, response?.data?.version);
      return nextLock;
    } catch (err) {
      handleLockError(err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [entityId, resolveQueueSlug, applyLockUpdate, handleLockError]);

  const forceUnlock = useCallback(
    async (reason: string): Promise<ClaimLockInfo | null> => {
      if (!entityId) return null;
      setIsLoading(true);
      setError(null);
      setErrorCode(null);

      try {
        const slug = resolveQueueSlug();
        const response = await apiClient.post<QueueLockApiResponse>(
          `/admin/queues/${slug}/${entityId}/force-unlock`,
          { reason },
        );
        const nextLock =
          response?.data?.lockInfo ?? {
            isLocked: false,
            lockedByAdminId: null,
            lockedByAdminName: null,
            lockedAt: null,
            lockExpiresAt: null,
            remainingSeconds: 0,
            isLockedByCurrentAdmin: false,
          };
        applyLockUpdate(nextLock, response?.data?.version);
        return nextLock;
      } catch (err) {
        handleLockError(err);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [entityId, resolveQueueSlug, applyLockUpdate, handleLockError],
  );

  // Automatic 5-minute heartbeat while locked by current admin
  useEffect(() => {
    if (
      !enableAutoHeartbeat ||
      !entityId ||
      !lockInfo?.isLocked ||
      !lockInfo?.isLockedByCurrentAdmin
    ) {
      return;
    }

    const interval = setInterval(() => {
      heartbeat();
    }, TASK_CLAIM_HEARTBEAT_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [
    enableAutoHeartbeat,
    entityId,
    lockInfo?.isLocked,
    lockInfo?.isLockedByCurrentAdmin,
    heartbeat,
  ]);

  const syncLockInfo = useCallback(
    (nextLockInfo: ClaimLockInfo | null, nextVersion?: number | null) => {
      setLockInfo(nextLockInfo);
      setRemainingSeconds(nextLockInfo?.remainingSeconds ?? 0);
      if (nextVersion !== undefined) {
        setVersion(nextVersion);
      }
    },
    [],
  );

  const getIfMatchHeaders = useCallback(() => {
    return buildIfMatchHeaders(version);
  }, [version]);

  const isLocked = Boolean(lockInfo?.isLocked && remainingSeconds > 0);
  const isLockedByCurrentAdmin = Boolean(
    isLocked && lockInfo?.isLockedByCurrentAdmin,
  );
  const isLockedByOtherAdmin = Boolean(
    isLocked && !lockInfo?.isLockedByCurrentAdmin,
  );
  const isActionDisabled = !isLockedByCurrentAdmin;

  return {
    lockInfo,
    version,
    remainingSeconds,
    formattedCountdown: formatLockCountdown(remainingSeconds),
    isLocked,
    isLockedByCurrentAdmin,
    isLockedByOtherAdmin,
    isActionDisabled,
    isLoading,
    error,
    errorCode,
    claim,
    heartbeat,
    release,
    forceUnlock,
    syncLockInfo,
    getIfMatchHeaders,
  };
}

