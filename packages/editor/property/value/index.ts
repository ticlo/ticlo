import {DynamicEditor, dynamicEditorMap} from './DynamicEditor.tsx';
import {MultiSelectEditor, SelectEditor} from './SelectEditor.tsx';
import {ComboEditor} from './ComboEditor.tsx';
import {PasswordEditor} from './PasswordEditor.tsx';
import {RadioButtonEditor} from './RadioButtonEditor.tsx';
import {FunctionEditor} from './FunctionEditor.tsx';
import {WorkerEditor} from './WorkerEditor.tsx';
import {ReadonlyEditor} from './ReadonlyEditor.tsx';
import {EventEditor} from './EventEditor.tsx';
import {ScheduleEditor} from './ScheduleEditor.tsx';
import {TimeEditor} from './TimeEditor.tsx';

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
