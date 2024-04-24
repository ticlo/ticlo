import {FunctionData, ImpureFunction, PureFunction} from '../../block/BlockFunction';
import {Functions} from '../../block/Functions';
import {DateTime} from 'luxon';
import {invalidDate} from '../../util/DateTime';
import type {BlockConfig} from '../../block/BlockProperty';
import {Block} from '../../block/Block';
import {ScheduleEvent, setSchedule} from '../../util/SetSchedule';

const UNIT_OPTIONS = ['year', 'month', 'day', 'hour', 'minute', 'week'] as const;
export type UNIT_TYPE = (typeof UNIT_OPTIONS)[number];

export class CreateDateFunction extends ImpureFunction {
  #schedule: ScheduleEvent;
  #onTimer = (time: number) => {
    this.#schedule = null;
    if (this._data instanceof Block) {
      this._data._queueFunction();
    }
  };

  #autoUpdate: boolean;
  #setAutoUpdate(v: boolean) {
    if (v !== this.#autoUpdate && this._data instanceof Block) {
      this.#autoUpdate = v;
      if (!v && this.#schedule) {
        this.#schedule.cancel();
        this.#schedule = null;
      }
      return true;
    }
    return false;
  }

  constructor(data: FunctionData) {
    super(data);
    this.#autoUpdate = data instanceof Block;
  }

  configChanged(config: BlockConfig, val: unknown): boolean {
    if (config._name === 'mode') {
      return this.#setAutoUpdate(config._value == null || config._value === 'auto');
    }
    return false;
  }

  run() {
    const count = Number(this._data.getValue('count') ?? 1);
    const unit = (this._data.getValue('unit') as UNIT_TYPE) ?? 'day';
    if (count >= 1 && Number.isInteger(count) && UNIT_OPTIONS.includes(unit)) {
      const isPrevious = this._data.getValue('mode') !== 'next';
      const current = Boolean(this._data.getValue('current'));

      const timezone = this._data.getValue('timezone');
      try {
        let now: DateTime = DateTime.now();
        if (typeof timezone === 'string') {
          now = now.setZone(timezone); // convert empty string to undefined
        }
        const start = now.startOf(unit);
        const end = now.endOf(unit);
        const nextCheck = end.valueOf() + 1;
        let dStart = 0;
        let dEnd = 0;
        if (isPrevious) {
          if (!current) {
            dStart -= 1;
            dEnd -= 1;
          }
          dStart -= count - 1;
        } else {
          if (!current) {
            dStart += 1;
            dEnd += 1;
          }
          dStart += count - 1;
        }
        const result = [start.plus({[unit]: dStart}), end.plus({[unit]: dEnd})];
        this._data.output(result);

        if (this.#autoUpdate) {
          if (nextCheck !== this.#schedule?.start) {
            this.#schedule?.cancel();
            this.#schedule = setSchedule(this.#onTimer, nextCheck);
          }
        }

        return;
      } catch (err) {
        // output invalid range
      }
    }
    this._data.output([invalidDate, invalidDate]);
  }
  cleanup() {
    this.#schedule?.cancel();
    super.cleanup();
  }
  destroy() {
    this.#schedule?.cancel();
    super.destroy();
  }
}

Functions.add(
  CreateDateFunction,
  {
    name: 'create-range',
    icon: 'fas:clock',
    priority: 0,
    properties: [
      {name: 'mode', type: 'select', options: ['previous', 'next'], init: 'previous', pinned: true},
      {name: 'current', type: 'toggle', default: false, pinned: true},
      {name: 'count', type: 'number', init: 1, pinned: true},
      {name: 'unit', type: 'select', options: UNIT_OPTIONS as any, init: 'day', pinned: true},
      {name: 'timezone', type: 'string', default: ''},
      {name: '#output', type: 'date-range', pinned: true, readonly: true},
    ],
  },
  'date'
);
