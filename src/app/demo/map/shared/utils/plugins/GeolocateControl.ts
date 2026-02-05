import type maplibregl from 'maplibre-gl';

/**
 * 经纬度坐标拾取控件
 */
export class GeolocateControl implements maplibregl.IControl {
  private map?: maplibregl.Map;
  private container?: HTMLElement;
  private onMouseMove?: (e: maplibregl.MapMouseEvent) => void;

  private toText(lngLat: maplibregl.LngLat) {
    return `经度：${lngLat.lng.toFixed(6)}, 纬度：${lngLat.lat.toFixed(6)}`;
  }

  onAdd(map: maplibregl.Map): HTMLElement {
    this.map = map;
    this.container = document.createElement('div');
    this.container.className = 'maplibregl-ctrl maplibregl-ctrl-lnglat';
    this.container.textContent = this.toText(map.getCenter());

    const handler = (e: maplibregl.MapMouseEvent) => {
      const el = this.container as HTMLElement;
      el.textContent = this.toText(e.lngLat);
    };
    this.onMouseMove = handler;
    map.on('mousemove', handler);

    return this.container;
  }

  onRemove(): void {
    if (this.map && this.onMouseMove) {
      this.map.off('mousemove', this.onMouseMove);
    }
    this.container?.parentNode?.removeChild(this.container as HTMLElement);
    this.map = undefined;
    this.container = undefined;
    this.onMouseMove = undefined;
  }

  getDefaultPosition(): maplibregl.ControlPosition {
    return 'top-right';
  }
}