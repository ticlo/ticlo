import {Resolver} from "./Resolver";

export class Event {
  static readonly OK = 0;
  static readonly ERROR = 1;
  static readonly INVALID = 2;

  loopId: string;
  type: string;

  constructor(type?: string) {
    this.type = type;
    this.loopId = Resolver.uid;
  }

  static check(val: any): number {
    if (val == null) {
      return Event.INVALID;
    }
    if (val instanceof Event) {
      return val.check();
    }
    return Event.OK;
  }

  check(): number {
    if (this.loopId === Resolver.uid) {
      return Event.OK;
    }
    return Event.INVALID;
  }
}


export class ErrorEvent extends Event {
  detail: any;

  constructor(type: string = null, detail?: any) {
    super(type);
    this.detail = detail;
  }

  check(): number {
    return Event.ERROR;
  }
}

export class NotReady extends Event {
  constructor() {
    super('notReady');
  }

  // shouldn't trigger the next block
  check(): number {
    return Event.INVALID;
  }
}

export const NOT_READY = new NotReady();