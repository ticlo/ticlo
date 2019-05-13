import {assert} from "chai";
import {encode, decode} from '../Serialize';
import moment from 'moment';

describe("Serialize", function () {

  it('moment', function () {
    let iso8601 = '2014-11-27T11:07:00.000-08:00';
    let str = `"\\u001bTime:${iso8601}"`;
    let time = moment(iso8601);
    assert.isTrue(time.isSame(decode(str)));
    assert.equal(encode(time), str);
  });

});
