import {describe, expect, it, vi} from 'vitest';
import {droppedUploads, FileOperations} from '../FileOperations.ts';
import {file, fixtureClient, folder} from './fixtures.ts';

describe('File manager operations', () => {
  it('copies a folder recursively, including empty folders, using file-only copy requests', async () => {
    const fixture = fixtureClient([
      folder('proj/demo/src'),
      folder('proj/demo/src/empty'),
      file('proj/demo/src/a.txt'),
      folder('proj/demo/dest'),
    ]);
    const operations = new FileOperations(fixture.client, 'demo');
    await operations.transfer([fixture.entries.get('proj/demo/src')], 'proj/demo/dest', false, async () => true);
    expect([...fixture.entries.keys()]).toEqual(
      expect.arrayContaining([
        'proj/demo/dest/src',
        'proj/demo/dest/src/empty',
        'proj/demo/dest/src/a.txt',
        'proj/demo/src/a.txt',
      ])
    );
    expect(fixture.methods.copyFile.mock.calls.map(([source]) => source)).toEqual(['proj/demo/src/a.txt']);
  });

  it('generates an unused copy name and preserves the extension', async () => {
    const fixture = fixtureClient([file('proj/demo/a.json'), file('proj/demo/a (1).json')]);
    await new FileOperations(fixture.client, 'demo').transfer(
      [fixture.entries.get('proj/demo/a.json')],
      'proj/demo',
      false,
      async () => {
        throw new Error('No conflict should be shown');
      }
    );
    expect(fixture.entries.has('proj/demo/a (2).json')).toBe(true);
  });

  it('keeps the existing file when overwrite is declined and does not delete it before an approved upload', async () => {
    const fixture = fixtureClient([file('proj/demo/a.txt', 3)]);
    const operations = new FileOperations(fixture.client, 'demo');
    const payload = new File(['replacement'], 'a.txt');
    const confirm = vi.fn(async () => false);
    await operations.upload([{path: payload.name, file: payload}], 'proj/demo', confirm);
    expect(fixture.entries.get('proj/demo/a.txt')).toMatchObject({size: 3});
    expect(fixture.methods.uploadFile).not.toHaveBeenCalled();
    await operations.upload([{path: payload.name, file: payload}], 'proj/demo', async () => true);
    expect(fixture.entries.get('proj/demo/a.txt')).toMatchObject({size: payload.size});
    expect(fixture.methods.deleteFile).not.toHaveBeenCalled();
    expect(fixture.methods.uploadFile.mock.calls[0][2]).toEqual({existsBehavior: 'overwrite'});
  });

  it('rejects project-root mutations, traversal, cross-project entries and self-descendant transfers before writes', async () => {
    const fixture = fixtureClient([folder('proj/demo/src'), file('proj/demo/a.txt')]);
    const operations = new FileOperations(fixture.client, 'demo');
    for (const path of ['proj/demo', 'proj/demo/../other', 'proj/demo/.. ', 'proj/other/a.txt', 'usr/demo/a.txt']) {
      await expect(operations.remove([file(path)])).rejects.toThrow('Path must be inside the project');
    }
    await expect(
      operations.transfer(
        [fixture.entries.get('proj/demo/a.txt'), fixture.entries.get('proj/demo/src')],
        'proj/demo/src/child',
        true,
        async () => true
      )
    ).rejects.toThrow('into itself');
    expect(fixture.methods.deleteFile).not.toHaveBeenCalled();
    expect(fixture.methods.moveFile).not.toHaveBeenCalled();
    expect(() => new FileOperations(fixture.client, '../demo')).toThrow('Invalid project');
  });

  it('does not replace a folder containing another selected source', async () => {
    const fixture = fixtureClient([folder('proj/demo/in/foo'), file('proj/demo/foo/a.txt')]);
    await expect(
      new FileOperations(fixture.client, 'demo').transfer(
        [...fixture.entries.values()],
        'proj/demo',
        true,
        async () => true
      )
    ).rejects.toThrow('selected source');
    expect(fixture.methods.moveFile).not.toHaveBeenCalled();
    expect(fixture.methods.deleteFile).not.toHaveBeenCalled();
  });

  it('does not overwrite a destination when the copied source has disappeared', async () => {
    const fixture = fixtureClient([file('proj/demo/dest/a.txt')]);
    await expect(
      new FileOperations(fixture.client, 'demo').transfer(
        [file('proj/demo/src/a.txt')],
        'proj/demo/dest',
        false,
        async () => true
      )
    ).rejects.toThrow('no longer exists');
    expect(fixture.methods.deleteFile).not.toHaveBeenCalled();
    expect(fixture.methods.copyFile).not.toHaveBeenCalled();
  });

  it('deduplicates parent/child selections when moving and deleting', async () => {
    const fixture = fixtureClient([folder('proj/demo/src'), file('proj/demo/src/a.txt')]);
    const operations = new FileOperations(fixture.client, 'demo');
    await operations.transfer([...fixture.entries.values()], 'proj/demo/dest', true, async () => true);
    expect(fixture.methods.moveFile).toHaveBeenCalledTimes(1);
    expect(fixture.entries.has('proj/demo/src')).toBe(false);
    await operations.remove([...fixture.entries.values()]);
    expect(fixture.methods.deleteFile).toHaveBeenCalledTimes(1);
    expect(fixture.entries.size).toBe(0);
  });

  it('skips the entire dropped directory when replacing a file with that directory is declined', async () => {
    const fixture = fixtureClient([file('proj/demo/src')]);
    await new FileOperations(fixture.client, 'demo').upload(
      [{path: 'src'}, {path: 'src/a.txt', file: new File(['text'], 'a.txt')}],
      'proj/demo',
      async () => false
    );
    expect(fixture.methods.createDirectory).not.toHaveBeenCalled();
    expect(fixture.methods.uploadFile).not.toHaveBeenCalled();
  });

  it('stops mutations after a project switch aborts an overwrite confirmation', async () => {
    const fixture = fixtureClient([file('proj/demo/a.txt'), file('proj/demo/dest/a.txt')]);
    const controller = new AbortController();
    let answer: (value: boolean) => void;
    const pending = new FileOperations(fixture.client, 'demo', controller.signal).transfer(
      [file('proj/demo/a.txt')],
      'proj/demo/dest',
      true,
      () =>
        new Promise((resolve) => {
          answer = resolve;
        })
    );
    await vi.waitFor(() => expect(answer).toBeDefined());
    controller.abort();
    answer(true);
    await expect(pending).rejects.toThrow();
    expect(fixture.methods.moveFile).not.toHaveBeenCalled();
    expect(fixture.methods.deleteFile).not.toHaveBeenCalled();
  });

  it('captures files from a browser drop', async () => {
    const data = new DataTransfer();
    const payload = new File(['upload'], 'a.txt');
    data.items.add(payload);
    expect(await droppedUploads(data)).toEqual([{path: 'a.txt', file: payload}]);
  });

  it('propagates permission errors instead of treating an entry as missing', async () => {
    const fixture = fixtureClient([]);
    fixture.methods.getFileInfo.mockRejectedValue({response: {status: 403}});
    await expect(
      new FileOperations(fixture.client, 'demo').upload(
        [{path: 'a.txt', file: new File(['text'], 'a.txt')}],
        'proj/demo',
        async () => true
      )
    ).rejects.toMatchObject({response: {status: 403}});
    expect(fixture.methods.uploadFile).not.toHaveBeenCalled();
  });
});
