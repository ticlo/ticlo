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
      return val.tick == Loop.tick;
    }
    return true;
  };

}


export class LogicResult extends Event {

  detail: string;

  constructor(type: string = null, detail: string = null) {
    super(type);
    this.detail = detail;
  }

  static isError(input: any) {
    return input instanceof LogicResult && input.type != null;
  }
}