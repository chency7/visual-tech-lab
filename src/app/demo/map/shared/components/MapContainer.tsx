import React from 'react';

interface MapContainerProps {
  /** 地图容器引用 */
  containerRef: React.RefObject<HTMLDivElement>;
  /** 容器样式类名 */
  className?: string;
  /** 子组件 */
  children?: React.ReactNode;
}

/**
 * 地图容器组件
 * 提供地图渲染的基础容器
 */
export function MapContainer({ containerRef, className = '', children }: MapContainerProps) {
  return (
    <div ref={containerRef} className={`relative h-full  ${className}`}>
      {children}
    </div>
  );
}
