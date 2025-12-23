import {setStorageFunctionProvider} from '@ticlo/core';
import {IndexDbStorage} from './storage/IndexDbStorage.js';

setStorageFunctionProvider(() => new IndexDbStorage('testFunctionStorage'));
