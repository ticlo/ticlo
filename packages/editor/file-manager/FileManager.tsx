import React, {useContext} from 'react';
import {Button, Dropdown, Input, Modal, Spin, type MenuProps} from 'antd';
import {
  CloseOutlined,
  CopyOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  EllipsisOutlined,
  EyeOutlined,
  FileOutlined,
  FolderAddOutlined,
  FolderOpenOutlined,
  FolderOutlined,
  ReloadOutlined,
  ScissorOutlined,
  SnippetsOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import type {FileEntry, TicloFileClient} from '@ticlo/file-client';
import {translateEditor} from '@ticlo/core/editor.ts';
import {ExpandIcon} from '../component/Tree.tsx';
import VirtualList from '../component/Virtual.tsx';
import {TicloLayoutContextType} from '../component/LayoutContext.ts';
import {t} from '../component/LocalizedLabel.tsx';
import {FilePreview} from './FilePreview.tsx';
import {droppedUploads, fileError, FileOperations, parentPath, topEntries, validFileName} from './FileOperations.ts';

export interface FileManagerProps {
  client: TicloFileClient;
  /** Project / namespace ID, without a leading +; #root is the global namespace. */
  project: string;
  defaultPreview?: boolean;
  onSelect?: (entries: FileEntry[]) => void;
  onChange?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

interface PanelProps extends FileManagerProps {
  confirm: (title: React.ReactNode, content: React.ReactNode, signal: AbortSignal) => Promise<boolean>;
}

interface State {
  selected: string[];
  preview: boolean;
  busy: boolean;
  error?: string;
  dropPath?: string;
  dialog?: {entry?: FileEntry; directory?: string};
  name: string;
}

export function FileManager(props: FileManagerProps) {
  useContext(TicloLayoutContextType);
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
  state: State = {selected: [], preview: this.props.defaultPreview ?? true, busy: false, name: ''};
  private controller = new AbortController();
  private files = new FileOperations(this.props.client, this.props.project, this.controller.signal);
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
  private rows: {entry: FileEntry; level: number}[] = [];

  private get rootEntry(): FileEntry {
    return {type: 'folder', path: this.files.root, name: this.props.project, created: 0, modified: 0};
  }

  componentDidMount() {
    this.live = true;
    // StrictMode may remount this instance after aborting the initial requests.
    if (this.controller.signal.aborted) this.reset();
    this.props.onSelect?.([]);
    this.reload();
  }

  componentDidUpdate(previous: PanelProps) {
    if (previous.client !== this.props.client || previous.project !== this.props.project) {
      this.reset();
      this.setState({selected: [], error: undefined, dialog: undefined, dropPath: undefined, busy: false});
      this.props.onSelect?.([]);
      this.reload();
    }
  }

  componentWillUnmount() {
    this.live = false;
    ++this.generation;
    ++this.folderVersion;
    this.controller.abort();
  }

  private reset() {
    this.controller.abort();
    ++this.generation;
    this.controller = new AbortController();
    this.files = new FileOperations(this.props.client, this.props.project, this.controller.signal);
    this.folders.clear();
    this.loading.clear();
    this.expanded = new Set([this.files.root]);
    this.clipboard = undefined;
    this.dragged = undefined;
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
    if (this.current(generation)) this.select(this.state.selected.filter((path) => this.entry(path)));
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
      try {
        await this.refresh();
      } catch (reason) {
        error ??= fileError(reason);
      }
    }
    if (!this.current(generation)) return;
    this.locked = false;
    this.setState({busy: false, error});
    if (changed) this.props.onChange?.();
  };

  private reload = () => this.run(() => this.refresh(), false, false);

  private toggle(entry: FileEntry) {
    if (entry.type !== 'folder' || this.locked) return;
    const path = entry.path;
    if (this.expanded.has(path)) {
      this.expanded.delete(path);
      if (this.state.selected.some((selected) => selected.startsWith(`${path}/`))) this.select([path]);
      this.forceUpdate();
    } else {
      this.expanded.add(path);
      if (this.folders.has(path)) this.forceUpdate();
      else {
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
  }

  private selectRow(entry: FileEntry, event: {shiftKey: boolean; ctrlKey: boolean; metaKey: boolean}) {
    const path = entry.path;
    if (event.shiftKey && this.anchor) {
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
    if (!entries.length || entries.some((entry) => entry.path === this.files.root) || this.locked) return;
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

  private paste = () => {
    const clipboard = this.clipboard;
    if (!clipboard?.entries.length) return;
    const files = this.files;
    const directory = this.directory();
    this.expanded.add(directory);
    return this.run(async () => {
      await files.transfer(clipboard.entries, directory, clipboard.move, this.confirmOverwrite, (completed) => {
        if (clipboard.move) clipboard.entries = clipboard.entries.filter((entry) => entry !== completed);
      });
    });
  };

  private remove = () => {
    const entries = this.selected();
    if (!entries.length || entries.some((entry) => entry.path === this.files.root)) return;
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
        await files.remove(entries);
      }
    });
  };

  private newFolder = () => this.setState({dialog: {directory: this.directory()}, name: '', error: undefined});
  private rename = () => {
    const entries = this.selected();
    if (entries.length === 1 && entries[0].path !== this.files.root) {
      this.setState({dialog: {entry: entries[0]}, name: entries[0].name, error: undefined});
    }
  };

  private saveName = () => {
    const {dialog, name} = this.state;
    const files = this.files;
    return this.run(async () => {
      if (dialog.entry) await files.rename(dialog.entry, name.trim());
      else await files.createFolder(dialog.directory, name.trim());
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
          const response = await files.client.getFile(entry.path, {signal: files.signal});
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

  private menu(): MenuProps {
    const entries = this.selected();
    const mutable = entries.length > 0 && entries.every((entry) => entry.path !== this.files.root);
    const collapse = entries.length === 1 && entries[0].type === 'folder' && this.expanded.has(entries[0].path);
    const disabled = this.state.busy;
    return {
      onClick: ({key}) => this.command(key),
      items: [
        {key: 'new', label: t('New Folder'), icon: <FolderAddOutlined />, disabled},
        {key: 'upload', label: t('Upload'), icon: <UploadOutlined />, disabled},
        {type: 'divider'},
        {key: 'cut', label: t('Cut'), icon: <ScissorOutlined />, disabled: disabled || !mutable},
        {key: 'copy', label: t('Copy'), icon: <CopyOutlined />, disabled: disabled || !mutable},
        {
          key: 'paste',
          label: t('Paste'),
          icon: <SnippetsOutlined />,
          disabled: disabled || !this.clipboard?.entries.length,
        },
        {
          key: 'rename',
          label: t('Rename'),
          icon: <EditOutlined />,
          disabled: disabled || !mutable || entries.length !== 1,
        },
        {key: 'delete', label: t('Delete'), icon: <DeleteOutlined />, danger: true, disabled: disabled || !mutable},
        {type: 'divider'},
        {
          key: 'download',
          label: t('Download'),
          icon: <DownloadOutlined />,
          disabled: disabled || !entries.length || entries.some((entry) => entry.type !== 'file'),
        },
        {key: 'path', label: t('Copy Path'), disabled: disabled || !entries.length},
        ...(collapse ? [{key: 'collapse', label: t('Collapse Children'), disabled}] : []),
      ],
    };
  }

  private command(key: string) {
    if (this.locked) return;
    switch (key) {
      case 'new':
        this.newFolder();
        break;
      case 'upload':
        this.uploadInput.click();
        break;
      case 'cut':
        this.copy(true);
        break;
      case 'copy':
        this.copy(false);
        break;
      case 'paste':
        void this.paste();
        break;
      case 'rename':
        this.rename();
        break;
      case 'delete':
        void this.remove();
        break;
      case 'download':
        void this.download();
        break;
      case 'path':
        void this.run(
          () =>
            navigator.clipboard.writeText(
              this.selected()
                .map((entry) => entry.path)
                .join('\n')
            ),
          false,
          false
        );
        break;
      case 'collapse': {
        const entries = this.selected();
        if (entries.length !== 1 || entries[0].type !== 'folder' || !this.expanded.has(entries[0].path)) break;
        for (const path of this.expanded) {
          if (path.startsWith(`${entries[0].path}/`)) this.expanded.delete(path);
        }
        this.forceUpdate();
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
    if (this.locked || (event.target as HTMLElement).closest('input, textarea, .cm-editor, .ant-modal')) return;
    const {key, ctrlKey, metaKey} = event;
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
    return !this.locked && (Boolean(this.dragged) || Array.from(event.dataTransfer.types).includes('Files'));
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
        onDoubleClick={() => this.toggle(entry)}
        onContextMenu={() => {
          if (!selected) {
            this.anchor = entry.path;
            this.select([entry.path]);
          }
        }}
        draggable={!this.state.busy && entry.path !== this.files.root}
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
        {entry.type === 'folder' ? opened ? <FolderOpenOutlined /> : <FolderOutlined /> : <FileOutlined />}
        <span>{entry.name}</span>
      </div>
    );
  };

  render() {
    const {project, client, style, className} = this.props;
    if (client !== this.files.client) return <div className="ticl-e-file-manager" style={style} />;
    const {busy, error, preview, dialog, name} = this.state;
    this.rows = [];
    const add = (entry: FileEntry, level: number) => {
      this.rows.push({entry, level});
      if (entry.type === 'folder' && this.expanded.has(entry.path)) {
        for (const child of this.folders.get(entry.path) ?? []) add(child, level + 1);
      }
    };
    add(this.rootEntry, 0);
    const selected = this.selected();
    const entry = selected.length === 1 ? selected[0] : undefined;
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
          if ((event.target as HTMLElement).closest('input, textarea, .cm-editor, .ant-modal')) return;
          if (!this.locked && event.clipboardData.files.length) {
            event.preventDefault();
            void this.upload(droppedUploads(event.clipboardData));
          }
        }}
      >
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
            title={translateEditor('New Folder')}
            icon={<FolderAddOutlined />}
            disabled={busy}
            onClick={this.newFolder}
          />
          <Button
            size="small"
            title={translateEditor('Upload')}
            icon={<UploadOutlined />}
            disabled={busy}
            onClick={() => this.uploadInput.click()}
          />
          <Button
            size="small"
            title={translateEditor('Preview')}
            type={preview ? 'primary' : 'default'}
            icon={<EyeOutlined />}
            onClick={() => this.setState({preview: !preview})}
          />
          <Dropdown menu={this.menu()} trigger={['click']}>
            <Button size="small" title={translateEditor('Actions')} icon={<EllipsisOutlined />} />
          </Dropdown>
          <input
            ref={(value) => {
              this.uploadInput = value;
            }}
            type="file"
            hidden
            multiple
            onChange={(event) => {
              const entries = Array.from(event.target.files).map((file) => ({path: file.name, file}));
              event.target.value = '';
              if (entries.length) void this.upload(Promise.resolve(entries));
            }}
          />
        </div>
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
        <Dropdown menu={this.menu()} trigger={['contextMenu']}>
          <div
            className="ticl-e-file-tree-area"
            onMouseDown={() => this.container.focus()}
            onContextMenu={(event) => {
              if (!(event.target as HTMLElement).closest('.ticl-e-file-row')) this.select([this.files.root]);
            }}
            onDragOver={this.dragOver}
            onDrop={this.drop}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node)) this.setState({dropPath: undefined});
            }}
          >
            <VirtualList
              className="ticl-e-file-tree"
              itemCount={this.rows.length}
              itemHeight={28}
              renderer={this.renderRow}
            />
          </div>
        </Dropdown>
        {preview ? (
          <FilePreview
            key={entry ? `${entry.path}:${entry.modified}:${entry.type === 'file' ? entry.size : ''}` : 'empty'}
            client={client}
            entry={entry}
            onDownload={this.download}
          />
        ) : null}
        <Modal
          title={dialog?.entry ? t('Rename') : t('New Folder')}
          open={Boolean(dialog)}
          onOk={this.saveName}
          onCancel={() => {
            if (!busy) this.setState({dialog: undefined});
          }}
          confirmLoading={busy}
          okButtonProps={{disabled: busy || !validFileName(name.trim())}}
          cancelButtonProps={{disabled: busy}}
          destroyOnHidden
        >
          <Input
            value={name}
            autoFocus
            onChange={(event) => this.setState({name: event.target.value})}
            onPressEnter={() => {
              if (!busy && validFileName(name.trim())) void this.saveName();
            }}
          />
          {error ? <div className="ticl-e-file-error">{error}</div> : null}
        </Modal>
      </div>
    );
  }
}
