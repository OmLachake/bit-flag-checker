let mainValue = null;
let flags = [];
let flagCounter = 0;
let currentFmt = 'hex';

function parseValue(raw) {
  const s = raw.trim().replace(/[\s_]/g, '');
  if (!s) return null;
  try {
    if (/^0[xX][0-9a-fA-F]+$/.test(s)) return BigInt(s);
    if (/^0[bB][01]+$/.test(s))         return BigInt(s);
    if (/^[0-9]+$/.test(s))             return BigInt(s);
    if (/^[0-9a-fA-F]+$/.test(s))       return BigInt('0x' + s);
  } catch { /* fall through */ }
  return undefined;
}

function toHex(v)  { return '0x' + v.toString(16).toUpperCase(); }
function toDec(v)  { return v.toString(10); }
function toBin(v)  { return '0b' + v.toString(2); }
function bitLen(v) { return v === 0n ? 1 : v.toString(2).length; }

function escHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatBinAnnotated(mainV, flagV) {
  const len      = Math.max(bitLen(mainV), bitLen(flagV));
  const mainBits = mainV.toString(2).padStart(len, '0');
  const flagBits = flagV.toString(2).padStart(len, '0');
  return flagBits.split('').map((b, i) => {
    if (b === '0') return `<span class="bit-off">0</span>`;
    return `<span class="${mainBits[i] === '1' ? 'bit-on' : 'bit-off'}">${b}</span>`;
  }).join('');
}

function renderMainDisplay() {
  const display = document.getElementById('valueDisplay');
  if (mainValue === null) { display.style.display = 'none'; return; }
  display.style.display = 'flex';
  document.getElementById('reprHex').textContent  = toHex(mainValue);
  document.getElementById('reprDec').textContent  = toDec(mainValue);
  document.getElementById('reprBin').textContent  = toBin(mainValue);
  document.getElementById('reprBits').textContent = bitLen(mainValue) + ' bits';
}

function renderResults() {
  const container   = document.getElementById('resultsContainer');
  const summaryBand = document.getElementById('summaryBand');
  const validFlags  = flags.filter(f => f.value !== null && f.value !== undefined);

  if (mainValue === null || validFlags.length === 0) {
    container.innerHTML = '<div class="empty-state">Add a main value and at least one flag to see results.</div>';
    summaryBand.classList.remove('visible');
    return;
  }

  let matchCount = 0;
  const cells = validFlags.map(f => {
    const isMatch = f.value !== 0n && (mainValue & f.value) === f.value;
    if (isMatch) matchCount++;
    return `<div class="result-cell ${isMatch ? 'match' : 'no-match'}">
      <div class="result-name">${escHtml(f.name)}</div>
      <div class="result-value">${toHex(f.value)} &nbsp;|&nbsp; ${toDec(f.value)}</div>
      <div class="result-bits">${formatBinAnnotated(mainValue, f.value)}</div>
      <div class="result-badge"><span class="dot"></span>${isMatch ? 'SET' : 'CLEAR'}</div>
    </div>`;
  }).join('');

  container.innerHTML = `<div class="results-grid">${cells}</div>`;
  document.getElementById('statTotal').textContent = validFlags.length;
  document.getElementById('statMatch').textContent = matchCount;
  document.getElementById('statMiss').textContent  = validFlags.length - matchCount;
  document.getElementById('statMain').textContent  = toHex(mainValue);
  summaryBand.classList.add('visible');
}

function fmtPlaceholder(fmt) {
  return fmt === 'hex' ? 'e.g. 0x0004' : fmt === 'bin' ? 'e.g. 0b0100' : 'e.g. 4';
}

function fmtValue(v, fmt) {
  return fmt === 'hex' ? toHex(v) : fmt === 'bin' ? toBin(v) : toDec(v);
}

function addFlagRow(flag, shouldFocus = false) {
  const list = document.getElementById('flagsList');
  const row  = document.createElement('div');
  row.className  = 'flag-row';
  row.dataset.id = flag.id;

  row.innerHTML = `
    <input type="text" class="flag-name" placeholder="FLAG_${flag.id}" value="${escHtml(flag.rawName)}">
    <div class="flag-value-group">
      <select class="flag-fmt-select" title="Value format">
        <option value="hex"${flag.fmt === 'hex' ? ' selected' : ''}>HEX</option>
        <option value="dec"${flag.fmt === 'dec' ? ' selected' : ''}>DEC</option>
        <option value="bin"${flag.fmt === 'bin' ? ' selected' : ''}>BIN</option>
      </select>
      <input type="text" class="flag-value" placeholder="${fmtPlaceholder(flag.fmt)}" value="${escHtml(flag.rawValue)}">
    </div>
    <button class="btn-remove" title="Remove">×</button>`;

  const nameInput = row.querySelector('.flag-name');
  const valInput  = row.querySelector('.flag-value');
  const fmtSelect = row.querySelector('.flag-fmt-select');

  nameInput.addEventListener('input', e => {
    flag.rawName = e.target.value;
    flag.name    = e.target.value || `FLAG_${flag.id}`;
    renderResults();
  });

  valInput.addEventListener('input', e => {
    flag.rawValue = e.target.value;
    const parsed  = parseValue(e.target.value);
    flag.value    = parsed === undefined ? null : parsed;
    e.target.style.borderColor = (e.target.value && parsed === undefined) ? 'var(--m-red)' : '';
    renderResults();
  });

  fmtSelect.addEventListener('change', e => {
    flag.fmt = e.target.value;
    valInput.placeholder = fmtPlaceholder(flag.fmt);
    if (flag.value !== null && flag.value !== undefined) {
      flag.rawValue  = fmtValue(flag.value, flag.fmt);
      valInput.value = flag.rawValue;
      valInput.style.borderColor = '';
    }
  });

  row.querySelector('.btn-remove').addEventListener('click', () => {
    row.classList.add('removing');
    row.addEventListener('animationend', () => {
      flags = flags.filter(f => f.id !== flag.id);
      row.remove();
      renderResults();
    }, { once: true });
  });

  list.appendChild(row);
  if (shouldFocus) nameInput.focus();
}

function createFlag(rawName = '', rawValue = '', fmt = 'hex', shouldFocus = false) {
  const id   = ++flagCounter;
  const flag = { id, rawName, rawValue, name: rawName || `FLAG_${id}`, value: null, fmt };
  if (rawValue) {
    const parsed = parseValue(rawValue);
    flag.value   = parsed === undefined ? null : parsed;
  }
  flags.push(flag);
  addFlagRow(flag, shouldFocus);
  renderResults();
}

document.getElementById('mainInput').addEventListener('input', e => {
  const raw    = e.target.value;
  const parsed = parseValue(raw);
  const errEl  = document.getElementById('mainError');

  if (!raw.trim()) {
    mainValue = null;
    errEl.textContent = '';
    e.target.style.borderColor = '';
  } else if (parsed === undefined) {
    mainValue = null;
    errEl.textContent = 'Could not parse — use hex (0x…), binary (0b…), or decimal.';
    e.target.style.borderColor = 'var(--m-red)';
  } else {
    mainValue = parsed;
    errEl.textContent = '';
    e.target.style.borderColor = '';
  }

  renderMainDisplay();
  renderResults();
});

document.querySelectorAll('.format-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.format-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentFmt = tab.dataset.fmt;
    const inp = document.getElementById('mainInput');
    if (mainValue !== null) {
      inp.value = currentFmt === 'hex' ? toHex(mainValue)
                : currentFmt === 'bin' ? toBin(mainValue)
                : toDec(mainValue);
    }
  });
});

function parseCDefines(text) {
  const results = [];
  const errors  = [];

  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || !line.startsWith('#define')) continue;

    const stripped = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '').trim();
    const match = stripped.match(/^#define\s+(\w+)\s+(.+)$/);
    if (!match) { errors.push(`Skipped: "${line}"`); continue; }

    const name = match[1];
    let rawVal = match[2].trim();

    if (/^\(.*\)$/.test(rawVal)) rawVal = rawVal.slice(1, -1).trim();

    const shiftMatch = rawVal.match(/^(\d+)[uUlL]*\s*<<\s*(\d+)$/);
    if (shiftMatch) {
      results.push({ name, value: BigInt(shiftMatch[1]) << BigInt(shiftMatch[2]), rawValue: rawVal, fmt: 'dec' });
      continue;
    }

    const parsed = parseValue(rawVal);
    if (parsed !== null && parsed !== undefined) {
      const fmt = /^0[xX]/.test(rawVal) ? 'hex' : /^0[bB]/.test(rawVal) ? 'bin' : 'dec';
      results.push({ name, value: parsed, rawValue: rawVal, fmt });
    } else {
      errors.push(`Could not parse value for ${name}: "${rawVal}"`);
    }
  }

  return { results, errors };
}

function parseJSValue(raw) {
  const s = raw.trim().replace(/;$/, '').trim();

  const shiftMatch = s.match(/^(0[xX][0-9a-fA-F]+|\d+)\s*<<\s*(\d+)$/);
  if (shiftMatch) {
    try {
      return { value: BigInt(shiftMatch[1]) << BigInt(shiftMatch[2]), fmt: 'dec' };
    } catch { /* fall through */ }
  }

  const parsed = parseValue(s);
  if (parsed !== null && parsed !== undefined) {
    const fmt = /^0[xX]/.test(s) ? 'hex' : /^0[bB]/.test(s) ? 'bin' : 'dec';
    return { value: parsed, fmt };
  }
  return undefined;
}

function pushJSMember(name, rawVal, results, errors) {
  const r = parseJSValue(rawVal);
  if (r) {
    results.push({ name, value: r.value, rawValue: rawVal, fmt: r.fmt });
  } else {
    errors.push(`Could not parse value for ${name}: "${rawVal}"`);
  }
}

function parseJSDefines(text) {
  const results = [];
  const errors  = [];
  const lines   = text.split('\n');
  let mode      = null;

  for (const raw of lines) {
    const line = raw.trim().replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '').trim();
    if (!line) continue;

    if (mode && /^\}/.test(line)) { mode = null; continue; }

    if (mode === 'enum') {
      const m = line.match(/^(\w+)\s*=\s*(.+?)\s*,?\s*$/);
      if (m) pushJSMember(m[1], m[2].trim(), results, errors);
      continue;
    }

    if (mode === 'object') {
      const m = line.match(/^(?:["'`])?(\w+)(?:["'`])?\s*:\s*(.+?)\s*,?\s*$/);
      if (m) pushJSMember(m[1], m[2].trim(), results, errors);
      continue;
    }

    if (/^(?:export\s+)?(?:const\s+)?enum\s+\w+\s*\{/.test(line)) {
      mode = 'enum';
      const inner = line.match(/\{(.+)\}/)?.[1];
      if (inner) {
        inner.split(',').forEach(part => {
          const m = part.trim().match(/^(\w+)\s*=\s*(.+)$/);
          if (m) pushJSMember(m[1], m[2].trim(), results, errors);
        });
        mode = null;
      }
      continue;
    }

    if (/^(?:export\s+)?(?:const|let|var)\s+\w+\s*(?::\s*[\w<>\[\]]+)?\s*=\s*\{/.test(line)) {
      mode = 'object';
      const inner = line.match(/\{(.+)\}/)?.[1];
      if (inner) {
        inner.split(',').forEach(part => {
          const m = part.trim().match(/^(?:["'`])?(\w+)(?:["'`])?\s*:\s*(.+)$/);
          if (m) pushJSMember(m[1], m[2].trim(), results, errors);
        });
        mode = null;
      }
      continue;
    }

    const varMatch = line.match(/^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*(?::\s*[\w<>\[\]|&\s]+)?\s*=\s*(.+?)\s*;?\s*$/);
    if (varMatch) pushJSMember(varMatch[1], varMatch[2].trim(), results, errors);
  }

  return { results, errors };
}

const PLACEHOLDERS = {
  c:  `#define READ_FLAG    0x0001\n#define WRITE_FLAG   0x0002\n#define EXEC_FLAG    (1 << 2)\n#define ADMIN_FLAG   8`,
  js: `// const / let / var\nconst READ_FLAG  = 0x0001;\nexport const WRITE_FLAG = 0x0002;\n\n// Bit shift\nconst EXEC_FLAG: number = 1 << 2;\n\n// TS enum\nenum Permissions {\n  READ  = 0x0001,\n  WRITE = 0x0002,\n}\n\n// Object literal\nconst Flags = {\n  ADMIN: 8,\n};`,
};

const HINTS = {
  c:  `Paste <code>#define</code> lines — one per line`,
  js: `Paste <code>const</code>, <code>enum</code>, or object literals`,
};

document.getElementById('langSelect').addEventListener('change', e => {
  const lang = e.target.value;
  document.getElementById('importInput').placeholder = PLACEHOLDERS[lang];
  document.getElementById('importHint').innerHTML    = HINTS[lang];
  document.getElementById('importError').textContent = '';
});

document.getElementById('btnImport').addEventListener('click', () => {
  const text  = document.getElementById('importInput').value;
  const lang  = document.getElementById('langSelect').value;
  const errEl = document.getElementById('importError');

  const { results, errors } = lang === 'js' ? parseJSDefines(text) : parseCDefines(text);

  if (results.length === 0 && errors.length === 0) {
    errEl.textContent = lang === 'js' ? 'No const/enum/object declarations found.' : 'No #define lines found.';
    return;
  }

  results.forEach(r => {
    const id   = ++flagCounter;
    const flag = { id, rawName: r.name, rawValue: r.rawValue, name: r.name, value: r.value, fmt: r.fmt || 'hex' };
    flags.push(flag);
    addFlagRow(flag);
  });

  errEl.textContent = errors.length ? `Imported ${results.length}, skipped ${errors.length}.` : '';
  if (results.length) renderResults();
});

document.getElementById('btnImportClear').addEventListener('click', () => {
  document.getElementById('importInput').value = '';
  document.getElementById('importError').textContent = '';
});

document.getElementById('btnAdd').addEventListener('click', () => createFlag('', '', 'hex', true));

document.getElementById('btnClear').addEventListener('click', () => {
  flags = [];
  flagCounter = 0;
  document.getElementById('flagsList').innerHTML = '';
  renderResults();
});

function applyTheme(dark) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : '');
  document.getElementById('iconSun').style.display  = dark ? 'block' : 'none';
  document.getElementById('iconMoon').style.display = dark ? 'none'  : 'block';
  localStorage.setItem('theme', dark ? 'dark' : 'light');
}

document.getElementById('btnTheme').addEventListener('click', () => {
  applyTheme(document.documentElement.getAttribute('data-theme') !== 'dark');
});

applyTheme(localStorage.getItem('theme') === 'dark');

document.getElementById('btnDemo').addEventListener('click', () => {
  const inp = document.getElementById('mainInput');
  inp.value = '0x000B';
  inp.dispatchEvent(new Event('input'));

  flags = [];
  flagCounter = 0;
  document.getElementById('flagsList').innerHTML = '';

  createFlag('READ',    '0x0001');
  createFlag('WRITE',   '0x0002');
  createFlag('EXECUTE', '0x0004');
  createFlag('ADMIN',   '0x0008');
});
