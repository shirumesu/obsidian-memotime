import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import type MemoTimePlugin from './main';
import { t, setLanguage } from './i18n';
import type { TimeoutThreshold } from './types';

export class MemoTimeSettingTab extends PluginSettingTab {
  plugin: MemoTimePlugin;

  constructor(app: App, plugin: MemoTimePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // ── Language ──
    new Setting(containerEl)
      .setName(t('settings.language'))
      .setDesc(t('settings.languageDesc'))
      .addDropdown(d => d
        .addOption('auto', 'Follow Obsidian / 跟随')
        .addOption('zh', '中文')
        .addOption('en', 'English')
        .setValue(this.plugin.settings.language)
        .onChange(async (v: string) => {
          this.plugin.settings.language = v as 'auto' | 'zh' | 'en';
          setLanguage(v as 'auto' | 'zh' | 'en', this.app);
          await this.plugin.saveSettings();
          this.display();
        }));

    // ── Tracking ──
    containerEl.createEl('h2', { text: t('settings.trackingSection') });

    new Setting(containerEl)
      .setName(t('settings.trackingEnabled'))
      .addToggle(tog => tog
        .setValue(this.plugin.settings.trackingEnabled)
        .onChange(async (v: boolean) => {
          this.plugin.settings.trackingEnabled = v;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName(t('settings.activityMode'))
      .setDesc(t('settings.activityModeDesc'))
      .addDropdown(d => d
        .addOption('typing', t('settings.activityModeTyping'))
        .addOption('cursor', t('settings.activityModeCursor'))
        .setValue(this.plugin.settings.activityMode)
        .onChange(async (v: string) => {
          this.plugin.settings.activityMode = v as 'typing' | 'cursor';
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName(t('settings.timeout'))
      .setDesc(t('settings.timeoutDesc'))
      .addDropdown(d => d
        .addOption('30', '30s')
        .addOption('60', '1m')
        .addOption('120', '2m')
        .addOption('300', '5m')
        .setValue(String(this.plugin.settings.timeoutThreshold))
        .onChange(async (v: string) => {
          this.plugin.settings.timeoutThreshold = Number(v) as TimeoutThreshold;
          await this.plugin.saveSettings();
        }));

    // ── Status Bar ──
    containerEl.createEl('h2', { text: t('settings.statusBarSection') });

    containerEl.createEl('p', {
      text: t('settings.statusBarWarning'),
      cls: 'memotime-warning',
    });

    const metricKeys = [
      ['session', t('settings.showSession')],
      ['file', t('settings.showFile')],
      ['today', t('settings.showToday')],
      ['folder', t('settings.showFolder')],
      ['vault_all', t('settings.showVaultAll')],
    ] as const;

    for (const [key, label] of metricKeys) {
      new Setting(containerEl).setName(label).addToggle(tog => tog
        .setValue(this.plugin.settings.statusBarMetrics[key])
        .onChange(async (v: boolean) => {
          this.plugin.settings.statusBarMetrics[key] = v;
          await this.plugin.saveSettings();
        }));
    }

    new Setting(containerEl)
      .setName(t('settings.metricSeparator'))
      .addText(txt => txt
        .setValue(this.plugin.settings.metricSeparator)
        .onChange(async (v: string) => {
          this.plugin.settings.metricSeparator = v;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName(t('settings.mainSeparator'))
      .addText(txt => txt
        .setValue(this.plugin.settings.mainSeparator)
        .onChange(async (v: string) => {
          this.plugin.settings.mainSeparator = v;
          await this.plugin.saveSettings();
        }));

    // ── File Explorer ──
    containerEl.createEl('h2', { text: t('settings.fileExplorerSection') });

    new Setting(containerEl)
      .setName(t('settings.showLabels'))
      .addToggle(tog => tog
        .setValue(this.plugin.settings.showFileExplorerLabels)
        .onChange(async (v: boolean) => {
          this.plugin.settings.showFileExplorerLabels = v;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName(t('settings.labelTimeRange'))
      .addDropdown(d => d
        .addOption('today', t('settings.timeRangeToday'))
        .addOption('week', t('settings.timeRangeWeek'))
        .addOption('all', t('settings.timeRangeAll'))
        .setValue(this.plugin.settings.fileExplorerTimeRange)
        .onChange(async (v: string) => {
          this.plugin.settings.fileExplorerTimeRange = v as 'today' | 'week' | 'all';
          await this.plugin.saveSettings();
        }));

    // ── Sync ──
    containerEl.createEl('h2', { text: t('settings.syncSection') });

    new Setting(containerEl)
      .setName(t('settings.syncMode'))
      .addDropdown(d => d
        .addOption('off', t('settings.syncModeOff'))
        .addOption('file', t('settings.syncModeFile'))
        .addOption('api', t('settings.syncModeApi'))
        .setValue(this.plugin.settings.syncMode)
        .onChange(async (v: string) => {
          this.plugin.settings.syncMode = v as 'off' | 'file' | 'api';
          await this.plugin.saveSettings();
          this.display();
        }));

    if (this.plugin.settings.syncMode === 'file') {
      new Setting(containerEl)
        .setName(t('settings.dataPath'))
        .setDesc(t('settings.dataPathDesc'))
        .addText(txt => txt
          .setValue(this.plugin.settings.dataPath)
          .onChange(async (v: string) => {
            this.plugin.settings.dataPath = v;
            await this.plugin.saveSettings();
          }));

      new Setting(containerEl).setName(t('settings.syncOnOpen')).addToggle(tog => tog
        .setValue(this.plugin.settings.syncOnOpen)
        .onChange(async (v: boolean) => { this.plugin.settings.syncOnOpen = v; await this.plugin.saveSettings(); }));

      new Setting(containerEl).setName(t('settings.syncOnClose')).addToggle(tog => tog
        .setValue(this.plugin.settings.syncOnClose)
        .onChange(async (v: boolean) => { this.plugin.settings.syncOnClose = v; await this.plugin.saveSettings(); }));

      new Setting(containerEl).setName(t('settings.syncScheduled')).addToggle(tog => tog
        .setValue(this.plugin.settings.syncScheduled)
        .onChange(async (v: boolean) => { this.plugin.settings.syncScheduled = v; await this.plugin.saveSettings(); }));

      if (this.plugin.settings.syncScheduled) {
        new Setting(containerEl)
          .setName(t('settings.syncScheduledTime'))
          .addText(txt => txt
            .setValue(this.plugin.settings.syncScheduledTime)
            .onChange(async (v: string) => { this.plugin.settings.syncScheduledTime = v; await this.plugin.saveSettings(); }));
      }

      new Setting(containerEl).setName(t('settings.syncConfirm')).addToggle(tog => tog
        .setValue(this.plugin.settings.syncConfirm)
        .onChange(async (v: boolean) => { this.plugin.settings.syncConfirm = v; await this.plugin.saveSettings(); }));
    }

    new Setting(containerEl)
      .setName(t('settings.syncNow'))
      .addButton(b => b
        .setButtonText(t('settings.syncNow'))
        .onClick(async () => {
          if (this.plugin.syncManager) await this.plugin.syncManager.syncNow();
        }));

    // ── Dashboard ──
    containerEl.createEl('h2', { text: t('settings.dashboardSection') });

    new Setting(containerEl)
      .setName(t('settings.defaultTab'))
      .addDropdown(d => d
        .addOption('today', t('settings.tabToday'))
        .addOption('week', t('settings.tabWeek'))
        .addOption('history', t('settings.tabHistory'))
        .setValue(this.plugin.settings.dashboardDefaultTab)
        .onChange(async (v: string) => {
          this.plugin.settings.dashboardDefaultTab = v as 'today' | 'week' | 'history';
          await this.plugin.saveSettings();
        }));

    // ── Data Management ──
    containerEl.createEl('h2', { text: t('settings.dataSection') });

    new Setting(containerEl)
      .setName(t('settings.rawRetention'))
      .setDesc(t('settings.rawRetentionDesc'))
      .addDropdown(d => d
        .addOption('30', t('settings.days30'))
        .addOption('60', t('settings.days60'))
        .addOption('90', t('settings.days90'))
        .addOption('-1', t('settings.forever'))
        .setValue(String(this.plugin.settings.rawRetentionDays))
        .onChange(async (v: string) => {
          this.plugin.settings.rawRetentionDays = Number(v) as 30 | 60 | 90 | -1;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName(t('settings.compressNow'))
      .addButton(b => b
        .setButtonText(t('settings.compressNow'))
        .onClick(async () => {
          const days = this.plugin.settings.rawRetentionDays;
          await this.plugin.storage.compressOldDays(days === -1 ? 99999 : days);
          new Notice('MemoTime: Compression complete');
        }));

    new Setting(containerEl)
      .setName(t('settings.exportData'))
      .addButton(b => b
        .setButtonText(t('settings.exportData'))
        .onClick(async () => {
          if (this.plugin.syncManager) await this.plugin.syncManager.exportData();
        }));
  }
}
