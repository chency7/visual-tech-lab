import type maplibregl from 'maplibre-gl';
import { point, lineString, featureCollection } from '@turf/turf';
import type {
  FeatureCollection as GeoFeatureCollection,
  Point as GeoPoint,
  LineString as GeoLineString,
} from 'geojson';

type LngLat = [number, number];

function haversineDistance(a: LngLat, b: LngLat): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371008.8;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export class MeasureControl implements maplibregl.IControl {
  private _map?: maplibregl.Map;
  private _container?: HTMLElement;
  private _active = false;
  private _points: LngLat[] = [];
  private _total = 0;

  private readonly pointsSourceId = 'measure-points-source';
  private readonly lineSourceId = 'measure-line-source';
  private readonly pointsLayerId = 'measure-points-layer';
  private readonly lineLayerId = 'measure-line-layer';

  onAdd(map: maplibregl.Map): HTMLElement {
    this._map = map;

    const container = document.createElement('div');
    container.className = 'maplibregl-ctrl maplibregl-ctrl-group';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '4px';

    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.setAttribute('aria-label', '测距');
    toggleBtn.title = '测距';
    toggleBtn.style.width = '30px';
    toggleBtn.style.height = '30px';
    toggleBtn.style.display = 'flex';
    toggleBtn.style.alignItems = 'center';
    toggleBtn.style.justifyContent = 'center';
    toggleBtn.style.cursor = 'pointer';
    toggleBtn.style.borderRadius = '2px';
    toggleBtn.style.color = '#0ea5e9';
    toggleBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="8" width="20" height="8" rx="2"></rect>
        <path d="M6 8v8M10 8v8M14 8v8M18 8v8"></path>
      </svg>
    `;

    const label = document.createElement('div');
    Object.assign(label.style, {
      fontSize: '12px',
      fontFamily: 'monospace',
      padding: '4px 6px',
      background: 'rgba(0,0,0,0.45)',
      color: '#fff',
      border: '1px solid rgba(255,255,255,0.15)',
      borderRadius: '4px',
      minWidth: '30px',
      textAlign: 'center',
    });
    label.textContent = '0 m';

    container.appendChild(toggleBtn);
    container.appendChild(label);

    const updateLabel = () => {
      const meters = this._total;
      label.textContent =
        meters < 1000 ? `${meters.toFixed(1)} m` : `${(meters / 1000).toFixed(2)} km`;
    };

    const addSourcesAndLayers = () => {
      if (!this._map) return;
      const map = this._map;
      if (!map.getSource(this.pointsSourceId)) {
        map.addSource(this.pointsSourceId, {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });
      }
      if (!map.getSource(this.lineSourceId)) {
        map.addSource(this.lineSourceId, {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });
      }
      if (!map.getLayer(this.lineLayerId)) {
        map.addLayer({
          id: this.lineLayerId,
          type: 'line',
          source: this.lineSourceId,
          paint: {
            'line-color': '#22c55e',
            'line-width': 3,
          },
        });
      }
      if (!map.getLayer(this.pointsLayerId)) {
        map.addLayer({
          id: this.pointsLayerId,
          type: 'circle',
          source: this.pointsSourceId,
          paint: {
            'circle-radius': 4,
            'circle-color': '#22c55e',
            'circle-stroke-color': '#14532d',
            'circle-stroke-width': 1,
          },
        });
      }
    };

    const updateGeoJSON = () => {
      if (!this._map) return;
      const pointsFC: GeoFeatureCollection<GeoPoint> = featureCollection(
        this._points.map((p) => point(p))
      );
      const lineFC: GeoFeatureCollection<GeoLineString> =
        this._points.length >= 2
          ? featureCollection([lineString(this._points)])
          : featureCollection([]);
      const pointsSource = this._map.getSource(this.pointsSourceId) as maplibregl.GeoJSONSource;
      const lineSource = this._map.getSource(this.lineSourceId) as maplibregl.GeoJSONSource;
      pointsSource?.setData(pointsFC);
      lineSource?.setData(lineFC);
    };

    const onClick = (e: maplibregl.MapMouseEvent) => {
      if (!this._active) return;
      const lngLat = e.lngLat.toArray() as LngLat;
      const last = this._points[this._points.length - 1];
      this._points.push(lngLat);
      if (last) this._total += haversineDistance(last, lngLat);
      updateGeoJSON();
      updateLabel();
    };

    const enable = () => {
      this._active = true;
      toggleBtn.classList.add('active');
      toggleBtn.style.backgroundColor = 'rgba(14,165,233,0.15)';
      this._map?.on('click', onClick);
    };

    const disable = () => {
      this._active = false;
      toggleBtn.classList.remove('active');
      toggleBtn.style.backgroundColor = 'transparent';
      this._map?.off('click', onClick);
    };

    toggleBtn.addEventListener('click', () => {
      if (this._active) {
        disable();
      } else {
        enable();
      }
    });

    const setup = () => addSourcesAndLayers();
    if (this._map?.isStyleLoaded()) setup();
    else this._map?.once('load', setup);

    this._container = container;
    return container;
  }

  onRemove(): void {
    if (!this._map) return;
    if (this._map.getLayer(this.pointsLayerId)) this._map.removeLayer(this.pointsLayerId);
    if (this._map.getLayer(this.lineLayerId)) this._map.removeLayer(this.lineLayerId);
    if (this._map.getSource(this.pointsSourceId)) this._map.removeSource(this.pointsSourceId);
    if (this._map.getSource(this.lineSourceId)) this._map.removeSource(this.lineSourceId);
    this._container?.remove();
    this._map = undefined;
    this._container = undefined;
    this._points = [];
    this._total = 0;
  }

  getDefaultPosition(): maplibregl.ControlPosition {
    return 'bottom-left';
  }
}
