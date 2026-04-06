import { Session, ActiveSession, MemoTimeSettings } from './types';
import { dateKeyFromTimestampSeconds } from './date';

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
    // Force-save before clearing — any time spent on the current file is persisted.
    await this.checkpoint(timestamp, wordCount);
    this.active = null;

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

  async checkTimeout(timestamp: number, currentWordCount: number): Promise<void> {
    if (!this.active) return;
    const idle = timestamp - this.active.lastHeartbeat;
    if (idle >= this.settings.timeoutThreshold) {
      // Force-save before clearing — preserve accumulated + threshold tail.
      await this.checkpoint(timestamp, currentWordCount);
      this.active = null;
    }
  }

  /**
   * Persist the active session to disk without ending it.
   * - Called every second for crash-resilience (at most ~1 s of data lost).
   * - Called explicitly before any operation that clears this.active
   *   (switchFile, checkTimeout, flushCurrent) so no data is ever dropped.
   *
   * Duration saved = accumulatedDuration + min(now − lastHeartbeat, threshold).
   * This matches exactly what the status bar displays, so what you see = what is saved.
   */
  async checkpoint(timestamp: number, wordCount: number): Promise<void> {
    if (!this.active) return;
    const gap = timestamp - this.active.lastHeartbeat;
    const cappedGap = Math.min(gap, this.settings.timeoutThreshold);
    const totalDuration = this.active.accumulatedDuration + cappedGap;
    if (totalDuration === 0) return;
    const session: Session = {
      id: this.active.id,
      file: this.active.file,
      start: this.active.start,
      end: timestamp,
      duration: totalDuration,
      mode: this.active.mode,
      word_delta: wordCount - this.active.wordCountAtStart,
    };
    const date = dateKeyFromTimestampSeconds(this.active.start);
    await this.onFlush(session, date);
    // Do NOT clear this.active — session continues
  }

  /** Save and end the current session. Used on plugin unload. */
  async flushCurrent(timestamp: number, wordCount: number): Promise<void> {
    await this.checkpoint(timestamp, wordCount);
    this.active = null;
  }

  /**
   * Returns live seconds elapsed since the last heartbeat, capped at the timeout threshold.
   * Returns threshold (not 0) when the gap exceeds the threshold, so the display stays stable
   * until the session is actually ended by checkTimeout.
   */
  getLiveExtra(now: number): number {
    if (!this.active) return 0;
    const gap = now - this.active.lastHeartbeat;
    return Math.min(gap, this.settings.timeoutThreshold);
  }

  updateSettings(settings: MemoTimeSettings): void {
    this.settings = settings;
  }
}
