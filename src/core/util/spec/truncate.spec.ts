import {assert} from "chai";
import {truncateData, measureObjSize, TRUNCATED, DataMap, isDataTruncated} from '../Types';


describe("truncateData", function () {

  let longstr = "1234567890";
  let bigObj: DataMap = {child: {}, arr: []};
  for (let i = 0; i < 8; i++) {
    longstr += longstr;
    bigObj[i] = longstr;
    bigObj.child[i] = longstr;
    bigObj.arr.push(longstr);
  }

  it('big string', function () {
    let tstr: string = truncateData(longstr)[0] as string;
    assert.lengthOf(tstr, 131, 'length of str is 128 + 3 dot');
    assert(isDataTruncated(tstr));
  });

  it('big obj', function () {
    let tobj: DataMap = truncateData(bigObj)[0];
    assert(JSON.stringify(tobj).length < 2048, 'truncated object cannot be more than 2048 bytes');
    assert.lengthOf(Object.keys(tobj), 10, 'all 10 keys are in output');
    assert(isDataTruncated(tobj));
  });

  it('max number of item', function () {
    let obj: any = {};
    let arr: any[] = [];
    for (let i = 0; i < 32; ++i) {
      obj[i] = i;
      arr.push(i);
    }

    let objResult = truncateData(obj)[0];
    assert.equal(Object.keys(objResult).length, 10, 'truncated object cannot be more 10 keys');
    assert.isTrue(isDataTruncated(objResult));

    let arrResult = truncateData(arr)[0];
    assert.equal(arrResult.length, 10, 'truncated array cannot be more 10 items');
    assert.isTrue(isDataTruncated(arrResult));
  });

  it('measure object', function () {
    let size1 = measureObjSize(bigObj, 1024);
    assert.isAtLeast(size1, 1024);
    let size2 = measureObjSize(bigObj, Infinity);
    assert.isAbove(size2, size1, 'full size is bigger than limited measured size');
  });

});
