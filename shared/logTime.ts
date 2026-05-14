import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(customParseFormat);

export const LOG_TIME_FORMAT = 'YYYYMMDD-HHmmss';

export const parseLogTime = (value: string) => {
  const parsed = dayjs(value, LOG_TIME_FORMAT, true);
  return parsed.isValid() ? parsed.valueOf() : Number.NaN;
};

export const isLogTime = (value: string) => Number.isFinite(parseLogTime(value));

export const formatLogTime = (value: dayjs.ConfigType) => dayjs(value).format(LOG_TIME_FORMAT);
