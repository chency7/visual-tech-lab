import { useCallback } from 'react';
import { HUNAN_BOUNDS } from '../const';
import { toLngLatBounds } from '../utils/bounds';

// 1.前端获取离散点数据。
// 2.使用 Turf.js 的interpolate方法(基于反距离权重法-IDW)或专门的 kriging.js 库(实现克里金法)进行空间插值，生成规则网格数据1
// 3.调用Turf.js的isobands 或isolines函数，基于网格数据生成等值面/等值线的GeoJSON矢量数据。
// 4.将GeoJSON数据源添加到Mapbox地图，配置填充图层样式进行可视化。

import {
  generateRectGrid,
  buildLabelGridFilter,
  applyIdwToLabelLayer,
  applyIdwIsobandsFillLayer,
  type StationDatum,
} from '../utils/grid';
import type {
  MapInstance,
  StationData,
  MockPointsData,
  StationFeatureCollection,
  IdwConfig
} from '../types';
// isobands 功能已移除

/**
 * 地图业务逻辑 Hook
 * 封装网格业务、点位业务和IDW转换逻辑
 */
export function useMapBusinessLogic() {
  /**
   * 添加网格业务逻辑到地图
   */
  const addGridBusiness = useCallback((map: MapInstance) => {
    // 调整地图视野到湖南省范围
    map.fitBounds(toLngLatBounds(HUNAN_BOUNDS), {
      padding: { top: 50, right: 20, bottom: 20, left: 20 },
      maxZoom: 9,
    });

    // 生成网格数据
    const gridFC = generateRectGrid(HUNAN_BOUNDS, 100, 100);
    const gridSourceId = 'hunan-grid-source';
    const gridFillLayerId = 'hunan-grid-fill';
    const gridLabelLayerId = 'hunan-grid-labels';

    // 添加网格数据源
    if (!map.getSource(gridSourceId)) {
      map.addSource(gridSourceId, {
        type: 'geojson',
        data: gridFC,
        tolerance: 0
      });
    }

    // 添加网格填充图层
    if (!map.getLayer(gridFillLayerId)) {
      map.addLayer({
        id: gridFillLayerId,
        type: 'fill',
        source: gridSourceId,
        paint: {
          'fill-color': [
            'let',
            'idx',
            ['-', ['get', 'value'], ['*', 10, ['floor', ['/', ['get', 'value'], 10]]]],
            [
              'case',
              ['==', ['var', 'idx'], 0], '#ef4444',
              ['==', ['var', 'idx'], 1], '#f59e0b',
              ['==', ['var', 'idx'], 2], '#84cc16',
              ['==', ['var', 'idx'], 3], '#10b981',
              ['==', ['var', 'idx'], 4], '#06b6d4',
              ['==', ['var', 'idx'], 5], '#3b82f6',
              ['==', ['var', 'idx'], 6], '#8b5cf6',
              ['==', ['var', 'idx'], 7], '#ec4899',
              ['==', ['var', 'idx'], 8], '#14b8a6',
              '#f97316',
            ],
          ],
          'fill-opacity': 0.05,
        },
        layout: {},
      });
    }

    // 添加网格标签图层
    if (!map.getLayer(gridLabelLayerId)) {
      map.addLayer({
        id: gridLabelLayerId,
        type: 'symbol',
        source: gridSourceId,
        minzoom: 6,
        layout: {
          'text-field': ['to-string', ['get', 'value']],
          'text-size': 10,
          'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
          'symbol-placement': 'point',
        },
        paint: {
          'text-color': '#111827',
          'text-halo-color': '#ffffff',
          'text-halo-width': 0.5,
        },
        filter: buildLabelGridFilter(),
      });
    }
  }, []);

  /**
   * 处理原始点位数据，转换为标准格式
   */
  const processStationData = useCallback((mockPoints: MockPointsData): StationData[] => {
    const raw = mockPoints?.body?.data ?? [];
    return raw
      .map((d) => ({
        lon: Number(d.lon),
        lat: Number(d.lat),
        pre: Number(d.pre ?? 0),
        stationCode: d.stationCode,
        stationName: d.stationName,
      }))
      .filter((s) => Number.isFinite(s.lon) && Number.isFinite(s.lat));
  }, []);

  /**
   * 将站点数据转换为GeoJSON格式
   */
  const createStationFeatureCollection = useCallback((stations: StationData[]): StationFeatureCollection => {
    const features = stations.map((d, idx) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [d.lon, d.lat]
      },
      properties: {
        pre: d.pre,
        idx,
        stationCode: d.stationCode,
        stationName: d.stationName,
      },
    }));

    return { type: 'FeatureCollection', features };
  }, []);

  /**
   * 添加点位业务逻辑到地图
   */
  const addPointsBusiness = useCallback((map: MapInstance, mockPoints: MockPointsData) => {
    const stations = processStationData(mockPoints);
    const pointsFC = createStationFeatureCollection(stations);

    const pointsSourceId = 'hunan-random-points';
    const pointsLayerId = 'hunan-random-points-labels';

    // 添加点位数据源
    if (!map.getSource(pointsSourceId)) {
      map.addSource(pointsSourceId, {
        type: 'geojson',
        data: pointsFC
      });
    }

    // 添加点位标签图层
    if (!map.getLayer(pointsLayerId)) {
      map.addLayer({
        id: pointsLayerId,
        type: 'symbol',
        source: pointsSourceId,
        minzoom: 0,
        layout: {
          'text-field': ['to-string', ['get', 'pre']],
          'text-size': 11,
          'symbol-placement': 'point',
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': '#111827',
          'text-halo-color': '#ffffff',
          'text-halo-width': 0.8,
        },
      });
    }
  }, [processStationData, createStationFeatureCollection]);

  /**
   * 执行IDW插值转换
   */
  const transformIDW = useCallback((
    map: MapInstance,
    mockPoints: MockPointsData,
    config: IdwConfig,
    onComplete?: () => void
  ) => {
    if (!map) return;

    if (!map.isStyleLoaded()) {
      map.once('load', () => transformIDW(map, mockPoints, config, onComplete));
      return;
    }

    const stations = processStationData(mockPoints);
    const stationDatums: StationDatum[] = stations.map(s => ({
      lon: s.lon,
      lat: s.lat,
      pre: s.pre,
    }));

    applyIdwToLabelLayer(map, HUNAN_BOUNDS, stationDatums, config);
    // applyIdwIsobandsFillLayer(map, HUNAN_BOUNDS, stationDatums, {
    //   cols: config.cols,
    //   rows: config.rows,
    //   power: config.power,
    //   hidePointsLayerId: config.hidePointsLayerId,
    //   hideLabelLayerId: 'hunan-idw-grid-labels',
    //   breaks: config.breaks,
    //   colors: config.colors,
    //   neighbors: config.neighbors,
    //   maxDistanceDeg: config.maxDistanceDeg,
    // });
    onComplete?.();
  }, [processStationData]);

  /**
   * 依据IDW格点生成等值面色斑（填充图层）
   * - 独立使用等值面数据源，避免与标签图层冲突
   * - 使用给定阈值进行颜色分段
   */
  // 已移除：transformIsobands 等值面色斑功能

  return {
    addGridBusiness,
    addPointsBusiness,
    transformIDW,
  };
}