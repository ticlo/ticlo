import React, {useContext} from 'react';
import {Button, Dropdown, Input, Modal, Popover, Spin, Table, Tree, type MenuProps} from 'antd';
import {DateTime} from 'luxon';
import {
  CloseOutlined,
  CopyOutlined,
  DeleteOutlined,
  DownOutlined,
  DownloadOutlined,
  EditOutlined,
  EllipsisOutlined,
  EyeOutlined,
  FileAddOutlined,
  FileImageOutlined,
  FileOutlined,
  FolderAddOutlined,
  FolderOpenOutlined,
  FolderOutlined,
  ReloadOutlined,
  RollbackOutlined,
  ScissorOutlined,
  SnippetsOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import {
  type FileEntry,
  type FileAccess,
  type GitCommit,
  type GitInfo,
  type LocalBackupAccess,
  type ProjectGit,
  StorageError,
  projectId,
} from '@ticlo/core/storage/FileAccess.ts';
import {translateEditor} from '@ticlo/core/editor.ts';
import {validFlowEntry} from '@ticlo/core/util/FlowStoragePath.ts';
import {ExpandIcon} from '../component/Tree.tsx';
import VirtualList from '../component/Virtual.tsx';
import {TicloI18NContext} from '../component/LayoutContext.ts';
import {t} from '../component/LocalizedLabel.tsx';
import {FilePreview, previewType} from './FilePreview.tsx';
import {droppedUploads, fileError, FileOperations, parentPath, topEntries, validFileName} from './FileOperations.ts';

export interface FileManagerProps {
  storage: FileAccess;
  /** Project / namespace ID, without a leading +; #root is the global namespace. */
  project: string;
  defaultPreview?: boolean;
  /** Show only the file tree for a file selection dialog. */
  picker?: boolean;
  onSelect?: (entries: FileEntry[]) => void;
  onOpen?: (entry: FileEntry) => void | Promise<void>;
  onFilesDeleted?: (paths: string[]) => void | Promise<void>;
  onFileDiscarded?: (path: string) => void | Promise<void>;
  onProjectReset?: () => void | Promise<void>;
  onChange?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

interface PanelProps extends FileManagerProps {
  confirm: (title: React.ReactNode, content: React.ReactNode, signal: AbortSignal) => Promise<boolean>;
}

interface State {
  selected: string[];
  folderMenu?: boolean;
  preview: boolean;
  busy: boolean;
  error?: string;
  dropPath?: string;
  dialog?: {entry?: FileEntry; directory?: string; flow?: boolean};
  name: string;
  gitInfo?: GitInfo;
  gitDialog?: 'commit' | 'history';
  gitMessage: string;
  gitHistory: GitCommit[];
  gitBranches: string[];
  gitBranch?: string;
  gitBranchOpen?: boolean;
  gitLog: string;
  gitSelected?: string;
  gitCreate?: {commit: string; name: string};
  rootInfo?: FileEntry;
}

interface GitLogRow {
  key: number;
  date: string;
  user: string;
  change: string;
  file: string;
}

interface GitBranchNode {
  key: string;
  title: string;
  selectable?: boolean;
  children?: GitBranchNode[];
}

function branchTree(branches: string[]): GitBranchNode[] {
  const roots: GitBranchNode[] = [];
  for (const branch of [...branches].sort().reverse()) {
    let nodes = roots;
    let key = '';
    const parts = branch.split('/');
    for (const [index, part] of parts.entries()) {
      key = key ? `${key}/${part}` : part;
      let node = nodes.find((item) => item.key === key);
      if (!node) {
        node = {key, title: part, selectable: index === parts.length - 1, children: []};
        nodes.push(node);
      }
      nodes = node.children;
    }
  }
  return roots;
}

const pendingHash = 'uncommitted';
const logSeparator = '\n\n--- --- ---\n';

function validNamespaceName(name: string) {
  try {
    return validFlowEntry(name) && projectId(name) === name;
  } catch {
    return false;
  }
}

function parseGitLog(log: string): GitLogRow[] | null {
  const rows: GitLogRow[] = [];
  let fields: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index <= log.length; index++) {
    if (index === log.length && quoted) return null;
    const char = log[index] ?? '\n';
    if (quoted) {
      if (char === '"' && log[index + 1] === '"') {
        field += '"';
        index++;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') {
      if (field) return null;
      quoted = true;
    } else if (char === ',') {
      fields.push(field);
      field = '';
    } else if (char === '\r' && log[index + 1] === '\n') {
      continue;
    } else if (char === '\n') {
      fields.push(field);
      if (fields.length !== 1 || fields[0]) {
        if (fields.length !== 4) return null;
        rows.push({key: rows.length, date: fields[0], user: fields[1], change: fields[2], file: fields[3]});
      }
      fields = [];
      field = '';
    } else field += char;
  }
  return rows;
}

function splitCommitMessage(message: string) {
  const normalized = message.replaceAll('\r\n', '\n').trimEnd();
  const separator = normalized.lastIndexOf(logSeparator);
  return separator < 0
    ? {comment: normalized, log: ''}
    : {comment: normalized.slice(0, separator), log: normalized.slice(separator + logSeparator.length)};
}

export function FileManager(props: FileManagerProps) {
  useContext(TicloI18NContext);
  const [modal, holder] = Modal.useModal();
  const confirm: PanelProps['confirm'] = (title, content, signal) => {
    if (signal.aborted) return Promise.resolve(false);
    const dialog = modal.confirm({title, content, okText: t('OK'), cancelText: t('Cancel')});
    return new Promise<boolean>((resolve) => {
      const finish = (answer: boolean) => {
        signal.removeEventListener('abort', cancel);
        resolve(answer);
      };
      const cancel = () => {
        dialog.destroy();
        finish(false);
      };
      signal.addEventListener('abort', cancel, {once: true});
      void dialog.then(finish, () => finish(false));
    });
  };
  return (
    <>
      <FileManagerPanel key={props.project} {...props} confirm={confirm} />
      {holder}
    </>
  );
}

class FileManagerPanel extends React.Component<PanelProps, State> {
  state: State = {
    selected: [],
    preview: this.props.defaultPreview ?? true,
    busy: false,
    name: '',
    gitMessage: '',
    gitHistory: [],
    gitBranches: [],
    gitLog: '',
  };
  private controller = new AbortController();
  private files = new FileOperations(this.props.storage, this.props.project, this.controller.signal);
  private folders = new Map<string, FileEntry[]>();
  private expanded = new Set([this.files.root]);
  private loading = new Map<string, Promise<void>>();
  private clipboard: {entries: FileEntry[]; move: boolean};
  private dragged: FileEntry[];
  private anchor: string;
  private generation = 0;
  private folderVersion = 0;
  private live = false;
  private locked = false;
  private container: HTMLDivElement;
  private uploadInput: HTMLInputElement;
  private uploadDirectory?: string;
  private menuDirectory: string;
  private rows: {entry: FileEntry; level: number}[] = [];
  private stopFileChanges?: () => void;
  private pendingFileChanges = new Set<string>();
  private fileChangeTimer?: ReturnType<typeof setTimeout>;
  private refreshingFileChanges = false;
  private gitContextHash?: string;

  private get rootEntry(): FileEntry {
    return (
      this.state.rootInfo ?? {type: 'folder', path: this.files.root, name: this.props.project, created: 0, modified: 0}
    );
  }

  private git(): ProjectGit | undefined {
    const storage = this.props.storage as FileAccess & Partial<ProjectGit>;
    return storage.supportsGit?.(this.props.project) ? (storage as ProjectGit) : undefined;
  }

  componentDidMount() {
    this.live = true;
    // StrictMode may remount this instance after aborting the initial requests.
    if (this.controller.signal.aborted) this.reset();
    this.stopFileChanges = this.props.storage.subscribeFileChanges?.(this.fileChanged);
    this.props.onSelect?.([]);
    this.reload();
  }

  componentDidUpdate(previous: PanelProps) {
    if (previous.storage !== this.props.storage || previous.project !== this.props.project) {
      this.stopFileChanges?.();
      this.reset();
      this.stopFileChanges = this.props.storage.subscribeFileChanges?.(this.fileChanged);
      this.setState({
        selected: [],
        folderMenu: undefined,
        error: undefined,
        dialog: undefined,
        dropPath: undefined,
        busy: false,
        gitInfo: undefined,
        gitDialog: undefined,
        gitSelected: undefined,
        gitLog: '',
        rootInfo: undefined,
      });
      this.props.onSelect?.([]);
      this.reload();
    }
  }

  componentWillUnmount() {
    this.live = false;
    this.stopFileChanges?.();
    clearTimeout(this.fileChangeTimer);
    ++this.generation;
    ++this.folderVersion;
    this.controller.abort();
  }

  private reset() {
    this.controller.abort();
    ++this.generation;
    clearTimeout(this.fileChangeTimer);
    this.fileChangeTimer = undefined;
    this.pendingFileChanges.clear();
    this.refreshingFileChanges = false;
    this.controller = new AbortController();
    this.files = new FileOperations(this.props.storage, this.props.project, this.controller.signal);
    this.folders.clear();
    this.loading.clear();
    this.expanded = new Set([this.files.root]);
    this.clipboard = undefined;
    this.dragged = undefined;
    this.uploadDirectory = undefined;
    this.menuDirectory = undefined;
    this.anchor = undefined;
    this.locked = false;
  }

  private current(generation: number) {
    return this.live && generation === this.generation;
  }

  private entry(path: string) {
    if (path === this.files.root) return this.rootEntry;
    for (const children of this.folders.values()) {
      const entry = children.find((entry) => entry.path === path);
      if (entry) return entry;
    }
  }

  private selected() {
    return this.state.selected.map((path) => this.entry(path)).filter(Boolean);
  }

  private directory() {
    const [entry] = this.selected();
    return entry ? (entry.type === 'folder' ? entry.path : parentPath(entry.path)) : this.files.root;
  }

  private select(paths: string[]) {
    this.setState({selected: paths});
    this.props.onSelect?.(paths.map((path) => this.entry(path)).filter(Boolean));
  }

  private loadFolder(path: string): Promise<void> {
    if (this.loading.has(path)) return this.loading.get(path);
    const generation = this.generation;
    const version = this.folderVersion;
    const request = this.files
      .list(path)
      .then((entries) => {
        if (this.current(generation) && version === this.folderVersion) this.folders.set(path, entries);
      })
      .finally(() => {
        if (this.current(generation) && version === this.folderVersion) {
          this.loading.delete(path);
          this.forceUpdate();
        }
      });
    this.loading.set(path, request);
    this.forceUpdate();
    return request;
  }

  private async refresh() {
    const generation = this.generation;
    const version = ++this.folderVersion;
    this.loading.clear();
    this.folders.clear();
    const visit = async (path: string) => {
      await this.loadFolder(path);
      if (!this.current(generation) || version !== this.folderVersion) return;
      for (const entry of this.folders.get(path) ?? []) {
        if (entry.type === 'folder' && this.expanded.has(entry.path)) await visit(entry.path);
      }
    };
    await visit(this.files.root);
    const git = this.git();
    const rootInfo = git ? ((await this.files.info(this.files.root)) ?? undefined) : undefined;
    const gitInfo = git ? await git.getGitInfo(this.props.project, {signal: this.files.signal}) : undefined;
    if (this.current(generation)) this.setState({gitInfo, rootInfo});
    if (this.current(generation)) this.select(this.state.selected.filter((path) => this.entry(path)));
  }

  private fileChanged = (path: string) => {
    if (path !== this.files.root && !path.startsWith(`${this.files.root}/`)) return;
    this.pendingFileChanges.add(path);
    this.scheduleFileChanges();
  };

  private scheduleFileChanges() {
    if (
      !this.live ||
      this.locked ||
      this.refreshingFileChanges ||
      this.fileChangeTimer ||
      !this.pendingFileChanges.size
    )
      return;
    this.fileChangeTimer = setTimeout(() => {
      this.fileChangeTimer = undefined;
      if (!this.live || this.locked) return;
      void this.refreshFileChanges();
    }, 30);
  }

  private async refreshFileChanges() {
    this.refreshingFileChanges = true;
    const changed = [...this.pendingFileChanges];
    this.pendingFileChanges.clear();
    const generation = this.generation;
    const version = this.folderVersion;
    const folders = [...this.expanded].filter((folder) =>
      changed.some(
        (path) =>
          path === this.files.root || (path === folder ? folder === this.files.root : path.startsWith(`${folder}/`))
      )
    );
    try {
      await Promise.all(
        folders.map(async (folder) => {
          await this.loading.get(folder)?.catch(() => {});
          if (!this.current(generation) || version !== this.folderVersion || !this.expanded.has(folder)) return;
          await this.loadFolder(folder);
        })
      );
      if (this.current(generation) && version === this.folderVersion) {
        for (const path of changed) {
          if (path === this.files.root || !this.expanded.has(path)) continue;
          const parent = parentPath(path);
          if (
            !this.expanded.has(parent) ||
            !this.folders.get(parent)?.some((entry) => entry.path === path && entry.type === 'folder')
          ) {
            for (const folder of this.expanded) {
              if (folder === path || folder.startsWith(`${path}/`)) {
                this.expanded.delete(folder);
                this.folders.delete(folder);
              }
            }
          }
        }
        const rootInfo = this.git() ? ((await this.files.info(this.files.root)) ?? undefined) : undefined;
        if (this.current(generation) && version === this.folderVersion) {
          if (this.git()) this.setState({rootInfo});
          this.select(this.state.selected.filter((path) => this.entry(path)));
        }
      }
    } catch (error) {
      if (this.current(generation) && version === this.folderVersion) this.setState({error: fileError(error)});
    } finally {
      if (generation === this.generation) {
        this.refreshingFileChanges = false;
        this.scheduleFileChanges();
      }
    }
  }

  private run = async (operation: () => Promise<unknown>, refresh = true, changed = true) => {
    if (this.locked) return;
    this.locked = true;
    const generation = this.generation;
    this.setState({busy: true, error: undefined});
    let error: string;
    try {
      await operation();
    } catch (reason) {
      error = fileError(reason);
    }
    if (!this.current(generation)) return;
    if (refresh) {
      this.pendingFileChanges.clear();
      try {
        await this.refresh();
      } catch (reason) {
        error ??= fileError(reason);
      }
    }
    if (!this.current(generation)) return;
    this.locked = false;
    this.setState({busy: false, error});
    this.scheduleFileChanges();
    if (changed) this.props.onChange?.();
  };

  private reload = () => this.run(() => this.refresh(), false, false);

  private resetToCommit = (commit: string) => {
    const git = this.git();
    if (!git) return;
    return this.run(
      async () => {
        const currentGitInfo = await git.getGitInfo(this.props.project, {signal: this.files.signal});
        if (
          currentGitInfo.hasUncommittedChanges !== false &&
          !(await this.props.confirm(
            t('Reset to This Commit?'),
            t('A backup branch will preserve the current commit history. All uncommitted changes will be discarded.'),
            this.files.signal
          ))
        )
          return;
        await git.resetGitToCommit(this.props.project, commit, {signal: this.files.signal});
        await this.props.onProjectReset?.();
        const [gitInfo, gitBranches, gitHistory] = await Promise.all([
          git.getGitInfo(this.props.project, {signal: this.files.signal}),
          git.getGitBranches(this.props.project, {signal: this.files.signal}),
          git.getGitHistory(this.props.project, {signal: this.files.signal}),
        ]);
        this.setState({
          gitInfo,
          gitBranches,
          gitBranch: gitInfo.branch,
          gitHistory,
          gitLog: '',
          gitSelected: commit,
        });
      },
      true,
      false
    );
  };

  private selectGitBranch = (branch: string) => {
    this.setState({gitBranchOpen: false});
    if (branch === this.state.gitBranch) return;
    const git = this.git();
    if (!git) return;
    void this.run(
      async () => {
        const gitHistory = await git.getGitHistory(this.props.project, {signal: this.files.signal, branch});
        this.setState({
          gitBranch: branch,
          gitHistory,
          gitSelected:
            branch === this.state.gitInfo?.branch && this.state.gitLog.trim() ? pendingHash : gitHistory[0]?.hash,
        });
      },
      false,
      false
    );
  };

  private deleteGitBranch = (branch: string) => {
    const git = this.git();
    if (!git || branch === 'main' || branch === this.state.gitInfo?.branch) return;
    this.setState({gitBranchOpen: false});
    void this.run(
      async () => {
        if (
          !(await this.props.confirm(
            t('Delete Branch?'),
            <>
              <div>{branch}</div>
              {t('Commits only on this branch may become unavailable.')}
            </>,
            this.files.signal
          ))
        )
          return;
        await git.deleteGitBranch(this.props.project, branch, {signal: this.files.signal});
        const [gitInfo, gitBranches] = await Promise.all([
          git.getGitInfo(this.props.project, {signal: this.files.signal}),
          git.getGitBranches(this.props.project, {signal: this.files.signal}),
        ]);
        if (this.state.gitBranch === branch) {
          const gitHistory = await git.getGitHistory(this.props.project, {signal: this.files.signal});
          this.setState({
            gitInfo,
            gitBranches,
            gitBranch: gitInfo.branch,
            gitHistory,
            gitSelected: this.state.gitLog.trim() ? pendingHash : gitHistory[0]?.hash,
          });
        } else {
          this.setState({gitInfo, gitBranches});
        }
      },
      false,
      false
    );
  };

  private createFromCommit = () => {
    const {gitCreate} = this.state;
    const git = this.git();
    if (!git || !gitCreate || !validNamespaceName(gitCreate.name.trim())) return;
    return this.run(
      async () => {
        await git.createProjectFromCommit(this.props.project, gitCreate.name.trim(), gitCreate.commit, {
          signal: this.files.signal,
        });
        this.setState({gitCreate: undefined});
        this.props.onChange?.();
      },
      false,
      false
    );
  };

  private toggle(entry: FileEntry) {
    if (entry.type !== 'folder' || this.locked) return;
    const path = entry.path;
    if (this.expanded.has(path)) {
      this.expanded.delete(path);
      if (this.state.selected.some((selected) => selected.startsWith(`${path}/`))) this.select([path]);
      this.forceUpdate();
    } else {
      this.expanded.add(path);
      this.folders.delete(path);
      const generation = this.generation;
      const version = this.folderVersion;
      void this.loadFolder(path).catch((error) => {
        if (this.current(generation) && version === this.folderVersion) {
          this.expanded.delete(path);
          this.setState({error: fileError(error)});
        }
      });
    }
  }

  private open(entry: FileEntry) {
    if (entry.gitStatus !== 'deleted' && entry.type === 'file' && entry.name.endsWith('.ticlo') && this.props.onOpen) {
      void this.run(() => Promise.resolve(this.props.onOpen(entry)), false, false);
    }
  }

  private selectRow(entry: FileEntry, event: {shiftKey: boolean; ctrlKey: boolean; metaKey: boolean}) {
    const path = entry.path;
    if (this.props.picker) {
      this.select([path]);
    } else if (event.shiftKey && this.anchor) {
      const from = this.rows.findIndex((row) => row.entry.path === this.anchor);
      const to = this.rows.findIndex((row) => row.entry.path === path);
      const range = this.rows
        .slice(Math.min(from < 0 ? to : from, to), Math.max(from, to) + 1)
        .map((row) => row.entry.path);
      this.select(event.ctrlKey || event.metaKey ? [...new Set([...this.state.selected, ...range])] : range);
    } else {
      this.anchor = path;
      this.select(
        event.ctrlKey || event.metaKey
          ? this.state.selected.includes(path)
            ? this.state.selected.filter((key) => key !== path)
            : [...this.state.selected, path]
          : [path]
      );
    }
  }

  private copy = (move: boolean) => {
    const entries = this.selected();
    if (
      !entries.length ||
      entries.some((entry) => entry.path === this.files.root || entry.gitStatus === 'deleted') ||
      this.locked
    )
      return;
    this.clipboard = {entries: topEntries(entries), move};
    this.forceUpdate();
  };

  private confirmOverwrite = (entry: FileEntry) =>
    this.props.confirm(
      t('Overwrite'),
      <>
        {entry.type === 'folder' ? t('Replace this folder and all its contents?') : t('Overwrite this file?')}
        <div>{entry.path}</div>
      </>,
      this.files.signal
    );

  private paste = (directory = this.directory()) => {
    const clipboard = this.clipboard;
    if (!clipboard?.entries.length) return;
    const files = this.files;
    this.expanded.add(directory);
    return this.run(async () => {
      await files.transfer(clipboard.entries, directory, clipboard.move, this.confirmOverwrite, (completed) => {
        if (clipboard.move) clipboard.entries = clipboard.entries.filter((entry) => entry !== completed);
      });
    });
  };

  private remove = () => {
    const entries = this.selected();
    if (!entries.length || entries.some((entry) => entry.path === this.files.root || entry.gitStatus === 'deleted'))
      return;
    const files = this.files;
    return this.run(async () => {
      if (
        await this.props.confirm(
          t('Delete'),
          <>
            {t('Delete selected files and folders?')}
            <div>{t('Folder contents will also be deleted')}</div>
            <div>{entries.map((entry) => entry.name).join(', ')}</div>
          </>,
          files.signal
        )
      ) {
        await files.remove(entries, this.props.onFilesDeleted);
      }
    });
  };

  private restore = () => {
    const entries = this.selected();
    const [entry] = entries;
    const git = this.git();
    if (
      !git ||
      !this.state.gitInfo?.initialized ||
      entries.length !== 1 ||
      entry.type !== 'file' ||
      (entry.gitStatus !== 'modified' && entry.gitStatus !== 'deleted')
    )
      return;
    const files = this.files;
    return this.run(async () => {
      if (
        entry.gitStatus === 'modified' &&
        !(await this.props.confirm(
          t('Discard changes?'),
          <>
            {t('Discard uncommitted changes to this file?')}
            <div>{entry.path}</div>
          </>,
          files.signal
        ))
      )
        return;
      await git.restoreGitFile(entry.path, {signal: files.signal});
      if (entry.path.endsWith('.ticlo')) await this.props.onFileDiscarded?.(entry.path);
    });
  };

  private discardLocalBackup = () => {
    const [entry] = this.selected();
    const storage = this.props.storage as FileAccess & Partial<LocalBackupAccess>;
    if (!entry?.localBackup || !storage.discardLocalBackup) return;
    const files = this.files;
    return this.run(async () => {
      if (
        await this.props.confirm(
          t('Discard Local Backup'),
          <>
            {t('Discard the locally saved copy of this file?')}
            <div>{entry.path}</div>
          </>,
          files.signal
        )
      ) {
        await storage.discardLocalBackup(entry.path);
        if (entry.path.endsWith('.ticlo')) await this.props.onFileDiscarded?.(entry.path);
      }
    });
  };

  private newFolder = (directory: string) => this.setState({dialog: {directory}, name: '', error: undefined});
  private newFlow = (directory: string) => this.setState({dialog: {directory, flow: true}, name: '', error: undefined});
  private rename = () => {
    const entries = this.selected();
    if (entries.length === 1 && entries[0].path !== this.files.root && entries[0].gitStatus !== 'deleted') {
      this.setState({dialog: {entry: entries[0]}, name: entries[0].name, error: undefined});
    }
  };

  private saveName = () => {
    const {dialog, name} = this.state;
    const files = this.files;
    return this.run(async () => {
      if (dialog.entry) await files.rename(dialog.entry, name.trim());
      else if (dialog.flow) {
        const entry = await files.createFlow(dialog.directory, name.trim());
        files.signal.throwIfAborted();
        this.expanded.add(dialog.directory);
        this.setState({dialog: undefined});
        await this.props.onOpen?.(entry);
      } else await files.createFolder(dialog.directory, name.trim());
      if (!files.signal.aborted) this.setState({dialog: undefined});
    });
  };

  private download = () => {
    const files = this.files;
    const entries = this.selected().filter((entry) => entry.type === 'file');
    return this.run(
      async () => {
        for (const entry of entries) {
          files.checkPath(entry.path);
          const response = await files.storage.getFile(entry.path, {signal: files.signal});
          files.signal.throwIfAborted();
          const url = URL.createObjectURL(new Blob([response.data]));
          const link = document.createElement('a');
          link.href = url;
          link.download = entry.name;
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
      },
      false,
      false
    );
  };

  private upload = (entries: ReturnType<typeof droppedUploads>, directory = this.directory()) => {
    const files = this.files;
    this.expanded.add(directory);
    return this.run(async () => files.upload(await entries, directory, this.confirmOverwrite));
  };

  private chooseUpload(directory: string) {
    this.uploadDirectory = directory;
    this.uploadInput.click();
  }

  private gitMenu(): MenuProps {
    const disabled = this.state.busy;
    const readonly = !this.props.storage.getCapabilities(this.files.root).write;
    return {
      onClick: ({key}) => this.command(key),
      items: this.state.gitInfo?.initialized
        ? [
            {key: 'gitCommit', label: t('Git Commit'), disabled: disabled || readonly},
            {key: 'gitHistory', label: t('Git History'), disabled},
          ]
        : [{key: 'gitInit', label: t('Initialize Git'), disabled: disabled || readonly}],
    };
  }

  private fileMenu(): MenuProps {
    const entries = this.selected();
    const folderMenu = this.state.folderMenu;
    const openable =
      entries.length === 1 &&
      entries[0].type === 'file' &&
      entries[0].gitStatus !== 'deleted' &&
      entries[0].name.endsWith('.ticlo');
    const mutable =
      entries.length > 0 && entries.every((entry) => entry.path !== this.files.root && entry.gitStatus !== 'deleted');
    const downloadable = entries.length > 0 && entries.every((entry) => entry.type === 'file');
    const restorable =
      this.git() &&
      this.state.gitInfo?.initialized &&
      entries.length === 1 &&
      entries[0].type === 'file' &&
      (entries[0].gitStatus === 'modified' || entries[0].gitStatus === 'deleted');
    const hasLocalBackup =
      entries.length === 1 &&
      entries[0].type === 'file' &&
      entries[0].localBackup &&
      typeof (this.props.storage as Partial<LocalBackupAccess>).discardLocalBackup === 'function';
    const disabled = this.state.busy;
    const readonly = !this.props.storage.getCapabilities(this.files.root).write;
    return {
      onClick: ({key}) => this.command(key),
      items: [
        ...(this.props.onOpen && openable
          ? [{key: 'open', label: t('Open'), icon: <FolderOpenOutlined />, disabled}]
          : []),
        ...(folderMenu
          ? [
              {key: 'new-flow', label: t('New Dataflow'), icon: <FileAddOutlined />, disabled: disabled || readonly},
              {key: 'new', label: t('New Folder'), icon: <FolderAddOutlined />, disabled: disabled || readonly},
              {key: 'upload', label: t('Upload'), icon: <UploadOutlined />, disabled: disabled || readonly},
              {type: 'divider' as const},
            ]
          : []),
        {key: 'cut', label: t('Cut'), icon: <ScissorOutlined />, disabled: disabled || readonly || !mutable},
        {key: 'copy', label: t('Copy'), icon: <CopyOutlined />, disabled: disabled || !mutable},
        ...(folderMenu
          ? [
              {
                key: 'paste',
                label: t('Paste'),
                icon: <SnippetsOutlined />,
                disabled: disabled || readonly || !this.clipboard?.entries.length,
              },
            ]
          : []),
        {
          key: 'rename',
          label: t('Rename'),
          icon: <EditOutlined />,
          disabled: disabled || readonly || !mutable || entries.length !== 1,
        },
        {
          key: 'delete',
          label: t('Delete'),
          icon: <DeleteOutlined />,
          danger: true,
          disabled: disabled || readonly || !mutable,
        },
        ...(restorable
          ? [
              {
                key: 'restore',
                label: entries[0].gitStatus === 'modified' ? t('Discard Changes') : t('Restore'),
                icon: <RollbackOutlined />,
                danger: entries[0].gitStatus === 'modified',
                disabled: disabled || readonly,
              },
            ]
          : []),
        ...(hasLocalBackup
          ? [
              {
                key: 'discardLocalBackup',
                label: t('Discard Local Backup'),
                icon: <RollbackOutlined />,
                danger: true,
                disabled,
              },
            ]
          : []),
        ...(downloadable
          ? [
              {type: 'divider' as const},
              {
                key: 'download',
                label: t('Download'),
                icon: <DownloadOutlined />,
                disabled: disabled || entries.some((entry) => entry.gitStatus === 'deleted'),
              },
            ]
          : []),
      ],
    };
  }

  private command(key: string) {
    if (this.locked) return;
    if (
      ['new-flow', 'new', 'upload', 'cut', 'paste', 'rename', 'delete', 'restore'].includes(key) &&
      !this.props.storage.getCapabilities(this.files.root).write
    )
      return;
    switch (key) {
      case 'open': {
        const entries = this.selected();
        if (entries.length === 1) this.open(entries[0]);
        break;
      }
      case 'new-flow':
        this.newFlow(this.menuDirectory ?? this.files.root);
        break;
      case 'new':
        this.newFolder(this.menuDirectory ?? this.files.root);
        break;
      case 'upload':
        this.chooseUpload(this.menuDirectory ?? this.files.root);
        break;
      case 'cut':
        this.copy(true);
        break;
      case 'copy':
        this.copy(false);
        break;
      case 'paste':
        void this.paste(this.menuDirectory ?? this.files.root);
        break;
      case 'rename':
        this.rename();
        break;
      case 'delete':
        void this.remove();
        break;
      case 'restore':
        void this.restore();
        break;
      case 'discardLocalBackup':
        void this.discardLocalBackup();
        break;
      case 'download':
        void this.download();
        break;
      case 'gitInit': {
        const git = this.git();
        if (git) void this.run(() => git.initGit(this.props.project, {signal: this.files.signal}), true, false);
        break;
      }
      case 'gitCommit':
        this.setState({gitDialog: 'commit', gitMessage: ''});
        break;
      case 'gitHistory': {
        const git = this.git();
        if (git)
          void this.run(
            async () => {
              const [gitInfo, gitBranches, gitHistory, gitLog] = await Promise.all([
                git.getGitInfo(this.props.project, {signal: this.files.signal}),
                git.getGitBranches(this.props.project, {signal: this.files.signal}),
                git.getGitHistory(this.props.project, {signal: this.files.signal}),
                this.props.storage
                  .getFile(`${this.files.root}/.gitlog`, {signal: this.files.signal})
                  .then(({data}) => new TextDecoder().decode(data))
                  .catch((error) => {
                    if (error instanceof StorageError && error.code === 'not-found') return '';
                    throw error;
                  }),
              ]);
              this.setState({
                gitInfo,
                gitBranches,
                gitBranch: gitInfo.branch,
                gitHistory,
                gitLog,
                gitSelected: gitLog.trim() ? pendingHash : gitHistory[0]?.hash,
                gitBranchOpen: false,
                gitDialog: 'history',
              });
            },
            false,
            false
          );
        break;
      }
    }
  }

  private scrollTo(path: string) {
    const index = this.rows.findIndex((row) => row.entry.path === path);
    const scroller = this.container.querySelector<HTMLElement>('.ticl-e-file-tree');
    if (index < 0 || !scroller) return;
    const top = index * 28;
    if (top < scroller.scrollTop) scroller.scrollTop = top;
    else if (top + 28 > scroller.scrollTop + scroller.clientHeight)
      scroller.scrollTop = top + 28 - scroller.clientHeight;
  }

  private keyDown = (event: React.KeyboardEvent) => {
    if (
      this.locked ||
      (event.target as HTMLElement).closest(`input, textarea, .cm-editor${this.props.picker ? '' : ', .ant-modal'}`)
    )
      return;
    const {key, ctrlKey, metaKey} = event;
    if (this.props.picker && (key === 'Delete' || key === 'F2' || ctrlKey || metaKey)) return;
    if (
      !this.props.storage.getCapabilities(this.files.root).write &&
      (key === 'Delete' || key === 'F2' || ((ctrlKey || metaKey) && ['x', 'v'].includes(key.toLowerCase())))
    )
      return;
    if (ctrlKey || metaKey) {
      switch (key.toLowerCase()) {
        case 'a':
          this.select(this.rows.map((row) => row.entry.path).filter((path) => path !== this.files.root));
          break;
        case 'c':
          this.copy(false);
          break;
        case 'x':
          this.copy(true);
          break;
        case 'v':
          if (!this.clipboard?.entries.length) return;
          void this.paste();
          break;
        default:
          return;
      }
    } else if (key === 'Delete') void this.remove();
    else if (key === 'F2') this.rename();
    else if (key === 'Escape') this.select([]);
    else {
      const entry = this.selected().at(-1);
      const index = this.rows.findIndex((row) => row.entry.path === entry?.path);
      if (key === 'ArrowUp' || key === 'ArrowDown') {
        const next = this.rows[Math.max(0, Math.min(this.rows.length - 1, index + (key === 'ArrowDown' ? 1 : -1)))];
        if (next) {
          this.selectRow(next.entry, event);
          this.scrollTo(next.entry.path);
        }
      } else if (entry?.type === 'folder' && (key === 'ArrowRight' || key === 'Enter')) {
        if (!this.expanded.has(entry.path) || key === 'Enter') this.toggle(entry);
        else if (this.rows[index + 1]) {
          const path = this.rows[index + 1].entry.path;
          this.select([path]);
          this.scrollTo(path);
        }
      } else if (entry && key === 'ArrowLeft') {
        if (entry.type === 'folder' && this.expanded.has(entry.path)) this.toggle(entry);
        else if (entry.path !== this.files.root) {
          const path = parentPath(entry.path);
          this.select([path]);
          this.scrollTo(path);
        }
      } else return;
    }
    event.preventDefault();
    event.stopPropagation();
  };

  private dropDirectory(event: React.DragEvent) {
    const path = (event.target as HTMLElement).closest<HTMLElement>('.ticl-e-file-row')?.dataset.path;
    const entry = path && this.entry(path);
    return entry ? (entry.type === 'folder' ? entry.path : parentPath(entry.path)) : this.files.root;
  }

  private acceptsDrop(event: React.DragEvent) {
    return (
      !this.locked &&
      this.props.storage.getCapabilities(this.files.root).write &&
      (Boolean(this.dragged) || Array.from(event.dataTransfer.types).includes('Files'))
    );
  }

  private dragOver = (event: React.DragEvent) => {
    if (!this.acceptsDrop(event)) return;
    event.preventDefault();
    event.stopPropagation();
    const directory = this.dropDirectory(event);
    event.dataTransfer.dropEffect = this.dragged && !event.ctrlKey && !event.metaKey ? 'move' : 'copy';
    if (this.state.dropPath !== directory) this.setState({dropPath: directory});
  };

  private drop = (event: React.DragEvent) => {
    if (!this.acceptsDrop(event)) return;
    event.preventDefault();
    event.stopPropagation();
    const directory = this.dropDirectory(event);
    this.setState({dropPath: undefined});
    if (this.dragged) {
      const entries = this.dragged;
      const move = !event.ctrlKey && !event.metaKey;
      const files = this.files;
      this.expanded.add(directory);
      void this.run(() => files.transfer(entries, directory, move, this.confirmOverwrite));
    } else void this.upload(droppedUploads(event.dataTransfer), directory);
  };

  private renderRow = (index: number, style: React.CSSProperties) => {
    const {entry, level} = this.rows[index];
    const selected = this.state.selected.includes(entry.path);
    const opened = this.expanded.has(entry.path);
    const cut = this.clipboard?.move && this.clipboard.entries.some((source) => source.path === entry.path);
    return (
      <div
        key={entry.path}
        data-path={entry.path}
        title={entry.path}
        className={`ticl-e-file-row${selected ? ' ticl-e-file-selected' : ''}${cut ? ' ticl-e-file-cut' : ''}${this.state.dropPath === entry.path ? ' ticl-e-file-drop' : ''}`}
        style={{...style, paddingLeft: level * 16}}
        onClick={(event) => this.selectRow(entry, event)}
        onDoubleClick={() => (entry.type === 'folder' ? this.toggle(entry) : this.open(entry))}
        onContextMenu={() => {
          this.menuDirectory = entry.type === 'folder' ? entry.path : parentPath(entry.path);
          this.setState({folderMenu: entry.type === 'folder' && entry.gitStatus !== 'deleted'});
          if (!selected) {
            this.anchor = entry.path;
            this.select([entry.path]);
          }
        }}
        draggable={
          !this.props.picker &&
          !this.state.busy &&
          entry.path !== this.files.root &&
          entry.gitStatus !== 'deleted' &&
          (!selected || this.selected().every((item) => item.gitStatus !== 'deleted'))
        }
        onDragStart={(event) => {
          const entries = selected ? this.selected() : [entry];
          if (!selected) this.select([entry.path]);
          this.dragged = topEntries(entries.filter((entry) => entry.path !== this.files.root));
          event.dataTransfer.setData('application/x-ticlo-file', entry.path);
          event.dataTransfer.effectAllowed = 'copyMove';
        }}
        onDragEnd={() => {
          this.dragged = undefined;
          this.setState({dropPath: undefined});
        }}
      >
        <ExpandIcon
          opened={
            entry.type !== 'folder'
              ? 'disabled'
              : this.loading.has(entry.path)
                ? 'loading'
                : opened
                  ? 'opened'
                  : 'closed'
          }
          onClick={(event) => {
            event.stopPropagation();
            this.toggle(entry);
          }}
        />
        <span
          className={entry.localBackup ? 'ticl-e-file-local-backup' : `ticl-e-file-git-${entry.gitStatus ?? 'clean'}`}
        >
          {entry.type === 'folder' ? (
            opened ? (
              <FolderOpenOutlined />
            ) : (
              <FolderOutlined />
            )
          ) : previewType(entry.name) === 'image' ? (
            <FileImageOutlined />
          ) : (
            <FileOutlined />
          )}
        </span>
        <span>{entry.name}</span>
      </div>
    );
  };

  render() {
    const {project, storage, style, className, picker} = this.props;
    if (storage !== this.files.storage) return <div className="ticl-e-file-manager" style={style} />;
    const {busy, error, preview, dialog, name} = this.state;
    const readonly = !storage.getCapabilities(this.files.root).write;
    this.rows = [];
    const add = (entry: FileEntry, level: number) => {
      this.rows.push({entry, level});
      if (entry.type === 'folder' && this.expanded.has(entry.path)) {
        for (const child of this.folders.get(entry.path) ?? []) add(child, level + 1);
      }
    };
    add(this.rootEntry, 0);
    const selected = this.selected();
    const entry = selected.length === 1 && selected[0].gitStatus !== 'deleted' ? selected[0] : undefined;
    const pendingLog = this.state.gitBranch === this.state.gitInfo?.branch ? this.state.gitLog.trim() : '';
    const historyRows = pendingLog
      ? [
          {
            hash: pendingHash,
            author: '',
            email: '',
            date: '',
            message: translateEditor('Uncommitted changes'),
          },
          ...this.state.gitHistory,
        ]
      : this.state.gitHistory;
    const selectedCommit = this.state.gitHistory.find((commit) => commit.hash === this.state.gitSelected);
    const details =
      this.state.gitSelected === pendingHash
        ? {comment: '', log: pendingLog}
        : selectedCommit && splitCommitMessage(selectedCommit.message);
    const changes = details?.log ? parseGitLog(details.log) : [];
    return (
      <div
        className={`ticl-e-file-manager${className ? ` ${className}` : ''}`}
        style={style}
        ref={(value) => {
          this.container = value;
        }}
        tabIndex={0}
        onKeyDown={this.keyDown}
        onPaste={(event) => {
          if (picker) return;
          if ((event.target as HTMLElement).closest('input, textarea, .cm-editor, .ant-modal')) return;
          if (!this.locked && !readonly && event.clipboardData.files.length) {
            event.preventDefault();
            void this.upload(droppedUploads(event.clipboardData));
          }
        }}
      >
        {!picker && (
          <div className="ticl-e-file-toolbar">
            <span className="ticl-e-file-project" title={project}>
              {project}
            </span>
            {busy ? <Spin size="small" /> : null}
            <Button
              size="small"
              title={translateEditor('Reload')}
              icon={<ReloadOutlined />}
              disabled={busy}
              onClick={this.reload}
            />
            <Button
              size="small"
              title={translateEditor('New Dataflow')}
              icon={<FileAddOutlined />}
              disabled={busy || readonly}
              onClick={() => this.newFlow(this.files.root)}
            />
            <Button
              size="small"
              title={translateEditor('New Folder')}
              icon={<FolderAddOutlined />}
              disabled={busy || readonly}
              onClick={() => this.newFolder(this.files.root)}
            />
            <Button
              size="small"
              title={translateEditor('Upload')}
              icon={<UploadOutlined />}
              disabled={busy || readonly}
              onClick={() => this.chooseUpload(this.files.root)}
            />
            <Button
              size="small"
              title={translateEditor('Preview')}
              type={preview ? 'primary' : 'default'}
              icon={<EyeOutlined />}
              onClick={() => this.setState({preview: !preview})}
            />
            {this.git() ? (
              <Dropdown menu={this.gitMenu()} trigger={['click']}>
                <Button size="small" title={translateEditor('Actions')} icon={<EllipsisOutlined />} />
              </Dropdown>
            ) : null}
            <input
              ref={(value) => {
                this.uploadInput = value;
              }}
              type="file"
              hidden
              multiple
              onChange={(event) => {
                const entries = Array.from(event.target.files).map((file) => ({path: file.name, file}));
                const directory = this.uploadDirectory;
                this.uploadDirectory = undefined;
                event.target.value = '';
                if (entries.length && directory) void this.upload(Promise.resolve(entries), directory);
              }}
            />
          </div>
        )}
        {error ? (
          <div className="ticl-e-file-error">
            {error}
            <Button
              size="small"
              type="text"
              title={translateEditor('Close')}
              icon={<CloseOutlined />}
              onClick={() => this.setState({error: undefined})}
            />
          </div>
        ) : null}
        <Dropdown menu={picker ? {items: []} : this.fileMenu()} trigger={picker ? [] : ['contextMenu']}>
          <div
            className="ticl-e-file-tree-area"
            onMouseDown={() => this.container.focus()}
            onContextMenu={(event) => {
              if (!picker && !(event.target as HTMLElement).closest('.ticl-e-file-row')) {
                this.menuDirectory = this.files.root;
                this.setState({folderMenu: true});
                this.select([this.files.root]);
              }
            }}
            onDragOver={picker ? undefined : this.dragOver}
            onDrop={picker ? undefined : this.drop}
            onDragLeave={
              picker
                ? undefined
                : (event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node))
                      this.setState({dropPath: undefined});
                  }
            }
          >
            <VirtualList
              className="ticl-e-file-tree"
              itemCount={this.rows.length}
              itemHeight={28}
              renderer={this.renderRow}
            />
          </div>
        </Dropdown>
        {!picker && preview ? (
          <FilePreview
            key={entry ? `${entry.path}:${entry.modified}:${entry.type === 'file' ? entry.size : ''}` : 'empty'}
            storage={storage}
            entry={entry}
            onDownload={this.download}
          />
        ) : null}
        {!picker && (
          <Modal
            title={dialog?.entry ? t('Rename') : dialog?.flow ? t('New Dataflow') : t('New Folder')}
            open={Boolean(dialog)}
            onOk={this.saveName}
            onCancel={() => {
              if (!busy) this.setState({dialog: undefined});
            }}
            confirmLoading={busy}
            okButtonProps={{
              disabled: busy || !validFileName(name.trim()) || (dialog?.flow && !validFlowEntry(name.trim())),
            }}
            cancelButtonProps={{disabled: busy}}
            destroyOnHidden
          >
            <Input
              value={name}
              autoFocus
              onChange={(event) => this.setState({name: event.target.value})}
              onPressEnter={() => {
                if (!busy && validFileName(name.trim()) && (!dialog?.flow || validFlowEntry(name.trim())))
                  void this.saveName();
              }}
            />
            {error ? <div className="ticl-e-file-error">{error}</div> : null}
          </Modal>
        )}
        {!picker && (
          <Modal
            title={t('Git Commit')}
            open={this.state.gitDialog === 'commit'}
            onOk={() => {
              const git = this.git();
              if (git)
                void this.run(
                  async () => {
                    await git.commitGit(project, this.state.gitMessage, {signal: this.files.signal});
                    this.setState({gitDialog: undefined, gitMessage: ''});
                  },
                  true,
                  false
                );
            }}
            onCancel={() => this.setState({gitDialog: undefined})}
            confirmLoading={busy}
            cancelButtonProps={{disabled: busy}}
            destroyOnHidden
          >
            <Input.TextArea
              value={this.state.gitMessage}
              onChange={(event) => this.setState({gitMessage: event.target.value})}
            />
          </Modal>
        )}
        {!picker && (
          <Modal
            title={t('Git History')}
            open={this.state.gitDialog === 'history'}
            onCancel={() => this.setState({gitDialog: undefined, gitBranchOpen: false})}
            footer={null}
            width="min(1100px, calc(100vw - 32px))"
            style={{top: 24}}
            destroyOnHidden
          >
            <div className="ticl-e-git-history">
              <Dropdown
                trigger={['contextMenu']}
                menu={{
                  items: [
                    {key: 'reset', label: t('Reset to This Commit'), danger: true},
                    {key: 'create', label: t('Create Namespace from This Commit')},
                  ],
                  onClick: ({key}) => {
                    const commit = this.gitContextHash;
                    if (!commit) return;
                    if (key === 'reset') void this.resetToCommit(commit);
                    else if (key === 'create') this.setState({gitCreate: {commit, name: ''}, error: undefined});
                  },
                }}
              >
                <div
                  className="ticl-e-git-history-list"
                  onContextMenuCapture={(event) => {
                    const row = (event.target as HTMLElement).closest<HTMLElement>('tr[data-row-key]');
                    if (!row || row.dataset.rowKey === pendingHash || busy) {
                      event.preventDefault();
                      event.stopPropagation();
                      return;
                    }
                    this.gitContextHash = row.dataset.rowKey;
                  }}
                >
                  <Popover
                    trigger="click"
                    placement="bottomLeft"
                    open={this.state.gitBranchOpen}
                    onOpenChange={(open) => this.setState({gitBranchOpen: open})}
                    content={
                      <Tree
                        showLine
                        defaultExpandAll
                        selectedKeys={this.state.gitBranch ? [this.state.gitBranch] : []}
                        treeData={branchTree(this.state.gitBranches)}
                        titleRender={(node) => (
                          <span className="ticl-e-git-branch-node">
                            <span>{node.title}</span>
                            {node.selectable &&
                              node.key !== 'main' &&
                              node.key !== this.state.gitInfo?.branch &&
                              !readonly && (
                                <Button
                                  type="text"
                                  size="small"
                                  danger
                                  icon={<DeleteOutlined />}
                                  title={translateEditor('Delete Branch')}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    this.deleteGitBranch(String(node.key));
                                  }}
                                />
                              )}
                          </span>
                        )}
                        onSelect={(_, {node}) => this.selectGitBranch(String(node.key))}
                      />
                    }
                  >
                    <Button className="ticl-e-git-branch-button" disabled={busy}>
                      {this.state.gitBranch || 'HEAD'} <DownOutlined />
                    </Button>
                  </Popover>
                  <Table<GitCommit>
                    size="small"
                    rowKey="hash"
                    dataSource={historyRows}
                    pagination={false}
                    scroll={{x: 470, y: 'min(800px, calc(100vh - 250px))'}}
                    columns={[
                      {
                        title: t('Date'),
                        dataIndex: 'date',
                        width: 140,
                        render: (date: string) => date && DateTime.fromISO(date).toLocal().toFormat('yyyy-LL-dd HH:mm'),
                      },
                      {title: t('Author'), dataIndex: 'author', width: 110, ellipsis: true},
                      {
                        title: t('Message'),
                        dataIndex: 'message',
                        ellipsis: true,
                        render: (message: string) => message.split(/\r?\n/, 1)[0],
                      },
                    ]}
                    rowClassName={(commit) =>
                      [
                        commit.hash === pendingHash && 'ticl-e-git-history-pending',
                        commit.hash === this.state.gitSelected && 'ticl-e-git-history-selected',
                      ]
                        .filter(Boolean)
                        .join(' ')
                    }
                    onRow={(commit) => ({onClick: () => this.setState({gitSelected: commit.hash})})}
                  />
                </div>
              </Dropdown>
              <div className="ticl-e-git-history-details">
                {this.state.gitSelected === pendingHash ? (
                  <div className="ticl-e-git-history-heading">{t('Uncommitted changes')}</div>
                ) : selectedCommit ? (
                  <div className="ticl-e-git-history-comment">
                    <div className="ticl-e-git-history-heading">{t('Message')}</div>
                    <pre>{details?.comment}</pre>
                  </div>
                ) : null}
                {changes?.length ? (
                  <Table<GitLogRow>
                    className="ticl-e-git-history-changes"
                    size="small"
                    bordered
                    rowKey="key"
                    dataSource={changes}
                    pagination={false}
                    tableLayout="fixed"
                    columns={[
                      {
                        title: t('Date'),
                        dataIndex: 'date',
                        width: 130,
                        render: (date: string) => DateTime.fromISO(date).toLocal().toFormat('yyyy-LL-dd HH:mm'),
                      },
                      {title: t('User'), dataIndex: 'user', width: 110, ellipsis: true},
                      {title: t('Change'), dataIndex: 'change', width: 75},
                      {title: t('File'), dataIndex: 'file'},
                    ]}
                  />
                ) : details?.log ? (
                  <pre className="ticl-e-git-history-raw">{details.log}</pre>
                ) : null}
              </div>
            </div>
            {error && <div className="ticl-e-file-error">{error}</div>}
          </Modal>
        )}
        {!picker && (
          <Modal
            title={t('Create Namespace from This Commit')}
            open={Boolean(this.state.gitCreate)}
            onOk={this.createFromCommit}
            onCancel={() => !busy && this.setState({gitCreate: undefined, error: undefined})}
            okButtonProps={{
              disabled: busy || !validNamespaceName(this.state.gitCreate?.name.trim() ?? ''),
            }}
            confirmLoading={busy}
            destroyOnHidden
          >
            <Input
              placeholder={translateEditor('Namespace name')}
              value={this.state.gitCreate?.name ?? ''}
              onChange={(event) => this.setState({gitCreate: {...this.state.gitCreate, name: event.target.value}})}
              onPressEnter={this.createFromCommit}
            />
            {error && <div className="ticl-e-file-error">{error}</div>}
          </Modal>
        )}
      </div>
    );
  }
}
