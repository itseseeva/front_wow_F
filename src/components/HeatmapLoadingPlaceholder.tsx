import React from 'react';
import { Loader2 } from 'lucide-react';

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
      className={`relative overflow-hidden bg-[#0c0c0f] flex flex-col items-center justify-center gap-2.5 select-none font-mono ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.025] via-transparent to-white/[0.02] animate-pulse pointer-events-none" />
      <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/[0.045] to-transparent animate-heatmap-shimmer pointer-events-none" />
      <Loader2 className="relative z-10 w-5 h-5 animate-spin text-zinc-400" />
      <span className="relative z-10 text-xs text-zinc-400 tracking-wide">
        {label}
      </span>
    </div>
  );
};
