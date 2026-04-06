import * as fs from 'fs';
import { promises as fsp } from 'fs';
import * as path from 'path';
import { Session, RawDayLog, MonthAggregate } from './types';

type IndexedSession = {
  date: string;
  session: Session;
};

function cloneSession(session: Session): Session {
  return { ...session };
}

function cloneRawDayLog(log: RawDayLog): RawDayLog {
  return {
    version: log.version,
    date: log.date,
    sessions: log.sessions.map(cloneSession),
  };
}

function cloneMonthAggregate(agg: MonthAggregate): MonthAggregate {
  return {
    version: agg.version,
    month: agg.month,
    files: Object.fromEntries(
      Object.entries(agg.files).map(([file, stats]) => [file, { ...stats }])
    ),
    daily: Object.fromEntries(
      Object.entries(agg.daily).map(([date, stats]) => [date, { ...stats }])
    ),
  };
}

export class StorageEngine {
  private dataPath: string;
  private readyPromise: Promise<void>;
  private mutationQueue: Promise<void> = Promise.resolve();

  private rawDayCache = new Map<string, RawDayLog>();
  private monthCache = new Map<string, MonthAggregate>();
  private sessionIndex = new Map<string, IndexedSession>();

  private dayTotals = new Map<string, number>();
  private fileDayTotals = new Map<string, Map<string, number>>();
  private folderDayTotals = new Map<string, Map<string, number>>();

  private fileAllTimeTotals = new Map<string, number>();
  private folderAllTimeTotals = new Map<string, number>();
  private vaultAllTimeTotal = 0;

  constructor(dataPath: string) {
    this.dataPath = dataPath;
    this.ensureDirectories();
    this.readyPromise = this.initializeIndexes();
  }

  private ensureDirectories(): void {
    const rawDir = path.join(this.dataPath, 'raw');
    const aggDir = path.join(this.dataPath, 'agg');
    if (!fs.existsSync(rawDir)) fs.mkdirSync(rawDir, { recursive: true });
    if (!fs.existsSync(aggDir)) fs.mkdirSync(aggDir, { recursive: true });
  }

  private validateDateString(date: string): void {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error(`Invalid date string: ${date}`);
    }
  }

  private validateMonthString(month: string): void {
    if (!/^\d{4}-\d{2}$/.test(month)) {
      throw new Error(`Invalid month string: ${month}`);
    }
  }

  private rawPath(date: string): string {
    this.validateDateString(date);
    return path.join(this.dataPath, 'raw', `${date}.json`);
  }

  private monthPath(month: string): string {
    this.validateMonthString(month);
    return path.join(this.dataPath, 'agg', `${month}.json`);
  }

  private async initializeIndexes(): Promise<void> {
    const rawDir = path.join(this.dataPath, 'raw');
    const aggDir = path.join(this.dataPath, 'agg');

    const rawFiles = (await fsp.readdir(rawDir)).filter((file) => file.endsWith('.json'));
    for (const file of rawFiles) {
      const date = file.replace('.json', '');
      const log = await this.readDayFromDisk(date);
      this.rawDayCache.set(date, log);
      this.applyRawDayDelta(date, log, 1);
    }

    const aggFiles = (await fsp.readdir(aggDir)).filter((file) => file.endsWith('.json'));
    for (const file of aggFiles) {
      const month = file.replace('.json', '');
      const agg = await this.readMonthFromDisk(month);
      this.monthCache.set(month, agg);
      this.applyMonthDelta(agg, 1);
    }
  }

  private async ready(): Promise<void> {
    await this.readyPromise;
  }

  private async enqueueMutation<T>(task: () => Promise<T>): Promise<T> {
    await this.ready();

    const previous = this.mutationQueue;
    let release = () => {};
    this.mutationQueue = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous;
    try {
      return await task();
    } finally {
      release();
    }
  }

  private async readDayFromDisk(date: string): Promise<RawDayLog> {
    const filePath = this.rawPath(date);
    if (!fs.existsSync(filePath)) {
      return { version: 1, date, sessions: [] };
    }
    const content = await fsp.readFile(filePath, 'utf-8');
    return JSON.parse(content) as RawDayLog;
  }

  private async writeDayToDisk(log: RawDayLog): Promise<void> {
    await fsp.writeFile(this.rawPath(log.date), JSON.stringify(log, null, 2), 'utf-8');
  }

  private async readMonthFromDisk(month: string): Promise<MonthAggregate> {
    const aggPath = this.monthPath(month);
    if (!fs.existsSync(aggPath)) {
      return { version: 1, month, files: {}, daily: {} };
    }
    return JSON.parse(await fsp.readFile(aggPath, 'utf-8')) as MonthAggregate;
  }

  private async writeMonthToDisk(agg: MonthAggregate): Promise<void> {
    await fsp.writeFile(this.monthPath(agg.month), JSON.stringify(agg, null, 2), 'utf-8');
  }

  private listFolderPrefixes(filePath: string): string[] {
    const segments = filePath.split('/');
    const folders: string[] = [];
    for (let i = 1; i < segments.length; i++) {
      folders.push(segments.slice(0, i).join('/'));
    }
    return folders;
  }

  private matchesFolder(filePath: string, folderPath: string): boolean {
    const prefix = folderPath.endsWith('/') ? folderPath : `${folderPath}/`;
    return filePath === folderPath || filePath.startsWith(prefix);
  }

  private adjustTotal(map: Map<string, number>, key: string, delta: number): void {
    if (!key || delta === 0) return;
    const next = (map.get(key) ?? 0) + delta;
    if (next <= 0) {
      map.delete(key);
      return;
    }
    map.set(key, next);
  }

  private adjustNestedTotal(index: Map<string, Map<string, number>>, outerKey: string, innerKey: string, delta: number): void {
    if (!outerKey || !innerKey || delta === 0) return;
    const bucket = index.get(outerKey) ?? new Map<string, number>();
    const next = (bucket.get(innerKey) ?? 0) + delta;
    if (next <= 0) {
      bucket.delete(innerKey);
    } else {
      bucket.set(innerKey, next);
    }
    if (bucket.size === 0) {
      index.delete(outerKey);
    } else {
      index.set(outerKey, bucket);
    }
  }

  private applyRawDayDelta(date: string, log: RawDayLog, direction: 1 | -1): void {
    for (const session of log.sessions) {
      const delta = direction * session.duration;
      this.adjustTotal(this.dayTotals, date, delta);
      this.adjustNestedTotal(this.fileDayTotals, date, session.file, delta);
      for (const folder of this.listFolderPrefixes(session.file)) {
        this.adjustNestedTotal(this.folderDayTotals, date, folder, delta);
      }

      this.adjustTotal(this.fileAllTimeTotals, session.file, delta);
      for (const folder of this.listFolderPrefixes(session.file)) {
        this.adjustTotal(this.folderAllTimeTotals, folder, delta);
      }
      this.vaultAllTimeTotal += delta;

      if (direction === 1) {
        this.sessionIndex.set(session.id, { date, session: cloneSession(session) });
      } else {
        this.sessionIndex.delete(session.id);
      }
    }
  }

  private applyMonthDelta(agg: MonthAggregate, direction: 1 | -1): void {
    for (const [file, stats] of Object.entries(agg.files)) {
      const delta = direction * stats.duration;
      this.adjustTotal(this.fileAllTimeTotals, file, delta);
      for (const folder of this.listFolderPrefixes(file)) {
        this.adjustTotal(this.folderAllTimeTotals, folder, delta);
      }
    }

    for (const stats of Object.values(agg.daily)) {
      this.vaultAllTimeTotal += direction * stats.duration;
    }
  }

  private replaceRawDay(date: string, nextLog: RawDayLog): void {
    const currentLog = this.rawDayCache.get(date);
    if (currentLog) {
      this.applyRawDayDelta(date, currentLog, -1);
    }
    if (nextLog.sessions.length === 0) {
      this.rawDayCache.delete(date);
      return;
    }
    const clonedLog = cloneRawDayLog(nextLog);
    this.rawDayCache.set(date, clonedLog);
    this.applyRawDayDelta(date, clonedLog, 1);
  }

  private replaceMonth(month: string, nextAgg: MonthAggregate): void {
    const currentAgg = this.monthCache.get(month);
    if (currentAgg) {
      this.applyMonthDelta(currentAgg, -1);
    }
    const clonedAgg = cloneMonthAggregate(nextAgg);
    this.monthCache.set(month, clonedAgg);
    this.applyMonthDelta(clonedAgg, 1);
  }

  private findExcludedSession(excludeId?: string): IndexedSession | null {
    if (!excludeId) return null;
    return this.sessionIndex.get(excludeId) ?? null;
  }

  async readDay(date: string): Promise<RawDayLog> {
    await this.ready();
    return cloneRawDayLog(this.rawDayCache.get(date) ?? { version: 1, date, sessions: [] });
  }

  async writeDay(log: RawDayLog): Promise<void> {
    await this.enqueueMutation(async () => {
      const nextLog = cloneRawDayLog(log);
      await this.writeDayToDisk(nextLog);
      this.replaceRawDay(log.date, nextLog);
    });
  }

  async appendSession(date: string, session: Session): Promise<void> {
    await this.enqueueMutation(async () => {
      const currentLog = cloneRawDayLog(this.rawDayCache.get(date) ?? { version: 1, date, sessions: [] });
      const existingIdx = currentLog.sessions.findIndex((entry) => entry.id === session.id);

      if (existingIdx >= 0) {
        if (session.duration <= currentLog.sessions[existingIdx].duration) {
          return;
        }
        currentLog.sessions[existingIdx] = cloneSession(session);
      } else {
        currentLog.sessions.push(cloneSession(session));
      }

      await this.writeDayToDisk(currentLog);
      this.replaceRawDay(date, currentLog);
    });
  }

  async getTodayTotal(date: string, excludeId?: string): Promise<number> {
    await this.ready();
    const total = this.dayTotals.get(date) ?? 0;
    const excluded = this.findExcludedSession(excludeId);
    if (!excluded || excluded.date !== date) return total;
    return total - excluded.session.duration;
  }

  async getFileTotal(file: string, date: string, excludeId?: string): Promise<number> {
    await this.ready();
    const total = this.fileDayTotals.get(date)?.get(file) ?? 0;
    const excluded = this.findExcludedSession(excludeId);
    if (!excluded || excluded.date !== date || excluded.session.file !== file) return total;
    return total - excluded.session.duration;
  }

  async getFolderTotal(folderPath: string, date: string, excludeId?: string): Promise<number> {
    await this.ready();
    const total = this.folderDayTotals.get(date)?.get(folderPath) ?? 0;
    const excluded = this.findExcludedSession(excludeId);
    if (!excluded || excluded.date !== date || !this.matchesFolder(excluded.session.file, folderPath)) return total;
    return total - excluded.session.duration;
  }

  async getFileTotalAllTime(file: string): Promise<number> {
    await this.ready();
    return this.fileAllTimeTotals.get(file) ?? 0;
  }

  async getFolderTotalAllTime(folderPath: string): Promise<number> {
    await this.ready();
    return this.folderAllTimeTotals.get(folderPath) ?? 0;
  }

  async getStatusBarTotals(
    date: string,
    filePath: string | null,
    folderPath: string | null,
    excludeId?: string
  ): Promise<{ today: number; file: number; folder: number; vault_all: number }> {
    await this.ready();

    const today = await this.getTodayTotal(date, excludeId);
    const file = filePath ? await this.getFileTotal(filePath, date, excludeId) : 0;
    const folder = folderPath ? await this.getFolderTotal(folderPath, date, excludeId) : 0;
    const vault_all = await this.getVaultTotalAllTime(excludeId);

    return { today, file, folder, vault_all };
  }

  async getVaultTotalAllTime(excludeId?: string): Promise<number> {
    await this.ready();
    const excluded = this.findExcludedSession(excludeId);
    return this.vaultAllTimeTotal - (excluded?.session.duration ?? 0);
  }

  async mergeSessions(date: string, remoteSessions: Session[]): Promise<void> {
    if (remoteSessions.length === 0) return;

    await this.enqueueMutation(async () => {
      const nextLog = cloneRawDayLog(this.rawDayCache.get(date) ?? { version: 1, date, sessions: [] });
      let changed = false;

      for (const session of remoteSessions) {
        const existingIdx = nextLog.sessions.findIndex((entry) => entry.id === session.id);
        if (existingIdx >= 0) {
          if (session.duration > nextLog.sessions[existingIdx].duration) {
            nextLog.sessions[existingIdx] = cloneSession(session);
            changed = true;
          }
        } else {
          nextLog.sessions.push(cloneSession(session));
          changed = true;
        }
      }

      if (!changed) return;

      await this.writeDayToDisk(nextLog);
      this.replaceRawDay(date, nextLog);
    });
  }

  async readMonth(month: string): Promise<MonthAggregate> {
    await this.ready();
    return cloneMonthAggregate(this.monthCache.get(month) ?? { version: 1, month, files: {}, daily: {} });
  }

  async writeMonth(agg: MonthAggregate): Promise<void> {
    await this.enqueueMutation(async () => {
      const nextAgg = cloneMonthAggregate(agg);
      await this.writeMonthToDisk(nextAgg);
      this.replaceMonth(agg.month, nextAgg);
    });
  }

  async compressOldDays(thresholdDays: number): Promise<void> {
    await this.enqueueMutation(async () => {
      const cutoff = new Date();
      cutoff.setUTCDate(cutoff.getUTCDate() - thresholdDays);
      cutoff.setUTCHours(0, 0, 0, 0);

      const dates = [...this.rawDayCache.keys()].sort();
      for (const date of dates) {
        const fileDate = new Date(`${date}T00:00:00Z`);
        if (fileDate >= cutoff) continue;

        const log = cloneRawDayLog(this.rawDayCache.get(date) ?? { version: 1, date, sessions: [] });
        const rawFilePath = this.rawPath(date);

        if (log.sessions.length === 0) {
          if (fs.existsSync(rawFilePath)) {
            await fsp.unlink(rawFilePath);
          }
          this.replaceRawDay(date, log);
          continue;
        }

        const month = date.substring(0, 7);
        const nextAgg = cloneMonthAggregate(
          this.monthCache.get(month) ?? { version: 1, month, files: {}, daily: {} }
        );

        for (const session of log.sessions) {
          if (!nextAgg.files[session.file]) {
            nextAgg.files[session.file] = { duration: 0, word_delta: 0, sessions: 0 };
          }
          nextAgg.files[session.file].duration += session.duration;
          nextAgg.files[session.file].word_delta += session.word_delta;
          nextAgg.files[session.file].sessions += 1;
        }

        const dayTotal = log.sessions.reduce((sum, session) => sum + session.duration, 0);
        const dayWords = log.sessions.reduce((sum, session) => sum + session.word_delta, 0);
        if (!nextAgg.daily[date]) {
          nextAgg.daily[date] = { duration: 0, word_delta: 0 };
        }
        nextAgg.daily[date].duration += dayTotal;
        nextAgg.daily[date].word_delta += dayWords;

        await this.writeMonthToDisk(nextAgg);
        if (fs.existsSync(rawFilePath)) {
          await fsp.unlink(rawFilePath);
        }

        this.replaceMonth(month, nextAgg);
        this.replaceRawDay(date, { version: 1, date, sessions: [] });
      }
    });
  }
}
