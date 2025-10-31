'use client';

import { useEffect, useMemo, useCallback } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';

// 工具函数和常量
import { createMap } from './utils/initMap';
import mockPoints from './mock/point.json';

// 类型定义
import type { MapConfig, MockPointsData, IdwConfig } from './types';

// 自定义 Hooks
import { useMapState, useMapBusinessLogic, useMapSync } from './hooks';

// 组件
import { MapContainer } from './components';
import Link from 'next/link';

/**
 * 地图页面组件
 *
 * 功能特性：
 * - 双地图展示：左侧显示网格数据，右侧显示点位数据
 * - 地图同步：左右地图的缩放和移动保持同步
 * - IDW插值：支持将点位数据转换为格点数据
 * - 响应式布局：适配不同屏幕尺寸
 */
export default function MapPage() {
  // 地图状态管理
  const {
    leftMap,
    rightMap,
    idwVisible,
    leftContainerRef,
    rightContainerRef,
    setLeftMap,
    setRightMap,
    setIdwVisible,
  } = useMapState();

  // 地图业务逻辑
  const { addGridBusiness, addPointsBusiness, transformIDW } = useMapBusinessLogic();

  // 地图同步
  useMapSync(leftMap, rightMap);

  /**
   * 地图配置 - 使用 useMemo 避免重复创建
   */
  const mapConfig: MapConfig = useMemo(
    () => ({
      controls: {
        navigation: true,
        scale: { maxWidth: 100, unit: 'metric' },
        geolocate: true,
        reset: {
          center: [111.53, 27.23],
          zoom: 6.5,
          bearing: 0,
          pitch: 0,
          speed: 0.8,
        },
        measure: true,
        zoomCenter: { position: 'top-left' },
      },
    }),
    []
  );

  /**
   * IDW配置 - 使用 useMemo 避免重复创建
   */
  const idwConfig: IdwConfig = useMemo(
    () => ({
      cols: 150,
      rows: 150,
      power: 6,
      hidePointsLayerId: 'hunan-random-points-labels',
      minzoom: 6,
      neighbors: 8,
      maxDistanceDeg: 0.25,
      breaks: [0, 0.1, 10, 25, 50, 100, 250, 400, 600],
      colors: ['#FAFAFA', '#AAF0AA', '#50C878', '#3CB4F0', '#1464DC', '#F064C8', '#B43CA0', '#FFB428', '#FF3C28'],
    }),
    []
  );

  /**
   * 处理IDW转换 - 使用 useCallback 避免重复创建
   */
  const handleTransformIDW = useCallback(() => {
    if (!rightMap) return;

    // 若当前已显示IDW，则恢复为原始离散点
    if (idwVisible) {
      const idwLabelId = 'hunan-idw-grid-labels';
      const idwIsobandsFillId = 'hunan-idw-isobands-fill';
      const pointsLayerId = idwConfig.hidePointsLayerId;

      if (rightMap.getLayer(idwLabelId)) {
        rightMap.setLayoutProperty(idwLabelId, 'visibility', 'none');
      }
      if (rightMap.getLayer(idwIsobandsFillId)) {
        rightMap.setLayoutProperty(idwIsobandsFillId, 'visibility', 'none');
      }

      if (pointsLayerId && rightMap.getLayer(pointsLayerId)) {
        rightMap.setLayoutProperty(pointsLayerId, 'visibility', 'visible');
      }

      setIdwVisible(false);
      return;
    }

    // 否则执行IDW插值并显示格点标签，同时隐藏原始点位标签
    transformIDW(rightMap, mockPoints as MockPointsData, idwConfig, () => setIdwVisible(true));
  }, [rightMap, idwVisible, transformIDW, idwConfig, setIdwVisible]);

  // 等值面色斑功能已移除

  /**
   * 初始化地图实例和业务逻辑
   */
  useEffect(() => {
    // 检查容器是否存在
    if (!leftContainerRef.current || !rightContainerRef.current) return;

    // 避免重复初始化
    if (leftMap || rightMap) return;

    // 创建左侧地图（网格数据）
    const leftMapInstance = createMap(leftContainerRef.current, mapConfig);

    // 创建右侧地图（点位数据）
    const rightMapInstance = createMap(rightContainerRef.current, mapConfig);

    // 保存地图实例
    setLeftMap(leftMapInstance);
    setRightMap(rightMapInstance);

    // 左侧地图加载完成后添加网格业务
    leftMapInstance.on('load', () => {
      addGridBusiness(leftMapInstance);
    });

    // 右侧地图加载完成后添加点位业务
    rightMapInstance.on('load', () => {
      addPointsBusiness(rightMapInstance, mockPoints as MockPointsData);
    });

    // 清理函数：组件卸载时移除地图实例
    return () => {
      leftMapInstance?.remove();
      rightMapInstance?.remove();
      setLeftMap(null);
      setRightMap(null);
    };
  }, []); // 空依赖数组，只在组件挂载时执行一次

  return (
    <div className="relative flex h-screen w-full">
      {/* 左侧地图容器 - 网格数据展示 */}
      <MapContainer
        containerRef={leftContainerRef as React.RefObject<HTMLDivElement>}
        className="grow-[2]"
      >
        {/* 返回首页置于左侧地图容器顶部居中 */}
        <Link
          href="/"
          className="pointer-events-auto absolute right-[30px] top-2 z-50 -translate-x-1/2 rounded bg-white/80 px-3 py-2 shadow backdrop-blur hover:bg-white"
          title="返回首页"
        >
          返回首页
        </Link>
      </MapContainer>

      {/* 右侧地图容器 - 点位数据展示 */}
      <MapContainer
        containerRef={rightContainerRef as React.RefObject<HTMLDivElement>}
        className="grow-[3] border-l border-gray-300"
      >
        {/* 转化格点按钮放在右侧地图容器的右上角 */}
        <button
          onClick={handleTransformIDW}
          className={`pointer-events-auto absolute right-[60px] top-2 z-50 rounded px-3 py-2 text-sm font-medium shadow backdrop-blur transition-colors ${
            idwVisible
              ? 'bg-green-100/80 text-green-800 hover:bg-green-100'
              : 'bg-white/80 hover:bg-white'
          }`}
          title={idwVisible ? '点击切换为离散点数据' : '点击转化为格点（IDW）'}
        >
          {idwVisible ? '切换为离散点' : '转化为格点（IDW）'}
        </button>

        {/* 等值面色斑功能已移除 */}
      </MapContainer>

      {/* 工具按钮已分别放入左右容器 */}
    </div>
  );
}
