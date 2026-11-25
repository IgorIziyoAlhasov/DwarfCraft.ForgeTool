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
  return <section className="card">
    <h2>Bank contents</h2>
    <p>DwarfCraft labels reflect the fields observed in the reference captures.</p>
    <div className="table-wrap"><table>
      <thead><tr><th>Path</th><th>DwarfCraft label</th><th>Value / XML</th></tr></thead>
      <tbody>{bank.entries.map(row => <tr key={row.id}>
        <td>{row.displayPath}</td><td>{observedLabel(bank, row)}</td>
        <td><code>{row.integer ?? row.xml}</code></td>
      </tr>)}</tbody>
    </table></div>
    <details><summary>Original XML text</summary><pre>{bank.source}</pre></details>
  </section>;
}

function Comparison({ left, right }) {
  const changes = compareBanks(left, right);
  return <section className="card">
    <h2>Bank comparison</h2>
    <p>{left.hash === right.hash ? 'Byte-identical files.' : 'File hashes differ.'} {changes.length} structural changes.</p>
    {changes.length > 0 && <div className="table-wrap"><table>
      <thead><tr><th>Path</th><th>Status</th><th>{left.name}</th><th>{right.name}</th></tr></thead>
      <tbody>{changes.map(change => <tr key={change.id}>
        <td>{change.path}</td><td>{change.status}</td>
        <td><code>{change.before?.xml ?? '—'}</code></td>
        <td><code>{change.after?.xml ?? '—'}</code></td>
      </tr>)}</tbody>
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
