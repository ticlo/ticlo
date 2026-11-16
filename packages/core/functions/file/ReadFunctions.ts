import {defaultConfigs} from '../../block/Descriptor.ts';
import {NO_EMIT} from '../../block/Event.ts';
import {globalFunctions} from '../../block/FunctionModule.ts';
import {StorageError, type FileReadResult} from '../../storage/FileAccess.ts';
import {classifyFilePath, fetchFileResult} from '../../storage/FilePath.ts';
import {BaseFileFunction} from './BaseFileFunction.ts';

const readFormatList = ['text', 'json', 'binary'] as const;
const textDecoder = new TextDecoder();

function decodeReadOutput(data: ArrayBuffer, format: unknown): unknown {
  switch (format) {
    case 'binary':
      return new Uint8Array(data);
    case 'json':
      return JSON.parse(textDecoder.decode(data));
    default:
      return textDecoder.decode(data);
  }
}

export class ReadFileFunction extends BaseFileFunction {
  protected override prepare(): unknown {
    const rawPath = this._data.getValue('path');
    if (rawPath == null || rawPath === '') return NO_EMIT;
    return undefined;
  }

  protected override async execute(signal: AbortSignal, revision: number, controller: AbortController): Promise<void> {
    const rawPath = this._data.getValue('path');
    if (typeof rawPath !== 'string' || !rawPath) {
      throw new StorageError('File path is required', 'invalid-path');
    }
    const format = this._data.getValue('format');
    const {storage, library} = this.getStorageContext();
    let result: FileReadResult;
    if (storage?.readFile) {
      result = await storage.readFile(rawPath, library, {signal});
    } else if (classifyFilePath(rawPath) === 'url') {
      result = await fetchFileResult(rawPath.startsWith('//') ? `https:${rawPath}` : rawPath, {signal});
    } else {
      throw new StorageError('File storage is not available', 'not-found');
    }
    if (this.isStale(revision, controller)) return;
    const output = decodeReadOutput(result.data, format);
    this._data.output(result.revision, 'revision');
    this._data.output(result.contentType, 'contentType');
    this._data.output(output);
  }

  protected override clearOutputs(): void {
    this._data.output(undefined, 'revision');
    this._data.output(undefined, 'contentType');
    this._data.output(undefined);
  }
}

globalFunctions.addFactory(
  ReadFileFunction,
  {
    name: 'read',
    icon: 'svg:file-arrow-down',
    mode: 'onLoad',
    priority: 1,
    configs: defaultConfigs.concat('#cancel'),
    properties: [
      {name: 'path', type: 'file-path', pinned: true},
      {name: 'format', type: 'select', options: readFormatList, default: 'text'},
      {name: 'revision', type: 'string', readonly: true},
      {name: 'contentType', type: 'string', readonly: true},
      {name: '#output', type: 'any', readonly: true, pinned: true},
    ],
  },
  'file'
);

export class ListFilesFunction extends BaseFileFunction {
  protected override prepare(): unknown {
    const rawPath = this._data.getValue('path');
    if (rawPath == null || rawPath === '') return NO_EMIT;
    return undefined;
  }

  protected override async execute(signal: AbortSignal, revision: number, controller: AbortController): Promise<void> {
    const {access, path} = this.resolveProjectTarget(this._data.getValue('path'), {allowEmptyRelative: true});
    const entries = await access.listFiles(path, {signal});
    if (this.isStale(revision, controller)) return;
    this._data.output(entries);
  }

  protected override clearOutputs(): void {
    this._data.output(undefined);
  }
}

globalFunctions.addFactory(
  ListFilesFunction,
  {
    name: 'list',
    icon: 'svg:list',
    mode: 'onLoad',
    priority: 1,
    configs: defaultConfigs.concat('#cancel'),
    properties: [
      {name: 'path', type: 'file-path', pinned: true},
      {name: '#output', type: 'array', readonly: true, pinned: true},
    ],
  },
  'file'
);

export class FileInfoFunction extends BaseFileFunction {
  protected override prepare(): unknown {
    const rawPath = this._data.getValue('path');
    if (rawPath == null || rawPath === '') return NO_EMIT;
    return undefined;
  }

  protected override async execute(signal: AbortSignal, revision: number, controller: AbortController): Promise<void> {
    const {access, path} = this.resolveProjectTarget(this._data.getValue('path'), {allowEmptyRelative: true});
    try {
      const entry = await access.getFileInfo(path, {signal});
      if (this.isStale(revision, controller)) return;
      this._data.output(true, 'exists');
      this._data.output(entry);
    } catch (error) {
      if (error instanceof StorageError && error.code === 'not-found') {
        if (this.isStale(revision, controller)) return;
        this._data.output(false, 'exists');
        this._data.output(undefined);
        return;
      }
      throw error;
    }
  }

  protected override clearOutputs(): void {
    this._data.output(undefined, 'exists');
    this._data.output(undefined);
  }
}

globalFunctions.addFactory(
  FileInfoFunction,
  {
    name: 'info',
    icon: 'svg:file',
    mode: 'onLoad',
    priority: 1,
    configs: defaultConfigs.concat('#cancel'),
    properties: [
      {name: 'path', type: 'file-path', pinned: true},
      {name: 'exists', type: 'toggle', readonly: true},
      {name: '#output', type: 'object', readonly: true, pinned: true},
    ],
  },
  'file'
);
