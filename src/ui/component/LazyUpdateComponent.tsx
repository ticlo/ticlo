import React from 'react';
import {ClientConn, ValueState, ValueUpdate} from '../../core/client';
import {DataMap} from '../../core/util/Types';
import {shallowEqual} from '../../core/util/Compare';

interface LazyUpdateProps {
  conn: ClientConn;
}

export abstract class LazyUpdateComponent<P extends LazyUpdateProps, S> extends React.Component<P, S> {
  _rendering = false;
  _mounted = false;

  render(): React.ReactNode {
    this._rendering = true;
    let result = this.renderImpl();
    this._rendering = false;
    this._mounted = true;
    return result;
  }

  shouldComponentUpdate(nextProps: Readonly<P>, nextState: Readonly<S>): boolean {
    return !shallowEqual(this.props, nextProps) || !shallowEqual(this.state, nextState);
  }

  abstract renderImpl(): React.ReactNode;

  forceUpdate() {
    this.props.conn.callImmediate(this.safeForceUpdate);
  }

  safeForceUpdate = () => {
    if (this._mounted && !this._rendering) {
      super.forceUpdate();
    }
  };

  componentWillUnmount() {
    this._mounted = false;
  }
}

export class LazyUpdateListener {
  parent: {forceUpdate: Function};

  value: any;
  bindingPath: string;
  defaultValue: any;

  error: string;

  constructor(parent: {forceUpdate: Function}, defaultValue?: any) {
    this.value = defaultValue;
    this.parent = parent;
    this.defaultValue = defaultValue;
  }

  onUpdate(response: ValueUpdate) {
    this.error = null;
    let newValue = response.cache.value;
    if (newValue === undefined) {
      newValue = this.defaultValue;
    }
    if (!Object.is(newValue, this.value)) {
      this.value = newValue;
      this.parent.forceUpdate();
    }
    if (response.cache.bindingPath !== this.bindingPath) {
      this.bindingPath = response.cache.bindingPath;
      this.parent.forceUpdate();
    }
  }

  onError(error: string, data?: DataMap) {
    this.error = error;
    this.parent.forceUpdate();
  }
}
