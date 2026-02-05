import type { FeatureCollection, Polygon, MultiPolygon, Feature } from 'geojson';

// 根据 adcode 是否以 00 结尾区分市级与区县级
export function splitCityAndDistrict(
  fc: FeatureCollection<Polygon | MultiPolygon>
): {
  cityFC: FeatureCollection<Polygon | MultiPolygon>;
  districtFC: FeatureCollection<Polygon | MultiPolygon>;
} {
  const cityFeatures: Feature<Polygon | MultiPolygon>[] = [];
  const districtFeatures: Feature<Polygon | MultiPolygon>[] = [];

  for (const f of fc.features) {
    const props = (f.properties ?? {}) as Record<string, unknown>;
    const codeRaw = props['adcode'];
    let code: number | null = null;
    if (typeof codeRaw === 'number') code = codeRaw;
    else if (typeof codeRaw === 'string') {
      const n = Number(codeRaw);
      code = Number.isFinite(n) ? n : null;
    }

    // 缺少 adcode 的要么忽略，要么默认归入区县
    if (code === null) {
      districtFeatures.push(f as Feature<Polygon | MultiPolygon>);
      continue;
    }

    if (code % 100 === 0) cityFeatures.push(f as Feature<Polygon | MultiPolygon>);
    else districtFeatures.push(f as Feature<Polygon | MultiPolygon>);
  }

  return {
    cityFC: {
      type: 'FeatureCollection',
      features: cityFeatures,
    },
    districtFC: {
      type: 'FeatureCollection',
      features: districtFeatures,
    },
  };
}