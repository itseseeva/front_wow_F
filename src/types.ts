export interface AppSettings {
  previousTargetKey: string;
}

export interface BotStatusResponse {
  running: boolean;
  chat_running?: boolean;
  ok?: boolean;
  error?: string;
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
        stop_route_record?(save: boolean): Promise<{ ok: boolean; error?: string; route?: RouteInfo }>;
        get_route_record_status?(): Promise<RouteRecordStatus>;
        list_routes?(): Promise<{ ok: boolean; error?: string; routes: RouteInfo[]; active_id: string | null }>;
        get_route_preview?(id: string): Promise<{ ok: boolean; error?: string; preview?: RoutePreview }>;
        delete_route?(id: string): Promise<{ ok: boolean; error?: string }>;
        set_active_route?(id: string | null): Promise<{ ok: boolean; error?: string }>;
      };
    };
  }
}
