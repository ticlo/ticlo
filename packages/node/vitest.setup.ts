import {setStorageFunctionProvider} from '@ticlo/core/functions/data/Storage.ts';
import {FileStorage} from './storage/FileStorage.ts';

setStorageFunctionProvider(() => new FileStorage('./.test-storage/', '.str'));
