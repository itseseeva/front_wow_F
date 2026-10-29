import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  Terminal,
  Clock,
  Coins,
  ChevronDown,
  ChevronUp,
  FastForward,
  Play,
  Pause,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import { soundFx } from '../utils/audio';

export interface LogEntry {
  id: string;
  time: string;
  type: 'info' | 'obstacle' | 'gather' | 'lap';
  text: string;
}

interface LiveTelemetryBotConsoleProps {
  isBotRunning: boolean;
  speedMultiplier: number;
  onSpeedChange: (speed: number) => void;
  logs: LogEntry[];
  sessionSeconds: number;
  khoriumCount: number;
  adamantiteCount: number;
  felIronCount: number;
  goldEstimate: number;
  language: 'ru' | 'en';
}

export const LiveTelemetryBotConsole: React.FC<LiveTelemetryBotConsoleProps> = ({
  isBotRunning,
  speedMultiplier,
  onSpeedChange,
  logs,
  sessionSeconds,
  khoriumCount,
  adamantiteCount,
  felIronCount,
  goldEstimate,
  language,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll log container to bottom on new log
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const formatTime = (secs: number) => {
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const isRu = language === 'ru';

  return (
    <div
      className="fixed z-20 transition-all duration-300 pointer-events-auto"
      style={{
        bottom: '24px',
        left: 'calc(50% + 190px)', // Offset to stay centered between sidebar and right edge
        transform: 'translateX(-50%)',
        width: 'min(680px, calc(100vw - 440px))',
      }}
    >
      {/* Drawer Toggle Tab */}
      <div className="flex justify-center -mb-px">
        <button
          type="button"
          onClick={() => {
            soundFx.playClick();
            setIsExpanded(!isExpanded);
          }}
          className="px-3.5 py-1 text-[11px] font-mono tracking-wider font-semibold rounded-t-lg border-t border-x border-white/10 bg-[#16181c]/90 text-zinc-300 hover:text-white flex items-center gap-1.5 backdrop-blur-md cursor-pointer transition-colors"
        >
          <Activity className="w-3.5 h-3.5 text-[#f5b041]" />
          <span>{isRu ? 'ТАКТИЧЕСКАЯ ТЕЛЕМЕТРИЯ БОТА' : 'BOT TELEMETRY & LOG'}</span>
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 ml-1 text-zinc-400" />
          ) : (
            <ChevronUp className="w-3.5 h-3.5 ml-1 text-zinc-400" />
          )}
        </button>
      </div>

      {/* Main Console Box */}
      <div
        className="rounded-xl border border-white/10 overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.7)] backdrop-blur-xl"
        style={{
          background: 'rgba(22, 24, 28, 0.85)',
        }}
      >
        {/* KPI Strip: Time, Khorium, Adamantite, Gold, Speed Controls */}
        <div className="px-4 py-2.5 border-b border-white/[0.08] flex items-center justify-between gap-3 flex-wrap bg-white/[0.02]">
          {/* Active Session Timer */}
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#7f8c8d]" />
            <div className="flex flex-col">
              <span className="text-[10px] text-[#7f8c8d] uppercase font-mono leading-none">
                {isRu ? 'Сессия' : 'Session'}
              </span>
              <span className="text-xs font-mono font-bold text-zinc-200">
                {formatTime(sessionSeconds)}
              </span>
            </div>
          </div>

          {/* Ore Counters */}
          <div className="flex items-center gap-4 text-xs font-mono">
            {/* Khorium */}
            <div className="flex items-center gap-1.5" title="Кориумная руда">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <span className="text-zinc-400 text-[11px]">{isRu ? 'Кориум:' : 'Khor:'}</span>
              <span className="font-bold text-amber-300">{khoriumCount}</span>
            </div>

            {/* Adamantite */}
            <div className="flex items-center gap-1.5" title="Адамантитовая руда">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
              <span className="text-zinc-400 text-[11px]">{isRu ? 'Адамант:' : 'Adam:'}</span>
              <span className="font-bold text-sky-300">{adamantiteCount}</span>
            </div>

            {/* Fel Iron */}
            <div className="flex items-center gap-1.5" title="Оскверненное железо">
              <span className="w-2.5 h-2.5 rounded-full bg-lime-400" />
              <span className="text-zinc-400 text-[11px]">{isRu ? 'Железо:' : 'Iron:'}</span>
              <span className="font-bold text-lime-300">{felIronCount}</span>
            </div>

            {/* Gold Earned */}
            <div className="flex items-center gap-1.5 text-amber-200">
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-bold">+{goldEstimate}g</span>
            </div>
          </div>

          {/* Runner Speed Selector */}
          <div className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-white/10">
            <span className="text-[10px] text-zinc-400 px-1 font-mono">
              {isRu ? 'Скорость:' : 'Speed:'}
            </span>
            {[1, 2, 4].map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => {
                  soundFx.playClick();
                  onSpeedChange(spd);
                }}
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold cursor-pointer transition-colors ${
                  speedMultiplier === spd
                    ? 'bg-[#e5c158] text-black shadow-xs'
                    : 'text-zinc-400 hover:text-white hover:bg-white/10'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>

        {/* Collapsible Live Log Section */}
        {isExpanded && (
          <div className="p-3 bg-black/40 animate-fadeIn">
            <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-white/[0.06] text-[10px] text-zinc-400 font-mono">
              <div className="flex items-center gap-1.5">
                <Terminal className="w-3 h-3 text-emerald-400" />
                <span>{isRu ? 'ЖУРНАЛ СОБЫТИЙ ОГРИКА' : 'OGRE EVENT FEED'}</span>
              </div>
              <span className="text-zinc-500">Live 60fps telemetry</span>
            </div>

            {/* Scrollable Log Feed */}
            <div
              ref={logContainerRef}
              className="max-h-[110px] overflow-y-auto space-y-1 font-mono text-[11px] pr-1"
            >
              {logs.map((log) => {
                const isObstacle = log.type === 'obstacle';
                const isGather = log.type === 'gather';
                const isLap = log.type === 'lap';

                return (
                  <div
                    key={log.id}
                    className={`flex items-start gap-2 py-0.5 px-1.5 rounded transition-colors ${
                      isObstacle
                        ? 'bg-amber-950/40 text-amber-200 border-l-2 border-amber-500'
                        : isGather
                        ? 'bg-emerald-950/30 text-emerald-200 border-l-2 border-emerald-500'
                        : isLap
                        ? 'bg-purple-950/30 text-purple-200 border-l-2 border-purple-500'
                        : 'text-zinc-300'
                    }`}
                  >
                    <span className="text-zinc-500 text-[10px] shrink-0">{log.time}</span>
                    <span className="shrink-0">
                      {isObstacle && <AlertTriangle className="w-3 h-3 text-amber-400 inline mr-1" />}
                      {isGather && <Sparkles className="w-3 h-3 text-emerald-400 inline mr-1" />}
                    </span>
                    <span className="leading-snug">{log.text}</span>
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
