import React from 'react';
import {Button, Select} from 'antd';
import {EllipsisOutlined, PlusOutlined} from '@ant-design/icons';
import {
  arrayEqual,
  ClientConn,
  type ContextBlockScope,
  FunctionDesc,
  getDefaultFuncData,
  getFuncDefaultName,
  getSubBlockFuncData,
  PropDesc,
  splitPathName,
} from '@ticlo/core/editor.ts';
import {Popup} from '../../component/ClickPopup.tsx';
import {PropertyList} from '../PropertyList.tsx';
import {EditPolicyContext} from '../../component/EditPolicyContext.tsx';
import {t} from '../../component/LocalizedLabel.tsx';
import {requestCallbacks} from '../../util/RequestCallbacks.ts';

function sameTags(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  return Array.isArray(a) && Array.isArray(b) && arrayEqual(a, b);
}

function sameContextScopes(a: ContextBlockScope[], b: ContextBlockScope[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; ++i) {
    if (a[i].path !== b[i].path || a[i].scope !== b[i].scope || !arrayEqual(a[i].blocks, b[i].blocks)) {
      return false;
    }
  }
  return true;
}

function getScopeLabel(scope: ContextBlockScope): React.ReactNode {
  switch (scope.scope) {
    case 'global':
      return t('#global');
    case 'context':
      return '#context';
    case 'flow':
      return splitPathName(scope.path)[1] || scope.path;
  }
}

export interface Props {
  conn?: ClientConn;
  keys: string[];
  value: any;
  bindingPath: string;
  funcDesc: FunctionDesc;
  desc: PropDesc;
  locked?: boolean;
  onPathChange?: (path: string) => void;
  funcModule?: string;
}

interface State {
  opened?: boolean;
  scopes: ContextBlockScope[];
}

export class ServiceEditor extends React.PureComponent<Props, State> {
  static contextType = EditPolicyContext;
  declare context: React.ContextType<typeof EditPolicyContext>;
  state: State = {scopes: []};
  private _mounted = false;
  private _dropdownOpen = false;
  private _requestSeq = 0;

  componentDidMount() {
    this._mounted = true;
  }

  componentWillUnmount() {
    this._mounted = false;
    ++this._requestSeq;
  }

  componentDidUpdate(prevProps: Props) {
    if (
      prevProps.conn !== this.props.conn ||
      prevProps.keys?.[0] !== this.props.keys?.[0] ||
      !sameTags(prevProps.desc?.options, this.props.desc?.options)
    ) {
      ++this._requestSeq;
      if (this._dropdownOpen) {
        this.loadContextBlocks();
      } else if (this.state.scopes.length) {
        this.setState({scopes: []});
      }
    }
  }

  loadContextBlocks = () => {
    const {conn, desc, keys} = this.props;
    const tags = desc?.options;
    if (!conn || !Array.isArray(tags) || tags.length === 0) {
      if (this.state.scopes.length) this.setState({scopes: []});
      return;
    }
    const path = keys?.[0] ?? '';
    const requestSeq = ++this._requestSeq;
    void conn.findContextBlocks(path, tags as string[]).then(
      (response) => {
        if (!this._mounted || requestSeq !== this._requestSeq) return;
        const scopes = response?.scopes ?? [];
        if (!sameContextScopes(this.state.scopes, scopes)) {
          this.setState({scopes});
        }
      },
      () => {
        if (this._mounted && requestSeq === this._requestSeq && this.state.scopes.length) {
          this.setState({scopes: []});
        }
      }
    );
  };

  onOpenChange = (open: boolean) => {
    this._dropdownOpen = open;
    if (open) {
      this.loadContextBlocks();
    }
  };

  onBlockSelect = (value: string) => {
    if (!this.props.locked) this.props.onPathChange?.(value == null ? undefined : `${value}.#output`);
  };

  canCreate() {
    const {conn, desc, onPathChange, locked} = this.props;
    if (!onPathChange || locked || typeof desc.create !== 'string' || !desc.create) return false;
    const funcDesc = conn.watchDesc(desc.create);
    return (
      funcDesc &&
      this.context.can({
        cmd: 'addBlock',
        path: `#global.^${getFuncDefaultName(funcDesc)}`,
        data: getSubBlockFuncData(getDefaultFuncData(funcDesc)),
      })
    );
  }

  onCreate = async () => {
    if (!this.canCreate()) return;
    const {conn, desc, keys, onPathChange} = this.props;
    const {create} = desc;
    if (typeof create !== 'string') return;
    const funcDesc = conn.watchDesc(create);
    if (funcDesc) {
      try {
        const createdBlock = await conn.addBlock(
          `#global.^${getFuncDefaultName(funcDesc)}`,
          getSubBlockFuncData(getDefaultFuncData(funcDesc))
        );
        if (createdBlock?.name && keys === this.props.keys && !this.props.locked) {
          onPathChange?.(`${createdBlock.name}.#output`);
          this.openPopup();
        }
      } catch (error) {
        requestCallbacks.onError(String(error));
      }
    }
  };

  getPopup = () => {
    const {bindingPath, conn, keys, funcModule} = this.props;
    if (!this.state.opened || !bindingPath) {
      // work around of the pop caching issue
      return <div />;
    }
    const bindingParentPath = bindingPath.substring(0, bindingPath.lastIndexOf('.'));
    const sourceKeys: string[] = keys.map((key) => `${key}.${bindingParentPath}`);
    return (
      <PropertyList
        conn={conn}
        paths={sourceKeys}
        mode="minimal"
        funcModule={funcModule}
        style={{width: 300, minHeight: 160, padding: 16}}
      />
    );
  };

  openPopup = () => {
    this.setState({opened: true});
  };
  onPopupClose = (visible?: boolean) => {
    if (!visible) {
      this.setState({opened: false});
    }
  };

  render() {
    const {bindingPath, desc, locked, onPathChange} = this.props;
    const {opened, scopes} = this.state;
    const {create} = desc;

    const options = scopes.map((scope, index) => ({
      key: scope.path,
      label: getScopeLabel(scope),
      title: scope.path,
      className: index > 0 ? 'ticl-e-service-scope-divider' : undefined,
      options: scope.blocks.map((name) => ({label: name, value: name})),
    }));

    let selectValue = bindingPath;
    if (typeof selectValue === 'string' && selectValue.endsWith('.#output')) {
      selectValue = selectValue.substring(0, selectValue.length - 8);
    }
    let button: React.ReactElement;
    if (bindingPath) {
      button = (
        <Popup popupVisible={opened} onPopupVisibleChange={this.onPopupClose} popup={this.getPopup}>
          <Button
            className="ticl-e-square-icon-btn"
            size="small"
            icon={<EllipsisOutlined />}
            onClick={this.openPopup}
          />
        </Popup>
      );
    } else if (!locked && typeof create === 'string' && create) {
      button = (
        <Button
          className="ticl-e-square-icon-btn"
          size="small"
          icon={<PlusOutlined />}
          onClick={this.onCreate}
          disabled={!this.canCreate()}
        />
      );
    }

    return (
      <div className="ticl-e-hbox ticl-e-service-editor">
        <Select
          size="small"
          value={selectValue ?? undefined}
          placeholder={desc.placeholder ? t(desc.placeholder) : undefined}
          allowClear={Boolean(bindingPath && onPathChange && !locked)}
          disabled={locked || onPathChange == null}
          options={options}
          onOpenChange={this.onOpenChange}
          onChange={this.onBlockSelect}
        />
        {button}
      </div>
    );
  }
}
