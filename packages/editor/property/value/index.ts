import {DynamicEditor, dynamicEditorMap} from './DynamicEditor.js';
import {MultiSelectEditor, SelectEditor} from './SelectEditor.js';
import {ComboEditor} from './ComboEditor.js';
import {PasswordEditor} from './PasswordEditor.js';
import {RadioButtonEditor} from './RadioButtonEditor.js';
import {FunctionEditor} from './FunctionEditor.js';
import {WorkerEditor} from './WorkerEditor.js';
import {ReadonlyEditor} from './ReadonlyEditor.js';
import {EventEditor} from './EventEditor.js';
import {ScheduleEditor} from './ScheduleEditor.js';
import {TimeEditor} from './TimeEditor.js';

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
