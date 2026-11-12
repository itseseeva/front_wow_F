import React, { useMemo } from 'react';
import { LootRow } from '../types';
import { MoneyBadge } from '../utils/money';
import { ItemIcon, getRarityMeta } from './ItemIcon';
import { SpecularCard } from './ui/Specular';

interface SplitLootTablesProps {
  items: LootRow[];
  earnedCopper?: number | null;
  earnedComplete?: boolean;
  lootLost?: number | null;
  language: 'ru' | 'en';
  variant?: 'modal' | 'frameless';
  showTotalHeader?: boolean;
}

const computeTableTotal = (rows: LootRow[]): number | null => {
  if (rows.length === 0) return 0;
  let sum = 0;
  let hasAnyValue = false;
  for (const r of rows) {
    if (r.value != null) {
      sum += r.value;
      hasAnyValue = true;
    }
  }
  return hasAnyValue ? sum : null;
};

const LootSubTable: React.FC<{
  title: string;
  rows: LootRow[];
  language: 'ru' | 'en';
  variant: 'modal' | 'frameless';
}> = ({ title, rows, language, variant }) => {
  const isRu = language === 'ru';
  const totalCopper = useMemo(() => computeTableTotal(rows), [rows]);

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const valA = a.value ?? a.price ?? -1;
      const valB = b.value ?? b.price ?? -1;
      if (valB !== valA) return valB - valA;
      return (b.count ?? 0) - (a.count ?? 0);
    });
  }, [rows]);

  const content = (
    <div className="flex flex-col justify-between gap-3 font-mono h-full">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono font-medium text-zinc-700 dark:text-zinc-300">
            {title}
          </span>
          <span className="text-[11px] text-zinc-500">
            {sortedRows.length} {isRu ? 'поз.' : 'items'}
          </span>
        </div>

        <div
          className="max-h-[304px] overflow-y-auto overflow-x-auto overscroll-y-contain pr-1"
          onWheel={(e) => {
            const el = e.currentTarget;
            if (el.scrollHeight > el.clientHeight) {
              e.stopPropagation();
            }
          }}
        >
          <table className="w-full text-left text-[11px]">
            <thead className="sticky top-0 z-10 bg-zinc-50/95 dark:bg-[#09090b]/95 backdrop-blur-sm">
              <tr className="border-b border-black/10 dark:border-white/10 text-[10px] text-zinc-400 uppercase tracking-wider">
                <th className="pb-2 font-normal">{isRu ? 'Название' : 'Item'}</th>
                <th className="pb-2 font-normal text-right whitespace-nowrap">{isRu ? 'Кол-во' : 'Count'}</th>
                <th className="pb-2 font-normal text-right whitespace-nowrap">{isRu ? 'Цена' : 'Price'}</th>
                <th className="pb-2 font-normal text-right whitespace-nowrap">{isRu ? 'Сумма' : 'Total'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/5">
              {sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-2.5 text-zinc-500">
                    {isRu ? 'Ничего' : 'Nothing'}
                  </td>
                </tr>
              ) : (
                sortedRows.map((item, idx) => {
                  const displayName = item.name || (isRu ? `Предмет #${item.item_id}` : `Item #${item.item_id}`);
                  const rarity = getRarityMeta(item.quality);

                  return (
                    <tr
                      key={`${item.item_id}-${idx}`}
                      className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="py-1.5 pr-2 font-medium text-zinc-800 dark:text-zinc-200 max-w-[160px]" title={displayName}>
                        <div className="flex items-center gap-2 min-w-0">
                          <ItemIcon
                            iconUrl={item.icon_url}
                            alt={displayName}
                            quality={item.quality}
                          />
                          <span
                            className="truncate"
                            style={rarity.text ? { color: rarity.text } : undefined}
                          >
                            {displayName}
                          </span>
                        </div>
                      </td>
                      <td className="py-1.5 px-1.5 text-right text-zinc-500 tabular-nums whitespace-nowrap">
                        ×{item.count}
                      </td>
                      <td className="py-1.5 px-1.5 text-right tabular-nums whitespace-nowrap">
                        <MoneyBadge copper={item.price} language={language} />
                      </td>
                      <td className="py-1.5 pl-1.5 text-right font-semibold tabular-nums whitespace-nowrap">
                        <MoneyBadge copper={item.value} language={language} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Per-table Earned Total */}
      <div className="pt-2 border-t border-black/10 dark:border-white/10 flex items-center gap-2 text-xs">
        <span className="text-zinc-500 dark:text-zinc-400">
          {isRu ? 'Заработано:' : 'Earned:'}
        </span>
        <strong className="font-bold">
          <MoneyBadge copper={totalCopper} language={language} />
        </strong>
      </div>
    </div>
  );

  if (variant === 'modal') {
    return (
      <SpecularCard className="h-full p-3.5 sm:p-4 rounded-xl border border-transparent hover:border-black/10 dark:hover:border-white/[0.08] bg-transparent">
        {content}
      </SpecularCard>
    );
  }

  return content;
};

export const SplitLootTables: React.FC<SplitLootTablesProps> = ({
  items,
  earnedCopper,
  earnedComplete,
  lootLost,
  language,
  variant = 'frameless',
  showTotalHeader = true,
}) => {
  const isRu = language === 'ru';

  const gatherRows = useMemo(
    () => items.filter((item) => item.source === 'gather'),
    [items]
  );

  const mobRows = useMemo(
    () => items.filter((item) => item.source !== 'gather'),
    [items]
  );

  return (
    <div className="flex flex-col gap-4 font-mono">
      {/* Overall Earned Total above tables (shown when not already in top cards) */}
      {showTotalHeader && earnedCopper !== undefined && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs px-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-zinc-500 dark:text-zinc-400">
              {isRu ? 'Всего заработано:' : 'Total earned:'}
            </span>
            <strong className="text-sm font-bold">
              <MoneyBadge copper={earnedCopper} language={language} />
            </strong>
            {earnedComplete === false && (
              <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-normal">
                {isRu ? '(не у всех предметов есть цена)' : '(not all items have a price)'}
              </span>
            )}
          </div>

          {lootLost != null && lootLost > 0 && (
            <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
              {isRu ? `не посчитано предметов: ${lootLost}` : `uncounted items: ${lootLost}`}
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
        <LootSubTable
          title={isRu ? 'Ресурсы' : 'Resources'}
          rows={gatherRows}
          language={language}
          variant={variant}
        />

        <LootSubTable
          title={isRu ? 'Добыча с мобов' : 'Mob Loot'}
          rows={mobRows}
          language={language}
          variant={variant}
        />
      </div>
    </div>
  );
};
