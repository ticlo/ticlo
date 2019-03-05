import React from "react";
import {ClientConnection} from "../../../common/connect/ClientConnection";
import {SpecialViewProps} from "./SpecialView";
import {LazyUpdateComponent, LazyUpdateListener} from "../../../ui/component/LazyUpdateComponent";
import {Slider} from "antd";

class SliderView extends LazyUpdateComponent<SpecialViewProps, any> {

  value = new LazyUpdateListener(this);
  min = new LazyUpdateListener(this, 0);
  max = new LazyUpdateListener(this, 100);
  step = new LazyUpdateListener(this, 1);

  constructor(props: SpecialViewProps) {
    super(props);
    let {conn, path} = props;
    conn.subscribe(`${path}.value`, this.value, true);
    conn.subscribe(`${path}.min`, this.min, true);
    conn.subscribe(`${path}.max`, this.max, true);
    conn.subscribe(`${path}.step`, this.step, true);
  }

  renderImpl(): React.ReactNode {

    return (
      <Slider value={this.value.value} min={this.min.value} max={this.max.value} step={this.step.value}/>
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

ClientConnection.addEditorType('note',
  {
    view: SliderView,
    name: 'slider-view',
    properties: [
      {name: 'value', type: 'number'},
      {name: 'min', type: 'number', default: 0},
      {name: 'max', type: 'number', default: 100},
      {name: 'step', type: 'number', default: 1},
    ]
  }
);
