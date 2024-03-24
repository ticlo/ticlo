import {setDefaultStorageFunctionProvider} from '../core/functions/data/Storage';
import {FileStorage} from './storage/FileStorage';

setDefaultStorageFunctionProvider(() => new FileStorage('./.test-storage/', '.str'));
