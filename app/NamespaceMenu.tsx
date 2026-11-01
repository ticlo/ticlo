import React, {useState} from 'react';
import {ApartmentOutlined, SettingOutlined} from '@ant-design/icons';
import {Modal, Select, type MenuProps} from 'antd';
import type {Root} from '@ticlo/core';
import {projectId, type ProjectFiles} from '@ticlo/core/storage/FileAccess.ts';
import {validateNamespace} from '@ticlo/core/util/NamespaceMetadata.ts';
import {t} from '@ticlo/editor/component/LocalizedLabel.tsx';
import {NamespaceSelectDialog, type NamespaceSelectionOptions} from '@ticlo/editor/namespace/NamespaceSelectDialog.tsx';

type Dialog = 'select' | 'properties' | null;

export function useNamespaceMenu({
  root,
  storage,
  project,
  readonly,
  onNamespaceChange,
  onNamespaceUnload,
  onSetDefaultNamespace,
  onChange,
}: {
  root: Root;
  storage: ProjectFiles;
  project: string;
  readonly?: boolean;
  onNamespaceChange: (name: string, options: NamespaceSelectionOptions) => Promise<void>;
  onNamespaceUnload: (name: string) => Promise<void>;
  onSetDefaultNamespace: (name: string) => Promise<void>;
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
      const [listed, metadata] = await Promise.all([storage.listProjects(), root.getNamespaceMetadata(project)]);
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
        !!validateNamespace(name) &&
        !!projectId(name) &&
        storage.getCapabilities(name).write
      );
    } catch {
      return false;
    }
  };
  const saveProperties = () =>
    run(async () => {
      await root.setNamespaceDependencies(project, dependencies);
      onChange?.();
    });

  const items: MenuProps['items'] = [
    {key: 'select', icon: <ApartmentOutlined />, label: t('Select Namespace'), onClick: () => void open('select')},
    {
      key: 'properties',
      icon: <SettingOutlined />,
      label: t('Namespace Properties'),
      onClick: () => void open('properties'),
    },
  ];
  const dialogs = (
    <>
      {dialog === 'select' && (
        <NamespaceSelectDialog
          defaultNamespace={project}
          graph={root.getNamespaceGraph()}
          listNamespaces={async () => (await storage.listProjects()).map(({id}) => id)}
          canCreate={canCreate}
          onCreate={async (name) => {
            await storage.createProject(name);
            onChange?.();
          }}
          onSelect={onNamespaceChange}
          onUnload={onNamespaceUnload}
          onSetDefault={onSetDefaultNamespace}
          onClose={() => setDialog(null)}
        />
      )}
      <Modal
        title={t('Namespace Properties')}
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
