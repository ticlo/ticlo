import {setStorageFunctionProvider} from '@ticlo/core/functions/data/Storage.js';
import {FileStorage} from './storage/FileStorage.js';

setStorageFunctionProvider(() => new FileStorage('./.test-storage/', '.str'));
