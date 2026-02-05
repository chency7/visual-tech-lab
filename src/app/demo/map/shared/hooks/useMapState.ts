import { useRef, useState } from 'react';
import type { MapInstance, MapState } from '../types';

/**
 * 地图状态管理 Hook
 * 管理左右两个地图实例和IDW可见性状态
 */
export function useMapState(): MapState & {
  leftContainerRef: React.RefObject<HTMLDivElement | null>;
  rightContainerRef: React.RefObject<HTMLDivElement | null>;
  setLeftMap: (map: MapInstance | null) => void;
  setRightMap: (map: MapInstance | null) => void;
  setIdwVisible: (visible: boolean) => void;
} {
  const leftContainerRef = useRef<HTMLDivElement>(null);
  const rightContainerRef = useRef<HTMLDivElement>(null);

  const [leftMap, setLeftMap] = useState<MapInstance | null>(null);
  const [rightMap, setRightMap] = useState<MapInstance | null>(null);
  const [idwVisible, setIdwVisible] = useState(false);

  return {
    leftMap,
    rightMap,
    idwVisible,
    leftContainerRef,
    rightContainerRef,
    setLeftMap,
    setRightMap,
    setIdwVisible,
  };
}