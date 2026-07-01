import { featureCollection, isobands, polygon, point } from '@turf/turf';
import type maplibregl from 'maplibre-gl';
import type { Feature, FeatureCollection, MultiPolygon, Point, Polygon } from 'geojson';
import type {
  BoundsTuple,
  IdwConfig,
  IdwIsobandFeatureCollection,
  IdwLabelFeatureCollection,
  IdwWorkerPayload,
  IdwWorkerResult,
  RainThreshold,
  StationDatum,
} from '../types';
import { BOUNDARY_LAYER_IDS } from '../const';
import rainThresholds from '../mock/rain_thresholds.json';

type IdwDistance = { d: number; pre: number };
type StationBucketIndex = {
  cellSize: number;
  buckets: Map<string, StationDatum[]>;
};

function parseThresholds(
  thresholds: RainThreshold[],
  lastUpperSentinel = 10000
): { breaks: number[]; colors: string[] } {
  const breaks: number[] = [];
  const colors: string[] = [];

  let lastUpper: number | null = null;
  for (const threshold of thresholds) {
    const text = threshold.range.trim();
    const rangeMatch = text.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/);
    const gtMatch = text.match(/^>\s*(\d+(?:\.\d+)?)$/);
    if (rangeMatch) {
      const lower = parseFloat(rangeMatch[1]);
      const upper = parseFloat(rangeMatch[2]);
      breaks.push(lower);
      lastUpper = upper;
      colors.push(threshold.hex);
      continue;
    }

    if (gtMatch) {
      const lower = parseFloat(gtMatch[1]);
      breaks.push(lower);
      lastUpper = lastUpperSentinel;
      colors.push(threshold.hex);
    }
  }

  if (lastUpper != null) {
    breaks.push(lastUpper);
  }

  const sortedBreaks = Array.from(new Set(breaks)).sort((a, b) => a - b);
  const intervalCount = Math.max(1, sortedBreaks.length - 1);
  const colorList = colors.slice(0, intervalCount);
  if (sortedBreaks[0] === 0 && colorList.length > 0) {
    colorList[0] = '#FFFFFF';
  }

  return { breaks: sortedBreaks, colors: colorList };
}

export function resolveThresholds(
  config?: Pick<IdwConfig, 'breaks' | 'colors'>
): { breaks: number[]; colors: string[] } {
  const breaks = config?.breaks;
  const colors = config?.colors;
  if (
    Array.isArray(breaks) &&
    breaks.length >= 2 &&
    Array.isArray(colors) &&
    colors.length >= breaks.length - 1
  ) {
    return {
      breaks: [...breaks].sort((a, b) => a - b),
      colors: colors.slice(0, breaks.length - 1),
    };
  }

  return parseThresholds(rainThresholds as RainThreshold[]);
}

/**
 * 生成指定边界范围内的规则矩形网格（cols × rows）。
 * 注意：按经纬度线性划分，网格在墨卡托投影下实际尺寸会因纬度不同而变化。
 */
export function generateRectGrid(
  bbox: BoundsTuple,
  cols: number,
  rows: number
): FeatureCollection<Polygon> {
  const [[minLng, minLat], [maxLng, maxLat]] = bbox;
  const dx = (maxLng - minLng) / cols;
  const dy = (maxLat - minLat) / rows;

  const features: Feature<Polygon>[] = [];

  for (let i = 0; i < cols; i++) {
    const x0 = minLng + i * dx;
    const x1 = x0 + dx;
    for (let j = 0; j < rows; j++) {
      const y0 = minLat + j * dy;
      const y1 = y0 + dy;
      const ring = [
        [x0, y0],
        [x1, y0],
        [x1, y1],
        [x0, y1],
        [x0, y0],
      ];
      const value = Math.round(Math.random() * 300);
      features.push(polygon([ring], { value, i, j, cols, rows }));
    }
  }

  return featureCollection(features);
}

/**
 * 根据经纬度边界与目标间距（公里）近似计算网格分辨率（列/行）。
 * - 使用近似换算：1°纬度≈111.32km；1°经度≈111.32km×cos(纬度)
 * - 取边界中心纬度做经度换算，适用于省域尺度的近似计算
 */
export function computeGridResolutionFromSpacing(
  bbox: BoundsTuple,
  spacingKm: number
): { cols: number; rows: number } {
  const [[minLng, minLat], [maxLng, maxLat]] = bbox;
  const widthDeg = Math.max(0, maxLng - minLng);
  const heightDeg = Math.max(0, maxLat - minLat);
  const latMean = (minLat + maxLat) / 2;
  const metersPerDegLat = 111_320;
  const metersPerDegLon = Math.max(
    1,
    111_320 * Math.cos((latMean * Math.PI) / 180)
  );
  const spacingMeters = Math.max(1, spacingKm * 1000);
  const widthMeters = widthDeg * metersPerDegLon;
  const heightMeters = heightDeg * metersPerDegLat;

  return {
    cols: Math.max(1, Math.ceil(widthMeters / spacingMeters)),
    rows: Math.max(1, Math.ceil(heightMeters / spacingMeters)),
  };
}

/**
 * 为文字图层构建“等距采样”过滤表达式。
 */
export function buildLabelGridFilter(): any {
  return [
    'let',
    'k',
    [
      'case',
      ['<=', ['zoom'], 6],
      4,
      ['<=', ['zoom'], 7],
      3,
      ['<=', ['zoom'], 8],
      2,
      ['<=', ['zoom'], 9],
      1,
      1,
    ],
    [
      'all',
      ['==', ['%', ['get', 'i'], ['var', 'k']], 0],
      ['==', ['%', ['get', 'j'], ['var', 'k']], 0],
    ],
  ];
}

/**
 * 在给定边界内生成分散的随机点。
 */
export function generateDispersedRandomPoints(
  bbox: BoundsTuple,
  count: number
): FeatureCollection<Point> {
  const [[minLng, minLat], [maxLng, maxLat]] = bbox;
  const width = Math.max(0, maxLng - minLng);
  const height = Math.max(0, maxLat - minLat);
  const ratio = height === 0 ? 1 : width / height;

  let cols = Math.max(1, Math.round(Math.sqrt(count * ratio)));
  let rows = Math.max(1, Math.round(count / cols));
  while (cols * rows < count) {
    cols++;
    rows = Math.max(1, Math.round(count / cols));
  }

  const dx = width / cols;
  const dy = height / rows;

  const features: Feature<Point>[] = [];
  for (let i = 0; i < cols; i++) {
    const x0 = minLng + i * dx;
    const x1 = x0 + dx;
    for (let j = 0; j < rows; j++) {
      if (features.length >= count) break;
      const y0 = minLat + j * dy;
      const y1 = y0 + dy;
      const lng = x0 + Math.random() * (x1 - x0);
      const lat = y0 + Math.random() * (y1 - y0);
      features.push(point([lng, lat], { idx: features.length, i, j, cols, rows }));
    }
  }

  return featureCollection(features);
}

function bucketKey(ix: number, iy: number) {
  return `${ix}:${iy}`;
}

function buildStationBucketIndex(
  stations: StationDatum[],
  cellSize: number
): StationBucketIndex {
  const buckets = new Map<string, StationDatum[]>();

  for (const station of stations) {
    const ix = Math.floor(station.lon / cellSize);
    const iy = Math.floor(station.lat / cellSize);
    const key = bucketKey(ix, iy);
    const list = buckets.get(key);
    if (list) {
      list.push(station);
    } else {
      buckets.set(key, [station]);
    }
  }

  return { cellSize, buckets };
}

function collectCandidateStations(
  index: StationBucketIndex,
  cx: number,
  cy: number,
  neighbors?: number,
  maxDistanceDeg?: number
): StationDatum[] {
  const targetCount = Math.max(neighbors ?? 0, 8);
  const ix = Math.floor(cx / index.cellSize);
  const iy = Math.floor(cy / index.cellSize);
  const hardRingLimit = maxDistanceDeg
    ? Math.max(1, Math.ceil(maxDistanceDeg / index.cellSize))
    : 12;

  const visited = new Set<string>();
  const candidates: StationDatum[] = [];

  for (let ring = 0; ring <= hardRingLimit; ring++) {
    for (let x = ix - ring; x <= ix + ring; x++) {
      for (let y = iy - ring; y <= iy + ring; y++) {
        if (ring > 0 && x !== ix - ring && x !== ix + ring && y !== iy - ring && y !== iy + ring) {
          continue;
        }
        const key = bucketKey(x, y);
        if (visited.has(key)) continue;
        visited.add(key);
        const bucket = index.buckets.get(key);
        if (bucket) {
          candidates.push(...bucket);
        }
      }
    }

    if (maxDistanceDeg) {
      continue;
    }

    if (candidates.length >= targetCount) {
      break;
    }
  }

  return candidates;
}

function computeIdwValue(
  cx: number,
  cy: number,
  stations: StationDatum[],
  power: number,
  neighbors?: number,
  maxDistanceDeg?: number
) {
  const eps = 1e-9;
  const usable: IdwDistance[] = [];

  for (const station of stations) {
    const dlng = cx - station.lon;
    const dlat = cy - station.lat;
    // 经纬度距离矫正：1°经度 ≈ 111km × cos(lat)，补偿东西方向距离差异
    const cosLat = Math.cos((cy * Math.PI) / 180);
    const distance = Math.sqrt((dlng * cosLat) * (dlng * cosLat) + dlat * dlat);

    if (distance < eps) {
      return station.pre;
    }

    if (maxDistanceDeg && distance > maxDistanceDeg) {
      continue;
    }

    usable.push({ d: distance, pre: station.pre });
  }

  if (usable.length === 0) {
    return 0;
  }

  if (neighbors && neighbors > 0 && usable.length > neighbors) {
    usable.sort((a, b) => a.d - b.d);
    usable.length = neighbors;
  }

  let weightSum = 0;
  let valueSum = 0;
  for (const item of usable) {
    const weight = 1 / Math.pow(item.d + eps, power);
    weightSum += weight;
    valueSum += weight * item.pre;
  }

  return weightSum > 0 ? valueSum / weightSum : 0;
}

/**
 * 使用 Chaikin 角切割算法平滑多边形环。
 * 对应后端 Java Contour.smoothLines() 的平滑效果。
 * @param ring - 闭合环坐标数组（首尾相同）
 * @param iterations - 平滑迭代次数（推荐 2-3）
 */
function chaikinSmoothRing(ring: number[][], iterations: number = 3): number[][] {
  if (ring.length < 4) return ring;

  let result = ring;

  for (let iter = 0; iter < iterations; iter++) {
    const smoothed: number[][] = [];
    const n = result.length - 1;

    for (let i = 0; i < n; i++) {
      const [x0, y0] = result[i];
      const [x1, y1] = result[i + 1];
      smoothed.push([
        x0 * 0.75 + x1 * 0.25,
        y0 * 0.75 + y1 * 0.25,
      ]);
      smoothed.push([
        x0 * 0.25 + x1 * 0.75,
        y0 * 0.25 + y1 * 0.75,
      ]);
    }

    smoothed.push([...smoothed[0]]);
    result = smoothed;
  }

  return result;
}

function smoothFeatureCollection(
  fc: FeatureCollection<Polygon | MultiPolygon>,
  iterations: number = 0
): FeatureCollection<Polygon | MultiPolygon> {
  // iterations <= 0 时跳过平滑，直接返回原始数据
  if (iterations <= 0) return fc;

  return {
    ...fc,
    features: fc.features.map((feature) => {
      if (feature.geometry.type === 'Polygon') {
        return {
          ...feature,
          geometry: {
            ...feature.geometry,
            coordinates: (feature.geometry as Polygon).coordinates.map((ring) =>
              chaikinSmoothRing(ring as number[][], iterations)
            ),
          },
        };
      }
      if (feature.geometry.type === 'MultiPolygon') {
        return {
          ...feature,
          geometry: {
            ...feature.geometry,
            coordinates: (feature.geometry as MultiPolygon).coordinates.map((polygon) =>
              polygon.map((ring) => chaikinSmoothRing(ring as number[][], iterations))
            ),
          },
        };
      }
      return feature;
    }),
  };
}

function discretizeValueByBreaks(value: number, breaks: number[]) {
  if (breaks.length === 0) return value;

  if (value < breaks[0]) {
    return breaks[0] - 1;
  }

  const lastBreak = breaks[breaks.length - 1];
  if (value >= lastBreak) {
    return 1.5 * lastBreak;
  }

  for (let index = 0; index < breaks.length - 1; index++) {
    const lower = breaks[index];
    const upper = breaks[index + 1];
    if (value >= lower && value < upper) {
      return lower + (upper - lower) * 0.75;
    }
  }

  return value;
}

export function computeIdwWorkerResult(payload: IdwWorkerPayload): IdwWorkerResult {
  const {
    bbox,
    stations,
    config: {
      cols: colsOpt = 80,
      rows: rowsOpt = 80,
      gridSpacingKm,
      power = 2,
      neighbors,
      maxDistanceDeg,
      breaks: configBreaks,
      colors: configColors,
      smoothIterations = 3,
    },
  } = payload;

  const { cols, rows } =
    gridSpacingKm && gridSpacingKm > 0
      ? computeGridResolutionFromSpacing(bbox, gridSpacingKm)
      : { cols: colsOpt, rows: rowsOpt };

  const [[minLng, minLat], [maxLng, maxLat]] = bbox;
  const dx = (maxLng - minLng) / Math.max(1, cols);
  const dy = (maxLat - minLat) / Math.max(1, rows);

  const labelFeatures: IdwLabelFeatureCollection['features'] = [];
  const searchCellSize = Math.max(
    maxDistanceDeg ? maxDistanceDeg / 2 : Math.max(dx, dy) * 4,
    Math.max(dx, dy)
  );
  const bucketIndex = buildStationBucketIndex(stations, searchCellSize);

  const resolveValueAt = (lng: number, lat: number) => {
    let candidates = collectCandidateStations(
      bucketIndex,
      lng,
      lat,
      neighbors,
      maxDistanceDeg
    );

    if (candidates.length === 0 || (!maxDistanceDeg && neighbors && candidates.length < neighbors)) {
      candidates = stations;
    }

    return computeIdwValue(
      lng,
      lat,
      candidates,
      power,
      neighbors,
      maxDistanceDeg
    );
  };

  for (let i = 0; i < cols; i++) {
    const cx = minLng + (i + 0.5) * dx;
    for (let j = 0; j < rows; j++) {
      const cy = minLat + (j + 0.5) * dy;
      const value = resolveValueAt(cx, cy);

      labelFeatures.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [cx, cy] },
        properties: { value, i, j, cols, rows },
      });
    }
  }

  const { breaks, colors } = resolveThresholds({
    breaks: configBreaks,
    colors: configColors,
  });
  const discreteStations = stations.map((station) => ({
    ...station,
    pre: discretizeValueByBreaks(station.pre, breaks),
  }));
  const bandBucketIndex = buildStationBucketIndex(discreteStations, searchCellSize);
  const resolveBandValueAt = (lng: number, lat: number) => {
    let candidates = collectCandidateStations(
      bandBucketIndex,
      lng,
      lat,
      neighbors,
      maxDistanceDeg
    );

    if (candidates.length === 0 || (!maxDistanceDeg && neighbors && candidates.length < neighbors)) {
      candidates = discreteStations;
    }

    return computeIdwValue(
      lng,
      lat,
      candidates,
      power,
      neighbors,
      maxDistanceDeg
    );
  };
  const breakProperties = breaks.slice(0, -1).map((lower, index) => ({
    lower,
    upper: breaks[index + 1],
    colorIndex: index,
  }));
  const bandFeatures: IdwLabelFeatureCollection['features'] = [];
  for (let i = 0; i <= cols; i++) {
    const lng = minLng + i * dx;
    for (let j = 0; j <= rows; j++) {
      const lat = minLat + j * dy;
      bandFeatures.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lng, lat] },
        properties: { value: resolveBandValueAt(lng, lat), i, j, cols: cols + 1, rows: rows + 1 },
      });
    }
  }

  const isobandsFeatureCollection = smoothFeatureCollection(
    isobands(
      featureCollection(bandFeatures),
      breaks,
      {
        zProperty: 'value',
        breaksProperties: breakProperties,
      }
    ) as FeatureCollection<Polygon | MultiPolygon>,
    smoothIterations
  ) as IdwIsobandFeatureCollection;

  return {
    cols,
    rows,
    breaks,
    colors,
    labelFeatureCollection: featureCollection(labelFeatures),
    isobandsFeatureCollection,
  };
}

function upsertGeoJsonSource(
  map: maplibregl.Map,
  sourceId: string,
  data: FeatureCollection
) {
  if (!map.getSource(sourceId)) {
    map.addSource(sourceId, { type: 'geojson', data, tolerance: 0 });
    return;
  }

  const source = map.getSource(sourceId) as any;
  source.setData(data);
}

function buildIsobandColorExpression(breaks: number[], colors: string[]) {
  const expr: any[] = ['match', ['get', 'colorIndex']];
  for (let index = 0; index < Math.min(colors.length, breaks.length - 1); index++) {
    expr.push(index, colors[index]);
  }
  expr.push(colors[0] ?? 'rgba(255, 255, 255, 0)');
  return expr;
}

function getFirstBoundaryLayerId(map: maplibregl.Map) {
  return BOUNDARY_LAYER_IDS.find((layerId) => map.getLayer(layerId));
}

export function applyIdwResultToMap(
  map: maplibregl.Map,
  result: IdwWorkerResult,
  opts?: {
    sourceId?: string;
    labelId?: string;
    fillId?: string;
    minzoom?: number;
    hidePointsLayerId?: string;
    isobandsSourceId?: string;
    isobandsFillId?: string;
    isobandsFillOpacity?: number;
    createGridLabelLayer?: boolean;
  }
) {
  const {
    sourceId = 'hunan-idw-grid-source',
    labelId = 'hunan-idw-grid-labels',
    fillId = 'hunan-idw-grid-fill',
    minzoom = 6,
    hidePointsLayerId,
    isobandsSourceId = 'hunan-idw-isobands-source',
    isobandsFillId = 'hunan-idw-isobands-fill',
    isobandsFillOpacity = 0.9,
    createGridLabelLayer = true,
  } = opts || {};

  upsertGeoJsonSource(map, sourceId, result.labelFeatureCollection);
  upsertGeoJsonSource(map, isobandsSourceId, result.isobandsFeatureCollection);

  if (map.getLayer(fillId)) {
    map.setLayoutProperty(fillId, 'visibility', 'none');
  }

  const colorExpr = buildIsobandColorExpression(result.breaks, result.colors);
  const beforeBoundaryLayerId = getFirstBoundaryLayerId(map);
  if (!map.getLayer(isobandsFillId)) {
    map.addLayer({
      id: isobandsFillId,
      type: 'fill',
      source: isobandsSourceId,
      paint: {
        'fill-color': colorExpr as any,
        'fill-opacity': isobandsFillOpacity,
      },
    }, beforeBoundaryLayerId ?? (map.getLayer(labelId) ? labelId : undefined));
  } else {
    map.setPaintProperty(isobandsFillId, 'fill-color', colorExpr as any);
    map.setPaintProperty(isobandsFillId, 'fill-opacity', isobandsFillOpacity);
    map.setLayoutProperty(isobandsFillId, 'visibility', 'visible');
  }

  if (createGridLabelLayer && !map.getLayer(labelId)) {
    map.addLayer({
      id: labelId,
      type: 'symbol',
      source: sourceId,
      minzoom,
      layout: {
        'text-field': ['to-string', ['/', ['round', ['*', ['get', 'value'], 10]], 10]],
        'text-size': 10,
        'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
        'symbol-placement': 'point',
      },
      paint: {
        'text-color': '#111827',
        'text-halo-color': '#ffffff',
        'text-halo-width': 0.5,
      },
      filter: buildLabelGridFilter(),
    });
  } else if (createGridLabelLayer) {
    map.setLayoutProperty(labelId, 'visibility', 'visible');
  }

  if (map.getLayer(isobandsFillId)) {
    const beforeLayerId = getFirstBoundaryLayerId(map) ?? (map.getLayer(labelId) ? labelId : undefined);
    if (beforeLayerId) {
      map.moveLayer(isobandsFillId, beforeLayerId);
    }
  }

  if (hidePointsLayerId && map.getLayer(hidePointsLayerId)) {
    map.setLayoutProperty(hidePointsLayerId, 'visibility', 'none');
  }
}

export function setIdwResultVisibility(
  map: maplibregl.Map,
  visible: boolean,
  opts?: {
    labelId?: string;
    isobandsFillId?: string;
    pointsLayerId?: string;
  }
) {
  const {
    labelId = 'hunan-idw-grid-labels',
    isobandsFillId = 'hunan-idw-isobands-fill',
    pointsLayerId,
  } = opts || {};

  if (map.getLayer(labelId)) {
    map.setLayoutProperty(labelId, 'visibility', visible ? 'visible' : 'none');
  }

  if (map.getLayer(isobandsFillId)) {
    map.setLayoutProperty(isobandsFillId, 'visibility', visible ? 'visible' : 'none');
  }

  if (pointsLayerId && map.getLayer(pointsLayerId)) {
    map.setLayoutProperty(pointsLayerId, 'visibility', visible ? 'none' : 'visible');
  }
}

export function setIdwLayerVisibility(
  map: maplibregl.Map,
  visibility: {
    labels?: boolean;
    isobands?: boolean;
  },
  opts?: {
    labelId?: string;
    isobandsFillId?: string;
  }
) {
  const {
    labelId = 'hunan-idw-grid-labels',
    isobandsFillId = 'hunan-idw-isobands-fill',
  } = opts || {};

  if (visibility.labels != null && map.getLayer(labelId)) {
    map.setLayoutProperty(labelId, 'visibility', visibility.labels ? 'visible' : 'none');
  }

  if (visibility.isobands != null && map.getLayer(isobandsFillId)) {
    map.setLayoutProperty(
      isobandsFillId,
      'visibility',
      visibility.isobands ? 'visible' : 'none'
    );
  }
}
