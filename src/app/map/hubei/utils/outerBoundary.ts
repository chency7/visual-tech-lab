import type { FeatureCollection, Polygon, MultiPolygon, Feature } from 'geojson';

// 提取最外层边界为 MultiPolygon，不包含洞，保留基本属性
export function extractOuterBoundary(
  fc: FeatureCollection<Polygon | MultiPolygon>
): FeatureCollection<MultiPolygon> {
  const outerCoords: number[][][][] = [];

  for (const f of fc.features) {
    const g = (f as Feature<Polygon | MultiPolygon>).geometry;
    if (!g) continue;
    if (g.type === 'Polygon') {
      const outer = g.coordinates[0];
      if (outer && outer.length) outerCoords.push([outer]);
    } else if (g.type === 'MultiPolygon') {
      for (const poly of g.coordinates) {
        const outer = poly[0];
        if (outer && outer.length) outerCoords.push([outer]);
      }
    }
  }

  const out: FeatureCollection<MultiPolygon> = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {
          name: '湖北省最外层边界',
          adcode: 420000,
          source: 'aliyun areas_v3 bound 420000_full',
        },
        geometry: {
          type: 'MultiPolygon',
          coordinates: outerCoords,
        },
      },
    ],
  };

  return out;
}