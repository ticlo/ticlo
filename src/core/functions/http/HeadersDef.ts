import {PropDesc} from '../../block/Descriptor';

export default {
  'Accept': {name: 'Accept', type: 'string'},
  'Authorization': {name: 'Authorization', type: 'string'},
  'Content-Encoding': {name: 'Content-Encoding', type: 'string'},
  'Content-Type': {name: 'Content-Type', type: 'string'},
  'Content-Length': {name: 'Content-Length', type: 'string'},
  'User-Agent': {name: 'User-Agent', type: 'string'},
} as {[key: string]: PropDesc};
