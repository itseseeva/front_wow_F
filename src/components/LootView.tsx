import React, { useState, useEffect } from 'react';
import { Coins, Sparkles, Info, ShieldCheck, Layers } from 'lucide-react';
import { AppSettings } from '../types';
import { SpecularCard } from './ui/Specular';
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
      // Disabling Auto -> calculate copper value from current gold & silver
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
      // Enabling Auto -> lootMinValue = null
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
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-5 pt-2 sm:pt-4 pb-16 px-3 sm:px-6 select-none animate-fadeIn">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-black/10 dark:border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-zinc-950 dark:bg-white shadow-[0_0_8px_rgba(0,0,0,0.4)] dark:shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
            <h1 className="text-lg sm:text-xl font-bold font-mono tracking-tight text-zinc-950 dark:text-white">
              {isRu ? 'Настройки лута' : 'Loot Settings'}
            </h1>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono mt-1">
            {isRu
              ? 'Фильтрация предметов с поверженных мобов и экономия места в сумках'
              : 'Filter mob corpse drops to save valuable bag space'}
          </p>
        </div>

        {/* Status Pill */}
        <div className="flex items-center gap-2 self-start sm:self-auto px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] text-xs font-mono">
          <Coins className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
          <span className="text-zinc-500 dark:text-zinc-400">
            {isRu ? 'Режим:' : 'Mode:'}
          </span>
          <span className="font-semibold text-zinc-950 dark:text-white">
            {isAuto
              ? isRu
                ? 'Автоматический'
                : 'Automatic'
              : `${goldVal}з ${silverVal}с`}
          </span>
        </div>
      </div>

      {/* Main Card: Фильтр добычи с мобов */}
      <SpecularCard
        data-tour="loot-card"
        className="p-4 sm:p-6 rounded-2xl border border-black/10 dark:border-white/10 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-xl shadow-lg flex flex-col gap-5"
      >
        {/* Card Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] border border-black/10 dark:border-white/10 flex items-center justify-center text-zinc-900 dark:text-white shrink-0">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold font-mono text-zinc-950 dark:text-white">
                {isRu ? 'Фильтр добычи с мобов' : 'Mob Loot Filter'}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono mt-0.5">
                {isRu
                  ? 'Определяет, какие предметы персонаж забирает с тел убитых монстров'
                  : 'Configures which dropped items are collected into your inventory'}
              </p>
            </div>
          </div>
        </div>

        {/* Toggle «Авто» */}
        <div
          data-tour="loot-auto-toggle"
          className="p-3.5 sm:p-4 rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] flex items-center justify-between gap-4 transition-all"
        >
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-mono font-medium text-zinc-950 dark:text-white">
                {isRu ? 'Авто' : 'Auto'}
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-black/10 dark:border-white/10 text-zinc-500 dark:text-zinc-400">
                {isRu ? 'Рекомендуется' : 'Recommended'}
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
            className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ease-in-out shrink-0 ${
              isAuto ? 'bg-zinc-950 dark:bg-white' : 'bg-black/15 dark:bg-white/15'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white dark:bg-zinc-950 shadow-sm transform transition-transform duration-200 ease-in-out ${
                isAuto ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Custom Price Inputs (when Auto is turned off) */}
        {!isAuto && (
          <div
            data-tour="loot-threshold-inputs"
            className="flex flex-col gap-3 p-4 rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.04] animate-fadeIn"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-medium text-zinc-800 dark:text-zinc-200">
                {isRu ? 'Порог минимальной стоимости' : 'Minimum Value Threshold'}
              </span>
              <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                {isRu ? 'В меди:' : 'In copper:'}{' '}
                <span className="text-zinc-950 dark:text-white font-semibold">
                  {goldVal * 10000 + silverVal * 100}
                </span>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Gold Input */}
              <div className="flex items-center justify-between p-2.5 rounded-lg border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02]">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-black/10 dark:bg-white/15 text-zinc-950 dark:text-white flex items-center justify-center font-bold text-xs select-none">
                    ●
                  </span>
                  <label
                    htmlFor="loot-gold-input"
                    className="text-xs font-mono text-zinc-700 dark:text-zinc-300"
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
                    className="w-20 h-8 px-2 rounded-lg border border-black/15 dark:border-white/15 bg-black/5 dark:bg-white/5 text-right text-xs font-mono font-semibold text-zinc-950 dark:text-white outline-none focus:border-zinc-950 dark:focus:border-white"
                  />
                  <span className="text-xs font-mono text-zinc-700 dark:text-white font-bold">
                    g
                  </span>
                </div>
              </div>

              {/* Silver Input */}
              <div className="flex items-center justify-between p-2.5 rounded-lg border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02]">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-zinc-400/20 text-zinc-500 dark:text-zinc-300 flex items-center justify-center font-bold text-xs select-none">
                    ●
                  </span>
                  <label
                    htmlFor="loot-silver-input"
                    className="text-xs font-mono text-zinc-700 dark:text-zinc-300"
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
                    className="w-20 h-8 px-2 rounded-lg border border-black/15 dark:border-white/15 bg-black/5 dark:bg-white/5 text-right text-xs font-mono font-semibold text-zinc-950 dark:text-white outline-none focus:border-zinc-950 dark:focus:border-white"
                  />
                  <span className="text-xs font-mono text-zinc-400 dark:text-zinc-300 font-bold">
                    s
                  </span>
                </div>
              </div>
            </div>

            {/* Gray hint under inputs */}
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono mt-1 leading-relaxed">
              {isRu
                ? 'Предметы дешевле порога бот оставляет на трупе. Травы и руду берёт всегда.'
                : 'Items cheaper than the threshold are left on the corpse. Herbs and ores are always looted.'}
            </p>
          </div>
        )}

        {/* Feature note box */}
        <div className="flex items-start gap-2.5 p-3 rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] text-xs font-mono text-zinc-600 dark:text-zinc-400">
          <ShieldCheck className="w-4 h-4 text-zinc-500 dark:text-zinc-400 shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1 leading-relaxed">
            <span>
              {isRu
                ? 'Сбор трав и добыча руды не зависят от порога стоимости: ценные реагенты подбираются в 100% случаев.'
                : 'Herb harvesting and ore mining are exempt from value thresholds: valuable nodes are collected 100% of the time.'}
            </span>
          </div>
        </div>

        {/* Gray note at bottom of card */}
        <div className="pt-2 border-t border-black/5 dark:border-white/5">
          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
            {isRu
              ? 'Порог применится после /reload в игре.'
              : 'The threshold will take effect after /reload in-game.'}
          </p>
        </div>
      </SpecularCard>

      {/* Reserved spacing for future loot memory & vendor selling cards */}
      <div className="hidden sm:block min-h-[40px]" />
    </div>
  );
};
