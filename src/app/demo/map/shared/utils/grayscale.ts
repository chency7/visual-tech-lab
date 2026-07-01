'use client';

/**
 * 将 IDW 网格数据编码为 1 通道灰度 PNG（R = 归一化后的降水值）。
 *
 * 灰度图是数据载体，不是渲染结果：
 *   - 格点数据过于密集时，HTTP 传输压力大
 *   - 用灰度图的单个分量（R 通道）来表达数值
 *   - WebGL 着色器解析 R 通道，结合色阶映射填成具体颜色
 *
 * 归一化方式：按 breaks 值域归一化（标准做法）
 *   R = (value - breaks[0]) / (breaks[last] - breaks[0]) × 255
 *   这样 shader 中 texture2D().r 直接就是色阶位置 [0,1]，无需额外转换
 */

import type { IdwLabelFeatureCollection } from '../types';

/** 灰度图 + 描述头 */
export interface GrayscalePng {
  /** PNG dataURL（image/png;base64,...） */
  dataUrl: string;
  /** 图片宽度（格点数） */
  width: number;
  /** 图片高度（格点数） */
  height: number;
  /** 网格经度步长 */
  dx: number;
  /** 网格纬度步长 */
  dy: number;
  /** 归一化时使用的最小值（breaks[0]） */
  minValue: number;
  /** 归一化时使用的最大值（breaks[last]） */
  maxValue: number;
}

interface EncodeOptions {
  /** 断点数组（必需），用于确定归一化值域 */
  breaks: number[];
}

/**
 * 将 IDW 格点数据编码成 1 通道灰度 PNG。
 *
 * @param grid       IDW 格点结果（每个 Feature 的 i/j 表示格点位置，properties.value 是 IDW 值）
 * @param bbox       网格覆盖的经纬度范围 [[minLng, minLat], [maxLng, maxLat]]
 * @param cols       格点经向数量
 * @param rows       格点纬向数量
 * @param options    编码配置（必须提供 breaks）
 */
export function encodeIdwGridToGrayscalePng(
  grid: IdwLabelFeatureCollection,
  bbox: [[number, number], [number, number]],
  cols: number,
  rows: number,
  options: EncodeOptions
): GrayscalePng {
  if (cols <= 0 || rows <= 0) {
    throw new Error('Grid dimensions must be positive');
  }

  const { breaks } = options;
  if (!breaks || breaks.length < 2) {
    throw new Error('breaks must have at least 2 values');
  }

  // 按 breaks 值域归一化：R = (value - breaks[0]) / (breaks[last] - breaks[0])
  const minValue = breaks[0];
  const maxValue = breaks[breaks.length - 1];
  const range = maxValue - minValue || 1;

  // 分配 RGBA 像素数组（R = 归一化灰度值, G/B = 0, A = 255）
  const pixels = new Uint8ClampedArray(cols * rows * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = 0;
    pixels[i + 1] = 0;
    pixels[i + 2] = 0;
    pixels[i + 3] = 255;
  }

  // 写入格点：grid 内 (i, j) 对应图片 (i, rows - 1 - j)（翻转 Y 方向以匹配北向上）
  for (const f of grid.features) {
    const { i, j, value } = f.properties;
    if (i < 0 || i >= cols || j < 0 || j >= rows) continue;
    if (!Number.isFinite(value)) continue;

    // clamp 到 [minValue, maxValue]
    const clamped = value < minValue ? minValue : value > maxValue ? maxValue : value;
    const normalized = (clamped - minValue) / range; // 0..1
    const gray = Math.round(normalized * 255);

    const px = i;
    const py = rows - 1 - j;
    const offset = (py * cols + px) * 4;
    pixels[offset] = gray;
    pixels[offset + 1] = gray;
    pixels[offset + 2] = gray;
    pixels[offset + 3] = 255;
  }

  // 编码 PNG
  const width = cols;
  const height = rows;
  const dataUrl = encodePixelsToPngDataUrl(pixels, width, height);

  // 计算 dx/dy（格点之间的经纬度跨度）
  const [[minLng, minLat], [maxLng, maxLat]] = bbox;
  const dx = (maxLng - minLng) / Math.max(1, cols);
  const dy = (maxLat - minLat) / Math.max(1, rows);

  return {
    dataUrl,
    width,
    height,
    dx,
    dy,
    minValue,
    maxValue,
  };
}

/**
 * 编码 RGBA 像素为 PNG dataURL。
 */
function encodePixelsToPngDataUrl(
  pixels: Uint8ClampedArray,
  width: number,
  height: number
): string {
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const imageData = new ImageData(pixels, width, height);
      ctx.putImageData(imageData, 0, 0);
      return canvas.toDataURL('image/png');
    }
  }

  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const imageData = new ImageData(pixels, width, height);
      ctx.putImageData(imageData, 0, 0);
    }
  }

  throw new Error('No canvas API available to encode PNG');
}
