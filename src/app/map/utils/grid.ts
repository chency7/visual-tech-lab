import { featureCollection, polygon, point } from '@turf/helpers';
import isobands from '@turf/isobands';
import type { Feature, FeatureCollection, Polygon, Point } from 'geojson';
import type { BoundsTuple } from '../types';

/**
 * 生成指定边界范围内的规则矩形网格（cols × rows）。
 * 注意：按经纬度线性划分，网格在墨卡托投影下实际尺寸会因纬度不同而变化。
 */
export function generateRectGrid(bbox: BoundsTuple, cols: number, rows: number): FeatureCollection<Polygon> {
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
      const feat = polygon([ring], { value, i, j, cols, rows });
      features.push(feat);
    }
  }

  return featureCollection(features);
}

/**
 * 为文字图层构建“等距采样”过滤表达式：
 * - zoom<=6 显示约 10×10（步长 k=10）
 * - 6<zoom<=7 显示约 20×20（k=5）
 * - 7<zoom<=8 显示约 40×40（k=3）
 * - 8<zoom<=9 显示约 80×80（k=2）
 * - zoom>9 显示全部（k=1）
 * 通过 i/j 索引做整除筛选，只影响文字图层。
 */
export function buildLabelGridFilter(): any {
  return [
    'let', 'k',
    ['case',
      ['<=', ['zoom'], 6], 4,
      ['<=', ['zoom'], 7], 3,
      ['<=', ['zoom'], 8], 2,
      ['<=', ['zoom'], 9], 1,
      1
    ],
    ['any',
      ['all',
        ['==', ['%', ['get', 'i'], ['var', 'k']], 0],
        ['==', ['%', ['get', 'j'], ['var', 'k']], 0]
      ]
    ]
  ];
}

/**
 * 在给定边界（湖南省近似边界框）内生成分散的随机点。
 * 使用分层（格网）采样：将边界按列×行切分，每个格内放置一个随机点，避免过度聚集。
 */
export function generateDispersedRandomPoints(bbox: BoundsTuple, count: number): FeatureCollection<Point> {
  const [[minLng, minLat], [maxLng, maxLat]] = bbox;
  const width = Math.max(0, maxLng - minLng);
  const height = Math.max(0, maxLat - minLat);
  const ratio = height === 0 ? 1 : width / height;

  // 根据长宽比计算接近 count 的列/行数（cols*rows ≈ count）
  let cols = Math.max(1, Math.round(Math.sqrt(count * ratio)));
  let rows = Math.max(1, Math.round(count / cols));
  // 防御性调整，保证至少能容纳 count
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
      // 在格子内均匀随机取点，保证分散
      const lng = x0 + Math.random() * (x1 - x0);
      const lat = y0 + Math.random() * (y1 - y0);
      features.push(point([lng, lat], { idx: features.length, i, j, cols, rows }));
    }
  }

  return featureCollection(features);
}

// 站点数据结构（经纬度与数值）
export type StationDatum = { lon: number; lat: number; pre: number };

/**
 * 将离散站点转换为格点数据（IDW 插值）。
 * - bbox: 插值范围（湖南省边界框）
 * - cols/rows: 网格分辨率
 * - stations: 站点数组（lon/lat/pre）
 * - power: 距离幂次（默认 2）
 * 注意：距离使用经纬度近似欧氏距离，适用于省域尺度近似计算。
 */
export function idwInterpolateToGrid(
  bbox: BoundsTuple,
  cols: number,
  rows: number,
  stations: StationDatum[],
  power = 2,
  opts?: { neighbors?: number; maxDistanceDeg?: number }
): FeatureCollection<Polygon> {
  const [[minLng, minLat], [maxLng, maxLat]] = bbox;
  const dx = (maxLng - minLng) / Math.max(1, cols);
  const dy = (maxLat - minLat) / Math.max(1, rows);
  const eps = 1e-9;

  const features: Feature<Polygon>[] = [];

  for (let i = 0; i < cols; i++) {
    const x0 = minLng + i * dx;
    const x1 = x0 + dx;
    const cx = (x0 + x1) / 2;
    for (let j = 0; j < rows; j++) {
      const y0 = minLat + j * dy;
      const y1 = y0 + dy;
      const cy = (y0 + y1) / 2;

      // 计算到各站点的距离
      const distances: { d: number; pre: number }[] = [];
      for (let k = 0; k < stations.length; k++) {
        const s = stations[k];
        const dlng = cx - s.lon;
        const dlat = cy - s.lat;
        const d = Math.sqrt(dlng * dlng + dlat * dlat);
        distances.push({ d, pre: s.pre });
      }

      // 若设置最大半径，过滤过远的点
      const maxD = opts?.maxDistanceDeg;
      let usable = maxD ? distances.filter((it) => it.d <= maxD) : distances;

      // 若设置最近邻数，选取最近的 K 个点
      const neighbors = opts?.neighbors;
      if (neighbors && neighbors > 0 && usable.length > neighbors) {
        usable = usable.sort((a, b) => a.d - b.d).slice(0, neighbors);
      }

      // 若有点与中心非常接近，直接取其值
      const exact = usable.find((it) => it.d < eps);
      let weightSum = 0;
      let valueSum = 0;
      let exactValue: number | null = exact ? exact.pre : null;

      if (exactValue == null) {
        for (let u of usable) {
          const w = 1 / Math.pow(u.d + eps, power);
          weightSum += w;
          valueSum += w * u.pre;
        }
      }

      const value = exactValue != null ? exactValue : (weightSum > 0 ? valueSum / weightSum : 0);

      const ring = [
        [x0, y0],
        [x1, y0],
        [x1, y1],
        [x0, y1],
        [x0, y0],
      ];
      const feat = polygon([ring], { value, i, j, cols, rows });
      features.push(feat);
    }
  }

  return featureCollection(features);
}

// 已移除：等值面色斑专用的点插值函数

/**
 * 应用 IDW 插值并以文字标签方式显示（
 * - 在地图上添加/更新数据源与标签图层；可选择隐藏原点标签图层。
 */
export function applyIdwToLabelLayer(
  map: maplibregl.Map,
  bbox: BoundsTuple,
  stations: StationDatum[],
  opts?: {
    cols?: number;
    rows?: number;
    power?: number;
    sourceId?: string;
    labelId?: string;
    fillId?: string;
    minzoom?: number;
    hidePointsLayerId?: string;
    neighbors?: number;
    maxDistanceDeg?: number;
  }
) {
  const {
    cols = 80,
    rows = 80,
    power = 2,
    sourceId = 'hunan-idw-grid-source',
    labelId = 'hunan-idw-grid-labels',
    fillId = 'hunan-idw-grid-fill',
    minzoom = 6,
    hidePointsLayerId,
  } = opts || {};

  const gridFC = idwInterpolateToGrid(bbox, cols, rows, stations, power, {
    neighbors: opts?.neighbors,
    maxDistanceDeg: opts?.maxDistanceDeg,
  });

  console.log('gridFC', gridFC)

  if (!map.getSource(sourceId)) {
    map.addSource(sourceId, { type: 'geojson', data: gridFC, tolerance: 0 });
  } else {
    const src: any = map.getSource(sourceId);
    src.setData(gridFC);
  }

  // 可选：隐藏已有填充网格
  if (map.getLayer(fillId)) {
    map.setLayoutProperty(fillId, 'visibility', 'none');
  }

  if (!map.getLayer(labelId)) {
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
  } else {
    map.setLayoutProperty(labelId, 'visibility', 'visible');
  }

  if (hidePointsLayerId && map.getLayer(hidePointsLayerId)) {
    map.setLayoutProperty(hidePointsLayerId, 'visibility', 'none');
  }
}

/**
 * 基于 IDW 生成格点后，使用 Turf.isobands 生成等值面色斑，并以填充图层显示。
 */
export function applyIdwIsobandsFillLayer(
  map: any,
  bbox: BoundsTuple,
  stations: StationDatum[],
  opts?: {
    cols?: number;
    rows?: number;
    power?: number;
    sourceId?: string;
    fillId?: string;
    hidePointsLayerId?: string;
    hideLabelLayerId?: string;
    breaks?: number[];
    colors?: string[];
    neighbors?: number;
    maxDistanceDeg?: number;
  }
) {
  const {
    cols = 80,
    rows = 80,
    power = 2,
    sourceId = 'hunan-idw-isobands-source',
    fillId = 'hunan-idw-isobands-fill',
    hidePointsLayerId,
    hideLabelLayerId,
    breaks = [0, 0.1, 10, 25, 50, 100, 250, 400, 600],
    colors = ['#FAFAFA', '#AAF0AA', '#50C878', '#3CB4F0', '#1464DC', '#F064C8', '#B43CA0', '#FFB428', '#FF3C28'],
    neighbors,
    maxDistanceDeg,
  } = opts || {};

  const gridFC = idwInterpolateToGrid(bbox, cols, rows, stations, power, { neighbors, maxDistanceDeg });

  // Turf.isobands 
  const bands = isobands(gridFC as any, breaks, { zProperty: 'value' });

  // 若颜色数量不匹配，做防御性截断
  const colorList = colors.slice(0, Math.max(0, breaks.length - 1));

  if (!map.getSource(sourceId)) {
    map.addSource(sourceId, { type: 'geojson', data: bands, tolerance: 0 });
  } else {
    const src: any = map.getSource(sourceId);
    src.setData(bands);
  }

  // 构造按上界匹配的颜色表达式（isobands 结果含 lower/upper 属性）
  const colorExpr: any[] = ['case'];
  for (let i = 0; i < colorList.length; i++) {
    const upper = breaks[i + 1];
    colorExpr.push(['<=', ['get', 'upper'], upper], colorList[i]);
  }
  colorExpr.push('#888888');

  if (!map.getLayer(fillId)) {
    map.addLayer({
      id: fillId,
      type: 'fill',
      source: sourceId,
      paint: {
        'fill-color': colorExpr as any,
        'fill-opacity': 0.35,
      },
    });
  } else {
    map.setLayoutProperty(fillId, 'visibility', 'visible');
  }

  if (hidePointsLayerId && map.getLayer(hidePointsLayerId)) {
    map.setLayoutProperty(hidePointsLayerId, 'visibility', 'none');
  }
  if (hideLabelLayerId && map.getLayer(hideLabelLayerId)) {
    map.setLayoutProperty(hideLabelLayerId, 'visibility', 'none');
  }
}

