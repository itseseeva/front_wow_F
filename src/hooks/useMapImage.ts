import { useState, useEffect } from 'react';
import { MapImageResponse } from '../types';
import { getPywebviewApi } from '../utils/pywebviewBridge';
import { mockGetMapImage } from '../data/mockRoutes';

// Shared memory cache by map_id
const mapImageCache = new Map<number, MapImageResponse>();

// Subscribers to map_id updates
const subscribers = new Map<number, Set<(resp: MapImageResponse) => void>>();

// Active polling intervals
const pollingIntervals = new Map<number, number>();

async function queryMapImage(mapId: number): Promise<MapImageResponse> {
  const api = await getPywebviewApi();
  if (api && typeof api.get_map_image === 'function') {
    return await api.get_map_image(mapId);
  }
  return await mockGetMapImage(mapId);
}

function notifySubscribers(mapId: number, resp: MapImageResponse) {
  mapImageCache.set(mapId, resp);
  const subs = subscribers.get(mapId);
  if (subs) {
    subs.forEach((cb) => cb(resp));
  }
}

function startPolling(mapId: number) {
  if (pollingIntervals.has(mapId)) return;

  const intervalId = window.setInterval(async () => {
    try {
      const resp = await queryMapImage(mapId);
      notifySubscribers(mapId, resp);
      if (resp.status === 'ready' || resp.status === 'error') {
        stopPolling(mapId);
      }
    } catch (err: any) {
      stopPolling(mapId);
      notifySubscribers(mapId, {
        ok: false,
        status: 'error',
        error: err?.message || 'Ошибка загрузки карты',
      });
    }
  }, 1000);

  pollingIntervals.set(mapId, intervalId);
}

function stopPolling(mapId: number) {
  const intervalId = pollingIntervals.get(mapId);
  if (intervalId !== undefined) {
    clearInterval(intervalId);
    pollingIntervals.delete(mapId);
  }
}

/**
 * Hook to retrieve map image background with shared memory cache and 1s polling.
 * If mapId is null/undefined, returns null (grid mode).
 */
export function useMapImage(mapId: number | null | undefined): MapImageResponse | null {
  const [mapState, setMapState] = useState<MapImageResponse | null>(() => {
    if (mapId == null) return null;
    return mapImageCache.get(mapId) || null;
  });

  useEffect(() => {
    if (mapId == null) {
      setMapState(null);
      return;
    }

    // Check if already in cache
    const cached = mapImageCache.get(mapId);
    if (cached) {
      setMapState(cached);
      if (cached.status === 'ready' || cached.status === 'error') {
        return;
      }
    }

    if (!subscribers.has(mapId)) {
      subscribers.set(mapId, new Set());
    }
    const listener = (resp: MapImageResponse) => {
      setMapState(resp);
    };
    subscribers.get(mapId)!.add(listener);

    if (!cached || cached.status === 'loading') {
      if (!pollingIntervals.has(mapId)) {
        queryMapImage(mapId)
          .then((resp) => {
            notifySubscribers(mapId, resp);
            if (resp.status === 'loading') {
              startPolling(mapId);
            }
          })
          .catch((err) => {
            notifySubscribers(mapId, {
              ok: false,
              status: 'error',
              error: err?.message || 'Ошибка загрузки карты',
            });
          });
      }
    }

    return () => {
      const subs = subscribers.get(mapId);
      if (subs) {
        subs.delete(listener);
      }
    };
  }, [mapId]);

  return mapState;
}
