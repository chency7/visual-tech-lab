'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import 'maplibre-gl/dist/maplibre-gl.css';

import { MapContainer } from '../shared/components';
import { HUNAN_CONTOUR_BOUNDS, HUNAN_CONTOUR_GRID_NODES } from '../shared/const';
import { useIdwWorker, useMapBusinessLogic, useMapState, useMapSync } from '../shared/hooks';
import mockPoints from '../shared/mock/point.json';
import stainData from '../shared/mock/stain.json';
import type { IdwConfig, MapInstance, MapConfig, MockPointsData, StainData } from '../shared/types';
import { createMap } from '../shared/utils/initMap';
import { applyIdwResultToMap, setIdwLayerVisibility } from '../shared/utils/grid';

const RAW_VALUE_LAYER_ID = 'hunan-random-points-labels';

export default function MapPage() {
  const { leftMap, rightMap, leftContainerRef, rightContainerRef, setLeftMap, setRightMap } =
    useMapState();

  const { addStainBusiness, addPointsBusiness, getStationDatums } = useMapBusinessLogic();
  const { compute } = useIdwWorker();
  const [isComputingIdw, setIsComputingIdw] = useState(false);
  const [idwError, setIdwError] = useState<string | null>(null);
  const [showValueLabels, setShowValueLabels] = useState(false);
  const [showColorBands, setShowColorBands] = useState(true);
  const initializedRef = useRef(false);
  const isComputingIdwRef = useRef(false);
  const idwVisibilityRef = useRef({ labels: false, isobands: true });

  useMapSync(leftMap, rightMap);

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
        measure: true,
        zoomCenter: { position: 'top-left' },
      },
    }),
    []
  );

  const idwConfig: IdwConfig = useMemo(
    () => ({
      cols: HUNAN_CONTOUR_GRID_NODES - 1,
      rows: HUNAN_CONTOUR_GRID_NODES - 1,
      power: 2,
      hidePointsLayerId: RAW_VALUE_LAYER_ID,
      minzoom: 6,
      neighbors: 4,
      smoothIterations: 3,
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

  const legendLabels = useMemo(
    () => [
      '0 - 0.1',
      '0.1 - 9.9',
      '10 - 24.9',
      '25 - 49.9',
      '50 - 99.9',
      '100 - 249.9',
      '250 - 399.9',
      '400 - 599.9',
      '>600',
    ],
    []
  );

  const legendItems = useMemo(
    () =>
      idwConfig.colors?.map((color, index) => {
        const lower = idwConfig.breaks?.[index] ?? 0;
        const upper = idwConfig.breaks?.[index + 1];
        return {
          color,
          label:
            legendLabels[index] ??
            (upper === 10000 || upper == null ? `>${lower}` : `${lower}-${upper}`),
        };
      }) ?? [],
    [idwConfig.breaks, idwConfig.colors, legendLabels]
  );

  useEffect(() => {
    idwVisibilityRef.current = {
      labels: showValueLabels,
      isobands: showColorBands,
    };
    if (!rightMap) return;

    setIdwLayerVisibility(
      rightMap,
      {
        labels: showValueLabels,
        isobands: showColorBands,
      },
      {
        labelId: RAW_VALUE_LAYER_ID,
      }
    );
  }, [rightMap, showColorBands, showValueLabels]);

  const computeAndShowIdw = useCallback(
    async (targetMap: MapInstance) => {
      if (isComputingIdwRef.current) return;

      isComputingIdwRef.current = true;
      setIsComputingIdw(true);
      setIdwError(null);

      try {
        const stationDatums = getStationDatums(mockPoints as MockPointsData);
        const result = await compute({
          bbox: HUNAN_CONTOUR_BOUNDS,
          stations: stationDatums,
          config: {
            cols: idwConfig.cols,
            rows: idwConfig.rows,
            gridSpacingKm: idwConfig.gridSpacingKm,
            power: idwConfig.power,
            neighbors: idwConfig.neighbors,
            maxDistanceDeg: idwConfig.maxDistanceDeg,
            breaks: idwConfig.breaks,
            colors: idwConfig.colors,
            smoothIterations: idwConfig.smoothIterations,
          },
        });

        applyIdwResultToMap(targetMap, result, {
          minzoom: idwConfig.minzoom,
          createGridLabelLayer: false,
        });
        setIdwLayerVisibility(targetMap, idwVisibilityRef.current, {
          labelId: RAW_VALUE_LAYER_ID,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'IDW 计算失败';
        setIdwError(message);
      } finally {
        isComputingIdwRef.current = false;
        setIsComputingIdw(false);
      }
    },
    [
      compute,
      getStationDatums,
      idwConfig.breaks,
      idwConfig.colors,
      idwConfig.cols,
      idwConfig.maxDistanceDeg,
      idwConfig.minzoom,
      idwConfig.neighbors,
      idwConfig.power,
      idwConfig.rows,
    ]
  );

  useEffect(() => {
    if (initializedRef.current) return;
    if (!leftContainerRef.current || !rightContainerRef.current) return;
    initializedRef.current = true;

    const leftMapInstance = createMap(leftContainerRef.current, mapConfig);
    const rightMapInstance = createMap(rightContainerRef.current, mapConfig);

    setLeftMap(leftMapInstance);
    setRightMap(rightMapInstance);

    leftMapInstance.on('load', () => {
      addStainBusiness(leftMapInstance, stainData as StainData);
    });

    rightMapInstance.on('load', () => {
      addPointsBusiness(rightMapInstance, mockPoints as MockPointsData);
      setIdwLayerVisibility(
        rightMapInstance,
        {
          labels: idwVisibilityRef.current.labels,
        },
        {
          labelId: RAW_VALUE_LAYER_ID,
        }
      );
      void computeAndShowIdw(rightMapInstance);
    });

    return () => {
      initializedRef.current = false;
      leftMapInstance.remove();
      rightMapInstance.remove();
      setLeftMap(null);
      setRightMap(null);
    };
  }, []);

  return (
    <div className="relative flex h-screen w-full">
      <MapContainer
        containerRef={leftContainerRef as React.RefObject<HTMLDivElement>}
        className="grow-[2]"
      >
        <Link
          href="/"
          className="pointer-events-auto absolute right-[30px] top-2 z-50 -translate-x-1/2 rounded bg-white/80 px-3 py-2 shadow backdrop-blur hover:bg-white"
          title="返回首页"
        >
          返回首页
        </Link>
      </MapContainer>

      <MapContainer
        containerRef={rightContainerRef as React.RefObject<HTMLDivElement>}
        className="grow-[3] border-l border-gray-300"
      >
        <div className="pointer-events-auto absolute right-[60px] top-2 z-50 rounded bg-white/90 px-3 py-2 text-sm text-gray-800 shadow backdrop-blur">
          <div className="mb-1 font-medium">右侧图层</div>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={showValueLabels}
              onChange={(event) => setShowValueLabels(event.target.checked)}
            />
            <span>数值</span>
          </label>
          <label className="mt-1 flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={showColorBands}
              onChange={(event) => setShowColorBands(event.target.checked)}
            />
            <span>色斑</span>
          </label>
          {isComputingIdw ? <div className="mt-1 text-xs text-gray-500">色斑计算中...</div> : null}
        </div>

        {idwError ? (
          <div className="pointer-events-none absolute left-4 top-4 z-50 rounded bg-red-100/90 px-3 py-2 text-sm text-red-700 shadow">
            {idwError}
          </div>
        ) : null}

        <div className="pointer-events-none absolute bottom-4 right-4 z-50 rounded bg-white/90 px-3 py-2 text-xs text-gray-800 shadow backdrop-blur">
          <div className="mb-1 font-medium">图例（毫米）</div>
          <div className="grid gap-1">
            {legendItems.map((item) => {
              const isTransparent = item.color.includes('rgba') && item.color.endsWith(', 0)');
              return (
                <div key={item.label} className="flex items-center gap-2">
                  <span
                    className="h-3 w-6 border border-gray-300"
                    style={{
                      backgroundColor: item.color,
                      backgroundImage: isTransparent
                        ? 'linear-gradient(45deg, #e5e7eb 25%, transparent 25%), linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e7eb 75%), linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)'
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
      </MapContainer>
    </div>
  );
}
