const CUSTOM_SCENE_STORAGE_KEY = 'diebiandesign_custom_scenes'

function nowIso() {
  return new Date().toISOString()
}

function normalizeTags(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean)
  }
  return String(value || '')
    .split(/[,，、]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function cloneScene(scene = {}) {
  return {
    sceneId: scene.sceneId || '',
    name: scene.name || '',
    coverUrl: scene.coverUrl || '',
    sceneType: scene.sceneType || '',
    category: scene.category || '',
    styleTags: normalizeTags(scene.styleTags),
    prompt: scene.prompt || '',
    isCustom: !!scene.isCustom,
    createdAt: scene.createdAt || nowIso()
  }
}

function readCustomScenes() {
  try {
    if (typeof uni === 'undefined' || !uni.getStorageSync) return []
    const value = uni.getStorageSync(CUSTOM_SCENE_STORAGE_KEY)
    return Array.isArray(value) ? value.map(cloneScene) : []
  } catch (error) {
    return []
  }
}

function writeCustomScenes(scenes = []) {
  try {
    if (typeof uni !== 'undefined' && uni.setStorageSync) {
      uni.setStorageSync(CUSTOM_SCENE_STORAGE_KEY, scenes.map(cloneScene))
    }
  } catch (error) {}
}

const SYSTEM_SCENES = [
  {
    sceneId: 'scene_studio_001',
    name: '柔光白底棚拍',
    coverUrl: '/static/scenes/scene-studio-001.jpg',
    sceneType: 'commercial_studio',
    category: '商业棚拍',
    styleTags: ['白底', '柔光', '主图'],
    prompt: '将服装主体置于干净白底商业摄影棚，使用均匀柔光，主体清晰，保留真实材质与自然阴影。'
  },
  {
    sceneId: 'scene_studio_002',
    name: '高级灰影棚',
    coverUrl: '/static/scenes/scene-studio-002.jpg',
    sceneType: 'commercial_studio',
    category: '商业棚拍',
    styleTags: ['灰调', '高级感', '画册'],
    prompt: '将服装主体置于高级灰商业影棚，使用层次柔光和克制阴影，呈现品牌画册质感。'
  },
  {
    sceneId: 'scene_lifestyle_001',
    name: '日光咖啡空间',
    coverUrl: '/static/scenes/scene-lifestyle-001.jpg',
    sceneType: 'lifestyle',
    category: '生活方式',
    styleTags: ['咖啡店', '自然光', '种草'],
    prompt: '将服装主体置于明亮咖啡空间，午后自然光，生活方式构图，适合小红书种草内容。'
  },
  {
    sceneId: 'scene_lifestyle_002',
    name: '简约居家空间',
    coverUrl: '/static/scenes/scene-lifestyle-002.jpg',
    sceneType: 'lifestyle',
    category: '生活方式',
    styleTags: ['家居', '松弛感', '自然'],
    prompt: '将服装主体置于简约现代家居空间，光线自然柔和，氛围松弛，保持商业服装展示清晰度。'
  },
  {
    sceneId: 'scene_street_001',
    name: '都市街角',
    coverUrl: '/static/scenes/scene-street-001.jpg',
    sceneType: 'street',
    category: '街拍',
    styleTags: ['城市', '街拍', '通勤'],
    prompt: '将服装主体置于现代都市街角，真实街拍光线与景深，突出通勤穿搭和自然行走感。'
  },
  {
    sceneId: 'scene_street_002',
    name: '夜景霓虹街区',
    coverUrl: '/static/scenes/scene-street-002.jpg',
    sceneType: 'street',
    category: '街拍',
    styleTags: ['夜景', '潮流', '霓虹'],
    prompt: '将服装主体置于夜景霓虹街区，使用克制彩色环境光，呈现潮流街拍和内容封面质感。'
  },
  {
    sceneId: 'scene_nature_001',
    name: '城市公园草地',
    coverUrl: '/static/scenes/scene-nature-001.jpg',
    sceneType: 'outdoor_nature',
    category: '户外自然',
    styleTags: ['草地', '自然光', '清新'],
    prompt: '将服装主体置于城市公园草地，自然日光，清新空气感，背景层次柔和且主体完整。'
  },
  {
    sceneId: 'scene_nature_002',
    name: '海边度假',
    coverUrl: '/static/scenes/scene-nature-002.jpg',
    sceneType: 'outdoor_nature',
    category: '户外自然',
    styleTags: ['海边', '度假', '轻盈'],
    prompt: '将服装主体置于明亮海边度假环境，柔和海风与自然光，突出轻盈面料和度假氛围。'
  },
  {
    sceneId: 'scene_hotel_001',
    name: '轻奢酒店大堂',
    coverUrl: '/static/scenes/scene-hotel-001.jpg',
    sceneType: 'hotel_space',
    category: '酒店空间',
    styleTags: ['轻奢', '大堂', '高级感'],
    prompt: '将服装主体置于轻奢酒店大堂，暖色环境光和简洁空间线条，呈现高级品牌商业质感。'
  },
  {
    sceneId: 'scene_hotel_002',
    name: '度假酒店露台',
    coverUrl: '/static/scenes/scene-hotel-002.jpg',
    sceneType: 'hotel_space',
    category: '酒店空间',
    styleTags: ['露台', '度假', '自然光'],
    prompt: '将服装主体置于度假酒店露台，自然日光与开阔空间，适合轻奢度假系列展示。'
  },
  {
    sceneId: 'scene_sport_001',
    name: '专业运动场馆',
    coverUrl: '/static/scenes/scene-sport-001.jpg',
    sceneType: 'sports',
    category: '运动场景',
    styleTags: ['场馆', '动感', '运动'],
    prompt: '将服装主体置于专业运动场馆，清晰动感光线，突出运动服装结构、功能面料和活力。'
  },
  {
    sceneId: 'scene_sport_002',
    name: '城市跑道',
    coverUrl: '/static/scenes/scene-sport-002.jpg',
    sceneType: 'sports',
    category: '运动场景',
    styleTags: ['跑步', '户外', '速度感'],
    prompt: '将服装主体置于现代城市跑道，晨间自然光，带轻微速度感，适合运动新品上新图。'
  },
  {
    sceneId: 'scene_festival_001',
    name: '新年红金陈列',
    coverUrl: '/static/scenes/scene-festival-001.jpg',
    sceneType: 'festival_marketing',
    category: '节日营销',
    styleTags: ['新年', '红金', '活动'],
    prompt: '将服装主体置于克制的新年红金陈列场景，保留高级留白，适合节日活动主图和营销素材。'
  },
  {
    sceneId: 'scene_festival_002',
    name: '春日上新橱窗',
    coverUrl: '/static/scenes/scene-festival-002.jpg',
    sceneType: 'festival_marketing',
    category: '节日营销',
    styleTags: ['春日', '上新', '橱窗'],
    prompt: '将服装主体置于清新春日上新橱窗，柔和色彩与自然花材点缀，适合新品营销视觉。'
  }
].map((scene) => cloneScene({
  ...scene,
  isCustom: false,
  createdAt: '2026-07-19T00:00:00.000Z'
}))

export const SCENE_CATEGORIES = Object.freeze([
  '全部',
  '商业棚拍',
  '生活方式',
  '街拍',
  '户外自然',
  '酒店空间',
  '运动场景',
  '节日营销'
])

export function getSystemScenes() {
  return SYSTEM_SCENES.map(cloneScene)
}

export function getMyScenes() {
  return readCustomScenes()
}

export function getSceneById(sceneId) {
  const normalizedId = String(sceneId || '').trim()
  if (!normalizedId) return null
  return [...getSystemScenes(), ...getMyScenes()].find((scene) => scene.sceneId === normalizedId) || null
}

export function createCustomScene(scene = {}) {
  const name = String(scene.name || '').trim() || '我的参考场景'
  const sceneType = String(scene.sceneType || '').trim() || 'custom_scene'
  const styleTags = normalizeTags(scene.styleTags)
  const nextScene = cloneScene({
    ...scene,
    sceneId: scene.sceneId || `custom_scene_${Date.now()}`,
    name,
    sceneType,
    styleTags,
    prompt: scene.prompt || `将服装主体自然融入${name}，保持服装版型、材质和主体清晰，参考场景光线与空间氛围，呈现商业摄影质感。`,
    isCustom: true,
    createdAt: scene.createdAt || nowIso()
  })
  const scenes = getMyScenes()
  writeCustomScenes([nextScene, ...scenes.filter((item) => item.sceneId !== nextScene.sceneId)])
  return nextScene
}
