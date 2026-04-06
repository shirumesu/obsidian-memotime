import type { MemoTimeSettings } from './types';
import type MemoTimePlugin from './main';

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

interface Metrics {
  session: number;
  file: number;
  today: number;
  folder: number;
  vault_all: number;
}

export function buildStatusBarText(metrics: Metrics, settings: MemoTimeSettings): string {
  const m = settings.statusBarMetrics;
  const sep = settings.metricSeparator;
  const mainSep = settings.mainSeparator;
  const parts: string[] = [];
  if (m.session && metrics.session > 0) parts.push(formatDuration(metrics.session));
  if (m.file) parts.push(formatDuration(metrics.file));
  if (m.today) parts.push(formatDuration(metrics.today));
  if (m.folder) parts.push(formatDuration(metrics.folder));
  const left = parts.join(sep);
  if (m.vault_all) {
    const right = formatDuration(metrics.vault_all);
    return `⏱ ${left ? left + mainSep : ''}${right}`;
  }
  return `⏱ ${left}`;
}

export class StatusBarManager {
  private el: HTMLElement | null = null;
  private plugin: MemoTimePlugin;

  constructor(plugin: MemoTimePlugin) {
    this.plugin = plugin;
  }

  initialize(): void {
    this.el = this.plugin.addStatusBarItem() as unknown as HTMLElement;
    (this.el as any).addClass?.('memotime-statusbar');
    (this.el as any).setCssStyles?.({ cursor: 'pointer' });
    (this.el as any).addEventListener?.('click', () => this.plugin.activateDashboard());
    this.refresh();
  }

  async refresh(): Promise<void> {
    if (!this.el) return;
    const today = new Date().toISOString().slice(0, 10);
    const activeSession = this.plugin.tracker.getActiveSession();
    const file = this.plugin.app.workspace?.getActiveFile?.();
    const settings = this.plugin.settings;

    const liveExtra = this.plugin.tracker.getLiveExtra(Date.now() / 1000);
    const sessionDuration = (activeSession?.accumulatedDuration ?? 0) + liveExtra;
    // Exclude the active session from disk reads to avoid double-counting:
    // checkpoint() already wrote it to disk, so we add in-memory sessionDuration separately.
    const activeId = activeSession?.id;
    const activeFile = activeSession?.file;
    const folderPath = file?.path
      ? (file.path.includes('/') ? file.path.split('/').slice(0, -1).join('/') : '')
      : null;
    const totals = await this.plugin.storage.getStatusBarTotals(
      today,
      file?.path ?? null,
      folderPath,
      activeId
    );
    const todayTotal = totals.today + sessionDuration;
    const fileTotal = (totals.file ?? 0) + (activeFile === file?.path ? sessionDuration : 0);
    const folderTotal = totals.folder ?? 0;
    const vaultAll = totals.vault_all + sessionDuration;

    const text = buildStatusBarText(
      { session: sessionDuration, file: fileTotal, today: todayTotal, folder: folderTotal, vault_all: vaultAll },
      settings
    );
    (this.el as any).setText?.(text);
    (this.el as any).setAttr?.('aria-label', text);
  }
}
