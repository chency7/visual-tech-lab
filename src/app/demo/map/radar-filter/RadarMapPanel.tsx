'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { ArrowLeft } from 'lucide-react';
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
      // 页面不需要导出 canvas，关闭 preserveDrawingBuffer 可以减少显存和渲染成本。
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
  // ── DOM 与 MapLibre 实例引用 ──
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const compareMapContainerRef = useRef<HTMLDivElement>(null);
  const compareMapRef = useRef<maplibregl.Map | null>(null);

  // ── React 状态：只保存会影响 UI 的信息 ──
  const [mapLoaded, setMapLoaded] = useState(false);
  const [compareMapLoaded, setCompareMapLoaded] = useState(false);
  const [radarVisible, setRadarVisible] = useState(false);
  const [sourceReady, setSourceReady] = useState(false);
  const [layersReady, setLayersReady] = useState(false);
  const [thresholds] = useState<ThresholdRange[]>(() => parseThresholds());
  const [selectedIndexes, setSelectedIndexes] = useState<number[]>(() =>
    thresholds.map((_threshold, index) => index)
  );

  // ── 运行时引用：保存最新选择，避免地图事件里频繁触发 React render ──
  const selectedIndexesRef = useRef<number[]>(thresholds.map((_threshold, index) => index));
  const layersReadyRef = useRef(false);
  const sourceReadyRef = useRef(false);
  // 同步标志：A 地图 jumpTo B 后，B 也会触发 move；用它避免互相递归同步。
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

    // 左侧过滤视图走 WebGL custom layer，GPU 根据当前色域实时 discard 像素。
    initGpuRadarLayer(map);
    setBandSelectionVisibility(map, selectedIndexesRef.current);
    markSourceReady(true);
    markLayersReady(true);
  }, [initGpuRadarLayer, markLayersReady, markSourceReady, setBandSelectionVisibility]);

  // ── 初始化左侧过滤地图 ──
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

  // ── 初始化对比地图（右侧，显示原始雷达图，不做过滤）──
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

  // ── 实时同步两边地图的缩放/平移/旋转/俯仰 ──
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

  // 如果用户先打开雷达、右侧地图后加载完成，这里补一次原始图层创建，避免右侧空白。
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

  // ── 开关雷达图层 ──
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

      // 右侧对比视图使用普通 raster image source，始终展示未过滤的原始雷达图。
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
    <div className="flex h-full w-full">
      {/* 左侧：过滤面板 */}
      <div className="flex w-80 shrink-0 flex-col border-r border-zinc-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-zinc-800">雷达图阈值过滤</h2>
          <Link
            href="/"
            className="inline-flex items-center gap-1 rounded border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
          >
            <ArrowLeft size={13} />
            首页
          </Link>
        </div>
        <RadarFilterPanel
          thresholds={thresholds}
          selectedIndexes={selectedIndexes}
          onSelectionChange={handleSelectionChange}
          radarVisible={radarVisible}
          onRadarVisibleChange={handleRadarVisibleChange}
        />
      </div>

      {/* 中间：过滤后地图 */}
      <div className="relative flex-1 border-r border-zinc-200">
        <div className="absolute left-2 top-2 z-10 rounded bg-black/60 px-2 py-0.5 text-xs text-white">
          过滤视图
        </div>
        <div ref={mapContainerRef} className="h-full w-full" />

        {radarVisible && sourceReady && !layersReady && (
          <div className="absolute right-3 top-3 z-20 rounded bg-white/90 px-3 py-1.5 text-xs text-zinc-600 shadow">
            正在准备筛选...
          </div>
        )}

        {radarVisible && !sourceReady && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/20">
            <div className="rounded-lg bg-white px-4 py-2 text-sm text-zinc-600 shadow-lg">
              正在加载雷达图层...
            </div>
          </div>
        )}
      </div>

      {/* 右侧：对比地图（原始雷达图） */}
      <div className="relative flex-1">
        <div className="absolute left-2 top-2 z-10 rounded bg-black/60 px-2 py-0.5 text-xs text-white">
          原始视图
        </div>
        <div ref={compareMapContainerRef} className="h-full w-full" />
      </div>
    </div>
  );
}
