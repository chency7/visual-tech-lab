import MapboxDraw from '@mapbox/mapbox-gl-draw';
import type maplibregl from 'maplibre-gl';

export type LngLat = { lng: number; lat: number };

type DrawEventFeature = {
  id: string | number;
  geometry: { type: string; coordinates: [number, number] };
};

type MapLibreControl = maplibregl.IControl;

export interface MapboxDrawControlOptions {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

export class MapboxDrawControl {
  private map: maplibregl.Map;
  private draw: MapboxDraw;

  constructor(map: maplibregl.Map, options?: MapboxDrawControlOptions) {
    this.map = map;
    this.draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: { point: true, trash: true },
      defaultMode: 'draw_point',
      userProperties: true,
      // 自定义样式，避免 line-dasharray 在 MapLibre 上的表达式解析问题
      styles: [
        {
          id: 'gl-draw-point-inactive',
          type: 'circle',
          filter: [
            'all',
            ['==', '$type', 'Point'],
            ['!=', 'meta', 'midpoint'],
            ['!=', 'active', 'true'],
          ],
          paint: {
            'circle-radius': 4,
            'circle-color': '#3bb2d0',
            'circle-stroke-color': '#3bb2d0',
            'circle-stroke-width': 1,
          },
        },
        {
          id: 'gl-draw-point-active',
          type: 'circle',
          filter: [
            'all',
            ['==', '$type', 'Point'],
            ['!=', 'meta', 'midpoint'],
            ['==', 'active', 'true'],
          ],
          paint: {
            'circle-radius': 5,
            'circle-color': '#fbb03b',
            'circle-stroke-color': '#fbb03b',
            'circle-stroke-width': 2,
          },
        },
        {
          id: 'gl-draw-midpoint',
          type: 'circle',
          filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'midpoint']],
          paint: {
            'circle-radius': 3,
            'circle-color': '#fbb03b',
          },
        },
        // 提供最小线条/面样式以防内部依赖这些图层（未使用线/面绘制时也保持兼容）
        {
          id: 'gl-draw-line-inactive',
          type: 'line',
          filter: ['all', ['==', '$type', 'LineString'], ['!=', 'active', 'true']],
          paint: {
            'line-color': '#3bb2d0',
            'line-width': 2,
          },
        },
        {
          id: 'gl-draw-line-active',
          type: 'line',
          filter: ['all', ['==', '$type', 'LineString'], ['==', 'active', 'true']],
          paint: {
            'line-color': '#fbb03b',
            'line-width': 2,
          },
        },
        {
          id: 'gl-draw-polygon-fill-inactive',
          type: 'fill',
          filter: ['all', ['==', '$type', 'Polygon'], ['!=', 'active', 'true']],
          paint: {
            'fill-color': '#3bb2d0',
            'fill-opacity': 0.1,
          },
        },
        {
          id: 'gl-draw-polygon-fill-active',
          type: 'fill',
          filter: ['all', ['==', '$type', 'Polygon'], ['==', 'active', 'true']],
          paint: {
            'fill-color': '#fbb03b',
            'fill-opacity': 0.1,
          },
        },
        {
          id: 'gl-draw-polygon-stroke-inactive',
          type: 'line',
          filter: ['all', ['==', '$type', 'Polygon'], ['!=', 'active', 'true']],
          paint: {
            'line-color': '#3bb2d0',
            'line-width': 2,
          },
        },
        {
          id: 'gl-draw-polygon-stroke-active',
          type: 'line',
          filter: ['all', ['==', '$type', 'Polygon'], ['==', 'active', 'true']],
          paint: {
            'line-color': '#fbb03b',
            'line-width': 2,
          },
        },
      ],
    });

    map.addControl(this.draw as unknown as MapLibreControl, options?.position ?? 'top-right');
  }

  get instance() {
    return this.draw;
  }

  onCreate(cb: (id: string, lngLat: LngLat) => void) {
    this.map.on('draw.create', (e: any) => {
      const f = e?.features?.[0] as DrawEventFeature | undefined;
      if (!f || f.geometry?.type !== 'Point') return;
      const [lng, lat] = f.geometry.coordinates;
      cb(String(f.id), { lng, lat });
    });
  }

  onSelectionChange(cb: (id: string | null, lngLat: LngLat | null) => void) {
    this.map.on('draw.selectionchange', (e: any) => {
      const f = e?.features?.[0] as DrawEventFeature | undefined;
      if (f && f.geometry?.type === 'Point') {
        const [lng, lat] = f.geometry.coordinates;
        cb(String(f.id), { lng, lat });
      } else {
        cb(null, null);
      }
    });
  }

  setFeatureProperties(id: string, props: Record<string, unknown>) {
    Object.entries(props).forEach(([k, v]) => {
      // Mapbox Draw 支持 number | string | boolean | null
      this.draw.setFeatureProperty(id, k, (v as number | string | boolean | null) ?? null);
    });
  }

  remove() {
    this.map.removeControl(this.draw as unknown as MapLibreControl);
  }
}
