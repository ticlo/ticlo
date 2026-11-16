import {describe, expect, it} from 'vitest';
import {
  DoneEvent,
  ErrorEvent,
  MemoryFlowStorage,
  NO_EMIT,
  Root,
  StorageError,
  WAIT,
  type FileAccess,
  type FileEntry,
  type FilePayload,
  type FileReadResult,
  type FileRequest,
  type FileWriteOptions,
  type FlowStorage,
} from '../../../index.ts';
import {shouldHappen} from '../../../util/test-util.ts';
import {parseFilePath} from '../../../storage/FilePath.ts';

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return {promise, resolve, reject};
}

function makeMockStorage(overrides?: Partial<FlowStorage & FileAccess>): FlowStorage {
  const calls: string[] = [];
  const access: FileAccess = {
    getCapabilities: () => ({write: true, persistent: true}),
    async getFile(path: string): Promise<FileReadResult> {
      calls.push(`get:${path}`);
      return {data: new TextEncoder().encode('hello').buffer, revision: 'r1', contentType: 'text/plain'};
    },
    async getFileInfo(path: string): Promise<FileEntry> {
      calls.push(`info:${path}`);
      if (path === 'proj1/missing.txt') throw new StorageError('File not found', 'not-found');
      return {path, name: path.split('/').pop() ?? path, type: 'file', size: 5};
    },
    async listFiles(path: string): Promise<FileEntry[]> {
      calls.push(`list:${path}`);
      return [{path: `${path}/a.txt`, name: 'a.txt', type: 'file', size: 1}];
    },
    async uploadFile(path: string, _data: FilePayload, _options?: FileWriteOptions) {
      calls.push(`write:${path}`);
      return {revision: 'r2'};
    },
    async createDirectory(path: string) {
      calls.push(`mkdir:${path}`);
    },
    async deleteFile(path: string) {
      calls.push(`delete:${path}`);
    },
    async copyFile(source: string, destination: string) {
      calls.push(`copy:${source}->${destination}`);
    },
    async moveFile(source: string, destination: string) {
      calls.push(`move:${source}->${destination}`);
    },
    async renameFile(path: string, name: string) {
      calls.push(`rename:${path}->${name}`);
    },
    ...overrides,
  };

  return Object.assign(
    new MemoryFlowStorage(),
    {
      readFile(path: string, library?: string, _options?: FileRequest) {
        const parsed = parseFilePath(path, library);
        if (parsed.kind !== 'project' && parsed.kind !== 'frontend') {
          throw new StorageError('External not allowed', 'permission-denied');
        }
        return access.getFile(parsed.storagePath);
      },
      resolveFileAccess(path: string, library?: string, options?: {allowEmptyRelative?: boolean}) {
        const parsed = parseFilePath(path, library, options);
        if (parsed.kind === 'project' || parsed.kind === 'frontend') {
          return {access, path: parsed.storagePath};
        }
        return undefined;
      },
    },
    overrides
  );
}

describe('file operation functions', () => {
  it('runs read/list/info automatically onLoad and clears or handles missing paths cleanly', async () => {
    const root = new Root();
    try {
      await root.setStorage(makeMockStorage());
      await root.start();
      const flow = root.addFlow('+proj1.main', undefined, undefined, true);

      const read = flow.createBlock('read');
      read.setValue('#is', 'file:read');
      root._run();
      expect(read.getValue('#output')).toBeUndefined();

      read.setValue('path', '+/hello.txt');
      await shouldHappen(() => read.getValue('#output') === 'hello');
      expect(read.getValue('revision')).toBe('r1');
      expect(read.getValue('contentType')).toBe('text/plain');

      const list = flow.createBlock('list');
      list.setValue('#is', 'file:list');
      list.setValue('path', '+/');
      await shouldHappen(() => Array.isArray(list.getValue('#output')));
      expect(list.getValue('#output')).toEqual([{path: 'proj1/a.txt', name: 'a.txt', type: 'file', size: 1}]);

      const info = flow.createBlock('info');
      info.setValue('#is', 'file:info');
      info.setValue('path', '+/missing.txt');
      await shouldHappen(() => info.getValue('exists') === false);
      expect(info.getValue('#output')).toBeUndefined();

      info.setValue('path', '+/hello.txt');
      await shouldHappen(() => info.getValue('exists') === true);
      expect(info.getValue('#output')).toMatchObject({path: 'proj1/hello.txt', type: 'file', size: 5});
    } finally {
      root.destroy();
    }
  });

  it('requires #call (onCall) for mutating file functions before running', async () => {
    let writes = 0;
    let deletes = 0;
    const root = new Root();
    try {
      await root.setStorage(
        makeMockStorage({
          async uploadFile() {
            writes += 1;
            return {revision: `rev-${writes}`};
          },
          async deleteFile() {
            deletes += 1;
          },
        })
      );
      await root.start();
      const flow = root.addFlow('+proj1.main', undefined, undefined, true);

      const writer = flow.createBlock('writer');
      writer.setValue('#is', 'file:write');
      writer.setValue('path', '+/out.txt');
      writer.setValue('data', 'payload');

      const deleter = flow.createBlock('deleter');
      deleter.setValue('#is', 'file:delete');
      deleter.setValue('path', '+/out.txt');
      deleter.getProperty('#emit');

      root._run();
      await Promise.resolve();
      expect(writes).toBe(0);
      expect(deletes).toBe(0);

      writer.setValue('#call', true);
      await shouldHappen(() => writer.getValue('#output') === 'rev-1');
      expect(writes).toBe(1);

      deleter.setValue('#call', true);
      await shouldHappen(() => deletes === 1 && deleter.getValue('#emit') instanceof DoneEvent);
    } finally {
      root.destroy();
    }
  });

  it('cancels stale reads via AbortSignal and emits ErrorEvent on failure', async () => {
    const first = createDeferred<FileReadResult>();
    const second = createDeferred<FileReadResult>();
    const signals: AbortSignal[] = [];

    const root = new Root();
    try {
      await root.setStorage(
        makeMockStorage({
          readFile(_path: string, _library?: string, options?: FileRequest) {
            if (options?.signal) signals.push(options.signal);
            return signals.length === 1 ? first.promise : second.promise;
          },
        })
      );
      await root.start();
      const flow = root.addFlow('+proj1.main', undefined, undefined, true);

      const read = flow.createBlock('read');
      read.setValue('#is', 'file:read');
      read.getProperty('#emit');
      read.setValue('path', '+/a.txt');
      root._run();
      expect(read.getValue('#wait')).toBe(true);
      expect(read.getValue('#emit')).toBe(WAIT);
      expect(signals[0]?.aborted).toBe(false);

      read.setValue('path', '+/b.txt');
      root._run();
      expect(signals[0]?.aborted).toBe(true);

      first.resolve({data: new TextEncoder().encode('stale').buffer, revision: 'old'});
      second.resolve({data: new TextEncoder().encode('fresh').buffer, revision: 'new'});
      await shouldHappen(() => read.getValue('#output') === 'fresh');
      expect(read.getValue('revision')).toBe('new');

      // Canceling via #cancel aborts active read and suppresses async error.
      read.setValue('#cancel', {});
      expect(read.getValue('#wait')).toBeUndefined();

      // Calling file:rename without a name produces ErrorEvent cleanly.
      const renamer = flow.createBlock('renamer');
      renamer.setValue('#is', 'file:rename');
      renamer.setValue('path', '+/b.txt');
      renamer.setValue('#call', true);
      await shouldHappen(() => renamer.getValue('#emit') instanceof ErrorEvent);
      expect(NO_EMIT).toBeDefined();
    } finally {
      root.destroy();
    }
  });
});
