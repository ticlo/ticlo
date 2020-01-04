import React from 'react';
import {BlockWidget, BlockWidgetProps} from './BlockWidget';
import {
  LazyUpdateComponent,
  LazyUpdateListener,
  LazyUpdateSubscriber
} from '../../../react/component/LazyUpdateComponent';
import {Slider} from 'antd';
import {displayNumber} from '../../../react/util/Types';
import {PropDesc} from '../../../core/block/Descriptor';

class SliderView extends LazyUpdateComponent<BlockWidgetProps, any> {
  static readonly viewProperties: PropDesc[] = [
    {name: '@b-w-field', type: 'string'},
    {name: '@b-w-min', type: 'number', default: 0, visible: 'low'},
    {name: '@b-w-max', type: 'number', default: 100, visible: 'low'},
    {name: '@b-w-step', type: 'number', default: 1, min: 0, visible: 'low'}
  ];

  field = new LazyUpdateSubscriber((value: any) => {
    let {conn, path} = this.props;
    if (value && typeof value === 'string') {
      this.value.subscribe(conn, `${path}.${value}`);
    } else {
      this.value.unsubscribe();
    }
  });
  value = new LazyUpdateSubscriber((value: any) => {
    this._pendingValue = NaN;
    this.forceUpdate();
  });
  min = new LazyUpdateSubscriber(this, 0);
  max = new LazyUpdateSubscriber(this, 100);
  step = new LazyUpdateSubscriber(this, 1);

  // this is not a state because in commitChange() editorValue is changed but we don't want a re-render until prop change
  _pendingValue: number = NaN;

  onValueChange = (value: number) => {
    let {conn, path} = this.props;
    let field = this.field.value;
    this._pendingValue = value;
    if (field && typeof field === 'string') {
      conn.setValue(`${path}.${field}`, value);
      this.forceUpdate();
    }
  };

  onAfterChange = () => {
    this._pendingValue = NaN;
  };

  constructor(props: BlockWidgetProps) {
    super(props);
    let {conn, path, updateViewHeight} = props;
    this.field.subscribe(conn, `${path}.@b-w-field`);
    this.min.subscribe(conn, `${path}.@b-w-min`);
    this.max.subscribe(conn, `${path}.@b-w-max`);
    this.step.subscribe(conn, `${path}.@b-w-step`);

    updateViewHeight(61);
  }

  renderImpl(): React.ReactNode {
    let value = this.value.value;
    if (this._pendingValue === this._pendingValue) {
      value = this._pendingValue;
    }
    let min = this.min.value;
    let max = this.max.value;

    value = Number(value);

    return (
      <div className="ticl-slider-view">
        <Slider
          value={value}
          min={min}
          max={max}
          step={this.step.value}
          onChange={this.onValueChange}
          disabled={this.value.bindingPath != null}
        />
        <div className="ticl-slider-view-markers">
          <span className="ticl-slider-view-marker">{displayNumber(min)}</span>
          <span className="ticl-slider-view-marker">{displayNumber(max)}</span>
        </div>
      </div>
    );
  }

  componentWillUnmount(): void {
    this.field.unsubscribe();
    this.value.unsubscribe();
    this.min.unsubscribe();
    this.max.unsubscribe();
    this.step.unsubscribe();
    super.componentWillUnmount();
  }
}
BlockWidget.register('slider', SliderView);
