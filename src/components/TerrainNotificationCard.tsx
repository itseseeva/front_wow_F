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

  useEffect(() => {
    if (terrain.status === 'ready') {
      const timer = setTimeout(() => {
        onClose();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [terrain.status, onClose]);

  // When terrain is ready, do not display annoying notification
  if (isReady) {
    return null;
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
    <div className={`w-full p-2.5 rounded-xl border-2 backdrop-blur-md text-xs font-fantasy shadow-2xl pointer-events-auto select-none transition-all duration-300 animate-fadeIn relative flex flex-col gap-2 ${
      isDark
        ? 'border-[#785a28] bg-[#161216] text-[#d9c8a9] shadow-[inset_0_0_24px_rgba(0,0,0,0.95)]'
        : 'border-[#bfa57a] bg-[#faf4ea] text-slate-800 shadow-md'
    }`}>
      {/* 1. Header Line: Ruby Gemstone + Cinzel Title + Close Button */}
      <div className="flex items-center justify-between gap-1.5 shrink-0 border-b pb-1.5 border-[#5a4422]/60">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-b from-red-500 to-red-800 border border-[#f0b232] shadow-[0_0_8px_rgba(240,178,50,0.7)] shrink-0" />
          <h4 className={`text-xs sm:text-[13px] font-fantasy font-black tracking-wide truncate ${
            isDark ? 'text-wow-gold' : 'text-[#422206]'
          }`}>
            {isError ? (isEn ? 'Terrain build error' : 'Ошибка сборки местности') : `${t.terrainBuildingTitle} • «${routeName}»`}
          </h4>
        </div>

        <button
          type="button"
          onClick={onClose}
          className={`p-1 rounded-md transition-colors cursor-pointer shrink-0 border ${
            isDark ? 'border-[#5a4422] bg-[#141014] text-[#a89274] hover:text-[#f5d17f] hover:border-[#c89b3c]' : 'border-[#d9c8a9] bg-white text-slate-500 hover:text-slate-900'
          }`}
          title={t.recordModalClose}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Error State */}
      {isError ? (
        <div className="py-2.5 px-3 rounded-xl bg-red-950/40 border-2 border-red-700/60 space-y-1">
          <div className="flex items-center gap-2 text-red-300 font-bold text-[11px]">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{terrain.error || (isEn ? 'Failed to build terrain mesh' : 'Не удалось построить сетку местности')}</span>
          </div>
          <p className="text-[9.5px] text-[#a89274] pl-6 leading-tight">
            {isEn ? 'Bot will navigate without mesh; rebuild will retry next record.' : 'Бот сможет двигаться без сетки; повторная сборка запустится при следующей записи.'}
          </p>
        </div>
      ) : (
        /* Active Building State - Real 3D WebGL Three.js Scene */
        <div className="flex flex-col gap-2">
          {/* 2. Subheader: [ ОБЪЕКТЫ ] badge + Count + Glowing Amber Gold */}
          <div className="flex items-center justify-between text-xs px-0.5">
            <span className={`px-2.5 py-0.5 rounded-md font-fantasy font-black tracking-widest text-[9.5px] border-2 ${
              isDark
                ? 'bg-[#22181d] border-[#5a4422] text-[#f5d17f]'
                : 'bg-amber-50 border-[#c89b3c] text-[#785a28]'
            }`}>
              {stageBadge}
            </span>

            <div className="flex items-center gap-3">
              {countText && (
                <span className={`font-fantasy font-bold text-[11.5px] ${isDark ? 'text-wow-parchment' : 'text-slate-600'}`}>
                  {countText}
                </span>
              )}
              <span className="font-fantasy font-black text-sm sm:text-base text-wow-gold drop-shadow-[0_0_8px_rgba(240,178,50,0.85)]">
                {progressPercent}%
              </span>
            </div>
          </div>

          {/* 3. Real 3D WebGL Interactive Three.js Scene */}
          <div className="rounded-lg overflow-hidden border-2 border-[#5a4422] bg-[#0c090c]">
            <ThreeTerrainScene
              progress={terrain.progress || 0}
              stageName={terrain.stage || 'models'}
              language={language}
            />
          </div>

          {/* 4. World of Warcraft Cast Bar with Liquid Amber/Gold Fill */}
          <div className="pt-0.5 flex flex-col gap-1.5">
            <div className={`wow-castbar-track w-full h-3 rounded-sm relative border-2 ${
              isDark ? 'border-[#785a28] bg-[#0c090c]' : 'border-[#785a28] bg-stone-900'
            }`}>
              <div
                className="wow-castbar-fill h-full relative transition-all duration-300 ease-out"
                style={{ width: `${Math.max(2, progressPercent)}%` }}
              >
                {/* Glowing edge bead */}
                <div className="absolute right-0 top-0 bottom-0 w-2 bg-[#fff0a6] rounded-sm shadow-[0_0_8px_#ffffff]" />
              </div>
            </div>

            {/* Timers below Cast Bar */}
            <div className={`flex items-center justify-between text-[10px] font-fantasy px-0.5 ${
              isDark ? 'text-wow-parchment' : 'text-slate-600'
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
