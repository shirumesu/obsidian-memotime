import { formatDuration, buildStatusBarText } from '../src/statusbar';
import { DEFAULT_SETTINGS, MemoTimeSettings } from '../src/types';

describe('formatDuration', () => {
  it('formats 0 as "0s"', () => {
    expect(formatDuration(0)).toBe('0s');
  });
  it('formats 45 seconds as "45s"', () => {
    expect(formatDuration(45)).toBe('45s');
  });
  it('formats exactly 60 seconds as "1m"', () => {
    expect(formatDuration(60)).toBe('1m');
  });
  it('formats 90 seconds as "1m 30s"', () => {
    expect(formatDuration(90)).toBe('1m 30s');
  });
  it('formats 3600 seconds as "1h 0m"', () => {
    expect(formatDuration(3600)).toBe('1h 0m');
  });
  it('formats 3661 seconds as "1h 1m"', () => {
    expect(formatDuration(3661)).toBe('1h 1m');
  });
  it('formats 7384 seconds as "2h 3m"', () => {
    expect(formatDuration(7384)).toBe('2h 3m');
  });
});

describe('buildStatusBarText', () => {
  it('default settings: shows today and vault_all with main separator', () => {
    const settings: MemoTimeSettings = { ...DEFAULT_SETTINGS };
    // DEFAULT: today=true, vault_all=true, mainSeparator=' / ', metricSeparator=' · '
    const result = buildStatusBarText(
      { session: 0, file: 0, today: 3600, folder: 0, vault_all: 14400 },
      settings
    );
    expect(result).toBe('⏱ 1h 0m / 4h 0m');
  });

  it('shows only vault_all when today is disabled', () => {
    const settings: MemoTimeSettings = {
      ...DEFAULT_SETTINGS,
      statusBarMetrics: { ...DEFAULT_SETTINGS.statusBarMetrics, today: false },
    };
    const result = buildStatusBarText(
      { session: 0, file: 0, today: 0, folder: 0, vault_all: 14400 },
      settings
    );
    expect(result).toBe('⏱ 4h 0m');
  });

  it('shows multiple metrics with metric separator', () => {
    const settings: MemoTimeSettings = {
      ...DEFAULT_SETTINGS,
      statusBarMetrics: { session: false, file: true, today: true, folder: false, vault_all: true },
      metricSeparator: ' | ',
      mainSeparator: ' >> ',
    };
    const result = buildStatusBarText(
      { session: 0, file: 1800, today: 3600, folder: 0, vault_all: 14400 },
      settings
    );
    expect(result).toBe('⏱ 30m | 1h 0m >> 4h 0m');
  });

  it('hides session metric when session duration is 0', () => {
    const settings: MemoTimeSettings = {
      ...DEFAULT_SETTINGS,
      statusBarMetrics: { session: true, file: false, today: true, folder: false, vault_all: false },
    };
    const result = buildStatusBarText(
      { session: 0, file: 0, today: 3600, folder: 0, vault_all: 0 },
      settings
    );
    // session is 0 so it should be hidden; only today shows
    expect(result).toBe('⏱ 1h 0m');
  });

  it('shows all five metrics when all enabled', () => {
    const settings: MemoTimeSettings = {
      ...DEFAULT_SETTINGS,
      statusBarMetrics: { session: true, file: true, today: true, folder: true, vault_all: true },
      metricSeparator: '·',
      mainSeparator: '/',
    };
    const result = buildStatusBarText(
      { session: 60, file: 120, today: 180, folder: 240, vault_all: 300 },
      settings
    );
    expect(result).toBe('⏱ 1m·2m·3m·4m/5m');
  });
});
