import React from 'react';
import {DockDialogPane} from '../component/DockDialogPane.js';
import {ScheduleEvent} from '@ticlo/core/util/SetSchedule.js';
import {RepeatMode, RepeatModeList, SchedulerConfig} from '@ticlo/core/functions/date/Schedule/SchedulerEvent.js';
import {LocalizedPropertyName, t} from '../component/LocalizedLabel.js';
import {SelectEditor} from '../property/value/SelectEditor.js';
import {type FunctionDesc, type PropDesc, PropGroupDesc, smartStrCompare} from '@ticlo/core';
import {deepEqual} from '@ticlo/core/util/Compare.js';
import {StringEditor} from '../property/value/StringEditor.js';
import {ColorEditor} from '../property/value/ColorEditor.js';
import {typeEditorMap} from '../property/value/index.js';
import {TimeRangeEditor} from './editors/TimeRange.js';
import {ExpandIcon} from '../component/Tree.js';
import {PropertyEditor} from '../property/PropertyEditor.js';
import {ClientConn} from '@ticlo/core/connect/ClientConn.js';
import {DatesSelector} from './editors/DatesSelector.js';
import {AdvancedSelector} from './editors/AdvancedSelector.js';
import {descs, funcDesc} from './editors/descs.js';

function P({
  field,
  current,
  onChange,
}: {
  field: string;
  current: any;
  onChange: (value: unknown, field: string) => void;
}) {
  const propDesc = descs[field];
  const EditorClass = typeEditorMap[propDesc.type];
  return (
    <div className="ticl-property">
      <div className="ticl-property-name">
        <LocalizedPropertyName desc={funcDesc} name={field} />
      </div>
      <div className="ticl-property-value">
        <EditorClass
          name={propDesc.name}
          value={current?.[field]}
          desc={propDesc}
          funcDesc={funcDesc}
          onChange={onChange}
        />
      </div>
    </div>
  );
}

export function sortDateItem(a: unknown, b: unknown) {
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }
  if (typeof a === 'string' && typeof b === 'string') {
    return smartStrCompare(a, b, false);
  }
  if (typeof a === 'number') {
    return -1;
  }
  if (typeof b === 'number') {
    return 1;
  }
  return 0;
}

interface Props {
  conn: ClientConn;
  path: string;
  index: number;
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
    let deleteField = value === '' || value === false;
    if (value === 0 && field === 'priority') {
      // also make priority undefined to be the default
      // but other value like duration should keep the 0 verlue
      deleteField = true;
    }
    if (deleteField) {
      const copy: any = {...current};
      delete copy[field];
      this.onValuesChange(copy, true);
    } else {
      const v = value;
      if (Array.isArray(v)) {
        v.sort(sortDateItem);
      }
      this.onValuesChange({[field]: v});
    }
  };

  onRepeatChange = (repeat: RepeatMode) => {
    const {current} = this.state;
    const newConfig = {...current, repeat};
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
    }
    this.onValuesChange(newConfig, true);
  };

  onshowOptionalClicked = () => {
    const {showOptional} = this.state;
    this.setState({showOptional: !showOptional});
  };

  render() {
    const {conn, path, index} = this.props;
    const {error, config, current, showOptional, paths} = this.state;
    const schedulerDesc = conn.watchDesc('scheduler');
    const valueDesc = (schedulerDesc.properties[0] as PropGroupDesc).properties.find((d) => d.name === 'value');

    const {repeat} = current;
    return (
      <DockDialogPane error={error}>
        <div className="ticl-property-list">
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
          <TimeRangeEditor current={current} onChange={this.onValuesChange} />
          <P field="repeat" current={current} onChange={this.onRepeatChange} />
          {repeat === 'weekly' ? <P field="wDays" current={current} onChange={this.onValueChange} /> : null}
          {repeat === 'dates' ? <DatesSelector dates={current.dates} onValueChange={this.onValueChange} /> : null}
          {repeat === 'advanced' ? <AdvancedSelector onValueChange={this.onValueChange} current={current} /> : null}
          <div className="ticl-property-divider">
            <div className="ticl-h-line" style={{maxWidth: '16px'}} />
            <ExpandIcon opened={showOptional ? 'opened' : 'closed'} onClick={this.onshowOptionalClicked} />
            {t('Optional')}
            <div className="ticl-h-line" />
          </div>
          {showOptional ? (
            <>
              <P field="name" current={current} onChange={this.onValueChange} />
              <P field="priority" current={current} onChange={this.onValueChange} />
              <P field="after" current={current} onChange={this.onValueChange} />
              <P field="before" current={current} onChange={this.onValueChange} />
              <P field="onlyWeekday" current={current} onChange={this.onValueChange} />
              <P field="color" current={current} onChange={this.onValueChange} />
            </>
          ) : null}
        </div>
      </DockDialogPane>
    );
  }
}
