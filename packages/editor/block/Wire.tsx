import React from 'react';
import {DataRendererItem, PureDataRenderer} from '../component/DataRenderer.js';
import {FieldItem} from './Field.js';
import {cssNumber} from '../util/Types.js';

export class WireItem extends DataRendererItem {
  source: FieldItem;
  target: FieldItem;

  _rightSide?: boolean;

  checkIsRightSide() {
    let rightSide = false;
    if (this.source && this.target) {
      rightSide = this.target.x + this.target.w <= this.source.x + this.source.w;
    }
    if (this._rightSide !== rightSide) {
      if (this._rightSide != null) {
        this._rightSide = rightSide;
        this.target.forceUpdate();
      } else {
        this._rightSide = rightSide;
      }
    }
    return rightSide;
  }

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
    // it's possible an indirect binding change to direct binding while source remains the same
    // so we need a forceUpdate even when source is not changed
    this.forceUpdate();
  }

  redraw(positionChanged: boolean) {
    if (positionChanged) {
      this.checkIsRightSide();
      // TODO, even more optimization, maybe only update the wire's z index when there is no position change?
    }
    super.forceUpdate();
  }

  constructor(souce: FieldItem, target: FieldItem) {
    super();
    this.target = target;
    this.source = souce;
    this.source.outWires.add(this);
    this.checkIsRightSide();
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
    let {item} = this.props;
    let {source, target} = this.props.item;

    let zIndex = source.block.selected || target.block.selected ? 100 : undefined;

    let className = 'ticl-block-wire';
    if (target._bindingTargetPath !== source.path) {
      className = 'ticl-block-wire ticl-wire-dash';
    }

    if (item._rightSide) {
      return this.renderRightSide(zIndex, className);
    } else {
      return this.renderNormal(zIndex, className);
    }
  }

  renderNormal(zIndex: number, className: string) {
    let {source, target} = this.props.item;
    let x0 = source.x + source.w + 4;
    let x1 = target.x - 4;
    let y0 = source.y;
    let y1 = target.y;

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

  renderRightSide(zIndex: number, className: string) {
    let {source, target} = this.props.item;
    let x0 = source.x + source.w + 4;
    let x1 = target.x + target.w + 4;
    let y0 = source.y;
    let y1 = target.y;

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

    let gap = Math.pow(Math.abs(y1 - y0), 0.6) + 4;
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
