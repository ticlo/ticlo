import {defaultConfigs} from '../../block/Descriptor.ts';
import {globalFunctions} from '../../block/FunctionModule.ts';
import {StorageError, type FileAccess, type FilePayload} from '../../storage/FileAccess.ts';
import {BaseFileFunction} from './BaseFileFunction.ts';

const existsBehaviorList = ['overwrite', 'fail'] as const;

function toFilePayload(value: unknown): FilePayload {
  if (
    typeof value === 'string' ||
    value instanceof Uint8Array ||
    value instanceof ArrayBuffer ||
    (typeof Blob !== 'undefined' && value instanceof Blob)
  ) {
    return value;
  }
  if (value === undefined) {
    throw new Error('File data is required');
  }
  return JSON.stringify(value, null, 2);
}

async function transferAcrossStorages(
  srcAccess: FileAccess,
  srcPath: string,
  dstAccess: FileAccess,
  dstPath: string,
  move: boolean,
  signal: AbortSignal
): Promise<void> {
  const entry = await srcAccess.getFileInfo(srcPath, {signal});
  signal.throwIfAborted();
  if (entry.type === 'folder') {
    await dstAccess.createDirectory(dstPath, {signal});
    for (const child of await srcAccess.listFiles(srcPath, {signal})) {
      await transferAcrossStorages(srcAccess, child.path, dstAccess, `${dstPath}/${child.name}`, move, signal);
    }
    if (move) {
      await srcAccess.deleteFile(srcPath, {signal});
    }
    return;
  }
  const read = await srcAccess.getFile(srcPath, {signal});
  await dstAccess.uploadFile(dstPath, read.data, {existsBehavior: 'fail', signal});
  if (move) {
    await srcAccess.deleteFile(srcPath, {revision: read.revision, signal});
  }
}

export class WriteFileFunction extends BaseFileFunction {
  protected override async execute(signal: AbortSignal, revision: number, controller: AbortController): Promise<void> {
    const {access, path} = this.resolveProjectTarget(this._data.getValue('path'));
    const payload = toFilePayload(this._data.getValue('data'));
    const rawBehavior = this._data.getValue('existsBehavior');
    const existsBehavior = rawBehavior === 'fail' ? 'fail' : 'overwrite';
    const expectedRevision = this._data.getValue('revision');
    const result = await access.uploadFile(path, payload, {
      existsBehavior,
      signal,
      ...(typeof expectedRevision === 'string' && expectedRevision ? {revision: expectedRevision} : undefined),
    });
    if (this.isStale(revision, controller)) return;
    this._data.output(result.revision);
  }

  protected override clearOutputs(): void {
    this._data.output(undefined);
  }
}

globalFunctions.addFactory(
  WriteFileFunction,
  {
    name: 'write',
    icon: 'svg:file-arrow-up',
    mode: 'onCall',
    priority: 2,
    configs: defaultConfigs.concat('#cancel'),
    properties: [
      {name: 'path', type: 'file-path', pinned: true},
      {name: 'data', type: 'any', pinned: true},
      {name: 'existsBehavior', type: 'select', options: existsBehaviorList, default: 'overwrite'},
      {name: 'revision', type: 'string'},
      {name: '#output', type: 'string', readonly: true, pinned: true},
    ],
  },
  'file'
);

export class MkdirFunction extends BaseFileFunction {
  protected override async execute(signal: AbortSignal): Promise<void> {
    const {access, path} = this.resolveProjectTarget(this._data.getValue('path'));
    await access.createDirectory(path, {signal});
  }
}

globalFunctions.addFactory(
  MkdirFunction,
  {
    name: 'mkdir',
    icon: 'svg:folder',
    mode: 'onCall',
    priority: 2,
    configs: defaultConfigs.concat('#cancel'),
    properties: [{name: 'path', type: 'file-path', pinned: true}],
  },
  'file'
);

export class DeleteFileFunction extends BaseFileFunction {
  protected override async execute(signal: AbortSignal): Promise<void> {
    const {access, path} = this.resolveProjectTarget(this._data.getValue('path'));
    const expectedRevision = this._data.getValue('revision');
    await access.deleteFile(path, {
      signal,
      ...(typeof expectedRevision === 'string' && expectedRevision ? {revision: expectedRevision} : undefined),
    });
  }
}

globalFunctions.addFactory(
  DeleteFileFunction,
  {
    name: 'delete',
    icon: 'svg:file',
    mode: 'onCall',
    priority: 3,
    configs: defaultConfigs.concat('#cancel'),
    properties: [
      {name: 'path', type: 'file-path', pinned: true},
      {name: 'revision', type: 'string'},
    ],
  },
  'file'
);

abstract class TransferFileFunction extends BaseFileFunction {
  protected abstract readonly move: boolean;

  protected override async execute(signal: AbortSignal): Promise<void> {
    const src = this.resolveProjectTarget(this._data.getValue('source'));
    const dst = this.resolveProjectTarget(this._data.getValue('destination'));
    if (src.access === dst.access) {
      if (this.move) {
        await src.access.moveFile(src.path, dst.path, {signal});
      } else {
        await src.access.copyFile(src.path, dst.path, {signal});
      }
      return;
    }
    await transferAcrossStorages(src.access, src.path, dst.access, dst.path, this.move, signal);
  }
}

export class CopyFileFunction extends TransferFileFunction {
  protected readonly move = false;
}

globalFunctions.addFactory(
  CopyFileFunction,
  {
    name: 'copy',
    icon: 'svg:file',
    mode: 'onCall',
    priority: 2,
    configs: defaultConfigs.concat('#cancel'),
    properties: [
      {name: 'source', type: 'file-path', pinned: true},
      {name: 'destination', type: 'file-path', pinned: true},
    ],
  },
  'file'
);

export class MoveFileFunction extends TransferFileFunction {
  protected readonly move = true;
}

globalFunctions.addFactory(
  MoveFileFunction,
  {
    name: 'move',
    icon: 'svg:file',
    mode: 'onCall',
    priority: 3,
    configs: defaultConfigs.concat('#cancel'),
    properties: [
      {name: 'source', type: 'file-path', pinned: true},
      {name: 'destination', type: 'file-path', pinned: true},
    ],
  },
  'file'
);

export class RenameFileFunction extends BaseFileFunction {
  protected override async execute(signal: AbortSignal): Promise<void> {
    const {access, path} = this.resolveProjectTarget(this._data.getValue('path'));
    const name = this._data.getValue('name');
    if (typeof name !== 'string' || !name) {
      throw new StorageError('File name is required', 'invalid-path');
    }
    await access.renameFile(path, name, {signal});
  }
}

globalFunctions.addFactory(
  RenameFileFunction,
  {
    name: 'rename',
    icon: 'svg:file',
    mode: 'onCall',
    priority: 3,
    configs: defaultConfigs.concat('#cancel'),
    properties: [
      {name: 'path', type: 'file-path', pinned: true},
      {name: 'name', type: 'string', pinned: true},
    ],
  },
  'file'
);
