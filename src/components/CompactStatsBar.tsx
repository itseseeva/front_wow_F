import React from 'react';
import { Clock, Coins } from 'lucide-react';
import { soundFx } from '../utils/audio';
import { SpecularCard } from './ui/Specular';

interface CompactStatsBarProps {
  sessionSeconds: number;
  khoriumCount: number;
  adamantiteCount: number;
  felIronCount: number;
  goldEstimate: number;
  speedMultiplier: number;
  onSpeedChange: (speed: number) => void;
  language: 'ru' | 'en';
}

export const CompactStatsBar: React.FC<CompactStatsBarProps> = ({
  sessionSeconds,
  khoriumCount,
  adamantiteCount,
  felIronCount,
  goldEstimate,
  speedMultiplier,
  onSpeedChange,
  language,
}) => {
  const formatTime = (secs: number) => {
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const isRu = language === 'ru';

  return (
    <div className="fixed bottom-4 z-20 pointer-events-auto flex justify-center w-auto left-1/2 -translate-x-1/2 md:left-[calc(50%+160px)]">
      <SpecularCard
        className="px-3.5 py-1.5 rounded-xl flex items-center gap-3.5 sm:gap-4 border border-transparent hover:border-white/[0.08] bg-transparent shadow-none select-none text-[11px] transition-all duration-200"
      >
        {/* Session Time */}
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-zinc-500" strokeWidth={1.5} />
          <div className="flex items-center gap-1.5 font-mono text-xs">
            <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">
              {isRu ? 'Сессия' : 'Session'}
            </span>
            <span className="font-semibold text-white tracking-wide tabular-nums">
              {formatTime(sessionSeconds)}
            </span>
          </div>
        </div>

        {/* Separator */}
        <span className="w-px h-3.5 bg-white/[0.06]" />

        {/* Khorium Ore */}
        <div className="flex items-center gap-1.5 font-mono text-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.7)]" />
          <span className="text-zinc-500">{isRu ? 'Кориум:' : 'Khorium:'}</span>
          <span className="font-semibold text-zinc-200 tabular-nums">{khoriumCount}</span>
        </div>

        {/* Adamantite Ore */}
        <div className="flex items-center gap-1.5 font-mono text-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
          <span className="text-zinc-500">{isRu ? 'Адамант:' : 'Adamant:'}</span>
          <span className="font-semibold text-zinc-300 tabular-nums">{adamantiteCount}</span>
        </div>

        {/* Fel Iron */}
        <div className="flex items-center gap-1.5 font-mono text-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
          <span className="text-zinc-500">{isRu ? 'Железо:' : 'Iron:'}</span>
          <span className="font-semibold text-zinc-400 tabular-nums">{felIronCount}</span>
        </div>

        {/* Separator */}
        <span className="w-px h-3.5 bg-white/[0.06]" />

        {/* Gold Estimate */}
        <div className="flex items-center gap-1.5 font-mono text-xs text-white">
          <Coins className="w-3.5 h-3.5 text-zinc-500" strokeWidth={1.5} />
          <span className="font-semibold tabular-nums text-zinc-200">+{goldEstimate}g</span>
        </div>

        {/* Runner Speed Toggle (1x, 2x, 4x) */}
        <div className="flex items-center gap-1.5 pl-2 border-l border-white/[0.06] font-mono text-xs">
          <span className="text-[11px] text-zinc-500">
            {isRu ? 'Скорость:' : 'Speed:'}
          </span>
          <div className="flex items-center gap-1 bg-transparent p-0.5 rounded-lg border border-transparent hover:border-white/[0.08] transition-all">
            {[1, 2, 4].map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => {
                  soundFx.playClick();
                  onSpeedChange(spd);
                }}
                className={`px-1.5 py-0.5 rounded-md text-[11px] cursor-pointer transition-all ${
                  speedMultiplier === spd
                    ? 'text-white font-bold underline underline-offset-4 decoration-white/60'
                    : 'text-zinc-500 hover:text-white'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>
      </SpecularCard>
    </div>
  );
};
