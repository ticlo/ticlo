import * as React from "react";

export class DataRendererItem {
  _renderers: Set<PureDataRenderer<any, any>> = new Set<PureDataRenderer<any, any>>();

  attachedRenderer(renderer: PureDataRenderer<any, any>) {
    this._renderers.add(renderer);
  }

  detachRenderer(renderer: PureDataRenderer<any, any>) {
    this._renderers.delete(renderer);
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
