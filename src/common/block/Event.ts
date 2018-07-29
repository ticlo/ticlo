import {Resolver} from "./Resolver";

export enum EventType {
  TRIGGER = 0,
  ERROR = 1,
  VOID = 2 // void event should be ignored
}

export class Event {


  loopId: string;
  type: string;

  constructor(type?: string) {
    this.type = type;
    this.loopId = Resolver.uid;
  }

  static check(val: any): EventType {
    if (val == null) {
      return EventType.VOID;
    }
    if (val instanceof Event) {
      return val.check();
    }
    return EventType.TRIGGER;
  }

  check(): number {
    if (this.loopId === Resolver.uid) {
      return EventType.TRIGGER;
    }
    return EventType.VOID;
  }
}


export class ErrorEvent extends Event {
  detail: any;

  constructor(type: string = null, detail?: any) {
    super(type);
    this.detail = detail;
  }

  check(): EventType {
    return EventType.ERROR;
  }
}

export class NotReady extends Event {
  constructor() {
    super('notReady');
  }

  // shouldn't trigger the next block
  check(): EventType {
    return EventType.VOID;
  }
}

export const NOT_READY = new NotReady();