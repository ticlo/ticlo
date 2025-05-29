import Validator from '../Validator';

describe('Validator', () => {
  describe('basic validation', () => {
    it('should validate simple types', () => {
      expect(Validator.check(1, 'number')).toBe(true);
      expect(Validator.check('1', 'string')).toBe(true);
      expect(Validator.check(true, 'boolean')).toBe(true);
    });

    it('should validate number ranges', () => {
      const num0to10 = Validator.num0n(10);
      const num1to10 = Validator.num1n(10);

      expect(Validator.check(5, num0to10)).toBe(true);
      expect(Validator.check(0, num0to10)).toBe(true);
      expect(Validator.check(10, num0to10)).toBe(true);
      expect(Validator.check(-1, num0to10)).toBe(false);
      expect(Validator.check(11, num0to10)).toBe(false);

      expect(Validator.check(5, num1to10)).toBe(true);
      expect(Validator.check(1, num1to10)).toBe(true);
      expect(Validator.check(0, num1to10)).toBe(false);
    });

    it('should validate objects', () => {
      const validator = {
        name: 'string',
        age: Validator.num0n(100),
        optional: 'string',
      };

      const validObj = {name: 'John', age: 25, optional: 'value'};
      const invalidObj = {name: 'John', age: 150};
      const partialObj = {name: 'John'};

      expect(Validator.check(validObj, validator)).toBe(true);
      expect(Validator.check(invalidObj, validator)).toBe(false);
      expect(Validator.check(partialObj, validator)).toBe(false);
    });

    it('should validate arrays', () => {
      const validator = [Validator.num0n(10)];
      const validatorMultiple = [Validator.num0n(10), Validator.num1n(5)];

      expect(Validator.check([1, 2, 3], validator)).toBe(true);
      expect(Validator.check([1, 11], validator)).toBe(false);
      expect(Validator.check([1, 2], validatorMultiple)).toBe(true);
      expect(Validator.check([1, 6], validatorMultiple)).toBe(false);
    });
  });

  describe('nullable and any validation', () => {
    it('should validate nullable values', () => {
      const validator = Validator.nullable('number');

      expect(Validator.check('hello', validator)).toBe(false);
      expect(Validator.check(null, validator)).toBe(true);
      expect(Validator.check(undefined, validator)).toBe(true);
      expect(Validator.check(42, validator)).toBe(true);
    });

    it('should validate any of multiple validators', () => {
      const validator = Validator.any('string', Validator.num0n(10));

      expect(Validator.check('hello', validator)).toBe(true);
      expect(Validator.check(5, validator)).toBe(true);
      expect(Validator.check(15, validator)).toBe(false);
      expect(Validator.check(null, validator)).toBe(false);
    });
  });

  describe('enum validation', () => {
    it('should validate enums', () => {
      const validator = Validator.enum(['option1', 'option2', 'option3']);

      expect(Validator.check('option1', validator)).toBe(true);
      expect(Validator.check('option2', validator)).toBe(true);
      expect(Validator.check('invalid', validator)).toBe(false);
    });
  });
});
