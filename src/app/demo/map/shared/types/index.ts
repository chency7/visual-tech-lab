import type maplibregl from 'maplibre-gl';
import type { FeatureCollection, Feature, Point, Polygon, MultiPolygon } from 'geojson';

// 基础地理类型
export type LngLatTuple = [number, number];
export type BoundsTuple = [LngLatTuple, LngLatTuple];

// 地图实例类型
export type MapInstance = maplibregl.Map;

// 站点数据类型
export interface StationData {
  lon: number;
  lat: number;
  pre: number;
  stationCode?: string;
  stationName?: string;
}

export interface StationDatum {
  lon: number;
  lat: number;
  pre: number;
}

// 原始数据结构类型
export interface MockPointsData {
  body:
    | Array<{
        lon: string | number;
        lat: string | number;
        pre?: string | number;
        stationCode?: string;
        stationName?: string;
      }>
    | {
        data: Array<{
          lon: string | number;
          lat: string | number;
          pre?: string | number;
          stationCode?: string;
          stationName?: string;
        }>;
      };
}

// GeoJSON 特征类型
export interface StationFeature extends Feature<Point> {
  properties: {
    pre: number;
    idx: number;
    stationCode?: string;
    stationName?: string;
  };
}

export type StationFeatureCollection = FeatureCollection<Point, StationFeature['properties']>;

export type StainFeatureCollection = FeatureCollection<
  Polygon | MultiPolygon,
  { color?: string }
>;

export interface StainData {
  body: {
    data: StainFeatureCollection;
  };
}

// 地图配置类型
export interface MapConfig {
  controls: {
    navigation: boolean;
    scale: { maxWidth: number; unit: 'metric' | 'imperial' };
    geolocate: boolean;
    reset: {
      center: LngLatTuple;
      zoom: number;
      bearing: number;
      pitch: number;
      speed: number;
    };
    measure: boolean;
    zoomCenter: { position: maplibregl.ControlPosition };
  };
}

export interface RainThreshold {
  range: string;
  color_description: string;
  rgb: string;
  hex: string;
}

export interface IdwLabelProperties {
  value: number;
  i: number;
  j: number;
  cols: number;
  rows: number;
}

export type IdwLabelFeatureCollection = FeatureCollection<Point, IdwLabelProperties>;
export type IdwIsobandFeatureCollection = FeatureCollection<
  Polygon | MultiPolygon,
  { lower: number; upper: number; colorIndex: number }
>;

export interface IdwWorkerPayload {
  bbox: BoundsTuple;
  stations: StationDatum[];
  config: Pick<
    IdwConfig,
    'cols' | 'rows' | 'gridSpacingKm' | 'power' | 'neighbors' | 'maxDistanceDeg' | 'breaks' | 'colors' | 'smoothIterations'
  >;
}

export interface IdwWorkerResult {
  cols: number;
  rows: number;
  breaks: number[];
  colors: string[];
  labelFeatureCollection: IdwLabelFeatureCollection;
  isobandsFeatureCollection: IdwIsobandFeatureCollection;
}

// IDW 配置类型
export interface IdwConfig {
  cols?: number;
  rows?: number;
  /** 目标格点间距（公里）。若设置则优先按此计算 cols/rows */
  gridSpacingKm?: number;
  power: number;
  hidePointsLayerId: string;
  minzoom: number;
  /** 限制参与插值的最近邻个数（可选） */
  neighbors?: number;
  /** 限制参与插值的最大距离（经纬度度数，约 0.1≈11km）（可选） */
  maxDistanceDeg?: number;
  /** 等值面阈值（按递增排列），例如 [0, 0.1, 10, 25, 50, 100, 250, 400, 600] */
  breaks?: number[];
  /** 与 breaks 对应的色斑颜色（十六进制），长度应为 breaks.length - 1 */
  colors?: string[];
  /** Chaikin 平滑迭代次数，0 表示关闭平滑，推荐 2-3 */
  smoothIterations?: number;
}

// 地图业务逻辑类型
export interface MapBusinessHandlers {
  addGridBusiness: (map: MapInstance) => void;
  addStainBusiness: (map: MapInstance, stainData: StainData) => void;
  addPointsBusiness: (map: MapInstance, mockPoints: MockPointsData) => void;
  getStationDatums: (mockPoints: MockPointsData) => StationDatum[];
}

// 地图状态类型
export interface MapState {
  leftMap: MapInstance | null;
  rightMap: MapInstance | null;
  idwVisible: boolean;
}
