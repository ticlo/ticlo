import {setStorageFunctionProvider} from '@ticlo/core';
import {MemoryValueStorage} from '@ticlo/core/storage/MemoryValueStorage.ts';
setStorageFunctionProvider(() => new MemoryValueStorage());
