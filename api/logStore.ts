import { randomUUID } from 'node:crypto';

import { LOG_LEVELS, type AppListItem, type LogCreateInput, type LogLevel, type LogQuery, type LogRecord, type VersionListItem } from '../shared/log';
import { parseLogTime } from '../shared/logTime';

const logs: LogRecord[] = [];
const MAX_LOGS_PER_APP = 1000;

const byOldest = (left: LogRecord, right: LogRecord) => parseLogTime(left.timestamp) - parseLogTime(right.timestamp);

const levelRank = new Map(LOG_LEVELS.map((level, index) => [level, index]));

const matchLevel = (record: LogRecord, level?: LogLevel) =>
  !level || (levelRank.get(record.level) ?? -1) >= (levelRank.get(level) ?? -1);

const matchApp = (record: LogRecord, appName?: string) => !appName || record.appName === appName;

const matchVersion = (record: LogRecord, version?: number) => version === undefined || record.version === version;

const matchVersionGte = (record: LogRecord, versionGte?: number) =>
  versionGte === undefined || (record.version !== undefined && record.version >= versionGte);

const includesKeyword = (value: string | undefined, keyword?: string) =>
  keyword === undefined || value?.toLowerCase().includes(keyword.toLowerCase()) === true;

const matchFrom = (record: LogRecord, from?: string) => !from || parseLogTime(record.timestamp) >= parseLogTime(from);

const matchTo = (record: LogRecord, to?: string) => !to || parseLogTime(record.timestamp) <= parseLogTime(to);

const matchQuery = (record: LogRecord, query: LogQuery) =>
  matchApp(record, query.appName) &&
  matchVersion(record, query.version) &&
  matchVersionGte(record, query.versionGte) &&
  includesKeyword(record.message, query.messageKeyword) &&
  includesKeyword(record.details, query.detailsKeyword) &&
  matchLevel(record, query.level) &&
  matchFrom(record, query.from) &&
  matchTo(record, query.to);

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

const toVersionList = (counts: Map<string, number>): VersionListItem[] =>
  [...counts.entries()]
    .map(([version, count]) => ({ version: Number(version), count }))
    .sort((left, right) => right.version - left.version);
 

const trimAppLogs = (appName: string) => {
  let count = 0;

  for (let index = 0; index < logs.length; index += 1) {
    if (logs[index]?.appName !== appName) {
      continue;
    }

    count += 1;
    if (count > MAX_LOGS_PER_APP) {
      logs.splice(index, 1);
      index -= 1;
    }
  }
};

export const insertLog = (input: LogCreateInput) => {
  const record: LogRecord = {
    ...input,
    id: randomUUID(),
  };

  logs.unshift(record);
  trimAppLogs(record.appName);

  return record;
};

export const queryLogs = (query: LogQuery) => {
  const matched = logs.filter((record) => matchQuery(record, query)).sort(byOldest);
  const limited = query.limit ? matched.slice(0, query.limit) : matched;

  return {
    logs: limited.map((record) => trimLogFields(record, query.maxFieldLength)),
    total: matched.length,
    apps: listApps(matched),
    versions: listVersions(matched),
  };
};

export const listApps = (source: LogRecord[] = logs): AppListItem[] => {
  const summary = new Map<string, { count: number; versions: Map<string, number> }>();

  for (const record of source) {
    const current = summary.get(record.appName) ?? { count: 0, versions: new Map<string, number>() };
    current.count += 1;

    if (record.version !== undefined) {
      const versionKey = `${record.version}`;
      current.versions.set(versionKey, (current.versions.get(versionKey) ?? 0) + 1);
    }

    summary.set(record.appName, current);
  }

  return [...summary.entries()]
    .map(([appName, item]) => ({
      appName,
      count: item.count,
      versions: toVersionList(item.versions),
    }))
    .sort((left, right) => right.count - left.count || left.appName.localeCompare(right.appName));
};

export const listVersions = (source: LogRecord[] = logs): VersionListItem[] => {
  const counts = new Map<string, number>();

  for (const record of source) {
    if (record.version === undefined) {
      continue;
    }

    const versionKey = `${record.version}`;
    counts.set(versionKey, (counts.get(versionKey) ?? 0) + 1);
  }

  return toVersionList(counts);
};

export const deleteLogById = (id: string) => {
  const index = logs.findIndex((record) => record.id === id);

  if (index < 0) {
    return false;
  }

  logs.splice(index, 1);

  return true;
};

export const deleteLogs = (query: LogQuery) => {
  const before = logs.length;
  const keep = logs.filter((record) => !matchQuery(record, query));

  logs.splice(0, logs.length, ...keep);

  return before - logs.length;
};
