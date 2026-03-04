import { Plugin } from 'obsidian';

export default class MemoTimePlugin extends Plugin {
  async onload() {
    console.log('MemoTime loaded');
  }

  onunload() {
    console.log('MemoTime unloaded');
  }
}
