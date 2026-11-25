import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { compareBanks, readBank } from './bank.js';
import { observedLabel } from './dwarfcraft.js';
import './style.scss';

function BankInput({ label, onChange }) {
  const [state, setState] = useState({});
  const request = useRef(0);

  async function load(event) {
    const file = event.target.files[0];
    if (!file) return;
    const id = ++request.current;
    onChange(null);
    setState({ loading: true });
    try {
      const bank = await readBank(file);
      if (id !== request.current) return;
      onChange(bank);
      setState({ bank });
    } catch (error) {
      if (id === request.current) setState({ error: error.message });
    }
  }

  return <section className="card">
    <label>{label}<input type="file" accept=".SC2Bank,.xml" onChange={load} /></label>
    {state.loading && <p role="status">Reading bank…</p>}
    {state.error && <p role="alert">{state.error}</p>}
    {state.bank && <dl>
      <dt>File</dt><dd>{state.bank.name}</dd>
      <dt>Size</dt><dd>{state.bank.size.toLocaleString()} bytes</dd>
      <dt>Bank version</dt><dd>{state.bank.version ?? 'Missing'}</dd>
      <dt>SHA-256</dt><dd><code>{state.bank.hash}</code></dd>
    </dl>}
    {state.bank?.diagnostics.length > 0 && <ul>
      {state.bank.diagnostics.map((message, index) => <li key={index}>{message}</li>)}
    </ul>}
  </section>;
}

function Inspection({ bank }) {
  const [query, setQuery] = useState('');
  const [labeledOnly, setLabeledOnly] = useState(false);
  const search = query.trim().toLowerCase();
  const rows = bank.entries.map(row => ({ row, label: observedLabel(bank, row) }));
  const visibleRows = rows.filter(({ row, label }) =>
    (!labeledOnly || label) &&
    [row.displayPath, label, row.integer ?? row.xml].some(value => value.toLowerCase().includes(search))
  );

  return <section className="card">
    <h2>Bank contents</h2>
    <p>DwarfCraft labels reflect the fields observed in the reference captures.</p>
    <div className="inspection-controls">
      <label>Search bank contents
        <input type="search" value={query} onChange={event => setQuery(event.target.value)} />
      </label>
      <label className="checkbox-label">
        <input type="checkbox" checked={labeledOnly} onChange={event => setLabeledOnly(event.target.checked)} />
        Labeled fields only
      </label>
    </div>
    <p role="status">{visibleRows.length} of {rows.length} entries</p>
    {visibleRows.length === 0 && <p>{rows.length ? 'No entries match these filters.' : 'This bank has no entries.'}</p>}
    {visibleRows.length > 0 && <div className="table-wrap inspection-table" tabIndex={0} role="region" aria-label="Bank entries"><table>
      <thead><tr><th>Path</th><th>DwarfCraft label</th><th>Value / XML</th></tr></thead>
      <tbody>{visibleRows.map(({ row, label }) => <tr key={row.id}>
        <td>{row.displayPath}</td><td>{label}</td>
        <td><code>{row.integer ?? row.xml}</code></td>
      </tr>)}</tbody>
    </table></div>}
    <details><summary>Original XML text</summary><pre>{bank.source}</pre></details>
  </section>;
}

function ComparisonValue({ entry }) {
  if (!entry) return <span aria-label="Entry absent">—</span>;
  if (entry.integer == null) return <code>{entry.xml}</code>;
  return <>
    <code>{entry.integer}</code>
    <details><summary>XML</summary><code>{entry.xml}</code></details>
  </>;
}

function Comparison({ left, right }) {
  const changes = compareBanks(left, right);
  return <section className="card">
    <h2>Bank comparison</h2>
    <p>{left.hash === right.hash ? 'Byte-identical files.' : 'File hashes differ.'} {changes.length} structural changes.</p>
    {changes.length > 0 && <div className="table-wrap inspection-table" tabIndex={0} role="region" aria-label="Changed bank entries"><table>
      <thead><tr><th>Path</th><th>DwarfCraft label</th><th>Status</th><th>Primary · {left.name}</th><th>Comparison · {right.name}</th></tr></thead>
      <tbody>{changes.map(({ id, path, status, before, after }) => {
        const label = (before && observedLabel(left, before)) || (after && observedLabel(right, after));
        return <tr key={id}>
          <td>{path}</td><td>{label}</td><td>{status}</td>
          <td><ComparisonValue entry={before} /></td>
          <td><ComparisonValue entry={after} /></td>
        </tr>;
      })}</tbody>
    </table></div>}
  </section>;
}

function App() {
  const [bank, setBank] = useState(null);
  const [comparison, setComparison] = useState(null);
  return <main>
    <header><h1>DwarfCraft ForgeTool</h1><p>Read-only bank inspector</p></header>
    <div className="inputs">
      <BankInput label="Primary bank" onChange={setBank} />
      <BankInput label="Comparison bank (optional)" onChange={setComparison} />
    </div>
    {bank && comparison && <Comparison left={bank} right={comparison} />}
    {(bank ?? comparison) && <Inspection bank={bank ?? comparison} />}
  </main>;
}

createRoot(document.getElementById('root')).render(<App />);
