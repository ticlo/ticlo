import {addConsoleLogger} from '@ticlo/core/util/Logger.ts';
import {initialUrlParams} from './url-state.ts';

addConsoleLogger(initialUrlParams().has('trace') ? 'trace' : 'info');
