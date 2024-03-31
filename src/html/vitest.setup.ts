import {setStorageFunctionProvider} from '../core';
import {IndexDbStorage} from './storage/IndexDbStorage';

setStorageFunctionProvider(() => new IndexDbStorage('testFunctionStorage'));
