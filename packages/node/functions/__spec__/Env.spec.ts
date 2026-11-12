import {Flow, Root} from '@ticlo/core';
import '../../index.ts';

it('reads the requested environment variable and clears the output for an unset variable', () => {
  vi.stubEnv('TICLO_ENV_TEST', 'host value');
  vi.stubEnv('TICLO_ENV_MISSING_TEST', undefined);
  const flow = new Flow();
  try {
    const env = flow.createBlock('env');
    env._load({'#is': 'node:env', 'name': 'TICLO_ENV_TEST'});
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
