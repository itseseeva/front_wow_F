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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/75 backdrop-blur-md animate-fadeIn select-none">
      <div
        className={`w-full ${
          screen === 'recording' ? 'max-w-xl' : 'max-w-md'
        } rounded-2xl p-5 border border-black/10 dark:border-white/[0.08] shadow-[0_20px_50px_rgba(0,0,0,0.2)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.9)] bg-white dark:bg-[#121214] transition-all duration-200`}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-black/10 dark:border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <Route className="w-4 h-4 text-zinc-950 dark:text-white" strokeWidth={1.5} />
            <h2 className="text-sm font-semibold text-zinc-950 dark:text-white tracking-wide">
              {screen === 'recording'
                ? isRu
                  ? 'Идёт запись маршрута'
                  : 'Recording route...'
                : isRu
                ? 'Запись нового маршрута'
                : 'Record new route'}
            </h2>
            {screen === 'recording' && (
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/25 text-[10px] font-mono text-red-500 dark:text-red-400">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                REC
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handleCloseClick}
            className="text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white cursor-pointer p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/[0.08] transition-colors"
            title={screen === 'recording' ? (isRu ? 'Отменить запись' : 'Cancel recording') : (isRu ? 'Закрыть' : 'Close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* =========================================================================
            SCREEN 1: NAMING
            ========================================================================= */}
        {screen === 'naming' && (
          <form onSubmit={handleStartRecord} className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-mono text-zinc-600 dark:text-zinc-400 mb-1.5">
                {isRu ? 'Название маршрута' : 'Route name'}
              </label>
              <input
                type="text"
                value={routeName}
                onChange={(e) => setRouteName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-[#18181b] border border-black/15 dark:border-white/[0.08] text-zinc-950 dark:text-white text-xs font-mono focus:outline-none focus:border-zinc-950 dark:focus:border-white transition-colors"
                placeholder={isRu ? 'Например: Награнд Руда' : 'e.g. Nagrand Ore'}
                autoFocus
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-2.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-500 dark:text-red-400 text-xs font-mono">
                {error}
              </div>
            )}

            <div className="pt-2 flex justify-end gap-2.5">
              <SpecularButton
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-3.5 py-1.5 rounded-lg text-xs font-mono text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white border border-black/10 dark:border-white/[0.08] bg-zinc-100 dark:bg-[#18181b] hover:bg-zinc-200 dark:hover:bg-white/[0.08] cursor-pointer"
              >
                {isRu ? 'Отмена' : 'Cancel'}
              </SpecularButton>
              <SpecularButton
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white dark:text-zinc-950 bg-zinc-950 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-sm cursor-pointer active:scale-95 transition-all flex items-center gap-1.5"
              >
                {isSubmitting && <Loader2 className="w-3 h-3 animate-spin" />}
                <span>{isRu ? 'Начать запись' : 'Start recording'}</span>
              </SpecularButton>
            </div>
          </form>
        )}

        {/* =========================================================================
            SCREEN 2: RECORDING IN PROGRESS
            ========================================================================= */}
        {screen === 'recording' && (
          <div className="mt-4 flex flex-col gap-3.5">
            {/* Route Name Badge */}
            <div className="flex items-center justify-between text-xs font-mono text-zinc-600 dark:text-zinc-400">
              <span>{isRu ? 'Имя маршрута:' : 'Route name:'}</span>
              <span className="font-semibold text-zinc-950 dark:text-white font-mono">
                {status.name || routeName}
              </span>
            </div>

            {/* Live Canvas View */}
            <div className="w-full h-56 sm:h-64 rounded-xl overflow-hidden border border-black/10 dark:border-white/[0.08] relative bg-zinc-950">
              <RouteCanvas
                points={status.points}
                mapId={status.map_id}
                mode="live_record"
                loop={false}
                className="w-full h-full"
              />
            </div>

            {/* Live Telemetry Bar */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-lg bg-zinc-50 dark:bg-[#18181b] border border-black/10 dark:border-white/[0.08] flex flex-col">
                <span className="text-[10px] text-zinc-500 font-mono">{isRu ? 'Время' : 'Duration'}</span>
                <span className="text-xs font-mono font-bold text-zinc-950 dark:text-white mt-0.5">
                  {formatSeconds(status.seconds)}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-zinc-50 dark:bg-[#18181b] border border-black/10 dark:border-white/[0.08] flex flex-col">
                <span className="text-[10px] text-zinc-500 font-mono">{isRu ? 'Точки' : 'Points'}</span>
                <span className="text-xs font-mono font-bold text-zinc-950 dark:text-white mt-0.5">
                  {status.points.length}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-zinc-50 dark:bg-[#18181b] border border-black/10 dark:border-white/[0.08] flex flex-col">
                <span className="text-[10px] text-zinc-500 font-mono">{isRu ? 'Длина' : 'Length'}</span>
                <span className="text-xs font-mono font-bold text-zinc-950 dark:text-white mt-0.5">
                  ≈ {status.length_s} {isRu ? 'с бега' : 's run'}
                </span>
              </div>
            </div>

            {/* Warning Message (Yellow) */}
            {status.warning && (
              <div className="p-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-500 dark:text-amber-400 text-xs font-mono flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                <span>{status.warning}</span>
              </div>
            )}

            {/* Reason Message if Stopped by Bot */}
            {botStopReason && (
              <div className="p-2.5 rounded-lg border border-sky-500/30 bg-sky-500/10 text-sky-500 dark:text-sky-400 text-xs font-mono flex items-center gap-2">
                <Info className="w-3.5 h-3.5 shrink-0" />
                <span>{botStopReason}</span>
              </div>
            )}

            {/* Error Message (Red) */}
            {error && (
              <div className="p-2.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-500 dark:text-red-400 text-xs font-mono">
                {error}
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-2 flex justify-end gap-2.5">
              <SpecularButton
                type="button"
                onClick={() => handleStopRecord(false)}
                disabled={isSubmitting}
                className="px-3.5 py-1.5 rounded-lg text-xs font-mono text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white border border-black/10 dark:border-white/[0.08] bg-zinc-100 dark:bg-[#18181b] hover:bg-zinc-200 dark:hover:bg-white/[0.08] cursor-pointer"
              >
                {isRu ? 'Отменить' : 'Cancel'}
              </SpecularButton>
              <SpecularButton
                type="button"
                onClick={() => handleStopRecord(true)}
                disabled={isSubmitting}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white dark:text-zinc-950 bg-zinc-950 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-sm cursor-pointer active:scale-95 transition-all flex items-center gap-1.5"
              >
                {isSubmitting && <Loader2 className="w-3 h-3 animate-spin" />}
                <span>{isRu ? 'Сохранить' : 'Save'}</span>
              </SpecularButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
