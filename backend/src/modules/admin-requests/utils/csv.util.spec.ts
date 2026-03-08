import { buildCsv, toCsvCell } from './csv.util';

describe('csv.util', () => {
  it('converts primitive values to csv cell strings', () => {
    expect(toCsvCell(undefined)).toBe('');
    expect(toCsvCell(null)).toBe('');
    expect(toCsvCell(123)).toBe('123');
  });

  it('escapes commas, quotes and newlines', () => {
    const csv = buildCsv(
      ['a', 'b'],
      [
        ['hello,world', 'x"y'],
        ['line1\nline2', 'ok'],
      ],
    );

    expect(csv).toContain('"hello,world"');
    expect(csv).toContain('"x""y"');
    expect(csv).toContain('"line1\nline2"');
  });

  it('returns only header when there is no row', () => {
    expect(buildCsv(['col1', 'col2'], [])).toBe('col1,col2');
  });
});
