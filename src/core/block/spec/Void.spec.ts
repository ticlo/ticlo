import {assert} from "chai";
import {voidProperty} from "../Void";

import {Job, Root} from "../Block";
import {BlockPropertyEvent} from "../BlockProperty";
import {Dispatcher} from "../Dispatcher";
import {VoidListeners} from "./TestFunction";

describe("VoidProperty", function () {

  it('basic', function () {

    voidProperty.setValue(1);
    assert.isUndefined(voidProperty.getValue(), 'void property never change value');
    voidProperty.updateValue(2);
    voidProperty.setBinding('a');
    assert.isUndefined(voidProperty.getValue(), 'void property never change value');

    voidProperty.listen(VoidListeners);
    assert.isEmpty(voidProperty._listeners, 'void property wont listen');

    voidProperty.subscribe(VoidListeners);
    assert.isUndefined(voidProperty._subscribers, 'void property wont subscribe');

    if (Root.instance._strictMode) {
      assert.throw(() => voidProperty._save(), 'Can not save destroyed property');
      assert.throw(() => voidProperty._load({}), 'Can not load destroyed property');
      assert.throw(() => voidProperty._liveUpdate({}), 'Can not liveUpdate destroyed property');
    } else {
      assert.isUndefined(voidProperty._save());
      voidProperty._load(123);
      assert.isUndefined(voidProperty.getValue());
      voidProperty._liveUpdate('123');
      assert.isUndefined(voidProperty.getValue());
    }
  });

});
