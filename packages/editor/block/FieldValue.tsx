import React, {useContext, useEffect, useReducer, useRef, useState} from 'react';
import {useConnectionValue} from '../component/useConnectionValue.ts';
import {
  type ClientConn,
  type FunctionDesc,
  type PropDesc,
  getInlineProp,
  isDataTruncated,
  stopPropagation,
} from '@ticlo/core/editor.ts';
import {Popup} from '../component/ClickPopup.tsx';
import {ObjectTree} from '../object-tree/ObjectTree.tsx';
import {TicloLayoutContextType} from '../component/LayoutContext.ts';
import {renderValue} from '../component/renderValue.tsx';
import {typeEditorMap} from '../property/value/index.ts';
import {ServiceEditor} from '../property/value/ServiceEditor.tsx';
import type {ValueEditorProps} from '../property/value/ValueEditorBase.ts';
import {requestCallbacks} from '../util/RequestCallbacks.ts';
import {useEditPolicy} from '../component/EditPolicyContext.tsx';
import {
  addSubBlock,
  canConvertEmbeddedBlock,
  convertEmbeddedBlock,
  hasEmbeddedBlockTypes,
} from '../property/EmbeddedBlock.ts';
import {getDescModule} from '../util/FunctionModule.ts';

export function getInlineEditorDesc(base: PropDesc, inline: ReturnType<typeof getInlineProp>) {
  if (!inline || base.readonly || base.type === 'none' || base.name.endsWith('[]')) return;
  const desc = inline === true ? base : {...base, ...inline, name: base.name};
  if (!desc.readonly && desc.type !== 'none' && (desc.type === 'service' || Object.hasOwn(typeEditorMap, desc.type))) {
    return desc;
  }
}

interface Props {
  conn: ClientConn;
  path: string;
}

interface InlineProps extends Props {
  keys: string[];
  name: string;
  desc: PropDesc;
  funcDesc: FunctionDesc;
  funcModule: string;
}

export const InlineFieldValue = React.memo(function InlineFieldValue({
  conn,
  path,
  keys,
  name,
  desc,
  funcDesc,
  funcModule,
}: InlineProps) {
  const value = useConnectionValue(conn, path);
  const layout = useContext(TicloLayoutContextType);
  const commit = (value: unknown): void => {
    void conn.setUnboundValue(path, value).catch(requestCallbacks.onError);
  };
  const onEditValue = layout.editValue
    ? (desc: PropDesc, mime?: string) => {
        void conn
          .getValue(path)
          .then(({value}) => {
            layout.editValue(
              value === undefined ? desc.default : value,
              {...desc, name, mime: mime ?? desc.mime},
              commit
            );
          })
          .catch(requestCallbacks.onError);
      }
    : undefined;

  // Keep the value area out of stage gestures and leave native input behavior intact.
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!(event.key.toLowerCase() === 's' && (event.ctrlKey || event.metaKey))) event.stopPropagation();
  };
  const Editor = hasEmbeddedBlockTypes(desc) ? InlineObjectFieldEditor : typeEditorMap[desc.type];
  return (
    <div
      className="ticl-e-field-value ticl-e-inline-value"
      onMouseDown={stopPropagation}
      onTouchStart={stopPropagation}
      onKeyDown={onKeyDown}
      onPaste={stopPropagation}
    >
      {desc.type === 'service' ? (
        <ServiceEditor
          conn={conn}
          keys={keys}
          value={value}
          funcDesc={funcDesc}
          desc={desc}
          bindingPath={null}
          funcModule={funcModule}
          onPathChange={(from): void => {
            if (from) void conn.setUnboundBinding(path, `#global.${from}`).catch(requestCallbacks.onError);
          }}
        />
      ) : (
        <Editor
          inline
          conn={conn}
          keys={keys}
          name={name}
          value={value === undefined ? desc.default : value}
          funcDesc={funcDesc}
          desc={desc}
          funcModule={funcModule}
          onEditValue={onEditValue}
          onChange={isDataTruncated(value) && !['object', 'array', 'table'].includes(desc.type) ? undefined : commit}
        />
      )}
    </div>
  );
});

function InlineObjectFieldEditor(props: ValueEditorProps) {
  const {conn, keys, name, desc, funcModule, value} = props;
  const policy = useEditPolicy();
  const creatorId =
    !desc.disableObjectTools && value !== undefined && typeof desc.create === 'string' ? desc.create : undefined;
  const scope = getDescModule(creatorId, funcModule);
  const [, redraw] = useReducer((version: number) => version + 1, 0);
  useEffect(() => {
    if (!creatorId) return;
    const listener = () => redraw();
    conn.watchDesc(creatorId, scope, listener);
    return () => conn.unwatchDesc(listener);
  }, [conn, creatorId, scope]);
  const creator = creatorId ? conn.watchDesc(creatorId, scope) : undefined;
  const [converting, setConverting] = useState(false);
  const pending = useRef<AbortController>(null);
  useEffect(() => () => pending.current?.abort(), [conn, keys, name, desc, policy, funcModule]);
  const convert = async () => {
    if (pending.current) return;
    const operation = new AbortController();
    pending.current = operation;
    setConverting(true);
    try {
      await convertEmbeddedBlock(
        conn,
        policy,
        keys[0],
        name,
        desc,
        funcModule,
        () => !operation.signal.aborted,
        creator
      );
    } catch (error) {
      requestCallbacks.onError(String(error));
    } finally {
      pending.current = null;
      setConverting(false);
    }
  };
  const Editor = typeEditorMap[desc.type];
  return (
    <Editor
      {...props}
      addSubBlock={(id: string) => {
        void addSubBlock({conn, paths: keys, name, funcModule}, policy, id).catch(requestCallbacks.onError);
      }}
      onConvertToEmbeddedBlock={
        creator && !converting && canConvertEmbeddedBlock(policy, keys[0], name, desc, value, null, creator)
          ? convert
          : undefined
      }
    />
  );
}

export const FieldValue = React.memo(function FieldValue({conn, path}: Props) {
  const value = useConnectionValue(conn, path);
  const context = useContext(TicloLayoutContextType);
  const objectTree = useRef<{close?: () => void}>({});

  useEffect(() => {
    const source = objectTree.current;
    return () => {
      source.close?.();
      source.close = undefined;
    };
  }, [conn, path]);

  const getObjectMenu = () => <ObjectTree conn={conn} path={path} data={value} />;
  const onExpandObjectTree = (e: React.MouseEvent) => {
    if (context?.showObjectTree) {
      context.showObjectTree(path, value, e.target as HTMLElement, objectTree.current);
      const source = objectTree.current;
      source.close = () => context.closeObjectTree?.(path, source);
      e.stopPropagation();
    }
  };

  const getObjectPopup = () => (
    <Popup
      popup={getObjectMenu}
      popupAlign={{
        points: ['tl', 'tr'],
        offset: [-6, 0],
      }}
    >
      <div className="ticl-e-tree-arr ticl-e-tree-arr-expand" onDoubleClick={onExpandObjectTree} />
    </Popup>
  );

  return <div className="ticl-e-field-value">{renderValue(value, getObjectPopup)}</div>;
});
