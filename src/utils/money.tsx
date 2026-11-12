import React from 'react';
import coinGoldImg from '../assets/coins/coin-gold.png';
import coinSilverImg from '../assets/coins/coin-silver.png';
import coinCopperImg from '../assets/coins/coin-copper.png';

export type CoinKind = 'gold' | 'silver' | 'copper';

const COIN_SRC: Record<CoinKind, string> = {
  gold: coinGoldImg,
  silver: coinSilverImg,
  copper: coinCopperImg,
};

export const CoinIcon: React.FC<{
  kind: CoinKind;
  alt?: string;
  className?: string;
}> = ({ kind, alt = '', className = '' }) => (
  <img
    src={COIN_SRC[kind]}
    alt={alt}
    draggable={false}
    className={`inline-block w-[0.95em] h-[0.95em] shrink-0 select-none [image-rendering:pixelated] ${className}`}
  />
);

/**
 * Format copper currency like World of Warcraft:
 * 1 gold (з) = 10000 copper (м)
 * 1 silver (с) = 100 copper (м)
 * 1 copper (м) = 1 copper
 * Zero parts are omitted (e.g. 500 -> «5с», 10000 -> «1з», 10050 -> «1з 50м»).
 * If null/undefined -> «нет цены» (or «no price» in English).
 * If 0 -> «0м» (or «0c»).
 */
export function formatCopper(
  copper: number | null | undefined,
  language: 'ru' | 'en' = 'ru'
): string {
  if (copper === null || copper === undefined) {
    return language === 'ru' ? 'нет цены' : 'no price';
  }

  const sign = copper < 0 ? '-' : '';
  const total = Math.abs(Math.round(copper));

  const g = Math.floor(total / 10000);
  const s = Math.floor((total % 10000) / 100);
  const c = total % 100;

  const gUnit = language === 'ru' ? 'з' : 'g';
  const sUnit = language === 'ru' ? 'с' : 's';
  const cUnit = language === 'ru' ? 'м' : 'c';

  const parts: string[] = [];
  if (g > 0) parts.push(`${g}${gUnit}`);
  if (s > 0) parts.push(`${s}${sUnit}`);
  if (c > 0) parts.push(`${c}${cUnit}`);

  if (parts.length === 0) {
    return `0${cUnit}`;
  }

  return sign + parts.join(' ');
}

/**
 * Visual Money Display with authentic WoW coin colors:
 * Gold: #f59e0b (amber-400)
 * Silver: #d4d4d8 (zinc-300)
 * Copper: #d97706 (amber-600)
 */
export const MoneyBadge: React.FC<{
  copper: number | null | undefined;
  language?: 'ru' | 'en';
  className?: string;
  nullText?: string;
}> = ({ copper, language = 'ru', className = '', nullText }) => {
  const sizeClass = /\btext-(xs|sm|base|lg|xl|2xl|3xl)\b/.test(className) ? '' : 'text-xs';

  if (copper === null || copper === undefined) {
    return (
      <span className={`text-zinc-500 font-mono ${sizeClass} ${className}`}>
        {nullText ?? (language === 'ru' ? 'нет цены' : 'no price')}
      </span>
    );
  }

  const sign = copper < 0 ? '-' : '';
  const total = Math.abs(Math.round(copper));

  const g = Math.floor(total / 10000);
  const s = Math.floor((total % 10000) / 100);
  const c = total % 100;

  const titleText = formatCopper(copper, language);

  if (g === 0 && s === 0 && c === 0) {
    return (
      <span
        title={titleText}
        className={`inline-flex items-center gap-1 font-mono ${sizeClass} tabular-nums ${className}`}
      >
        <span className="text-zinc-700 dark:text-zinc-300">0</span>
        <CoinIcon kind="copper" alt={language === 'ru' ? 'м' : 'c'} />
      </span>
    );
  }

  return (
    <span
      title={titleText}
      className={`inline-flex items-center gap-2 font-mono ${sizeClass} tabular-nums ${className}`}
    >
      {sign}
      {g > 0 && (
        <span className="inline-flex items-center gap-1 font-semibold text-zinc-900 dark:text-zinc-100">
          <span>{g}</span>
          <CoinIcon kind="gold" alt={language === 'ru' ? 'з' : 'g'} />
        </span>
      )}
      {s > 0 && (
        <span className="inline-flex items-center gap-1 font-medium text-zinc-700 dark:text-zinc-200">
          <span>{s}</span>
          <CoinIcon kind="silver" alt={language === 'ru' ? 'с' : 's'} />
        </span>
      )}
      {c > 0 && (
        <span className="inline-flex items-center gap-1 text-zinc-600 dark:text-zinc-300">
          <span>{c}</span>
          <CoinIcon kind="copper" alt={language === 'ru' ? 'м' : 'c'} />
        </span>
      )}
    </span>
  );
};
