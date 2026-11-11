import React, {useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
import {Button} from 'antd';
import {PlayCircleFilled} from '@ant-design/icons';
import type {DataMap, FunctionCommandDesc, FunctionDesc, PropDesc} from '@ticlo/core';
import {deepClone} from '@ticlo/core/util/Clone.ts';
import type {ClientConn} from '@ticlo/core/editor.ts';
import {TicloLayoutContextType} from '../component/LayoutContext.ts';
import {LocalizedPropertyName, t} from '../component/LocalizedLabel.tsx';
import {typeEditorMap} from '../property/value/index.ts';
import {ReadonlyEditor} from '../property/value/ReadonlyEditor.tsx';
import {EditPolicyProvider, useEditPolicy} from '../component/EditPolicyContext.tsx';

interface Props {
  conn: ClientConn;
  paths: string[];
  command: string;
  desc: FunctionCommandDesc;
  funcDesc: FunctionDesc;
  property?: string;
}

interface Outcome {
  path: string;
  values?: DataMap;
  error?: string;
}

interface ValueProps {
  desc: PropDesc;
  funcDesc: FunctionDesc;
  value: unknown;
  readonly?: boolean;
  label?: React.ReactNode;
  onChange?: (value: unknown, name: string) => void;
}

export const CommandValue = React.memo(function CommandValue({
  desc,
  funcDesc,
  value,
  readonly,
  label,
  onChange,
}: ValueProps) {
  const layout = useContext(TicloLayoutContextType);
  const localLayout = useMemo(
    () => ({
      ...layout,
      editProperty: layout.editValue
        ? (_paths: string[], prop: PropDesc, value: unknown, mime?: string, locked?: boolean) => {
            layout.editValue(
              value,
              {...prop, mime: mime ?? prop.mime, readonly: readonly || locked},
              readonly || locked || !onChange ? undefined : (value) => onChange(value, desc.name)
            );
          }
        : undefined,
    }),
    [layout, readonly, onChange, desc.name]
  );
  const effectiveDesc = useMemo(() => (readonly ? {...desc, readonly: true} : desc), [desc, readonly]);
  const Editor = typeEditorMap[desc.type] ?? ReadonlyEditor;
  return (
    <TicloLayoutContextType.Provider value={localLayout}>
      <div className="ticl-e-property">
        <div className="ticl-e-property-name">
          {label === undefined ? <LocalizedPropertyName desc={funcDesc} name={desc.name} /> : label}
        </div>
        <div className="ticl-e-property-value">
          <Editor
            keys={[]}
            name={desc.name}
            value={value}
            desc={effectiveDesc}
            funcDesc={funcDesc}
            locked={readonly}
            onChange={readonly ? undefined : onChange}
          />
        </div>
      </div>
    </TicloLayoutContextType.Provider>
  );
});

function defaultParameters(parameters: PropDesc[]) {
  return Object.fromEntries(
    parameters.map((desc) => [desc.name, deepClone(desc.init !== undefined ? desc.init : desc.default)])
  );
}

export function CommandMenu(props: Props) {
  return (
    <EditPolicyProvider conn={props.conn}>
      <CommandPanel {...props} />
    </EditPolicyProvider>
  );
}

function CommandPanel({conn, paths, command, desc, funcDesc, property}: Props) {
  const policy = useEditPolicy();
  const [params, setParams] = useState(() => defaultParameters(desc.parameters ?? []));
  const [running, setRunning] = useState(false);
  const [outcomes, setOutcomes] = useState<Outcome[]>();
  const inFlight = useRef(false);
  const pathKey = JSON.stringify(paths);
  const target = useMemo(() => ({conn, pathKey, command, property, desc}), [conn, pathKey, command, property, desc]);
  const current = useRef(target);
  current.current = target;
  const session = useRef({active: false});
  useEffect(() => {
    const revision = {active: true};
    session.current = revision;
    inFlight.current = false;
    setRunning(false);
    setOutcomes(undefined);
    setParams(defaultParameters(desc.parameters ?? []));
    return () => {
      revision.active = false;
    };
  }, [target, desc]);
  const change = useCallback(
    (value: unknown, name: string) => {
      if (session.current.active && current.current === target) setParams((params) => ({...params, [name]: value}));
    },
    [target]
  );
  const data = property === undefined ? params : {...params, property};
  const allowed = (view: typeof policy) =>
    paths.length > 0 && paths.every((path) => view.can({cmd: 'executeCommand', path, command, params: data}));
  const run = async () => {
    if (inFlight.current || !allowed(conn.getEditPolicyView())) return;
    const revision = session.current;
    inFlight.current = true;
    setRunning(true);
    setOutcomes(undefined);
    const values = await Promise.all(
      paths.map(async (path): Promise<Outcome> => {
        try {
          const response = await conn.executeCommand(path, command, data, undefined, desc);
          return {path, values: response?.result};
        } catch (error) {
          return {path, error: error instanceof Error ? `${error.name}: ${error.message}` : String(error)};
        }
      })
    );
    if (revision.active && current.current === target) {
      setOutcomes(values);
      setRunning(false);
      inFlight.current = false;
    }
  };
  return (
    <div className="ticl-e-command-menu ant-dropdown-menu" onKeyDown={(event) => event.stopPropagation()}>
      {desc.parameters?.map((parameter) => (
        <CommandValue
          key={parameter.name}
          desc={parameter}
          funcDesc={funcDesc}
          value={params[parameter.name]}
          readonly={running || parameter.readonly}
          onChange={change}
        />
      ))}
      <div className="ticl-e-command-actions">
        <Button
          size="small"
          type="primary"
          icon={<PlayCircleFilled />}
          loading={running}
          disabled={!allowed(policy)}
          onClick={() => void run()}
        >
          {t('Run')}
        </Button>
      </div>
      {outcomes ? (
        <div className="ticl-e-command-results">
          <strong>{t('Results')}</strong>
          {outcomes.map((outcome) => (
            <div key={outcome.path}>
              {outcomes.length > 1 ? <div>{outcome.path}</div> : null}
              {outcome.error ? (
                <div className="ticl-e-error-message">{outcome.error}</div>
              ) : desc.results?.length ? (
                desc.results.map((result) => (
                  <CommandValue
                    key={result.name}
                    desc={result}
                    funcDesc={funcDesc}
                    value={outcome.values?.[result.name]}
                    readonly
                  />
                ))
              ) : (
                t('Done')
              )}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
