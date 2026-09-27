import {afterEach, describe, expect, it} from 'vitest';
import {FlowFolder, Root} from '../Flow.ts';
import {makeLocalConnection} from '../../connect/LocalConnection.ts';
import {shouldHappen} from '../../util/test-util.ts';

describe('flow folders', () => {
  let root: Root;
  afterEach(() => root?.destroy());

  it.each(['folder.deep.nested.flow', '+main.folder.deep.nested.flow'])('creates all parents for %s', (path) => {
    root = new Root();
    const flow = root.addFlow(path, {value: 1}, null, true);
    expect(root.queryValue(path)).toBe(flow);
    expect(flow.getValue('value')).toBe(1);
    const folder = root.queryValue(path.slice(0, path.lastIndexOf('.'))) as FlowFolder;
    expect(folder).toBeInstanceOf(FlowFolder);
    expect(flow._namespace).toBe(path.startsWith('+') ? '+main' : '+#root');
    expect(folder._namespace).toBe(flow._namespace);
  });

  it.each([false, true])('waits for folder creation and rolls back failure (reject=%s)', async (reject) => {
    root = new Root();
    root.addFlowFolder('+main');
    let finish: () => void;
    let started = false;
    root._storage = {
      inited: true,
      createFolder: () => {
        started = true;
        return new Promise<void>((resolve, fail) => {
          finish = () => (reject ? fail(new Error('mkdir failed')) : resolve());
        });
      },
    } as any;
    const [, client] = makeLocalConnection(root, false);
    try {
      let completed = false;
      const request = client.addFlowFolder('+main.folder') as Promise<unknown>;
      request.then(
        () => (completed = true),
        () => (completed = true)
      );
      await shouldHappen(() => started);
      expect(completed).toBe(false);
      finish();
      if (reject) {
        await expect(request).rejects.toContain('mkdir failed');
        expect(root.queryValue('+main.folder')).toBeUndefined();
      } else {
        await request;
        expect(root.queryValue('+main.folder')).toBeInstanceOf(FlowFolder);
      }
    } finally {
      client.destroy();
    }
  });
});
