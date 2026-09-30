import React, {useContext, useEffect, useRef, useState} from 'react';
import {Modal} from 'antd';
import type {ClientConn} from '@ticlo/core';
import {WorkerEditor} from './WorkerEditor.tsx';
import type {ValueEditorProps} from './ValueEditorBase.ts';
import {TicloLayoutContextType} from '../../component/LayoutContext.ts';
import {EditPolicyContext} from '../../component/EditPolicyContext.tsx';
import {BlockStagePane} from '../../dock/block/BlockStagePane.tsx';
import {t} from '../../component/LocalizedLabel.tsx';
import {requestCallbacks} from '../../util/RequestCallbacks.ts';

interface WorkerDialogProps {
  conn: ClientConn;
  path: string;
  onSave: () => void | Promise<void>;
  onClose: () => void;
  disabled: boolean;
}

function WorkerDialog({conn, path, onSave, onClose, disabled}: WorkerDialogProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const save = async () => {
    if (disabled || saving) return;
    setSaving(true);
    try {
      await onSave();
      onClose();
    } catch (error) {
      setError(String(error));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      open
      title={t('Edit')}
      width={1100}
      className="ticl-table-worker-editor"
      onCancel={onClose}
      onOk={save}
      okText={t('OK')}
      cancelText={t('Cancel')}
      okButtonProps={{disabled, loading: saving}}
      cancelButtonProps={{disabled: saving}}
      closable={!saving}
      mask={{closable: false}}
      keyboard={!saving}
    >
      <div style={{height: '65vh'}}>
        <BlockStagePane conn={conn} basePath={path} onSave={save} />
      </div>
      {error ? (
        <div role="alert" className="ticl-error-message">
          {error}
        </div>
      ) : null}
    </Modal>
  );
}

export function TableWorkerEditor(props: ValueEditorProps) {
  const {conn, value, funcLib, locked, desc, onChange} = props;
  const policies = [useContext(EditPolicyContext), conn.getEditPolicyView()];
  const [dialogs, setDialogs] = useState<Omit<WorkerDialogProps, 'conn' | 'disabled' | 'onClose'>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const latest = useRef(props);
  latest.current = props;
  const [id] = useState(() => crypto.randomUUID());
  const tempPath = `#temp.table-worker-${id}`;
  const path = typeof value === 'string' ? `#temp.#edit-table-worker-${id}` : `${tempPath}.#edit-value`;
  const tempPaths = useRef(new Set<string>());
  const alive = useRef(true);
  useEffect(() => {
    const paths = tempPaths.current;
    alive.current = true;
    return () => {
      alive.current = false;
      for (const path of paths) conn.setValue(path, undefined, requestCallbacks);
    };
  }, [conn]);

  const editFlow = (path: string, onSave: () => void | Promise<void>) => {
    setDialogs((dialogs) => (dialogs.some((dialog) => dialog.path === path) ? dialogs : [...dialogs, {path, onSave}]));
  };
  const editWorker = async () => {
    setLoading(true);
    setError(undefined);
    // A temporary Block holds inline data; applying its flow never touches the table property.
    tempPaths.current.add(typeof value === 'string' ? path : tempPath);
    try {
      if (typeof value === 'string') {
        await conn.editWorker(path, undefined, value, undefined, funcLib);
      } else {
        // addBlock accepts saved data, where objects containing #is need a value wrapper.
        await conn.addBlock(tempPath, {'#is': '', 'value': {'#is': value}});
        await conn.editWorker(path, 'value', undefined, undefined, funcLib);
      }
      if (!alive.current) {
        conn.setValue(typeof value === 'string' ? path : tempPath, undefined, requestCallbacks);
        return;
      }
      editFlow(path, async () => {
        await conn.applyFlowChange(path);
        if (typeof value !== 'string') {
          const {value: updated} = await conn.getValue(`${tempPath}.value`);
          if (alive.current) latest.current.onChange?.(updated, latest.current.name);
        }
      });
    } catch (error) {
      if (alive.current) setError(String(error));
    } finally {
      if (alive.current) setLoading(false);
    }
  };
  const disabled = locked || desc.readonly || !onChange;
  const canEdit =
    !loading &&
    policies.every(
      (policy) =>
        policy.can({cmd: 'editWorker', path}) &&
        (typeof value === 'string' || policy.can({cmd: 'addBlock', path: tempPath, data: {'#is': '', value}}))
    );
  return (
    <TicloLayoutContextType.Provider value={{editFlow}}>
      <WorkerEditor {...props} locked={disabled || loading} onEditWorker={canEdit ? editWorker : undefined} />
      {error ? (
        <div role="alert" className="ticl-error-message">
          {error}
        </div>
      ) : null}
      {dialogs.map((dialog) => (
        <WorkerDialog
          key={dialog.path}
          {...dialog}
          conn={conn}
          disabled={disabled}
          onClose={() => setDialogs((dialogs) => dialogs.filter((item) => item !== dialog))}
        />
      ))}
    </TicloLayoutContextType.Provider>
  );
}
