import {setDefaultStorageFunctionProvider} from '../core';
import {IndexDbStorage} from './storage/IndexDbStorage';

setDefaultStorageFunctionProvider(() => new IndexDbStorage('testFunctionStorage'));
