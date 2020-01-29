import React from 'react';
import {Button, Input} from 'antd';
import SearchIcon from '@ant-design/icons/SearchOutlined';
import {MultiSelectComponent, MultiSelectLoader} from './MultiSelectComponent';
import {PropertyEditor} from './PropertyEditor';
import {ClientConn, ValueSubscriber} from '../../core/connect/ClientConn';
import {ValueUpdate} from '../../core/connect/ClientRequests';
import {ExpandIcon} from '../component/Tree';
const {Search} = Input;

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
    }
  });

  init() {
    this.defListener.subscribe(this.conn, `${this.path}.#optional`, true);
  }
  destroy() {
    this.defListener.unsubscribe();
  }
}

interface Props {
  baseId: string;
  conn: ClientConn;
  paths: string[];
}
interface State {
  search?: string;
}
export class OptionalPropertyList extends MultiSelectComponent<Props, State, OptionalPropertyLoader> {
  state: State = {};

  createLoader(path: string): OptionalPropertyLoader {
    return new OptionalPropertyLoader(path, this);
  }

  startSearch = () => {
    let {search} = this.state;
    if (search == null) {
      this.setState({search: ''});
    }
  };

  onSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({search: e.target.value});
  };

  renderImpl() {
    let {paths, conn, baseId} = this.props;
    let {search} = this.state;
    let baseFuncDesc = conn.watchDesc(baseId);
    if (this.loaders.size === 0 || !baseFuncDesc?.optional) {
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
      let optionalPropDesc = baseFuncDesc.optional[name];
      children.push(
        <PropertyEditor
          key={name}
          name={name}
          paths={paths}
          conn={conn}
          funcDesc={baseFuncDesc}
          propDesc={optionalPropDesc}
        />
      );
    }
    if (search && search.length > 1) {
      let lsearch = search.toLowerCase();
      let matchFirst: React.ReactElement[] = [];
      let matchMiddle: React.ReactElement[] = [];
      for (let name in baseFuncDesc.optional) {
        if (optionalProps.includes(name)) {
          continue;
        }
        let lowerKey = name.toLowerCase();
        if (lowerKey.includes(lsearch)) {
          let optionalPropDesc = baseFuncDesc.optional[name];
          let editor = (
            <PropertyEditor
              key={name}
              name={name}
              paths={paths}
              conn={conn}
              funcDesc={baseFuncDesc}
              propDesc={optionalPropDesc}
            />
          );
          if (lowerKey.startsWith(lsearch)) {
            matchFirst.push(editor);
          } else {
            matchMiddle.push(editor);
          }
        }
      }
      children = children.concat(matchFirst, matchMiddle);
    }

    return (
      <div className="ticl-property-optional-list">
        <div className="ticl-property-divider">
          <div className="ticl-h-line" style={{maxWidth: '16px'}} />
          <Button
            className="ticl-icon-btn"
            shape="circle"
            size="small"
            icon={<SearchIcon />}
            onClick={this.startSearch}
            style={{marginLeft: 8}}
          />
          {search == null ? (
            <>
              <span>optional</span>
              <div className="ticl-h-line" />
            </>
          ) : (
            <Input size="small" autoFocus={true} placeholder="optional" onChange={this.onSearchChange} />
          )}
        </div>
        {children}
      </div>
    );
  }
}
