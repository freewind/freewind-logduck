import { randomUUID } from 'node:crypto';

import type { AppListItem, LogCreateInput, LogLevel, LogQuery, LogRecord } from '../shared/log';
import { parseLogTime } from '../shared/logTime';

const logs: LogRecord[] = [];

const byNewest = (left: LogRecord, right: LogRecord) => parseLogTime(right.timestamp) - parseLogTime(left.timestamp);

const matchLevel = (record: LogRecord, level?: LogLevel) => !level || record.level === level;

const matchApp = (record: LogRecord, appName?: string) => !appName || record.appName === appName;

const matchFrom = (record: LogRecord, from?: string) => !from || parseLogTime(record.timestamp) >= parseLogTime(from);

const matchTo = (record: LogRecord, to?: string) => !to || parseLogTime(record.timestamp) <= parseLogTime(to);

const matchQuery = (record: LogRecord, query: LogQuery) =>
  matchApp(record, query.appName) &&
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

export const insertLog = (input: LogCreateInput) => {
  const record: LogRecord = {
    ...input,
    id: randomUUID(),
  };

  logs.unshift(record);

  return record;
};

export const queryLogs = (query: LogQuery) => {
  const matched = logs.filter((record) => matchQuery(record, query)).sort(byNewest);
  const limited = query.limit ? matched.slice(0, query.limit) : matched;

  return {
    logs: limited.map((record) => trimLogFields(record, query.maxFieldLength)),
    total: matched.length,
    apps: listApps(matched),
  };
};

export const listApps = (source: LogRecord[] = logs): AppListItem[] => {
  const counts = new Map<string, number>();

  for (const record of source) {
    counts.set(record.appName, (counts.get(record.appName) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([appName, count]) => ({ appName, count }))
    .sort((left, right) => right.count - left.count || left.appName.localeCompare(right.appName));
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
