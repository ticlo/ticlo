import React, {ReactNode} from 'react';
import {PureDataRenderer} from '../component/DataRenderer.js';
import {TIcon} from '../icon/Icon.js';
import {BaseBlockItem, BlockItem, Stage, XYWRenderer} from './Field.js';
import {getFuncStyleFromDesc} from '../util/BlockColors.js';
import {DataMap} from '@ticlo/core/util/DataTypes.js';

interface MiniBlockViewProps {
  item: BlockItem;
}

export class MiniBlockView extends PureDataRenderer<MiniBlockViewProps, any> implements XYWRenderer {
  private _rootNode!: HTMLElement;
  private getRef = (node: HTMLDivElement): void => {
    this._rootNode = node;
  };

  renderXYW(x: number, y: number, w: number) {
    this._rootNode.style.left = `${x}px`;
    this._rootNode.style.top = `${y}px`;
    if (w) {
      this._rootNode.style.width = `${w}px`;
    }
  }

  renderH(h: number) {
    if (h) {
      this._rootNode.style.height = `${h}px`;
    }
  }

  constructor(props: MiniBlockViewProps) {
    super(props);
  }

  renderImpl() {
    let {item} = this.props;
    let SpecialView = item.desc.view;

    let classNames: string[] = [];
    if (item.selected) {
      classNames.push('ticl-block-selected');
    }
    if (item.synced) {
      classNames.push('ticl-block-synced');
    }
    if (item._syncChild) {
      classNames.push('ticl-block-sync-parent');
    }

    if ((SpecialView as DataMap)?.fullView) {
      classNames.push('ticl-block-full-view-zoom');
      let width = item.w;

      if (!(width > 80)) {
        width = 143;
      }
      return (
        <div
          className={classNames.join(' ')}
          ref={this.getRef}
          style={{top: item.y, left: item.x, width, height: 30}}
        ></div>
      );
    } else if (item.w) {
      classNames.push('ticl-block');

      let [colorClass, icon] = getFuncStyleFromDesc(item.desc, item.conn);
      classNames.push(colorClass);
      return (
        <div
          ref={this.getRef}
          className={classNames.join(' ')}
          style={{top: item.y, left: item.x, width: item.w, height: item.h}}
        >
          <div className="ticl-block-head ticl-block-prbg">
            <TIcon icon={icon} />
            {item.name}
          </div>
        </div>
      );
    } else if (item.descLoaded) {
      classNames.push('ticl-block');
      classNames.push('ticl-block-min');
      let [colorClass, icon] = getFuncStyleFromDesc(item.desc, item.conn);
      classNames.push(colorClass);
      return (
        <div ref={this.getRef} className={classNames.join(' ')} style={{top: item.y, left: item.x}}>
          <div className="ticl-block-head ticl-block-prbg">
            <TIcon icon={icon} />
          </div>
        </div>
      );
    } else {
      // data not ready, don't renderer
      return <div ref={this.getRef} />;
    }
  }
}

interface ZoomStageProps {
  children: ReactNode[];
  style?: React.CSSProperties;
}

export class MiniStage extends React.PureComponent<ZoomStageProps, any> {
  render() {
    let {children, style} = this.props;
    return (
      <div className="ticl-mini-stage" style={style}>
        {children}
      </div>
    );
  }
}
