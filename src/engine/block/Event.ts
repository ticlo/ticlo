import { Loop } from "./Loop";

export class Event {
  tick: number;
  type: string;

  constructor(type: string = null) {
    this.tick = Loop.uid;
  }

  static isValid(val: any) {
    if (val == null) {
      return false;
    }
    if (val instanceof Event) {
      return val.tick === Loop.uid;
    }
    return true;
  }

}


export class FunctionResult extends Event {

  detail: string;

  constructor(type: string = null, detail: string = null) {
    super(type);
    this.detail = detail;
  }

  static isError(val: any) {
    return val instanceof FunctionResult && val.type != null;
  }

  // is valid event and not error
  static isValidCall(val: any) {
    if (val == null) {
      return false;
    }

    if (val instanceof Event) {
      if (val instanceof FunctionResult && val.type != null) {
        return false;
      }
      return val.tick === Loop.uid;
    }
    return true;
  }
}
