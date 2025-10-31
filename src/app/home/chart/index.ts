import type { Selection } from 'd3-selection';

export interface MEXTData {
  // 时间序列（建议为 Date 或毫秒时间戳）
  times: Array<Date | number>;
  // 高度（单位：m，或 km，保持一致即可）
  heights: number[];
  // 值矩阵：values[heightIndex][timeIndex] = 消光系数(km^-1)
  values: number[][];
}

// 颜色阈值规范（支持用户提供的 JSON 格式）
export interface ColorThresholdSpec {
  variableName: string;
  unit: string;
  range: [number, number];
  intervals: Array<{
    min: number | null;
    max: number | null;
    description?: string;
    colorHex: string;
  }>;
}

export interface MEXTOptions {
  // 值域（默认 [0, 0.9]）
  valueDomain?: [number, number];
  // 颜色映射（默认 d3.interpolateTurbo）
  colorInterpolator?: (t: number) => string;
  // 单位与标题显示
  unitLabel?: string; // 默认 "km^-1"
  title?: string; // 标题文本
  // 右侧剖面的初始时间索引（默认最后一帧）
  profileIndex?: number;
  // 布局与尺寸
  margin?: { top: number; right: number; bottom: number; left: number };
  sidebarWidth?: number; // 右侧剖面宽度（默认 120）
  legendHeight?: number; // 下方图例高度（默认 28）
  // 新增：绘制模式与等值面参数
  renderMode?: 'grid' | 'contour' | 'both';
  contourLevels?: number | number[]; // 等值级数或自定义阈值
  contourSmooth?: boolean; // 是否平滑
  contourStroke?: boolean; // 是否描边
  contourFill?: boolean; // 是否填充
  contourOpacity?: number; // 0-1 填充/线条透明度
  // 新增：离散阈值配色（用于匹配 legacy 视觉）
  colorThresholds?: number[]; // 阈值数组，长度为颜色数-1
  discreteColors?: string[]; // 离散颜色数组（长度 = 阈值数+1）
  palettePreset?: 'hsv'; // 预设离散色带（目前提供 hsv）
  // 新增：直接支持阈值规范 JSON
  colorThresholdSpec?: ColorThresholdSpec;
}

export type D3Module = typeof import('d3');

/**
 * 创建 MEXT（消光系数）时间-高度热图 + 右侧垂直剖面 的绘制回调。
 * 返回的回调可直接传入 useD3(draw, deps, opts)。
 */
export function createMEXTChart(data: MEXTData, options: MEXTOptions = {}) {
  const {
    valueDomain: valueDomainOpt = [0, 0.9],
    colorInterpolator,
    unitLabel: unitLabelOpt = 'km^-1',
    title = '消光系数 (MBC532)',
    profileIndex,
    margin = { top: 24, right: 16, bottom: 32, left: 48 },
    sidebarWidth = 100,
    legendHeight = 28,
    // 新增默认值
    renderMode = 'grid',
    contourLevels = 12,
    contourSmooth = true,
    contourStroke = false,
    contourFill = true,
    contourOpacity = 0.85,
    // 离散色带默认值
    colorThresholds,
    discreteColors,
    palettePreset,
    colorThresholdSpec,
  } = options;

  // 生效的值域与单位（可由阈值规范覆盖）
  let domain: [number, number] = valueDomainOpt;
  let legendUnit = unitLabelOpt;
  let legendTitleText: string | null = null;

  // 若提供阈值规范，则覆盖 domain 与 unit
  if (colorThresholdSpec) {
    if (Array.isArray(colorThresholdSpec.range) && colorThresholdSpec.range.length === 2) {
      domain = [Number(colorThresholdSpec.range[0]), Number(colorThresholdSpec.range[1])];
    }
    if (colorThresholdSpec.unit) legendUnit = colorThresholdSpec.unit;
    if (colorThresholdSpec.variableName) legendTitleText = `${colorThresholdSpec.variableName} (${legendUnit})`;
  }

  return function draw(
    root: Selection<HTMLDivElement, unknown, null, undefined>,
    d3: D3Module,
    size: { width: number; height: number }
  ) {
    // 清空
    root.selectAll('*').remove();
    const width = Math.max(0, size.width);
    const height = Math.max(0, size.height);

    // 布局
    const innerWidth = Math.max(0, width - margin.left - margin.right - sidebarWidth);
    const innerHeight = Math.max(0, height - margin.top - margin.bottom - legendHeight);

    // 容器
    const container = root
      .style('position', 'relative')
      .style('font', '12px system-ui, -apple-system, Segoe UI, Roboto')
      .append('div')
      .style('position', 'relative')
      .style('width', width + 'px')
      .style('height', height + 'px');

    // 主图：Canvas（性能更好）
    const dpr = (typeof window !== 'undefined' && (window as any).devicePixelRatio) ? (window as any).devicePixelRatio : 1;
    const canvas = container
      .append('canvas')
      .attr('width', Math.floor(innerWidth * dpr))
      .attr('height', Math.floor(innerHeight * dpr))
      .style('position', 'absolute')
      .style('left', 0 + 'px')
      .style('top', margin.top + 'px')
      .style('width', innerWidth + 'px')
      .style('height', innerHeight + 'px');

    const ctx = (canvas.node() as HTMLCanvasElement).getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    // 叠加 SVG：坐标轴、剖面、指示线、图例、标题
    const svg = container
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .style('position', 'absolute')
      .style('left', '0px')
      .style('top', '0px');

    // 数据与比例尺
    const times = data.times.map(t => (t instanceof Date ? t.getTime() : +t));
    const heights = data.heights;
    const values = data.values;
    const defaultBlueYellowRed = d3.scaleSequential(d3.interpolateRdYlBu).domain([0, 1]);


    const y = d3.scaleLinear()
      .domain([d3.min(heights) ?? 0, d3.max(heights) ?? 1])
      .range([margin.top + innerHeight, margin.top]);


    // 颜色函数：优先使用离散阈值色带（提供安全默认值，避免“使用前未赋值”）
    let colorFn: (v: number) => string = (v: number) => {
      const t = (v - domain[0]) / (domain[1] - domain[0]);
      const clamped = Math.max(0, Math.min(1, t));
      return (colorInterpolator ?? defaultBlueYellowRed)(clamped);
    };
    let legendBins: Array<{ min: number; max: number; color: string; description?: string }> | null = null;

    if (colorThresholdSpec && Array.isArray(colorThresholdSpec.intervals) && colorThresholdSpec.intervals.length > 0) {
      const thresholds = colorThresholdSpec.intervals
        .map((it) => (it.max == null ? null : Number(it.max)))
        .filter((v): v is number => typeof v === 'number');
      const colors = colorThresholdSpec.intervals.map((it) => it.colorHex);
      const th = d3.scaleThreshold<number, string>(thresholds, colors);
      colorFn = (v: number) => th(v);
      const domMin = domain[0];
      const domMax = domain[1];
      legendBins = colorThresholdSpec.intervals.map((it) => ({
        min: (it.min == null ? domMin : Number(it.min)),
        max: (it.max == null ? domMax : Number(it.max)),
        color: it.colorHex,
        description: it.description,
      }));
    } else if (Array.isArray(colorThresholds) && Array.isArray(discreteColors) && discreteColors.length === colorThresholds.length + 1) {
      const th = d3.scaleThreshold<number, string>(colorThresholds, discreteColors);
      colorFn = (v: number) => th(v);
      const domMin = domain[0];
      const domMax = domain[1];
      legendBins = [
        // 按阈值生成 bins
        ...discreteColors.map((c, i) => {
          const prev = i === 0 ? domMin : colorThresholds[i - 1];
          const next = i === discreteColors.length - 1 ? domMax : colorThresholds[i];
          return { min: prev, max: next, color: c };
        }),
      ];
    } else if (palettePreset === 'hsv') {
      const hsvColors = ['#00007f', '#0000f6', '#004dff', '#00b1ff', '#29ffce', '#7dff7a', '#d1ff26', '#ffc400', '#ff6800', '#f10800', '#7f0000'];
      const ths = (d3.scaleLinear().domain(domain).ticks(hsvColors.length - 1));
      const th = d3.scaleThreshold<number, string>(ths, hsvColors);
      colorFn = (v: number) => th(v);
      const domMin = domain[0];
      const domMax = domain[1];
      legendBins = hsvColors.map((c, i) => {
        const prev = i === 0 ? domMin : ths[i - 1];
        const next = i === hsvColors.length - 1 ? domMax : ths[i];
        return { min: prev, max: next, color: c };
      });
    }

    // 计算每格像素大小（按等分）
    const cellW = innerWidth / times.length;
    const cellH = innerHeight / heights.length;
    // 将格子边界对齐到整数像素，避免子像素缝隙
    const xEdges = Array.from({ length: times.length + 1 }, (_, i) => margin.left + Math.round(i * cellW));
    const yEdges = Array.from({ length: heights.length + 1 }, (_, i) => margin.top + Math.round(i * cellH));

    // 绘制主热图（格点着色）
    if (renderMode !== 'contour') {
      for (let ti = 0; ti < times.length; ti++) {
        for (let hi = 0; hi < heights.length; hi++) {
          const v = values[hi]?.[ti];
          if (v == null) continue;
          ctx.fillStyle = colorFn(v);
          const x0 = xEdges[ti];
          const x1 = xEdges[ti + 1];
          const yi = heights.length - 1 - hi; // y 轴向上
          const y0 = yEdges[yi];
          const y1 = yEdges[yi + 1];
          ctx.fillRect(x0, y0, Math.max(0, x1 - x0), Math.max(0, y1 - y0));
        }
      }
    }

    // 绘制等值面/等值线
    if (renderMode !== 'grid') {
      const cols = times.length;
      const rows = heights.length;
      const flat = new Float32Array(cols * rows);
      for (let hi = 0; hi < rows; hi++) {
        for (let ti = 0; ti < cols; ti++) {
          const v = values[hi]?.[ti];
          flat[hi * cols + ti] = v == null ? NaN : v;
        }
      }

      let levels: number[];
      if (Array.isArray(contourLevels)) {
        levels = contourLevels as number[];
      } else {
        const cnt = Math.max(2, contourLevels as number);
        levels = d3.scaleLinear().domain(domain).ticks(cnt);
      }

      const gen = d3
        .contours()
        .size([cols, rows])
        .smooth(!!contourSmooth)
        .thresholds(levels);

      const geoms = gen(flat as any);
      const xMap = d3.scaleLinear().domain([0, cols]).range([margin.left, margin.left + innerWidth]);
      const yMap = d3.scaleLinear().domain([0, rows]).range([margin.top + innerHeight, margin.top]);
      const gContour = svg.append('g').attr('class', 'mext-contours');

      geoms.forEach((c: any) => {
        const coords = c.coordinates.map((poly: any) =>
          poly.map((ring: any) => ring.map(([ix, iy]: [number, number]) => [xMap(ix), yMap(iy)]))
        );
        const feature = { type: 'MultiPolygon', coordinates: coords } as any;
        const dPath = (d3.geoPath() as any)(feature);
        const p = gContour
          .append('path')
          .attr('d', dPath)
          .attr('opacity', contourOpacity);

        if (contourFill) p.attr('fill', colorFn(c.value)); else p.attr('fill', 'none');
        if (contourStroke) p.attr('stroke', colorFn(c.value)).attr('stroke-width', 0.8);
      });
    }

    // 坐标轴
    const xAxis = d3.axisBottom<number>(d3.scaleLinear()
      .domain([times[0], times[times.length - 1]])
      .range([0, innerWidth]))
      .tickFormat((d: number) => d3.timeFormat('%m-%d %H:%M')(new Date(d)) as unknown as string)
      .ticks(Math.min(8, times.length));

    const yAxis = d3.axisLeft<number>(d3.scaleLinear()
      .domain([d3.min(heights) ?? 0, d3.max(heights) ?? 1])
      .range([innerHeight, 0]))
      .ticks(6);

    svg.append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top + innerHeight})`)
      .call(xAxis as any)
      .selectAll('text')
      .style('font-size', '11px')
      .style('fill', '#6b7280');

    svg.append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`)
      .call(yAxis as any)
      .selectAll('text')
      .style('font-size', '11px')
      .style('fill', '#6b7280');

    // 标题
    svg.append('text')
      .attr('x', margin.left)
      .attr('y', 18)
      .attr('fill', '#111827')
      .attr('font-weight', 600)
      .text(title);

    // 右侧剖面区域
    const sideX0 = margin.left + innerWidth + 16;
    const sideW = sidebarWidth - 16;
    const sideY0 = margin.top;
    const sideH = innerHeight;

    // 剖面比例尺
    const profX = d3.scaleLinear().domain(domain).range([0, sideW - 24]);
    const profY = d3.scaleLinear().domain(y.domain()).range([sideH, 0]);

    const profAxisX = d3.axisBottom(profX).ticks(5);
    const profAxisY = d3.axisLeft(profY).ticks(6);

    const profG = svg.append('g').attr('transform', `translate(${sideX0}, ${sideY0})`);
    profG.append('g').attr('transform', `translate(0, ${sideH})`).call(profAxisX as any);
    profG.append('g').call(profAxisY as any);

    const profilePath = profG.append('path')
      .attr('fill', 'none')
      .attr('stroke', '#10b981')
      .attr('stroke-width', 2);

    // 选定时间索引 & 垂直指示线
    let currentIndex = profileIndex != null ? Math.max(0, Math.min(times.length - 1, profileIndex)) : times.length - 1;
    const vline = svg.append('line')
      .attr('x1', margin.left + currentIndex * cellW + cellW / 2)
      .attr('x2', margin.left + currentIndex * cellW + cellW / 2)
      .attr('y1', margin.top)
      .attr('y2', margin.top + innerHeight)
      .attr('stroke', '#22c55e')
      .attr('stroke-width', 2)
      .attr('opacity', 0.8);

    function updateProfile(idx: number) {
      const col: number[] = heights.map((_, hi) => values[hi]?.[idx] ?? 0);
      const line = d3.line<number>()
        .x((d) => profX(d))
        .y((_, i) => profY(heights[i]));
      profilePath.datum(col as any).attr('d', line as any);
      vline
        .attr('x1', margin.left + idx * cellW + cellW / 2)
        .attr('x2', margin.left + idx * cellW + cellW / 2);
    }

    updateProfile(currentIndex);

    // 交互：移动更新剖面
    canvas.on('mousemove', (event: MouseEvent) => {
      const [mx] = d3.pointer(event, canvas.node());
      const idx = Math.max(0, Math.min(times.length - 1, Math.floor(mx / cellW)));
      currentIndex = idx;
      updateProfile(idx);
    });

    // 图例：若为阈值模式，则绘制分段色带；否则绘制渐变
    const legendG = svg.append('g').attr('transform', `translate(${margin.left}, ${margin.top + innerHeight + 25})`);

    if (legendBins && legendBins.length > 0) {
      const total = domain[1] - domain[0];
      let offset = 0;
      legendBins.forEach((bin) => {
        const w = innerWidth * ((bin.max - bin.min) / total);
        legendG.append('rect')
          .attr('x', offset)
          .attr('y', 0)
          .attr('width', w)
          .attr('height', legendHeight - 10)
          .attr('fill', bin.color)
          .attr('stroke', '#ffffff')
          .attr('stroke-width', 0.5);
        offset += w;
      });
      const legendScale = d3.scaleLinear().domain(domain).range([0, innerWidth]);
      const legendAxis = d3.axisBottom<number>(legendScale)
        .tickValues([
          domain[0],
          ...legendBins.slice(0, legendBins.length - 1).map((b) => b.max),
          domain[1],
        ])
        .tickFormat((d: number) => d3.format('.2f')(d));
      legendG.append('g').attr('transform', `translate(0, ${legendHeight - 10})`).call(legendAxis as any);
      if (legendTitleText) {
        legendG.append('text')
          .attr('x', innerWidth)
          .attr('y', legendHeight + 14)
          .attr('text-anchor', 'end')
          .attr('fill', '#6b7280')
          .text(legendTitleText);
      } else {
        legendG.append('text')
          .attr('x', innerWidth)
          .attr('y', legendHeight + 14)
          .attr('text-anchor', 'end')
          .attr('fill', '#6b7280')
          .text(legendUnit);
      }
    } else {
      const gradId = `mext-grad-${Math.floor(Math.random() * 1e6)}`;
      const defs = svg.append('defs');
      const linear = defs.append('linearGradient').attr('id', gradId).attr('x1', '0%').attr('x2', '100%').attr('y1', '0%').attr('y2', '0%');
      const stops = 32;
      for (let i = 0; i <= stops; i++) {
        const t = i / stops;
        const val = domain[0] + t * (domain[1] - domain[0]);
        linear.append('stop').attr('offset', `${t * 100}%`).attr('stop-color', colorFn(val));
      }
      legendG.append('rect').attr('width', innerWidth).attr('height', legendHeight - 10).attr('fill', `url(#${gradId})`).attr('rx', 4);

      const legendScale = d3.scaleLinear().domain(domain).range([0, innerWidth]);
      const legendAxis = d3.axisBottom(legendScale).ticks(6);
      legendG.append('g').attr('transform', `translate(0, ${legendHeight - 10})`).call(legendAxis as any);
      legendG.append('text')
        .attr('x', innerWidth)
        .attr('y', legendHeight + 14)
        .attr('text-anchor', 'end')
        .attr('fill', '#6b7280')
        .text(legendUnit);
    }

    return () => {
      // 清理事件与 DOM
      canvas.on('mousemove', null);
      root.selectAll('*').remove();
    };
  };
}

/**
 * 一个简单的示例数据生成器（可用于本地预览），生成随机的流场式消光矩阵。
 */
export function generateMockMEXT(rows = 80, cols = 48): MEXTData {
  const now = Date.now();
  const times = Array.from({ length: cols }, (_, i) => new Date(now - (cols - 1 - i) * 60 * 60 * 1000));
  const heights = Array.from({ length: rows }, (_, i) => 150 + i * 150); // 150m 起，每层 150m
  const values: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0));

  // 生成 bump 模式
  for (let k = 0; k < 5; k++) {
    const cx = Math.floor(Math.random() * cols);
    const cy = Math.floor(Math.random() * rows);
    const sx = 6 + Math.random() * 10;
    const sy = 6 + Math.random() * 10;
    const amp = 0.3 + Math.random() * 0.6;
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const dx = (j - cx) / sx;
        const dy = (i - cy) / sy;
        values[i][j] += amp * Math.exp(-(dx * dx + dy * dy));
      }
    }
  }
  // 限幅到 [0, 0.9]
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      values[i][j] = Math.max(0, Math.min(0.9, values[i][j]));
    }
  }

  return { times, heights, values };
}



// 将 smartChart 的 mock.json 适配为 MEXTData
export function generateMockMEXTFromSmart(json: any): MEXTData {
  if (!json || !Array.isArray(json.content) || json.content.length === 0) {
    // 回退到随机
    return generateMockMEXT(80, 48);
  }
  const items = json.content;
  const cols = items.length;

  // 解析第一条以确定行数与分辨率
  const first = items[0];
  const res = first?.resolution != null ? Number(first.resolution) : 30;
  const firstArr = Array.isArray(first.mext)
    ? (first.mext as number[])
    : typeof first.mext === 'string'
      ? (JSON.parse(first.mext) as number[])
      : [];
  const rows = firstArr.length;

  // 时间列
  const times: Date[] = items.map((it: any) => {
    const dt = it?.dataTime ?? it?.time ?? it?.dateTime;
    return dt ? new Date(dt) : new Date();
  });

  // 高度列（以 resolution 为步长，从 0 开始）
  const heights: number[] = Array.from({ length: rows }, (_, i) => i * res);

  // 值矩阵 [rows][cols]
  const values: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0));
  for (let c = 0; c < cols; c++) {
    const it = items[c];
    const arr = Array.isArray(it.mext)
      ? (it.mext as number[])
      : typeof it.mext === 'string'
        ? (JSON.parse(it.mext) as number[])
        : [];
    // 若长度不匹配，截断或填充
    const len = Math.min(rows, arr.length);
    for (let r = 0; r < len; r++) {
      const v = arr[r];
      values[r][c] = v == null || Number.isNaN(v as number) ? 0 : Number(v);
    }
  }

  return { times, heights, values };
}

// 通过路径异步加载 smartChart 的 JSON 并适配
export async function generateMockMEXTFromSmartPath(path: string): Promise<MEXTData> {
  try {
    const res = await fetch(path);
    const json = await res.json();
    return generateMockMEXTFromSmart(json);
  } catch {
    return generateMockMEXT(80, 48);
  }
}