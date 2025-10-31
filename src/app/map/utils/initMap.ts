// 地图基础初始化：通用能力，业务图层在页面层处理
import maplibregl, { type MapOptions } from 'maplibre-gl';
import { foxGisVectorStyle, APP_BOUNDS, DEFAULT_CENTER, DEFAULT_ZOOM, MIN_ZOOM, MAX_ZOOM } from '../const';
import { toLngLatBounds } from './bounds';
import { MeasureControl, GeolocateControl, ResetControl, ZoomCenterControl } from './plugins';

// 控件位置类型（便于统一传参）
type ControlPosition = maplibregl.ControlPosition;

// 控件配置：支持开关/参数与位置
type ControlsConfig = {
  navigation?: boolean
  navigationPosition?: ControlPosition;
  scale?: boolean | maplibregl.ScaleControlOptions;
  scalePosition?: ControlPosition;
  geolocate?: boolean;
  geolocatePosition?: ControlPosition;
  reset?: false | maplibregl.FlyToOptions;
  resetPosition?: ControlPosition;
  measure?: boolean;
  measurePosition?: ControlPosition;
  zoomCenter?: false | { position?: ControlPosition };
};

// 创建地图的总配置（地图选项覆盖 + 控件开关）
export type CreateMapConfig = {
  options?: Partial<MapOptions>;
  controls?: ControlsConfig;
};

// 创建基础地图：支持配置覆盖与控件开关
export function createMap(container: HTMLElement, config?: CreateMapConfig): maplibregl.Map {
  // 1) 合成控件配置（默认值可覆盖）
  const controls: ControlsConfig = {
    navigation: true,
    navigationPosition: 'top-right',
    scale: { maxWidth: 100, unit: 'metric' },
    scalePosition: 'bottom-left',
    geolocate: true,
    geolocatePosition: 'top-right',
    reset: { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM, bearing: 0, pitch: 0, speed: 0.8 },
    resetPosition: 'top-right',
    measure: true,
    measurePosition: 'top-right',
    zoomCenter: { position: 'top-left' },
    ...(config?.controls ?? {}),
  };

  // 2) 合成地图选项（允许覆盖）
  const options: MapOptions = {
    container,
    style: config?.options?.style ?? foxGisVectorStyle(),
    center: config?.options?.center ?? DEFAULT_CENTER,
    zoom: config?.options?.zoom ?? DEFAULT_ZOOM,
    minZoom: config?.options?.minZoom ?? MIN_ZOOM,
    maxZoom: config?.options?.maxZoom ?? MAX_ZOOM,
    renderWorldCopies: config?.options?.renderWorldCopies ?? false,
    maxBounds: config?.options?.maxBounds ?? toLngLatBounds(APP_BOUNDS),
  };

  // 3) 创建地图实例
  const map = new maplibregl.Map(options);

  // 导航控件
  if (controls.navigation !== false) {
    const navOpts = typeof controls.navigation === 'object' ? controls.navigation : { visualizePitch: true };
    map.addControl(new maplibregl.NavigationControl(navOpts), controls.navigationPosition ?? 'top-right');
  }
  // 比例尺控件
  if (controls.scale) {
    // 比例尺控件支持参数与默认值
    const scaleOpts: maplibregl.ScaleControlOptions = typeof controls.scale === 'object' ? controls.scale : { maxWidth: 100, unit: 'metric' };
    map.addControl(new maplibregl.ScaleControl(scaleOpts), controls.scalePosition ?? 'bottom-left');
  }
  // 经纬度拾取控件
  if (controls.geolocate) {
    map.addControl(new GeolocateControl(), controls.geolocatePosition ?? 'top-right');
  }
  // 复位控件
  if (controls.reset && typeof controls.reset === 'object') {
    map.addControl(new ResetControl(controls.reset), controls.resetPosition ?? 'top-right');
  }
  // 测距控件
  if (controls.measure) {
    map.addControl(new MeasureControl(), controls.measurePosition ?? 'top-right');
  }
  // 缩放与中心点显示控件
  if (controls.zoomCenter !== false && controls.zoomCenter != null) {
    const zcPos = (controls.zoomCenter as { position?: ControlPosition }).position ?? 'top-left';
    map.addControl(new ZoomCenterControl(), zcPos);
  }

  return map;
}