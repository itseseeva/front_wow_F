import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Route, AlertTriangle, Info, Loader2 } from 'lucide-react';
import { soundFx } from '../utils/audio';
import { SpecularButton } from './ui/Specular';
import { RouteCanvas } from './RouteCanvas';
import { RouteInfo, RouteRecordStatus, RouteRecordStoppedDetail, TerrainStatus } from '../types';
import { getPywebviewApi } from '../utils/pywebviewBridge';
import {
  mockStartRouteRecord,
  mockGetRouteRecordStatus,
  mockStopRouteRecord,
} from '../data/mockRoutes';

interface RouteRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultName?: string;
  onStartRecord?: (name: string, isLoop: boolean) => void;
  onRouteSaved?: (newRoute: RouteInfo, terrain: TerrainStatus | null) => void;
  onToast?: (toast: any) => void;
  language?: 'ru' | 'en' | any;
  theme?: 'dark' | 'light' | any;
}

function formatSeconds(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const RouteRecordModal: React.FC<RouteRecordModalProps> = ({
  isOpen,
  onClose,
  defaultName,
  onStartRecord,
  onRouteSaved,
  language = 'ru',
}) => {
  const isRu = language === 'ru';
  const effectiveDefaultName = defaultName || (isRu ? 'Маршрут 2' : 'Route 2');

  const [screen, setScreen] = useState<'naming' | 'recording'>('naming');
  const [routeName, setRouteName] = useState(effectiveDefaultName);
  const [error, setError] = useState<string | null>(null);
  const [botStopReason, setBotStopReason] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Status of the active recording session
  const [status, setStatus] = useState<RouteRecordStatus>({
    recording: false,
    name: null,
    seconds: 0,
    points: [],
    length_s: 0,
    map_id: null,
    warning: null,
  });

  const pollTimerRef = useRef<any>(null);

  // Reset state when modal is opened / closed
  useEffect(() => {
    if (isOpen) {
      setRouteName(effectiveDefaultName);
      setScreen('naming');
      setError(null);
      setBotStopReason(null);
      setIsSubmitting(false);
      setStatus({
        recording: false,
        name: null,
        seconds: 0,
        points: [],
        length_s: 0,
        map_id: null,
        warning: null,
      });
    } else {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    }
  }, [isOpen, effectiveDefaultName]);

  // Status fetcher for recording screen
  const fetchStatus = useCallback(async () => {
    try {
      const api = await getPywebviewApi();
      let res: RouteRecordStatus;
      if (api?.get_route_record_status) {
        res = await api.get_route_record_status();
      } else {
        res = await mockGetRouteRecordStatus();
      }
      setStatus(res);
    } catch (err: any) {
      console.warn('get_route_record_status error:', err);
    }
  }, []);

  // Polling management: run every 1 second while recording
  useEffect(() => {
    if (!isOpen || screen !== 'recording') {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      return;
    }

    // Initial fetch immediately
    fetchStatus();

    // Start 1s interval
    pollTimerRef.current = setInterval(() => {
      fetchStatus();
    }, 1000);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [isOpen, screen, fetchStatus]);

  // Listen for 'wowbot:route-record-stopped'
  useEffect(() => {
    const handleStopped = (e: Event) => {
      const customEvent = e as CustomEvent<RouteRecordStoppedDetail>;
      const detail = customEvent.detail;
      if (!detail) return;

      if (detail.reason) {
        setBotStopReason(detail.reason);
      }

      if (detail.route) {
        if (onRouteSaved) {
          onRouteSaved(detail.route, detail.terrain ?? null);
        }
        onClose();
      } else if (detail.error) {
        setError(detail.error);
      }
    };

    window.addEventListener('wowbot:route-record-stopped', handleStopped);
    return () => {
      window.removeEventListener('wowbot:route-record-stopped', handleStopped);
    };
  }, [onRouteSaved, onClose]);

  // Screen 1: Submit Name -> start recording
  const handleStartRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    soundFx.playClick();
    setError(null);
    setIsSubmitting(true);

    const finalName = routeName.trim() || effectiveDefaultName;

    try {
      const api = await getPywebviewApi();
      let res: { ok: boolean; error?: string };
      if (api?.start_route_record) {
        res = await api.start_route_record(finalName);
      } else {
        res = await mockStartRouteRecord(finalName);
      }

      if (!res.ok) {
        setError(res.error || (isRu ? 'Не удалось начать запись' : 'Failed to start recording'));
        setIsSubmitting(false);
        return;
      }

      // Transition to recording screen
      setScreen('recording');
      setStatus((prev) => ({
        ...prev,
        recording: true,
        name: finalName,
        seconds: 0,
        points: [],
        length_s: 0,
      }));
    } catch (err: any) {
      setError(err?.message || (isRu ? 'Ошибка соединения' : 'Connection error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Screen 2: Stop recording (save = true or false)
  const handleStopRecord = async (save: boolean) => {
    soundFx.playClick();
    setError(null);
    setIsSubmitting(true);

    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    try {
      const api = await getPywebviewApi();
      let res: { ok: boolean; error?: string; route?: RouteInfo; terrain?: TerrainStatus | null };
      if (api?.stop_route_record) {
        res = await api.stop_route_record(save);
      } else {
        res = await mockStopRouteRecord(save);
      }

      if (save) {
        if (res.ok && res.route) {
          if (onRouteSaved) {
            onRouteSaved(res.route, res.terrain ?? null);
          }
          onClose();
        } else {
          setError(res.error || (isRu ? 'Ошибка при сохранении маршрута' : 'Failed to save route'));
          // Resume polling if failed to save so user can retry or cancel
          pollTimerRef.current = setInterval(fetchStatus, 1000);
        }
      } else {
        // Cancelled
        onClose();
      }
    } catch (err: any) {
      if (save) {
        setError(err?.message || (isRu ? 'Ошибка остановки записи' : 'Error stopping record'));
      } else {
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Close X click: if recording, equals 'Cancel' (stop_route_record(false))
  const handleCloseClick = () => {
    soundFx.playClick();
    if (screen === 'recording') {
      handleStopRecord(false);
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/70 backdrop-blur-md animate-fadeIn select-none">
      <div className="w-[290px] rounded-2xl p-4 border border-white/10 shadow-[0_25px_60px_rgba(0,0,0,0.85)] bg-[#101014]/95 text-zinc-100 transition-all duration-300 relative overflow-hidden flex flex-col gap-3">
        {/* Top subtle cyan laser accent line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-80" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
          <div className="flex items-center gap-2">
            <Route className="w-3.5 h-3.5 text-cyan-400" strokeWidth={1.5} />
            <h2 className="text-xs font-semibold text-white tracking-wide font-mono">
              {screen === 'recording'
                ? (status.name || routeName)
                : (isRu ? 'Новый маршрут' : 'New Route')}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleCloseClick}
            className="text-zinc-400 hover:text-white cursor-pointer p-1 rounded-md hover:bg-white/[0.08] transition-colors"
            title={screen === 'recording' ? (isRu ? 'Отменить' : 'Cancel') : (isRu ? 'Закрыть' : 'Close')}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* SCREEN 1: NAMING */}
        {screen === 'naming' && (
          <form onSubmit={handleStartRecord} className="flex flex-col gap-3">
            <input
              type="text"
              value={routeName}
              onChange={(e) => setRouteName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white text-xs font-mono placeholder:text-zinc-600 focus:outline-none focus:border-cyan-400 transition-colors"
              placeholder={isRu ? 'Название маршрута...' : 'Route name...'}
              autoFocus
            />

            {error && (
              <div className="p-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-[11px] font-mono">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-3 py-1.5 rounded-lg text-xs font-mono text-zinc-400 hover:text-white border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] cursor-pointer transition-colors"
              >
                {isRu ? 'Отмена' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-1.5 rounded-lg text-xs font-mono font-semibold text-black bg-cyan-400 hover:bg-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.4)] cursor-pointer active:scale-95 transition-all flex items-center gap-1.5"
              >
                {isSubmitting && <Loader2 className="w-3 h-3 animate-spin text-black" />}
                <span>{isRu ? 'Запись' : 'Record'}</span>
              </button>
            </div>
          </form>
        )}

        {/* SCREEN 2: RECORDING */}
        {screen === 'recording' && (
          <div className="flex flex-col gap-2.5">
            {/* Live Canvas View with HUD Badges */}
            <div className="w-full h-44 rounded-xl overflow-hidden border border-white/10 relative bg-black/60 shadow-inner">
              <RouteCanvas
                points={status.points}
                mapId={status.map_id}
                mode="live_record"
                loop={false}
                className="w-full h-full"
              />

              {/* Floating Minimal HUD: REC Indicator */}
              <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md border border-red-500/30 text-[10px] font-mono text-red-400 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                <span>REC</span>
                <span className="text-zinc-300 ml-0.5">{formatSeconds(status.seconds)}</span>
              </div>

              {/* Floating Minimal HUD: Points */}
              <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md border border-cyan-500/30 text-[10px] font-mono text-cyan-300 shadow-sm">
                <span>{status.points.length} {isRu ? 'точек' : 'pts'}</span>
              </div>
            </div>

            {/* Warning Message if any */}
            {status.warning && (
              <div className="p-2 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400 text-[11px] font-mono flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3 shrink-0 text-amber-500" />
                <span>{status.warning}</span>
              </div>
            )}

            {botStopReason && (
              <div className="p-2 rounded-lg border border-sky-500/30 bg-sky-500/10 text-sky-400 text-[11px] font-mono flex items-center gap-1.5">
                <Info className="w-3 h-3 shrink-0" />
                <span>{botStopReason}</span>
              </div>
            )}

            {error && (
              <div className="p-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-[11px] font-mono">
                {error}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleStopRecord(false)}
                disabled={isSubmitting}
                className="px-3 py-1.5 rounded-lg text-xs font-mono text-zinc-400 hover:text-white border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] cursor-pointer transition-colors"
              >
                {isRu ? 'Отмена' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => handleStopRecord(true)}
                disabled={isSubmitting}
                className="px-4 py-1.5 rounded-lg text-xs font-mono font-semibold text-black bg-cyan-400 hover:bg-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.4)] cursor-pointer active:scale-95 transition-all flex items-center gap-1.5"
              >
                {isSubmitting && <Loader2 className="w-3 h-3 animate-spin text-black" />}
                <span>{isRu ? 'Сохранить' : 'Save'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
