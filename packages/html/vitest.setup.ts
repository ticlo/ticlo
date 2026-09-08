import {setStorageFunctionProvider} from '@ticlo/core';
import {IndexDbStorage} from './storage/IndexDbStorage.ts';

setStorageFunctionProvider(() => new IndexDbStorage('testFunctionStorage'));
