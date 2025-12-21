import {DateTime, Info, StringUnitLength} from 'luxon';
import type {GenerateConfig} from '@rc-component/picker/es/generate';

const weekDayFormatMap: {[key: string]: StringUnitLength} = {
  zh_CN: 'narrow',
  zh_TW: 'narrow',
};

const weekDayLengthMap: {[key: string]: number} = {
  en_US: 2,
  en_GB: 2,
};

/**
 * Normalizes part of a moment format string that should
 * not be escaped to a luxon compatible format string.
 *
 * @param part string
 * @returns string
 */
const normalizeFormatPart = (part: string): string =>
  part
    .replace(/Y/g, 'y')
    .replace(/D/g, 'd')
    .replace(/gg/g, 'kk')
    .replace(/Q/g, 'q')
    .replace(/([Ww])o/g, 'WW');

/**
 * Normalizes a moment compatible format string to a luxon compatible format string
 *
 * @param format string
 * @returns string
 */
const normalizeFormat = (format: string): string =>
  format
    // moment escapes strings contained in brackets
    .split(/[[\]]/)
    .map((part, index) => {
      const shouldEscape = index % 2 > 0;

      return shouldEscape ? part : normalizeFormatPart(part);
    })
    // luxon escapes strings contained in single quotes
    .join("'");

/**
 * Normalizes language tags used to luxon compatible
 * language tags by replacing underscores with hyphen-minus.
 *
 * @param locale string
 * @returns string
 */
const normalizeLocale = (locale: string): string => locale.replace(/_/g, '-');

const generateConfig: GenerateConfig<DateTime> = {
  // get
  getNow: () => DateTime.local(),
  getFixedDate: (fixed: string) => DateTime.fromFormat(fixed, 'yyyy-MM-dd'),
  getEndDate: (date: DateTime) => date.endOf('month'),
  getWeekDay: (date: DateTime) => date.weekday,
  getYear: (date: DateTime) => date.year,
  getMonth: (date: DateTime) => date.month - 1, // getMonth should return 0-11, luxon month returns 1-12
  getDate: (date: DateTime) => date.day,
  getHour: (date: DateTime) => date.hour,
  getMinute: (date: DateTime) => date.minute,
  getSecond: (date: DateTime) => date.second,
  getMillisecond: (date: DateTime) => date.millisecond,

  // set
  addYear: (date: DateTime, diff: number) => date.plus({year: diff}),
  addMonth: (date: DateTime, diff: number) => date.plus({month: diff}),
  addDate: (date: DateTime, diff: number) => date.plus({day: diff}),
  setYear: (date: DateTime, year: number) => date.set({year}),
  setMonth: (date: DateTime, month: number) => date.set({month: month + 1}), // setMonth month argument is 0-11, luxon months are 1-12
  setDate: (date: DateTime, day: number) => date.set({day}),
  setHour: (date: DateTime, hour: number) => date.set({hour}),
  setMinute: (date: DateTime, minute: number) => date.set({minute}),
  setSecond: (date: DateTime, second: number) => date.set({second}),
  setMillisecond: (date: DateTime, millisecond: number) => date.set({millisecond}),

  // Compare
  isAfter: (date1: DateTime, date2: DateTime) => date1 > date2,
  isValidate: (date: DateTime) => date.isValid,

  locale: {
    getWeekFirstDate: (locale: string, date: DateTime) => date.setLocale(normalizeLocale(locale)).startOf('week'),
    getWeekFirstDay: (locale: string) => DateTime.local().setLocale(normalizeLocale(locale)).startOf('week').weekday,
    getWeek: (locale: string, date: DateTime) => date.setLocale(normalizeLocale(locale)).weekNumber,
    getShortWeekDays: (locale: string) => {
      const weekdays = Info.weekdays(weekDayFormatMap[locale] || 'short', {
        locale: normalizeLocale(locale),
      });

      const shifted = weekdays.map((weekday) => weekday.slice(0, weekDayLengthMap[locale]));

      // getShortWeekDays should return weekday labels starting from Sunday.
      // luxon returns them starting from Monday, so we have to shift the results.
      shifted.unshift(shifted.pop() as string);

      return shifted;
    },
    getShortMonths: (locale: string) => Info.months('short', {locale: normalizeLocale(locale)}),
    format: (locale: string, date: DateTime, format: string) => {
      if (!date || !date.isValid) {
        return null;
      }

      return date.setLocale(normalizeLocale(locale)).toFormat(normalizeFormat(format));
    },
    parse: (locale: string, text: string, formats: string[]) => {
      for (let i = 0; i < formats.length; i += 1) {
        const normalizedFormat = normalizeFormat(formats[i]);

        const date = DateTime.fromFormat(text, normalizedFormat, {
          locale: normalizeLocale(locale),
        });

        if (date.isValid) {
          return date;
        }
      }

      return null;
    },
  },
};

export default generateConfig;
