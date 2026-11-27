import {StatefulFunction, globalFunctions, NO_EMIT, ValueUpdateEvent} from '@ticlo/core';
import './SystemCategory.ts';

export const SYSTEM_SIGNALS = ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGUSR1', 'SIGUSR2'] as const;
export type SystemSignal = (typeof SYSTEM_SIGNALS)[number];

const validSignals: ReadonlySet<string> = new Set(SYSTEM_SIGNALS);
const defaultSignals: readonly SystemSignal[] = ['SIGTERM', 'SIGINT'];

interface SignalRegistryEntry {
  listeners: Set<(signal: SystemSignal) => void>;
  processHandler: () => void;
}

const signalRegistry = new Map<SystemSignal, SignalRegistryEntry>();

function subscribeSignal(signal: SystemSignal, listener: (signal: SystemSignal) => void) {
  let entry = signalRegistry.get(signal);
  if (!entry) {
    const listeners = new Set<(signal: SystemSignal) => void>();
    const processHandler = () => {
      for (const cb of [...listeners]) {
        cb(signal);
      }
    };
    entry = {listeners, processHandler};
    signalRegistry.set(signal, entry);
    try {
      process.on(signal, processHandler);
    } catch {
      signalRegistry.delete(signal);
      return;
    }
  }
  entry.listeners.add(listener);
}

function unsubscribeSignal(signal: SystemSignal, listener: (signal: SystemSignal) => void) {
  const entry = signalRegistry.get(signal);
  if (!entry) return;
  entry.listeners.delete(listener);
  if (entry.listeners.size === 0) {
    signalRegistry.delete(signal);
    try {
      process.off(signal, entry.processHandler);
    } catch {
      // ignore unsupported signal cleanup errors
    }
  }
}

class SignalFunction extends StatefulFunction {
  private _subscribed = new Set<SystemSignal>();
  private _pendingSignals: {signal: SystemSignal; timestamp: number}[] = [];

  private _onSignal = (signal: SystemSignal) => {
    if (!this._data) return;
    this._pendingSignals.push({signal, timestamp: Date.now()});
    this._data._queueFunction();
  };

  private _onSignalsChange(val: unknown): boolean {
    const requested =
      val === undefined
        ? defaultSignals
        : Array.isArray(val)
          ? val.filter((s): s is SystemSignal => typeof s === 'string' && validSignals.has(s))
          : [];
    const next = new Set<SystemSignal>(requested);
    for (const signal of this._subscribed) {
      if (!next.has(signal)) {
        unsubscribeSignal(signal, this._onSignal);
      }
    }
    for (const signal of next) {
      if (!this._subscribed.has(signal)) {
        subscribeSignal(signal, this._onSignal);
      }
    }
    this._subscribed = next;
    return false;
  }

  static readonly inputMap: Map<string, (this: StatefulFunction, val: unknown) => boolean> = new Map([
    [
      'signals',
      function (this: StatefulFunction, val: unknown) {
        return (this as SignalFunction)._onSignalsChange(val);
      },
    ],
  ]);

  getInputMap() {
    return SignalFunction.inputMap;
  }

  private _unlistenAll() {
    for (const signal of this._subscribed) {
      unsubscribeSignal(signal, this._onSignal);
    }
    this._subscribed.clear();
  }

  run() {
    if (this._pendingSignals.length === 0) {
      return NO_EMIT;
    }
    const pending = this._pendingSignals.splice(0);
    const lastIndex = pending.length - 1;
    for (let i = 0; i <= lastIndex; ++i) {
      const entry = pending[i];
      this._data.output(entry.signal, 'signal');
      this._data.output(entry.timestamp, 'timestamp');
      this._data.output(entry.signal);
      if (i < lastIndex) {
        this._data.emitOnly(new ValueUpdateEvent(entry.signal, entry.timestamp));
      } else {
        return new ValueUpdateEvent(entry.signal, entry.timestamp);
      }
    }
    return NO_EMIT;
  }

  cleanup() {
    this._unlistenAll();
    this._pendingSignals.length = 0;
    this._data.output(undefined, 'signal');
    this._data.output(undefined, 'timestamp');
    this._data.output(undefined);
  }

  destroy() {
    this._unlistenAll();
    this._pendingSignals.length = 0;
    super.destroy();
  }
}

globalFunctions.addFactory(
  SignalFunction,
  {
    name: 'signal',
    icon: '11:SIG',
    mode: 'onCall',
    priority: 0,
    properties: [
      {name: 'signals', type: 'multi-select', options: [...SYSTEM_SIGNALS], init: ['SIGTERM', 'SIGINT'], pinned: true},
      {name: 'signal', type: 'string', readonly: true},
      {name: 'timestamp', type: 'number', readonly: true},
      {name: '#output', type: 'string', readonly: true, pinned: true},
    ],
  },
  'system'
);
