import {
  normalizeListInput,
  normalizeVariant,
  sanitizeDecimalInput,
  sanitizeIntegerInput,
  ProductVariant,
} from '../ProductEditorDrawer';

describe('ProductEditorDrawer helpers', () => {
  test('normalizeListInput handles comma strings and arrays', () => {
    expect(normalizeListInput('a, b, ,c')).toEqual(['a', 'b', 'c']);
    expect(normalizeListInput([' x ', '', 'y'])).toEqual(['x', 'y']);
    expect(normalizeListInput(undefined)).toEqual([]);
  });

  test('sanitizeDecimalInput strips letters but retains dots', () => {
    expect(sanitizeDecimalInput('12a.3b4')).toBe('12.34');
    expect(sanitizeDecimalInput('..1..2')).toBe('..1..2');
  });

  test('sanitizeIntegerInput removes non-digits', () => {
    expect(sanitizeIntegerInput('00a12b3')).toBe('00123');
    expect(sanitizeIntegerInput('-42')).toBe('42');
  });

  test('normalizeVariant trims fields and defaults values', () => {
    const source = {
      id: 1,
      size_value: ' L ',
      colour: ' Green ',
      sku: '  SKU-001 ',
      price_amount: '  5.00 ',
      stock_qty: '10',
      image_url: '  http://example.com/img.jpg ',
    };
    const normalized = normalizeVariant(source);
    const expected: ProductVariant = {
      id: '1',
      size: 'L',
      color: 'Green',
      sku: 'SKU-001',
      price: '5.00',
      stock: '10',
      image: 'http://example.com/img.jpg',
    };
    expect(normalized).toEqual(expected);
  });
});
