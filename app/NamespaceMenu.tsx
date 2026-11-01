import React, {useState} from 'react';
import {ApartmentOutlined, PlusOutlined, SettingOutlined} from '@ant-design/icons';
import {Button, Input, Modal, Select, type MenuProps} from 'antd';
import type {Root} from '@ticlo/core';
import {translateEditor} from '@ticlo/core/editor.ts';
import {projectId, type ProjectFiles} from '@ticlo/core/storage/FileAccess.ts';
import {validateNamespace} from '@ticlo/core/util/NamespaceMetadata.ts';
import {t} from '@ticlo/editor/component/LocalizedLabel.tsx';

type Dialog = 'select' | 'properties' | null;

export function useNamespaceMenu({
  root,
  storage,
  project,
  readonly,
  onNamespaceChange,
  onChange,
}: {
  root: Root;
  storage: ProjectFiles;
  project: string;
  readonly?: boolean;
  onNamespaceChange: (name: string) => Promise<void>;
  onChange?: () => void;
}) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const [projects, setProjects] = useState<string[]>([]);
  const [selected, setSelected] = useState(project);
  const [newName, setNewName] = useState('');
  const [dependencies, setDependencies] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const writable = !readonly && storage.getCapabilities(`${project}/ticlo.json`).write;

  const open = async (next: Exclude<Dialog, null>) => {
    setDialog(next);
    setSelected(project);
    setNewName('');
    setDependencies([]);
    setError('');
    setLoading(true);
    setReady(false);
    try {
      const [listed, metadata] = await Promise.all([
        storage.listProjects(),
        next === 'properties' ? root.getNamespaceMetadata(project) : undefined,
      ]);
      setProjects([...new Set([project, ...listed.map(({id}) => id)])].sort());
      if (next === 'properties') setDependencies(metadata?.dependencies ?? []);
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
  const select = () =>
    run(async () => {
      if (selected !== project) await onNamespaceChange(selected);
    });
  const name = newName.trim();
  let canCreate = false;
  try {
    canCreate =
      !!name &&
      ready &&
      !readonly &&
      name !== '#root' &&
      !projects.includes(name) &&
      !!validateNamespace(name) &&
      !!projectId(name) &&
      storage.getCapabilities(name).write;
  } catch {}
  const create = () =>
    run(async () => {
      if (!canCreate) throw new Error('Invalid namespace name or storage is read-only.');
      await storage.createProject(name);
      setProjects((current) => [...current, name].sort());
      setSelected(name);
      setNewName('');
      await onNamespaceChange(name);
    });
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
      <Modal
        title={t('Select Namespace')}
        open={dialog === 'select'}
        onOk={select}
        onCancel={() => !busy && setDialog(null)}
        okButtonProps={{disabled: !ready || !selected}}
        confirmLoading={busy}
        destroyOnHidden
      >
        <Select
          value={selected}
          options={projects.map((id) => ({value: id, label: id}))}
          onChange={setSelected}
          loading={loading}
          disabled={busy || loading}
          style={{width: '100%', marginBottom: 16}}
        />
        <div style={{marginBottom: 8}}>{t('New Namespace')}</div>
        <div style={{display: 'flex', gap: 8}}>
          <Input
            value={newName}
            placeholder={translateEditor('Namespace Name')}
            onChange={(event) => setNewName(event.target.value)}
            onPressEnter={() => canCreate && void create()}
            disabled={busy}
          />
          <Button icon={<PlusOutlined />} disabled={!canCreate || busy || loading} onClick={create}>
            {t('Create')}
          </Button>
        </div>
        {error && <div className="ticl-e-file-error">{error}</div>}
      </Modal>
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
