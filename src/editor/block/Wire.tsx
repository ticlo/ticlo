import React from "react";
import {DataRendererItem, PureDataRenderer} from "../../ui/component/DataRenderer";
import {FieldItem} from "./Block";

export class WireItem extends DataRendererItem {
  source: FieldItem;
  target: FieldItem;

  setSource(source: FieldItem) {
    if (source !== this.source) {
      if (this.source) {
        this.source.outWires.delete(this);
      }
      this.source = source;
      if (source) {
        source.outWires.add(this);
        this.forceUpdate();
      }
    }
  }

  constructor(souce: FieldItem, target: FieldItem) {
    super();
    this.target = target;
    this.source = souce;
    this.source.outWires.add(this);
  }
}

interface WireViewProps {
  item: WireItem;
}

interface WireViewState {
}


const wirePadding = 2;

export class WireView extends PureDataRenderer<WireViewProps, WireViewState> {
  render() {
    let {source, target} = this.props.item;
    let x0 = source.x + source.w;
    let y0 = source.y;
    let x1 = target.x;
    let y1 = target.y;
    let wireSpread = Math.abs(y1 - y0) / 2;
    if (wireSpread > 30) {
      wireSpread = 30;
    }
    if (wireSpread < 5) {
      wireSpread = 5;
    }
    let minx = Math.min(x0, x1 - wireSpread) - wirePadding;
    let maxx = Math.max(x0 + wireSpread, x1) + wirePadding;
    let miny = Math.min(y0, y1) - wireSpread;
    let maxy = Math.max(y0, y1) + wireSpread;
    x0 -= minx;
    x1 -= minx;
    y0 -= miny;
    y1 -= miny;

    return (
      <svg width={maxx - minx} height={maxy - miny} className="ticl-block-wire" xmlns="http://www.w3.org/2000/svg"
           style={{left: minx, top: miny}}>
        <path d={`M ${x0} ${y0} C ${x0 + wireSpread} ${y0} ${x1 - wireSpread} ${y1} ${x1} ${y1}`}/>
      </svg>
    );
  }
}
