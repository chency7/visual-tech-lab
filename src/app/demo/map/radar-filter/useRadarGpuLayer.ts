import { useCallback, useRef } from 'react';
import type maplibregl from 'maplibre-gl';
import { getRadarLayerBeforeId, RADAR_GPU_LAYER_ID } from './radarFilter';
import { RadarGpuLayer } from './radarGpuLayer';

/**
 * 管理左侧过滤视图的雷达 GPU 图层。
 *
 * 设计要点：
 * 1. 只创建一个 custom layer，避免每次切换色域都 add/remove 图层。
 * 2. 只上传一张原始雷达纹理，颜色区间筛选在 fragment shader 中完成。
 * 3. 交互时只更新 selectedMask/visible 这类 uniform，避免 CPU 重新处理图片。
 */
export function useRadarGpuLayer() {
  const layerRef = useRef<RadarGpuLayer | null>(null);

  const initGpuRadarLayer = useCallback((map: maplibregl.Map): RadarGpuLayer => {
    let layer = layerRef.current;
    if (!layer) {
      layer = new RadarGpuLayer();
      layerRef.current = layer;
    }

    if (!map.getLayer(RADAR_GPU_LAYER_ID)) {
      map.addLayer(layer, getRadarLayerBeforeId(map));
    }

    return layer;
  }, []);

  const setBandSelectionVisibility = useCallback(
    (map: maplibregl.Map, selectedIndexes: number[]) => {
      const layer = initGpuRadarLayer(map);
      layer.setSelectedIndexes(selectedIndexes);
      layer.setVisible(true);
    },
    [initGpuRadarLayer]
  );

  const setVisibility = useCallback(
    (map: maplibregl.Map, visible: boolean) => {
      const layer = layerRef.current ?? (visible ? initGpuRadarLayer(map) : null);
      layer?.setVisible(visible);
    },
    [initGpuRadarLayer]
  );

  return {
    initGpuRadarLayer,
    setBandSelectionVisibility,
    setVisibility,
  };
}
