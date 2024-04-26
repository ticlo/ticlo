import {Uid} from '../util/Uid';

export enum EventType {
  TRIGGER = 0,
  ERROR = 1,
  VOID = 2, // void event should be ignored
}

export class Event {
  static _uid = new Uid();
  static get uid(): string {
    return Event._uid.current;
  }
  loopId: string;
  constructor(public readonly type: string) {
    this.type = type;
    this.loopId = Event.uid;
  }

  static check(val: unknown): EventType {
    if (val == null || val === false) {
      return EventType.VOID;
    }
    if (val instanceof Event) {
      return val.check();
    }
    return EventType.TRIGGER;
  }

  check(): number {
    if (this.loopId === Event.uid) {
      return EventType.TRIGGER;
    }
    return EventType.VOID;
  }
}

export class ErrorEvent extends Event {
  constructor(
    type: string,
    public readonly detail?: unknown
  ) {
    super(type);
    this.detail = detail;
  }

  check(): EventType {
    return EventType.ERROR;
  }
}

export class WaitEvent extends Event {
  constructor() {
    super('notReady');
  }

  // shouldn't trigger the next block
  check(): EventType {
    return EventType.VOID;
  }
}
export class NoEmit extends Event {
  constructor() {
    super('noEmit');
  }

  // shouldn't trigger the next block
  check(): EventType {
    return EventType.VOID;
  }
}
export class CompleteEvent extends Event {
  constructor() {
    super('complete');
  }
}

export class ValueUpdateEvent extends Event {
  constructor(
    public readonly name: string,
    public readonly value: unknown,
    public readonly ts?: number
  ) {
    super('valueUpdate');
  }
}

export const WAIT = new WaitEvent();
export const NO_EMIT = new NoEmit();
