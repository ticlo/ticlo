import React, {useContext, useState} from 'react';
import {Input, message, Modal, type MenuProps} from 'antd';
import {
  BookOutlined,
  CopyOutlined,
  DeploymentUnitOutlined,
  FileAddOutlined,
  FolderOpenOutlined,
  LayoutOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import {Flow, Root, encodeSorted} from '@ticlo/core';
import {translateEditor} from '@ticlo/core/editor.ts';
import {flowRefFromPath} from '@ticlo/core/block/FlowRuntime.ts';
import type {ClientConn} from '@ticlo/core/connect/ClientConn.ts';
import type {FileEntry, ProjectFiles} from '@ticlo/core/storage/FileAccess.ts';
import {flowStoragePath} from '@ticlo/core/util/FlowStoragePath.ts';
import {FileManager} from '@ticlo/editor';
import {TicloCurrentFlowContext} from '@ticlo/editor/component/LayoutContext.ts';
import {t} from '@ticlo/editor/component/LocalizedLabel.tsx';
import {fileDestination, fileFlowPath} from './flow-path.ts';
import {stageReadonly} from './AppLayout.ts';
import {AppHeader} from './AppHeader.tsx';
import {useNamespaceMenu} from './NamespaceMenu.tsx';
import type {NamespaceSelectionOptions} from '@ticlo/editor/namespace/NamespaceSelectDialog.tsx';

type Dialog = 'open' | 'new-flow' | 'new-library' | 'save-as' | null;

export function FileMenuHeader({
  language,
  onLanguageChange,
  root,
  conn,
  files,
  onOpen,
  onChange,
  onNamespaceChange,
  onNamespaceUnload,
  onSetDefaultNamespace,
  newPage = false,
  viewItems,
  children,
}: {
  language: string;
  onLanguageChange: (language: string) => void;
  root: Root;
  conn: ClientConn;
  files: {storage: ProjectFiles; project: string};
  onOpen: (path: string, flow: Flow) => void;
  onChange?: () => void;
  onNamespaceChange: (name: string, options: NamespaceSelectionOptions) => Promise<void>;
  onNamespaceUnload: (name: string) => Promise<void>;
  onSetDefaultNamespace: (name: string) => Promise<void>;
  newPage?: boolean;
  viewItems?: MenuProps['items'];
  children?: React.ReactNode;
}) {
  const {storage, project} = files;
  const {activeStage} = useContext(TicloCurrentFlowContext);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [name, setName] = useState('');
  const [directory, setDirectory] = useState(project);
  const [selected, setSelected] = useState<FileEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const namespaceMenu = useNamespaceMenu({
    root,
    storage,
    project,
    readonly: conn.getEditPolicyView().policy?.readonly,
    onNamespaceChange,
    onNamespaceUnload,
    onSetDefaultNamespace,
    onChange,
  });
  const writable = storage.getCapabilities(project).write;
  const activePath = activeStage?.basePath;
  const activeFlow = activePath && root.queryValue(activePath);
  const activeLibrary = activePath?.startsWith(':') || activePath?.includes('.:');
  const canSave =
    activeFlow instanceof Flow &&
    !stageReadonly(storage, activePath) &&
    conn.getEditPolicyView().can({cmd: 'applyFlowChange', path: activePath});
  const newFlowLabel = newPage ? 'New Page' : 'New Dataflow';
  const library = dialog === 'new-library' || (dialog === 'save-as' && activeLibrary);
  const destination = fileDestination(
    project,
    dialog === 'new-library' ? `${project}/#libs` : directory,
    name.trim(),
    library ? 'library' : 'flow'
  );
  const canCreate = destination && storage.getCapabilities(destination.file).write;

  const show = (next: Dialog) => {
    setDialog(next);
    setName(next === 'save-as' ? (activePath?.split('.').pop()?.replace(/^:/, '') ?? '') : '');
    let folder = project;
    if (next === 'new-library') folder = `${project}/#libs`;
    else if (next === 'save-as' && activePath) {
      try {
        const ref = flowRefFromPath(activePath);
        if (ref.namespace === project) {
          const file = `${project}/${flowStoragePath(ref.kind === 'library' ? `:${ref.name}` : ref.name)}`;
          folder = file.slice(0, file.lastIndexOf('/'));
        }
      } catch {}
    }
    setDirectory(folder);
    setSelected(null);
    setError('');
  };
  const run = async (operation: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await operation();
      setDialog(null);
    } catch (reason) {
      const text = reason instanceof Error ? reason.message : String(reason);
      if (dialog) setError(text);
      else message.error(text);
    } finally {
      setBusy(false);
    }
  };
  const open = (entry: FileEntry) =>
    run(async () => {
      const target = fileFlowPath(project, entry.path);
      if (!target) throw new Error('Select a .ticlo file.');
      if (!conn.getEditPolicyView().can({cmd: 'loadFlow', path: target.path}))
        throw new Error('Opening this flow is not permitted.');
      const flow = await root.loadFlow(target.ref);
      onOpen(target.path, flow);
    });
  const save = () =>
    run(async () => {
      if (!canSave) throw new Error('This flow cannot be saved.');
      await conn.applyFlowChange(activePath);
      onChange?.();
    });
  const create = () =>
    run(async () => {
      if (!destination) throw new Error('Invalid file name or folder.');
      if (!canCreate) throw new Error('Storage is read-only.');
      let data;
      if (dialog === 'save-as') {
        if (!(activeFlow instanceof Flow)) throw new Error('This flow cannot be saved.');
        data = activeFlow.save();
      } else {
        data = {'#is': dialog === 'new-flow' && newPage ? 'flow:main' : ''};
      }
      if (!conn.getEditPolicyView().can({cmd: 'addFlow', path: destination.path, data}))
        throw new Error('Creating this flow is not permitted.');
      await storage.uploadFile(destination.file, encodeSorted(data), {revision: null});
      onChange?.();
      const flow = await root.loadFlow(destination.ref);
      onOpen(destination.path, flow);
    });

  const items: MenuProps['items'] = [
    {key: 'open', icon: <FolderOpenOutlined />, label: t('Open'), onClick: () => show('open')},
    {
      key: 'new',
      icon: <FileAddOutlined />,
      label: t('New'),
      disabled: !writable || conn.getEditPolicyView().policy?.readonly,
      children: [
        {
          key: 'new-flow',
          icon: newPage ? <LayoutOutlined /> : <DeploymentUnitOutlined />,
          label: t(newFlowLabel),
          onClick: () => show('new-flow'),
        },
        {key: 'new-library', icon: <BookOutlined />, label: t('New Library'), onClick: () => show('new-library')},
      ],
    },
    {type: 'divider'},
    {key: 'save', icon: <SaveOutlined />, label: t('Save'), disabled: !canSave, onClick: save},
    {
      key: 'save-as',
      icon: <CopyOutlined />,
      label: t('Save As'),
      disabled: !writable || conn.getEditPolicyView().policy?.readonly || !(activeFlow instanceof Flow),
      onClick: () => show('save-as'),
    },
  ];

  return (
    <>
      <AppHeader
        language={language}
        onLanguageChange={onLanguageChange}
        fileItems={items}
        namespaceItems={namespaceMenu.items}
        viewItems={viewItems}
      >
        {children}
      </AppHeader>
      {namespaceMenu.dialogs}
      <Modal
        title={t('Open')}
        open={dialog === 'open'}
        onOk={() => selected && void open(selected)}
        onCancel={() => !busy && setDialog(null)}
        okButtonProps={{disabled: !selected || !fileFlowPath(project, selected.path)}}
        confirmLoading={busy}
        destroyOnHidden
      >
        <div style={{height: 400}}>
          {dialog === 'open' && (
            <FileManager
              storage={storage}
              project={project}
              picker
              defaultPreview={false}
              onSelect={(entries) => setSelected(entries.length === 1 ? entries[0] : null)}
              onOpen={open}
            />
          )}
        </div>
        {error && <div className="ticl-e-file-error">{error}</div>}
      </Modal>
      <Modal
        title={dialog === 'save-as' ? t('Save As') : t(newFlowLabel)}
        open={dialog === 'new-flow' || dialog === 'save-as'}
        onOk={create}
        onCancel={() => !busy && setDialog(null)}
        okButtonProps={{disabled: !canCreate}}
        confirmLoading={busy}
        destroyOnHidden
      >
        <div style={{height: 300, marginBottom: 8}}>
          {(dialog === 'new-flow' || dialog === 'save-as') && (
            <FileManager
              storage={storage}
              project={project}
              picker
              defaultPreview={false}
              onSelect={(entries) => {
                if (entries.length !== 1) return;
                const entry = entries[0];
                setDirectory(entry.type === 'folder' ? entry.path : entry.path.slice(0, entry.path.lastIndexOf('/')));
              }}
            />
          )}
        </div>
        <div
          title={directory}
          style={{marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}
        >
          {directory}/
        </div>
        <Input
          value={name}
          autoFocus
          placeholder={translateEditor('Name')}
          addonAfter=".ticlo"
          onChange={(event) => setName(event.target.value)}
          onPressEnter={() => canCreate && void create()}
        />
        {(error || (name.trim() && !destination)) && (
          <div className="ticl-e-file-error">{error || 'Invalid file name or folder.'}</div>
        )}
      </Modal>
      <Modal
        title={t('New Library')}
        open={dialog === 'new-library'}
        onOk={create}
        onCancel={() => !busy && setDialog(null)}
        okButtonProps={{disabled: !canCreate}}
        confirmLoading={busy}
        destroyOnHidden
      >
        <Input
          value={name}
          autoFocus
          placeholder={translateEditor('Name')}
          addonAfter=".ticlo"
          onChange={(event) => setName(event.target.value)}
          onPressEnter={() => canCreate && void create()}
        />
        {error && <div className="ticl-e-file-error">{error}</div>}
      </Modal>
    </>
  );
}
