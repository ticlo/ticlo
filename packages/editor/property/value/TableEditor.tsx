import React from 'react';
import {Button, Modal, Table} from 'antd';
import {ArrowDownOutlined, ArrowUpOutlined, CopyOutlined, DeleteOutlined, TableOutlined} from '@ant-design/icons';
import {deepEqual, isDataTruncated, translateEditor} from '@ticlo/core/editor.ts';
import type {PropDesc, TableColumnDesc} from '@ticlo/core';
import {deepClone} from '@ticlo/core/util/Clone.ts';
import {ValueEditorProps} from './ValueEditorBase.ts';
import {typeEditorMap} from './index.ts';
import {ReadonlyEditor} from './ReadonlyEditor.tsx';
import {TicloLayoutContextType, type TicloLayoutContext} from '../../component/LayoutContext.ts';
import {LocalizedPropertyName, t} from '../../component/LocalizedLabel.tsx';
import {TableWorkerEditor} from './TableWorkerEditor.tsx';

type RowValue = Record<string, unknown> | unknown[];
interface Row {
  id: number;
  value: RowValue;
}
interface State {
  open: boolean;
  rows: Row[];
  loading: boolean;
  error?: string;
}

// These editors operate on values without requiring a Block property path.
const cellEditors = new Set([
  'string',
  'number',
  'toggle',
  'select',
  'multi-select',
  'combo-box',
  'radio-button',
  'password',
  'color',
  'date',
  'date-range',
  'time',
  'any',
  'none',
]);

function isRow(value: unknown, rowType: PropDesc['rowType']): value is RowValue {
  if (rowType === 'array') return Array.isArray(value);
  return value != null && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

export class TableEditor extends React.PureComponent<ValueEditorProps, State> {
  static contextType = TicloLayoutContextType;
  declare context: TicloLayoutContext;

  state: State = {open: false, rows: [], loading: false};
  private nextId = 0;
  private requestId = 0;
  private source: {value: unknown; paths: string; desc: PropDesc};

  componentWillUnmount() {
    ++this.requestId;
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
    const {locked, onChange, desc} = this.props;
    return Boolean(onChange) && !locked && !desc.readonly;
  }

  popup = () => {
    const {desc, value} = this.props;
    this.context.editProperty(this.paths(), desc, value, 'object', !this.editable());
  };

  private schemaError() {
    const {rowType, columns} = this.props.desc;
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
    this.setState({open: true, loading: true, rows: [], error: undefined});
    try {
      if (this.schemaError()) throw new Error(translateEditor('Invalid table columns'));
      // Subscribed values can be truncated, even inside individual cells.
      const data = conn && paths.length ? (await conn.getValue(paths[0])).value : value;
      if (requestId !== this.requestId) return;
      if (
        data !== undefined &&
        (!Array.isArray(data) || isDataTruncated(data) || data.some((row) => !isRow(row, desc.rowType)))
      ) {
        throw new Error(translateEditor('Invalid table rows'));
      }
      this.setState({
        rows: (data ?? []).map((row: RowValue) => ({id: this.nextId++, value: deepClone(row)})),
        loading: false,
      });
    } catch (error) {
      if (requestId === this.requestId) this.setState({loading: false, error: String(error)});
    }
  };

  close = () => {
    ++this.requestId;
    this.setState({open: false, rows: []});
  };

  save = () => {
    if (!this.editable() || this.changedSource() || this.state.loading || this.state.error) return;
    this.props.onChange(
      this.state.rows.map((row) => row.value),
      this.props.name
    );
    this.close();
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
    const {rowType, columns} = this.props.desc;
    const value: RowValue =
      rowType === 'array' ? new Array(Math.max(...columns.map((column) => Number(column.key))) + 1) : {};
    for (const column of columns) {
      if (column.init !== undefined) {
        Object.defineProperty(value, column.key, {
          value: deepClone(column.init),
          enumerable: true,
          writable: true,
          configurable: true,
        });
      }
    }
    const row = {id: this.nextId++, value};
    this.setState(({rows}) => ({rows: [...rows, row]}));
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

  private cell(row: Row, column: TableColumnDesc, disabled: boolean) {
    const name = String(column.key);
    const desc: PropDesc = {...column, name, create: undefined};
    const Editor =
      column.type === 'worker' && this.props.conn
        ? TableWorkerEditor
        : cellEditors.has(column.type)
          ? typeEditorMap[column.type]
          : ReadonlyEditor;
    const value = Object.hasOwn(row.value, column.key) ? Reflect.get(row.value, column.key) : undefined;
    return (
      <div className="ticl-property-value ticl-table-cell">
        <Editor
          conn={this.props.conn}
          funcLib={this.props.funcLib}
          name={name}
          desc={desc}
          funcDesc={this.props.funcDesc}
          value={column.type === 'number' && value === null ? undefined : value}
          locked={disabled || column.readonly}
          onChange={
            disabled || column.readonly ? undefined : (value: unknown) => this.changeCell(row.id, column.key, value)
          }
        />
      </div>
    );
  }

  render() {
    const {value, desc, name, funcDesc} = this.props;
    const {open, rows, loading, error} = this.state;
    const changed = open && this.changedSource();
    const disabled = !this.editable() || loading || Boolean(error) || changed;
    const columns = (desc.columns ?? []).map((column, index) => ({
      key: `column-${index}`,
      title: column.title ?? String(column.key),
      width: 180,
      render: (_: unknown, row: Row) => this.cell(row, column, disabled),
    }));
    return (
      <>
        <Button size="small" icon={<TableOutlined />} onClick={this.load} disabled={!this.editable()}>
          {t('Edit table')} {Array.isArray(value) && !isDataTruncated(value) ? `(${value.length})` : null}
        </Button>
        {this.context?.editProperty && this.props.keys?.length ? (
          <div className="ticl-expand-button" title="Edit" onClick={this.popup}>
            <div className="ticl-expand-icon-11" />
          </div>
        ) : null}
        {open ? (
          <Modal
            title={<LocalizedPropertyName desc={funcDesc} name={name ?? desc.name} />}
            open
            width={900}
            onCancel={this.close}
            onOk={this.save}
            okText={t('OK')}
            cancelText={t('Cancel')}
            okButtonProps={{disabled}}
            className="ticl-table-editor"
          >
            <div onKeyDown={(event) => event.stopPropagation()} onPaste={(event) => event.stopPropagation()}>
              {error || changed ? (
                <div role="alert" className="ticl-error-message">
                  {error || t('Value changed. Reload to continue.')}
                </div>
              ) : null}
              <div className="ticl-table-toolbar">
                <Button size="small" disabled={disabled} onClick={this.addRow}>
                  {t('Add row')}
                </Button>
                <Button size="small" onClick={this.load} disabled={loading}>
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
                    ...columns,
                    {
                      key: 'row-actions',
                      width: 150,
                      title: t('Actions'),
                      render: (_, row, index) => (
                        <div className="ticl-table-actions">
                          <Button
                            size="small"
                            aria-label={translateEditor('Move up')}
                            icon={<ArrowUpOutlined />}
                            disabled={disabled || index === 0}
                            onClick={() => this.rowAction(row.id, 'up')}
                          />
                          <Button
                            size="small"
                            aria-label={translateEditor('Move down')}
                            icon={<ArrowDownOutlined />}
                            disabled={disabled || index === rows.length - 1}
                            onClick={() => this.rowAction(row.id, 'down')}
                          />
                          <Button
                            size="small"
                            aria-label={translateEditor('Duplicate row')}
                            icon={<CopyOutlined />}
                            disabled={disabled}
                            onClick={() => this.rowAction(row.id, 'copy')}
                          />
                          <Button
                            size="small"
                            aria-label={translateEditor('Delete row')}
                            icon={<DeleteOutlined />}
                            disabled={disabled}
                            onClick={() => this.rowAction(row.id, 'delete')}
                          />
                        </div>
                      ),
                    },
                  ]}
                />
              </TicloLayoutContextType.Provider>
            </div>
          </Modal>
        ) : null}
      </>
    );
  }
}
