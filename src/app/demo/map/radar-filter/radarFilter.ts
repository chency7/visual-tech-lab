/**
 * 雷达图过滤模块的共享配置。
 *
 * 这里不做图片处理，只放地图边界、图层 ID 和调色板类型等稳定配置，
 * 方便 React 组件和 WebGL custom layer 复用同一套常量。
 */

import type maplibregl from 'maplibre-gl';
import { RADAR_COLOR_BANDS, type RadarColorBand } from './radarPalette';

// 雷达图覆盖中国区域的四角坐标，顺序必须与 MapLibre image source 保持一致：左上、右上、右下、左下。
export const RADAR_COORDINATES: [
  [number, number],
  [number, number],
  [number, number],
  [number, number],
] = [
  [73, 54.2],
  [135, 54.2],
  [135, 12.2],
  [73, 12.2],
];

export const RADAR_GPU_LAYER_ID = 'radar-gpu-layer';
export const RADAR_COMPARE_SOURCE_ID = 'radar-source';
export const RADAR_COMPARE_LAYER_ID = 'radar-raster-layer';

// 雷达图需要压在行政边界线下方，避免有色栅格遮住边界。
export const RADAR_BOUNDARY_LAYER_IDS = [
  'china-full-fill',
  'city-boundary',
  'shenxian-boundary',
] as const;

export type ThresholdRange = RadarColorBand;

/**
 * 当前示例使用固定色带。后续如果后台返回色带配置，可以只替换这里的来源。
 */
export function parseThresholds(): ThresholdRange[] {
  return RADAR_COLOR_BANDS;
}

/**
 * 找到雷达图应插入到哪个图层之前。
 *
 * MapLibre 的 addLayer(layer, beforeId) 会把新图层放在 beforeId 下方；
 * 这里优先找行政区面/线图层，让边界始终画在雷达图上面。
 */
export function getRadarLayerBeforeId(map: maplibregl.Map): string | undefined {
  return RADAR_BOUNDARY_LAYER_IDS.find((layerId) => map.getLayer(layerId));
}

/**
 * 应用 MapLibre 性能选项
 */
export function applyMapPerformanceOptions(map: maplibregl.Map): void {
  // 限制像素比为 2，避免高 DPR 屏幕过度超采样拖慢交互。
  map.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}
