'use client';

import { useEffect, useRef } from 'react';
import Map from 'ol/Map';
import View from 'ol/View';
import VectorSource from 'ol/source/Vector';
import VectorLayer from 'ol/layer/Vector';
import VectorTileSource from 'ol/source/VectorTile';
import VectorTileLayer from 'ol/layer/VectorTile';
import GeoJSON from 'ol/format/GeoJSON';
import MVT from 'ol/format/MVT';
import { Fill, Stroke, Style } from 'ol/style';
import { fromLonLat } from 'ol/proj';
import type { Feature, FeatureCollection, Polygon, MultiPolygon } from 'geojson';
import { HUNAN_BOUNDS } from '../shared/const';

type ColorFullResponse = {
  body: {
    data: {
      features: Feature<Polygon>[];
    };
  };
};

export function ChinaOpenLayersPanel() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const center = fromLonLat([104, 35]);
    const boundarySource = new VectorSource();
    const colorSource = new VectorSource();
    const hunanSource = new VectorSource();

    const tileSource = new VectorTileSource({
      format: new MVT(),
      url: 'http://localhost:1234/api/tilesets/430000/{z}/{x}/{y}.pbf',
    });

    const tileLayer = new VectorTileLayer({
      source: tileSource,
      zIndex: 0,
      style: new Style({
        stroke: new Stroke({
          color: '#9e9e9e',
          width: 1,
        }),
      }),
    });

    // 区域边界
    const boundaryLayer = new VectorLayer({
      source: boundarySource,
      zIndex: 2,
      style: new Style({
        fill: new Fill({
          color: 'rgba(96, 165, 250, 1)',
        }),
        stroke: new Stroke({
          color: '#1f2937',
          width: 1,
        }),
      }),
    });

    // 湖南区域底图
    const hunanLayer = new VectorLayer({
      source: hunanSource,
      zIndex: 1.5,
      style: new Style({
        fill: new Fill({
          color: 'rgba(254, 226, 226, 0.35)',
        }),
        stroke: new Stroke({
          color: '#f97316',
          width: 2,
          lineDash: [4, 2],
        }),
      }),
    });

    // 色斑图
    const colorLayer = new VectorLayer({
      source: colorSource,
      zIndex: 1,
      style: (feature) => {
        const color = feature.get('color') as string | undefined;
        return new Style({
          fill: new Fill({
            color: color ?? '#7AC943',
          }),
          stroke: new Stroke({
            color: '#ffffff',
            width: 0.5,
          }),
        });
      },
      opacity: 0.5,
    });

    const map = new Map({
      target: containerRef.current ?? undefined,
      layers: [tileLayer, colorLayer, hunanLayer, boundaryLayer],
      view: new View({
        center,
        zoom: 4,
      }),
    });

    mapRef.current = map;

    const geoJson = new GeoJSON();

    fetch('/json/100000_full.json', {})
      .then((res) => res.json())
      .then((fc: FeatureCollection<Polygon | MultiPolygon>) => {
        const features = geoJson.readFeatures(fc, {
          dataProjection: 'EPSG:4326',
          featureProjection: 'EPSG:3857',
        });
        boundarySource.addFeatures(features);
        const extent = boundarySource.getExtent();
        if (extent) {
          map.getView().fit(extent, { padding: [40, 40, 40, 40] });
        }
      })
      .catch(() => {});

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

    const hunanFc: FeatureCollection<Polygon> = {
      type: 'FeatureCollection',
      features: [hunanPolygon],
    };

    const hunanFeatures = geoJson.readFeatures(hunanFc, {
      dataProjection: 'EPSG:4326',
      featureProjection: 'EPSG:3857',
    });
    hunanSource.addFeatures(hunanFeatures);

    fetch('/json/color_full.json', {})
      .then((res) => res.json())
      .then((raw: ColorFullResponse) => {
        const fc: FeatureCollection<Polygon> = {
          type: 'FeatureCollection',
          features: raw?.body?.data?.features ?? [],
        };
        const features = geoJson.readFeatures(fc, {
          dataProjection: 'EPSG:4326',
          featureProjection: 'EPSG:3857',
        });
        colorSource.addFeatures(features);
      })
      .catch(() => {});

    return () => {
      map.setTarget(undefined);
      mapRef.current = null;
    };
  }, []);

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <div className="pointer-events-none absolute left-4 top-4 z-40 rounded bg-white/80 px-2 py-1 text-xs text-zinc-700 shadow">
        OpenLayers
      </div>
    </div>
  );
}
