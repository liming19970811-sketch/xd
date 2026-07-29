export const ADVANCED_PANEL_TYPES = Object.freeze({
  MODEL_AND_BODY: 'model_and_body',
  STYLE_SCENE: 'style_scene',
  PLATFORM_OUTPUT: 'platform_output',
  PATTERN_ADJUSTMENT: 'pattern_adjustment',
  FABRIC_TEXTURE: 'fabric_texture',
  PRINT_DESIGN: 'print_design',
  PRINT_PLACEMENT: 'print_placement',
  COLOR_BATCH: 'color_batch',
  DETAIL_PAGE: 'detail_page',
  CLOSEUP_DETAIL: 'closeup_detail',
  LONG_IMAGE_LAYOUT: 'long_image_layout',
  RUNWAY_VIDEO: 'runway_video',
  SKETCH_GENERATION: 'sketch_generation',
  SKETCH_TO_MODEL: 'sketch_to_model',
  IMAGE_TO_SKETCH: 'image_to_sketch',
  TECH_PACK: 'tech_pack'
})

const option = (value, label) => Object.freeze({ value, label })
const field = (key, label, type, options = [], defaultValue = '', placeholder = '') => Object.freeze({
  key,
  label,
  type,
  options: Object.freeze(options),
  defaultValue,
  placeholder
})

const CUSTOM_PROMPT_PLACEHOLDERS = Object.freeze({
  fabric_texture: '例如：重磅水洗牛仔、轻微做旧、保留原版褶皱和版型',
  print_design: '例如：复古植物花卉、低饱和莫兰迪色、适合春夏连衣裙',
  print_placement: '例如：印花放前胸偏上，尺寸不要太大，边缘自然贴合衣身',
  runway_video: '例如：自然走秀、轻微转身、衣摆随动作自然摆动',
  image_to_sketch: '例如：重点标注领口、袖口、省道、口袋和开衩结构',
  tech_pack: '例如：补充车线、拉链、纽扣、辅料和面料注意事项，仅作参考工艺说明',
  pattern_adjustment: '例如：圆领改V领、长袖改短袖、衣长缩短、腰线略收',
  sketch_generation: '例如：法式通勤连衣裙，收腰，中长款，适合春夏上新',
  sketch_to_model: '例如：尽量保留原线稿结构，面料偏真丝，有自然垂坠感',
  style_scene: '例如：小红书氛围感，午后自然光，咖啡厅外景'
})

const getCustomPromptPlaceholder = (panelKey) => CUSTOM_PROMPT_PLACEHOLDERS[panelKey] || '可补充更具体的风格、材质、细节或限制要求'

const panel = (panelKey, title, description, fields) => Object.freeze({
  panelKey,
  title,
  description,
  fields: Object.freeze([
    ...fields,
    field('customPrompt', '补充需求', 'textarea', [], '', getCustomPromptPlaceholder(panelKey))
  ])
})

export const ADVANCED_PANEL_PRESETS = Object.freeze({
  model_and_body: panel('model_and_body', '模特与身材', '选择模特、人群、身材和姿势方向。', [
    field('modelType', '模特类型', 'select', [
      option('female', '女模特'),
      option('male', '男模特'),
      option('kids', '儿童'),
      option('plus_size', '大码'),
      option('middle_aged', '中老年')
    ], 'female'),
    field('bodyType', '身材类型', 'select', [
      option('standard', '标准'),
      option('slightly_plump', '微胖'),
      option('pear', '梨形'),
      option('apple', '苹果型'),
      option('hourglass', '沙漏型')
    ], 'standard'),
    field('poseType', '姿势', 'select', [
      option('standing', '站姿'),
      option('sitting', '坐姿'),
      option('half_body', '半身'),
      option('full_body', '全身')
    ], 'standing')
  ]),
  style_scene: panel('style_scene', '风格与场景', '控制视觉风格、拍摄场景和光影方向。', [
    field('styleCode', '风格', 'select', [
      option('simple_commute', '简约通勤'),
      option('korean_casual', '韩系休闲'),
      option('french_soft', '法式温柔'),
      option('american_street', '美式街头'),
      option('sweet_cool', '纯欲甜妹'),
      option('minimal_white_studio', '极简白棚')
    ], 'simple_commute'),
    field('sceneCode', '场景', 'select', [
      option('white_studio', '纯白棚拍'),
      option('home_window', '居家窗边'),
      option('city_street', '城市街道'),
      option('grass_outdoor', '草坪外景'),
      option('cafe_lifestyle', '咖店休闲')
    ], 'white_studio'),
    field('lightType', '光影', 'select', [
      option('natural', '自然光'),
      option('studio_flat', '棚拍平光'),
      option('warm', '暖光'),
      option('cool', '冷调')
    ], 'natural')
  ]),
  platform_output: panel('platform_output', '平台与输出', '选择平台规格、比例和输出类型。', [
    field('platform', '平台', 'select', [
      option('taobao', '淘宝'),
      option('douyin', '抖音'),
      option('xiaohongshu', '小红书'),
      option('amazon', '亚马逊'),
      option('independent_site', '独立站')
    ], 'taobao'),
    field('ratio', '比例', 'select', [
      option('1:1', '1:1'),
      option('3:4', '3:4'),
      option('4:5', '4:5'),
      option('9:16', '9:16')
    ], '1:1'),
    field('outputType', '输出类型', 'select', [
      option('white_main', '白底主图'),
      option('scene_image', '场景图'),
      option('transparent', '透明图'),
      option('detail_image', '详情图')
    ], 'white_main')
  ]),
  pattern_adjustment: panel('pattern_adjustment', '版型改款', '调整领口、袖型、版型、衣长等辅助改款方向。', [
    field('neckType', '领口', 'select', [
      option('round', '圆领'),
      option('v', 'V领'),
      option('square', '方领'),
      option('lapel', '翻领'),
      option('off_shoulder', '一字肩'),
      option('camisole', '吊带')
    ], 'round'),
    field('sleeveType', '袖型', 'select', [
      option('short', '短袖'),
      option('long', '长袖'),
      option('sleeveless', '无袖'),
      option('puff', '泡泡袖'),
      option('drop_shoulder', '落肩袖'),
      option('five_point', '五分袖')
    ], 'long'),
    field('fitType', '版型', 'select', [
      option('slim', '修身'),
      option('standard', '标准'),
      option('loose', '宽松'),
      option('oversize', 'oversize'),
      option('cropped', '短款'),
      option('waist_fitted', '收腰款')
    ], 'standard'),
    field('lengthType', '衣长', 'select', [
      option('short', '短款'),
      option('regular', '常规'),
      option('mid_long', '中长'),
      option('long', '长款')
    ], 'regular'),
    field('pocketEnabled', '是否加口袋', 'switch', [], false)
  ]),
  fabric_texture: panel('fabric_texture', '面料与质感', '控制面料、颜色、质感强度和替换范围。', [
    field('fabricType', '面料', 'select', [
      option('cotton_linen', '棉麻'),
      option('denim', '牛仔'),
      option('chiffon', '雪纺'),
      option('knit', '针织'),
      option('suiting', '西装料'),
      option('suede', '麂皮'),
      option('silk', '真丝')
    ], 'cotton_linen'),
    field('fabricColor', '面料颜色', 'select', [
      option('keep_original', '保留原色'),
      option('black_white_gray', '黑白灰'),
      option('morandi', '莫兰迪'),
      option('spring_summer', '春夏亮色')
    ], 'keep_original'),
    field('textureStrength', '质感强度', 'select', [
      option('light', '轻微'),
      option('standard', '标准'),
      option('strong', '强')
    ], 'standard'),
    field('replaceScope', '替换范围', 'select', [
      option('whole_garment', '整衣'),
      option('partial', '局部')
    ], 'whole_garment')
  ]),
  print_design: panel('print_design', '印花生成', '配置印花主题、风格、颜色数量和复杂度。', [
    field('printTheme', '印花主题', 'select', [
      option('floral', '花卉'),
      option('geometry', '几何'),
      option('animal', '动物'),
      option('letter', '字母'),
      option('chinese_style', '国风'),
      option('abstract', '抽象')
    ], 'floral'),
    field('printStyle', '印花风格', 'select', [
      option('minimal', '简约'),
      option('trend', '潮流'),
      option('retro', '复古'),
      option('sweet_cool', '甜酷'),
      option('childlike', '童趣')
    ], 'minimal'),
    field('colorCount', '颜色数量', 'select', [
      option('1', '1色'),
      option('2', '2色'),
      option('3', '3色'),
      option('multi', '多色')
    ], '2'),
    field('complexity', '复杂度', 'select', [
      option('simple', '简单'),
      option('standard', '标准'),
      option('complex', '复杂')
    ], 'standard')
  ]),
  print_placement: panel('print_placement', '衣身贴图', '设置印花贴图位置、大小、旋转和透明度。', [
    field('placementArea', '位置', 'select', [
      option('front_chest', '前胸'),
      option('back', '后背'),
      option('sleeve', '袖子'),
      option('hem', '下摆'),
      option('all_over', '满印')
    ], 'front_chest'),
    field('scale', '缩放', 'select', [
      option('small', '小'),
      option('medium', '中'),
      option('large', '大')
    ], 'medium'),
    field('rotation', '旋转', 'select', [
      option('none', '不旋转'),
      option('slight', '轻微'),
      option('free', '自由')
    ], 'none'),
    field('opacity', '透明度', 'select', [
      option('low', '低'),
      option('medium', '中'),
      option('high', '高')
    ], 'high')
  ]),
  color_batch: panel('color_batch', '批量配色', '配置批量生成的色系、数量和面料保留策略。', [
    field('colorGroup', '色系', 'select', [
      option('black_white_gray', '黑白灰'),
      option('morandi', '莫兰迪'),
      option('spring_summer', '春夏亮色'),
      option('retro', '复古色'),
      option('sweet_cool', '甜酷色')
    ], 'morandi'),
    field('colorCount', '生成数量', 'select', [
      option('3', '3'),
      option('5', '5'),
      option('8', '8')
    ], '3'),
    field('keepFabric', '保留面料质感', 'switch', [], true)
  ]),
  detail_page: panel('detail_page', '详情页素材', '配置详情页结构、版式和卖点文案。', [
    field('detailSections', '结构', 'select', [
      option('main_scene_detail_copy_size', '主图/场景图/细节图/卖点文案/尺码说明'),
      option('main_scene_detail', '主图/场景图/细节图'),
      option('main_copy_size', '主图/卖点文案/尺码说明')
    ], 'main_scene_detail_copy_size'),
    field('layoutStyle', '版式', 'select', [
      option('minimal', '简约'),
      option('xiaohongshu', '小红书'),
      option('commerce_long', '电商长图'),
      option('brand', '品牌感')
    ], 'minimal'),
    field('copyEnabled', '是否生成卖点文案', 'switch', [], true)
  ]),
  closeup_detail: panel('closeup_detail', '局部细节', '选择细节位置和增强强度。', [
    field('detailType', '细节位置', 'select', [
      option('neckline', '领口'),
      option('cuff', '袖口'),
      option('fabric', '面料纹理'),
      option('button_zipper', '纽扣拉链'),
      option('print_detail', '印花细节')
    ], 'fabric'),
    field('enhanceLevel', '增强强度', 'select', [
      option('standard', '标准'),
      option('hd', '高清'),
      option('ultra_hd', '超清')
    ], 'hd')
  ]),
  long_image_layout: panel('long_image_layout', '长图排版', '配置详情长图版式、平台和文案。', [
    field('layoutStyle', '版式', 'select', [
      option('vertical_long', '纵向详情长图')
    ], 'vertical_long'),
    field('platform', '平台', 'select', [
      option('taobao', '淘宝'),
      option('douyin', '抖音'),
      option('xiaohongshu', '小红书'),
      option('independent_site', '独立站')
    ], 'taobao'),
    field('includeCopy', '是否包含文案', 'switch', [], true)
  ]),
  runway_video: panel('runway_video', '走秀视频', '配置走秀视频时长、动作、镜头和背景。', [
    field('durationSec', '时长', 'select', [
      option('3', '3秒'),
      option('5', '5秒'),
      option('10', '10秒')
    ], '3'),
    field('motionType', '动作', 'select', [
      option('natural_walk', '自然走秀'),
      option('turnaround', '转身'),
      option('pose', '摆拍'),
      option('slow_motion', '慢动作')
    ], 'natural_walk'),
    field('cameraType', '镜头', 'select', [
      option('fixed', '固定镜头'),
      option('follow', '跟拍'),
      option('half_body', '半身'),
      option('full_body', '全身')
    ], 'full_body'),
    field('backgroundType', '背景', 'select', [
      option('white_studio', '白棚'),
      option('runway', 'T台'),
      option('street', '街拍'),
      option('minimal_space', '简约空间')
    ], 'white_studio')
  ]),
  sketch_generation: panel('sketch_generation', '款式起稿', '配置品类、人群、季节和草图风格。', [
    field('category', '品类', 'select', [
      option('dress', '连衣裙'),
      option('top', '上衣'),
      option('pants', '裤装'),
      option('coat', '外套'),
      option('suit', '套装')
    ], 'dress'),
    field('targetUser', '人群', 'select', [
      option('girl', '少女'),
      option('commute', '通勤'),
      option('plus_size', '大码'),
      option('middle_aged', '中老年'),
      option('kids', '童装')
    ], 'commute'),
    field('season', '季节', 'select', [
      option('spring_summer', '春夏'),
      option('autumn_winter', '秋冬'),
      option('all_season', '四季')
    ], 'spring_summer'),
    field('sketchStyle', '草图风格', 'select', [
      option('line_art', '线稿'),
      option('color_sketch', '彩稿'),
      option('hand_drawn', '手绘感')
    ], 'line_art')
  ]),
  sketch_to_model: panel('sketch_to_model', '设计稿成衣', '控制设计稿结构保留、面料、模特和写实程度。', [
    field('keepSketchStructure', '保留结构', 'switch', [], true),
    field('fabricType', '面料', 'select', [
      option('cotton_linen', '棉麻'),
      option('denim', '牛仔'),
      option('chiffon', '雪纺'),
      option('knit', '针织'),
      option('suiting', '西装料')
    ], 'cotton_linen'),
    field('modelType', '模特', 'select', [
      option('female', '女模特'),
      option('male', '男模特'),
      option('kids', '儿童')
    ], 'female'),
    field('realismLevel', '写实程度', 'select', [
      option('reference', '参考图'),
      option('realistic', '写实'),
      option('commerce_main', '电商主图')
    ], 'reference')
  ]),
  image_to_sketch: panel('image_to_sketch', '结构线稿', '配置线稿精度、结构标注和参考工艺说明。', [
    field('sketchLevel', '线稿精度', 'select', [
      option('simple', '简易'),
      option('standard', '标准'),
      option('fine', '精细')
    ], 'standard'),
    field('includeLabels', '是否标注结构', 'switch', [], true),
    field('includeCraftNotes', '是否生成参考工艺说明', 'switch', [], true)
  ]),
  tech_pack: panel('tech_pack', '参考工艺结构', '生成参考工艺结构说明，需设计师/制版师修正后用于生产沟通。', [
    field('includeStitching', '车线', 'switch', [], true),
    field('includeDarts', '省道', 'switch', [], true),
    field('includeAccessories', '辅料', 'switch', [], true),
    field('includeFabricNote', '面料说明', 'switch', [], true),
    field('warningText', '固定文案', 'text', [], '仅供参考，需设计师/制版师修正后用于生产沟通')
  ])
})

const DEFAULT_PANEL_KEYS = Object.freeze([
  'model_and_body',
  'style_scene',
  'platform_output'
])

export const ENTRY_SCENE_ADVANCED_PANEL_MAP = Object.freeze({
  ecommerce_main: Object.freeze(['model_and_body', 'style_scene', 'platform_output']),
  xiaohongshu_seed: Object.freeze(['model_and_body', 'style_scene', 'platform_output']),
  cross_border_white: Object.freeze(['model_and_body', 'platform_output']),
  new_arrival: Object.freeze(['style_scene', 'platform_output', 'color_batch']),
  batch_model: Object.freeze(['model_and_body', 'style_scene', 'platform_output']),
  hot_style_remix: Object.freeze(['pattern_adjustment', 'style_scene', 'fabric_texture']),
  text_to_sketch: Object.freeze(['sketch_generation', 'pattern_adjustment']),
  sketch_to_model: Object.freeze(['sketch_to_model', 'fabric_texture', 'model_and_body', 'style_scene']),
  image_to_sketch: Object.freeze(['image_to_sketch', 'tech_pack']),
  sketch_remix: Object.freeze(['pattern_adjustment', 'sketch_to_model', 'fabric_texture']),
  sketch_to_tech_pack: Object.freeze(['image_to_sketch', 'tech_pack']),
  print_generate: Object.freeze(['print_design']),
  print_placement: Object.freeze(['print_design', 'print_placement']),
  fabric_replace: Object.freeze(['fabric_texture']),
  color_batch: Object.freeze(['color_batch', 'fabric_texture']),
  detail_page_from_photo: Object.freeze(['detail_page', 'closeup_detail', 'long_image_layout']),
  detail_closeup: Object.freeze(['closeup_detail']),
  detail_long_image: Object.freeze(['long_image_layout', 'detail_page']),
  runway_video: Object.freeze(['runway_video', 'style_scene'])
})

export function getAdvancedPanelKeysForEntryScene(entryScene = '') {
  return ENTRY_SCENE_ADVANCED_PANEL_MAP[entryScene] || DEFAULT_PANEL_KEYS
}

export function getAdvancedPanelsForEntryScene(entryScene = '') {
  return getAdvancedPanelKeysForEntryScene(entryScene)
    .map((panelKey) => ADVANCED_PANEL_PRESETS[panelKey])
    .filter(Boolean)
}

export function getDefaultAdvancedPanelValuesForEntryScene(entryScene = '') {
  return getAdvancedPanelsForEntryScene(entryScene).reduce((values, panelConfig) => {
    const panelValues = {}
    panelConfig.fields.forEach((item) => {
      panelValues[item.key] = item.defaultValue
    })
    return {
      ...values,
      [panelConfig.panelKey]: panelValues
    }
  }, {})
}
