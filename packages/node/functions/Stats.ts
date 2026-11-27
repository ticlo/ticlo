import os from 'node:os';
import {BaseFunction, globalFunctions} from '@ticlo/core';
import './SystemCategory.ts';

class StatsFunction extends BaseFunction {
  run() {
    const uptime = process.uptime();
    const rawMemoryUsage = process.memoryUsage();
    const memoryUsage = {
      rss: rawMemoryUsage.rss,
      heapTotal: rawMemoryUsage.heapTotal,
      heapUsed: rawMemoryUsage.heapUsed,
      external: rawMemoryUsage.external,
      arrayBuffers: rawMemoryUsage.arrayBuffers,
    };
    const freeMemory = os.freemem();
    const totalMemory = os.totalmem();
    const loadAvg = os.loadavg();
    const rawCpuUsage = process.cpuUsage();
    const cpuUsage = {user: rawCpuUsage.user, system: rawCpuUsage.system};

    this._data.output(uptime, 'uptime');
    this._data.output(memoryUsage, 'memoryUsage');
    this._data.output(freeMemory, 'freeMemory');
    this._data.output(totalMemory, 'totalMemory');
    this._data.output(loadAvg, 'loadAvg');
    this._data.output(cpuUsage, 'cpuUsage');
  }

  cleanup() {
    this._data.output(undefined, 'uptime');
    this._data.output(undefined, 'memoryUsage');
    this._data.output(undefined, 'freeMemory');
    this._data.output(undefined, 'totalMemory');
    this._data.output(undefined, 'loadAvg');
    this._data.output(undefined, 'cpuUsage');
  }
}

globalFunctions.addFactory(
  StatsFunction,
  {
    name: 'stats',
    icon: 'svg:line-chart',
    mode: 'onCall',
    priority: 1,
    properties: [
      {name: 'uptime', type: 'number', readonly: true, pinned: true},
      {name: 'memoryUsage', type: 'object', readonly: true, pinned: true},
      {name: 'freeMemory', type: 'number', readonly: true},
      {name: 'totalMemory', type: 'number', readonly: true},
      {name: 'loadAvg', type: 'array', readonly: true},
      {name: 'cpuUsage', type: 'object', readonly: true},
    ],
  },
  'system'
);
