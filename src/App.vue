<script setup>
// ==================== Vue ====================
import { onMounted, onUnmounted, ref, shallowRef } from 'vue'

// ==================== OpenLayers ====================
import { Map, View, Overlay } from 'ol'
import TileLayer from 'ol/layer/Tile'
import VectorLayer from 'ol/layer/Vector'
import { XYZ } from 'ol/source'
import VectorSource from 'ol/source/Vector'
import GeoJSON from 'ol/format/GeoJSON'
import { Style, Stroke, Fill, Circle as CircleStyle, Text } from 'ol/style'
import Draw from 'ol/interaction/Draw'
import ScaleLine from 'ol/control/ScaleLine'
import Feature from 'ol/Feature'
import Point from 'ol/geom/Point'

// ==================== 第三方 ====================
import axios from 'axios'
import { ElMessage } from 'element-plus'

// ====================================================
// 响应式状态
// ====================================================

/** OpenLayers 地图实例（非响应式对象，使用 shallowRef） */
const mapInstance = shallowRef(null)

/** 城市搜索输入框 */
const citySearchInput = ref('')

/** 绘制类型选择 */
const drawType = ref('')

/** POI 类型选择 */
const poiType = ref('')

/** 从阿里云 DataV 加载的全国城市 GeoJSON 数据 */
const allCityFeatures = ref([])

/** 城市数据是否已加载完成 */
const isCityDataLoaded = ref(false)

// ====================================================
// 常量配置
// ====================================================

const DRAW_OPTIONS = [
  { value: 'LineString', label: '绘制直线' },
  { value: 'Circle', label: '绘制圆' },
  { value: 'Polygon', label: '绘制多边形' },
  { value: 'FreehandLine', label: '自由画笔' },
  { value: 'Clear', label: '清除要素' },
]

const POI_OPTIONS = [
  { value: 'charging_station', label: '充电站' },
  { value: 'bus_stop', label: '公交车站' },
  { value: 'trash_bin', label: '垃圾桶' },
]

/**
 * POI 类型编码与样式映射（高德地图 POI 分类编码）
 * 编码参考: https://a.amap.com/lbs/static/amap_poitree/index.html
 */
const POI_TYPE_CONFIG = {
  charging_station: {
    code: '150500',
    label: '充电站',
    color: '#00d86b',
    icon: '⚡',
  },
  bus_stop: {
    code: '150700',
    label: '公交车站',
    color: '#ff6b35',
    icon: '🚌',
  },
  trash_bin: {
    code: '200100',
    label: '垃圾桶',
    color: '#ff9800',
    icon: '🗑️',
  },
}

/** 高德地图 Web API 配置 */
const AMAP_CONFIG = {
  key: '6cc018dd755c859afb384f16aa488a40',
  searchUrl: 'https://restapi.amap.com/v3/place/around',
}

/**
 * 天地图底图 Token。
 * 生产环境请使用 .env 文件中的 VITE_TIANDITU_TOKEN，避免硬编码。
 * @see https://console.tianditu.gov.cn/
 */
// const TIANDITU_TOKEN =
//   import.meta.env.VITE_TIANDITU_TOKEN ||
//   'c928cf09a3ed75a3b8d23f1e4d11d4eb'

// ====================================================
// Axios 实例
// ====================================================

const geoApi = axios.create({
  baseURL: 'https://geo.datav.aliyun.com/areas_v3/bound',
  timeout: 10000,
})

// ====================================================
// 图层引用（在 onMounted 中初始化）
// ====================================================

let cityLayer = null
let drawSource = null
let drawLayer = null
let drawInteraction = null
let poiSource = null
let poiLayer = null
let poiOverlay = null

// ====================================================
// 城市数据加载
// ====================================================

/**
 * 从阿里云 DataV 获取全国城市 GeoJSON 数据
 */
async function fetchCityData() {
  try {
    const { data } = await geoApi.get('/100000_full_city.json')
    if (data?.features) {
      allCityFeatures.value = data.features
      isCityDataLoaded.value = true
      console.log(`✅ 城市数据加载完成，共 ${data.features.length} 条记录`)
    }
  } catch (error) {
    console.error('获取城市数据失败:', error)
    ElMessage.error('城市数据加载失败，请刷新页面重试')
  }
}

// ====================================================
// 城市搜索
// ====================================================

/**
 * 搜索城市并飞行动画跳转。
 * 匹配策略：精确匹配 → 前缀匹配 → 模糊包含
 */
function searchCity() {
  const input = citySearchInput.value.trim()
  if (!input) {
    ElMessage.warning('请输入城市名称')
    return
  }
  if (!isCityDataLoaded.value) {
    ElMessage.info('城市数据正在加载中，请稍后再试')
    return
  }
  if (!mapInstance.value) {
    ElMessage.error('地图尚未初始化')
    return
  }

  const features = allCityFeatures.value
  const targetFeature =
    features.find((f) => f.properties.name === input) ??
    features.find((f) => f.properties.name.startsWith(input)) ??
    features.find((f) => f.properties.name.includes(input))

  if (!targetFeature) {
    ElMessage.warning(`未找到匹配"${input}"的城市`)
    return
  }

  const { name, center, adcode } = targetFeature.properties
  if (!center || center.length < 2) {
    ElMessage.error(`城市"${name}"缺少坐标数据`)
    return
  }

  // 飞行动画到目标城市
  const view = mapInstance.value.getView()
  view.animate({
    center,
    zoom: 8,
    duration: 800,
  })

  // 加载并显示城市行政区划边界
  loadCityBoundary(adcode)

  ElMessage.success(`已定位至 ${name}`)
  console.log(`📍 定位城市: ${name}, adcode: ${adcode}, 坐标: [${center}]`)
}

/**
 * 加载指定 adcode 的行政区划边界并渲染到城市图层
 */
function loadCityBoundary(adcode) {
  if (!cityLayer) return

  const source = cityLayer.getSource()
  source.clear()
  source.setUrl(`https://geo.datav.aliyun.com/areas_v3/bound/${adcode}.json`)
  source.refresh()
}

// ====================================================
// 绘制交互
// ====================================================

/**
 * 处理绘制类型切换。
 * 先移除旧的 Draw 交互，再根据选择创建新的。
 */
function handleDrawChange(selectedType) {
  if (!mapInstance.value) return

  // 先移除旧的交互
  if (drawInteraction) {
    mapInstance.value.removeInteraction(drawInteraction)
    drawInteraction = null
  }

  // 清除模式：清空已绘制要素
  if (selectedType === 'Clear') {
    drawSource?.clear()
    drawType.value = ''
    ElMessage.info('已清除所有绘制的要素')
    return
  }

  if (!selectedType) return

  // 自由画笔和普通线条都是 LineString，区别在于 freehand 模式
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
// POI 检索
// ====================================================

/**
 * 调用高德周边搜索 API，获取指定类型 POI 列表。
 * @param {number[]} center - 搜索中心点 [lng, lat]
 * @param {string} poiType - POI 类型 key
 * @param {number} radius - 搜索半径，单位米
 * @returns {Promise<Array>} POI 数据数组
 */
async function searchPoi(center, poiType, radius) {
  const config = POI_TYPE_CONFIG[poiType]
  if (!config?.code) {
    console.warn(`未找到 POI 类型编码: ${poiType}`)
    return []
  }

  try {
    const { data } = await axios.get(AMAP_CONFIG.searchUrl, {
      params: {
        key: AMAP_CONFIG.key,
        location: `${center[0]},${center[1]}`,
        types: config.code,
        radius,
        offset: 25,
        extensions: 'all',
      },
    })

    if (data.status === '1' && data.pois) {
      console.log(`🔍 搜索"${config.label}"：找到 ${data.count} 条，已返回 ${data.pois.length} 条`)
      return data.pois
    }
    return []
  } catch (error) {
    console.error('POI 搜索失败:', error)
    ElMessage.error('POI 搜索请求失败，请检查网络或 API Key')
    return []
  }
}

/**
 * 将 POI 数据渲染到地图上的矢量图层。
 * @param {Array} pois - 高德 API 返回的 pois 数组
 * @param {string} poiType - POI 类型 key
 */
function renderPoiOnMap(pois, poiType) {
  if (!poiSource) return

  poiSource.clear()

  if (!pois.length) {
    ElMessage.info('该区域未找到对应 POI')
    return
  }

  const config = POI_TYPE_CONFIG[poiType]
  const features = pois.map((poi) => {
    const [lng, lat] = poi.location.split(',').map(Number)
    const feature = new Feature({
      geometry: new Point([lng, lat]),
    })
    feature.setProperties({
      name: poi.name,
      address: poi.address || '暂无地址信息',
      poiType,
    })
    return feature
  })

  poiSource.addFeatures(features)

  const label = config?.label || poiType
  ElMessage.success(`已加载 ${features.length} 个${label}`)
}

/**
 * 处理 POI 类型下拉框变更。
 * 根据当前地图中心位置和缩放级别，搜索并渲染 POI。
 */
async function handlePoiChange(selectedType) {
  // 清空上次的搜索结果
  if (poiSource) poiSource.clear()
  if (poiOverlay) poiOverlay.setPosition(undefined)

  if (!selectedType) return

  if (!mapInstance.value) {
    ElMessage.error('地图尚未初始化')
    return
  }

  const view = mapInstance.value.getView()
  const center = view.getCenter()
  const zoom = view.getZoom()

  // 搜索半径随缩放级别动态调整（zoom 越大 → 地图越细节 → 半径越小）
  const radius = Math.max(1000, Math.round(50000 / Math.pow(2, zoom - 5)))

  const pois = await searchPoi(center, selectedType, radius)
  renderPoiOnMap(pois, selectedType)
}

// ====================================================
// 地图初始化
// ====================================================

function initMap() {
  // ---- View ----
  const view = new View({
    center: [113.65, 34.76], // 初始中心：河南省郑州市附近
    zoom: 8,
    projection: 'EPSG:4326',
  })

  // ---- 天地图底图 ----
  const baseLayer = new TileLayer({
    source: new XYZ({
      url: `https://wprd0{1-4}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}`,
    }),
  })

  // ---- 城市行政区划图层 ----
  const citySource = new VectorSource({
    format: new GeoJSON(),
  })

  cityLayer = new VectorLayer({
    source: citySource,
    style: new Style({
      stroke: new Stroke({
        color: 'rgb(52, 120, 255)',
        width: 1,
      }),
      fill: new Fill({
        color: 'rgba(52, 120, 255, 0.4)',
      }),
    }),
  })

  // 放大到 10 级以上时隐藏城市边界（看得太细不需要行政区划轮廓）
  view.on('change:resolution', () => {
    const currentZoom = view.getZoom()
    cityLayer.setVisible(currentZoom <= 10)
  })

  // ---- 要素绘制图层 ----
  drawSource = new VectorSource({})
  drawLayer = new VectorLayer({
    source: drawSource,
    // 注意：drawLayer 的样式在上面已定义，保持不变
    style: new Style({
      fill: new Fill({
        color: 'rgba(0, 0, 255, 0.3)',
      }),
      stroke: new Stroke({
        color: 'rgba(0, 0, 255, 0.3)',
        width: 3,
      }),
      image: new CircleStyle({
        radius: 7,
        fill: new Fill({
          color: 'rgba(0, 0, 255, 0.3)',
        }),
      }),
    }),
  })

  // ---- POI 兴趣点图层 ----
  poiSource = new VectorSource({})
  poiLayer = new VectorLayer({
    source: poiSource,
    style: function (feature) {
      const type = feature.get('poiType')
      const config = POI_TYPE_CONFIG[type] || { color: '#409eff' }
      return new Style({
        image: new CircleStyle({
          radius: 8,
          fill: new Fill({
            color: config.color,
          }),
          stroke: new Stroke({
            color: '#fff',
            width: 2,
          }),
        }),
        text: new Text({
          text: feature.get('name'),
          offsetY: -16,
          font: '12px "Microsoft YaHei", sans-serif',
          fill: new Fill({
            color: '#333',
          }),
          stroke: new Stroke({
            color: '#fff',
            width: 2,
          }),
        }),
      })
    },
    // POI 图层置于顶层
    zIndex: 10,
  })

  // ---- POI 弹窗 Overlay ----
  const popupElement = document.createElement('div')
  popupElement.className = 'poi-popup'
  popupElement.style.display = 'none'
  poiOverlay = new Overlay({
    element: popupElement,
    autoPan: true,
    autoPanAnimation: { duration: 250 },
    positioning: 'bottom-center',
    offset: [0, -14],
  })

  // ---- 比例尺控件 ----
  const scaleLineControl = new ScaleLine({
    units: 'metric',
  })

  // ---- 创建地图 ----
  mapInstance.value = new Map({
    target: 'map',
    view,
    layers: [baseLayer, drawLayer, cityLayer, poiLayer],
    controls: [scaleLineControl],
  })

  // 添加 POI 弹窗 Overlay
  mapInstance.value.addOverlay(poiOverlay)

  // ---- POI 点击弹窗交互 ----
  mapInstance.value.on('click', (evt) => {
    const feature = mapInstance.value.forEachFeatureAtPixel(evt.pixel, (f) => f, {
      layerFilter: (layer) => layer === poiLayer,
    })

    if (feature) {
      const name = feature.get('name')
      const address = feature.get('address')
      const type = feature.get('poiType')
      const config = POI_TYPE_CONFIG[type] || {}
      popupElement.innerHTML = `
          <strong>${config.icon || '📍'} ${name}</strong>
          <span class="poi-popup__address">${address}</span>
        `
      popupElement.style.display = 'block'
      poiOverlay.setPosition(feature.getGeometry().getCoordinates())
    } else {
      popupElement.style.display = 'none'
      poiOverlay.setPosition(undefined)
    }
  })

  console.log('🗺️  地图初始化完成')
}

// ====================================================
// 生命周期
// ====================================================

onMounted(() => {
  initMap()
  fetchCityData()
})

onUnmounted(() => {
  // 清理绘制交互
  if (drawInteraction && mapInstance.value) {
    mapInstance.value.removeInteraction(drawInteraction)
    drawInteraction = null
  }

  // 清理 POI 图层引用
  poiSource = null
  poiLayer = null
  poiOverlay = null

  // 销毁地图（释放 WebGL 上下文、事件监听等）
  if (mapInstance.value) {
    mapInstance.value.setTarget(undefined)
    mapInstance.value.dispose()
    mapInstance.value = null
  }

  console.log('🧹 地图资源已清理')
})
</script>

<template>
  <div class="app-container">
    <div id="map">
      <div class="toolbar">
        <span class="toolbar__location">📍 郑州市</span>

        <el-input
          v-model="citySearchInput"
          style="width: 240px"
          placeholder="请输入你要搜索的城市"
          clearable
          @keyup.enter="searchCity"
          @clear="citySearchInput = ''"
        />

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
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ===== 布局 ===== */
.app-container {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

#map {
  width: 100%;
  height: 100%;
  background-color: #f0f2f5;
}

/* ===== 工具栏 ===== */
.toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 24px;
  height: 56px;
  background-color: #3478ff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.toolbar__location {
  flex-shrink: 0;
  color: #ffffff;
  font-size: 14px;
  white-space: nowrap;
  margin-right: 20px;
}

/* 穿透 scoped 样式，覆盖 Element Plus 组件内部样式 */
.toolbar :deep(.el-select) {
  flex-shrink: 0;
  margin-left: 80px;
}

/* ===== POI 弹窗 ===== */
/* 弹窗由 Overlay 动态创建 DOM，不受 scoped 限制，使用非 scoped 全局样式 */
</style>

<style>
.poi-popup {
  background: #ffffff;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  padding: 8px 14px;
  font-size: 13px;
  white-space: nowrap;
  pointer-events: none;
  animation: poi-fade-in 0.2s ease;
}

.poi-popup strong {
  display: block;
  color: #303133;
  font-size: 14px;
  margin-bottom: 2px;
}

.poi-popup__address {
  color: #909399;
  font-size: 12px;
}

@keyframes poi-fade-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
