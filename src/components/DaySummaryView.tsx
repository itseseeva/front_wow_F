import React, { useState, useEffect } from 'react';
import { DayResponse, SessionHeatmapResponse, LootStatus, ScheduleStatus, TerrainStatus } from '../types';
import { getPywebviewApi } from '../utils/pywebviewBridge';
import { mockGetTerrainStatus } from '../data/mockRoutes';
import {
  BarChart3,
  Calendar as CalendarIcon,
  Clock,
  Coffee,
  Loader2,
  Maximize2,
  TrendingUp,
  Coins,
  Sparkles,
  Square,
} from 'lucide-react';
import { SpecularCard } from './ui/Specular';
import { HeatmapViewer } from './HeatmapViewer';
import { soundFx } from '../utils/audio';
import { formatRouteRoman } from '../utils/roman';
import { MoneyBadge } from '../utils/money';
import { RouteItem } from './StealthHUDLeftSidebar';

interface DaySummaryViewProps {
  selectedDate: string;
  dayData: DayResponse | null;
  selectedSessionId: string | 'all';
  onSelectSessionId: (id: string | 'all') => void;
  selectedPassIndex: number | null;
  onSelectPassIndex: (pass: number | null) => void;
  heatmap: SessionHeatmapResponse | null;
  isHeatmapLoading: boolean;
  language: 'ru' | 'en';
  isBotRunning?: boolean;
  sessionSeconds?: number;
  lootStatus?: LootStatus | null;
  activeRoute?: RouteItem | null;
  scheduleStatus?: ScheduleStatus | null;
  onStopBot?: () => void;
}

function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
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

function getPluralSessions(n: number, isRu: boolean): string {
  if (!isRu) return `${n} ${n === 1 ? 'session' : 'sessions'}`;
  if (n % 10 === 1 && n % 100 !== 11) return `${n} сессия`;
  if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return `${n} сессии`;
  return `${n} сессий`;
}

function getPluralRoutes(n: number, isRu: boolean): string {
  if (!isRu) return `${n} ${n === 1 ? 'route' : 'routes'}`;
  if (n % 10 === 1 && n % 100 !== 11) return `${n} маршрут`;
  if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return `${n} маршрута`;
  return `${n} маршрутов`;
}

export const DaySummaryView: React.FC<DaySummaryViewProps> = ({
  selectedDate,
  dayData,
  selectedSessionId,
  onSelectSessionId,
  selectedPassIndex,
  onSelectPassIndex,
  heatmap,
  isHeatmapLoading,
  language,
  isBotRunning = false,
  sessionSeconds = 0,
  lootStatus = null,
  activeRoute = null,
  scheduleStatus = null,
  onStopBot,
}) => {
  const isRu = language === 'ru';
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  const sessions = dayData?.sessions || [];
  const hasSessions = sessions.length > 0;
  const hasLiveOrPastSessions = hasSessions || isBotRunning;

  // Active LIVE selection: when bot is running, unless user explicitly selected a past session, LIVE is immediately open!
  const isSpecificPastSessionSelected = sessions.some((s) => s.session_id === selectedSessionId);
  const isLiveSelected = isBotRunning && !isSpecificPastSessionSelected;

  // Live session calculations
  const liveTotalLootCount = (lootStatus?.items || []).reduce((sum, item) => sum + item.count, 0);

  // Live Schedule Tracking & 1-second countdown ticker
  const [liveScheduleStatus, setLiveScheduleStatus] = useState<ScheduleStatus | null>(scheduleStatus || null);

  useEffect(() => {
    if (scheduleStatus !== undefined) {
      setLiveScheduleStatus(scheduleStatus);
    }
  }, [scheduleStatus]);

  useEffect(() => {
    const handleScheduleEvent = (e: any) => {
      if (e.detail) {
        setLiveScheduleStatus(e.detail);
      }
    };
    window.addEventListener('wowbot:schedule-status', handleScheduleEvent);
    return () => window.removeEventListener('wowbot:schedule-status', handleScheduleEvent);
  }, []);

  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Terrain & dynamic auto-route building state
  const [terrainStatus, setTerrainStatus] = useState<TerrainStatus | null>(null);

  // Subscribe to wowbot:terrain-status window events
  useEffect(() => {
    const handleTerrain = (e: any) => {
      const detail: TerrainStatus = e?.detail;
      if (detail) {
        setTerrainStatus(prev => {
          const incomingProg = typeof detail.progress === 'number' ? Math.max(0, Math.min(1, detail.progress)) : 0;
          const finalProg = detail.status === 'ready' ? 1 : Math.max(prev?.progress ?? 0, incomingProg);
          return {
            ...detail,
            progress: finalProg,
          };
        });
      }
    };
    window.addEventListener('wowbot:terrain-status', handleTerrain);
    return () => window.removeEventListener('wowbot:terrain-status', handleTerrain);
  }, []);

  // Poll terrain / auto-route status while building or running without a route
  useEffect(() => {
    const isBuilding = isBotRunning && (!activeRoute || terrainStatus?.status === 'building');
    if (!isBuilding) return;

    let isMounted = true;
    const mapId = terrainStatus?.map_id || 1436;

    const poll = async () => {
      try {
        let res: { ok: boolean; error?: string } & Partial<TerrainStatus>;
        const api = await getPywebviewApi();
        if (api?.get_terrain_status) {
          res = await api.get_terrain_status(mapId);
        } else {
          res = await mockGetTerrainStatus(mapId);
        }

        if (!isMounted) return;

        if (res && res.status) {
          setTerrainStatus(prev => {
            const incomingProg = typeof res.progress === 'number' ? Math.max(0, Math.min(1, res.progress)) : 0;
            const finalProg = res.status === 'ready' ? 1 : Math.max(prev?.progress ?? 0, incomingProg);
            return {
              map_id: res.map_id ?? mapId,
              status: res.status as any,
              stage: (res.stage as any) ?? prev?.stage ?? 'tiles',
              done: res.done ?? prev?.done ?? 0,
              total: res.total ?? prev?.total ?? 100,
              progress: finalProg,
              elapsed_s: res.elapsed_s ?? prev?.elapsed_s ?? 0,
              eta_s: res.eta_s !== undefined ? res.eta_s : prev?.eta_s ?? null,
              error: res.error ?? null,
              source: res.source ?? prev?.source ?? null,
            };
          });
        }
      } catch (err) {
        console.warn('Poll terrain status error:', err);
      }
    };

    poll();
    const interval = setInterval(poll, 1000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isBotRunning, activeRoute, terrainStatus?.status, terrainStatus?.map_id]);

  // Card «До перерыва»: countdown to phase_until_ms based on phase
  let breakValueNode: React.ReactNode = '—';
  let breakSubtext = isRu ? 'без расписания' : 'no schedule';

  const isScheduleActive = liveScheduleStatus && liveScheduleStatus.enabled && liveScheduleStatus.phase !== 'idle';

  if (isScheduleActive && liveScheduleStatus.phase_until_ms) {
    const totalSec = Math.max(0, Math.floor((liveScheduleStatus.phase_until_ms - nowMs) / 1000));
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    const timeFormatted = hrs > 0
      ? `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
      : `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    if (liveScheduleStatus.phase === 'farm') {
      breakValueNode = `≈${timeFormatted}`;
      breakSubtext = isRu ? 'до перерыва' : 'until break';
    } else if (liveScheduleStatus.phase === 'short_break' || liveScheduleStatus.phase === 'long_break') {
      breakValueNode = isRu ? `перерыв, ещё ${timeFormatted}` : `break, ${timeFormatted} left`;
      breakSubtext = isRu ? 'пауза в работе' : 'scheduled break';
    } else {
      breakValueNode = timeFormatted;
      breakSubtext = liveScheduleStatus.phase;
    }
  } else {
    breakValueNode = '—';
    breakSubtext = isRu ? 'без расписания' : 'no schedule';
  }

  // Card «Золото в час»: earned_copper / hours worked; first 5 mins -> «считаю…»
  const earnedCopper = lootStatus?.earned_copper;
  let goldPerHourNode: React.ReactNode = null;
  let goldPerHourSubtext = '';

  if (earnedCopper === null || earnedCopper === undefined) {
    goldPerHourNode = isRu ? 'нет цен' : 'no price';
    goldPerHourSubtext = isRu ? 'выбери аукцион в настройках' : 'select auction in settings';
  } else if (sessionSeconds < 300) {
    goldPerHourNode = isRu ? 'считаю…' : 'calculating…';
    if (lootStatus?.earned_complete === false) {
      goldPerHourSubtext = isRu ? 'не у всех предметов есть цена' : 'not all items have a price';
    } else {
      goldPerHourSubtext = isRu ? 'первые 5 минут' : 'first 5 minutes';
    }
  } else {
    const hours = sessionSeconds / 3600;
    const copperPerHour = Math.round(earnedCopper / hours);
    goldPerHourNode = <MoneyBadge copper={copperPerHour} language={language} />;
    if (lootStatus?.earned_complete === false) {
      goldPerHourSubtext = isRu ? 'не у всех предметов есть цена' : 'not all items have a price';
    } else {
      goldPerHourSubtext = isRu ? 'по ценам аукциона' : 'auction market rate';
    }
  }

  // Active session and summary calculation
  const isAllDay = !isLiveSelected && selectedSessionId === 'all';
  const activeSession = isAllDay
    ? sessions[0]
    : sessions.find((s) => s.session_id === selectedSessionId) || sessions[0];

  const currentSummary = isAllDay ? dayData?.total : activeSession?.summary;

  // Unique routes count for day subtitle
  const uniqueRoutesCount = new Set(sessions.map((s) => s.route_name)).size;

  // Heatmap title/label calculation
  let heatmapLabel = '';
  if (activeSession) {
    const timeStr = new Date(activeSession.started_at_ms).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    const match = activeSession.route_name.match(/^(.*?)\s*\(([^)]+)\)$/);
    const baseName = match ? match[1] : activeSession.route_name;
    const regionName = match ? match[2] : null;
    const cleanRouteName = formatRouteRoman(baseName.trim());
    const fullRouteName = regionName ? `${cleanRouteName} (${regionName})` : cleanRouteName;
    heatmapLabel = isAllDay
      ? `${isRu ? 'карта: ' : 'map: '}${timeStr} · ${fullRouteName}`
      : `${timeStr} · ${fullRouteName}`;
  }

  // Active pass info if a pass is selected
  const activePassInfo = selectedPassIndex != null && activeSession?.passes_info
    ? activeSession.passes_info.find((p) => p.index === selectedPassIndex)
    : null;

  // Filter non-empty resources ("Пустые ресурсы (нет данных) не показывать вовсе")
  const khorium = currentSummary?.khorium;
  const adamantite = currentSummary?.adamantite;
  const felIron = currentSummary?.fel_iron;
  const gold = currentSummary?.gold;
  const hasExtractedResources = Boolean(
    (khorium != null && khorium > 0) ||
    (adamantite != null && adamantite > 0) ||
    (felIron != null && felIron > 0) ||
    (gold != null && gold > 0)
  );

  return (
    <div className="w-full max-w-4xl 2xl:max-w-5xl mx-auto flex flex-col gap-6">
      <div className="w-full flex flex-col gap-5">
        {/* 1. Header: Date Title, sessions/routes subtitle & day duration (frameless) */}
        <div className="flex items-center justify-between pb-1">
          <div>
            <h1 className="text-sm 2xl:text-base font-semibold tracking-wide text-zinc-950 dark:text-white font-mono flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-zinc-700 dark:text-zinc-300" strokeWidth={1.5} />
              <span>
                {isRu ? 'Итоги · ' : 'Summary · '}
                {formatDateTitle(selectedDate, isRu)}
              </span>
            </h1>
            <p className="text-[11px] 2xl:text-xs text-zinc-500 mt-0.5 font-mono">
              {isBotRunning && isLiveSelected
                ? (isRu ? 'Идёт сессия сбора в реальном времени' : 'Live gathering session in progress')
                : hasSessions
                ? `${getPluralSessions(sessions.length, isRu)} · ${getPluralRoutes(uniqueRoutesCount, isRu)}`
                : (isRu ? 'В этот день бот не работал' : 'No sessions on this day')}
            </p>
          </div>

          {hasSessions && dayData?.total?.duration_s != null && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] 2xl:text-xs font-mono text-zinc-600 dark:text-zinc-400">
                {isRu ? 'за день: ' : 'day total: '}
                <strong className="text-zinc-950 dark:text-white font-semibold">
                  {formatDuration(dayData.total.duration_s)}
                </strong>
              </span>
            </div>
          )}
        </div>

        {/* 2. Content: Empty day notice OR Sessions selector & Telemetry */}
        {!hasLiveOrPastSessions ? (
          <div className="text-center py-16 flex flex-col items-center justify-center gap-3 font-mono">
            <div className="w-12 h-12 flex items-center justify-center text-zinc-400 dark:text-zinc-600">
              <CalendarIcon className="w-6 h-6" />
            </div>
            <span className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">
              {isRu ? 'В этот день бот не работал' : 'No sessions on this day'}
            </span>
            <span className="text-xs text-zinc-500 max-w-sm text-center leading-relaxed">
              {isRu
                ? 'Сессий за эту дату не зафиксировано. Выберите другой день с отметками в календаре.'
                : 'No bot runs recorded for this date. Pick another day with dots on the calendar.'}
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* 3. Chip Selector Row: frameless text tabs */}
            <div className="flex items-center justify-between gap-3 overflow-x-auto pb-1 scrollbar-none font-mono text-xs border-b border-black/5 dark:border-white/5">
              <div className="flex items-center gap-3 overflow-x-auto scrollbar-none">
                {isBotRunning && (
                  <button
                    type="button"
                    onClick={() => {
                      soundFx.playClick();
                      onSelectSessionId('live');
                      onSelectPassIndex(null);
                    }}
                    className={`py-1 transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                      isLiveSelected
                        ? 'text-zinc-950 dark:text-white font-semibold underline underline-offset-8 decoration-zinc-400 dark:decoration-zinc-400'
                        : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
                    }`}
                  >
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-zinc-900 dark:bg-white opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-zinc-950 dark:bg-white"></span>
                    </span>
                    <span>
                      LIVE · {activeRoute ? `${formatRouteRoman(activeRoute.name)}${activeRoute.region ? ` (${activeRoute.region})` : ''}` : (isRu ? 'Текущая сессия' : 'Active Session')}
                    </span>
                  </button>
                )}

                {hasSessions && (
                  <button
                    type="button"
                    onClick={() => {
                      soundFx.playClick();
                      onSelectSessionId('all');
                      onSelectPassIndex(null);
                    }}
                    className={`py-1 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                      isAllDay
                        ? 'text-zinc-950 dark:text-white font-semibold underline underline-offset-8 decoration-zinc-400 dark:decoration-zinc-400'
                        : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
                    }`}
                  >
                    <span>{isRu ? 'Весь день' : 'All Day'}</span>
                  </button>
                )}

                {sessions.map((s) => {
                  const isSelected = !isLiveSelected && selectedSessionId === s.session_id;
                  const timeStr = new Date(s.started_at_ms).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  const match = s.route_name.match(/^(.*?)\s*\(([^)]+)\)$/);
                  const baseName = match ? match[1] : s.route_name;
                  const regionName = match ? match[2] : null;
                  const cleanRouteName = formatRouteRoman(baseName.trim());

                  return (
                    <button
                      key={s.session_id}
                      type="button"
                      onClick={() => {
                        soundFx.playClick();
                        onSelectSessionId(s.session_id);
                        onSelectPassIndex(null);
                      }}
                      className={`py-1 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                        isSelected
                          ? 'text-zinc-950 dark:text-white font-semibold underline underline-offset-8 decoration-zinc-400 dark:decoration-zinc-400'
                          : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
                      }`}
                    >
                      <span>
                        {timeStr} · {cleanRouteName}
                        {regionName && (
                          <span className="text-zinc-400 dark:text-zinc-500 font-normal ml-1">
                            ({regionName})
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>

              {isBotRunning && onStopBot && isLiveSelected && (
                <button
                  type="button"
                  onClick={() => {
                    soundFx.playClick();
                    onStopBot();
                  }}
                  className="px-2.5 py-1 text-zinc-500 hover:text-red-500 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ml-auto"
                >
                  <Square className="w-3 h-3 fill-current" />
                  <span>{isRu ? 'Остановить' : 'Stop Bot'}</span>
                </button>
              )}
            </div>

            {/* LIVE TELEMETRY VIEW (immediately open, no container boxes) */}
            {isLiveSelected ? (
              <div className="flex flex-col gap-6 animate-fadeIn">
                {/* Live 5 Metric Cards (frameless columns, no boxes) */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6 py-1 font-mono">
                  {/* 1. Duration */}
                  <div className="flex flex-col justify-between gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-zinc-500">{isRu ? 'Время в работе' : 'Live Uptime'}</span>
                      <Clock className="w-3.5 h-3.5 text-zinc-400" />
                    </div>
                    <div>
                      <span className="text-2xl sm:text-3xl font-bold text-zinc-950 dark:text-white tracking-tight">
                        {formatDuration(sessionSeconds)}
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-950 dark:bg-white animate-pulse" />
                        <span className="text-[10px] text-zinc-500">
                          {isRu ? 'в процессе' : 'running'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 2. Break Countdown */}
                  <div className="flex flex-col justify-between gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-zinc-500">{isRu ? 'До перерыва' : 'Until Break'}</span>
                      <Coffee className="w-3.5 h-3.5 text-zinc-400" />
                    </div>
                    <div>
                      <span className="text-2xl sm:text-3xl font-bold text-zinc-950 dark:text-white tracking-tight truncate">
                        {breakValueNode}
                      </span>
                      <p className="text-[10px] text-zinc-500 mt-0.5 truncate">
                        {breakSubtext}
                      </p>
                    </div>
                  </div>

                  {/* 3. Nodes Gathered */}
                  <div className="flex flex-col justify-between gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-zinc-500">{isRu ? 'Собрано ресурсов' : 'Total Items'}</span>
                      <Sparkles className="w-3.5 h-3.5 text-zinc-400" />
                    </div>
                    <div>
                      <span className="text-2xl sm:text-3xl font-bold text-zinc-950 dark:text-white tracking-tight">
                        {liveTotalLootCount}
                      </span>
                      <p className="text-[10px] text-zinc-500 mt-0.5">
                        {(lootStatus?.items || []).length} {isRu ? 'уник. видов' : 'unique types'}
                      </p>
                    </div>
                  </div>

                  {/* 4. Estimated Earnings */}
                  <div className="flex flex-col justify-between gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-zinc-500">{isRu ? 'Заработано' : 'Earned'}</span>
                      <Coins className="w-3.5 h-3.5 text-zinc-400" />
                    </div>
                    <div>
                      <span className="text-xl sm:text-2xl font-bold text-zinc-950 dark:text-white tracking-tight">
                        <MoneyBadge copper={lootStatus?.earned_copper} language={language} />
                      </span>
                      <p className="text-[10px] text-zinc-500 mt-0.5 truncate">
                        {lootStatus?.earned_complete === false
                          ? (isRu ? 'не у всех предметов есть цена' : 'not all items have a price')
                          : (isRu ? 'по аукциону' : 'auction price')}
                      </p>
                    </div>
                  </div>

                  {/* 5. Gold Per Hour */}
                  <div className="flex flex-col justify-between gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-zinc-500">{isRu ? 'Золото в час' : 'Gold / hour'}</span>
                      <TrendingUp className="w-3.5 h-3.5 text-zinc-400" />
                    </div>
                    <div>
                      <span className="text-xl sm:text-2xl font-bold text-zinc-950 dark:text-white tracking-tight">
                        {goldPerHourNode}
                      </span>
                      <p className="text-[10px] text-zinc-500 mt-0.5 truncate">
                        {goldPerHourSubtext}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Live Gathering Loot Table or Radar Scanning Placeholder (frameless) */}
                {lootStatus?.items && lootStatus.items.length > 0 ? (
                  <div className="flex flex-col gap-3 font-mono pt-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100 uppercase tracking-wide">
                          {isRu ? 'Добыча текущей сессии' : 'Active Session Loot'}
                        </span>
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-950 dark:bg-white animate-pulse" />
                      </div>
                      <span className="text-[11px] text-zinc-500">
                        {lootStatus.items.length} {isRu ? 'поз.' : 'types'}
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="text-[10px] text-zinc-500 uppercase tracking-wider">
                            <th className="pb-2 font-normal">{isRu ? 'Ресурс' : 'Item'}</th>
                            <th className="pb-2 font-normal text-right">{isRu ? 'Количество' : 'Count'}</th>
                            <th className="pb-2 font-normal text-right">{isRu ? 'Цена аукциона' : 'Market Price'}</th>
                            <th className="pb-2 font-normal text-right">{isRu ? 'Сумма' : 'Value'}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lootStatus.items.map((item) => {
                            const displayName = item.name || (isRu ? `Предмет #${item.item_id}` : `Item #${item.item_id}`);
                            return (
                              <tr key={item.item_id} className="hover:bg-white/[0.02] transition-colors">
                                <td className="py-2 pr-2 font-medium text-zinc-900 dark:text-zinc-100 truncate max-w-[220px]" title={displayName}>
                                  <div className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 shrink-0" />
                                    <span className="truncate">{displayName}</span>
                                  </div>
                                </td>
                                <td className="py-2 px-2 text-right font-mono font-semibold text-zinc-700 dark:text-zinc-300 tabular-nums whitespace-nowrap">
                                  ×{item.count}
                                </td>
                                <td className="py-2 px-2 text-right tabular-nums whitespace-nowrap">
                                  <MoneyBadge copper={item.price} language={language} />
                                </td>
                                <td className="py-2 pl-2 text-right font-semibold tabular-nums whitespace-nowrap">
                                  <MoneyBadge copper={item.value} language={language} />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Footer with Earned Total */}
                    <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-zinc-500">
                          {isRu ? 'Итого заработано:' : 'Total Earned:'}
                        </span>
                        <strong className="text-sm font-bold text-zinc-950 dark:text-white">
                          <MoneyBadge copper={lootStatus.earned_copper} language={language} />
                        </strong>
                        {lootStatus.earned_complete === false && (
                          <span className="text-[11px] text-zinc-500 font-normal">
                            {isRu ? '(не для всех предметов найдена цена на аукционе)' : '(prices pending for some items)'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  (() => {
                    const hasActiveFixedRoute = Boolean(activeRoute && activeRoute.id);
                    const isAutoRouteBuilding = isBotRunning && (!hasActiveFixedRoute || terrainStatus?.status === 'building');
                    const currentProg = terrainStatus?.progress ?? 0;
                    const percent = Math.min(100, Math.max(0, Math.round(currentProg * 100)));

                    return (
                      <div className="py-16 flex flex-col items-center justify-center text-center gap-3 font-mono">
                        {/* Blinking white dot + text "Сканирование местности" */}
                        <div className="flex items-center gap-2 text-xs font-medium text-zinc-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                          <span>{isRu ? 'Сканирование местности' : 'Scanning terrain'}</span>
                        </div>

                        {/* Minimalist black and white bar with percentage on the right */}
                        {isAutoRouteBuilding && (
                          <div className="w-full max-w-xs flex items-center gap-3">
                            <div className="flex-1 h-1 rounded-full bg-zinc-800 overflow-hidden">
                              <div
                                className="h-full bg-white transition-all duration-300 ease-out rounded-full"
                                style={{ width: `${Math.max(2, percent)}%` }}
                              />
                            </div>
                            <span className="text-xs font-mono text-zinc-400 tabular-nums shrink-0">
                              {percent}%
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })()
                )}
              </div>
            ) : (
              /* PAST SESSION OR ALL DAY SUMMARY (frameless, no container boxes) */
              <div className="flex flex-col gap-6">
                {/* 4. Metric Cards Grid */}
                {currentSummary && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 py-1 font-mono">
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] text-zinc-500">{isRu ? 'Длительность' : 'Duration'}</span>
                      <span className="text-2xl sm:text-3xl font-bold text-zinc-950 dark:text-white">
                        {formatDuration(currentSummary.duration_s)}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] text-zinc-500">{isRu ? 'Узлов собрано' : 'Nodes Gathered'}</span>
                      <span className="text-2xl sm:text-3xl font-bold text-zinc-950 dark:text-white">
                        {currentSummary.kills != null ? currentSummary.kills : '—'}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] text-zinc-500">{isRu ? 'Темп в час' : 'Pace / hour'}</span>
                      <span className="text-2xl sm:text-3xl font-bold text-zinc-950 dark:text-white">
                        {currentSummary.kills_per_hour != null ? `${currentSummary.kills_per_hour}/ч` : '—'}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] text-zinc-500">{isRu ? 'Пауза' : 'Avg Kill Gap'}</span>
                      <span className="text-2xl sm:text-3xl font-bold text-zinc-950 dark:text-white">
                        {currentSummary.avg_kill_gap_s != null ? `${currentSummary.avg_kill_gap_s}с` : '—'}
                      </span>
                    </div>
                  </div>
                )}

                {/* 5. Resource breakdown: ONLY show if resources exist and are > 0 */}
                {hasExtractedResources && currentSummary && (
                  <div className="flex flex-col gap-2.5 pt-2">
                    <span className="text-xs font-mono font-medium text-zinc-500 uppercase tracking-wide">
                      {isRu ? 'Добытые ресурсы' : 'Extracted Resources'}
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono">
                      {khorium != null && khorium > 0 && (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] text-zinc-500">{isRu ? 'Кориум' : 'Khorium'}</span>
                          <span className="text-sm font-semibold text-zinc-950 dark:text-white">
                            {khorium}
                          </span>
                        </div>
                      )}
                      {adamantite != null && adamantite > 0 && (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] text-zinc-500">{isRu ? 'Адамантит' : 'Adamantite'}</span>
                          <span className="text-sm font-semibold text-zinc-950 dark:text-white">
                            {adamantite}
                          </span>
                        </div>
                      )}
                      {felIron != null && felIron > 0 && (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] text-zinc-500">{isRu ? 'Оскверн. железо' : 'Fel Iron'}</span>
                          <span className="text-sm font-semibold text-zinc-950 dark:text-white">
                            {felIron}
                          </span>
                        </div>
                      )}
                      {gold != null && gold > 0 && (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] text-zinc-500">{isRu ? 'Золото' : 'Gold'}</span>
                          <span className="text-sm font-semibold text-zinc-950 dark:text-white">
                            +{gold.toLocaleString()}g
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 5b. Gathering Loot Table: ONLY show if loot exists and is not empty */}
                {currentSummary?.loot && currentSummary.loot.length > 0 && (
                  <div className="flex flex-col gap-3 font-mono pt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-medium text-zinc-500 uppercase tracking-wide">
                        {isRu ? 'Добыча сбора' : 'Gathering Loot'}
                      </span>
                      <span className="text-[11px] text-zinc-500">
                        {currentSummary.loot.length} {isRu ? 'поз.' : 'items'}
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="text-[10px] text-zinc-500 uppercase tracking-wider">
                            <th className="pb-2 font-normal">{isRu ? 'Название' : 'Item'}</th>
                            <th className="pb-2 font-normal text-right">{isRu ? 'Кол-во' : 'Count'}</th>
                            <th className="pb-2 font-normal text-right">{isRu ? 'Цена за шт.' : 'Price each'}</th>
                            <th className="pb-2 font-normal text-right">{isRu ? 'Сумма' : 'Total'}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {currentSummary.loot.map((item) => {
                            const displayName = item.name || (isRu ? `Предмет #${item.item_id}` : `Item #${item.item_id}`);
                            return (
                              <tr key={item.item_id} className="hover:bg-white/[0.02]">
                                <td className="py-1.5 pr-2 font-medium text-zinc-900 dark:text-zinc-100 truncate max-w-[200px]" title={displayName}>
                                  {displayName}
                                </td>
                                <td className="py-1.5 px-2 text-right text-zinc-500 tabular-nums whitespace-nowrap">
                                  ×{item.count}
                                </td>
                                <td className="py-1.5 px-2 text-right tabular-nums whitespace-nowrap">
                                  <MoneyBadge copper={item.price} language={language} />
                                </td>
                                <td className="py-1.5 pl-2 text-right font-semibold tabular-nums whitespace-nowrap">
                                  <MoneyBadge copper={item.value} language={language} />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Footer with Earned Total & Notes */}
                    <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-zinc-500">
                          {isRu ? 'Заработано: ' : 'Earned: '}
                        </span>
                        <strong className="text-sm font-bold text-zinc-950 dark:text-white">
                          <MoneyBadge copper={currentSummary.earned_copper} language={language} />
                        </strong>
                        {currentSummary.earned_complete === false && (
                          <span className="text-[11px] text-zinc-500 font-normal">
                            {isRu ? '(не у всех предметов есть цена)' : '(not all items have a price)'}
                          </span>
                        )}
                      </div>

                      {currentSummary.loot_lost != null && currentSummary.loot_lost > 0 && (
                        <span className="text-[11px] text-zinc-500">
                          {isRu ? `не посчитано предметов: ${currentSummary.loot_lost}` : `uncounted items: ${currentSummary.loot_lost}`}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* 6. Stop Reason & Targets Lost */}
                {currentSummary && (currentSummary.stop_reason || currentSummary.lost != null) && (
                  <div className="flex items-center justify-between text-xs font-mono text-zinc-500 pt-2">
                    {currentSummary.stop_reason ? (
                      <span>
                        {isRu ? 'Причина остановки: ' : 'Stop reason: '}
                        <strong className="text-zinc-800 dark:text-zinc-200">
                          {currentSummary.stop_reason}
                        </strong>
                      </span>
                    ) : <span />}

                    {currentSummary.lost != null && (
                      <span>
                        {isRu ? 'Потеряно целей: ' : 'Targets lost: '}
                        <strong className="text-zinc-800 dark:text-zinc-200">
                          {currentSummary.lost}
                        </strong>
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 7. Heatmap Card & Passes Row for Active Session (only when viewing a past session or all-day) */}
      {!isLiveSelected && hasSessions && heatmap && heatmap.status === 'ready' && heatmap.image && (
        <div className="w-full flex flex-col gap-2.5 select-none bg-transparent">
          {/* Header of Map: route name / map info */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-medium text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                {isRu ? 'Тепловая карта прогона' : 'Session Heatmap'}
              </span>
              {heatmapLabel && (
                <span className="text-[11px] font-mono text-zinc-500">
                  · {heatmapLabel}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                soundFx.playClick();
                setIsViewerOpen(true);
              }}
              className="p-1 rounded text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
              title={isRu ? 'Полноэкранный просмотр (зум и сдвиг)' : 'Open fullscreen viewer'}
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Seamless Map Container with loading spinner if pass is changing */}
          <div
            onClick={() => {
              soundFx.playClick();
              setIsViewerOpen(true);
            }}
            className="group relative w-full h-[210px] sm:h-[245px] xl:h-[275px] overflow-hidden rounded-xl cursor-zoom-in transition-all flex items-center justify-center bg-transparent border-0 shadow-none"
          >
            <img
              src={heatmap.image}
              alt={heatmap.route_name || 'Session Heatmap'}
              className={`max-h-full max-w-full w-auto h-auto object-contain select-none rounded-xl transition-all duration-300 group-hover:scale-[1.01] ${
                isHeatmapLoading ? 'opacity-40 grayscale' : 'opacity-100'
              }`}
              loading="lazy"
            />

            {isHeatmapLoading && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <Loader2 className="w-6 h-6 animate-spin text-zinc-200 drop-shadow" />
              </div>
            )}

            {/* Hover Hint */}
            <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-zinc-950/80 backdrop-blur-sm border border-white/10 text-[10px] font-mono text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 pointer-events-none shadow-md">
              <Maximize2 className="w-3 h-3 text-zinc-400" />
              <span>{isRu ? 'Клик для зума' : 'Click to zoom'}</span>
            </div>
          </div>

          {/* 8. Passes Buttons Row: «Все», «1», «2», … до passes */}
          {activeSession && activeSession.passes > 0 && (
            <div className="flex flex-col gap-1.5 px-1 pt-1 font-mono">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider pr-1 shrink-0">
                  {isRu ? 'Проход:' : 'Pass:'}
                </span>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    soundFx.playClick();
                    onSelectPassIndex(null);
                  }}
                  className={`px-2.5 py-1 rounded-md border text-xs transition-all cursor-pointer shrink-0 ${
                    selectedPassIndex === null
                      ? 'border-zinc-950 dark:border-white bg-black/5 dark:bg-white/10 text-zinc-950 dark:text-white font-semibold'
                      : 'border-black/10 dark:border-white/10 text-zinc-500 hover:text-zinc-950 dark:hover:text-white'
                  }`}
                >
                  {isRu ? 'Все' : 'All'}
                </button>

                {Array.from({ length: activeSession.passes }).map((_, idx) => {
                  const passNum = idx + 1;
                  const isPassSelected = selectedPassIndex === passNum;

                  return (
                    <button
                      key={passNum}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        soundFx.playClick();
                        onSelectPassIndex(passNum);
                      }}
                      className={`min-w-[28px] px-2 py-1 rounded-md border text-xs text-center transition-all cursor-pointer shrink-0 ${
                        isPassSelected
                          ? 'border-zinc-950 dark:border-white bg-black/5 dark:bg-white/10 text-zinc-950 dark:text-white font-semibold'
                          : 'border-black/10 dark:border-white/10 text-zinc-500 hover:text-zinc-950 dark:hover:text-white'
                      }`}
                    >
                      {passNum}
                    </button>
                  );
                })}
              </div>

              {/* 9. Selected Pass Info Details Row */}
              {activePassInfo && (
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 pl-0.5 flex items-center gap-2">
                  <span>
                    {isRu ? `проход ${activePassInfo.index}: ` : `pass ${activePassInfo.index}: `}
                    <strong>
                      {activePassInfo.direction === 'forward'
                        ? (isRu ? 'туда' : 'forward')
                        : activePassInfo.direction === 'back'
                        ? (isRu ? 'обратно' : 'back')
                        : (isRu ? 'круг' : 'loop')}
                    </strong>
                    {' · '}
                    {formatDuration(activePassInfo.duration_s)}
                    {' · '}
                    {isRu ? `узлов ${activePassInfo.nodes}` : `nodes ${activePassInfo.nodes}`}
                    {' · '}
                    {isRu ? `упоров ${activePassInfo.stucks}` : `stucks ${activePassInfo.stucks}`}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Fullscreen Viewer Modal */}
          {isViewerOpen && (
            <HeatmapViewer
              image={heatmap.image}
              routeName={heatmap.route_name || heatmapLabel}
              width={heatmap.width}
              height={heatmap.height}
              onClose={() => setIsViewerOpen(false)}
              language={language}
            />
          )}
        </div>
      )}
    </div>
  );
};
