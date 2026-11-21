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
  herbSearchKey?: string;
  oreSearchKey?: string;
  autoRouteMinutes?: number;
  auctionHouseId?: number | null;
  lootMinValue?: number | null;
}

export interface LootRow {
  item_id: number;
  name: string | null;
  count: number;
  price: number | null;
  value: number | null;
  vendor: number | null;
  quality?: number | null;              // 0 серый, 1 белый, 2 зелёный, 3 синий, 4 фиолетовый, 5 оранжевый
  icon_url?: string | null;             // data:image/jpeg;base64,... (64 px), может не быть
  source?: 'gather' | 'mob' | null;     // откуда: сбор (жила, куст) или с мобов; null — старые записи
}

export interface SaleRow extends LootRow {
  sold_copper: number;          // выручка за всю строку, медь
  sold_at_ms: number | null;    // когда продано
  blocked: boolean;             // предмет в списке «не продавать»
  dropped?: boolean;            // выброшено, а не продано
}

export interface SaleLog {
  ok: boolean;
  error?: string;
  date: string | null;          // день, за который пришёл список (null — все)
  items: SaleRow[];             // от новых к старым
  totalCopper: number;
  blocked: number[];            // item_id из списка «не продавать»
  updatedAtMs: number | null;
}

export interface SaleBlockResult {
  ok: boolean;
  error?: string;
  blocked: number[];
}

export interface LootStatus {
  items: LootRow[];
  earned_copper: number | null;
  earned_complete: boolean;
}

export type LootFilterSource = 'memory' | 'gathered' | 'floor' | 'none' | null;

export interface LootFilterStatus {
  ok: boolean;
  active: boolean;                 // фильтр работает в игре
  thresholdCopper: number | null;  // порог прямо сейчас, медь; null — порога нет / не знаем
  source: LootFilterSource;
  leftThisSession: number;         // сколько предметов оставлено на трупах за сессию
  minValue: number | null;         // «не брать дешевле» из настроек (медь) или null
}

export interface LootMemoryItem {
  itemId: number;
  name: string | null;             // null — показать «Предмет #itemId»
  chance: number;                  // 0..1 — с какой долей трупов падает
  margin: number;                  // 0..1 — точность ± (95%)
  perKill: number;                 // штук в среднем за одно убийство
  priceCopper: number | null;      // цена на аукционе за штуку, null — нет цены
  quality?: number | null;         // редкость: 0 серый, 1 белый, 2 зелёный, 3 синий, 4 фиолетовый, 5 оранжевый; null — не знаем
  iconUrl?: string | null;         // картинка предмета (https://… или data:image/…); null — картинки нет
}

export interface LootMob {
  npcId: number;
  name: string | null;             // имя моба (null — показать «Моб #npcId»)
  zoneId: number | null;
  zone: string | null;             // название зоны по-русски
  kills: number;
  trusted: boolean;                // true — убийств достаточно (20+), память по этому мобу уже решает
  items: LootMemoryItem[];         // до 8 предметов, самые частые первыми
}

export interface LootMemory {
  ok: boolean;
  error?: string;
  updatedAtMs: number | null;      // когда игра сохранила память (null — ещё ни разу)
  mobs: LootMob[];
}

export type AuctionRuleset = 'normal' | 'pvp' | 'rp' | 'rp_pvp' | null;

export interface PriceStatus {
  configured: boolean;
  keys_error: string | null;
  region: string | null;
  house_id: number | null;
  house_source?: 'auto' | 'settings' | null;
  who?: {
    realm: string | null;
    faction: string | null;
    ruleset: AuctionRuleset;
    auto_house_id: number | null;
    note: string;
  } | null;
  houses: { id: number; name: string; ruleset?: AuctionRuleset }[];
  updated_at_ms: number | null;
  loading: boolean;
  error: string | null;
  items: number;
}


export interface BotStatusResponse {
  running: boolean;
  paused?: boolean; // true — бот на паузе, сессия идёт
  chat_running?: boolean;
  ok?: boolean;
  error?: string;
  schedule?: ScheduleStatus | null;
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

export interface AutoRouteStatus {
  status: 'idle' | 'building' | 'ready' | 'error';
  map_id: number | null;
  minutes: number | null;          // заданная длина круга
  started_at_ms: number | null;
  finished_at_ms: number | null;
  typical_s: number;
  route_id: string | null;
  route_name: string | null;
  note: string | null;             // ready — что вошло в круг; error — почему не вышло
  stage: 'grid' | 'spots' | 'paths' | 'check' | null;
  done: number;
  total: number;
  progress: number;                // 0..1, только растёт
  elapsed_s: number | null;
  eta_s: number | null;            // null — «оцениваю…»
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

export interface RoutesChangedDetail {
  reason: 'autoroute' | 'regions';
  route_id?: string;
  map_id?: number;
  name?: string;
}

export interface RouteInfo {
  id: string; // имя файла маршрута (латиница/цифры), передавать обратно как есть
  name: string; // имя, которое ввёл пользователь
  region?: string | null; // название зоны маршрута, как в игре (например «Темные берега»); null — ещё не известно
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

export interface SessionHeatmapResponse {
  ok: boolean;
  status: 'none' | 'building' | 'ready' | 'error';
  // none — карты нет (сессия короче 10 с, без маршрута или без позиции); building — рисуется;
  // ready — готова; error — не получилось (текст в error)
  image?: string;        // data:image/png;base64,... — только при ready
  width?: number;        // размер картинки в пикселях (порядка 1600×1900, бывает и шире, и уже)
  height?: number;
  route_name?: string;   // например «Маршрут 3»
  error?: string;        // при error — понятный текст для пользователя
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
  heatmap_status?: 'none' | 'building' | 'ready' | 'error';
  khorium?: number;
  adamantite?: number;
  fel_iron?: number;
  gold?: number;
  mock_heatmap?: SessionHeatmapResponse;
  timeline?: { time_s: number; kills: number; pace_per_h: number }[];
  loot?: LootRow[];
  earned_copper?: number | null;
  earned_complete?: boolean;
  loot_lost?: number;
}

export interface CalendarRoute {
  route_id: string;
  name: string;
  color_index: number;
}

export interface CalendarDay {
  date: string; // 'YYYY-MM-DD' (локальная дата)
  sessions: number;
  duration_s: number;
  nodes: number;
  routes: CalendarRoute[];
  problem: boolean; // смерть, застревание и т.п.
}

export interface CalendarMonthResponse {
  ok: boolean;
  error?: string;
  year: number;
  month: number; // month 1..12
  days: CalendarDay[]; // только дни, где были сессии
  totals: { duration_s: number; sessions: number; nodes: number };
  routes: CalendarRoute[]; // все маршруты месяца — для легенды
}

export interface PassInfo {
  index: number;
  direction: 'forward' | 'back' | 'loop';
  duration_s: number;
  nodes: number;
  stucks: number;
}

export interface DaySession {
  session_id: string;
  started_at_ms: number;
  stopped_at_ms: number;
  route_id: string | null;
  route_name: string;
  color_index: number;
  summary: SessionSummaryData;
  passes: number;
  passes_info: PassInfo[];
  heatmap: boolean; // есть ли карта у сессии
}

export interface DayResponse {
  ok: boolean;
  error?: string;
  date: string;
  total: SessionSummaryData | null; // сумма за день; null — сессий нет
  sessions: DaySession[]; // по времени начала
}

export type SchedulePhase = 'idle' | 'farm' | 'short_break' | 'long_break' | 'wait_window' | 'day_done' | 'off_day';

export type WeekdayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type ScheduleStyleId = 'careful' | 'normal' | 'heavy' | 'custom';
export type DailySpread = 'low' | 'mid' | 'high';    // «чуть-чуть» / «заметно» / «сильно»

export interface ScheduleWindow {
  start: string;
  end: string;
}

export interface DaySchedule {
  enabled: boolean;                       // false — выходной
  windows: ScheduleWindow[];              // 1–4 окна часов, не пересекаются
  style: ScheduleStyleId;
  dailyHours: number;                     // норма «около N ч», 0.5–12, шаг 0.5
  dailySpread: DailySpread;               // насколько каждый день отличается от нормы
  sessionMinutes: [number, number];       // длина сессии, 10–180 мин
  shortBreakMinutes: [number, number];    // короткий перерыв (стоит на месте), 1–60 мин
  longBreakMinutes: [number, number];     // длинный перерыв, 10–240 мин
  longBreakEvery: [number, number];       // длинный перерыв после каждых N сессий, целые 1–10
  longBreakLogout: boolean;               // на длинный перерыв выходить в меню персонажей
  longBreaks?: boolean;
}

export interface ScheduleSettings {
  enabled: boolean;
  offDayPercent: number;                  // 0–50, случайный выходной поверх выключенных дней
  days: Record<WeekdayKey, DaySchedule>;
}

export interface ScheduleStyle {
  id: 'careful' | 'normal' | 'heavy';
  title: string;
  description: string;
  sessionMinutes: [number, number];
  shortBreakMinutes: [number, number];
  longBreakMinutes: [number, number];
  longBreakEvery: [number, number];
}

export interface SchedulePreviewSegment {
  kind: 'farm' | 'short_break' | 'long_break' | 'wait_window';
  start_ms: number;
  end_ms: number;
  minutes: number;
}

export interface SchedulePreview {
  ok: boolean;
  error?: string;
  date: string;                           // 'YYYY-MM-DD'
  off: boolean;                           // день выключен — segments пустой
  daily_hours: [number, number] | null;   // в каких пределах бот будет играть в этот день (с учётом разброса)
  windows: { start_ms: number; end_ms: number }[];
  segments: SchedulePreviewSegment[];
  sessions: number;
  farm_s: number;
  start_ms: number | null;
  end_ms: number | null;
  timezone: string;                       // например «UTC+03:00»
}

export interface ScheduleToday {
  date: string;        // 'YYYY-MM-DD' (игровой день начинается в 05:00)
  off: boolean;        // сегодня выходной
  budget_s: number;    // норма на сегодня, секунды
  played_s: number;    // уже сыграно сегодня
  sessions: number;
  start_ms: number;    // когда сегодня можно начать (уже со случайным сдвигом)
  end_ms: number;      // когда сегодня закончить
  windows: { start_ms: number; end_ms: number }[];
}

export interface ScheduleStatus {
  ok: boolean;
  error?: string;
  enabled: boolean;
  active: boolean;                 // расписание сейчас крутится (бот запущен)
  phase: SchedulePhase;
  phase_until_ms: number | null;   // до какого момента текущая фаза
  in_world: boolean | null;        // false — персонаж в меню персонажей
  note: string;                    // пояснение от бэкенда, показать мелко
  timezone: string;
  today: ScheduleToday | null;
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
        rename_route?(id: string, new_name: string): Promise<{ ok: boolean; error?: string }>;
        set_active_route?(id: string | null): Promise<{ ok: boolean; error?: string }>;

        // Map Image & Terrain API
        get_map_image?(map_id: number): Promise<MapImageResponse>;
        get_terrain_status?(map_id: number): Promise<{ ok: boolean; error?: string } & Partial<TerrainStatus>>;

        // Heatmap API
        get_session_heatmap?(): Promise<SessionHeatmapResponse>;

        // Calendar & Session History API
        get_calendar_month?(year: number, month: number): Promise<CalendarMonthResponse>;
        get_day?(date: string): Promise<DayResponse>;
        get_session_heatmap_by_id?(session_id: string, pass_index: number | null): Promise<SessionHeatmapResponse>;

        // Schedule API
        get_schedule_status?(): Promise<ScheduleStatus>;
        get_schedule_styles?(): Promise<{ ok: boolean; styles: ScheduleStyle[] }>;
        preview_schedule_day?(configJson: string, weekday: number, seed: number): Promise<SchedulePreview>;

        // Auction & Prices API
        get_price_status?(): Promise<{ ok: boolean } & PriceStatus>;
        refresh_prices?(): Promise<{ ok: boolean } & PriceStatus>;

        // AutoRoute API
        get_autoroute_status?(): Promise<{ ok: boolean } & AutoRouteStatus>;
        start_autoroute?(): Promise<{ ok: boolean; error?: string }>;

        // Loot Filter & Drop Memory API
        get_loot_status?(): Promise<LootFilterStatus>;
        get_loot_memory?(): Promise<LootMemory>;

        // Sales Log API
        get_sale_log?(date?: string): Promise<SaleLog>;   // date — 'YYYY-MM-DD'; без даты — все продажи
        set_sale_block?(item_id: number, blocked: boolean): Promise<SaleBlockResult>;
      };
    };
  }
}

