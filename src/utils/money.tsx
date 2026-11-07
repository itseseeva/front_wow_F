import React from 'react';

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
}> = ({ copper, language = 'ru', className = '' }) => {
  if (copper === null || copper === undefined) {
    return (
      <span className={`text-zinc-500 italic font-mono text-xs ${className}`}>
        {language === 'ru' ? 'нет цены' : 'no price'}
      </span>
    );
  }

  const sign = copper < 0 ? '-' : '';
  const total = Math.abs(Math.round(copper));

  const g = Math.floor(total / 10000);
  const s = Math.floor((total % 10000) / 100);
  const c = total % 100;

  const gUnit = language === 'ru' ? 'з' : 'g';
  const sUnit = language === 'ru' ? 'с' : 's';
  const cUnit = language === 'ru' ? 'м' : 'c';

  if (g === 0 && s === 0 && c === 0) {
    return (
      <span className={`font-mono text-xs tabular-nums text-zinc-500 ${className}`}>
        0{cUnit}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-xs tabular-nums ${className}`}>
      {sign}
      {g > 0 && (
        <span className="text-zinc-950 dark:text-white font-semibold">
          {g}
          <span className="text-[10px] ml-0.5 opacity-70">{gUnit}</span>
        </span>
      )}
      {s > 0 && (
        <span className="text-zinc-600 dark:text-zinc-400 font-medium">
          {s}
          <span className="text-[10px] ml-0.5 opacity-70">{sUnit}</span>
        </span>
      )}
      {c > 0 && (
        <span className="text-zinc-500 dark:text-zinc-500">
          {c}
          <span className="text-[10px] ml-0.5 opacity-70">{cUnit}</span>
        </span>
      )}
    </span>
  );
};
