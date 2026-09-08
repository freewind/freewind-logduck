import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { DATA_DIR, logFilePath, nextMs } from './logStore';

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
