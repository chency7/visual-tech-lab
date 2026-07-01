'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { ArrowLeft, CloudRain } from 'lucide-react';
import { RadarFilterPanel } from './RadarFilterPanel';
import { useRadarGpuLayer } from './useRadarGpuLayer';
import { foxGisVectorStyle } from '../shared/const';
import {
  parseThresholds,
  applyMapPerformanceOptions,
  RADAR_COORDINATES,
  RADAR_COMPARE_LAYER_ID,
  RADAR_COMPARE_SOURCE_ID,
  getRadarLayerBeforeId,
  type ThresholdRange,
} from './radarFilter';

const CHINA_CENTER: [number, number] = [104.5, 37.5];
const CHINA_ZOOM = 3.5;
const MAP_MIN_ZOOM = 0;
const MAP_MAX_ZOOM = 15;

function createRadarMap(container: HTMLDivElement): maplibregl.Map {
  return new maplibregl.Map({
    container,
    style: foxGisVectorStyle(),
    center: CHINA_CENTER,
    zoom: CHINA_ZOOM,
    minZoom: MAP_MIN_ZOOM,
    maxZoom: MAP_MAX_ZOOM,
    attributionControl: false,
    canvasContextAttributes: {
      preserveDrawingBuffer: false,
    },
  });
}

function syncCamera(from: maplibregl.Map, to: maplibregl.Map): void {
  to.jumpTo({
    center: from.getCenter(),
    zoom: from.getZoom(),
    bearing: from.getBearing(),
    pitch: from.getPitch(),
  });
}

function setCompareRadarVisibility(map: maplibregl.Map, visible: boolean): void {
  if (map.getLayer(RADAR_COMPARE_LAYER_ID)) {
    map.setLayoutProperty(RADAR_COMPARE_LAYER_ID, 'visibility', visible ? 'visible' : 'none');
  }
}

function ensureCompareRadarLayer(map: maplibregl.Map, visible: boolean): void {
  if (!map.isStyleLoaded()) return;

  if (!map.getSource(RADAR_COMPARE_SOURCE_ID)) {
    map.addSource(RADAR_COMPARE_SOURCE_ID, {
      type: 'image',
      url: '/images/radar.png',
      coordinates: RADAR_COORDINATES,
    });
  }

  if (!map.getLayer(RADAR_COMPARE_LAYER_ID)) {
    map.addLayer(
      {
        id: RADAR_COMPARE_LAYER_ID,
        type: 'raster',
        source: RADAR_COMPARE_SOURCE_ID,
        paint: {
          'raster-opacity': 1,
          'raster-fade-duration': 0,
          'raster-resampling': 'nearest',
        },
        layout: {
          visibility: visible ? 'visible' : 'none',
        },
      },
      getRadarLayerBeforeId(map)
    );
  } else {
    setCompareRadarVisibility(map, visible);
  }
}

export default function RadarMapPanel() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const compareMapContainerRef = useRef<HTMLDivElement>(null);
  const compareMapRef = useRef<maplibregl.Map | null>(null);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [compareMapLoaded, setCompareMapLoaded] = useState(false);
  const [radarVisible, setRadarVisible] = useState(false);
  const [sourceReady, setSourceReady] = useState(false);
  const [layersReady, setLayersReady] = useState(false);
  const [thresholds] = useState<ThresholdRange[]>(() => parseThresholds());
  const [selectedIndexes, setSelectedIndexes] = useState<number[]>(() =>
    thresholds.map((_threshold, index) => index)
  );

  const selectedIndexesRef = useRef<number[]>(thresholds.map((_threshold, index) => index));
  const layersReadyRef = useRef(false);
  const sourceReadyRef = useRef(false);
  const isSyncingRef = useRef(false);

  const { initGpuRadarLayer, setBandSelectionVisibility, setVisibility } =
    useRadarGpuLayer();

  const markLayersReady = useCallback((ready: boolean) => {
    layersReadyRef.current = ready;
    setLayersReady(ready);
  }, []);

  const markSourceReady = useCallback((ready: boolean) => {
    sourceReadyRef.current = ready;
    setSourceReady(ready);
  }, []);

  const ensureRadarLayers = useCallback((): void => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    initGpuRadarLayer(map);
    setBandSelectionVisibility(map, selectedIndexesRef.current);
    markSourceReady(true);
    markLayersReady(true);
  }, [initGpuRadarLayer, markLayersReady, markSourceReady, setBandSelectionVisibility]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = createRadarMap(mapContainerRef.current);

    map.on('load', () => {
      applyMapPerformanceOptions(map);
      setMapLoaded(true);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!compareMapContainerRef.current || compareMapRef.current) return;

    const compareMap = createRadarMap(compareMapContainerRef.current);

    compareMap.on('load', () => {
      applyMapPerformanceOptions(compareMap);
      setCompareMapLoaded(true);
    });

    compareMapRef.current = compareMap;

    return () => {
      compareMap.remove();
      compareMapRef.current = null;
      setCompareMapLoaded(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const compareMap = compareMapRef.current;
    if (!mapLoaded || !compareMapLoaded || !map || !compareMap) return;

    const syncFromMain = () => {
      if (isSyncingRef.current) return;
      isSyncingRef.current = true;
      syncCamera(map, compareMap);
      isSyncingRef.current = false;
    };

    const syncFromCompare = () => {
      if (isSyncingRef.current) return;
      isSyncingRef.current = true;
      syncCamera(compareMap, map);
      isSyncingRef.current = false;
    };

    map.on('move', syncFromMain);
    compareMap.on('move', syncFromCompare);

    return () => {
      map.off('move', syncFromMain);
      compareMap.off('move', syncFromCompare);
    };
  }, [compareMapLoaded, mapLoaded]);

  useEffect(() => {
    const compareMap = compareMapRef.current;
    if (!radarVisible || !compareMapLoaded || !compareMap) return;

    try {
      ensureCompareRadarLayer(compareMap, true);
    } catch (err) {
      console.error('[Compare] 加载原始雷达图失败:', err);
    }
  }, [compareMapLoaded, radarVisible]);

  useEffect(() => {
    if (!radarVisible || !mapLoaded) return;

    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    ensureRadarLayers();
  }, [ensureRadarLayers, mapLoaded, radarVisible]);

  const handleRadarVisibleChange = useCallback(
    (visible: boolean) => {
      setRadarVisible(visible);

      const map = mapRef.current;
      if (map?.isStyleLoaded()) {
        if (visible) {
          ensureRadarLayers();
        } else {
          setVisibility(map, false);
        }
      }

      const compareMap = compareMapRef.current;
      if (compareMap?.isStyleLoaded()) {
        try {
          ensureCompareRadarLayer(compareMap, visible);
        } catch (err) {
          console.error('[Compare] 加载原始雷达图失败:', err);
        }
      }
    },
    [ensureRadarLayers, setVisibility]
  );

  const handleSelectionChange = useCallback(
    (nextSelectedIndexes: number[]) => {
      selectedIndexesRef.current = nextSelectedIndexes;
      setSelectedIndexes(nextSelectedIndexes);

      if (!radarVisible || !layersReady) return;
      const map = mapRef.current;
      if (!map || !map.isStyleLoaded()) return;

      setBandSelectionVisibility(map, nextSelectedIndexes);
    },
    [radarVisible, layersReady, setBandSelectionVisibility]
  );

  return (
    <div className="flex h-full w-full bg-zinc-50">
      {/* ── 左侧面板 ── */}
      <div className="flex w-[260px] shrink-0 flex-col border-r border-zinc-200 bg-white shadow-sm">
        {/* 面板头部 */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-3 py-2.5">
          <Link
            href="/demo"
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-700"
          >
            <ArrowLeft size={13} />
            返回
          </Link>
          <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">
            预研案例
          </span>
        </div>

        {/* 面板内容 */}
        <div className="flex-1 overflow-y-auto px-3 py-3">
          <RadarFilterPanel
            thresholds={thresholds}
            selectedIndexes={selectedIndexes}
            onSelectionChange={handleSelectionChange}
            radarVisible={radarVisible}
            onRadarVisibleChange={handleRadarVisibleChange}
          />
        </div>
      </div>

      {/* ── 地图区域 ── */}
      <div className="flex flex-1 gap-0">
        {/* 过滤视图 */}
        <div className="relative flex-1">
          <div className="pointer-events-none absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-md bg-zinc-900/65 px-2.5 py-1 text-xs text-white/90 backdrop-blur-sm">
            <CloudRain size={13} className="text-cyan-300" />
            过滤视图
          </div>
          <div ref={mapContainerRef} className="h-full w-full" />

          {radarVisible && sourceReady && !layersReady && (
            <div className="absolute right-3 top-3 z-20 rounded-md bg-white/90 px-3 py-1.5 text-xs text-zinc-600 shadow-sm backdrop-blur-sm">
              正在准备筛选...
            </div>
          )}

          {radarVisible && !sourceReady && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/10 backdrop-blur-[1px]">
              <div className="rounded-lg bg-white px-4 py-2 text-sm text-zinc-600 shadow-lg">
                正在加载雷达图层...
              </div>
            </div>
          )}
        </div>

        {/* 分割线 */}
        <div className="w-[3px] shrink-0 bg-zinc-200" />

        {/* 原始视图 */}
        <div className="relative flex-1">
          <div className="pointer-events-none absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-md bg-zinc-900/65 px-2.5 py-1 text-xs text-white/90 backdrop-blur-sm">
            <CloudRain size={13} className="text-zinc-400" />
            原始视图
          </div>
          <div ref={compareMapContainerRef} className="h-full w-full" />
        </div>
      </div>
    </div>
  );
}