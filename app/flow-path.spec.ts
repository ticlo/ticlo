import {describe, expect, it} from 'vitest';
import {fileFlowPath, pageFlowPath} from './flow-path.ts';

describe('flow page paths', () => {
  it('resolves the same nested flow path for viewer and designer', () => {
    expect(pageFlowPath(new URLSearchParams('path=main/jobs/daily'))).toEqual({
      ref: {namespace: 'main', kind: 'flow', name: 'jobs.daily'},
      path: '+main.jobs.daily',
    });
    expect(pageFlowPath(new URLSearchParams('path=%23root/entry'))?.path).toBe('entry');
  });

  it('resolves ordinary and special files to their runtime targets', () => {
    expect(fileFlowPath('main', 'main/jobs/daily.ticlo')?.path).toBe('+main.jobs.daily');
    expect(fileFlowPath('main', 'main/#context.ticlo')?.path).toBe('+main.#context');
    expect(fileFlowPath('main', 'main/#libs/tools.ticlo')?.path).toBe('+main.:tools');
    expect(fileFlowPath('#root', '#root/#libs/tools.ticlo')?.path).toBe(':tools');
  });
});
