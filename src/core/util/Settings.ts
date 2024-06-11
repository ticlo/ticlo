import vl from './Validator';
import {DateTime} from 'luxon';

const startDate = DateTime.now();
export const systemZone = startDate.zoneName;

let timezone: string;
let firstDayOfWeek: number;
let weekDays: Set<number>;

export function updateGlobalSettings(source?: {getValue(field: string): unknown}) {
  let firstDayOfWeekV = source?.getValue('firstDayOfWeek') as number;
  let timezoneV = source?.getValue('firstDayOfWeek') as string;
  let weekDaysV = source?.getValue('weekDays') as number[];
  firstDayOfWeek =
    Number.isInteger(firstDayOfWeekV) && firstDayOfWeekV >= 1 && firstDayOfWeekV <= 7 ? firstDayOfWeekV : 7;
  timezone = typeof timezoneV === 'string' ? timezoneV : systemZone;
  weekDaysV = vl.check(weekDays, vl.num1n(7)) ? weekDaysV : [1, 2, 3, 4, 5];
  weekDays = new Set<number>(weekDaysV);
}
updateGlobalSettings();

export function getGlobalSettingsData() {
  return {
    timezone,
    firstDayOfWeek,
    weekDays: [...weekDays.values()].sort(),
  };
}

export function getDefaultZone() {
  return timezone;
}
export function isWeekDay(n: number): boolean {
  return weekDays.has(n);
}
