import fs from 'node:fs';
import os from 'node:os';
import {DoneEvent, ErrorEvent, Flow, globalFunctions, Root, ValueUpdateEvent, shouldHappen} from '@ticlo/core';
import {registerSystemExec, unregisterSystemExec} from '../../index.ts';

describe('system functions', () => {
  it('system:info populates host metadata and clears outputs on cleanup', () => {
    const flow = new Flow();
    try {
      const info = flow.createBlock('info');
      info.setValue('#is', 'system:info');
      Root.run();

      const expectedCpus = typeof os.availableParallelism === 'function' ? os.availableParallelism() : os.cpus().length;
      const expectedVersion = process.versions.bun ?? process.versions.deno ?? process.versions.node;

      expect(info.getValue('platform')).toBe(process.platform);
      expect(info.getValue('arch')).toBe(process.arch);
      expect(typeof info.getValue('runtime')).toBe('string');
      expect(info.getValue('version')).toBe(expectedVersion);
      expect(info.getValue('hostname')).toBe(os.hostname());
      expect(info.getValue('pid')).toBe(process.pid);
      expect(info.getValue('cpus')).toBe(expectedCpus);
      expect(info.getValue('totalMemory')).toBe(os.totalmem());
      expect(info.getValue('#output')).toBeUndefined();
      expect(flow.save().info).toEqual({'#is': 'system:info'});

      info.setValue('#is', '');
      for (const field of ['platform', 'arch', 'runtime', 'version', 'hostname', 'pid', 'cpus', 'totalMemory']) {
        expect(info.getValue(field)).toBeUndefined();
      }
    } finally {
      flow.destroy();
    }
  });

  it('system:stats stays idle on load, samples metrics on #call, and emits DoneEvent', () => {
    const flow = new Flow();
    try {
      const stats = flow.createBlock('stats');
      const emits: unknown[] = [];
      stats.getProperty('#emit').listen({
        onChange: (val) => {
          if (val !== undefined) emits.push(val);
        },
        onSourceChange: () => {},
      });
      stats.setValue('#is', 'system:stats');
      Root.run();

      expect(stats.getValue('uptime')).toBeUndefined();
      expect(emits).toEqual([]);

      stats.setValue('#call', {});
      Root.run();

      expect(typeof stats.getValue('uptime')).toBe('number');
      expect(stats.getValue('memoryUsage')).toMatchObject({
        rss: expect.any(Number),
        heapTotal: expect.any(Number),
        heapUsed: expect.any(Number),
      });
      expect(typeof stats.getValue('freeMemory')).toBe('number');
      expect(stats.getValue('totalMemory')).toBe(os.totalmem());
      expect(Array.isArray(stats.getValue('loadAvg'))).toBe(true);
      expect(stats.getValue('cpuUsage')).toMatchObject({
        user: expect.any(Number),
        system: expect.any(Number),
      });
      expect(stats.getValue('#output')).toBeUndefined();
      expect(emits.at(-1)).toBeInstanceOf(DoneEvent);

      stats.setValue('#is', '');
      for (const field of ['uptime', 'memoryUsage', 'freeMemory', 'totalMemory', 'loadAvg', 'cpuUsage']) {
        expect(stats.getValue(field)).toBeUndefined();
      }
    } finally {
      flow.destroy();
    }
  });

  it('system:signal listens to subscribed signals, shares process listeners, and cleans up', () => {
    const baselineUsr2 = process.listenerCount('SIGUSR2');
    const baselineUsr1 = process.listenerCount('SIGUSR1');
    const flow = new Flow();
    try {
      const sig1 = flow.createBlock('sig1');
      const emits1: unknown[] = [];
      sig1
        .getProperty('#emit')
        .listen({onChange: (val) => val !== undefined && emits1.push(val), onSourceChange: () => {}});
      sig1._load({'#is': 'system:signal', 'signals': ['SIGUSR2']});
      Root.run();

      expect(emits1).toEqual([]);
      expect(sig1.getValue('#output')).toBeUndefined();
      expect(process.listenerCount('SIGUSR2')).toBe(baselineUsr2 + 1);

      const sig2 = flow.createBlock('sig2');
      const emits2: unknown[] = [];
      sig2
        .getProperty('#emit')
        .listen({onChange: (val) => val !== undefined && emits2.push(val), onSourceChange: () => {}});
      sig2._load({'#is': 'system:signal', 'signals': ['SIGUSR2']});
      Root.run();

      // Multiple blocks share one OS process listener per signal.
      expect(process.listenerCount('SIGUSR2')).toBe(baselineUsr2 + 1);

      // Unsubscribed signal should be ignored.
      process.emit('SIGUSR1' as any);
      Root.run();
      expect(emits1).toEqual([]);
      expect(sig1.getValue('#output')).toBeUndefined();

      // Changing signals input updates subscription without triggering emission.
      sig1.setValue('signals', ['SIGUSR1', 'SIGUSR2']);
      Root.run();
      expect(emits1).toEqual([]);
      expect(process.listenerCount('SIGUSR1')).toBe(baselineUsr1 + 1);

      // Deliver subscribed signal.
      process.emit('SIGUSR2' as any);
      Root.run();

      expect(sig1.getValue('signal')).toBe('SIGUSR2');
      expect(typeof sig1.getValue('timestamp')).toBe('number');
      expect(sig1.getValue('#output')).toBe('SIGUSR2');
      expect(emits1.at(-1)).toBeInstanceOf(ValueUpdateEvent);
      expect((emits1.at(-1) as ValueUpdateEvent).data).toMatchObject({value: 'SIGUSR2'});

      expect(sig2.getValue('#output')).toBe('SIGUSR2');
      expect(emits2.at(-1)).toBeInstanceOf(ValueUpdateEvent);

      // Removing one block preserves shared listener while the second still listens.
      sig1.setValue('#is', '');
      expect(process.listenerCount('SIGUSR1')).toBe(baselineUsr1);
      expect(process.listenerCount('SIGUSR2')).toBe(baselineUsr2 + 1);

      sig2.setValue('#is', '');
      expect(process.listenerCount('SIGUSR2')).toBe(baselineUsr2);
    } finally {
      flow.destroy();
      expect(process.listenerCount('SIGUSR1')).toBe(baselineUsr1);
      expect(process.listenerCount('SIGUSR2')).toBe(baselineUsr2);
    }
  });

  describe('system:exec', () => {
    afterEach(() => {
      unregisterSystemExec();
    });

    it('is not registered by default', () => {
      expect(globalFunctions.getDesc('system:exec')).toBeNull();
    });

    it('runs commands directly without shell expansion and handles stdin, env, cwd, and errors', async () => {
      registerSystemExec();
      expect(globalFunctions.getDesc('system:exec')).not.toBeNull();

      const flow = new Flow();
      try {
        const exec = flow.createBlock('exec');
        exec._load({
          '#is': 'system:exec',
          'command': process.execPath,
          'args': [
            '-e',
            'const fs=require("node:fs");const input=fs.readFileSync(0,"utf8");console.log(JSON.stringify({input,env:process.env.TICLO_EXEC_ENV,cwd:process.cwd(),argv:process.argv.slice(1)}));console.error("err line");',
            '$(echo should_not_expand); echo injected',
          ],
          'cwd': os.tmpdir(),
          'env': {TICLO_EXEC_ENV: 'custom-val'},
          'stdin': 'stdin-payload',
        });
        exec.setValue('#call', {});
        Root.run();

        await shouldHappen(() => exec.getValue('exitCode') === 0, 5000);
        const parsed = JSON.parse(String(exec.getValue('stdout')));
        expect(parsed.input).toBe('stdin-payload');
        expect(parsed.env).toBe('custom-val');
        expect(parsed.cwd).toBe(fs.realpathSync(os.tmpdir()));
        expect(parsed.argv).toEqual(['$(echo should_not_expand); echo injected']);
        expect(exec.getValue('#output')).toBe(exec.getValue('stdout'));
        expect(exec.getValue('stderr')).toBe('err line\n');
        expect(exec.getValue('signal')).toBeUndefined();

        // Non-zero exit code records outputs and emits ErrorEvent.
        exec.setValue('args', [
          '-e',
          'process.stdout.write("partial"); process.stderr.write("fail"); process.exit(3);',
        ]);
        exec.setValue('#emit', undefined);
        exec.setValue('#call', {});
        Root.run();
        await shouldHappen(() => exec.getValue('#emit') instanceof ErrorEvent, 5000);
        expect(exec.getValue('exitCode')).toBe(3);
        expect(exec.getValue('stdout')).toBe('partial');
        expect(exec.getValue('stderr')).toBe('fail');
      } finally {
        flow.destroy();
      }
    });

    it('enforces allowedCommands and validates inputs', () => {
      registerSystemExec({
        allowedCommands: (command, args) => command === process.execPath && args[0] === '--allowed',
      });
      const flow = new Flow();
      try {
        const exec = flow.createBlock('exec');
        exec._load({'#is': 'system:exec', 'command': 'forbidden-cmd'});
        exec.setValue('#call', {});
        Root.run();
        expect(exec.getValue('#emit')).toBeInstanceOf(ErrorEvent);
        expect((exec.getValue('#emit') as ErrorEvent).type).toBe('command not allowed');

        exec.setValue('#emit', undefined);
        exec.setValue('command', process.execPath);
        exec.setValue('args', 'bad-args');
        exec.setValue('#call', {});
        Root.run();
        expect((exec.getValue('#emit') as ErrorEvent).type).toBe('invalid args');

        exec.setValue('#emit', undefined);
        exec.setValue('args', ['--allowed']);
        exec.setValue('timeout', -1);
        exec.setValue('#call', {});
        Root.run();
        expect((exec.getValue('#emit') as ErrorEvent).type).toBe('invalid timeout');
      } finally {
        flow.destroy();
      }
    });

    it('enforces timeout, maxBuffer, and cancellation', async () => {
      registerSystemExec({maxBuffer: 64});
      const flow = new Flow();
      try {
        const exec = flow.createBlock('exec');
        // Timeout case
        exec._load({
          '#is': 'system:exec',
          'command': process.execPath,
          'args': ['-e', 'setTimeout(() => {}, 10000)'],
          'timeout': 50,
        });
        exec.setValue('#call', {});
        Root.run();
        await shouldHappen(() => exec.getValue('#emit') instanceof ErrorEvent, 5000);
        expect(String((exec.getValue('#emit') as ErrorEvent).detail)).toContain('timed out');

        // maxBuffer overflow case
        exec.setValue('#emit', undefined);
        exec.setValue('timeout', 5000);
        exec.setValue('args', ['-e', 'process.stdout.write("x".repeat(256))']);
        exec.setValue('#call', {});
        Root.run();
        await shouldHappen(() => exec.getValue('#emit') instanceof ErrorEvent, 5000);
        expect(String((exec.getValue('#emit') as ErrorEvent).detail)).toContain('maxBuffer');

        // Explicit #cancel clears #wait and leaves outputs clean
        exec.setValue('#emit', undefined);
        exec.setValue('args', ['-e', 'setTimeout(() => console.log("late"), 5000)']);
        exec.setValue('#call', {});
        Root.run();
        expect(exec.getValue('#wait')).toBe(true);
        exec.setValue('#cancel', {});
        Root.run();
        expect(exec.getValue('#wait')).toBeUndefined();
        expect(exec.getValue('stdout')).toBeUndefined();
      } finally {
        flow.destroy();
      }
    });
  });
});
