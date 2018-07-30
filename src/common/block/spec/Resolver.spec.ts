import {assert} from "chai";
import {Job, Root} from "../Job";
import {Block} from "../Block";
import {Event} from "../Event";

describe("Resolver", () => {

  it('Event Uid Change in Root', () => {
    let uid = Event.uid;
    assert.equal(uid, Event.uid);
    Root.run();
    assert.notEqual(uid, Event.uid);
  });

});
