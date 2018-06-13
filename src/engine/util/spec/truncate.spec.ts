import { assert } from "chai";
import { truncateObj, TRUNCATED, DataMap } from '../Types';


describe("truncateObj", () => {

  let longstr = "1234567890";
  let bigObj: DataMap = {child: {}, arr: []};
  for (let i = 0; i < 8; i++) {
    longstr += longstr;
    bigObj[i] = longstr;
    bigObj.child[i] = longstr;
    bigObj.arr.push(longstr);
  }

  it('big string', () => {
    let tstr: string = truncateObj(longstr)[0] as string;
    assert.lengthOf(tstr, 131, 'length of str is 128 + 3 dot');
    assert(tstr.endsWith(TRUNCATED), `str ends with ${TRUNCATED}`);
  });

  it('big obj', () => {
    let tobj: DataMap = truncateObj(bigObj)[0];
    assert(JSON.stringify(tobj).length < 2048, 'truncated object cannot be more than 2048 bytes');
    assert.lengthOf(Object.keys(tobj), 10, 'all 10 keys are in output');
  });

  it('max number of item', () => {
    let obj: any = {};
    let arr: any[] = [];
    for (let i = 0; i < 32; ++i) {
      obj[i] = i;
      arr.push(i);
    }
    assert.equal(Object.keys(truncateObj(obj)[0]).length, 10, 'truncated object cannot be more 10 keys');
    assert.equal(truncateObj(arr)[0].length, 10, 'truncated array cannot be more 10 items');
  });
});
