import {systemZone} from './DateTime';
import vl from './Validator';

export class Settings {
  readonly timezone: string;
  readonly firstDayOfWeek: number;
  readonly workDays: Set<number>;
  constructor(source?: {getValue(field: string): unknown}) {
    let firstDayOfWeek = source?.getValue('firstDayOfWeek') as number;
    let timezone = source?.getValue('firstDayOfWeek') as string;
    let workDays = source?.getValue('workDays') as number[];
    this.firstDayOfWeek =
      Number.isInteger(firstDayOfWeek) && firstDayOfWeek >= 1 && firstDayOfWeek <= 7 ? firstDayOfWeek : 7;
    this.timezone = typeof timezone === 'string' ? timezone : systemZone;
    workDays = vl.check(workDays, vl.num1n(7)) ? workDays : [1, 2, 3, 4, 5];
    this.workDays = new Set<number>(workDays);
  }

  getData() {
    return {
      timezone: this.timezone,
      firstDayOfWeek: this.firstDayOfWeek,
      workDays: [...this.workDays.values()].sort(),
    };
  }
}

let _globalSettings = new Settings();

export function updateGlobalSettings(source: {getValue(field: string): unknown}) {
  _globalSettings = new Settings(source);
}

export function getGlobalSettings() {
  return _globalSettings;
}
