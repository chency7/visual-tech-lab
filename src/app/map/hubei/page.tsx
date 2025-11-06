'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import { createMap } from '../utils/initMap';
import { Card } from '@/components/ui/card';
import { SplitPane } from '@/components/ui/split-pane';
import { JsonPanel } from './components/JsonPanel';
// import initialData from './mock.json';
import type maplibregl from 'maplibre-gl';
import type { FeatureCollection, Polygon, MultiPolygon, Feature, Point } from 'geojson';
import bbox from '@turf/bbox';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import type { JsonValue, JsonObject } from './types';
// Mapbox Draw 控件在 createMap 内部通过配置开启

export default function HubeiDataPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  // Draw 控件实例通过 map.__mapboxDrawControl 访问
  const [editorRaw, setEditorRaw] = useState<string>('{}');
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [lastLngLat, setLastLngLat] = useState<{ lng: number; lat: number } | null>(null);
  const [genCount, setGenCount] = useState<string>('10');
  const [selectedSourceType, setSelectedSourceType] = useState<'draw' | 'generated' | null>(null);
  const generatedFCRef = useRef<FeatureCollection<Point> | null>(null);
  const generatedEventsBoundRef = useRef<boolean>(false);
  const hubeiFCRef = useRef<FeatureCollection<Polygon | MultiPolygon> | null>(null);

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

  const handleJsonApply = useCallback((parsed: JsonValue) => {
    const map = mapInstanceRef.current;
    if (!map || !selectedPointId) return;

    // 仅当为对象时应用到属性
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return;
    const props = parsed as JsonObject;

    if (selectedSourceType === 'draw') {
      const drawCtrl = (map as any).__mapboxDrawControl as
        | { setFeatureProperties: (id: string, props: Record<string, JsonValue>) => void }
        | undefined;
      if (drawCtrl) drawCtrl.setFeatureProperties(selectedPointId, props as Record<string, JsonValue>);
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
  }, [selectedPointId, selectedSourceType]);

  useEffect(() => {
    const el = mapRef.current;
    if (!el) return;

    const defMapOptions = {
      center: [112.38562, 30.582387] as [number, number],
      zoom: 6.5,
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

  const addRandomPoints = (count: number) => {
    const map = mapInstanceRef.current;
    if (!map || count <= 0) return;
    const hb = hubeiFCRef.current;
    if (!hb || !hb.features?.length) return;

    const b = bbox(hb); // [minLng, minLat, maxLng, maxLat]
    const minLng = b[0];
    const minLat = b[1];
    const maxLng = b[2];
    const maxLat = b[3];

    const features: Feature<Point>[] = [];
    let attempts = 0;
    const maxAttempts = Math.max(1000, count * 50);

    while (features.length < count && attempts < maxAttempts) {
      attempts++;
      const lng = minLng + Math.random() * (maxLng - minLng);
      const lat = minLat + Math.random() * (maxLat - minLat);
      const candidate: Feature<Point> = {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lng, lat] },
        properties: {},
      };

      let inside = false;
      for (const f of hb.features) {
        if (booleanPointInPolygon(candidate, f as any)) {
          inside = true;
          break;
        }
      }
      if (inside) {
        const idx = features.length + 1;
        features.push({
          type: 'Feature',
          id: `gen-${idx}`,
          geometry: candidate.geometry,
          properties: { source: 'generated', idx },
        });
      }
    }

    const fc: FeatureCollection<Point> = { type: 'FeatureCollection', features };
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

  return (
    <div className="h-screen w-full">
      <SplitPane
        initialLeftRatio={0.4}
        minLeftPx={280}
        minRightPx={360}
        left={
          <div className="relative h-full w-full">
            <div ref={mapRef} className="absolute inset-0 h-full w-full" />
            <div className="absolute right-[60px] top-3 z-50 flex items-center gap-2 rounded bg-white/90 p-2 text-xs shadow backdrop-blur dark:bg-zinc-900/80">
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
