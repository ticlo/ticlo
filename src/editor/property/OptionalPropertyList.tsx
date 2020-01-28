import React from 'react';
import {MultiSelectComponent, MultiSelectLoader} from './MultiSelectComponent';
import {PropertyEditor} from './PropertyEditor';
import {ClientConn, ValueSubscriber} from '../../core/connect/ClientConn';
import {ValueUpdate} from '../../core/connect/ClientRequests';
import {FunctionDesc, PropDesc} from '../../core';
import {Simulate} from 'react-dom/test-utils';
import load = Simulate.load;

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
  createLoader(path: string): OptionalPropertyLoader {
    return new OptionalPropertyLoader(path, this);
  }

  renderImpl() {
    let {paths, conn, baseId} = this.props;

    let baseFuncDesc = conn.watchDesc(baseId);
    if (!baseFuncDesc?.optional) {
      return <div />;
    }

    let children: React.ReactElement[] = [];

    let optionalProps: string[];
    for (let [path, loader] of this.loaders) {
      if (!loader.optionalProps) {
        optionalProps = null;
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
    return <div>{children}</div>;
  }
}
