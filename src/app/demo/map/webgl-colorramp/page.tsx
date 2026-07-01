'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import 'maplibre-gl/dist/maplibre-gl.css';

import { MapContainer } from '../shared/components';
import { HUNAN_CONTOUR_BOUNDS } from '../shared/const';
import { useIdwWorker, useMapBusinessLogic, useMapState } from '../shared/hooks';
import mockPoints from '../shared/mock/point.json';
import type { IdwConfig, MapConfig, MockPointsData } from '../shared/types';
import { createMap } from '../shared/utils/initMap';
import { encodeIdwGridToGrayscalePng } from '../shared/utils/grayscale';
import {
  buildColorStopsFromBreaks,
  createColorRampLayer,
  type ColorRampStop,
} from '../shared/utils/colorRampLayer';

const COLOR_RAMP_LAYER_ID = 'webgl-colorramp';
const RIGHT_COLOR_RAMP_LAYER_ID = 'webgl-colorramp-right';

export default function WebglColorrampPage() {
  const { leftMap, rightMap, leftContainerRef, rightContainerRef, setLeftMap, setRightMap } =
    useMapState();

  const { addPointsBusiness, getStationDatums } = useMapBusinessLogic();
  const { compute } = useIdwWorker();

  const [isComputing, setIsComputing] = useState(false);
  const [colorRampOpacity, setColorRampOpacity] = useState(1);
  const [grayscaleMin, setGrayscaleMin] = useState<number | null>(null);
  const [grayscaleMax, setGrayscaleMax] = useState<number | null>(null);
  const [grayscaleInfo, setGrayscaleInfo] = useState<{
    width: number;
    height: number;
    bytes: number;
  } | null>(null);
  const [grayscaleDataUrl, setGrayscaleDataUrl] = useState<string | null>(null);

  const initializedRef = useRef(false);
  const isComputingRef = useRef(false);
  const leftLayerRef = useRef<ReturnType<typeof createColorRampLayer> | null>(null);
  const rightLayerRef = useRef<ReturnType<typeof createColorRampLayer> | null>(null);

  const mapConfig: MapConfig = useMemo(
    () => ({
      controls: {
        navigation: true,
        scale: { maxWidth: 100, unit: 'metric' },
        geolocate: true,
        reset: {
          center: [111.53, 27.23],
          zoom: 6.5,
          bearing: 0,
          pitch: 0,
          speed: 0.8,
        },
        measure: false,
        zoomCenter: { position: 'top-left' },
      },
    }),
    []
  );

  const idwConfig: IdwConfig = useMemo(
    () => ({
      cols: 512,
      rows: 512,
      power: 2,
      hidePointsLayerId: '',
      minzoom: 6,
      neighbors: 4,
      breaks: [0, 0.1, 10, 25, 50, 100, 250, 400, 600, 10000],
      colors: [
        'rgba(0, 0, 0, 0)',
        '#90EE90',
        'rgb(93, 188, 51)',
        'rgb(129, 199, 250)',
        '#0000FF',
        'rgb(250, 2, 250)',
        'rgb(129, 0, 67)',
        'rgb(253, 172, 0)',
        'rgb(253, 100, 7)',
      ],
    }),
    []
  );

  const legendItems = useMemo(() => {
    const breaks = idwConfig.breaks ?? [];
    const colors = idwConfig.colors ?? [];
    return colors.map((color, i) => {
      const lower = breaks[i] ?? 0;
      const upper = breaks[i + 1];
      const label = upper === 10000 || upper == null ? `>${lower}` : `${lower} - ${upper}`;
      return { color, label };
    });
  }, [idwConfig.breaks, idwConfig.colors]);

  // ─── 计算 IDW + 生成灰度 PNG + 上 GPU ────────────────────────
  const regenerate = useCallback(
    async (map: NonNullable<typeof leftMap>) => {
      if (isComputingRef.current) return;
      isComputingRef.current = true;
      setIsComputing(true);

      try {
        const stationDatums = getStationDatums(mockPoints as MockPointsData);
        const result = await compute({
          bbox: HUNAN_CONTOUR_BOUNDS,
          stations: stationDatums,
          config: {
            cols: idwConfig.cols,
            rows: idwConfig.rows,
            power: idwConfig.power,
            neighbors: idwConfig.neighbors,
            breaks: idwConfig.breaks,
            colors: idwConfig.colors,
            smoothIterations: 0,
          },
        });

        // 1) IDW 网格 → 灰度 PNG
        //   灰度图是数据载体：R 通道按 breaks 值域归一化
        //   R = (value - breaks[0]) / (breaks[last] - breaks[0])
        //   shader 中 texture2D().r 直接就是色阶位置 [0,1]
        const grayscale = encodeIdwGridToGrayscalePng(
          result.labelFeatureCollection,
          HUNAN_CONTOUR_BOUNDS,
          idwConfig.cols!,
          idwConfig.rows!,
          { breaks: idwConfig.breaks! }
        );

        setGrayscaleMin(grayscale.minValue);
        setGrayscaleMax(grayscale.maxValue);
        setGrayscaleDataUrl(grayscale.dataUrl);
        setGrayscaleInfo({
          width: grayscale.width,
          height: grayscale.height,
          bytes: Math.round((grayscale.dataUrl.length * 3) / 4),
        });

        // 2) 构建色阶 stops（position 基于 breaks 值域归一化，与灰度图编码一致）
        const stops: ColorRampStop[] = buildColorStopsFromBreaks(
          idwConfig.breaks!,
          idwConfig.colors!
        );

        console.log(
          '[webgl-colorramp] PNG size:',
          grayscale.dataUrl.length,
          'bytes, prefix:',
          grayscale.dataUrl.substring(0, 30)
        );
        console.log(
          '[webgl-colorramp] color stops:',
          stops.length,
          'first:',
          stops[0],
          'last:',
          stops[stops.length - 1]
        );

        // 3) 左侧地图：替换/添加 WebGL Custom Layer
        if (leftLayerRef.current) {
          map.removeLayer(COLOR_RAMP_LAYER_ID);
        }
        leftLayerRef.current = createColorRampLayer({
          grayscale,
          bbox: HUNAN_CONTOUR_BOUNDS,
          colorStops: stops,
          opacity: colorRampOpacity,
        });
        map.addLayer(leftLayerRef.current as unknown as Parameters<typeof map.addLayer>[0]);

        // 4) 右侧地图：同样用 WebGL 着色器渲染色斑图
        if (rightMap) {
          if (rightLayerRef.current) {
            try {
              rightMap.removeLayer(RIGHT_COLOR_RAMP_LAYER_ID);
            } catch {
              /* ignore */
            }
          }
          rightLayerRef.current = createColorRampLayer({
            grayscale,
            bbox: HUNAN_CONTOUR_BOUNDS,
            colorStops: stops,
            opacity: colorRampOpacity,
          });
          // 修改 layer id 避免冲突
          (rightLayerRef.current as any).id = RIGHT_COLOR_RAMP_LAYER_ID;
          rightMap.addLayer(
            rightLayerRef.current as unknown as Parameters<typeof rightMap.addLayer>[0]
          );
        }
      } catch (error) {
        console.error('Failed to build color ramp layer:', error);
      } finally {
        isComputingRef.current = false;
        setIsComputing(false);
      }
    },
    [
      compute,
      getStationDatums,
      idwConfig.cols,
      idwConfig.rows,
      idwConfig.power,
      idwConfig.neighbors,
      idwConfig.breaks,
      idwConfig.colors,
      rightMap,
      colorRampOpacity,
    ]
  );

  // 导出当前灰度图
  const handleExportGrayscale = useCallback(() => {
    if (!grayscaleDataUrl || !grayscaleInfo) {
      alert('请先点击"重新计算"生成灰度图');
      return;
    }
    const fileName = `grayscale-idw-${grayscaleInfo.width}x${grayscaleInfo.height}-${grayscaleMin?.toFixed(2) ?? '0'}-${grayscaleMax?.toFixed(2) ?? '0'}.png`;
    const link = document.createElement('a');
    link.href = grayscaleDataUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [grayscaleDataUrl, grayscaleInfo, grayscaleMin, grayscaleMax]);

  // ─── 初始化两个地图 ──────────────────────────────────────────────
  useEffect(() => {
    if (initializedRef.current) return;
    if (!leftContainerRef.current || !rightContainerRef.current) return;
    initializedRef.current = true;

    const leftInstance = createMap(leftContainerRef.current, mapConfig);
    setLeftMap(leftInstance);

    const rightInstance = createMap(rightContainerRef.current, mapConfig);
    setRightMap(rightInstance);

    leftInstance.on('load', () => {
      addPointsBusiness(leftInstance, mockPoints as MockPointsData);
      void regenerate(leftInstance);
    });

    rightInstance.on('load', () => {
      addPointsBusiness(rightInstance, mockPoints as MockPointsData);
    });

    return () => {
      initializedRef.current = false;
      if (leftLayerRef.current) {
        try {
          leftInstance.removeLayer(COLOR_RAMP_LAYER_ID);
        } catch {
          /* ignore */
        }
      }
      if (rightLayerRef.current) {
        try {
          rightInstance.removeLayer(RIGHT_COLOR_RAMP_LAYER_ID);
        } catch {
          /* ignore */
        }
      }
      leftInstance.remove();
      rightInstance.remove();
      setLeftMap(null);
      setRightMap(null);
    };
  }, []);

  // ─── 透明度联动 ──────────────────────────────────────────────
  useEffect(() => {
    if (leftLayerRef.current) {
      leftLayerRef.current.setOpacity(colorRampOpacity);
      leftMap?.triggerRepaint();
    }
    if (rightLayerRef.current) {
      rightLayerRef.current.setOpacity(colorRampOpacity);
      rightMap?.triggerRepaint();
    }
  }, [leftMap, rightMap, colorRampOpacity]);

  return (
    <div className="relative flex h-screen w-full flex-col bg-zinc-100 dark:bg-zinc-950">
      <div className="flex h-full w-full flex-row">
        {/* ── 左：WebGL Custom Layer（Fragment Shader 实时色阶） ── */}
        <MapContainer
          containerRef={leftContainerRef as React.RefObject<HTMLDivElement>}
          className="relative h-full w-1/2 border-r border-zinc-300"
        >
          <div className="pointer-events-none absolute left-2 top-2 z-50 rounded bg-white/90 px-2 py-1 text-xs font-medium text-zinc-800 shadow">
            左：WebGL Fragment Shader 色阶
          </div>
          <Link
            href="/demo"
            className="pointer-events-auto absolute right-3 top-2 z-50 rounded bg-white/80 px-3 py-2 text-sm shadow backdrop-blur hover:bg-white"
            title="返回首页"
          >
            返回
          </Link>

          {/* 顶部说明卡 */}
          <div className="pointer-events-none absolute left-4 top-4 z-50 max-w-md rounded bg-white/90 px-4 py-3 text-xs text-zinc-800 shadow backdrop-blur">
            <div className="mb-1 font-medium text-zinc-900">WebGL + 灰度图方案</div>
            <div className="leading-relaxed text-zinc-600">
              灰度图是数据载体（R 通道编码数值），WebGL 着色器解析 R 通道并映射色阶。
              双线性插值（GL_LINEAR）硬件加速，可流畅处理超大规模数据。
            </div>
          </div>

          {/* 控制面板 */}
          <div className="pointer-events-auto absolute right-3 top-14 z-50 w-64 rounded bg-white/90 px-3 py-2 text-sm text-zinc-800 shadow backdrop-blur">
            <div className="mb-2 font-medium">控制台</div>
            <div className="mt-2">
              <div className="flex items-center justify-between">
                <span>色阶透明度</span>
                <span className="text-xs text-zinc-500">{colorRampOpacity.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={colorRampOpacity}
                onChange={(e) => setColorRampOpacity(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
            <button
              type="button"
              onClick={() => leftMap && regenerate(leftMap)}
              disabled={isComputing}
              className="mt-2 w-full rounded bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
            >
              {isComputing ? '计算中…' : '重新计算'}
            </button>
            <button
              type="button"
              onClick={handleExportGrayscale}
              disabled={!grayscaleDataUrl}
              className="mt-2 w-full rounded border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-100 disabled:opacity-50"
              title="下载当前生成的灰度图 PNG"
            >
              下载灰度图
            </button>
          </div>

          {/* 灰度图说明卡 */}
          <div className="pointer-events-auto absolute right-3 top-[18.5rem] z-50 w-64 rounded bg-white/90 px-3 py-2 text-xs text-zinc-800 shadow backdrop-blur">
            <div className="mb-1 font-medium text-zinc-900">灰度图说明</div>
            <div className="mb-1 leading-relaxed text-zinc-600">
              <span className="font-medium text-zinc-800">生成路径：</span>
              point.json → IDW 插值（power=2，cosLat 矫正）→ {idwConfig.cols}×{idwConfig.rows}
              网格 → Canvas 2D 编码 1 通道灰度 PNG → 上传 GPU 纹理 → Fragment Shader 色阶映射
            </div>
            <div className="leading-relaxed text-zinc-600">
              <span className="font-medium text-zinc-800">编码方式：</span>
              <code className="block rounded bg-zinc-100 px-1.5 py-1 font-mono text-[10px] text-zinc-700">
                R = (value - breaks[0]) / (breaks[last] - breaks[0])
              </code>
              <div className="mt-1 text-[10px]">
                • 灰度图是数据载体，不是渲染结果
                <br />• R 通道按 breaks 值域归一化，shader 直接采样映射色阶
                <br />• GL_LINEAR 双线性插值实现 GPU 硬件级平滑
              </div>
            </div>
          </div>

          {/* 数据信息卡 */}
          {grayscaleInfo ? (
            <div className="pointer-events-none absolute bottom-4 left-4 z-50 max-w-xs rounded bg-white/90 px-3 py-2 text-xs text-zinc-700 shadow backdrop-blur">
              <div className="mb-1 font-medium text-zinc-900">灰度图描述头</div>
              <div>
                nx × ny: {grayscaleInfo.width} × {grayscaleInfo.height}
              </div>
              <div>
                dx, dy (°):{' '}
                {(
                  (HUNAN_CONTOUR_BOUNDS[1][0] - HUNAN_CONTOUR_BOUNDS[0][0]) /
                  grayscaleInfo.width
                ).toFixed(4)}
                ,{' '}
                {(
                  (HUNAN_CONTOUR_BOUNDS[1][1] - HUNAN_CONTOUR_BOUNDS[0][1]) /
                  grayscaleInfo.height
                ).toFixed(4)}
              </div>
              <div>
                extent: [{HUNAN_CONTOUR_BOUNDS[0][0]}, {HUNAN_CONTOUR_BOUNDS[0][1]}] → [
                {HUNAN_CONTOUR_BOUNDS[1][0]}, {HUNAN_CONTOUR_BOUNDS[1][1]}]
              </div>
              <div>
                breaks range: {grayscaleMin?.toFixed(2)} / {grayscaleMax?.toFixed(2)}
              </div>
              <div>PNG 体积: {(grayscaleInfo.bytes / 1024).toFixed(1)} KB</div>
            </div>
          ) : null}

          {/* 图例 */}
          <div className="pointer-events-none absolute bottom-4 right-4 z-50 rounded bg-white/90 px-3 py-2 text-xs text-zinc-800 shadow backdrop-blur">
            <div className="mb-1 font-medium">图例（毫米）</div>
            <div className="grid gap-1">
              {legendItems.map((item) => {
                const isTransparent = item.color.includes('rgba') && item.color.endsWith(', 0)');
                return (
                  <div key={item.label} className="flex items-center gap-2">
                    <span
                      className="h-3 w-6 border border-zinc-300"
                      style={{
                        backgroundColor: item.color,
                        backgroundImage: isTransparent
                          ? 'linear-gradient(45deg, #e4e4e7 25%, transparent 25%), linear-gradient(-45deg, #e4e4e7 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e4e4e7 75%), linear-gradient(-45deg, transparent 75%, #e4e4e7 75%)'
                          : undefined,
                        backgroundPosition: isTransparent
                          ? '0 0, 0 6px, 6px -6px, -6px 0'
                          : undefined,
                        backgroundSize: isTransparent ? '12px 12px' : undefined,
                      }}
                    />
                    <span>{item.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 加载状态 */}
          {isComputing ? (
            <div className="pointer-events-none absolute left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 rounded bg-zinc-900/80 px-4 py-2 text-sm text-white shadow-lg">
              IDW 计算 + GPU 纹理上传中…
            </div>
          ) : null}
        </MapContainer>

        {/* ── 右：WebGL 着色器渲染色斑图 ── */}
        <MapContainer
          containerRef={rightContainerRef as React.RefObject<HTMLDivElement>}
          className="relative h-full w-1/2"
        >
          <div className="pointer-events-none absolute left-2 top-2 z-50 rounded bg-white/90 px-2 py-1 text-xs font-medium text-zinc-800 shadow">
            右：WebGL 着色器渲染色斑图
          </div>
        </MapContainer>
      </div>
    </div>
  );
}
