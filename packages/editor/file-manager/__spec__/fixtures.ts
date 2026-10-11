import {vi} from 'vitest';
import type {FileEntry, TicloFileClient} from '@ticlo/file-client';
import {parentPath} from '../FileOperations.ts';

export function file(path: string, size = 12): FileEntry {
  return {type: 'file', path, name: path.split('/').pop(), size, created: 1, modified: 1};
}

export function folder(path: string): FileEntry {
  return {type: 'folder', path, name: path.split('/').pop(), created: 1, modified: 1};
}

export function fixtureClient(initial: FileEntry[]) {
  const entries = new Map(initial.map((entry) => [entry.path, entry]));
  const missing = () => {
    throw {response: {status: 404, data: {message: 'Not found'}}};
  };
  const move = (source: string, destination: string) => {
    if (!entries.has(source)) missing();
    for (const [path, entry] of [...entries]) {
      if (path === source || path.startsWith(`${source}/`)) {
        entries.delete(path);
        const target = `${destination}${path.slice(source.length)}`;
        entries.set(target, {...entry, path: target, name: target.split('/').pop()});
      }
    }
  };
  const methods = {
    listFiles: vi.fn(async (path: string) => [...entries.values()].filter((entry) => parentPath(entry.path) === path)),
    getFileInfo: vi.fn(async (path: string) => entries.get(path) ?? missing()),
    getFile: vi.fn(async (_path: string, _config?: {signal?: AbortSignal}) => ({
      data: new TextEncoder().encode('preview text').buffer,
      headers: {},
    })),
    copyFile: vi.fn(async (source: string, destination: string) => {
      const entry = entries.get(source) ?? missing();
      if (entry.type === 'folder') throw new Error('Server cannot copy directories');
      entries.set(destination, {...entry, path: destination, name: destination.split('/').pop()});
    }),
    moveFile: vi.fn(async (source: string, destination: string) => move(source, destination)),
    renameFile: vi.fn(async (source: string, name: string) => move(source, `${parentPath(source)}/${name}`)),
    createDirectory: vi.fn(async (path: string) => {
      entries.set(path, folder(path));
    }),
    deleteFile: vi.fn(async (path: string) => {
      for (const key of entries.keys()) if (key === path || key.startsWith(`${path}/`)) entries.delete(key);
    }),
    uploadFile: vi.fn(async (path: string, payload: File, _options?: {existsBehavior: string}) => {
      entries.set(path, file(path, payload.size));
      return path;
    }),
  };
  return {client: methods as unknown as TicloFileClient, methods, entries};
}
