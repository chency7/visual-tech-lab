import { promises as fs } from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);

function readArg(name, def) {
  const idx = argv.indexOf(`--${name}`);
  if (idx !== -1 && idx + 1 < argv.length) return argv[idx + 1];
  return def;
}

const cwd = process.cwd();
const inputDir = path.resolve(readArg('input', path.join(cwd, 'public', 'json')));
const outputDir = path.resolve(readArg('output', path.join(cwd, 'public', 'json', 'generated')));

function toCamelCase(str) {
  return String(str)
    .replace(/[-_\s]+([a-zA-Z0-9])/g, (_, c) => c.toUpperCase())
    .replace(/^[A-Z]/, (c) => c.toLowerCase());
}

function isPlainObject(v) {
  return Object.prototype.toString.call(v) === '[object Object]';
}

function canonicalStringify(value) {
  const seen = new WeakSet();
  function sortKeys(obj) {
    if (obj === null) return null;
    if (typeof obj !== 'object') return obj;
    if (seen.has(obj)) return null;
    seen.add(obj);
    if (Array.isArray(obj)) return obj.map(sortKeys);
    const keys = Object.keys(obj).sort();
    const out = {};
    for (const k of keys) out[k] = sortKeys(obj[k]);
    return out;
  }
  return JSON.stringify(sortKeys(value));
}

function dedupeArray(arr) {
  const set = new Set();
  const out = [];
  for (const item of arr) {
    const key = canonicalStringify(item);
    if (!set.has(key)) {
      set.add(key);
      out.push(item);
    }
  }
  return out;
}

function coerceValue(v) {
  if (typeof v === 'string') {
    const s = v.trim();
    if (/^[-+]?\d+(?:\.\d+)?$/.test(s)) {
      const n = Number(s);
      if (Number.isFinite(n)) return n;
    }
    return s;
  }
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return null;
    return v;
  }
  if (v === null || v === undefined) return null;
  return v;
}

function transformValue(value) {
  if (Array.isArray(value)) {
    const arr = value.map((v) => transformValue(v)).filter((v) => v !== null && v !== undefined);
    return dedupeArray(arr);
  }
  if (isPlainObject(value)) {
    const entries = Object.entries(value);
    const out = {};
    for (const [k, v] of entries) {
      const nk = toCamelCase(k);
      const tv = transformValue(v);
      if (tv !== null && tv !== undefined) out[nk] = tv;
    }
    return out;
  }
  return coerceValue(value);
}

async function ensureDir(p) {
  try {
    await fs.mkdir(p, { recursive: true });
  } catch {}
}

async function listJsonFiles(dir, ignoreDirs) {
  const res = [];
  const ents = await fs.readdir(dir, { withFileTypes: true });
  for (const ent of ents) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ignoreDirs.has(ent.name)) continue;
      const nested = await listJsonFiles(p, ignoreDirs);
      for (const n of nested) res.push(n);
    } else if (ent.isFile()) {
      if (/\.(?:json|geojson)$/i.test(ent.name)) res.push(p);
    }
  }
  return res;
}

async function readJsonSafe(p) {
  try {
    const raw = await fs.readFile(p, 'utf8');
    return { ok: true, data: JSON.parse(raw) };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

async function writeJsonSafe(p, data) {
  try {
    const json = JSON.stringify(data, null, 2);
    await fs.writeFile(p, json, 'utf8');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

async function main() {
  const ignoreDirs = new Set(['generated']);
  await ensureDir(outputDir);
  const files = await listJsonFiles(inputDir, ignoreDirs);
  const results = [];
  let processed = 0;
  let written = 0;
  let errors = 0;

  for (const file of files) {
    const rel = path.relative(inputDir, file);
    const outPath = path.join(outputDir, rel);
    const outDirname = path.dirname(outPath);
    await ensureDir(outDirname);
    const rd = await readJsonSafe(file);
    if (!rd.ok) {
      results.push({ file: rel, ok: false, error: rd.error });
      errors++;
      continue;
    }

    let data = rd.data;
    if (isPlainObject(data) && data.type === 'FeatureCollection' && Array.isArray(data.features)) {
      const features = data.features.map((f) => {
        if (isPlainObject(f)) {
          const g = f.geometry;
          const p = isPlainObject(f.properties) ? transformValue(f.properties) : {};
          const rest = { ...f };
          delete rest.properties;
          return { ...rest, properties: p, geometry: g };
        }
        return f;
      });
      data = { ...data, features };
    } else {
      data = transformValue(data);
    }

    const wr = await writeJsonSafe(outPath, data);
    processed++;
    if (!wr.ok) {
      results.push({ file: rel, ok: false, error: wr.error });
      errors++;
    } else {
      results.push({ file: rel, ok: true, output: path.relative(cwd, outPath) });
      written++;
    }
  }

  const summary = {
    inputDir: path.relative(cwd, inputDir),
    outputDir: path.relative(cwd, outputDir),
    processed,
    written,
    errors,
    files: results,
    timestamp: Date.now(),
  };

  process.stdout.write(JSON.stringify(summary));
}

main().catch((e) => {
  const err = { ok: false, error: String(e), timestamp: Date.now() };
  process.stdout.write(JSON.stringify(err));
  process.exit(1);
});
