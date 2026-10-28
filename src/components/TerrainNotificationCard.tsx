import React, { useState, useEffect } from 'react';
import { TerrainStatus } from '../types';
import { getPywebviewApi } from '../utils/pywebviewBridge';
import { mockGetTerrainStatus } from '../data/mockRoutes';
import { ThreeTerrainScene } from './ThreeTerrainScene';
import { AlertCircle, X } from 'lucide-react';
import { Language, Theme, translations } from '../utils/i18n';

interface TerrainNotificationCardProps {
  routeName: string;
  initialTerrain: TerrainStatus;
  onClose: () => void;
  language?: Language;
  theme?: Theme;
}

export function formatHumanSeconds(sec: number, isEn: boolean): string {
  if (sec <= 0) return isEn ? '0 s' : '0 с';
  if (sec < 60) return isEn ? `${sec} s` : `${sec} с`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (isEn) {
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
  return s > 0 ? `${m} мин ${s} с` : `${m} мин`;
}

export const TerrainNotificationCard: React.FC<TerrainNotificationCardProps> = ({
  routeName,
  initialTerrain,
  onClose,
  language = 'ru',
  theme = 'dark',
}) => {
  const t = translations[language];
  const isDark = theme === 'dark';
  const isEn = language === 'en';

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
        console.warn('Card poll warning:', err);
      }
    };

    const interval = window.setInterval(poll, 1000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [terrain.map_id, terrain.status]);

  const isReady = terrain.status === 'ready';
  const isError = terrain.status === 'error';

  // Ready Card: Minimal green indicator with close button
  if (isReady) {
    return (
      <div className={`w-full p-2.5 rounded-xl border flex items-center justify-between text-xs font-mono shadow-md animate-fadeIn select-none ${
        isDark
          ? 'bg-[#04140b]/95 border-emerald-500/60 text-emerald-200'
          : 'bg-emerald-50 border-emerald-300 text-emerald-900'
      }`}>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] shrink-0" />
          <span className="font-bold">
            {t.terrainReadyTitle}: «{routeName}»
          </span>
          <span className={isDark ? 'text-zinc-500' : 'text-slate-400'}>•</span>
          <span className={isDark ? 'text-zinc-400 text-[11px]' : 'text-slate-600 text-[11px]'}>
            {t.terrainGridReady}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className={`p-1 rounded-md transition-colors cursor-pointer ${
            isDark ? 'text-zinc-400 hover:text-white' : 'text-slate-400 hover:text-slate-800'
          }`}
          title={t.recordModalClose}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  const stageBadge =
    terrain.stage === 'tiles'
      ? isEn ? 'TILES' : 'ТАЙЛЫ КАРТЫ'
      : terrain.stage === 'models'
      ? isEn ? 'OBJECTS' : 'ОБЪЕКТЫ'
      : terrain.stage === 'grid'
      ? isEn ? 'NAVMESH' : 'НАВМЕШ'
      : isEn ? 'GRID' : 'СЕТКА';

  const hasCount = terrain.total > 0;
  const countText = hasCount ? `${terrain.done} / ${terrain.total}` : '';

  const etaText =
    terrain.eta_s != null ? `${formatHumanSeconds(terrain.eta_s, isEn)}` : isEn ? 'estimating…' : 'оцениваю…';
  const elapsedText =
    terrain.elapsed_s != null ? `${formatHumanSeconds(terrain.elapsed_s, isEn)}` : isEn ? '0 s' : '0 с';

  const progressPercent = Math.max(0, Math.min(100, Math.round((terrain.progress || 0) * 100)));

  return (
    <div className={`w-full p-2 rounded-xl border backdrop-blur-md text-xs font-mono shadow-xl pointer-events-auto select-none transition-all duration-300 animate-fadeIn relative flex flex-col gap-1.5 ${
      isDark
        ? 'border-cyan-800/40 bg-[#040812]/95 text-zinc-100'
        : 'border-slate-200 bg-white/95 text-slate-800 shadow-md'
    }`}>
      {/* 1. Header Line: Cyan Glowing Disc + Title + Close Button */}
      <div className="flex items-center justify-between gap-1.5 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] shrink-0" />
          <h4 className={`text-[12px] sm:text-[13px] font-mono font-medium tracking-wide truncate ${
            isDark ? 'text-zinc-100' : 'text-slate-900'
          }`}>
            {isError ? (isEn ? 'Terrain build error' : 'Ошибка сборки местности') : `${t.terrainBuildingTitle} • «${routeName}»`}
          </h4>
        </div>

        <button
          type="button"
          onClick={onClose}
          className={`p-1 rounded-md transition-colors cursor-pointer shrink-0 ${
            isDark ? 'text-zinc-400 hover:text-white hover:bg-white/10' : 'text-slate-400 hover:text-slate-800 hover:bg-slate-100'
          }`}
          title={t.recordModalClose}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Error State */}
      {isError ? (
        <div className="py-2.5 px-3 rounded-xl bg-rose-500/10 border border-rose-500/40 space-y-1">
          <div className="flex items-center gap-2 text-rose-500 font-bold text-[11px]">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{terrain.error || (isEn ? 'Failed to build terrain mesh' : 'Не удалось построить сетку местности')}</span>
          </div>
          <p className="text-[9.5px] text-slate-500 dark:text-zinc-400 pl-6 leading-tight">
            {isEn ? 'Bot will navigate without mesh; rebuild will retry next record.' : 'Бот сможет двигаться без сетки; повторная сборка запустится при следующей записи.'}
          </p>
        </div>
      ) : (
        /* Active Building State - Real 3D WebGL Three.js Scene */
        <div className="flex flex-col gap-2">
          {/* 2. Subheader: [ ОБЪЕКТЫ ] badge + Count + Glowing 10% */}
          <div className="flex items-center justify-between text-xs px-0.5">
            <span className={`px-2.5 py-0.5 rounded-md font-bold tracking-widest text-[9.5px] border ${
              isDark
                ? 'bg-[#061424] border-cyan-800/60 text-cyan-300'
                : 'bg-cyan-50 border-cyan-200 text-cyan-800'
            }`}>
              {stageBadge}
            </span>

            <div className="flex items-center gap-3">
              {countText && (
                <span className={`font-mono text-[11.5px] ${isDark ? 'text-zinc-400' : 'text-slate-500'}`}>
                  {countText}
                </span>
              )}
              <span className="font-mono font-extrabold text-sm sm:text-base text-cyan-500 drop-shadow-[0_0_8px_rgba(34,211,238,0.85)]">
                {progressPercent}%
              </span>
            </div>
          </div>

          {/* 3. Real 3D WebGL Interactive Three.js Scene */}
          <ThreeTerrainScene
            progress={terrain.progress || 0}
            stageName={terrain.stage || 'models'}
          />

          {/* 4. Glowing Cyan Progress Bar at the bottom */}
          <div className="pt-0.5 flex flex-col gap-1.5">
            <div className={`w-full h-1.5 rounded-full overflow-hidden relative border ${
              isDark ? 'bg-[#081324] border-cyan-950/80' : 'bg-slate-200 border-slate-300'
            }`}>
              <div
                className="h-full bg-gradient-to-r from-cyan-600 via-cyan-400 to-[#38bdf8] rounded-full relative transition-all duration-300 ease-out shadow-[0_0_12px_rgba(6,182,212,0.95)]"
                style={{ width: `${Math.max(2, progressPercent)}%` }}
              >
                {/* Glowing bead on the right edge */}
                <div className="absolute right-0 top-0 bottom-0 w-2.5 bg-white/90 rounded-full shadow-[0_0_8px_#ffffff]" />
              </div>
            </div>

            {/* Timers below Progress Bar */}
            <div className={`flex items-center justify-between text-[10px] font-mono px-0.5 ${
              isDark ? 'text-zinc-400' : 'text-slate-500'
            }`}>
              <span>{t.terrainRemaining} ≈ {etaText}</span>
              <span>{t.terrainElapsed} {elapsedText}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
