import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { apiClient, ApiError, getApiBaseUrl } from '../api-client';

describe('Universal Presentation API Client (apiClient)', () => {
  const originalEnv = process.env;
  let mockFetch: ReturnType<typeof vi.fn>;

  const setGlobalWindow = (win: unknown) => {
    (globalThis as Record<string, unknown>).window = win;
  };

  const removeGlobalWindow = () => {
    delete (globalThis as Record<string, unknown>).window;
  };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('Base URL resolution (getApiBaseUrl)', () => {
    it('should resolve to relative /api/v1 in browser context', () => {
      setGlobalWindow({});
      expect(getApiBaseUrl()).toBe('/api/v1');
      removeGlobalWindow();
    });

    it('should resolve to default absolute URL in server context when no env vars are set', () => {
      removeGlobalWindow();
      delete process.env.INTERNAL_API_URL;
      delete process.env.API_URL;
      expect(getApiBaseUrl()).toBe('http://localhost:4000/api/v1');
    });

    it('should resolve to INTERNAL_API_URL in server context', () => {
      removeGlobalWindow();
      process.env.INTERNAL_API_URL = 'http://backend-service:4000';
      expect(getApiBaseUrl()).toBe('http://backend-service:4000/api/v1');
    });

    it('should resolve to API_URL in server context when INTERNAL_API_URL is absent', () => {
      removeGlobalWindow();
      delete process.env.INTERNAL_API_URL;
      process.env.API_URL = 'http://public-gateway:4000';
      expect(getApiBaseUrl()).toBe('http://public-gateway:4000/api/v1');
    });
  });

  describe('Request handling & Response parsing', () => {
    it('should send credentials: include and default JSON headers', async () => {
      setGlobalWindow({});
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: 'ok' }),
      } as unknown as Response);

      const result = await apiClient<{ status: string }>('/health');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/health',
        expect.objectContaining({
          credentials: 'include',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Accept: 'application/json',
          }),
        })
      );
      expect(result).toEqual({ status: 'ok' });
      removeGlobalWindow();
    });

    it('should return empty object on 204 No Content', async () => {
      setGlobalWindow({});
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      } as unknown as Response);

      const result = await apiClient('/health');
      expect(result).toEqual({});
      removeGlobalWindow();
    });

    it('should throw typed ApiError with envelope properties on error response', async () => {
      setGlobalWindow({});
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({
          code: 'VALIDATION_ERROR',
          message: 'Invalid phone number',
          details: { phone: ['Must start with +966'] },
          requestId: 'req-uuid-9999',
        }),
      } as unknown as Response);

      await expect(apiClient('/auth/register')).rejects.toThrow(ApiError);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({
          code: 'VALIDATION_ERROR',
          message: 'Invalid phone number',
          details: { phone: ['Must start with +966'] },
          requestId: 'req-uuid-9999',
        }),
      } as unknown as Response);

      try {
        await apiClient('/auth/register');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(ApiError);
        const apiErr = err as ApiError;
        expect(apiErr.statusCode).toBe(400);
        expect(apiErr.code).toBe('VALIDATION_ERROR');
        expect(apiErr.message).toBe('Invalid phone number');
        expect(apiErr.details).toEqual({ phone: ['Must start with +966'] });
        expect(apiErr.requestId).toBe('req-uuid-9999');
      }
      removeGlobalWindow();
    });
  });

  describe('Convenience HTTP Helper Methods', () => {
    it('should support apiClient.get', async () => {
      setGlobalWindow({});
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ items: [] }),
      } as unknown as Response);

      const res = await apiClient.get('/items');
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/items',
        expect.objectContaining({ method: 'GET' })
      );
      expect(res).toEqual({ items: [] });
      removeGlobalWindow();
    });

    it('should support apiClient.post with serialized body', async () => {
      setGlobalWindow({});
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ id: 'new-1' }),
      } as unknown as Response);

      const res = await apiClient.post('/items', { title: 'Villa' });
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/items',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ title: 'Villa' }),
        })
      );
      expect(res).toEqual({ id: 'new-1' });
      removeGlobalWindow();
    });

    it('should support apiClient.put with serialized body', async () => {
      setGlobalWindow({});
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'item-1', updated: true }),
      } as unknown as Response);

      const res = await apiClient.put('/items/item-1', { title: 'Updated Villa' });
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/items/item-1',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ title: 'Updated Villa' }),
        })
      );
      expect(res).toEqual({ id: 'item-1', updated: true });
      removeGlobalWindow();
    });

    it('should support apiClient.patch with serialized body', async () => {
      setGlobalWindow({});
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'item-1', patched: true }),
      } as unknown as Response);

      const res = await apiClient.patch('/items/item-1', { price: 500000 });
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/items/item-1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ price: 500000 }),
        })
      );
      expect(res).toEqual({ id: 'item-1', patched: true });
      removeGlobalWindow();
    });

    it('should support apiClient.delete', async () => {
      setGlobalWindow({});
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      } as unknown as Response);

      const res = await apiClient.delete('/items/item-1');
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/items/item-1',
        expect.objectContaining({ method: 'DELETE' })
      );
      expect(res).toEqual({});
      removeGlobalWindow();
    });
  });
});
