import {voidFunction} from "../../../../common/util/Functions";

export function simulateInput(input: any, event: any, value: string) {
  if ('onKeyDown' in input && event) {
    event.stopPropagation = voidFunction;
    event.preventDefault = voidFunction;
    input.onKeyDown(event);
  }
  if ('onValueChange' in input && value) {
    let event = {nativeEvent: {target: {value}}};
    input.onValueChange(event);
  }
}