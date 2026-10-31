import React, { useState } from 'react';
import { DayResponse, SessionHeatmapResponse } from '../types';
import { BarChart3, Calendar as CalendarIcon, Clock, Loader2, Maximize2 } from 'lucide-react';
import { SpecularCard } from './ui/Specular';
import { HeatmapViewer } from './HeatmapViewer';
import { soundFx } from '../utils/audio';

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
}) => {
  const isRu = language === 'ru';
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  const sessions = dayData?.sessions || [];
  const hasSessions = sessions.length > 0;

  // Active session and summary calculation
  const isAllDay = selectedSessionId === 'all';
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
    const cleanRouteName = activeSession.route_name.replace(/\s*\([^)]*\)/g, '').trim();
    heatmapLabel = isAllDay
      ? `${isRu ? 'карта: ' : 'map: '}${timeStr} · ${cleanRouteName}`
      : `${timeStr} · ${cleanRouteName}`;
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
    <div className="w-full max-w-4xl 2xl:max-w-5xl mx-auto flex flex-col gap-4">
      <SpecularCard className="w-full rounded-2xl p-5 2xl:p-7 border border-transparent hover:border-black/10 dark:hover:border-white/[0.08] bg-transparent shadow-none transition-all duration-200">
        {/* 1. Header: Date Title, sessions/routes subtitle & day duration */}
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-black/10 dark:border-white/10">
          <div>
            <h1 className="text-sm 2xl:text-base font-semibold tracking-wide text-zinc-950 dark:text-white font-mono flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-zinc-700 dark:text-zinc-300" strokeWidth={1.5} />
              <span>
                {isRu ? 'Итоги · ' : 'Summary · '}
                {formatDateTitle(selectedDate, isRu)}
              </span>
            </h1>
            <p className="text-[11px] 2xl:text-xs text-zinc-500 mt-0.5 font-mono">
              {hasSessions
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
        {!hasSessions ? (
          <div className="text-center py-16 flex flex-col items-center justify-center gap-3 font-mono">
            <div className="w-12 h-12 rounded-xl border border-dashed border-zinc-400 dark:border-zinc-700 flex items-center justify-center text-zinc-400 dark:text-zinc-500">
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
          <div className="flex flex-col gap-5">
            {/* 3. Chip Selector Row: «Весь день» + each session */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none font-mono text-xs">
              <button
                type="button"
                onClick={() => {
                  soundFx.playClick();
                  onSelectSessionId('all');
                  onSelectPassIndex(null);
                }}
                className={`px-3 py-1.5 rounded-lg border transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  isAllDay
                    ? 'border-zinc-950 dark:border-white bg-black/5 dark:bg-white/10 text-zinc-950 dark:text-white font-semibold'
                    : 'border-black/10 dark:border-white/10 text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <span>{isRu ? 'Весь день' : 'All Day'}</span>
              </button>

              {sessions.map((s) => {
                const isSelected = selectedSessionId === s.session_id;
                const timeStr = new Date(s.started_at_ms).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                });
                const cleanRouteName = s.route_name.replace(/\s*\([^)]*\)/g, '').trim();

                return (
                  <button
                    key={s.session_id}
                    type="button"
                    onClick={() => {
                      soundFx.playClick();
                      onSelectSessionId(s.session_id);
                      onSelectPassIndex(null);
                    }}
                    className={`px-3 py-1.5 rounded-lg border transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                      isSelected
                        ? 'border-zinc-950 dark:border-white bg-black/5 dark:bg-white/10 text-zinc-950 dark:text-white font-semibold'
                        : 'border-black/10 dark:border-white/10 text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                  >
                    <span>{timeStr} · {cleanRouteName}</span>
                  </button>
                );
              })}
            </div>

            {/* 4. Metric Cards Grid */}
            {currentSummary && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl border border-black/10 dark:border-white/10 flex flex-col gap-1">
                  <span className="text-[11px] font-mono text-zinc-500">{isRu ? 'Длительность' : 'Duration'}</span>
                  <span className="text-base font-mono font-bold text-zinc-950 dark:text-white">
                    {formatDuration(currentSummary.duration_s)}
                  </span>
                </div>
                <div className="p-3 rounded-xl border border-black/10 dark:border-white/10 flex flex-col gap-1">
                  <span className="text-[11px] font-mono text-zinc-500">{isRu ? 'Узлов собрано' : 'Nodes Gathered'}</span>
                  <span className="text-base font-mono font-bold text-zinc-950 dark:text-white">
                    {currentSummary.kills != null ? currentSummary.kills : '—'}
                  </span>
                </div>
                <div className="p-3 rounded-xl border border-black/10 dark:border-white/10 flex flex-col gap-1">
                  <span className="text-[11px] font-mono text-zinc-500">{isRu ? 'Темп в час' : 'Pace / hour'}</span>
                  <span className="text-base font-mono font-bold text-zinc-950 dark:text-white">
                    {currentSummary.kills_per_hour != null ? `${currentSummary.kills_per_hour}/ч` : '—'}
                  </span>
                </div>
                <div className="p-3 rounded-xl border border-black/10 dark:border-white/10 flex flex-col gap-1">
                  <span className="text-[11px] font-mono text-zinc-500">{isRu ? 'Пауза' : 'Avg Kill Gap'}</span>
                  <span className="text-base font-mono font-bold text-zinc-950 dark:text-white">
                    {currentSummary.avg_kill_gap_s != null ? `${currentSummary.avg_kill_gap_s}с` : '—'}
                  </span>
                </div>
              </div>
            )}

            {/* 5. Resource breakdown: ONLY show if resources exist and are > 0 */}
            {hasExtractedResources && currentSummary && (
              <div className="p-3.5 rounded-xl border border-black/10 dark:border-white/10 flex flex-col gap-2.5">
                <span className="text-xs font-mono font-medium text-zinc-600 dark:text-zinc-400">
                  {isRu ? 'Добытые ресурсы' : 'Extracted Resources'}
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
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

            {/* 6. Stop Reason & Targets Lost */}
            {currentSummary && (currentSummary.stop_reason || currentSummary.lost != null) && (
              <div className="flex items-center justify-between text-xs font-mono text-zinc-500 pt-2 border-t border-black/10 dark:border-white/10">
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
      </SpecularCard>

      {/* 7. Heatmap Card & Passes Row for Active Session */}
      {hasSessions && heatmap && heatmap.status === 'ready' && heatmap.image && (
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
