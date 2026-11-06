interface FileEntryBase {
  path: string;
  name: string;
  created: number;
  modified: number;
  gitStatus?: 'added' | 'modified' | 'deleted';
}

interface GitInfo {
  initialized: boolean;
  branch?: string;
}

interface GitCommit {
  hash: string;
  author: string;
  email: string;
  date: string;
  message: string;
}

interface FileEntryFile extends FileEntryBase {
  type: 'file';
  size: number;
}

interface FileEntryFolder extends FileEntryBase {
  type: 'folder';
}

type FileEntry = FileEntryFile | FileEntryFolder;

type FileInfo = FileEntry;

type ExistsBehavior = 'fail' | 'overwrite';

type ProjectMetadata = Record<string, unknown> & {
  id: string;
};

export type {ExistsBehavior, FileEntry, FileEntryFile, FileEntryFolder, FileInfo, GitCommit, GitInfo, ProjectMetadata};
