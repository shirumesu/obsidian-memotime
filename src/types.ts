export interface Session {
  id: string;           // UUID v4 — merge deduplication key
  file: string;         // vault-relative path e.g. "Projects/design.md"
  start: number;        // Unix timestamp (seconds)
  end: number;          // Unix timestamp (seconds) — last heartbeat
  duration: number;     // ACTIVE seconds (sum of heartbeat gaps, capped at timeout). NOT end-start.
  mode: 'typing' | 'cursor';
  word_delta: number;   // net word count change (can be negative)
}

export interface RawDayLog {
  version: 1;
  date: string;           // "YYYY-MM-DD"
  sessions: Session[];
}

export interface FileAggregate {
  duration: number;
  word_delta: number;
  sessions: number;
}

export interface MonthAggregate {
  version: 1;
  month: string;          // "YYYY-MM"
  files: Record<string, FileAggregate>;
  daily: Record<string, { duration: number; word_delta: number }>;
}

export interface ActiveSession {
  id: string;
  file: string;
  start: number;
  lastActivity: number;
  wordCountAtStart: number;
  accumulatedDuration: number;
  lastHeartbeat: number;
  mode: 'typing' | 'cursor';
}

export type SyncMode = 'off' | 'file' | 'api';
export type ActivityMode = 'typing' | 'cursor';
export type TimeoutThreshold = 30 | 60 | 120 | 300;
export type TimeRange = 'today' | 'week' | 'all';

export interface MemoTimeSettings {
  language: 'auto' | 'zh' | 'en';
  activityMode: ActivityMode;
  timeoutThreshold: TimeoutThreshold;
  trackingEnabled: boolean;
  statusBarMetrics: {
    session: boolean;
    file: boolean;
    today: boolean;
    folder: boolean;
    vault_all: boolean;
  };
  metricSeparator: string;
  mainSeparator: string;
  showFileExplorerLabels: boolean;
  fileExplorerTimeRange: TimeRange;
  syncMode: SyncMode;
  dataPath: string;
  syncOnOpen: boolean;
  syncOnClose: boolean;
  syncScheduled: boolean;
  syncScheduledTime: string;
  syncConfirm: boolean;
  dashboardDefaultTab: 'today' | 'week' | 'history';
  rawRetentionDays: 30 | 60 | 90 | -1;
}

export const DEFAULT_SETTINGS: MemoTimeSettings = {
  language: 'auto',
  activityMode: 'typing',
  timeoutThreshold: 120,
  trackingEnabled: true,
  statusBarMetrics: {
    session: false,
    file: false,
    today: true,
    folder: false,
    vault_all: true,
  },
  metricSeparator: ' · ',
  mainSeparator: ' / ',
  showFileExplorerLabels: false,
  fileExplorerTimeRange: 'today',
  syncMode: 'off',
  dataPath: '.memotime',
  syncOnOpen: false,
  syncOnClose: false,
  syncScheduled: false,
  syncScheduledTime: '03:00',
  syncConfirm: true,
  dashboardDefaultTab: 'today',
  rawRetentionDays: 30,
};
