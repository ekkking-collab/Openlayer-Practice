<script setup>
// ==================== Vue ====================
import { inject, onBeforeUnmount, ref, watch } from 'vue'

// ==================== OpenLayers ====================
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import { Style, Stroke, Fill, Circle as CircleStyle, Text } from 'ol/style'
import Overlay from 'ol/Overlay'
import Feature from 'ol/Feature'
import Point from 'ol/geom/Point'

// ==================== 第三方 ====================
import axios from 'axios'
import { ElMessage } from 'element-plus'

// ====================================================
// 注入父组件的地图实例
// ====================================================
const mapInstance = inject('mapInstance')

// ====================================================
// 下拉框选项 & 配置
// ====================================================
const poiType = ref('')

const POI_OPTIONS = [
  { value: 'charging_station', label: '充电站' },
  { value: 'bus_stop', label: '公交车站' },
  { value: 'trash_bin', label: '垃圾桶' },
]

const POI_TYPE_CONFIG = {
  charging_station: { code: '150500', label: '充电站', color: '#00d86b', icon: '⚡' },
  bus_stop: { code: '150700', label: '公交车站', color: '#ff6b35', icon: '🚌' },
  trash_bin: { code: '200100', label: '垃圾桶', color: '#ff9800', icon: '🗑️' },
}

const AMAP_KEY = '6cc018dd755c859afb384f16aa488a40'

// ====================================================
// 图层 & Overlay 引用
// ====================================================
let poiSource = null
let poiLayer = null
let poiOverlay = null

// ====================================================
// POI 搜索 API
// ====================================================
async function searchPoi(center, type, radius) {
  const config = POI_TYPE_CONFIG[type]
  if (!config?.code) { console.warn(`未找到 POI 编码: ${type}`); return [] }

  try {
    const { data } = await axios.get('https://restapi.amap.com/v3/place/around', {
      params: {
        key: AMAP_KEY,
        location: `${center[0]},${center[1]}`,
        types: config.code,
        radius,
        offset: 25,
        extensions: 'all',
      },
    })
    if (data.status === '1' && data.pois) {
      console.log(`🔍 搜索"${config.label}"：${data.pois.length} 条`)
      return data.pois
    }
    return []
  } catch (error) {
    console.error('POI 搜索失败:', error)
    ElMessage.error('POI 搜索请求失败')
    return []
  }
}

// ====================================================
// POI 渲染
// ====================================================
function renderPoiOnMap(pois, type) {
  if (!poiSource) return
  poiSource.clear()
  if (!pois.length) { ElMessage.info('该区域未找到对应 POI'); return }

  const config = POI_TYPE_CONFIG[type]
  const features = pois.map((poi) => {
    const [lng, lat] = poi.location.split(',').map(Number)
    const f = new Feature({ geometry: new Point([lng, lat]) })
    f.setProperties({ name: poi.name, address: poi.address || '暂无地址信息', poiType: type })
    return f
  })
  poiSource.addFeatures(features)
  ElMessage.success(`已加载 ${features.length} 个${config?.label || type}`)
}

// ====================================================
// POI 下拉变更入口
// ====================================================
async function handlePoiChange(selectedType) {
  if (poiSource) poiSource.clear()
  if (poiOverlay) poiOverlay.setPosition(undefined)

  if (!selectedType) return
  if (!mapInstance.value) { ElMessage.error('地图尚未初始化'); return }

  const view = mapInstance.value.getView()
  const center = view.getCenter()
  const zoom = view.getZoom()
  const radius = Math.max(1000, Math.round(50000 / Math.pow(2, zoom - 5)))

  const pois = await searchPoi(center, selectedType, radius)
  renderPoiOnMap(pois, selectedType)
}

// ====================================================
// 等待地图就绪后初始化
// ====================================================
const stopWatch = watch(
  () => mapInstance.value,
  (map) => {
    if (!map) return
    stopWatch()
    initPoiFeature(map)
  },
  { immediate: true },
)

function initPoiFeature(map) {
  // POI 图层
  poiSource = new VectorSource({})
  poiLayer = new VectorLayer({
    source: poiSource,
    style: (feature) => {
      const type = feature.get('poiType')
      const c = POI_TYPE_CONFIG[type] || { color: '#409eff' }
      return new Style({
        image: new CircleStyle({
          radius: 8,
          fill: new Fill({ color: c.color }),
          stroke: new Stroke({ color: '#fff', width: 2 }),
        }),
        text: new Text({
          text: feature.get('name'),
          offsetY: -16,
          font: '12px "Microsoft YaHei", sans-serif',
          fill: new Fill({ color: '#333' }),
          stroke: new Stroke({ color: '#fff', width: 2 }),
        }),
      })
    },
    zIndex: 10,
  })

  // POI 弹窗
  const popupEl = document.createElement('div')
  popupEl.className = 'poi-popup'
  popupEl.style.display = 'none'
  poiOverlay = new Overlay({
    element: popupEl,
    autoPan: true,
    autoPanAnimation: { duration: 250 },
    positioning: 'bottom-center',
    offset: [0, -14],
  })

  map.addLayer(poiLayer)
  map.addOverlay(poiOverlay)

  // 点击弹窗
  map.on('click', (evt) => {
    const feature = map.forEachFeatureAtPixel(evt.pixel, (f) => f, {
      layerFilter: (layer) => layer === poiLayer,
    })
    if (feature) {
      const name = feature.get('name')
      const address = feature.get('address')
      const type = feature.get('poiType')
      const config = POI_TYPE_CONFIG[type] || {}
      popupEl.innerHTML = `<strong>${config.icon || '📍'} ${name}</strong><span class="poi-popup__address">${address}</span>`
      popupEl.style.display = 'block'
      poiOverlay.setPosition(feature.getGeometry().getCoordinates())
    } else {
      popupEl.style.display = 'none'
      poiOverlay.setPosition(undefined)
    }
  })

  console.log('📍 PoiFeature 初始化完成')
}

// ====================================================
// 清理
// ====================================================
onBeforeUnmount(() => {
  if (poiLayer && mapInstance.value) mapInstance.value.removeLayer(poiLayer)
  if (poiOverlay && mapInstance.value) mapInstance.value.removeOverlay(poiOverlay)
  poiSource = null; poiLayer = null; poiOverlay = null
})
</script>

<template>
  <el-select
    v-model="poiType"
    placeholder="选择 POI 类型"
    style="width: 160px"
    @change="handlePoiChange"
  >
    <el-option
      v-for="item in POI_OPTIONS"
      :key="item.value"
      :label="item.label"
      :value="item.value"
    />
  </el-select>
</template>

<style scoped>
:deep(.el-select) {
  flex-shrink: 0;
}
</style>
