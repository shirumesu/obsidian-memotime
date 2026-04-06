import type { App } from 'obsidian';
import { Notice, Modal } from 'obsidian';
import type MemoTimePlugin from './main';
import type { RawDayLog, Session } from './types';
import { t } from './i18n';
import * as fs from 'fs';
import * as path from 'path';
import { formatLocalDateKey, formatLocalTimeKey } from './date';

export function mergeDayLogs(local: RawDayLog, remote: RawDayLog): RawDayLog {
  const map = new Map<string, Session>();
  for (const s of local.sessions) map.set(s.id, s);
  for (const s of remote.sessions) {
    const existing = map.get(s.id);
    if (!existing || s.duration > existing.duration) {
      map.set(s.id, s);
    }
  }
  return { ...local, sessions: Array.from(map.values()) };
}

function deduplicateDayLog(log: RawDayLog): { log: RawDayLog; removed: number } {
  const deduped: RawDayLog = { version: log.version, date: log.date, sessions: [] };
  for (const session of log.sessions) {
    const existingIdx = deduped.sessions.findIndex((entry) => entry.id === session.id);
    if (existingIdx >= 0) {
      if (session.duration > deduped.sessions[existingIdx].duration) {
        deduped.sessions[existingIdx] = session;
      }
    } else {
      deduped.sessions.push(session);
    }
  }
  return {
    log: deduped,
    removed: log.sessions.length - deduped.sessions.length,
  };
}

export class SyncManager {
  private plugin: MemoTimePlugin;
  private lastScheduledSyncDate: string | null = null;

  constructor(plugin: MemoTimePlugin) {
    this.plugin = plugin;
  }

  async syncNow(options: { silent?: boolean } = {}): Promise<void> {
    if (this.plugin.settings.syncMode !== 'file') return;
    try {
      const duplicates = await this.countLocalDuplicates();
      if (duplicates > 0 && this.plugin.settings.syncConfirm && !options.silent) {
        const shouldMerge = await this.showConfirmModal(duplicates);
        if (!shouldMerge) return;
      }
      if (duplicates > 0) {
        await this.deduplicateLocalData();
      }
      if (!options.silent) new Notice(t('sync.syncComplete'));
    } catch (e) {
      console.error('MemoTime sync error:', e);
      if (!options.silent) new Notice(t('sync.syncFailed'));
    }
  }

  async runScheduledSyncIfNeeded(now: Date = new Date()): Promise<void> {
    if (this.plugin.settings.syncMode !== 'file' || !this.plugin.settings.syncScheduled) return;

    const dateKey = formatLocalDateKey(now);
    if (this.lastScheduledSyncDate === dateKey) return;
    if (formatLocalTimeKey(now) < this.plugin.settings.syncScheduledTime) return;

    await this.syncNow({ silent: true });
    this.lastScheduledSyncDate = dateKey;
  }

  private getDataPath(): string {
    return this.plugin.storage.getDataPath?.() ?? (this.plugin.storage as any).dataPath;
  }

  private async countLocalDuplicates(): Promise<number> {
    const dataPath = this.getDataPath();
    const rawDir = path.join(dataPath, 'raw');
    if (!fs.existsSync(rawDir)) return 0;
    let duplicates = 0;
    const files = fs.readdirSync(rawDir).filter((f: string) => f.endsWith('.json'));
    for (const file of files) {
      const date = file.replace('.json', '');
      const log = await this.plugin.storage.readDay(date);
      duplicates += deduplicateDayLog(log).removed;
    }
    return duplicates;
  }

  private async deduplicateLocalData(): Promise<number> {
    const dataPath = this.getDataPath();
    const rawDir = path.join(dataPath, 'raw');
    if (!fs.existsSync(rawDir)) return 0;
    let changed = 0;
    const files = fs.readdirSync(rawDir).filter((f: string) => f.endsWith('.json'));
    for (const f of files) {
      const date = f.replace('.json', '');
      const log = await this.plugin.storage.readDay(date);
      const result = deduplicateDayLog(log);
      if (result.removed > 0) {
        await this.plugin.storage.writeDay(result.log);
        changed += result.removed;
      }
    }
    return changed;
  }

  private showConfirmModal(count: number): Promise<boolean> {
    return new Promise((resolve) => {
      const modal = new SyncConfirmModal(this.plugin.app, count, resolve);
      modal.open();
    });
  }

  async exportData(): Promise<void> {
    const dataPath = this.getDataPath();
    const allData: Record<string, unknown> = {};
    const rawDir = path.join(dataPath, 'raw');
    const aggDir = path.join(dataPath, 'agg');
    if (fs.existsSync(rawDir)) {
      for (const f of fs.readdirSync(rawDir).filter((f: string) => f.endsWith('.json'))) {
        allData[`raw/${f}`] = JSON.parse(fs.readFileSync(path.join(rawDir, f), 'utf-8'));
      }
    }
    if (fs.existsSync(aggDir)) {
      for (const f of fs.readdirSync(aggDir).filter((f: string) => f.endsWith('.json'))) {
        allData[`agg/${f}`] = JSON.parse(fs.readFileSync(path.join(aggDir, f), 'utf-8'));
      }
    }
    const json = JSON.stringify(allData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `memotime-export-${formatLocalDateKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

class SyncConfirmModal extends Modal {
  private count: number;
  private resolve: (shouldMerge: boolean) => void;
  private settled = false;

  constructor(app: App, count: number, resolve: (shouldMerge: boolean) => void) {
    super(app);
    this.count = count;
    this.resolve = resolve;
  }

  private finish(shouldMerge: boolean): void {
    if (this.settled) return;
    this.settled = true;
    this.resolve(shouldMerge);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: t('sync.confirmTitle') });
    contentEl.createEl('p', {
      text: t('sync.confirmMessage').replace('{count}', String(this.count)),
    });
    const btnRow = contentEl.createDiv({ cls: 'memotime-modal-buttons' });
    btnRow.createEl('button', { text: t('sync.merge'), cls: 'mod-cta' })
      .addEventListener('click', () => { this.finish(true); this.close(); });
    btnRow.createEl('button', { text: t('sync.skip') })
      .addEventListener('click', () => { this.finish(false); this.close(); });
  }

  onClose(): void {
    this.contentEl.empty();
    this.finish(false);
  }
}
