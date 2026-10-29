import React, { useState, useEffect, useRef } from 'react';
import { LatticeLoader } from './LatticeLoader';
import { SpecularCard, SpecularButton } from './ui/Specular';
import { Play, Square, Plus, RotateCcw } from 'lucide-react';

interface RouteProcessingCardProps {
  routeName: string;
  waypointsCount?: number;
  duration?: string;
  routeType?: string;
  isBotRunning?: boolean;
  onToggleBot?: () => void;
  onRecordRoute?: () => void;
  language?: 'ru' | 'en';
}

export const RouteProcessingCard: React.FC<RouteProcessingCardProps> = ({
  routeName,
  waypointsCount = 44,
  duration = '≈132 с бега',
  routeType = 'КРУГ',
  isBotRunning = false,
  onToggleBot,
  onRecordRoute,
  language = 'ru',
}) => {
  const isRu = language === 'ru';
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startLoad = () => {
    setIsLoading(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setIsLoading(false);
    }, 850);
  };

  useEffect(() => {
    startLoad();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [routeName]);

  return (
    <div className="w-full relative min-h-[140px] flex flex-col justify-center">
      {/* 1. SEAMLESS MONOCHROME LOADER (Zero green, zero pop jump) */}
      {isLoading ? (
        <SpecularCard className="w-full p-4 sm:p-5 rounded-xl border border-white/[0.08] bg-[#121214] shadow-xl flex items-center justify-between transition-all duration-150 animate-fadeIn">
          <div className="flex items-center gap-3">
            <LatticeLoader
              status="working"
              label={isRu ? 'Синхронизация маршрута' : 'Syncing route'}
              pattern="orbit"
              grid={3}
              shape="round"
              color="#ffffff"
              doneColor="#ffffff"
              glow={true}
              glowColor="rgba(255, 255, 255, 0.45)"
              cellSize={6}
              gap={2.5}
              fontSize={13}
              step={75}
              showTimer={true}
            />
          </div>
          <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">
            {routeName}
          </span>
        </SpecularCard>
      ) : (
        /* 2. REVEALED MONOCHROME SPECULAR ROUTE CARD */
        <SpecularCard className="w-full p-4 sm:p-5 rounded-xl border border-white/[0.08] bg-[#121214] shadow-xl flex flex-col gap-4 transition-all duration-150 animate-fadeIn">
          {/* Header Row */}
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]" />
              <span className="text-xs font-mono font-medium tracking-wide text-zinc-200 uppercase">
                {isRu ? 'Маршрут готов' : 'Route ready'}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/[0.06] text-zinc-300 border border-white/10">
                {routeType}
              </span>
            </div>

            {/* Quick Re-test Action */}
            <button
              type="button"
              onClick={startLoad}
              className="px-2.5 py-1 rounded-md text-xs font-mono text-zinc-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition-colors flex items-center gap-1.5 cursor-pointer"
              title={isRu ? 'Перезагрузить маршрут' : 'Reload route'}
            >
              <RotateCcw className="w-3 h-3" />
              <span>{isRu ? 'Тест' : 'Test'}</span>
            </button>
          </div>

          {/* Main Spec & Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* Left: Route Name & Meta */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg sm:text-xl font-semibold text-white tracking-tight">
                  {routeName}
                </h2>
                <span className="text-[11px] font-mono text-zinc-400 bg-white/[0.05] border border-white/10 px-2 py-0.5 rounded">
                  {waypointsCount} {isRu ? 'точек' : 'pts'}
                </span>
              </div>
              <p className="text-xs font-mono tabular-nums text-zinc-400 flex items-center gap-2">
                <span>{duration}</span>
                <span className="text-zinc-600">•</span>
                <span>{isRu ? 'Режим: Сбор руды и трав' : 'Mode: Gathering'}</span>
              </p>
            </div>

            {/* Right: High Contrast White Action Buttons */}
            <div className="flex items-center gap-2 shrink-0">
              {onRecordRoute && (
                <SpecularButton
                  onClick={onRecordRoute}
                  className="h-9 px-3.5 rounded-lg text-xs font-medium bg-[#18181b] hover:bg-[#222226] text-zinc-200 border border-white/10 flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-zinc-400" />
                  <span>{isRu ? 'Записать' : 'Record'}</span>
                </SpecularButton>
              )}

              {onToggleBot && (
                <SpecularButton
                  onClick={onToggleBot}
                  className={`h-9 px-4 rounded-lg text-xs font-medium flex items-center gap-2 cursor-pointer shadow-sm transition-all ${
                    isBotRunning
                      ? 'bg-zinc-200 hover:bg-zinc-100 text-zinc-950 font-semibold ring-1 ring-white'
                      : 'bg-white hover:bg-zinc-100 text-zinc-950 font-semibold ring-1 ring-white/20'
                  }`}
                >
                  {isBotRunning ? (
                    <>
                      <Square className="w-3.5 h-3.5 fill-current" />
                      <span>{isRu ? 'Остановить' : 'Stop Bot'}</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>{isRu ? 'Запустить бота' : 'Start Bot'}</span>
                    </>
                  )}
                </SpecularButton>
              )}
            </div>
          </div>
        </SpecularCard>
      )}
    </div>
  );
};
