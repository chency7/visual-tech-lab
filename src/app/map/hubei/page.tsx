'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import { createMap } from '../utils/initMap';
import { Card } from '@/components/ui/card';
import { SplitPane } from '@/components/ui/split-pane';
import { JsonPanel } from './components/JsonPanel';
// import initialData from './mock.json';
import type maplibregl from 'maplibre-gl';
import type { FeatureCollection, Polygon, MultiPolygon, Feature, Point, LineString } from 'geojson';
import { bbox, bboxPolygon, booleanPointInPolygon, centroid } from '@turf/turf';
import type { JsonValue, JsonObject } from './types';
import { usePointsGenerator } from './hooks/usePointsGenerator';
import { usePointsGeneratorPool } from './hooks/usePointsGeneratorPool';
import { downloadJson } from './utils/export';
import { splitCityAndDistrict } from './utils/splitDistrict';
import { enrichFeatureCollection } from './utils/randomProps';

const typesOpts = [
  {
    label: '公益林',
    value: 'nyx-gongyilin',
  },
  {
    label: '育肥猪',
    value: 'nyx-yufeizhu',
  },
  {
    label: '水稻',
    value: 'nyx-shuidao',
  },
  {
    label: '烟叶',
    value: 'nyx-yanye',
  },
  {
    label: '商品林',
    value: 'nyx-shangpinlin',
  },
];

// 示例点属性模板（可在 UI 中编辑）
const defaultPointTemplate: JsonObject = {
  insuranceType: '公益林',
  insuranceTypeId: '1788047825970659331',
  insuranceTypeValue: 'nyx-gongyilin',
  address: '湖北省武汉市',
};

export default function HubeiDataPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const [editorRaw, setEditorRaw] = useState<string>('{}');
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [lastLngLat, setLastLngLat] = useState<{ lng: number; lat: number } | null>(null);
  const [genCount, setGenCount] = useState<string>('10');
  const [templateRaw, setTemplateRaw] = useState<string>(
    JSON.stringify(defaultPointTemplate, null, 2)
  );
  const [selectedSourceType, setSelectedSourceType] = useState<'draw' | 'generated' | null>(null);
  const generatedFCRef = useRef<FeatureCollection<Point> | null>(null);
  const generatedEventsBoundRef = useRef<boolean>(false);
  const hubeiFCRef = useRef<FeatureCollection<Polygon | MultiPolygon> | null>(null);
  const hubeiDistrictFCRef = useRef<FeatureCollection<Polygon | MultiPolygon> | null>(null);
  const { generate } = usePointsGenerator();
  const { generateParallel } = usePointsGeneratorPool();
  const [jsonScriptRunning, setJsonScriptRunning] = useState<boolean>(false);
  const [jsonScriptResult, setJsonScriptResult] = useState<string>('');

  const handleJsonRawChange = useCallback((next: string) => {
    setEditorRaw(next);
    try {
      const obj = JSON.parse(next) as FeatureCollection<Point>;
      if (obj && obj.type === 'FeatureCollection' && Array.isArray(obj.features)) {
        generatedFCRef.current = obj;
        const map = mapInstanceRef.current;
        const sourceId = 'generated-points-source';
        if (map && map.getSource(sourceId)) {
          const src = map.getSource(sourceId) as maplibregl.GeoJSONSource;
          src.setData(obj);
        }
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  const handleJsonApply = useCallback(
    (parsed: JsonValue) => {
      const map = mapInstanceRef.current;
      if (!map || !selectedPointId) return;

      // 仅当为对象时应用到属性
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return;
      const props = parsed as JsonObject;

      if (selectedSourceType === 'draw') {
        const drawCtrl = (map as any).__mapboxDrawControl as
          | { setFeatureProperties: (id: string, props: Record<string, JsonValue>) => void }
          | undefined;
        if (drawCtrl)
          drawCtrl.setFeatureProperties(selectedPointId, props as Record<string, JsonValue>);
      } else if (selectedSourceType === 'generated') {
        const sourceId = 'generated-points-source';
        const src = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
        const fc = generatedFCRef.current;
        if (src && fc) {
          const idx = fc.features.findIndex((f) => String(f.id) === selectedPointId);
          if (idx >= 0) {
            const cur = fc.features[idx];
            fc.features[idx] = {
              ...cur,
              properties: { ...(cur.properties ?? {}), ...props },
            };
            src.setData(fc);
          }
        }
      }
    },
    [selectedPointId, selectedSourceType]
  );

  // 模板 JSON 合法性校验
  const templateValid = useMemo<boolean>(() => {
    try {
      const obj = JSON.parse(templateRaw);
      return obj !== null && typeof obj === 'object' && !Array.isArray(obj);
    } catch {
      return false;
    }
  }, [templateRaw]);

  useEffect(() => {
    const el = mapRef.current;
    if (!el) return;

    const defMapOptions = {
      center: [112.38562, 31.735995] as [number, number],
      zoom: 6.21,
      minZoom: 2,
      maxZoom: 24,
    };

    const map = createMap(el, {
      options: {
        style: 'https://demotiles.maplibre.org/style.json',
        center: defMapOptions.center,
        zoom: defMapOptions.zoom,
        minZoom: defMapOptions.minZoom,
        maxZoom: defMapOptions.maxZoom,
        maxBounds: [
          [73.66, 18.12],
          [135.05, 53.55],
        ],
      },
      controls: {
        navigation: true,
        scale: { maxWidth: 100, unit: 'metric' },
        geolocate: true,
        reset: {
          center: defMapOptions.center,
          zoom: defMapOptions.zoom,
          bearing: 0,
          pitch: 0,
          speed: 0.8,
        },
        measure: false,
        zoomCenter: { position: 'top-left' },
      },
    });

    mapInstanceRef.current = map;

    // 监听 Draw 事件
    map.on('draw.create', (e: any) => {
      const f = e?.features?.[0];
      if (!f || f.geometry?.type !== 'Point') return;
      const [lng, lat] = f.geometry.coordinates as [number, number];
      setSelectedPointId(String(f.id));
      setLastLngLat({ lng, lat });
      setSelectedSourceType('draw');
    });

    map.on('draw.selectionchange', (e: any) => {
      const f = e?.features?.[0];
      if (f && f.geometry?.type === 'Point') {
        const [lng, lat] = f.geometry.coordinates as [number, number];
        setSelectedPointId(String(f.id));
        setLastLngLat({ lng, lat });
        setSelectedSourceType('draw');
      } else {
        setSelectedPointId(null);
        setLastLngLat(null);
        setSelectedSourceType(null);
      }
    });

    const addHubeiLayers = (fc: FeatureCollection<Polygon | MultiPolygon>) => {
      hubeiFCRef.current = fc;
      if (!map.getSource('hubei')) {
        map.addSource('hubei', { type: 'geojson', data: fc });
      }

      if (!map.getLayer('hubei-fill')) {
        map.addLayer({
          id: 'hubei-fill',
          type: 'fill',
          source: 'hubei',
          paint: {
            'fill-color': '#60a5fa',
            'fill-opacity': 0.15,
          },
        });
      }

      if (!map.getLayer('hubei-outline')) {
        map.addLayer({
          id: 'hubei-outline',
          type: 'line',
          source: 'hubei',
          paint: {
            'line-color': '#1f2937',
            'line-width': 2,
          },
        });
      }

      const popup = new (require('maplibre-gl').Popup)({ closeButton: false, closeOnClick: false });

      map.on('mousemove', 'hubei-fill', (e: any) => {
        const f = e.features?.[0];
        const name = f?.properties?.name || '湖北省';
        if (!e.lngLat) return;
        popup.setLngLat(e.lngLat).setHTML(`<div class="text-xs">${name}</div>`).addTo(map);
      });

      map.on('mouseleave', 'hubei-fill', () => {
        popup.remove();
      });
    };

    const ensureLoadedAndAdd = (fc: FeatureCollection<Polygon | MultiPolygon>) => {
      if (map.isStyleLoaded()) addHubeiLayers(fc);
      else map.on('load', () => addHubeiLayers(fc));
    };

    fetch('/json/420000_full.json', {})
      .then((res) => res.json())
      .then((fc: FeatureCollection<Polygon | MultiPolygon>) => {
        ensureLoadedAndAdd(fc);
      })
      .catch(() => {});

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  const addRandomPoints = async (count: number) => {
    const map = mapInstanceRef.current;
    if (!map || count <= 0) return;
    const hb = hubeiFCRef.current;
    if (!hb || !hb.features?.length) return;

    // 解析示例属性模板（仅当合法时应用）
    let templateProps: JsonObject | null = null;
    try {
      const parsed = JSON.parse(templateRaw);
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        templateProps = parsed as JsonObject;
      }
    } catch {
      templateProps = null;
    }

    const threads = (navigator as any).hardwareConcurrency || 4;
    const parallelThreshold = Math.max(threads * 1000, 4000);

    const fc: FeatureCollection<Point> =
      count >= parallelThreshold
        ? await generateParallel(count, hb, templateProps)
        : await generate(count, hb, templateProps);

    const districtFC = await ensureDistrictFC();
    const enrichedFC = enrichFeatureCollection(fc, districtFC, typesOpts, templateProps);
    generatedFCRef.current = enrichedFC;
    // 将生成的通用 GeoJSON 关联到右侧 JSON 原始数据
    // setEditorRaw(JSON.stringify(enrichedFC, null, 2));

    const sourceId = 'generated-points-source';
    const layerId = 'generated-points-layer';

    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, { type: 'geojson', data: enrichedFC });
    } else {
      const src = map.getSource(sourceId) as maplibregl.GeoJSONSource;
      src.setData(enrichedFC);
    }

    if (!map.getLayer(layerId)) {
      map.addLayer({
        id: layerId,
        type: 'circle',
        source: sourceId,
        paint: {
          'circle-radius': 5,
          'circle-color': '#2563eb',
          'circle-stroke-color': '#1e3a8a',
          'circle-stroke-width': 1,
        },
      });
    }

    if (!generatedEventsBoundRef.current) {
      map.on('click', layerId, (e: any) => {
        const f = e?.features?.[0] as Feature<Point> | undefined;
        if (!f || f.geometry?.type !== 'Point') return;
        const coords = f.geometry.coordinates as [number, number];
        setSelectedPointId(String(f.id ?? f.properties?.idx));
        setLastLngLat({ lng: coords[0], lat: coords[1] });
        setSelectedSourceType('generated');
      });
      generatedEventsBoundRef.current = true;
    }
  };

  // 导出湖北省最外层边界（写死 420000_full）
  const exportOuterBoundary = useCallback(async () => {
    // 优先使用已加载到地图的湖北数据
    try {
      const res = await fetch('/json/420000.json', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'application/json',
        },
      });
      const out = await res.json();
      downloadJson('hubei-outer-boundary.geojson', out as unknown as JsonValue);
    } catch {
      // ignore
    }
  }, []);

  // 懒加载区县数据并拆分导出（市级与区县）
  const ensureDistrictFC = useCallback(async () => {
    if (hubeiDistrictFCRef.current) return hubeiDistrictFCRef.current;
    try {
      const res = await fetch('/json/420000_full_district.json');
      const fc = (await res.json()) as FeatureCollection<Polygon | MultiPolygon>;
      hubeiDistrictFCRef.current = fc;
      return fc;
    } catch {
      return null;
    }
  }, []);

  const exportCityLevel = useCallback(async () => {
    const fc = await ensureDistrictFC();
    if (!fc) return;
    const { cityFC } = splitCityAndDistrict(fc);
    downloadJson('hubei-city-boundaries.geojson', cityFC as unknown as JsonValue);
  }, [ensureDistrictFC]);

  const exportDistrictLevel = useCallback(async () => {
    const fc = await ensureDistrictFC();
    if (!fc) return;
    const { districtFC } = splitCityAndDistrict(fc);
    downloadJson('hubei-district-boundaries.geojson', districtFC as unknown as JsonValue);
  }, [ensureDistrictFC]);

  // 渲染市级数据（public/json/hubei-city.geojson）中的中心点为 symbol 图层
  const renderCityCenters = useCallback(async () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    try {
      const res = await fetch('/json/hubei-city.geojson');
      const fc = (await res.json()) as FeatureCollection<Polygon | MultiPolygon>;

      const centers: Feature<Point>[] = fc.features
        .map((f, idx) => {
          const props = (f.properties ?? {}) as Record<string, unknown>;
          const center = props['center'];
          let lnglat: [number, number] | null = null;
          if (Array.isArray(center) && center.length >= 2) {
            const lng = Number(center[0]);
            const lat = Number(center[1]);
            if (Number.isFinite(lng) && Number.isFinite(lat)) {
              lnglat = [lng, lat];
            }
          }
          if (!lnglat) return null;

          return {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: lnglat },
            properties: {
              ...props,
              sourceIndex: idx,
            },
            id: f.id ?? idx,
          };
        })
        .filter(Boolean) as Feature<Point>[];

      const pointsFC: FeatureCollection<Point> = {
        type: 'FeatureCollection',
        features: centers,
      };

      const sourceId = 'hubei-city-centers';
      const layerId = 'hubei-city-centers-symbol';

      const addLayers = () => {
        if (!map.getSource(sourceId)) {
          map.addSource(sourceId, { type: 'geojson', data: pointsFC });
        } else {
          const src = map.getSource(sourceId) as maplibregl.GeoJSONSource;
          src.setData(pointsFC);
        }

        if (!map.getLayer(layerId)) {
          map.addLayer({
            id: layerId,
            type: 'symbol',
            source: sourceId,
            layout: {
              'text-field': ['get', 'name'],
              'text-size': 12,
              'text-offset': [0, 1.2],
              'icon-image': 'marker-15',
              'icon-size': 1,
              'icon-allow-overlap': true,
            },
            paint: {
              'text-color': '#111827',
              'text-halo-color': '#ffffff',
              'text-halo-width': 1,
            },
          });
        }
      };

      if (map.isStyleLoaded()) addLayers();
      else map.on('load', addLayers);
    } catch {
      // ignore
    }
  }, []);

  // 计算 bbox 并渲染到地图，同时在控制台打印
  const renderAndLogBBox = useCallback(async () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    try {
      const res = await fetch('http://geo.datav.aliyun.com/areas_v3/bound/420000.json');
      const fc = (await res.json()) as FeatureCollection<Polygon | MultiPolygon>;
      const bounds = bbox(fc);
      console.log('湖北省 bbox:', bounds);
      const rect = bboxPolygon(bounds);

      const sourceId = 'hubei-bbox';
      const fillId = 'hubei-bbox-fill';
      const outlineId = 'hubei-bbox-outline';
      const ticksSourceId = 'hubei-bbox-ticks';
      const ticksLayerId = 'hubei-bbox-ticks-layer';
      const labelsLayerId = 'hubei-bbox-labels-layer';

      // 生成刻度
      const [minLng, minLat, maxLng, maxLat] = bounds;
      const features: Feature<LineString | Point>[] = [];

      const lngStep = 0.5;
      const latStep = 0.5;
      const tickLen = 0.05; // 刻度线长度
      const labelOffset = 0.15; // 标签偏移量
      const minGap = 0.1; // 最小间距，防止重叠

      // 辅助函数：生成不重叠的刻度值列表
      const generateTicks = (min: number, max: number, step: number) => {
        const ticks: number[] = [min];
        const start = Math.ceil(min / step) * step;
        for (let val = start; val <= max; val += step) {
          const v = parseFloat(val.toFixed(2));
          // 如果与最小值太近，跳过
          if (Math.abs(v - min) < minGap) continue;
          // 如果与最大值太近，先暂存（循环结束会处理最大值，这里其实只需要保证不加重复的）
          if (Math.abs(v - max) < minGap) continue;
          ticks.push(v);
        }
        if (Math.abs(max - ticks[ticks.length - 1]) >= minGap) {
          ticks.push(max);
        }
        return ticks;
      };

      const lngTicks = generateTicks(minLng, maxLng, lngStep);
      const latTicks = generateTicks(minLat, maxLat, latStep);

      // 经度刻度 (上下)
      lngTicks.forEach((lngVal) => {
        // Bottom
        features.push({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [lngVal, minLat],
              [lngVal, minLat - tickLen],
            ],
          },
          properties: {},
        });
        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [lngVal, minLat - labelOffset] },
          properties: { text: lngVal.toFixed(2) + '°' },
        });

        // Top
        features.push({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [lngVal, maxLat],
              [lngVal, maxLat + tickLen],
            ],
          },
          properties: {},
        });
        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [lngVal, maxLat + labelOffset] },
          properties: { text: lngVal.toFixed(2) + '°' },
        });
      });

      // 纬度刻度 (左右)
      latTicks.forEach((latVal) => {
        // Left
        features.push({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [minLng, latVal],
              [minLng - tickLen, latVal],
            ],
          },
          properties: {},
        });
        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [minLng - labelOffset * 1.5, latVal] },
          properties: { text: latVal.toFixed(2) + '°' },
        });

        // Right
        features.push({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [maxLng, latVal],
              [maxLng + tickLen, latVal],
            ],
          },
          properties: {},
        });
        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [maxLng + labelOffset * 1.5, latVal] },
          properties: { text: latVal.toFixed(2) + '°' },
        });
      });

      const ticksFC: FeatureCollection<LineString | Point> = {
        type: 'FeatureCollection',
        features: features,
      };

      const addLayers = () => {
        if (!map.getSource(sourceId)) {
          map.addSource(sourceId, { type: 'geojson', data: rect });
        } else {
          const src = map.getSource(sourceId) as maplibregl.GeoJSONSource;
          src.setData(rect);
        }

        if (!map.getSource(ticksSourceId)) {
          map.addSource(ticksSourceId, { type: 'geojson', data: ticksFC });
        } else {
          const src = map.getSource(ticksSourceId) as maplibregl.GeoJSONSource;
          src.setData(ticksFC);
        }

        if (!map.getLayer(fillId)) {
          map.addLayer({
            id: fillId,
            type: 'fill',
            source: sourceId,
            paint: {
              'fill-color': '#f59e0b',
              'fill-opacity': 0.05,
            },
          });
        }

        if (!map.getLayer(outlineId)) {
          map.addLayer({
            id: outlineId,
            type: 'line',
            source: sourceId,
            paint: {
              'line-color': '#b45309',
              'line-width': 1,
              'line-dasharray': [4, 2],
            },
          });
        }

        // Ticks图层
        if (!map.getLayer(ticksLayerId)) {
          map.addLayer({
            id: ticksLayerId,
            type: 'line',
            source: ticksSourceId,
            filter: ['==', '$type', 'LineString'],
            paint: {
              'line-color': '#b45309',
              'line-width': 1,
            },
          });
        }

        // Labels图层
        if (!map.getLayer(labelsLayerId)) {
          map.addLayer({
            id: labelsLayerId,
            type: 'symbol',
            source: ticksSourceId,
            filter: ['==', '$type', 'Point'],
            layout: {
              'text-field': ['get', 'text'],
              'text-size': 11,
              'text-justify': 'center',
              'text-anchor': 'center',
              'text-allow-overlap': true,
              'text-ignore-placement': true,
            },
            paint: {
              'text-color': '#78350f',
              'text-halo-color': '#ffffff',
              'text-halo-width': 2,
            },
          });
        }
      };

      if (map.isStyleLoaded()) addLayers();
      else map.on('load', addLayers);
    } catch {
      // ignore
    }
  }, []);

  const runJsonTransform = useCallback(async () => {
    setJsonScriptRunning(true);
    setJsonScriptResult('');
    try {
      const res = await fetch('/api/json-transform', { method: 'POST' });
      const data = await res.json();
      setJsonScriptResult(JSON.stringify(data, null, 2));
    } catch {
      setJsonScriptResult('执行失败');
    } finally {
      setJsonScriptRunning(false);
    }
  }, []);

  return (
    <div className="h-screen w-full">
      <SplitPane
        initialLeftRatio={0.6}
        minLeftPx={360}
        minRightPx={360}
        left={
          <div className="relative h-full w-full">
            <div ref={mapRef} className="absolute inset-0 h-full w-full" />
            <div className="absolute left-[230px] top-3 z-50 flex flex-col items-start gap-2 rounded bg-white/90 p-2 text-xs shadow backdrop-blur dark:bg-zinc-900/80">
              <div className="flex items-center gap-2">
                <input
                  value={genCount}
                  onChange={(e) => setGenCount(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="生成点数量"
                  className="h-7 w-24 rounded border border-zinc-300 px-2 outline-none dark:border-zinc-700 dark:bg-zinc-900"
                />
                <button
                  onClick={() => addRandomPoints(Math.max(0, Number(genCount) || 0))}
                  className="h-7 rounded bg-blue-600 px-2 text-white dark:bg-blue-500"
                >
                  生成点
                </button>
                <button
                  onClick={exportOuterBoundary}
                  className="h-7 rounded bg-zinc-900 px-2 text-white dark:bg-zinc-100 dark:text-zinc-900"
                >
                  导出外边界
                </button>
                <button
                  onClick={exportCityLevel}
                  className="h-7 rounded bg-emerald-600 px-2 text-white dark:bg-emerald-500"
                >
                  导出市级
                </button>
                <button
                  onClick={exportDistrictLevel}
                  className="h-7 rounded bg-purple-600 px-2 text-white dark:bg-purple-500"
                >
                  导出区县
                </button>
                <button
                  onClick={renderCityCenters}
                  className="h-7 rounded bg-sky-600 px-2 text-white dark:bg-sky-500"
                >
                  渲染市级中心点
                </button>
                <button
                  onClick={renderAndLogBBox}
                  className="h-7 rounded bg-amber-600 px-2 text-white dark:bg-amber-500"
                >
                  渲染并打印 bbox
                </button>
                <button
                  onClick={runJsonTransform}
                  disabled={jsonScriptRunning}
                  className="h-7 rounded bg-teal-600 px-2 text-white disabled:opacity-60 dark:bg-teal-500"
                >
                  执行 JSON 脚本
                </button>
              </div>
              <div className="mt-1 w-[280px]">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[11px] text-zinc-600 dark:text-zinc-400">
                    示例属性（JSON，应用到每个生成点）
                  </span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[11px] ${templateValid ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200'}`}
                  >
                    {templateValid ? '有效' : '无效'}
                  </span>
                </div>
                <textarea
                  value={templateRaw}
                  onChange={(e) => setTemplateRaw(e.target.value)}
                  spellCheck={false}
                  placeholder='{"type":"POI","name":"示例点"}'
                  className="h-24 w-full resize-none rounded border border-zinc-300 bg-transparent p-2 font-mono text-[11px] outline-none dark:border-zinc-700 dark:bg-zinc-900"
                />
                <div className="pt-1 text-[15px] text-zinc-600 dark:text-zinc-400">
                  执行路径：/api/json-transform
                </div>
                {jsonScriptResult && (
                  <pre className="mt-2 max-h-32 overflow-auto rounded bg-zinc-100 p-2 text-[11px] dark:bg-zinc-900">
                    {jsonScriptResult}
                  </pre>
                )}
              </div>
            </div>
            <Card className="pointer-events-none absolute left-2 top-12 z-50 bg-white/80 p-2 text-xs shadow backdrop-blur dark:bg-zinc-900/80">
              湖北省地图
              {lastLngLat
                ? ` · 选中点(${lastLngLat.lng.toFixed(6)}, ${lastLngLat.lat.toFixed(6)})`
                : ''}
            </Card>
          </div>
        }
        right={
          <div className="h-full w-full border-l border-zinc-300">
            <JsonPanel
              initialData={{}}
              raw={editorRaw}
              onRawChange={handleJsonRawChange}
              onApply={handleJsonApply}
            />
          </div>
        }
      />
    </div>
  );
}
