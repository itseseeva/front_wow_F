import React, { useState, useEffect } from 'react';
import { TerrainStatus } from '../types';
import { getPywebviewApi } from '../utils/pywebviewBridge';
import { mockGetTerrainStatus } from '../data/mockRoutes';
import { ThreeTerrainScene } from './ThreeTerrainScene';
import { AlertCircle, X } from 'lucide-react';

interface TerrainNotificationCardProps {
  routeName: string;
  initialTerrain: TerrainStatus;
  onClose: () => void;
}

export function formatHumanSeconds(sec: number): string {
  if (sec <= 0) return '0 с';
  if (sec < 60) return `${sec} с`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `${m} мин ${s} с` : `${m} мин`;
}

export const TerrainNotificationCard: React.FC<TerrainNotificationCardProps> = ({
  routeName,
  initialTerrain,
  onClose,
}) => {
  const [terrain, setTerrain] = useState<TerrainStatus>(initialTerrain);

  // Poll get_terrain_status(map_id) every 1s while card is building
  useEffect(() => {
    if (terrain.status === 'ready' || terrain.status === 'error') {
      return;
    }

    let isMounted = true;

    const poll = async () => {
      try {
        let res: { ok: boolean; error?: string } & Partial<TerrainStatus>;
        const api = await getPywebviewApi();
        if (api?.get_terrain_status) {
          res = await api.get_terrain_status(terrain.map_id);
        } else {
          res = await mockGetTerrainStatus(terrain.map_id);
        }

        if (!isMounted) return;

        if (res && res.status) {
          setTerrain((prev) => ({
            ...prev,
            ...res,
            status: res.status ?? prev.status,
          }));
        }
      } catch (err) {
        console.warn('Error polling terrain status:', err);
      }
    };

    const interval = window.setInterval(poll, 1000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [terrain.map_id, terrain.status]);

  // Listen for window event "wowbot:terrain-status"
  useEffect(() => {
    const handleTerrainEvent = (e: any) => {
      const detail: TerrainStatus = e?.detail;
      if (detail && detail.map_id === terrain.map_id) {
        setTerrain(detail);
      }
    };

    window.addEventListener('wowbot:terrain-status', handleTerrainEvent);
    return () => {
      window.removeEventListener('wowbot:terrain-status', handleTerrainEvent);
    };
  }, [terrain.map_id]);

  // If ready: automatically dismiss immediately without rendering the green banner
  useEffect(() => {
    if (terrain.status === 'ready') {
      onClose();
    }
  }, [terrain.status, onClose]);

  // Do not render if ready!
  if (terrain.status === 'ready') {
    return null;
  }

  const isError = terrain.status === 'error';

  const stageBadge =
    terrain.stage === 'tiles'
      ? 'КАРТА'
      : terrain.stage === 'models'
      ? 'ОБЪЕКТЫ'
      : terrain.stage === 'grid'
      ? 'НАВМЕШ'
      : 'СЕТКА';

  const hasCount = terrain.total > 0;
  const countText = hasCount ? `${terrain.done} / ${terrain.total}` : '';

  const etaText =
    terrain.eta_s != null ? `${formatHumanSeconds(terrain.eta_s)}` : 'оцениваю…';
  const elapsedText =
    terrain.elapsed_s != null ? `${formatHumanSeconds(terrain.elapsed_s)}` : '0 с';

  const progressPercent = Math.max(0, Math.min(100, Math.round((terrain.progress || 0) * 100)));

  return (
    <div className="w-full p-2 rounded-xl border border-cyan-800/40 bg-[#040812]/95 backdrop-blur-md text-xs font-mono shadow-[0_0_25px_rgba(0,0,0,0.95)] pointer-events-auto select-none transition-all duration-300 animate-fadeIn relative flex flex-col gap-1.5">
      {/* 1. Header Line: Cyan Glowing Disc + Title + Close Button */}
      <div className="flex items-center justify-between gap-1.5 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] shrink-0" />
          <h4 className="text-[12px] sm:text-[13px] font-mono font-medium tracking-wide text-zinc-100 truncate">
            {isError ? 'Ошибка сборки местности' : `Сборка местности • «${routeName}»`}
          </h4>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="text-zinc-400 hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors cursor-pointer shrink-0"
          title="Закрыть окно сборки"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Error State */}
      {isError ? (
        <div className="py-2.5 px-3 rounded-xl bg-[#18090d] border border-rose-600/50 space-y-1">
          <div className="flex items-center gap-2 text-rose-300 font-bold text-[11px]">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{terrain.error || 'Не удалось построить сетку местности'}</span>
          </div>
          <p className="text-[9.5px] text-zinc-400 pl-6 leading-tight">
            Бот сможет двигаться без сетки; повторная сборка запустится при следующей записи.
          </p>
        </div>
      ) : (
        /* Active Building State - Real 3D WebGL Three.js Scene */
        <div className="flex flex-col gap-2">
          {/* 2. Subheader: [ ОБЪЕКТЫ ] badge + Count + Glowing 10% */}
          <div className="flex items-center justify-between text-xs px-0.5">
            <span className="px-2.5 py-0.5 rounded-md bg-[#061424] border border-cyan-800/60 text-cyan-300 font-bold tracking-widest text-[9.5px]">
              {stageBadge}
            </span>

            <div className="flex items-center gap-3">
              {countText && (
                <span className="font-mono text-zinc-400 text-[11.5px]">{countText}</span>
              )}
              <span className="font-mono font-extrabold text-sm sm:text-base text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.85)]">
                {progressPercent}%
              </span>
            </div>
          </div>

          {/* 3. Real 3D WebGL Interactive Three.js Scene (Silky-smooth, continuous 60 FPS) */}
          <ThreeTerrainScene
            progress={terrain.progress || 0}
            stageName={terrain.stage || 'models'}
          />

          {/* 4. Glowing Cyan Progress Bar at the bottom */}
          <div className="pt-0.5 flex flex-col gap-1.5">
            <div className="w-full h-1.5 bg-[#081324] rounded-full overflow-hidden relative border border-cyan-950/80">
              <div
                className="h-full bg-gradient-to-r from-cyan-600 via-cyan-400 to-[#38bdf8] rounded-full relative transition-all duration-300 ease-out shadow-[0_0_12px_rgba(6,182,212,0.95)]"
                style={{ width: `${Math.max(2, progressPercent)}%` }}
              >
                {/* Glowing bead on the right edge */}
                <div className="absolute right-0 top-0 bottom-0 w-2.5 bg-white/90 rounded-full shadow-[0_0_8px_#ffffff]" />
              </div>
            </div>

            {/* Timers below Progress Bar */}
            <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 px-0.5">
              <span>Осталось ≈ {etaText}</span>
              <span>прошло {elapsedText}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
