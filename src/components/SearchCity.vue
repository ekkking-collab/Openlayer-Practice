<script setup>
// ==================== Vue ====================
import { inject, onBeforeUnmount, ref, watch } from 'vue'

// ==================== OpenLayers ====================
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import GeoJSON from 'ol/format/GeoJSON'
import { Style, Stroke, Fill } from 'ol/style'

// ==================== 第三方 ====================
import axios from 'axios'
import { ElMessage } from 'element-plus'

// ====================================================
// 注入父组件的地图实例
// ====================================================
const mapInstance = inject('mapInstance')

// ====================================================
// 响应式状态
// ====================================================
const citySearchInput = ref('')
const allCityFeatures = ref([])
const isCityDataLoaded = ref(false)

// ====================================================
// Axios 实例
// ====================================================
const geoApi = axios.create({
  baseURL: 'https://geo.datav.aliyun.com/areas_v3/bound',
  timeout: 10000,
})

// ====================================================
// 城市图层
// ====================================================
let cityLayer = null

const stopWatch = watch(
  () => mapInstance.value,
  (map) => {
    if (!map) return
    stopWatch()
    initCityLayer(map)
    fetchCityData()
  },
  { immediate: true },
)

function initCityLayer(map) {
  cityLayer = new VectorLayer({
    source: new VectorSource({ format: new GeoJSON() }),
    style: new Style({
      stroke: new Stroke({ color: 'rgb(52, 120, 255)', width: 1 }),
      fill: new Fill({ color: 'rgba(52, 120, 255, 0.4)' }),
    }),
  })
  map.addLayer(cityLayer)

  // 缩放控制：放大到 10 级以上隐藏城市边界
  map.getView().on('change:resolution', () => {
    if (cityLayer) {
      cityLayer.setVisible(map.getView().getZoom() <= 10)
    }
  })
}

// ====================================================
// 城市数据加载
// ====================================================
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
function searchCity() {
  const input = citySearchInput.value.trim()
  if (!input) { ElMessage.warning('请输入城市名称'); return }
  if (!isCityDataLoaded.value) { ElMessage.info('城市数据正在加载中'); return }
  if (!mapInstance.value) { ElMessage.error('地图尚未初始化'); return }

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

  mapInstance.value.getView().animate({ center, zoom: 8, duration: 800 })
  loadCityBoundary(adcode)

  ElMessage.success(`已定位至 ${name}`)
  console.log(`📍 定位城市: ${name}, adcode: ${adcode}`)
}

function loadCityBoundary(adcode) {
  if (!cityLayer) return
  const source = cityLayer.getSource()
  source.clear()
  source.setUrl(`https://geo.datav.aliyun.com/areas_v3/bound/${adcode}.json`)
  source.refresh()
}

// ====================================================
// 生命周期
// ====================================================
onBeforeUnmount(() => {
  if (cityLayer && mapInstance.value) {
    mapInstance.value.removeLayer(cityLayer)
  }
  cityLayer = null
})
</script>

<template>
  <span class="search-city__label">📍 郑州市</span>
  <el-input
    v-model="citySearchInput"
    style="width: 240px"
    placeholder="请输入你要搜索的城市"
    clearable
    @keyup.enter="searchCity"
  />
</template>

<style scoped>
.search-city__label {
  flex-shrink: 0;
  color: #ffffff;
  font-size: 14px;
  white-space: nowrap;
  margin-right: 20px;
}
</style>
