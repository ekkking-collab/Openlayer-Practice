<script setup>
// ==================== Vue ====================
import { onMounted, onUnmounted, provide, shallowRef } from 'vue'

// ==================== OpenLayers ====================
import { Map, View } from 'ol'
import TileLayer from 'ol/layer/Tile'
import { XYZ } from 'ol/source'
import ScaleLine from 'ol/control/ScaleLine'

// ==================== 子组件 ====================
import SearchCity from './components/SearchCity.vue'
import DrawFeature from './components/DrawFeature.vue'
import PoiFeature from './components/PoiFeature.vue'

// ====================================================
// 地图实例（通过 provide 向子组件共享）
// ====================================================
const mapInstance = shallowRef(null)
provide('mapInstance', mapInstance)

// ====================================================
// 地图初始化（仅负责底图 + 比例尺）
// ====================================================
onMounted(() => {
  const view = new View({
    center: [113.65, 34.76],
    zoom: 8,
    projection: 'EPSG:4326',
  })

  const markLayer = new TileLayer({
    source: new XYZ({
      url: 'https://wprd0{1-4}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
    }),
  })
  const rsLayer = new TileLayer({
    source: new XYZ({
      url: 'https://wprd0{1-4}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=6&x={x}&y={y}&z={z}',
    }),
  })
  const baseLayer = new TileLayer({
    source: new XYZ({
      url: 'https://wprd0{1-4}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}',
    }),
  })
  const scaleLineControl = new ScaleLine({ units: 'metric' })

  mapInstance.value = new Map({
    target: 'map',
    view,
    layers: [rsLayer, markLayer, baseLayer],
    controls: [scaleLineControl],
  })

  console.log('🗺️  底图加载完成')
})

// 切换底图
const changeTile = () => {
  const tile = mapInstance.value.getLayers()
  if (tile.array_[2].getVisible()) {
    tile.array_[2].setVisible(false)
  } else {
    tile.array_[2].setVisible(true)
  }
}
// 清理
onUnmounted(() => {
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
        <SearchCity />
        <DrawFeature />
        <PoiFeature />
        <button class="btn" @click="changeTile">切换底图</button>
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
.btn {
  margin-left: 40px;
  background-color: #fff;
  height: 32px;
  width: 80px;
  border-radius: 4px;
  color: #000000;
}
.toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 24px;
  height: 56px;
  background-color: #3478ff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.toolbar :deep(.el-select) {
  flex-shrink: 0;
  margin-left: 40px;
}

.toolbar :deep(.el-input) {
  flex-shrink: 0;
}
</style>

<!-- 全局样式：Overlay 创建的 DOM 不被 scoped 穿透      -->
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

.measure-tooltip {
  background: rgba(0, 0, 0, 0.75);
  color: #ffffff;
  border-radius: 4px;
  padding: 4px 10px;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  pointer-events: none;
  font-family: 'JetBrains Mono', 'Consolas', monospace;
}

.measure-tooltip strong {
  color: #ffccc7;
}

/* ===== 比例尺 — 覆写 OL 默认样式使其清晰可见 ===== */
.ol-scale-line {
  background: rgba(0, 0, 0, 0.55) !important;
  border-radius: 4px;
  padding: 4px 6px;
}

.ol-scale-line-inner {
  color: #fff !important;
  font-size: 11px !important;
  font-weight: 500;
  border-color: rgba(255, 255, 255, 0.5) !important;
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
