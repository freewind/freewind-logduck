import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';

import { logDateOf, todayLogDate } from './logTime';

describe('logDateOf', () => {
  it('extracts YYYYMMDD from a full log timestamp', () => {
    expect(logDateOf('20260514-100000')).toBe('20260514');
  });

  it('passes through an 8-char date', () => {
    expect(logDateOf('20260514')).toBe('20260514');
  });
});

describe('todayLogDate', () => {
  it('returns the current local date as YYYYMMDD', () => {
    expect(todayLogDate()).toBe(dayjs().format('YYYYMMDD'));
  });
});
