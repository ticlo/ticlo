import {BaseFunction} from '../../block/BlockFunction.ts';
import type {Block} from '../../block/Block.ts';
import {ErrorEvent, NO_EMIT, ValueUpdateEvent} from '../../block/Event.ts';
import type {LiveEvent, LiveSource, LiveSubscription} from './LiveSource.ts';

/** Subclasses supply the adapter-specific target and can translate event payloads. */
export abstract class SubscribeFunction<Target> extends BaseFunction<Block> {
  private subscription?: LiveSubscription;
  private revision = 0;

  protected abstract target(): Target;

  run() {
    this.cleanup();
    const source = this._data.getValue('client') as LiveSource<Target>;
    if (!source) return NO_EMIT;
    if (typeof source.subscribe !== 'function') throw new Error('Invalid live source');
    const revision = this.revision;
    this.subscription = source.subscribe(this.target(), (event) => {
      if (this.revision === revision) {
        try {
          this.receive(event);
        } catch (error) {
          this._data.emit(new ErrorEvent(ErrorEvent.SyncError, error));
        }
      }
    });
    return NO_EMIT;
  }

  protected receive(event: LiveEvent) {
    if (event.type === 'status') {
      this._data.output(event, 'status');
      return;
    }
    if ('value' in event) this._data.output(event.value);
    else if (event.type === 'remove') this._data.output(undefined);
    this._data.output(event, 'event');
    this._data.emit(new ValueUpdateEvent(event));
  }

  cancel() {
    ++this.revision;
    this.subscription?.close();
    this.subscription = undefined;
    return true;
  }

  cleanup() {
    this.cancel();
    this._data.output(undefined);
    this._data.output(undefined, 'event');
    this._data.output(undefined, 'status');
  }

  destroy() {
    this.cancel();
    super.destroy();
  }
}
