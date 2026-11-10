import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Alert, Button, Table, Tree, type TreeDataNode} from 'antd';
import {KeyOutlined, PlayCircleOutlined, ReloadOutlined, TableOutlined} from '@ant-design/icons';
import type {DockLayout} from 'rc-dock';
import CodeMirror from '@uiw/react-codemirror';
import type {SqlEntity, SqlEntityColumn, SqlResult, SqlTable} from '@ticlo/core';
import {sqlClientCommands} from '@ticlo/core';
import {type ClientConn, translateEditor} from '@ticlo/core/editor.ts';
import {EditPolicyProvider, useEditPolicy} from '../component/EditPolicyContext.tsx';
import {useConnectionValue} from '../component/useConnectionValue.ts';
import {renderValue} from '../component/renderValue.tsx';
import {t} from '../component/LocalizedLabel.tsx';
import {editorTheme} from '../dock/text-editor/TextEditorPane.tsx';
import {createDockDialog} from '../component/DockDialogPane.tsx';

interface Props {
  conn: ClientConn;
  path: string;
}

interface EntityNode extends TreeDataNode {
  entity?: SqlEntity;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

const QueryTable = React.memo(function QueryTable({table}: {table: SqlTable}) {
  const container = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(200);
  useEffect(() => {
    let frame: number;
    const observer = new ResizeObserver(([entry]) => {
      const height = Math.max(40, Math.floor(entry.contentRect.height) - 40);
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setHeight(height));
    });
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);
  const columns = useMemo(
    () =>
      table.columns.map((column, index) => ({
        key: column.name,
        title: column.sourceName || column.name,
        width: Math.max(80, Math.min(240, column.name.length * 8 + 24)),
        ellipsis: true,
        render: (_: unknown, row: {values: unknown[]}) => renderValue(row.values[index]),
      })),
    [table]
  );
  const rows = useMemo(() => table.rows.map((values, key) => ({key, values})), [table]);
  return (
    <div className="ticl-e-sql-table" ref={container}>
      <Table
        columns={columns}
        dataSource={rows}
        size="small"
        pagination={false}
        virtual
        scroll={{
          x: Math.max(
            100,
            columns.reduce((sum, column) => sum + column.width, 0)
          ),
          y: height,
        }}
      />
    </div>
  );
});

function SqlClientPanel({conn, path}: Props) {
  const service = useConnectionValue(conn, `${path}.#output`);
  const policy = useEditPolicy();
  const [sql, setSql] = useState('');
  const [entities, setEntities] = useState<SqlEntity[]>();
  const [columns, setColumns] = useState<Record<string, SqlEntityColumn[]>>({});
  const [expanded, setExpanded] = useState<React.Key[]>([]);
  const [refresh, setRefresh] = useState(0);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SqlResult>();
  const [error, setError] = useState<string>();
  const session = useRef({id: 0, active: false});
  const inFlight = useRef(false);
  const target = useMemo(() => ({conn, path, service}), [conn, path, service]);
  const current = useRef(target);
  current.current = target;

  const request = useCallback(
    async (command: string, params?: Record<string, unknown>) => {
      const response = await conn.executeCommand(path, command, params, undefined, sqlClientCommands[command]);
      return response?.result;
    },
    [conn, path]
  );
  const canExecute = policy.can({cmd: 'executeCommand', path, command: 'query'});

  useEffect(() => {
    const revision = {id: session.current.id + 1, active: true};
    session.current = revision;
    setEntities(undefined);
    setColumns({});
    setExpanded([]);
    setResult(undefined);
    setError(undefined);
    setRunning(false);
    inFlight.current = false;
    if (service) {
      request('listEntities').then(
        (value) => {
          if (revision.active && current.current === target) setEntities(value);
        },
        (error) => {
          if (revision.active && current.current === target) {
            setError(errorMessage(error));
            setEntities([]);
          }
        }
      );
    }
    return () => {
      revision.active = false;
    };
  }, [service, refresh, request, target]);

  const tree = useMemo<EntityNode[]>(
    () =>
      (entities ?? []).map((entity) => {
        const key = JSON.stringify([entity.catalog, entity.schema, entity.name]);
        return {
          key,
          entity,
          icon: <TableOutlined />,
          title: [entity.catalog, entity.schema, entity.name].filter(Boolean).join('.'),
          isLeaf: false,
          children: columns[key]?.map((column, index) => ({
            key: `${key}:${index}`,
            isLeaf: true,
            title: (
              <span title={column.defaultExpression}>
                {column.primaryKey ? <KeyOutlined /> : null} {column.name}
                <span className="ticl-e-sql-column-type">{column.databaseType}</span>
              </span>
            ),
          })),
        };
      }),
    [entities, columns]
  );

  const loadColumns = async (node: EntityNode) => {
    const key = String(node.key);
    if (!node.entity || columns[key]) return;
    const revision = session.current;
    try {
      const value = await request('getColumns', {entity: node.entity});
      if (revision.active && current.current === target) setColumns((columns) => ({...columns, [key]: value}));
    } catch (error) {
      if (revision.active && current.current === target) setError(errorMessage(error));
    }
  };

  const run = async () => {
    if (inFlight.current || !service || !sql.trim() || !canExecute) return;
    const revision = session.current;
    inFlight.current = true;
    setRunning(true);
    setResult(undefined);
    setError(undefined);
    try {
      const value = await request('query', {sql});
      if (revision.active && current.current === target) setResult(value);
    } catch (error) {
      if (revision.active && current.current === target) setError(errorMessage(error));
    } finally {
      if (revision.active && current.current === target) {
        inFlight.current = false;
        setRunning(false);
      }
    }
  };

  return (
    <div className="ticl-e-sql-client">
      <div className="ticl-e-sql-entities">
        <div className="ticl-e-sql-toolbar">
          <strong>{t('Entities')}</strong>
          <Button
            size="small"
            icon={<ReloadOutlined />}
            title={translateEditor('Refresh')}
            disabled={!service || running}
            onClick={() => setRefresh((value) => value + 1)}
          />
        </div>
        {service ? (
          entities ? (
            <Tree<EntityNode>
              key={session.current.id}
              treeData={tree}
              showIcon
              blockNode
              expandedKeys={expanded}
              onExpand={setExpanded}
              loadData={loadColumns}
            />
          ) : (
            t('Loading...')
          )
        ) : (
          t('SQL client is not ready')
        )}
      </div>
      <div className="ticl-e-sql-main">
        <div
          className="ticl-e-sql-input"
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              void run();
            }
          }}
        >
          <CodeMirror value={sql} onChange={setSql} height="180px" theme={editorTheme} />
        </div>
        <div className="ticl-e-sql-toolbar">
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            loading={running}
            disabled={!service || !sql.trim() || !canExecute}
            onClick={() => void run()}
          >
            {t('Run')}
          </Button>
          {result?.table ? (
            <span>
              {t('Rows')}: {result.table.rows.length}
            </span>
          ) : null}
          {result?.affectedRows !== undefined ? (
            <span>
              {t('Affected rows')}: {result.affectedRows}
            </span>
          ) : null}
          {result?.insertId !== undefined ? (
            <span>
              {t('Insert ID')}: {result.insertId}
            </span>
          ) : null}
        </div>
        {error ? <Alert type="error" title={error} /> : null}
        {result?.table ? <QueryTable table={result.table} /> : null}
      </div>
    </div>
  );
}

export function SqlClientDialog({conn, path}: Props) {
  return (
    <EditPolicyProvider conn={conn}>
      <SqlClientPanel conn={conn} path={path} />
    </EditPolicyProvider>
  );
}

export function openSqlClientDialog(layout: DockLayout, conn: ClientConn, path: string) {
  createDockDialog(
    layout,
    `${translateEditor('Manage database')} — ${path}`,
    <SqlClientDialog conn={conn} path={path} />,
    `sql-client-${path}`,
    {preferredWidth: 1000, preferredHeight: 650}
  );
}
