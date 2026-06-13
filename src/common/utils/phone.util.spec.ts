import { normalizePhone } from './phone.util';

describe('normalizePhone', () => {
  it.each([
    ['0707070707', '0707070707'],
    ['07 07 07 07 07', '0707070707'],
    ['+225 07 07 07 07 07', '0707070707'],
    ['+2250506070809', '0506070809'],
    ['002250101020304', '0101020304'],
    ['2250707070707', '0707070707'],
    ['07-07-07-07-07', '0707070707'],
  ])('normalise %s → %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each([
    ['0207070707'], // préfixe non mobile (02)
    ['070707070'], // trop court
    ['07070707070'], // trop long
    ['abcdefghij'],
    [''],
  ])('rejette %s', (input) => {
    expect(normalizePhone(input)).toBeNull();
  });
});
