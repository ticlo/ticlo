import { assert } from "chai";
import { voidProperty } from "../Void";

import { Job } from "../Job";
import { BlockPropertyEvent } from "../BlockProperty";
import { Dispatcher } from "../Dispatcher";
import { voidListeners } from "./TestFunction";

describe("VoidProperty", () => {

  it('basic', () => {

    voidProperty.setValue(1);
    assert.isUndefined(voidProperty.getValue(), 'void property never change value');
    voidProperty.updateValue(2);
    voidProperty.setBinding('a');
    assert.isUndefined(voidProperty.getValue(), 'void property never change value');

    voidProperty.listen(voidListeners);
    assert.isEmpty(voidProperty._listeners, 'void property wont listen');

    voidProperty.subscribe(voidListeners);
    assert.isUndefined(voidProperty._subscribers, 'void property wont subscribe');

    assert.throw(() => voidProperty._save(), 'Can not save destroyed property');
    assert.throw(() => voidProperty._load({}), 'Can not load destroyed property');
    assert.throw(() => voidProperty._liveUpdate({}), 'Can not liveUpdate destroyed property');
  });

});
