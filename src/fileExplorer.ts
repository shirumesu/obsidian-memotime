import { TFolder, TFile } from 'obsidian';
import type MemoTimePlugin from './main';
import { formatDuration } from './statusbar';
import { formatLocalDateKey, shiftLocalDateKey } from './date';

export class FileExplorerDecorator {
  private plugin: MemoTimePlugin;

  constructor(plugin: MemoTimePlugin) {
    this.plugin = plugin;
  }

  async refresh(): Promise<void> {
    const items = this.getExplorerItems();
    if (!items) return;
    await this.refreshPaths(Object.keys(items));
  }

  async refreshForFileChange(previousFilePath: string, nextFilePath: string): Promise<void> {
    if (!this.plugin.settings.showFileExplorerLabels) {
      this.clearAll();
      return;
    }

    const items = this.getExplorerItems();
    if (!items) return;

    const targets = new Set<string>();
    for (const filePath of [previousFilePath, nextFilePath]) {
      if (!filePath) continue;
      targets.add(filePath);
      for (const folderPath of this.getAncestorFolders(filePath)) {
        targets.add(folderPath);
      }
    }

    await this.refreshPaths([...targets]);
  }

  private async getDuration(filePath: string, today: string): Promise<number> {
    const range = this.plugin.settings.fileExplorerTimeRange;
    const abstractFile = this.plugin.app.vault.getAbstractFileByPath(filePath);
    if (!abstractFile) return 0;

    if (abstractFile instanceof TFolder) {
      if (range === 'today') return this.plugin.storage.getFolderTotal(filePath, today);
      if (range === 'all') return this.plugin.storage.getFolderTotalAllTime(filePath);
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
    const today = formatLocalDateKey();
    for (let i = 0; i < 7; i++) {
      total += await this.plugin.storage.getFileTotal(filePath, shiftLocalDateKey(today, -i));
    }
    return total;
  }

  private async getFolderWeek(folderPath: string): Promise<number> {
    let total = 0;
    const today = formatLocalDateKey();
    for (let i = 0; i < 7; i++) {
      total += await this.plugin.storage.getFolderTotal(folderPath, shiftLocalDateKey(today, -i));
    }
    return total;
  }

  private getExplorerItems(): Record<string, any> | null {
    if (!this.plugin.settings.showFileExplorerLabels) {
      this.clearAll();
      return null;
    }

    const explorer = this.plugin.app.workspace.getLeavesOfType('file-explorer')[0];
    if (!explorer) return null;
    return (explorer.view as any)?.fileItems ?? {};
  }

  private getAncestorFolders(filePath: string): string[] {
    const segments = filePath.split('/');
    const folders: string[] = [];
    for (let i = 1; i < segments.length; i++) {
      folders.push(segments.slice(0, i).join('/'));
    }
    return folders;
  }

  private async refreshPaths(filePaths: Iterable<string>): Promise<void> {
    const items = this.getExplorerItems();
    if (!items) return;

    const today = formatLocalDateKey();
    for (const filePath of filePaths) {
      const item = items[filePath];
      const el = (item as any)?.selfEl as HTMLElement | undefined;
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

  clearAll(): void {
    if (typeof document === 'undefined') return;
    document.querySelectorAll('.memotime-file-badge').forEach(b => b.remove());
  }

  private clearDecoration(el: HTMLElement): void {
    const badges = el.querySelectorAll('.memotime-file-badge');
    for (const badge of Array.from(badges)) {
      (badge as HTMLElement).remove?.();
    }
  }
}
