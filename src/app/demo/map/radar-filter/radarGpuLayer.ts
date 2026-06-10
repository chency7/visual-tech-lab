import maplibregl, {
  MercatorCoordinate,
  type CustomLayerInterface,
  type CustomRenderMethodInput,
} from 'maplibre-gl';
import { RADAR_COORDINATES, RADAR_GPU_LAYER_ID } from './radarFilter';
import { RADAR_COLOR_BANDS } from './radarPalette';

const VERTEX_SHADER_SOURCE = `
attribute vec2 a_pos;
attribute vec2 a_tex;

uniform mat4 u_matrix;

varying vec2 v_tex;

void main() {
  gl_Position = u_matrix * vec4(a_pos, 0.0, 1.0);
  v_tex = a_tex;
}
`;

const FRAGMENT_SHADER_SOURCE = `
precision mediump float;

uniform sampler2D u_image;
uniform float u_selectedMask;
uniform bool u_visible;
uniform bool u_allSelected;

varying vec2 v_tex;

// selectedMask 使用 bitmask 表示当前选中的色域，例如第 0、2 档选中时 mask = 1 + 4。
bool bitEnabled(float mask, float bitValue) {
  return mod(floor(mask / bitValue), 2.0) >= 1.0;
}

// 当前输入是已经渲染好的彩色雷达图，因此这里按颜色范围反推出色带。
// 后续如果后台改成灰度/数值纹理，这个函数可以替换为“数值 -> 色带”的判断。
float directBand(vec3 color) {
  float r = color.r * 255.0;
  float g = color.g * 255.0;
  float b = color.b * 255.0;

  if (g >= 120.0 && r <= 90.0 && b <= 100.0) return 0.0;
  if (b >= 180.0 && g >= 120.0 && r <= 90.0) return 1.0;
  if (r >= 220.0 && g >= 205.0 && b <= 90.0) return 2.0;
  if (r >= 220.0 && g >= 80.0 && g < 205.0 && b <= 100.0) return 3.0;
  if (r >= 150.0 && g >= 80.0 && b >= 80.0) return 4.0;
  if (r >= 160.0 && g <= 60.0 && b <= 90.0) return 5.0;
  if (b >= 110.0 && r >= 80.0 && g <= 80.0) return 6.0;

  return -1.0;
}

void main() {
  if (!u_visible) discard;

  vec4 texel = texture2D(u_image, v_tex);
  if (texel.a < 0.2) discard;

  if (u_allSelected) {
    // 全选时直接输出原图，避免颜色分类导致边缘抗锯齿像素被误删。
    gl_FragColor = texel;
    return;
  }

  vec3 rgb = texel.rgb / max(texel.a, 0.0001);
  float maxChannel = max(max(rgb.r, rgb.g), rgb.b) * 255.0;
  float minChannel = min(min(rgb.r, rgb.g), rgb.b) * 255.0;
  if (maxChannel >= 245.0 && maxChannel - minChannel <= 20.0) discard;

  float band = directBand(rgb);
  if (band < 0.0) discard;

  float bitValue = pow(2.0, band);
  if (!bitEnabled(u_selectedMask, bitValue)) discard;

  gl_FragColor = texel;
}
`;

type GpuProgram = {
  program: WebGLProgram;
  positionLocation: number;
  texCoordLocation: number;
  matrixLocation: WebGLUniformLocation;
  imageLocation: WebGLUniformLocation;
  selectedMaskLocation: WebGLUniformLocation;
  visibleLocation: WebGLUniformLocation;
  allSelectedLocation: WebGLUniformLocation;
};

function compileShader(
  gl: WebGLRenderingContext | WebGL2RenderingContext,
  type: number,
  source: string
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error('无法创建雷达图层 shader');
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) ?? '未知 shader 编译错误';
    gl.deleteShader(shader);
    throw new Error(info);
  }

  return shader;
}

function createProgram(gl: WebGLRenderingContext | WebGL2RenderingContext): GpuProgram {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);
  const program = gl.createProgram();

  if (!program) {
    throw new Error('无法创建雷达图层 WebGL program');
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program) ?? '未知 WebGL program 链接错误';
    gl.deleteProgram(program);
    throw new Error(info);
  }

  const matrixLocation = gl.getUniformLocation(program, 'u_matrix');
  const imageLocation = gl.getUniformLocation(program, 'u_image');
  const selectedMaskLocation = gl.getUniformLocation(program, 'u_selectedMask');
  const visibleLocation = gl.getUniformLocation(program, 'u_visible');
  const allSelectedLocation = gl.getUniformLocation(program, 'u_allSelected');
  const positionLocation = gl.getAttribLocation(program, 'a_pos');
  const texCoordLocation = gl.getAttribLocation(program, 'a_tex');

  if (
    !matrixLocation ||
    !imageLocation ||
    !selectedMaskLocation ||
    !visibleLocation ||
    !allSelectedLocation ||
    positionLocation < 0 ||
    texCoordLocation < 0
  ) {
    gl.deleteProgram(program);
    throw new Error('雷达图层 shader 初始化失败');
  }

  return {
    program,
    positionLocation,
    texCoordLocation,
    matrixLocation,
    imageLocation,
    selectedMaskLocation,
    visibleLocation,
    allSelectedLocation,
  };
}

function selectedIndexesToMask(selectedIndexes: number[]): number {
  return selectedIndexes.reduce((mask, index) => mask | (1 << index), 0);
}

const ALL_SELECTED_MASK = selectedIndexesToMask(RADAR_COLOR_BANDS.map((_band, index) => index));

function createRadarVertices(): Float32Array {
  // MapLibre custom layer 的 defaultProjectionData.mainMatrix 期望输入是 0..1 的 Mercator 坐标。
  // 四个角点的纹理坐标按原图方向绑定：左上(0,0)、右上(1,0)、右下(1,1)、左下(0,1)。
  const [topLeft, topRight, bottomRight, bottomLeft] = RADAR_COORDINATES.map(([lng, lat]) =>
    MercatorCoordinate.fromLngLat({ lng, lat })
  );

  return new Float32Array([
    topLeft.x,
    topLeft.y,
    0,
    0,
    bottomLeft.x,
    bottomLeft.y,
    0,
    1,
    topRight.x,
    topRight.y,
    1,
    0,
    topRight.x,
    topRight.y,
    1,
    0,
    bottomLeft.x,
    bottomLeft.y,
    0,
    1,
    bottomRight.x,
    bottomRight.y,
    1,
    1,
  ]);
}

export class RadarGpuLayer implements CustomLayerInterface {
  id = RADAR_GPU_LAYER_ID;
  type: 'custom' = 'custom';
  renderingMode: '2d' = '2d';

  private map: maplibregl.Map | null = null;
  private programInfo: GpuProgram | null = null;
  private vertexBuffer: WebGLBuffer | null = null;
  private texture: WebGLTexture | null = null;
  private selectedMask = ALL_SELECTED_MASK;
  private visible = true;
  private imageLoaded = false;
  // MapLibre 传入的矩阵可能是 Float64Array，WebGL uniformMatrix4fv 需要 Float32Array。
  private readonly matrixScratch = new Float32Array(16);

  onAdd(map: maplibregl.Map, gl: WebGLRenderingContext | WebGL2RenderingContext): void {
    this.map = map;
    this.programInfo = createProgram(gl);
    this.vertexBuffer = gl.createBuffer();
    if (!this.vertexBuffer) {
      throw new Error('无法创建雷达图层 vertex buffer');
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, createRadarVertices(), gl.STATIC_DRAW);

    this.texture = gl.createTexture();
    if (!this.texture) {
      throw new Error('无法创建雷达图层纹理');
    }

    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      if (!this.texture) return;

      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      // MapLibre custom layer 默认使用 premultiplied alpha 混合，上传纹理时保持一致。
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      // pixelStorei 是全局 WebGL 状态，用完恢复，避免影响 MapLibre 后续纹理上传。
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      this.imageLoaded = true;
      this.map?.triggerRepaint();
    };
    image.onerror = () => {
      console.error('[Radar] GPU 雷达纹理加载失败');
    };
    image.src = '/images/radar.png';
  }

  setSelectedIndexes(selectedIndexes: number[]): void {
    this.selectedMask = selectedIndexesToMask(selectedIndexes);
    this.map?.triggerRepaint();
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.map?.triggerRepaint();
  }

  render(
    gl: WebGLRenderingContext | WebGL2RenderingContext,
    { defaultProjectionData }: CustomRenderMethodInput
  ): void {
    if (!this.programInfo || !this.vertexBuffer || !this.texture || !this.imageLoaded) return;

    const stride = 4 * Float32Array.BYTES_PER_ELEMENT;
    // mainMatrix 是 MapLibre 专门给 custom layer 的投影矩阵，可直接投影 Mercator 0..1 坐标。
    this.matrixScratch.set(defaultProjectionData.mainMatrix);

    if ('bindVertexArray' in gl) {
      gl.bindVertexArray(null);
    }

    gl.useProgram(this.programInfo.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);

    gl.enableVertexAttribArray(this.programInfo.positionLocation);
    gl.vertexAttribPointer(
      this.programInfo.positionLocation,
      2,
      gl.FLOAT,
      false,
      stride,
      0
    );

    gl.enableVertexAttribArray(this.programInfo.texCoordLocation);
    gl.vertexAttribPointer(
      this.programInfo.texCoordLocation,
      2,
      gl.FLOAT,
      false,
      stride,
      2 * Float32Array.BYTES_PER_ELEMENT
    );

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform1i(this.programInfo.imageLocation, 0);
    gl.uniform1f(this.programInfo.selectedMaskLocation, this.selectedMask);
    gl.uniform1i(this.programInfo.visibleLocation, this.visible ? 1 : 0);
    gl.uniform1i(
      this.programInfo.allSelectedLocation,
      this.selectedMask === ALL_SELECTED_MASK ? 1 : 0
    );
    gl.uniformMatrix4fv(this.programInfo.matrixLocation, false, this.matrixScratch);

    // custom layer 运行在 MapLibre 共用的 WebGL context 中，需要主动设置本层依赖的关键状态。
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.STENCIL_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.blendEquation(gl.FUNC_ADD);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  onRemove(_map: maplibregl.Map, gl: WebGLRenderingContext | WebGL2RenderingContext): void {
    if (this.vertexBuffer) {
      gl.deleteBuffer(this.vertexBuffer);
    }
    if (this.texture) {
      gl.deleteTexture(this.texture);
    }
    if (this.programInfo) {
      gl.deleteProgram(this.programInfo.program);
    }

    this.map = null;
    this.vertexBuffer = null;
    this.texture = null;
    this.programInfo = null;
    this.imageLoaded = false;
  }
}
