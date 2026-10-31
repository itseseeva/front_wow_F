import React, { useState, useEffect, useRef } from 'react';
import { SessionHeatmapResponse, SessionSummaryData } from '../types';
import { SpecularCard } from './ui/Specular';
import { HeatmapViewer } from './HeatmapViewer';
import { translations, Language, Theme } from '../utils/i18n';
import { Map, Maximize2, Loader2, AlertCircle } from 'lucide-react';
import { soundFx } from '../utils/audio';

interface SessionHeatmapCardProps {
  summary: SessionSummaryData | null;
  language?: Language;
  theme?: Theme;
}

export const SessionHeatmapCard: React.FC<SessionHeatmapCardProps> = ({
  summary,
  language = 'ru',
}) => {
  const t = translations[language];
  const isRu = language === 'ru';

  const [heatmap, setHeatmap] = useState<SessionHeatmapResponse | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState<boolean>(false);
  const pollTimerRef = useRef<any>(null);
  const pollCountRef = useRef<number>(0);

  // Key tracking unique session run
  const sessionKey = summary ? `${summary.started_at_ms}_${summary.stopped_at_ms}` : 'none';

  useEffect(() => {
    // 1. Reset state on new session
    setHeatmap(null);
    setIsViewerOpen(false);
    pollCountRef.current = 0;

    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    // Check if pywebview API exists and has get_session_heatmap
    const api = window.pywebview?.api;
    if (!api || typeof api.get_session_heatmap !== 'function') {
      // Backend does not support heatmap or is old
      return;
    }

    let isMounted = true;

    const stopPolling = () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };

    const fetchHeatmap = async () => {
      try {
        if (!window.pywebview?.api?.get_session_heatmap) return;
        const res = await window.pywebview.api.get_session_heatmap();
        if (!isMounted) return;

        if (res) {
          setHeatmap(res);

          if (res.status !== 'building') {
            stopPolling();
          }
        }
      } catch (err) {
        console.warn('get_session_heatmap error:', err);
        if (isMounted) {
          setHeatmap({
            ok: false,
            status: 'error',
            error: isRu ? 'Не удалось связаться с бэкендом' : 'Failed to reach backend',
          });
          stopPolling();
        }
      }
    };

    const startPolling = () => {
      stopPolling();
      pollCountRef.current = 0;

      // Poll every 1500ms, max 60s (40 iterations)
      pollTimerRef.current = setInterval(async () => {
        pollCountRef.current += 1;
        if (pollCountRef.current > 40) {
          stopPolling();
          return;
        }
        await fetchHeatmap();
      }, 1500);
    };

    // Initial fetch
    fetchHeatmap().then(() => {
      if (!isMounted) return;
      // If initial fetch resulted in building, start interval
      setHeatmap((current) => {
        if (current?.status === 'building') {
          startPolling();
        }
        return current;
      });
    });

    // Event listener for backend broadcast
    const handleHeatmapEvent = (e: Event) => {
      const customEvent = e as CustomEvent<SessionHeatmapResponse>;
      if (!isMounted || !customEvent.detail) return;
      setHeatmap(customEvent.detail);
      stopPolling();
    };

    window.addEventListener('wowbot:session-heatmap', handleHeatmapEvent);

    return () => {
      isMounted = false;
      stopPolling();
      window.removeEventListener('wowbot:session-heatmap', handleHeatmapEvent);
    };
  }, [sessionKey, isRu]);

  // If method doesn't exist or status is 'none', do not render card at all
  if (!heatmap || heatmap.status === 'none') {
    return null;
  }

  // 1. Building State
  if (heatmap.status === 'building') {
    return (
      <SpecularCard className="p-4 sm:p-5 rounded-xl border border-black/10 dark:border-white/10 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Map className="w-4 h-4 text-zinc-500 animate-pulse" />
            <span className="text-xs font-mono font-medium text-zinc-950 dark:text-white uppercase tracking-wider">
              {t.heatmapCardTitle}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-mono text-zinc-500">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" />
            <span>{t.heatmapBuilding}</span>
          </div>
        </div>

        {/* Tactical Skeleton Placeholder with subtle pulse */}
        <div className="relative w-full aspect-[16/9] min-h-[220px] rounded-lg bg-black/[0.04] dark:bg-white/[0.03] border border-dashed border-black/10 dark:border-white/10 flex flex-col items-center justify-center gap-2 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.04] to-transparent animate-pulse" />
          <Loader2 className="w-6 h-6 animate-spin text-zinc-400 dark:text-zinc-500" />
          <span className="text-xs font-mono text-zinc-600 dark:text-zinc-400 font-medium">
            {t.heatmapBuilding}
          </span>
          <span className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500">
            {t.heatmapBuildingSub}
          </span>
        </div>
      </SpecularCard>
    );
  }

  // 2. Error State
  if (heatmap.status === 'error') {
    return (
      <SpecularCard className="p-4 sm:p-5 rounded-xl border border-black/10 dark:border-white/10 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Map className="w-4 h-4 text-zinc-500" />
          <span className="text-xs font-mono font-medium text-zinc-950 dark:text-white uppercase tracking-wider">
            {t.heatmapCardTitle}
          </span>
        </div>
        <div className="p-4 rounded-lg bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 flex items-center gap-2.5 text-xs font-mono text-zinc-500">
          <AlertCircle className="w-4 h-4 text-zinc-400 shrink-0" />
          <span>{heatmap.error || t.heatmapErrorGeneric}</span>
        </div>
      </SpecularCard>
    );
  }

  // 3. Ready State
  if (heatmap.status === 'ready' && heatmap.image) {
    return (
      <>
        <SpecularCard className="p-4 sm:p-5 rounded-xl border border-black/10 dark:border-white/10 flex flex-col gap-3">
          {/* Header with Route Name and Fullscreen Hint */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Map className="w-4 h-4 text-zinc-700 dark:text-zinc-300" strokeWidth={1.5} />
              <span className="text-xs font-mono font-medium text-zinc-950 dark:text-white uppercase tracking-wider">
                {t.heatmapCardTitle}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {heatmap.route_name && (
                <span className="px-2 py-0.5 rounded bg-black/[0.04] dark:bg-white/[0.06] border border-black/5 dark:border-white/10 text-[11px] font-mono text-zinc-600 dark:text-zinc-300 font-medium">
                  {heatmap.route_name}
                </span>
              )}
              <button
                onClick={() => {
                  soundFx.playClick();
                  setIsViewerOpen(true);
                }}
                className="p-1 rounded text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                title={isRu ? 'Открыть на весь экран' : 'Open fullscreen'}
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Heatmap Image Container: Full Width, Natural Height, Clickable */}
          <div
            onClick={() => {
              soundFx.playClick();
              setIsViewerOpen(true);
            }}
            className="group relative w-full overflow-hidden rounded-lg border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.02] cursor-zoom-in transition-all hover:border-black/25 dark:hover:border-white/25"
          >
            <img
              src={heatmap.image}
              alt={heatmap.route_name || t.heatmapCardTitle}
              className="w-full h-auto block select-none transition-transform duration-300 group-hover:scale-[1.008]"
              loading="lazy"
            />

            {/* Subtle Hover Overlay Hint */}
            <div className="absolute bottom-2.5 right-2.5 px-2.5 py-1 rounded-md bg-zinc-950/75 backdrop-blur-sm border border-white/10 text-[10.5px] font-mono text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 shadow-lg pointer-events-none">
              <Maximize2 className="w-3 h-3 text-zinc-400" />
              <span>{isRu ? 'Клик для зума и сдвига' : 'Click to inspect & zoom'}</span>
            </div>
          </div>
        </SpecularCard>

        {/* Fullscreen Pan/Zoom Modal Viewer */}
        {isViewerOpen && (
          <HeatmapViewer
            image={heatmap.image}
            routeName={heatmap.route_name}
            width={heatmap.width}
            height={heatmap.height}
            onClose={() => setIsViewerOpen(false)}
            language={language}
          />
        )}
      </>
    );
  }

  return null;
};
