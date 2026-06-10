/**
 * 雷达色带配置。
 *
 * hex 用于左侧色卡展示；colors 保留原始雷达图中可能出现的同一色域颜色阶，
 * 后续如果改为“灰度/数值纹理 -> 前端着色”，可以直接把这份配置作为调色板来源。
 */
export interface RadarColorBand {
  label: string;
  min: number;
  max: number;
  hex: string;
  colors: string[];
  colorDescription: string;
}

export const RADAR_COLOR_BANDS: RadarColorBand[] = [
  {
    label: '0.1 - 9.9',
    min: 0.1,
    max: 9.9,
    hex: '#00E200',
    colors: [
      '#00E200',
      '#00DA00',
      '#00D200',
      '#00CA00',
      '#00C200',
      '#00BB00',
      '#00B500',
      '#00AF00',
      '#00A900',
      '#00A300',
      '#009D00',
      '#009700',
      '#009100',
      '#008D00',
      '#008A00',
    ],
    colorDescription: '绿色回波',
  },
  {
    label: '10 - 24.9',
    min: 10,
    max: 24.9,
    hex: '#00B3F3',
    colors: ['#00C2F1', '#00BBF2', '#00B3F3', '#00ACF5', '#00A4F6'],
    colorDescription: '青蓝色回波',
  },
  {
    label: '25 - 49.9',
    min: 25,
    max: 49.9,
    hex: '#FAF000',
    colors: [
      '#FEFD00',
      '#FCF700',
      '#FAF000',
      '#F8E900',
      '#F6E300',
      '#F4DC00',
      '#F2D500',
      '#F0CF00',
    ],
    colorDescription: '黄色回波',
  },
  {
    label: '50 - 99.9',
    min: 50,
    max: 99.9,
    hex: '#F8B400',
    colors: ['#F2C800', '#F4C100', '#F6BB00', '#F8B400', '#FAAD00', '#FCA700', '#FFA000'],
    colorDescription: '橙色回波',
  },
  {
    label: '100 - 249.9',
    min: 100,
    max: 249.9,
    hex: '#F5ACAC',
    colors: ['#FDACAC', '#F9ACAC', '#F5ACAC', '#F1ACAC', '#EDACAC'],
    colorDescription: '浅红色回波',
  },
  {
    label: '250 - 399.9',
    min: 250,
    max: 399.9,
    hex: '#E80230',
    colors: ['#EC0230', '#E80230', '#E40230', '#E00230'],
    colorDescription: '红色回波',
  },
  {
    label: '> 400',
    min: 400,
    max: Infinity,
    hex: '#9D0FBE',
    colors: ['#9D0FBE', '#A300BA', '#B300BC', '#C300BE', '#D300C0', '#E300C2'],
    colorDescription: '紫色回波',
  },
];
