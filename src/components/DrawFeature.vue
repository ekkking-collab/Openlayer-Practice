<script setup>
// ==================== Vue ====================
import { inject, onBeforeUnmount, ref, watch } from 'vue'

// ==================== OpenLayers ====================
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import { Style, Stroke, Fill, Circle as CircleStyle } from 'ol/style'
import Draw from 'ol/interaction/Draw'
import Overlay from 'ol/Overlay'

// ==================== 球面几何计算 ====================
import { getLength, getArea } from 'ol/sphere'

// ==================== 第三方 ====================
import { ElMessage } from 'element-plus'

// ====================================================
// 注入父组件的地图实例
// ====================================================
const mapInstance = inject('mapInstance')

// ====================================================
// 下拉框选项
// ====================================================
const drawType = ref('')

const DRAW_OPTIONS = [
  { value: 'LineString', label: '绘制直线' },
  { value: 'Circle', label: '绘制圆' },
  { value: 'Polygon', label: '绘制多边形' },
  { value: 'FreehandLine', label: '自由画笔' },
  { value: 'Measure', label: '测距' },
  { value: 'MeasureArea', label: '测面积' },
  { value: 'Clear', label: '清除要素' },
]

// ====================================================
// 图层 & 交互引用
// ====================================================
let drawSource = null
let drawLayer = null
let measureSource = null
let measureLayer = null
let measureTooltip = null
let measureSketch = null
let drawInteraction = null

// ====================================================
// 格式化函数
// ====================================================
function formatLength(line) {
  const length = getLength(line, { projection: 'EPSG:4326' })
  if (length < 1000) return `${Math.round(length)} m`
  return `${(length / 1000).toFixed(2)} km`
}

function formatArea(polygon) {
  const area = getArea(polygon, { projection: 'EPSG:4326' })
  if (area > 1_000_000) return `${(area / 1_000_000).toFixed(2)} km²`
  if (area > 666) return `${(area / 666.67).toFixed(1)} 亩（${Math.round(area)} m²）`
  return `${Math.round(area)} m²`
}

// ====================================================
// 测量 pointermove
// ====================================================
function onMeasurePointerMove(evt) {
  if (!measureSketch) return
  const geom = measureSketch.getGeometry()
  if (!geom) return

  const output = geom.getType() === 'Polygon'
    ? formatArea(geom)
    : formatLength(geom)

  measureTooltip.getElement().innerHTML = output
  measureTooltip.setPosition(evt.coordinate)
}

// ====================================================
// 创建测量交互
// ====================================================
function addMeasureInteraction(geometryType) {
  if (!mapInstance.value) return

  const draw = new Draw({
    source: measureSource,
    type: geometryType,
    style: new Style({
      stroke: new Stroke({ color: '#ff4d4f', width: 2, lineDash: [6, 4] }),
      fill: new Fill({ color: 'rgba(255, 77, 79, 0.08)' }),
      image: new CircleStyle({
        radius: 5,
        stroke: new Stroke({ color: '#ff4d4f', width: 2 }),
        fill: new Fill({ color: 'rgba(255, 77, 79, 0.3)' }),
      }),
    }),
  })

  draw.on('drawstart', (evt) => {
    measureSketch = evt.feature
    const el = measureTooltip.getElement()
    el.style.display = 'block'
    el.innerHTML = geometryType === 'Polygon' ? '0 m²' : '0 m'
    mapInstance.value.on('pointermove', onMeasurePointerMove)
  })

  draw.on('drawend', (evt) => {
    const geom = evt.feature.getGeometry()
    const value = geometryType === 'Polygon' ? formatArea(geom) : formatLength(geom)
    measureTooltip.getElement().innerHTML = `<strong>${value}</strong>`
    measureSketch = null
    mapInstance.value.un('pointermove', onMeasurePointerMove)
  })

  draw.on('drawabort', () => {
    measureSource.clear()
    measureSketch = null
    measureTooltip.getElement().style.display = 'none'
    mapInstance.value.un('pointermove', onMeasurePointerMove)
  })

  drawInteraction = draw
  mapInstance.value.addInteraction(draw)
}

// ====================================================
// 绘制 / 测量 入口
// ====================================================
function handleDrawChange(selectedType) {
  if (!mapInstance.value) return

  // 移除旧交互
  if (drawInteraction) {
    mapInstance.value.un('pointermove', onMeasurePointerMove)
    mapInstance.value.removeInteraction(drawInteraction)
    drawInteraction = null
  }

  // 清除模式
  if (selectedType === 'Clear') {
    drawSource?.clear()
    measureSource?.clear()
    drawType.value = ''
    ElMessage.info('已清除所有要素和测量结果')
    return
  }

  if (!selectedType) return

  // 测量模式
  if (selectedType === 'Measure') { addMeasureInteraction('LineString'); return }
  if (selectedType === 'MeasureArea') { addMeasureInteraction('Polygon'); return }

  // 绘制模式
  const isFreehand = selectedType === 'FreehandLine'
  const geometryType = isFreehand ? 'LineString' : selectedType

  drawInteraction = new Draw({
    source: drawSource,
    type: geometryType,
    freehand: isFreehand,
  })
  mapInstance.value.addInteraction(drawInteraction)
}

// ====================================================
// 等待地图就绪后初始化
// ====================================================
const stopWatch = watch(
  () => mapInstance.value,
  (map) => {
    if (!map) return
    stopWatch()
    initDrawFeature(map)
  },
  { immediate: true },
)

function initDrawFeature(map) {
  // 绘制图层
  drawSource = new VectorSource({})
  drawLayer = new VectorLayer({
    source: drawSource,
    style: new Style({
      fill: new Fill({ color: 'rgba(0, 0, 255, 0.3)' }),
      stroke: new Stroke({ color: 'rgba(0, 0, 255, 0.3)', width: 3 }),
      image: new CircleStyle({
        radius: 7,
        fill: new Fill({ color: 'rgba(0, 0, 255, 0.3)' }),
      }),
    }),
  })

  // 测量图层
  measureSource = new VectorSource({})
  measureLayer = new VectorLayer({
    source: measureSource,
    style: new Style({
      stroke: new Stroke({ color: '#ff4d4f', width: 2, lineDash: [6, 4] }),
      fill: new Fill({ color: 'rgba(255, 77, 79, 0.08)' }),
      image: new CircleStyle({
        radius: 5,
        stroke: new Stroke({ color: '#ff4d4f', width: 2 }),
        fill: new Fill({ color: 'rgba(255, 77, 79, 0.3)' }),
      }),
    }),
    zIndex: 5,
  })

  // 测量 tooltip
  const tooltipEl = document.createElement('div')
  tooltipEl.className = 'measure-tooltip'
  tooltipEl.style.display = 'none'
  measureTooltip = new Overlay({
    element: tooltipEl,
    autoPan: false,
    positioning: 'bottom-center',
    offset: [0, -10],
  })

  map.addLayer(drawLayer)
  map.addLayer(measureLayer)
  map.addOverlay(measureTooltip)

  console.log('✏️ DrawFeature 初始化完成')
}

// ====================================================
// 清理
// ====================================================
onBeforeUnmount(() => {
  if (drawInteraction && mapInstance.value) {
    mapInstance.value.un('pointermove', onMeasurePointerMove)
    mapInstance.value.removeInteraction(drawInteraction)
    drawInteraction = null
  }
  if (drawLayer && mapInstance.value) mapInstance.value.removeLayer(drawLayer)
  if (measureLayer && mapInstance.value) mapInstance.value.removeLayer(measureLayer)
  if (measureTooltip && mapInstance.value) mapInstance.value.removeOverlay(measureTooltip)
  drawSource = null; drawLayer = null
  measureSource = null; measureLayer = null; measureTooltip = null; measureSketch = null
})
</script>

<template>
  <el-select
    v-model="drawType"
    placeholder="选择绘制工具"
    style="width: 160px"
    @change="handleDrawChange"
  >
    <el-option
      v-for="item in DRAW_OPTIONS"
      :key="item.value"
      :label="item.label"
      :value="item.value"
    />
  </el-select>
</template>

<style scoped>
/* 穿透 Element Plus scoped */
:deep(.el-select) {
  flex-shrink: 0;
}
</style>
