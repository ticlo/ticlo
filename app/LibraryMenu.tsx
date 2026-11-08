import React, {useState} from 'react';
import {ApartmentOutlined, SettingOutlined} from '@ant-design/icons';
import {Modal, Select, type MenuProps} from 'antd';
import type {Root} from '@ticlo/core';
import {projectId, type ProjectFiles} from '@ticlo/core/storage/FileAccess.ts';
import {validateLibrary} from '@ticlo/core/util/LibraryMetadata.ts';
import {t} from '@ticlo/editor/component/LocalizedLabel.tsx';
import {LibrarySelectDialog, type LibrarySelectionOptions} from '@ticlo/editor/library/LibrarySelectDialog.tsx';

type Dialog = 'select' | 'properties' | null;

export function useLibraryMenu({
  root,
  storage,
  project,
  readonly,
  onLibraryChange,
  onLibraryUnload,
  onSetDefaultLibrary,
  onChange,
}: {
  root: Root;
  storage: ProjectFiles;
  project: string;
  readonly?: boolean;
  onLibraryChange: (name: string, options: LibrarySelectionOptions) => Promise<void>;
  onLibraryUnload: (name: string) => Promise<void>;
  onSetDefaultLibrary: (name: string) => Promise<void>;
  onChange?: () => void;
}) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const [projects, setProjects] = useState<string[]>([]);
  const [dependencies, setDependencies] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const writable = !readonly && storage.getCapabilities(`${project}/ticlo.json`).write;

  const open = async (next: Exclude<Dialog, null>) => {
    setDialog(next);
    setDependencies([]);
    setError('');
    if (next === 'select') return;
    setLoading(true);
    setReady(false);
    try {
      const [listed, metadata] = await Promise.all([storage.listProjects(), root.getLibraryMetadata(project)]);
      setProjects([...new Set([project, ...listed.map(({id}) => id)])].sort());
      setDependencies(metadata?.dependencies ?? []);
      setReady(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLoading(false);
    }
  };
  const run = async (operation: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await operation();
      setDialog(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };
  const canCreate = (name: string, existing: string[]) => {
    try {
      return (
        !!name &&
        !readonly &&
        name !== '#root' &&
        !existing.includes(name) &&
        !!validateLibrary(name) &&
        !!projectId(name) &&
        storage.getCapabilities(name).write
      );
    } catch {
      return false;
    }
  };
  const saveProperties = () =>
    run(async () => {
      await root.setLibraryDependencies(project, dependencies);
      if (!storage.subscribeFileChanges) onChange?.();
    });

  const items: MenuProps['items'] = [
    {key: 'select', icon: <ApartmentOutlined />, label: t('Select Library'), onClick: () => void open('select')},
    {
      key: 'properties',
      icon: <SettingOutlined />,
      label: t('Library Properties'),
      onClick: () => void open('properties'),
    },
  ];
  const dialogs = (
    <>
      {dialog === 'select' && (
        <LibrarySelectDialog
          defaultLibrary={project}
          graph={root.getLibraryGraph()}
          listLibraries={async () => (await storage.listProjects()).map(({id}) => id)}
          canCreate={canCreate}
          onCreate={async (name) => {
            await storage.createProject(name);
            if (!storage.subscribeFileChanges) onChange?.();
          }}
          onSelect={onLibraryChange}
          onUnload={onLibraryUnload}
          onSetDefault={onSetDefaultLibrary}
          onClose={() => setDialog(null)}
        />
      )}
      <Modal
        title={t('Library Properties')}
        open={dialog === 'properties'}
        onOk={saveProperties}
        onCancel={() => !busy && setDialog(null)}
        okButtonProps={{disabled: !ready || !writable}}
        confirmLoading={busy}
        destroyOnHidden
      >
        <div style={{marginBottom: 8}}>{project}</div>
        <div style={{marginBottom: 8}}>{t('Dependencies')}</div>
        <Select
          mode="multiple"
          value={dependencies}
          options={[...new Set([...projects, ...dependencies])]
            .filter((id) => id !== project || dependencies.includes(id))
            .map((id) => ({value: id, label: id}))}
          onChange={setDependencies}
          loading={loading}
          disabled={busy || loading || !writable}
          style={{width: '100%'}}
        />
        {error && <div className="ticl-e-file-error">{error}</div>}
      </Modal>
    </>
  );
  return {items, dialogs};
}
