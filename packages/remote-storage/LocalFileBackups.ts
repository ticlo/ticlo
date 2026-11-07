import type {FileReadResult} from '@ticlo/core/storage/FileAccess.ts';

export interface LocalFileBackup extends FileReadResult {
  scope: string;
  path: string;
  modified: number;
}

const request = <T>(value: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    value.onsuccess = () => resolve(value.result);
    value.onerror = () => reject(value.error);
  });

/** Failed editor saves share the local-files database, but not the local project stores. */
export class LocalFileBackups {
  private database?: Promise<IDBDatabase>;

  constructor(private readonly name = 'ticlo-local-files') {}

  private db() {
    return (this.database ??= new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open(this.name, 2);
      open.onupgradeneeded = () => {
        if (!open.result.objectStoreNames.contains('entries')) {
          const entries = open.result.createObjectStore('entries', {keyPath: 'path'});
          entries.createIndex('parent', 'parent');
          open.result.createObjectStore('contents');
        }
        if (!open.result.objectStoreNames.contains('backups')) {
          const backups = open.result.createObjectStore('backups', {keyPath: ['scope', 'path']});
          backups.createIndex('scope', 'scope');
        }
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

  async close() {
    if (this.database) (await this.database).close();
    this.database = undefined;
  }

  private async operation<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => Promise<T>) {
    const db = await this.db();
    const tx = db.transaction('backups', mode);
    const done = new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
    });
    done.catch(() => {});
    const result = await run(tx.objectStore('backups'));
    await done;
    return result;
  }

  get(scope: string, path: string) {
    if (typeof indexedDB === 'undefined') return Promise.resolve(undefined);
    return this.operation('readonly', (store) => request<LocalFileBackup | undefined>(store.get([scope, path])));
  }

  list(scope: string) {
    if (typeof indexedDB === 'undefined') return Promise.resolve([] as LocalFileBackup[]);
    return this.operation('readonly', (store) =>
      request<LocalFileBackup[]>(store.index('scope').getAll(IDBKeyRange.only(scope)))
    );
  }

  put(backup: LocalFileBackup) {
    if (typeof indexedDB === 'undefined') return Promise.resolve();
    return this.operation('readwrite', async (store) => {
      await request(store.put(backup));
    });
  }

  delete(scope: string, path: string) {
    if (typeof indexedDB === 'undefined') return Promise.resolve();
    return this.operation('readwrite', async (store) => {
      await request(store.delete([scope, path]));
    });
  }
}
