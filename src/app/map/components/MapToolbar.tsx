import React from 'react';
import Link from 'next/link';

interface MapToolbarProps {
  /** IDW转换处理函数 */
  onTransformIDW: () => void;
  /** IDW是否可见 */
  idwVisible?: boolean;
}

/**
 * 地图工具栏组件
 * 包含返回首页和IDW转换功能按钮
 */
export function MapToolbar({ onTransformIDW, idwVisible }: MapToolbarProps) {
  return (
    <>
      {/* 返回首页按钮 */}
      <Link
        href="/"
        className="absolute right-[50px] top-2 z-50 rounded bg-white/80 px-3 py-2 shadow backdrop-blur transition-colors hover:bg-white"
        title="返回首页"
      >
        返回首页
      </Link>

      {/* IDW转换/切换按钮 */}
      <button
        onClick={onTransformIDW}
        className={`absolute right-[60px] top-2 z-50 rounded px-3 py-2 text-sm font-medium shadow backdrop-blur transition-colors ${
          idwVisible 
            ? 'bg-green-100/80 text-green-800 hover:bg-green-100' 
            : 'bg-white/80 hover:bg-white'
        }`}
        title={idwVisible ? '点击切换为离散点数据' : '点击转化为格点（IDW）'}
      >
        {idwVisible ? '切换为离散点' : '转化为格点（IDW）'}
      </button>
    </>
  );
}