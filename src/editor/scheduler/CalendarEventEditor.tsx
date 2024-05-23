import React from 'react';
import {DockDialogPane} from '../component/DockDialogPane';
import {ScheduleEvent} from '../../core/util/SetSchedule';
import {RepeatModeList, SchedulerConfig} from '../../core/functions/date/Schedule/SchedulerEvent';
import {t} from '../component/LocalizedLabel';
import {SelectEditor} from '../property/value/SelectEditor';
import {type FunctionDesc, type PropDesc, PropGroupDesc} from '../../core';
import {deepEqual} from '../../core/util/Compare';
import {StringEditor} from '../property/value/StringEditor';
import {ColorEditor} from '../property/value/ColorEditor';
import {typeEditorMap} from '../property/value';
import {TimeRangeEditor} from './editors/TimeRange';
import {ExpandIcon} from '../component/Tree';
import {PropertyEditor} from '../property/PropertyEditor';
import {ClientConn} from '../../core/connect/ClientConn';
import {DatesSelector} from './editors/DatesSelector';

const funcDesc: FunctionDesc = {name: 'scheduler'};
const descs: Record<string, PropDesc> = {
  repeat: {name: 'repeat', type: 'select', options: RepeatModeList},
  name: {name: 'name', type: 'string', default: ''},
  key: {name: 'key', type: 'string', default: ''},
  color: {name: 'color', type: 'color'},
  priority: {name: 'priority', type: 'number', min: 0},
  after: {name: 'after', type: 'date'},
  before: {name: 'before', type: 'date'},
  onlyWeekday: {name: 'onlyWeekday', type: 'toggle'},
  wDays: {name: 'wDays', type: 'multi-select', options: [1, 2, 3, 4, 5, 6, 7]},
  mDays: {
    name: 'mDays',
    type: 'multi-select',
    options: Array.from({length: 31}, (_, i) => i + 1),
  },
  years: {name: 'years', type: 'array'},
  months: {
    name: 'months',
    type: 'multi-select',
    placeholder: 'Any Month',
    options: Array.from({length: 12}, (_, i) => i + 1),
  },
  days: {name: 'days', type: 'array'},
};

function P({
  label,
  field,
  current,
  onChange,
}: {
  label?: React.ReactNode;
  field: string;
  current: any;
  onChange: (value: unknown, field: string) => void;
}) {
  const propDesc = descs[field];
  const EditorClass = typeEditorMap[propDesc.type];
  return (
    <div className="ticl-property">
      <div className="ticl-property-name">{label}</div>
      <div className="ticl-property-value">
        <EditorClass name={field} value={current?.[field]} desc={propDesc} funcDesc={funcDesc} onChange={onChange} />
      </div>
    </div>
  );
}

function sortItem(a: unknown, b: unknown) {
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return a.length - b.length;
    }
    for (let i = 0; i < a.length; ++i) {
      let d = a[i] - b[i];
      if (d !== 0) {
        return d;
      }
    }
    return 0;
  }
  if (typeof a === 'string' && typeof b === 'string') {
    return a.localeCompare(b);
  }
  if (typeof a === 'number') {
    return -1;
  }
  if (typeof b === 'number') {
    return -1;
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

//   isWeekday: z.nullable('boolean'),
//   repeat: z.switch({
//   daily: {},
//   weekly: {days: [z.num1n(7)]},
//   monthly: {days: [z.num1n(31)]},
//   advanced: {
//     years: z.nullable([z.num1n(31)]),
//     months: z.nullable([z.num1n(12)]),
//     days: [z.any(z.num1n(31), ['number', z.num1n(7)])],
//   },
//   dates: {dates: [[z.int, z.num1n(12), z.num1n(31)]]},
// }),
//

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
    const {current} = this.state;
    const newConfig = fullValue ? values : {...current, ...values};
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
      let copy: any = {...current};
      delete copy[field];
      this.onValuesChange(copy, true);
    } else {
      let v = value;
      if (Array.isArray(v)) {
        v.sort(sortItem);
      }
      this.onValuesChange({[field]: v});
    }
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
          <P label={t('Repeat')} field="repeat" current={current} onChange={this.onValueChange} />
          {repeat === 'weekly' ? <P field="wDays" current={current} onChange={this.onValueChange} /> : null}
          {repeat === 'monthly' ? <P field="mDays" current={current} onChange={this.onValueChange} /> : null}
          {repeat === 'dates' ? <DatesSelector dates={current.dates} onChange={this.onValueChange} /> : null}
          {repeat === 'advanced' ? (
            <>
              <P label={t('Months')} field="months" current={current} onChange={this.onValueChange} />
            </>
          ) : null}
          <div className="ticl-property-divider">
            <div className="ticl-h-line" style={{maxWidth: '16px'}} />
            <ExpandIcon opened={showOptional ? 'opened' : 'closed'} onClick={this.onshowOptionalClicked} />
            {t('Optional')}
            <div className="ticl-h-line" />
          </div>
          {showOptional ? (
            <>
              <P label={t('Name')} field="name" current={current} onChange={this.onValueChange} />
              <P label={t('Priority')} field="priority" current={current} onChange={this.onValueChange} />
              <P label={t('Not Before')} field="after" current={current} onChange={this.onValueChange} />
              <P label={t('Not After')} field="before" current={current} onChange={this.onValueChange} />
              <P label={t('Only Week Days')} field="onlyWeekday" current={current} onChange={this.onValueChange} />
              <P label={t('Key')} field="key" current={current} onChange={this.onValueChange} />
              <P label={t('Color')} field="color" current={current} onChange={this.onValueChange} />
            </>
          ) : null}
        </div>
      </DockDialogPane>
    );
  }
}
