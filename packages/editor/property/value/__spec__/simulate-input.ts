import {voidFunction} from '@ticlo/core';

export function simulateInput(input: any, event: any, value: string) {
  if ('onKeyDown' in input && event) {
    event.stopPropagation = voidFunction;
    event.preventDefault = voidFunction;
    input.onKeyDown(event);
  }
  if ('onInputChange' in input && value) {
    let event = {target: {value}};
    input.onInputChange(event);
  }
}
