import express from 'express';

import { LOG_LEVELS, type LogCreateInput, type LogLevel, type LogQuery } from '../shared/log';
import { isLogTime } from '../shared/logTime';
import { deleteLogById, deleteLogs, insertLog, listApps, listDates, listVersions, queryLogs } from './logStore';

const PORT = Number.parseInt(process.env.LOG_DOG_PORT ?? '52743', 10);
const HOST = process.env.LOG_DOG_HOST ?? '127.0.0.1';

const app = express();

app.use(express.json({ limit: '2mb' }));

const requestPayload = (req: express.Request): Record<string, unknown> => {
  const payload: Record<string, unknown> = {};

  if (Object.keys(req.query).length) {
    payload.query = req.query;
  }

  if (req.body && typeof req.body === 'object' && Object.keys(req.body).length) {
    Object.assign(payload, req.body);
  }

  return payload;
};

const requestIp = (req: express.Request) => {
  const forwardedFor = req.header('x-forwarded-for')?.split(',')[0]?.trim();
  return forwardedFor || req.ip || req.socket.remoteAddress || 'unknown';
};

app.use((req, _res, next) => {
  console.log(`${req.method} ${req.originalUrl} from ${requestIp(req)} ${JSON.stringify(requestPayload(req))}`);

  next();
});

const parseLevel = (value: unknown): LogLevel | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  return LOG_LEVELS.find((item) => item === value);
};

const parseText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const parseOptionalText = (value: unknown) => {
  const text = parseText(value);
  return text || undefined;
};

const parseOptionalNumber = (value: unknown) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value !== 'string' || !value.trim()) {
    return undefined;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
};

const parseTimestamp = (value: unknown) => {
  const text = parseText(value);
  return text && isLogTime(text) ? text : '';
};

const parseDate = (value: unknown) => {
  const text = parseText(value);
  return /^\d{8}$/.test(text) ? text : undefined;
};

const parseMaxFieldLength = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) {
    return 100;
  }

  const maxFieldLength = Number.parseInt(value, 10);
  return Number.isFinite(maxFieldLength) && maxFieldLength >= 0 ? maxFieldLength : 100;
};

const parseQuery = (query: Record<string, unknown>): LogQuery => ({
  appName: parseOptionalText(query.appName),
  version: parseOptionalNumber(query.version),
  versionGte: parseOptionalNumber(query.versionGte),
  messageKeyword: parseOptionalText(query.messageKeyword),
  detailsKeyword: parseOptionalText(query.detailsKeyword),
  date: parseDate(query.date),
  from: parseTimestamp(query.from),
  to: parseTimestamp(query.to),
  level: parseLevel(query.level),
  maxFieldLength: parseMaxFieldLength(query.maxFieldLength),
});

const toCreateInput = (body: Record<string, unknown>): LogCreateInput | null => {
  const appName = parseText(body.appName);
  const version = parseOptionalNumber(body.version);
  const timestamp = parseTimestamp(body.timestamp);
  const message = parseText(body.message);
  const level = parseLevel(body.level);
  const details = parseOptionalText(body.details);

  if (!appName || !timestamp || !message || !level) {
    return null;
  }

  return {
    appName,
    version,
    timestamp,
    level,
    message,
    details,
  };
};

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, apiPort: PORT, host: HOST });
});

app.get('/api/apps', (_req, res) => {
  res.json({ apps: listApps() });
});

app.get('/api/versions', (req, res) => {
  const appName = typeof req.query.appName === 'string' ? req.query.appName : '';
  res.json({ versions: listVersions(appName) });
});

app.get('/api/dates', (req, res) => {
  const appName = typeof req.query.appName === 'string' ? req.query.appName : '';
  res.json({ dates: appName ? listDates(appName, parseOptionalNumber(req.query.version)) : [] });
});

app.post('/api/logs', (req, res) => {
  const input = toCreateInput(req.body ?? {});

  if (!input) {
    res.status(400).json({
      error: 'invalid_payload',
      required: ['appName', 'timestamp', 'level', 'message'],
    });
    return;
  }

  res.status(201).json(insertLog(input));
});

app.get('/api/logs', (req, res) => {
  res.json(queryLogs(parseQuery(req.query as Record<string, unknown>)));
});

app.delete('/api/logs/:id', (req, res) => {
  const deleted = deleteLogById(req.params.id);

  if (!deleted) {
    res.status(404).json({ error: 'not_found' });
    return;
  }

  res.json({ deleted: 1 });
});

app.delete('/api/logs', (req, res) => {
  const deleted = deleteLogs(parseQuery(req.query as Record<string, unknown>));
  res.json({ deleted });
});

app.listen(PORT, HOST, () => {
  console.log(`Log Dog API listening on http://${HOST}:${PORT}`);
});
