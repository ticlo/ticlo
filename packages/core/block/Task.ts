import {convertToOutput, DataMap} from '../util/DataTypes.ts';
import {Block} from './Block.ts';
import {ErrorEvent} from './Event.ts';

export class Task {
  // REFACTOR(design.md): MUST release handler references when the task completes or is cancelled.
  _handler: unknown = null;

  attachHandler(handler: unknown): boolean {
    if (this._handler) {
      return false;
    }
    this._handler = handler;
    return true;
  }

  /**
   * Get the raw input element
   */
  getData(): unknown {
    return this;
  }

  /**
   * Get the input structure used by worker
   */
  getDataMap(): unknown {
    return null;
  }

  /**
   * called when the task is resolved, it ignores the keepOrder parameter and called at the order flow is done, not the same order as emitted output
   * @param worker
   * @param output
   */
  // REFACTOR(design.md): MUST release the input and output payloads after resolving the delivery.
  onResolve(worker: Block, output: unknown): DataMap {
    return convertToOutput(output);
  }

  onTimeout(): unknown {
    return new ErrorEvent('timeout');
  }

  // REFACTOR(design.md): MUST cancel owned work and release any retained event payload.
  onCancel(): void {}
}

export class DefaultTask extends Task {
  data: unknown;

  constructor(data: unknown) {
    super();
    this.data = data;
  }

  attachHandler(handler: unknown): boolean {
    return false;
  }

  getData(): unknown {
    return this.data;
  }
  getDataMap(): unknown {
    return this.data;
  }
}
