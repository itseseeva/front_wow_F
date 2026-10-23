import { RouteInfo, RoutePoint, RoutePreview, RouteRecordStatus, RoutePath } from '../types';

// Generate points along an ellipse
const generateOvalPoints = (count: number, cx = 0.5, cy = 0.5, rx = 0.35, ry = 0.25): RoutePoint[] => {
  const pts: RoutePoint[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * 2 * Math.PI;
    // Add small organic jitter
    const noise = Math.sin(i * 1.5) * 0.015;
    const x = Math.max(0.05, Math.min(0.95, cx + (rx + noise) * Math.cos(angle)));
    const y = Math.max(0.05, Math.min(0.95, cy + (ry + noise) * Math.sin(angle)));
    pts.push([Number(x.toFixed(4)), Number(y.toFixed(4))]);
  }
  return pts;
};

// Generate points along a linear back-and-forth path
const generateLinearPoints = (count: number): RoutePoint[] => {
  const pts: RoutePoint[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const x = 0.15 + t * 0.7 + Math.sin(t * Math.PI * 3) * 0.04;
    const y = 0.3 + t * 0.4 + Math.cos(t * Math.PI * 2) * 0.06;
    pts.push([Number(x.toFixed(4)), Number(y.toFixed(4))]);
  }
  return pts;
};

const INITIAL_MURLOC_POINTS = generateOvalPoints(52);
const INITIAL_DUROTAR_POINTS = generateLinearPoints(38);

export const MOCK_ROUTES: RouteInfo[] = [
  {
    id: 'murloc_circle',
    name: 'Берег мурлоков (Круг)',
    map_id: 1436,
    points: 52,
    length_s: 175,
    loop: true,
    created_ms: Date.now() - 3600000 * 18,
    active: true,
    thumb: INITIAL_MURLOC_POINTS.filter((_, idx) => idx % 2 === 0).slice(0, 36),
  },
  {
    id: 'durotar_canyon',
    name: 'Дуротар - Каньон (Линейный)',
    map_id: 1411,
    points: 38,
    length_s: 110,
    loop: false,
    created_ms: Date.now() - 3600000 * 72,
    active: false,
    thumb: INITIAL_DUROTAR_POINTS.filter((_, idx) => idx % 2 === 0).slice(0, 30),
  },
];

// Persistent state in memory/localStorage for browser preview
let storedRoutes: RouteInfo[] = (() => {
  const saved = localStorage.getItem('wowbot_routes_v2');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {}
  }
  return [...MOCK_ROUTES];
})();

const saveStoredRoutes = () => {
  localStorage.setItem('wowbot_routes_v2', JSON.stringify(storedRoutes));
};

let activeRecordSession: {
  name: string;
  startedAt: number;
  points: RoutePoint[];
} | null = null;

// Mock list_routes()
export const mockListRoutes = async (): Promise<{ ok: boolean; error?: string; routes: RouteInfo[]; active_id: string | null }> => {
  const activeRoute = storedRoutes.find(r => r.active);
  return {
    ok: true,
    routes: [...storedRoutes],
    active_id: activeRoute ? activeRoute.id : null,
  };
};

// Mock set_active_route(id)
export const mockSetActiveRoute = async (id: string | null): Promise<{ ok: boolean; error?: string }> => {
  storedRoutes = storedRoutes.map(r => ({
    ...r,
    active: id === null ? false : r.id === id,
  }));
  saveStoredRoutes();
  return { ok: true };
};

// Mock delete_route(id)
export const mockDeleteRoute = async (id: string): Promise<{ ok: boolean; error?: string }> => {
  storedRoutes = storedRoutes.filter(r => r.id !== id);
  saveStoredRoutes();
  return { ok: true };
};

// Mock start_route_record(name)
export const mockStartRouteRecord = async (name: string): Promise<{ ok: boolean; error?: string }> => {
  activeRecordSession = {
    name: name || 'Маршрут',
    startedAt: Date.now(),
    points: [[0.2, 0.45]],
  };
  return { ok: true };
};

// Mock get_route_record_status()
export const mockGetRouteRecordStatus = async (): Promise<RouteRecordStatus> => {
  if (!activeRecordSession) {
    return {
      recording: false,
      name: null,
      seconds: 0,
      points: [],
      length_s: 0,
      map_id: null,
      warning: null,
    };
  }

  const elapsedSec = Math.floor((Date.now() - activeRecordSession.startedAt) / 1000);

  // Add a point along a circular trajectory every second
  const angle = (elapsedSec / 45) * 2 * Math.PI;
  const x = 0.5 + 0.32 * Math.cos(angle);
  const y = 0.5 + 0.24 * Math.sin(angle);
  activeRecordSession.points.push([Number(x.toFixed(4)), Number(y.toFixed(4))]);

  return {
    recording: true,
    name: activeRecordSession.name,
    seconds: elapsedSec,
    points: [...activeRecordSession.points],
    length_s: elapsedSec,
    map_id: 1436,
    warning: elapsedSec > 2 && elapsedSec < 6 ? 'персонаж стоит' : null,
  };
};

// Mock stop_route_record(save)
export const mockStopRouteRecord = async (save: boolean) => {
  if (!activeRecordSession) {
    return { ok: false, error: 'Запись не была запущена' };
  }

  const session = activeRecordSession;
  activeRecordSession = null;

  if (!save) {
    return { ok: true };
  }

  const newId = `route_${Date.now()}`;
  const points = session.points.length > 5 ? session.points : INITIAL_MURLOC_POINTS;
  const newRoute: RouteInfo = {
    id: newId,
    name: session.name,
    map_id: 1436,
    points: points.length,
    length_s: Math.max(25, points.length * 3),
    loop: true,
    created_ms: Date.now(),
    active: true,
    thumb: points.filter((_, idx) => idx % Math.max(1, Math.floor(points.length / 35))),
  };

  storedRoutes = storedRoutes.map(r => ({ ...r, active: false }));
  storedRoutes.unshift(newRoute);
  saveStoredRoutes();

  return { ok: true, route: newRoute };
};

// Mock get_route_preview(id) with 3 paths and marks
export const mockGetRoutePreview = async (id: string): Promise<{ ok: boolean; error?: string; preview?: RoutePreview }> => {
  const route = storedRoutes.find(r => r.id === id) || storedRoutes[0] || MOCK_ROUTES[0];
  const basePoints = route.loop ? INITIAL_MURLOC_POINTS : INITIAL_DUROTAR_POINTS;

  // Path 1: Default path with skip and pause
  const path1Points = basePoints.map(([x, y]) => [x + (Math.random() - 0.5) * 0.01, y + (Math.random() - 0.5) * 0.01] as RoutePoint);
  const path1: RoutePath = {
    points: path1Points,
    marks: [
      { index: Math.floor(path1Points.length * 0.25), kind: 'skip' },
      { index: Math.floor(path1Points.length * 0.65), kind: 'pause' },
    ],
  };

  // Path 2: Detour and back
  const path2Points = basePoints.map(([x, y]) => [x + (Math.random() - 0.5) * 0.018, y + (Math.random() - 0.5) * 0.018] as RoutePoint);
  const path2: RoutePath = {
    points: path2Points,
    marks: [
      { index: Math.floor(path2Points.length * 0.35), kind: 'detour' },
      { index: Math.floor(path2Points.length * 0.75), kind: 'back' },
    ],
  };

  // Path 3: Reverse
  const path3Points = basePoints.map(([x, y]) => [x + (Math.random() - 0.5) * 0.015, y + (Math.random() - 0.5) * 0.015] as RoutePoint);
  const path3: RoutePath = {
    points: path3Points,
    marks: [
      { index: Math.floor(path3Points.length * 0.5), kind: 'reverse' },
    ],
  };

  return {
    ok: true,
    preview: {
      route,
      aspect: 1.5,
      points: basePoints,
      paths: [path1, path2, path3],
    },
  };
};
