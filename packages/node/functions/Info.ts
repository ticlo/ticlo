import os from 'node:os';
import {BaseFunction, globalFunctions, NO_EMIT} from '@ticlo/core';
import './SystemCategory.ts';

function detectRuntime(): {runtime: string; version: string} {
  const versions = process.versions as Record<string, string | undefined>;
  if (versions.bun) return {runtime: 'bun', version: versions.bun};
  if (versions.deno) return {runtime: 'deno', version: versions.deno};
  if (versions.node) return {runtime: 'node', version: versions.node};
  return {runtime: 'unknown', version: process.version};
}

class InfoFunction extends BaseFunction {
  run() {
    const {runtime, version} = detectRuntime();
    const cpus = typeof os.availableParallelism === 'function' ? os.availableParallelism() : os.cpus().length;
    this._data.output(process.platform, 'platform');
    this._data.output(process.arch, 'arch');
    this._data.output(runtime, 'runtime');
    this._data.output(version, 'version');
    this._data.output(os.hostname(), 'hostname');
    this._data.output(process.pid, 'pid');
    this._data.output(cpus, 'cpus');
    this._data.output(os.totalmem(), 'totalMemory');
    return NO_EMIT;
  }

  cleanup() {
    this._data.output(undefined, 'platform');
    this._data.output(undefined, 'arch');
    this._data.output(undefined, 'runtime');
    this._data.output(undefined, 'version');
    this._data.output(undefined, 'hostname');
    this._data.output(undefined, 'pid');
    this._data.output(undefined, 'cpus');
    this._data.output(undefined, 'totalMemory');
  }
}

globalFunctions.addFactory(
  InfoFunction,
  {
    name: 'info',
    icon: '11:INF',
    mode: 'onLoad',
    priority: 0,
    properties: [
      {name: 'platform', type: 'string', readonly: true, pinned: true},
      {name: 'arch', type: 'string', readonly: true},
      {name: 'runtime', type: 'string', readonly: true, pinned: true},
      {name: 'version', type: 'string', readonly: true},
      {name: 'hostname', type: 'string', readonly: true, pinned: true},
      {name: 'pid', type: 'number', readonly: true},
      {name: 'cpus', type: 'number', readonly: true},
      {name: 'totalMemory', type: 'number', readonly: true},
    ],
  },
  'system'
);
