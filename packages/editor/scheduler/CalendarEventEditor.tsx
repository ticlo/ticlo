import React from 'react';
import {DockDialogPane} from '../component/DockDialogPane.tsx';
import {ScheduleEvent} from '@ticlo/core/util/SetSchedule.ts';
import {RepeatMode, RepeatModeList, SchedulerConfig} from '@ticlo/core/functions/date/Schedule/SchedulerEvent.ts';
import {LocalizedPropertyName, t} from '../component/LocalizedLabel.tsx';
import {SelectEditor} from '../property/value/SelectEditor.tsx';
import {type FunctionDesc, type PropDesc, PropGroupDesc} from '@ticlo/core';
import {deepEqual} from '@ticlo/core/util/Compare.ts';
import {StringEditor} from '../property/value/StringEditor.tsx';
import {ColorEditor} from '../property/value/ColorEditor.tsx';
import {typeEditorMap} from '../property/value/index.ts';
import {TimeRangeEditor} from './editors/TimeRange.tsx';
import {ExpandIcon} from '../component/Tree.tsx';
import {PropertyEditor} from '../property/PropertyEditor.tsx';
import {ClientConn} from '@ticlo/core/connect/ClientConn.ts';
import {DatesSelector} from './editors/DatesSelector.tsx';
import {AdvancedSelector} from './editors/AdvancedSelector.tsx';
import {descs, funcDesc, sortDateItem} from './editors/descs.ts';

export {sortDateItem};

function P({
  field,
  current,
  timezone,
  onChange,
}: {
  field: string;
  current: any;
  timezone?: string;
  onChange: (value: unknown, field: string) => void;
}) {
  const propDesc = descs[field];
  const EditorClass = typeEditorMap[propDesc.type];
  return (
    <div className="ticl-e-property">
      <div className="ticl-e-property-name">
        <LocalizedPropertyName desc={funcDesc} name={field} />
      </div>
      <div className="ticl-e-property-value">
        <EditorClass
          name={propDesc.name}
          value={current?.[field]}
          desc={propDesc}
          funcDesc={funcDesc}
          timezone={timezone}
          onChange={onChange}
        />
      </div>
    </div>
  );
}

interface Props {
  conn: ClientConn;
  path: string;
  index: number;
  zone?: string;
  config: SchedulerConfig;
  onChange: (config: SchedulerConfig) => void;
}

interface State {
  error?: string;
  config?: Partial<SchedulerConfig>;
  current?: Partial<SchedulerConfig>;
  showOptional?: boolean;
  // cache the path array to reduce re-render
  paths?: string[];
}

const emptyConfig: Partial<SchedulerConfig> = {};

export class CalendarEventEditor extends React.PureComponent<Props, State> {
  // Track change, if input changed and there is no editing happening, reset it
  static getDerivedStateFromProps(props: Props, state: State): State {
    const {path} = props;
    const config: Partial<SchedulerConfig> = props.config ?? emptyConfig;
    let result: State = state;
    if (config !== state.config) {
      result = {...result, config, current: config};
    }
    if (path !== state.paths?.[0]) {
      result = {...result, paths: [path]};
    }
    if (result === state) {
      return null;
    }
    return result;
  }
  state: State = {paths: []};
  constructor(props: Props) {
    super(props);
    const config: Partial<SchedulerConfig> = this.props.config ?? emptyConfig;
  }

  onValuesChange = (values: any, fullValue = false) => {
    const {onChange} = this.props;
    const newConfig = fullValue ? values : {...this.state.current, ...values};
    onChange?.(newConfig);
    this.setState({current: newConfig});
  };

  onValueChange = (value: unknown, field: string) => {
    const {current} = this.state;
    // Keep onlyWeekday as a 2-state toggle (undefined = all days, true = weekdays only).
    // Preserve numeric 0 for priority (0 is the highest priority; undefined/Infinity is lowest).
    const deleteField =
      value == null || value === '' || (value === false && (field === 'onlyWeekday' || field === 'range'));
    if (deleteField) {
      const copy: any = {...current};
      delete copy[field];
      this.onValuesChange(copy, true);
    } else {
      const v = Array.isArray(value) ? [...value].sort(sortDateItem) : value;
      this.onValuesChange({[field]: v});
    }
  };

  onRepeatChange = (repeat: RepeatMode) => {
    const {current} = this.state;
    const newConfig: Partial<SchedulerConfig> = {...current, repeat};
    if (newConfig.duration == null) {
      newConfig.duration = 0;
    }
    if (repeat !== 'weekly') {
      delete newConfig.wDays;
    }
    if (repeat !== 'dates') {
      delete newConfig.dates;
    }
    if (repeat !== 'advanced') {
      delete newConfig.years;
      delete newConfig.months;
      delete newConfig.days;
      delete newConfig.range;
    }
    this.onValuesChange(newConfig, true);
  };

  onshowOptionalClicked = () => {
    const {showOptional} = this.state;
    this.setState({showOptional: !showOptional});
  };

  render() {
    const {conn, index, zone} = this.props;
    const {error, current, showOptional, paths} = this.state;
    const schedulerDesc = conn.watchDesc('scheduler');
    const valueDesc = (schedulerDesc?.properties?.[0] as PropGroupDesc)?.properties?.find((d) => d.name === 'value');

    const {repeat} = current;
    return (
      <DockDialogPane error={error}>
        <div className="ticl-e-property-list">
          {schedulerDesc && valueDesc ? (
            <PropertyEditor
              key={
                // PropertyEditor can handle paths change internally, but not name change.
                // So we have to refresh it on name(index) change.
                index
              }
              conn={conn}
              paths={paths}
              name={`value${index}`}
              funcDesc={schedulerDesc}
              propDesc={valueDesc}
            />
          ) : null}
          <TimeRangeEditor current={current} onChange={this.onValuesChange} />
          <P field="repeat" current={current} onChange={this.onRepeatChange} />
          {repeat === 'weekly' ? <P field="wDays" current={current} onChange={this.onValueChange} /> : null}
          {repeat === 'dates' ? (
            <DatesSelector dates={current.dates} zone={zone} onValueChange={this.onValueChange} />
          ) : null}
          {repeat === 'advanced' ? <AdvancedSelector onValuesChange={this.onValuesChange} current={current} /> : null}
          <div className="ticl-e-property-divider">
            <div className="ticl-e-h-line" style={{maxWidth: '16px'}} />
            <ExpandIcon opened={showOptional ? 'opened' : 'closed'} onClick={this.onshowOptionalClicked} />
            {t('Optional')}
            <div className="ticl-e-h-line" />
          </div>
          {showOptional ? (
            <>
              <P field="name" current={current} onChange={this.onValueChange} />
              <P field="priority" current={current} onChange={this.onValueChange} />
              <P field="after" current={current} timezone={zone} onChange={this.onValueChange} />
              <P field="before" current={current} timezone={zone} onChange={this.onValueChange} />
              <P field="onlyWeekday" current={current} onChange={this.onValueChange} />
              <P field="color" current={current} onChange={this.onValueChange} />
            </>
          ) : null}
        </div>
      </DockDialogPane>
    );
  }
}
