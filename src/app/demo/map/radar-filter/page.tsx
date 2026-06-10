'use client';

import RadarMapPanel from './RadarMapPanel';

export default function RadarFilterPage() {
  return (
    // 雷达示例是完整工作台页面，直接占满视口，避免地图容器高度塌陷。
    <div className="h-screen w-full">
      <RadarMapPanel />
    </div>
  );
}
