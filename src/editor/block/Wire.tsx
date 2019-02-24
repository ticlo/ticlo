import React from "react";
import {DataRendererItem, PureDataRenderer} from "../../ui/component/DataRenderer";
import {FieldItem} from "./Field";
import {cssNumber} from "../../ui/util/Types";

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
      }
    }
    // it's possible a indirect binding change to direct binding while source remains the same
    // forceUpdate even if source is not changed
    this.forceUpdate();
  }

  constructor(souce: FieldItem, target: FieldItem) {
    super();
    this.target = target;
    this.source = souce;
    this.source.outWires.add(this);
  }

  destroy() {
    if (this.source) {
      this.source.outWires.delete(this);
      this.source = null;
    }
  }

  getConn() {
    return this.target.getConn();
  }
}

interface WireViewProps {
  item: WireItem;
}

const wirePadding = 2;

export class WireView extends PureDataRenderer<WireViewProps, any> {
  renderImpl() {
    let {source, target} = this.props.item;
    let x0 = source.x + source.w + 4;
    let y0 = source.y;
    let x1 = target.x - 4;
    let y1 = target.y;
    let midx = (x0 + x1) * 0.5;
    let mx0: number;
    let mx1: number;

    let minx = Math.min(x0, x1) - wirePadding;
    let maxx = Math.max(x0, x1) + wirePadding;
    let miny = Math.min(y0, y1) - wirePadding;
    let maxy = Math.max(y0, y1) + wirePadding;

    let xgap = 50;
    let dy = Math.max(x0 - x1, Math.abs(y1 - y0)) / 2;
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

    let selected = source.block.selected || target.block.selected;

    let className = 'ticl-block-wire';
    if (target._bindingTargetKey !== source.key) {
      className = 'ticl-block-wire ticl-wire-dash';
    }

    return (
      <svg width={maxx - minx} height={maxy - miny} className={className} xmlns="http://www.w3.org/2000/svg"
           style={{left: minx, top: miny, zIndex: selected ? 100 : undefined}}>
        <path
          d={`M ${cssNumber(x0)} ${cssNumber(y0)} Q ${cssNumber(mx0)} ${cssNumber(y0)} ${cssNumber(midx)} ${cssNumber((y0 + y1) * 0.5)} ${cssNumber(mx1)} ${cssNumber(y1)} ${cssNumber(x1)} ${cssNumber(y1)}`}/>
      </svg>
    );
  }
}
