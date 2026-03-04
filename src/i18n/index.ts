import type { App } from 'obsidian';
import { en, type Strings } from './en';
import { zh } from './zh';

let current: Strings = en;

export function setLanguage(lang: 'auto' | 'zh' | 'en', app?: App): void {
  if (lang === 'zh') { current = zh; return; }
  if (lang === 'en') { current = en; return; }
  // auto: read from Obsidian's moment locale
  const locale = (app as any)?.moment?.locale?.() ?? 'en';
  current = locale.startsWith('zh') ? zh : en;
}

type DeepValue<T, K extends string> =
  K extends `${infer Head}.${infer Tail}`
    ? Head extends keyof T ? DeepValue<T[Head], Tail> : never
    : K extends keyof T ? T[K] : never;

export function t(key: string): string {
  const keys = key.split('.');
  let val: any = current;
  for (const k of keys) {
    val = val?.[k];
    if (val === undefined) return key; // fallback to key if missing
  }
  return typeof val === 'string' ? val : key;
}
