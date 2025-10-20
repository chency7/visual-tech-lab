export const runtime = 'nodejs';

export async function GET() {
  return Response.json({ status: 'ok', body: 'health', timestamp: Date.now() });
}