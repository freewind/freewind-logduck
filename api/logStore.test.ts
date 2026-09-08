import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { DATA_DIR, dateOfFileName, filterAndSortLogs, logFilePath, nextMs } from './logStore';
import type { LogRecord } from '../shared/log';

describe('nextMs', () => {
  it('increments within the same millisecond', () => {
    expect(nextMs(1000, 1000)).toBe(1001);
  });

  it('uses current time when it advances', () => {
    expect(nextMs(2000, 1000)).toBe(2000);
  });

  it('guards against clock regression', () => {
    expect(nextMs(500, 1000)).toBe(1001);
  });
});

describe('logFilePath', () => {
  it('builds versioned path under DATA_DIR', () => {
    expect(logFilePath('demo-app', 42, '20260514')).toBe(path.join(DATA_DIR, 'demo-app', '42', 'demo-app-42-20260514.jsonl'));
  });

  it('uses __none__ directory for missing version', () => {
    expect(logFilePath('demo-app', undefined, '20260514')).toBe(
      path.join(DATA_DIR, 'demo-app', '__none__', 'demo-app-__none__-20260514.jsonl'),
    );
  });

  it('rejects path traversal in appName', () => {
    expect(() => logFilePath('../evil', 1, '20260514')).toThrow('invalid_path_part');
  });

  it('rejects slash in appName', () => {
    expect(() => logFilePath('a/b', 1, '20260514')).toThrow('invalid_path_part');
  });
});

describe('filterAndSortLogs', () => {
  const records: LogRecord[] = [
    { id: '1', appName: 'app', version: 1, timestamp: '20260514-100001', level: 'info', message: 'login ok', _ms: 1001 },
    { id: '2', appName: 'app', version: 1, timestamp: '20260514-100002', level: 'error', message: 'Login FAILED', details: 'timeout', _ms: 1002 },
    { id: '3', appName: 'app', version: 1, timestamp: '20260514-100003', level: 'debug', message: 'start', _ms: 1003 },
  ];

  it('sorts by _ms descending (newest first)', () => {
    const result = filterAndSortLogs(records, {});
    expect(result.map((record) => record.id)).toEqual(['3', '2', '1']);
  });

  it('filters by level threshold', () => {
    const result = filterAndSortLogs(records, { level: 'warn' });
    expect(result.map((record) => record.id)).toEqual(['2']);
  });

  it('matches message keyword case-insensitively', () => {
    const result = filterAndSortLogs(records, { messageKeyword: 'FAILED' });
    expect(result.map((record) => record.id)).toEqual(['2']);
  });

  it('matches details keyword', () => {
    const result = filterAndSortLogs(records, { detailsKeyword: 'timeout' });
    expect(result.map((record) => record.id)).toEqual(['2']);
  });

  it('filters by from/to time range', () => {
    const result = filterAndSortLogs(records, { from: '20260514-100002', to: '20260514-100002' });
    expect(result.map((record) => record.id)).toEqual(['2']);
  });

  it('falls back to timestamp when _ms missing', () => {
    const noMs: LogRecord[] = records.map(({ _ms, ...record }) => record);
    const result = filterAndSortLogs(noMs, {});
    expect(result.map((record) => record.id)).toEqual(['3', '2', '1']);
  });

  it('keeps file order for same-second fallback ties (stable sort)', () => {
    const sameSecond: LogRecord[] = [
      { id: 'b', appName: 'app', timestamp: '20260514-100000', level: 'info', message: 'second' },
      { id: 'a', appName: 'app', timestamp: '20260514-100000', level: 'info', message: 'first' },
    ];
    const result = filterAndSortLogs(sameSecond, {});
    expect(result.map((record) => record.id)).toEqual(['b', 'a']);
  });
});

describe('dateOfFileName', () => {
  it('extracts date from jsonl file name', () => {
    expect(dateOfFileName('demo-app-42-20260514.jsonl')).toBe('20260514');
  });

  it('extracts date from __none__ file name', () => {
    expect(dateOfFileName('demo-app-__none__-20260515.jsonl')).toBe('20260515');
  });

  it('rejects non-jsonl names', () => {
    expect(dateOfFileName('readme.md')).toBeUndefined();
  });

  it('rejects names without valid date suffix', () => {
    expect(dateOfFileName('demo-app-42-abc.jsonl')).toBeUndefined();
  });
});
