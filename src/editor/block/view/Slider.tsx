import React from "react";
import {ClientConnection} from "../../../core/connect/ClientConnection";
import {SpecialViewProps} from "./SpecialView";
import {LazyUpdateComponent, LazyUpdateListener} from "../../../ui/component/LazyUpdateComponent";
import {Slider} from "antd";
import {displayNumber} from "../../../ui/util/Types";

class SliderView extends LazyUpdateComponent<SpecialViewProps, any> {

  value = new LazyUpdateListener(this);
  min = new LazyUpdateListener(this, 0);
  max = new LazyUpdateListener(this, 100);
  step = new LazyUpdateListener(this, 1);

  // this is not a state bacause in commitChange() editorValue is changed but we don't want a re-render until prop change
  _pendingValue: number = NaN;

  onValueChange = (value: number) => {
    let {conn, path} = this.props;
    this._pendingValue = value;
    conn.setValue(`${path}.value`, value);
    this.forceUpdate();
  };

  onAfterChange = () => {
    this._pendingValue = NaN;
  };


  constructor(props: SpecialViewProps) {
    super(props);
    let {conn, path, updateViewHeight} = props;
    conn.subscribe(`${path}.value`, this.value, true);
    conn.subscribe(`${path}.min`, this.min, true);
    conn.subscribe(`${path}.max`, this.max, true);
    conn.subscribe(`${path}.step`, this.step, true);

    updateViewHeight(61);
  }

  renderImpl(): React.ReactNode {
    let value = this.value.value;
    if (this._pendingValue === this._pendingValue) {
      value = this._pendingValue;
    }
    let min = this.min.value;
    let max = this.max.value;

    return (
      <div className='ticl-slider-view'>
        <Slider value={value} min={min} max={max} step={this.step.value}
                onChange={this.onValueChange}
                disabled={this.value.bindingPath != null}/>
        <div className='ticl-slider-view-markers'>
          <span className='ticl-slider-view-marker'>{displayNumber(min)}</span>
          <span className='ticl-slider-view-marker'>{displayNumber(max)}</span>
        </div>
      </div>

    );
  }

  componentWillUnmount(): void {
    let {conn, path} = this.props;
    conn.unsubscribe(`${path}.value`, this.value);
    conn.unsubscribe(`${path}.min`, this.min);
    conn.unsubscribe(`${path}.max`, this.max);
    conn.unsubscribe(`${path}.step`, this.step);
    super.componentWillUnmount();
  }
}

ClientConnection.addEditorType('slider-view',
  {
    view: SliderView,
    name: 'slider-view',
    properties: [
      {name: 'value', type: 'number'},
      {name: 'min', type: 'number', default: 0},
      {name: 'max', type: 'number', default: 100},
      {name: 'step', type: 'number', default: 1, min: 0},
    ]
  }
);
