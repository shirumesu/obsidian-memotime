import { ItemView, WorkspaceLeaf, TFile } from 'obsidian';
import { Chart, registerables } from 'chart.js';
import type MemoTimePlugin from './main';
import { t } from './i18n';
import { formatDuration } from './statusbar';

Chart.register(...registerables);

export const DASHBOARD_VIEW_TYPE = 'memotime-dashboard';

export class DashboardView extends ItemView {
  plugin: MemoTimePlugin;
  private charts: Chart[] = [];

  constructor(leaf: WorkspaceLeaf, plugin: MemoTimePlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string { return DASHBOARD_VIEW_TYPE; }
  getDisplayText(): string { return 'MemoTime'; }
  getIcon(): string { return 'clock'; }

  async onOpen(): Promise<void> {
    await this.render();
  }

  async onClose(): Promise<void> {
    this.charts.forEach(c => c.destroy());
    this.charts = [];
  }

  async render(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass('memotime-dashboard');

    const tabBar = container.createDiv({ cls: 'memotime-tabs' });
    const defaultTab = this.plugin.settings.dashboardDefaultTab;

    const content = container.createDiv({ cls: 'memotime-content' });

    const renderTab = async (tab: string): Promise<void> => {
      this.charts.forEach(c => c.destroy());
      this.charts = [];
      content.empty();
      tabBar.querySelectorAll('.memotime-tab').forEach(el => el.removeClass('active'));
      tabBar.querySelector(`[data-tab="${tab}"]`)?.addClass('active');
      if (tab === 'today') await this.renderToday(content);
      else if (tab === 'week') await this.renderWeek(content);
      else await this.renderHistory(content);
    };

    const tabs = [
      { key: 'today', label: t('settings.tabToday') },
      { key: 'week', label: t('settings.tabWeek') },
      { key: 'history', label: t('settings.tabHistory') },
    ];

    for (const tab of tabs) {
      const btn = tabBar.createEl('button', {
        cls: `memotime-tab${tab.key === defaultTab ? ' active' : ''}`,
        text: tab.label,
      });
      btn.setAttr('data-tab', tab.key);
      btn.addEventListener('click', () => renderTab(tab.key));
    }

    await renderTab(defaultTab);
  }

  private async renderToday(container: HTMLElement): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    const log = await this.plugin.storage.readDay(today);
    const totalSeconds = log.sessions.reduce((s, x) => s + x.duration, 0);
    const wordDelta = log.sessions.reduce((s, x) => s + x.word_delta, 0);
    const streak = await this.calcStreak();

    const cards = container.createDiv({ cls: 'memotime-cards' });
    this.createCard(cards, t('dashboard.todayTime'), formatDuration(totalSeconds));
    this.createCard(cards, t('dashboard.streak'), `${streak} ${t('dashboard.days')}`);
    const wordStr = wordDelta >= 0 ? `+${wordDelta}` : `${wordDelta}`;
    this.createCard(cards, t('dashboard.todayWords'), wordStr);

    if (log.sessions.length === 0) {
      container.createEl('p', { text: t('dashboard.noData'), cls: 'memotime-no-data' });
      return;
    }

    // Top notes bar chart
    const fileMap = new Map<string, number>();
    for (const s of log.sessions) {
      fileMap.set(s.file, (fileMap.get(s.file) ?? 0) + s.duration);
    }
    const sorted = [...fileMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    this.createHorizontalBarChart(
      container,
      t('dashboard.topNotes'),
      sorted.map(([f]) => f.split('/').pop() ?? f),
      sorted.map(([, d]) => d)
    );

    // Folder pie
    const folderMap = new Map<string, number>();
    for (const [file, dur] of fileMap) {
      const folder = file.includes('/') ? file.split('/')[0] : '(root)';
      folderMap.set(folder, (folderMap.get(folder) ?? 0) + dur);
    }
    this.createPieChart(
      container,
      t('dashboard.folderBreakdown'),
      [...folderMap.keys()],
      [...folderMap.values()]
    );

    // Tag breakdown
    await this.renderTagBreakdown(container, [...fileMap.keys()], today);
  }

  private async renderWeek(container: HTMLElement): Promise<void> {
    const days: string[] = [];
    const durations: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      const date = d.toISOString().slice(0, 10);
      days.push(date.slice(5));
      durations.push(await this.plugin.storage.getTodayTotal(date));
    }
    const weekTotal = durations.reduce((a, b) => a + b, 0);
    const streak = await this.calcStreak();

    const cards = container.createDiv({ cls: 'memotime-cards' });
    this.createCard(cards, t('dashboard.weekTime'), formatDuration(weekTotal));
    this.createCard(cards, t('dashboard.streak'), `${streak} ${t('dashboard.days')}`);

    this.createBarChart(container, t('dashboard.dailyChart'), days, durations);

    const fileMap = new Map<string, number>();
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      const log = await this.plugin.storage.readDay(d.toISOString().slice(0, 10));
      for (const s of log.sessions) {
        fileMap.set(s.file, (fileMap.get(s.file) ?? 0) + s.duration);
      }
    }
    const sorted = [...fileMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    if (sorted.length > 0) {
      this.createHorizontalBarChart(
        container,
        t('dashboard.topNotes'),
        sorted.map(([f]) => f.split('/').pop() ?? f),
        sorted.map(([, d]) => d)
      );
    }
  }

  private async renderHistory(container: HTMLElement): Promise<void> {
    const days: string[] = [];
    const durations: number[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      const date = d.toISOString().slice(0, 10);
      const log = await this.plugin.storage.readDay(date);
      days.push(date.slice(5));
      durations.push(log.sessions.reduce((s, x) => s + x.duration, 0));
    }
    this.createBarChart(container, t('dashboard.dailyChart'), days, durations);
    await this.renderHeatmap(container);
  }

  private async renderHeatmap(container: HTMLElement): Promise<void> {
    const section = container.createDiv({ cls: 'memotime-section' });
    section.createEl('h3', { text: t('dashboard.activityHeatmap') });
    const grid = section.createDiv({ cls: 'memotime-heatmap' });
    const dayMap = new Map<string, number>();
    for (let i = 364; i >= 0; i--) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      const date = d.toISOString().slice(0, 10);
      dayMap.set(date, await this.plugin.storage.getTodayTotal(date));
    }
    const max = Math.max(...dayMap.values(), 1);
    for (const [date, dur] of dayMap) {
      const cell = grid.createDiv({ cls: 'memotime-heatmap-cell' });
      const intensity = dur === 0 ? 0 : Math.min(4, Math.ceil((dur / max) * 4));
      cell.setAttr('data-level', String(intensity));
      cell.setAttr('title', `${date}: ${formatDuration(dur)}`);
    }
  }

  private async renderTagBreakdown(container: HTMLElement, files: string[], date: string): Promise<void> {
    const tagMap = new Map<string, number>();
    let hasAnyTags = false;
    for (const file of new Set(files)) {
      const tfile = this.plugin.app.vault.getFileByPath?.(file) ?? this.plugin.app.vault.getAbstractFileByPath(file);
      if (!(tfile instanceof TFile)) continue;
      const cache = this.plugin.app.metadataCache.getFileCache(tfile);
      const frontmatterTags: string[] = cache?.frontmatter?.tags ?? [];
      const inlineTags: string[] = (cache?.tags ?? []).map((t: any) => t.tag);
      const tags = [...new Set([...frontmatterTags, ...inlineTags])];
      if (tags.length > 0) hasAnyTags = true;
      const dur = await this.plugin.storage.getFileTotal(file, date);
      const tagList = tags.length > 0 ? tags : [t('dashboard.untagged')];
      for (const tag of tagList) {
        tagMap.set(tag, (tagMap.get(tag) ?? 0) + dur);
      }
    }
    // Hide entire section if no notes use tags
    if (!hasAnyTags) return;
    if (tagMap.size === 0) return;
    const sorted = [...tagMap.entries()].sort((a, b) => b[1] - a[1]);
    this.createHorizontalBarChart(
      container,
      t('dashboard.tagBreakdown'),
      sorted.map(([tag]) => tag),
      sorted.map(([, dur]) => dur)
    );
  }

  private async calcStreak(): Promise<number> {
    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      const total = await this.plugin.storage.getTodayTotal(d.toISOString().slice(0, 10));
      if (total > 0) streak++;
      else if (i > 0) break;
    }
    return streak;
  }

  private createCard(container: HTMLElement, label: string, value: string): void {
    const card = container.createDiv({ cls: 'memotime-card' });
    card.createEl('div', { cls: 'memotime-card-value', text: value });
    card.createEl('div', { cls: 'memotime-card-label', text: label });
  }

  private createBarChart(container: HTMLElement, title: string, labels: string[], data: number[]): void {
    const section = container.createDiv({ cls: 'memotime-section' });
    section.createEl('h3', { text: title });
    const canvas = section.createEl('canvas');
    const chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: 'rgba(var(--color-accent-rgb, 99,102,241), 0.7)',
          borderRadius: 4,
        }],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { ticks: { callback: (v: any) => formatDuration(Number(v)) } },
        },
      },
    });
    this.charts.push(chart);
  }

  private createHorizontalBarChart(container: HTMLElement, title: string, labels: string[], data: number[]): void {
    const section = container.createDiv({ cls: 'memotime-section' });
    section.createEl('h3', { text: title });
    const canvas = section.createEl('canvas');
    const chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: 'rgba(var(--color-accent-rgb, 99,102,241), 0.7)',
          borderRadius: 4,
        }],
      },
      options: {
        indexAxis: 'y' as const,
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { callback: (v: any) => formatDuration(Number(v)) } },
        },
      },
    });
    this.charts.push(chart);
  }

  private createPieChart(container: HTMLElement, title: string, labels: string[], data: number[]): void {
    const section = container.createDiv({ cls: 'memotime-section' });
    section.createEl('h3', { text: title });
    const canvas = section.createEl('canvas');
    const chart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          borderWidth: 1,
        }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'right' as const },
          tooltip: {
            callbacks: {
              label: (ctx: any) => {
                const val = ctx.raw as number;
                return ` ${ctx.label}: ${formatDuration(val)}`;
              },
            },
          },
        },
      },
    });
    this.charts.push(chart);
  }
}
