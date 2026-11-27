import {
  Block,
  BlockIO,
  BlockProperty,
  DataMap,
  DateTime,
  deepEqual,
  encodeDisplay,
  ErrorEvent,
  Flow,
  getInputsArray,
} from '@ticlo/core';
import {ConstTypeConfig} from '@ticlo/core/block/BlockConfigs.ts';
import {FlowConfigGenerators} from '@ticlo/core/block/FlowConfigs.ts';
import {BlockConfig} from '@ticlo/core/block/BlockProperty.ts';
import {updateObjectValue} from '@ticlo/core/property-api/ObjectValue.ts';
import {FlowState} from '@ticlo/core/block/Flow.ts';
import {TestsRunner, TestState} from './Interface.ts';

const MAX_FORMAT_LEN = 300;

function truncateFormatted(str: string): string {
  return str.length > MAX_FORMAT_LEN ? `${str.slice(0, MAX_FORMAT_LEN - 3)}...` : str;
}

export function formatTestValue(val: unknown, depth = 0): string {
  if (val === undefined) {
    return 'undefined';
  }
  if (DateTime.isDateTime(val)) {
    if (val.isValid) {
      return `DateTime(${val.toISO()} [${val.zoneName}])`;
    }
    return `DateTime.invalid(${JSON.stringify(val.invalidReason)})`;
  }
  if (val instanceof ErrorEvent) {
    const detail = val.detail !== undefined ? `: ${formatTestValue(val.detail, depth + 1)}` : '';
    return `ErrorEvent(${val.type}${detail})`;
  }
  if (val instanceof Error) {
    return truncateFormatted(`${val.name}: ${val.message}`);
  }
  if (typeof val === 'string') {
    return truncateFormatted(JSON.stringify(val));
  }
  if (Array.isArray(val) && depth < 3) {
    return truncateFormatted(`[${val.map((v) => formatTestValue(v, depth + 1)).join(', ')}]`);
  }
  try {
    return truncateFormatted(encodeDisplay(val));
  } catch {
    return truncateFormatted(String(val));
  }
}

export const FlowTestConfigGenerators: {[key: string]: typeof BlockProperty} = {
  ...FlowConfigGenerators,
  '#is': ConstTypeConfig('flow:test-case'),
};

export class FlowTestCase extends Flow implements TestsRunner {
  constructor(
    parent: Block,
    property: BlockProperty,
    public timeoutMs: number,
    public testParent?: TestsRunner
  ) {
    super(parent, null, property);
  }

  onPassed: (testcase: FlowTestCase) => void;
  onFailed: (testcase: FlowTestCase) => void;
  start(onPassed?: (testcase: FlowTestCase) => void, onFailed?: (testcase: FlowTestCase) => void) {
    // Set #disabled to true first to clear all the cache.
    this.updateValue('#disabled', true);
    this.onPassed = onPassed;
    this.onFailed = onFailed;
    this.clearTimeout();
    this._timeouted = false;
    if (this.timeoutMs > 0) {
      this._timeout = setTimeout(this.onTimeout, this.timeoutMs);
    }
    this.updateLabel('running');
    this.deleteValue('@b-style');
    // Clear #disabled to restart the test.
    this.updateValue('#disabled', undefined);
  }

  load(
    src: DataMap,
    funcId?: string,
    applyChange?: (flow: Flow) => DataMap,
    onStateChange?: (flow: Flow, state: FlowState) => void
  ): boolean {
    const loaded = super.load(src, funcId, applyChange, onStateChange);
    this.results.clear();
    this.forEach((field: string, value: unknown, prop: BlockIO) => {
      if (value instanceof Block && value.getValue('#is') === 'test:assert') {
        this.results.set(value, TestState.NEW);
      }
    });
    return loaded;
  }

  _createConfig(field: string): BlockProperty {
    if (field in FlowTestConfigGenerators) {
      return new FlowTestConfigGenerators[field](this, field);
    } else {
      return new BlockConfig(this, field);
    }
  }

  results = new Map<Block, TestState>();

  _timeout: any;
  _timeouted = false;
  _pending: any = null;
  updateTestState(testBlock: Block, result: TestState) {
    if (this.results.get(testBlock) === result) {
      return;
    }
    if (result === TestState.REMOVED) {
      this.results.delete(testBlock);
    } else {
      this.results.set(testBlock, result);
    }
    if (!this._pending) {
      this._pending = setTimeout(this.queueFunction, 0);
    }
  }
  // bind _queueFunction with arrow function
  queueFunction = () => {
    this._pending = null;
    if (!this._disabled) {
      this._queueFunction();
    }
  };

  getPriority(): number {
    if (this._controlPriority >= 0) {
      return this._controlPriority;
    }
    return 3;
  }
  run() {
    this._queueToRun = false;
    if (!this._timeouted) {
      const waiting = this.findFirst((field: string, value: unknown, prop: BlockIO) => {
        if (value instanceof Block && value._waiting) {
          // return anything !== undefined is enough
          return true;
        }
      });
      if (waiting) {
        return;
      }
    }
    let passed = 0;
    let failed = 0;
    let waiting = 0;
    for (const [block, state] of this.results) {
      switch (state) {
        case TestState.PASSED: {
          ++passed;
          break;
        }
        case TestState.FAILED: {
          ++failed;
          break;
        }
        case TestState.NEW:
        case TestState.RUNNING: {
          ++waiting;
          break;
        }
        // case TestState.DISABLED:
        default: {
          // void
        }
      }
    }
    if (waiting > 0 && !this._timeouted) {
      return;
    }
    this.clearTimeout();

    if (failed > 0 || this._timeouted) {
      updateObjectValue(this, '@b-style', {color: 'f44'});
      this.updateLabel('failed');
      this.testParent?.updateTestState(this, TestState.FAILED);
      this.onFailed?.(this);
    } else {
      updateObjectValue(this, '@b-style', {color: '4b2'});
      this.updateLabel('passed');
      this.testParent?.updateTestState(this, TestState.PASSED);
      this.onPassed?.(this);
    }
  }
  onTimeout = () => {
    this._timeout = null;
    this._timeouted = true;
    this._queueFunction();
  };
  clearTimeout() {
    if (this._timeout) {
      clearTimeout(this._timeout);
      this._timeout = null;
    }
  }
  destroy() {
    if (this._pending) {
      clearTimeout(this._pending);
      this._pending = null;
    }
    this.clearTimeout();
    this.testParent?.updateTestState(this, TestState.REMOVED);
  }

  updateLabel(stat: string) {
    this.updateValue('#label', `${this._prop._name}-${stat}-#`);
  }

  getFailureDetails(): string[] {
    const details: string[] = [];
    if (this._timeouted) {
      details.push(`timed out after ${this.timeoutMs}ms`);
    }
    const testPath = this.getFullPath();
    for (const [block, state] of this.results) {
      const blockPath = block.getFullPath();
      const assertName = blockPath.startsWith(`${testPath}.`)
        ? blockPath.slice(testPath.length + 1)
        : block._prop._name;
      if (state === TestState.FAILED) {
        const compares = getInputsArray(block, '', 1, ['expect', 'actual']) as {
          expect: unknown;
          actual: unknown;
        }[];
        if (compares.length === 0) {
          details.push(`${assertName}: no assertions configured`);
          continue;
        }
        let recorded = 0;
        for (let i = 0; i < compares.length; ++i) {
          const {expect, actual} = compares[i];
          if (actual !== undefined && !deepEqual(actual, expect)) {
            details.push(`${assertName}[${i}]: expected ${formatTestValue(expect)}, actual ${formatTestValue(actual)}`);
            ++recorded;
          }
        }
        if (recorded === 0) {
          for (let i = 0; i < compares.length; ++i) {
            const faultVal = block.getValue(`fault${i}`);
            if (faultVal !== undefined) {
              details.push(
                `${assertName}[${i}]: expected ${formatTestValue(compares[i].expect)}, actual ${formatTestValue(faultVal)}`
              );
              ++recorded;
            }
          }
        }
        if (recorded === 0) {
          details.push(`${assertName}: assertion failed`);
        }
      } else if (this._timeouted && (state === TestState.NEW || state === TestState.RUNNING)) {
        const compares = getInputsArray(block, '', 1, ['expect', 'actual']) as {
          expect: unknown;
          actual: unknown;
        }[];
        const missing: number[] = [];
        for (let i = 0; i < compares.length; ++i) {
          if (compares[i].actual === undefined) {
            missing.push(i);
          }
        }
        if (missing.length > 0) {
          details.push(`${assertName}: incomplete (${missing.map((i) => `actual${i}`).join(', ')} undefined)`);
        } else {
          details.push(`${assertName}: still ${state === TestState.NEW ? 'not run' : 'running'}`);
        }
      }
    }
    if (this._timeouted) {
      const waitingNames: string[] = [];
      this.forEach((field: string, value: unknown) => {
        if (value instanceof Block && value._waiting) {
          waitingNames.push(field);
        }
      });
      if (waitingNames.length > 0) {
        details.push(`waiting blocks: ${waitingNames.join(', ')}`);
      }
    }
    return details;
  }

  executeCommand(command: string, params: DataMap, readonly = false): DataMap {
    if (readonly) return null;
    switch (command) {
      case 'start': {
        this.start();
        break;
      }
    }
    return null;
  }
}
