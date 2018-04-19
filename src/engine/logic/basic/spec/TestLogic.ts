import { Classes } from "../../../core/Class";
import { Logic, LogicData } from "../../../core/Logic";
import { LogicDesc } from "../../../core/Descriptor";
import { AddLogic } from "../Math";


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