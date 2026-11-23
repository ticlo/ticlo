import type {Block} from '../../block/Block.ts';
import {BaseFunction} from '../../block/BlockFunction.ts';
import type {PropDesc} from '../../block/Descriptor.ts';
import {ErrorEvent} from '../../block/Event.ts';
import {globalFunctions} from '../../block/FunctionModule.ts';
import {escapedObject} from '../../util/NoSerialize.ts';
import {Logger, writeConsole, type FlowLogLevel} from '../../util/Logger.ts';
import {encodeDisplay} from '../../util/Serialize.ts';

export interface FlowLogRecord {
  time: number;
  level: FlowLogLevel;
  message: string;
  blockPath?: string;
  originPath?: string;
  data?: unknown;
}

export interface LogProvider {
  write(record: FlowLogRecord): void | Promise<void>;
}

export const consoleLogProvider = escapedObject<LogProvider>('log:console', {
  write({level, message, blockPath, originPath, data}) {
    const source = originPath ?? blockPath;
    writeConsole(level, source ? `[${source}] ${message}` : message, data);
  },
});

const levels = ['debug', 'info', 'warn', 'error'] as const;
const defaultMaxLength = 4096;

function limitMessage(message: string, maxLength: unknown): string {
  const limit =
    typeof maxLength === 'number' && Number.isFinite(maxLength) ? Math.max(3, Math.floor(maxLength)) : defaultMaxLength;
  if (message.length <= limit) return message;
  let end = limit - 3;
  // Keep both halves of a UTF-16 surrogate pair together.
  if (message.codePointAt(end - 1) > 0xffff) --end;
  return message.slice(0, end) + '...';
}

const providerProperty: PropDesc = {
  name: 'provider',
  type: 'service',
  options: ['log-provider'],
  create: 'sql:log-provider',
  placeholder: 'Runtime console',
};

class LogFunction extends BaseFunction<Block> {
  private write(level: FlowLogLevel, message: string, data: unknown, originPath?: string) {
    const block = this._data;
    let provider = block.getValue('provider') as LogProvider;
    if (provider === undefined && !block.getProperty('provider', false)?._bindingSource) provider = consoleLogProvider;
    if (typeof provider?.write !== 'function') throw new Error('Log provider unavailable');
    const result = provider.write({
      time: Date.now(),
      level,
      message: limitMessage(message, block.getValue('maxLength')),
      data,
      blockPath: block.getFullPath?.(),
      originPath,
    });
    // Block.run recognizes native promises from the executing runtime.
    if (result !== undefined) return Promise.resolve(result);
  }

  private getCallOriginPath(): string | undefined {
    const source = this._data.getProperty('#call', false)?._bindingSource?.getProperty();
    if (source?._name === '#emit' && source._block && source._block !== this._data) {
      return source._block.getFullPath?.() || undefined;
    }
  }

  run() {
    const value = this._data.getValue('message');
    let message = '';
    if (value !== undefined) message = typeof value === 'string' ? value : encodeDisplay(value);
    const data = this._data.getValue('data');
    if (message === '' && data === undefined) return;
    const level = (this._data.getValue('level') ?? 'info') as FlowLogLevel;
    if (!levels.includes(level)) throw new Error('Invalid log level');
    return this.write(level, message, data, this.getCallOriginPath());
  }

  runOnError(event: ErrorEvent) {
    const path = this._data.getFullPath?.();
    const writeFailed = (reason: unknown) => {
      Logger.error(() => `Failed to write error log at ${path}`, reason);
      return event;
    };
    try {
      const detailMessage = event.detailMessage;
      const message = detailMessage ? `${event.type}: ${detailMessage}` : event.type;
      const pending = this.write('error', message, event.detail, event.originPath ?? this.getCallOriginPath());
      if (pending) return pending.then(() => event, writeFailed);
    } catch (reason) {
      return writeFailed(reason);
    }
    return event;
  }
}

globalFunctions.addFactory(LogFunction, {
  name: 'log',
  category: 'system',
  icon: '11:LOG',
  mode: 'onCall',
  priority: 3,
  properties: [
    {name: 'message', type: 'any', pinned: true},
    {name: 'data', type: 'any'},
    {name: 'level', type: 'select', options: levels, default: 'info'},
    {name: 'maxLength', type: 'number', default: defaultMaxLength, min: 3, step: 1},
    providerProperty,
  ],
});
