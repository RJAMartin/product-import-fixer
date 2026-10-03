import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpFromLine,
  Box,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Columns3,
  FileSpreadsheet,
  FileText,
  Leaf,
  ListChecks,
  LockKeyhole,
  PackageCheck,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  fields,
  parseSource,
  suggestMapping,
  mapRows,
  cleanup,
  validate,
  exportCatalog,
  reportCsv,
  sample,
  type Source,
  type Mapping,
  type Row,
  type Key,
  type Settings,
} from './catalog';
const steps = ['Import file', 'Map columns', 'Review & fix', 'Export'];
function download(text: string, name: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: 'text/csv;charset=utf-8' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export default function App() {
  const [source, setSource] = useState<Source | null>(null),
    [mapping, setMapping] = useState<Mapping | null>(null),
    [rows, setRows] = useState<Row[]>([]),
    [step, setStep] = useState(0),
    [settings, setSettings] = useState<Settings>({
      numbers: 'dot',
      inventory: false,
    }),
    [selected, setSelected] = useState<string | null>(null),
    [filter, setFilter] = useState('all'),
    [query, setQuery] = useState(''),
    [page, setPage] = useState(0),
    [message, setMessage] = useState(''),
    [error, setError] = useState(false),
    [drag, setDrag] = useState(false),
    [reading, setReading] = useState(false),
    [previous, setPrevious] = useState<Row[] | null>(null),
    [exported, setExported] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);
  const issues = useMemo(() => validate(rows, settings), [rows, settings]);
  const errors = issues.filter((i) => i.level === 'error'),
    warnings = issues.filter((i) => i.level === 'warning');
  const errorIds = new Set(errors.map((i) => i.rowId)),
    warningIds = new Set(warnings.map((i) => i.rowId));
  const products = new Set(rows.map((r) => r.values.handle.trim())).size;
  const filtered = rows.filter(
    (r) =>
      (filter === 'all' ||
        (filter === 'errors' && errorIds.has(r.id)) ||
        (filter === 'warnings' && warningIds.has(r.id))) &&
      (!query ||
        Object.values(r.values).some((v) =>
          v.toLowerCase().includes(query.toLowerCase()),
        )),
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / 20)),
    currentPage = Math.min(page, totalPages - 1);
  const active = rows.find((r) => r.id === selected);
  const mapped = fields.filter(
    (f) =>
      mapping && (mapping[f.key].column !== null || mapping[f.key].fallback),
  ).length;
  function notice(text: string, isError = false) {
    setMessage(text);
    setError(isError);
  }
  function load(text: string, name: string) {
    try {
      const s = parseSource(text, name);
      setSource(s);
      setMapping(suggestMapping(s.headers));
      setRows([]);
      setPrevious(null);
      setSelected(null);
      setStep(1);
      setPage(0);
      setQuery('');
      setFilter('all');
      setExported(false);
      notice('');
    } catch (e) {
      notice(
        e instanceof Error ? e.message : 'Could not read this file.',
        true,
      );
    }
  }
  async function files(fs: File[]) {
    const f = fs[0];
    if (!f) return;
    if (!/\.(csv|tsv|txt)$/i.test(f.name) || f.size > 5 * 1024 * 1024) {
      notice('Choose a CSV or TSV under 5 MB.', true);
      return;
    }
    setReading(true);
    try {
      const data = await f.arrayBuffer();
      load(new TextDecoder('utf-8', { fatal: true }).decode(data), f.name);
    } catch {
      notice(
        'Could not read the file as UTF-8. Export it as UTF-8 CSV and try again.',
        true,
      );
    } finally {
      setReading(false);
    }
  }
  function apply() {
    if (!source || !mapping) return;
    const title = mapping.title,
      price = mapping.price;
    if (
      (title.column === null && !title.fallback.trim()) ||
      (price.column === null && !price.fallback.trim())
    ) {
      notice(
        'Map a product title and price, or give each a default value.',
        true,
      );
      return;
    }
    setRows(mapRows(source, mapping));
    setPrevious(null);
    setStep(2);
    setSelected(null);
    setFilter('all');
    setPage(0);
    setExported(false);
    notice('Columns mapped. Review the issues below before exporting.');
  }
  function bulk() {
    setPrevious(rows);
    setRows(cleanup(rows, settings));
    setExported(false);
    notice(
      'Trimmed outer spaces, normalized handles, and formatted recognized prices. No currency conversion was applied.',
    );
  }
  function edit(id: string, key: Key, value: string) {
    setRows((v) =>
      v.map((r) =>
        r.id === id ? { ...r, values: { ...r.values, [key]: value } } : r,
      ),
    );
    setExported(false);
    notice('');
  }
  function remove(id: string) {
    setPrevious(rows);
    setRows((v) => v.filter((r) => r.id !== id));
    setSelected(null);
    setExported(false);
    notice('Row removed from this export. Use Undo to restore it.');
  }
  function sync() {
    if (!active) return;
    setPrevious(rows);
    const shared = [
      'title',
      'vendor',
      'type',
      'description',
      'tags',
      'option1Name',
      'option2Name',
      'option3Name',
    ] as Key[];
    setRows((v) =>
      v.map((r) =>
        r.values.handle.trim() === active.values.handle.trim()
          ? {
              ...r,
              values: {
                ...r.values,
                ...Object.fromEntries(shared.map((k) => [k, active.values[k]])),
              },
            }
          : r,
      ),
    );
    notice('Shared product details applied to rows with the same handle.');
    setExported(false);
  }
  function saveMapping() {
    if (!source || !mapping) return;
    try {
      localStorage.setItem(
        'stockroom-mapping-v1',
        JSON.stringify({ headers: source.headers, mapping }),
      );
      notice(
        'Mapping and fallback values saved in this browser. Imported rows stay in this tab.',
      );
    } catch {
      notice(
        'Browser storage is unavailable. You can still finish this import.',
        true,
      );
    }
  }
  function restoreMapping() {
    try {
      const x = JSON.parse(
        localStorage.getItem('stockroom-mapping-v1') || 'null',
      );
      if (
        !x ||
        !source ||
        JSON.stringify(x.headers) !== JSON.stringify(source.headers) ||
        !fields.every(
          (f) =>
            x.mapping?.[f.key] &&
            typeof x.mapping[f.key].fallback === 'string' &&
            (x.mapping[f.key].column === null ||
              (Number.isInteger(x.mapping[f.key].column) &&
                x.mapping[f.key].column >= 0 &&
                x.mapping[f.key].column < source.headers.length)),
        )
      )
        throw Error();
      setMapping(x.mapping);
      notice('Saved mapping restored for these source columns.');
    } catch {
      notice('No saved mapping matches this file’s columns.', true);
    }
  }
  function exportFile() {
    try {
      download(
        exportCatalog(rows, settings),
        `${source!.name.replace(/\.[^.]+$/, '')}-shopify.csv`,
      );
      setExported(true);
      notice(
        'CSV downloaded. In Shopify, open Products → Import and review the preview before importing.',
      );
    } catch (e) {
      notice(e instanceof Error ? e.message : 'Could not export.', true);
    }
  }
  return (
    <div className="app">
      <aside className="sidebar">
        <a href="./" className="brand">
          <span>
            <Box size={23} />
          </span>
          stockroom
        </a>
        <div className="side-label">YOUR WORKSPACE</div>
        <nav aria-label="Import steps">
          {steps.map((s, i) => (
            <button
              key={s}
              className={'nav-step ' + (step === i ? 'active' : '')}
              disabled={
                (i > 0 && !source) ||
                (i > 1 && !rows.length) ||
                (i === 3 && errors.length > 0)
              }
              onClick={() => {
                setStep(i);
                notice('');
              }}
            >
              <span className="step-number">
                {i < step ? (
                  <Check size={13} />
                ) : (
                  String(i + 1).padStart(2, '0')
                )}
              </span>
              {s}
              {step === i && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="side-note">
          <Leaf size={21} />
          <strong>A lighter way to import.</strong>
          <p>
            Your supplier files stay on this device. No account or store
            connection needed.
          </p>
        </div>
        <div className="side-bottom">
          <a
            href="https://github.com/RJAMartin/product-import-fixer"
            target="_blank"
            rel="noreferrer"
          >
            Built by Renaud Martin ↗
          </a>
          <span>Independent tool for Shopify imports.</span>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <span className="breadcrumb">
            Workspace <span>/</span> New product import
          </span>
          <span className="private">
            <LockKeyhole size={13} />
            Private by default
          </span>
        </header>
        <main className="content">
          <section className="heading">
            <div>
              <div className="eyebrow">SUPPLIER FILE → SHOPIFY CATALOG</div>
              <h1>
                {
                  [
                    'A good catalog starts here.',
                    'Everything in its right column.',
                    'A little cleanup. A clean import.',
                    'Ready for your next shelf.',
                  ][step]
                }
              </h1>
              <p>
                {
                  [
                    'Turn supplier spreadsheets into import-ready products. All in your browser.',
                    'Match your supplier’s columns to the fields Shopify expects.',
                    'Review your products, resolve the details, and leave the guesswork behind.',
                    'Download your checked catalog and finish the import in Shopify.',
                  ][step]
                }
              </p>
            </div>
            {source && (
              <button
                className="button"
                onClick={() => {
                  setStep(0);
                  notice('');
                }}
              >
                <Plus size={15} />
                New file
              </button>
            )}
          </section>
          {message && (
            <div
              className={'notice ' + (error ? 'error' : '')}
              role={error ? 'alert' : 'status'}
            >
              {error ? <CircleAlert size={16} /> : <Check size={16} />}
              <span>{message}</span>
              <button aria-label="Dismiss message" onClick={() => notice('')}>
                <X size={15} />
              </button>
            </div>
          )}
          {step === 0 && (
            <>
              <div className="import-layout">
                <section className="panel upload-panel">
                  <div className="panel-heading">
                    <h2>
                      <FileSpreadsheet size={18} />
                      Start with your supplier file
                    </h2>
                    <span className="badge">CSV / TSV</span>
                  </div>
                  <div
                    className={'drop-area ' + (drag ? 'dragging' : '')}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDrag(true);
                    }}
                    onDragLeave={() => setDrag(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDrag(false);
                      if (!reading)
                        void files(Array.from(e.dataTransfer.files));
                    }}
                  >
                    <div className="file-illustration">
                      <div className="sheet-back" />
                      <div className="sheet-front">
                        <Columns3 size={27} />
                        <span />
                        <span />
                        <span />
                      </div>
                      <span className="upload-circle">
                        <ArrowUpFromLine size={17} />
                      </span>
                    </div>
                    <h2>Drop your spreadsheet here</h2>
                    <p>
                      A CSV or TSV with column names in the first row.
                      <br />
                      Up to 5 MB · 10,000 rows · UTF-8
                    </p>
                    <button
                      className="button primary"
                      disabled={reading}
                      onClick={() => input.current?.click()}
                    >
                      {reading ? 'Reading file…' : 'Choose a file'}
                      <ArrowRight size={15} />
                    </button>
                    <input
                      className="sr-only"
                      ref={input}
                      type="file"
                      accept=".csv,.tsv,.txt"
                      onChange={(e) => {
                        void files(Array.from(e.target.files ?? []));
                        e.target.value = '';
                      }}
                    />
                    <span className="local-note">
                      <ShieldCheck size={12} />
                      Your file never leaves this browser
                    </span>
                  </div>
                  <div className="sample-bar">
                    <div>
                      <strong>Just looking around?</strong>
                      <p>Try a small catalog with a few things to fix.</p>
                    </div>
                    <button
                      className="button"
                      onClick={() => load(sample, 'north-supply-catalog.csv')}
                    >
                      Try sample file
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </section>
                <aside className="intro-aside">
                  <span className="eyebrow">
                    FROM SPREADSHEET TO STOREFRONT
                  </span>
                  <h2>
                    Less admin.
                    <br />
                    More getting
                    <br />
                    <em>products out there.</em>
                  </h2>
                  <div className="intro-step">
                    <span>01</span>
                    <div>
                      <strong>Bring your supplier’s format</strong>
                      <p>No perfect template required.</p>
                    </div>
                  </div>
                  <div className="intro-step">
                    <span>02</span>
                    <div>
                      <strong>Make the columns match</strong>
                      <p>Map once. Reuse next time.</p>
                    </div>
                  </div>
                  <div className="intro-step">
                    <span>03</span>
                    <div>
                      <strong>Fix it before you import it</strong>
                      <p>Clear issues, with the row to edit.</p>
                    </div>
                  </div>
                  <div className="draft-pill">
                    <PackageCheck size={17} />
                    <span>
                      Exported as drafts.
                      <br />
                      <strong>You decide when products go live.</strong>
                    </span>
                  </div>
                </aside>
              </div>
              <div className="feature-strip">
                <span>
                  <CheckCheck size={17} />
                  Products & variants
                </span>
                <span>
                  <Settings2 size={17} />
                  Reusable column mappings
                </span>
                <span>
                  <ShieldCheck size={17} />
                  No uploads or tracking
                </span>
              </div>
            </>
          )}
          {source && step > 0 && (
            <div className="file-summary">
              <div className="file-icon">
                <FileSpreadsheet size={21} />
              </div>
              <div>
                <strong>{source.name}</strong>
                <span>
                  {source.rows.length.toLocaleString()} source rows ·{' '}
                  {source.headers.length} columns
                  {source.blankRows
                    ? ` · ${source.blankRows} blank rows skipped`
                    : ''}
                </span>
              </div>
              <span className="badge">New products · Drafts</span>
            </div>
          )}
          {step === 1 && mapping && source && (
            <section className="panel">
              <div className="panel-heading">
                <h2>
                  <Columns3 size={18} />
                  Column mapping <small>{mapped} fields connected</small>
                </h2>
                <div className="button-row">
                  <button className="button quiet" onClick={restoreMapping}>
                    Load saved mapping
                  </button>
                  <button className="button" onClick={saveMapping}>
                    Save mapping
                  </button>
                </div>
              </div>
              <div className="mapping-head">
                <span>SHOPIFY FIELD</span>
                <span>YOUR SOURCE COLUMN</span>
                <span>FALLBACK VALUE</span>
              </div>
              {['Essentials', 'Product details', 'Variants'].map((group) => (
                <details
                  key={group}
                  className="mapping-group"
                  open={group === 'Essentials' || group === 'Variants'}
                >
                  <summary>
                    {group}
                    <ChevronDown size={15} />
                  </summary>
                  {fields
                    .filter((f) => f.group === group)
                    .map((f) => (
                      <div className="mapping-row" key={f.key}>
                        <div>
                          <label htmlFor={`map-${f.key}`}>
                            {f.label}
                            {['title', 'price'].includes(f.key) && (
                              <span className="required"> *</span>
                            )}
                          </label>
                          <p>{f.hint}</p>
                        </div>
                        <div>
                          <select
                            id={`map-${f.key}`}
                            value={mapping[f.key].column ?? ''}
                            onChange={(e) => {
                              setMapping({
                                ...mapping,
                                [f.key]: {
                                  ...mapping[f.key],
                                  column:
                                    e.target.value === ''
                                      ? null
                                      : +e.target.value,
                                },
                              });
                              notice('');
                            }}
                          >
                            <option value="">
                              {f.key === 'handle'
                                ? 'Generate from title'
                                : 'Not mapped'}
                            </option>
                            {source.headers.map((h, i) => (
                              <option key={i} value={i}>
                                {h}
                              </option>
                            ))}
                          </select>
                          {mapping[f.key].column !== null && (
                            <small className="source-example">
                              e.g.{' '}
                              {source.rows[0].cells[mapping[f.key].column!] ||
                                '(empty)'}
                            </small>
                          )}
                        </div>
                        <input
                          aria-label={`${f.label} fallback`}
                          placeholder={
                            f.key === 'handle'
                              ? 'Auto-generated'
                              : 'Optional default'
                          }
                          value={mapping[f.key].fallback}
                          onChange={(e) =>
                            setMapping({
                              ...mapping,
                              [f.key]: {
                                ...mapping[f.key],
                                fallback: e.target.value,
                              },
                            })
                          }
                        />
                      </div>
                    ))}
                </details>
              ))}
              <div className="mapping-footer">
                <p>
                  Blank cells use the fallback value. Repeated handles group
                  variants; without a handle column, repeated titles group
                  together.
                  {rows.length > 0 &&
                    ' Applying again replaces your current review edits.'}
                </p>
                <button className="button primary" onClick={apply}>
                  Apply mapping & review
                  <ArrowRight size={15} />
                </button>
              </div>
            </section>
          )}
          {step === 2 && (
            <>
              <div className="metric-row">
                <div className="metric">
                  <span>PRODUCTS</span>
                  <strong>
                    {products}
                    <Box size={20} />
                  </strong>
                </div>
                <div className="metric">
                  <span>VARIANT ROWS</span>
                  <strong>
                    {rows.length}
                    <Columns3 size={20} />
                  </strong>
                </div>
                <button
                  className={'metric ' + (errors.length ? 'error-metric' : '')}
                  onClick={() => {
                    setFilter('errors');
                    setPage(0);
                  }}
                >
                  <span>BLOCKING ISSUES</span>
                  <strong>
                    {errors.length}
                    <CircleAlert size={20} />
                  </strong>
                </button>
                <button
                  className="metric"
                  onClick={() => {
                    setFilter('warnings');
                    setPage(0);
                  }}
                >
                  <span>WARNINGS TO REVIEW</span>
                  <strong>
                    {warnings.length}
                    <ListChecks size={20} />
                  </strong>
                </button>
              </div>
              <section className="cleanup-bar">
                <div>
                  <Sparkles size={18} />
                  <div>
                    <strong>A quick tidy-up</strong>
                    <span>
                      Trim spaces, normalize handles and format prices. No
                      currency conversion.
                    </span>
                  </div>
                </div>
                <div className="button-row">
                  <label className="compact-label">
                    Source number format
                    <select
                      value={settings.numbers}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          numbers: e.target.value as Settings['numbers'],
                        })
                      }
                    >
                      <option value="dot">1,234.56 · decimal point</option>
                      <option value="comma">1.234,56 · decimal comma</option>
                    </select>
                  </label>
                  <button className="button" onClick={bulk}>
                    Apply cleanup
                  </button>
                  <button
                    className="button icon"
                    aria-label="Undo last bulk change"
                    title="Undo last bulk change"
                    disabled={!previous}
                    onClick={() => {
                      setRows(previous!);
                      setPrevious(null);
                      setExported(false);
                      notice('Last bulk change undone.');
                    }}
                  >
                    <RotateCcw size={15} />
                  </button>
                </div>
              </section>
              <div className={'review-layout ' + (active ? 'editing' : '')}>
                <section className="panel table-panel">
                  <div className="panel-heading">
                    <div className="filters" aria-label="Row filters">
                      {[
                        ['all', 'All rows'],
                        ['errors', 'Needs fixing'],
                        ['warnings', 'Warnings'],
                      ].map(([v, label]) => (
                        <button
                          key={v}
                          className={filter === v ? 'active' : ''}
                          onClick={() => {
                            setFilter(v);
                            setPage(0);
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <label className="search">
                      <Search size={15} />
                      <input
                        aria-label="Search products"
                        placeholder="Search products or SKUs"
                        value={query}
                        onChange={(e) => {
                          setQuery(e.target.value);
                          setPage(0);
                        }}
                      />
                    </label>
                  </div>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>ROW</th>
                          <th>PRODUCT / HANDLE</th>
                          <th>SKU</th>
                          <th>PRICE</th>
                          <th>OPTIONS</th>
                          <th>CHECK</th>
                          <th>
                            <span className="sr-only">Edit</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered
                          .slice(currentPage * 20, currentPage * 20 + 20)
                          .map((r) => (
                            <tr
                              key={r.id}
                              className={active?.id === r.id ? 'selected' : ''}
                            >
                              <td className="row-id">{r.sourceRow}</td>
                              <td>
                                <strong>
                                  {r.values.title || <em>Missing title</em>}
                                </strong>
                                <small>
                                  {r.values.handle || 'Missing handle'}
                                </small>
                              </td>
                              <td className="mono">{r.values.sku || '—'}</td>
                              <td
                                className={
                                  'mono ' +
                                  (issues.some(
                                    (i) =>
                                      i.rowId === r.id &&
                                      i.field === 'price' &&
                                      i.level === 'error',
                                  )
                                    ? 'bad-value'
                                    : '')
                                }
                              >
                                {r.values.price || '—'}
                              </td>
                              <td>
                                {[
                                  r.values.option1Value,
                                  r.values.option2Value,
                                  r.values.option3Value,
                                ]
                                  .filter(Boolean)
                                  .join(' / ')}
                              </td>
                              <td>
                                {errorIds.has(r.id) ? (
                                  <span className="status-badge bad">
                                    <CircleAlert size={11} />
                                    {
                                      errors.filter((i) => i.rowId === r.id)
                                        .length
                                    }{' '}
                                    issues
                                  </span>
                                ) : warningIds.has(r.id) ? (
                                  <span className="status-badge warn">
                                    Review
                                  </span>
                                ) : (
                                  <span className="status-badge good">
                                    <Check size={11} />
                                    Ready
                                  </span>
                                )}
                              </td>
                              <td>
                                <button
                                  className="edit-button"
                                  aria-label={`Edit source row ${r.sourceRow}`}
                                  onClick={() => setSelected(r.id)}
                                >
                                  Edit
                                  <ArrowRight size={12} />
                                </button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                    {!filtered.length && (
                      <div className="empty-table">
                        <CheckCheck size={24} />
                        <h3>
                          {rows.length
                            ? 'No rows match this view.'
                            : 'No rows left to export.'}
                        </h3>
                        <p>
                          {filter === 'errors'
                            ? 'Your current rows have no blocking issues.'
                            : 'Change the filters or use Undo to restore removed rows.'}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="table-footer">
                    <span>
                      {filtered.length ? currentPage * 20 + 1 : 0}–
                      {Math.min(currentPage * 20 + 20, filtered.length)} of{' '}
                      {filtered.length} rows
                    </span>
                    <div className="button-row">
                      <button
                        className="button icon quiet"
                        aria-label="Previous page"
                        disabled={currentPage === 0}
                        onClick={() => setPage(currentPage - 1)}
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <span>
                        {currentPage + 1} / {totalPages}
                      </span>
                      <button
                        className="button icon quiet"
                        aria-label="Next page"
                        disabled={currentPage >= totalPages - 1}
                        onClick={() => setPage(currentPage + 1)}
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                </section>
                {active && (
                  <aside className="panel row-editor">
                    <div className="panel-heading">
                      <h2>Edit row {active.sourceRow}</h2>
                      <button
                        className="button icon quiet"
                        aria-label="Close row editor"
                        onClick={() => setSelected(null)}
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <div className="editor-body">
                      {issues.filter((i) => i.rowId === active.id).length >
                        0 && (
                        <div className="issue-list">
                          {issues
                            .filter((i) => i.rowId === active.id)
                            .map((i, n) => (
                              <p key={n} className={i.level}>
                                <CircleAlert size={13} />
                                <span>
                                  <strong>
                                    {
                                      fields.find((f) => f.key === i.field)!
                                        .label
                                    }
                                    :
                                  </strong>{' '}
                                  {i.message}
                                </span>
                              </p>
                            ))}
                        </div>
                      )}
                      {fields
                        .filter(
                          (f) =>
                            f.group === 'Essentials' ||
                            f.group === 'Variants' ||
                            ['vendor', 'compare', 'quantity', 'image'].includes(
                              f.key,
                            ) ||
                            active.values[f.key],
                        )
                        .map((f) => (
                          <label className="edit-field" key={f.key}>
                            {f.label}
                            {f.key === 'description' ? (
                              <textarea
                                value={active.values[f.key]}
                                onChange={(e) =>
                                  edit(active.id, f.key, e.target.value)
                                }
                              />
                            ) : (
                              <input
                                value={active.values[f.key]}
                                onChange={(e) =>
                                  edit(active.id, f.key, e.target.value)
                                }
                                aria-invalid={issues.some(
                                  (i) =>
                                    i.rowId === active.id &&
                                    i.field === f.key &&
                                    i.level === 'error',
                                )}
                              />
                            )}
                          </label>
                        ))}
                      <button className="button full" onClick={sync}>
                        Apply shared details to this product
                      </button>
                      <p className="hint">
                        Copies title, vendor, type, description, tags and option
                        names to all rows with this handle.
                      </p>
                      <button
                        className="button danger full"
                        onClick={() => remove(active.id)}
                      >
                        <Trash2 size={14} />
                        Remove this row
                      </button>
                    </div>
                  </aside>
                )}
              </div>
              <div className="review-bottom">
                <label className="check">
                  <input
                    type="checkbox"
                    checked={settings.inventory}
                    onChange={(e) => {
                      setSettings({ ...settings, inventory: e.target.checked });
                      setExported(false);
                    }}
                  />
                  Include inventory quantities for a single-location store
                </label>
                <div className="button-row">
                  <button
                    className="button"
                    disabled={!issues.length}
                    onClick={() =>
                      download(reportCsv(rows, issues), 'stockroom-issues.csv')
                    }
                  >
                    <FileText size={15} />
                    Download issues
                  </button>
                  <button
                    className="button primary"
                    disabled={!!errors.length || !rows.length}
                    onClick={() => {
                      setStep(3);
                      notice('');
                    }}
                  >
                    Continue to export
                    <ArrowRight size={15} />
                  </button>
                </div>
              </div>
              <p className="hint">
                {errors.length
                  ? `Resolve ${errors.length} blocking issues to export. Click Edit on a row to see exactly what needs attention.`
                  : 'All blocking checks passed. Warnings are advisory; review them before importing.'}{' '}
                Images are checked for URL format only, without contacting the
                image server.
              </p>
            </>
          )}
          {step === 3 && (
            <div className="export-layout">
              <section className="panel export-card">
                <div className="export-icon">
                  <PackageCheck size={35} />
                </div>
                <span className="eyebrow">
                  {exported
                    ? 'DOWNLOADED. NICELY DONE.'
                    : 'ALL BLOCKING CHECKS PASSED'}
                </span>
                <h2>
                  {exported
                    ? 'Your catalog is ready to go.'
                    : 'A clean file for a fresh start.'}
                </h2>
                <p>
                  {products} products · {rows.length} variants ·{' '}
                  {warnings.length} warnings to review
                </p>
                <div className="export-checks">
                  <span>
                    <Check size={15} />
                    Shopify column names and UTF-8 encoding
                  </span>
                  <span>
                    <Check size={15} />
                    Variants grouped by product handle
                  </span>
                  <span>
                    <Check size={15} />
                    Draft status · hidden from the online store
                  </span>
                  <span>
                    <Check size={15} />
                    {settings.inventory
                      ? 'Single-location inventory included'
                      : 'Inventory quantities excluded'}
                  </span>
                </div>
                {warnings.length > 0 && (
                  <div className="advisory">
                    {warnings.length} advisory warnings remain.{' '}
                    <button
                      onClick={() => {
                        setStep(2);
                        setFilter('warnings');
                      }}
                    >
                      Review warnings
                    </button>
                  </div>
                )}
                <button className="button primary large" onClick={exportFile}>
                  <ArrowDownToLine size={18} />
                  Download Shopify CSV
                </button>
                <button className="button quiet" onClick={() => setStep(2)}>
                  <ArrowLeft size={14} />
                  Back to review
                </button>
              </section>
              <aside className="export-guide">
                <span className="eyebrow">THE LAST FEW STEPS</span>
                <h2>
                  From file
                  <br />
                  to your store.
                </h2>
                <ol>
                  <li>
                    <strong>Open Products → Import</strong>
                    <p>Upload the CSV in your Shopify admin.</p>
                  </li>
                  <li>
                    <strong>Keep matching products unchanged</strong>
                    <p>
                      This file is for new products. Leave “Overwrite products
                      with matching handles” unchecked.
                    </p>
                  </li>
                  <li>
                    <strong>Review Shopify’s import preview</strong>
                    <p>
                      Confirm prices use your store currency and image URLs are
                      public. Stockroom cannot check your store or download
                      those images.
                    </p>
                  </li>
                  <li>
                    <strong>Publish when you’re ready</strong>
                    <p>Your imported products start as drafts.</p>
                  </li>
                </ol>
                <a
                  href="https://help.shopify.com/en/manual/products/import-export/using-csv"
                  target="_blank"
                  rel="noreferrer"
                >
                  Shopify’s CSV guide ↗
                </a>
              </aside>
            </div>
          )}
          <footer>
            <span>
              <LockKeyhole size={12} />
              Product data stays in this tab. Download before closing.
            </span>
            <span>STOCKROOM / A SMALL TOOL FOR BETTER WORK</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
