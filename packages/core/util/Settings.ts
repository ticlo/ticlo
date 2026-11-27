import vl from './Validator.ts';
import {DateTime} from 'luxon';

const DEFAULT_MAX_FLOW_DEPTH = 1024;
const startDate = DateTime.now();
export const systemZone = startDate.zoneName;

let timezone: string;
let firstDayOfWeek: number;
let weekDays: Set<number>;
let maxFlowDepth: number;

const settingsListeners = new Set<() => void>();

export function addGlobalSettingsListener(listener: () => void) {
  settingsListeners.add(listener);
}

export function removeGlobalSettingsListener(listener: () => void) {
  settingsListeners.delete(listener);
}

export function updateGlobalSettings(source?: {getValue(field: string): unknown}) {
  const firstDayOfWeekV = source?.getValue('#firstDayOfWeek') as number;
  const nextFirstDayOfWeek =
    Number.isInteger(firstDayOfWeekV) && firstDayOfWeekV >= 1 && firstDayOfWeekV <= 7 ? firstDayOfWeekV : 7;

  const timezoneV = source?.getValue('#timezone') as string;
  const nextTimezone =
    typeof timezoneV === 'string' && timezoneV && timezoneV !== 'Factory' && DateTime.now().setZone(timezoneV).isValid
      ? timezoneV
      : systemZone;

  const weekDaysV = source?.getValue('#weekDays') as number[];
  const nextWeekDaysArr = vl.check(weekDaysV, [vl.num1n(7)]) && weekDaysV.length > 0 ? weekDaysV : [1, 2, 3, 4, 5];
  const nextWeekDays = new Set<number>(nextWeekDaysArr);

  const maxFlowDepthV = source?.getValue('#maxFlowDepth') as number;
  maxFlowDepth = maxFlowDepthV >= 8 ? maxFlowDepthV : DEFAULT_MAX_FLOW_DEPTH;

  const changed =
    nextTimezone !== timezone ||
    nextFirstDayOfWeek !== firstDayOfWeek ||
    !weekDays ||
    nextWeekDays.size !== weekDays.size ||
    nextWeekDaysArr.some((d) => !weekDays.has(d));

  firstDayOfWeek = nextFirstDayOfWeek;
  timezone = nextTimezone;
  weekDays = nextWeekDays;

  if (changed && settingsListeners.size > 0) {
    for (const listener of settingsListeners) {
      listener();
    }
  }
}
updateGlobalSettings();

export function getGlobalSettingsData() {
  return {
    '#timezone': timezone,
    '#firstDayOfWeek': firstDayOfWeek,
    '#weekDays': [...weekDays.values()].sort((a, b) => a - b),
  };
}

export function getDefaultZone() {
  return timezone;
}
export function getFirstDayOfWeek() {
  return firstDayOfWeek;
}
export function isWeekDay(n: number): boolean {
  return weekDays.has(n);
}
export function getMaxFlowDepth() {
  return maxFlowDepth;
}
