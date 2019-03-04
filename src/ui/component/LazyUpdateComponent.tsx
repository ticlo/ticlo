import React from "react";
import {ClientConnection, ValueUpdate} from "../../common";
import {DataMap} from "../../common/util/Types";

interface LazyUpdateProps {
  conn: ClientConnection;
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

  error: string;

  constructor(parent: {forceUpdate: Function}) {
    this.parent = parent;
  }

  onUpdate(response: ValueUpdate) {
    this.error = null;
    console.log(response);
    if (!Object.is(response.cache.value, this.value)) {
      this.value = response.cache.value;
      this.parent.forceUpdate();
    }
  }

  onError(error: string, data?: DataMap) {
    console.log(error);
    this.error = error;
    this.parent.forceUpdate();
  }

}

