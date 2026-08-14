// _tursod1.js — D1 相容的 Turso(libsql) HTTP 用戶端。
// 讓既有 D1 程式碼（env.DB.prepare().bind().first()/all()/run()/raw()、env.DB.batch()、env.DB.exec()）
// 不改一行直接改打 Turso。由 functions/_middleware.js 注入取代原 D1 binding。
// 環境變數（CF Pages 專案設定，不入版控）：
//   TURSO_URL   = https://<db>-<org>.turso.io（libsql:// 開頭也接受，會自動轉 https）
//   TURSO_TOKEN = Turso database auth token

function encodeArg(v) {
  if (v === null || v === undefined) return { type: 'null' };
  if (typeof v === 'number') {
    return Number.isInteger(v) ? { type: 'integer', value: String(v) } : { type: 'float', value: v };
  }
  if (typeof v === 'bigint') return { type: 'integer', value: String(v) };
  if (typeof v === 'boolean') return { type: 'integer', value: v ? '1' : '0' };
  if (v instanceof ArrayBuffer || ArrayBuffer.isView(v)) {
    const bytes = v instanceof ArrayBuffer ? new Uint8Array(v) : new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return { type: 'blob', base64: btoa(bin) };
  }
  return { type: 'text', value: String(v) };
}

function decodeCell(cell) {
  if (!cell || cell.type === 'null') return null;
  if (cell.type === 'integer') {
    const n = Number(cell.value);
    return Number.isSafeInteger(n) ? n : cell.value;
  }
  if (cell.type === 'float') return Number(cell.value);
  if (cell.type === 'blob') {
    const bin = atob(cell.base64 || '');
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }
  return cell.value;
}

function toMeta(result) {
  const lr = result?.last_insert_rowid;
  return {
    served_by: 'turso',
    duration: 0,
    changes: result?.affected_row_count ?? 0,
    last_row_id: lr == null ? 0 : Number(lr),
    changed_db: (result?.affected_row_count ?? 0) > 0,
    size_after: 0,
    rows_read: result?.rows_read ?? 0,
    rows_written: result?.rows_written ?? 0,
  };
}

async function pipeline(env, stmts) {
  const url = String(env.TURSO_URL || '').replace(/^libsql:\/\//u, 'https://').replace(/\/$/u, '');
  if (!url || !env.TURSO_TOKEN) throw new Error('turso env missing (TURSO_URL / TURSO_TOKEN)');
  const r = await fetch(`${url}/v2/pipeline`, {
    method: 'POST',
    headers: { authorization: `Bearer ${env.TURSO_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      requests: [...stmts.map((s) => ({ type: 'execute', stmt: s })), { type: 'close' }],
    }),
  });
  if (!r.ok) throw new Error(`turso http ${r.status}`);
  const data = await r.json();
  const out = [];
  for (let i = 0; i < stmts.length; i++) {
    const res = data?.results?.[i];
    if (!res || res.type !== 'ok') {
      const msg = res?.error?.message || JSON.stringify(res?.error || res || 'missing result').slice(0, 300);
      const err = new Error(`D1_ERROR: ${msg}`);
      err.cause = res?.error;
      throw err;
    }
    out.push(res.response?.result || {});
  }
  return out;
}

function rowsToObjects(result) {
  const cols = (result.cols || []).map((c) => c.name);
  return (result.rows || []).map((row) => Object.fromEntries(row.map((cell, i) => [cols[i], decodeCell(cell)])));
}

function toD1Result(result) {
  return { success: true, results: rowsToObjects(result), meta: toMeta(result) };
}

class TursoStatement {
  constructor(env, sql, args = []) {
    this._env = env;
    this._sql = sql;
    this._args = args;
  }
  bind(...args) {
    return new TursoStatement(this._env, this._sql, args);
  }
  _stmt() {
    return { sql: this._sql, args: this._args.map(encodeArg) };
  }
  async first(col) {
    const [result] = await pipeline(this._env, [this._stmt()]);
    const rows = rowsToObjects(result);
    if (!rows.length) return null;
    return col === undefined ? rows[0] : (rows[0][col] ?? null);
  }
  async all() {
    const [result] = await pipeline(this._env, [this._stmt()]);
    return toD1Result(result);
  }
  async run() {
    return this.all();
  }
  async raw(opts) {
    const [result] = await pipeline(this._env, [this._stmt()]);
    const cols = (result.cols || []).map((c) => c.name);
    const rows = (result.rows || []).map((row) => row.map(decodeCell));
    return opts && opts.columnNames ? [cols, ...rows] : rows;
  }
}

export function tursoD1(env) {
  return {
    prepare(sql) {
      return new TursoStatement(env, sql);
    },
    async batch(statements) {
      const stmts = statements.map((s) => s._stmt());
      // D1 batch 是原子交易：用 Hrana batch 條件步驟包 BEGIN/COMMIT/ROLLBACK（同官方 libsql client 作法）。
      const url = String(env.TURSO_URL || '').replace(/^libsql:\/\//u, 'https://').replace(/\/$/u, '');
      if (!url || !env.TURSO_TOKEN) throw new Error('turso env missing (TURSO_URL / TURSO_TOKEN)');
      const steps = [{ stmt: { sql: 'BEGIN', args: [] } }];
      stmts.forEach((s, i) => steps.push({ stmt: s, condition: { type: 'ok', step: i } }));
      steps.push({ stmt: { sql: 'COMMIT', args: [] }, condition: { type: 'ok', step: steps.length - 1 } });
      steps.push({ stmt: { sql: 'ROLLBACK', args: [] }, condition: { type: 'not', cond: { type: 'ok', step: steps.length - 1 } } });
      const r = await fetch(`${url}/v2/pipeline`, {
        method: 'POST',
        headers: { authorization: `Bearer ${env.TURSO_TOKEN}`, 'content-type': 'application/json' },
        body: JSON.stringify({ requests: [{ type: 'batch', batch: { steps } }, { type: 'close' }] }),
      });
      if (!r.ok) throw new Error(`turso http ${r.status}`);
      const data = await r.json();
      const res = data?.results?.[0];
      if (!res || res.type !== 'ok') throw new Error(`D1_ERROR: ${JSON.stringify(res?.error || res).slice(0, 300)}`);
      const { step_results: sr = [], step_errors: se = [] } = res.response?.result || {};
      const firstErr = se.find((e) => e != null);
      if (firstErr) throw new Error(`D1_ERROR: ${firstErr.message || JSON.stringify(firstErr).slice(0, 300)}`);
      return sr.slice(1, 1 + stmts.length).map((s) => toD1Result(s || {}));
    },
    async exec(sql) {
      const parts = String(sql)
        .split(/;\s*(?:\n|$)/u)
        .map((s) => s.trim())
        .filter(Boolean);
      const t0 = Date.now();
      await pipeline(env, parts.map((s) => ({ sql: s, args: [] })));
      return { count: parts.length, duration: Date.now() - t0 };
    },
    async dump() {
      throw new Error('dump() not supported on turso shim');
    },
    withSession() {
      return this;
    },
  };
}
