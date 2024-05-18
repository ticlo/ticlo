import React from 'react';
import {DockDialogPane} from '../component/DockDialogPane';
import {ScheduleEvent} from '../../core/util/SetSchedule';
import {RepeatModeList, SchedulerConfig} from '../../core/functions/date/Schedule/SchedulerEvent';
import {t} from '../component/LocalizedLabel';
import {SelectEditor} from '../property/value/SelectEditor';
import {type FunctionDesc, type PropDesc} from '../../core';
import {deepEqual} from '../../core/util/Compare';
import {StringEditor} from '../property/value/StringEditor';
import {ColorEditor} from '../property/value/ColorEditor';
import {typeEditorMap} from '../property/value';

const funcDesc: FunctionDesc = {name: 'scheduler'};
const descs: Record<string, PropDesc> = {
  repeat: {name: 'repeat', type: 'select', options: RepeatModeList},
  name: {name: 'name', type: 'string', default: ''},
  field: {name: 'field', type: 'string', default: ''},
  color: {name: 'color', type: 'color'},
};

function P({
  label,
  field,
  current,
  onChange,
}: {
  label: React.ReactNode;
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

function TimeP() {}

interface Props {
  config: SchedulerConfig;
}

interface State {
  error?: string;
  config?: Partial<SchedulerConfig>;
  current?: Partial<SchedulerConfig>;
}

//
//   name: z.nullable('string'),
//   start: [23, 59],
//   duration: z.notNegative,
//   after: z.nullable(z.datetime),
//   before: z.nullable(z.datetime),
//   priority: z.nullable(Number.isFinite),
//   isWeekDay: z.nullable('boolean'),
//   repeat: z.switch({
//   daily: {},
//   weekly: {days: [z.num1n(7)]},
//   monthly: {days: [z.num1n(31)]},
//   advanced: {
//     years: z.nullable([z.num1n(31)]),
//     months: z.nullable([z.num1n(12)]),
//     monthDays: [z.any(z.num1n(31), ['number', z.num1n(7)])],
//   },
//   dates: {dates: [[z.int, z.num1n(12), z.num1n(31)]]},
// }),
//   color: z.nullable('string'),
//   field: z.nullable('string'),
//

const emptyConfig: Partial<SchedulerConfig> = {};

export class CalendarEventEditor extends React.PureComponent<Props, State> {
  // Track change, if input changed and there is no editing happening, reset it
  static getDerivedStateFromProps(props: Props, state: State): State {
    const config: Partial<SchedulerConfig> = props.config ?? emptyConfig;
    if (config !== state.config) {
      return {config, current: config};
    }
    return null;
  }
  constructor(props: Props) {
    super(props);
    const config: Partial<SchedulerConfig> = this.props.config ?? emptyConfig;
    this.state = {config, current: config};
  }
  onApply = () => {
    return true;
  };
  onCancel = (closing: boolean) => {
    if (!closing) {
      this.setState({current: this.state.config});
    }
  };

  onValueChange = (value: unknown, field: string) => {
    this.setState((oldState) => {
      const {current} = oldState;
      if (value === '' || value === false) {
        let copy: any = {...current};
        delete copy[field];
        return {current: copy};
      }
      return {current: {...current, [field]: value}};
    });
  };
  onTimeChange = (value) => {};

  render() {
    const {error, config, current} = this.state;
    const hasChange = deepEqual(config, current);
    return (
      <DockDialogPane
        error={error}
        hideOk={true}
        saveDisabled={hasChange}
        cancelDisabled={hasChange}
        onApply={this.onApply}
        onCancel={this.onCancel}
      >
        <div className="ticl-property-list">
          <P label={t('Repeat')} field="repeat" current={current} onChange={this.onValueChange} />
          <P label={t('Name')} field="name" current={current} onChange={this.onValueChange} />
          <P label={t('Field')} field="field" current={current} onChange={this.onValueChange} />
          <P label={t('Color')} field="color" current={current} onChange={this.onValueChange} />
        </div>
      </DockDialogPane>
    );
  }
}
