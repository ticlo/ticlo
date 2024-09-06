import {BaseFunction} from '../../block/BlockFunction';
import {setSchedule} from '../../util/SetSchedule';
import {Block} from '../../block/Block';
import type {BlockConfig} from '../../block/BlockProperty';
import type {FunctionData} from '../../block/FunctonData';
import type {EventType} from '../../block/Event';
import type {BlockMode} from '../../block/Descriptor';

interface ScheduleListener {
  cancel(): void;
  start?: number;
}

class TimeoutListener implements ScheduleListener {
  timeout: any;
  constructor(callback: (time: number) => void, ms: number) {
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
  #schedule: ScheduleListener;
  #onSchedule = (time: number) => {
    this.#schedule = null;
    if (this.onSchedule) {
      this.onSchedule();
    } else {
      if (this._data instanceof Block) {
        this._data._queueFunction();
      }
    }
  };
  onSchedule: () => void;

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

  addSchedule(nextCheck: number): ScheduleListener {
    if (this.#autoUpdate) {
      if (nextCheck !== this.#schedule?.start) {
        this.#schedule?.cancel();
        this.#schedule = setSchedule(this.#onSchedule, nextCheck);
        return this.#schedule;
      }
    }
    return null;
  }
  addTimeout(ms: number): ScheduleListener {
    if (this.#autoUpdate) {
      this.#schedule?.cancel();
      this.#schedule = new TimeoutListener(this.#onSchedule, ms);
      return this.#schedule;
    }
    return null;
  }
  getSchedule() {
    return this.#schedule;
  }

  constructor(data: T) {
    super(data);
    this.#autoUpdate = data instanceof Block;
  }

  configChanged(config: BlockConfig, val: unknown): boolean {
    if (config._name === 'mode') {
      return this.#setAutoUpdate(config._value == null || config._value === 'auto');
    }
    return false;
  }

  cancel(reason: EventType, mode: BlockMode): boolean {
    if (this.#schedule) {
      this.#schedule.cancel();
      this.#schedule = null;
      return true;
    }
    return false;
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
