export const ALLOWED_MINIMAP_ZOOM_KEYS = [
  '',
  'PAGEUP',
  'PAGEDOWN',
  'HOME',
  'END',
  'INSERT',
  'DELETE',
  'F6',
  'F7',
  'F8',
  'F9',
  'F10',
  'F11',
  'F12',
] as const;

export type MinimapZoomKey = typeof ALLOWED_MINIMAP_ZOOM_KEYS[number];

export interface AppSettings {
  previousTargetKey: string;
  mode: 'grind' | 'gather';
  minimapZoomInKey: string;
  minimapZoomOutKey: string;
  startStopKey?: string;
  interactKey?: string;
  clearTargetKey?: string;
  pauseKey?: string;
}


export interface BotStatusResponse {
  running: boolean;
  chat_running?: boolean;
  ok?: boolean;
  error?: string;
}

export interface TerrainStatus {
  map_id: number;
  status: 'ready' | 'building' | 'error' | 'none';
  stage: 'tiles' | 'models' | 'grid' | null; // tiles — «Скачиваю карту зоны», models — «Скачиваю деревья и дома», grid — «Строю сетку»
  done: number;            // сделано на этапе (например 120)
  total: number;           // всего на этапе (например 765)
  progress: number;        // 0..1 — общая доля, для полоски
  elapsed_s: number | null;
  eta_s: number | null;    // сколько примерно осталось, с; null — «оцениваю…»
  error: string | null;    // при status='error' — текст для пользователя
  source: string | null;   // при ready — например «Retail 12.1.5.70575», показать мелко
}

// Ответ get_map_image: картинка карты зоны WoW (та же, что карта мира в игре).
// Координаты маршрута (доли 0..1) — это доли ЭТОЙ картинки: точка [x, y] лежит в пикселе (x * width, y * height).
export interface MapImageResponse {
  ok: boolean;
  status: 'ready' | 'loading' | 'error';
  image?: string;   // data:image/jpeg;base64,... — только при ready
  width?: number;   // размер картинки в пикселях, обычно 1002×668
  height?: number;
  source?: string;  // откуда карта, например «Forever 1.60.1.70532» — показать мелко в углу
  error?: string;   // при error — понятный текст для пользователя
}

// Событие wowbot:route-record-stopped (запись остановилась САМА) — в detail теперь есть причина и terrain:
export interface RouteRecordStoppedDetail {
  route: RouteInfo | null; // сохранённый маршрут или null, если не сохранён
  error: string | null;    // почему не сохранён
  reason: string;          // почему запись остановилась: «сменилась карта», «данных аддона нет 30 с», «20 минут»
  terrain?: TerrainStatus | null;
}

// Точка маршрута — доли карты зоны WoW: x, y от 0 до 1, y растёт ВНИЗ (как на карте мира).
export type RoutePoint = [number, number];

export interface RouteInfo {
  id: string; // имя файла маршрута (латиница/цифры), передавать обратно как есть
  name: string; // имя, которое ввёл пользователь
  map_id: number | null; // номер карты игры
  points: number; // сколько точек
  length_s: number; // длина круга в секундах бега
  loop: boolean; // true — круг, false — «туда и обратно»
  created_ms: number;
  active: boolean; // выбран пользователем как основной
  thumb: RoutePoint[]; // упрощённая линия (до 40 точек) для миниатюры
}

export interface RouteRecordStatus {
  recording: boolean;
  name: string | null;
  seconds: number; // сколько идёт запись
  points: RoutePoint[]; // всё, что записано до сих пор (рисовать вживую)
  length_s: number;
  map_id: number | null;
  warning: string | null; // «персонаж стоит», «нет данных аддона» — показывать жёлтым
}

export type RouteMarkKind = 'skip' | 'back' | 'reverse' | 'pause' | 'detour';

export interface RoutePath {
  points: RoutePoint[]; // по каким точкам пройдёт бот
  marks: { index: number; kind: RouteMarkKind }[]; // index — номер точки в points
}

export interface RoutePreview {
  route: RouteInfo;
  aspect: number; // во сколько раз карта шире, чем выше (сейчас 1.5): рисовать x * aspect, y как есть
  points: RoutePoint[]; // записанный маршрут
  paths: RoutePath[]; // 3 примера, как бот пройдёт маршрут (каждый раз по-разному)
}

export interface SessionSummaryData {
  started_at_ms: number;
  stopped_at_ms: number;
  duration_s: number;
  kills: number;
  kills_per_hour: number;
  avg_kill_gap_s: number | null;
  lost: number;
  stop_reason: string;
}

declare global {
  interface Window {
    pywebview?: {
      api: {
        start_bot(): Promise<{ ok: boolean; error?: string }>;
        stop_bot(): Promise<{ ok: boolean; error?: string }>;
        get_status(): Promise<BotStatusResponse>;
        get_last_session(): Promise<SessionSummaryData | null>;
        save_config(configJson: string): Promise<{ ok: boolean; error?: string }>;
        load_config(): Promise<{ ok: boolean; error?: string; config?: any }>;
        start_chat(): Promise<{ ok: boolean; message?: string; error?: string }>;
        stop_chat(): Promise<{ ok: boolean; message?: string; error?: string }>;

        // Routes API
        start_route_record?(name: string): Promise<{ ok: boolean; error?: string }>;
        stop_route_record?(save: boolean): Promise<{ ok: boolean; error?: string; route?: RouteInfo; terrain?: TerrainStatus | null }>;
        get_route_record_status?(): Promise<RouteRecordStatus>;
        list_routes?(): Promise<{ ok: boolean; error?: string; routes: RouteInfo[]; active_id: string | null }>;
        get_route_preview?(id: string): Promise<{ ok: boolean; error?: string; preview?: RoutePreview }>;
        delete_route?(id: string): Promise<{ ok: boolean; error?: string }>;
        set_active_route?(id: string | null): Promise<{ ok: boolean; error?: string }>;

        // Map Image & Terrain API
        get_map_image?(map_id: number): Promise<MapImageResponse>;
        get_terrain_status?(map_id: number): Promise<{ ok: boolean; error?: string } & Partial<TerrainStatus>>;
      };
    };
  }
}
