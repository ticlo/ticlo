import React from 'react';
import {Button, Input, Tooltip} from 'antd';
import {CloseCircleFilled, SearchOutlined} from '@ant-design/icons';

import {MultiSelectComponent, MultiSelectLoader} from './MultiSelectComponent.js';
import {ClientConn, ValueSubscriber} from '@ticlo/core/connect/ClientConn.js';
import {ValueUpdate} from '@ticlo/core/connect/ClientRequests.js';
import {OptionalPropertyEditor} from './OptionalPropertyEditor.js';
import {FunctionDesc, PropDesc} from '@ticlo/core';
import {TicloI18NConsumer} from '../component/LayoutContext.js';
import {translateEditor} from '@ticlo/core/util/i18n.js';
import {t} from '../component/LocalizedLabel.js';

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
}

interface State {
  search?: string;
}

export class OptionalPropertyList extends MultiSelectComponent<Props, State, OptionalPropertyLoader> {
  state: State = {};

  cachedProperties: {[key: string]: PropDesc};
  checkedFuncDesc: FunctionDesc;

  getProperties(): {[key: string]: PropDesc} {
    const {funcDesc, conn} = this.props;
    if (funcDesc !== this.checkedFuncDesc) {
      if (funcDesc) {
        this.cachedProperties = conn.getOptionalProps(funcDesc);
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

  onPropertyChecked = (name: string, checked: boolean) => {
    const {conn, paths} = this.props;
    if (checked) {
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
      if (this.getProperties()?.[search]) {
        this.onPropertyChecked(search, true);
        this.setState({search: ''});
      }
    }
  };

  renderImpl() {
    const {paths, conn, funcDesc} = this.props;
    const {search} = this.state;
    const properties = this.getProperties();
    if (this.loaders.size === 0 || !properties) {
      return <div />;
    }

    let children: React.ReactElement[] = [];

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

    for (const name of optionalProps) {
      const optionalPropDesc = properties[name];
      children.push(
        <OptionalPropertyEditor
          key={name}
          name={name}
          paths={paths}
          conn={conn}
          funcDesc={funcDesc}
          propDesc={optionalPropDesc}
          checked={true}
          onCheck={this.onPropertyChecked}
        />
      );
    }
    let showMore: React.ReactNode;
    if (search) {
      const lsearch = search.toLowerCase();
      const matchFirst: React.ReactElement[] = [];
      const matchMiddle: React.ReactElement[] = [];
      for (const name in properties) {
        if (optionalProps.includes(name)) {
          continue;
        }
        const lowerKey = name.toLowerCase();
        if (lowerKey.includes(lsearch)) {
          const optionalPropDesc = properties[name];
          const editor = (
            <OptionalPropertyEditor
              key={name}
              name={name}
              paths={paths}
              conn={conn}
              funcDesc={funcDesc}
              propDesc={optionalPropDesc}
              checked={false}
              onCheck={this.onPropertyChecked}
            />
          );
          if (lowerKey.startsWith(lsearch)) {
            if (lsearch === lowerKey) {
              matchFirst.unshift(editor);
            } else {
              matchFirst.push(editor);
            }
          } else {
            matchMiddle.push(editor);
          }
        }
      }
      matchFirst.push(...matchMiddle);
      if (matchFirst.length > 10) {
        matchFirst.length = 10;
        showMore = <div style={{marginLeft: 32}}>. . . more . . .</div>;
      }
      children = children.concat(matchFirst);
    }

    return (
      <div className="ticl-property-optional-list">
        <div className="ticl-property-divider">
          <div className="ticl-h-line" style={{maxWidth: '16px'}} />
          <Tooltip title="Search Optional Properties">
            <Button
              className="ticl-icon-btn"
              shape="circle"
              size="small"
              icon={<SearchOutlined />}
              onClick={this.startSearch}
            />
          </Tooltip>
          {search == null ? (
            <>
              <span onClick={this.startSearch}>{t('Optional')}</span>
              <div className="ticl-h-line" />
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
        {showMore}
      </div>
    );
  }
}
