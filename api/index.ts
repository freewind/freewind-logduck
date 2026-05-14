import express from 'express';

import { LOG_LEVELS, type LogCreateInput, type LogLevel, type LogQuery } from '../shared/log';
import { deleteLogById, deleteLogs, insertLog, queryLogs } from './logStore';

const PORT = Number.parseInt(process.env.LOG_DOG_PORT ?? '52743', 10);
const HOST = process.env.LOG_DOG_HOST ?? '127.0.0.1';

const app = express();

app.use(express.json({ limit: '2mb' }));

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

const parseTimestamp = (value: unknown) => {
  const text = parseText(value);
  return text && !Number.isNaN(Date.parse(text)) ? text : '';
};

const parseLimit = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) {
    return undefined;
  }

  const limit = Number.parseInt(value, 10);
  return Number.isFinite(limit) && limit > 0 ? limit : undefined;
};

const parseQuery = (query: Record<string, unknown>): LogQuery => ({
  appName: parseOptionalText(query.appName),
  from: parseTimestamp(query.from),
  to: parseTimestamp(query.to),
  level: parseLevel(query.level),
  limit: parseLimit(query.limit),
});

const toCreateInput = (body: Record<string, unknown>): LogCreateInput | null => {
  const appName = parseText(body.appName);
  const timestamp = parseTimestamp(body.timestamp);
  const message = parseText(body.message);
  const level = parseLevel(body.level);
  const details = parseOptionalText(body.details);

  if (!appName || !timestamp || !message || !level) {
    return null;
  }

  return {
    appName,
    timestamp,
    level,
    message,
    details,
  };
};

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, apiPort: PORT, host: HOST });
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
