import vl from './Validator';
import {DateTime} from 'luxon';

const DEFAULT_MAX_FLOW_DEPTH = 1024;
const startDate = DateTime.now();
export const systemZone = startDate.zoneName;

let timezone: string;
let firstDayOfWeek: number;
let weekDays: Set<number>;
let maxFlowDepth: number;

export function updateGlobalSettings(source?: {getValue(field: string): unknown}) {
  let firstDayOfWeekV = source?.getValue('#firstDayOfWeek') as number;
  firstDayOfWeek =
    Number.isInteger(firstDayOfWeekV) && firstDayOfWeekV >= 1 && firstDayOfWeekV <= 7 ? firstDayOfWeekV : 7;

  let timezoneV = source?.getValue('#timezone') as string;
  timezone = typeof timezoneV === 'string' ? timezoneV : systemZone;

  let weekDaysV = source?.getValue('#weekDays') as number[];
  weekDaysV = vl.check(weekDays, vl.num1n(7)) ? weekDaysV : [1, 2, 3, 4, 5];
  weekDays = new Set<number>(weekDaysV);

  let maxFlowDepthV = source?.getValue('#maxFlowDepth') as number;
  maxFlowDepth = maxFlowDepthV >= 8 ? maxFlowDepthV : DEFAULT_MAX_FLOW_DEPTH;
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
export function getMaxFlowDepth() {
  return maxFlowDepth;
}
