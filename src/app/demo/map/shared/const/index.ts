import type { StyleSpecification } from 'maplibre-gl';
import type { BoundsTuple, LngLatTuple } from '../types';

// 湖南省边界近似范围（经纬度）
export const HUNAN_BOUNDS: BoundsTuple = [
  [108.29, 24.38],
  [114.77, 30.45],
];

// 后台 ContourUtil 使用的固定色斑矩形范围与 59×59 节点网格
export const HUNAN_CONTOUR_BOUNDS: BoundsTuple = [
  [108.6, 24.5],
  [114.4, 30.3],
];
export const HUNAN_CONTOUR_GRID_NODES = 59;

// 应用整体允许的视野范围（中国境内更宽范围）
export const APP_BOUNDS: BoundsTuple = [
  [99.50, 20.89],
  [125.03, 33.52],
];

// 默认视图参数
export const DEFAULT_CENTER: LngLatTuple = [111.53897, 27.7573];
export const DEFAULT_ZOOM = 6.3;
export const MIN_ZOOM = 5;
export const MAX_ZOOM = 18;

export const BOUNDARY_LAYER_IDS = ['city-boundary', 'shenxian-boundary'] as const;

// 矢量样式
export function foxGisVectorStyle(): StyleSpecification {
  return {
    version: 8,
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
      '430000': {
        type: 'vector',
        tiles: ['http://10.111.100.230:1235/api/tilesets/430000/{z}/{x}/{y}.pbf'],
        attribution: '© FoxGIS 湖南省瓦片',
      },
      '430000.city': {
        type: 'vector',
        tiles: ['http://10.111.100.230:1235/api/tilesets/430000.city/{z}/{x}/{y}.pbf'],
      },
    },
    layers: [
      {
        id: 'city-boundary',
        type: 'line',
        source: '430000.city',
        'source-layer': '430000.city',
        layout: {},
        minzoom: 0,
        paint: { 'line-color': '#9e9e9e' },
      },
      {
        id: 'shenxian-boundary',
        type: 'line',
        source: '430000',
        'source-layer': '430000',
        layout: {},
        minzoom: 0,
        paint: { 'line-color': 'black', 'line-width': 2 },
      },
    ],
  };
}
