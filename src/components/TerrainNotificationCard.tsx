import React, { useState, useEffect, useRef } from 'react';
import { TerrainStatus } from '../types';
import { getPywebviewApi } from '../utils/pywebviewBridge';
import { mockGetTerrainStatus } from '../data/mockRoutes';
import { CheckCircle2, AlertCircle, X, Compass, MapPin } from 'lucide-react';

interface TerrainNotificationCardProps {
  routeName: string;
  initialTerrain: TerrainStatus;
  onClose: () => void;
}

export function formatHumanSeconds(sec: number): string {
  if (sec <= 0) return '0 с';
  if (sec < 60) return `${sec} с`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `${m} мин ${s} с` : `${m} мин`;
}

/* =========================================================================
   Stage 1: MapFillVisualizer (Пустая карта с интерактивным заполнением зоны)
   ========================================================================= */
const MapFillVisualizer: React.FC<{ progress: number; done: number; total: number }> = ({
  progress,
  done,
  total,
}) => {
  const fraction = total > 0 ? Math.min(1, Math.max(0, done / total)) : progress;
  const percent = Math.min(100, Math.round(fraction * 100));

  // Interactive mouse scout light & click pings
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [pings, setPings] = useState<{ id: number; x: number; y: number }[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 240;
    const y = ((e.clientY - rect.top) / rect.height) * 85;
    setMousePos({ x, y });
  };

  const handleMouseLeave = () => {
    setMousePos(null);
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 240;
    const y = ((e.clientY - rect.top) / rect.height) * 85;
    const newPing = { id: Date.now(), x, y };
    setPings((prev) => [...prev.slice(-3), newPing]);
    setTimeout(() => {
      setPings((prev) => prev.filter((p) => p.id !== newPing.id));
    }, 1200);
  };

  // Reveal width in SVG coordinate space (0 to 240)
  const revealWidth = Math.max(8, fraction * 240);

  return (
    <div className="w-full py-1 flex flex-col items-center">
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        className="relative w-full max-w-[270px] h-22 bg-[#03060c] border border-cyan-800/60 hover:border-cyan-400/80 rounded-lg overflow-hidden flex items-center justify-center shadow-inner cursor-crosshair transition-colors duration-200 group"
        title="Кликните по карте, чтобы поставить метку разведки"
      >
        <svg viewBox="0 0 240 85" className="w-full h-full select-none">
          <defs>
            {/* Color Gradients for discovered terrain */}
            <linearGradient id="oceanDiscoveredGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#04222f" />
              <stop offset="50%" stopColor="#063d4a" />
              <stop offset="100%" stopColor="#0a4b5c" />
            </linearGradient>

            <linearGradient id="landDiscoveredGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#065f46" />
              <stop offset="50%" stopColor="#047857" />
              <stop offset="100%" stopColor="#064e3b" />
            </linearGradient>

            <linearGradient id="mountainRidgeGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#14b8a6" />
              <stop offset="100%" stopColor="#0f766e" />
            </linearGradient>

            {/* Dynamic Clip Path for Fog of War reveal */}
            <clipPath id="mapRevealClip">
              <rect
                x="0"
                y="0"
                width={revealWidth}
                height="85"
                style={{ transition: 'width 0.4s ease-out' }}
              />
            </clipPath>
          </defs>

          {/* =========================================================
              LAYER 1: Undiscovered Base Map (Fog of War / Wireframe Outline)
             ========================================================= */}
          {/* Subtle grid lines */}
          <g stroke="rgba(6, 182, 212, 0.12)" strokeWidth="0.7" strokeDasharray="3 3">
            <line x1="60" y1="0" x2="60" y2="85" />
            <line x1="120" y1="0" x2="120" y2="85" />
            <line x1="180" y1="0" x2="180" y2="85" />
            <line x1="0" y1="28" x2="240" y2="28" />
            <line x1="0" y1="56" x2="240" y2="56" />
          </g>

          {/* Undiscovered Island / Coastline Contours (Faint dark outline) */}
          <g stroke="#162e3d" strokeWidth="1.2" fill="#040b14">
            {/* Main Landmass */}
            <path d="M 12 70 Q 25 20, 65 30 T 130 20 T 175 40 T 145 75 T 70 80 Z" />
            {/* North-East Isle */}
            <path d="M 175 18 Q 200 12, 222 24 T 215 50 T 180 35 Z" />
            {/* Southwest Reef */}
            <path d="M 18 45 Q 32 40, 36 54 T 22 62 Z" />
          </g>

          {/* Undiscovered Mountains outline */}
          <g stroke="#1a3b4c" strokeWidth="1" fill="none">
            <polygon points="55,42 68,26 81,42" />
            <polygon points="76,44 92,22 108,44" />
            <polygon points="102,45 116,29 130,45" />
          </g>

          {/* =========================================================
              LAYER 2: Discovered Colorful Map (Revealed via mapRevealClip)
             ========================================================= */}
          <g clipPath="url(#mapRevealClip)">
            {/* Discovered Ocean Water Background */}
            <rect x="0" y="0" width="240" height="85" fill="url(#oceanDiscoveredGrad)" opacity="0.35" />

            {/* Discovered Landmass */}
            <path
              d="M 12 70 Q 25 20, 65 30 T 130 20 T 175 40 T 145 75 T 70 80 Z"
              fill="url(#landDiscoveredGrad)"
              stroke="#34d399"
              strokeWidth="1.6"
              style={{ filter: 'drop-shadow(0 0 6px rgba(16,185,129,0.3))' }}
            />

            {/* Discovered North-East Isle */}
            <path
              d="M 175 18 Q 200 12, 222 24 T 215 50 T 180 35 Z"
              fill="url(#landDiscoveredGrad)"
              stroke="#34d399"
              strokeWidth="1.4"
            />

            {/* Southwest Reef */}
            <path
              d="M 18 45 Q 32 40, 36 54 T 22 62 Z"
              fill="url(#landDiscoveredGrad)"
              stroke="#34d399"
              strokeWidth="1.2"
            />

            {/* Flowing River across the continent */}
            <path
              d="M 45 32 Q 75 48, 105 40 T 140 68"
              fill="none"
              stroke="#38bdf8"
              strokeWidth="2.2"
              className="animate-river-flow"
              style={{ filter: 'drop-shadow(0 0 4px #0ea5e9)' }}
            />

            {/* Discovered Mountain Peaks */}
            <g fill="url(#mountainRidgeGrad)" stroke="#5eead4" strokeWidth="1.2">
              <polygon points="55,42 68,26 81,42" />
              <polygon points="76,44 92,22 108,44" />
              <polygon points="102,45 116,29 130,45" />
            </g>

            {/* Roads & Pathways */}
            <path
              d="M 28 65 Q 60 62, 90 52 T 165 48"
              fill="none"
              stroke="#fef08a"
              strokeWidth="1.2"
              strokeDasharray="3 2"
              opacity="0.8"
            />

            {/* Landmark Fort / Castle at (68, 58) */}
            {percent > 30 && (
              <g transform="translate(68, 56)" className="animate-fadeIn">
                <rect x="-4" y="-5" width="8" height="7" fill="#fbbf24" rx="1" />
                <polygon points="-4,-5 -4,-8 -2,-6 0,-8 2,-6 4,-8 4,-5" fill="#f59e0b" />
                <circle cx="0" cy="-1" r="1" fill="#78350f" />
              </g>
            )}

            {/* Landmark Campfire / Waypoint at (122, 38) */}
            {percent > 55 && (
              <g transform="translate(122, 36)" className="animate-fadeIn">
                <circle cx="0" cy="0" r="3.5" fill="#ef4444" className="animate-ping opacity-60" />
                <circle cx="0" cy="0" r="3" fill="#f97316" />
                <circle cx="0" cy="0" r="1.5" fill="#fef08a" />
              </g>
            )}

            {/* Landmark Golden Treasure / Quest X at (168, 48) */}
            {percent > 75 && (
              <g transform="translate(168, 46)" className="animate-fadeIn">
                <text x="-4" y="3" fill="#38bdf8" fontSize="9" fontWeight="bold" fontFamily="sans-serif">
                  ✕
                </text>
              </g>
            )}
          </g>

          {/* =========================================================
              LAYER 3: Animated Discovery Frontier Wave
             ========================================================= */}
          {revealWidth > 12 && revealWidth < 235 && (
            <g style={{ transition: 'transform 0.4s ease-out', transform: `translateX(${revealWidth}px)` }}>
              {/* Vertical soft glowing discovery wave */}
              <line
                x1="0"
                y1="0"
                x2="0"
                y2="85"
                stroke="#67e8f9"
                strokeWidth="2.5"
                className="animate-discovery-glow"
                style={{ filter: 'drop-shadow(0 0 8px #22d3ee)' }}
              />
              <circle cx="0" cy="22" r="3" fill="#a5f3fc" />
              <circle cx="0" cy="54" r="2.5" fill="#a5f3fc" />
            </g>
          )}

          {/* Compass Rose in top-right corner */}
          <g transform="translate(222, 16)" className="opacity-70 group-hover:opacity-100 transition-opacity">
            <circle cx="0" cy="0" r="10" fill="#040b14" stroke="#0891b2" strokeWidth="0.8" />
            <polygon points="0,-8 3,-1 0,1 -3,-1" fill="#38bdf8" />
            <polygon points="0,8 3,1 0,-1 -3,1" fill="#0369a1" />
            <text x="-2.5" y="-10" fill="#38bdf8" fontSize="6" fontFamily="monospace" fontWeight="bold">
              N
            </text>
          </g>

          {/* Interactive Scout Lantern / Cursor Spotlight */}
          {mousePos && (
            <g transform={`translate(${mousePos.x}, ${mousePos.y})`} className="pointer-events-none">
              <circle cx="0" cy="0" r="22" fill="rgba(6, 182, 212, 0.12)" />
              <circle cx="0" cy="0" r="10" fill="none" stroke="#22d3ee" strokeWidth="0.8" strokeDasharray="2 2" />
              <circle cx="0" cy="0" r="1.5" fill="#ffffff" />
            </g>
          )}

          {/* Interactive User Click Pings */}
          {pings.map((p) => (
            <g key={p.id} transform={`translate(${p.x}, ${p.y})`} className="pointer-events-none">
              <circle cx="0" cy="0" r="8" fill="none" stroke="#34d399" strokeWidth="1.8" className="animate-ping" />
              <circle cx="0" cy="0" r="2" fill="#6ee7b7" />
            </g>
          ))}
        </svg>

        {/* HUD Overlay Info */}
        <div className="absolute top-1 left-2 text-[8.5px] font-mono text-cyan-400/90 select-none pointer-events-none flex items-center gap-1">
          <Compass className="w-2.5 h-2.5 text-cyan-300" />
          <span>ОТКРЫТИЕ КАРТЫ: <strong className="text-white font-bold">{percent}%</strong></span>
        </div>

        <div className="absolute bottom-1 right-2 text-[8px] font-mono text-emerald-400/80 select-none pointer-events-none">
          ЗЕМЛИ ЭКСПЕДИЦИИ
        </div>
      </div>
    </div>
  );
};

/* =========================================================================
   Stage 2: TreeFillVisualizer (Деревья и дома - Плавная интерактивная заливка БЕЗ лазера)
   ========================================================================= */
const TreeFillVisualizer: React.FC<{ progress: number; done: number; total: number }> = ({
  progress,
  done,
  total,
}) => {
  const fraction = total > 0 ? Math.min(1, Math.max(0, done / total)) : progress;
  const fillPercent = Math.min(100, Math.max(3, Math.round(fraction * 100)));
  const fillY = 90 - (90 * fillPercent) / 100;

  // Interactive hover & click bursts of leaves
  const [clickCount, setClickCount] = useState(0);

  return (
    <div className="w-full py-1 flex flex-col items-center">
      <div
        onClick={() => setClickCount((c) => c + 1)}
        className="relative w-full max-w-[270px] h-22 bg-[#03080c] border border-emerald-950/80 hover:border-emerald-500/70 rounded-lg overflow-hidden flex items-center justify-center shadow-inner cursor-pointer transition-colors duration-200 group"
        title="Кликните по лесу, чтобы вызвать шелест листвы"
      >
        {/* Soft atmospheric forest background */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              'radial-gradient(circle, rgba(16,185,129,0.35) 1px, transparent 1px)',
            backgroundSize: '12px 12px',
          }}
        />

        {/* Rising glowing organic spore / leaf particles */}
        <div className="absolute bottom-3 left-14 w-1.5 h-1.5 rounded-full bg-emerald-300/80 animate-spore-1 pointer-events-none" />
        <div className="absolute bottom-4 left-20 w-1.5 h-1.5 rounded-full bg-teal-300/80 animate-spore-2 pointer-events-none" />
        <div className="absolute bottom-2 left-28 w-1.5 h-1.5 rounded-full bg-cyan-300/80 animate-spore-3 pointer-events-none" />
        <div className="absolute bottom-4 right-16 w-1.5 h-1.5 rounded-full bg-emerald-400/80 animate-spore-1 pointer-events-none" />

        {/* SVG Container with Tree and Cottage silhouettes */}
        <svg viewBox="0 0 160 90" className="w-full h-full max-w-[230px] overflow-visible">
          <defs>
            {/* Rich emerald-teal-cyan fluid gradient */}
            <linearGradient id="richTreeFluidGrad" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#047857" />
              <stop offset="40%" stopColor="#059669" />
              <stop offset="75%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#34d399" />
            </linearGradient>

            <linearGradient id="richHouseFluidGrad" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#0f766e" />
              <stop offset="50%" stopColor="#0d9488" />
              <stop offset="100%" stopColor="#2dd4bf" />
            </linearGradient>

            {/* Smooth liquid clip-path that fills from bottom up */}
            <clipPath id="naturalTreeClip">
              <rect
                x="0"
                y={fillY}
                width="160"
                height="90"
                style={{ transition: 'y 0.4s ease-out, height 0.4s ease-out' }}
              />
            </clipPath>
          </defs>

          {/* 1. Wireframe Outlines (Empty / Unbuilt State) */}
          <g stroke="rgba(16, 185, 129, 0.22)" strokeWidth="1.2" fill="rgba(4, 47, 46, 0.2)">
            {/* Tree Trunk */}
            <rect x="53" y="66" width="8" height="18" rx="1" />
            {/* Tree Foliage (Layered pine tiers) */}
            <path d="M57 10 L30 42 L42 42 L25 68 L52 68 L52 84 L62 84 L62 68 L89 68 L72 42 L84 42 Z" />

            {/* Small Cottage next to tree */}
            <polygon points="108,44 140,44 124,28" />
            <rect x="112" y="44" width="24" height="24" rx="1" />
            <rect x="120" y="54" width="8" height="14" rx="0.5" />
          </g>

          {/* 2. Fluid Filled & Glowing Silhouettes (NO LASER - purely smooth vibrant filling) */}
          <g clipPath="url(#naturalTreeClip)" className="animate-tree-glow">
            {/* Tree Trunk */}
            <rect x="53" y="66" width="8" height="18" rx="1" fill="#065f46" />
            {/* Foliage */}
            <path
              d="M57 10 L30 42 L42 42 L25 68 L52 68 L52 84 L62 84 L62 68 L89 68 L72 42 L84 42 Z"
              fill="url(#richTreeFluidGrad)"
            />

            {/* House */}
            <polygon points="108,44 140,44 124,28" fill="url(#richHouseFluidGrad)" />
            <rect x="112" y="44" width="24" height="24" rx="1" fill="url(#richHouseFluidGrad)" />
            <rect x="120" y="54" width="8" height="14" rx="0.5" fill="#042f2e" />
          </g>

          {/* Ground baseline */}
          <line
            x1="15"
            y1="84"
            x2="148"
            y2="84"
            stroke="rgba(16, 185, 129, 0.4)"
            strokeWidth="1.2"
          />
        </svg>

        {/* HUD Info */}
        <div className="absolute top-1 left-2 text-[8.5px] font-mono text-emerald-400/90 select-none pointer-events-none">
          ОБЪЕКТЫ ЗОНЫ: <strong className="text-white font-bold">{fillPercent}%</strong>
        </div>

        <div className="absolute top-1 right-2 text-[8px] font-mono text-emerald-400/70 tracking-wider select-none pointer-events-none">
          ДЕРЕВЬЯ И СТРОЕНИЯ
        </div>
      </div>
    </div>
  );
};

/* =========================================================================
   Stage 3: MeshLaserVisualizer (Сетка проходимости / Полигональный Навмеш)
   ========================================================================= */
const MeshLaserVisualizer: React.FC<{ progress: number; done: number; total: number }> = ({
  progress,
  done,
  total,
}) => {
  const fraction = total > 0 ? Math.min(1, Math.max(0, done / total)) : progress;
  const percent = Math.min(100, Math.round(fraction * 100));

  return (
    <div className="w-full py-1 flex flex-col items-center">
      <div className="relative w-full max-w-[270px] h-22 bg-[#040810] border border-cyan-900/60 rounded-lg overflow-hidden flex items-center justify-center shadow-inner">
        {/* Isometric 3D Polygon Wireframe Mesh */}
        <svg viewBox="0 0 200 75" className="w-full h-full max-w-[240px]">
          <defs>
            <linearGradient id="meshPolyGradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="rgba(6,182,212,0.38)" />
              <stop offset="100%" stopColor="rgba(16,185,129,0.18)" />
            </linearGradient>
          </defs>

          {/* Base Triangles */}
          <polygon
            points="25,50 65,24 105,50"
            fill={percent > 15 ? 'url(#meshPolyGradient)' : 'rgba(6,182,212,0.05)'}
            stroke="#0891b2"
            strokeWidth="1"
          />
          <polygon
            points="65,24 105,50 145,24"
            fill={percent > 35 ? 'url(#meshPolyGradient)' : 'rgba(6,182,212,0.05)'}
            stroke="#0891b2"
            strokeWidth="1"
          />
          <polygon
            points="105,50 145,24 185,50"
            fill={percent > 55 ? 'url(#meshPolyGradient)' : 'rgba(6,182,212,0.05)'}
            stroke="#0891b2"
            strokeWidth="1"
          />
          <polygon
            points="25,50 65,65 105,50"
            fill={percent > 70 ? 'url(#meshPolyGradient)' : 'rgba(6,182,212,0.05)'}
            stroke="#0891b2"
            strokeWidth="1"
          />
          <polygon
            points="105,50 145,65 185,50"
            fill={percent > 85 ? 'url(#meshPolyGradient)' : 'rgba(6,182,212,0.05)'}
            stroke="#0891b2"
            strokeWidth="1"
          />

          {/* Weaving Laser Line across the top contour */}
          <path
            d="M25,50 L65,24 L105,50 L145,24 L185,50 L145,65 L105,50 L65,65 Z"
            fill="none"
            stroke="#22d3ee"
            strokeWidth="1.8"
            className="animate-mesh-weave"
            style={{ filter: 'drop-shadow(0 0 6px #06b6d4)' }}
          />

          {/* Vertex Nodes */}
          {[
            [25, 50],
            [65, 24],
            [105, 50],
            [145, 24],
            [185, 50],
            [65, 65],
            [145, 65],
          ].map(([nx, ny], i) => (
            <g key={i}>
              <circle
                cx={nx}
                cy={ny}
                r="3"
                fill="#06b6d4"
                className="animate-pulse"
                style={{ filter: 'drop-shadow(0 0 4px #22d3ee)' }}
              />
              <circle cx={nx} cy={ny} r="1.2" fill="#ffffff" />
            </g>
          ))}
        </svg>

        <div className="absolute top-1 left-2 text-[8px] font-mono text-cyan-400/80 tracking-wider select-none pointer-events-none">
          НАВМЕШ ТРИАНГУЛЯЦИЯ: <strong className="text-white font-bold">{percent}%</strong>
        </div>
      </div>
    </div>
  );
};

/* =========================================================================
   Main Component: TerrainNotificationCard
   ========================================================================= */
export const TerrainNotificationCard: React.FC<TerrainNotificationCardProps> = ({
  routeName,
  initialTerrain,
  onClose,
}) => {
  const [terrain, setTerrain] = useState<TerrainStatus>(initialTerrain);

  // Poll get_terrain_status(map_id) every 1s while card is open and building
  useEffect(() => {
    if (terrain.status === 'ready' || terrain.status === 'error') {
      return;
    }

    let isMounted = true;

    const poll = async () => {
      try {
        let res: { ok: boolean; error?: string } & Partial<TerrainStatus>;
        const api = await getPywebviewApi();
        if (api?.get_terrain_status) {
          res = await api.get_terrain_status(terrain.map_id);
        } else {
          res = await mockGetTerrainStatus(terrain.map_id);
        }

        if (!isMounted) return;

        if (res && res.status) {
          setTerrain((prev) => ({
            ...prev,
            ...res,
            status: res.status ?? prev.status,
          }));
        }
      } catch (err) {
        console.warn('Error polling terrain status:', err);
      }
    };

    const interval = window.setInterval(poll, 1000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [terrain.map_id, terrain.status]);

  // Listen for window event "wowbot:terrain-status"
  useEffect(() => {
    const handleTerrainEvent = (e: any) => {
      const detail: TerrainStatus = e?.detail;
      if (detail && detail.map_id === terrain.map_id) {
        setTerrain(detail);
      }
    };

    window.addEventListener('wowbot:terrain-status', handleTerrainEvent);
    return () => {
      window.removeEventListener('wowbot:terrain-status', handleTerrainEvent);
    };
  }, [terrain.map_id]);

  // If ready: automatically close after 4 seconds
  useEffect(() => {
    if (terrain.status === 'ready') {
      const timer = setTimeout(() => {
        onClose();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [terrain.status, onClose]);

  const isReady = terrain.status === 'ready';
  const isError = terrain.status === 'error';

  const stageBadge =
    terrain.stage === 'tiles'
      ? 'КАРТА ЗОНЫ'
      : terrain.stage === 'models'
      ? 'ОБЪЕКТЫ'
      : terrain.stage === 'grid'
      ? 'НАВМЕШ'
      : 'СЕТКА';

  const hasCount = terrain.total > 0;
  const countText = hasCount ? `${terrain.done} / ${terrain.total}` : '';

  const etaText =
    terrain.eta_s != null ? `Осталось ≈ ${formatHumanSeconds(terrain.eta_s)}` : 'Осталось ≈ оцениваю…';
  const elapsedText = terrain.elapsed_s != null ? `прошло ${formatHumanSeconds(terrain.elapsed_s)}` : '';

  const progressPercent = Math.max(0, Math.min(100, Math.round((terrain.progress || 0) * 100)));

  return (
    <div
      className={`w-80 sm:w-86 p-3 rounded-xl border text-xs font-mono shadow-[0_4px_30px_rgba(0,0,0,0.95)] pointer-events-auto select-none transition-all duration-300 animate-fadeIn relative ${
        isReady
          ? 'bg-[#061810] border-emerald-500/70 text-emerald-200 shadow-[0_0_20px_rgba(16,185,129,0.25)]'
          : isError
          ? 'bg-[#1a0a0f] border-rose-500/70 text-rose-200 shadow-[0_0_20px_rgba(244,63,94,0.25)]'
          : 'bg-[#060a12] border-cyan-500/70 text-zinc-200 shadow-[0_0_22px_rgba(6,182,212,0.25)]'
      }`}
    >
      {/* Top Header with Route Name and Close Button */}
      <div className="flex items-center justify-between gap-1.5 pb-1 border-b border-zinc-800/60">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {isReady ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          ) : isError ? (
            <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          ) : (
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
            </span>
          )}

          <h4 className="text-[11px] font-black tracking-wide leading-tight text-white truncate">
            {isReady
              ? `Готово: местность для «${routeName}»`
              : isError
              ? 'Ошибка сборки местности'
              : `Сборка местности · «${routeName}»`}
          </h4>
        </div>

        {/* Close Button (X) */}
        <button
          type="button"
          onClick={onClose}
          className="text-zinc-400 hover:text-white p-0.5 rounded hover:bg-white/10 transition-colors cursor-pointer shrink-0"
          title="Закрыть уведомление"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Ready State */}
      {isReady && (
        <div className="py-2.5 space-y-1">
          <p className="text-[11px] text-emerald-300 font-bold">Сетка местности зоны готова</p>
          {terrain.source && (
            <p className="text-[9px] text-emerald-400/80">Источник: {terrain.source}</p>
          )}
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="py-2 space-y-1">
          <p className="text-[10.5px] text-rose-300 font-bold leading-tight">
            {terrain.error || 'Не удалось построить сетку местности'}
          </p>
          <p className="text-[9px] text-zinc-400 leading-tight">
            Бот будет ходить без сетки; панель попробует снова при следующей записи.
          </p>
        </div>
      )}

      {/* Active Building State */}
      {!isReady && !isError && (
        <div className="pt-2 space-y-2">
          {/* Subheader: Stage badge + Count + Percent */}
          <div className="flex items-center justify-between text-[10px]">
            <span className="px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-800/60 text-cyan-300 font-black tracking-widest text-[9px]">
              {stageBadge}
            </span>
            <div className="flex items-center gap-2 text-zinc-400">
              {countText && <span className="font-semibold text-zinc-300">{countText}</span>}
              <span className="font-bold text-cyan-400">{progressPercent}%</span>
            </div>
          </div>

          {/* Dynamic Interactive Stage Visualizer */}
          {terrain.stage === 'tiles' ? (
            <MapFillVisualizer
              progress={terrain.progress}
              done={terrain.done}
              total={terrain.total}
            />
          ) : terrain.stage === 'grid' ? (
            <MeshLaserVisualizer
              progress={terrain.progress}
              done={terrain.done}
              total={terrain.total}
            />
          ) : (
            /* Default: 'models' (Trees and houses with organic liquid fill, no laser) */
            <TreeFillVisualizer
              progress={terrain.progress}
              done={terrain.done}
              total={terrain.total}
            />
          )}

          {/* Bottom Timer Line: Remaining & Elapsed */}
          <div className="flex items-center justify-between text-[9.5px] text-zinc-400 pt-1 border-t border-zinc-850">
            <span className="text-zinc-200 font-medium">{etaText}</span>
            {elapsedText && <span className="text-zinc-500 text-[9px]">{elapsedText}</span>}
          </div>
        </div>
      )}
    </div>
  );
};
