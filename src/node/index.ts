import {setDefaultStorageFunctionProvider} from '../core/functions/data/Storage';
import {FileStorage, FileFlowStorage} from './storage/FileStorage';

export {WsServerConnection} from './connect/WsServerConnection';
export {FileFlowStorage, FileStorage};

setDefaultStorageFunctionProvider(() => new FileStorage('./.storage/', '.str'));
