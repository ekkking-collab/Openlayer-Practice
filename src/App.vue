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
import axios from 'axios'

const cityName = ref('')
// 创建axios实例
const geoApi = axios.create({
  baseURL: 'https://geo.datav.aliyun.com/areas_v3/bound',
  timeout: 10000, // 请求超时时间
})
// 用于存储请求回来的全国城市数据
const cityFeatures = ref([])
// 获取数据的函数
const fetchCityData = async () => {
  try {
    const response = await geoApi.get('/100000_full_city.json')
    if (response.data && response.data.features) {
      cityFeatures.value = response.data.features
      console.log('全国城市 GeoJSON 数据加载成功！')
    }
  } catch (error) {
    console.error('获取城市数据失败:', error)
  }
}
// 查找并打印城市信息
let cityLayer = null
const printCityName = () => {
  const input = cityName.value.trim()
  if (!input) {
    console.log('输入为空，请输入城市名称')
    return
  }

  if (cityFeatures.value.length === 0) {
    console.log('数据还未加载完成，请稍后再试')
    return
  }

  // 在 features 数组中查找包含输入名称的城市 (例如输入"郑州"能匹配到"郑州市")
  const targetFeature = cityFeatures.value.find((feature) =>
    feature.properties.name.includes(input),
  )

  if (targetFeature) {
    const props = targetFeature.properties
    const coords = props.center
    console.log(props.adcode)
    if (map.value) {
      const view = map.value.getView()

      // 使用动画平滑飞往该城市，并放大地图层级
      view.animate({
        center: coords, // 坐标数组
        zoom: 8, // 放大到 10 级以便看清城市
        duration: 800, // 动画持续 0.8 秒
      })
    }
    if (!cityLayer) {
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
            color: 'rgba(52, 120, 255,0.4)',
          }),
        }),
      })
      map.value.addLayer(cityLayer)

      // 缩放监听只绑定一次
      view.on('change:resolution', () => {
        const zoom = view.getZoom()
        cityLayer.setVisible(zoom >= 8)
      })
    }
    const source = cityLayer.getSource()
    source.clear() // 清除上一个城市图形
    source.setUrl(`https://geo.datav.aliyun.com/areas_v3/bound/${props.adcode}.json`)
    source.refresh() // 强制重新请求加载新数据
  } else {
    console.log(`未找到与 "${input}" 相关的城市信息，请检查输入。`)
  }
}

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
  center: [113.65, 34.76],
  zoom: 8,
  projection: 'EPSG:4326',
})

onMounted(() => {
  fetchCityData()
  map.value = new Map({
    target: 'map',
    layers: [shpLayer],
    view,
  })
})
</script>

<template>
  <div class="app-container">
    <div id="map">
      <div class="header">
        <p class="ip">IP地 : 郑州市</p>
        <el-input
          v-model="cityName"
          style="width: 240px"
          placeholder="请输入你要搜索的城市"
          @keyup.enter="printCityName"
        />
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
