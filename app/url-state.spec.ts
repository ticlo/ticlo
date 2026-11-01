import {afterEach, expect, it, vi} from 'vitest';
import {initialUrlParams, replaceUrlQuery} from './url-state.ts';

afterEach(() => vi.unstubAllGlobals());

it('reads startup query and replaces later parameters without navigation or history entries', () => {
  const location = new URL(
    'http://localhost/designer.html?host=http%3A%2F%2Flocalhost%3A8010%2Ffile&path=main%2Fentry#old'
  );
  const replaceState = vi.fn();
  const pushState = vi.fn();
  const state = {session: 1};
  vi.stubGlobal('location', location);
  vi.stubGlobal('history', {state, replaceState, pushState});

  const initial = initialUrlParams();
  expect(initial.get('path')).toBe('main/entry');
  replaceUrlQuery({project: 'other', path: null, flow: undefined});

  const [previous, title, next] = replaceState.mock.calls[0];
  expect(replaceState).toHaveBeenCalledTimes(1);
  expect(previous).toBe(state);
  expect(title).toBe('');
  expect(new URL(next).searchParams.get('host')).toBe('http://localhost:8010/file');
  expect(new URL(next).searchParams.get('project')).toBe('other');
  expect(new URL(next).searchParams.has('path')).toBe(false);
  expect(new URL(next).hash).toBe('');
  expect(initial.get('path')).toBe('main/entry');
  expect(pushState).not.toHaveBeenCalled();
});
