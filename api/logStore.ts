import { randomUUID } from 'node:crypto';

import type { LogCreateInput, LogLevel, LogQuery, LogRecord } from '../shared/log';

const logs: LogRecord[] = [];

const parseTime = (value: string) => new Date(value).getTime();

const byNewest = (left: LogRecord, right: LogRecord) => parseTime(right.timestamp) - parseTime(left.timestamp);

const matchLevel = (record: LogRecord, level?: LogLevel) => !level || record.level === level;

const matchApp = (record: LogRecord, appName?: string) => !appName || record.appName === appName;

const matchFrom = (record: LogRecord, from?: string) => !from || parseTime(record.timestamp) >= parseTime(from);

const matchTo = (record: LogRecord, to?: string) => !to || parseTime(record.timestamp) <= parseTime(to);

const matchQuery = (record: LogRecord, query: LogQuery) =>
  matchApp(record, query.appName) &&
  matchLevel(record, query.level) &&
  matchFrom(record, query.from) &&
  matchTo(record, query.to);

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
  const counts = new Map<string, number>();

  for (const record of matched) {
    counts.set(record.appName, (counts.get(record.appName) ?? 0) + 1);
  }

  return {
    logs: limited,
    total: matched.length,
    apps: [...counts.entries()]
      .map(([appName, count]) => ({ appName, count }))
      .sort((left, right) => right.count - left.count || left.appName.localeCompare(right.appName)),
  };
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
