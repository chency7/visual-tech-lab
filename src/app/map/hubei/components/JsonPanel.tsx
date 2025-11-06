import React, { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { JsonViewer } from './JsonViewer';
import { downloadJson } from '../utils/export';
import type { JsonValue } from '../types';

interface JsonPanelProps {
  initialData: JsonValue;
  raw?: string;
  onRawChange?: (next: string) => void;
  onApply?: (parsed: JsonValue) => void;
}

export function JsonPanel({ initialData, raw, onRawChange, onApply }: JsonPanelProps) {
  const [internalRaw, setInternalRaw] = useState<string>(JSON.stringify(initialData, null, 2));
  const rawValue = raw !== undefined ? raw : internalRaw;
  const setRawValue = (next: string) => {
    if (onRawChange) onRawChange(next);
    else setInternalRaw(next);
  };
  const [search, setSearch] = useState<string>('');

  const parsed = useMemo<JsonValue | null>(() => {
    try {
      const obj = JSON.parse(rawValue) as JsonValue;
      return obj;
    } catch {
      return null;
    }
  }, [rawValue]);

  const valid = parsed !== null;

  const onImport = async (file: File) => {
    const text = await file.text();
    setRawValue(text);
  };

  const onExport = () => {
    if (!parsed) return;
    downloadJson('hubei-data.json', parsed);
  };

  const onCopy = async () => {
    await navigator.clipboard.writeText(rawValue);
  };

  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <Card className="flex items-center justify-between p-3">
        <div className="flex items-center gap-2">
          <input
            value={search}
            placeholder="搜索关键词"
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-48 rounded border border-zinc-300 px-2 text-xs outline-none dark:border-zinc-700 dark:bg-zinc-900"
          />
          <span
            className={`rounded px-2 py-1 text-xs ${valid ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200'}`}
          >
            JSON {valid ? '有效' : '无效'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1 rounded bg-zinc-100 px-2 py-1 text-xs dark:bg-zinc-800">
            导入
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => e.target.files && onImport(e.target.files[0])}
            />
          </label>
          <button
            onClick={onCopy}
            className="rounded bg-zinc-100 px-2 py-1 text-xs dark:bg-zinc-800"
          >
            复制
          </button>
          <button
            onClick={onExport}
            disabled={!valid}
            className="rounded bg-zinc-900 px-2 py-1 text-xs text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            导出
          </button>
          {onApply ? (
            <button
              onClick={() => parsed && onApply(parsed)}
              disabled={!valid}
              className="rounded bg-blue-600 px-2 py-1 text-xs text-white disabled:opacity-50 dark:bg-blue-500"
            >
              应用到选中点
            </button>
          ) : null}
        </div>
      </Card>

      <div className="grid h-full grid-cols-2 gap-3">
        <Card className="flex h-full flex-col">
          <div className="border-b border-zinc-200 p-2 text-xs text-zinc-500 dark:border-zinc-800">
            JSON 原始数据
          </div>
          <textarea
            value={rawValue}
            onChange={(e) => setRawValue(e.target.value)}
            spellCheck={false}
            className="h-full w-full flex-1 resize-none bg-transparent p-3 font-mono text-xs outline-none"
          />
        </Card>

        <Card className="flex h-full flex-col">
          <div className="border-b border-zinc-200 p-2 text-xs text-zinc-500 dark:border-zinc-800">
            JSON 可视化
          </div>
          <div className="h-full overflow-auto p-3">
            {parsed ? (
              <JsonViewer data={parsed} search={search} />
            ) : (
              <div className="text-xs text-red-600">JSON 解析失败</div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
