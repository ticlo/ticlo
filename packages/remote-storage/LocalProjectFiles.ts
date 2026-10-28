import {
  FileAccessBase,
  StorageError,
  checkRevision,
  fileBytes,
  filePath,
  type FileEntry,
  type FilePayload,
  type FileRequest,
  type FileWriteOptions,
} from '@ticlo/core/storage/FileAccess.ts';

interface Entry extends FileEntry {
  parent: string;
  revision?: string;
}
const request = <T>(value: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    value.onsuccess = () => resolve(value.result);
    value.onerror = () => reject(value.error);
  });

/** A single browser-local project. The legacy ticlo database is left untouched. */
export class LocalProjectFiles extends FileAccessBase {
  private database?: Promise<IDBDatabase>;
  constructor(private readonly name = 'ticlo-local-files') {
    super();
  }
  async close() {
    if (this.database) (await this.database).close();
    this.database = undefined;
  }
  getCapabilities(_path: string) {
    return {write: true, persistent: true};
  }
  private db() {
    return (this.database ??= new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open(this.name, 1);
      open.onupgradeneeded = () => {
        const entries = open.result.createObjectStore('entries', {keyPath: 'path'});
        entries.createIndex('parent', 'parent');
        open.result.createObjectStore('contents');
      };
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        open.result.onversionchange = () => {
          open.result.close();
          this.database = undefined;
        };
        resolve(open.result);
      };
    }));
  }
  private async transaction<T>(
    mode: IDBTransactionMode,
    operation: (entries: IDBObjectStore, contents: IDBObjectStore) => Promise<T>,
    options: FileRequest = {}
  ) {
    options.signal?.throwIfAborted();
    const db = await this.db();
    options.signal?.throwIfAborted();
    const tx = db.transaction(['entries', 'contents'], mode);
    const abort = () => tx.abort();
    options.signal?.addEventListener('abort', abort, {once: true});
    const done = new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error ?? new DOMException('Operation aborted', 'AbortError'));
      tx.onerror = () => {};
    });
    // Observe the transaction rejection even if a request rejects first.
    done.catch(() => {});
    try {
      const result = await operation(tx.objectStore('entries'), tx.objectStore('contents'));
      await done;
      return result;
    } catch (error) {
      try {
        tx.abort();
      } catch {}
      throw error;
    } finally {
      options.signal?.removeEventListener('abort', abort);
    }
  }
  private root(): Entry {
    return {path: '', name: 'local', parent: '', type: 'folder'};
  }
  private async entry(entries: IDBObjectStore, path: string): Promise<Entry> {
    filePath(path, true);
    if (!path) return this.root();
    const result: Entry = await request(entries.get(path));
    if (!result) throw new StorageError('File not found', 'not-found');
    return result;
  }
  private async parents(entries: IDBObjectStore, path: string) {
    const parent = path.slice(0, path.lastIndexOf('/') + 1).replace(/\/$/, '');
    if (!parent) return;
    const existing: Entry = await request(entries.get(parent));
    if (existing) {
      if (existing.type !== 'folder') throw new StorageError('Parent is not a directory', 'invalid-path');
      return;
    }
    await this.parents(entries, parent);
    await request(
      entries.put({
        path: parent,
        name: parent.split('/').pop(),
        parent: parent.slice(0, parent.lastIndexOf('/') + 1).replace(/\/$/, ''),
        type: 'folder',
        created: Date.now(),
        modified: Date.now(),
      })
    );
  }
  getFileInfo(path: string, options?: FileRequest) {
    return this.transaction('readonly', (entries) => this.entry(entries, path), options);
  }
  getFile(path: string, options?: FileRequest) {
    return this.transaction(
      'readonly',
      async (entries, contents) => {
        const entry = await this.entry(entries, path);
        if (entry.type !== 'file') throw new StorageError('Not a file', 'invalid-path');
        const data: ArrayBuffer = await request(contents.get(path));
        return {data, revision: entry.revision};
      },
      options
    );
  }
  listFiles(path: string, options?: FileRequest) {
    return this.transaction(
      'readonly',
      async (entries) => {
        if ((await this.entry(entries, path)).type !== 'folder')
          throw new StorageError('Not a directory', 'invalid-path');
        return (await request(entries.index('parent').getAll(path))) as Entry[];
      },
      options
    );
  }
  async uploadFile(path: string, value: FilePayload, options: FileWriteOptions = {}) {
    filePath(path);
    const data = await fileBytes(value);
    return this.transaction(
      'readwrite',
      async (entries, contents) => {
        const previous: Entry = await request(entries.get(path));
        if (previous?.type === 'folder') throw new StorageError('Not a file', 'invalid-path');
        checkRevision(previous?.revision, options);
        await this.parents(entries, path);
        const revision = crypto.randomUUID();
        await request(
          entries.put({
            path,
            name: path.split('/').pop(),
            parent: path.slice(0, path.lastIndexOf('/') + 1).replace(/\/$/, ''),
            type: 'file',
            size: data.byteLength,
            created: previous?.created ?? Date.now(),
            modified: Date.now(),
            revision,
          })
        );
        await request(contents.put(data, path));
        return {revision};
      },
      options
    );
  }
  async createDirectory(path: string, options?: FileRequest) {
    filePath(path, true);
    if (!path) return;
    await this.transaction(
      'readwrite',
      async (entries) => {
        const previous: Entry = await request(entries.get(path));
        if (previous) {
          if (previous.type !== 'folder') throw new StorageError('Not a directory', 'invalid-path');
          return;
        }
        await this.parents(entries, path);
        await request(
          entries.put({
            path,
            name: path.split('/').pop(),
            parent: path.slice(0, path.lastIndexOf('/') + 1).replace(/\/$/, ''),
            type: 'folder',
            created: Date.now(),
            modified: Date.now(),
          })
        );
      },
      options
    );
  }
  async deleteFile(path: string, options: FileWriteOptions = {}) {
    filePath(path);
    await this.transaction(
      'readwrite',
      async (entries, contents) => {
        const entry = await this.entry(entries, path);
        checkRevision(entry.revision, options);
        const children =
          entry.type === 'folder'
            ? await request(entries.getAllKeys(IDBKeyRange.bound(`${path}/`, `${path}/\uffff`)))
            : [];
        for (const key of [...children, path]) {
          await request(entries.delete(key));
          await request(contents.delete(key));
        }
      },
      options
    );
  }
}
