import type maplibregl from 'maplibre-gl';

/**
 * 缩放与中心点显示控件（左上角）。
 * 显示当前地图缩放级别与中心点坐标，随地图移动/缩放实时更新。
 */
export class ZoomCenterControl implements maplibregl.IControl {
  private map?: maplibregl.Map;
  private container?: HTMLElement;
  private onMove?: (e: maplibregl.MapEventType['move']) => void;

  private toText(map: maplibregl.Map) {
    const zoom = map.getZoom();
    const c = map.getCenter();
    return `缩放：${zoom.toFixed(2)}\n中心：${c.lng.toFixed(6)}, ${c.lat.toFixed(6)}`;
  }

  onAdd(map: maplibregl.Map): HTMLElement {
    this.map = map;
    const container = document.createElement('div');
    container.className = 'maplibregl-ctrl maplibregl-ctrl-zoom-center';
    container.style.whiteSpace = 'pre';
    container.style.fontSize = '12px';
    container.style.lineHeight = '16px';
    container.style.padding = '6px 8px';
    container.style.background = 'rgba(255,255,255,0.9)';
    container.style.borderRadius = '4px';
    container.style.boxShadow = '1px 1px 2px rgba(0,0,0,0.08)';
    container.textContent = this.toText(map);

    const handler = () => {
      container.textContent = this.toText(map);
    };
    this.onMove = handler;
    map.on('move', handler);
    map.on('zoom', handler);

    this.container = container;
    return container;
  }

  onRemove(): void {
    if (this.map && this.onMove) {
      this.map.off('move', this.onMove);
      this.map.off('zoom', this.onMove);
    }
    this.container?.parentNode?.removeChild(this.container as HTMLElement);
    this.map = undefined;
    this.container = undefined;
    this.onMove = undefined;
  }

  getDefaultPosition(): maplibregl.ControlPosition {
    return 'top-left';
  }
}