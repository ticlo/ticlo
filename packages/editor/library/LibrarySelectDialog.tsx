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
import {AutoComplete, Button, Checkbox, Divider, Dropdown, Modal} from 'antd';
import {translateEditor} from '@ticlo/core/editor.ts';
import {t} from '../component/LocalizedLabel.tsx';

import type {LibraryGraph} from '@ticlo/core/block/FlowRuntime.ts';
export type {LibraryGraph} from '@ticlo/core/block/FlowRuntime.ts';

export interface LibrarySelectionOptions {
  setDefault: boolean;
  unloadOthers: boolean;
}

interface Props {
  defaultLibrary: string;
  graph: LibraryGraph;
  listLibraries: () => Promise<string[]>;
  canCreate: (name: string, existing: string[]) => boolean;
  onCreate?: (name: string) => Promise<void>;
  canLoad?: (name: string) => boolean;
  canUnload?: (name: string) => boolean;
  canRetain?: boolean;
  catalogComplete?: boolean;
  selectOnly?: boolean;
  onSelect: (name: string, options: LibrarySelectionOptions) => Promise<void>;
  onUnload: (name: string) => Promise<void>;
  onSetDefault: (name: string) => Promise<void>;
  onClose: () => void;
}

function LibraryNode({
  name,
  ancestors,
  graph,
  defaultLibrary,
  onUnload,
  onSetDefault,
  canUnload,
}: {
  name: string;
  ancestors: string[];
  graph: LibraryGraph;
  defaultLibrary: string;
  onUnload: (name: string) => void;
  onSetDefault: (name: string) => void;
  canUnload?: (name: string) => boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const root = ancestors.length === 0;
  const isDefault = root && name === defaultLibrary;
  const children = ancestors.includes(name) ? [] : [...new Set(graph.dependencies[name] ?? [])];
  const row = (
    <div className="ticl-e-library-row" style={{display: 'flex', alignItems: 'center', minHeight: 28, gap: 4}}>
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
      {isDefault && <StarFilled title={translateEditor('Default Library')} />}
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
                label: t('Set as Default Library'),
                disabled: isDefault,
                onClick: () => onSetDefault(name),
              },
              {
                key: 'unload',
                icon: <CloseOutlined />,
                label: t('Unload Library'),
                disabled: isDefault || canUnload?.(name) === false,
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
            <LibraryNode
              key={child}
              name={child}
              ancestors={[...ancestors, name]}
              graph={graph}
              defaultLibrary={defaultLibrary}
              onUnload={onUnload}
              onSetDefault={onSetDefault}
              canUnload={canUnload}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function LibraryTree({
  graph,
  defaultLibrary,
  onUnload,
  onSetDefault,
  canUnload,
}: {
  graph: LibraryGraph;
  defaultLibrary: string;
  onUnload: (name: string) => void;
  onSetDefault: (name: string) => void;
  canUnload?: (name: string) => boolean;
}) {
  return graph.roots.map((root) => (
    <LibraryNode
      key={root}
      name={root}
      ancestors={[]}
      graph={graph}
      defaultLibrary={defaultLibrary}
      onUnload={onUnload}
      onSetDefault={onSetDefault}
      canUnload={canUnload}
    />
  ));
}

export function LibrarySelectDialog({
  defaultLibrary,
  graph,
  listLibraries,
  canCreate,
  onCreate,
  canLoad,
  canUnload,
  canRetain = true,
  catalogComplete = true,
  selectOnly = false,
  onSelect,
  onUnload,
  onSetDefault,
  onClose,
}: Props) {
  const [projects, setProjects] = useState<string[]>([defaultLibrary]);
  const [input, setInput] = useState('');
  const [setDefault, setSetDefault] = useState(true);
  const [unloadOthers, setUnloadOthers] = useState(false);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    listLibraries()
      .then((names) => {
        if (mounted) {
          setProjects([...new Set([defaultLibrary, ...names])].sort());
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
  const creating = catalogComplete && !!onCreate && !!name && !exists;
  const canRun = ready && !!name && (creating ? canCreate(name, projects) : (canLoad?.(name) ?? exists));
  const load = () => {
    if (!canRun) return;
    return run(async () => {
      if (creating) {
        await onCreate(name);
        setProjects((current) => [...current, name].sort());
      }
      await onSelect(name, {
        setDefault: selectOnly || setDefault,
        unloadOthers: !selectOnly && canRetain && unloadOthers,
      });
    });
  };

  return (
    <Modal
      title={t('Libraries')}
      open
      onCancel={() => !busy && onClose()}
      destroyOnHidden
      footer={
        !selectOnly && (
          <div style={{display: 'flex', flexWrap: 'wrap', gap: '4px 12px', textAlign: 'left'}}>
            <Checkbox checked={setDefault} onChange={(event) => setSetDefault(event.target.checked)} disabled={busy}>
              {t('Set as Default Library')}
            </Checkbox>
            <Checkbox
              checked={canRetain && unloadOthers}
              onChange={(event) => setUnloadOthers(event.target.checked)}
              disabled={busy || !canRetain}
            >
              {t('Unload Other Libraries')}
            </Checkbox>
          </div>
        )
      }
    >
      <div
        style={{
          height: 300,
          overflow: 'auto',
          border: '1px solid var(--ant-color-border)',
          padding: 4,
        }}
      >
        <LibraryTree
          graph={graph}
          defaultLibrary={defaultLibrary}
          onUnload={(name) => void runTreeAction(() => onUnload(name))}
          onSetDefault={(name) => void runTreeAction(() => onSetDefault(name))}
          canUnload={canUnload}
        />
      </div>
      <Divider style={{margin: '12px 0'}} />
      <div style={{display: 'flex', gap: 8}}>
        <AutoComplete
          value={input}
          placeholder={translateEditor('Library Name')}
          options={projects.map((id) => ({value: id, label: id}))}
          onChange={setInput}
          filterOption={(value, option) => option?.value.toLowerCase().includes(value.toLowerCase()) ?? false}
          disabled={busy || loading}
          style={{flex: 1}}
        />
        <Button icon={creating ? <PlusOutlined /> : <ApartmentOutlined />} disabled={!canRun || busy} onClick={load}>
          {t(creating ? 'Create' : selectOnly ? 'Open' : 'Load')}
        </Button>
      </div>
      {error && <div className="ticl-e-file-error">{error}</div>}
    </Modal>
  );
}
