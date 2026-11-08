import React from 'react';
import {Button, Input, InputNumber, Popover, Select, Switch, Table} from 'antd';
import type {DockLayout} from 'rc-dock';
import {ArrowDownOutlined, ArrowUpOutlined, CopyOutlined, DeleteOutlined, TableOutlined} from '@ant-design/icons';
import {deepEqual, encodeDisplay, isDataTruncated, translateEditor} from '@ticlo/core/editor.ts';
import type {PropDesc, TableColumnDesc} from '@ticlo/core';
import {deepClone} from '@ticlo/core/util/Clone.ts';
import {ValueEditorProps} from './ValueEditorBase.ts';
import {renderValue} from '../../component/renderValue.tsx';
import {TicloLayoutContextType, type TicloLayoutContext} from '../../component/LayoutContext.ts';
import {t} from '../../component/LocalizedLabel.tsx';
import {createDockDialog, DialogContext} from '../../component/DockDialogPane.tsx';
import {TableWorkerEditor} from './TableWorkerEditor.tsx';

type RowValue = Record<string, unknown> | unknown[];
type Format = 'object' | 'matrix' | 'legacy-array';
interface Column {
  key: string | number;
  desc: PropDesc;
  fixed?: boolean;
}
interface Row {
  id: number;
  value: RowValue;
}
interface State {
  open: boolean;
  rows: Row[];
  columns: Column[];
  format: Format;
  activeCell?: string;
  newColumnName: string;
  newColumnType: 'string' | 'number' | 'toggle';
  loading: boolean;
  saving: boolean;
  error?: string;
}

interface TableEditorProps extends ValueEditorProps {
  dockPanel?: boolean;
}

function isRow(value: unknown, rowType: PropDesc['rowType']): value is RowValue {
  if (rowType === 'array') return Array.isArray(value);
  return value != null && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value != null && !Array.isArray(value) && typeof value === 'object';
}

export class TableEditor extends React.PureComponent<TableEditorProps, State> {
  static contextType = TicloLayoutContextType;
  declare context: TicloLayoutContext;

  static openFloatPanel(layout: DockLayout, props: ValueEditorProps) {
    const paths = props.keys?.map((key) => `${key}.${props.name}`) ?? [];
    const id = paths.length ? `table-${[...paths].sort().join('..')}` : undefined;
    createDockDialog(
      layout,
      `${translateEditor(props.locked || !props.onChange ? 'View table' : 'Edit table')} ${props.name}`,
      <TableEditor {...props} dockPanel />,
      id,
      {preferredWidth: 1000, preferredHeight: 650}
    );
  }

  state: State = {
    open: false,
    rows: [],
    columns: [],
    format: 'object',
    newColumnName: '',
    newColumnType: 'string',
    loading: Boolean(this.props.dockPanel),
    saving: false,
  };
  private nextId = 0;
  private requestId = 0;
  private source: {value: unknown; paths: string; desc: PropDesc};
  private loadedValue: unknown;
  private loadedValues: unknown[];

  componentDidMount() {
    if (this.props.dockPanel) {
      this.props.conn?.editPolicyChanges().listen(this.onPolicyChange);
      void this.load();
    }
  }

  private onPolicyChange = () => this.forceUpdate();

  componentWillUnmount() {
    ++this.requestId;
    if (this.props.dockPanel) this.props.conn?.editPolicyChanges().unlisten(this.onPolicyChange);
  }

  private paths() {
    const {keys, name} = this.props;
    return keys?.map((key) => `${key}.${name}`) ?? [];
  }

  private changedSource() {
    return (
      this.source &&
      (this.source.paths !== this.paths().join('\n') ||
        !deepEqual(this.source.value, this.props.value) ||
        !deepEqual(this.source.desc, this.props.desc))
    );
  }

  private editable() {
    const {locked, onChange, desc, conn} = this.props;
    return (
      Boolean(onChange) &&
      !locked &&
      !desc.readonly &&
      (!conn || this.paths().every((path) => conn.getEditPolicyView().canWriteField(path)))
    );
  }

  private openTable = () => this.context.editTable?.({...this.props, locked: !this.editable()});

  popup = () => {
    const {desc, value} = this.props;
    this.context.editProperty(this.paths(), desc, value, 'object', !this.editable());
  };

  private schemaError() {
    const {rowType, columns} = this.props.desc;
    if (rowType == null) return false;
    if ((rowType !== 'array' && rowType !== 'object') || !columns?.length) return true;
    const keys = new Set<string | number>();
    for (const {key} of columns) {
      if (
        keys.has(key) ||
        (rowType === 'object' ? typeof key !== 'string' : !Number.isInteger(key) || Number(key) < 0)
      ) {
        return true;
      }
      keys.add(key);
    }
    return false;
  }

  load = async () => {
    const requestId = ++this.requestId;
    const {value, desc, conn} = this.props;
    const paths = this.paths();
    this.source = {value, desc, paths: paths.join('\n')};
    this.setState({
      open: true,
      loading: true,
      rows: [],
      columns: [],
      activeCell: undefined as string | undefined,
      newColumnName: '',
      error: undefined,
    });
    try {
      if (this.schemaError()) throw new Error(translateEditor('Invalid table columns'));
      // Subscribed values can be truncated, even inside individual cells.
      const loadedValues =
        conn && paths.length
          ? await Promise.all(paths.map(async (path) => (await conn.getValue(path)).value))
          : [value];
      const data = loadedValues[0];
      if (requestId !== this.requestId) return;
      let format: Format;
      let rows: RowValue[];
      let columns: Column[];
      if (isObject(data)) {
        if (
          !Array.isArray(data.rows) ||
          !Array.isArray(data.columns) ||
          isDataTruncated(data.rows) ||
          data.rows.some((row: unknown) => !Array.isArray(row))
        ) {
          throw new Error(translateEditor('Invalid table rows'));
        }
        const names = new Set<string>();
        for (const column of data.columns) {
          if (!isObject(column) || typeof column.name !== 'string' || !column.name || names.has(column.name)) {
            throw new Error(translateEditor('Invalid table columns'));
          }
          names.add(column.name);
        }
        format = 'matrix';
        rows = data.rows;
        columns = data.columns.map((column: PropDesc, index: number) => ({key: index, desc: deepClone(column)}));
      } else {
        if (
          data !== undefined &&
          (!Array.isArray(data) || isDataTruncated(data) || data.some((row) => !isRow(row, desc.rowType)))
        ) {
          throw new Error(translateEditor('Invalid table rows'));
        }
        format = desc.rowType === 'array' ? 'legacy-array' : 'object';
        rows = data ?? [];
        columns = (desc.columns ?? []).map((column: TableColumnDesc) => ({
          key: column.key,
          desc: {...column, name: column.title ?? String(column.key)},
          fixed: true,
        }));
        if (format === 'object') {
          const keys = new Set(columns.map((column) => String(column.key)));
          for (const row of [rows[0], rows[rows.length - 1]]) {
            if (!row) continue;
            for (const key of Object.keys(row)) {
              if (!keys.has(key)) {
                columns.push({key, desc: {name: key, type: 'any'}});
                keys.add(key);
              }
            }
          }
        }
      }
      this.loadedValue = data;
      this.loadedValues = loadedValues;
      this.setState({
        format,
        columns,
        rows: rows.map((row) => ({id: this.nextId++, value: deepClone(row)})),
        loading: false,
      });
    } catch (error) {
      if (requestId === this.requestId) this.setState({loading: false, error: String(error)});
    }
  };

  save = async (onClose?: () => void) => {
    if (!this.editable() || this.changedSource() || this.state.loading || this.state.saving || this.state.error) return;
    const {rows, columns, format} = this.state;
    const values = rows.map((row) => row.value);
    const next =
      format === 'matrix'
        ? {...(this.loadedValue as object), columns: columns.map((column) => column.desc), rows: values}
        : values;
    const {conn, onChange, name} = this.props;
    const paths = this.paths();
    this.setState({saving: true});
    try {
      if (conn && paths.length) {
        const current = await Promise.all(paths.map(async (path) => (await conn.getValue(path)).value));
        if (current.some((value, index) => !deepEqual(value, this.loadedValues[index]))) {
          throw new Error(translateEditor('Value changed. Reload to continue.'));
        }
        for (const path of paths) {
          const denied = conn.getEditPolicyView().check({cmd: 'set', path, value: next});
          if (denied) throw new Error(denied);
        }
        for (const path of paths) await conn.setValue(path, next, true);
      } else {
        onChange(next, name);
      }
      onClose?.();
    } catch (error) {
      this.setState({error: String(error), saving: false});
    }
  };

  private changeCell(id: number, key: string | number, value: unknown) {
    this.setState(({rows}) => ({
      rows: rows.map((row) => {
        if (row.id !== id) return row;
        const next = Array.isArray(row.value) ? row.value.slice() : {...row.value};
        // defineProperty also supports an object column literally named "__proto__".
        Object.defineProperty(next, key, {value, enumerable: true, writable: true, configurable: true});
        return {...row, value: next};
      }),
    }));
  }

  addRow = () => {
    const {format, columns} = this.state;
    const value: RowValue =
      format === 'object'
        ? {}
        : new Array(
            format === 'matrix' ? columns.length : Math.max(-1, ...columns.map((column) => Number(column.key))) + 1
          );
    for (const column of columns) {
      if (column.desc.init !== undefined || (format === 'object' && !column.fixed)) {
        Object.defineProperty(value, column.key, {
          value: column.desc.init !== undefined ? deepClone(column.desc.init) : '',
          enumerable: true,
          writable: true,
          configurable: true,
        });
      }
    }
    const row = {id: this.nextId++, value};
    this.setState(({rows}) => ({rows: [...rows, row]}));
  };

  addColumn = () => {
    const {format, columns, newColumnName, newColumnType} = this.state;
    const name = newColumnName.trim();
    if (
      !name ||
      format === 'legacy-array' ||
      columns.some((column) => (format === 'object' ? column.key : column.desc.name) === name)
    )
      return;
    const key = format === 'matrix' ? columns.length : name;
    const column: Column = {key, desc: {name, type: format === 'matrix' ? newColumnType : 'any'}};
    const initial = format === 'object' ? '' : newColumnType === 'number' ? 0 : newColumnType === 'toggle' ? false : '';
    this.setState(({rows}) => ({
      columns: [...columns, column],
      rows: rows.map((row) => {
        const value = Array.isArray(row.value) ? [...row.value, initial] : {...row.value};
        if (!Array.isArray(value))
          Object.defineProperty(value, key, {value: '', enumerable: true, writable: true, configurable: true});
        return {...row, value};
      }),
      newColumnName: '',
    }));
  };

  private deleteColumn(column: Column) {
    if (column.fixed) return;
    const {format, columns} = this.state;
    this.setState(({rows}) => ({
      columns: columns
        .filter((item) => item !== column)
        .map((item, index) => (format === 'matrix' ? {...item, key: index} : item)),
      rows: rows.map((row) => {
        const value = Array.isArray(row.value) ? row.value.slice() : {...row.value};
        if (Array.isArray(value)) value.splice(Number(column.key), 1);
        else delete value[column.key];
        return {...row, value};
      }),
      activeCell: undefined as string | undefined,
    }));
  }

  private scanAllColumns = () => {
    this.setState(({columns, rows}) => {
      const keys = new Set(columns.map((column) => String(column.key)));
      const next = columns.slice();
      for (const row of rows) {
        for (const key of Object.keys(row.value)) {
          if (!keys.has(key)) {
            next.push({key, desc: {name: key, type: 'any'}});
            keys.add(key);
          }
        }
      }
      return {columns: next};
    });
  };

  private rowAction(id: number, action: 'copy' | 'delete' | 'up' | 'down') {
    this.setState(({rows}) => {
      const next = rows.slice();
      const index = next.findIndex((row) => row.id === id);
      if (action === 'copy') next.splice(index + 1, 0, {id: this.nextId++, value: deepClone(next[index].value)});
      else if (action === 'delete') next.splice(index, 1);
      else {
        const target = index + (action === 'up' ? -1 : 1);
        if (target < 0 || target >= next.length) return null;
        [next[index], next[target]] = [next[target], next[index]];
      }
      return {rows: next};
    });
  }

  private cell(row: Row, column: Column, disabled: boolean) {
    const value = Object.hasOwn(row.value, column.key) ? Reflect.get(row.value, column.key) : undefined;
    const editable = !disabled && !column.desc.readonly;
    const active = editable && this.state.activeCell === `${row.id}:${column.key}`;
    let editor: React.ReactNode;
    if (active) {
      const type = column.desc.type === 'any' || !column.desc.type ? typeof value : column.desc.type;
      if (type === 'worker' && this.props.conn) {
        editor = (
          <TableWorkerEditor
            conn={this.props.conn}
            funcModule={this.props.funcModule}
            name={column.desc.name}
            desc={column.desc}
            funcDesc={this.props.funcDesc}
            value={value}
            onChange={(next) => this.changeCell(row.id, column.key, next)}
          />
        );
      } else if (type === 'number') {
        editor = (
          <InputNumber
            autoFocus
            size="small"
            value={typeof value === 'number' ? value : null}
            onChange={(next) => this.changeCell(row.id, column.key, next)}
            onBlur={() => this.setState({activeCell: undefined})}
          />
        );
      } else if (type === 'toggle' || type === 'boolean') {
        editor = (
          <Switch
            size="small"
            checked={Boolean(value)}
            onChange={(next) => this.changeCell(row.id, column.key, next)}
          />
        );
      } else {
        editor = (
          <Input.TextArea
            autoFocus
            size="small"
            autoSize={{minRows: 1, maxRows: 5}}
            value={value === undefined ? '' : typeof value === 'string' ? value : encodeDisplay(value)}
            onChange={(event) => this.changeCell(row.id, column.key, event.target.value)}
            onBlur={() => this.setState({activeCell: undefined})}
          />
        );
      }
    } else {
      editor = (
        <div
          className={`ticl-e-table-cell-display${editable ? ' ticl-e-table-cell-editable' : ''}`}
          onClick={editable ? () => this.setState({activeCell: `${row.id}:${column.key}`}) : undefined}
        >
          {renderValue(value)}
        </div>
      );
    }
    return <div className="ticl-e-property-value ticl-e-table-cell">{editor}</div>;
  }

  render() {
    const {value, desc, name, funcDesc} = this.props;
    const {open, rows, columns, format, loading, saving, error, newColumnName, newColumnType} = this.state;
    const changed = open && this.changedSource();
    const disabled = !this.editable() || loading || saving || Boolean(error) || changed;
    const tableColumns = columns.map((column, index) => ({
      key: `column-${index}`,
      title: (
        <div className="ticl-e-table-column-title">
          <span>{column.desc.name}</span>
          {!column.fixed && format !== 'legacy-array' && this.editable() ? (
            <Button
              size="small"
              title={translateEditor('Delete column')}
              icon={<DeleteOutlined />}
              disabled={disabled}
              onClick={() => this.deleteColumn(column)}
            />
          ) : null}
        </div>
      ),
      width: 180,
      render: (_: unknown, row: Row) => this.cell(row, column, disabled),
    }));
    if (!this.props.dockPanel) {
      return (
        <>
          <Button size="small" icon={<TableOutlined />} onClick={this.openTable} disabled={!this.context?.editTable}>
            {t(this.editable() ? 'Edit table' : 'View table')}{' '}
            {Array.isArray(value) && !isDataTruncated(value)
              ? `(${value.length})`
              : isObject(value) && Array.isArray(value.rows)
                ? `(${value.rows.length})`
                : null}
          </Button>
          {this.context?.editProperty && this.props.keys?.length ? (
            <div className="ticl-e-expand-button" title="Edit" onClick={this.popup}>
              <div className="ticl-e-expand-icon-11" />
            </div>
          ) : null}
        </>
      );
    }
    return (
      <DialogContext.Consumer>
        {({onClose}) => (
          <div
            className="ticl-e-table-editor ticl-e-dock-dialog"
            data-loaded={open && !loading}
            onKeyDown={(event) => event.stopPropagation()}
            onPaste={(event) => event.stopPropagation()}
          >
            <div className="ticl-e-table-body">
              {error || changed ? (
                <div className="ticl-e-error-message">{error || t('Value changed. Reload to continue.')}</div>
              ) : null}
              <div className="ticl-e-table-toolbar">
                {this.editable() ? (
                  <Button size="small" disabled={disabled} onClick={this.addRow}>
                    {t('Add row')}
                  </Button>
                ) : null}
                {format !== 'legacy-array' && (this.editable() || (format === 'object' && !desc.columns?.length)) ? (
                  <Popover
                    trigger="click"
                    content={
                      <div className="ticl-e-table-add-column">
                        {this.editable() ? (
                          <>
                            <Input
                              size="small"
                              placeholder={translateEditor('Column name')}
                              value={newColumnName}
                              disabled={disabled}
                              onChange={(event) => this.setState({newColumnName: event.target.value})}
                              onPressEnter={this.addColumn}
                            />
                            {format === 'matrix' ? (
                              <Select
                                size="small"
                                value={newColumnType}
                                disabled={disabled}
                                options={[
                                  {value: 'string', label: t('String')},
                                  {value: 'number', label: t('Number')},
                                  {value: 'toggle', label: t('Boolean')},
                                ]}
                                onChange={(type) => this.setState({newColumnType: type})}
                              />
                            ) : null}
                            <Button
                              size="small"
                              disabled={
                                disabled ||
                                !newColumnName.trim() ||
                                columns.some(
                                  (column) =>
                                    (format === 'object' ? column.key : column.desc.name) === newColumnName.trim()
                                )
                              }
                              onClick={this.addColumn}
                            >
                              {t('Add column')}
                            </Button>
                          </>
                        ) : null}
                        {format === 'object' && !desc.columns?.length ? (
                          <Button
                            size="small"
                            disabled={loading || Boolean(error) || changed}
                            onClick={this.scanAllColumns}
                          >
                            {t('Find all columns')}
                          </Button>
                        ) : null}
                      </div>
                    }
                  >
                    <Button size="small" disabled={loading || Boolean(error) || changed}>
                      {t(this.editable() ? 'Add column' : 'Columns')}
                    </Button>
                  </Popover>
                ) : null}
                <Button size="small" onClick={this.load} disabled={loading || saving}>
                  {t('Reload')}
                </Button>
              </div>
              {/* Cells edit a draft, not independently addressable Block properties. */}
              <TicloLayoutContextType.Provider value={{}}>
                <Table<Row>
                  size="small"
                  rowKey="id"
                  dataSource={rows}
                  loading={loading}
                  pagination={false}
                  scroll={{x: 'max-content', y: 400}}
                  columns={[
                    ...tableColumns,
                    ...(this.editable()
                      ? [
                          {
                            key: 'row-actions',
                            width: 150,
                            title: t('Actions'),
                            render: (_: unknown, row: Row, index: number) => (
                              <div className="ticl-e-table-actions">
                                <Button
                                  size="small"
                                  title={translateEditor('Move up')}
                                  icon={<ArrowUpOutlined />}
                                  disabled={disabled || index === 0}
                                  onClick={() => this.rowAction(row.id, 'up')}
                                />
                                <Button
                                  size="small"
                                  title={translateEditor('Move down')}
                                  icon={<ArrowDownOutlined />}
                                  disabled={disabled || index === rows.length - 1}
                                  onClick={() => this.rowAction(row.id, 'down')}
                                />
                                <Button
                                  size="small"
                                  title={translateEditor('Duplicate row')}
                                  icon={<CopyOutlined />}
                                  disabled={disabled}
                                  onClick={() => this.rowAction(row.id, 'copy')}
                                />
                                <Button
                                  size="small"
                                  title={translateEditor('Delete row')}
                                  icon={<DeleteOutlined />}
                                  disabled={disabled}
                                  onClick={() => this.rowAction(row.id, 'delete')}
                                />
                              </div>
                            ),
                          },
                        ]
                      : []),
                  ]}
                />
              </TicloLayoutContextType.Provider>
            </div>
            <div className="ticl-e-box-footer">
              <div className="ticl-e-spacer" />
              {this.editable() ? (
                <Button size="small" type="primary" disabled={disabled} onClick={() => void this.save(onClose)}>
                  {t('OK')}
                </Button>
              ) : null}
              <Button size="small" onClick={onClose}>
                {t(this.editable() ? 'Cancel' : 'Close')}
              </Button>
            </div>
          </div>
        )}
      </DialogContext.Consumer>
    );
  }
}
