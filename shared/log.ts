export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

export type LogRecord = {
  id: string;
  appName: string;
  version?: number;
  timestamp: string;
  level: LogLevel;
  message: string;
  details?: string;
};

export type LogCreateInput = {
  appName: string;
  version?: number;
  timestamp: string;
  level: LogLevel;
  message: string;
  details?: string;
};

export type LogQuery = {
  appName?: string;
  version?: number;
  versionGte?: number;
  messageKeyword?: string;
  detailsKeyword?: string;
  from?: string;
  to?: string;
  level?: LogLevel;
  limit?: number;
  maxFieldLength?: number;
};

export type LogListResponse = {
  apps: AppListItem[];
  versions: VersionListItem[];
  levels: LevelListItem[];
  logs: LogRecord[];
  total: number;
};

export type AppListItem = {
  appName: string;
  count: number;
  versions: VersionListItem[];
  levels: LevelListItem[];
};

export type VersionListItem = {
  version: number;
  count: number;
  levels: LevelListItem[];
};

export type LevelListItem = {
  level: LogLevel;
  count: number;
};
