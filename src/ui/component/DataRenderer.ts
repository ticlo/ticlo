import React from "react";
import {DataMap} from "../../common/util/Types";

export class DataRendererItem<T = any> {
  _renderers: Set<PureDataRenderer<any, any> & T> = new Set<PureDataRenderer<any, any> & T>();

  attachedRenderer(renderer: PureDataRenderer<any, any> & T) {
    if (this._renderers.size === 0) {
      this._renderers.add(renderer);
      this.onAttached();
    } else {
      this._renderers.add(renderer);
    }
  }

  detachRenderer(renderer: PureDataRenderer<any, any> & T) {
    this._renderers.delete(renderer);
    if (this._renderers.size === 0) {
      this.onDetached();
    }
  }

  onAttached() {
    // to be overridden
  }

  onDetached() {
    // to be overridden
  }

  forceUpdate() {
    for (let renderer of this._renderers) {
      renderer.forceUpdate();
    }
  }
}

export interface DataRendererProps<T extends DataRendererItem> {
  item: T;
}

export class PureDataRenderer<P extends DataRendererProps<any>, S> extends React.PureComponent<P, S> {
  constructor(props: P) {
    super(props);
    this.props.item.attachedRenderer(this);
  }

  componentDidUpdate(prevProps: P) {
    if (prevProps.item !== this.props.item) {
      this.props.item.attachedRenderer(this);
      prevProps.item.detachRenderer(this);
    }
  }

  componentWillUnmount() {
    this.props.item.detachRenderer(this);
  }
}
