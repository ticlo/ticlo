import {Block} from '../../block/Block.ts';
import {BaseFunction} from '../../block/BlockFunction.ts';
import {NO_EMIT} from '../../block/Event.ts';
import {Library} from '../../block/Library.ts';
import type {FlowStorage} from '../../block/Storage.ts';
import {StorageError, type FileAccess} from '../../storage/FileAccess.ts';

export interface ResolvedFileTarget {
  access: FileAccess;
  path: string;
}

export abstract class BaseFileFunction extends BaseFunction {
  protected revision = 0;
  private abortController?: AbortController;

  protected getStorageContext(): {storage?: FlowStorage; library?: string} {
    const flow = this._data instanceof Block ? this._data._flow : undefined;
    return {
      storage: flow ? Library.rootOf(flow)._storage : undefined,
      library: flow?._library,
    };
  }

  protected isStale(revision: number, controller: AbortController): boolean {
    return revision !== this.revision || !this._data || controller.signal.aborted;
  }

  protected resolveProjectTarget(rawPath: unknown, options?: {allowEmptyRelative?: boolean}): ResolvedFileTarget {
    if (typeof rawPath !== 'string' || !rawPath) {
      throw new StorageError('File path is required', 'invalid-path');
    }
    const {storage, library} = this.getStorageContext();
    if (!storage) {
      throw new StorageError('File storage is not available', 'not-found');
    }
    const target = storage.resolveFileAccess?.(rawPath, library, options);
    if (!target) {
      throw new StorageError('Operation requires a project file path', 'invalid-path');
    }
    return target;
  }

  protected prepare(): unknown {
    return undefined;
  }

  protected clearOutputs(): void {}

  protected abstract execute(signal: AbortSignal, revision: number, controller: AbortController): Promise<void>;

  run(): any {
    const revision = ++this.revision;
    this.abortController?.abort();
    const controller = new AbortController();
    this.abortController = controller;

    if (this.prepare() === NO_EMIT) {
      this.clearOutputs();
      return NO_EMIT;
    }

    return this.execute(controller.signal, revision, controller).catch((error: unknown) => {
      if (this.isStale(revision, controller) || (error as Error)?.name === 'AbortError') {
        return NO_EMIT;
      }
      this.clearOutputs();
      throw error;
    });
  }

  cancel(): boolean {
    ++this.revision;
    this.abortController?.abort();
    this.abortController = undefined;
    return true;
  }

  cleanup(): void {
    this.cancel();
    this.clearOutputs();
  }

  destroy(): void {
    this.cancel();
    super.destroy();
  }
}
