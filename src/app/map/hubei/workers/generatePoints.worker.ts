import { bbox, booleanPointInPolygon } from '@turf/turf';
import type { FeatureCollection, Polygon, MultiPolygon, Feature, Point } from 'geojson';

type JsonPrimitive = string | number | boolean | null;
type JsonArray = JsonValue[];
type JsonObject = { [key: string]: JsonValue };
type JsonValue = JsonPrimitive | JsonArray | JsonObject;

interface GeneratePayload {
  hb: FeatureCollection<Polygon | MultiPolygon>;
  count: number;
  templateProps: JsonObject | null;
  idOffset?: number;
}

interface WorkerRequest {
  type: 'generate';
  requestId: number;
  payload: GeneratePayload;
}

interface WorkerResponse {
  requestId: number;
  fc: FeatureCollection<Point>;
}

// 生成指定数量的湖北省内随机点
function generatePoints(
  hb: FeatureCollection<Polygon | MultiPolygon>,
  count: number,
  templateProps: JsonObject | null,
  idOffset: number = 0
): FeatureCollection<Point> {
  const b = bbox(hb); // [minLng, minLat, maxLng, maxLat]
  const minLng = b[0];
  const minLat = b[1];
  const maxLng = b[2];
  const maxLat = b[3];

  const features: Feature<Point>[] = [];
  let attempts = 0;
  const maxAttempts = Math.max(1000, count * 50);

  while (features.length < count && attempts < maxAttempts) {
    attempts++;
    const lng = minLng + Math.random() * (maxLng - minLng);
    const lat = minLat + Math.random() * (maxLat - minLat);
    const candidate: Feature<Point> = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lng, lat] },
      properties: {},
    };

    let inside = false;
    for (const f of hb.features) {
      if (booleanPointInPolygon(candidate, f as any)) {
        inside = true;
        break;
      }
    }
    if (inside) {
      const idx = features.length + 1;
      features.push({
        type: 'Feature',
        id: `gen-${idOffset + idx}`,
        geometry: candidate.geometry,
        properties: {
          source: 'generated',
          idx,
          ...(templateProps ?? {}),
        },
      });
    }
  }

  return { type: 'FeatureCollection', features };
}

// Worker 消息入口
self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const data = e.data;
  if (!data || data.type !== 'generate') return;
  const { hb, count, templateProps, idOffset = 0 } = data.payload;
  const fc = generatePoints(hb, count, templateProps, idOffset);
  const resp: WorkerResponse = { requestId: data.requestId, fc };
  // 发送结果
  (self as any).postMessage(resp);
};