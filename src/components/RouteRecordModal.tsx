import React, { useState, useEffect, useRef } from 'react';
import { RouteInfo, RouteRecordStatus, TerrainStatus } from '../types';
import { ThreeRouteRecordView } from './ThreeRouteRecordView';
import { ThreeWaypointOrb } from './ThreeWaypointOrb';
import { getPywebviewApi } from '../utils/pywebviewBridge';
import {
  mockStartRouteRecord,
  mockStopRouteRecord,
  mockGetRouteRecordStatus,
} from '../data/mockRoutes';
import { AlertTriangle, Check, X, Loader2, Play, Footprints, Clock } from 'lucide-react';
import { Language, Theme, translations } from '../utils/i18n';

interface RouteRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRouteSaved: (route: RouteInfo, terrain?: TerrainStatus | null) => void;
  onToast: (toast: { type: 'success' | 'error' | 'info'; message: string }) => void;
  language?: Language;
  theme?: Theme;
}

export const RouteRecordModal: React.FC<RouteRecordModalProps> = ({
  isOpen,
  onClose,
  onRouteSaved,
  onToast,
  language = 'ru',
  theme = 'dark',
}) => {
  const t = translations[language];
  const isDark = theme === 'dark';

  const [routeName, setRouteName] = useState(language === 'ru' ? 'Маршрут 1' : 'Route 1');
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [status, setStatus] = useState<RouteRecordStatus | null>(null);

  const pollTimerRef = useRef<number | null>(null);

  const startRecordApi = async (name: string) => {
    const api = await getPywebviewApi();
    if (api?.start_route_record) {
      return await api.start_route_record(name);
    }
    return await mockStartRouteRecord(name);
  };

  const stopRecordApi = async (save: boolean) => {
    const api = await getPywebviewApi();
    if (api?.stop_route_record) {
      return await api.stop_route_record(save);
    }
    return await mockStopRouteRecord(save);
  };

  const getStatusApi = async (): Promise<RouteRecordStatus> => {
    const api = await getPywebviewApi();
    if (api?.get_route_record_status) {
      return await api.get_route_record_status();
    }
    return await mockGetRouteRecordStatus();
  };

  // Poll status while recording is active
  useEffect(() => {
    if (!isOpen || !status?.recording) {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      return;
    }

    const poll = async () => {
      try {
        const s = await getStatusApi();
        setStatus(s);
      } catch (err) {
        console.warn('Status poll error:', err);
      }
    };

    pollTimerRef.current = window.setInterval(poll, 600);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [isOpen, status?.recording]);

  // Reset when opening
  useEffect(() => {
    if (isOpen) {
      setIsStarting(false);
      setIsStopping(false);
      setStatus(null);
    }
  }, [isOpen]);

  const handleStart = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanName = routeName.trim() || (language === 'ru' ? 'Маршрут' : 'Route');
    setIsStarting(true);
    try {
      const res = await startRecordApi(cleanName);
      if (res.ok) {
        setStatus({
          recording: true,
          name: cleanName,
          points: [],
          seconds: 0,
          length_s: 0,
          map_id: null,
          warning: null,
        });
      } else {
        onToast({
          type: 'error',
          message: res.error || 'Failed to start record',
        });
      }
    } catch (err: any) {
      onToast({
        type: 'error',
        message: err?.message || 'Error starting record',
      });
    } finally {
      setIsStarting(false);
    }
  };

  const handleFinishAndSave = async () => {
    setIsStopping(true);
    try {
      const res = await stopRecordApi(true);
      if (res.ok && res.route) {
        onRouteSaved(res.route, res.terrain);
        onClose();
      } else {
        onToast({
          type: 'error',
          message: res.error || 'Failed to save route',
        });
      }
    } catch (err: any) {
      onToast({
        type: 'error',
        message: err?.message || 'Error saving route',
      });
    } finally {
      setIsStopping(false);
    }
  };

  const handleCancelRecord = async () => {
    if (status?.recording) {
      setIsStopping(true);
      try {
        await stopRecordApi(false);
      } catch (e) {
        // ignore
      } finally {
        setIsStopping(false);
      }
    }
    onClose();
  };

  if (!isOpen) return null;

  const formatTimer = (sec?: number) => {
    const s = sec || 0;
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 animate-fadeIn"
      style={{
        backdropFilter: 'blur(8px)',
        backgroundColor: isDark ? 'rgba(0, 0, 0, 0.75)' : 'rgba(15, 23, 42, 0.45)',
      }}
    >
      {/* State 1: Before Recording Starts */}
      {!status?.recording ? (
        <div className={`w-[94%] max-w-[400px] sm:max-w-[420px] rounded-2xl overflow-hidden flex flex-col animate-screen-assemble relative my-auto border shadow-2xl ${
          isDark
            ? 'bg-[#040812]/98 border-cyan-500/40 text-zinc-200'
            : 'bg-white border-slate-200 text-slate-800'
        }`}>
          {/* Top Neon Glow Line */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-85 shadow-[0_0_8px_#22d3ee]" />

          {/* Header */}
          <div className={`px-3 py-1.5 border-b flex items-center justify-between shrink-0 ${
            isDark ? 'bg-[#02050a] border-zinc-800/80' : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex items-center gap-1.5">
              <ThreeWaypointOrb className="w-6 h-6" />
              <span className={`text-[11px] font-mono font-black uppercase tracking-wider ${
                isDark ? 'text-zinc-100' : 'text-slate-900'
              }`}>
                {t.recordModalTitle}
              </span>
            </div>

            <button
              onClick={onClose}
              className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
                isDark ? 'text-zinc-400 hover:text-white hover:bg-white/10' : 'text-slate-400 hover:text-slate-800 hover:bg-slate-200'
              }`}
              title={t.cancelBtn}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleStart} className="p-2.5 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={routeName}
                onChange={(e) => setRouteName(e.target.value)}
                placeholder={t.recordModalNamePlaceholder}
                maxLength={40}
                autoFocus
                required
                className={`flex-1 min-w-0 h-8 px-2.5 rounded-xl text-xs font-mono focus:outline-hidden transition-all shadow-inner border ${
                  isDark
                    ? 'bg-[#020408] border-cyan-900/60 focus:border-cyan-400 text-cyan-200 placeholder-zinc-600 focus:ring-1 focus:ring-cyan-400/40'
                    : 'bg-slate-50 border-slate-300 focus:border-cyan-500 text-slate-900 placeholder-slate-400 focus:ring-1 focus:ring-cyan-400'
                }`}
              />

              <button
                type="button"
                onClick={onClose}
                className={`h-8 px-2.5 rounded-xl text-xs font-mono transition-colors cursor-pointer shrink-0 ${
                  isDark ? 'text-zinc-400 hover:text-white hover:bg-zinc-800/60' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {t.cancelBtn}
              </button>

              <button
                type="submit"
                disabled={isStarting || !routeName.trim()}
                className="h-8 px-3.5 flex items-center justify-center gap-1.5 rounded-xl text-xs font-mono font-black uppercase tracking-wider bg-gradient-to-r from-cyan-600 to-cyan-400 hover:from-cyan-500 hover:to-cyan-300 text-black shadow-[0_0_15px_rgba(6,182,212,0.4)] disabled:opacity-50 transition-all cursor-pointer active:scale-95 shrink-0"
              >
                {isStarting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3 h-3 fill-current" />
                )}
                <span>{t.recordModalStartBtn}</span>
              </button>
            </div>

            <p className={`text-[9px] font-mono pl-0.5 leading-none truncate ${
              isDark ? 'text-zinc-500' : 'text-slate-500'
            }`}>
              {t.recordModalRecordingNotice}
            </p>
          </form>
        </div>
      ) : (
        /* State 2: Active Recording HUD — 3D Holographic Tactical Radar */
        <div className={`w-[94%] max-w-[420px] sm:max-w-[440px] max-h-[90vh] rounded-2xl overflow-hidden flex flex-col animate-screen-assemble relative my-auto border shadow-2xl ${
          isDark
            ? 'bg-[#040812]/98 border-cyan-500/40 text-zinc-200'
            : 'bg-white border-slate-200 text-slate-800'
        }`}>
          {/* Top Neon Glow Line */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-90 shadow-[0_0_8px_#22d3ee]" />

          {/* Header Bar */}
          <div className={`px-2.5 py-1.5 border-b flex items-center justify-between shrink-0 ${
            isDark ? 'bg-[#02050a] border-zinc-800/80' : 'bg-slate-50 border-slate-200'
          }`}>
            {/* Left: Live REC badge + Route Name */}
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-90" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500 shadow-[0_0_8px_#f43f5e]" />
              </span>
              <span className="text-[9.5px] font-mono font-black text-rose-500 uppercase tracking-widest shrink-0">
                REC
              </span>
              <span className={isDark ? 'text-zinc-600 font-mono text-xs' : 'text-slate-400 font-mono text-xs'}>/</span>
              <span className={`text-xs font-mono font-bold truncate max-w-[90px] sm:max-w-[120px] ${
                isDark ? 'text-zinc-100' : 'text-slate-900'
              }`}>
                {status.name || routeName}
              </span>
            </div>

            {/* Right: Telemetry Badges + Close */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Digital Timer */}
              <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md border ${
                isDark ? 'bg-[#020409] border-cyan-950' : 'bg-slate-100 border-slate-200'
              }`}>
                <Clock className="w-2.5 h-2.5 text-cyan-500" />
                <span className={`text-[11px] font-mono font-black tracking-wider ${
                  isDark ? 'text-cyan-300' : 'text-cyan-700'
                }`}>
                  {formatTimer(status.seconds)}
                </span>
              </div>

              {/* Points badge */}
              <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-md border text-[9.5px] font-mono ${
                isDark ? 'bg-[#020409] border-zinc-800 text-zinc-300' : 'bg-slate-100 border-slate-200 text-slate-700'
              }`}>
                <Footprints className="w-2.5 h-2.5 text-cyan-500" />
                <span>{status.points?.length || 0}</span>
              </div>

              {/* Length badge */}
              <div className={`px-1.5 py-0.5 rounded-md border text-[9.5px] font-mono font-bold ${
                isDark ? 'bg-[#020409] border-zinc-800 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-700'
              }`}>
                ≈{status.length_s}{t.castSecondsUnit}
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={handleCancelRecord}
                className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
                  isDark ? 'text-zinc-400 hover:text-white hover:bg-white/10' : 'text-slate-400 hover:text-slate-800 hover:bg-slate-200'
                }`}
                title={t.cancelBtn}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* 3D WebGL Holographic Tactical Radar */}
          <div className="p-2 flex flex-col gap-1.5">
            <div className={`h-[110px] sm:h-[125px] w-full rounded-xl overflow-hidden relative border shadow-inner ${
              isDark ? 'bg-[#010307] border-cyan-900/60' : 'bg-slate-900 border-slate-300'
            }`}>
              <ThreeRouteRecordView
                points={status.points || []}
                mapId={status.map_id}
              />
            </div>

            {/* Warning if character is standing still */}
            {status.warning && (
              <div className="bg-amber-500/10 border border-amber-500/40 text-amber-600 dark:text-amber-300 px-2 py-0.5 rounded-lg text-[9px] font-mono flex items-center justify-center gap-1.5 animate-pulse shadow-xs">
                <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                <span>{status.warning}</span>
              </div>
            )}

            {/* Bottom Actions Row */}
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <button
                type="button"
                onClick={handleCancelRecord}
                disabled={isStopping}
                className={`h-7.5 px-3 rounded-xl text-xs font-mono transition-colors cursor-pointer ${
                  isDark ? 'text-zinc-400 hover:text-rose-400 hover:bg-rose-950/20' : 'text-slate-500 hover:text-rose-600 hover:bg-rose-50'
                }`}
              >
                {t.cancelBtn}
              </button>

              <button
                type="button"
                onClick={handleFinishAndSave}
                disabled={isStopping || (status.points?.length || 0) < 2}
                className="h-7.5 px-3.5 flex items-center justify-center gap-1.5 rounded-xl text-xs font-mono font-black uppercase tracking-wider bg-gradient-to-r from-emerald-600 to-emerald-400 hover:from-emerald-500 hover:to-emerald-300 text-black shadow-[0_0_15px_rgba(16,185,129,0.45)] disabled:opacity-40 transition-all cursor-pointer active:scale-95"
              >
                {isStopping ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                )}
                <span>{t.saveBtn}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
