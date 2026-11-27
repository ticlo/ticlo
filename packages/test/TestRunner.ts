import chalk from 'chalk';
import {FlowTestCase} from './FlowTestCase.ts';
import {FlowTestGroup} from './FlowTestGroup.ts';
import {Resolver} from '@ticlo/core/block/Resolver.ts';
import {Block} from '@ticlo/core';

interface TestTask {
  target: FlowTestCase | FlowTestGroup;
  processed?: boolean;
}

export function normalizeTestFilter(raw: string): string {
  let s = raw.trim().replaceAll('\\', '/');
  if (!s) return '';
  if (s.startsWith('./')) {
    s = s.slice(2);
  }
  if (s.includes('/') || s.endsWith('.ticlo')) {
    if (s.endsWith('.ticlo')) {
      s = s.slice(0, -6);
    }
    s = s.replace(/(^|\/)tests\//, '$1');
    if (s.startsWith('packages/')) {
      s = s.slice('packages/'.length);
    }
    s = s.replaceAll('/', '.');
  }
  if (s.startsWith('tests.')) {
    s = s.slice('tests.'.length);
  }
  return s;
}

export function matchTestFilter(displayPath: string, rawFilter: string): boolean {
  const f = normalizeTestFilter(rawFilter);
  if (!f) return false;
  if (f.includes('*')) {
    const escaped = f.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replaceAll('*', '.*');
    const regex = new RegExp(`^${escaped}$`);
    if (regex.test(displayPath)) {
      return true;
    }
    if (!f.includes('.')) {
      const lastDot = displayPath.lastIndexOf('.');
      const leaf = lastDot >= 0 ? displayPath.slice(lastDot + 1) : displayPath;
      return regex.test(leaf);
    }
    return false;
  }
  return displayPath === f || displayPath.startsWith(`${f}.`) || displayPath.endsWith(`.${f}`);
}

export class TestRunner {
  stack: TestTask[];
  passed = 0;
  failed = 0;
  failedTests: string[] = [];
  readonly filters: string[];

  constructor(
    testGroup: FlowTestGroup,
    public onDone?: () => void,
    public allowEditing: boolean = false,
    filters?: string[]
  ) {
    this.stack = [{target: testGroup, processed: false}];
    this.filters = filters?.filter(Boolean) ?? [];
  }

  getLastTask() {
    if (this.stack.length) {
      return this.stack.at(-1);
    }
    return null;
  }

  printSummary() {
    if (this.filters.length > 0 && this.passed + this.failed === 0) {
      console.error(`${chalk.red('no tests matched filter')}: ${this.filters.join(', ')}`);
      return;
    }
    if (this.failed) {
      console.log(
        `done ${chalk.green(`${this.passed}`)} / ${this.passed + this.failed}, ${chalk.red(`${this.failed} failed`)}`
      );
      console.error('failed tests:');
      for (const name of this.failedTests) {
        console.error(`  ${name}`);
      }
    } else {
      console.log(`done ${chalk.green(`${this.passed} / ${this.passed}`)}`);
    }
  }

  getDisplayPath(block: Block) {
    return block.getFullPath().substring(6);
  }

  onPassed = (testCase: FlowTestCase) => {
    const lastTask = this.getLastTask();
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
    const lastTask = this.getLastTask();
    if (lastTask?.target === testCase) {
      const displayPath = this.getDisplayPath(testCase);
      const details = testCase.getFailureDetails();
      ++this.failed;
      this.failedTests.push(displayPath);
      this.stack.pop();
      Resolver.callLater(this.run);
      console.error(`${chalk.red('test failed')}: ${displayPath}`);
      for (const detail of details) {
        console.error(`  ${detail}`);
      }
      lastTask.target.updateValue('#disabled', true);
    } else if (!this.allowEditing) {
      console.error(`unexpected test failed event: ${this.getDisplayPath(testCase)}`);
    }
  };
  run = () => {
    let lastTask: TestTask;
    while ((lastTask = this.getLastTask())) {
      const {target, processed} = lastTask;
      if (target instanceof FlowTestCase) {
        target.start(this.onPassed, this.onFailed);
        return;
      } else if (target instanceof FlowTestGroup) {
        if (processed) {
          this.stack.pop();
        } else {
          const groups: FlowTestGroup[] = [];
          const testcases: FlowTestCase[] = [];
          target.forEach((field: string, value: unknown) => {
            if (value instanceof FlowTestCase) {
              if (
                this.filters.length === 0 ||
                this.filters.some((f) => matchTestFilter(this.getDisplayPath(value), f))
              ) {
                testcases.push(value);
              }
            } else if (value instanceof FlowTestGroup) {
              groups.push(value);
            }
          });
          for (const group of groups.sort().reverse()) {
            this.stack.push({target: group, processed: false});
          }
          for (const testcase of testcases.sort().reverse()) {
            this.stack.push({target: testcase, processed: false});
          }
          lastTask.processed = true;
        }
      }
    }
    this.printSummary();
    this.onDone?.();
  };
}
