import { useEffect } from 'react';
import type { MapInstance } from '../types';

/**
 * 地图同步 Hook
 * 处理左右两个地图的缩放和移动同步
 */
export function useMapSync(leftMap: MapInstance | null, rightMap: MapInstance | null) {
  useEffect(() => {
    if (!leftMap || !rightMap) return;

    /**
     * 处理缩放同步
     */
    const handleZoom = () => {
      rightMap.setZoom(leftMap.getZoom());
    };

    /**
     * 处理移动同步
     */
    const handleMove = () => {
      rightMap.setCenter(leftMap.getCenter());
    };

    // 绑定事件监听器
    leftMap.on('zoom', handleZoom);
    leftMap.on('move', handleMove);

    // 清理函数
    return () => {
      leftMap.off('zoom', handleZoom);
      leftMap.off('move', handleMove);
    };
  }, [leftMap, rightMap]);
}