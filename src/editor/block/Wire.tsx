import React from 'react';
import {DataRendererItem, PureDataRenderer} from '../../ui/component/DataRenderer';
import {FieldItem} from './Field';
import {cssNumber} from '../../ui/util/Types';

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
    this.target.forceUpdate();
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
    let sourceRight = source.x + source.w + 4;
    let targetRight = target.x + target.w + 4;

    let zIndex = source.block.selected || target.block.selected ? 100 : undefined;

    let className = 'ticl-block-wire';
    if (target._bindingTargetKey !== source.key) {
      className = 'ticl-block-wire ticl-wire-dash';
    }
    let y0 = source.y;
    let y1 = target.y;
    if (targetRight > sourceRight) {
      let x1 = target.x - 4;
      return WireView.renderNormal(sourceRight, y0, x1, y1, zIndex, className);
    } else {
      return WireView.renderRightSide(sourceRight, y0, targetRight, y1, zIndex, className);
    }
  }
  static renderNormal(x0: number, y0: number, x1: number, y1: number, zIndex: number, className: string) {
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
      let r = ((x1 - x0) * 0.5) / xgap;
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
    mx0 -= minx;
    mx1 -= minx;
    y0 -= miny;
    y1 -= miny;

    let midx = (x0 + x1) * 0.5;
    let midy = (y0 + y1) * 0.5;

    return (
      <svg
        width={maxx - minx}
        height={maxy - miny}
        className={className}
        xmlns="http://www.w3.org/2000/svg"
        style={{left: minx, top: miny, zIndex}}
      >
        <path
          d={`M ${cssNumber(x0)} ${cssNumber(y0)} Q ${cssNumber(mx0)} ${cssNumber(y0)} ${cssNumber(midx)} ${cssNumber(
            midy
          )} ${cssNumber(mx1)} ${cssNumber(y1)} ${cssNumber(x1)} ${cssNumber(y1)}`}
        />
      </svg>
    );
  }

  static renderRightSide(x0: number, y0: number, x1: number, y1: number, zIndex: number, className: string) {
    if (x0 === x1 && y0 === y1) {
      return null;
    }
    let minx = x1 - wirePadding;
    let maxx = x0 + wirePadding;
    let miny = Math.min(y0, y1) - wirePadding;
    let maxy = Math.max(y0, y1) + wirePadding;

    x0 -= minx;
    x1 -= minx;
    y0 -= miny;
    y1 -= miny;

    let gap = 8 + Math.abs(y1 - y0) / 6;
    let midx = x0 + gap;
    let midy = (y0 + y1) * 0.5;

    maxx += gap;

    let smidx = cssNumber(midx);
    let sy0 = cssNumber(y0);
    let sy1 = cssNumber(y1);

    return (
      <svg
        width={maxx - minx}
        height={maxy - miny}
        className={className}
        xmlns="http://www.w3.org/2000/svg"
        style={{left: minx, top: miny, zIndex}}
      >
        <path
          d={`M ${cssNumber(x0)} ${cssNumber(y0)} C ${smidx} ${sy0} ${smidx} ${sy0} ${smidx} ${cssNumber(
            midy
          )} C ${smidx} ${sy1} ${smidx} ${sy1} ${cssNumber(x1)} ${cssNumber(y1)}`}
        />
      </svg>
    );
  }
}
