import React, {useEffect, useState} from 'react';
import {ApartmentOutlined, SettingOutlined} from '@ant-design/icons';
import {Modal, Select, type MenuProps} from 'antd';
import type {ClientConn, LibraryRuntimeInfo} from '@ticlo/core/connect/ClientConn.ts';
import {projectId, type FileAccess, type ProjectFiles} from '@ticlo/core/storage/FileAccess.ts';
import {libraryPath, validateLibrary} from '@ticlo/core/util/LibraryMetadata.ts';
import {t} from '@ticlo/editor/component/LocalizedLabel.tsx';
import {useEditPolicy} from '@ticlo/editor/component/EditPolicyContext.tsx';
import {LibrarySelectDialog, type LibrarySelectionOptions} from '@ticlo/editor/library/LibrarySelectDialog.tsx';
import {AppHeader} from './AppHeader.tsx';

export type LibraryFiles = Pick<FileAccess, 'getCapabilities' | 'subscribeFileChanges' | 'notifyFileChange'> &
  Partial<Pick<ProjectFiles, 'listProjects' | 'createProject'>>;

interface LibraryMenuProps {
  conn: ClientConn;
  storage?: LibraryFiles;
  project: string;
  onLibraryChange: (name: string, options: LibrarySelectionOptions) => Promise<void>;
  onLibraryUnload: (name: string) => Promise<void>;
  onSetDefaultLibrary: (name: string) => Promise<void>;
  onChange?: () => void;
}

type Dialog = 'select' | 'properties' | null;

export function useLibraryMenu({
  conn,
  storage,
  project,
  onLibraryChange,
  onLibraryUnload,
  onSetDefaultLibrary,
  onChange,
}: LibraryMenuProps) {
  const policy = useEditPolicy();
  const [runtime, setRuntime] = useState<LibraryRuntimeInfo | null>(null);
  const [catalog, setCatalog] = useState<string[] | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [dependencies, setDependencies] = useState<string[]>([]);
  const [writable, setWritable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    conn.getLibraryGraph().then(
      (graph) => {
        if (active) setRuntime(graph);
      },
      () => {
        if (active) setRuntime(null);
      }
    );
    return () => {
      active = false;
    };
  }, [conn, policy]);
  useEffect(() => {
    let active = true;
    setCatalog(null);
    storage?.listProjects?.().then(
      (projects) => {
        if (active) setCatalog(projects.map(({id}) => id));
      },
      () => {
        if (active) setCatalog(null);
      }
    );
    return () => {
      active = false;
    };
  }, [storage]);

  const listLibraries = async () => {
    const graph = runtime ? await conn.getLibraryGraph() : null;
    if (graph) setRuntime(graph);
    let names = catalog;
    if (storage?.listProjects) {
      try {
        names = (await storage.listProjects()).map(({id}) => id);
      } catch (reason) {
        names = null;
        if (!graph) throw reason;
      }
      setCatalog(names);
    }
    return [...new Set([...(names ?? []), ...Object.keys(graph?.dependencies ?? {}), ...(graph?.roots ?? [])])];
  };
  const open = async (next: Exclude<Dialog, null>) => {
    setDialog(next);
    setError('');
    if (next === 'select') return;
    setDependencies([]);
    setLoading(true);
    setReady(false);
    try {
      const [{metadata, canWrite}] = await Promise.all([conn.getLibraryMetadata(project), listLibraries()]);
      setDependencies(metadata?.dependencies ?? []);
      setWritable(canWrite);
      setReady(metadata != null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLoading(false);
    }
  };
  const managingRuntime = !!runtime?.canLoad && !policy.policy?.readonly;
  const canCreate = (name: string, existing: string[]) => {
    try {
      return (
        catalog != null &&
        !!storage?.createProject &&
        !policy.policy?.readonly &&
        name !== '#root' &&
        !existing.includes(name) &&
        !!validateLibrary(name) &&
        !!projectId(name) &&
        storage.getCapabilities(name).write &&
        (!managingRuntime || policy.can({cmd: 'enableLibrary', path: libraryPath(name)}))
      );
    } catch {
      return false;
    }
  };
  const canLoad = (name: string) => {
    try {
      return managingRuntime
        ? policy.can({cmd: 'enableLibrary', path: libraryPath(name)})
        : !!catalog?.includes(name) || Object.hasOwn(runtime?.dependencies ?? {}, name);
    } catch {
      return false;
    }
  };
  const saveProperties = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await conn.setLibraryDependencies(project, dependencies);
      if (storage?.notifyFileChange) storage.notifyFileChange(project);
      else onChange?.();
      setDialog(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };
  const items: MenuProps['items'] = [];
  if (catalog || (runtime && (runtime.canLoad || runtime.roots.length || runtime.hasMetadata))) {
    items.push({
      key: 'select',
      icon: <ApartmentOutlined />,
      label: t('Select Library'),
      onClick: () => void open('select'),
    });
  }
  if (runtime?.hasMetadata) {
    items.push({
      key: 'properties',
      icon: <SettingOutlined />,
      label: t('Library Properties'),
      onClick: () => void open('properties'),
    });
  }
  const editable = writable && policy.can({cmd: 'setLibraryDependencies', path: libraryPath(project)});
  const dialogs = (
    <>
      {dialog === 'select' && (
        <LibrarySelectDialog
          defaultLibrary={project}
          graph={runtime ?? {roots: [], dependencies: {}}}
          listLibraries={listLibraries}
          catalogComplete={catalog != null}
          selectOnly={!managingRuntime}
          canLoad={canLoad}
          canRetain={!!runtime && policy.can({cmd: 'retainLibraries', path: ''})}
          canUnload={(name) => !!runtime && policy.can({cmd: 'unloadLibrary', path: libraryPath(name)})}
          canCreate={canCreate}
          onCreate={
            catalog != null && storage?.createProject
              ? async (name) => {
                  await storage.createProject(name);
                  if (!storage.subscribeFileChanges) onChange?.();
                }
              : undefined
          }
          onSelect={managingRuntime ? onLibraryChange : async (name) => onSetDefaultLibrary(name)}
          onUnload={async (name) => {
            await onLibraryUnload(name);
            setRuntime(await conn.getLibraryGraph());
          }}
          onSetDefault={onSetDefaultLibrary}
          onClose={() => setDialog(null)}
        />
      )}
      <Modal
        title={t('Library Properties')}
        open={dialog === 'properties'}
        onOk={saveProperties}
        onCancel={() => !busy && setDialog(null)}
        okButtonProps={{disabled: !ready || !editable}}
        confirmLoading={busy}
        destroyOnHidden
      >
        <div style={{marginBottom: 8}}>{project}</div>
        <div style={{marginBottom: 8}}>{t('Dependencies')}</div>
        <Select
          mode={catalog == null ? 'tags' : 'multiple'}
          value={dependencies}
          options={[...new Set([...(catalog ?? []), ...Object.keys(runtime?.dependencies ?? {}), ...dependencies])]
            .filter((id) => id !== project || dependencies.includes(id))
            .map((id) => ({value: id, label: id}))}
          onChange={setDependencies}
          loading={loading}
          disabled={busy || loading || !editable}
          style={{width: '100%'}}
        />
        {error && <div className="ticl-e-file-error">{error}</div>}
      </Modal>
    </>
  );
  return {items, dialogs};
}

export function LibraryMenuHeader({
  language,
  onLanguageChange,
  ...props
}: LibraryMenuProps & {
  language: string;
  onLanguageChange: (language: string) => void;
}) {
  const menu = useLibraryMenu(props);
  return (
    <>
      <AppHeader language={language} onLanguageChange={onLanguageChange} libraryItems={menu.items} />
      {menu.dialogs}
    </>
  );
}
