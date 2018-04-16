import { Loop } from "./Loop";

export class Event {
  tick: number;
  type: string;

  constructor(type: string = null) {
    this.tick = Loop.tick;
  }

  static isValid(val: any) {
    if (val == null) {
      return false;
    }
    if (val instanceof Event) {
      return val.tick === Loop.tick;
    }
    return true;
  }

}


export class LogicResult extends Event {

  detail: string;

  constructor(type: string = null, detail: string = null) {
    super(type);
    this.detail = detail;
  }

  static isError(val: any) {
    return val instanceof LogicResult && val.type != null;
  }

  // is valid event and not error
  static isValidCall(val: any) {
    if (val == null) {
      return false;
    }

    if (val instanceof Event) {
      if (val instanceof LogicResult && val.type != null) {
        return false;
      }
      return val.tick === Loop.tick;
    }
    return true;
  }
}
