<template>
  <view v-if="visible" class="custom-color-mask" @click="cancel">
    <view class="custom-color-sheet" @click.stop>
      <view class="custom-color-handle"></view>
      <view class="custom-color-head">
        <text class="custom-color-title">自定义颜色</text>
        <text class="custom-color-close" @click="cancel">取消</text>
      </view>

      <view class="custom-color-canvas-wrap">
        <canvas
          :canvas-id="canvasId"
          :id="canvasId"
          class="custom-color-canvas"
          @touchstart="handlePanelTouch"
          @touchmove.stop.prevent="handlePanelTouch"
        />
        <view class="custom-color-cursor" :style="cursorStyle"></view>
      </view>

      <view class="custom-color-field">
        <text>色相</text>
        <slider class="custom-color-slider" min="0" max="359" :value="hue" activeColor="#6657D9" block-color="#6657D9" block-size="20" @changing="changeHue" @change="changeHue" />
      </view>

      <view class="custom-color-preview-row">
        <view class="custom-color-preview" :style="{ background: currentColor.hex }"></view>
        <view class="custom-color-value"><text>{{ currentColor.hex }}</text><text>RGB({{ currentColor.rgb.join(', ') }})</text></view>
      </view>

      <view class="custom-color-input-row">
        <view class="custom-color-input-wrap custom-color-hex-wrap">
          <text>HEX</text>
          <input :value="hexInput" maxlength="7" @input="handleHexInput" @blur="commitHexInput" />
        </view>
        <view class="custom-color-input-wrap">
          <text>R</text><input type="number" maxlength="3" :value="rgbInput.r" data-channel="r" @input="handleRgbInput" />
        </view>
        <view class="custom-color-input-wrap">
          <text>G</text><input type="number" maxlength="3" :value="rgbInput.g" data-channel="g" @input="handleRgbInput" />
        </view>
        <view class="custom-color-input-wrap">
          <text>B</text><input type="number" maxlength="3" :value="rgbInput.b" data-channel="b" @input="handleRgbInput" />
        </view>
      </view>

      <button class="custom-color-confirm" @click="confirm">确认选择</button>
      <view class="custom-color-safe"></view>
    </view>
  </view>
</template>

<script>
import {
  hexToRgb,
  hsvToRgb,
  normalizeHexColor,
  normalizeStandardColor,
  rgbToHex,
  rgbToHsv
} from '../../utils/color/colorPicker'

export default {
  name: 'CustomColorPicker',
  props: {
    visible: { type: Boolean, default: false },
    initialColor: { type: String, default: '#FFFFFF' },
    canvasId: { type: String, default: 'customColorPickerCanvas' }
  },
  data() {
    return {
      hue: 0,
      saturation: 0,
      brightness: 100,
      panelWidth: 320,
      panelHeight: 190,
      hexInput: '#FFFFFF',
      rgbInput: { r: 255, g: 255, b: 255 }
    }
  },
  computed: {
    currentColor() {
      const rgb = hsvToRgb(this.hue, this.saturation, this.brightness)
      return normalizeStandardColor({
        name: '自定义颜色',
        hex: rgbToHex(rgb[0], rgb[1], rgb[2]),
        rgb
      }, 'custom_picker')
    },
    cursorStyle() {
      return {
        left: `${Math.max(0, Math.min(this.panelWidth, this.panelWidth * this.saturation / 100))}px`,
        top: `${Math.max(0, Math.min(this.panelHeight, this.panelHeight * (1 - this.brightness / 100)))}px`
      }
    }
  },
  watch: {
    visible(value) {
      if (!value) return
      this.applyHex(this.initialColor)
      this.$nextTick(() => this.measureAndDraw())
    },
    hue() {
      if (this.visible) this.drawPanel()
    },
    currentColor: {
      deep: true,
      handler(color) {
        if (!color) return
        this.hexInput = color.hex
        this.rgbInput = { r: color.rgb[0], g: color.rgb[1], b: color.rgb[2] }
        this.$emit('change', color)
      }
    }
  },
  methods: {
    measureAndDraw() {
      uni.createSelectorQuery().in(this).select(`#${this.canvasId}`).boundingClientRect((rect) => {
        if (rect) {
          this.panelWidth = Math.max(1, rect.width)
          this.panelHeight = Math.max(1, rect.height)
        }
        this.drawPanel()
      }).exec()
    },
    drawPanel() {
      const context = uni.createCanvasContext(this.canvasId, this)
      const hueRgb = hsvToRgb(this.hue, 100, 100)
      const horizontal = context.createLinearGradient(0, 0, this.panelWidth, 0)
      horizontal.addColorStop(0, '#FFFFFF')
      horizontal.addColorStop(1, rgbToHex(...hueRgb))
      context.setFillStyle(horizontal)
      context.fillRect(0, 0, this.panelWidth, this.panelHeight)
      const vertical = context.createLinearGradient(0, 0, 0, this.panelHeight)
      vertical.addColorStop(0, 'rgba(0,0,0,0)')
      vertical.addColorStop(1, '#000000')
      context.setFillStyle(vertical)
      context.fillRect(0, 0, this.panelWidth, this.panelHeight)
      context.draw()
    },
    handlePanelTouch(event) {
      const touch = (event.touches || [])[0]
      if (!touch) return
      const x = Number(touch.x !== undefined ? touch.x : touch.clientX)
      const y = Number(touch.y !== undefined ? touch.y : touch.clientY)
      this.saturation = Math.round(Math.max(0, Math.min(1, x / this.panelWidth)) * 100)
      this.brightness = Math.round((1 - Math.max(0, Math.min(1, y / this.panelHeight))) * 100)
    },
    changeHue(event) {
      this.hue = Number(event.detail.value) || 0
    },
    applyHex(value) {
      const hex = normalizeHexColor(value) || '#FFFFFF'
      const rgb = hexToRgb(hex)
      const hsv = rgbToHsv(rgb)
      this.hue = hsv.h
      this.saturation = hsv.s
      this.brightness = hsv.v
      this.hexInput = hex
      this.rgbInput = rgb
    },
    handleHexInput(event) {
      this.hexInput = String(event.detail.value || '').toUpperCase()
    },
    commitHexInput() {
      const normalized = normalizeHexColor(this.hexInput)
      if (!normalized) {
        this.hexInput = this.currentColor.hex
        uni.showToast({ title: '请输入6位HEX颜色值', icon: 'none' })
        return
      }
      this.applyHex(normalized)
      this.$nextTick(() => this.drawPanel())
    },
    handleRgbInput(event) {
      const channel = event.currentTarget.dataset.channel
      const value = Math.max(0, Math.min(255, Number(event.detail.value) || 0))
      const rgb = { ...this.rgbInput, [channel]: value }
      this.applyHex(rgbToHex(rgb.r, rgb.g, rgb.b))
      this.$nextTick(() => this.drawPanel())
    },
    cancel() {
      this.$emit('cancel')
    },
    confirm() {
      this.$emit('confirm', { ...this.currentColor, sourceType: 'custom_picker' })
    }
  }
}
</script>

<style scoped>
.custom-color-mask { position: fixed; inset: 0; z-index: 999; display: flex; align-items: flex-end; background: rgba(17, 24, 39, 0.42); }
.custom-color-sheet { position: relative; box-sizing: border-box; width: 100%; padding: 16px 16px 0; border-radius: 18px 18px 0 0; background: #fff; }
.custom-color-handle { width: 38px; height: 4px; margin: 0 auto 12px; border-radius: 4px; background: #d8dbe3; }
.custom-color-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.custom-color-title { color: #171a24; font-size: 18px; font-weight: 600; }
.custom-color-close { min-height: 44px; display: flex; align-items: center; color: #667085; font-size: 14px; }
.custom-color-canvas-wrap { position: relative; width: 100%; height: 190px; }
.custom-color-canvas { width: 100%; height: 190px; border-radius: 10px; overflow: hidden; }
.custom-color-cursor { position: absolute; width: 20px; height: 20px; border: 2px solid #fff; border-radius: 50%; box-shadow: 0 0 0 1px rgba(17,24,39,.65); pointer-events: none; transform: translate(-50%, -50%); }
.custom-color-field { display: flex; align-items: center; min-height: 48px; margin-top: 8px; color: #475467; font-size: 13px; }
.custom-color-slider { flex: 1; margin-left: 8px; }
.custom-color-preview-row { display: flex; align-items: center; padding: 10px 0; }
.custom-color-preview { width: 48px; height: 48px; border: 1px solid #d9dde6; border-radius: 50%; }
.custom-color-value { display: flex; flex-direction: column; gap: 4px; margin-left: 12px; color: #171a24; font-size: 14px; }
.custom-color-value text:last-child { color: #667085; font-size: 12px; }
.custom-color-input-row { display: grid; grid-template-columns: 1.5fr repeat(3, 1fr); gap: 8px; }
.custom-color-input-wrap { min-width: 0; }
.custom-color-input-wrap text { display: block; margin-bottom: 5px; color: #667085; font-size: 12px; }
.custom-color-input-wrap input { box-sizing: border-box; width: 100%; height: 44px; padding: 0 8px; border: 1px solid #d9dde6; border-radius: 8px; color: #171a24; font-size: 14px; }
.custom-color-confirm { height: 48px; margin-top: 16px; border: 0; border-radius: 10px; background: #6657d9; color: #fff; font-size: 16px; font-weight: 600; line-height: 48px; }
.custom-color-confirm::after { border: 0; }
.custom-color-safe { height: env(safe-area-inset-bottom); min-height: 8px; }
</style>
