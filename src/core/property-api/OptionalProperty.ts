import {Block} from '../block/Block';
import {hideProperties, showProperties} from './PropertyShowHide';

export function addOptionalProperty(block: Block, name: string) {
  let optionalProps: string[] = block.getValue('#optional');

  if (!Array.isArray(optionalProps)) {
    optionalProps = [name];
  } else if (!optionalProps.includes(name)) {
    optionalProps = [...optionalProps];
    optionalProps.push(name);
  } else {
    return;
  }
  block.setValue('#optional', optionalProps);
  showProperties(block, [name]);
}

export function removeOptionalProperty(block: Block, name: string) {
  let optionalProps: string[] = block.getValue('#optional');

  if (!Array.isArray(optionalProps)) {
    return;
  }

  optionalProps = [...optionalProps];
  if (name) {
    let propIndex = optionalProps.indexOf(name);
    if (propIndex > -1) {
      if (optionalProps.length > 1) {
        optionalProps.splice(propIndex, 1);
      } else {
        optionalProps = undefined;
      }

      block.setValue('#optional', optionalProps);
      hideProperties(block, [name]);
    }
  }
}

export function moveOptionalProperty(block: Block, nameFrom: string, nameTo: string) {
  if (nameFrom === nameTo) {
    return;
  }

  let optionalProps: string[] = block.getValue('#optional');
  if (!Array.isArray(optionalProps)) {
    return;
  }
  optionalProps = [...optionalProps];

  let idxFrom = optionalProps.indexOf(nameFrom);
  let idxTo = optionalProps.indexOf(nameTo);
  if (idxFrom > -1 && idxTo > -1) {
    let from = optionalProps.splice(idxFrom, 1)[0];
    optionalProps.splice(idxTo, 0, from);
    block.setValue('#optional', optionalProps);
  }
}
