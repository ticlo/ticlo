import {systemZone} from '../util/DateTime';

export class TicloSettings {
  readonly timezone: string;
  readonly firstDayOfWeek: number;
  constructor(source?: {getValue(field: string): unknown}) {
    let firstDayOfWeek = source?.getValue('firstDayOfWeek') as number;
    let timezone = source?.getValue('firstDayOfWeek') as string;
    this.firstDayOfWeek =
      Number.isInteger(firstDayOfWeek) && firstDayOfWeek >= 1 && firstDayOfWeek <= 7 ? firstDayOfWeek : 7;
    this.timezone = typeof timezone === 'string' ? timezone : systemZone;
  }

  getData() {
    return {
      timezone: this.timezone,
      firstDayOfWeek: this.firstDayOfWeek,
    };
  }
}

let _globalSettings = new TicloSettings();

export function updateGlobalSettings(source: {getValue(field: string): unknown}) {
  _globalSettings = new TicloSettings(source);
}

export function getGlobalSettings() {
  return _globalSettings;
}
