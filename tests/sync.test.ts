import { mergeDayLogs } from '../src/sync';
import { RawDayLog } from '../src/types';

describe('mergeDayLogs', () => {
  it('merges non-overlapping sessions from two logs', () => {
    const local: RawDayLog = {
      version: 1, date: '2026-03-04',
      sessions: [{ id: 'a', file: 'a.md', start: 0, end: 60, duration: 60, mode: 'typing', word_delta: 10 }],
    };
    const remote: RawDayLog = {
      version: 1, date: '2026-03-04',
      sessions: [{ id: 'b', file: 'b.md', start: 0, end: 60, duration: 60, mode: 'typing', word_delta: 10 }],
    };
    const merged = mergeDayLogs(local, remote);
    expect(merged.sessions).toHaveLength(2);
  });

  it('keeps the session with larger duration on id conflict', () => {
    const local: RawDayLog = {
      version: 1, date: '2026-03-04',
      sessions: [{ id: 'same', file: 'a.md', start: 0, end: 60, duration: 60, mode: 'typing', word_delta: 10 }],
    };
    const remote: RawDayLog = {
      version: 1, date: '2026-03-04',
      sessions: [{ id: 'same', file: 'a.md', start: 0, end: 90, duration: 90, mode: 'typing', word_delta: 15 }],
    };
    const merged = mergeDayLogs(local, remote);
    expect(merged.sessions).toHaveLength(1);
    expect(merged.sessions[0].duration).toBe(90);
  });

  it('returns local unchanged when remote has no sessions', () => {
    const local: RawDayLog = {
      version: 1, date: '2026-03-04',
      sessions: [{ id: 'a', file: 'a.md', start: 0, end: 60, duration: 60, mode: 'typing', word_delta: 0 }],
    };
    const remote: RawDayLog = { version: 1, date: '2026-03-04', sessions: [] };
    const merged = mergeDayLogs(local, remote);
    expect(merged.sessions).toHaveLength(1);
    expect(merged.sessions[0].id).toBe('a');
  });
});
