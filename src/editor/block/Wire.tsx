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

// fix number format in svg
function f(n: number): string {
  if (Math.floor(n) === n) {
    return n.toFixed(0);
  } else {
    return n.toFixed(2);
  }
}

export class WireView extends PureDataRenderer<WireViewProps, WireViewState> {
  render() {
    let {source, target} = this.props.item;
    let x0 = source.x + source.w + 4;
    let y0 = source.y;
    let x1 = target.x;
    let y1 = target.y;
    let midx = (x0 + x1) * 0.5;
    let mx0: number;
    let mx1: number;

    let minx = Math.min(x0, x1) - wirePadding;
    let maxx = Math.max(x0, x1) + wirePadding;
    let miny = Math.min(y0, y1) - wirePadding;
    let maxy = Math.max(y0, y1) + wirePadding;

    let xgap = 50;
    let dy = Math.abs(y1 - y0) / 2;
    if (xgap > dy) {
      xgap = dy;
    }
    if (x1 > x0 + xgap * 2) {
      mx0 = x0 * 0.6 + x1 * 0.4;
      mx1 = x0 * 0.4 + x1 * 0.6;
    } else if (x1 > x0) {
      // make a smooth transition between the 2 algorithms;
      let r = (x1 - x0) * 0.5 / xgap;
      let offx = xgap + (x0 - x1) * 0.0625;
      mx0 = (x0 * 0.6 + x1 * 0.4) * r + (x0 + offx) * (1 - r);
      mx1 = (x0 * 0.4 + x1 * 0.6) * r + (x1 - offx) * (1 - r);
      minx -= 25;
      maxx += 25;
    } else {
      let offx = xgap + (x0 - x1) * 0.0625;
      mx0 = x0 + offx;
      mx1 = x1 - offx;
      minx -= 25;
      maxx += 25;
    }

    x0 -= minx;
    x1 -= minx;
    midx -= minx;
    mx0 -= minx;
    mx1 -= minx;
    y0 -= miny;
    y1 -= miny;

    return (
      <svg width={maxx - minx} height={maxy - miny} className="ticl-block-wire" xmlns="http://www.w3.org/2000/svg"
           style={{left: minx, top: miny}}>
        <path
          d={`M ${f(x0)} ${f(y0)} Q ${f(mx0)} ${f(y0)} ${f(midx)} ${f((y0 + y1) * 0.5)} ${f(mx1)} ${f(y1)} ${f(x1)} ${f(y1)}`}/>
      </svg>
    );
  }
}
