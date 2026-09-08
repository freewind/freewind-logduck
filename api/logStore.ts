import { randomUUID } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { LOG_LEVELS, type LogCreateInput, type LogLevel, type LogQuery, type LogRecord } from '../shared/log';
import { logDateOf, parseLogTime, todayLogDate } from '../shared/logTime';

export const DATA_DIR = path.resolve(process.cwd(), 'data');

const lastMsByFile = new Map<string, number>();

export const nextMs = (now: number, lastMs: number) => Math.max(now, lastMs + 1);

const sanitizePathPart = (value: string) => {
  if (!value || value.includes('/') || value.includes('\\') || value.includes('..')) {
    throw new Error(`invalid_path_part:${value}`);
  }

  return value;
};

const versionPartOf = (version: number | undefined) =>
  version === undefined ? '__none__' : sanitizePathPart(`${version}`);

export const logFilePath = (appName: string, version: number | undefined, date: string) => {
  const app = sanitizePathPart(appName);
  const versionPart = versionPartOf(version);
  const fileName = `${app}-${versionPart}-${sanitizePathPart(date)}.jsonl`;

  return path.join(DATA_DIR, app, versionPart, fileName);
};

const logMs = (record: LogRecord) => record._ms ?? parseLogTime(record.timestamp);

const sortByNewest = (left: LogRecord, right: LogRecord) => logMs(right) - logMs(left);

const levelRank = new Map(LOG_LEVELS.map((level, index) => [level, index]));

const matchLevel = (record: LogRecord, level?: LogLevel) =>
  !level || (levelRank.get(record.level) ?? -1) >= (levelRank.get(level) ?? -1);

const includesKeyword = (value: string | undefined, keyword?: string) =>
  keyword === undefined || value?.toLowerCase().includes(keyword.toLowerCase()) === true;

const matchFrom = (record: LogRecord, from?: string) => !from || parseLogTime(record.timestamp) >= parseLogTime(from);

const matchTo = (record: LogRecord, to?: string) => !to || parseLogTime(record.timestamp) <= parseLogTime(to);

const matchApp = (record: LogRecord, appName?: string) => !appName || record.appName === appName;

const matchVersion = (record: LogRecord, version?: number) => version === undefined || record.version === version;

const matchQuery = (record: LogRecord, query: LogQuery) =>
  matchApp(record, query.appName) &&
  matchVersion(record, query.version) &&
  includesKeyword(record.message, query.messageKeyword) &&
  includesKeyword(record.details, query.detailsKeyword) &&
  matchLevel(record, query.level) &&
  matchFrom(record, query.from) &&
  matchTo(record, query.to);

export const filterAndSortLogs = (records: LogRecord[], query: LogQuery): LogRecord[] =>
  records
    .filter(
      (record) =>
        matchLevel(record, query.level) &&
        includesKeyword(record.message, query.messageKeyword) &&
        includesKeyword(record.details, query.detailsKeyword) &&
        matchFrom(record, query.from) &&
        matchTo(record, query.to),
    )
    .sort(sortByNewest);

const truncateText = (value: string | undefined, maxFieldLength?: number) => {
  if (!value || maxFieldLength === undefined || maxFieldLength === 0 || value.length <= maxFieldLength) {
    return value;
  }

  return value.slice(0, maxFieldLength);
};

const trimLogFields = (record: LogRecord, maxFieldLength?: number): LogRecord => ({
  ...record,
  message: truncateText(record.message, maxFieldLength) ?? '',
  details: truncateText(record.details, maxFieldLength),
});

export const insertLog = (input: LogCreateInput) => {
  const record: LogRecord = {
    ...input,
    id: randomUUID(),
  };

  const filePath = logFilePath(record.appName, record.version, logDateOf(record.timestamp));
  record._ms = nextMs(Date.now(), lastMsByFile.get(filePath) ?? 0);
  lastMsByFile.set(filePath, record._ms);

  mkdirSync(path.dirname(filePath), { recursive: true });
  appendFileSync(filePath, `${JSON.stringify(record)}\n`, 'utf8');

  return record;
};

const readJsonlFile = (filePath: string): LogRecord[] => {
  if (!existsSync(filePath)) {
    return [];
  }

  const records: LogRecord[] = [];

  for (const [index, line] of readFileSync(filePath, 'utf8').split('\n').entries()) {
    if (!line.trim()) {
      continue;
    }

    try {
      records.push(JSON.parse(line) as LogRecord);
    } catch {
      console.warn(`skip_invalid_jsonl:${filePath}:${index + 1}`);
    }
  }

  return records;
};

export const queryLogs = (query: LogQuery) => {
  if (!query.appName) {
    return { logs: [], total: 0 };
  }

  const filePath = logFilePath(query.appName, query.version, query.date ?? todayLogDate());
  const matched = filterAndSortLogs(readJsonlFile(filePath), query);

  return {
    logs: matched.map((record) => trimLogFields(record, query.maxFieldLength)),
    total: matched.length,
  };
};

export const listApps = (): string[] => {
  if (!existsSync(DATA_DIR)) {
    return [];
  }

  return readdirSync(DATA_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
};

const versionDirSort = (left: string, right: string) => {
  const leftNumber = Number(left);
  const rightNumber = Number(right);

  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
    return rightNumber - leftNumber;
  }
  if (Number.isFinite(leftNumber)) {
    return -1;
  }
  if (Number.isFinite(rightNumber)) {
    return 1;
  }

  return left.localeCompare(right);
};

export const listVersions = (appName: string): string[] => {
  if (!appName) {
    return [];
  }

  const appDir = path.join(DATA_DIR, sanitizePathPart(appName));

  if (!existsSync(appDir)) {
    return [];
  }

  return readdirSync(appDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort(versionDirSort);
};

export const dateOfFileName = (fileName: string) => {
  if (!fileName.endsWith('.jsonl')) {
    return undefined;
  }

  const date = fileName.slice(0, -'.jsonl'.length).slice(-8);
  return /^\d{8}$/.test(date) ? date : undefined;
};

export const listDates = (appName: string, version: number | undefined): string[] => {
  const versionDir = !appName ? '' : path.join(DATA_DIR, sanitizePathPart(appName), versionPartOf(version));

  if (!existsSync(versionDir)) {
    return [];
  }

  return readdirSync(versionDir)
    .map((fileName) => dateOfFileName(fileName))
    .filter((date) => date !== undefined)
    .sort()
    .reverse();
};

const listAllLogFiles = (): string[] => {
  if (!existsSync(DATA_DIR)) {
    return [];
  }

  const files: string[] = [];

  for (const app of readdirSync(DATA_DIR, { withFileTypes: true })) {
    if (!app.isDirectory()) {
      continue;
    }

    const appDir = path.join(DATA_DIR, app.name);

    for (const version of readdirSync(appDir, { withFileTypes: true })) {
      if (!version.isDirectory()) {
        continue;
      }

      const versionDir = path.join(appDir, version.name);

      for (const file of readdirSync(versionDir)) {
        if (file.endsWith('.jsonl')) {
          files.push(path.join(versionDir, file));
        }
      }
    }
  }

  return files;
};

const removeDirIfEmpty = (dir: string) => {
  try {
    rmdirSync(dir);
  } catch {
    // 非空目录，保留
  }
};

const rewriteFileWithout = (filePath: string, drop: (record: LogRecord) => boolean): number => {
  const records = readJsonlFile(filePath);
  const keep = records.filter((record) => !drop(record));
  const dropped = records.length - keep.length;

  if (dropped === 0) {
    return 0;
  }

  if (keep.length === 0) {
    unlinkSync(filePath);
    removeDirIfEmpty(path.dirname(filePath));
    removeDirIfEmpty(path.dirname(path.dirname(filePath)));
    return dropped;
  }

  const tmpPath = `${filePath}.tmp`;
  writeFileSync(tmpPath, keep.map((record) => JSON.stringify(record)).join('\n') + '\n', 'utf8');
  renameSync(tmpPath, filePath);

  return dropped;
};

export const deleteLogById = (id: string) => {
  let deleted = 0;

  for (const filePath of listAllLogFiles()) {
    deleted += rewriteFileWithout(filePath, (record) => record.id === id);
  }
  return deleted > 0;
};

export const deleteLogs = (query: LogQuery) => {
  let deleted = 0;

  for (const filePath of listAllLogFiles()) {
    deleted += rewriteFileWithout(filePath, (record) => matchQuery(record, query));
  }

  return deleted;
};
