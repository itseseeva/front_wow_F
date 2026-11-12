import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Coins, RefreshCw, ChevronDown, ChevronRight, Check } from 'lucide-react';
import { AppSettings, LootFilterSource, LootFilterStatus, LootMemory } from '../types';
import { soundFx } from '../utils/audio';
import { getPywebviewApi } from '../utils/pywebviewBridge';
import { mockGetLootMemory, mockGetLootStatus } from '../data/mockPrices';
import { MoneyBadge, CoinIcon } from '../utils/money';
import { ItemIcon, getRarityMeta } from './ItemIcon';

interface LootViewProps {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
  language?: 'ru' | 'en';
  onToast?: (msg: string) => void;
}

const getSourceBadgeMeta = (
  source: LootFilterSource,
  isRu: boolean
): { label: string; className: string } => {
  switch (source) {
    case 'memory':
      return {
        label: isRu ? 'по памяти дропа' : 'from drop memory',
        className: 'text-zinc-900 dark:text-white bg-black/[0.06] dark:bg-white/[0.08] border-black/15 dark:border-white/20',
      };
    case 'gathered':
      return {
        label: isRu ? 'по собранному — память копит опыт' : 'from gathered — learning drops',
        className: 'text-zinc-700 dark:text-zinc-200 bg-black/[0.03] dark:bg-white/[0.05] border-black/10 dark:border-white/15',
      };
    case 'floor':
      return {
        label: isRu ? 'твоя граница «не брать дешевле»' : 'your custom minimum floor',
        className: 'text-sky-600 dark:text-sky-400 bg-sky-500/10 border-sky-500/25',
      };
    case 'none':
      return {
        label: isRu ? 'порога нет — берёт всё' : 'no threshold — loots all',
        className: 'text-zinc-500 dark:text-zinc-400 bg-transparent border-black/10 dark:border-white/10',
      };
    case null:
    default:
      return {
        label: isRu ? 'ошибка расчёта' : 'calculation error',
        className: 'text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/25',
      };
  }
};

export const LootView: React.FC<LootViewProps> = ({
  settings,
  onSettingsChange,
  language = 'ru',
  onToast,
}) => {
  const isRu = language === 'ru';
  const isAuto = settings.lootMinValue === null || settings.lootMinValue === undefined;

  const [goldVal, setGoldVal] = useState<number>(() => {
    if (settings.lootMinValue === null || settings.lootMinValue === undefined) return 0;
    return Math.floor(settings.lootMinValue / 10000);
  });

  const [silverVal, setSilverVal] = useState<number>(() => {
    if (settings.lootMinValue === null || settings.lootMinValue === undefined) return 5;
    return Math.floor((settings.lootMinValue % 10000) / 100);
  });

  const [lootFilterStatus, setLootFilterStatus] = useState<LootFilterStatus | null>(null);
  const [lootMemory, setLootMemory] = useState<LootMemory | null>(null);
  const [isMemoryLoading, setIsMemoryLoading] = useState<boolean>(false);
  const [selectedZone, setSelectedZone] = useState<string>('ALL');
  const [isZoneMenuOpen, setIsZoneMenuOpen] = useState<boolean>(false);
  const [expandedNpcIds, setExpandedNpcIds] = useState<Record<number, boolean>>({});
  const zoneDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (settings.lootMinValue !== null && settings.lootMinValue !== undefined) {
      setGoldVal(Math.floor(settings.lootMinValue / 10000));
      setSilverVal(Math.floor((settings.lootMinValue % 10000) / 100));
    }
  }, [settings.lootMinValue]);

  // Close custom zone dropdown on outside click or Escape
  useEffect(() => {
    if (!isZoneMenuOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (zoneDropdownRef.current && !zoneDropdownRef.current.contains(e.target as Node)) {
        setIsZoneMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsZoneMenuOpen(false);
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isZoneMenuOpen]);

  const fetchLootStatus = useCallback(async () => {
    try {
      const api = await getPywebviewApi();
      const res = api?.get_loot_status
        ? await api.get_loot_status()
        : await mockGetLootStatus(settings.lootMinValue ?? null);
      if (res) {
        setLootFilterStatus(res);
      }
    } catch (e) {
      console.warn('get_loot_status error:', e);
    }
  }, [settings.lootMinValue]);

  const fetchLootMemory = useCallback(async () => {
    setIsMemoryLoading(true);
    try {
      const api = await getPywebviewApi();
      const res = api?.get_loot_memory
        ? await api.get_loot_memory()
        : await mockGetLootMemory();
      if (res) {
        setLootMemory(res);
      }
    } catch (e) {
      console.warn('get_loot_memory error:', e);
      setLootMemory({
        ok: false,
        error: String(e),
        updatedAtMs: null,
        mobs: [],
      });
    } finally {
      setIsMemoryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLootStatus();
    fetchLootMemory();
  }, [fetchLootStatus, fetchLootMemory]);

  useEffect(() => {
    const handleLootFilter = (e: Event) => {
      let detail = (e as CustomEvent).detail;
      if (typeof detail === 'string') {
        try {
          detail = JSON.parse(detail);
        } catch {
          return;
        }
      }
      if (detail && typeof detail === 'object') {
        setLootFilterStatus(detail as LootFilterStatus);
      }
    };

    window.addEventListener('wowbot:loot-filter', handleLootFilter);
    return () => window.removeEventListener('wowbot:loot-filter', handleLootFilter);
  }, []);

  const handleToggleAuto = () => {
    soundFx.playClick();
    if (isAuto) {
      const g = Math.max(0, goldVal);
      const s = Math.max(0, silverVal);
      const copper = g * 10000 + s * 100;
      onSettingsChange({
        ...settings,
        lootMinValue: copper,
      });
      if (onToast) {
        onToast(
          isRu
            ? `Не брать дешевле: ${g}з ${s}с`
            : `Never loot below: ${g}g ${s}s`
        );
      }
    } else {
      onSettingsChange({
        ...settings,
        lootMinValue: null,
      });
      if (onToast) {
        onToast(isRu ? 'Включён режим «Авто» для лута' : '«Auto» loot mode enabled');
      }
    }
  };

  const handleGoldChange = (valStr: string) => {
    const rawNum = parseInt(valStr, 10);
    const g = isNaN(rawNum) ? 0 : Math.max(0, rawNum);
    setGoldVal(g);
    if (!isAuto) {
      const copper = g * 10000 + silverVal * 100;
      onSettingsChange({
        ...settings,
        lootMinValue: copper,
      });
    }
  };

  const handleSilverChange = (valStr: string) => {
    const rawNum = parseInt(valStr, 10);
    const s = isNaN(rawNum) ? 0 : Math.max(0, rawNum);
    setSilverVal(s);
    if (!isAuto) {
      const copper = goldVal * 10000 + s * 100;
      onSettingsChange({
        ...settings,
        lootMinValue: copper,
      });
    }
  };

  const toggleMobExpanded = (npcId: number) => {
    soundFx.playClick();
    setExpandedNpcIds((prev) => ({
      ...prev,
      [npcId]: !prev[npcId],
    }));
  };

  const zoneOptions = useMemo(() => {
    const mobs = lootMemory?.mobs || [];
    const set = new Set<string>();
    for (const m of mobs) {
      if (m.zone) set.add(m.zone);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [lootMemory]);

  const sortedFilteredMobs = useMemo(() => {
    const mobs = lootMemory?.mobs || [];
    const filtered =
      selectedZone === 'ALL'
        ? mobs
        : mobs.filter((m) => m.zone === selectedZone);
    return [...filtered].sort((a, b) => b.kills - a.kills);
  }, [lootMemory, selectedZone]);

  const manualCopper = goldVal * 10000 + silverVal * 100;
  const sourceBadge = getSourceBadgeMeta(lootFilterStatus?.source ?? null, isRu);

  const updatedTimeText = useMemo(() => {
    if (!lootMemory || lootMemory.updatedAtMs == null) {
      return isRu ? 'ещё не сохранялась' : 'not saved yet';
    }
    const timeStr = new Date(lootMemory.updatedAtMs).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    return isRu ? `обновлено ${timeStr}` : `updated ${timeStr}`;
  }, [lootMemory, isRu]);

  return (
    <div className="w-full max-w-3xl 2xl:max-w-5xl mx-auto flex flex-col gap-5 pt-2 sm:pt-3 pb-20 px-3 sm:px-6 select-none animate-fadeIn text-zinc-900 dark:text-zinc-100">
      {/* =========================================================================
          1. ФИЛЬТР ДОБЫЧИ С МОБОВ (Переключатель «Авто» + Золото/Серебро)
          ========================================================================= */}
      <div data-tour="loot-card" className="flex flex-col gap-3 bg-transparent">
        <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-black/10 dark:border-white/[0.08]">
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-zinc-500 dark:text-zinc-400" strokeWidth={1.5} />
            <h1 className="text-sm sm:text-base font-semibold font-mono tracking-wide text-zinc-800 dark:text-zinc-100">
              {isRu ? 'Фильтр добычи с мобов' : 'Mob Loot Filter'}
            </h1>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 dark:text-zinc-400">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500" />
            {isAuto ? (
              <span className="font-semibold text-zinc-700 dark:text-zinc-200">
                {isRu ? 'Авто' : 'Auto'}
              </span>
            ) : (
              <MoneyBadge copper={manualCopper} language={language} />
            )}
          </div>
        </div>

        {/* Toggle «Авто» */}
        <div
          data-tour="loot-auto-toggle"
          className="py-1.5 px-2 -mx-2 rounded-xl border border-transparent hover:border-black/10 dark:hover:border-white/[0.08] bg-transparent flex items-center justify-between gap-4 transition-all"
        >
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-mono font-medium text-zinc-800 dark:text-zinc-200">
                {isRu ? 'Авто' : 'Auto'}
              </span>
              <span className="text-[10px] font-mono text-zinc-500">
                · {isRu ? 'рекомендуется' : 'recommended'}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 font-mono mt-0.5 leading-snug">
              {isRu
                ? 'Бот запоминает, что падает с каждого вида мобов, и сам решает, что стоит места в сумке. Чем меньше места — тем строже.'
                : 'The bot remembers what each mob drops and decides what is worth bag space. Less free space means a stricter filter.'}
            </p>
          </div>

          <button
            type="button"
            onClick={handleToggleAuto}
            aria-label={isRu ? 'Переключить режим Авто' : 'Toggle Auto mode'}
            className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ease-in-out shrink-0 ${
              isAuto ? 'bg-zinc-700 dark:bg-zinc-300' : 'bg-zinc-300 dark:bg-zinc-700'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white dark:bg-zinc-950 shadow-sm transform transition-transform duration-200 ease-in-out ${
                isAuto ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Custom Price Inputs (compact single-row HUD controls) */}
        {!isAuto && (
          <div
            data-tour="loot-threshold-inputs"
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-black/10 dark:border-white/[0.08] animate-fadeIn"
          >
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-xs font-mono font-medium text-zinc-800 dark:text-zinc-200">
                {isRu ? 'Не брать дешевле' : 'Never loot below'}
              </span>
              <p className="text-[11px] text-zinc-500 font-mono leading-snug">
                {isRu
                  ? 'Дешевле этой суммы бот не возьмёт никогда. Дороже — решает память дропа.'
                  : 'Items worth less than this are never looted. Above it, drop memory decides.'}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
              <label
                htmlFor="loot-gold-input"
                title={isRu ? 'Золото' : 'Gold'}
                className="h-8 px-2.5 rounded-lg border border-black/15 dark:border-white/15 bg-black/[0.02] dark:bg-white/[0.03] focus-within:border-zinc-600 dark:focus-within:border-zinc-400 flex items-center gap-1.5 transition-colors cursor-text"
              >
                <input
                  id="loot-gold-input"
                  type="number"
                  min="0"
                  step="1"
                  value={goldVal === 0 ? '' : goldVal}
                  placeholder="0"
                  onChange={(e) => handleGoldChange(e.target.value)}
                  className="w-12 bg-transparent text-right text-xs font-mono font-semibold text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-500 outline-none tabular-nums"
                />
                <CoinIcon kind="gold" className="w-3.5 h-3.5" />
              </label>

              <label
                htmlFor="loot-silver-input"
                title={isRu ? 'Серебро' : 'Silver'}
                className="h-8 px-2.5 rounded-lg border border-black/15 dark:border-white/15 bg-black/[0.02] dark:bg-white/[0.03] focus-within:border-zinc-600 dark:focus-within:border-zinc-400 flex items-center gap-1.5 transition-colors cursor-text"
              >
                <input
                  id="loot-silver-input"
                  type="number"
                  min="0"
                  max="99"
                  step="1"
                  value={silverVal === 0 ? '' : silverVal}
                  placeholder="0"
                  onChange={(e) => handleSilverChange(e.target.value)}
                  className="w-10 bg-transparent text-right text-xs font-mono font-semibold text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-500 outline-none tabular-nums"
                />
                <CoinIcon kind="silver" className="w-3.5 h-3.5" />
              </label>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          2. БЛОК «СЕЙЧАС»
          ========================================================================= */}
      <div data-tour="loot-now" className="flex flex-col gap-2 pt-4 border-t border-black/10 dark:border-white/[0.08]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-[11px] font-mono font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {isRu ? 'Сейчас' : 'Right now'}
            </h2>

            <span className="text-zinc-600 font-mono text-xs">·</span>

            {lootFilterStatus?.thresholdCopper != null ? (
              <MoneyBadge
                copper={lootFilterStatus.thresholdCopper}
                language={language}
                className="text-base sm:text-lg font-bold"
              />
            ) : (
              <span className="font-mono text-base sm:text-lg font-bold text-zinc-500">—</span>
            )}

            {lootFilterStatus && (
              <span
                className={`px-2 py-0.5 rounded border text-[10px] font-mono font-medium ${sourceBadge.className}`}
              >
                {sourceBadge.label}
              </span>
            )}
          </div>

          <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
            {isRu ? 'Оставлено на трупах за сессию:' : 'Left on corpses this session:'}{' '}
            <strong className="text-zinc-800 dark:text-zinc-200 tabular-nums">
              {lootFilterStatus?.leftThisSession ?? 0}
            </strong>
          </span>
        </div>

        {lootFilterStatus && !lootFilterStatus.active && (
          <span className="font-mono text-[11px] text-zinc-500">
            {isRu
              ? 'Бот не запущен или фильтр ещё не в игре'
              : 'Bot is not running or filter is not active in-game yet'}
          </span>
        )}
      </div>

      {/* =========================================================================
          3. БЛОК «ПАМЯТЬ ДРОПА»
          ========================================================================= */}
      <div data-tour="loot-memory" className="flex flex-col gap-3 pt-4 border-t border-black/10 dark:border-white/[0.08]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {isRu ? 'Память дропа' : 'Drop memory'}
            </h2>
            <p className="text-[11px] font-mono text-zinc-500">
              {isRu ? 'Память сохраняется игрой при /reload и выходе' : 'Saved by game on /reload and logout'}
              {' · '}
              <span className="text-zinc-400">{updatedTimeText}</span>
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              soundFx.playClick();
              fetchLootMemory();
            }}
            disabled={isMemoryLoading}
            className="px-2.5 py-1.5 rounded-lg border border-transparent hover:border-black/10 dark:hover:border-white/[0.08] bg-transparent text-zinc-500 hover:text-zinc-950 dark:hover:text-white transition-all cursor-pointer flex items-center gap-1.5 text-xs font-mono disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isMemoryLoading ? 'animate-spin' : ''}`} strokeWidth={1.5} />
            <span>{isRu ? 'Обновить' : 'Refresh'}</span>
          </button>
        </div>

        {/* Error state */}
        {lootMemory && !lootMemory.ok && (
          <div className="text-xs font-mono text-red-500 dark:text-red-400">
            {lootMemory.error || (isRu ? 'Не удалось загрузить память дропа' : 'Failed to load drop memory')}
          </div>
        )}

        {/* Empty state */}
        {lootMemory?.ok && lootMemory.mobs.length === 0 && (
          <p className="text-xs font-mono text-zinc-500 py-3">
            {isRu
              ? 'Пока пусто: убейте несколько мобов и сделайте /reload — здесь появится, что с них падает.'
              : 'Empty for now: kill a few mobs and /reload — their drops will appear here.'}
          </p>
        )}

        {/* Zone filter & Mob list */}
        {lootMemory?.ok && lootMemory.mobs.length > 0 && (
          <div className="flex flex-col gap-3">
            {zoneOptions.length > 0 && (
              <div className="flex items-center gap-2.5 text-xs font-mono">
                <span className="text-zinc-500">{isRu ? 'Зона:' : 'Zone:'}</span>
                <div ref={zoneDropdownRef} className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      soundFx.playClick();
                      setIsZoneMenuOpen((prev) => !prev);
                    }}
                    className={`h-8 px-3 rounded-lg border text-xs font-mono flex items-center gap-2 transition-all cursor-pointer outline-none ${
                      isZoneMenuOpen
                        ? 'border-black/25 dark:border-white/30 bg-black/[0.04] dark:bg-white/[0.06] text-zinc-950 dark:text-white'
                        : 'border-black/10 dark:border-white/10 hover:border-black/20 dark:hover:border-white/20 bg-transparent text-zinc-700 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white'
                    }`}
                  >
                    <span>{selectedZone === 'ALL' ? (isRu ? 'Все' : 'All') : selectedZone}</span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-zinc-500 transition-transform duration-150 ${
                        isZoneMenuOpen ? 'rotate-180 text-zinc-300' : ''
                      }`}
                    />
                  </button>

                  {isZoneMenuOpen && (
                    <div className="absolute left-0 top-full mt-1.5 z-40 min-w-[220px] max-w-[300px] rounded-xl border border-black/15 dark:border-white/15 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-2xl shadow-[0_16px_40px_rgba(0,0,0,0.45)] dark:shadow-[0_16px_40px_rgba(0,0,0,0.85)] py-1 flex flex-col animate-fadeIn">
                      {[{ value: 'ALL', label: isRu ? 'Все' : 'All' }, ...zoneOptions.map((z) => ({ value: z, label: z }))].map(
                        (opt) => {
                          const isSelected = selectedZone === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => {
                                soundFx.playClick();
                                setSelectedZone(opt.value);
                                setIsZoneMenuOpen(false);
                              }}
                              className={`w-full px-3 py-1.5 text-left text-xs font-mono flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                                isSelected
                                  ? 'text-zinc-950 dark:text-white bg-black/[0.05] dark:bg-white/[0.08] font-semibold'
                                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-black/[0.03] dark:hover:bg-white/[0.04]'
                              }`}
                            >
                              <span className="truncate">{opt.label}</span>
                              {isSelected && <Check className="w-3.5 h-3.5 shrink-0 text-zinc-900 dark:text-white" />}
                            </button>
                          );
                        }
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-col divide-y divide-black/10 dark:divide-white/[0.06]">
              {sortedFilteredMobs.map((mob) => {
                const isExpanded = Boolean(expandedNpcIds[mob.npcId]);
                const mobName = mob.name || (isRu ? `Моб #${mob.npcId}` : `Mob #${mob.npcId}`);

                return (
                  <div key={mob.npcId} className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => toggleMobExpanded(mob.npcId)}
                      className="w-full py-2.5 px-2 -mx-2 rounded-lg hover:bg-black/[0.02] dark:hover:bg-white/[0.03] flex flex-wrap items-center justify-between gap-2 text-left transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2 min-w-0 font-mono text-xs">
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                        )}
                        <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                          {mobName}
                        </span>
                        {mob.zone && (
                          <>
                            <span className="text-zinc-600">·</span>
                            <span className="text-zinc-500 truncate">{mob.zone}</span>
                          </>
                        )}
                        <span className="text-zinc-600">·</span>
                        <span className="text-zinc-500 whitespace-nowrap tabular-nums">
                          {isRu ? `убито ${mob.kills}` : `killed ${mob.kills}`}
                        </span>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded border text-[10px] font-mono shrink-0 ${
                          mob.trusted
                            ? 'text-zinc-900 dark:text-zinc-100 bg-black/[0.05] dark:bg-white/[0.08] border-black/15 dark:border-white/20 font-medium'
                            : 'text-zinc-500 bg-transparent border-black/10 dark:border-white/10'
                        }`}
                      >
                        {mob.trusted
                          ? isRu
                            ? 'память решает'
                            : 'memory active'
                          : isRu
                          ? `копит опыт: ${mob.kills} из 20`
                          : `learning: ${mob.kills} of 20`}
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="pl-6 pr-2 pb-3 pt-1 overflow-x-auto">
                        {mob.items.length === 0 ? (
                          <span className="text-[11px] font-mono text-zinc-500">
                            {isRu ? 'Предметов пока не зафиксировано' : 'No items recorded yet'}
                          </span>
                        ) : (
                          <table className="w-full text-left border-collapse font-mono text-[11px]">
                            <thead>
                              <tr className="text-zinc-500 border-b border-black/10 dark:border-white/[0.06]">
                                <th className="py-1.5 pr-3 font-medium">{isRu ? 'Предмет' : 'Item'}</th>
                                <th className="py-1.5 px-3 font-medium">{isRu ? 'Шанс' : 'Chance'}</th>
                                <th className="py-1.5 px-3 font-medium text-right whitespace-nowrap">
                                  {isRu ? 'За убийство' : 'Per kill'}
                                </th>
                                <th className="py-1.5 pl-3 font-medium text-right">{isRu ? 'Цена' : 'Price'}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-black/5 dark:divide-white/[0.04]">
                              {mob.items.map((item) => {
                                const chancePct = Math.round(item.chance * 100);
                                const marginPct = Math.round(item.margin * 100);
                                const barWidth = Math.min(100, Math.max(0, item.chance * 100));
                                const rarity = getRarityMeta(item.quality);
                                const itemName = item.name || (isRu ? `Предмет #${item.itemId}` : `Item #${item.itemId}`);

                                return (
                                  <tr
                                    key={item.itemId}
                                    className="text-zinc-700 dark:text-zinc-300 hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors"
                                  >
                                    <td className="py-1.5 pr-3">
                                      <div className="flex items-center gap-2.5 min-w-0">
                                        <ItemIcon
                                          iconUrl={item.iconUrl}
                                          alt={itemName}
                                          quality={item.quality}
                                        />
                                        <span
                                          className="truncate"
                                          style={rarity.text ? { color: rarity.text } : undefined}
                                        >
                                          {itemName}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="py-1.5 px-3 whitespace-nowrap">
                                      <div className="flex items-center gap-2">
                                        <span className="tabular-nums text-zinc-600 dark:text-zinc-400">
                                          {chancePct}% ±{marginPct}%
                                        </span>
                                        <div className="w-16 h-1 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden shrink-0">
                                          <div
                                            className="h-full rounded-full bg-zinc-500 dark:bg-zinc-400"
                                            style={{ width: `${barWidth}%` }}
                                          />
                                        </div>
                                      </div>
                                    </td>
                                    <td className="py-1.5 px-3 text-right tabular-nums text-zinc-500 whitespace-nowrap">
                                      {item.perKill.toFixed(1)} {isRu ? 'шт' : 'pcs'}
                                    </td>
                                    <td className="py-1.5 pl-3 text-right whitespace-nowrap">
                                      {item.priceCopper != null ? (
                                        <MoneyBadge copper={item.priceCopper} language={language} />
                                      ) : (
                                        <span className="text-zinc-500">—</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
