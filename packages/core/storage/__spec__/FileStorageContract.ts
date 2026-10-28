import {expect, it} from 'vitest';
import type {ProjectStorage} from '../ProjectStorage.ts';

/** Shared data-integrity checks; each backend owns its setup and teardown. */
export function fileStorageContract(getStorage: () => ProjectStorage, project: string) {
  it('preserves binary files, empty directories and recursive copy/move operations', async () => {
    const storage = getStorage();
    await storage.createDirectory(`${project}/source/empty`);
    await storage.uploadFile(`${project}/source/a.bin`, new Uint8Array([0, 255, 13, 10]));
    await storage.copyFile(`${project}/source`, `${project}/copy`);
    expect(new Uint8Array((await storage.getFile(`${project}/copy/a.bin`)).data)).toEqual(
      new Uint8Array([0, 255, 13, 10])
    );
    expect(await storage.listFiles(`${project}/copy/empty`)).toEqual([]);
    await storage.renameFile(`${project}/copy`, 'renamed');
    await expect(storage.getFileInfo(`${project}/copy`)).rejects.toMatchObject({code: 'not-found'});
    expect((await storage.listFiles(`${project}/renamed`)).map((entry) => entry.name).sort()).toEqual([
      'a.bin',
      'empty',
    ]);
    await expect(storage.moveFile(`${project}/source`, `${project}/source/nested`)).rejects.toMatchObject({
      code: 'invalid-path',
    });
    await storage.deleteFile(`${project}/renamed`);
    expect(await storage.getFileInfo(`${project}/source/a.bin`)).toMatchObject({type: 'file', size: 4});
  });
  it('rejects stale revisions without modifying the stored file', async () => {
    const storage = getStorage();
    const path = `${project}/revision.txt`;
    const first = await storage.uploadFile(path, 'one', {revision: null});
    expect(first.revision).toBeTruthy();
    await expect(storage.uploadFile(path, 'bad', {revision: null})).rejects.toMatchObject({code: 'conflict'});
    const second = await storage.uploadFile(path, 'two', {revision: first.revision});
    await expect(storage.uploadFile(path, 'stale', {revision: first.revision})).rejects.toMatchObject({
      code: 'conflict',
    });
    await expect(storage.deleteFile(path, {revision: first.revision})).rejects.toMatchObject({code: 'conflict'});
    expect(new TextDecoder().decode((await storage.getFile(path)).data)).toBe('two');
    await storage.deleteFile(path, {revision: second.revision});
  });
  it('rejects traversal and preserves the source when a move cannot finish', async () => {
    const storage = getStorage();
    await storage.uploadFile(`${project}/original`, 'keep');
    await storage.uploadFile(`${project}/existing`, 'existing');
    await expect(storage.moveFile(`${project}/original`, `${project}/existing`)).rejects.toMatchObject({
      code: 'conflict',
    });
    expect(new TextDecoder().decode((await storage.getFile(`${project}/original`)).data)).toBe('keep');
    await expect(storage.uploadFile(`${project}/../escape`, 'bad')).rejects.toMatchObject({code: 'invalid-path'});
    await expect(storage.getFile('/outside')).rejects.toMatchObject({code: 'invalid-path'});
  });
}
