import React from 'react';
import {ClientConn, ValueState, ValueUpdate, DataMap, shallowEqual} from '../../../src/core/editor';

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
    return result;
  }

  componentDidMount(): void {
    this._mounted = true;
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
  parent: {forceUpdate: Function} | Function;

  value: any;
  bindingPath: string;
  defaultValue: any;

  error: string;

  constructor(parent: {forceUpdate: Function} | Function, defaultValue?: any) {
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
      this.update();
    }
    if (response.cache.bindingPath !== this.bindingPath) {
      this.bindingPath = response.cache.bindingPath;
      this.update();
    }
  }

  onError(error: string, data?: DataMap) {
    this.error = error;
    this.update();
  }
  update() {
    if (typeof this.parent === 'function') {
      this.parent(this.value);
    } else {
      this.parent.forceUpdate();
    }
  }
}

export class LazyUpdateSubscriber extends LazyUpdateListener {
  conn: ClientConn;
  path: string;
  subscribe(conn: ClientConn, path: string, fullValue = true) {
    if (this.conn === conn && this.path === path) {
      return;
    }
    if (this.conn && this.path) {
      this.conn.unsubscribe(path, this);
    }
    this.conn = conn;
    this.path = path;
    if (this.conn && this.path) {
      this.conn.subscribe(this.path, this, fullValue);
    }
  }

  unsubscribe() {
    if (this.conn && this.path) {
      this.conn.unsubscribe(this.path, this);
      this.conn = null;
      this.path = null;
    }
  }
}
