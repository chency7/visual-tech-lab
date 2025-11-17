import { spawn } from 'node:child_process';
import path from 'node:path';

export const runtime = 'nodejs';

export async function POST() {
  const scriptPath = path.join(process.cwd(), 'public', 'json', 'transform-json.mjs');
  const inputDir = path.join(process.cwd(), 'public', 'json');
  const outputDir = path.join(process.cwd(), 'public', 'json', 'generated');

  const child = spawn(process.execPath, [scriptPath, '--input', inputDir, '--output', outputDir], {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  });

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (d) => (stdout += d.toString()));
  child.stderr.on('data', (d) => (stderr += d.toString()));

  const exitCode: number = await new Promise((resolve) => {
    child.on('close', (code) => resolve(code ?? 0));
  });

  try {
    const parsed = stdout.trim() ? JSON.parse(stdout.trim()) : null;
    if (exitCode === 0) return Response.json({ ok: true, result: parsed });
    return new Response(JSON.stringify({ ok: false, result: parsed, error: stderr.trim() }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  } catch {
    if (exitCode === 0)
      return Response.json({ ok: true, output: stdout.trim(), error: stderr.trim() });
    return new Response(JSON.stringify({ ok: false, output: stdout.trim(), error: stderr.trim() }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}