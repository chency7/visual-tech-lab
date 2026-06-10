'use client';

import { useEffect, useRef, RefObject } from 'react';
import Link from 'next/link';
import 'maplibre-gl/dist/maplibre-gl.css';
import { createMap } from '../shared/utils/initMap';
import { MapContainer } from '../shared/components';
import type maplibregl from 'maplibre-gl';
import type { Feature, FeatureCollection, Polygon, MultiPolygon } from 'geojson';
import { bbox } from '@turf/turf';
import { HUNAN_BOUNDS } from '../shared/const';

type ColorFullResponse = {
  body: {
    data: {
      features: Feature<Polygon>[];
    };
  };
};

export function ChinaMapLibrePanel() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = createMap(containerRef.current, {
      options: {
        center: [104, 35],
        zoom: 3.8,
        minZoom: 3,
        maxZoom: 8,
        maxBounds: [
          [73.66, 18.12],
          [135.05, 53.55],
        ],
      },
      controls: {
        navigation: true,
        scale: { maxWidth: 100, unit: 'metric' },
        geolocate: false,
        reset: {
          center: [104, 35],
          zoom: 3.8,
          bearing: 0,
          pitch: 0,
          speed: 0.8,
        },
        measure: false,
        zoomCenter: { position: 'top-left' },
      },
    });

    mapRef.current = map;

    const addChinaLayers = (fc: FeatureCollection<Polygon | MultiPolygon>) => {
      if (!map.getSource('china-full')) {
        map.addSource('china-full', { type: 'geojson', data: fc });
      }

      if (!map.getLayer('china-full-fill')) {
        map.addLayer({
          id: 'china-full-fill',
          type: 'fill',
          source: 'china-full',
          paint: {
            'fill-color': 'rgba(96, 165, 250, 1)',
            'fill-opacity': 1,
          },
        });
      }

      if (!map.getLayer('china-full-outline')) {
        map.addLayer({
          id: 'china-full-outline',
          type: 'line',
          source: 'china-full',
          paint: {
            'line-color': '#1f2937',
            'line-width': 1,
          },
        });
      }

      if (map.getLayer('china-color-fill')) {
        map.moveLayer('china-color-fill', 'china-full-fill');
      }
    };

    const addHunanRegionLayer = () => {
      const [[minLng, minLat], [maxLng, maxLat]] = HUNAN_BOUNDS;
      const hunanPolygon: Feature<Polygon> = {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [minLng, minLat],
              [maxLng, minLat],
              [maxLng, maxLat],
              [minLng, maxLat],
              [minLng, minLat],
            ],
          ],
        },
        properties: {},
      };

      const sourceId = 'hunan-region';
      const fillId = 'hunan-region-fill';
      const outlineId = 'hunan-region-outline';

      if (!map.getSource(sourceId)) {
        map.addSource(sourceId, {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: [hunanPolygon],
          },
        });
      }

      if (!map.getLayer(fillId)) {
        map.addLayer({
          id: fillId,
          type: 'fill',
          source: sourceId,
          paint: {
            'fill-color': 'rgba(254, 226, 226, 0.35)',
            'fill-opacity': 1,
          },
        });
      }

      if (!map.getLayer(outlineId)) {
        map.addLayer({
          id: outlineId,
          type: 'line',
          source: sourceId,
          paint: {
            'line-color': '#f97316',
            'line-width': 2,
            'line-dasharray': [2, 1],
          },
        });
      }
    };

    const ensureLoadedAndAdd = (fc: FeatureCollection<Polygon | MultiPolygon>) => {
      const boundsArray = bbox(fc);
      const bounds: [[number, number], [number, number]] = [
        [boundsArray[0], boundsArray[1]],
        [boundsArray[2], boundsArray[3]],
      ];
      const run = () => {
        addChinaLayers(fc);
        addHunanRegionLayer();
        map.fitBounds(bounds, { padding: 40 });
      };
      if (map.isStyleLoaded()) run();
      else map.on('load', run);
    };

    fetch('/json/100000_full.json', {})
      .then((res) => res.json())
      .then((fc: FeatureCollection<Polygon | MultiPolygon>) => {
        ensureLoadedAndAdd(fc);
      })
      .catch(() => {});

    const addColorLayers = (fc: FeatureCollection<Polygon>) => {
      if (!map.getSource('china-color')) {
        map.addSource('china-color', { type: 'geojson', data: fc });
      }

      if (!map.getLayer('china-color-fill')) {
        map.addLayer({
          id: 'china-color-fill',
          type: 'fill',
          source: 'china-color',
          paint: {
            'fill-color': ['get', 'color'],
            'fill-opacity': 0.7,
          },
        });
      }

      if (map.getLayer('china-full-fill')) {
        map.moveLayer('china-color-fill', 'china-full-fill');
      }
    };

    const ensureColorLoadedAndAdd = (fc: FeatureCollection<Polygon>) => {
      const run = () => addColorLayers(fc);
      if (map.isStyleLoaded()) run();
      else map.on('load', run);
    };

    fetch('/json/color_full.json', {})
      .then((res) => res.json())
      .then((raw: ColorFullResponse) => {
        const features = raw?.body?.data?.features ?? [];
        const fc: FeatureCollection<Polygon> = {
          type: 'FeatureCollection',
          features,
        };
        ensureColorLoadedAndAdd(fc);
      })
      .catch(() => {});

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <MapContainer
      containerRef={containerRef as RefObject<HTMLDivElement>}
      className="h-full w-full"
    >
      <Link
        href="/demo"
        className="pointer-events-auto absolute left-1/2 top-4 z-50 -translate-x-1/2 rounded bg-white/80 px-3 py-2 text-sm shadow backdrop-blur hover:bg-white"
      >
        返回预研案例
      </Link>
      <div className="pointer-events-none absolute left-4 top-4 z-40 rounded bg-white/80 px-2 py-1 text-xs text-zinc-700 shadow">
        MapLibre GL（Mapbox 系渲染）
      </div>
    </MapContainer>
  );
}