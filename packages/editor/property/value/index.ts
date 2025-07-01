import {DynamicEditor, dynamicEditorMap} from './DynamicEditor';
import {MultiSelectEditor, SelectEditor} from './SelectEditor';
import {ComboEditor} from './ComboEditor';
import {PasswordEditor} from './PasswordEditor';
import {RadioButtonEditor} from './RadioButtonEditor';
import {FunctionEditor} from './FunctionEditor';
import {WorkerEditor} from './WorkerEditor';
import {ReadonlyEditor} from './ReadonlyEditor';
import {EventEditor} from './EventEditor';
import {ScheduleEditor} from './ScheduleEditor';
import {TimeEditor} from './TimeEditor';

export const typeEditorMap: {[key: string]: any} = {
  ...dynamicEditorMap,

  'select': SelectEditor,
  'multi-select': MultiSelectEditor,
  'combo-box': ComboEditor,
  'password': PasswordEditor,
  'radio-button': RadioButtonEditor,
  'time': TimeEditor,
  'type': FunctionEditor,
  'worker': WorkerEditor,
  'none': ReadonlyEditor,
  'any': DynamicEditor,
  // special editor
  'event': EventEditor,
  'schedule': ScheduleEditor,
};
