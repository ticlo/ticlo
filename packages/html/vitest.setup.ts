import {setStorageFunctionProvider} from '@ticlo/core';
import {IndexDbStorage} from './storage/IndexDbStorage';

setStorageFunctionProvider(() => new IndexDbStorage('testFunctionStorage'));
