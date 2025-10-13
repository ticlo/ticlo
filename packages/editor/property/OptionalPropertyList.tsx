import React from 'react';
import {Input, Tooltip} from 'antd';
import {Button, Icon} from '@blueprintjs/core';
import {MultiSelectComponent, MultiSelectLoader} from './MultiSelectComponent';
import {ClientConn, ValueSubscriber} from '@ticlo/core/connect/ClientConn';
import {ValueUpdate} from '@ticlo/core/connect/ClientRequests';
import {OptionalPropertyEditor} from './OptionalPropertyEditor';
import {FunctionDesc, PropDesc} from '@ticlo/core';
import {TicloI18NConsumer} from '../component/LayoutContext';
import {translateEditor} from '@ticlo/core/util/i18n';
import {t} from '../component/LocalizedLabel';

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
    let {funcDesc, conn} = this.props;
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
    let {search} = this.state;
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
    let {conn, paths} = this.props;
    if (checked) {
      for (let path of paths) {
        conn.addOptionalProp(path, name);
      }
    } else {
      for (let path of paths) {
        conn.removeOptionalProp(path, name);
      }
    }
  };

  onSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      this.clearSearch();
    } else if (e.key === 'Enter') {
      let {search} = this.state;
      if (this.getProperties()?.[search]) {
        this.onPropertyChecked(search, true);
        this.setState({search: ''});
      }
    }
  };

  renderImpl() {
    let {paths, conn, funcDesc} = this.props;
    let {search} = this.state;
    let properties = this.getProperties();
    if (this.loaders.size === 0 || !properties) {
      return <div />;
    }

    let children: React.ReactElement[] = [];

    let optionalProps: string[];
    for (let [path, loader] of this.loaders) {
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

    for (let name of optionalProps) {
      let optionalPropDesc = properties[name];
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
      let lsearch = search.toLowerCase();
      let matchFirst: React.ReactElement[] = [];
      let matchMiddle: React.ReactElement[] = [];
      for (let name in properties) {
        if (optionalProps.includes(name)) {
          continue;
        }
        let lowerKey = name.toLowerCase();
        if (lowerKey.includes(lsearch)) {
          let optionalPropDesc = properties[name];
          let editor = (
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
              variant="minimal"
              size="small"
              icon="search"
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
              <Icon icon="cross-circle" onClick={this.clearSearch} />
            </>
          )}
        </div>
        {children}
        {showMore}
      </div>
    );
  }
}
