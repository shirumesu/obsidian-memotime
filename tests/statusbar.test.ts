import { formatDuration, buildStatusBarText } from '../src/statusbar';
import { DEFAULT_SETTINGS, MemoTimeSettings } from '../src/types';

describe('formatDuration', () => {
  it('formats 0 as "0s"', () => {
    expect(formatDuration(0)).toBe('0s');
  });
  it('formats 45 seconds as "45s"', () => {
    expect(formatDuration(45)).toBe('45s');
  });
  it('formats exactly 60 seconds as "1.0m"', () => {
    expect(formatDuration(60)).toBe('1.0m');
  });
  it('formats 90 seconds as "1.5m"', () => {
    expect(formatDuration(90)).toBe('1.5m');
  });
  it('formats 3600 seconds as "1.0h"', () => {
    expect(formatDuration(3600)).toBe('1.0h');
  });
  it('formats 5400 seconds as "1.5h"', () => {
    expect(formatDuration(5400)).toBe('1.5h');
  });
  it('formats 7200 seconds as "2.0h"', () => {
    expect(formatDuration(7200)).toBe('2.0h');
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
    expect(result).toBe('⏱ 1.0h / 4.0h');
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
    expect(result).toBe('⏱ 4.0h');
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
    expect(result).toBe('⏱ 30.0m | 1.0h >> 4.0h');
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
    expect(result).toBe('⏱ 1.0h');
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
    expect(result).toBe('⏱ 1.0m·2.0m·3.0m·4.0m/5.0m');
  });
});
