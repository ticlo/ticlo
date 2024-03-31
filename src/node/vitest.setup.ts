import {setStorageFunctionProvider} from '../core/functions/data/Storage';
import {FileStorage} from './storage/FileStorage';

setStorageFunctionProvider(() => new FileStorage('./.test-storage/', '.str'));
