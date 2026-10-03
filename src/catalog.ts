import Papa from 'papaparse';
export const fields = [
  {
    key: 'title',
    label: 'Product title',
    header: 'Title',
    group: 'Essentials',
    hint: 'The customer-facing product name.',
    aliases: ['title', 'product name', 'name', 'product title', 'item name'],
  },
  {
    key: 'handle',
    label: 'Product handle',
    header: 'URL handle',
    group: 'Essentials',
    hint: 'Rows with the same handle become variants of one product. Blank handles are generated from the title.',
    aliases: ['handle', 'url handle', 'slug', 'product handle', 'product id'],
  },
  {
    key: 'sku',
    label: 'SKU',
    header: 'SKU',
    group: 'Essentials',
    hint: 'Your inventory identifier. Leading zeros are preserved.',
    aliases: ['sku', 'variant sku', 'item code', 'reference', 'product code'],
  },
  {
    key: 'price',
    label: 'Price',
    header: 'Price',
    group: 'Essentials',
    hint: 'Required here to avoid accidentally creating free products. Use 0 for a free product.',
    aliases: [
      'price',
      'variant price',
      'retail price',
      'unit price',
      'selling price',
    ],
  },
  {
    key: 'vendor',
    label: 'Vendor',
    header: 'Vendor',
    group: 'Product details',
    hint: 'Brand, maker or supplier.',
    aliases: ['vendor', 'brand', 'supplier', 'manufacturer'],
  },
  {
    key: 'type',
    label: 'Product type',
    header: 'Type',
    group: 'Product details',
    hint: 'A free-form product type, not Shopify’s taxonomy category.',
    aliases: ['type', 'product type', 'category'],
  },
  {
    key: 'description',
    label: 'Description',
    header: 'Description',
    group: 'Product details',
    hint: 'Plain text or existing HTML. Shown as text here.',
    aliases: ['description', 'body html', 'body (html)', 'details'],
  },
  {
    key: 'tags',
    label: 'Tags',
    header: 'Tags',
    group: 'Product details',
    hint: 'Comma-separated tags.',
    aliases: ['tags', 'keywords'],
  },
  {
    key: 'compare',
    label: 'Compare-at price',
    header: 'Compare-at price',
    group: 'Product details',
    hint: 'Optional original price; should be higher than the selling price.',
    aliases: [
      'compare-at price',
      'compare at price',
      'variant compare at price',
      'rrp',
      'msrp',
    ],
  },
  {
    key: 'quantity',
    label: 'Inventory quantity',
    header: 'Inventory quantity',
    group: 'Product details',
    hint: 'Export only when single-location inventory is enabled.',
    aliases: [
      'inventory quantity',
      'variant inventory qty',
      'stock',
      'quantity',
      'qty',
      'stock on hand',
    ],
  },
  {
    key: 'image',
    label: 'Product image URL',
    header: 'Product image URL',
    group: 'Product details',
    hint: 'A public HTTPS image URL. Availability is not checked.',
    aliases: ['product image url', 'image src', 'image url', 'image', 'photo'],
  },
  {
    key: 'option1Name',
    label: 'Option 1 name',
    header: 'Option1 name',
    group: 'Variants',
    hint: 'For example, Size or Color.',
    aliases: ['option1 name', 'option 1 name'],
  },
  {
    key: 'option1Value',
    label: 'Option 1 value',
    header: 'Option1 value',
    group: 'Variants',
    hint: 'For example, Small or Sand.',
    aliases: ['option1 value', 'option 1 value', 'size'],
  },
  {
    key: 'option2Name',
    label: 'Option 2 name',
    header: 'Option2 name',
    group: 'Variants',
    hint: 'Optional second dimension.',
    aliases: ['option2 name', 'option 2 name'],
  },
  {
    key: 'option2Value',
    label: 'Option 2 value',
    header: 'Option2 value',
    group: 'Variants',
    hint: 'For example, a color.',
    aliases: ['option2 value', 'option 2 value', 'color', 'colour'],
  },
  {
    key: 'option3Name',
    label: 'Option 3 name',
    header: 'Option3 name',
    group: 'Variants',
    hint: 'Optional third dimension.',
    aliases: ['option3 name', 'option 3 name'],
  },
  {
    key: 'option3Value',
    label: 'Option 3 value',
    header: 'Option3 value',
    group: 'Variants',
    hint: 'For example, Material.',
    aliases: ['option3 value', 'option 3 value', 'material'],
  },
] as const;
export type Key = (typeof fields)[number]['key'];
export type Values = Record<Key, string>;
export type Row = { id: string; sourceRow: number; values: Values };
export type Source = {
  name: string;
  headers: string[];
  rows: { line: number; cells: string[] }[];
  blankRows: number;
  delimiter: string;
};
export type Mapping = Record<Key, { column: number | null; fallback: string }>;
export type Issue = {
  rowId: string;
  field: Key;
  level: 'error' | 'warning';
  message: string;
};
export type Settings = { numbers: 'dot' | 'comma'; inventory: boolean };
export const blankValues = () =>
  Object.fromEntries(fields.map((f) => [f.key, ''])) as Values;
const normalize = (s: string) =>
  s.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
export function parseSource(text: string, name: string): Source {
  if (new Blob([text]).size > 5 * 1024 * 1024)
    throw new Error('Choose a UTF-8 CSV or TSV under 5 MB.');
  const parsed = Papa.parse<string[]>(text.replace(/^\uFEFF/, ''), {
    skipEmptyLines: false,
  });
  if (parsed.errors.some((e) => e.type === 'Quotes'))
    throw new Error(
      'A quoted value is not closed correctly. Check the source file.',
    );
  const data = parsed.data;
  if (data.length > 10002)
    throw new Error('This workspace supports up to 10,000 source records.');
  while (data.length && data[data.length - 1].every((c) => !c.trim()))
    data.pop();
  const headers = data.shift()?.map((h) => h.trim()) ?? [];
  if (!headers.length || headers.some((h) => !h))
    throw new Error('Each source column needs a name in the first row.');
  if (headers.length > 100)
    throw new Error('Use a file with 100 columns or fewer.');
  if (new Set(headers.map(normalize)).size !== headers.length)
    throw new Error(
      'Source column names must be unique. Rename duplicate columns first.',
    );
  const rows: Source['rows'] = [];
  let blankRows = 0;
  data.forEach((cells, i) => {
    if (cells.every((c) => !c.trim())) {
      blankRows++;
      return;
    }
    if (cells.length !== headers.length)
      throw new Error(
        `Source record ${i + 2} has ${cells.length} cells; expected ${headers.length}. Check its delimiters and quotes.`,
      );
    rows.push({ line: i + 2, cells });
  });
  if (!rows.length) throw new Error('There are no product rows in this file.');
  return { name, headers, rows, blankRows, delimiter: parsed.meta.delimiter };
}
export function suggestMapping(headers: string[]): Mapping {
  const used = new Set<number>();
  const map = Object.fromEntries(
    fields.map((f) => {
      const i = headers.findIndex(
        (h, n) =>
          !used.has(n) && f.aliases.some((a) => normalize(a) === normalize(h)),
      );
      if (i >= 0) used.add(i);
      return [f.key, { column: i >= 0 ? i : null, fallback: '' }];
    }),
  ) as Mapping;
  for (const n of [1, 2, 3] as const) {
    const key = `option${n}Value` as Key;
    const col = map[key].column;
    if (
      col !== null &&
      ['size', 'color', 'colour', 'material'].includes(normalize(headers[col]))
    )
      map[`option${n}Name` as Key].fallback = headers[col].trim();
  }
  return map;
}
export function slug(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
export function mapRows(source: Source, map: Mapping): Row[] {
  const rows = source.rows.map((r, i) => ({
    id: `r${i}`,
    sourceRow: r.line,
    values: Object.fromEntries(
      fields.map((f) => {
        const m = map[f.key];
        return [
          f.key,
          m.column === null ? m.fallback : r.cells[m.column] || m.fallback,
        ];
      }),
    ) as Values,
  }));
  const groups = new Map<string, Values>();
  for (const row of rows) {
    const v = row.values;
    if (!v.handle.trim()) v.handle = slug(v.title);
    if (!groups.has(v.handle) && v.title.trim()) groups.set(v.handle, v);
  }
  return rows.map((row) => {
    const v = { ...row.values };
    const parent = groups.get(v.handle);
    if (parent)
      for (const key of [
        'title',
        'vendor',
        'type',
        'description',
        'tags',
        'option1Name',
        'option2Name',
        'option3Name',
      ] as Key[])
        if (!v[key].trim()) v[key] = parent[key];
    const options = [1, 2, 3].some(
      (n) => v[`option${n}Name` as Key] || v[`option${n}Value` as Key],
    );
    if (!options) {
      v.option1Name = 'Title';
      v.option1Value = 'Default Title';
    }
    return { ...row, values: v };
  });
}
export function moneyValue(value: string) {
  return (
    /^\d+(?:\.\d{1,2})?$/.test(value.trim()) &&
    Number.isFinite(Number(value)) &&
    Number(value) <= 999999999.99
  );
}
export function normalizePrice(value: string, style: Settings['numbers']) {
  const s = value
    .trim()
    .replace(/^[€$£]\s*|\s*[€$£]$/g, '')
    .replace(/\s/g, '');
  if (!s) return '';
  if (style === 'dot') {
    if (
      !/^\d+(\.\d{1,2})?$/.test(s) &&
      !/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(s)
    )
      return value.trim();
    return s.replace(/,/g, '');
  }
  if (!/^\d+(,\d{1,2})?$/.test(s) && !/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(s))
    return value.trim();
  return s.replace(/\./g, '').replace(',', '.');
}
export function cleanup(rows: Row[], settings: Settings) {
  return rows.map((r) => ({
    ...r,
    values: Object.fromEntries(
      fields.map((f) => {
        let value = r.values[f.key].trim();
        if (f.key === 'handle') value = slug(value || r.values.title);
        if (['price', 'compare'].includes(f.key))
          value = normalizePrice(value, settings.numbers);
        return [f.key, value];
      }),
    ) as Values,
  }));
}
export function validate(rows: Row[], settings: Settings): Issue[] {
  const issues: Issue[] = [];
  const add = (
    r: Row,
    f: Key,
    message: string,
    level: Issue['level'] = 'error',
  ) => issues.push({ rowId: r.id, field: f, level, message });
  const groups = new Map<string, Row[]>(),
    skus = new Map<string, Row[]>();
  for (const r of rows) {
    const v = r.values;
    const handle = v.handle.trim();
    groups.set(handle, [...(groups.get(handle) ?? []), r]);
    if (v.sku.trim())
      skus.set(v.sku.trim(), [...(skus.get(v.sku.trim()) ?? []), r]);
    if (!v.title.trim()) add(r, 'title', 'Add a product title.');
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(handle))
      add(
        r,
        'handle',
        'Use a handle containing lowercase letters, numbers and single hyphens.',
      );
    if (!moneyValue(v.price))
      add(
        r,
        'price',
        'Enter a non-negative price using a decimal point, such as 24.90.',
      );
    if (v.compare && !moneyValue(v.compare))
      add(r, 'compare', 'Use a decimal point for the compare-at price.');
    else if (
      v.compare &&
      moneyValue(v.price) &&
      Number(v.compare) <= Number(v.price)
    )
      add(
        r,
        'compare',
        'Compare-at price must be greater than the selling price.',
      );
    if (settings.inventory && !/^\d+$/.test(v.quantity.trim()))
      add(r, 'quantity', 'Enter a whole stock quantity of zero or more.');
    if (v.image) {
      try {
        const url = new URL(v.image);
        if (
          !['https:', 'http:'].includes(url.protocol) ||
          url.username ||
          url.password ||
          !url.hostname.includes('.') ||
          url.hostname === 'localhost'
        )
          throw Error();
        if (url.protocol === 'http:')
          add(r, 'image', 'Prefer HTTPS for your image URL.', 'warning');
      } catch {
        add(
          r,
          'image',
          'Enter a public HTTP or HTTPS image URL, or leave it blank.',
        );
      }
    }
    if (!v.sku.trim())
      add(
        r,
        'sku',
        'No SKU supplied; adding one makes inventory easier to manage.',
        'warning',
      );
    if (!v.option1Name.trim() && !v.option1Value.trim())
      add(
        r,
        'option1Name',
        'Use Title / Default Title for a simple product, or provide an option name and value.',
      );
    for (const n of [1, 2, 3] as const) {
      const nk = `option${n}Name` as Key,
        vk = `option${n}Value` as Key;
      if (Boolean(v[nk].trim()) !== Boolean(v[vk].trim()))
        add(
          r,
          v[nk].trim() ? vk : nk,
          `Option ${n} needs both a name and a value.`,
        );
      if (n > 1 && (v[nk] || v[vk]) && !v[`option${n - 1}Value` as Key])
        add(
          r,
          vk,
          'Options must be consecutive: fill the previous option first.',
        );
    }
    const optionNames = [v.option1Name, v.option2Name, v.option3Name]
      .filter(Boolean)
      .map(normalize);
    if (new Set(optionNames).size !== optionNames.length)
      add(r, 'option1Name', 'Use a different name for each option.');
    for (const f of fields)
      if (/^[=+@-]/.test(v[f.key].trimStart()))
        add(
          r,
          f.key,
          'This value can be interpreted as a spreadsheet formula. Review it before opening the export in a spreadsheet.',
          'warning',
        );
    if (v.tags.split(',').filter((t) => t.trim()).length > 250)
      add(r, 'tags', 'Use at most 250 tags.');
  }
  for (const group of groups.values()) {
    const first = group[0];
    const combos = new Map<string, Row[]>();
    for (const r of group) {
      for (const f of [
        'title',
        'vendor',
        'type',
        'description',
        'tags',
        'option1Name',
        'option2Name',
        'option3Name',
      ] as Key[])
        if (r.values[f].trim() !== first.values[f].trim())
          add(
            r,
            f,
            'Rows sharing a handle must agree on product details and option names.',
          );
      const key = JSON.stringify(
        [
          r.values.option1Value,
          r.values.option2Value,
          r.values.option3Value,
        ].map((s) => s.trim()),
      );
      combos.set(key, [...(combos.get(key) ?? []), r]);
    }
    for (const same of combos.values())
      if (same.length > 1)
        for (const r of same)
          add(
            r,
            'option1Value',
            'Duplicate variant combination within this product. Change an option, change the handle, or remove the duplicate row.',
          );
  }
  for (const same of skus.values())
    if (same.length > 1)
      for (const r of same)
        add(
          r,
          'sku',
          'This SKU is used by more than one row. Confirm that it is intentional.',
          'warning',
        );
  return issues;
}
export function exportCatalog(rows: Row[], settings: Settings) {
  if (!rows.length) throw new Error('Add at least one product row.');
  if (validate(rows, settings).some((i) => i.level === 'error'))
    throw new Error('Resolve all blocking issues before exporting.');
  const optional = fields.filter(
    (f) =>
      ![
        'title',
        'handle',
        'price',
        'option1Name',
        'option1Value',
        'quantity',
      ].includes(f.key) && rows.some((r) => r.values[f.key].trim()),
  );
  const ordered = fields.filter(
    (f) =>
      ['title', 'handle', 'price', 'option1Name', 'option1Value'].includes(
        f.key,
      ) ||
      optional.includes(f) ||
      (f.key === 'quantity' && settings.inventory),
  );
  const headers = ordered.map((f) => f.header as string);
  headers.push('Status', 'Published on online store');
  if (settings.inventory)
    headers.push(
      'Inventory tracker',
      'Continue selling when out of stock',
      'Fulfillment service',
    );
  const groups = new Map<string, Row[]>();
  rows.forEach((r) => {
    const h = r.values.handle.trim();
    groups.set(h, [...(groups.get(h) ?? []), r]);
  });
  const data: string[][] = [];
  for (const group of groups.values())
    group.forEach((r, i) => {
      const cells = ordered.map((f) => {
        let v = r.values[f.key].trim();
        if (
          i > 0 &&
          ['title', 'description', 'vendor', 'type', 'tags'].includes(f.key)
        )
          v = '';
        if (['price', 'compare'].includes(f.key) && v) v = Number(v).toFixed(2);
        return v;
      });
      cells.push(i === 0 ? 'draft' : '', i === 0 ? 'false' : '');
      if (settings.inventory) cells.push('shopify', 'deny', 'manual');
      data.push(cells);
    });
  // Preserve identifiers exactly. Formula-like strings are surfaced as warnings, not silently rewritten.
  return Papa.unparse(
    { fields: headers, data },
    { newline: '\n', delimiter: ',' },
  );
}
export function reportCsv(rows: Row[], issues: Issue[]) {
  return Papa.unparse(
    {
      fields: [
        'Source record',
        'Field',
        'Severity',
        'Message',
        'Current value',
      ],
      data: issues.map((i) => {
        const r = rows.find((r) => r.id === i.rowId)!;
        return [
          r.sourceRow,
          fields.find((f) => f.key === i.field)!.label,
          i.level,
          i.message,
          r.values[i.field],
        ];
      }),
    },
    { escapeFormulae: true, newline: '\n' },
  );
}
export const sample =
  'Product name,Product handle,Item code,Retail price,Brand,Size,Stock,Image URL\nEveryday cotton tee,everyday-cotton-tee,TEE-S,"24,90",North Supply,Small,18,\nEveryday cotton tee,everyday-cotton-tee,TEE-M,"24,90",North Supply,Medium,12,\nEveryday cotton tee,everyday-cotton-tee,TEE-L,"24,90",North Supply,Large,8,\nCanvas market tote,Canvas Market Tote,TOTE-01,18.50,North Supply,Standard,20,\nStoneware coffee cup,stoneware-coffee-cup,CUP-01,twelve,Clay House,Standard,10,\nLinen table runner,linen-table-runner,RUN-01,39.00,North Supply,Standard,6,\n';
