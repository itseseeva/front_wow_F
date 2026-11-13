import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ReceiptText, AlertTriangle, ShieldAlert, Loader2, Search } from 'lucide-react';
import { SaleRow, SaleLog, SaleBlockResult } from '../types';
import { MoneyBadge } from '../utils/money';
import { ItemIcon, getRarityMeta } from './ItemIcon';
import { SpecularButton } from './ui/Specular';
import { soundFx } from '../utils/audio';
import { getPywebviewApi } from '../utils/pywebviewBridge';
import { mockGetSaleLog, mockSetSaleBlock } from '../data/mockPrices';

interface SalesLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: 'ru' | 'en';
  date: string;
}

const RU_MONTHS_GEN = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

const EN_MONTHS_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatDateTitle(dateStr: string, isRu: boolean): string {
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  const day = parseInt(parts[2], 10);
  const month = parseInt(parts[1], 10);
  if (isRu) {
    return `${day} ${RU_MONTHS_GEN[month - 1] || ''}`;
  }
  return `${EN_MONTHS_NAMES[month - 1] || ''} ${day}`;
}

function formatDateTime(ms: number | null | undefined, isRu: boolean, includeSeconds = false): string {
  if (!ms) return '—';
  const d = new Date(ms);
  if (isNaN(d.getTime())) return '—';
  const pad = (n: number) => String(n).padStart(2, '0');
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const hours = pad(d.getHours());
  const mins = pad(d.getMinutes());
  if (includeSeconds) {
    const secs = pad(d.getSeconds());
    return `${day}.${month} ${hours}:${mins}:${secs}`;
  }
  return `${day}.${month} ${hours}:${mins}`;
}

export const SalesLogModal: React.FC<SalesLogModalProps> = ({
  isOpen,
  onClose,
  language,
  date,
}) => {
  const isRu = language === 'ru';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<SaleRow[]>([]);
  const [totalCopper, setTotalCopper] = useState<number>(0);
  const [updatedAtMs, setUpdatedAtMs] = useState<number | null>(null);
  const [pendingItemIds, setPendingItemIds] = useState<Set<number>>(new Set());
  const [searchFilter, setSearchFilter] = useState('');

  const fetchSalesLog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const api = await getPywebviewApi();
      let res: SaleLog | null = null;
      if (api?.get_sale_log) {
        res = await api.get_sale_log(date);
      } else if (!window.pywebview?.api) {
        // Fallback to mock in browser development mode
        res = await mockGetSaleLog(date);
      } else {
        // Old backend without method: show empty state
        res = {
          ok: true,
          date: date ?? null,
          items: [],
          totalCopper: 0,
          blocked: [],
          updatedAtMs: null,
        };
      }

      if (res) {
        const blockedSet = new Set(res.blocked || []);
        const rows = (res.items || []).map((row) => ({
          ...row,
          source: 'mob' as const,
          blocked: blockedSet.has(row.item_id),
        }));
        setItems(rows);
        setTotalCopper(res.totalCopper ?? 0);
        setUpdatedAtMs(res.updatedAtMs ?? null);
        if (!res.ok) {
          setError(res.error || (isRu ? 'Ошибка получения журнала продаж' : 'Failed to fetch sales log'));
        }
      }
    } catch (err: any) {
      console.warn('get_sale_log error:', err);
      setItems([]);
      setTotalCopper(0);
      setError(err?.message || (isRu ? 'Ошибка получения журнала продаж' : 'Failed to fetch sales log'));
    } finally {
      setLoading(false);
    }
  }, [isRu, date]);

  useEffect(() => {
    if (isOpen) {
      fetchSalesLog();
    } else {
      setSearchFilter('');
      setError(null);
    }
  }, [isOpen, fetchSalesLog]);

  // Handle ESC key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        soundFx.playClick();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleToggleBlock = async (itemId: number, nextBlocked: boolean) => {
    soundFx.playClick();
    setPendingItemIds((prev) => new Set(prev).add(itemId));
    try {
      const api = await getPywebviewApi();
      let res: SaleBlockResult | null = null;
      if (api?.set_sale_block) {
        res = await api.set_sale_block(itemId, nextBlocked);
      } else if (!window.pywebview?.api) {
        res = await mockSetSaleBlock(itemId, nextBlocked);
      }

      if (res && res.ok && Array.isArray(res.blocked)) {
        const blockedSet = new Set(res.blocked);
        setItems((prev) =>
          prev.map((row) =>
            row.item_id === itemId || blockedSet.has(row.item_id) !== row.blocked
              ? { ...row, blocked: blockedSet.has(row.item_id) }
              : row
          )
        );
      } else if (res && !res.ok && res.error) {
        console.warn('set_sale_block returned error:', res.error);
      }
    } catch (err) {
      console.error('set_sale_block error:', err);
    } finally {
      setPendingItemIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  const filteredItems = useMemo(() => {
    const q = searchFilter.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => {
      const name = it.name ? it.name.toLowerCase() : `item #${it.item_id}`;
      return name.includes(q);
    });
  }, [items, searchFilter]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-black/40 backdrop-blur-md select-none animate-in fade-in duration-150"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          soundFx.playClick();
          onClose();
        }
      }}
    >
      <div className="relative w-full max-w-4xl max-h-[85vh] flex flex-col rounded-2xl bg-zinc-950/65 dark:bg-black/60 backdrop-blur-2xl border border-white/10 shadow-[0_24px_80px_rgba(0,0,0,0.85)] overflow-hidden font-mono text-zinc-200">
        {/* Specular top glow line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none" />

        {/* Header (frameless glass) */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0 bg-transparent">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-zinc-300">
              <ReceiptText className="w-4 h-4 text-zinc-300" />
            </div>
            <div className="flex items-baseline gap-2">
              <h2 className="text-sm font-semibold text-zinc-100">
                {isRu ? 'Журнал продаж' : 'Sales log'}
              </h2>
              <span className="text-xs text-zinc-400">
                · {formatDateTitle(date, isRu)}
              </span>
              {items.length > 0 && (
                <span className="text-[11px] text-zinc-500">
                  ({items.length} {isRu ? 'поз.' : 'records'})
                </span>
              )}
            </div>

            {/* Quick search filter */}
            {items.length > 0 && (
              <div className="relative ml-2 hidden sm:block">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder={isRu ? 'Фильтр...' : 'Filter...'}
                  className="w-36 lg:w-48 pl-8 pr-2.5 py-1 text-xs bg-white/5 hover:bg-white/[0.08] focus:bg-white/10 border border-white/10 rounded-lg text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-white/20 font-mono transition-all"
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end text-right">
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                <span className="text-zinc-500 text-[11px] font-normal">
                  {isRu ? 'за день:' : 'day total:'}
                </span>
                <MoneyBadge copper={totalCopper} language={language} />
              </div>
              {updatedAtMs != null && (
                <span className="text-[10px] text-zinc-500 mt-0.5">
                  {isRu ? 'обновлено: ' : 'updated: '}
                  {formatDateTime(updatedAtMs, isRu, true)}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                soundFx.playClick();
                onClose();
              }}
              className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title={isRu ? 'Закрыть (Esc)' : 'Close (Esc)'}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden p-5 flex flex-col min-h-[220px]">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-zinc-400 py-16">
              <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
              <span className="text-xs text-zinc-500">
                {isRu ? 'Загрузка журнала продаж...' : 'Loading sales log...'}
              </span>
            </div>
          ) : error && items.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-rose-400 py-16 text-center">
              <AlertTriangle className="w-6 h-6 text-rose-400" />
              <span className="text-xs">{error}</span>
            </div>
          ) : items.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-16 px-4 text-center gap-2">
              <ReceiptText className="w-8 h-8 text-zinc-600 mb-1" />
              <p className="text-xs text-zinc-400 max-w-md leading-relaxed">
                {isRu ? 'В этот день продаж не было' : 'No sales on this day'}
              </p>
              <p className="text-[11px] text-zinc-500 max-w-md leading-relaxed">
                {isRu
                  ? 'Новые продажи появляются после /reload или выхода из игры'
                  : 'New sales appear after /reload or logging out'}
              </p>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-2.5 flex items-center gap-1.5 text-[11px] text-zinc-400 shrink-0">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400/80 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              <div
              className="flex-1 overflow-y-auto overflow-x-auto overscroll-y-contain pr-1.5 max-h-[360px] 2xl:max-h-[460px] [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.25)_transparent]"
              onWheel={(e) => {
                const el = e.currentTarget;
                if (el.scrollHeight > el.clientHeight) {
                  e.stopPropagation();
                }
              }}
            >
              <table className="w-full text-left text-[11px] font-mono">
                <thead className="sticky top-0 z-10 bg-zinc-950/80 backdrop-blur-md">
                  <tr className="border-b border-white/10 text-[10px] text-zinc-400 uppercase tracking-wider">
                    <th className="pb-2.5 font-normal">{isRu ? 'Предмет' : 'Item'}</th>
                    <th className="pb-2.5 font-normal text-right whitespace-nowrap">{isRu ? 'Штук' : 'Count'}</th>
                    <th className="pb-2.5 font-normal text-right whitespace-nowrap">{isRu ? 'Продано за' : 'Sold for'}</th>
                    <th className="pb-2.5 font-normal text-right whitespace-nowrap">{isRu ? 'На аукционе' : 'On Auction'}</th>
                    <th className="pb-2.5 font-normal text-right whitespace-nowrap">{isRu ? 'Когда' : 'When'}</th>
                    <th className="pb-2.5 font-normal text-right whitespace-nowrap pr-1">{isRu ? 'Действие' : 'Action'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-zinc-500">
                        {isRu ? 'Ничего не найдено по фильтру' : 'Nothing found by filter'}
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item, idx) => {
                      const displayName = item.name || (isRu ? `Предмет #${item.item_id}` : `Item #${item.item_id}`);
                      const rarity = getRarityMeta(item.quality);
                      const isPending = pendingItemIds.has(item.item_id);
                      const isSoldBelowMarket = item.value != null && item.value > item.sold_copper;

                      return (
                        <tr
                          key={`${item.item_id}-${item.sold_at_ms ?? idx}-${idx}`}
                          className="hover:bg-white/[0.04] transition-colors"
                        >
                          {/* 1. Item Icon & Name */}
                          <td className="py-2 pr-3 font-medium text-zinc-200 max-w-[220px]" title={displayName}>
                            <div className="flex items-center gap-2.5 min-w-0">
                              <ItemIcon
                                iconUrl={item.icon_url}
                                alt={displayName}
                                quality={item.quality}
                              />
                              <span
                                className="truncate font-medium"
                                style={rarity.text ? { color: rarity.text } : undefined}
                              >
                                {displayName}
                              </span>
                            </div>
                          </td>

                          {/* 2. Count */}
                          <td className="py-2 px-2 text-right text-zinc-400 tabular-nums whitespace-nowrap">
                            ×{item.count}
                          </td>

                          {/* 3. Sold For (sold_copper) */}
                          <td className="py-2 px-2 text-right tabular-nums whitespace-nowrap font-medium text-zinc-200">
                            <MoneyBadge copper={item.sold_copper} language={language} />
                          </td>

                          {/* 4. On Auction (value) - with warning if value > sold_copper */}
                          <td className="py-2 px-2 text-right tabular-nums whitespace-nowrap">
                            {item.value == null ? (
                              <span className="text-zinc-500">—</span>
                            ) : isSoldBelowMarket ? (
                              <div
                                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/35 text-amber-300 font-semibold"
                                title={isRu ? 'Продано торговцу дешевле рыночной цены аукциона!' : 'Sold to vendor cheaper than auction market price!'}
                              >
                                <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                                <MoneyBadge copper={item.value} language={language} />
                              </div>
                            ) : (
                              <MoneyBadge copper={item.value} language={language} />
                            )}
                          </td>

                          {/* 5. When (sold_at_ms) */}
                          <td className="py-2 px-2 text-right text-zinc-400 tabular-nums whitespace-nowrap text-[11px]">
                            {formatDateTime(item.sold_at_ms, isRu, false)}
                          </td>

                          {/* 6. Action button (Never sell / Kept) */}
                          <td className="py-2 pl-3 text-right whitespace-nowrap">
                            {item.blocked ? (
                              <SpecularButton
                                onClick={() => handleToggleBlock(item.item_id, false)}
                                disabled={isPending}
                                className="h-7 px-2.5 rounded-lg border border-amber-500/40 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-all font-mono text-[11px] whitespace-nowrap cursor-pointer shadow-sm disabled:opacity-50 inline-flex items-center gap-1.5"
                                title={isRu ? 'Нажмите, чтобы разрешить продажу торговцу' : 'Click to allow selling to vendor'}
                              >
                                {isPending ? (
                                  <Loader2 className="w-3 h-3 animate-spin text-amber-300" />
                                ) : (
                                  <ShieldAlert className="w-3 h-3 text-amber-400 shrink-0" />
                                )}
                                <span>{isRu ? 'Не продаётся' : 'Kept'}</span>
                              </SpecularButton>
                            ) : (
                              <SpecularButton
                                onClick={() => handleToggleBlock(item.item_id, true)}
                                disabled={isPending}
                                className="h-7 px-2.5 rounded-lg border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-zinc-200 transition-all font-mono text-[11px] whitespace-nowrap cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
                                title={isRu ? 'Запретить боту продавать этот предмет торговцу' : 'Block bot from selling this item to vendor'}
                              >
                                {isPending && <Loader2 className="w-3 h-3 animate-spin text-zinc-400" />}
                                <span>{isRu ? 'Больше не продавать' : 'Never sell'}</span>
                              </SpecularButton>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
              </div>
              <p className="mt-2.5 text-[11px] text-zinc-500 font-mono leading-normal shrink-0">
                {isRu
                  ? 'Новые продажи появляются после /reload или выхода из игры'
                  : 'New sales appear after /reload or logging out'}
              </p>
            </>
          )}
        </div>

        {/* Footer Note (frameless glass) */}
        <div className="px-5 py-3 border-t border-white/10 bg-transparent shrink-0">
          <p className="text-[11px] text-zinc-500 font-mono leading-normal">
            {isRu
              ? 'Список начнёт действовать после /reload в игре — в начале следующей сессии бот сделает его сам.'
              : 'The list will take effect after /reload in game — the bot will do it automatically at the start of the next session.'}
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
};
