import React from 'react';

export interface HeatmapLoadingPlaceholderProps {
  mode: 'loading' | 'building';
  language?: 'ru' | 'en';
  className?: string;
}

export const HeatmapLoadingPlaceholder: React.FC<HeatmapLoadingPlaceholderProps> = ({
  mode,
  language = 'ru',
  className = '',
}) => {
  const isRu = language === 'ru';
  const label =
    mode === 'building'
      ? (isRu ? 'Карта строится…' : 'Building map…')
      : (isRu ? 'Загружаю карту…' : 'Loading map…');

  return (
    <div
      className={`absolute inset-0 z-20 grid place-items-center overflow-hidden bg-[#09090b] select-none font-mono ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/[0.045] to-transparent animate-heatmap-shimmer pointer-events-none" />
      <div className="relative z-10 flex flex-col items-center justify-center gap-3 text-center">
        <span className="w-8 h-8 rounded-full border-2 border-white/15 border-t-white animate-spin" />
        <span className="text-xs text-zinc-400 tracking-wide">
          {label}
        </span>
      </div>
    </div>
  );
};
