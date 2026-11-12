import React, { useState, useEffect } from 'react';

export const RARITY_COLOR_MAP: Record<number, { border: string; glow: string; text?: string }> = {
  0: { border: '#9d9d9d', glow: 'rgba(157, 157, 157, 0.4)', text: '#9d9d9d' },
  1: { border: '#ffffff', glow: 'rgba(255, 255, 255, 0.4)' },
  2: { border: '#1eff00', glow: 'rgba(30, 255, 0, 0.4)', text: '#1eff00' },
  3: { border: '#0070dd', glow: 'rgba(0, 112, 221, 0.4)', text: '#0070dd' },
  4: { border: '#a335ee', glow: 'rgba(163, 53, 238, 0.4)', text: '#a335ee' },
  5: { border: '#ff8000', glow: 'rgba(255, 128, 0, 0.4)', text: '#ff8000' },
};

const DEFAULT_RARITY = {
  border: '#9d9d9d',
  glow: 'rgba(157, 157, 157, 0.4)',
  text: '#9d9d9d',
};

export const getRarityMeta = (quality?: number | null) => {
  if (quality == null) return DEFAULT_RARITY;
  return RARITY_COLOR_MAP[quality] ?? DEFAULT_RARITY;
};

export const ItemIcon: React.FC<{
  iconUrl?: string | null;
  alt: string;
  quality?: number | null;
}> = ({ iconUrl, alt, quality }) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [iconUrl]);

  const rarity = getRarityMeta(quality);
  const showImage = Boolean(iconUrl) && !hasError;

  return (
    <div
      className="w-7 h-7 rounded-[4px] bg-zinc-900/90 flex items-center justify-center overflow-hidden shrink-0 select-none"
      style={{
        border: `1.5px solid ${rarity.border}`,
        boxShadow: `0 0 6px ${rarity.glow}`,
      }}
    >
      {showImage ? (
        <img
          src={iconUrl!}
          alt={alt}
          loading="lazy"
          onError={() => setHasError(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <span className="text-[11px] font-mono font-bold text-zinc-400 leading-none">?</span>
      )}
    </div>
  );
};
