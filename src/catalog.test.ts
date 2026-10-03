import { describe, it, expect } from 'vitest';
import Papa from 'papaparse';
import {
  parseSource,
  suggestMapping,
  mapRows,
  cleanup,
  validate,
  exportCatalog,
  normalizePrice,
  sample,
  type Settings,
} from './catalog';
const settings: Settings = { numbers: 'comma', inventory: false };
const prepare = (csv: string) => {
  const s = parseSource(csv, 'test.csv');
  return mapRows(s, suggestMapping(s.headers));
};
describe('supplier import', () => {
  it('preserves strings, quoted multiline descriptions and source record numbers', () => {
    const s = parseSource(
      '\uFEFFName,SKU,Price,Description\nMug,000123,12.50,"First line\nSecond line"\n,,,\nTote,000124,20,Canvas',
      'test.csv',
    );
    expect(s.rows[0].cells[1]).toBe('000123');
    expect(s.rows[0].cells[3]).toContain('\n');
    expect(s.rows[1].line).toBe(4);
    expect(s.blankRows).toBe(1);
  });
  it('rejects malformed, duplicate and unnamed columns', () => {
    expect(() => parseSource('Name,Name\na,b', 'x')).toThrow('unique');
    expect(() => parseSource('Name,\na,b', 'x')).toThrow('name');
    expect(() => parseSource('Name,Price\na,2,3', 'x')).toThrow('record 2');
  });
  it('recognizes supplier aliases and creates variant option names', () => {
    const s = parseSource(sample, 'x'),
      m = suggestMapping(s.headers),
      rows = mapRows(s, m);
    expect(m.option1Name.fallback).toBe('Size');
    expect(rows[0].values.sku).toBe('TEE-S');
    expect(rows[0].values.option1Name).toBe('Size');
  });
  it('inherits product details on continuation rows', () => {
    const rows = prepare(
      'Title,URL handle,SKU,Price,Option1 name,Option1 value\nTee,tee,A,20,Size,S\n,tee,B,20,,M',
    );
    expect(rows[1].values.title).toBe('Tee');
    expect(rows[1].values.option1Name).toBe('Size');
    expect(validate(rows, settings).filter((i) => i.level === 'error')).toEqual(
      [],
    );
  });
});
describe('review and fixes', () => {
  it('normalizes chosen number conventions without guessing ambiguous grouping', () => {
    expect(normalizePrice('€ 1.234,50', 'comma')).toBe('1234.50');
    expect(normalizePrice('$1,234.50', 'dot')).toBe('1234.50');
    expect(normalizePrice('1,23', 'dot')).toBe('1,23');
    expect(normalizePrice('twelve', 'comma')).toBe('twelve');
  });
  it('keeps the original rows intact during cleanup', () => {
    const rows = prepare(sample),
      out = cleanup(rows, settings);
    expect(rows[0].values.price).toBe('24,90');
    expect(out[0].values.price).toBe('24.90');
    expect(out[3].values.handle).toBe('canvas-market-tote');
    expect(
      validate(out, settings).filter((i) => i.level === 'error'),
    ).toHaveLength(1);
  });
  it('blocks duplicate variants and conflicting product details', () => {
    const rows = prepare(
      'Name,Handle,Price,Size\nTee,tee,20,S\nOther tee,tee,20,S',
    );
    const issues = validate(rows, settings);
    expect(issues.some((i) => i.message.includes('Duplicate variant'))).toBe(
      true,
    );
    expect(issues.some((i) => i.field === 'title')).toBe(true);
    expect(() => exportCatalog(rows, settings)).toThrow('blocking');
  });
  it('validates option pairs, inventory and compare-at values', () => {
    const rows = prepare('Name,Price,Stock,RRP,Size\nTee,20,no,15,S');
    rows[0].values.option1Name = '';
    const issues = validate(rows, { ...settings, inventory: true });
    expect(issues.some((i) => i.field === 'quantity')).toBe(true);
    expect(issues.some((i) => i.field === 'compare')).toBe(true);
    expect(issues.some((i) => i.field === 'option1Name')).toBe(true);
  });
  it('warns about duplicate SKUs without losing them', () => {
    const rows = prepare('Name,SKU,Price\nTee,001,20\nMug,001,15');
    expect(
      validate(rows, settings).filter(
        (i) => i.field === 'sku' && i.level === 'warning',
      ),
    ).toHaveLength(2);
    expect(exportCatalog(rows, settings)).toContain('001');
  });
  it('rejects script URLs and validates a price even when Shopify could default it to zero', () => {
    const rows = prepare('Name,Price,Image URL\nTee,,javascript:alert(1)');
    expect(
      validate(rows, settings)
        .filter((i) => i.level === 'error')
        .map((i) => i.field),
    ).toEqual(expect.arrayContaining(['price', 'image']));
  });
});
describe('Shopify CSV export', () => {
  it('groups variants, preserves commas, and exports drafts with dependent inventory columns', () => {
    const rows = prepare(
      'Name,Handle,SKU,Price,Size,Stock\n"Tee, cotton",tee,0001,20,S,10\nMug,mug,0002,15,Standard,2\n"Tee, cotton",tee,0003,21,M,5',
    );
    const csv = exportCatalog(rows, { ...settings, inventory: true }),
      parsed = Papa.parse<Record<string, string>>(csv, { header: true }).data;
    expect(parsed.map((r) => r['URL handle'])).toEqual(['tee', 'tee', 'mug']);
    expect(parsed[0].Title).toBe('Tee, cotton');
    expect(parsed[1].Title).toBe('');
    expect(parsed[0].Status).toBe('draft');
    expect(parsed[0]['Published on online store']).toBe('false');
    expect(parsed[0]['Inventory tracker']).toBe('shopify');
    expect(parsed[0]['Fulfillment service']).toBe('manual');
    expect(parsed[0].SKU).toBe('0001');
    expect(csv).not.toContain('\r\n');
  });
  it('omits inventory and unused optional columns, includes default variants', () => {
    const rows = prepare('Name,Price\nMug,12');
    const csv = exportCatalog(rows, settings);
    expect(csv).not.toContain('Inventory quantity');
    expect(csv).not.toContain('Description');
    expect(csv).toContain('Option1 name');
    expect(csv).toContain('Default Title');
  });
  it('rejects an empty export', () => {
    expect(() => exportCatalog([], settings)).toThrow('at least one');
  });
});

it('does not export missing option dependencies after manual editing', () => {
  const rows = prepare('Name,Price,SKU\nMug,12,001');
  rows[0].values.option1Name = '';
  rows[0].values.option1Value = '';
  expect(() => exportCatalog(rows, settings)).toThrow('blocking');
});

it('warns about formula-like values hidden behind whitespace and preserves the source value', () => {
  const rows = prepare('Name,Price,SKU\nMug,12,001');
  rows[0].values.description = '  =HYPERLINK("https://example.com")';
  expect(
    validate(rows, settings).some(
      (i) => i.field === 'description' && i.level === 'warning',
    ),
  ).toBe(true);
  expect(rows[0].values.description).toMatch(/^  =/);
});
