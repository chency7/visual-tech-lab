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
import type { FeatureCollection, Polygon, MultiPolygon, Feature, Point } from 'geojson';
import { bbox, booleanPointInPolygon } from '@turf/turf';
import type { JsonValue, JsonObject } from './types';
import { usePointsGenerator } from './hooks/usePointsGenerator';
import { usePointsGeneratorPool } from './hooks/usePointsGeneratorPool';
import { extractOuterBoundary } from './utils/outerBoundary';
import { downloadJson } from './utils/export';
import { splitCityAndDistrict } from './utils/splitDistrict';

// 示例点属性模板（可在 UI 中编辑）
const defaultPointTemplate: JsonObject = {
  type: 'POI',
  name: '示例点',
  category: '默认',
  rating: 0,
  tags: ['demo'],
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

    fetch('https://geo.datav.aliyun.com/areas_v3/bound/420000_full.json')
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
    generatedFCRef.current = fc;
    // 将生成的通用 GeoJSON 关联到右侧 JSON 原始数据
    setEditorRaw(JSON.stringify(fc, null, 2));

    const sourceId = 'generated-points-source';
    const layerId = 'generated-points-layer';

    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, { type: 'geojson', data: fc });
    } else {
      const src = map.getSource(sourceId) as maplibregl.GeoJSONSource;
      src.setData(fc);
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
    let hb = hubeiFCRef.current;
    if (!hb) {
      try {
        const res = await fetch('https://geo.datav.aliyun.com/areas_v3/bound/420000_full.json');
        hb = (await res.json()) as FeatureCollection<Polygon | MultiPolygon>;
      } catch {
        return;
      }
    }
    const out = extractOuterBoundary(hb);
    downloadJson('hubei-outer-boundary.geojson', out as unknown as JsonValue);
  }, []);

  // 懒加载区县数据并拆分导出（市级与区县）
  const ensureDistrictFC = useCallback(async () => {
    if (hubeiDistrictFCRef.current) return hubeiDistrictFCRef.current;
    try {
      const res = await fetch(
        'https://geo.datav.aliyun.com/areas_v3/bound/420000_full_district.json'
      );
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

  return (
    <div className="h-screen w-full">
      <SplitPane
        initialLeftRatio={0.5}
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
