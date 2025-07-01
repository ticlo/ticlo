import chalk from 'chalk';
import {FlowTestCase} from './FlowTestCase';
import {FlowTestGroup} from './FlowTestGroup';
import {Resolver} from '@ticlo/core/block/Resolver';
import {Block, BlockIO} from '@ticlo/core';

interface TestTask {
  target: FlowTestCase | FlowTestGroup;
  processed?: boolean;
}

export class TestRunner {
  stack: TestTask[];
  passed = 0;
  failed = 0;

  constructor(
    testGroup: FlowTestGroup,
    public onDone?: () => void,
    public allowEditing: boolean = false
  ) {
    this.stack = [{target: testGroup, processed: false}];
  }

  getLastTask() {
    if (this.stack.length) {
      return this.stack.at(-1);
    }
    if (this.failed) {
      console.log(
        `done ${chalk.green(`${this.passed}`)} / ${this.passed + this.failed}, ${chalk.red(`${this.failed} failed`)}`
      );
    } else {
      console.log(`done ${chalk.green(`${this.passed} / ${this.passed}`)}`);
    }

    return null;
  }

  getDisplayPath(block: Block) {
    return block.getFullPath().substring(6);
  }

  onPassed = (testCase: FlowTestCase) => {
    let lastTask = this.getLastTask();
    if (lastTask?.target === testCase) {
      ++this.passed;
      this.stack.pop();
      Resolver.callLater(this.run);
      console.log(`${chalk.green('test passed')}: ${this.getDisplayPath(testCase)}`);
      lastTask.target.updateValue('#disabled', true);
    } else if (!this.allowEditing) {
      console.error(`unexpected test passed event: ${this.getDisplayPath(testCase)}`);
    }
  };
  onFailed = (testCase: FlowTestCase) => {
    let lastTask = this.getLastTask();
    if (lastTask?.target === testCase) {
      ++this.failed;
      this.stack.pop();
      Resolver.callLater(this.run);
      console.warn(`${chalk.red('test failed')}: ${this.getDisplayPath(testCase)}`);
      lastTask.target.updateValue('#disabled', true);
    } else if (!this.allowEditing) {
      console.error(`unexpected test passed event: ${this.getDisplayPath(testCase)}`);
    }
  };
  run = () => {
    let lastTask: TestTask;
    while ((lastTask = this.getLastTask())) {
      let {target, processed} = lastTask;
      if (target instanceof FlowTestCase) {
        target.start(this.onPassed, this.onFailed);
        return;
      } else if (target instanceof FlowTestGroup) {
        if (processed) {
          this.stack.pop();
        } else {
          let groups: FlowTestGroup[] = [];
          let testcases: FlowTestCase[] = [];
          target.forEach((field: string, value: unknown) => {
            if (value instanceof FlowTestCase) {
              testcases.push(value);
            } else if (value instanceof FlowTestGroup) {
              groups.push(value);
            }
          });
          for (let group of groups.sort().reverse()) {
            this.stack.push({target: group, processed: false});
          }
          for (let testcase of testcases.sort().reverse()) {
            this.stack.push({target: testcase, processed: false});
          }
          lastTask.processed = true;
        }
      }
    }
    this.onDone?.();
  };
}
