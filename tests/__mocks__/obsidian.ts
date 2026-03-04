export class Plugin {
  app: any = {};
  registerEvent() {}
  addCommand() {}
  addStatusBarItem() {
    return {
      setText: jest.fn(),
      setAttr: jest.fn(),
      addClass: jest.fn(),
      setCssStyles: jest.fn(),
      addEventListener: jest.fn(),
    };
  }
  addRibbonIcon() { return { addClass: jest.fn() }; }
  addSettingTab() {}
  registerInterval() {}
  loadData() { return Promise.resolve({}); }
  saveData() { return Promise.resolve(); }
}
export class TFile {
  path: string = '';
  basename: string = '';
  extension: string = '';
}
export class TFolder {
  path: string = '';
  name: string = '';
  children: any[] = [];
}
export class Notice {
  constructor(_msg: string) {}
}
export class Modal {
  app: any;
  contentEl: HTMLElement = document.createElement('div');
  constructor(app: any) { this.app = app; }
  open() {}
  close() {}
}
export class PluginSettingTab {
  app: any;
  plugin: any;
  containerEl: HTMLElement = document.createElement('div');
  constructor(app: any, plugin: any) { this.app = app; this.plugin = plugin; }
  display() {}
}
export class Setting {
  constructor(_containerEl: HTMLElement) {}
  setName(_name: string) { return this; }
  setDesc(_desc: string) { return this; }
  addToggle(_cb: (t: any) => any) { return this; }
  addText(_cb: (t: any) => any) { return this; }
  addDropdown(_cb: (d: any) => any) { return this; }
  addButton(_cb: (b: any) => any) { return this; }
}
export function normalizePath(p: string) { return p.replace(/\\/g, '/'); }
export function moment() { return { locale: () => 'en' }; }
