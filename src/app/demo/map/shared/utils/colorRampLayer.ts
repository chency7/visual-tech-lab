'use client';

/**
 * 基于 MapLibre Custom Layer 的 GPU 色彩映射层（WebGL + GLSL）。
 *
 * 原理：
 * 1. 将灰度 PNG 作为纹理上传到 GPU
 * 2. 灰度图是数据载体：R 通道 = (value - breaks[0]) / (breaks[last] - breaks[0])
 * 3. Fragment Shader 直接用 texture2D().r 查色阶，无需中间转换
 * 4. 双线性插值（GL_LINEAR）实现 GPU 硬件级平滑
 */

import type { Map as MapInstance, CustomLayerInterface } from 'maplibre-gl';
import type { GrayscalePng } from '../utils/grayscale';

export interface ColorRampStop {
  /** 该色阶对应的归一化值（0..1），基于 breaks 值域 */
  position: number;
  /** 颜色 [r, g, b, a]（0..1 范围） */
  color: [number, number, number, number];
}

export interface WebGLColorRampLayerOptions {
  /** 灰度 PNG 数据（含 width/height/minValue/maxValue） */
  grayscale: GrayscalePng;
  /** 数据覆盖的经纬度范围 [[minLng, minLat], [maxLng, maxLat]] */
  bbox: [[number, number], [number, number]];
  /** 色阶断点（0..1 归一化，基于 breaks 值域） */
  colorStops: ColorRampStop[];
  /** 透明度（0..1） */
  opacity?: number;
}

/**
 * 将颜色字符串转为 [r, g, b, a]（0..1 范围）
 * 支持格式：#RGB, #RRGGBB, rgb(r,g,b), rgba(r,g,b,a)
 */
export function parseColorToRgba(color: string, alpha = 1): [number, number, number, number] {
  // 1) rgba() / rgb() 格式
  const rgbaMatch = color.match(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/
  );
  if (rgbaMatch) {
    return [
      parseInt(rgbaMatch[1], 10) / 255,
      parseInt(rgbaMatch[2], 10) / 255,
      parseInt(rgbaMatch[3], 10) / 255,
      rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : alpha,
    ];
  }

  // 2) #RRGGBB / #RGB 格式
  const cleaned = color.replace('#', '');
  const value =
    cleaned.length === 3
      ? cleaned
        .split('')
        .map((c) => c + c)
        .join('')
      : cleaned;
  const r = parseInt(value.substring(0, 2), 16) / 255;
  const g = parseInt(value.substring(2, 4), 16) / 255;
  const b = parseInt(value.substring(4, 6), 16) / 255;
  return [r, g, b, alpha];
}

/**
 * 将 breaks + colors 数组转换为 ColorRampStop[]，归一化到 0..1
 *
 * 归一化基于 breaks 自身值域：position = (break - breaks[0]) / (breaks[last] - breaks[0])
 * 与灰度图编码一致，shader 中 texture2D().r 直接对应 position
 */
export function buildColorStopsFromBreaks(
  breaks: number[],
  colors: string[]
): ColorRampStop[] {
  if (breaks.length < 2 || colors.length === 0) {
    return [
      { position: 0, color: [0, 0, 0, 0] },
      { position: 1, color: [0, 0, 1, 1] },
    ];
  }

  const breaksMin = breaks[0];
  const breaksMax = breaks[breaks.length - 1];
  const range = breaksMax - breaksMin || 1;
  const stops: ColorRampStop[] = [];

  for (let i = 0; i < breaks.length; i++) {
    const t = (breaks[i] - breaksMin) / range;
    const colorIndex = Math.min(i, colors.length - 1);
    const color = colors[colorIndex];
    const alpha = color.startsWith('rgba') ? 0 : 1;
    stops.push({ position: t, color: parseColorToRgba(color, alpha) });
  }
  return stops;
}

// ─── GLSL 顶点着色器 ───────────────────────────────────────────────
const VERTEX_SHADER = /* glsl */ `
attribute vec2 a_pos;
uniform mat4 u_matrix;
varying vec2 v_uv;
void main() {
  v_uv = vec2(a_pos.x, 1.0 - a_pos.y); // 翻转 Y：图片 Y=0 在底部
  gl_Position = u_matrix * vec4(a_pos, 0.0, 1.0);
}
`;

// ─── GLSL 片段着色器：色阶映射 ─────────────────────────────────────
// 灰度图 R 通道 = (value - breaks[0]) / (breaks[last] - breaks[0])
// texture2D().r 直接就是色阶位置 [0,1]，无需额外转换
const FRAGMENT_SHADER = /* glsl */ `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_image;
uniform float u_opacity;

const int MAX_STOPS = 16;
uniform vec4 u_stops[16];
uniform float u_positions[16];

vec4 sampleColorRamp(float t) {
  if (t <= u_positions[0]) return u_stops[0];

  vec4 result = u_stops[0];
  for (int i = 0; i < 15; i++) {
    float p0 = u_positions[i];
    float p1 = u_positions[i + 1];
    if (t >= p0 && t <= p1) {
      float span = max(p1 - p0, 1e-6);
      float k = (t - p0) / span;
      result = mix(u_stops[i], u_stops[i + 1], k);
      return result;
    }
  }
  return u_stops[15];
}

void main() {
  float t = texture2D(u_image, v_uv).r;
  vec4 color = sampleColorRamp(t);
  gl_FragColor = vec4(color.rgb, color.a * u_opacity);
}
`;

/**
 * 创建 WebGL Color Ramp Custom Layer
 */
export function createColorRampLayer(options: WebGLColorRampLayerOptions): CustomLayerInterface {
  const { grayscale, bbox, colorStops, opacity = 1 } = options;

  // 计算经纬度 → NDC 坐标
  // 数据范围: bbox, 我们将整个图片作为单个 quad 覆盖到这个范围
  // quad 顶点的 NDC 坐标需要通过墨卡托投影矩阵转换
  let gl: WebGLRenderingContext | null = null;
  let program: WebGLProgram | null = null;
  let texture: WebGLTexture | null = null;
  let buffer: WebGLBuffer | null = null;
  // 纹理是否已上传完成（Image.onload 后置为 true）
  let textureReady = false;

  const [[minLng, minLat], [maxLng, maxLat]] = bbox;
  // 共享的 opacity 引用（外部可通过 setOpacity 动态更新）
  const opacityRef = { current: opacity };

  // 在 onAdd 中加载图片并初始化 GL 资源
  const image = new Image();
  image.crossOrigin = 'anonymous';

  const layer: CustomLayerInterface = {
    id: 'webgl-colorramp',
    type: 'custom',
    renderingMode: '2d',
    onAdd(map: MapInstance, _gl: WebGLRenderingContext) {
      // 墨卡托投影经纬度 → mercator 世界坐标 (0..1)
      // x:  经度 [-180, 180] → [0, 1]
      // y:  纬度 [85, -85] → [0, 1]（北=0，南=1）
      const project = (lng: number, lat: number): [number, number] => {
        const x = (lng + 180) / 360;
        const sin = Math.min(Math.max(Math.sin((lat * Math.PI) / 180), -0.9999), 0.9999);
        const y = 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI);
        return [x, y];
      };

      const [minNx, minNy] = project(minLng, maxLat);
      const [maxNx, maxNy] = project(maxLng, minLat);

      const vertices = new Float32Array([
        minNx, minNy,
        maxNx, minNy,
        maxNx, maxNy,
        minNx, minNy,
        maxNx, maxNy,
        minNx, maxNy,
      ]);

      gl = _gl;
      program = createProgram(gl, VERTEX_SHADER, FRAGMENT_SHADER);

      // buffer
      buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

      // texture
      texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); // GPU 双线性插值
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

      // 异步加载图片
      image.onload = () => {
        if (!gl || !texture) return;
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          image
        );
        textureReady = true;
        map.triggerRepaint();
        console.log('[webgl-colorramp] grayscale texture uploaded', grayscale.width, 'x', grayscale.height);
      };
      image.onerror = (e) => {
        console.error('[webgl-colorramp] failed to load grayscale image', e);
      };
      image.src = grayscale.dataUrl;
    },
    render(_gl: WebGLRenderingContext, args: { modelViewProjectionMatrix: Float32Array }) {
      if (!gl || !program || !texture || !textureReady) return;

      gl.useProgram(program);

      // ── attribute: 顶点坐标 ──
      const posLoc = gl.getAttribLocation(program, 'a_pos');
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

      // ── uniform: 投影矩阵 ──
      const matLoc = gl.getUniformLocation(program, 'u_matrix');
      gl.uniformMatrix4fv(matLoc, false, args.modelViewProjectionMatrix);

      // ── uniform: 透明度 ──
      gl.uniform1f(gl.getUniformLocation(program, 'u_opacity'), opacityRef.current);

      // ── uniform: 色阶 ──
      // 始终填充 16 个槽位（shader 要求固定大小），未用槽位置为 position=-1，使 i=0..numStops-1 循环中不会匹配
      const numStops = Math.min(colorStops.length, 16);
      const stops = new Float32Array(16 * 4);
      const positions = new Float32Array(16);
      for (let i = 0; i < 16; i++) {
        if (i < numStops) {
          stops[i * 4 + 0] = colorStops[i].color[0];
          stops[i * 4 + 1] = colorStops[i].color[1];
          stops[i * 4 + 2] = colorStops[i].color[2];
          stops[i * 4 + 3] = colorStops[i].color[3];
          positions[i] = colorStops[i].position;
        } else {
          // 未使用槽位：position 设为 -1，永远不会被命中
          positions[i] = -1;
          stops[i * 4 + 3] = 0; // alpha=0
        }
      }
      gl.uniform4fv(gl.getUniformLocation(program, 'u_stops'), stops);
      gl.uniform1fv(gl.getUniformLocation(program, 'u_positions'), positions);

      // ── uniform: 纹理 ──
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(gl.getUniformLocation(program, 'u_image'), 0);

      // 启用混合（处理半透明色阶）
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      // 绘制 quad
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      // 恢复混合状态
      gl.disable(gl.BLEND);
    },
  };

  // 暴露给外部的 API
  return Object.assign(layer, {
    /** 动态更新透明度，触发地图重绘 */
    setOpacity(value: number) {
      opacityRef.current = value;
    },
    /** 获取当前透明度 */
    getOpacity() {
      return opacityRef.current;
    },
  });
}

/**
 * 编译 GLSL 着色器
 */
function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Failed to create shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error('Shader compile error: ' + info);
  }
  return shader;
}

/**
 * 链接 vertex + fragment 程序
 */
function createProgram(
  gl: WebGLRenderingContext,
  vertexSrc: string,
  fragmentSrc: string
): WebGLProgram {
  const program = gl.createProgram();
  if (!program) throw new Error('Failed to create program');
  const vs = compileShader(gl, gl.VERTEX_SHADER, vertexSrc);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSrc);
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error('Program link error: ' + info);
  }
  return program;
}
