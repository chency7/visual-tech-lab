import type maplibregl from 'maplibre-gl';

/**
 * 地图复位控件（按 Mapbox 示例实现，适配 MapLibre）
 */
export class ResetControl implements maplibregl.IControl {
  private map?: maplibregl.Map;
  private container?: HTMLElement;
  private options: maplibregl.FlyToOptions;

  constructor(options: maplibregl.FlyToOptions) {
    this.options = options;
  }

  onAdd(map: maplibregl.Map): HTMLElement {
    this.map = map;

    const container = document.createElement('div');
    container.className = 'maplibregl-ctrl maplibregl-ctrl-group maplibre-control';
    container.innerHTML = `
      <button type="button" class="maplibregl-ctrl-reset-button" title="地图复位" aria-label="地图复位" style="width:30px;height:30px;display:flex;align-items:center;justify-content:center;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#374151" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="1 4 1 10 7 10"></polyline>
          <polyline points="23 20 23 14 17 14"></polyline>
          <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15"></path>
        </svg>
      </button>
    `;

    container.addEventListener('click', () => {
      this.map?.flyTo(this.options);
    });

    this.container = container;
    return container;
  }

  onRemove(): void {
    this.container?.parentNode?.removeChild(this.container as HTMLElement);
    this.map = undefined;
    this.container = undefined;
  }

  getDefaultPosition(): maplibregl.ControlPosition {
    return 'top-right';
  }
}