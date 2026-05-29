<script setup>
import { View, Map } from 'ol'
import TileLayer from 'ol/layer/Tile'
import { XYZ } from 'ol/source'
import VectorSource from 'ol/source/Vector'
import { onMounted, shallowRef } from 'vue'
import { ref } from 'vue'
import GeoJSON from 'ol/format/GeoJSON'
import VectorLayer from 'ol/layer/Vector'
import Style from 'ol/style/Style'
import Stroke from 'ol/style/Stroke'
import Fill from 'ol/style/Fill'

const input = ref('')
const value = ref('')
const value2 = ref('')
const options = [
  {
    value: 'Option1',
    label: '绘制直线',
  },
  {
    value: 'Option2',
    label: '绘制圆',
  },
  {
    value: 'Option3',
    label: '绘制多边形',
  },
  {
    value: 'Option4',
    label: '自由画笔',
  },
  {
    value: 'Option5',
    label: '清除要素',
  },
]
const options2 = [
  {
    value2: 'Option1',
    label: '充电站',
  },
  {
    value2: 'Option2',
    label: '公交车站',
  },
  {
    value2: 'Option3',
    label: '垃圾桶',
  },
]

const map = shallowRef(null)

// 高德矢量地图
const shpLayer = new TileLayer({
  source: new XYZ({
    url: 'https://wprd0{1-4}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
  }),
})
const view = new View({
  center: [114.66, 35.33],
  zoom: 8,
  projection: 'EPSG:4326',
})

// 中国各市地图
const citySource = new VectorSource({
  url: 'https://geo.datav.aliyun.com/areas_v3/bound/100000_full_city.json',
  format: new GeoJSON(),
})
const sityLayer = new VectorLayer({
  source: citySource,
  style: new Style({
    stroke: new Stroke({
      color: 'rgb(52, 120, 255)',
      width: 1,
    }),
    fill: new Fill({
      color: 'rgba(52, 120, 255,0.4)',
    }),
  }),
})
onMounted(() => {
  map.value = new Map({
    target: 'map',
    layers: [shpLayer],
    view,
  })
  map.value.addLayer(sityLayer)
})
</script>

<template>
  <div class="app-container">
    <div id="map">
      <div class="header">
        <p class="ip">IP地 : 郑州市</p>
        <el-input v-model="input" style="width: 240px" placeholder="请输入你要搜索的城市" />
        <el-select v-model="value" placeholder="Select" style="width: 240px">
          <el-option
            v-for="item in options"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
        <el-select v-model="value2" placeholder="Select" style="width: 240px">
          <el-option
            v-for="item in options2"
            :key="item.value2"
            :label="item.label"
            :value="item.value2"
          />
        </el-select>
      </div>
    </div>
  </div>
</template>

<style scoped>
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
.header {
  display: flex;
  padding: 14px;
  height: 60px;
  background-color: #3478ff;
}
.ip {
  margin-left: 20px;
  margin-right: 60px;
  line-height: 32px;
  color: #ffffff;
}
.el-select {
  margin-left: 80px;
}
</style>
