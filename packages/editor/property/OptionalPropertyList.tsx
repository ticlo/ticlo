import React from 'react';
import {Button, Input, Tooltip} from 'antd';
import {CloseCircleFilled, SearchOutlined} from '@ant-design/icons';

import {MultiSelectComponent, MultiSelectLoader} from './MultiSelectComponent.tsx';
import {ClientConn, ValueSubscriber} from '@ticlo/core/connect/ClientConn.ts';
import {ValueUpdate} from '@ticlo/core/connect/ClientRequests.ts';
import {OptionalPropertyEditor} from './OptionalPropertyEditor.tsx';
import {FunctionDesc, PropDesc} from '@ticlo/core';
import {TicloI18NConsumer} from '../component/LayoutContext.ts';
import {translateEditor} from '@ticlo/core/util/i18n.ts';
import {t} from '../component/LocalizedLabel.tsx';
import {EditPolicyContext} from '../component/EditPolicyContext.tsx';
import {OptionalPropertyHistory} from './OptionalPropertyHistory.ts';

class OptionalPropertyLoader extends MultiSelectLoader<OptionalPropertyList> {
  optionalProps: string[];
  defListener = new ValueSubscriber({
    onUpdate: (response: ValueUpdate) => {
      let value = response.cache.value;
      if (!Array.isArray(value)) {
        // since initial value is undefined, this makes sure there is one update
        value = null;
      }
      if (value !== this.optionalProps) {
        this.optionalProps = value;
        this.parent.forceUpdate();
      }
    },
  });

  init() {
    this.defListener.subscribe(this.conn, `${this.path}.#optional`, true);
  }

  destroy() {
    this.defListener.unsubscribe();
  }
}

interface Props {
  funcDesc: FunctionDesc;
  conn: ClientConn;
  paths: string[];
  funcLib?: string;
}

interface State {
  search?: string;
}

export class OptionalPropertyList extends MultiSelectComponent<Props, State, OptionalPropertyLoader> {
  static contextType = EditPolicyContext;
  declare context: React.ContextType<typeof EditPolicyContext>;
  state: State = {};

  cachedProperties: {[key: string]: PropDesc};
  checkedFuncDesc: FunctionDesc;
  checkedFuncLib: string;
  history: OptionalPropertyHistory;

  getProperties(): {[key: string]: PropDesc} {
    const {funcDesc, conn, funcLib} = this.props;
    if (funcDesc !== this.checkedFuncDesc || funcLib !== this.checkedFuncLib) {
      this.checkedFuncDesc = funcDesc;
      this.checkedFuncLib = funcLib;
      if (funcDesc) {
        this.cachedProperties = conn.getOptionalProps(funcDesc, funcLib);
        this.history = new OptionalPropertyHistory(funcDesc, this.cachedProperties || {}, funcLib);
      } else {
        this.cachedProperties = null;
      }
    }
    return this.cachedProperties;
  }

  createLoader(path: string): OptionalPropertyLoader {
    return new OptionalPropertyLoader(path, this);
  }

  startSearch = () => {
    const {search} = this.state;
    if (search == null) {
      this.setState({search: ''});
    }
  };
  clearSearch = () => {
    this.setState({search: null});
  };
  onSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({search: e.target.value});
  };

  getSearchMatches(search: string): string[] {
    const properties = this.getProperties();
    if (!search) return this.history?.getSuggestions() ?? [];
    const lsearch = search.toLowerCase();
    return Object.keys(properties || {})
      .filter((name) => name.toLowerCase().includes(lsearch))
      .sort(
        (a, b) =>
          Number(b.toLowerCase().startsWith(lsearch)) - Number(a.toLowerCase().startsWith(lsearch)) ||
          a.localeCompare(b)
      );
  }

  onPropertyChecked = (name: string, checked: boolean) => {
    const {conn, paths} = this.props;
    if (!paths.every((path) => this.context.can({cmd: checked ? 'addOptionalProp' : 'removeOptionalProp', path, name})))
      return;
    if (checked) {
      if ([...this.loaders.values()].some((loader) => !loader.optionalProps?.includes(name))) {
        this.getProperties();
        this.history.record(name);
      }
      for (const path of paths) {
        conn.addOptionalProp(path, name);
      }
    } else {
      for (const path of paths) {
        conn.removeOptionalProp(path, name);
      }
    }
  };

  onSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      this.clearSearch();
    } else if (e.key === 'Enter') {
      const {search} = this.state;
      if (!search) return;
      let name = Object.keys(this.getProperties() || {}).find((name) => name.toLowerCase() === search.toLowerCase());
      if (!name) {
        const matches = this.getSearchMatches(search);
        if (matches.length === 1) name = matches[0];
      }
      if (name) {
        this.onPropertyChecked(name, true);
        this.setState({search: ''});
      }
    }
  };

  renderImpl() {
    const {paths, conn, funcDesc, funcLib} = this.props;
    const {search} = this.state;
    const properties = this.getProperties();
    if (this.loaders.size === 0 || !properties) {
      return <div />;
    }

    const children: React.ReactNode[] = [];

    let optionalProps: string[];
    for (const [path, loader] of this.loaders) {
      if (!loader.optionalProps) {
        optionalProps = [];
        break;
      }
      if (!optionalProps) {
        optionalProps = loader.optionalProps;
      } else {
        optionalProps = optionalProps.filter((field) => loader.optionalProps.includes(field));
      }
    }

    const addProperty = (name: string, checked: boolean) => {
      children.push(
        <OptionalPropertyEditor
          key={`property:${name}`}
          name={name}
          paths={paths}
          conn={conn}
          funcDesc={funcDesc}
          propDesc={properties[name]}
          checked={checked}
          onCheck={this.onPropertyChecked}
          funcLib={funcLib}
        />
      );
    };
    let matchingEnabled: string[] = [];
    if (search != null) {
      const matches = this.getSearchMatches(search);
      matchingEnabled = optionalProps.filter((name) => matches.includes(name));
      for (const name of matchingEnabled) addProperty(name, true);
      const available = matches.filter((name) => !optionalProps.includes(name));
      for (const name of available.slice(0, 10)) addProperty(name, false);
      if (available.length > 10) {
        children.push(
          <div key="more" style={{marginLeft: 32}}>
            . . . more . . .
          </div>
        );
      }
    }
    for (const name of optionalProps) {
      if (!matchingEnabled.includes(name)) addProperty(name, true);
    }

    return (
      <div className="ticl-e-property-optional-list">
        <div className="ticl-e-property-divider">
          <div className="ticl-e-h-line" style={{maxWidth: '16px'}} />
          <Tooltip title="Search Optional Properties">
            <Button
              className="ticl-e-icon-btn"
              shape="circle"
              size="small"
              icon={<SearchOutlined />}
              onClick={this.startSearch}
            />
          </Tooltip>
          {search == null ? (
            <>
              <span onClick={this.startSearch}>{t('Optional')}</span>
              <div className="ticl-e-h-line" />
            </>
          ) : (
            <>
              <TicloI18NConsumer>
                {() => (
                  <Input
                    size="small"
                    value={search}
                    autoFocus={true}
                    placeholder={translateEditor('Optional')}
                    onChange={this.onSearchChange}
                    onKeyDown={this.onSearchKeyDown}
                  />
                )}
              </TicloI18NConsumer>
              <CloseCircleFilled onClick={this.clearSearch} />
            </>
          )}
        </div>
        {children}
      </div>
    );
  }
}
