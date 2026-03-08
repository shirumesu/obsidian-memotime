import * as fs from 'fs';
import * as path from 'path';
import { Session, RawDayLog, MonthAggregate } from './types';

export class StorageEngine {
  private dataPath: string;

  constructor(dataPath: string) {
    this.dataPath = dataPath;
    this.ensureDirectories();
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

  async readDay(date: string): Promise<RawDayLog> {
    const filePath = this.rawPath(date);
    if (!fs.existsSync(filePath)) {
      return { version: 1, date, sessions: [] };
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as RawDayLog;
  }

  async writeDay(log: RawDayLog): Promise<void> {
    const filePath = this.rawPath(log.date);
    fs.writeFileSync(filePath, JSON.stringify(log, null, 2), 'utf-8');
  }

  async appendSession(date: string, session: Session): Promise<void> {
    const log = await this.readDay(date);
    const existingIdx = log.sessions.findIndex(s => s.id === session.id);
    if (existingIdx >= 0) {
      if (session.duration > log.sessions[existingIdx].duration) {
        log.sessions[existingIdx] = session;
      }
    } else {
      log.sessions.push(session);
    }
    await this.writeDay(log);
  }

  async getTodayTotal(date: string, excludeId?: string): Promise<number> {
    const log = await this.readDay(date);
    return log.sessions
      .filter(s => s.id !== excludeId)
      .reduce((sum, s) => sum + s.duration, 0);
  }

  async getFileTotal(file: string, date: string, excludeId?: string): Promise<number> {
    const log = await this.readDay(date);
    return log.sessions
      .filter(s => s.file === file && s.id !== excludeId)
      .reduce((sum, s) => sum + s.duration, 0);
  }

  async getFolderTotal(folderPath: string, date: string, excludeId?: string): Promise<number> {
    const log = await this.readDay(date);
    const prefix = folderPath.endsWith('/') ? folderPath : folderPath + '/';
    return log.sessions
      .filter(s => (s.file.startsWith(prefix) || s.file === folderPath) && s.id !== excludeId)
      .reduce((sum, s) => sum + s.duration, 0);
  }

  async getFileTotalAllTime(file: string): Promise<number> {
    let total = 0;
    const rawDir = path.join(this.dataPath, 'raw');
    if (fs.existsSync(rawDir)) {
      const files = fs.readdirSync(rawDir).filter((f: string) => f.endsWith('.json'));
      for (const f of files) {
        const date = f.replace('.json', '');
        total += await this.getFileTotal(file, date);
      }
    }
    const aggDir = path.join(this.dataPath, 'agg');
    if (fs.existsSync(aggDir)) {
      const aggFiles = fs.readdirSync(aggDir).filter((f: string) => f.endsWith('.json'));
      for (const af of aggFiles) {
        const content = fs.readFileSync(path.join(aggDir, af), 'utf-8');
        const agg = JSON.parse(content) as MonthAggregate;
        if (agg.files[file]) total += agg.files[file].duration;
      }
    }
    return total;
  }

  async getVaultTotalAllTime(excludeId?: string): Promise<number> {
    let total = 0;
    const rawDir = path.join(this.dataPath, 'raw');
    if (fs.existsSync(rawDir)) {
      const files = fs.readdirSync(rawDir).filter((f: string) => f.endsWith('.json'));
      for (const f of files) {
        const date = f.replace('.json', '');
        total += await this.getTodayTotal(date, excludeId);
      }
    }
    const aggDir = path.join(this.dataPath, 'agg');
    if (fs.existsSync(aggDir)) {
      const aggFiles = fs.readdirSync(aggDir).filter((f: string) => f.endsWith('.json'));
      for (const af of aggFiles) {
        const content = fs.readFileSync(path.join(aggDir, af), 'utf-8');
        const agg = JSON.parse(content) as MonthAggregate;
        for (const daily of Object.values(agg.daily)) {
          total += daily.duration;
        }
      }
    }
    return total;
  }

  async mergeSessions(date: string, remoteSessions: Session[]): Promise<void> {
    if (remoteSessions.length === 0) return;
    const log = await this.readDay(date);
    for (const session of remoteSessions) {
      const existingIdx = log.sessions.findIndex(s => s.id === session.id);
      if (existingIdx >= 0) {
        if (session.duration > log.sessions[existingIdx].duration) {
          log.sessions[existingIdx] = session;
        }
      } else {
        log.sessions.push(session);
      }
    }
    await this.writeDay(log);
  }

  async readMonth(month: string): Promise<MonthAggregate> {
    this.validateMonthString(month);
    const aggPath = path.join(this.dataPath, 'agg', `${month}.json`);
    if (!fs.existsSync(aggPath)) {
      return { version: 1, month, files: {}, daily: {} };
    }
    return JSON.parse(fs.readFileSync(aggPath, 'utf-8')) as MonthAggregate;
  }

  async writeMonth(agg: MonthAggregate): Promise<void> {
    this.validateMonthString(agg.month);
    const aggPath = path.join(this.dataPath, 'agg', `${agg.month}.json`);
    fs.writeFileSync(aggPath, JSON.stringify(agg, null, 2), 'utf-8');
  }

  async compressOldDays(thresholdDays: number): Promise<void> {
    const rawDir = path.join(this.dataPath, 'raw');
    if (!fs.existsSync(rawDir)) return;
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - thresholdDays);
    cutoff.setUTCHours(0, 0, 0, 0);
    const files = fs.readdirSync(rawDir).filter((f: string) => f.endsWith('.json'));
    for (const f of files) {
      const date = f.replace('.json', '');
      const fileDate = new Date(date + 'T00:00:00Z');
      if (fileDate >= cutoff) continue;
      const log = await this.readDay(date);
      if (log.sessions.length === 0) {
        fs.unlinkSync(path.join(rawDir, f));
        continue;
      }
      const month = date.substring(0, 7);
      const agg = await this.readMonth(month);
      for (const session of log.sessions) {
        if (!agg.files[session.file]) {
          agg.files[session.file] = { duration: 0, word_delta: 0, sessions: 0 };
        }
        agg.files[session.file].duration += session.duration;
        agg.files[session.file].word_delta += session.word_delta;
        agg.files[session.file].sessions += 1;
      }
      const dayTotal = log.sessions.reduce((s, sess) => s + sess.duration, 0);
      const dayWords = log.sessions.reduce((s, sess) => s + sess.word_delta, 0);
      if (!agg.daily[date]) {
        agg.daily[date] = { duration: 0, word_delta: 0 };
      }
      agg.daily[date].duration += dayTotal;
      agg.daily[date].word_delta += dayWords;
      await this.writeMonth(agg);
      fs.unlinkSync(path.join(rawDir, f));
    }
  }
}
