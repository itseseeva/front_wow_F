import React, { useState, useEffect } from 'react';
import { Coins, ShieldCheck } from 'lucide-react';
import { AppSettings } from '../types';
import { soundFx } from '../utils/audio';

interface LootViewProps {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
  language?: 'ru' | 'en';
  onToast?: (msg: string) => void;
}

export const LootView: React.FC<LootViewProps> = ({
  settings,
  onSettingsChange,
  language = 'ru',
  onToast,
}) => {
  const isRu = language === 'ru';
  const isAuto = settings.lootMinValue === null || settings.lootMinValue === undefined;

  // Local state for Gold and Silver inputs to allow comfortable typing
  const [goldVal, setGoldVal] = useState<number>(() => {
    if (settings.lootMinValue === null || settings.lootMinValue === undefined) return 0;
    return Math.floor(settings.lootMinValue / 10000);
  });

  const [silverVal, setSilverVal] = useState<number>(() => {
    if (settings.lootMinValue === null || settings.lootMinValue === undefined) return 5;
    return Math.floor((settings.lootMinValue % 10000) / 100);
  });

  // Keep local inputs in sync when settings change from outside
  useEffect(() => {
    if (settings.lootMinValue !== null && settings.lootMinValue !== undefined) {
      setGoldVal(Math.floor(settings.lootMinValue / 10000));
      setSilverVal(Math.floor((settings.lootMinValue % 10000) / 100));
    }
  }, [settings.lootMinValue]);

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
            ? `Порог лута: ${g}з ${s}с (${copper} меди)`
            : `Loot threshold: ${g}g ${s}s (${copper} copper)`
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

  return (
    <div className="w-full max-w-3xl 2xl:max-w-5xl mx-auto flex flex-col gap-6 pt-2 sm:pt-4 pb-20 px-3 sm:px-6 select-none animate-fadeIn text-zinc-900 dark:text-zinc-100">
      {/* Section Header (Frameless, clean hairline divider) */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-3 border-b border-black/10 dark:border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-zinc-500 dark:text-zinc-400" strokeWidth={1.5} />
            <h1 className="text-sm sm:text-base font-semibold font-mono tracking-wide text-zinc-800 dark:text-zinc-100">
              {isRu ? 'Настройки лута' : 'Loot Settings'}
            </h1>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono mt-1">
            {isRu
              ? 'Фильтрация предметов с поверженных мобов и экономия места в сумках'
              : 'Filter mob corpse drops to save valuable bag space'}
          </p>
        </div>

        {/* Inline Status Indicator (No container box) */}
        <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 dark:text-zinc-400">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500" />
          <span>{isRu ? 'Режим:' : 'Mode:'}</span>
          <span className="font-semibold text-zinc-700 dark:text-zinc-200">
            {isAuto
              ? isRu
                ? 'Автоматический'
                : 'Automatic'
              : `${goldVal}з ${silverVal}с`}
          </span>
        </div>
      </div>

      {/* Main Ghost Section: Фильтр добычи с мобов (No visible container) */}
      <div data-tour="loot-card" className="flex flex-col gap-5 bg-transparent">
        {/* Subheader */}
        <div className="flex flex-col gap-0.5">
          <h2 className="text-xs sm:text-sm font-mono font-medium text-zinc-700 dark:text-zinc-200 uppercase tracking-wider">
            {isRu ? 'Фильтр добычи с мобов' : 'Mob Loot Filter'}
          </h2>
          <p className="text-[11px] text-zinc-500 font-mono">
            {isRu
              ? 'Определяет, какие предметы персонаж забирает с тел убитых монстров'
              : 'Configures which dropped items are collected into your inventory'}
          </p>
        </div>

        {/* Toggle «Авто» (Frameless row with subtle hover only) */}
        <div
          data-tour="loot-auto-toggle"
          className="py-3 px-2 -mx-2 rounded-xl border border-transparent hover:border-black/10 dark:hover:border-white/[0.08] bg-transparent flex items-center justify-between gap-4 transition-all"
        >
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-mono font-medium text-zinc-800 dark:text-zinc-200">
                {isRu ? 'Авто' : 'Auto'}
              </span>
              <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
                · {isRu ? 'рекомендуется' : 'recommended'}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono mt-1 leading-relaxed">
              {isRu
                ? 'Бот сам рассчитывает минимальную ценность предмета по уровню зоны и свободным ячейкам'
                : 'The bot automatically calculates minimum item value based on zone level and free bag slots'}
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

        {/* Custom Price Inputs (when Auto is turned off) — Clean frameless gray layout */}
        {!isAuto && (
          <div
            data-tour="loot-threshold-inputs"
            className="flex flex-col gap-4 pt-4 border-t border-black/10 dark:border-white/[0.08] animate-fadeIn"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-medium text-zinc-700 dark:text-zinc-300">
                {isRu ? 'Порог минимальной стоимости' : 'Minimum Value Threshold'}
              </span>
              <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                {isRu ? 'В меди:' : 'In copper:'}{' '}
                <span className="text-zinc-800 dark:text-zinc-200 font-semibold tabular-nums">
                  {goldVal * 10000 + silverVal * 100}
                </span>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8">
              {/* Gold Input (Frameless row with underline input) */}
              <div className="flex items-center justify-between py-2 border-b border-black/10 dark:border-white/[0.08]">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-zinc-500 select-none" />
                  <label
                    htmlFor="loot-gold-input"
                    className="text-xs font-mono text-zinc-600 dark:text-zinc-400"
                  >
                    {isRu ? 'Золото' : 'Gold'}
                  </label>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    id="loot-gold-input"
                    type="number"
                    min="0"
                    step="1"
                    value={goldVal === 0 ? '' : goldVal}
                    placeholder="0"
                    onChange={(e) => handleGoldChange(e.target.value)}
                    className="w-20 h-8 px-2 rounded-lg border border-black/15 dark:border-white/15 bg-transparent text-right text-xs font-mono font-semibold text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-500 outline-none focus:border-zinc-600 dark:focus:border-zinc-400 transition-colors"
                  />
                  <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400 font-semibold">
                    g
                  </span>
                </div>
              </div>

              {/* Silver Input (Frameless row with underline input) */}
              <div className="flex items-center justify-between py-2 border-b border-black/10 dark:border-white/[0.08]">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-zinc-500/60 dark:bg-zinc-600 select-none" />
                  <label
                    htmlFor="loot-silver-input"
                    className="text-xs font-mono text-zinc-600 dark:text-zinc-400"
                  >
                    {isRu ? 'Серебро' : 'Silver'}
                  </label>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    id="loot-silver-input"
                    type="number"
                    min="0"
                    max="99"
                    step="1"
                    value={silverVal === 0 ? '' : silverVal}
                    placeholder="0"
                    onChange={(e) => handleSilverChange(e.target.value)}
                    className="w-20 h-8 px-2 rounded-lg border border-black/15 dark:border-white/15 bg-transparent text-right text-xs font-mono font-semibold text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-500 outline-none focus:border-zinc-600 dark:focus:border-zinc-400 transition-colors"
                  />
                  <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400 font-semibold">
                    s
                  </span>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-zinc-500 font-mono leading-relaxed">
              {isRu
                ? 'Предметы дешевле порога бот оставляет на трупе. Травы и руду берёт всегда.'
                : 'Items cheaper than the threshold are left on the corpse. Herbs and ores are always looted.'}
            </p>
          </div>
        )}

        {/* Frameless muted gray notes */}
        <div className="flex flex-col gap-2.5 pt-4 border-t border-black/10 dark:border-white/[0.08] text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
          <div className="flex items-start gap-2.5 leading-relaxed">
            <ShieldCheck className="w-3.5 h-3.5 text-zinc-500 shrink-0 mt-0.5" strokeWidth={1.5} />
            <span>
              {isRu
                ? 'Сбор трав и добыча руды не зависят от порога стоимости: ценные реагенты подбираются в 100% случаев.'
                : 'Herb harvesting and ore mining are exempt from value thresholds: valuable nodes are collected 100% of the time.'}
            </span>
          </div>
          <p className="text-zinc-500 pl-6">
            {isRu
              ? 'Порог применится после /reload в игре.'
              : 'The threshold will take effect after /reload in-game.'}
          </p>
        </div>
      </div>
    </div>
  );
};
