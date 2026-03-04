import { Tracker } from '../src/tracker';
import { MemoTimeSettings, DEFAULT_SETTINGS, Session } from '../src/types';

describe('Tracker — session lifecycle', () => {
  let flushedSessions: { session: Session; date: string }[];
  let settings: MemoTimeSettings;

  beforeEach(() => {
    flushedSessions = [];
    settings = { ...DEFAULT_SETTINGS };
  });

  function makeTracker(overrides?: Partial<MemoTimeSettings>): Tracker {
    const s = { ...settings, ...overrides };
    return new Tracker(s, async (session: Session, date: string) => {
      flushedSessions.push({ session, date });
    });
  }

  it('starts a session on first heartbeat', () => {
    const tracker = makeTracker();
    tracker.heartbeat('Notes/a.md', 1000, 500);
    const active = tracker.getActiveSession();
    expect(active).not.toBeNull();
    expect(active?.file).toBe('Notes/a.md');
  });

  it('accumulates duration correctly across heartbeats', () => {
    const tracker = makeTracker();
    tracker.heartbeat('Notes/a.md', 1000, 500);
    tracker.heartbeat('Notes/a.md', 1030, 510); // gap = 30s
    tracker.heartbeat('Notes/a.md', 1060, 520); // gap = 30s
    expect(tracker.getActiveSession()?.accumulatedDuration).toBe(60);
  });

  it('caps gap at timeout threshold — does not count idle time', () => {
    const tracker = makeTracker({ timeoutThreshold: 120 });
    tracker.heartbeat('Notes/a.md', 1000, 500);
    tracker.heartbeat('Notes/a.md', 1400, 600); // gap = 400s > 120s timeout
    // gap should be capped at 120s
    expect(tracker.getActiveSession()?.accumulatedDuration).toBe(120);
  });

  it('flushes session on file switch and returns correct duration', async () => {
    const tracker = makeTracker();
    tracker.heartbeat('Notes/a.md', 1000, 500);
    tracker.heartbeat('Notes/a.md', 1030, 510); // gap = 30s accumulated
    await tracker.switchFile('Notes/b.md', 1100, 600);
    expect(flushedSessions).toHaveLength(1);
    expect(flushedSessions[0].session.file).toBe('Notes/a.md');
    expect(flushedSessions[0].session.duration).toBe(30);
  });

  it('computes word_delta as final wordCount minus wordCount at session start', async () => {
    const tracker = makeTracker();
    tracker.heartbeat('Notes/a.md', 1000, 500); // start wordCount = 500
    tracker.heartbeat('Notes/a.md', 1030, 520);
    await tracker.flushCurrent(1060, 650); // end wordCount = 650
    expect(flushedSessions[0].session.word_delta).toBe(150);
  });

  it('does not flush if no duration was accumulated', async () => {
    const tracker = makeTracker();
    tracker.heartbeat('Notes/a.md', 1000, 500); // only one heartbeat — no gap yet
    await tracker.flushCurrent(1001, 500);
    expect(flushedSessions).toHaveLength(0); // nothing to flush
  });

  it('does not start session when trackingEnabled is false', () => {
    const tracker = makeTracker({ trackingEnabled: false });
    tracker.heartbeat('Notes/a.md', 1000, 500);
    expect(tracker.getActiveSession()).toBeNull();
  });

  it('checkTimeout flushes session when idle exceeds threshold', async () => {
    const tracker = makeTracker({ timeoutThreshold: 120 });
    tracker.heartbeat('Notes/a.md', 1000, 500);
    tracker.heartbeat('Notes/a.md', 1030, 510); // 30s accumulated
    // Simulate 200s of idle time
    await tracker.checkTimeout(1230, 510);
    expect(flushedSessions).toHaveLength(1);
    expect(flushedSessions[0].session.duration).toBe(30);
  });

  it('checkTimeout does not flush when idle is within threshold', async () => {
    const tracker = makeTracker({ timeoutThreshold: 120 });
    tracker.heartbeat('Notes/a.md', 1000, 500);
    tracker.heartbeat('Notes/a.md', 1030, 510);
    await tracker.checkTimeout(1090, 510); // 60s idle < 120s threshold
    expect(flushedSessions).toHaveLength(0);
  });

  it('heartbeat for different file while another is active does nothing', () => {
    const tracker = makeTracker();
    tracker.heartbeat('Notes/a.md', 1000, 500);
    tracker.heartbeat('Notes/b.md', 1030, 100); // different file — ignored
    const active = tracker.getActiveSession();
    expect(active?.file).toBe('Notes/a.md');
    expect(active?.accumulatedDuration).toBe(0); // no duration from b.md heartbeat
  });
});
