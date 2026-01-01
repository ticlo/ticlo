import {BaseFunction} from '../../block/BlockFunction.js';
import {setSchedule} from '../../util/SetSchedule.js';
import {Block} from '../../block/Block.js';
import type {BlockConfig} from '../../block/BlockProperty.js';
import type {FunctionData} from '../../block/FunctonData.js';
import type {EventType} from '../../block/Event.js';
import type {BlockMode} from '../../block/Descriptor.js';

interface ScheduleListener {
  cancel(): void;
  start: number;
}

class TimeoutListener implements ScheduleListener {
  timeout: any;
  constructor(
    callback: (time: number) => void,
    ms: number,
    public start: number
  ) {
    this.timeout = setTimeout(callback, ms);
  }
  cancel() {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
  }
}

export abstract class AutoUpdateFunction<T extends FunctionData = FunctionData> extends BaseFunction<T> {
  private _schedule: ScheduleListener;
  private _onSchedule = (time: number) => {
    this._schedule = null;
    if (this.onSchedule) {
      this.onSchedule();
    } else {
      if (this._data instanceof Block) {
        this._data._queueFunction();
      }
    }
  };
  onSchedule: () => void;

  private _autoUpdate: boolean;
  private _setAutoUpdate(v: boolean) {
    if (v !== this._autoUpdate && this._data instanceof Block) {
      this._autoUpdate = v;
      if (!v && this._schedule) {
        this._schedule.cancel();
        this._schedule = null;
      }
      return true;
    }
    return false;
  }

  addSchedule(nextCheck: number): ScheduleListener {
    if (this._autoUpdate) {
      if (nextCheck !== this._schedule?.start) {
        this._schedule?.cancel();
        this._schedule = setSchedule(this._onSchedule, nextCheck);
        return this._schedule;
      }
    }
    return null;
  }
  addTimeout(ms: number, start?: number): ScheduleListener {
    if (this._autoUpdate) {
      this._schedule?.cancel();
      this._schedule = new TimeoutListener(this._onSchedule, ms, start);
      return this._schedule;
    }
    return null;
  }
  getSchedule() {
    return this._schedule;
  }

  constructor(data: T) {
    super(data);
    this._autoUpdate = data instanceof Block;
  }

  configChanged(config: BlockConfig, val: unknown): boolean {
    if (config._name === 'mode') {
      return this._setAutoUpdate(config._value == null || config._value === 'auto');
    }
    return false;
  }

  cancel(reason: EventType, mode: BlockMode): boolean {
    if (this._schedule) {
      this._schedule.cancel();
      this._schedule = null;
      return true;
    }
    return false;
  }

  cleanup() {
    this._schedule?.cancel();
    super.cleanup();
  }
  destroy() {
    this._schedule?.cancel();
    super.destroy();
  }
}
