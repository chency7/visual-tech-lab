import { useCallback } from 'react';
import { BOUNDARY_LAYER_IDS, HUNAN_BOUNDS } from '../const';
import type {
  MapInstance,
  MockPointsData,
  StationData,
  StationDatum,
  StationFeatureCollection,
  StainData,
} from '../types';
import { toLngLatBounds } from '../utils/bounds';
import { buildLabelGridFilter, generateRectGrid } from '../utils/grid';

function getFirstBoundaryLayerId(map: MapInstance) {
  return BOUNDARY_LAYER_IDS.find((layerId) => map.getLayer(layerId));
}

/**
 * 地图业务逻辑 Hook
 * 封装网格业务、点位业务和站点数据标准化逻辑。
 */
export function useMapBusinessLogic() {
  const fitToHunan = useCallback((map: MapInstance) => {
    map.fitBounds(toLngLatBounds(HUNAN_BOUNDS), {
      padding: { top: 50, right: 20, bottom: 20, left: 20 },
      maxZoom: 9,
    });
  }, []);

  const addGridBusiness = useCallback((map: MapInstance) => {
    fitToHunan(map);

    const gridFC = generateRectGrid(HUNAN_BOUNDS, 100, 100);
    const gridSourceId = 'hunan-grid-source';
    const gridFillLayerId = 'hunan-grid-fill';
    const gridLabelLayerId = 'hunan-grid-labels';

    if (!map.getSource(gridSourceId)) {
      map.addSource(gridSourceId, {
        type: 'geojson',
        data: gridFC,
        tolerance: 0,
      });
    }

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
  }, [fitToHunan]);

  const addStainBusiness = useCallback(
    (map: MapInstance, stainData: StainData) => {
      fitToHunan(map);

      const sourceId = 'hunan-backend-stain-source';
      const fillLayerId = 'hunan-backend-stain-fill';
      const stainFC = stainData.body.data;

      if (!map.getSource(sourceId)) {
        map.addSource(sourceId, {
          type: 'geojson',
          data: stainFC,
          tolerance: 0,
        });
      }

      if (!map.getLayer(fillLayerId)) {
        map.addLayer({
          id: fillLayerId,
          type: 'fill',
          source: sourceId,
          paint: {
            'fill-color': ['coalesce', ['get', 'color'], 'rgba(255, 255, 255, 0)'],
            'fill-opacity': 0.9,
          },
        }, getFirstBoundaryLayerId(map));
      } else {
        const beforeLayerId = getFirstBoundaryLayerId(map);
        if (beforeLayerId) {
          map.moveLayer(fillLayerId, beforeLayerId);
        }
      }
    },
    [fitToHunan]
  );

  const processStationData = useCallback((mockPoints: MockPointsData): StationData[] => {
    const raw = Array.isArray(mockPoints?.body)
      ? mockPoints.body
      : mockPoints?.body?.data ?? [];
    return raw
      .map((datum) => ({
        lon: Number(datum.lon),
        lat: Number(datum.lat),
        pre: Number(datum.pre ?? 0),
        stationCode: datum.stationCode,
        stationName: datum.stationName,
      }))
      .filter((station) => Number.isFinite(station.lon) && Number.isFinite(station.lat));
  }, []);

  const createStationFeatureCollection = useCallback(
    (stations: StationData[]): StationFeatureCollection => {
      const features = stations.map((station, idx) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [station.lon, station.lat],
        },
        properties: {
          pre: station.pre,
          idx,
          stationCode: station.stationCode,
          stationName: station.stationName,
        },
      }));

      return { type: 'FeatureCollection', features };
    },
    []
  );

  const addPointsBusiness = useCallback(
    (map: MapInstance, mockPoints: MockPointsData) => {
      const stations = processStationData(mockPoints);
      const pointsFC = createStationFeatureCollection(stations);
      const pointsSourceId = 'hunan-random-points';
      const pointsLayerId = 'hunan-random-points-labels';

      if (!map.getSource(pointsSourceId)) {
        map.addSource(pointsSourceId, {
          type: 'geojson',
          data: pointsFC,
        });
      }

      if (!map.getLayer(pointsLayerId)) {
        map.addLayer({
          id: pointsLayerId,
          type: 'symbol',
          source: pointsSourceId,
          minzoom: 0,
          maxzoom: 12,
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
    },
    [createStationFeatureCollection, processStationData]
  );

  const getStationDatums = useCallback(
    (mockPoints: MockPointsData): StationDatum[] =>
      processStationData(mockPoints).map((station) => ({
        lon: station.lon,
        lat: station.lat,
        pre: station.pre,
      })),
    [processStationData]
  );

  return {
    addGridBusiness,
    addStainBusiness,
    addPointsBusiness,
    getStationDatums,
  };
}
