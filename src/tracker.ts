import { Session, ActiveSession, MemoTimeSettings } from './types';

type FlushCallback = (session: Session, date: string) => Promise<void>;

function generateId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export class Tracker {
  private active: ActiveSession | null = null;
  private settings: MemoTimeSettings;
  private onFlush: FlushCallback;

  constructor(settings: MemoTimeSettings, onFlush: FlushCallback) {
    this.settings = settings;
    this.onFlush = onFlush;
  }

  getActiveSession(): ActiveSession | null {
    return this.active;
  }

  heartbeat(file: string, timestamp: number, wordCount: number): void {
    if (!this.settings.trackingEnabled) return;

    if (!this.active) {
      // Start new session
      this.active = {
        id: generateId(),
        file,
        start: timestamp,
        lastActivity: timestamp,
        lastHeartbeat: timestamp,
        wordCountAtStart: wordCount,
        accumulatedDuration: 0,
        mode: this.settings.activityMode,
      };
      return;
    }

    // Heartbeat for a different file — ignore (caller should call switchFile first)
    if (this.active.file !== file) return;

    const gap = timestamp - this.active.lastHeartbeat;
    const cappedGap = Math.min(gap, this.settings.timeoutThreshold);
    this.active.accumulatedDuration += cappedGap;
    this.active.lastHeartbeat = timestamp;
    this.active.lastActivity = timestamp;
  }

  async switchFile(newFile: string, timestamp: number, wordCount: number): Promise<void> {
    await this.flushCurrent(timestamp, wordCount);
    if (newFile && this.settings.trackingEnabled) {
      this.active = {
        id: generateId(),
        file: newFile,
        start: timestamp,
        lastActivity: timestamp,
        lastHeartbeat: timestamp,
        wordCountAtStart: wordCount,
        accumulatedDuration: 0,
        mode: this.settings.activityMode,
      };
    }
  }

  async flushCurrent(timestamp: number, wordCount: number): Promise<void> {
    if (!this.active || this.active.accumulatedDuration === 0) {
      this.active = null;
      return;
    }
    const session: Session = {
      id: this.active.id,
      file: this.active.file,
      start: this.active.start,
      end: timestamp,
      duration: this.active.accumulatedDuration,
      mode: this.active.mode,
      word_delta: wordCount - this.active.wordCountAtStart,
    };
    const date = new Date(this.active.start * 1000).toISOString().slice(0, 10);
    await this.onFlush(session, date);
    this.active = null;
  }

  async checkTimeout(timestamp: number, currentWordCount: number): Promise<void> {
    if (!this.active) return;
    const idle = timestamp - this.active.lastHeartbeat;
    if (idle >= this.settings.timeoutThreshold) {
      await this.flushCurrent(this.active.lastHeartbeat, currentWordCount);
    }
  }

  updateSettings(settings: MemoTimeSettings): void {
    this.settings = settings;
  }
}
