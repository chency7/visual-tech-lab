import React, { useState } from 'react';
import type { JsonValue, JsonObject, JsonArray } from '../types';

interface JsonViewerProps {
  data: JsonValue;
  search?: string;
}

export function JsonViewer({ data, search = '' }: JsonViewerProps) {
  return (
    <div className="font-mono text-xs leading-6">
      <JsonNode value={data} path={[]} search={search} depth={0} />
    </div>
  );
}

function JsonNode({ value, path, search, depth }: { value: JsonValue; path: string[]; search: string; depth: number }) {
  const indent = { paddingLeft: `${depth * 12}px` };
  if (Array.isArray(value)) {
    return <ArrayNode value={value as JsonArray} path={path} search={search} depth={depth} />;
  }
  if (value !== null && typeof value === 'object') {
    return <ObjectNode value={value as JsonObject} path={path} search={search} depth={depth} />;
  }
  return <PrimitiveNode value={value} style={indent} search={search} />;
}

function PrimitiveNode({ value, style, search }: { value: string | number | boolean | null; style: React.CSSProperties; search: string }) {
  const text = value === null ? 'null' : typeof value === 'string' ? `"${value}"` : String(value);
  const highlighted = highlight(text, search);
  return <div style={style} className="text-zinc-800 dark:text-zinc-200" dangerouslySetInnerHTML={{ __html: highlighted }} />;
}

function ObjectNode({ value, path, search, depth }: { value: JsonObject; path: string[]; search: string; depth: number }) {
  const [open, setOpen] = useState(true);
  const keys = Object.keys(value);
  return (
    <div>
      <div className="flex items-center" style={{ paddingLeft: `${depth * 12}px` }}>
        <button className="mr-1 rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] dark:bg-zinc-800" onClick={() => setOpen(!open)}>
          {open ? '-' : '+'}
        </button>
        <span className="text-zinc-500">{'{'}{keys.length} keys{'}'}</span>
      </div>
      {open && (
        <div>
          {keys.map((k) => (
            <div key={k} className="flex" style={{ paddingLeft: `${(depth + 1) * 12}px` }}>
              <span className="mr-2 text-blue-700 dark:text-blue-300">{k}:</span>
              <JsonNode value={value[k]} path={[...path, k]} search={search} depth={depth + 1} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ArrayNode({ value, path, search, depth }: { value: JsonArray; path: string[]; search: string; depth: number }) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <div className="flex items-center" style={{ paddingLeft: `${depth * 12}px` }}>
        <button className="mr-1 rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] dark:bg-zinc-800" onClick={() => setOpen(!open)}>
          {open ? '-' : '+'}
        </button>
        <span className="text-zinc-500">[ {value.length} ]</span>
      </div>
      {open && (
        <div>
          {value.map((v, i) => (
            <div key={i} className="flex" style={{ paddingLeft: `${(depth + 1) * 12}px` }}>
              <span className="mr-2 text-purple-700 dark:text-purple-300">{i}:</span>
              <JsonNode value={v} path={[...path, String(i)]} search={search} depth={depth + 1} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function highlight(text: string, query: string): string {
  if (!query) return escapeHtml(text);
  const safe = escapeHtml(text);
  const idx = safe.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return safe;
  const before = safe.slice(0, idx);
  const mid = safe.slice(idx, idx + query.length);
  const after = safe.slice(idx + query.length);
  return `${before}<mark class="bg-yellow-200 dark:bg-yellow-700">${mid}</mark>${after}`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}