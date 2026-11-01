import React, {useEffect, useState} from 'react';
import {
  ApartmentOutlined,
  CloseOutlined,
  DownOutlined,
  PlusOutlined,
  RightOutlined,
  StarFilled,
  StarOutlined,
} from '@ant-design/icons';
import {AutoComplete, Button, Checkbox, Dropdown, Modal} from 'antd';
import {translateEditor} from '@ticlo/core/editor.ts';
import {t} from '../component/LocalizedLabel.tsx';

export interface NamespaceGraph {
  roots: string[];
  dependencies: Record<string, string[]>;
}

export interface NamespaceSelectionOptions {
  setDefault: boolean;
  unloadOthers: boolean;
}

interface Props {
  defaultNamespace: string;
  graph: NamespaceGraph;
  listNamespaces: () => Promise<string[]>;
  canCreate: (name: string, existing: string[]) => boolean;
  onCreate: (name: string) => Promise<void>;
  onSelect: (name: string, options: NamespaceSelectionOptions) => Promise<void>;
  onUnload: (name: string) => Promise<void>;
  onSetDefault: (name: string) => Promise<void>;
  onClose: () => void;
}

function NamespaceNode({
  name,
  ancestors,
  graph,
  defaultNamespace,
  onUnload,
  onSetDefault,
}: {
  name: string;
  ancestors: string[];
  graph: NamespaceGraph;
  defaultNamespace: string;
  onUnload: (name: string) => void;
  onSetDefault: (name: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const root = ancestors.length === 0;
  const isDefault = root && name === defaultNamespace;
  const children = ancestors.includes(name) ? [] : [...new Set(graph.dependencies[name] ?? [])];
  const row = (
    <div className="ticl-e-namespace-row" style={{display: 'flex', alignItems: 'center', minHeight: 28, gap: 4}}>
      {children.length ? (
        <Button
          size="small"
          type="text"
          icon={expanded ? <DownOutlined /> : <RightOutlined />}
          onClick={() => setExpanded(!expanded)}
        />
      ) : (
        <span style={{width: 24}} />
      )}
      <ApartmentOutlined />
      <span>{name}</span>
      {isDefault && <StarFilled title={translateEditor('Default Namespace')} />}
    </div>
  );
  return (
    <div>
      {root ? (
        <Dropdown
          trigger={['contextMenu']}
          menu={{
            items: [
              {
                key: 'default',
                icon: <StarOutlined />,
                label: t('Set as Default Namespace'),
                disabled: isDefault,
                onClick: () => onSetDefault(name),
              },
              {
                key: 'unload',
                icon: <CloseOutlined />,
                label: t('Unload Namespace'),
                disabled: isDefault,
                onClick: () => onUnload(name),
              },
            ],
          }}
        >
          {row}
        </Dropdown>
      ) : (
        row
      )}
      {expanded && children.length > 0 && (
        <div style={{paddingLeft: 20}}>
          {children.map((child) => (
            <NamespaceNode
              key={child}
              name={child}
              ancestors={[...ancestors, name]}
              graph={graph}
              defaultNamespace={defaultNamespace}
              onUnload={onUnload}
              onSetDefault={onSetDefault}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function NamespaceTree({
  graph,
  defaultNamespace,
  onUnload,
  onSetDefault,
}: {
  graph: NamespaceGraph;
  defaultNamespace: string;
  onUnload: (name: string) => void;
  onSetDefault: (name: string) => void;
}) {
  return graph.roots.map((root) => (
    <NamespaceNode
      key={root}
      name={root}
      ancestors={[]}
      graph={graph}
      defaultNamespace={defaultNamespace}
      onUnload={onUnload}
      onSetDefault={onSetDefault}
    />
  ));
}

export function NamespaceSelectDialog({
  defaultNamespace,
  graph,
  listNamespaces,
  canCreate,
  onCreate,
  onSelect,
  onUnload,
  onSetDefault,
  onClose,
}: Props) {
  const [projects, setProjects] = useState<string[]>([defaultNamespace]);
  const [input, setInput] = useState('');
  const [setDefault, setSetDefault] = useState(true);
  const [unloadOthers, setUnloadOthers] = useState(false);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    listNamespaces()
      .then((names) => {
        if (mounted) {
          setProjects([...new Set([defaultNamespace, ...names])].sort());
          setReady(true);
        }
      })
      .catch((reason) => {
        if (mounted) setError(reason instanceof Error ? reason.message : String(reason));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const run = async (operation: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await operation();
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };
  const runTreeAction = async (operation: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await operation();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };
  const name = input.trim();
  const exists = projects.includes(name);
  const creating = !!name && !exists;
  const canRun = ready && !!name && (exists || canCreate(name, projects));
  const load = () => {
    if (!canRun) return;
    return run(async () => {
      if (!exists) {
        await onCreate(name);
        setProjects((current) => [...current, name].sort());
      }
      await onSelect(name, {setDefault, unloadOthers});
    });
  };

  return (
    <Modal
      title={t('Select Namespace')}
      open
      onCancel={() => !busy && onClose()}
      destroyOnHidden
      footer={
        <div style={{display: 'flex', flexWrap: 'wrap', gap: '4px 12px', textAlign: 'left'}}>
          <Checkbox checked={setDefault} onChange={(event) => setSetDefault(event.target.checked)} disabled={busy}>
            {t('Set as Default Namespace')}
          </Checkbox>
          <Checkbox checked={unloadOthers} onChange={(event) => setUnloadOthers(event.target.checked)} disabled={busy}>
            {t('Unload Other Namespaces')}
          </Checkbox>
        </div>
      }
    >
      <div style={{marginBottom: 4}}>{t('Loaded Namespaces')}</div>
      <div
        style={{
          maxHeight: 180,
          overflow: 'auto',
          border: '1px solid var(--ant-color-border)',
          padding: 4,
          marginBottom: 12,
        }}
      >
        <NamespaceTree
          graph={graph}
          defaultNamespace={defaultNamespace}
          onUnload={(name) => void runTreeAction(() => onUnload(name))}
          onSetDefault={(name) => void runTreeAction(() => onSetDefault(name))}
        />
      </div>
      <div style={{display: 'flex', gap: 8}}>
        <AutoComplete
          value={input}
          placeholder={translateEditor('Namespace Name')}
          options={projects.map((id) => ({value: id, label: id}))}
          onChange={setInput}
          filterOption={(value, option) => option?.value.toLowerCase().includes(value.toLowerCase()) ?? false}
          disabled={busy || loading}
          style={{flex: 1}}
        />
        <Button icon={creating ? <PlusOutlined /> : <ApartmentOutlined />} disabled={!canRun || busy} onClick={load}>
          {t(creating ? 'Create' : 'Load')}
        </Button>
      </div>
      {error && <div className="ticl-e-file-error">{error}</div>}
    </Modal>
  );
}
