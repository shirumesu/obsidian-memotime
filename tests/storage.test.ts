import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { StorageEngine } from '../src/storage';
import { Session } from '../src/types';

describe('StorageEngine', () => {
  let tmpDir: string;
  let engine: StorageEngine;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'memotime-test-'));
    engine = new StorageEngine(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('writes and reads back a session for today', async () => {
    const session: Session = {
      id: 'test-uuid-1',
      file: 'Notes/test.md',
      start: 1741046400,
      end: 1741046520,
      duration: 90,
      mode: 'typing',
      word_delta: 50,
    };
    await engine.appendSession('2026-03-04', session);
    const log = await engine.readDay('2026-03-04');
    expect(log.sessions).toHaveLength(1);
    expect(log.sessions[0].id).toBe('test-uuid-1');
    expect(log.sessions[0].duration).toBe(90);
  });

  it('deduplicates sessions with same id — keeps larger duration', async () => {
    const session: Session = {
      id: 'dup-uuid',
      file: 'Notes/test.md',
      start: 1741046400,
      end: 1741046520,
      duration: 90,
      mode: 'typing',
      word_delta: 50,
    };
    await engine.appendSession('2026-03-04', session);
    await engine.appendSession('2026-03-04', { ...session, duration: 120 });
    const log = await engine.readDay('2026-03-04');
    expect(log.sessions).toHaveLength(1);
    expect(log.sessions[0].duration).toBe(120);
  });

  it('returns empty sessions array for missing day', async () => {
    const log = await engine.readDay('2000-01-01');
    expect(log.sessions).toEqual([]);
  });

  it('getTodayTotal returns sum of all session durations for a date', async () => {
    await engine.appendSession('2026-03-04', {
      id: 'a', file: 'a.md', start: 0, end: 100, duration: 60, mode: 'typing', word_delta: 0,
    });
    await engine.appendSession('2026-03-04', {
      id: 'b', file: 'b.md', start: 200, end: 350, duration: 120, mode: 'typing', word_delta: 0,
    });
    const total = await engine.getTodayTotal('2026-03-04');
    expect(total).toBe(180);
  });

  it('getFileTotal returns duration only for specified file', async () => {
    await engine.appendSession('2026-03-04', {
      id: 'a', file: 'Notes/a.md', start: 0, end: 100, duration: 60, mode: 'typing', word_delta: 0,
    });
    await engine.appendSession('2026-03-04', {
      id: 'b', file: 'Notes/b.md', start: 0, end: 100, duration: 90, mode: 'typing', word_delta: 0,
    });
    const total = await engine.getFileTotal('Notes/a.md', '2026-03-04');
    expect(total).toBe(60);
  });

  it('getFolderTotal returns sum for all files under folder prefix', async () => {
    await engine.appendSession('2026-03-04', {
      id: 'a', file: 'Projects/sub/a.md', start: 0, end: 100, duration: 60, mode: 'typing', word_delta: 0,
    });
    await engine.appendSession('2026-03-04', {
      id: 'b', file: 'Projects/b.md', start: 0, end: 100, duration: 40, mode: 'typing', word_delta: 0,
    });
    await engine.appendSession('2026-03-04', {
      id: 'c', file: 'Other/c.md', start: 0, end: 100, duration: 90, mode: 'typing', word_delta: 0,
    });
    const total = await engine.getFolderTotal('Projects', '2026-03-04');
    expect(total).toBe(100); // 60 + 40, not 90
  });

  it('compressOldDays moves sessions older than threshold to monthly aggregate', async () => {
    await engine.appendSession('2025-01-15', {
      id: 'old-1', file: 'Notes/a.md', start: 0, end: 100, duration: 300,
      mode: 'typing', word_delta: 100,
    });
    // Compress with 0 days threshold (compress everything)
    await engine.compressOldDays(0);
    // Raw file should now return empty (compressed away)
    const log = await engine.readDay('2025-01-15');
    expect(log.sessions).toEqual([]);
    // Monthly aggregate should exist
    const agg = await engine.readMonth('2025-01');
    expect(agg.files['Notes/a.md'].duration).toBe(300);
    expect(agg.files['Notes/a.md'].word_delta).toBe(100);
    expect(agg.daily['2025-01-15'].duration).toBe(300);
  });

  it('compressOldDays does not compress files within threshold', async () => {
    const today = new Date().toISOString().slice(0, 10);
    await engine.appendSession(today, {
      id: 'recent', file: 'Notes/recent.md', start: 0, end: 100, duration: 60,
      mode: 'typing', word_delta: 10,
    });
    await engine.compressOldDays(30); // 30 days threshold — today should be kept
    const log = await engine.readDay(today);
    expect(log.sessions).toHaveLength(1); // not compressed
  });
});
