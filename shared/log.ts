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
  _ms?: number;
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
  date?: string;
  maxFieldLength?: number;
};
