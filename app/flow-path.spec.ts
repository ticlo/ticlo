import {describe, expect, it} from 'vitest';
import {fileDestination, fileFlowPath, pageFlowPath} from './flow-path.ts';

describe('flow page paths', () => {
  it('resolves the same nested flow path for viewer and designer', () => {
    expect(pageFlowPath(new URLSearchParams('path=main/jobs/daily'))).toEqual({
      ref: {library: 'main', kind: 'flow', name: 'jobs.daily'},
      path: '+main.jobs.daily',
    });
    expect(pageFlowPath(new URLSearchParams('path=%23root/entry'))?.path).toBe('entry');
  });

  it('resolves ordinary and special files to their runtime targets', () => {
    expect(fileFlowPath('main', 'main/jobs/daily.ticlo')?.path).toBe('+main.jobs.daily');
    expect(fileFlowPath('main', 'main/#context.ticlo')?.path).toBe('+main.#context');
    expect(fileFlowPath('main', 'main/#modules/tools.ticlo')?.path).toBe('+main.:tools');
    expect(fileFlowPath('#root', '#root/#modules/tools.ticlo')?.path).toBe(':tools');
  });

  it('resolves new flows in selected folders without treating modules as pages', () => {
    expect(fileDestination('main', 'main/jobs', 'daily', 'flow')).toEqual({
      file: 'main/jobs/daily.ticlo',
      path: '+main.jobs.daily',
      ref: {library: 'main', kind: 'flow', name: 'jobs.daily'},
    });
    expect(fileDestination('main', 'main/#modules', 'tools', 'module')?.path).toBe('+main.:tools');
    expect(fileDestination('main', 'main/#modules', 'tools', 'flow')).toBeNull();
    expect(fileDestination('main', 'main/jobs', 'tools', 'module')).toBeNull();
  });
});
