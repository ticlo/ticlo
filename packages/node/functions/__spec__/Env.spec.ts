import {Flow, globalFunctions, Root} from '@ticlo/core';
import '../../index.ts';

it('reads the requested environment variable under system:env and clears the output for an unset variable', () => {
  expect(globalFunctions.getDesc('node:env')).toBeNull();
  vi.stubEnv('TICLO_ENV_TEST', 'host value');
  vi.stubEnv('TICLO_ENV_MISSING_TEST', undefined);
  const flow = new Flow();
  try {
    const env = flow.createBlock('env');
    env._load({'#is': 'system:env', 'name': 'TICLO_ENV_TEST'});
    Root.run();
    expect(env.getValue('#output')).toBe('host value');
    expect(flow.save().env).not.toHaveProperty('#output');

    env.setValue('name', 'TICLO_ENV_MISSING_TEST');
    Root.run();
    expect(env.getValue('#output')).toBeUndefined();
  } finally {
    flow.destroy();
    vi.unstubAllEnvs();
  }
});
