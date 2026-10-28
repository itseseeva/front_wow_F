import React, { useState, useEffect } from 'react';
import { TerrainStatus } from '../types';
import { getPywebviewApi } from '../utils/pywebviewBridge';
import { mockGetTerrainStatus } from '../data/mockRoutes';
import { CheckCircle2, AlertCircle } from 'lucide-react';

import { Language, Theme, translations } from '../utils/i18n';

interface TerrainHeaderIndicatorProps {
  initialTerrain: TerrainStatus | null;
  onClear?: () => void;
  onToggleCard?: () => void;
  language?: Language;
  theme?: Theme;
}

export const TerrainHeaderIndicator: React.FC<TerrainHeaderIndicatorProps> = ({
  initialTerrain,
  onClear,
  onToggleCard,
  language = 'ru',
  theme = 'dark',
}) => {
  const isDark = theme === 'dark';
  const t = translations[language];
  const [terrain, setTerrain] = useState<TerrainStatus | null>(initialTerrain);
  const [showReady, setShowReady] = useState<boolean>(false);

  useEffect(() => {
    if (initialTerrain) {
      setTerrain(initialTerrain);
      if (initialTerrain.status === 'ready') {
        setShowReady(true);
      }
    }
  }, [initialTerrain]);

  // Poll get_terrain_status(map_id) while building
  useEffect(() => {
    if (!terrain || terrain.status === 'ready' || terrain.status === 'error' || terrain.status === 'none') {
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
          setTerrain((prev) => (prev ? { ...prev, ...res, status: res.status ?? prev.status } : null));
          if (res.status === 'ready') {
            setShowReady(true);
          }
        }
      } catch (err) {
        console.warn('Terrain poll warning:', err);
      }
    };

    const interval = window.setInterval(poll, 1000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [terrain?.map_id, terrain?.status]);

  // Listen to window event 'wowbot:terrain-status'
  useEffect(() => {
    const handleTerrainEvent = (e: any) => {
      const detail: TerrainStatus = e?.detail;
      if (detail) {
        setTerrain(detail);
        if (detail.status === 'ready') {
          setShowReady(true);
        }
      }
    };

    window.addEventListener('wowbot:terrain-status', handleTerrainEvent);
    return () => {
      window.removeEventListener('wowbot:terrain-status', handleTerrainEvent);
    };
  }, []);

  // Ready icon auto-dismisses after 15s or can be clicked
  useEffect(() => {
    if (showReady) {
      const timer = setTimeout(() => {
        setShowReady(false);
        if (onClear) onClear();
      }, 15000);
      return () => clearTimeout(timer);
    }
  }, [showReady, onClear]);

  if (!terrain || terrain.status === 'none') {
    return null;
  }

  // 1. Ready state: clean glowing checkmark icon only (no big text!)
  if (showReady || terrain.status === 'ready') {
    return (
      <div
        onClick={() => {
          setShowReady(false);
          if (onClear) onClear();
        }}
        className={`flex items-center gap-1 px-1.5 py-1 rounded-md border cursor-pointer select-none active:scale-95 animate-fadeIn transition-colors ${
          isDark
            ? 'bg-[#061810] border-emerald-500/70 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.4)] hover:border-emerald-400'
            : 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-xs hover:border-emerald-400'
        }`}
        title={`${t.terrainGridReady} (${language === 'ru' ? 'нажмите, чтобы скрыть' : 'click to dismiss'})`}
      >
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 drop-shadow-[0_0_6px_rgba(52,211,153,0.9)]" />
      </div>
    );
  }

  // 2. Error state: small alert icon only
  if (terrain.status === 'error') {
    return (
      <div
        onClick={() => {
          if (onToggleCard) {
            onToggleCard();
          } else if (onClear) {
            onClear();
          }
        }}
        className={`flex items-center gap-1 px-1.5 py-1 rounded-md border cursor-pointer select-none active:scale-95 animate-fadeIn transition-colors ${
          isDark
            ? 'bg-[#1a0a0f] border-rose-500/70 text-rose-300 shadow-[0_0_10px_rgba(244,63,94,0.3)] hover:border-rose-400'
            : 'bg-rose-50 border-rose-300 text-rose-700 shadow-xs hover:border-rose-400'
        }`}
        title={terrain.error || (language === 'ru' ? 'Ошибка сборки местности (нажмите для просмотра)' : 'Terrain build error (click to view)')}
      >
        <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
      </div>
    );
  }

  // 3. Building state: small cyan pulsing dot + micro percent (click toggles visualizer card)
  const percent = Math.min(100, Math.max(1, Math.round((terrain.progress || 0) * 100)));
  const etaText = terrain.eta_s != null ? `≈${terrain.eta_s}${t.castSecondsUnit}` : '...';

  return (
    <div
      onClick={() => {
        if (onToggleCard) onToggleCard();
      }}
      className={`flex items-center gap-1 px-1.5 py-1 rounded-md border select-none animate-fadeIn cursor-pointer active:scale-95 transition-all ${
        isDark
          ? 'bg-[#071320] border-cyan-500/70 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.3)] hover:border-cyan-400 hover:shadow-[0_0_14px_rgba(6,182,212,0.45)]'
          : 'bg-cyan-50 border-cyan-400 text-cyan-800 shadow-xs hover:border-cyan-500'
      }`}
      title={`${t.terrainBuildingTitle}: ${terrain.done}/${terrain.total} (${etaText}).`}
    >
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-80" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400 shadow-[0_0_6px_rgba(6,182,212,1)]" />
      </span>
      <span className="text-[9.5px] font-mono font-bold">{percent}%</span>
    </div>
  );
};
