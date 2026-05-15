export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

export type LogRecord = {
  id: string;
  appName: string;
  version?: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  details?: string;
};

export type LogCreateInput = {
  appName: string;
  version?: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  details?: string;
};

export type LogQuery = {
  appName?: string;
  version?: string;
  from?: string;
  to?: string;
  level?: LogLevel;
  limit?: number;
  maxFieldLength?: number;
};

export type LogListResponse = {
  apps: Array<{ appName: string; count: number }>;
  versions: VersionListItem[];
  logs: LogRecord[];
  total: number;
};

export type AppListItem = {
  appName: string;
  count: number;
};

export type VersionListItem = {
  version: string;
  count: number;
};
