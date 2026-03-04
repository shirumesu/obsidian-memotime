import type { MemoTimeSettings } from './types';
import type MemoTimePlugin from './main';

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return s > 0 ? `${h}h ${m}m` : `${h}h ${m}m`;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
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

    const sessionDuration = activeSession?.accumulatedDuration ?? 0;
    const todayTotal = await this.plugin.storage.getTodayTotal(today) + sessionDuration;
    const fileTotal = file
      ? await this.plugin.storage.getFileTotal(file.path, today) + sessionDuration
      : 0;
    const folderTotal = file?.path
      ? await this.plugin.storage.getFolderTotal(
          file.path.includes('/') ? file.path.split('/').slice(0, -1).join('/') : '',
          today
        )
      : 0;
    const vaultAll = await this.plugin.storage.getVaultTotalAllTime() + sessionDuration;

    const text = buildStatusBarText(
      { session: sessionDuration, file: fileTotal, today: todayTotal, folder: folderTotal, vault_all: vaultAll },
      settings
    );
    (this.el as any).setText?.(text);
    (this.el as any).setAttr?.('aria-label', text);
  }
}
