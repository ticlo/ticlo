import {spawn, type ChildProcess} from 'node:child_process';
import {BaseFunction, defaultConfigs, ErrorEvent, globalFunctions, NO_EMIT} from '@ticlo/core';
import {isDataMap} from '@ticlo/core/util/DataTypes.ts';
import './SystemCategory.ts';

export interface SystemExecOptions {
  allowedCommands?: readonly string[] | ((command: string, args: string[]) => boolean);
  defaultTimeout?: number;
  maxBuffer?: number;
  defaultCwd?: string;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_BUFFER_BYTES = 1024 * 1024;
const MAX_TIMEOUT_MS = 2_147_483_647;

let execOptions: SystemExecOptions = {};

function resolveCommandArgs(rawArgs: unknown): string[] | null {
  if (rawArgs === undefined || rawArgs === null) return [];
  if (!Array.isArray(rawArgs)) return null;
  const resolved: string[] = [];
  for (const item of rawArgs) {
    if (typeof item === 'string' || typeof item === 'boolean') {
      resolved.push(String(item));
    } else if (typeof item === 'number' && Number.isFinite(item)) {
      resolved.push(String(item));
    } else {
      return null;
    }
  }
  return resolved;
}

function isCommandAllowed(command: string, args: string[]): boolean {
  const {allowedCommands} = execOptions;
  if (allowedCommands == null) return true;
  if (typeof allowedCommands === 'function') return allowedCommands(command, args);
  return allowedCommands.includes(command);
}

function resolveProcessEnv(rawEnv: unknown): NodeJS.ProcessEnv | null {
  if (rawEnv === undefined || rawEnv === null) return process.env;
  if (!isDataMap(rawEnv)) return null;
  const nextEnv: NodeJS.ProcessEnv = {...process.env};
  for (const key of Object.keys(rawEnv)) {
    const val = rawEnv[key];
    if (val === undefined || val === null) {
      delete nextEnv[key];
    } else if (
      typeof val === 'string' ||
      typeof val === 'boolean' ||
      (typeof val === 'number' && Number.isFinite(val))
    ) {
      nextEnv[key] = String(val);
    } else {
      return null;
    }
  }
  return nextEnv;
}

class ExecFunction extends BaseFunction {
  private _revision = 0;
  private _child?: ChildProcess;
  private _timer?: ReturnType<typeof setTimeout>;
  private _resolveCancel?: (value: typeof NO_EMIT) => void;

  private clearOutputs() {
    this._data.output(undefined, 'stdout');
    this._data.output(undefined, 'stderr');
    this._data.output(undefined, 'exitCode');
    this._data.output(undefined, 'signal');
    this._data.output(undefined);
  }

  private clearTimer() {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = undefined;
    }
  }

  run(): unknown {
    this.cancel();
    const revision = this._revision;

    const command = this._data.getValue('command');
    if (typeof command !== 'string' || !command) {
      this.clearOutputs();
      return new ErrorEvent('invalid command');
    }

    const args = resolveCommandArgs(this._data.getValue('args'));
    if (!args) {
      this.clearOutputs();
      return new ErrorEvent('invalid args');
    }

    if (!isCommandAllowed(command, args)) {
      this.clearOutputs();
      return new ErrorEvent('command not allowed');
    }

    const rawCwd = this._data.getValue('cwd');
    if (rawCwd !== undefined && rawCwd !== null && typeof rawCwd !== 'string') {
      this.clearOutputs();
      return new ErrorEvent('invalid cwd');
    }
    const cwd = typeof rawCwd === 'string' && rawCwd ? rawCwd : execOptions.defaultCwd;

    const env = resolveProcessEnv(this._data.getValue('env'));
    if (!env) {
      this.clearOutputs();
      return new ErrorEvent('invalid env');
    }

    const stdin = this._data.getValue('stdin');
    if (stdin !== undefined && stdin !== null && typeof stdin !== 'string') {
      this.clearOutputs();
      return new ErrorEvent('invalid stdin');
    }

    const rawTimeout = this._data.getValue('timeout');
    const timeout =
      rawTimeout === undefined || rawTimeout === null ? (execOptions.defaultTimeout ?? DEFAULT_TIMEOUT_MS) : rawTimeout;
    if (typeof timeout !== 'number' || !Number.isFinite(timeout) || timeout < 0 || timeout > MAX_TIMEOUT_MS) {
      this.clearOutputs();
      return new ErrorEvent('invalid timeout');
    }

    const maxBuffer = execOptions.maxBuffer ?? DEFAULT_MAX_BUFFER_BYTES;

    return new Promise((resolve, reject) => {
      let child: ChildProcess;
      try {
        child = spawn(command, args, {
          cwd,
          env,
          shell: false,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
      } catch (error) {
        this.clearOutputs();
        reject(error instanceof Error ? error : new Error(String(error)));
        return;
      }

      this._child = child;
      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];
      let totalBytes = 0;
      let settled = false;

      const isStale = () => settled || revision !== this._revision || !this._data;

      const cleanupRun = () => {
        this.clearTimer();
        if (this._child === child) {
          this._child = undefined;
        }
        if (this._resolveCancel === cancelResolve) {
          this._resolveCancel = undefined;
        }
      };

      const finishResolve = (value?: typeof NO_EMIT) => {
        if (settled) return;
        settled = true;
        cleanupRun();
        resolve(value);
      };

      const finishReject = (error: Error) => {
        if (settled) return;
        settled = true;
        cleanupRun();
        reject(error);
      };

      const cancelResolve = (value: typeof NO_EMIT) => {
        finishResolve(value);
      };
      this._resolveCancel = cancelResolve;

      const onDataChunk = (target: Buffer[], chunk: Buffer) => {
        if (isStale()) return;
        totalBytes += chunk.length;
        if (totalBytes > maxBuffer) {
          try {
            child.kill('SIGKILL');
          } catch {
            // ignore kill errors on exited child
          }
          this.clearOutputs();
          finishReject(new Error('Output exceeded maxBuffer'));
          return;
        }
        target.push(chunk);
      };

      child.stdout?.on('data', (chunk: Buffer) => onDataChunk(stdoutChunks, chunk));
      child.stderr?.on('data', (chunk: Buffer) => onDataChunk(stderrChunks, chunk));
      child.stdin?.on('error', () => {
        // Ignore EPIPE if child closes stdin early.
      });
      if (typeof stdin === 'string' && stdin.length > 0) {
        child.stdin?.write(stdin);
      }
      child.stdin?.end();

      if (timeout > 0) {
        this._timer = setTimeout(() => {
          if (isStale()) return;
          try {
            child.kill('SIGTERM');
          } catch {
            // ignore kill errors on exited child
          }
          this.clearOutputs();
          finishReject(new Error('Command timed out'));
        }, timeout);
      }

      child.on('error', (error: Error) => {
        if (isStale()) {
          finishResolve(NO_EMIT);
          return;
        }
        this.clearOutputs();
        finishReject(error);
      });

      child.on('close', (code, signal) => {
        if (isStale()) {
          finishResolve(NO_EMIT);
          return;
        }
        const stdout = Buffer.concat(stdoutChunks).toString('utf8');
        const stderr = Buffer.concat(stderrChunks).toString('utf8');
        this._data.output(stdout, 'stdout');
        this._data.output(stderr, 'stderr');
        this._data.output(code ?? undefined, 'exitCode');
        this._data.output(signal ?? undefined, 'signal');
        this._data.output(stdout);
        if (code === 0 && !signal) {
          finishResolve();
        } else {
          finishReject(new Error(signal ? `Command terminated by ${signal}` : `Command exited with code ${code}`));
        }
      });
    });
  }

  cancel(): boolean {
    ++this._revision;
    this.clearTimer();
    const resolveCancel = this._resolveCancel;
    this._resolveCancel = undefined;
    const child = this._child;
    this._child = undefined;
    if (child) {
      try {
        child.kill();
      } catch {
        // ignore kill errors on already exited child
      }
    }
    resolveCancel?.(NO_EMIT);
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

export function registerSystemExec(options: SystemExecOptions = {}): void {
  execOptions = {...options};
  globalFunctions.addFactory(
    ExecFunction,
    {
      name: 'exec',
      icon: '13:>$',
      mode: 'onCall',
      priority: 3,
      configs: defaultConfigs.concat('#cancel'),
      properties: [
        {name: 'command', type: 'string', pinned: true},
        {name: 'args', type: 'array', pinned: true},
        {name: 'cwd', type: 'string'},
        {name: 'env', type: 'object', create: 'create-object'},
        {name: 'stdin', type: 'string'},
        {name: 'timeout', type: 'number', default: DEFAULT_TIMEOUT_MS, min: 0, unit: 'ms'},
        {name: 'stdout', type: 'string', readonly: true, pinned: true},
        {name: 'stderr', type: 'string', readonly: true},
        {name: 'exitCode', type: 'number', readonly: true, pinned: true},
        {name: 'signal', type: 'string', readonly: true},
        {name: '#output', type: 'string', readonly: true, pinned: true},
      ],
    },
    'system'
  );
}

export function unregisterSystemExec(): void {
  execOptions = {};
  globalFunctions.delete('system:exec');
}
