import {StorageError, assertWritable, type FileEntry, type FileAccess} from '@ticlo/core/storage/FileAccess.ts';

export type ConfirmOverwrite = (entry: FileEntry) => Promise<boolean>;
export interface UploadEntry {
  path: string;
  file?: File;
}

export function parentPath(path: string) {
  return path.slice(0, path.lastIndexOf('/'));
}

export function validFileName(name: string) {
  return Boolean(name) && name === name.trim() && name !== '.' && name !== '..' && !/[/\\\u0000]/.test(name);
}

export function topEntries(entries: FileEntry[]) {
  return entries.filter((entry) => !entries.some((other) => entry.path.startsWith(`${other.path}/`)));
}

export function fileError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

/** File operations stay within one project; the project root cannot be mutated. */
export class FileOperations {
  readonly root: string;

  constructor(
    readonly storage: FileAccess,
    project: string,
    readonly signal?: AbortSignal
  ) {
    if (!validFileName(project) || project.includes('.') || project !== project.trim()) {
      throw new Error('Invalid project');
    }
    this.root = project;
  }

  checkPath(path: string, allowRoot = false) {
    if (
      !(allowRoot && path === this.root) &&
      (!path.startsWith(`${this.root}/`) || path.split('/').some((part) => !validFileName(part)))
    ) {
      throw new Error('Path must be inside the project');
    }
    this.signal?.throwIfAborted();
    return path;
  }

  async info(path: string) {
    this.checkPath(path, true);
    try {
      return await this.storage.getFileInfo(path, {signal: this.signal});
    } catch (error) {
      if (error instanceof StorageError && error.code === 'not-found') return null;
      throw error;
    }
  }

  async list(path: string) {
    this.checkPath(path, true);
    const entries = await this.storage.listFiles(path, {signal: this.signal});
    for (const entry of entries) {
      this.checkPath(entry.path);
      if (parentPath(entry.path) !== path) throw new Error('Invalid directory entry');
    }
    return entries.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'folder' ? -1 : 1));
  }

  async createFolder(directory: string, name: string) {
    this.checkPath(directory, true);
    assertWritable(this.storage, directory);
    if (!validFileName(name)) throw new Error('Invalid file name');
    const path = `${directory}/${name}`;
    if (await this.info(path)) throw new Error('An entry with this name already exists');
    await this.storage.createDirectory(path, {signal: this.signal});
  }

  async rename(entry: FileEntry, name: string) {
    this.checkPath(entry.path);
    assertWritable(this.storage, entry.path);
    if (!validFileName(name)) throw new Error('Invalid file name');
    if (name === entry.name) return;
    if (await this.info(`${parentPath(entry.path)}/${name}`)) {
      throw new Error('An entry with this name already exists');
    }
    await this.storage.renameFile(entry.path, name, {signal: this.signal});
  }

  async remove(entries: FileEntry[]) {
    for (const entry of entries) {
      this.checkPath(entry.path);
      assertWritable(this.storage, entry.path);
    }
    for (const entry of topEntries(entries)) {
      this.checkPath(entry.path);
      await this.storage.deleteFile(entry.path, {signal: this.signal});
    }
  }

  async copyName(entry: FileEntry, directory: string) {
    const dot = entry.type === 'file' ? entry.name.lastIndexOf('.') : -1;
    const base = dot > 0 ? entry.name.slice(0, dot) : entry.name;
    const ext = dot > 0 ? entry.name.slice(dot) : '';
    for (let index = 1; ; ++index) {
      const name = `${base} (${index})${ext}`;
      if (!(await this.info(`${directory}/${name}`))) return name;
    }
  }

  private async prepare(path: string, type: FileEntry['type'], confirm: ConfirmOverwrite) {
    const existing = await this.info(path);
    this.checkPath(path);
    if (existing) {
      if (!(await confirm(existing))) return null;
      this.checkPath(path);
      if (existing.type === 'folder' || type === 'folder') {
        await this.storage.deleteFile(path, {signal: this.signal});
      }
    }
    return existing?.type === 'file' && type === 'file' ? 'overwrite' : 'fail';
  }

  private async copy(entry: FileEntry, destination: string) {
    this.checkPath(entry.path);
    this.checkPath(destination);
    if (entry.type === 'file') {
      await this.storage.copyFile(entry.path, destination, {signal: this.signal});
    } else {
      const children = await this.list(entry.path);
      await this.storage.createDirectory(destination, {signal: this.signal});
      for (const child of children) await this.copy(child, `${destination}/${child.name}`);
    }
  }

  async transfer(
    entries: FileEntry[],
    directory: string,
    move: boolean,
    confirm: ConfirmOverwrite,
    onComplete?: (entry: FileEntry) => void
  ) {
    this.checkPath(directory, true);
    assertWritable(this.storage, directory);
    const sources = topEntries(entries);
    // Validate the whole selection before changing any files.
    for (const entry of sources) {
      this.checkPath(entry.path);
      if (move) assertWritable(this.storage, entry.path);
      const target = `${directory}/${entry.name}`;
      if (directory === entry.path || directory.startsWith(`${entry.path}/`) || entry.path.startsWith(`${target}/`)) {
        throw new Error('Cannot copy or move a folder into itself');
      }
      if (
        sources.some(
          (other) => other.path !== entry.path && (other.path === target || other.path.startsWith(`${target}/`))
        )
      ) {
        throw new Error('Cannot overwrite a selected source');
      }
    }
    const completed: FileEntry[] = [];
    const finish = (entry: FileEntry) => {
      completed.push(entry);
      onComplete?.(entry);
    };
    for (const entry of sources) {
      if (!(await this.info(entry.path))) throw new Error('Source entry no longer exists');
      if (move && parentPath(entry.path) === directory) {
        finish(entry);
        continue;
      }
      const name = !move && parentPath(entry.path) === directory ? await this.copyName(entry, directory) : entry.name;
      const destination = `${directory}/${name}`;
      const existsBehavior = await this.prepare(destination, entry.type, confirm);
      if (!existsBehavior) continue;
      if (existsBehavior === 'overwrite') {
        const source = await this.storage.getFile(entry.path, {signal: this.signal});
        await this.storage.uploadFile(destination, source.data, {existsBehavior, signal: this.signal});
        if (move) await this.storage.deleteFile(entry.path, {revision: source.revision, signal: this.signal});
      } else if (move) {
        this.checkPath(entry.path);
        await this.storage.moveFile(entry.path, destination, {signal: this.signal});
      } else {
        await this.copy(entry, destination);
      }
      finish(entry);
    }
    return completed;
  }

  async upload(entries: UploadEntry[], directory: string, confirm: ConfirmOverwrite) {
    this.checkPath(directory, true);
    assertWritable(this.storage, directory);
    for (const entry of entries) this.checkPath(`${directory}/${entry.path}`);
    const skipped: string[] = [];
    for (const entry of entries) {
      if (skipped.some((path) => entry.path.startsWith(`${path}/`))) continue;
      const path = `${directory}/${entry.path}`;
      if (!entry.file) {
        const existing = await this.info(path);
        if (existing?.type === 'folder') continue;
        if (existing && !(await this.prepare(path, 'folder', confirm))) {
          skipped.push(entry.path);
          continue;
        }
        await this.storage.createDirectory(path, {signal: this.signal});
      } else {
        const existsBehavior = await this.prepare(path, 'file', confirm);
        if (!existsBehavior) continue;
        await this.storage.uploadFile(path, entry.file, {existsBehavior, signal: this.signal});
      }
    }
  }
}

/** Capture dropped entries while the browser's DataTransfer is still readable. */
export function droppedUploads(data: DataTransfer): Promise<UploadEntry[]> {
  const entries = Array.from(data.items ?? [])
    .map((item) => item.webkitGetAsEntry?.())
    .filter(Boolean);
  const files = Array.from(data.files);
  async function read(entry: FileSystemEntry, parent = ''): Promise<UploadEntry[]> {
    const path = `${parent}${entry.name}`;
    if (entry.isFile) {
      const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject));
      return [{path, file}];
    }
    const result: UploadEntry[] = [{path}];
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    for (;;) {
      const children = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
      if (!children.length) break;
      for (const child of children) result.push(...(await read(child, `${path}/`)));
    }
    return result;
  }
  return entries.length
    ? Promise.all(entries.map((entry) => read(entry))).then((lists) => lists.flat())
    : Promise.resolve(files.map((file) => ({path: file.name, file})));
}
