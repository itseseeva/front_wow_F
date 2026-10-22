export interface SkillConfigItem {
  slot: string;
  name?: string;
  combo: string;
  cooldown: number;
  steps: string[];
  lastUsed?: number;
  icon?: string;
}

export interface AppSettings {
  previousTargetKey: string;
}

export type FSMState = 'SEARCH' | 'COMBAT' | 'LOOT' | 'ESCAPE' | 'IDLE';

export interface TargetInfo {
  found: boolean;
  hpPercent: number;
  offsetX: number;
  offsetY: number;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  level: 'info' | 'warn' | 'error' | 'success';
  source?: 'fsm' | 'input' | 'vision' | 'test';
}

export interface RoadmapTask {
  id: string;
  title: string;
  practice: string;
  completed: boolean;
}

export interface RoadmapStage {
  id: string;
  title: string;
  timeframe: string;
  tasks: RoadmapTask[];
}

export interface VisionSettings {
  targetHpOffsetX: number;
  targetHpOffsetY: number;
  targetHpWidth: number;
  targetHpHeight: number;
  maxTargetHpWidth: number;
  redLower1: [number, number, number];
  redUpper1: [number, number, number];
  redLower2: [number, number, number];
  redUpper2: [number, number, number];
  yellowLower: [number, number, number];
  yellowUpper: [number, number, number];
}

export type FarmMode = 'pull' | 'normal';

export interface BotStatusResponse {
  running: boolean;
  chat_running?: boolean;
  farm_mode?: FarmMode;
  shutdown_mode: 'duration' | 'clock' | null;
  shutdown_minutes: number | null;
  shutdown_deadline_ms: number | null;
  ok?: boolean;
  error?: string;
}

export interface SessionSummaryData {
  started_at_ms: number;
  stopped_at_ms: number;
  duration_s: number;
  kills: number;
  kills_per_hour: number;
  avg_kill_gap_s: number | null;
  lost: number;
  stop_reason: 'user' | 'timer' | string;
}

export interface CaptureSkillsSlot {
  key: string;
  row?: 'top' | 'bottom' | string;
  icon_png?: string | null;
  brightness: number;
  ok: boolean;
  status: string;
}

export interface CaptureSkillsResponse {
  ok: boolean;
  message: string;
  preview_png?: string | null;
  slots?: CaptureSkillsSlot[];
  error?: string;
}

declare global {
  interface Window {
    pywebview?: {
      api: {
        start_bot(): Promise<{ ok: boolean; error?: string }>;
        stop_bot(): Promise<{ ok: boolean; error?: string }>;
        get_status?(): Promise<BotStatusResponse>;
        get_farm_mode?(): Promise<{ ok: boolean; farm_mode?: FarmMode; error?: string }>;
        set_farm_mode?(mode: FarmMode): Promise<{
          ok: boolean;
          farm_mode?: FarmMode;
          applies?: 'now' | 'next_start';
          message?: string;
          error?: string;
        }>;
        set_shutdown_duration?(minutes: number): Promise<BotStatusResponse>;
        set_shutdown_timer?(deadlineMs: number): Promise<BotStatusResponse>;
        cancel_shutdown_timer?(): Promise<BotStatusResponse>;
        get_last_session?(): Promise<SessionSummaryData | null>;
        capture_skills?(): Promise<CaptureSkillsResponse>;
        start_chat?(): Promise<{ ok: boolean; message?: string; error?: string }>;
        stop_chat?(): Promise<{ ok: boolean; message?: string; error?: string }>;
        test_rotation(): Promise<{ ok: boolean; error?: string; chains_tested?: number }>;
        save_config(configJson: string): Promise<{ ok: boolean; error?: string }>;
        save_icon(slot: string, dataUrl: string): Promise<{ ok: boolean; error?: string; path?: string }>;
        load_config(): Promise<{ ok: boolean; error?: string; config?: any }>;
      };
    };
  }
}
