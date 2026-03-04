import type { App } from 'obsidian';
import { Notice, Modal } from 'obsidian';
import type MemoTimePlugin from './main';
import type { RawDayLog, Session } from './types';
import { t } from './i18n';
import * as fs from 'fs';
import * as path from 'path';

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

export class SyncManager {
  private plugin: MemoTimePlugin;

  constructor(plugin: MemoTimePlugin) {
    this.plugin = plugin;
  }

  async syncNow(options: { silent?: boolean } = {}): Promise<void> {
    if (this.plugin.settings.syncMode !== 'file') return;
    try {
      const changed = await this.deduplicateLocalData();
      if (changed > 0 && this.plugin.settings.syncConfirm && !options.silent) {
        await this.showConfirmModal(changed);
      }
      if (!options.silent) new Notice(t('sync.syncComplete'));
    } catch (e) {
      console.error('MemoTime sync error:', e);
      if (!options.silent) new Notice(t('sync.syncFailed'));
    }
  }

  private async deduplicateLocalData(): Promise<number> {
    const dataPath = (this.plugin.storage as any).dataPath as string;
    const rawDir = path.join(dataPath, 'raw');
    if (!fs.existsSync(rawDir)) return 0;
    let changed = 0;
    const files = fs.readdirSync(rawDir).filter((f: string) => f.endsWith('.json'));
    for (const f of files) {
      const date = f.replace('.json', '');
      const log = await this.plugin.storage.readDay(date);
      const before = log.sessions.length;
      const deduped: RawDayLog = { version: 1, date, sessions: [] };
      for (const s of log.sessions) {
        const idx = deduped.sessions.findIndex(x => x.id === s.id);
        if (idx >= 0) {
          if (s.duration > deduped.sessions[idx].duration) deduped.sessions[idx] = s;
        } else {
          deduped.sessions.push(s);
        }
      }
      if (deduped.sessions.length !== before) {
        await this.plugin.storage.writeDay(deduped);
        changed += before - deduped.sessions.length;
      }
    }
    return changed;
  }

  private showConfirmModal(count: number): Promise<void> {
    return new Promise((resolve) => {
      const modal = new SyncConfirmModal(this.plugin.app, count, resolve);
      modal.open();
    });
  }

  async exportData(): Promise<void> {
    const dataPath = (this.plugin.storage as any).dataPath as string;
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
    a.download = `memotime-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

class SyncConfirmModal extends Modal {
  private count: number;
  private resolve: () => void;

  constructor(app: App, count: number, resolve: () => void) {
    super(app);
    this.count = count;
    this.resolve = resolve;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: t('sync.confirmTitle') });
    contentEl.createEl('p', {
      text: t('sync.confirmMessage').replace('{count}', String(this.count)),
    });
    const btnRow = contentEl.createDiv({ cls: 'memotime-modal-buttons' });
    btnRow.createEl('button', { text: t('sync.merge'), cls: 'mod-cta' })
      .addEventListener('click', () => { this.close(); this.resolve(); });
    btnRow.createEl('button', { text: t('sync.skip') })
      .addEventListener('click', () => { this.close(); this.resolve(); });
  }

  onClose(): void {
    this.contentEl.empty();
    this.resolve();
  }
}
