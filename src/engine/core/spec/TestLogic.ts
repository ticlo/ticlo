import { Classes } from "../Class";
import { Logic, LogicData } from "../Logic";


export class TestLogicRunner extends Logic {

  static logs: any[] = [];

  static clearLog() {
    TestLogicRunner.logs.length = 0;
  }

  constructor(block: LogicData) {
    super(block);
  }

  run(): any {
    TestLogicRunner.logs.push(this._data.getValue('@log'));
  }
}

Classes.add('test-runner', TestLogicRunner);