export interface AppSettings {
  previousTargetKey: string;
}

export interface BotStatusResponse {
  running: boolean;
  chat_running?: boolean;
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
      };
    };
  }
}
