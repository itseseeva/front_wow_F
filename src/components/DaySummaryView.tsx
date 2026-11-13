import React, { useState, useEffect, useRef, useMemo } from 'react';
import { DayResponse, SessionHeatmapResponse, LootStatus, ScheduleStatus, AutoRouteStatus, TerrainStatus, PriceStatus } from '../types';
import { getPywebviewApi } from '../utils/pywebviewBridge';
import { mockGetAutoRouteStatus, startMockAutoRouteSimulation } from '../data/mockRoutes';
import {
  BarChart3,
  Calendar as CalendarIcon,
  Clock,
  Coffee,
  Map as MapIcon,
  TrendingUp,
  Coins,
  Sparkles,
  ReceiptText,
} from 'lucide-react';
import { SpecularCard, SpecularButton } from './ui/Specular';
import { HeatmapViewer } from './HeatmapViewer';
import { soundFx } from '../utils/audio';
import { formatRouteRoman } from '../utils/roman';
import { MoneyBadge } from '../utils/money';
import { SplitLootTables } from './SplitLootTables';
import { RouteItem } from './StealthHUDLeftSidebar';
import { SalesLogModal } from './SalesLogModal';

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
  isBotPaused?: boolean;
  pauseKey?: string;
  sessionSeconds?: number;
  lootStatus?: LootStatus | null;
  activeRoute?: RouteItem | null;
  scheduleStatus?: ScheduleStatus | null;
  initialAutoRouteStatus?: AutoRouteStatus | null;
  initialTerrainStatus?: TerrainStatus | null;
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

function formatElapsed(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, '0')}`;
}

function getTerrainStageText(stage: 'tiles' | 'models' | 'grid' | null, isRu: boolean): string {
  if (stage === 'tiles') return isRu ? 'Скачиваю карту зоны' : 'Downloading zone tiles';
  if (stage === 'models') return isRu ? 'Скачиваю деревья и дома' : 'Downloading trees and models';
  if (stage === 'grid') return isRu ? 'Строю сетку' : 'Building navigation grid';
  return isRu ? 'Подготовка местности' : 'Preparing terrain';
}

function getAutoRouteStageText(stage: AutoRouteStatus['stage'], done: number, total: number, isRu: boolean): string {
  if (stage === 'grid') return isRu ? 'Загружаю карту местности' : 'Loading terrain mesh';
  if (stage === 'spots') return isRu ? 'Ищу скопления руды и трав' : 'Searching for resource nodes';
  if (stage === 'paths') return isRu ? `Прокладываю круг: участок ${done} из ${total}` : `Plotting path: segment ${done} of ${total}`;
  if (stage === 'check') return isRu ? 'Уточняю длину круга' : 'Refining loop length';
  return isRu ? 'Готовлюсь…' : 'Preparing…';
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
  isBotPaused = false,
  pauseKey = 'PAUSE',
  sessionSeconds = 0,
  lootStatus = null,
  activeRoute = null,
  scheduleStatus = null,
  initialAutoRouteStatus = null,
  initialTerrainStatus = null,
  onStopBot,
}) => {
  const isRu = language === 'ru';
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [isSalesLogOpen, setIsSalesLogOpen] = useState(false);

  // Terrain & AutoRoute Status (always subscribed, even when bot is not running)
  const [terrainStatus, setTerrainStatus] = useState<TerrainStatus | null>(initialTerrainStatus);
  const [autoRouteStatus, setAutoRouteStatus] = useState<AutoRouteStatus | null>(initialAutoRouteStatus);
  const [showAutoRouteReady, setShowAutoRouteReady] = useState<boolean>(() => {
    if (initialAutoRouteStatus?.status === 'ready') {
      return !initialAutoRouteStatus.finished_at_ms || Date.now() - initialAutoRouteStatus.finished_at_ms < 30000;
    }
    return false;
  });
  const autoRouteReadyTimerRef = useRef<any>(null);

  const isTerrainBuilding = terrainStatus?.status === 'building';
  const isTerrainError = terrainStatus?.status === 'error';
  const isAutoRouteBuilding = !isTerrainBuilding && autoRouteStatus?.status === 'building';
  const isAutoRouteReady = !isTerrainBuilding && autoRouteStatus?.status === 'ready' && showAutoRouteReady;
  const isAutoRouteError = !isTerrainBuilding && autoRouteStatus?.status === 'error';
  const hasScanActivity = Boolean(
    isTerrainBuilding ||
    isTerrainError ||
    autoRouteStatus?.status === 'building' ||
    isAutoRouteReady ||
    isAutoRouteError
  );
  const showLiveTab = isBotRunning || hasScanActivity;

  const sessions = dayData?.sessions || [];
  const hasSessions = sessions.length > 0;
  const hasLiveOrPastSessions = hasSessions || showLiveTab;

  // Active LIVE selection: when bot is running or scanning/building route, unless user explicitly selected a past session, LIVE is immediately open!
  const isSpecificPastSessionSelected = sessions.some((s) => s.session_id === selectedSessionId);
  const isLiveSelected = showLiveTab && !isSpecificPastSessionSelected;

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

  // Terrain Status (from wowbot:terrain-status, always subscribed)
  useEffect(() => {
    if (initialTerrainStatus !== undefined) {
      setTerrainStatus(initialTerrainStatus?.status === 'ready' ? null : initialTerrainStatus);
    }
  }, [initialTerrainStatus]);

  useEffect(() => {
    const handleTerrain = (e: Event) => {
      let detail = (e as CustomEvent).detail as TerrainStatus | string | undefined;
      if (typeof detail === 'string') {
        try {
          detail = JSON.parse(detail) as TerrainStatus;
        } catch {
          return;
        }
      }
      if (!detail) return;
      if (detail.status === 'ready') {
        setTerrainStatus(null);
      } else {
        setTerrainStatus(detail);
      }
    };
    window.addEventListener('wowbot:terrain-status', handleTerrain);
    return () => window.removeEventListener('wowbot:terrain-status', handleTerrain);
  }, []);

  // AutoRoute Status (from get_autoroute_status and wowbot:autoroute-status, always active)
  useEffect(() => {
    if (initialAutoRouteStatus) {
      setAutoRouteStatus(initialAutoRouteStatus);
      if (
        initialAutoRouteStatus.status === 'ready' &&
        (!initialAutoRouteStatus.finished_at_ms || Date.now() - initialAutoRouteStatus.finished_at_ms < 30000)
      ) {
        setShowAutoRouteReady(true);
        if (autoRouteReadyTimerRef.current) clearTimeout(autoRouteReadyTimerRef.current);
        autoRouteReadyTimerRef.current = setTimeout(() => {
          setShowAutoRouteReady(false);
        }, 10000);
      }
    }
  }, [initialAutoRouteStatus]);

  // Restore state whenever Summary opens / bot or route changes (no !isBotRunning guard)
  useEffect(() => {
    getPywebviewApi().then((api) => {
      if (api?.get_autoroute_status) {
        api.get_autoroute_status().then((res) => {
          if (res && res.status) {
            setAutoRouteStatus((prev) => {
              const incomingProg = typeof res.progress === 'number' ? Math.max(0, Math.min(1, res.progress)) : 0;
              const finalProg = res.status === 'ready' ? 1 : Math.max(prev?.progress ?? 0, incomingProg);
              return {
                ...res,
                progress: finalProg,
              };
            });
            if (
              res.status === 'ready' &&
              (!res.finished_at_ms || Date.now() - res.finished_at_ms < 30000)
            ) {
              setShowAutoRouteReady(true);
              if (autoRouteReadyTimerRef.current) clearTimeout(autoRouteReadyTimerRef.current);
              autoRouteReadyTimerRef.current = setTimeout(() => {
                setShowAutoRouteReady(false);
              }, 10000);
            }
          }
        }).catch(() => {});
      } else {
        // In browser mock preview
        mockGetAutoRouteStatus().then((res) => {
          if (res && res.status !== 'idle') {
            setAutoRouteStatus(res);
            if (
              res.status === 'ready' &&
              (!res.finished_at_ms || Date.now() - res.finished_at_ms < 30000)
            ) {
              setShowAutoRouteReady(true);
              if (autoRouteReadyTimerRef.current) clearTimeout(autoRouteReadyTimerRef.current);
              autoRouteReadyTimerRef.current = setTimeout(() => {
                setShowAutoRouteReady(false);
              }, 10000);
            }
          } else if (isBotRunning && !activeRoute) {
            startMockAutoRouteSimulation();
          }
        });
      }
    });
  }, [isBotRunning, activeRoute]);

  // Listen to wowbot:autoroute-status window events
  useEffect(() => {
    const handleAutoRoute = (e: Event) => {
      let detail = (e as CustomEvent).detail as AutoRouteStatus | string | undefined;
      if (typeof detail === 'string') {
        try {
          detail = JSON.parse(detail) as AutoRouteStatus;
        } catch {
          return;
        }
      }
      if (!detail) return;
      setAutoRouteStatus((prev) => {
        const incomingProg = typeof detail.progress === 'number' ? Math.max(0, Math.min(1, detail.progress)) : 0;
        const finalProg = detail.status === 'ready' ? 1 : Math.max(prev?.progress ?? 0, incomingProg);
        return {
          ...detail,
          progress: finalProg,
        };
      });

      if (detail.status === 'ready') {
        setShowAutoRouteReady(true);
        if (autoRouteReadyTimerRef.current) clearTimeout(autoRouteReadyTimerRef.current);
        autoRouteReadyTimerRef.current = setTimeout(() => {
          setShowAutoRouteReady(false);
        }, 10000);
      }
    };
    window.addEventListener('wowbot:autoroute-status', handleAutoRoute);
    return () => {
      window.removeEventListener('wowbot:autoroute-status', handleAutoRoute);
      if (autoRouteReadyTimerRef.current) clearTimeout(autoRouteReadyTimerRef.current);
    };
  }, []);

  // Price Status (from wowbot:prices and get_price_status)
  const [priceStatus, setPriceStatus] = useState<PriceStatus | null>(null);

  useEffect(() => {
    const handlePrices = (e: any) => {
      if (e?.detail) {
        setPriceStatus(e.detail);
      }
    };
    window.addEventListener('wowbot:prices', handlePrices);

    getPywebviewApi().then((api) => {
      if (api?.get_price_status) {
        api.get_price_status().then((res) => {
          if (res && res.ok) {
            setPriceStatus(res);
          }
        }).catch(() => {});
      }
    });

    return () => window.removeEventListener('wowbot:prices', handlePrices);
  }, []);

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

  // Cards «Заработано» и «Золото в час»
  const items = lootStatus?.items || [];
  const hasItems = items.length > 0;
  const earnedCopper = lootStatus?.earned_copper;

  let earnedValueNode: React.ReactNode = null;
  let earnedSubtext = '';
  let goldPerHourNode: React.ReactNode = null;
  let goldPerHourSubtext = '';

  const getPriceSubtext = () => {
    if (!priceStatus || priceStatus.configured === false) {
      return isRu ? 'нет ключей API (.env)' : 'missing API keys (.env)';
    }
    if (priceStatus.house_id === null) {
      return isRu ? 'аукцион не определён — см. настройки' : 'auction not selected — see settings';
    }
    return isRu ? 'цены загружаются' : 'loading prices…';
  };

  if (!hasItems) {
    // items пустой — «Заработано: 0», «Золото в час: —», подпись «пока ничего не собрано»
    earnedValueNode = '0';
    earnedSubtext = isRu ? 'пока ничего не собрано' : 'nothing gathered yet';
    goldPerHourNode = '—';
    goldPerHourSubtext = isRu ? 'пока ничего не собрано' : 'nothing gathered yet';
  } else if (earnedCopper === null || earnedCopper === undefined) {
    // предметы есть, а earned_copper === null — «нет цен», и подпись по PriceStatus
    const pSub = getPriceSubtext();
    earnedValueNode = isRu ? 'нет цен' : 'no prices';
    earnedSubtext = pSub;
    goldPerHourNode = isRu ? 'нет цен' : 'no prices';
    goldPerHourSubtext = pSub;
  } else {
    // предметы есть и цена известна
    earnedValueNode = <MoneyBadge copper={earnedCopper} language={language} />;
    earnedSubtext = lootStatus?.earned_complete === false
      ? (isRu ? 'не у всех предметов есть цена' : 'not all items have a price')
      : (isRu ? 'по аукциону' : 'auction price');

    if (sessionSeconds < 300) {
      goldPerHourNode = isRu ? 'считаю…' : 'calculating…';
      goldPerHourSubtext = lootStatus?.earned_complete === false
        ? (isRu ? 'не у всех предметов есть цена' : 'not all items have a price')
        : (isRu ? 'первые 5 минут' : 'first 5 minutes');
    } else {
      const hours = sessionSeconds / 3600;
      const copperPerHour = Math.round(earnedCopper / hours);
      goldPerHourNode = <MoneyBadge copper={copperPerHour} language={language} />;
      goldPerHourSubtext = lootStatus?.earned_complete === false
        ? (isRu ? 'не у всех предметов есть цена' : 'not all items have a price')
        : (isRu ? 'по ценам аукциона' : 'auction market rate');
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

  // Effective loot and metrics for past session / all-day view
  const effectiveLoot = useMemo(() => {
    return currentSummary?.loot && currentSummary.loot.length > 0 ? currentSummary.loot : null;
  }, [currentSummary]);

  const pastEarnedCopper = useMemo(() => {
    if (currentSummary?.earned_copper != null) return currentSummary.earned_copper;
    if (currentSummary?.gold != null && currentSummary.gold > 0) return currentSummary.gold * 10000;
    if (effectiveLoot && effectiveLoot.length > 0) {
      const sum = effectiveLoot.reduce((acc, it) => acc + (it.value || 0), 0);
      return sum > 0 ? sum : null;
    }
    return null;
  }, [currentSummary, effectiveLoot]);

  const pastTotalItems = useMemo(() => {
    if (currentSummary?.loot && currentSummary.loot.length > 0) {
      return currentSummary.loot.reduce((acc, it) => acc + (it.count || 0), 0);
    }
    const ores = (currentSummary?.khorium || 0) + (currentSummary?.adamantite || 0) + (currentSummary?.fel_iron || 0);
    return ores;
  }, [currentSummary]);

  const pastCopperPerHour = useMemo(() => {
    if (!currentSummary?.duration_s || currentSummary.duration_s <= 0 || pastEarnedCopper == null) return null;
    return Math.round((pastEarnedCopper / currentSummary.duration_s) * 3600);
  }, [currentSummary, pastEarnedCopper]);

  return (
    <div className="w-full max-w-4xl 2xl:max-w-5xl mx-auto flex flex-col gap-6">
      <div data-tour="summary-overview" className="w-full flex flex-col gap-5">
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
                ? (isBotPaused
                    ? (isRu
                        ? `⏸ Пауза — управление у тебя. Нажми ${(pauseKey || 'PAUSE').toUpperCase()}, чтобы продолжить`
                        : `⏸ Paused — you are in control. Press ${(pauseKey || 'PAUSE').toUpperCase()} to resume`)
                    : (isRu ? 'Идёт сессия сбора в реальном времени' : 'Live gathering session in progress'))
                : isLiveSelected && hasScanActivity
                ? (isRu ? 'Построение автомаршрута' : 'Building auto route')
                : hasSessions
                ? `${getPluralSessions(sessions.length, isRu)} · ${getPluralRoutes(uniqueRoutesCount, isRu)}`
                : (isRu ? 'В этот день бот не работал' : 'No sessions on this day')}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <SpecularButton
              data-tour="summary-heatmap"
              onClick={() => {
                soundFx.playClick();
                setIsViewerOpen(true);
              }}
              className="h-7 px-2.5 rounded-lg flex items-center gap-1.5 cursor-pointer border border-black/10 dark:border-white/10 bg-transparent text-[11px] text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-all font-mono"
              title={isRu ? 'Открыть тепловую карту прогона' : 'Open session heatmap'}
            >
              <MapIcon className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
              <span>{isRu ? 'Карта' : 'Map'}</span>
            </SpecularButton>

            <SpecularButton
              data-tour="summary-sales-log"
              onClick={() => {
                soundFx.playClick();
                setIsSalesLogOpen(true);
              }}
              className="h-7 px-2.5 rounded-lg flex items-center gap-1.5 cursor-pointer border border-black/10 dark:border-white/10 bg-transparent text-[11px] text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-all font-mono"
              title={isRu ? 'Открыть журнал продаж' : 'Open sales log'}
            >
              <ReceiptText className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
              <span>{isRu ? 'Журнал продаж' : 'Sales log'}</span>
            </SpecularButton>

            {hasSessions && dayData?.total?.duration_s != null && (
              <span className="text-[10px] 2xl:text-xs font-mono text-zinc-600 dark:text-zinc-400">
                {isRu ? 'за день: ' : 'day total: '}
                <strong className="text-zinc-950 dark:text-white font-semibold">
                  {formatDuration(dayData.total.duration_s)}
                </strong>
              </span>
            )}
          </div>
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
                {showLiveTab && (
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
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isBotPaused ? 'bg-amber-400' : 'bg-zinc-900 dark:bg-white'} opacity-75`}></span>
                      <span className={`relative inline-flex rounded-full h-2 w-2 ${isBotPaused ? 'bg-amber-400' : 'bg-zinc-950 dark:bg-white'}`}></span>
                    </span>
                    <span>
                      {isBotRunning
                        ? `LIVE · ${activeRoute ? `${formatRouteRoman(activeRoute.name)}${activeRoute.region ? ` (${activeRoute.region})` : ''}` : (isRu ? 'Текущая сессия' : 'Active Session')}`
                        : `LIVE · ${isRu ? 'Автомаршрут' : 'Auto Route'}`}
                      {isBotRunning && isBotPaused && (
                        <span className="ml-1.5 px-1.5 py-0.5 text-[10px] rounded bg-amber-500/20 text-amber-500 dark:text-amber-400 border border-amber-500/30">
                          {isRu ? 'ПАУЗА' : 'PAUSED'}
                        </span>
                      )}
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
            </div>

            {/* LIVE TELEMETRY VIEW (immediately open, no container boxes) */}
            {isLiveSelected ? (
              <div className="flex flex-col gap-6 animate-fadeIn">
                {isBotRunning && isBotPaused && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500 dark:text-amber-400 font-mono text-xs font-semibold shadow-sm">
                    <span>
                      {isRu
                        ? `⏸ Пауза — управление у тебя. Нажми ${(pauseKey || 'PAUSE').toUpperCase()}, чтобы продолжить`
                        : `⏸ Paused — you are in control. Press ${(pauseKey || 'PAUSE').toUpperCase()} to resume`}
                    </span>
                  </div>
                )}
                {/* Live 5 Metric Cards (only when bot is running) */}
                {isBotRunning && (
                <div data-tour="summary-live-cards" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6 py-1 font-mono">
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
                        <span className={`w-1.5 h-1.5 rounded-full ${isBotPaused ? 'bg-amber-400' : 'bg-zinc-950 dark:bg-white'} animate-pulse`} />
                        <span className={`text-[10px] ${isBotPaused ? 'text-amber-500 dark:text-amber-400 font-medium' : 'text-zinc-500'}`}>
                          {isBotPaused ? (isRu ? 'на паузе' : 'paused') : (isRu ? 'в процессе' : 'running')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 2. Break Countdown */}
                  <div data-tour="summary-until-break" className="flex flex-col justify-between gap-1">
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
                        {earnedValueNode}
                      </span>
                      <p className="text-[10px] text-zinc-500 mt-0.5 truncate">
                        {earnedSubtext}
                      </p>
                    </div>
                  </div>

                  {/* 5. Gold Per Hour */}
                  <div data-tour="summary-gold-rate" className="flex flex-col justify-between gap-1">
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
                )}

                {/* 1. Unified «Сканирование местности» loading block / AutoRoute ready / error */}
                {(() => {
                  let scanTitle = isRu ? 'Сканирование местности' : 'Scanning terrain';
                  let scanSubtitle: string | null = null;
                  let scanPercent = 0;
                  let scanBottomText: string | null = null;

                  if (isTerrainBuilding) {
                    scanPercent = Math.min(100, Math.max(0, Math.round((terrainStatus.progress ?? 0) * 100)));
                    scanSubtitle = getTerrainStageText(terrainStatus.stage, isRu);
                    const elapsed = terrainStatus.elapsed_s ?? 0;
                    const eta = terrainStatus.eta_s != null ? (isRu ? `${terrainStatus.eta_s} с` : `${terrainStatus.eta_s}s`) : (isRu ? 'оцениваю…' : 'evaluating…');
                    scanBottomText = isRu ? `прошло ${elapsed} с · осталось ~${eta}` : `elapsed ${elapsed}s · ~${eta} left`;
                  } else if (isAutoRouteBuilding) {
                    scanPercent = Math.min(100, Math.max(0, Math.round((autoRouteStatus.progress ?? 0) * 100)));
                    scanSubtitle =
                      autoRouteStatus.stage == null && autoRouteStatus.note
                        ? autoRouteStatus.note
                        : getAutoRouteStageText(autoRouteStatus.stage, autoRouteStatus.done, autoRouteStatus.total, isRu);
                    const elapsed = autoRouteStatus.elapsed_s != null
                      ? autoRouteStatus.elapsed_s
                      : (autoRouteStatus.started_at_ms ? Math.max(0, Math.floor((nowMs - autoRouteStatus.started_at_ms) / 1000)) : 0);
                    const eta = autoRouteStatus.eta_s != null ? (isRu ? `${autoRouteStatus.eta_s} с` : `${autoRouteStatus.eta_s}s`) : (isRu ? 'оцениваю…' : 'evaluating…');
                    scanBottomText = isRu ? `прошло ${elapsed} с · осталось ~${eta}` : `elapsed ${elapsed}s · ~${eta} left`;
                  } else if (isAutoRouteReady) {
                    scanTitle = isRu ? `Круг готов: ${autoRouteStatus.route_name || 'Автомаршрут'}` : `Loop ready: ${autoRouteStatus.route_name || 'AutoRoute'}`;
                    scanSubtitle = autoRouteStatus.note || null;
                    scanPercent = 100;
                    scanBottomText = null;
                  }

                  return (
                    <>
                      {/* Active Loading Bar or Ready (10s) */}
                      {(isTerrainBuilding || isAutoRouteBuilding || isAutoRouteReady) && (
                        <div className="py-8 flex flex-col items-center justify-center text-center font-mono select-none">
                          <div className="w-full max-w-xs flex flex-col gap-2">
                            {/* Top: Blinking white dot + Title + Percent on the right */}
                            <div className="flex items-center justify-between text-xs font-medium text-zinc-200">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    isAutoRouteReady ? 'bg-emerald-400' : 'bg-white animate-pulse'
                                  }`}
                                />
                                <span className="tracking-wide">{scanTitle}</span>
                              </div>
                              <span className="font-mono text-zinc-400 tabular-nums shrink-0">
                                {scanPercent}%
                              </span>
                            </div>

                            {/* Stage Subtitle under title */}
                            {scanSubtitle && (
                              <div className="text-[11px] text-zinc-400 text-left pl-3.5 -mt-0.5">
                                {scanSubtitle}
                              </div>
                            )}

                            {/* Minimalist black and white bar */}
                            <div className="w-full h-1 rounded-full bg-zinc-800 overflow-hidden">
                              <div
                                className="h-full bg-white transition-all duration-300 ease-out rounded-full"
                                style={{ width: `${Math.max(2, scanPercent)}%` }}
                              />
                            </div>

                            {/* Fine text under bar */}
                            {scanBottomText && (
                              <div className="text-[10px] text-zinc-500 text-left pl-0.5">
                                {scanBottomText}
                              </div>
                            )}

                            {/* Warning during active build: pulsing white text */}
                            {(isTerrainBuilding || isAutoRouteBuilding) && (
                              <div className="text-[10px] text-zinc-100 dark:text-white font-medium animate-pulse text-left pl-0.5">
                                {isRu
                                  ? 'Не сворачивайте игру во время загрузки'
                                  : 'Do not minimize the game during loading'}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Error State: AutoRoute error without bar */}
                      {isAutoRouteError && !isTerrainBuilding && (
                        <div className="py-6 flex flex-col items-center justify-center text-center font-mono select-none">
                          <div className="w-full max-w-sm p-3 rounded-lg bg-zinc-900/40 border border-zinc-800/80 text-xs text-zinc-300 text-left flex items-start gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1 shrink-0" />
                            <span>
                              {isBotRunning
                                ? isRu
                                  ? `Автомаршрут не вышел: ${autoRouteStatus.note || 'ошибка'}. Хожу по зоне вокруг места`
                                  : `Auto-route failed: ${autoRouteStatus.note || 'error'}. Patrolling local zone around area`
                                : isRu
                                ? `Круг не построен: ${autoRouteStatus.note || 'ошибка'}`
                                : `Loop was not built: ${autoRouteStatus.note || 'error'}`}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Error State: Terrain error without bar */}
                      {isTerrainError && (
                        <div className="py-6 flex flex-col items-center justify-center text-center font-mono select-none">
                          <div className="w-full max-w-sm p-3 rounded-lg bg-red-950/20 border border-red-900/50 text-xs text-red-300 text-left flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                            <span>{terrainStatus.error || (isRu ? 'Ошибка сборки карты зоны' : 'Error building terrain mesh')}</span>
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}

                {/* Live Gathering Loot Tables (only when bot is running) */}
                {isBotRunning && (hasItems ? (
                  <div className="flex flex-col gap-3 font-mono pt-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100 uppercase tracking-wide">
                        {isRu ? 'Добыча текущей сессии' : 'Active Session Loot'}
                      </span>
                      <span className="w-1.5 h-1.5 rounded-full bg-zinc-950 dark:bg-white animate-pulse" />
                    </div>

                    <SplitLootTables
                      items={items}
                      earnedCopper={lootStatus?.earned_copper ?? null}
                      earnedComplete={lootStatus?.earned_complete}
                      language={language}
                      variant="frameless"
                      showTotalHeader={false}
                      highlightNew
                    />
                  </div>
                ) : !terrainStatus && (!autoRouteStatus || autoRouteStatus.status === 'idle' || (autoRouteStatus.status === 'ready' && !showAutoRouteReady)) ? (
                  isBotRunning ? (
                    <div className="py-14 flex flex-col items-center justify-center text-center font-mono select-none">
                      <div className="w-full max-w-md flex flex-col items-center gap-2">
                        <div className="flex items-center gap-2 text-xs font-medium text-zinc-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                          <span>{isRu ? 'Добычи пока нет' : 'No loot yet'}</span>
                        </div>
                        <p className="text-[11px] text-zinc-500 max-w-sm leading-relaxed">
                          {isRu
                            ? 'Бот идёт по маршруту. Собранная руда и травы появятся здесь с ценой на аукционе.'
                            : 'Bot is on the route. Gathered ore and herbs will appear here with auction prices.'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="py-16 flex flex-col items-center justify-center text-center font-mono select-none text-zinc-500 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                        <span>{isRu ? 'пока ничего не собрано' : 'nothing gathered yet'}</span>
                      </div>
                    </div>
                  )
                ) : null)}
              </div>
            ) : (
              /* PAST SESSION OR ALL DAY SUMMARY (frameless, no container boxes) */
              <div className="flex flex-col gap-6">
                {/* 4. Metric Cards Grid: Duration, Items Gathered, Earned Gold, Gold/hour, Avg Gap */}
                {currentSummary && (
                  <div data-tour="summary-live-cards" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6 py-2 font-mono">
                    {/* 1. Duration */}
                    <div className="flex flex-col justify-between gap-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-zinc-500">{isRu ? 'Длительность' : 'Duration'}</span>
                        <Clock className="w-3.5 h-3.5 text-zinc-400" />
                      </div>
                      <div>
                        <span className="text-2xl sm:text-3xl font-bold text-zinc-950 dark:text-white tracking-tight">
                          {formatDuration(currentSummary.duration_s)}
                        </span>
                      </div>
                    </div>

                    {/* 2. Total Items Gathered (Сумма предметов) */}
                    <div className="flex flex-col justify-between gap-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-zinc-500">{isRu ? 'Собрано предметов' : 'Items Gathered'}</span>
                        <Sparkles className="w-3.5 h-3.5 text-zinc-400" />
                      </div>
                      <div>
                        <span className="text-2xl sm:text-3xl font-bold text-zinc-950 dark:text-white tracking-tight">
                          {pastTotalItems}
                        </span>
                        <p className="text-[10px] text-zinc-500 mt-0.5">
                          {pastTotalItems > 0 ? (isRu ? 'всего в сумках' : 'total in bags') : (isRu ? 'нет предметов' : 'none')}
                        </p>
                      </div>
                    </div>

                    {/* 3. Earned Gold (Количество заработанной голды) */}
                    <div className="flex flex-col justify-between gap-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-zinc-500">{isRu ? 'Заработано' : 'Earned'}</span>
                        <Coins className="w-3.5 h-3.5 text-zinc-400" />
                      </div>
                      <div>
                        <span className="text-xl sm:text-2xl font-bold text-zinc-950 dark:text-white tracking-tight">
                          <MoneyBadge copper={pastEarnedCopper} language={language} />
                        </span>
                        <p className="text-[10px] text-zinc-500 mt-0.5 truncate">
                          {pastEarnedCopper != null && pastEarnedCopper > 0
                            ? (isRu ? 'по ценам аукциона' : 'auction valuation')
                            : (isRu ? 'добычи нет' : 'no revenue')}
                        </p>
                      </div>
                    </div>

                    {/* 4. Gold Per Hour */}
                    <div data-tour="summary-gold-rate" className="flex flex-col justify-between gap-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-zinc-500">{isRu ? 'Золото в час' : 'Gold / hour'}</span>
                        <TrendingUp className="w-3.5 h-3.5 text-zinc-400" />
                      </div>
                      <div>
                        <span className="text-xl sm:text-2xl font-bold text-zinc-950 dark:text-white tracking-tight">
                          <MoneyBadge copper={pastCopperPerHour} language={language} />
                        </span>
                        <p className="text-[10px] text-zinc-500 mt-0.5 truncate">
                          {currentSummary.duration_s > 0 ? (isRu ? 'темп фарма' : 'farm pace') : '—'}
                        </p>
                      </div>
                    </div>

                    {/* 5. Avg Kill Gap */}
                    <div className="flex flex-col justify-between gap-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-zinc-500">{isRu ? 'Пауза' : 'Avg Gap'}</span>
                      </div>
                      <div>
                        <span className="text-2xl sm:text-3xl font-bold text-zinc-950 dark:text-white tracking-tight">
                          {currentSummary.avg_kill_gap_s != null ? `${currentSummary.avg_kill_gap_s}с` : '—'}
                        </span>
                        <p className="text-[10px] text-zinc-500 mt-0.5 truncate">
                          {isRu ? 'между узлами' : 'between nodes'}
                        </p>
                      </div>
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

                {/* Past Session / All-Day Split Loot Tables (get_day -> total.loot & sessions[].summary.loot) */}
                {effectiveLoot && effectiveLoot.length > 0 && (
                  <div className="pt-3 border-t border-black/5 dark:border-white/5">
                    <SplitLootTables
                      items={effectiveLoot}
                      earnedCopper={pastEarnedCopper}
                      earnedComplete={currentSummary?.earned_complete}
                      lootLost={currentSummary?.loot_lost}
                      language={language}
                      variant="frameless"
                      showTotalHeader={false}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Fullscreen Heatmap Viewer Modal */}
      {isViewerOpen && (
        <HeatmapViewer
          image={!isLiveSelected && hasSessions ? heatmap?.image : undefined}
          routeName={
            (!isLiveSelected && hasSessions && (heatmap?.route_name || heatmapLabel)) ||
            formatDateTitle(selectedDate, isRu)
          }
          width={heatmap?.width}
          height={heatmap?.height}
          onClose={() => setIsViewerOpen(false)}
          language={language}
          passes={!isLiveSelected && hasSessions ? (activeSession?.passes || 0) : 0}
          selectedPassIndex={selectedPassIndex}
          onSelectPassIndex={onSelectPassIndex}
          activePassInfo={activePassInfo}
          isLoading={!isLiveSelected && hasSessions && isHeatmapLoading}
          emptyMessage={
            !hasSessions
              ? (isRu ? 'В этот день бот не работал — карты прогона нет' : 'No sessions on this day — no heatmap recorded')
              : isLiveSelected
              ? (isRu ? 'Карта появится после завершения текущей сессии' : 'Heatmap will appear after the current session finishes')
              : heatmap?.status === 'building'
              ? (isRu ? 'Тепловая карта ещё строится…' : 'Session heatmap is still building…')
              : heatmap?.status === 'error'
              ? (heatmap.error || (isRu ? 'Не удалось построить карту' : 'Failed to build heatmap'))
              : (isRu ? 'Для этой сессии карта не записана' : 'No heatmap recorded for this session')
          }
        />
      )}

      {/* Sales Log Modal */}
      <SalesLogModal
        isOpen={isSalesLogOpen}
        onClose={() => setIsSalesLogOpen(false)}
        language={language}
        date={selectedDate}
      />
    </div>
  );
};
