import { Plugin, WorkspaceLeaf, normalizePath, TFile, Notice } from 'obsidian';
import { MemoTimeSettings, DEFAULT_SETTINGS, Session } from './types';
import { StorageEngine } from './storage';
import { Tracker } from './tracker';
import { setLanguage, t } from './i18n';
import { StatusBarManager } from './statusbar';

// Forward declarations for modules implemented in later tasks
// These will be replaced when those modules are implemented
let DashboardView: any;
let DASHBOARD_VIEW_TYPE = 'memotime-dashboard';
let MemoTimeSettingTab: any;
let FileExplorerDecorator: any;
let SyncManager: any;

// Try to import modules that may exist
try { const m = require('./dashboard'); DashboardView = m.DashboardView; DASHBOARD_VIEW_TYPE = m.DASHBOARD_VIEW_TYPE; } catch {}
try { const m = require('./settings'); MemoTimeSettingTab = m.MemoTimeSettingTab; } catch {}
try { const m = require('./fileExplorer'); FileExplorerDecorator = m.FileExplorerDecorator; } catch {}
try { const m = require('./sync'); SyncManager = m.SyncManager; } catch {}

export default class MemoTimePlugin extends Plugin {
  settings: MemoTimeSettings;
  storage: StorageEngine;
  tracker: Tracker;
  statusBar: StatusBarManager;
  decorator: any;
  syncManager: any;

  async onload() {
    await this.loadSettings();
    setLanguage(this.settings.language, this.app);

    const vaultPath = (this.app.vault.adapter as any).basePath ?? '';
    const dataPath = normalizePath(vaultPath + '/' + this.settings.dataPath);
    this.storage = new StorageEngine(dataPath);

    this.tracker = new Tracker(this.settings, async (session: Session, date: string) => {
      await this.storage.appendSession(date, session);
    });

    this.statusBar = new StatusBarManager(this);
    this.statusBar.initialize();

    if (FileExplorerDecorator) {
      this.decorator = new FileExplorerDecorator(this);
    }

    if (SyncManager) {
      this.syncManager = new SyncManager(this);
    }

    if (DashboardView) {
      this.registerView(DASHBOARD_VIEW_TYPE, (leaf: WorkspaceLeaf) => new DashboardView(leaf, this));
    }

    this.addRibbonIcon('clock', t('ribbonTooltip'), async () => {
      if (this.settings.syncMode === 'off') {
        new Notice(t('sync.syncDisabled'));
        return;
      }
      if (this.syncManager) await this.syncManager.syncNow();
    });

    this.addCommand({
      id: 'open-dashboard',
      name: t('commands.openDashboard'),
      callback: () => this.activateDashboard(),
    });

    this.registerEvent(
      this.app.workspace.on('active-leaf-change', (_leaf: WorkspaceLeaf | null) => {
        void this.onLeafChange();
      })
    );

    this.registerEvent(
      this.app.workspace.on('editor-change', (editor: any, _view: any) => {
        this.onEditorChange(editor);
      })
    );

    this.registerInterval(
      window.setInterval(() => { void this.checkTimeout(); }, 30_000)
    );

    // Every second: refresh status bar and checkpoint active session to disk
    // so at most ~1 second of data is lost on crash.
    this.registerInterval(
      window.setInterval(() => {
        if (this.tracker.getActiveSession()) {
          void this.statusBar.refresh();
          const editor = (this.app.workspace as any).activeEditor?.editor;
          const wordCount = editor ? editor.getValue().split(/\s+/).filter(Boolean).length : 0;
          void this.tracker.checkpoint(Date.now() / 1000, wordCount);
        }
      }, 1000)
    );

    if (MemoTimeSettingTab) {
      this.addSettingTab(new MemoTimeSettingTab(this.app, this));
    }

    if (this.settings.syncOnOpen && this.syncManager) {
      await this.syncManager.syncNow({ silent: true });
    }
  }

  async onunload() {
    const editor = (this.app.workspace as any).activeEditor?.editor;
    const wordCount = editor ? editor.getValue().split(/\s+/).filter(Boolean).length : 0;
    await this.tracker.flushCurrent(Date.now() / 1000, wordCount);
    if (this.settings.syncOnClose && this.syncManager) {
      await this.syncManager.syncNow({ silent: true });
    }
  }

  private async onLeafChange(): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    const editor = (this.app.workspace as any).activeEditor?.editor;
    const wordCount = editor ? editor.getValue().split(/\s+/).filter(Boolean).length : 0;
    const filePath = file?.path ?? '';
    await this.tracker.switchFile(filePath, Date.now() / 1000, wordCount);
    await this.statusBar.refresh();
    this.decorator?.refresh?.();
  }

  private onEditorChange(editor: any): void {
    if (this.settings.activityMode !== 'typing') return;
    const file = this.app.workspace.getActiveFile();
    if (!file) return;
    const wordCount = editor.getValue().split(/\s+/).filter(Boolean).length;
    this.tracker.heartbeat(file.path, Date.now() / 1000, wordCount);
    void this.statusBar.refresh();
  }

  private async checkTimeout(): Promise<void> {
    const editor = (this.app.workspace as any).activeEditor?.editor;
    const wordCount = editor ? editor.getValue().split(/\s+/).filter(Boolean).length : 0;
    await this.tracker.checkTimeout(Date.now() / 1000, wordCount);
    await this.statusBar.refresh();
  }

  async activateDashboard(): Promise<void> {
    if (!DashboardView) return;
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(DASHBOARD_VIEW_TYPE)[0];
    if (!leaf) {
      leaf = workspace.getLeaf(true);
      await leaf.setViewState({ type: DASHBOARD_VIEW_TYPE, active: true });
    }
    workspace.revealLeaf(leaf);
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    this.tracker?.updateSettings(this.settings);
    void this.statusBar?.refresh();
    this.decorator?.refresh?.();
  }
}
