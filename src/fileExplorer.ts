import { TFolder, TFile } from 'obsidian';
import type MemoTimePlugin from './main';
import { formatDuration } from './statusbar';

export class FileExplorerDecorator {
  private plugin: MemoTimePlugin;

  constructor(plugin: MemoTimePlugin) {
    this.plugin = plugin;
  }

  async refresh(): Promise<void> {
    if (!this.plugin.settings.showFileExplorerLabels) {
      this.clearAll();
      return;
    }
    const explorer = this.plugin.app.workspace.getLeavesOfType('file-explorer')[0];
    if (!explorer) return;
    const items: Record<string, any> = (explorer.view as any)?.fileItems ?? {};
    const today = new Date().toISOString().slice(0, 10);

    for (const [filePath, item] of Object.entries(items)) {
      const el = (item as any).selfEl as HTMLElement | undefined;
      if (!el) continue;
      this.clearDecoration(el);
      const duration = await this.getDuration(filePath, today);
      if (duration <= 0) continue;
      const badge = el.createEl('span', {
        cls: 'memotime-file-badge',
        text: formatDuration(duration),
      });
      badge.setAttr('aria-hidden', 'true');
    }
  }

  private async getDuration(filePath: string, today: string): Promise<number> {
    const range = this.plugin.settings.fileExplorerTimeRange;
    const abstractFile = this.plugin.app.vault.getAbstractFileByPath(filePath);
    if (!abstractFile) return 0;

    if (abstractFile instanceof TFolder) {
      if (range === 'today') return this.plugin.storage.getFolderTotal(filePath, today);
      if (range === 'all') return this.getFolderAllTime(abstractFile);
      return this.getFolderWeek(filePath);
    }
    if (abstractFile instanceof TFile) {
      if (range === 'today') return this.plugin.storage.getFileTotal(filePath, today);
      if (range === 'all') return this.plugin.storage.getFileTotalAllTime(filePath);
      return this.getFileWeek(filePath);
    }
    return 0;
  }

  private async getFileWeek(filePath: string): Promise<number> {
    let total = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      total += await this.plugin.storage.getFileTotal(filePath, d.toISOString().slice(0, 10));
    }
    return total;
  }

  private async getFolderWeek(folderPath: string): Promise<number> {
    let total = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      total += await this.plugin.storage.getFolderTotal(folderPath, d.toISOString().slice(0, 10));
    }
    return total;
  }

  private async getFolderAllTime(folder: TFolder): Promise<number> {
    let total = 0;
    for (const child of folder.children) {
      if (child instanceof TFile) {
        total += await this.plugin.storage.getFileTotalAllTime(child.path);
      } else if (child instanceof TFolder) {
        total += await this.getFolderAllTime(child);
      }
    }
    return total;
  }

  private clearDecoration(el: HTMLElement): void {
    el.querySelectorAll('.memotime-file-badge').forEach(b => b.remove());
  }

  clearAll(): void {
    document.querySelectorAll('.memotime-file-badge').forEach(b => b.remove());
  }
}
