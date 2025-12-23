import {AutoUpdateFunction} from '../base/AutoUpdateFunction.js';
import {Functions} from '../../block/Functions.js';
import {Event, EventType, NO_EMIT, ValueUpdateEvent, WAIT} from '../../block/Event.js';
import type {Block} from '../../block/Block.js';
import {DateTime} from 'luxon';
import {getZoneObject} from '../../util/DateTime.js';
import {BlockIO} from '../../block/BlockProperty.js';

// interval value in seconds
const MIN_INTERVAL = 0.001;
const DEFAULT_INTERVAL = 1;

const ONE_SECOND = 1000;
const ONE_MINUTE = 60_000;
const FIVE_MINUTES = ONE_MINUTE * 5;
const FIFTEEN_MINUTES = ONE_MINUTE * 15;
const ONE_HOUR = ONE_MINUTE * 60;

export function getNextAlignedMinute(currentTs: number, interval: number, timezone: unknown) {
  let alignedTo = ONE_MINUTE;
  if (interval % ONE_HOUR === 0) {
    alignedTo = ONE_HOUR;
  } else if (ONE_HOUR % interval === 0) {
    alignedTo = interval;
  }
  switch (alignedTo) {
    case ONE_MINUTE:
    // case THREE_MINUTES: // not related to timezone either, but since it's such a rare use case, we can skip it.
    case FIVE_MINUTES:
    case FIFTEEN_MINUTES:
      // these options are unrelated to timezone
      return Math.ceil((currentTs + interval + 1 - alignedTo) / alignedTo) * alignedTo;
  }
  // align to minutes related to current timezone
  let delta = 0;
  try {
    const date = DateTime.fromMillis(currentTs + 1, getZoneObject(timezone));
    delta = date.set({minute: 0, second: 0, millisecond: 0}).valueOf() % alignedTo;
  } catch (err) {}
  return Math.ceil((currentTs - delta + interval + 1 - alignedTo) / alignedTo) * alignedTo + delta;
}

export function getNextAlignedSecond(currentTs: number, interval: number) {
  let alignedTo = ONE_SECOND;
  if (ONE_MINUTE % interval === 0) {
    alignedTo = interval;
  }
  return Math.ceil((currentTs + interval + 1 - alignedTo) / alignedTo) * alignedTo;
}

class TimerFunction extends AutoUpdateFunction<Block> {
  #currentValue = 0;
  onCall(val: unknown): boolean {
    // timer is called, and should increase current value
    this.#scheduleTriggered = false;
    this.#currentValue = 0;
    this._data.output(undefined);
    // clear the timer to start over
    this.cancel(EventType.TRIGGER, null);
    return super.onCall(val);
  }

  #scheduleTriggered = false;
  onSchedule = () => {
    this.#scheduleTriggered = true;
    this._data._queueFunction();
  };

  inputChanged(input: BlockIO, val: unknown): boolean {
    if (input._name === 'paused' && val) {
      /*if*/ this.cancel(EventType.TRIGGER, null);
      // this._data.output(undefined, 'nextTs')

      return false;
    }
    if (input._name === 'interval' || input._name === 'aligned' || input._name === 'timezone') {
      // need to restart the timer
      this.cancel(EventType.TRIGGER, null);
    }
    return true;
  }

  run() {
    if (this._data.getValue('paused')) {
      return NO_EMIT;
    }
    const max = (this._data.getValue('max') as number) || Number.MAX_SAFE_INTEGER;
    const repeat = this._data.getValue('repeat');
    let toEmit: Event = NO_EMIT;

    const currentTs = new Date().getTime();

    if (this.#scheduleTriggered) {
      this.#scheduleTriggered = false;
      ++this.#currentValue;
      if (repeat && this.#currentValue >= max) {
        this.#currentValue = 0;
      }
      this._data.output(this.#currentValue);

      toEmit = new ValueUpdateEvent(this.#currentValue, currentTs);
    }
    if (!repeat && this.#currentValue >= max) {
      // no repeat
      return toEmit;
    }
    let nextTs: number;
    if (!this.getSchedule()) {
      let interval = Math.round(((this._data.getValue('interval') as number) || 1) * 1000);
      if (interval > 0) {
        const aligned = this._data.getValue('aligned');

        if (interval % ONE_MINUTE === 0 && aligned) {
          nextTs = getNextAlignedMinute(currentTs, interval, this._data.getValue('timezone'));
          this.addSchedule(nextTs);
        } else if (interval % ONE_SECOND === 0 && aligned) {
          nextTs = getNextAlignedSecond(currentTs, interval);
          this.addTimeout(nextTs - currentTs, nextTs);
        } else {
          nextTs = currentTs + interval;
          this.addTimeout(interval, nextTs);
        }
        if (toEmit === NO_EMIT) {
          toEmit = WAIT;
        }
      }
    }
    // this._data.output(nextTs, 'nextTs');
    return toEmit;
  }
  cleanup() {
    this._data.output(undefined);
    // this._data.output(undefined, 'nextTs');
    super.cleanup();
  }
}

Functions.add(
  TimerFunction,
  {
    name: 'timer',
    icon: 'fas:stopwatch',
    priority: 2,
    properties: [
      {
        name: 'interval',
        type: 'number',
        min: MIN_INTERVAL,
        init: DEFAULT_INTERVAL,
        default: DEFAULT_INTERVAL,
        unit: 's',
        pinned: true,
      },
      {name: 'aligned', type: 'toggle'},
      {name: 'max', type: 'number', min: 0, max: Number.MAX_SAFE_INTEGER, default: 0},
      {name: 'paused', type: 'toggle'},
      {name: 'repeat', type: 'toggle'},
      {name: 'timezone', type: 'string', default: ''},
      // {name: 'nextTs', type: 'number', readonly: true},
      {name: '#output', type: 'number', readonly: true},
    ],
  },
  'time'
);
