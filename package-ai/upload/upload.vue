<template>
  <view class="container">
    <view class="top-bar">
      <view class="left-info">
        <text v-if="!isVip && quotaLoaded">剩余次数：{{ leftCount }} 次</text>
        <text v-else-if="isVip" class="vip-text">会员无限生成</text>
        <text v-else class="quota-placeholder">额度同步中</text>
      </view>
      <view class="right-btns">
        <button class="btn-history" @click="goToTaskList">任务</button>
        <button class="btn-share" @click="openShareModal">邀请</button>
        <button class="btn-vip" @click="openPayModal" :class="{ hot: !isVip }">
          {{ isVip ? '会员' : '会员' }}
        </button>
      </view>
    </view>

    <view v-if="showStyleAdvanced && currentStepValue > 1" class="step-nav">
      <text class="step" :class="{ active: currentStepValue >= 1 }">1. 服装图</text>
      <text class="arrow">></text>
      <text class="step" :class="{ active: currentStepValue >= 2 }">2. 参考图</text>
      <text class="arrow">></text>
      <text class="step" :class="{ active: currentStepValue >= 3 }">3. 模特类型</text>
      <text class="arrow">></text>
      <text class="step" :class="{ active: currentStepValue >= 4 }">4. 风格场景</text>
      <text class="arrow">></text>
      <text class="step" :class="{ active: currentStepValue >= 5 }">5. 版型细节</text>
      <text class="arrow">></text>
      <text class="step" :class="{ active: currentStepValue >= 6 }">6. 输出设置</text>
    </view>

    <view class="step-page" :class="{ 'sketch-step-page': isImageToSketchEntry, 'style-sketch-step-page': isTextToSketchEntry || isSketchRemixEntry, 'batch-model-step-page': isBatchModelEntry }" v-show="currentStepValue === 1">
      <template v-if="isImageToSketchEntry">
        <AiFeatureHeader
          title="图片转结构线稿"
          description="上传服装图片，提取版型结构、缝线与工艺细节，生成可继续设计的参考线稿。"
        />

        <view v-if="sketchDraftDetected" class="sketch-draft-banner">
          <view><text class="sketch-draft-title">检测到未完成的结构线稿配置</text><text class="sketch-draft-desc">可继续使用已保存的稳定图片和设置。</text></view>
          <view class="sketch-draft-actions"><text @click="continueSketchDraft">继续编辑</text><text class="danger-text" @click="restartSketchDraft">重新开始</text></view>
        </view>

        <view class="sketch-card sketch-upload-card">
          <view class="sketch-section-head">
            <view><text class="sketch-section-title">1. 上传服装图片</text><text class="sketch-section-desc">建议上传正面、主体完整、清晰无遮挡的服装图片。</text></view>
            <text class="required-badge">必填</text>
          </view>
          <view v-if="!clothImageValue.localPath && !hasRemoteClothImage" class="sketch-upload-box" @click="handleChooseClothImage">
            <text class="sketch-upload-icon">+</text>
            <text class="sketch-upload-title">上传服装图片</text>
            <text class="sketch-upload-desc">支持平铺图、人台图或真人展示图</text>
          </view>
          <view v-else class="sketch-image-preview">
            <image :src="clothImageValue.localPath || getAssetFileUrl(clothImageValue)" mode="aspectFit"></image>
            <view class="sketch-preview-actions"><button size="mini" :disabled="clothUploadingValue || isGeneratingValue" @click.stop="handleChooseClothImage">更换</button><button size="mini" class="danger" :disabled="clothUploadingValue || isGeneratingValue" @click.stop="resetSketchImage">删除</button></view>
            <view class="sketch-file-meta">
              <text v-if="sketchImageMeta.format">{{ sketchImageMeta.format }}</text>
              <text v-if="sketchImageMeta.width && sketchImageMeta.height">{{ sketchImageMeta.width }} × {{ sketchImageMeta.height }}</text>
              <text v-if="sketchImageMeta.sizeText">{{ sketchImageMeta.sizeText }}</text>
              <text>{{ clothUploadingValue ? '正在上传并检查图片…' : hasRemoteClothImage ? '图片已上传，可继续生成' : '正在准备稳定图片…' }}</text>
            </view>
            <text v-if="clothUploadErrorValue" class="sketch-error-text">{{ clothUploadErrorValue }}</text>
            <button v-if="clothRetryableValue" class="sketch-retry-btn" size="mini" :disabled="clothUploadingValue" @click="retryClothUpload">重新上传</button>
          </view>
          <view v-if="!clothImageValue.localPath && !hasRemoteClothImage" class="sketch-upload-pending-tip">上传后将检查图片格式、大小与尺寸，并提取线稿所需结构信息。</view>
        </view>

        <view v-if="hasSketchImage" class="sketch-card">
          <view class="sketch-section-head"><view><text class="sketch-section-title">2. 选择生成方式</text><text class="sketch-section-desc">选择速度与细节保留程度。</text></view><text class="sketch-current">当前：{{ generationModeLabel }}</text></view>
          <view class="sketch-mode-grid">
            <view v-for="mode in sketchGenerationModeOptions" :key="mode.value" :class="['sketch-mode-item', { active: generationMode === mode.value }]" @click="setGenerationMode(mode.value)">
              <text class="sketch-check">{{ generationMode === mode.value ? '✓' : '' }}</text><text class="sketch-mode-name">{{ mode.label }}</text><text class="sketch-mode-desc">{{ mode.desc }}</text>
            </view>
          </view>
          <text v-if="generationMode === 'creative'" class="sketch-warning">创意模式可能调整部分结构细节，请生成后核对。</text>
        </view>

        <view v-if="hasSketchImage" class="sketch-card">
          <view class="sketch-section-head"><view><text class="sketch-section-title">推荐设置</text><text class="sketch-section-desc">根据当前模式生成线稿参数建议，不会创建任务或消耗额度。</text></view><text :class="['sketch-recommend-status', sketchRecommendationState]">{{ sketchRecommendationLabel }}</text></view>
          <view class="sketch-inline-actions"><button class="sketch-secondary-btn" :disabled="sketchRecommendationState === 'loading'" @click="generateSketchRecommendation">{{ sketchRecommendationState === 'loading' ? '正在生成推荐设置…' : '生成推荐设置' }}</button><button v-if="sketchRecommendationState === 'ready'" class="sketch-secondary-btn accent" @click="applySketchRecommendation">应用推荐设置</button></view>
          <text v-if="sketchRecommendationState === 'ready'" class="sketch-recommend-summary">推荐：{{ sketchRecommendationSummary }}</text>
          <text v-if="sketchRecommendationState === 'failed'" class="sketch-error-text">推荐设置生成失败，可继续使用手动设置。</text>
        </view>

        <view v-if="hasSketchImage" class="sketch-card">
          <view class="sketch-section-head"><view><text class="sketch-section-title">3. 确认结构线稿设置</text><text class="sketch-section-desc">手动设置优先，不会被推荐设置自动覆盖。</text></view></view>
          <view v-if="generationMode === 'quick'" class="sketch-quick-note">快速模式使用当前推荐设置直接生成；切换到标准或创意可调整细节。</view>
          <view v-else class="sketch-basic-settings">
            <view v-for="field in sketchBasicFields" :key="field.key" class="sketch-setting-group">
              <text class="sketch-setting-label">{{ sketchFieldTitle(field) }}</text>
              <view class="sketch-option-row">
                <view v-for="option in sketchFieldOptions(field)" :key="String(option.value)" :class="['sketch-option', { active: getAdvancedFieldValue('image_to_sketch', field) === option.value }]" @click="updateAdvancedFieldValue('image_to_sketch', field, option.value)">
                  <text class="sketch-option-check">{{ getAdvancedFieldValue('image_to_sketch', field) === option.value ? '✓' : '' }}</text><text>{{ option.label }}</text><text v-if="option.desc" class="sketch-option-desc">{{ option.desc }}</text>
                </view>
              </view>
            </view>
          </view>

          <view class="sketch-advanced-block">
            <view class="sketch-collapsible-head" @click="sketchAdvancedExpanded = !sketchAdvancedExpanded"><view><text class="sketch-collapsible-title">高级设置</text><text class="sketch-collapsible-summary">{{ sketchSettingsSummary }}</text></view><text>{{ sketchAdvancedExpanded ? '收起' : '展开设置' }}</text></view>
            <view v-if="sketchAdvancedExpanded" class="sketch-advanced-content">
              <view v-for="field in sketchTechFields" :key="field.key" class="sketch-setting-group compact">
                <text class="sketch-setting-label">{{ field.label }}</text>
                <view class="sketch-option-row"><view v-for="option in sketchFieldOptions(field)" :key="String(option.value)" :class="['sketch-option small', { active: getAdvancedFieldValue('tech_pack', field) === option.value }]" @click="updateAdvancedFieldValue('tech_pack', field, option.value)"><text>{{ getAdvancedFieldValue('tech_pack', field) === option.value ? '✓ ' : '' }}{{ option.label }}</text></view></view>
              </view>
            </view>
          </view>

          <view class="sketch-prompt-block"><view class="sketch-prompt-head"><text class="sketch-setting-label">补充要求（可选）</text><text>{{ sketchCustomPrompt.length }}/200</text></view><textarea class="sketch-custom-prompt" :value="sketchCustomPrompt" maxlength="200" placeholder="例如：重点标注领口、袖口、门襟和口袋结构，保留原版型比例。" @focus="sketchKeyboardOpen = true" @blur="sketchKeyboardOpen = false" @input="updateSketchCustomPrompt($event.detail.value)"></textarea><text class="sketch-prompt-tip">建议描述需要重点呈现的结构部位，不建议输入服装颜色、背景或模特信息。</text></view>
        </view>

        <view v-if="hasSketchImage" class="sketch-card sketch-check-card">
          <text class="sketch-section-title">图片检查</text>
          <view v-if="clothUploadingValue" class="sketch-check-state">正在上传并检查图片…</view>
          <view v-else-if="hasRemoteClothImage" class="sketch-check-list"><view><text>上传状态</text><text class="success-text">稳定图片已准备</text></view><view v-if="sketchImageMeta.format"><text>图片格式</text><text>{{ sketchImageMeta.format }}</text></view><view v-if="sketchImageMeta.width"><text>图片尺寸</text><text>{{ sketchImageMeta.width }} × {{ sketchImageMeta.height }}</text></view><text class="sketch-check-note">当前仅校验格式、大小和尺寸，不伪造服装主体、遮挡或背景识别结果。</text></view>
          <view v-else class="sketch-check-state">图片已选择，正在准备稳定地址。</view>
        </view>

        <view class="sketch-guide-card">
          <view class="sketch-collapsible-head" @click="showUploadGuide = !showUploadGuide"><view><text class="sketch-collapsible-title">怎样上传效果更好？</text><text class="sketch-collapsible-summary">推荐正面、清晰、主体完整且无遮挡的服装图片。</text></view><text>{{ showUploadGuide ? '收起' : '展开' }}</text></view>
          <view v-if="showUploadGuide" class="sketch-guide-list"><text>优先上传正面服装图</text><text>保证服装主体完整</text><text>尽量避免手臂、包袋等遮挡</text><text>避免强反光、严重褶皱和低清晰度</text></view>
        </view>

        <view v-if="hasSketchImage" class="sketch-submit-spacer"><text>{{ sketchSubmitSummary }}</text></view>
        <GenerationActionBar
          :summary="sketchSubmitSummary"
          :reason="sketchGenerateDisabledReason"
          :button-text="sketchSubmitButtonText"
          loading-text="正在创建任务…"
          :disabled="!canSubmitSketch"
          :loading="isGeneratingValue || sketchSubmissionState === 'creating'"
          :keyboard-visible="sketchKeyboardOpen"
          @generate="submitSketchGenerate"
        />
      </template>

      <template v-else-if="isTextToSketchEntry">
        <AiFeatureHeader
          title="AI款式起稿"
          description="上传服装图片，调整领口、袖型、版型和衣长，快速生成新款设计草图。"
        />

        <view v-if="styleSketchDraftDetected" class="style-sketch-draft-banner">
          <view>
            <text class="style-sketch-draft-title">检测到未完成的款式配置</text>
            <text class="style-sketch-draft-desc">可继续使用已上传图片和上次设置。</text>
          </view>
          <view class="style-sketch-draft-actions">
            <text @click="continueStyleSketchDraft">继续编辑</text>
            <text class="danger-text" @click="restartStyleSketchDraft">重新开始</text>
          </view>
        </view>

        <view class="style-sketch-card">
          <view class="style-sketch-section-head">
            <view>
              <text class="style-sketch-section-title">1. 上传服装图片</text>
              <text class="style-sketch-section-desc">建议上传正面、主体完整、清晰无遮挡的服装图片。</text>
            </view>
            <text class="required-badge">必填</text>
          </view>
          <view v-if="!clothImageValue.localPath && !hasRemoteClothImage" class="style-sketch-upload-box" @click="handleChooseClothImage">
            <text class="style-sketch-upload-icon">+</text>
            <text class="style-sketch-upload-title">上传服装正面图</text>
            <text class="style-sketch-upload-desc">支持平铺图、人台图或真人展示图</text>
          </view>
          <view v-else class="style-sketch-image-preview">
            <image :src="clothImageValue.localPath || getAssetFileUrl(clothImageValue)" mode="aspectFit"></image>
            <view class="style-sketch-preview-actions">
              <button size="mini" :disabled="clothUploadingValue || isGeneratingValue" @click.stop="handleChooseClothImage">更换</button>
              <button size="mini" class="danger" :disabled="clothUploadingValue || isGeneratingValue" @click.stop="resetStyleSketchImage">删除</button>
            </view>
            <view class="style-sketch-file-meta">
              <text v-if="styleSketchImageMeta.format">{{ styleSketchImageMeta.format }}</text>
              <text v-if="styleSketchImageMeta.width && styleSketchImageMeta.height">{{ styleSketchImageMeta.width }} × {{ styleSketchImageMeta.height }}</text>
              <text v-if="styleSketchImageMeta.sizeText">{{ styleSketchImageMeta.sizeText }}</text>
              <text>{{ clothUploadingValue ? '图片上传中…' : hasRemoteClothImage ? '图片已上传，可继续配置款式' : '正在准备稳定图片…' }}</text>
            </view>
            <text v-if="clothUploadErrorValue" class="style-sketch-error-text">{{ clothUploadErrorValue }}</text>
            <button v-if="clothRetryableValue" class="style-sketch-retry-btn" size="mini" :disabled="clothUploadingValue" @click="retryClothUpload">重新上传</button>
          </view>
          <text v-if="!hasStyleSketchImage" class="style-sketch-upload-tip">上传后可根据服装主体生成款式调整建议。</text>
        </view>

        <template v-if="hasStyleSketchImage">
          <view class="style-sketch-card">
            <view class="style-sketch-section-head">
              <view>
                <text class="style-sketch-section-title">2. 选择起稿方式</text>
                <text class="style-sketch-section-desc">选择生成速度和款式变化幅度。</text>
              </view>
              <text class="style-sketch-current">当前：{{ generationModeLabel }}</text>
            </view>
            <view class="style-sketch-mode-grid">
              <view v-for="mode in styleSketchGenerationModeOptions" :key="mode.value" :class="['style-sketch-mode-item', { active: generationMode === mode.value }]" @click="setGenerationMode(mode.value)">
                <text class="style-sketch-check">{{ generationMode === mode.value ? '✓' : '' }}</text>
                <text class="style-sketch-mode-name">{{ mode.label }}</text>
                <text class="style-sketch-mode-desc">{{ mode.desc }}</text>
              </view>
            </view>
            <text v-if="generationMode === 'creative'" class="style-sketch-warning">创意模式可能对原服装结构进行更明显调整。</text>
          </view>

          <view class="style-sketch-card">
            <view class="style-sketch-section-head">
              <view>
                <text class="style-sketch-section-title">生成改款建议</text>
                <text class="style-sketch-section-desc">按当前模式整理受支持的款式参数，不创建任务、不消耗额度。</text>
              </view>
              <text :class="['style-sketch-recommend-status', styleSketchRecommendationState]">{{ styleSketchRecommendationLabel }}</text>
            </view>
            <view class="style-sketch-inline-actions">
              <button class="style-sketch-secondary-btn" :disabled="styleSketchRecommendationState === 'loading'" @click="generateStyleSketchRecommendation">{{ styleSketchRecommendationState === 'loading' ? '正在生成改款建议…' : '生成改款建议' }}</button>
              <button v-if="styleSketchRecommendationState === 'ready'" class="style-sketch-secondary-btn accent" @click="applyStyleSketchRecommendation">应用建议</button>
            </view>
            <text v-if="styleSketchRecommendationState === 'ready'" class="style-sketch-recommend-summary">{{ styleSketchRecommendationSummary }}</text>
            <text class="style-sketch-local-note">当前建议由本地规则整理，不代表图片结构已被 AI 识别；AI适配暂未开放。</text>
          </view>

          <view class="style-sketch-card">
            <view class="style-sketch-section-head">
              <view>
                <text class="style-sketch-section-title">3. 调整款式方向</text>
                <text class="style-sketch-section-desc">选择希望调整的服装结构，其他细节尽量保留原款。</text>
              </view>
            </view>
            <view v-for="field in styleSketchPatternFields" :key="field.key" class="style-sketch-setting-group">
              <text class="style-sketch-setting-label">{{ styleSketchFieldTitle(field) }}</text>
              <view class="style-sketch-option-row">
                <view v-for="option in styleSketchFieldOptions(field)" :key="String(option.value)" :class="['style-sketch-option', { active: getAdvancedFieldValue('pattern_adjustment', field) === option.value }]" @click="updateAdvancedFieldValue('pattern_adjustment', field, option.value)">
                  <text class="style-sketch-option-check">{{ getAdvancedFieldValue('pattern_adjustment', field) === option.value ? '✓' : '' }}</text>
                  <text>{{ option.label }}</text>
                </view>
              </view>
            </view>

            <view class="style-sketch-advanced-block">
              <view class="style-sketch-collapsible-head" @click="styleSketchAdvancedExpanded = !styleSketchAdvancedExpanded">
                <view>
                  <text class="style-sketch-collapsible-title">高级设置</text>
                  <text class="style-sketch-collapsible-summary">品类、人群、季节和草图风格</text>
                </view>
                <text>{{ styleSketchAdvancedExpanded ? '收起' : '展开' }}</text>
              </view>
              <view v-if="styleSketchAdvancedExpanded" class="style-sketch-advanced-content">
                <view v-for="field in styleSketchAdvancedFields" :key="field.key" class="style-sketch-setting-group compact">
                  <text class="style-sketch-setting-label">{{ field.label }}</text>
                  <view class="style-sketch-option-row">
                    <view v-for="option in styleSketchFieldOptions(field)" :key="String(option.value)" :class="['style-sketch-option small', { active: getAdvancedFieldValue('sketch_generation', field) === option.value }]" @click="updateAdvancedFieldValue('sketch_generation', field, option.value)">
                      <text class="style-sketch-option-check">{{ getAdvancedFieldValue('sketch_generation', field) === option.value ? '✓' : '' }}</text>
                      <text>{{ option.label }}</text>
                    </view>
                  </view>
                </view>
              </view>
            </view>

            <view class="style-sketch-prompt-block">
              <view class="style-sketch-prompt-head">
                <text class="style-sketch-setting-label">补充要求（可选）</text>
                <text>{{ styleSketchCustomPrompt.length }}/200</text>
              </view>
              <textarea class="style-sketch-custom-prompt" :value="styleSketchCustomPrompt" maxlength="200" placeholder="例如：保留原版型，将圆领改为V领，袖型改成长袖，腰线略微收紧。" @focus="styleSketchKeyboardOpen = true" @blur="styleSketchKeyboardOpen = false" @input="updateStyleSketchCustomPrompt($event.detail.value)"></textarea>
              <text class="style-sketch-prompt-tip">建议描述材质、风格和需要重点调整的结构，不建议重复填写已选参数。</text>
            </view>
          </view>

          <view class="style-sketch-card style-sketch-check-card">
            <text class="style-sketch-section-title">图片检查</text>
            <view v-if="clothUploadingValue" class="style-sketch-check-state">正在上传并检查图片…</view>
            <view v-else-if="hasRemoteClothImage" class="style-sketch-check-list">
              <view><text>上传状态</text><text class="success-text">稳定图片已准备</text></view>
              <view v-if="styleSketchImageMeta.format"><text>图片格式</text><text>{{ styleSketchImageMeta.format }}</text></view>
              <view v-if="styleSketchImageMeta.width"><text>图片尺寸</text><text>{{ styleSketchImageMeta.width }} × {{ styleSketchImageMeta.height }}</text></view>
              <view v-if="styleSketchImageMeta.sizeText"><text>文件大小</text><text>{{ styleSketchImageMeta.sizeText }}</text></view>
              <text class="style-sketch-check-note">当前仅校验格式、大小、尺寸和上传状态，不伪造主体完整度、遮挡或背景识别结果。</text>
            </view>
            <view v-else class="style-sketch-check-state">图片已选择，正在准备稳定地址。</view>
          </view>
        </template>

        <view class="style-sketch-guide-card">
          <view class="style-sketch-collapsible-head" @click="styleSketchGuideExpanded = !styleSketchGuideExpanded">
            <view>
              <text class="style-sketch-collapsible-title">怎样上传效果更好？</text>
              <text class="style-sketch-collapsible-summary">推荐正面、清晰、主体完整且无遮挡的服装图片。</text>
            </view>
            <text>{{ styleSketchGuideExpanded ? '收起' : '展开' }}</text>
          </view>
          <view v-if="styleSketchGuideExpanded" class="style-sketch-guide-list">
            <text>优先上传正面服装图</text>
            <text>保证服装主体完整</text>
            <text>尽量避免手臂、包袋等遮挡</text>
            <text>白底或简洁背景效果更稳定</text>
            <text>避免强反光、严重褶皱和低清晰度</text>
          </view>
        </view>

        <view v-if="hasStyleSketchImage" class="style-sketch-submit-spacer"><text>{{ styleSketchSubmitSummary }}</text></view>
        <GenerationActionBar
          :summary="styleSketchSubmitSummary"
          :reason="styleSketchGenerateDisabledReason"
          :button-text="styleSketchSubmitButtonText"
          loading-text="正在创建任务…"
          :disabled="!canSubmitStyleSketch"
          :loading="isGeneratingValue || styleSketchSubmissionState === 'creating'"
          :keyboard-visible="styleSketchKeyboardOpen"
          @generate="submitStyleSketchGenerate"
        />
      </template>

      <template v-else-if="isSketchRemixEntry">
        <AiFeatureHeader
          title="线稿改款效果图"
          description="上传清晰的服装结构线稿，调整领口、袖型、版型和面料，生成改款效果图。"
        />

        <view v-if="remixDraftDetected" class="style-sketch-draft-banner">
          <view><text class="style-sketch-draft-title">检测到未完成的改款配置</text><text class="style-sketch-draft-desc">可继续使用已上传线稿和上次设置。</text></view>
          <view class="style-sketch-draft-actions"><text @click="continueRemixDraft">继续编辑</text><text class="danger-text" @click="restartRemixDraft">重新开始</text></view>
        </view>

        <view class="style-sketch-card">
          <view class="style-sketch-section-head">
            <view><text class="style-sketch-section-title">1. 上传原始图片</text><text class="style-sketch-section-desc">建议使用正面、轮廓完整、线条清晰的服装结构线稿。</text></view>
            <text class="required-badge">必填</text>
          </view>
          <view v-if="!clothImageValue.localPath && !hasRemoteClothImage" class="style-sketch-upload-box" @click="handleChooseClothImage">
            <text class="style-sketch-upload-icon">+</text><text class="style-sketch-upload-title">上传结构线稿</text><text class="style-sketch-upload-desc">支持手绘稿、电子线稿或款式结构图</text>
          </view>
          <view v-else class="style-sketch-image-preview">
            <image :src="clothImageValue.localPath || getAssetFileUrl(clothImageValue)" mode="aspectFit"></image>
            <view class="style-sketch-preview-actions"><button size="mini" :disabled="clothUploadingValue || isGeneratingValue" @click.stop="handleChooseClothImage">更换</button><button size="mini" class="danger" :disabled="clothUploadingValue || isGeneratingValue" @click.stop="resetRemixImage">删除</button></view>
            <view class="style-sketch-file-meta">
              <text v-if="remixImageMeta.format">{{ remixImageMeta.format }}</text>
              <text v-if="remixImageMeta.width && remixImageMeta.height">{{ remixImageMeta.width }} × {{ remixImageMeta.height }}</text>
              <text v-if="remixImageMeta.sizeText">{{ remixImageMeta.sizeText }}</text>
              <text>{{ clothUploadingValue ? '图片上传中…' : hasRemoteClothImage ? '结构线稿已上传，可继续设置' : '正在准备稳定图片…' }}</text>
            </view>
            <text v-if="clothUploadErrorValue" class="style-sketch-error-text">{{ clothUploadErrorValue }}</text>
            <button v-if="clothRetryableValue" class="style-sketch-retry-btn" size="mini" :disabled="clothUploadingValue" @click="retryClothUpload">重新上传</button>
          </view>
          <text v-if="!hasRemixImage" class="style-sketch-upload-tip">上传后可生成款式、版型和面料调整建议。</text>
        </view>

        <template v-if="hasRemixImage">
          <view class="style-sketch-card">
            <view class="style-sketch-section-head"><view><text class="style-sketch-section-title">2. 选择改款方式</text><text class="style-sketch-section-desc">选择生成速度和结构变化幅度。</text></view><text class="style-sketch-current">当前：{{ generationModeLabel }}</text></view>
            <view class="style-sketch-mode-grid">
              <view v-for="mode in remixGenerationModeOptions" :key="mode.value" :class="['style-sketch-mode-item', { active: generationMode === mode.value }]" @click="setGenerationMode(mode.value)">
                <text class="style-sketch-check">{{ generationMode === mode.value ? '✓' : '' }}</text><text class="style-sketch-mode-name">{{ mode.label }}</text><text class="style-sketch-mode-desc">{{ mode.desc }}</text>
              </view>
            </view>
            <text v-if="generationMode === 'creative'" class="style-sketch-warning">创意模式可能对原结构进行更明显调整。</text>
            <view class="remix-recommend-block">
              <view class="style-sketch-section-head compact"><view><text class="style-sketch-setting-label">生成改款建议</text><text class="style-sketch-section-desc">按当前模式整理受支持参数，不创建任务、不消耗额度。</text></view><text class="style-sketch-recommend-status">{{ remixRecommendationLabel }}</text></view>
              <view class="style-sketch-inline-actions"><button class="style-sketch-secondary-btn" :disabled="remixRecommendationState === 'loading'" @click="generateRemixRecommendation">{{ remixRecommendationState === 'loading' ? '正在生成改款建议…' : '生成改款建议' }}</button><button v-if="remixRecommendationState === 'ready'" class="style-sketch-secondary-btn accent" @click="applyRemixRecommendation">应用建议</button></view>
              <text v-if="remixRecommendationState === 'ready'" class="style-sketch-recommend-summary">{{ remixRecommendationSummary }}</text>
              <text class="style-sketch-local-note">当前建议由本地规则整理，不代表线稿已被 AI 识别；AI适配暂未开放。</text>
            </view>
          </view>

          <view class="style-sketch-card">
            <view class="style-sketch-section-head"><view><text class="style-sketch-section-title">3. 调整款式结构</text><text class="style-sketch-section-desc">调整领口、袖型、版型和衣长，其他结构尽量沿用原线稿。</text></view></view>
            <view v-for="field in remixPatternFields" :key="field.key" class="style-sketch-setting-group">
              <text class="style-sketch-setting-label">{{ styleSketchFieldTitle(field) }}</text>
              <view class="style-sketch-option-row"><view v-for="option in styleSketchFieldOptions(field)" :key="String(option.value)" :class="['style-sketch-option', { active: getAdvancedFieldValue('pattern_adjustment', field) === option.value }]" @click="updateAdvancedFieldValue('pattern_adjustment', field, option.value)"><text class="style-sketch-option-check">{{ getAdvancedFieldValue('pattern_adjustment', field) === option.value ? '✓' : '' }}</text><text>{{ option.label }}</text></view></view>
            </view>
          </view>

          <view class="style-sketch-card">
            <view class="style-sketch-collapsible-head" @click="remixFabricExpanded = !remixFabricExpanded">
              <view><text class="style-sketch-section-title">4. 设置面料质感</text><text class="style-sketch-collapsible-summary">{{ remixFabricSummary }}</text></view><text>{{ remixFabricExpanded ? '收起' : '展开' }}</text>
            </view>
            <view v-if="remixFabricExpanded" class="style-sketch-advanced-content">
              <view v-for="field in remixFabricFields" :key="field.key" class="style-sketch-setting-group compact">
                <text class="style-sketch-setting-label">{{ remixFieldTitle(field) }}</text>
                <view class="style-sketch-option-row"><view v-for="option in styleSketchFieldOptions(field)" :key="String(option.value)" :class="['style-sketch-option small', { active: getAdvancedFieldValue('fabric_texture', field) === option.value }]" @click="updateAdvancedFieldValue('fabric_texture', field, option.value)"><text class="style-sketch-option-check">{{ getAdvancedFieldValue('fabric_texture', field) === option.value ? '✓' : '' }}</text><text>{{ option.label }}</text></view></view>
              </view>
              <view v-for="field in remixPresentationFields" :key="field.key" class="style-sketch-setting-group compact">
                <text class="style-sketch-setting-label">{{ remixFieldTitle(field) }}</text>
                <view class="style-sketch-option-row"><view v-for="option in styleSketchFieldOptions(field)" :key="String(option.value)" :class="['style-sketch-option small', { active: getAdvancedFieldValue('sketch_to_model', field) === option.value }]" @click="updateAdvancedFieldValue('sketch_to_model', field, option.value)"><text class="style-sketch-option-check">{{ getAdvancedFieldValue('sketch_to_model', field) === option.value ? '✓' : '' }}</text><text>{{ option.label }}</text></view></view>
              </view>
            </view>

            <view class="style-sketch-prompt-block">
              <view class="style-sketch-prompt-head"><text class="style-sketch-setting-label">补充要求（可选）</text><text>{{ remixCustomPrompt.length }}/200</text></view>
              <textarea class="style-sketch-custom-prompt" :value="remixCustomPrompt" maxlength="200" placeholder="例如：将圆领改为V领，袖型改成长袖，衣长改为中长款，并保留原面料颜色。" @focus="remixKeyboardOpen = true" @blur="remixKeyboardOpen = false" @input="updateRemixCustomPrompt($event.detail.value)"></textarea>
              <text class="style-sketch-prompt-tip">建议描述需要重点调整的结构或材质，不建议重复填写已选参数。</text>
            </view>
          </view>

          <view class="style-sketch-card style-sketch-check-card">
            <text class="style-sketch-section-title">图片检查</text>
            <view v-if="clothUploadingValue" class="style-sketch-check-state">正在上传并检查图片…</view>
            <view v-else-if="hasRemoteClothImage" class="style-sketch-check-list"><view><text>上传状态</text><text class="success-text">稳定图片已准备</text></view><view v-if="remixImageMeta.format"><text>图片格式</text><text>{{ remixImageMeta.format }}</text></view><view v-if="remixImageMeta.width"><text>图片尺寸</text><text>{{ remixImageMeta.width }} × {{ remixImageMeta.height }}</text></view><view v-if="remixImageMeta.sizeText"><text>文件大小</text><text>{{ remixImageMeta.sizeText }}</text></view><text class="style-sketch-check-note">当前仅校验格式、大小、尺寸和上传状态，不伪造结构清晰度、遮挡或背景识别结果。</text></view>
            <view v-else class="style-sketch-check-state">图片已选择，正在准备稳定地址。</view>
          </view>
        </template>

        <view class="style-sketch-guide-card">
          <view class="style-sketch-collapsible-head" @click="remixGuideExpanded = !remixGuideExpanded"><view><text class="style-sketch-collapsible-title">怎样上传效果更好？</text><text class="style-sketch-collapsible-summary">推荐正面、清晰、主体完整且无遮挡的服装结构线稿。</text></view><text>{{ remixGuideExpanded ? '收起' : '展开' }}</text></view>
          <view v-if="remixGuideExpanded" class="style-sketch-guide-list"><text>正面视角优先</text><text>主体完整，不被遮挡</text><text>线稿轮廓应清楚连贯</text><text>避免低清晰度和严重反光</text></view>
        </view>

        <view v-if="hasRemixImage" class="style-sketch-submit-spacer"><text>{{ remixSubmitSummary }}</text></view>
        <GenerationActionBar
          :summary="remixSubmitSummary"
          :reason="remixGenerateDisabledReason"
          :button-text="remixSubmitButtonText"
          loading-text="正在创建任务…"
          :disabled="!canSubmitRemix"
          :loading="isGeneratingValue || remixSubmissionState === 'creating'"
          :keyboard-visible="remixKeyboardOpen"
          @generate="submitRemixGenerate"
        />
      </template>

      <template v-else-if="isBatchModelEntry">
        <AiFeatureHeader
          title="批量模特图"
          description="上传多件服装图片，统一设置模特、场景和视觉风格，批量生成商品模特图。"
        />
        <view class="batch-step-rail">
          <view
            v-for="step in batchWizardSteps"
            :key="step.value"
            :class="['batch-step-item', { active: batchWizardStep === step.value, completed: isBatchStepCompleted(step.value) }]"
            @click="goToBatchWizardStep(step.value)"
          >
            <text class="batch-step-dot">{{ batchWizardStep > step.value ? '✓' : step.value }}</text>
            <text class="batch-step-label">{{ step.label }}</text>
          </view>
        </view>

        <view v-if="batchWizardStep === 1" class="batch-card batch-step-panel">
          <view class="batch-section-head">
            <view><text class="batch-section-title">上传服装图</text><text class="batch-section-desc">每张图片对应一款服装，最多上传 3 款。</text></view>
            <text class="batch-count-badge">已上传 {{ batchReadyCount }}/3 款</text>
          </view>
          <view v-if="batchImages.length" class="batch-image-grid">
            <view v-for="(item, index) in batchImages" :key="item.id" class="batch-image-item">
              <image :src="item.localPath || item.fileUrl || item.fileId" mode="aspectFill" @click="previewBatchImage(index)"></image>
              <text class="batch-image-order">{{ index + 1 }}</text>
              <text :class="['batch-upload-status', item.status]">{{ batchImageStatusText(item) }}</text>
              <text class="batch-image-meta">{{ batchImageMetaText(item) }}</text>
              <text v-if="item.status === 'failed'" class="batch-image-error">{{ item.error || '图片未准备完成' }}</text>
              <view class="batch-order-actions">
                <text :class="{ disabled: index === 0 }" @click.stop="moveBatchImage(index, -1)">前移</text>
                <text :class="{ disabled: index === batchImages.length - 1 }" @click.stop="moveBatchImage(index, 1)">后移</text>
              </view>
              <view class="batch-image-actions">
                <text v-if="item.status === 'failed'" @click.stop="retryBatchImage(index)">重试</text>
                <text @click.stop="replaceBatchImage(index)">更换</text>
                <text @click.stop="removeBatchImage(index)">删除</text>
              </view>
            </view>
            <view v-if="canAddBatchImage" class="batch-image-add" @click="chooseBatchImages">
              <text class="batch-add-icon">＋</text><text>继续添加</text>
            </view>
          </view>
          <view v-else class="batch-upload-box" @click="chooseBatchImages">
            <text class="batch-upload-icon">＋</text>
            <text class="batch-upload-title">添加服装图片</text>
            <text class="batch-upload-desc">支持 JPG、PNG、WEBP；单张不超过 10MB</text>
          </view>
          <view v-if="batchImages.length" class="batch-check-summary">
            <text>已上传 {{ batchReadyCount }} 张</text><text v-if="batchUploadingCount">{{ batchUploadingCount }} 张上传中</text><text v-if="batchFailedCount" class="error">{{ batchFailedCount }} 张失败</text>
          </view>
        </view>

        <view v-if="batchWizardStep === 1" class="batch-card batch-collapsible batch-guide-card">
          <view class="batch-collapsible-head" @click="batchGuideExpanded = !batchGuideExpanded"><view><text class="batch-section-title">怎样上传效果更好？</text><text class="batch-section-desc">推荐正面、清晰、主体完整且无遮挡的服装图片。</text></view><text class="batch-chevron">{{ batchGuideExpanded ? '⌃' : '⌄' }}</text></view>
          <view v-if="batchGuideExpanded" class="batch-guide-list"><text>优先上传正面服装图</text><text>每张图片尽量只包含一件主要服装</text><text>保证服装主体完整，避免包袋和手臂遮挡</text><text>白底或简洁背景效果更稳定</text><text>避免强反光、严重褶皱和低清晰度</text></view>
        </view>

        <template v-if="batchImages.length">
        <view v-if="batchWizardStep === 2" class="batch-card batch-step-panel">
          <view class="batch-section-head"><view><text class="batch-section-title">2. 模特配置</text><text class="batch-section-desc">全部服装使用同一套模特配置，保持批次视觉一致。</text></view><text class="batch-required">必选</text></view>
          <view class="batch-consistency"><text class="batch-consistency-check">✓</text><view><text class="batch-consistency-title">统一模特与风格</text><text class="batch-consistency-desc">当前批量任务固定使用统一配置，不支持逐张单独设置。</text></view></view>
          <view class="batch-field">
            <view class="batch-model-profile-head"><view><text class="batch-field-label">我的常用模特</text><text class="batch-section-desc">可选；选中后本批次统一使用该授权人像。</text></view><button class="batch-text-btn" @click="openBatchModelProfiles">管理</button></view>
            <view v-if="batchModelProfilesLoading" class="batch-field-note">正在加载常用模特...</view>
            <view v-else-if="batchModelProfiles.length" class="batch-model-profile-list">
              <view v-for="profile in batchModelProfiles" :key="profile.modelProfileId" :class="['batch-model-profile-card', { active: batchModelProfileId === profile.modelProfileId }]" @click="selectBatchModelProfile(profile)">
                <image v-if="profile.coverUrl" class="batch-model-profile-image" :src="profile.coverUrl" mode="aspectFill" />
                <view v-else class="batch-model-profile-image placeholder">模</view>
                <text class="batch-model-profile-name">{{ profile.name }}</text><text v-if="batchModelProfileId === profile.modelProfileId" class="batch-model-profile-check">✓</text>
              </view>
            </view>
            <view v-else class="batch-field-note">还没有常用模特，可先上传已授权的人像。</view>
          </view>
          <view class="batch-field">
            <text class="batch-field-label">常用预设</text>
            <view class="batch-preset-grid"><view v-for="preset in batchModelPresets" :key="preset.value" :class="['batch-preset-item', { active: batchSelectedPreset === preset.value }]" @click="applyBatchModelPreset(preset)"><text class="batch-preset-name">{{ preset.label }}</text><text class="batch-preset-desc">{{ preset.desc }}</text></view></view>
          </view>
          <view class="batch-field">
            <text class="batch-field-label">生成模式</text>
            <view class="batch-mode-grid"><view v-for="mode in generationModeOptions" :key="mode.value" :class="['batch-mode-item', { active: generationMode === mode.value }]" @click="setGenerationMode(mode.value)"><text class="batch-mode-name"><text v-if="generationMode === mode.value">✓ </text>{{ mode.label }}</text><text class="batch-mode-desc">{{ batchModeDescription(mode.value) }}</text></view></view>
            <text v-if="generationMode === 'creative'" class="batch-field-note">创意模式允许更多视觉变化，可能降低同批次一致性。</text>
          </view>
          <view v-for="field in batchModelFields" :key="field.key" class="batch-field">
            <template v-if="field.key === 'modelType'">
              <text class="batch-field-label">人物类型</text>
              <view class="batch-chip-grid"><text v-for="option in batchFieldOptions(field, 'person')" :key="option.value" :class="['batch-chip', { active: getAdvancedFieldValue('model_and_body', field) === option.value }]" @click="updateAdvancedFieldValue('model_and_body', field, option.value)"><text v-if="getAdvancedFieldValue('model_and_body', field) === option.value" class="batch-chip-check">✓</text>{{ option.label }}</text></view>
            </template>
            <template v-else-if="field.key === 'poseType'">
              <text class="batch-field-label">姿势</text>
              <view class="batch-chip-grid"><text v-for="option in batchFieldOptions(field, 'pose')" :key="option.value" :class="['batch-chip', { active: getAdvancedFieldValue('model_and_body', field) === option.value }]" @click="updateAdvancedFieldValue('model_and_body', field, option.value)"><text v-if="getAdvancedFieldValue('model_and_body', field) === option.value" class="batch-chip-check">✓</text>{{ option.label }}</text></view>
              <text class="batch-field-sublabel">构图范围</text>
              <view class="batch-chip-grid"><text v-for="option in batchFieldOptions(field, 'framing')" :key="option.value" :class="['batch-chip', { active: getAdvancedFieldValue('model_and_body', field) === option.value }]" @click="updateAdvancedFieldValue('model_and_body', field, option.value)"><text v-if="getAdvancedFieldValue('model_and_body', field) === option.value" class="batch-chip-check">✓</text>{{ option.label }}</text></view>
            </template>
            <template v-else>
              <text class="batch-field-label">{{ batchFieldLabel(field) }}</text>
              <view class="batch-chip-grid"><text v-for="option in field.options" :key="option.value" :class="['batch-chip', { active: getAdvancedFieldValue('model_and_body', field) === option.value }]" @click="updateAdvancedFieldValue('model_and_body', field, option.value)"><text v-if="getAdvancedFieldValue('model_and_body', field) === option.value" class="batch-chip-check">✓</text>{{ option.label }}</text></view>
            </template>
          </view>
          <text class="batch-field-note">当前接口将站姿、坐姿、半身和全身作为同一组选项，只能选择一个。</text>
          <view class="batch-advanced-toggle" @click="batchModelAdvancedExpanded = !batchModelAdvancedExpanded"><view><text class="batch-guide-title">高级设置</text><text class="batch-section-desc">特殊模特和其他补充要求</text></view><text class="batch-chevron">{{ batchModelAdvancedExpanded ? '⌃' : '⌄' }}</text></view>
          <view v-if="batchModelAdvancedExpanded && batchModelTypeField" class="batch-field"><text class="batch-field-label">特殊模特</text><view class="batch-chip-grid"><text v-for="option in batchFieldOptions(batchModelTypeField, 'special')" :key="option.value" :class="['batch-chip', { active: getAdvancedFieldValue('model_and_body', batchModelTypeField) === option.value }]" @click="updateAdvancedFieldValue('model_and_body', batchModelTypeField, option.value)"><text v-if="getAdvancedFieldValue('model_and_body', batchModelTypeField) === option.value" class="batch-chip-check">✓</text>{{ option.label }}</text></view></view>
          <view v-if="batchModelAdvancedExpanded && batchModelPromptField" class="batch-field">
            <text class="batch-field-label">批量补充说明（可选）</text>
            <textarea class="batch-textarea" :value="getAdvancedFieldValue('model_and_body', batchModelPromptField)" placeholder="例如：统一白色棚拍背景，使用同一女模特，全身站姿，保持服装颜色和版型。" maxlength="300" @focus="batchKeyboardOpen = true" @blur="batchKeyboardOpen = false" @input="updateAdvancedFieldValue('model_and_body', batchModelPromptField, $event.detail.value)"></textarea>
            <text class="batch-char-count">{{ batchPromptLength }}/300</text>
          </view>
        </view>

        <view v-if="batchWizardStep === 3" class="batch-card batch-step-panel">
          <view class="batch-section-head"><view><text class="batch-section-title">场景风格</text><text class="batch-section-desc">{{ batchStyleSummary }}</text></view></view>
          <view class="batch-collapsible-body">
            <view v-for="field in batchStyleFields" :key="field.key" class="batch-field">
              <text class="batch-field-label">{{ field.label }}</text>
              <view v-if="field.type === 'select'" class="batch-chip-grid"><text v-for="option in field.options" :key="option.value" :class="['batch-chip', { active: getAdvancedFieldValue('style_scene', field) === option.value }]" @click="updateAdvancedFieldValue('style_scene', field, option.value)"><text v-if="getAdvancedFieldValue('style_scene', field) === option.value" class="batch-chip-check">✓</text>{{ option.label }}</text></view>
              <textarea v-else class="batch-textarea" :value="getAdvancedFieldValue('style_scene', field)" :placeholder="field.placeholder" maxlength="300" @focus="batchKeyboardOpen = true" @blur="batchKeyboardOpen = false" @input="updateAdvancedFieldValue('style_scene', field, $event.detail.value)"></textarea>
            </view>
          </view>
        </view>

        <view v-if="batchWizardStep === 4" class="batch-card batch-step-panel">
          <view class="batch-section-head"><view><text class="batch-section-title">输出设置</text><text class="batch-section-desc">平台变化只更新推荐值，不强制覆盖当前比例。</text></view></view>
          <view class="batch-collapsible-body">
            <view v-for="field in batchOutputFields" :key="field.key" class="batch-field">
              <text class="batch-field-label">{{ field.label }}</text>
              <view v-if="field.type === 'select'" class="batch-chip-grid"><text v-for="option in field.options" :key="option.value" :class="['batch-chip', { active: getAdvancedFieldValue('platform_output', field) === option.value }]" @click="field.key === 'platform' ? selectBatchPlatform(field, option.value) : updateAdvancedFieldValue('platform_output', field, option.value)"><text v-if="getAdvancedFieldValue('platform_output', field) === option.value" class="batch-chip-check">✓</text>{{ option.label }}</text></view>
              <textarea v-else class="batch-textarea" :value="getAdvancedFieldValue('platform_output', field)" :placeholder="field.placeholder" maxlength="300" @focus="batchKeyboardOpen = true" @blur="batchKeyboardOpen = false" @input="updateAdvancedFieldValue('platform_output', field, $event.detail.value)"></textarea>
            </view>
          </view>
          <view v-if="batchPlatformRecommendation" class="batch-platform-tip"><text>推荐比例：{{ batchPlatformRecommendation }}</text><button class="batch-text-btn" @click="applyBatchRecommendedRatio">使用推荐比例</button></view>
          <view class="batch-output-count"><view><text class="batch-field-label">每款生成数量</text><text class="batch-section-desc">当前生成链路每款支持 1 张。</text></view><text class="batch-fixed-count">1 张</text></view>
        </view>

        <view v-if="batchWizardStep === 2" class="batch-card batch-suggestion-card">
          <view><text class="batch-section-title">生成配置建议</text><text class="batch-section-desc">只生成推荐参数，不创建任务、不消耗额度。</text><text v-if="batchRecommendationState === 'ready'" class="batch-recommendation-summary">建议修改：{{ batchRecommendationChanges.join('；') || '当前配置已接近推荐值' }}</text></view>
          <view class="batch-recommendation-actions"><button v-if="batchRecommendationState !== 'ready'" class="batch-secondary-btn" :disabled="batchSubmitting" @click="generateBatchRecommendation">生成配置建议</button><template v-else><button class="batch-secondary-btn primary" @click="applyBatchRecommendation">应用建议</button><button class="batch-text-btn" @click="keepBatchSettings">保持当前</button></template></view>
        </view>

        <view v-if="batchWizardStep === 5" class="batch-card batch-confirm-card batch-step-panel">
          <text class="batch-section-title">确认生成</text>
          <view class="batch-confirm-row"><text>服装数量</text><text>{{ batchImages.length }} 款</text></view>
          <view class="batch-confirm-row"><text>每款生成数量</text><text>{{ batchPerGarmentCount }} 张</text></view>
          <view class="batch-confirm-row"><text>总任务数</text><text>{{ batchTotalTaskCount }} 个独立任务</text></view>
          <view class="batch-confirm-row"><text>总结果数</text><text>{{ batchTotalResultCount }} 张</text></view>
          <view class="batch-confirm-row"><text>统一模特配置</text><text>{{ batchModelSummary }}</text></view>
          <view class="batch-confirm-row"><text>场景与光影</text><text>{{ batchStyleSummary }}</text></view>
          <view class="batch-confirm-row"><text>平台与输出</text><text>{{ batchOutputSummary }}</text></view>
          <view class="batch-confirm-row"><text>预计消耗次数</text><text>{{ batchExpectedQuota }} 次</text></view>
          <view class="batch-confirm-row"><text>当前剩余次数</text><text>{{ quotaLoaded ? `${leftCount} 次` : '额度同步中' }}</text></view>
          <text class="batch-formula">预计消耗 = 服装数量 {{ batchImages.length }} × 每款生成数量 {{ batchPerGarmentCount }}</text>
          <text class="batch-confirm-note">每款服装创建独立子任务并归属同一批次；单项失败不会覆盖其他结果，批次重试只处理失败项。</text>
          <view v-if="quotaLoaded && !batchHasEnoughQuota" class="batch-quota-warning"><text class="batch-quota-title">生成次数不足，还差 {{ batchQuotaShortfall }} 次</text><text>可升级会员，或减少本批次服装数量。</text><view class="batch-quota-actions"><button class="batch-secondary-btn primary" @click="openBatchMembership">升级会员</button><button class="batch-secondary-btn" @click="reduceBatchGenerationCount">减少生成数量</button><button class="batch-text-btn" @click="goToBatchWizardStep(4)">返回调整</button></view></view>
        </view>
        </template>

        <view class="batch-submit-spacer"></view>
        <view v-if="!batchKeyboardOpen" class="batch-fixed-bar"><view class="batch-fixed-inner"><button v-if="batchHasPreviousStep" class="batch-prev-btn" :disabled="batchSubmitting" @click="previousBatchWizardStep">上一步</button><button v-if="batchHasNextStep" class="batch-next-btn" :disabled="!batchStepCanContinue" @click="nextBatchWizardStep">下一步</button><button v-else class="batch-submit-btn" :disabled="!canSubmitBatch || batchQuotaRefreshing" @click="submitBatchModel">{{ batchQuotaRefreshing ? '正在校验额度…' : (batchSubmitting ? '正在创建批次…' : '确认生成') }}</button></view></view>
      </template>

      <template v-else>
      <AiFeatureHeader
        :title="uploadPageTitle"
        description="上传服装图，确认生成方案后即可创建图片任务。"
      />

      <view class="upload-main-card">
        <view class="module-head">
          <text class="module-title">上传服装图</text>
          <text class="module-desc">最多上传 3 张，建议上传清晰、无遮挡的服装图。</text>
        </view>
        <view class="upload-box" @click="handleChooseClothImage" v-if="!clothImageValue.localPath">
          <view class="icon">上传</view>
          <text>{{ primaryUploadTitle }}</text>
          <text class="upload-helper-text">点击添加服装图，上传后即可生成方案和图片。</text>
        </view>
        <view class="preview upload-preview-card" v-else>
          <image :src="clothImageValue.localPath" class="img" mode="aspectFit"></image>
          <view class="upload-preview-actions">
            <button class="mini-action-btn" size="mini" :disabled="clothUploadingValue || isGeneratingValue" @click.stop="handleChooseClothImage">更换</button>
            <button class="mini-action-btn danger" size="mini" :disabled="clothUploadingValue || isGeneratingValue" @click.stop="resetClothImage">删除</button>
          </view>
          <text class="upload-status">
            {{ clothUploadingValue ? '上传中...' : hasRemoteClothImage ? '已上传，可生成' : '待上传完成' }}
          </text>
          <text v-if="clothUploadErrorValue" class="error-text">{{ clothUploadErrorValue }}</text>
          <button v-if="clothRetryableValue" class="retry-upload-btn" size="mini" type="warn" :disabled="clothUploadingValue" @click="retryClothUpload">
            {{ clothUploadingValue ? '上传中...' : '重试上传' }}
          </button>
        </view>
      </view>

      <view v-if="isFlatLayEntry && canGeneratePromptPlan" class="flat-lay-style-card">
        <view class="module-head">
          <text class="module-title">选择平铺风格</text>
          <text class="module-desc">选择商品图的布光与展示方向，生成时会保持服装版型和面料细节。</text>
        </view>
        <view class="flat-lay-style-grid">
          <view
            v-for="item in flatLayStyleOptions"
            :key="item.value"
            class="flat-lay-style-option"
            :class="{ active: selectedFlatLayStyle === item.value }"
            @click="selectFlatLayStyle(item)"
          >
            <text class="flat-lay-style-name">{{ item.label }}</text>
            <text class="flat-lay-style-desc">{{ item.description }}</text>
          </view>
        </view>
      </view>

      <view v-if="hasPromptPlanEntry" class="prompt-plan-card">
        <view class="prompt-plan-head">
          <view>
            <text class="prompt-plan-title">AI 出图方案</text>
            <text class="prompt-plan-desc">系统会根据服装图片和用途生成可编辑出图描述，用于提升出图效果。</text>
          </view>
          <text class="prompt-plan-badge">{{ generationModeLabel }}</text>
        </view>
        <view class="prompt-plan-actions">
          <button class="plan-btn primary" :class="{ disabled: !canGeneratePromptPlan }" size="mini" :disabled="!canGeneratePromptPlan" @click.stop="generatePromptPlan">{{ promptPlanReady ? '重新生成' : '一键生成方案' }}</button>
          <button class="plan-btn" :class="{ disabled: !canGeneratePromptPlan }" size="mini" :disabled="!canGeneratePromptPlan" @click.stop="adaptPromptPlan">AI 适配</button>
        </view>
        <text v-if="!canGeneratePromptPlan" class="prompt-plan-empty">请先上传服装图后生成方案。</text>
        <view v-else-if="promptPlanReady" class="prompt-plan-grid">
          <view v-for="field in promptPlanFields" :key="field.key" class="prompt-plan-field">
            <text class="prompt-field-label">{{ field.label }}</text>
            <textarea
              class="prompt-field-input"
              :value="promptPlan[field.key]"
              auto-height
              maxlength="240"
              @input="updatePromptPlanField(field.key, $event.detail.value)"
            ></textarea>
          </view>
        </view>
        <text v-else class="prompt-plan-empty">点击“一键生成方案”，先得到一份可编辑的中文出图方案。</text>
      </view>

      <view class="mode-card">
        <view class="module-head">
          <text class="module-title">生成模式</text>
        </view>
        <view class="mode-tabs compact">
          <view
            v-for="mode in generationModeOptions"
            :key="mode.value"
            class="mode-tab"
            :class="{ active: generationMode === mode.value }"
            @click="setGenerationMode(mode.value)"
          >
            <text class="mode-name">{{ mode.label }}</text>
            <text class="mode-desc">{{ mode.desc }}</text>
          </view>
        </view>
      </view>

      <view class="primary-generate-card">
        <button
          class="primary-generate-btn"
          :class="{ 'is-disabled': !clothImageValue.localPath || clothUploadingValue || isGeneratingValue }"
          :disabled="!clothImageValue.localPath || clothUploadingValue || isGeneratingValue"
          @click="startGenerate"
        >
          {{ isGeneratingValue ? '生成中...' : '生成图片' }}
        </button>
        <text v-if="!clothImageValue.localPath" class="primary-generate-tip">请先上传服装图</text>
        <text v-else class="primary-generate-tip">{{ promptPlanReady ? '将携带 AI 出图方案生成' : '也可以不生成方案，直接普通生成' }}</text>
      </view>

      <view class="advanced-card">
        <view class="advanced-head" @click="toggleAdvancedSettings">
          <view>
            <text class="advanced-title">高级精细化设置</text>
            <text class="advanced-desc">默认由 AI 自动识别；需要更精细出图时再手动调整。</text>
          </view>
          <text class="advanced-toggle">{{ showStyleAdvanced ? '收起' : '展开' }}</text>
        </view>

        <view v-if="showStyleAdvanced" class="advanced-body">
          <view class="simple-auto-summary">
            <text class="simple-auto-item">风格：AI 自动识别</text>
            <text class="simple-auto-item">场景：AI 自动识别</text>
            <text class="simple-auto-item">身材：AI 自动识别</text>
          </view>
          <view class="advanced-tabs">
            <text
              v-for="panel in currentAdvancedPanelConfigs"
              :key="panel.panelKey"
              class="advanced-tab"
              :class="{ active: activeAdvancedPanel === panel.panelKey }"
              @click.stop="setActiveAdvancedPanel(panel.panelKey)"
            >
              {{ panel.title }}
            </text>
          </view>

          <view
            v-for="panel in currentAdvancedPanelConfigs"
            :key="panel.panelKey"
            v-show="activeAdvancedPanel === panel.panelKey"
            class="advanced-section"
          >
            <text class="advanced-section-title">{{ panel.title }}</text>
            <text class="advanced-section-desc">{{ panel.description }}</text>
            <view
              v-for="field in panel.fields"
              :key="field.key"
              class="advanced-field"
            >
              <text class="advanced-field-label">{{ field.label }}</text>
              <view v-if="field.type === 'select'" class="advanced-chip-grid">
                <text
                  v-for="item in field.options"
                  :key="item.value"
                  class="advanced-chip"
                  :class="{ active: getAdvancedFieldValue(panel.panelKey, field) === item.value }"
                  @click="updateAdvancedFieldValue(panel.panelKey, field, item.value)"
                >
                  {{ item.label }}
                </text>
              </view>
              <view v-else-if="field.type === 'switch'" class="advanced-chip-grid">
                <text
                  class="advanced-chip"
                  :class="{ active: getAdvancedFieldValue(panel.panelKey, field) === true }"
                  @click="updateAdvancedFieldValue(panel.panelKey, field, true)"
                >
                  是
                </text>
                <text
                  class="advanced-chip"
                  :class="{ active: getAdvancedFieldValue(panel.panelKey, field) === false }"
                  @click="updateAdvancedFieldValue(panel.panelKey, field, false)"
                >
                  否
                </text>
              </view>
              <view v-else-if="field.type === 'textarea'" class="advanced-textarea-wrap">
                <textarea
                  class="advanced-textarea"
                  :value="getAdvancedFieldValue(panel.panelKey, field)"
                  :placeholder="field.placeholder"
                  auto-height
                  maxlength="500"
                  @input="updateAdvancedFieldValue(panel.panelKey, field, $event.detail.value)"
                ></textarea>
                <text class="advanced-field-tip">补充说明会作为 AI 生成参考，建议描述材质、颜色、风格、细节，不建议输入侵权品牌名或他人肖像信息。</text>
              </view>
              <input
                v-else
                class="advanced-input"
                :type="field.type === 'number' ? 'number' : 'text'"
                :placeholder="field.placeholder"
                :value="getAdvancedFieldValue(panel.panelKey, field)"
                :disabled="field.key === 'warningText'"
                @input="updateAdvancedFieldValue(panel.panelKey, field, $event.detail.value)"
              />
            </view>
          </view>
        </view>
      </view>

      <view class="template-card">
        <view class="collapsible-head" @click="showUploadGuide = !showUploadGuide">
          <view>
            <text class="template-eyebrow">上传建议与模板</text>
            <text class="template-title compact">{{ currentSceneTemplate.title }}</text>
          </view>
          <text class="advanced-toggle">{{ showUploadGuide ? '收起' : '展开' }}</text>
        </view>
        <view v-if="showUploadGuide">
          <text class="template-desc">{{ currentSceneTemplate.desc }}</text>
          <view class="template-preset-list">
            <text
              v-for="item in currentSceneTemplate.presets"
              :key="item"
              class="template-preset-item"
            >
              {{ item }}
            </text>
          </view>
          <text class="template-focus">{{ currentSceneTemplate.focus }}</text>
          <view class="quality-tip-card inner">
            <text class="quality-tip-title">上传建议</text>
            <text class="quality-tip-line">- 正面清晰的服装图</text>
            <text class="quality-tip-line">- 服装主体完整，不被遮挡</text>
            <text class="quality-tip-line">- 白底或简洁背景优先</text>
            <text class="quality-tip-line">- 避免强反光、严重褶皱、低清晰度</text>
            <text v-if="entrySceneTip" class="quality-tip-scene">{{ entrySceneTip }}</text>
          </view>
          <button class="template-switch-btn" size="mini" @click.stop="showTemplatePicker = !showTemplatePicker">
            {{ showTemplatePicker ? '收起模板' : '切换模板' }}
          </button>
          <view v-if="showTemplatePicker" class="template-option-list">
            <view
              v-for="template in sceneTemplateOptions"
              :key="template.key"
              class="template-option"
              :class="{ active: currentSceneTemplate.key === template.key }"
              @click.stop="selectSceneTemplate(template.key)"
            >
              <text class="template-option-title">{{ template.title }}</text>
              <text class="template-option-desc">{{ template.desc }}</text>
            </view>
          </view>
        </view>
      </view>

      <view class="quality-check-card">
        <view class="collapsible-head" @click="showQualityCheck = !showQualityCheck">
          <text class="quality-tip-title">图片检查</text>
          <text class="advanced-toggle">{{ showQualityCheck ? '收起' : '展开' }}</text>
        </view>
        <view v-if="showQualityCheck">
          <text class="quality-tip-line">本地预览：{{ clothImageValue.localPath ? '有' : '无' }}</text>
          <text class="quality-tip-line">云端文件：{{ hasRemoteClothImage ? '有' : '无' }}</text>
          <text class="quality-tip-line">- 服装主体是否完整</text>
          <text class="quality-tip-line">- 领口 / 袖口 / 下摆是否无遮挡</text>
          <text class="quality-tip-line">- 背景是否过于复杂</text>
          <text class="quality-tip-foot">当前图片将作为 AI 生成的服装参考图。</text>
        </view>
      </view>

      <view v-if="currentAdvancedPanels.length" class="generate-confirm-card">
        <view class="collapsible-head" @click="showGenerateConfirm = !showGenerateConfirm">
          <text class="generate-confirm-title">生成前确认</text>
          <text class="advanced-toggle">{{ showGenerateConfirm ? '收起' : '展开' }}</text>
        </view>
        <view v-if="showGenerateConfirm">
          <view class="generate-confirm-row">
            <text class="generate-confirm-label">当前功能</text>
            <text class="generate-confirm-value">{{ generateConfirmSummary.templateName }} / {{ generateConfirmSummary.templateType }}</text>
          </view>
          <view class="generate-confirm-block">
            <text class="generate-confirm-label">已选高级设置</text>
            <text class="generate-confirm-text">{{ generateConfirmSummary.optionPromptSummary || '暂无高级选项，系统将使用默认参数。' }}</text>
          </view>
          <view class="generate-confirm-block">
            <text class="generate-confirm-label">补充需求</text>
            <text class="generate-confirm-text">{{ generateConfirmSummary.customPromptSummary || '暂无补充需求。' }}</text>
          </view>
          <view class="generate-confirm-toggle-row">
            <text class="generate-confirm-label">AI 参考摘要</text>
            <text
              v-if="generateConfirmSummary.fullAdvancedPromptSummary"
              class="generate-confirm-toggle"
              @click="toggleGenerateConfirmFull"
            >
              {{ showGenerateConfirmFull ? '收起' : '展开' }}
            </text>
          </view>
          <text v-if="showGenerateConfirmFull" class="generate-confirm-text">{{ generateConfirmFullText }}</text>
        </view>
      </view>
      </template>
    </view>

    <view class="step-page" v-if="showStyleAdvanced" v-show="currentStepValue === 2">
      <view class="card">
        <view class="card-title">参考图（可选高级项）</view>
        <view class="style-ref-box" @click="handleChooseStyleImage" v-if="!styleImageValue.localPath">
          <text>上传想参考的风格图</text>
        </view>
        <view class="style-preview" v-else>
          <image :src="styleImageValue.localPath" class="style-image" mode="aspectFit"></image>
          <text>{{ styleUploadingValue ? '参考图上传中...' : styleImageValue.fileId ? '参考图已上传到服务端' : '已选择参考图' }}</text>
          <text v-if="styleUploadErrorValue" class="error-text">{{ styleUploadErrorValue }}</text>
          <button v-if="styleRetryableValue" size="mini" type="warn" :disabled="styleUploadingValue" @click="retryStyleUpload">
            {{ styleUploadingValue ? '上传中...' : '重试上传' }}
          </button>
          <button size="mini" type="warn" :disabled="styleUploadingValue" @click="resetStyleImage">重选</button>
        </view>
      </view>
      <view class="btns">
        <button class="prev" @click="goStep(1)">上一步</button>
        <button class="next" @click="goStep(3)">下一步</button>
      </view>
    </view>

    <view class="step-page" v-show="currentStepValue === 3">
      <view class="card">
        <view class="card-title">适用人群</view>
        <view class="grid">
          <view class="item" :class="{ on: modelTypeValue === 'female' }" @click="updateChainState({ modelType: 'female' })">女模特</view>
          <view class="item" :class="{ on: modelTypeValue === 'male' }" @click="updateChainState({ modelType: 'male' })">男模特</view>
          <view class="item" :class="{ on: modelTypeValue === 'kids' }" @click="updateChainState({ modelType: 'kids' })">童装</view>
        </view>
      </view>

      <view class="card" v-if="modelTypeValue !== 'kids'">
        <view class="card-title">身材类型</view>
        <view class="grid">
          <view class="item" :class="{ on: bodyValue === 'slim' }" @click="updateChainState({ body: 'slim' })">偏瘦</view>
          <view class="item" :class="{ on: bodyValue === 'normal' }" @click="updateChainState({ body: 'normal' })">标准</view>
          <view class="item" :class="{ on: bodyValue === 'curvy' }" @click="updateChainState({ body: 'curvy' })">微胖</view>
        </view>
      </view>

      <view class="card" v-if="modelTypeValue === 'kids'">
        <view class="card-title">童装年龄段</view>
        <view class="grid">
          <view class="item" :class="{ on: kidsAgeValue === 'toddler' }" @click="updateChainState({ kidsAge: 'toddler' })">小童</view>
          <view class="item" :class="{ on: kidsAgeValue === 'middle' }" @click="updateChainState({ kidsAge: 'middle' })">中童</view>
          <view class="item" :class="{ on: kidsAgeValue === 'big' }" @click="updateChainState({ kidsAge: 'big' })">大童</view>
        </view>
      </view>

      <view class="btns">
        <button class="prev" @click="goStep(2)">上一步</button>
        <button class="next" @click="goStep(4)">下一步</button>
      </view>
    </view>

    <view class="step-page" v-show="currentStepValue === 4">
      <view class="card">
        <view class="card-title">风格</view>
        <view class="grid">
          <view class="item" :class="{ on: styleTagValue === item.id }" v-for="item in styleList" :key="item.id" @click="updateChainState({ styleTag: item.id })">
            <text>{{ item.name }}</text>
          </view>
        </view>
      </view>

      <view class="card">
        <view class="card-title">场景</view>
        <view class="grid">
          <view class="item" :class="{ on: sceneValue === item.id }" v-for="item in sceneList" :key="item.id" @click="updateChainState({ scene: item.id })">
            <text>{{ item.name }}</text>
          </view>
        </view>
      </view>

      <view class="btns">
        <button class="prev" @click="goStep(3)">上一步</button>
        <button class="next" @click="goStep(5)">下一步</button>
      </view>
    </view>

    <view class="step-page" v-show="currentStepValue === 5">
      <view class="card">
        <view class="card-title">领口</view>
        <view class="grid">
          <view class="item" :class="{ on: neckValue === item.id }" v-for="item in neckList" :key="item.id" @click="updateChainState({ neck: item.id })">
            <text>{{ item.name }}</text>
          </view>
        </view>
      </view>

      <view class="card">
        <view class="card-title">袖型</view>
        <view class="grid">
          <view class="item" :class="{ on: sleeveValue === item.id }" v-for="item in sleeveList" :key="item.id" @click="updateChainState({ sleeve: item.id })">
            <text>{{ item.name }}</text>
          </view>
        </view>
      </view>

      <view class="card">
        <view class="card-title">版型</view>
        <view class="grid">
          <view class="item" :class="{ on: fitValue === item.id }" v-for="item in fitList" :key="item.id" @click="updateChainState({ fit: item.id })">
            <text>{{ item.name }}</text>
          </view>
        </view>
      </view>

      <view class="btns">
        <button class="prev" @click="goStep(4)">上一步</button>
        <button class="next" @click="goStep(6)">下一步</button>
      </view>
    </view>

    <view class="step-page" v-show="currentStepValue === 6">
      <view class="card">
        <view class="card-title">输出设置</view>
        <view class="grid">
          <view class="item" :class="{ on: backgroundTypeValue === 'normal' }" @click="updateChainState({ bg: 'normal' })">普通背景</view>
          <view class="item" :class="{ on: backgroundTypeValue === 'transparent' }" @click="updateChainState({ bg: 'transparent' })">透明底</view>
        </view>
        <view class="grid grid-top">
          <view class="item" :class="{ on: outputTypeValue === 'main' }" @click="updateChainState({ output: 'main' })">主图</view>
          <view class="item" :class="{ on: outputTypeValue === 'detail' }" @click="updateChainState({ output: 'detail' })">详情页</view>
        </view>
      </view>

      <view v-if="currentAdvancedPanels.length" class="generate-confirm-card">
        <text class="generate-confirm-title">生成前确认</text>
        <view class="generate-confirm-row">
          <text class="generate-confirm-label">当前功能</text>
          <text class="generate-confirm-value">{{ generateConfirmSummary.templateName }} / {{ generateConfirmSummary.templateType }}</text>
        </view>
        <view class="generate-confirm-block">
          <text class="generate-confirm-label">已选高级设置</text>
          <text class="generate-confirm-text">{{ generateConfirmSummary.optionPromptSummary || '暂无高级选项，系统将使用默认参数。' }}</text>
        </view>
        <view class="generate-confirm-block">
          <text class="generate-confirm-label">补充需求</text>
          <text class="generate-confirm-text">{{ generateConfirmSummary.customPromptSummary || '暂无补充需求。' }}</text>
        </view>
        <view class="generate-confirm-block">
          <view class="generate-confirm-toggle-row">
            <text class="generate-confirm-label">完整 AI 参考摘要</text>
            <text
              v-if="generateConfirmSummary.fullAdvancedPromptSummary"
              class="generate-confirm-toggle"
              @click="toggleGenerateConfirmFull"
            >
              {{ showGenerateConfirmFull ? '收起' : '展开' }}
            </text>
          </view>
          <text class="generate-confirm-text">{{ generateConfirmFullText }}</text>
        </view>
      </view>

      <view v-if="clothImageValue.localPath" class="prompt-plan-card prompt-plan-card-final">
        <view class="prompt-plan-head">
          <view>
            <text class="prompt-plan-title">AI 出图方案</text>
            <text class="prompt-plan-desc">确认方案后再生成，能减少无效提示词和风格偏差。</text>
          </view>
          <text class="prompt-plan-badge">{{ generationModeLabel }}</text>
        </view>
        <view class="mode-tabs compact">
          <view
            v-for="mode in generationModeOptions"
            :key="mode.value"
            class="mode-tab"
            :class="{ active: generationMode === mode.value }"
            @click="setGenerationMode(mode.value)"
          >
            <text class="mode-name">{{ mode.label }}</text>
          </view>
        </view>
        <view class="prompt-plan-actions">
          <button class="plan-btn primary" :class="{ disabled: !canGeneratePromptPlan }" size="mini" :disabled="!canGeneratePromptPlan" @click.stop="generatePromptPlan">{{ promptPlanReady ? '重新生成' : '一键生成方案' }}</button>
          <button class="plan-btn" :class="{ disabled: !canGeneratePromptPlan }" size="mini" :disabled="!canGeneratePromptPlan" @click.stop="adaptPromptPlan">AI 适配</button>
        </view>
        <text v-if="!canGeneratePromptPlan" class="prompt-plan-empty">请先上传服装图后生成方案。</text>
        <view v-else-if="promptPlanReady" class="prompt-plan-grid final">
          <view v-for="field in promptPlanFields" :key="field.key" class="prompt-plan-field">
            <text class="prompt-field-label">{{ field.label }}</text>
            <textarea
              class="prompt-field-input"
              :value="promptPlan[field.key]"
              auto-height
              maxlength="240"
              @input="updatePromptPlanField(field.key, $event.detail.value)"
            ></textarea>
          </view>
        </view>
        <text v-else class="prompt-plan-empty">还没有方案，点击“一键生成方案”即可生成中文提示词草稿。</text>
      </view>

      <view class="quick-group">
        <button class="quick-btn single" :class="{ 'is-disabled': isGeneratingValue }" :disabled="isGeneratingValue" @click="startGenerate">
          {{ isGeneratingValue ? '生成中...' : '一键生成' }}
        </button>
        <button v-if="generateRetryableValue" class="quick-btn retry" :class="{ 'is-disabled': isGeneratingValue }" :disabled="isGeneratingValue" @click="retryGenerate">
          {{ isGeneratingValue ? '处理中...' : '重新生成' }}
        </button>
        <button v-if="canContinuePollingValue" class="quick-btn retry" :class="{ 'is-disabled': isGeneratingValue }" :disabled="isGeneratingValue" @click="continuePolling">
          {{ isGeneratingValue ? '查询中...' : '继续查询任务' }}
        </button>
        <text v-if="generateErrorValue" class="error-text">{{ generateErrorValue }}</text>
        <text v-if="pollingErrorValue" class="error-text">{{ pollingErrorValue }}</text>
      </view>
    </view>

    <view class="generating" v-show="isGeneratingValue">
      <text>{{ runtimeTaskStatusTextValue }}</text>
      <view class="progress">
        <view class="bar" :style="{ width: runtimeTaskProgressValue + '%' }"></view>
      </view>
    </view>

    <view class="modal" v-if="showPayModal && !showShare" @click="closePayModal">
      <view class="modal-card" @click.stop>
        <view class="close" @click="closePayModal">×</view>
        <view class="modal-title">开通会员</view>
        <view class="vip-item">月卡 39 元</view>
        <view class="vip-item hot">季卡 89 元</view>
        <view class="vip-item">年卡 199 元</view>
        <button class="pay-btn" @click="closePayModal">微信支付</button>
      </view>
    </view>

    <view class="modal" v-if="showShare && !showPayModal" @click="closeShareModal">
      <view class="modal-card" @click.stop>
        <view class="close" @click="closeShareModal">×</view>
        <view class="modal-title">邀请好友送次数</view>
        <view class="share-info">
          <text>当前为演示流程，分享功能暂未接入。</text>
        </view>
        <button class="share-btn" @click="closeShareModal">我知道了</button>
      </view>
    </view>
  </view>
</template>

<script>
import AiFeatureHeader from '../../components/ai-generation/ai-feature-header.vue'
import GenerationActionBar from '../../components/ai-generation/generation-action-bar.vue'
import { getMainChainState, patchMainChainState } from '../../utils/mainChainState'
import { syncDraftTaskToState } from '../../utils/task/taskActions'
import { getTask, simulateTask } from '../../utils/task/taskLayer'
import { createInternalRealGenerationTask } from '../../utils/task/generationExecution'
import { getRuntimeGenerationConfig, refreshFeatureRuntimeBackendState } from '../../utils/runtime/appRuntimeConfig'
import { attachBatchTask, createBatchId, createBatchRecord } from '../../utils/task/batchTask'
import { retryUploadAsset } from '../../utils/task/taskRetry'
import { uploadImage } from '../../utils/api/upload'
import {
  MVP_ENTRY_SCENE_SET,
  buildDefaultParamsForEntryScene,
  getEntryScenePreset
} from '../../utils/constants/entryScenePresets'
import {
  getAdvancedPanelsForEntryScene,
  getDefaultAdvancedPanelValuesForEntryScene
} from '../../utils/constants/advancedPanelPresets'
import { buildAdvancedPromptSummary } from '../../utils/constants/advancedPromptRules'
import { resolveCostActionType } from '../../utils/constants/costActionType'
import { getMembershipUsage, refreshMembershipUsage } from '../../utils/member/membershipRepository'
import { MODEL_PROFILE_SELECTION_KEY, getModelProfiles } from '../../utils/model/modelProfileRepository.js'
import {
  BODY_TYPE_OPTIONS,
  OUTPUT_TYPE_OPTIONS,
  SCENE_OPTIONS,
  STYLE_OPTIONS
} from '../../utils/constants/styleSceneOptions'
import {
  FIT_OPTIONS,
  LENGTH_OPTIONS,
  NECKLINE_OPTIONS,
  SLEEVE_OPTIONS
} from '../../utils/constants/patternOptions'

function normalizeVisibleUploadError(value, fallback = '图片上传失败，请重新上传。') {
  const text = String(value || '').trim()
  if (!text) return ''
  const mojibakePattern = /[\uFFFD\u951F\u93C2\u7F01\u9422\u6D60\u93B4\u7EE0]/
  if (mojibakePattern.test(text)) return fallback
  const lowerText = text.toLowerCase()
  if (/format|type|extension|jpg|jpeg|png|webp/.test(lowerText)) return '图片格式不支持，请选择 JPG、PNG 或 WEBP 图片。'
  if (/size|large|10mb/.test(lowerText)) return '图片文件过大，请压缩后重新上传。'
  if (/dimension|width|height|small|resolution/.test(lowerText)) return '图片尺寸不符合要求，请重新选择清晰图片。'
  if (/network|timeout|upload|cloud|file/.test(lowerText)) return fallback
  if (/^[\u4e00-\u9fa5，。！？、：；（）\s]{1,80}$/.test(text)) return text
  return fallback
}

const DEFAULT_SCENE_TEMPLATE = {
  key: 'default',
  title: '通用服装出图',
  desc: '上传服装图后，可生成模特图、场景图和上新素材',
  presets: [
    '背景：白底 / 简洁场景',
    '模特：标准模特',
    '比例：1:1 / 3:4',
    '重点：服装主体清晰'
  ],
  focus: '先保证服装主体完整清晰，再根据需要继续调整风格和场景。',
  sceneTip: '',
  defaultParams: {
    modelType: 'female',
    sceneType: 'white',
    outputRatio: '1:1',
    backgroundType: 'white'
  }
}

const FLAT_LAY_STYLE_OPTIONS = [
  {
    value: 'white_ecommerce',
    label: '白底电商',
    description: '纯白背景，规范上架',
    sceneType: 'white',
    styleTag: 'clean_ecommerce',
    prompt: '纯白背景电商平铺图，服装完整展开，构图规范，光线均匀，适合商品上架'
  },
  {
    value: 'premium_studio',
    label: '高级棚拍',
    description: '柔和布光，细节清晰',
    sceneType: 'studio',
    styleTag: 'premium_studio',
    prompt: '高级摄影棚平铺图，柔和商业布光，轻微自然阴影，突出面料纹理和服装细节'
  },
  {
    value: 'editorial',
    label: '杂志风',
    description: '编辑构图，时尚克制',
    sceneType: 'editorial',
    styleTag: 'editorial',
    prompt: '时尚杂志编辑风平铺图，克制高级的构图与配色，服装主体清楚，保留真实材质'
  },
  {
    value: 'brand_display',
    label: '品牌展示',
    description: '统一视觉，适合品牌内容',
    sceneType: 'brand_display',
    styleTag: 'brand_display',
    prompt: '品牌视觉平铺展示图，统一简洁的背景和布光，画面有秩序，适合品牌商品内容'
  }
]

const SCENE_TEMPLATE_MAP = {
  default: DEFAULT_SCENE_TEMPLATE,
  ecommerce_main: {
    key: 'ecommerce_main',
    title: '电商主图',
    desc: '适合淘宝、拼多多、抖音商品主图',
    presets: [
      '背景：白底 / 简洁棚拍',
      '模特：女装标准模特',
      '比例：1:1',
      '重点：主体清晰、服装保真'
    ],
    focus: '建议使用白底或清晰平铺图，主体越完整越适合生成主图。',
    sceneTip: '电商主图建议使用白底或清晰平铺图，主体越完整越适合生成主图。',
    defaultParams: {
      modelType: 'female',
      sceneType: 'white',
      outputRatio: '1:1',
      backgroundType: 'white'
    }
  },
  flat_lay: {
    key: 'flat_lay',
    title: '平铺图',
    desc: '上传服装图，选择平铺风格后生成商品展示图',
    presets: [
      '展示：服装自然完整平铺',
      '风格：白底 / 棚拍 / 杂志 / 品牌',
      '比例：1:1',
      '重点：保留版型、颜色和面料细节'
    ],
    focus: '建议上传正面清晰、无遮挡的服装图片，生成时将保持服装主体完整。',
    sceneTip: '平铺图建议上传正面清晰、无遮挡的服装图。',
    defaultParams: {
      modelType: 'female',
      sceneType: 'white',
      outputRatio: '1:1',
      backgroundType: 'white'
    }
  },
  xiaohongshu: {
    key: 'xiaohongshu',
    title: '小红书图',
    desc: '适合种草笔记、生活方式场景',
    presets: [
      '背景：生活方式 / 氛围场景',
      '模特：自然姿态',
      '比例：3:4 或 4:5',
      '重点：真实感、氛围感'
    ],
    focus: '适合生活方式场景，建议服装细节清晰、颜色准确。',
    sceneTip: '小红书图适合生活方式场景，建议服装细节清晰、颜色准确。',
    defaultParams: {
      modelType: 'female',
      sceneType: 'lifestyle',
      outputRatio: '3:4',
      backgroundType: 'lifestyle'
    }
  },
  cross_border_white: {
    key: 'cross_border_white',
    title: '跨境白底图',
    desc: '适合亚马逊、独立站上架',
    presets: [
      '背景：纯白 / 浅灰',
      '模特：简洁正面',
      '比例：1:1',
      '重点：规范、清晰、少干扰'
    ],
    focus: '建议主体完整、背景简洁，便于生成规范上架图。',
    sceneTip: '跨境白底图建议主体完整、背景简洁，便于生成规范上架图。',
    defaultParams: {
      modelType: 'female',
      sceneType: 'white',
      outputRatio: '1:1',
      backgroundType: 'white'
    }
  },
  new_arrival: {
    key: 'new_arrival',
    title: '新品上新图',
    desc: '适合多款服装快速生成上新素材',
    presets: [
      '背景：统一棚拍风格',
      '模特：统一人设',
      '比例：1:1 / 3:4',
      '重点：批量一致性'
    ],
    focus: '适合多款服装快速出图，建议同一批图片角度和光线尽量一致。',
    sceneTip: '新品上新图建议同一批图片角度和光线尽量一致，方便统一审核。',
    defaultParams: {
      modelType: 'female',
      sceneType: 'studio',
      outputRatio: '3:4',
      backgroundType: 'studio'
    }
  },
  batch_model: {
    key: 'batch_model',
    title: '批量模特图',
    desc: '适合一批服装统一生成真人模特图',
    presets: [
      '背景：统一白底或棚拍',
      '模特：统一风格',
      '比例：3:4',
      '重点：批次一致、方便审核'
    ],
    focus: '建议所有图片角度尽量一致，方便批量生成和审核。',
    sceneTip: '批量模特图建议所有图片角度尽量一致，方便统一审核。',
    defaultParams: {
      modelType: 'female',
      sceneType: 'studio',
      outputRatio: '3:4',
      backgroundType: 'studio'
    }
  },
  style_variation: {
    key: 'style_variation',
    title: '爆款改款图',
    desc: '适合基于参考款生成微改款方向',
    presets: [
      '背景：简洁',
      '模特：可选',
      '比例：1:1 / 3:4',
      '重点：领口、袖型、版型细节'
    ],
    focus: '建议上传能清楚看到领口、袖口、下摆的图片。',
    sceneTip: '微改款建议上传能清楚看到领口、袖口、下摆的图片。',
    defaultParams: {
      modelType: 'female',
      sceneType: 'simple',
      outputRatio: '1:1',
      backgroundType: 'simple'
    }
  }
}

SCENE_TEMPLATE_MAP.xiaohongshu_seed = {
  ...SCENE_TEMPLATE_MAP.xiaohongshu,
  key: 'xiaohongshu_seed'
}

SCENE_TEMPLATE_MAP.hot_style_remix = {
  ...SCENE_TEMPLATE_MAP.style_variation,
  key: 'hot_style_remix'
}

SCENE_TEMPLATE_MAP.sketch_to_model = {
  ...DEFAULT_SCENE_TEMPLATE,
  key: 'sketch_to_model',
  title: '设计稿成衣图',
  desc: '上传线稿/设计稿，生成模特上身效果图',
  presets: ['设计稿', '上身图', '测款', '白棚预览'],
  focus: '支持手绘稿、电子线稿、款式图，AI 将生成模特上身效果图。',
  sceneTip: '支持手绘稿、电子线稿、款式图，AI 将生成模特上身效果图。'
}

SCENE_TEMPLATE_MAP.image_to_sketch = {
  ...DEFAULT_SCENE_TEMPLATE,
  key: 'image_to_sketch',
  title: '图片转结构线稿',
  desc: '识别领口、袖型、衣长，生成改款参考线稿',
  presets: ['结构解析', '改款', '参考线稿', '版型微调'],
  focus: 'AI 将识别服装结构，生成参考线稿，适合改款分析。',
  sceneTip: 'AI 将识别服装结构，生成参考线稿，适合改款分析。'
}

SCENE_TEMPLATE_MAP.sketch_remix = {
  ...DEFAULT_SCENE_TEMPLATE,
  key: 'sketch_remix',
  title: '线稿改款效果图',
  desc: '在线改领口袖型版型，再生成新款模特图',
  presets: ['改款', '版型', '效果图', '设计师修正'],
  focus: '可在高级面板调整领口、袖型、衣长和版型，再生成新款效果图。',
  sceneTip: '可在高级面板调整领口、袖型、衣长和版型，再生成新款效果图。'
}

const SCENE_TEMPLATE_OPTIONS = [
  SCENE_TEMPLATE_MAP.ecommerce_main,
  SCENE_TEMPLATE_MAP.xiaohongshu_seed,
  SCENE_TEMPLATE_MAP.cross_border_white,
  SCENE_TEMPLATE_MAP.new_arrival,
  SCENE_TEMPLATE_MAP.batch_model,
  SCENE_TEMPLATE_MAP.hot_style_remix,
  SCENE_TEMPLATE_MAP.sketch_to_model,
  SCENE_TEMPLATE_MAP.image_to_sketch,
  SCENE_TEMPLATE_MAP.sketch_remix,
  DEFAULT_SCENE_TEMPLATE
]

function createSceneTemplateFromPreset(preset = {}) {
  const templateType = preset.templateType || 'default'
  const title = preset.name || preset.label || DEFAULT_SCENE_TEMPLATE.title
  const outputTypes = Array.isArray(preset.defaultOutputTypes) ? preset.defaultOutputTypes : []

  return {
    ...DEFAULT_SCENE_TEMPLATE,
    key: templateType,
    title,
    desc: preset.note || DEFAULT_SCENE_TEMPLATE.desc,
    presets: outputTypes.length ? outputTypes : DEFAULT_SCENE_TEMPLATE.presets,
    focus: preset.note || DEFAULT_SCENE_TEMPLATE.focus,
    sceneTip: preset.note || '',
    defaultParams: {
      ...DEFAULT_SCENE_TEMPLATE.defaultParams
    }
  }
}

function resolveSceneTemplateByEntryScene(entryScene) {
  const rawEntryScene = String(entryScene || '').trim()
  const preset = getEntryScenePreset(rawEntryScene)
  const template = SCENE_TEMPLATE_MAP[preset.templateType] || SCENE_TEMPLATE_MAP[rawEntryScene]

  if (template) {
    return template
  }

  if (preset.templateType && preset.templateType !== 'default') {
    return createSceneTemplateFromPreset(preset)
  }

  if (rawEntryScene && rawEntryScene !== 'default') {
    console.log('[upload:entry-scene] fallback default', {
      rawEntryScene,
      reason: 'preset_not_found'
    })
  }

  return DEFAULT_SCENE_TEMPLATE
}

const ENTRY_SCENE_DISPLAY_COPY = {
  flat_lay: {
    title: '平铺图',
    desc: '上传服装图片，选择风格后生成平铺商品图',
    presets: ['白底电商', '高级棚拍', '杂志风', '品牌展示'],
    focus: '保持服装版型、颜色和面料细节，生成完整清晰的平铺展示。',
    sceneTip: '平铺图建议上传正面清晰、无遮挡的服装图片。'
  },
  ecommerce_main: {
    title: '电商主图',
    desc: '适合淘宝/拼多多/抖音主图，默认白底棚拍',
    presets: ['白底棚拍', '简约/韩系', '标准身材', '商品搜索主图'],
    focus: '默认使用白底或浅灰棚拍，优先保证主体清晰、服装保真。',
    sceneTip: '电商主图适合淘宝/拼多多/抖音主图，默认白底棚拍。'
  },
  xiaohongshu_seed: {
    title: '小红书图',
    desc: '适合种草图/直播封面，自动匹配氛围场景',
    presets: ['法式/INS/休闲', '街道/咖啡厅/草坪', '标准身材', '社媒封面'],
    focus: '默认自动匹配生活方式氛围场景，适合种草图、私域素材和直播封面。',
    sceneTip: '小红书图适合种草图/直播封面，自动匹配氛围场景。'
  },
  cross_border_white: {
    title: '跨境白底图',
    desc: '适合亚马逊/独立站，默认规范白底',
    presets: ['纯白/透明底', '极简纯色', '标准通用模特', '跨境上架'],
    focus: '默认使用规范白底或透明底，减少干扰，适合跨境平台上架。',
    sceneTip: '跨境白底图适合亚马逊/独立站，默认规范白底。'
  },
  new_arrival: {
    title: '新品上新图',
    desc: '适合工厂/档口快速上新',
    presets: ['多风格套餐', '棚拍+外景', '标准身材', '批量上新'],
    focus: '默认组合棚拍和外景方向，适合工厂、档口快速生成上新素材。',
    sceneTip: '新品上新图适合工厂/档口快速上新。'
  },
  batch_model: {
    title: '批量模特图',
    desc: '统一模特、统一场景、统一视觉',
    presets: ['商家模板风格', '统一场景', '统一身材', '批次一致'],
    focus: '默认沿用商家保存模板，保持同批次模特、场景和视觉一致。',
    sceneTip: '批量模特图用于统一模特、统一场景、统一视觉。'
  },
  hot_style_remix: {
    title: '爆款改款图',
    desc: '沿用原图风格，可微调领口袖型版型',
    presets: ['沿用原图风格', '沿用原图场景', '沿用原图身材', '版型微调'],
    focus: '默认展开版型微调，可重点调整领口、袖型和版型细节。',
    sceneTip: '爆款改款图沿用原图风格，可微调领口袖型版型。'
  },
  sketch_to_model: {
    title: '设计稿成衣图',
    desc: '上传线稿/设计稿，生成模特上身效果图',
    presets: ['设计稿', '上身图', '测款', '白棚预览'],
    focus: '支持手绘稿、电子线稿、款式图，AI 将生成模特上身效果图。',
    sceneTip: '支持手绘稿、电子线稿、款式图，AI 将生成模特上身效果图。'
  },
  image_to_sketch: {
    title: '图片转结构线稿',
    desc: '识别领口、袖型、衣长，生成改款参考线稿',
    presets: ['结构解析', '改款', '参考线稿', '版型微调'],
    focus: 'AI 将识别服装结构，生成参考线稿，适合改款分析。',
    sceneTip: 'AI 将识别服装结构，生成参考线稿，适合改款分析。'
  },
  sketch_remix: {
    title: '线稿改款效果图',
    desc: '在线改领口袖型版型，再生成新款模特图',
    presets: ['改款', '版型', '效果图', '设计师修正'],
    focus: '可在高级面板调整领口、袖型、衣长和版型，再生成新款效果图。',
    sceneTip: '可在高级面板调整领口、袖型、衣长和版型，再生成新款效果图。'
  }
}

const MVP_PRIMARY_CLOTH_SCENE_SET = new Set([
  ...MVP_ENTRY_SCENE_SET,
  'white_background',
  'main_image'
])

const SKETCH_MAX_IMAGE_BYTES = 10 * 1024 * 1024
const SKETCH_MIN_IMAGE_EDGE = 256
const SKETCH_ALLOWED_IMAGE_TYPES = Object.freeze(['jpg', 'jpeg', 'png', 'webp'])
const BATCH_MODEL_MAX_IMAGES = 3

export default {
  components: {
    AiFeatureHeader,
    GenerationActionBar
  },
  data() {
    return {
      chainState: getMainChainState(),
      isVip: false,
      leftCount: 0,
      quotaLoaded: false,
      showPayModal: false,
      showShare: false,
      entryScene: '',
      autoPromptPlanAfterUpload: false,
      showTemplatePicker: false,
      showStyleAdvanced: false,
      showGenerateConfirmFull: false,
      showUploadGuide: false,
      showQualityCheck: false,
      showGenerateConfirm: false,
      promptPlanReady: false,
      promptPlanExpanded: true,
      promptPlanEditing: true,
      generationMode: 'standard',
      sketchAdvancedExpanded: false,
      sketchKeyboardOpen: false,
      sketchDraftDetected: false,
      sketchRecommendationState: 'idle',
      sketchRecommendation: null,
      sketchImageMeta: { format: '', width: 0, height: 0, size: 0, sizeText: '' },
      sketchSubmissionState: 'idle',
      sketchCreatedTaskId: '',
      styleSketchAdvancedExpanded: false,
      styleSketchKeyboardOpen: false,
      styleSketchDraftDetected: false,
      styleSketchGuideExpanded: false,
      styleSketchRecommendationState: 'idle',
      styleSketchRecommendation: null,
      styleSketchImageMeta: { format: '', width: 0, height: 0, size: 0, sizeText: '' },
      styleSketchSubmissionState: 'idle',
      styleSketchCreatedTaskId: '',
      remixFabricExpanded: false,
      remixKeyboardOpen: false,
      remixDraftDetected: false,
      remixGuideExpanded: false,
      remixRecommendationState: 'idle',
      remixRecommendation: null,
      remixImageMeta: { format: '', width: 0, height: 0, size: 0, sizeText: '' },
      remixSubmissionState: 'idle',
      remixCreatedTaskId: '',
      batchImages: [],
      batchWizardStep: 1,
      batchMaxVisitedStep: 1,
      batchWizardSteps: [
        { value: 1, label: '上传服装' },
        { value: 2, label: '模特配置' },
        { value: 3, label: '场景风格' },
        { value: 4, label: '输出设置' },
        { value: 5, label: '确认生成' }
      ],
      batchModelPresets: [
        { value: 'ecommerce_female', label: '电商标准女模特', desc: '标准身材 · 全身展示', generationMode: 'standard', modelType: 'female', bodyType: 'standard', poseType: 'full_body' },
        { value: 'xiaohongshu_natural', label: '小红书自然模特', desc: '自然站姿 · 生活感', generationMode: 'standard', modelType: 'female', bodyType: 'standard', poseType: 'standing', styleCode: 'korean_casual' },
        { value: 'cross_border', label: '欧美跨境模特', desc: '全身构图 · 街拍风格', generationMode: 'standard', modelType: 'female', bodyType: 'standard', poseType: 'full_body', styleCode: 'american_street' },
        { value: 'custom', label: '自定义', desc: '保留当前手动配置' }
      ],
      batchSelectedPreset: 'custom',
      batchModelProfiles: [],
      batchModelProfilesLoading: false,
      batchModelProfileId: '',
      batchRecommendationChanges: [],
      batchPlatformRecommendation: '',
      batchQuotaRefreshing: false,
      batchModelAdvancedExpanded: false,
      batchGuideExpanded: false,
      batchKeyboardOpen: false,
      batchRecommendationState: 'idle',
      batchSubmitting: false,
      batchCreatedId: '',
      batchSubmissionState: 'idle',
      selectedFlatLayStyle: 'white_ecommerce',
      flatLayStyleOptions: FLAT_LAY_STYLE_OPTIONS,
      promptPlan: {
        clothingDescription: '',
        modelSetting: '',
        sceneSetting: '',
        poseSetting: '',
        outputUsage: '',
        negativePrompt: ''
      },
      promptPlanFields: [
        { key: 'clothingDescription', label: '服装描述' },
        { key: 'modelSetting', label: '模特设定' },
        { key: 'sceneSetting', label: '场景设定' },
        { key: 'poseSetting', label: '姿势设定' },
        { key: 'outputUsage', label: '出图用途' },
        { key: 'negativePrompt', label: '负面约束' }
      ],
      generationModeOptions: [
        { value: 'quick', label: '快速', desc: '优先快速生成，适合测试效果。' },
        { value: 'standard', label: '标准', desc: '平衡质量和速度，适合常规电商图。' },
        { value: 'creative', label: '创意', desc: '更强场景感和风格化，适合营销图和小红书内容。' }
      ],
      activeAdvancedPanel: '',
      generateInFlight: false,
      advancedPanelTabs: [],
      styleOptions: STYLE_OPTIONS,
      sceneOptions: SCENE_OPTIONS,
      bodyTypeOptions: BODY_TYPE_OPTIONS,
      outputTypeOptions: OUTPUT_TYPE_OPTIONS,
      necklineOptions: NECKLINE_OPTIONS,
      sleeveOptions: SLEEVE_OPTIONS,
      fitOptions: FIT_OPTIONS,
      lengthOptions: LENGTH_OPTIONS,
      styleList: [
        { id: 'korean', name: '韩系' },
        { id: 'ins', name: 'INS' },
        { id: 'simple', name: '简约' },
        { id: 'japanese', name: '日系' },
        { id: 'sweet', name: '甜美' },
        { id: 'casual', name: '休闲' }
      ],
      sceneList: [
        { id: 'white', name: '纯白背景' },
        { id: 'gray', name: '浅灰背景' },
        { id: 'blue', name: '浅蓝背景' },
        { id: 'living', name: '客厅' },
        { id: 'studio', name: '摄影棚' },
        { id: 'street', name: '街道' }
      ],
      neckList: [
        { id: 'round', name: '圆领' },
        { id: 'v', name: 'V领' },
        { id: 'polo', name: 'POLO' }
      ],
      sleeveList: [
        { id: 'short', name: '短袖' },
        { id: 'long', name: '长袖' },
        { id: 'sleeveless', name: '无袖' }
      ],
      fitList: [
        { id: 'tight', name: '修身' },
        { id: 'normal', name: '标准' },
        { id: 'loose', name: '宽松' },
        { id: 'oversize', name: '超大' }
      ]
    }
  },
  onLoad(options) {
    this.closeAllBlockingModals()
    const projectId = options && options.projectId
    const batchId = options && options.batchId
    const batchMode = options && options.batchMode
    const openMode = options && options.mode ? decodeURIComponent(options.mode) : ''
    const legacyToolType = options && options.toolType ? decodeURIComponent(options.toolType) : ''
    const legacyTaskType = options && options.taskType ? decodeURIComponent(options.taskType) : ''
    const legacyOutputType = options && options.outputType ? decodeURIComponent(options.outputType) : ''
    const legacySceneType = options && options.sceneType ? decodeURIComponent(options.sceneType) : ''
    this.entryScene = options && options.entryScene ? decodeURIComponent(options.entryScene) : ''
    if (['detail_page_from_photo', 'detail_long_image', 'detail_page_long_image'].includes(this.entryScene)) {
      uni.redirectTo({
        url: '/package-ai/detail-long-image/detail-long-image',
        fail: () => uni.showToast({ title: '详情长图页面打开失败', icon: 'none' })
      })
      return
    }
    this.autoPromptPlanAfterUpload = !!(
      options &&
      (options.autoPromptPlan === '1' || options.autoPromptPlan === 'true')
    )
    if (projectId || batchId) {
      const patch = {}
      if (projectId) {
        patch.projectId = decodeURIComponent(projectId)
      }
      if (batchId) {
        patch.batchId = decodeURIComponent(batchId)
      }
      syncDraftTaskToState(patch)
      this.chainState = getMainChainState()
    }
    if (batchMode) {
      uni.showToast({
        title: `Batch mode: ${batchMode}`,
        icon: 'none'
      })
    }
    this.syncEntrySceneTemplateContext(undefined, {
      resetStep: openMode !== 'edit'
    })
    if (this.entryScene === 'image_to_sketch') {
      uni.setNavigationBarTitle({ title: '图片转结构线稿' })
      this.showStyleAdvanced = false
      syncDraftTaskToState({ currentStep: 1 })
      this.chainState = getMainChainState()
      this.$nextTick(() => {
        this.sketchDraftDetected = this.hasRemoteClothImage && !this.currentTaskIdValue
      })
    }
    if (this.entryScene === 'text_to_sketch') {
      uni.setNavigationBarTitle({ title: 'AI款式起稿' })
      this.showStyleAdvanced = false
      syncDraftTaskToState({ currentStep: 1 })
      this.chainState = getMainChainState()
      this.$nextTick(() => {
        this.styleSketchDraftDetected = this.hasRemoteClothImage
      })
    }
    if (this.entryScene === 'sketch_remix') {
      uni.setNavigationBarTitle({ title: '线稿改款效果图' })
      this.showStyleAdvanced = false
      syncDraftTaskToState({ currentStep: 1 })
      this.chainState = getMainChainState()
      this.normalizeRemixFabricBinding()
      this.$nextTick(() => {
        this.remixDraftDetected = this.hasRemoteClothImage
      })
    }
    if (this.entryScene === 'batch_model') {
      uni.setNavigationBarTitle({ title: '批量模特图' })
      this.showStyleAdvanced = false
      syncDraftTaskToState({ currentStep: 1 })
      this.chainState = getMainChainState()
      this.restoreBatchImages()
    }
    this.loadQuotaDisplay()
    if (this.entryScene === 'flat_lay') {
      const selectedStyle = this.flatLayStyleOptions.find((item) => item.value === this.selectedFlatLayStyle)
      this.selectFlatLayStyle(selectedStyle || this.flatLayStyleOptions[0], false)
    }
    if (legacyToolType || legacyTaskType || legacyOutputType || legacySceneType) {
      this.applyLegacyEntryParams({
        toolType: legacyToolType,
        taskType: legacyTaskType,
        outputType: legacyOutputType,
        sceneType: legacySceneType
      })
    }
  },
  onShow() {
    refreshFeatureRuntimeBackendState()
    this.closeAllBlockingModals()
    this.loadQuotaDisplay()
    if (this.isBatchModelEntry) this.loadBatchModelProfiles()
  },
  computed: {
    isBatchModelEntry() {
      return this.entryScene === 'batch_model'
    },
    batchModelPanel() {
      return this.currentAdvancedPanelConfigs.find((panel) => panel.panelKey === 'model_and_body') || { fields: [] }
    },
    batchStylePanel() {
      return this.currentAdvancedPanelConfigs.find((panel) => panel.panelKey === 'style_scene') || { fields: [] }
    },
    batchOutputPanel() {
      return this.currentAdvancedPanelConfigs.find((panel) => panel.panelKey === 'platform_output') || { fields: [] }
    },
    batchModelFields() {
      return (this.batchModelPanel.fields || []).filter((field) => field.type === 'select')
    },
    batchModelPromptField() {
      return (this.batchModelPanel.fields || []).find((field) => field.key === 'customPrompt') || null
    },
    batchModelTypeField() {
      return (this.batchModelPanel.fields || []).find((field) => field.key === 'modelType') || null
    },
    batchStyleFields() {
      return this.batchStylePanel.fields || []
    },
    batchOutputFields() {
      return this.batchOutputPanel.fields || []
    },
    batchPromptLength() {
      return String(this.batchModelPromptField ? this.getAdvancedFieldValue('model_and_body', this.batchModelPromptField) || '' : '').length
    },
    batchReadyCount() {
      return this.batchImages.filter((item) => item.status === 'success' && (item.fileId || item.fileUrl)).length
    },
    canAddBatchImage() {
      return this.batchImages.length < BATCH_MODEL_MAX_IMAGES
    },
    batchUploadingCount() {
      return this.batchImages.filter((item) => item.status === 'uploading').length
    },
    batchFailedCount() {
      return this.batchImages.filter((item) => item.status === 'failed').length
    },
    batchPerGarmentCount() {
      return 1
    },
    batchTotalTaskCount() {
      return this.batchReadyCount
    },
    batchTotalResultCount() {
      return this.batchReadyCount * this.batchPerGarmentCount
    },
    batchExpectedQuota() {
      return this.batchReadyCount * this.batchPerGarmentCount
    },
    batchQuotaShortfall() {
      return Math.max(0, this.batchExpectedQuota - Number(this.leftCount || 0))
    },
    batchStepCanContinue() {
      if (this.batchSubmitting || this.batchQuotaRefreshing) return false
      if (this.batchWizardStep === 1) {
        return this.batchImages.length > 0 && this.batchReadyCount === this.batchImages.length && !this.batchUploadingCount && !this.batchFailedCount
      }
      return this.batchWizardStep < 5
    },
    batchHasPreviousStep() {
      return this.batchWizardStep !== 1
    },
    batchHasNextStep() {
      return this.batchWizardStep !== 5
    },
    batchStyleSummary() {
      return this.batchPanelSummary(this.batchStylePanel, 'style_scene') || '使用默认风格与场景'
    },
    batchModelSummary() {
      const profile = this.batchSelectedModelProfile
      const summary = this.batchPanelSummary(this.batchModelPanel, 'model_and_body') || '女模特 · 标准身材 · 站姿'
      return profile ? `${profile.name} · ${summary}` : summary
    },
    batchSelectedModelProfile() {
      return this.batchModelProfiles.find((item) => item.modelProfileId === this.batchModelProfileId) || null
    },
    batchOutputSummary() {
      return this.batchPanelSummary(this.batchOutputPanel, 'platform_output') || '淘宝 · 1:1 · 白底主图'
    },
    batchHasEnoughQuota() {
      return !this.quotaLoaded || this.isVip || this.leftCount >= this.batchExpectedQuota
    },
    canSubmitBatch() {
      return this.isBatchModelEntry && this.batchWizardStep === 5 && this.batchImages.length > 0 && this.batchReadyCount === this.batchImages.length && !this.batchUploadingCount && !this.batchSubmitting && !this.batchQuotaRefreshing && !this.batchCreatedId && this.batchHasEnoughQuota
    },
    batchSubmitReason() {
      if (this.batchCreatedId) return '可前往结果页查看批次进度'
      if (!this.batchImages.length) return '至少上传 1 张服装图片'
      if (this.batchUploadingCount) return '请等待所有图片上传完成'
      if (this.batchFailedCount) return '请删除或重试上传失败的图片'
      if (!this.batchHasEnoughQuota) return '当前可用次数不足，请减少图片或升级会员'
      return '全部图片使用同一模特、场景和输出配置'
    },
    isImageToSketchEntry() {
      return this.entryScene === 'image_to_sketch'
    },
    isTextToSketchEntry() {
      return this.entryScene === 'text_to_sketch'
    },
    isSketchRemixEntry() {
      return this.entryScene === 'sketch_remix'
    },
    hasSketchImage() {
      return !!(this.clothImageValue.localPath || this.hasRemoteClothImage)
    },
    sketchGenerationModeOptions() {
      return [
        { value: 'quick', label: '快速', desc: '优先生成速度，适合快速预览' },
        { value: 'standard', label: '标准', desc: '平衡质量与速度，适合常规设计' },
        { value: 'creative', label: '创意', desc: '允许轻量优化，适合方案探索' }
      ]
    },
    sketchPanelConfig() {
      return this.currentAdvancedPanelConfigs.find((panel) => panel.panelKey === 'image_to_sketch') || { fields: [] }
    },
    sketchTechPanelConfig() {
      return this.currentAdvancedPanelConfigs.find((panel) => panel.panelKey === 'tech_pack') || { fields: [] }
    },
    sketchBasicFields() {
      return (this.sketchPanelConfig.fields || []).filter((field) => field.key !== 'customPrompt')
    },
    sketchTechFields() {
      return (this.sketchTechPanelConfig.fields || []).filter((field) => field.type === 'switch')
    },
    sketchCustomPrompt() {
      const field = (this.sketchPanelConfig.fields || []).find((item) => item.key === 'customPrompt')
      return String(field ? this.getAdvancedFieldValue('image_to_sketch', field) || '' : '')
    },
    sketchRecommendationLabel() {
      return { idle: '可选', loading: '生成中', ready: '已生成', applied: '已应用', failed: '生成失败' }[this.sketchRecommendationState] || '可选'
    },
    sketchRecommendationSummary() {
      const value = this.sketchRecommendation || {}
      return `${this.sketchLevelLabel(value.sketchLevel || 'standard')} · ${value.includeLabels ? '标注结构' : '不标注结构'} · ${value.includeCraftNotes ? '生成工艺说明' : '不生成工艺说明'}`
    },
    sketchSettingsSummary() {
      const panel = this.sketchPanelConfig
      const fieldMap = (panel.fields || []).reduce((result, field) => { result[field.key] = field; return result }, {})
      const level = fieldMap.sketchLevel ? this.getAdvancedFieldValue('image_to_sketch', fieldMap.sketchLevel) : 'standard'
      const labels = fieldMap.includeLabels ? this.getAdvancedFieldValue('image_to_sketch', fieldMap.includeLabels) : true
      const craft = fieldMap.includeCraftNotes ? this.getAdvancedFieldValue('image_to_sketch', fieldMap.includeCraftNotes) : true
      return `${this.sketchLevelLabel(level)}精度 · ${labels ? '标注结构' : '不标注结构'} · ${craft ? '生成工艺说明' : '不生成工艺说明'}`
    },
    sketchSubmitSummary() {
      if (this.generationMode === 'quick') return `快速模式 · ${this.sketchSettingsSummary}`
      return `${this.generationModeLabel}模式 · ${this.sketchSettingsSummary}`
    },
    canSubmitSketch() {
      const hasQuota = !this.quotaLoaded || this.isVip || this.leftCount > 0
      return this.isImageToSketchEntry && hasQuota && this.hasRemoteClothImage && !this.clothUploadingValue && !this.isGeneratingValue && this.sketchRecommendationState !== 'loading' && !this.sketchCreatedTaskId
    },
    sketchGenerateDisabledReason() {
      if (this.sketchCreatedTaskId) return '任务已创建，可在生产记录中查看'
      if (!this.hasSketchImage) return '请先上传服装图片'
      if (this.clothUploadingValue) return '图片上传中，请稍候'
      if (this.clothUploadErrorValue) return '图片上传失败，请重新上传'
      if (!this.hasRemoteClothImage) return '正在准备稳定图片地址'
      if (this.quotaLoaded && !this.isVip && this.leftCount <= 0) return '生成次数不足'
      if (this.sketchRecommendationState === 'loading') return '正在生成推荐设置'
      if (this.isGeneratingValue || this.sketchSubmissionState === 'creating') return '正在创建任务，请勿重复操作'
      return ''
    },
    sketchSubmitButtonText() {
      if (this.sketchCreatedTaskId) return '任务已创建'
      if (!this.hasSketchImage) return '请先上传服装图片'
      if (this.clothUploadingValue) return '图片上传中…'
      if (this.clothUploadErrorValue) return '图片上传失败，请重试'
      if (!this.hasRemoteClothImage) return '正在准备图片…'
      if (this.quotaLoaded && !this.isVip && this.leftCount <= 0) return '生成次数不足'
      if (this.sketchRecommendationState === 'loading') return '正在生成推荐设置…'
      if (this.isGeneratingValue || this.sketchSubmissionState === 'creating') return '正在创建任务…'
      return '生成结构线稿'
    },
    hasStyleSketchImage() {
      return !!(this.clothImageValue.localPath || this.hasRemoteClothImage)
    },
    styleSketchGenerationModeOptions() {
      return [
        { value: 'quick', label: '快速', desc: '优先生成速度，适合快速预览' },
        { value: 'standard', label: '标准', desc: '平衡细节和稳定性，适合常规设计' },
        { value: 'creative', label: '创意', desc: '款式变化更明显，适合方案探索' }
      ]
    },
    styleSketchPatternPanel() {
      return this.currentAdvancedPanelConfigs.find((panel) => panel.panelKey === 'pattern_adjustment') || { fields: [] }
    },
    styleSketchGenerationPanel() {
      return this.currentAdvancedPanelConfigs.find((panel) => panel.panelKey === 'sketch_generation') || { fields: [] }
    },
    styleSketchPatternFields() {
      return (this.styleSketchPatternPanel.fields || []).filter((field) => field.key !== 'customPrompt')
    },
    styleSketchAdvancedFields() {
      return (this.styleSketchGenerationPanel.fields || []).filter((field) => field.key !== 'customPrompt')
    },
    styleSketchCustomPrompt() {
      const field = (this.styleSketchPatternPanel.fields || []).find((item) => item.key === 'customPrompt')
      return String(field ? this.getAdvancedFieldValue('pattern_adjustment', field) || '' : '')
    },
    styleSketchRecommendationLabel() {
      return { idle: '可选', loading: '生成中', ready: '待应用', applied: '已应用', failed: '生成失败' }[this.styleSketchRecommendationState] || '可选'
    },
    styleSketchRecommendationSummary() {
      const recommendation = this.styleSketchRecommendation || {}
      return [
        this.styleSketchValueLabel('neckType', recommendation.neckType),
        this.styleSketchValueLabel('sleeveType', recommendation.sleeveType),
        this.styleSketchValueLabel('fitType', recommendation.fitType),
        this.styleSketchValueLabel('lengthType', recommendation.lengthType),
        recommendation.pocketEnabled ? '添加口袋' : '不添加口袋'
      ].filter(Boolean).join(' · ')
    },
    styleSketchConflictMessage() {
      if (!this.isTextToSketchEntry || !this.hasStyleSketchImage) return ''
      const value = (key) => {
        const field = this.styleSketchPatternFields.find((item) => item.key === key)
        return field ? this.getAdvancedFieldValue('pattern_adjustment', field) : ''
      }
      const neck = value('neckType')
      const sleeve = value('sleeveType')
      const fit = value('fitType')
      const length = value('lengthType')
      const pocket = value('pocketEnabled')
      const prompt = this.styleSketchCustomPrompt
      if (fit === 'cropped' && length === 'long') return '版型“短款”与衣长“长款”冲突，请调整后生成'
      if (neck === 'camisole' && sleeve === 'long') return '吊带与长袖方向冲突，请调整领口或袖型'
      if (this.generationMode === 'creative' && /完全保留原款/.test(prompt)) return '创意模式与“完全保留原款”要求冲突'
      if (pocket === true && /(去除|移除|不要|不加)口袋/.test(prompt)) return '已选择添加口袋，但补充要求中提出去除口袋'
      const defaults = this.styleSketchPatternFields.reduce((result, field) => {
        result[field.key] = field.defaultValue
        return result
      }, {})
      const changedCount = this.styleSketchPatternFields.filter((field) => value(field.key) !== defaults[field.key]).length
      if (this.generationMode === 'quick' && changedCount >= 4) return '快速模式不适合同时调整过多结构，请改用标准或创意模式'
      return ''
    },
    styleSketchSubmitSummary() {
      if (!this.hasStyleSketchImage) return '上传服装图片后即可配置款式'
      const value = (key) => {
        const field = this.styleSketchPatternFields.find((item) => item.key === key)
        return field ? this.getAdvancedFieldValue('pattern_adjustment', field) : ''
      }
      return [
        `${this.generationModeLabel}模式`,
        this.styleSketchValueLabel('neckType', value('neckType')),
        this.styleSketchValueLabel('sleeveType', value('sleeveType')),
        this.styleSketchValueLabel('fitType', value('fitType')),
        this.styleSketchValueLabel('lengthType', value('lengthType')),
        value('pocketEnabled') ? '添加口袋' : '不添加口袋'
      ].filter(Boolean).join(' · ')
    },
    canSubmitStyleSketch() {
      const hasQuota = !this.quotaLoaded || this.isVip || this.leftCount > 0
      return this.isTextToSketchEntry && hasQuota && this.hasRemoteClothImage && !this.clothUploadingValue && !this.isGeneratingValue && this.styleSketchRecommendationState !== 'loading' && !this.styleSketchConflictMessage && !this.styleSketchCreatedTaskId
    },
    styleSketchGenerateDisabledReason() {
      if (this.styleSketchCreatedTaskId) return '任务已创建，可在生产记录中查看'
      if (!this.hasStyleSketchImage) return '请先上传服装图片'
      if (this.clothUploadingValue) return '服装图片上传中，请稍候'
      if (this.clothUploadErrorValue) return '图片上传失败，请重新上传'
      if (!this.hasRemoteClothImage) return '正在准备稳定图片地址'
      if (this.styleSketchRecommendationState === 'loading') return '正在生成改款建议'
      if (this.styleSketchConflictMessage) return this.styleSketchConflictMessage
      if (this.quotaLoaded && !this.isVip && this.leftCount <= 0) return '生成次数不足'
      if (this.isGeneratingValue || this.styleSketchSubmissionState === 'creating') return '正在创建任务，请勿重复操作'
      return ''
    },
    styleSketchSubmitButtonText() {
      if (this.styleSketchCreatedTaskId) return '任务已创建'
      if (!this.hasStyleSketchImage) return '请先上传服装图片'
      if (this.clothUploadingValue) return '服装图片上传中…'
      if (this.clothUploadErrorValue) return '图片上传失败，请重试'
      if (!this.hasRemoteClothImage) return '正在准备图片…'
      if (this.styleSketchRecommendationState === 'loading') return '正在生成改款建议…'
      if (this.styleSketchConflictMessage) return '请调整冲突配置'
      if (this.quotaLoaded && !this.isVip && this.leftCount <= 0) return '生成次数不足'
      if (this.isGeneratingValue || this.styleSketchSubmissionState === 'creating') return '正在创建任务…'
      return '生成款式草图'
    },
    hasRemixImage() {
      return !!(this.clothImageValue.localPath || this.hasRemoteClothImage)
    },
    remixGenerationModeOptions() {
      return [
        { value: 'quick', label: '快速', desc: '优先生成速度，适合快速预览' },
        { value: 'standard', label: '标准', desc: '平衡结构还原和成图质量' },
        { value: 'creative', label: '创意', desc: '允许更明显的款式与面料变化' }
      ]
    },
    remixPatternPanel() {
      return this.currentAdvancedPanelConfigs.find((panel) => panel.panelKey === 'pattern_adjustment') || { fields: [] }
    },
    remixFabricPanel() {
      return this.currentAdvancedPanelConfigs.find((panel) => panel.panelKey === 'fabric_texture') || { fields: [] }
    },
    remixPresentationPanel() {
      return this.currentAdvancedPanelConfigs.find((panel) => panel.panelKey === 'sketch_to_model') || { fields: [] }
    },
    remixPatternFields() {
      return (this.remixPatternPanel.fields || []).filter((field) => field.key !== 'customPrompt')
    },
    remixFabricFields() {
      return (this.remixFabricPanel.fields || []).filter((field) => field.key !== 'customPrompt')
    },
    remixPresentationFields() {
      return (this.remixPresentationPanel.fields || []).filter((field) => !['customPrompt', 'fabricType'].includes(field.key))
    },
    remixCustomPrompt() {
      const field = (this.remixPatternPanel.fields || []).find((item) => item.key === 'customPrompt')
      return String(field ? this.getAdvancedFieldValue('pattern_adjustment', field) || '' : '')
    },
    remixRecommendationLabel() {
      return { idle: '可选', loading: '生成中', ready: '待应用', applied: '已应用', failed: '生成失败' }[this.remixRecommendationState] || '可选'
    },
    remixRecommendationSummary() {
      const value = this.remixRecommendation || {}
      return [
        this.remixValueLabel('pattern_adjustment', 'neckType', value.neckType),
        this.remixValueLabel('pattern_adjustment', 'sleeveType', value.sleeveType),
        this.remixValueLabel('pattern_adjustment', 'fitType', value.fitType),
        this.remixValueLabel('pattern_adjustment', 'lengthType', value.lengthType),
        value.pocketEnabled ? '添加口袋' : '不新增口袋'
      ].filter(Boolean).join(' · ')
    },
    remixFabricSummary() {
      const value = (key) => {
        const field = this.remixFabricFields.find((item) => item.key === key)
        return field ? this.getAdvancedFieldValue('fabric_texture', field) : ''
      }
      return [
        this.remixValueLabel('fabric_texture', 'fabricType', value('fabricType')),
        this.remixValueLabel('fabric_texture', 'fabricColor', value('fabricColor')),
        this.remixValueLabel('fabric_texture', 'textureStrength', value('textureStrength'))
      ].filter(Boolean).join(' · ') || '按需展开设置面料与展示效果'
    },
    remixConflictMessage() {
      if (!this.isSketchRemixEntry || !this.hasRemixImage) return ''
      const patternValue = (key) => {
        const field = this.remixPatternFields.find((item) => item.key === key)
        return field ? this.getAdvancedFieldValue('pattern_adjustment', field) : ''
      }
      const presentationValue = (key) => {
        const field = this.remixPresentationFields.find((item) => item.key === key)
        return field ? this.getAdvancedFieldValue('sketch_to_model', field) : ''
      }
      const fabricValue = (key) => {
        const field = this.remixFabricFields.find((item) => item.key === key)
        return field ? this.getAdvancedFieldValue('fabric_texture', field) : ''
      }
      const neck = patternValue('neckType')
      const sleeve = patternValue('sleeveType')
      const fit = patternValue('fitType')
      const length = patternValue('lengthType')
      const pocket = patternValue('pocketEnabled')
      const prompt = this.remixCustomPrompt
      if (fit === 'cropped' && length === 'long') return '版型“短款”与衣长“长款”冲突，请调整后生成'
      if (neck === 'camisole' && sleeve === 'long') return '吊带与长袖方向冲突，请调整领口或袖型'
      if (pocket === true && /(去除|移除|不要|不加)口袋/.test(prompt)) return '已选择添加口袋，但补充要求中提出移除口袋'
      if (this.generationMode === 'creative' && /(完全忠实|完全保留|严格还原)(原结构|原款|线稿)/.test(prompt)) return '创意模式与完全忠实还原要求冲突'
      const changedCount = this.remixPatternFields.filter((field) => this.getAdvancedFieldValue('pattern_adjustment', field) !== field.defaultValue).length
      if (presentationValue('keepSketchStructure') === true && this.generationMode === 'creative' && changedCount >= 3) return '已选择保留原结构，不适合同时进行多项创意改款'
      const fabricField = this.remixFabricFields.find((field) => field.key === 'fabricType')
      if (/保留原面料/.test(prompt) && fabricField && fabricValue('fabricType') !== fabricField.defaultValue) return '补充要求需要保留原面料，但已选择其他面料类型'
      return ''
    },
    remixSubmitSummary() {
      if (!this.hasRemixImage) return '上传结构线稿后即可配置改款效果'
      const patternValue = (key) => {
        const field = this.remixPatternFields.find((item) => item.key === key)
        return field ? this.getAdvancedFieldValue('pattern_adjustment', field) : ''
      }
      const fabricField = this.remixFabricFields.find((field) => field.key === 'fabricType')
      const fabricType = fabricField ? this.getAdvancedFieldValue('fabric_texture', fabricField) : ''
      return [
        `${this.generationModeLabel}模式`,
        this.remixValueLabel('pattern_adjustment', 'neckType', patternValue('neckType')),
        this.remixValueLabel('pattern_adjustment', 'sleeveType', patternValue('sleeveType')),
        this.remixValueLabel('pattern_adjustment', 'fitType', patternValue('fitType')),
        this.remixValueLabel('pattern_adjustment', 'lengthType', patternValue('lengthType')),
        this.remixValueLabel('fabric_texture', 'fabricType', fabricType),
        this.remixCustomPrompt ? '已填写补充要求' : ''
      ].filter(Boolean).join(' · ')
    },
    canSubmitRemix() {
      const hasQuota = !this.quotaLoaded || this.isVip || this.leftCount > 0
      return this.isSketchRemixEntry && hasQuota && this.hasRemoteClothImage && !this.clothUploadingValue && !this.isGeneratingValue && this.remixRecommendationState !== 'loading' && !this.remixConflictMessage && !this.remixCreatedTaskId
    },
    remixGenerateDisabledReason() {
      if (this.remixCreatedTaskId) return '任务已创建，可在生产记录中查看'
      if (!this.hasRemixImage) return '请先上传原始图片'
      if (this.clothUploadingValue) return '图片上传中，请稍候'
      if (this.clothUploadErrorValue) return '图片上传失败，请重新上传'
      if (!this.hasRemoteClothImage) return '正在准备稳定图片地址'
      if (this.remixRecommendationState === 'loading') return '正在生成改款建议'
      if (this.remixConflictMessage) return this.remixConflictMessage
      if (this.quotaLoaded && !this.isVip && this.leftCount <= 0) return '生成次数不足'
      if (this.isGeneratingValue || this.remixSubmissionState === 'creating') return '正在创建任务，请勿重复操作'
      return ''
    },
    remixSubmitButtonText() {
      if (this.remixCreatedTaskId) return '任务已创建'
      if (!this.hasRemixImage) return '请先上传原始图片'
      if (this.clothUploadingValue) return '图片上传中…'
      if (this.clothUploadErrorValue) return '图片上传失败，请重试'
      if (!this.hasRemoteClothImage) return '正在准备图片…'
      if (this.remixRecommendationState === 'loading') return '正在生成改款建议…'
      if (this.remixConflictMessage) return '请调整冲突配置'
      if (this.quotaLoaded && !this.isVip && this.leftCount <= 0) return '生成次数不足'
      if (this.isGeneratingValue || this.remixSubmissionState === 'creating') return '正在创建任务…'
      return '生成改款效果图'
    },
    currentTaskIdValue() {
      return this.chainState.currentTaskId || this.chainState.taskId || this.chainState.lastTaskId || ''
    },
    currentTaskValue() {
      const taskId = this.currentTaskIdValue
      return (taskId && this.chainState.tasks && this.chainState.tasks.byId && this.chainState.tasks.byId[taskId]) || null
    },
    currentStepValue() {
      return (this.chainState.uiState && this.chainState.uiState.currentStep) || 1
    },
    currentSceneTemplate() {
      const preset = getEntryScenePreset(this.entryScene)
      const baseTemplate = resolveSceneTemplateByEntryScene(this.entryScene)
      const displayCopy = ENTRY_SCENE_DISPLAY_COPY[preset.templateType] || {}
      return {
        ...baseTemplate,
        ...displayCopy
      }
    },
    uploadPageTitle() {
      const titleMap = {
        flat_lay: '平铺图',
        ecommerce_main: '电商主图',
        model_replace: '换模特',
        color_change: '换颜色',
        scene_change: '换场景',
        micro_redesign: '微改款',
        hot_style_remix: '微改款',
        detail_long_image: '自动排版详情长图',
        sketch_to_model: '自由创作',
        print_generate: '自由创作'
      }
      const templateKey = (this.currentSceneTemplate && this.currentSceneTemplate.key) || ''
      return titleMap[this.entryScene] || titleMap[templateKey] || (this.currentSceneTemplate && this.currentSceneTemplate.title) || 'AI 出图'
    },
    isFlatLayEntry() {
      return this.entryScene === 'flat_lay'
    },
    activeFlatLayStyle() {
      return this.flatLayStyleOptions.find((item) => item.value === this.selectedFlatLayStyle) || this.flatLayStyleOptions[0]
    },
    templateType() {
      const options = (this.chainState.draftTask && this.chainState.draftTask.input && this.chainState.draftTask.input.options) || {}
      return options.templateType || (this.currentSceneTemplate && this.currentSceneTemplate.key) || this.entryScene || ''
    },
    sceneTemplateOptions() {
      return SCENE_TEMPLATE_OPTIONS
    },
    showAdvancedSettings() {
      return this.showStyleAdvanced
    },
    currentAdvancedPanelConfigs() {
      return getAdvancedPanelsForEntryScene(this.entryScene)
    },
    currentAdvancedPanels() {
      return this.currentAdvancedPanelConfigs.map((panel) => panel.panelKey)
    },
    currentAdvancedPanelValues() {
      return this.draftParamsValue.advancedPanelValues || {}
    },
    advancedPanelValues() {
      return this.currentAdvancedPanelValues
    },
    generateConfirmSummary() {
      return this.getGenerateConfirmSummary()
    },
    generateConfirmFullText() {
      const summary = this.generateConfirmSummary.fullAdvancedPromptSummary || ''
      if (!summary) {
        return '暂无完整 AI 参考摘要。'
      }
      if (this.showGenerateConfirmFull || summary.length <= 120) {
        return summary
      }
      return `${summary.slice(0, 120)}...`
    },
    generationModeLabel() {
      const option = this.generationModeOptions.find((item) => item.value === this.generationMode)
      return option ? option.label : '标准'
    },
    hasPromptPlanEntry() {
      return true
    },
    canGeneratePromptPlan() {
      return !!(
        this.clothImageValue.localPath ||
        this.getAssetFileId(this.clothImageValue) ||
        this.getAssetFileUrl(this.clothImageValue)
      )
    },
    promptPlanGenerated() {
      return this.promptPlanReady
    },
    promptDraft() {
      return this.formatPromptDraft(this.promptPlan, this.generationMode)
    },
    negativePrompt() {
      return this.promptPlan.negativePrompt || ''
    },
    outputUsage() {
      return this.promptPlan.outputUsage || ''
    },
    entrySceneTip() {
      return this.currentSceneTemplate.sceneTip || ''
    },
    primaryUploadTitle() {
      const titleMap = {
        sketch_to_model: '上传设计稿/线稿',
        image_to_sketch: '上传成衣图/模特图',
        sketch_remix: '上传结构线稿'
      }
      return titleMap[this.entryScene] || '上传服装正面图'
    },
    primaryUploadDesc() {
      const descMap = {
        sketch_to_model: '支持手绘稿、电子线稿、款式图，AI 将生成模特上身效果图',
        image_to_sketch: 'AI 将识别服装结构，生成参考线稿，适合改款分析',
        sketch_remix: '可在高级面板调整领口、袖型、衣长和版型，再生成新款效果图'
      }
      return descMap[this.entryScene] || '主图会写入 clothImage，用于当前生成链路'
    },
    draftTaskValue() {
      return this.chainState.draftTask || {}
    },
    projectIdValue() {
      return this.draftTaskValue.projectId || ''
    },
    batchIdValue() {
      return this.draftTaskValue.batchId || ''
    },
    draftInputValue() {
      return this.draftTaskValue.input || {}
    },
    draftAssetsValue() {
      return this.draftInputValue.assets || {}
    },
    draftParamsValue() {
      return this.draftInputValue.params || {}
    },
    draftOptionsValue() {
      return this.draftInputValue.options || {}
    },
    draftErrorValue() {
      return this.draftTaskValue.error || {}
    },
    draftErrorDetailsValue() {
      return this.draftErrorValue.details || {}
    },
    draftUploadErrorValue() {
      return this.draftErrorDetailsValue.upload || {}
    },
    draftControlValue() {
      return this.draftTaskValue.control || {}
    },
    draftRetryStateValue() {
      return this.draftControlValue.retryState || {}
    },
    draftUploadingStateValue() {
      return this.draftControlValue.uploading || {}
    },
    runtimeTaskValue() {
      return this.currentTaskValue || this.draftTaskValue || {}
    },
    runtimeTaskStatusValue() {
      return this.runtimeTaskValue.status || ''
    },
    runtimeTaskProgressValue() {
      return this.runtimeTaskValue.progress || 0
    },
    runtimeTaskStatusTextValue() {
      return this.runtimeTaskValue.statusText || ''
    },
    runtimeTaskErrorValue() {
      return this.runtimeTaskValue.error || this.draftErrorValue || {}
    },
    runtimeTaskControlValue() {
      return this.runtimeTaskValue.control || this.draftControlValue || {}
    },
    clothUploadErrorValue() {
      return normalizeVisibleUploadError(this.draftUploadErrorValue.clothImage, '服装图片上传失败，请重新上传。')
    },
    styleUploadErrorValue() {
      return normalizeVisibleUploadError(this.draftUploadErrorValue.styleImage, '参考图片上传失败，请重新上传。')
    },
    clothUploadingValue() {
      return !!(this.runtimeTaskControlValue.uploading && this.runtimeTaskControlValue.uploading.clothImage)
    },
    styleUploadingValue() {
      return !!(this.runtimeTaskControlValue.uploading && this.runtimeTaskControlValue.uploading.styleImage)
    },
    clothRetryableValue() {
      return !!(this.runtimeTaskControlValue.retryState && this.runtimeTaskControlValue.retryState.clothImage)
    },
    styleRetryableValue() {
      return !!(this.runtimeTaskControlValue.retryState && this.runtimeTaskControlValue.retryState.styleImage)
    },
    generateRetryableValue() {
      return !!(this.runtimeTaskControlValue.retryState && this.runtimeTaskControlValue.retryState.generate)
    },
    canContinuePollingValue() {
      return !!this.runtimeTaskControlValue.canContinuePolling
    },
    generateErrorValue() {
      return (this.runtimeTaskErrorValue.details && this.runtimeTaskErrorValue.details.generate) || ''
    },
    pollingErrorValue() {
      return (this.runtimeTaskErrorValue.details && this.runtimeTaskErrorValue.details.polling) || ''
    },
    isGeneratingValue() {
      return this.generateInFlight || this.runtimeTaskStatusValue === 'processing' || this.runtimeTaskStatusValue === 'queued' || this.runtimeTaskStatusValue === 'submitted'
    },
    clothImageValue() {
      return this.draftAssetsValue.clothImage || { localPath: '', fileId: '', fileUrl: '' }
    },
    styleImageValue() {
      return this.draftAssetsValue.styleImage || { localPath: '', fileId: '', fileUrl: '' }
    },
    hasRemoteClothImage() {
      return !!(this.getAssetFileId(this.clothImageValue) || this.getAssetFileUrl(this.clothImageValue))
    },
    modelTypeValue() {
      return this.draftParamsValue.modelType || 'female'
    },
    bodyValue() {
      return this.draftParamsValue.bodyType || 'normal'
    },
    kidsAgeValue() {
      return this.draftParamsValue.kidsAgeGroup || 'middle'
    },
    styleTagValue() {
      return this.draftParamsValue.styleTag || 'simple'
    },
    sceneValue() {
      return this.draftParamsValue.sceneType || 'white'
    },
    neckValue() {
      return this.draftParamsValue.neckType || 'round'
    },
    sleeveValue() {
      return this.draftParamsValue.sleeveType || 'long'
    },
    fitValue() {
      return this.draftParamsValue.fitType || 'loose'
    },
    backgroundTypeValue() {
      return this.draftOptionsValue.backgroundType || 'normal'
    },
    outputTypeValue() {
      return this.draftOptionsValue.outputType || 'main'
    },
    selectedStyleCodeValue() {
      return this.draftParamsValue.selectedStyleCode || ''
    },
    selectedSceneCodeValue() {
      return this.draftParamsValue.selectedSceneCode || ''
    },
    selectedBodyTypeValue() {
      return this.draftParamsValue.selectedBodyType || ''
    },
    necklineTypeValue() {
      return this.draftParamsValue.necklineType || ''
    },
    sleeveTypeAdvancedValue() {
      return this.draftParamsValue.sleeveType || ''
    },
    fitTypeAdvancedValue() {
      return this.draftParamsValue.fitType || ''
    },
    lengthTypeValue() {
      return this.draftParamsValue.lengthType || ''
    },
    outputTypesValue() {
      return Array.isArray(this.draftParamsValue.outputTypes) ? this.draftParamsValue.outputTypes : []
    }
  },
  methods: {
    restoreBatchImages() {
      const draft = (getMainChainState().draftTask || {})
      const assets = (draft.input && draft.input.assets) || {}
      const params = (draft.input && draft.input.params) || {}
      const wizard = params.batchWizard && typeof params.batchWizard === 'object' ? params.batchWizard : {}
      const saved = Array.isArray(assets.batchClothImages) ? assets.batchClothImages : []
      this.batchImages = saved.slice(0, BATCH_MODEL_MAX_IMAGES).map((item, index) => ({
        ...item,
        id: item.id || `batch_image_${Date.now()}_${index}`,
        status: (item.fileId || item.fileUrl) ? 'success' : (item.status === 'failed' ? 'failed' : 'pending')
      }))
      const restoredStep = Math.min(5, Math.max(1, Number(wizard.step) || 1))
      this.batchWizardStep = this.batchImages.length ? restoredStep : 1
      this.batchMaxVisitedStep = Math.max(this.batchWizardStep, Math.min(5, Number(wizard.maxVisitedStep) || 1))
      this.batchSelectedPreset = String(wizard.selectedPreset || 'custom')
      this.batchModelProfileId = String(wizard.modelProfileId || '')
    },
    persistBatchImages() {
      const state = getMainChainState()
      const draft = state.draftTask || {}
      const input = draft.input || {}
      const assets = input.assets || {}
      patchMainChainState({
        draftTask: {
          ...draft,
          input: {
            ...input,
            params: {
              ...(input.params || {}),
              batchWizard: {
                step: this.batchWizardStep,
                maxVisitedStep: this.batchMaxVisitedStep,
                selectedPreset: this.batchSelectedPreset,
                modelProfileId: this.batchModelProfileId
              }
            },
            assets: {
              ...assets,
              batchClothImages: this.batchImages.map((item) => ({ ...item }))
            }
          }
        }
      })
      this.chainState = getMainChainState()
    },
    goToBatchWizardStep(step) {
      const target = Math.min(5, Math.max(1, Number(step) || 1))
      if (target > this.batchMaxVisitedStep) return
      this.batchWizardStep = target
      this.persistBatchImages()
    },
    isBatchStepCompleted(step) {
      return this.batchWizardStep > Number(step)
    },
    nextBatchWizardStep() {
      if (!this.batchStepCanContinue) {
        const message = this.batchWizardStep === 1
          ? (this.batchUploadingCount ? '请等待所有图片上传完成' : (this.batchFailedCount ? '请处理上传失败的图片' : '请至少上传 1 张服装图'))
          : '请完成当前步骤'
        uni.showToast({ title: message, icon: 'none' })
        return
      }
      this.batchWizardStep = Math.min(5, this.batchWizardStep + 1)
      this.batchMaxVisitedStep = Math.max(this.batchMaxVisitedStep, this.batchWizardStep)
      this.persistBatchImages()
      if (this.batchWizardStep === 5) this.loadQuotaDisplay()
    },
    previousBatchWizardStep() {
      if (this.batchSubmitting || this.batchQuotaRefreshing) return
      this.batchWizardStep = Math.max(1, this.batchWizardStep - 1)
      this.persistBatchImages()
    },
    batchImageStatusText(item = {}) {
      return {
        pending: '待上传',
        uploading: '上传中',
        success: '已就绪',
        failed: '上传失败'
      }[item.status] || '待处理'
    },
    batchImageMetaText(item = {}) {
      return [item.format, item.sizeText, item.width && item.height ? `${item.width}×${item.height}` : ''].filter(Boolean).join(' · ')
    },
    previewBatchImage(index) {
      const current = this.batchImages[index]
      const urls = this.batchImages.map((item) => item.localPath || item.fileUrl || item.fileId).filter(Boolean)
      const currentUrl = current && (current.localPath || current.fileUrl || current.fileId)
      if (!currentUrl || !urls.length) return
      uni.previewImage({ current: currentUrl, urls })
    },
    moveBatchImage(index, offset) {
      if (this.batchSubmitting || this.batchCreatedId) return
      const target = index + offset
      if (target < 0 || target >= this.batchImages.length) return
      const next = [...this.batchImages]
      const item = next.splice(index, 1)[0]
      next.splice(target, 0, item)
      this.batchImages = next
      this.persistBatchImages()
    },
    batchFieldLabel(field = {}) {
      if (field.key === 'poseType') return '姿势或构图'
      return field.label || ''
    },
    batchFieldOptions(field = {}, group = '') {
      const options = field.options || []
      if (field.key === 'modelType') {
        return group === 'special' ? options.filter((item) => item.value === 'plus_size') : options.filter((item) => item.value !== 'plus_size')
      }
      if (field.key === 'poseType') {
        return group === 'framing' ? options.filter((item) => ['half_body', 'full_body'].includes(item.value)) : options.filter((item) => ['standing', 'sitting'].includes(item.value))
      }
      return options
    },
    batchModeDescription(value = '') {
      return {
        quick: '优先速度，适合批量预览',
        standard: '平衡质量与速度，适合商品图',
        creative: '允许更多视觉变化，适合营销'
      }[value] || ''
    },
    batchPanelSummary(panel = {}, panelKey = '') {
      return (panel.fields || [])
        .filter((field) => field.type === 'select')
        .map((field) => {
          const value = this.getAdvancedFieldValue(panelKey, field)
          const option = (field.options || []).find((item) => item.value === value)
          return option ? option.label : ''
        })
        .filter(Boolean)
        .join(' · ')
    },
    chooseBatchImages() {
      if (this.batchSubmitting || this.batchImages.length >= BATCH_MODEL_MAX_IMAGES) return
      const remaining = BATCH_MODEL_MAX_IMAGES - this.batchImages.length
      uni.chooseImage({
        count: remaining,
        success: async (res) => {
          const paths = Array.isArray(res.tempFilePaths) ? res.tempFilePaths : []
          const files = Array.isArray(res.tempFiles) ? res.tempFiles : []
          for (let index = 0; index < paths.length; index += 1) {
            const localPath = paths[index]
            if (this.batchImages.some((item) => item.localPath === localPath)) {
              uni.showToast({ title: `第 ${index + 1} 张已在上传列表中`, icon: 'none' })
              continue
            }
            const validation = await this.validateSketchImage(localPath, files[index] || {})
            if (!validation.ok) {
              this.batchImages.push({
                id: `batch_image_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                localPath,
                fileId: '',
                fileUrl: '',
                status: 'failed',
                error: validation.message || '图片不符合上传要求',
                validationFailed: true,
                ...(validation.meta || {})
              })
              this.persistBatchImages()
              uni.showToast({ title: `第 ${index + 1} 张：${validation.message}`, icon: 'none' })
              continue
            }
            const item = {
              id: `batch_image_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              localPath,
              fileId: '',
              fileUrl: '',
              status: 'uploading',
              error: '',
              ...validation.meta
            }
            this.batchImages.push(item)
            this.persistBatchImages()
            await this.uploadBatchImage(this.batchImages.length - 1)
          }
        }
      })
    },
    async uploadBatchImage(index) {
      const item = this.batchImages[index]
      if (!item || !item.localPath || this.batchSubmitting) return
      this.$set(this.batchImages, index, { ...item, status: 'uploading', error: '' })
      this.persistBatchImages()
      try {
        const result = await uploadImage({ filePath: item.localPath, scene: 'batch_model_cloth' })
        const fileId = result.fileId || result.file_id || result.fileID || ''
        const fileUrl = result.fileUrl || result.file_url || result.imageUrl || result.url || ''
        if (!fileId && !/^https:\/\//.test(String(fileUrl || ''))) {
          throw new Error('上传结果缺少稳定图片地址')
        }
        this.$set(this.batchImages, index, {
          ...item,
          fileId,
          fileUrl,
          source: result.source || '',
          status: 'success',
          error: '',
          validationFailed: false
        })
        console.log('[batch-model:upload]', { index, success: true, hasFileId: !!fileId, hasHttpsUrl: /^https:\/\//.test(String(fileUrl || '')) })
      } catch (error) {
        this.$set(this.batchImages, index, {
          ...item,
          status: 'failed',
          error: (error && error.message) || '图片上传失败'
        })
        console.warn('[batch-model:upload]', { index, success: false, errorCode: 'BATCH_IMAGE_UPLOAD_FAILED' })
        uni.showToast({ title: `第 ${index + 1} 张上传失败，可单独重试`, icon: 'none' })
      } finally {
        this.persistBatchImages()
      }
    },
    retryBatchImage(index) {
      if (this.batchImages[index] && this.batchImages[index].validationFailed) {
        this.replaceBatchImage(index)
        return
      }
      this.uploadBatchImage(index)
    },
    replaceBatchImage(index) {
      if (this.batchSubmitting || this.batchCreatedId) return
      uni.chooseImage({
        count: 1,
        success: async (res) => {
          const localPath = (res.tempFilePaths || [])[0] || ''
          if (!localPath) return
          if (this.batchImages.some((item, itemIndex) => itemIndex !== index && item.localPath === localPath)) {
            uni.showToast({ title: '这张图片已在上传列表中', icon: 'none' })
            return
          }
          const validation = await this.validateSketchImage(localPath, (res.tempFiles || [])[0] || {})
          if (!validation.ok) {
            this.$set(this.batchImages, index, {
              id: this.batchImages[index].id,
              localPath,
              fileId: '',
              fileUrl: '',
              status: 'failed',
              error: validation.message || '图片不符合上传要求',
              validationFailed: true,
              ...(validation.meta || {})
            })
            this.persistBatchImages()
            uni.showToast({ title: validation.message, icon: 'none' })
            return
          }
          this.$set(this.batchImages, index, {
            id: this.batchImages[index].id,
            localPath,
            fileId: '',
            fileUrl: '',
            status: 'uploading',
            error: '',
            validationFailed: false,
            ...validation.meta
          })
          this.persistBatchImages()
          await this.uploadBatchImage(index)
        }
      })
    },
    removeBatchImage(index) {
      if (this.batchSubmitting || this.batchCreatedId) return
      this.batchImages.splice(index, 1)
      this.persistBatchImages()
    },
    applyBatchModelPreset(preset = {}) {
      this.batchSelectedPreset = String(preset.value || 'custom')
      if (this.batchSelectedPreset === 'custom') {
        this.persistBatchImages()
        return
      }
      this.setGenerationMode(preset.generationMode || 'standard')
      const fields = (this.batchModelPanel.fields || []).reduce((map, field) => ({ ...map, [field.key]: field }), {})
      ;['modelType', 'bodyType', 'poseType'].forEach((key) => {
        if (fields[key] && preset[key]) this.updateAdvancedFieldValue('model_and_body', fields[key], preset[key])
      })
      if (preset.styleCode) {
        const styleField = (this.batchStylePanel.fields || []).find((field) => field.key === 'styleCode')
        if (styleField) this.updateAdvancedFieldValue('style_scene', styleField, preset.styleCode)
      }
      this.persistBatchImages()
    },
    selectBatchPlatform(field = {}, value = '') {
      this.updateAdvancedFieldValue('platform_output', field, value)
      this.batchPlatformRecommendation = {
        taobao: '1:1',
        douyin: '9:16',
        xiaohongshu: '3:4',
        amazon: '1:1 或 4:5',
        independent_site: '按站点版式自定义'
      }[value] || ''
    },
    applyBatchRecommendedRatio() {
      const platformField = (this.batchOutputPanel.fields || []).find((field) => field.key === 'platform')
      const ratioField = (this.batchOutputPanel.fields || []).find((field) => field.key === 'ratio')
      if (!platformField || !ratioField) return
      const platform = this.getAdvancedFieldValue('platform_output', platformField)
      const recommended = { taobao: '1:1', douyin: '9:16', xiaohongshu: '3:4', amazon: '4:5' }[platform]
      if (!recommended) {
        uni.showToast({ title: '请按站点版式选择比例', icon: 'none' })
        return
      }
      this.updateAdvancedFieldValue('platform_output', ratioField, recommended)
      uni.showToast({ title: `已使用 ${recommended} 比例`, icon: 'none' })
    },
    generateBatchRecommendation() {
      const defaults = getDefaultAdvancedPanelValuesForEntryScene('batch_model')
      const changes = []
      this.currentAdvancedPanelConfigs.forEach((panel) => {
        ;(panel.fields || []).filter((field) => field.type === 'select').forEach((field) => {
          const current = this.getAdvancedFieldValue(panel.panelKey, field)
          const recommended = defaults[panel.panelKey] && defaults[panel.panelKey][field.key]
          if (current === recommended) return
          const currentOption = (field.options || []).find((item) => item.value === current)
          const recommendedOption = (field.options || []).find((item) => item.value === recommended)
          changes.push(`${field.label}：${currentOption ? currentOption.label : '未设置'} → ${recommendedOption ? recommendedOption.label : '推荐值'}`)
        })
      })
      this.batchRecommendationChanges = changes
      this.batchRecommendationState = 'ready'
      console.log('[batch-model:recommendation]', { generated: true, source: 'local', panelCount: this.currentAdvancedPanels.length })
    },
    applyBatchRecommendation() {
      const defaults = getDefaultAdvancedPanelValuesForEntryScene('batch_model')
      const advancedPromptPayload = buildAdvancedPromptSummary(defaults, this.currentAdvancedPanelConfigs)
      this.updateAdvancedParams({
        advancedPanelValues: defaults,
        ...advancedPromptPayload,
        selectedAdvancedPanels: this.currentAdvancedPanels,
        costActionType: this.resolveUploadCostActionType('batch_model', { advancedPanelValues: defaults })
      }, 'batchRecommendation')
      this.batchRecommendationState = 'applied'
      this.batchRecommendationChanges = []
      uni.showToast({ title: '已使用统一推荐配置', icon: 'none' })
      console.log('[batch-model:recommendation]', { applied: true, panelCount: this.currentAdvancedPanels.length })
    },
    keepBatchSettings() {
      this.batchRecommendationState = 'idle'
      this.batchRecommendationChanges = []
      uni.showToast({ title: '已保留当前配置', icon: 'none' })
    },
    buildBatchTaskOptions(payload = {}, asset = {}, batchIndex = 0, batchId = '') {
      const preset = getEntryScenePreset('batch_model')
      const clientRequestId = `${batchId || 'batch_pending'}_${asset.id || batchIndex}`
      const modelProfile = this.batchSelectedModelProfile
      return {
        type: preset.taskType || 'ai_model_image',
        projectId: payload.projectId || '',
        channel: 'batch_model',
        clientTaskId: clientRequestId,
        ...(modelProfile ? { run: { fallbackToMock: false } } : {}),
        input: {
          assets: {
            clothImage: {
              localPath: asset.localPath || '',
              fileId: asset.fileId || '',
              fileUrl: asset.fileUrl || ''
            },
            styleImage: { localPath: '', fileId: '', fileUrl: '' },
            ...(modelProfile ? { modelReferenceImage: { localPath: '', fileId: modelProfile.coverFileId || '', fileUrl: modelProfile.coverUrl || '' } } : {})
          },
          params: {
            modelType: payload.modelType || '',
            bodyType: payload.body || '',
            styleTag: payload.styleTag || '',
            sceneType: payload.scene || '',
            backgroundType: payload.bg || '',
            entryScene: 'batch_model',
            templateType: 'batch_model',
            batchStrategy: preset.batchStrategy || 'same_model_same_style',
            batchItemIndex: batchIndex,
            clientRequestId,
            idempotencyKey: clientRequestId,
            modelProfileId: modelProfile ? modelProfile.modelProfileId : '',
            modelReferenceImage: modelProfile ? (modelProfile.coverFileId || modelProfile.coverUrl || '') : '',
            ...(payload.input && payload.input.params ? payload.input.params : {}),
            advancedPanelValues: payload.advancedPanelValues || {},
            advancedCustomPrompts: payload.advancedCustomPrompts || {},
            advancedOptionPrompts: payload.advancedOptionPrompts || {},
            customPromptSummary: payload.customPromptSummary || '',
            optionPromptSummary: payload.optionPromptSummary || '',
            fullAdvancedPromptSummary: payload.fullAdvancedPromptSummary || ''
          },
          options: {
            backgroundType: payload.bg || '',
            outputType: payload.output || ''
          }
        },
        params: {
          entryScene: 'batch_model',
          templateType: 'batch_model',
          outputType: payload.output || '',
          generationMode: payload.generationMode || 'standard',
          outputUsage: payload.outputUsage || '',
          clientRequestId,
          idempotencyKey: clientRequestId,
          costActionType: payload.costActionType || preset.costActionType || 'ai_model_image'
        }
      }
    },
    async loadBatchModelProfiles() {
      if (this.batchModelProfilesLoading) return
      try {
        const selected = uni.getStorageSync(MODEL_PROFILE_SELECTION_KEY)
        if (selected && selected.modelProfileId) {
          this.batchModelProfileId = selected.modelProfileId
          uni.removeStorageSync(MODEL_PROFILE_SELECTION_KEY)
        }
      } catch (error) {
        // Cloud data remains authoritative if the page handoff is unavailable.
      }
      this.batchModelProfilesLoading = true
      const result = await getModelProfiles({ scope: 'personal' })
      this.batchModelProfilesLoading = false
      if (!result.ok) return
      this.batchModelProfiles = (result.data && result.data.profiles) || []
      if (!this.batchModelProfiles.some((item) => item.modelProfileId === this.batchModelProfileId)) this.batchModelProfileId = ''
    },
    selectBatchModelProfile(profile = {}) {
      if (!profile.modelProfileId || profile.status !== 'active') return
      this.batchModelProfileId = this.batchModelProfileId === profile.modelProfileId ? '' : profile.modelProfileId
      this.persistBatchImages()
    },
    openBatchModelProfiles() {
      uni.navigateTo({ url: '/package-assets/model-profiles/model-profiles?select=1', fail: () => uni.showToast({ title: '常用模特暂时无法打开', icon: 'none' }) })
    },
    openBatchMembership() {
      uni.navigateTo({
        url: '/pages/package-center/package-center',
        fail: () => uni.showToast({ title: '会员中心暂时无法打开', icon: 'none' })
      })
    },
    reduceBatchGenerationCount() {
      this.batchWizardStep = 1
      this.persistBatchImages()
      uni.showToast({ title: '请删除暂不生成的服装图', icon: 'none' })
    },
    async submitBatchModel() {
      if (this.batchSubmitting || this.batchQuotaRefreshing || this.batchCreatedId) return
      if (!this.canSubmitBatch) {
        uni.showToast({ title: this.batchSubmitReason, icon: 'none' })
        return
      }
      const runtime = getRuntimeGenerationConfig({ providerSupported: false, experimentalProviderSupported: true, provider: 'wanx', modelName: 'qwen-image-2.0-pro', taskType: 'ai_model_image' })
      if (!runtime.realProviderTest || !runtime.canManageTesting) {
        uni.showToast({ title: runtime.disabledReason || '仅内部测试账号可提交真实批量任务', icon: 'none' })
        return
      }
      const confirmed = await new Promise((resolve) => {
        uni.showModal({
          title: '确认真实批量测试',
          content: `将串行调用 ${this.batchImages.length} 次真实 API，并按每个子任务分别扣费；失败项自动回滚。`,
          confirmText: '确认提交',
          success: ({ confirm }) => resolve(Boolean(confirm)),
          fail: () => resolve(false)
        })
      })
      if (!confirmed) return
      this.batchQuotaRefreshing = true
      const latestUsage = await refreshMembershipUsage()
      this.batchQuotaRefreshing = false
      if (!latestUsage || !latestUsage.ok || !latestUsage.data || !latestUsage.data.available) {
        uni.showToast({ title: '暂时无法确认可用次数，请重试', icon: 'none' })
        return
      }
      this.leftCount = Number(latestUsage.data.remaining || 0)
      this.quotaLoaded = true
      if (!this.batchHasEnoughQuota) {
        uni.showToast({ title: `生成次数不足，还差 ${this.batchQuotaShortfall} 次`, icon: 'none' })
        return
      }
      this.batchSubmitting = true
      this.batchSubmissionState = 'creating'
      const requestedBatchId = createBatchId()
      try {
        const payload = this.buildGeneratePayload()
        const children = this.batchImages.map((item, index) => this.buildBatchTaskOptions(payload, item, index, requestedBatchId))
        let batch = createBatchRecord({ batchId: requestedBatchId, totalCount: children.length, batchConfig: { modelCount: children.length, colorCount: 1, sceneCount: 1 } })
        for (const child of children) {
          const task = await createInternalRealGenerationTask({ ...child, batchId: requestedBatchId }, runtime)
          batch = attachBatchTask(requestedBatchId, task.taskId)
        }
        this.batchCreatedId = batch.batchId
        this.batchSubmissionState = 'created'
        if (!this.isVip && this.quotaLoaded) this.leftCount = Math.max(0, this.leftCount - batch.taskIds.length)
        console.log('[batch-model:create]', { success: true, itemCount: children.length, taskCount: batch.taskIds.length, hasBatchId: !!batch.batchId })
        const firstTaskId = batch.taskIds[0] || ''
        uni.navigateTo({
          url: `/package-ai/result/result?taskId=${encodeURIComponent(firstTaskId)}&batchId=${encodeURIComponent(batch.batchId)}`,
          fail: () => uni.showToast({ title: '批量任务已创建，请前往任务中心查看', icon: 'none', duration: 2600 })
        })
      } catch (error) {
        this.batchCreatedId = requestedBatchId
        this.batchSubmissionState = 'unknown'
        console.warn('[batch-model:create]', { success: false, itemCount: this.batchImages.length, errorCode: 'BATCH_CREATE_FAILED' })
        uni.showModal({
          title: '批量任务状态待确认',
          content: '创建过程中出现异常。为避免重复扣除，本页不会自动重试，请先前往任务中心确认。',
          showCancel: false
        })
      } finally {
        this.batchSubmitting = false
      }
    },
    loadQuotaDisplay() {
      const result = getMembershipUsage()
      if (!result || !result.ok || !result.data) {
        this.quotaLoaded = false
        return
      }
      this.leftCount = Number(result.data.remaining || 0)
      this.isVip = false
      this.quotaLoaded = true
    },
    sketchLevelLabel(value = '') {
      return { simple: '简易', standard: '标准', fine: '精细' }[value] || '标准'
    },
    sketchFieldTitle(field = {}) {
      return { sketchLevel: '线稿精度', includeLabels: '标注结构', includeCraftNotes: '工艺说明' }[field.key] || field.label || ''
    },
    sketchFieldOptions(field = {}) {
      if (field.type === 'switch') {
        const labels = field.key === 'includeCraftNotes' ? ['生成', '不生成'] : ['开启', '关闭']
        return [{ value: true, label: labels[0] }, { value: false, label: labels[1] }]
      }
      const descriptions = {
        simple: '保留主要轮廓',
        standard: '保留版型和主要结构',
        fine: '增强缝线、拼接和辅料细节'
      }
      return (field.options || []).map((item) => ({ ...item, desc: descriptions[item.value] || '' }))
    },
    generateSketchRecommendation() {
      if (!this.hasRemoteClothImage || this.clothUploadingValue) {
        uni.showToast({ title: '请等待服装图片上传完成', icon: 'none' })
        return
      }
      this.sketchRecommendationState = 'loading'
      const recommendationMap = {
        quick: { sketchLevel: 'simple', includeLabels: true, includeCraftNotes: false },
        standard: { sketchLevel: 'standard', includeLabels: true, includeCraftNotes: true },
        creative: { sketchLevel: 'fine', includeLabels: true, includeCraftNotes: true }
      }
      this.sketchRecommendation = { ...(recommendationMap[this.generationMode] || recommendationMap.standard) }
      this.sketchRecommendationState = 'ready'
    },
    applySketchRecommendation() {
      if (!this.sketchRecommendation) return
      const fields = this.sketchBasicFields.reduce((result, field) => { result[field.key] = field; return result }, {})
      Object.keys(this.sketchRecommendation).forEach((key) => {
        if (fields[key]) this.updateAdvancedFieldValue('image_to_sketch', fields[key], this.sketchRecommendation[key])
      })
      this.generatePromptPlan()
      this.sketchRecommendationState = 'applied'
      uni.showToast({ title: '推荐设置已应用', icon: 'success' })
    },
    updateSketchCustomPrompt(value = '') {
      const field = (this.sketchPanelConfig.fields || []).find((item) => item.key === 'customPrompt')
      if (field) this.updateAdvancedFieldValue('image_to_sketch', field, String(value || '').slice(0, 200))
    },
    continueSketchDraft() {
      this.sketchDraftDetected = false
    },
    restartSketchDraft() {
      this.sketchDraftDetected = false
      this.resetSketchImage()
      this.syncEntrySceneTemplateContext(undefined, { resetStep: true })
      const state = getMainChainState()
      const draftTask = state.draftTask || {}
      const input = draftTask.input || {}
      this.chainState = patchMainChainState({
        draftTask: {
          ...draftTask,
          input: {
            ...input,
            params: {
              ...(input.params || {}),
              advancedPanelValues: getDefaultAdvancedPanelValuesForEntryScene('image_to_sketch'),
              promptDraft: '',
              promptPlan: null
            }
          }
        }
      })
      this.generationMode = 'standard'
      this.promptPlanReady = false
      this.showStyleAdvanced = false
    },
    resetSketchImage() {
      this.sketchImageMeta = { format: '', width: 0, height: 0, size: 0, sizeText: '' }
      this.sketchRecommendationState = 'idle'
      this.sketchRecommendation = null
      this.sketchSubmissionState = 'idle'
      this.sketchCreatedTaskId = ''
      this.resetClothImage()
    },
    clearSketchDraftAfterTaskCreated() {
      const state = getMainChainState()
      const draftTask = state.draftTask || {}
      const input = draftTask.input || {}
      const params = input.params || {}
      this.chainState = patchMainChainState({
        draftTask: {
          ...draftTask,
          input: {
            ...input,
            assets: { ...(input.assets || {}), clothImage: {} },
            params: { ...params, promptDraft: '', promptPlan: null }
          }
        }
      })
    },
    formatSketchFileSize(size = 0) {
      if (!size) return ''
      if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))}KB`
      return `${(size / 1024 / 1024).toFixed(1)}MB`
    },
    getSketchImageInfo(localPath = '') {
      return new Promise((resolve) => {
        if (!localPath || typeof uni.getImageInfo !== 'function') { resolve({}); return }
        uni.getImageInfo({ src: localPath, success: resolve, fail: () => resolve({}) })
      })
    },
    async validateSketchImage(localPath = '', tempFile = {}) {
      const info = await this.getSketchImageInfo(localPath)
      const pathExtension = String(localPath || '').split('?')[0].split('.').pop().toLowerCase()
      const format = String(info.type || (SKETCH_ALLOWED_IMAGE_TYPES.includes(pathExtension) ? pathExtension : '')).toLowerCase()
      const size = Number(tempFile.size || 0)
      if (format && !SKETCH_ALLOWED_IMAGE_TYPES.includes(format)) return { ok: false, message: '仅支持 JPG、PNG 或 WEBP 图片。' }
      if (size > SKETCH_MAX_IMAGE_BYTES) return { ok: false, message: '图片不能超过 10MB，请压缩后重试。' }
      if (info.width && info.height && Math.min(info.width, info.height) < SKETCH_MIN_IMAGE_EDGE) return { ok: false, message: '图片宽高至少需要 256px，请选择更清晰的图片。' }
      return {
        ok: true,
        meta: {
          format: format ? format.toUpperCase().replace('JPEG', 'JPG') : '',
          width: Number(info.width || 0),
          height: Number(info.height || 0),
          size,
          sizeText: this.formatSketchFileSize(size)
        }
      }
    },
    submitSketchGenerate() {
      if (!this.canSubmitSketch) {
        uni.showToast({ title: this.sketchSubmitButtonText, icon: 'none' })
        return
      }
      this.startGenerate()
    },
    styleSketchFieldTitle(field = {}) {
      return {
        neckType: '领口',
        sleeveType: '袖型',
        fitType: '版型',
        lengthType: '衣长',
        pocketEnabled: '口袋'
      }[field.key] || field.label || ''
    },
    styleSketchFieldOptions(field = {}) {
      if (field.type === 'switch') {
        if (field.key === 'keepSketchStructure') {
          return [
            { value: true, label: '保留原结构' },
            { value: false, label: '允许结构调整' }
          ]
        }
        return [
          { value: false, label: '不新增口袋' },
          { value: true, label: '添加口袋' }
        ]
      }
      const options = Array.isArray(field.options) ? field.options : []
      if (field.key === 'fitType') {
        return options
          .filter((option) => option.value !== 'cropped')
          .map((option) => option.value === 'oversize' ? { ...option, label: '超宽松' } : option)
      }
      return options.map((option) => option.value === 'oversize' ? { ...option, label: '超宽松' } : option)
    },
    styleSketchValueLabel(fieldKey = '', value) {
      if (fieldKey === 'pocketEnabled') return value ? '添加口袋' : '不添加口袋'
      const fields = [...this.styleSketchPatternFields, ...this.styleSketchAdvancedFields]
      const field = fields.find((item) => item.key === fieldKey)
      const option = field && (field.options || []).find((item) => item.value === value)
      return option ? option.label : ''
    },
    generateStyleSketchRecommendation() {
      if (!this.hasRemoteClothImage || this.clothUploadingValue) {
        uni.showToast({ title: '请等待服装图片上传完成', icon: 'none' })
        return
      }
      this.styleSketchRecommendationState = 'loading'
      const recommendationMap = {
        quick: { neckType: 'round', sleeveType: 'long', fitType: 'standard', lengthType: 'regular', pocketEnabled: false },
        standard: { neckType: 'v', sleeveType: 'long', fitType: 'standard', lengthType: 'regular', pocketEnabled: false },
        creative: { neckType: 'v', sleeveType: 'puff', fitType: 'waist_fitted', lengthType: 'mid_long', pocketEnabled: true }
      }
      this.styleSketchRecommendation = { ...(recommendationMap[this.generationMode] || recommendationMap.standard) }
      this.styleSketchRecommendationState = 'ready'
    },
    applyStyleSketchRecommendation() {
      if (!this.styleSketchRecommendation) return
      const fields = this.styleSketchPatternFields.reduce((result, field) => {
        result[field.key] = field
        return result
      }, {})
      Object.keys(this.styleSketchRecommendation).forEach((key) => {
        if (fields[key]) this.updateAdvancedFieldValue('pattern_adjustment', fields[key], this.styleSketchRecommendation[key])
      })
      this.generatePromptPlan()
      this.styleSketchRecommendationState = 'applied'
      uni.showToast({ title: '改款建议已应用', icon: 'success' })
    },
    updateStyleSketchCustomPrompt(value = '') {
      const field = (this.styleSketchPatternPanel.fields || []).find((item) => item.key === 'customPrompt')
      if (field) this.updateAdvancedFieldValue('pattern_adjustment', field, String(value || '').slice(0, 200))
    },
    continueStyleSketchDraft() {
      this.styleSketchDraftDetected = false
    },
    restartStyleSketchDraft() {
      this.styleSketchDraftDetected = false
      this.resetStyleSketchImage()
      this.syncEntrySceneTemplateContext(undefined, { resetStep: true })
      const state = getMainChainState()
      const draftTask = state.draftTask || {}
      const input = draftTask.input || {}
      this.chainState = patchMainChainState({
        draftTask: {
          ...draftTask,
          input: {
            ...input,
            params: {
              ...(input.params || {}),
              advancedPanelValues: getDefaultAdvancedPanelValuesForEntryScene('text_to_sketch'),
              promptDraft: '',
              promptPlan: null
            }
          }
        }
      })
      this.generationMode = 'standard'
      this.promptPlanReady = false
      this.showStyleAdvanced = false
      this.styleSketchAdvancedExpanded = false
    },
    resetStyleSketchImage() {
      this.styleSketchImageMeta = { format: '', width: 0, height: 0, size: 0, sizeText: '' }
      this.styleSketchRecommendationState = 'idle'
      this.styleSketchRecommendation = null
      this.styleSketchSubmissionState = 'idle'
      this.styleSketchCreatedTaskId = ''
      this.resetClothImage()
    },
    clearStyleSketchDraftAfterTaskCreated() {
      const state = getMainChainState()
      const draftTask = state.draftTask || {}
      const input = draftTask.input || {}
      const params = input.params || {}
      this.chainState = patchMainChainState({
        draftTask: {
          ...draftTask,
          input: {
            ...input,
            assets: { ...(input.assets || {}), clothImage: {} },
            params: { ...params, promptDraft: '', promptPlan: null }
          }
        }
      })
    },
    submitStyleSketchGenerate() {
      if (!this.canSubmitStyleSketch) {
        uni.showToast({ title: this.styleSketchConflictMessage || this.styleSketchSubmitButtonText, icon: 'none' })
        return
      }
      this.ensurePromptPlanReady()
      this.startGenerate()
    },
    normalizeRemixFabricBinding() {
      const fabricField = this.remixFabricFields.find((field) => field.key === 'fabricType')
      if (!fabricField) return
      const visibleValue = this.getAdvancedFieldValue('fabric_texture', fabricField)
      const linkedField = (this.remixPresentationPanel.fields || []).find((field) => field.key === 'fabricType')
      const linkedValue = linkedField ? this.getAdvancedFieldValue('sketch_to_model', linkedField) : ''
      if (visibleValue && visibleValue !== linkedValue) {
        this.updateAdvancedFieldValue('fabric_texture', fabricField, visibleValue)
      }
    },
    remixFieldTitle(field = {}) {
      return {
        fabricType: '面料类型',
        fabricColor: '面料颜色',
        textureStrength: '质感强度',
        replaceScope: '调整范围',
        keepSketchStructure: '结构保留',
        modelType: '展示模特',
        realismLevel: '效果类型'
      }[field.key] || field.label || ''
    },
    remixValueLabel(panelKey = '', fieldKey = '', value) {
      const panels = {
        pattern_adjustment: this.remixPatternPanel,
        fabric_texture: this.remixFabricPanel,
        sketch_to_model: this.remixPresentationPanel
      }
      const field = ((panels[panelKey] && panels[panelKey].fields) || []).find((item) => item.key === fieldKey)
      if (field && field.type === 'switch') {
        if (fieldKey === 'keepSketchStructure') return value ? '保留原结构' : '允许结构调整'
        return value ? '添加口袋' : '不新增口袋'
      }
      const option = field && (field.options || []).find((item) => item.value === value)
      if (!option) return ''
      if (option.value === 'oversize') return '超宽松'
      return option.label
    },
    generateRemixRecommendation() {
      if (!this.hasRemoteClothImage || this.clothUploadingValue) {
        uni.showToast({ title: '请等待结构线稿上传完成', icon: 'none' })
        return
      }
      this.remixRecommendationState = 'loading'
      const recommendationMap = {
        quick: { neckType: 'round', sleeveType: 'long', fitType: 'standard', lengthType: 'regular', pocketEnabled: false },
        standard: { neckType: 'v', sleeveType: 'long', fitType: 'standard', lengthType: 'regular', pocketEnabled: false },
        creative: { neckType: 'v', sleeveType: 'puff', fitType: 'waist_fitted', lengthType: 'mid_long', pocketEnabled: true }
      }
      this.remixRecommendation = { ...(recommendationMap[this.generationMode] || recommendationMap.standard) }
      this.remixRecommendationState = 'ready'
    },
    applyRemixRecommendation() {
      if (!this.remixRecommendation) return
      const fields = this.remixPatternFields.reduce((result, field) => {
        result[field.key] = field
        return result
      }, {})
      Object.keys(this.remixRecommendation).forEach((key) => {
        if (fields[key]) this.updateAdvancedFieldValue('pattern_adjustment', fields[key], this.remixRecommendation[key])
      })
      this.generatePromptPlan()
      this.remixRecommendationState = 'applied'
      uni.showToast({ title: '改款建议已应用', icon: 'success' })
    },
    updateRemixCustomPrompt(value = '') {
      const nextValue = String(value || '').slice(0, 200)
      ;[
        ['pattern_adjustment', this.remixPatternPanel],
        ['fabric_texture', this.remixFabricPanel],
        ['sketch_to_model', this.remixPresentationPanel]
      ].forEach(([panelKey, panel]) => {
        const field = (panel.fields || []).find((item) => item.key === 'customPrompt')
        if (field) this.updateAdvancedFieldValue(panelKey, field, nextValue)
      })
    },
    continueRemixDraft() {
      this.remixDraftDetected = false
    },
    restartRemixDraft() {
      this.remixDraftDetected = false
      this.resetRemixImage()
      this.syncEntrySceneTemplateContext(undefined, { resetStep: true })
      const state = getMainChainState()
      const draftTask = state.draftTask || {}
      const input = draftTask.input || {}
      this.chainState = patchMainChainState({
        draftTask: {
          ...draftTask,
          input: {
            ...input,
            params: {
              ...(input.params || {}),
              advancedPanelValues: getDefaultAdvancedPanelValuesForEntryScene('sketch_remix'),
              promptDraft: '',
              promptPlan: null
            }
          }
        }
      })
      this.generationMode = 'standard'
      this.promptPlanReady = false
      this.remixFabricExpanded = false
      this.showStyleAdvanced = false
    },
    resetRemixImage() {
      this.remixImageMeta = { format: '', width: 0, height: 0, size: 0, sizeText: '' }
      this.remixRecommendationState = 'idle'
      this.remixRecommendation = null
      this.remixSubmissionState = 'idle'
      this.remixCreatedTaskId = ''
      this.resetClothImage()
    },
    clearRemixDraftAfterTaskCreated() {
      const state = getMainChainState()
      const draftTask = state.draftTask || {}
      const input = draftTask.input || {}
      const params = input.params || {}
      this.chainState = patchMainChainState({
        draftTask: {
          ...draftTask,
          input: {
            ...input,
            assets: { ...(input.assets || {}), clothImage: {} },
            params: { ...params, promptDraft: '', promptPlan: null }
          }
        }
      })
    },
    submitRemixGenerate() {
      if (!this.canSubmitRemix) {
        uni.showToast({ title: this.remixConflictMessage || this.remixSubmitButtonText, icon: 'none' })
        return
      }
      this.ensurePromptPlanReady()
      this.startGenerate()
    },
    closeAllBlockingModals() {
      this.showPayModal = false
      this.showShare = false
    },
    openPayModal() {
      this.showShare = false
      this.showPayModal = true
    },
    closePayModal() {
      this.showPayModal = false
    },
    openShareModal() {
      this.showPayModal = false
      this.showShare = true
    },
    closeShareModal() {
      this.showShare = false
    },
    applyLegacyEntryParams(params = {}) {
      const state = getMainChainState()
      const draftTask = state.draftTask || {}
      const currentInput = draftTask.input || {}
      const currentParams = currentInput.params || {}
      const currentOptions = currentInput.options || {}
      const toolType = params.toolType || ''
      const taskType = params.taskType || toolType || ''
      const nextParams = {
        ...currentParams
      }
      const nextOptions = {
        ...currentOptions
      }
      if (toolType) {
        nextParams.toolType = toolType
      }
      if (taskType) {
        nextParams.taskType = taskType
      }
      if (params.sceneType) {
        nextParams.sceneType = params.sceneType
      }
      if (params.outputType) {
        nextOptions.outputType = params.outputType
      }
      this.chainState = patchMainChainState({
        draftTask: {
          ...draftTask,
          taskType: taskType || draftTask.taskType,
          input: {
            ...currentInput,
            params: nextParams,
            options: nextOptions
          }
        }
      })
      console.log('[upload:legacy-entry] params applied', {
        toolType,
        taskType,
        outputType: params.outputType || '',
        sceneType: params.sceneType || ''
      })
    },
    selectSceneTemplate(templateKey) {
      const preset = getEntryScenePreset(templateKey)
      const template = resolveSceneTemplateByEntryScene(templateKey)
      this.entryScene = template.key
      this.showTemplatePicker = false
      this.syncEntrySceneTemplateContext(template)
      console.log('[upload:template] switched', {
        entryScene: this.entryScene,
        templateType: template.key,
        templateName: template.title
      })
    },
    syncEntrySceneTemplateContext(template = this.currentSceneTemplate, options = {}) {
      const preset = getEntryScenePreset(template && template.key)
      const currentState = getMainChainState()
      const currentDraftTask = currentState.draftTask || {}
      const currentInput = currentDraftTask.input || {}
      const currentParams = currentInput.params || {}
      const currentOptions = currentInput.options || {}
      const defaults = template.defaultParams || {}
      const defaultParams = buildDefaultParamsForEntryScene(preset.templateType)
      const panelConfigs = getAdvancedPanelsForEntryScene(preset.templateType)
      const selectedAdvancedPanels = panelConfigs.map((panel) => panel.panelKey)
      const defaultAdvancedPanelValues = getDefaultAdvancedPanelValuesForEntryScene(preset.templateType)
      const nextParams = {
        ...currentParams,
        ...defaultParams,
        selectedAdvancedPanels,
        advancedPanelValues: {
          ...defaultAdvancedPanelValues,
          ...(currentParams.advancedPanelValues || {})
        }
      }
      nextParams.costActionType = this.resolveUploadCostActionType(preset.templateType, nextParams)
      Object.assign(nextParams, buildAdvancedPromptSummary(nextParams.advancedPanelValues, panelConfigs))
      const nextOptions = {
        ...currentOptions
      }
      const outputTypeLooksLikeRatio = /^\d+:\d+$/.test(String(nextOptions.outputType || ''))
      const shouldClearStyleImage = !!options.resetStep && MVP_PRIMARY_CLOTH_SCENE_SET.has(preset.templateType)
      const currentAssets = currentInput.assets || {}
      const nextAssets = shouldClearStyleImage
        ? {
            ...currentAssets,
            styleImage: {}
          }
        : currentAssets

      if (!nextParams.modelType && defaults.modelType) {
        nextParams.modelType = defaults.modelType
      }
      if (!nextParams.sceneType && defaults.sceneType) {
        nextParams.sceneType = defaults.sceneType
      }
      if (!nextOptions.outputRatio && outputTypeLooksLikeRatio) {
        nextOptions.outputRatio = nextOptions.outputType
      }
      if (!nextOptions.outputRatio && defaults.outputRatio) {
        nextOptions.outputRatio = defaults.outputRatio
      }
      if (!nextOptions.backgroundType && defaults.backgroundType) {
        nextOptions.backgroundType = defaults.backgroundType
      }

      patchMainChainState({
        draftTask: {
          ...currentDraftTask,
          input: {
            ...currentInput,
            assets: nextAssets,
            params: nextParams,
            options: {
              ...nextOptions,
              templateType: template.key,
              templateName: template.title,
              templatePreset: {
                ...(nextOptions.templatePreset || {}),
                ...defaults,
                focus: template.focus
              }
            }
          }
        },
        uiState: {
          ...(currentState.uiState || {}),
          entryScene: preset.templateType,
          currentStep: options.resetStep ? 1 : (currentState.uiState && currentState.uiState.currentStep) || 1
        }
      })
      this.entryScene = preset.templateType
      this.showStyleAdvanced = !!preset.advancedPanelDefaultOpen
      this.activeAdvancedPanel = this.resolveAdvancedPanelKey(preset.defaultOpenPanel, selectedAdvancedPanels)
      this.chainState = getMainChainState()
      if (shouldClearStyleImage) {
        console.log('[upload:mvp] cleared stale styleImage', {
          entryScene: preset.templateType,
          hasStyleImage: false
        })
      }
      console.log('[upload:template] initialized', {
        entryScene: preset.templateType,
        templateType: preset.templateType,
        templateName: template.title
      })
      console.log('[upload:entry-scene] preset applied', {
        entryScene: preset.templateType,
        templateType: defaultParams.templateType,
        finalStyleCode: defaultParams.finalStyleCode,
        finalSceneCode: defaultParams.finalSceneCode,
        finalBodyType: defaultParams.finalBodyType,
        outputTypes: defaultParams.outputTypes,
        selectedAdvancedPanels,
        activeAdvancedPanel: this.activeAdvancedPanel,
        advancedPanelDefaultOpen: preset.advancedPanelDefaultOpen,
        defaultOpenPanel: preset.defaultOpenPanel || ''
      })
    },
    goToTaskList() {
      uni.navigateTo({
        url: '/package-assets/task-list/task-list'
      })
    },
    updateChainState(patch) {
      syncDraftTaskToState(patch)
      this.chainState = getMainChainState()
    },
    selectFlatLayStyle(style = {}, refreshPromptPlan = true) {
      if (!style.value) return
      this.selectedFlatLayStyle = style.value
      this.updateAdvancedParams({
        entryScene: 'flat_lay',
        flatLayStyle: style.value,
        flatLayStyleName: style.label || '',
        flatLayStylePrompt: style.prompt || '',
        sceneType: style.sceneType || 'white',
        styleTag: style.styleTag || 'clean_ecommerce',
        optionPromptSummary: style.prompt || ''
      }, 'flatLayStyle')
      if (refreshPromptPlan && this.promptPlanReady) {
        this.promptPlan = this.buildPromptPlan(this.generationMode)
        this.syncPromptPlanToDraft()
      }
    },
    getPromptTokenLabel(value, fallback = '自动识别') {
      const map = {
        female: '女装模特',
        male: '男装模特',
        kids: '童装模特',
        slim: '偏瘦体型',
        normal: '标准体型',
        curvy: '微胖体型',
        korean: '韩系',
        ins: 'INS 风',
        simple: '简约棚拍',
        japanese: '日系',
        sweet: '甜美风',
        casual: '休闲风',
        white: '白底图',
        gray: '浅灰背景',
        blue: '浅蓝背景',
        living: '居家场景',
        studio: '摄影棚',
        street: '街拍场景',
        main: '电商主图',
        detail: '详情页素材',
        round: '圆领',
        v: 'V 领',
        polo: 'POLO 领',
        short: '短袖',
        long: '长袖',
        loose: '宽松版型',
        tight: '修身版型'
      }
      return map[value] || fallback
    },
    buildPromptPlan(mode = this.generationMode) {
      if (this.isSketchRemixEntry) {
        const patternValues = this.remixPatternFields.reduce((result, field) => {
          result[field.key] = this.getAdvancedFieldValue('pattern_adjustment', field)
          return result
        }, {})
        const fabricValues = this.remixFabricFields.reduce((result, field) => {
          result[field.key] = this.getAdvancedFieldValue('fabric_texture', field)
          return result
        }, {})
        const direction = [
          this.remixValueLabel('pattern_adjustment', 'neckType', patternValues.neckType),
          this.remixValueLabel('pattern_adjustment', 'sleeveType', patternValues.sleeveType),
          this.remixValueLabel('pattern_adjustment', 'fitType', patternValues.fitType),
          this.remixValueLabel('pattern_adjustment', 'lengthType', patternValues.lengthType),
          patternValues.pocketEnabled ? '添加口袋' : '不新增口袋'
        ].filter(Boolean).join('、')
        const fabricDirection = [
          this.remixValueLabel('fabric_texture', 'fabricType', fabricValues.fabricType),
          this.remixValueLabel('fabric_texture', 'fabricColor', fabricValues.fabricColor),
          this.remixValueLabel('fabric_texture', 'textureStrength', fabricValues.textureStrength)
        ].filter(Boolean).join('、')
        const modeHint = mode === 'quick'
          ? '控制改款幅度，优先快速预览。'
          : mode === 'creative'
            ? '允许更明显的款式和面料变化，用于方案探索。'
            : '平衡线稿结构还原与成图质量。'
        return {
          clothingDescription: `以结构线稿为原始设计，按${direction}调整款式，面料效果为${fabricDirection}。${modeHint}${this.remixCustomPrompt ? ` 补充要求：${this.remixCustomPrompt}` : ''}`,
          modelSetting: '按当前展示设置生成服装效果，人物不遮挡领口、袖口和衣身结构。',
          sceneSetting: '使用简洁背景展示改款结果，保持服装主体完整。',
          poseSetting: '正面或轻微侧身展示，清楚呈现改款后的轮廓和衣长。',
          outputUsage: '用于线稿改款预览、款式沟通和效果确认。',
          negativePrompt: '不要显示文字水印，不要裁切服装主体，不要加入未选择的结构变化。'
        }
      }
      if (this.isTextToSketchEntry) {
        const values = this.styleSketchPatternFields.reduce((result, field) => {
          result[field.key] = this.getAdvancedFieldValue('pattern_adjustment', field)
          return result
        }, {})
        const direction = [
          this.styleSketchValueLabel('neckType', values.neckType),
          this.styleSketchValueLabel('sleeveType', values.sleeveType),
          this.styleSketchValueLabel('fitType', values.fitType),
          this.styleSketchValueLabel('lengthType', values.lengthType),
          values.pocketEnabled ? '添加口袋' : '不添加口袋'
        ].filter(Boolean).join('、')
        const modeHint = mode === 'quick'
          ? '优先快速预览，控制改款幅度。'
          : mode === 'creative'
            ? '允许更明显的款式变化，用于方案探索。'
            : '平衡结构细节与生成稳定性。'
        return {
          clothingDescription: `以上传服装为原款参考，按${direction}进行款式起稿。${modeHint}${this.styleSketchCustomPrompt ? ` 补充要求：${this.styleSketchCustomPrompt}` : ''}`,
          modelSetting: '以服装设计草图为主体，不生成抢占画面的真人模特。',
          sceneSetting: '使用简洁背景呈现款式设计，避免无关场景干扰。',
          poseSetting: '保持服装正面结构清楚，完整呈现领口、袖型、衣长和轮廓。',
          outputUsage: '用于服装款式方向预览和设计沟通。',
          negativePrompt: '不要显示文字水印，不要裁切服装主体，不要加入未选择的结构变化。'
        }
      }
      if (this.isImageToSketchEntry) {
        const modeHint = mode === 'quick'
          ? '优先提取主要轮廓和关键结构，保持原版型比例。'
          : mode === 'creative'
            ? '增强缝线、拼接和辅料细节，允许轻量整理结构表达。'
            : '平衡轮廓与结构细节，清楚呈现领口、袖型、衣长和主要拼接线。'
        return {
          clothingDescription: `识别上传服装的真实版型与结构，${modeHint}`,
          modelSetting: '不生成模特，不改变服装版型、颜色、纹理和图案。',
          sceneSetting: '使用干净白底的结构线稿表达，不保留原场景。',
          poseSetting: '保持服装正面比例，线条清晰、结构关系准确。',
          outputUsage: '用于服装结构分析、改款沟通和后续设计参考。',
          negativePrompt: '不要生成真人，不要增加新款式，不要改变原服装比例，不要加入背景、文字水印或无关装饰。'
        }
      }
      if (this.isFlatLayEntry) {
        const flatLayStyle = this.activeFlatLayStyle || FLAT_LAY_STYLE_OPTIONS[0]
        return {
          clothingDescription: '识别上传服装的品类、颜色、版型和材质，保持衣身、领口、袖口与下摆完整，不改变原服装设计。',
          modelSetting: '不使用真人模特，以服装单品平铺展示为主体。',
          sceneSetting: `${flatLayStyle.prompt}。`,
          poseSetting: '服装自然完整展开，衣身居中，边缘整齐，褶皱真实克制，避免裁切主体。',
          outputUsage: `${flatLayStyle.label}平铺商品图，可用于商品上架、详情页或品牌内容。`,
          negativePrompt: '不要真人模特，不要衣架，不要改变服装颜色和款式，不要增加无关配饰，不要文字水印，不要裁切服装主体。'
        }
      }
      const modelLabel = this.getPromptTokenLabel(this.modelTypeValue, '服装模特')
      const bodyLabel = this.getPromptTokenLabel(this.bodyValue, '标准体型')
      const styleLabel = this.getPromptTokenLabel(this.styleTagValue, '简约电商风格')
      const sceneLabel = this.getPromptTokenLabel(this.sceneValue, '白底图')
      const outputLabel = this.getPromptTokenLabel(this.outputTypeValue, '电商主图')
      const neckLabel = this.getPromptTokenLabel(this.neckValue, '领口自然清晰')
      const sleeveLabel = this.getPromptTokenLabel(this.sleeveValue, '袖型自然清晰')
      const fitLabel = this.getPromptTokenLabel(this.fitValue, '版型自然清晰')
      const modeSceneHint = mode === 'creative'
        ? '画面可加入轻量生活方式氛围，保持服装为视觉中心'
        : mode === 'quick'
          ? '背景保持简洁，优先快速验证服装展示效果'
          : '背景干净，光线柔和，适合常规电商上架'

      return {
        clothingDescription: `识别上传服装的品类、主色、版型和材质感，重点保留${neckLabel}、${sleeveLabel}、${fitLabel}，呈现真实可售卖的服装细节。`,
        modelSetting: `${modelLabel}，${bodyLabel}，气质自然干净，妆发简洁，不抢服装主体。`,
        sceneSetting: `${sceneLabel}，${styleLabel}，${modeSceneHint}。`,
        poseSetting: '正面站姿或轻微侧身，自然展示上身效果，突出版型、下摆、袖口和领口细节。',
        outputUsage: `${outputLabel}，可用于商品上架、橱窗展示、社媒种草或直播封面预览。`,
        negativePrompt: '不要改变服装颜色，不要改变款式结构，不要增加多余饰品，不要夸张背景，不要文字水印，不要让图案和纽扣变形。'
      }
    },
    formatPromptDraft(plan = this.promptPlan, mode = this.generationMode) {
      const modeLabel = (this.generationModeOptions.find((item) => item.value === mode) || {}).label || '标准'
      return [
        `生成模式：${modeLabel}`,
        `服装描述：${plan.clothingDescription || ''}`,
        `模特设定：${plan.modelSetting || ''}`,
        `场景设定：${plan.sceneSetting || ''}`,
        `姿势设定：${plan.poseSetting || ''}`,
        `出图用途：${plan.outputUsage || ''}`,
        `负面约束：${plan.negativePrompt || ''}`
      ].filter(Boolean).join('\n')
    },
    getPromptPlanPayload() {
      const plan = {
        clothingDescription: this.promptPlan.clothingDescription || '',
        modelSetting: this.promptPlan.modelSetting || '',
        sceneSetting: this.promptPlan.sceneSetting || '',
        poseSetting: this.promptPlan.poseSetting || '',
        outputUsage: this.promptPlan.outputUsage || '',
        negativePrompt: this.promptPlan.negativePrompt || ''
      }
      return {
        promptPlan: plan,
        promptDraft: this.formatPromptDraft(plan, this.generationMode),
        generationMode: this.generationMode,
        negativePrompt: plan.negativePrompt,
        outputUsage: plan.outputUsage
      }
    },
    syncPromptPlanToDraft() {
      const state = getMainChainState()
      const draftTask = state.draftTask || {}
      const currentInput = draftTask.input || {}
      const currentParams = currentInput.params || {}
      const promptPayload = this.getPromptPlanPayload()
      this.chainState = patchMainChainState({
        draftTask: {
          ...draftTask,
          input: {
            ...currentInput,
            params: {
              ...currentParams,
              ...promptPayload
            }
          }
        }
      })
      return promptPayload
    },
    generatePromptPlan() {
      console.log('[upload:prompt-plan] generate start', {
        hasImage: this.canGeneratePromptPlan,
        generationMode: this.generationMode
      })
      if (!this.canGeneratePromptPlan) {
        uni.showToast({
          title: '请先上传服装图后生成方案',
          icon: 'none'
        })
        return
      }
      this.promptPlan = this.buildPromptPlan(this.generationMode)
      this.promptPlanReady = true
      this.syncPromptPlanToDraft()
      console.log('[upload:prompt-plan] generate done', {
        generationMode: this.generationMode,
        hasPromptDraft: !!this.promptDraft,
        fields: this.promptPlanFields.length
      })
      uni.showToast({
        title: '方案已生成',
        icon: 'success'
      })
    },
    adaptPromptPlan() {
      return this.adaptPromptPlanWithAi()
    },
    adaptPromptPlanWithAi() {
      console.log('[upload:prompt-plan] adapt start', {
        hasImage: this.canGeneratePromptPlan,
        generationMode: this.generationMode
      })
      if (!this.canGeneratePromptPlan) {
        uni.showToast({
          title: '请先上传服装图后生成方案',
          icon: 'none'
        })
        return
      }
      if (!this.promptPlanReady) {
        this.promptPlan = this.buildPromptPlan(this.generationMode)
        this.promptPlanReady = true
      }
      const adapted = this.buildPromptPlan(this.generationMode)
      this.promptPlan = {
        ...this.promptPlan,
        sceneSetting: adapted.sceneSetting,
        outputUsage: adapted.outputUsage,
        negativePrompt: adapted.negativePrompt
      }
      this.syncPromptPlanToDraft()
      console.log('[upload:prompt-plan] generate done', {
        action: 'adapt',
        generationMode: this.generationMode,
        hasPromptDraft: !!this.promptDraft
      })
      uni.showToast({
        title: '已完成 AI 适配',
        icon: 'success'
      })
    },
    updatePromptPlanField(field, value) {
      this.promptPlan = {
        ...this.promptPlan,
        [field]: value
      }
      this.promptPlanReady = true
      this.syncPromptPlanToDraft()
    },
    setGenerationMode(mode) {
      this.generationMode = mode || 'standard'
      if (this.isImageToSketchEntry && ['ready', 'applied'].includes(this.sketchRecommendationState)) {
        this.sketchRecommendationState = 'idle'
        this.sketchRecommendation = null
      }
      if (this.isTextToSketchEntry && ['ready', 'applied'].includes(this.styleSketchRecommendationState)) {
        this.styleSketchRecommendationState = 'idle'
        this.styleSketchRecommendation = null
      }
      if (this.isSketchRemixEntry && ['ready', 'applied'].includes(this.remixRecommendationState)) {
        this.remixRecommendationState = 'idle'
        this.remixRecommendation = null
      }
      if (this.promptPlanReady) {
        this.promptPlan = this.buildPromptPlan(this.generationMode)
        this.syncPromptPlanToDraft()
      }
    },
    ensurePromptPlanReady() {
      if (!this.promptPlanReady) {
        this.promptPlan = this.buildPromptPlan(this.generationMode)
        this.promptPlanReady = true
      }
      return this.syncPromptPlanToDraft()
    },
    usePromptPlanToGenerate() {
      console.log('[upload:prompt-plan] use for generate', {
        hasImage: this.canGeneratePromptPlan,
        hasPromptPlan: this.promptPlanReady,
        generationMode: this.generationMode
      })
      if (!this.canGeneratePromptPlan) {
        uni.showToast({
          title: '请先上传服装图',
          icon: 'none'
        })
        return
      }
      this.ensurePromptPlanReady()
      this.startGenerate()
    },
    summarizeAssetForLog(asset = {}) {
      const fileId = this.getAssetFileId(asset)
      const fileUrl = this.getAssetFileUrl(asset)
      return {
        hasLocalPath: !!asset.localPath,
        hasFileId: !!fileId,
        hasFileUrl: !!fileUrl,
        hasCloudFileId: /^cloud:\/\//.test(String(fileId || '')),
        hasHttpsUrl: /^https:\/\//.test(String(fileUrl || '')),
        source: asset.source || '',
        hasAssetId: !!asset.assetId
      }
    },
    normalizePrimaryClothImageAsset(asset = {}) {
      const currentAsset = this.clothImageValue || {}
      const localPath = Object.prototype.hasOwnProperty.call(asset, 'localPath')
        ? asset.localPath || ''
        : currentAsset.localPath || ''
      const fileId = asset.fileId || asset.file_id || asset.fileID || ''
      const fileUrl =
        asset.fileUrl ||
        asset.file_url ||
        asset.imageUrl ||
        asset.image_url ||
        asset.url ||
        ''
      const assetId =
        asset.assetId ||
        currentAsset.assetId ||
        (localPath ? `asset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` : '')

      return {
        ...currentAsset,
        localPath,
        fileId,
        file_id: fileId,
        fileUrl,
        file_url: fileUrl,
        imageUrl: fileUrl,
        image_url: fileUrl,
        url: fileUrl,
        assetId,
        source: asset.source || ''
      }
    },
    setPrimaryClothImageAsset(asset = {}) {
      const normalizedAsset = this.normalizePrimaryClothImageAsset(asset)
      const patch = {
        clothImage: normalizedAsset
      }
      if (Object.prototype.hasOwnProperty.call(asset, 'taskError')) {
        patch.taskError = asset.taskError
      }
      if (Object.prototype.hasOwnProperty.call(asset, 'taskControl')) {
        patch.taskControl = asset.taskControl
      }
      if (Object.prototype.hasOwnProperty.call(asset, 'resultImageUrl')) {
        patch.resultImageUrl = asset.resultImageUrl || ''
      }
      syncDraftTaskToState(patch)
      this.chainState = getMainChainState()
      console.log('[upload:primary-cloth] state updated', this.summarizeAssetForLog(normalizedAsset))
      return normalizedAsset
    },
    maybeAutoGeneratePromptPlanAfterUpload() {
      if (!this.autoPromptPlanAfterUpload || this.promptPlanReady || !this.canGeneratePromptPlan) {
        return
      }
      this.autoPromptPlanAfterUpload = false
      console.log('[upload:prompt-plan] auto generate from home entry', {
        entryScene: this.entryScene || '',
        generationMode: this.generationMode
      })
      this.generatePromptPlan()
    },
    handleChooseClothImage() {
      if (this.clothUploadingValue) {
        return
      }
      console.log('[upload:asset] choose start', {
        field: 'clothImage',
        scene: 'cloth_image',
        entryScene: this.entryScene || ''
      })
      this.chooseClothImage()
    },
    handleChooseStyleImage() {
      if (this.styleUploadingValue) {
        return
      }
      console.log('[upload:asset] choose start', {
        field: 'styleImage',
        scene: 'style_image',
        entryScene: this.entryScene || ''
      })
      this.chooseStyleImage()
    },
    goStep(step) {
      syncDraftTaskToState({ currentStep: step })
      this.chainState = getMainChainState()
    },
    resolveAdvancedPanelKey(panelKey = '', panelKeys = this.currentAdvancedPanels) {
      const keys = Array.isArray(panelKeys) ? panelKeys : []
      if (panelKey && keys.includes(panelKey)) {
        return panelKey
      }
      return keys[0] || ''
    },
    toggleStyleAdvanced() {
      this.toggleAdvancedSettings()
    },
    toggleAdvancedSettings() {
      this.showStyleAdvanced = !this.showStyleAdvanced
      if (this.showStyleAdvanced) {
        this.activeAdvancedPanel = this.resolveAdvancedPanelKey(this.activeAdvancedPanel)
      }
    },
    setActiveAdvancedPanel(panelKey) {
      this.activeAdvancedPanel = this.resolveAdvancedPanelKey(panelKey)
    },
    getGenerateConfirmSummary() {
      const params = this.draftParamsValue || {}
      return {
        entryScene: this.entryScene || '',
        templateType: this.templateType || '',
        templateName: (this.currentSceneTemplate && this.currentSceneTemplate.title) || '',
        optionPromptSummary: params.optionPromptSummary || '',
        customPromptSummary: params.customPromptSummary || '',
        fullAdvancedPromptSummary: params.fullAdvancedPromptSummary || '',
        hasAdvancedOptions: !!params.optionPromptSummary,
        hasCustomPrompt: !!params.customPromptSummary
      }
    },
    getRunwayDurationSecFromParams(params = this.draftParamsValue) {
      return params &&
        params.advancedPanelValues &&
        params.advancedPanelValues.runway_video &&
        params.advancedPanelValues.runway_video.durationSec
    },
    resolveUploadCostActionType(entryScene = this.entryScene, params = this.draftParamsValue) {
      const preset = getEntryScenePreset(entryScene)
      return resolveCostActionType(preset.templateType || entryScene, {
        costActionType: preset.templateType === 'runway_video' ? '' : preset.costActionType,
        durationSec: this.getRunwayDurationSecFromParams(params)
      })
    },
    toggleGenerateConfirmFull() {
      this.showGenerateConfirmFull = !this.showGenerateConfirmFull
      const summary = this.getGenerateConfirmSummary()
      console.log('[upload:generate-confirm] summary refreshed', {
        entryScene: summary.entryScene,
        optionSummaryLength: String(summary.optionPromptSummary || '').length,
        customSummaryLength: String(summary.customPromptSummary || '').length,
        fullSummaryLength: String(summary.fullAdvancedPromptSummary || '').length
      })
    },
    getAdvancedFieldValue(panelKey = '', field = {}) {
      const panelValues = this.currentAdvancedPanelValues[panelKey] || {}
      if (Object.prototype.hasOwnProperty.call(panelValues, field.key)) {
        return panelValues[field.key]
      }
      return field.defaultValue
    },
    getPreparedAdvancedGenerateParams() {
      const params = this.draftParamsValue || {}
      const advancedPanelValues = params.advancedPanelValues || this.currentAdvancedPanelValues || {}
      const advancedPromptPayload = buildAdvancedPromptSummary(advancedPanelValues, this.currentAdvancedPanelConfigs)
      const nextParams = {
        ...params,
        advancedPanelValues,
        ...advancedPromptPayload
      }
      if (this.isFlatLayEntry && params.flatLayStylePrompt) {
        nextParams.optionPromptSummary = params.flatLayStylePrompt
      }
      nextParams.costActionType = this.resolveUploadCostActionType(this.entryScene, nextParams)
      return nextParams
    },
    logPreparedAdvancedGenerateParams(params = {}) {
      console.log('[upload:generate-advanced-prompt] prepared', {
        entryScene: this.entryScene || '',
        templateType: this.templateType || '',
        costActionType: params.costActionType || '',
        hasAdvancedPanelValues: !!params.advancedPanelValues,
        selectedPanelCount: Array.isArray(params.selectedAdvancedPanels) ? params.selectedAdvancedPanels.length : 0,
        advancedCustomPromptCount: Object.keys(params.advancedCustomPrompts || {}).length,
        advancedOptionPromptCount: Object.keys(params.advancedOptionPrompts || {}).length,
        customPromptSummaryLength: String(params.customPromptSummary || '').length,
        optionPromptSummaryLength: String(params.optionPromptSummary || '').length,
        fullAdvancedPromptSummaryLength: String(params.fullAdvancedPromptSummary || '').length
      })
    },
    normalizeAdvancedFieldValue(field = {}, value) {
      const rawValue = value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'value')
        ? value.value
        : value
      if (field.type === 'number') {
        const numberValue = Number(rawValue)
        return Number.isNaN(numberValue) ? rawValue : numberValue
      }
      return rawValue
    },
    summarizeAdvancedFieldValue(field = {}, value) {
      if (field.type === 'textarea' || field.key === 'customPrompt' || field.type === 'text') {
        return {
          length: String(value || '').length
        }
      }
      if (typeof value === 'boolean' || typeof value === 'number') {
        return value
      }
      if (value && typeof value === 'object') {
        return {
          type: 'object'
        }
      }
      return String(value || '')
    },
    updateAdvancedFieldValue(panelKey = '', field = {}, value) {
      const nextValue = this.normalizeAdvancedFieldValue(field, value)
      const currentValues = this.currentAdvancedPanelValues || {}
      const nextValues = {
        ...currentValues,
        [panelKey]: {
          ...(currentValues[panelKey] || {}),
          [field.key]: nextValue
        }
      }
      if (this.isSketchRemixEntry && panelKey === 'fabric_texture' && field.key === 'fabricType') {
        nextValues.sketch_to_model = {
          ...(currentValues.sketch_to_model || {}),
          fabricType: nextValue
        }
      }
      if (field.type === 'textarea' || field.key === 'customPrompt') {
        console.log('[upload:advanced-panel] custom prompt changed', {
          panelKey,
          key: field.key,
          length: String(nextValue || '').length
        })
      }
      console.log('[upload:advanced-panel] field changed', {
        panelKey,
        key: field.key,
        type: field.type || '',
        valueSummary: this.summarizeAdvancedFieldValue(field, nextValue)
      })
      const advancedPromptPayload = buildAdvancedPromptSummary(nextValues, this.currentAdvancedPanelConfigs)
      const nextParamsForCost = {
        ...this.draftParamsValue,
        advancedPanelValues: nextValues
      }
      console.log('[upload:advanced-params] prompt summary updated', {
        selectedPanelCount: this.currentAdvancedPanels.length,
        customPromptCount: Object.keys(advancedPromptPayload.advancedCustomPrompts || {}).length,
        optionPromptCount: Object.keys(advancedPromptPayload.advancedOptionPrompts || {}).length,
        fullSummaryLength: String(advancedPromptPayload.fullAdvancedPromptSummary || '').length
      })
      this.updateAdvancedParams({
        advancedPanelValues: nextValues,
        ...advancedPromptPayload,
        costActionType: this.resolveUploadCostActionType(this.entryScene, nextParamsForCost),
        selectedAdvancedPanels: this.currentAdvancedPanels,
        [field.key]: nextValue
      }, field.key)
      if (this.isTextToSketchEntry && this.promptPlanReady) {
        this.promptPlan = this.buildPromptPlan(this.generationMode)
        this.syncPromptPlanToDraft()
      }
      if (this.isSketchRemixEntry && this.promptPlanReady) {
        this.promptPlan = this.buildPromptPlan(this.generationMode)
        this.syncPromptPlanToDraft()
      }
    },
    updateAdvancedParams(patch = {}, changedKey = '') {
      const currentState = getMainChainState()
      const currentDraftTask = currentState.draftTask || {}
      const currentInput = currentDraftTask.input || {}
      const currentParams = currentInput.params || {}
      const nextParams = {
        ...currentParams,
        ...patch
      }

      if (Object.prototype.hasOwnProperty.call(patch, 'selectedStyleCode')) {
        nextParams.styleMode = 'manual'
        nextParams.finalStyleCode = patch.selectedStyleCode || ''
      }
      if (Object.prototype.hasOwnProperty.call(patch, 'selectedSceneCode')) {
        nextParams.sceneMode = 'manual'
        nextParams.finalSceneCode = patch.selectedSceneCode || ''
      }
      if (Object.prototype.hasOwnProperty.call(patch, 'selectedBodyType')) {
        nextParams.bodyMode = 'manual'
        nextParams.finalBodyType = patch.selectedBodyType || ''
      }

      patchMainChainState({
        draftTask: {
          ...currentDraftTask,
          input: {
            ...currentInput,
            params: nextParams
          }
        }
      })
      this.chainState = getMainChainState()
      console.log('[upload:advanced-params] updated', {
        changedKey,
        finalStyleCode: nextParams.finalStyleCode || '',
        finalSceneCode: nextParams.finalSceneCode || '',
        finalBodyType: nextParams.finalBodyType || '',
        outputTypesLength: Array.isArray(nextParams.outputTypes) ? nextParams.outputTypes.length : 0
      })
    },
    toggleAdvancedOutputType(outputType) {
      const currentOutputTypes = Array.isArray(this.outputTypesValue) ? this.outputTypesValue : []
      const nextOutputTypes = currentOutputTypes.includes(outputType)
        ? currentOutputTypes.filter((item) => item !== outputType)
        : [...currentOutputTypes, outputType]
      this.updateAdvancedParams({
        outputTypes: nextOutputTypes
      }, 'outputTypes')
    },
    chooseClothImage() {
      uni.chooseImage({
        count: 1,
        success: async (res) => {
          const localPath = res.tempFilePaths[0]
          if (this.isImageToSketchEntry || this.isTextToSketchEntry || this.isSketchRemixEntry) {
            const validation = await this.validateSketchImage(localPath, (res.tempFiles || [])[0] || {})
            if (!validation.ok) {
              uni.showToast({ title: validation.message, icon: 'none' })
              return
            }
            if (this.isImageToSketchEntry) {
              this.sketchImageMeta = validation.meta
              this.sketchRecommendationState = 'idle'
              this.sketchRecommendation = null
              this.sketchCreatedTaskId = ''
              this.sketchSubmissionState = 'idle'
            }
            if (this.isTextToSketchEntry) {
              this.styleSketchImageMeta = validation.meta
              this.styleSketchRecommendationState = 'idle'
              this.styleSketchRecommendation = null
              this.styleSketchCreatedTaskId = ''
              this.styleSketchSubmissionState = 'idle'
            }
            if (this.isSketchRemixEntry) {
              this.remixImageMeta = validation.meta
              this.remixRecommendationState = 'idle'
              this.remixRecommendation = null
              this.remixCreatedTaskId = ''
              this.remixSubmissionState = 'idle'
            }
          }
          this.setPrimaryClothImageAsset({
            localPath,
            fileId: '',
            file_id: '',
            fileUrl: '',
            file_url: '',
            imageUrl: '',
            image_url: '',
            url: '',
            source: '',
            resultImageUrl: '',
            taskError: {
              message: '',
              retryable: false,
              details: {
                upload: {
                  ...(this.draftUploadErrorValue || {}),
                  clothImage: ''
                }
              }
            },
            taskControl: {
              retryState: {
                ...((this.runtimeTaskControlValue && this.runtimeTaskControlValue.retryState) || {}),
                clothImage: false
              },
              uploading: {
                ...((this.runtimeTaskControlValue && this.runtimeTaskControlValue.uploading) || {}),
                clothImage: true
              }
            }
          })

          try {
            const uploadResult = await retryUploadAsset('clothImage', localPath, 'cloth_image')
            this.setPrimaryClothImageAsset({
              ...uploadResult,
              localPath,
              source: uploadResult && uploadResult.source ? uploadResult.source : 'wx_cloud_upload'
            })
            this.maybeAutoGeneratePromptPlanAfterUpload()
          } catch (error) {
            uni.showToast({
              title: '服装图上传失败',
              icon: 'none'
            })
          }
        }
      })
    },
    chooseStyleImage() {
      uni.chooseImage({
        count: 1,
        success: async (res) => {
          const localPath = res.tempFilePaths[0]
          syncDraftTaskToState({
            styleImage: {
              localPath,
              fileId: '',
              file_id: '',
              fileUrl: '',
              file_url: '',
              imageUrl: '',
              image_url: '',
              url: '',
              source: ''
            },
            taskError: {
              message: '',
              retryable: false,
              details: {
                upload: {
                  ...(this.draftUploadErrorValue || {}),
                  styleImage: ''
                }
              }
            },
            taskControl: {
              retryState: {
                ...((this.runtimeTaskControlValue && this.runtimeTaskControlValue.retryState) || {}),
                styleImage: false
              },
              uploading: {
                ...((this.runtimeTaskControlValue && this.runtimeTaskControlValue.uploading) || {}),
                styleImage: true
              }
            }
          })

          try {
            await retryUploadAsset('styleImage', localPath, 'style_image')
          } catch (error) {
            uni.showToast({
              title: '参考图上传失败',
              icon: 'none'
            })
          }
        }
      })
    },
    resetStyleImage() {
      syncDraftTaskToState({
        styleImage: {
          localPath: '',
          fileId: '',
          file_id: '',
          fileUrl: '',
          file_url: '',
          imageUrl: '',
          image_url: '',
          url: '',
          source: ''
        },
        taskError: {
          message: '',
          retryable: false,
          details: {
            upload: {
              ...(this.draftUploadErrorValue || {}),
              styleImage: ''
            }
          }
        },
        taskControl: {
          retryState: {
            ...((this.runtimeTaskControlValue && this.runtimeTaskControlValue.retryState) || {}),
            styleImage: false
          }
        }
      })
    },
    resetClothImage() {
      syncDraftTaskToState({
        clothImage: {
          localPath: '',
          fileId: '',
          file_id: '',
          fileUrl: '',
          file_url: '',
          imageUrl: '',
          image_url: '',
          url: '',
          source: ''
        },
        resultImageUrl: '',
        taskError: {
          message: '',
          retryable: false,
          details: {
            upload: {
              ...(this.draftUploadErrorValue || {}),
              clothImage: ''
            }
          }
        },
        taskControl: {
          retryState: {
            ...((this.runtimeTaskControlValue && this.runtimeTaskControlValue.retryState) || {}),
            clothImage: false
          },
          uploading: {
            ...((this.runtimeTaskControlValue && this.runtimeTaskControlValue.uploading) || {}),
            clothImage: false
          }
        }
      })
      this.promptPlanReady = false
      this.chainState = getMainChainState()
    },
    retryClothUpload() {
      if (!this.clothImageValue.localPath || this.clothUploadingValue) {
        return
      }
      this.uploadSelectedImage('clothImage', this.clothImageValue.localPath, 'cloth_image')
    },
    retryStyleUpload() {
      if (!this.styleImageValue.localPath || this.styleUploadingValue) {
        return
      }
      this.uploadSelectedImage('styleImage', this.styleImageValue.localPath, 'style_image')
    },
    async uploadSelectedImage(field, localPath, scene) {
      try {
        await retryUploadAsset(field, localPath, scene)
        this.chainState = getMainChainState()
        if (field === 'clothImage') {
          this.maybeAutoGeneratePromptPlanAfterUpload()
        }
      } catch (error) {
        uni.showToast({
          title: field === 'clothImage' ? '服装图上传失败' : '参考图上传失败',
          icon: 'none'
        })
      }
    },
    checkCount() {
      if (this.quotaLoaded && !this.isVip && this.leftCount <= 0) {
        uni.showModal({
          title: '次数已用完',
          content: '请先开通会员',
          showCancel: false
        })
        return false
      }
      return true
    },
    getAssetFileId(asset = {}) {
      const directFileId = asset.fileId || asset.file_id || asset.fileID || ''
      if (directFileId) {
        return directFileId
      }
      const candidates = [
        asset.fileUrl,
        asset.file_url,
        asset.imageUrl,
        asset.image_url,
        asset.url,
        asset.downloadUrl,
        asset.download_url,
        asset.tempFileURL,
        asset.tempFileUrl
      ]
      return candidates.find((value) => /^cloud:\/\//.test(String(value || ''))) || ''
    },
    getAssetFileUrl(asset = {}) {
      const candidates = [
        asset.fileUrl,
        asset.file_url,
        asset.imageUrl,
        asset.image_url,
        asset.url,
        asset.downloadUrl,
        asset.download_url,
        asset.tempFileURL,
        asset.tempFileUrl
      ]
      return candidates.find((value) => /^https:\/\//.test(String(value || ''))) || ''
    },
    startGenerate(options = {}) {
      const debugDryRun = !!(options && options.dryRun)
      if (this.isGeneratingValue) {
        console.warn('[upload:generate] skipped generating')
        uni.showToast({
          title: '生成中，请稍候',
          icon: 'none'
        })
        return null
      }
      if (!debugDryRun && !this.clothImageValue.localPath && !this.getAssetFileId(this.clothImageValue) && !this.getAssetFileUrl(this.clothImageValue)) {
        console.warn('[upload:generate] blocked missing remote cloth image', this.summarizeAssetForLog(this.clothImageValue))
        uni.showToast({
          title: '请先上传服装图',
          icon: 'none'
        })
        return
      }

      if (!debugDryRun && this.isImageToSketchEntry && !this.hasRemoteClothImage) {
        this.sketchSubmissionState = 'idle'
        uni.showToast({ title: '图片尚未上传完成，请稍候', icon: 'none' })
        return
      }

      if (!debugDryRun && this.isTextToSketchEntry) {
        if (!this.hasRemoteClothImage) {
          this.styleSketchSubmissionState = 'idle'
          uni.showToast({ title: '图片尚未上传完成，请稍候', icon: 'none' })
          return
        }
        if (this.styleSketchConflictMessage) {
          this.styleSketchSubmissionState = 'idle'
          uni.showToast({ title: this.styleSketchConflictMessage, icon: 'none' })
          return
        }
      }

      if (!debugDryRun && this.isSketchRemixEntry) {
        if (!this.hasRemoteClothImage) {
          this.remixSubmissionState = 'idle'
          uni.showToast({ title: '图片尚未上传完成，请稍候', icon: 'none' })
          return
        }
        if (this.remixConflictMessage) {
          this.remixSubmissionState = 'idle'
          uni.showToast({ title: this.remixConflictMessage, icon: 'none' })
          return
        }
      }

      if (!debugDryRun && !this.checkCount()) {
        return
      }

      this.generateInFlight = true
      if (this.isImageToSketchEntry) this.sketchSubmissionState = 'creating'
      if (this.isTextToSketchEntry) this.styleSketchSubmissionState = 'creating'
      if (this.isSketchRemixEntry) this.remixSubmissionState = 'creating'
      this.runGenerate({
        ...(options || {}),
        fromStartGenerate: true
      })
      return null
    },
    buildGeneratePayload(options = {}) {
      const promptPayload = this.promptPlanReady ? this.syncPromptPlanToDraft() : {}
      const params = {
        ...this.getPreparedAdvancedGenerateParams(),
        ...promptPayload
      }
      this.logPreparedAdvancedGenerateParams(params)
      const debugDryRun = !!(options && options.dryRun)
      const payload = {
        projectId: this.projectIdValue || '',
        batchId: this.batchIdValue || '',
        cloth_image: {
          file_id: this.getAssetFileId(this.clothImageValue),
          file_url: this.getAssetFileUrl(this.clothImageValue)
        },
        style_image: {
          file_id: this.getAssetFileId(this.styleImageValue),
          file_url: this.getAssetFileUrl(this.styleImageValue)
        },
        modelType: this.modelTypeValue,
        body: this.bodyValue,
        kidsAge: this.kidsAgeValue,
        styleTag: this.styleTagValue,
        scene: this.sceneValue,
        neck: this.neckValue,
        sleeve: this.sleeveValue,
        fit: this.fitValue,
        bg: this.backgroundTypeValue,
        output: this.outputTypeValue,
        advancedPanelValues: params.advancedPanelValues || {},
        advancedCustomPrompts: params.advancedCustomPrompts || {},
        advancedOptionPrompts: params.advancedOptionPrompts || {},
        customPromptSummary: params.customPromptSummary || '',
        optionPromptSummary: params.optionPromptSummary || '',
        fullAdvancedPromptSummary: params.fullAdvancedPromptSummary || '',
        promptDraft: params.promptDraft || '',
        promptPlan: params.promptPlan || null,
        generationMode: params.generationMode || this.generationMode || 'standard',
        negativePrompt: params.negativePrompt || '',
        outputUsage: params.outputUsage || '',
        costActionType: params.costActionType || '',
        input: {
          params: {
            entryScene: this.entryScene || '',
            flatLayStyle: params.flatLayStyle || '',
            flatLayStyleName: params.flatLayStyleName || '',
            flatLayStylePrompt: params.flatLayStylePrompt || '',
            promptDraft: params.promptDraft || '',
            promptPlan: params.promptPlan || null,
            generationMode: params.generationMode || this.generationMode || 'standard',
            negativePrompt: params.negativePrompt || '',
            outputUsage: params.outputUsage || ''
          }
        }
      }
      if (debugDryRun) {
        payload.dryRun = true
        payload.provider = 'real'
        payload.idempotencyKey = options.idempotencyKey || `manual_upload_dry_run_${Date.now()}`
        payload.quotaRecordId = options.quotaRecordId || ''
        payload.quotaRecordStatus = options.quotaRecordStatus || ''
        console.log('[upload:generate-dry-run] prepared', {
          entryScene: this.entryScene || '',
          templateType: this.templateType || '',
          costActionType: payload.costActionType || '',
          dryRun: true,
          hasQuotaRecordId: !!payload.quotaRecordId,
          hasIdempotencyKey: !!payload.idempotencyKey
        })
      }
      return payload
    },
    async createLocalTaskFromPayload(payload = {}) {
      const runtime = getRuntimeGenerationConfig({
        providerSupported: false,
        experimentalProviderSupported: true,
        provider: 'wanx',
        modelName: 'qwen-image-2.0-pro',
        taskType: payload.taskType || payload.actionType || payload.type || this.templateType || this.entryScene
      })
      return createInternalRealGenerationTask({
        type: (this.isImageToSketchEntry || this.isTextToSketchEntry || this.isSketchRemixEntry) ? this.templateType : (payload.output || this.templateType || this.entryScene || 'model_replace'),
        projectId: payload.projectId || '',
        batchId: payload.batchId || '',
        channel: this.entryScene || 'upload',
        input: {
          assets: {
            clothImage: {
              localPath: this.clothImageValue.localPath || '',
              fileId: payload.cloth_image && payload.cloth_image.file_id ? payload.cloth_image.file_id : '',
              fileUrl: (payload.cloth_image && payload.cloth_image.file_url) || this.clothImageValue.fileUrl || this.clothImageValue.localPath || ''
            },
            styleImage: {
              localPath: this.styleImageValue.localPath || '',
              fileId: payload.style_image && payload.style_image.file_id ? payload.style_image.file_id : '',
              fileUrl: (payload.style_image && payload.style_image.file_url) || this.styleImageValue.fileUrl || this.styleImageValue.localPath || ''
            }
          },
          params: {
            modelType: payload.modelType || '',
            bodyType: payload.body || '',
            kidsAgeGroup: payload.kidsAge || '',
            styleTag: payload.styleTag || '',
            sceneType: payload.scene || '',
            neckType: payload.neck || '',
            sleeveType: payload.sleeve || '',
            fitType: payload.fit || '',
            backgroundType: payload.bg || '',
            entryScene: this.entryScene || '',
            templateType: this.templateType || '',
            ...(payload.input && payload.input.params ? payload.input.params : {}),
            advancedPanelValues: payload.advancedPanelValues || {},
            advancedCustomPrompts: payload.advancedCustomPrompts || {},
            advancedOptionPrompts: payload.advancedOptionPrompts || {},
            customPromptSummary: payload.customPromptSummary || '',
            optionPromptSummary: payload.optionPromptSummary || '',
            fullAdvancedPromptSummary: payload.fullAdvancedPromptSummary || ''
          },
          options: {
            backgroundType: payload.bg || '',
            outputType: payload.output || ''
          }
        },
        params: {
          entryScene: this.entryScene || '',
          templateType: this.templateType || '',
          outputType: payload.output || '',
          generationMode: payload.generationMode || '',
          outputUsage: payload.outputUsage || ''
        }
      }, runtime)
    },
    async runGenerate(options = {}) {
      const fromStartGenerate = options && options.fromStartGenerate
      if (this.generateInFlight && !fromStartGenerate) {
        console.warn('[upload:generate] skipped generating')
        uni.showToast({
          title: '生成中，请稍候',
          icon: 'none'
        })
        return null
      }
      if (!fromStartGenerate) {
        this.generateInFlight = true
      }
      try {
        const task = await this.createLocalTaskFromPayload(this.buildGeneratePayload(options))
        if (this.isImageToSketchEntry) {
          this.sketchCreatedTaskId = task.taskId
          this.sketchSubmissionState = 'created'
          this.sketchDraftDetected = false
          this.clearSketchDraftAfterTaskCreated()
        }
        if (this.isTextToSketchEntry) {
          this.styleSketchCreatedTaskId = task.taskId
          this.styleSketchSubmissionState = 'created'
          this.styleSketchDraftDetected = false
          this.clearStyleSketchDraftAfterTaskCreated()
        }
        if (this.isSketchRemixEntry) {
          this.remixCreatedTaskId = task.taskId
          this.remixSubmissionState = 'created'
          this.remixDraftDetected = false
          this.clearRemixDraftAfterTaskCreated()
        }
        if (!this.isVip && this.leftCount > 0) {
          this.leftCount -= 1
        }
        uni.navigateTo({
          url: `/package-ai/result/result?taskId=${encodeURIComponent(task.taskId)}`,
          fail: () => {
            if (this.isImageToSketchEntry) {
              uni.showToast({ title: '任务已创建，可前往最近任务查看', icon: 'none', duration: 2600 })
            }
            if (this.isTextToSketchEntry) {
              uni.showToast({ title: '任务已创建，可前往最近任务查看', icon: 'none', duration: 2600 })
            }
            if (this.isSketchRemixEntry) {
              uni.showToast({ title: '任务已创建，可前往最近任务查看', icon: 'none', duration: 2600 })
            }
          }
        })
      } catch (error) {
        if (this.isImageToSketchEntry && !this.sketchCreatedTaskId) this.sketchSubmissionState = 'failed'
        if (this.isTextToSketchEntry && !this.styleSketchCreatedTaskId) this.styleSketchSubmissionState = 'failed'
        if (this.isSketchRemixEntry && !this.remixCreatedTaskId) this.remixSubmissionState = 'failed'
        uni.showToast({
          title: '任务创建失败',
          icon: 'none'
        })
      } finally {
        this.generateInFlight = false
      }
    },
    handlePollingResult(pollResult) {
      if (!pollResult) {
        return
      }

      if (pollResult.status === 'success') {
        if (!this.isVip && this.leftCount > 0) {
          this.leftCount -= 1
        }

        uni.navigateTo({
          url: '/package-ai/result/result'
        })
        return
      }

      if (pollResult.reason === 'query_error') {
        uni.showToast({
          title: '任务查询失败',
          icon: 'none'
        })
        return
      }

      if (pollResult.reason === 'task_failed') {
        uni.showToast({
          title: '生成任务失败',
          icon: 'none'
        })
        return
      }

      if (pollResult.reason === 'timeout') {
        uni.showToast({
          title: '生成超时',
          icon: 'none'
        })
      }
    },
    retryGenerate() {
      if (this.isGeneratingValue) {
        console.warn('[upload:generate] skipped generating')
        return
      }
      this.runRetryGenerate()
    },
    async runRetryGenerate() {
      if (this.generateInFlight || this.isGeneratingValue) {
        console.warn('[upload:retry-generate] skipped generating')
        return null
      }
      this.generateInFlight = true
      try {
        const task = await this.createLocalTaskFromPayload(this.buildGeneratePayload())
        if (!this.isVip && this.leftCount > 0) {
          this.leftCount -= 1
        }
        uni.navigateTo({
          url: `/package-ai/result/result?taskId=${encodeURIComponent(task.taskId)}`
        })
      } catch (error) {
        uni.showToast({
          title: '重新创建任务失败',
          icon: 'none'
        })
      } finally {
        this.generateInFlight = false
      }
    },
    async continuePolling() {
      if (this.isGeneratingValue) {
        return
      }
      const taskId = this.currentTaskIdValue || (this.runtimeTaskControlValue && this.runtimeTaskControlValue.lastTaskId) || this.chainState.taskId || this.chainState.lastTaskId
      if (!taskId) {
        uni.showToast({
          title: '暂无可继续查询的任务',
          icon: 'none'
        })
        return
      }

      try {
        if (!getTask(taskId)) {
          uni.showToast({
            title: '任务不存在',
            icon: 'none'
          })
          return
        }
        simulateTask(taskId)
        uni.navigateTo({
          url: `/package-ai/result/result?taskId=${encodeURIComponent(taskId)}`
        })
      } catch (error) {
        uni.showToast({
          title: '继续查询失败',
          icon: 'none'
        })
      }
    }
  }
}
</script>

<style scoped>
.container {
  padding: 18rpx 20rpx 40rpx;
  background: #f5f7fb;
  min-height: 100vh;
}

.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255, 255, 255, 0.82);
  border-radius: 18rpx;
  padding: 14rpx 16rpx;
  margin-bottom: 16rpx;
  border: 1rpx solid #edf0f7;
}

.left-info {
  font-size: 23rpx;
  color: #667085;
}

.vip-text {
  color: #ff7d00;
  font-weight: bold;
}

.right-btns {
  display: flex;
  gap: 8rpx;
}

.btn-share,
.btn-history {
  height: 52rpx;
  line-height: 52rpx;
  margin: 0;
  padding: 0 16rpx;
  background: #eef6ff;
  color: #1677ff;
  border-radius: 50rpx;
  font-size: 22rpx;
}

.btn-vip {
  height: 52rpx;
  line-height: 52rpx;
  margin: 0;
  padding: 0 16rpx;
  background: #1677ff;
  color: #fff;
  border-radius: 50rpx;
  font-size: 22rpx;
}

.btn-history::after,
.btn-share::after,
.btn-vip::after {
  border: 0;
}

.btn-vip.hot {
  background: #ff4d4f;
}

.step-nav {
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 20rpx 0;
  flex-wrap: wrap;
}

.step {
  color: #888;
  padding: 0 10rpx;
  font-size: 24rpx;
}

.step.active {
  color: #0099ff;
  font-weight: bold;
}

.arrow {
  color: #ccc;
}

.upload-hero-card,
.upload-main-card,
.flat-lay-style-card,
.mode-card,
.primary-generate-card {
  margin-bottom: 18rpx;
  padding: 26rpx 24rpx;
  border-radius: 24rpx;
  background: #ffffff;
  border: 1rpx solid #edf0f7;
  box-shadow: 0 10rpx 26rpx rgba(31, 72, 128, 0.06);
}

.upload-hero-card {
  background: linear-gradient(145deg, #ffffff 0%, #f2f8ff 100%);
}

.upload-page-title {
  display: block;
  font-size: 42rpx;
  line-height: 1.2;
  font-weight: 800;
  color: #1f2937;
}

.upload-page-subtitle {
  display: block;
  margin-top: 10rpx;
  font-size: 25rpx;
  line-height: 1.55;
  color: #667085;
}

.module-head {
  margin-bottom: 18rpx;
}

.module-title {
  display: block;
  font-size: 30rpx;
  font-weight: 800;
  color: #1f2937;
}

.module-desc {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  line-height: 1.5;
  color: #667085;
}

.flat-lay-style-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx;
}

.flat-lay-style-option {
  min-height: 112rpx;
  padding: 18rpx;
  border: 2rpx solid #e9eef5;
  border-radius: 18rpx;
  background: #f8fafc;
  box-sizing: border-box;
}

.flat-lay-style-option.active {
  border-color: #4f46e5;
  background: #eef2ff;
}

.flat-lay-style-name,
.flat-lay-style-desc {
  display: block;
}

.flat-lay-style-name {
  color: #111827;
  font-size: 26rpx;
  font-weight: 800;
}

.flat-lay-style-desc {
  margin-top: 7rpx;
  color: #667085;
  font-size: 21rpx;
  line-height: 1.4;
}

.quality-tip-card,
.quality-check-card {
  margin-bottom: 20rpx;
  padding: 24rpx;
  border-radius: 20rpx;
  background: #fff;
  border: 2rpx solid #e9eef5;
}

.quality-tip-card.inner {
  margin: 18rpx 0 0;
  padding: 20rpx;
  background: #f8fafc;
}

.quality-check-card {
  margin-top: 20rpx;
  background: #f8fbff;
  border-color: #dbeafe;
}

.quality-tip-title {
  display: block;
  margin-bottom: 12rpx;
  font-size: 30rpx;
  font-weight: 700;
  color: #1f2937;
}

.quality-tip-line,
.quality-tip-foot,
.quality-tip-scene {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  line-height: 1.55;
  color: #475467;
}

.quality-tip-foot {
  margin-top: 16rpx;
  color: #b45309;
  font-weight: 600;
}

.quality-tip-scene {
  margin-top: 16rpx;
  padding: 12rpx 14rpx;
  border-radius: 12rpx;
  background: #e6f4ff;
  color: #1677ff;
}

.template-card {
  margin-bottom: 20rpx;
  padding: 24rpx;
  border-radius: 20rpx;
  background: #f8fbff;
  border: 2rpx solid #dbeafe;
}

.collapsible-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
}

.template-eyebrow {
  display: block;
  font-size: 22rpx;
  color: #1677ff;
  font-weight: 700;
}

.template-title {
  display: block;
  margin-top: 8rpx;
  font-size: 32rpx;
  font-weight: 700;
  color: #1f2937;
}

.template-title.compact {
  margin-top: 6rpx;
  font-size: 26rpx;
}

.template-desc {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  line-height: 1.55;
  color: #475467;
}

.template-preset-list {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  margin-top: 16rpx;
}

.template-preset-item {
  display: block;
  padding: 10rpx 12rpx;
  border-radius: 12rpx;
  background: #fff;
  color: #344054;
  font-size: 24rpx;
}

.template-focus {
  display: block;
  margin-top: 16rpx;
  font-size: 24rpx;
  line-height: 1.55;
  color: #b45309;
  font-weight: 600;
}

.template-switch-btn {
  margin-top: 18rpx;
  border-radius: 16rpx;
  background: #1677ff;
  color: #fff;
  font-size: 24rpx;
}

.template-option-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-top: 18rpx;
}

.template-option {
  padding: 16rpx;
  border-radius: 16rpx;
  background: #fff;
  border: 2rpx solid #e5e7eb;
}

.template-option.active {
  border-color: #1677ff;
  background: #eff6ff;
}

.template-option-title {
  display: block;
  color: #1f2937;
  font-size: 26rpx;
  font-weight: 700;
}

.template-option-desc {
  display: block;
  margin-top: 6rpx;
  color: #667085;
  font-size: 22rpx;
  line-height: 1.5;
}

.advanced-card {
  margin: 20rpx 0;
  padding: 24rpx;
  border-radius: 20rpx;
  background: #fff;
  border: 2rpx solid #e9eef5;
}

.advanced-head {
  display: flex;
  justify-content: space-between;
  gap: 20rpx;
  align-items: center;
}

.advanced-title {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: #1f2937;
}

.advanced-desc {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  line-height: 1.5;
  color: #667085;
}

.advanced-toggle {
  flex-shrink: 0;
  padding: 8rpx 18rpx;
  border-radius: 999rpx;
  background: #eff6ff;
  color: #1677ff;
  font-size: 24rpx;
  font-weight: 700;
}

.simple-auto-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-top: 18rpx;
}

.simple-auto-item {
  padding: 8rpx 14rpx;
  border-radius: 999rpx;
  background: #f5f7fb;
  color: #667085;
  font-size: 22rpx;
}

.advanced-body {
  margin-top: 22rpx;
}

.advanced-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-bottom: 22rpx;
}

.advanced-tab {
  padding: 12rpx 18rpx;
  border-radius: 999rpx;
  background: #f5f7fb;
  color: #475467;
  font-size: 24rpx;
}

.advanced-tab.active {
  background: #1677ff;
  color: #fff;
  font-weight: 700;
}

.advanced-section {
  padding-top: 4rpx;
}

.advanced-section-title {
  display: block;
  margin-bottom: 14rpx;
  font-size: 26rpx;
  font-weight: 700;
  color: #1f2937;
}

.advanced-section-desc {
  display: block;
  margin-bottom: 18rpx;
  font-size: 23rpx;
  line-height: 1.5;
  color: #667085;
}

.advanced-field {
  margin-top: 18rpx;
}

.advanced-field-label {
  display: block;
  margin-bottom: 12rpx;
  font-size: 24rpx;
  font-weight: 700;
  color: #344054;
}

.advanced-input {
  min-height: 76rpx;
  padding: 0 18rpx;
  border: 2rpx solid #e5e7eb;
  border-radius: 14rpx;
  background: #fff;
  color: #344054;
  font-size: 24rpx;
}

.advanced-textarea-wrap {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.advanced-textarea {
  width: 100%;
  min-height: 140rpx;
  box-sizing: border-box;
  padding: 18rpx;
  border: 2rpx solid #e5e7eb;
  border-radius: 14rpx;
  background: #fff;
  color: #344054;
  font-size: 24rpx;
  line-height: 1.5;
}

.advanced-field-tip {
  font-size: 22rpx;
  line-height: 1.5;
  color: #667085;
}

.section-gap {
  margin-top: 24rpx;
}

.advanced-chip-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.advanced-chip {
  padding: 14rpx 18rpx;
  border-radius: 999rpx;
  border: 2rpx solid #e5e7eb;
  background: #fff;
  color: #344054;
  font-size: 24rpx;
}

.advanced-chip.active {
  border-color: #1677ff;
  background: #eff6ff;
  color: #1677ff;
  font-weight: 700;
}

.generate-confirm-card {
  margin-top: 24rpx;
  padding: 24rpx;
  border: 2rpx solid #e5e7eb;
  border-radius: 18rpx;
  background: #ffffff;
}

.prompt-plan-card {
  margin: 24rpx 0;
  padding: 26rpx;
  border-radius: 24rpx;
  background: linear-gradient(180deg, #ffffff 0%, #f8f7ff 100%);
  border: 1rpx solid rgba(91, 108, 255, 0.14);
  box-shadow: 0 14rpx 36rpx rgba(91, 108, 255, 0.08);
}

.prompt-plan-card-final {
  margin-top: 24rpx;
}

.prompt-plan-head {
  display: flex;
  justify-content: space-between;
  gap: 18rpx;
  align-items: flex-start;
}

.prompt-plan-title {
  display: block;
  font-size: 32rpx;
  font-weight: 800;
  color: #1f2937;
}

.prompt-plan-desc {
  display: block;
  margin-top: 10rpx;
  color: #667085;
  font-size: 24rpx;
  line-height: 1.6;
}

.prompt-plan-badge {
  flex-shrink: 0;
  padding: 10rpx 16rpx;
  border-radius: 999rpx;
  background: linear-gradient(135deg, #eef2ff, #faf5ff);
  color: #5b21b6;
  font-size: 22rpx;
  font-weight: 700;
}

.mode-tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12rpx;
  margin-top: 22rpx;
}

.mode-tabs.compact .mode-tab {
  min-height: 64rpx;
}

.mode-tab {
  min-height: 112rpx;
  padding: 18rpx;
  border-radius: 18rpx;
  background: #f8fafc;
  border: 1rpx solid #e5e7eb;
  box-sizing: border-box;
}

.mode-tab.active {
  background: linear-gradient(135deg, rgba(91, 108, 255, 0.12), rgba(168, 85, 247, 0.12));
  border-color: rgba(91, 108, 255, 0.36);
}

.mode-name {
  display: block;
  color: #111827;
  font-size: 26rpx;
  font-weight: 800;
}

.mode-desc {
  display: block;
  margin-top: 8rpx;
  color: #667085;
  font-size: 22rpx;
  line-height: 1.45;
}

.prompt-plan-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 22rpx;
}

.plan-btn {
  margin: 0;
  min-width: 168rpx;
  height: 64rpx;
  line-height: 64rpx;
  border-radius: 999rpx;
  background: #eef2ff;
  color: #3730a3;
  font-size: 24rpx;
}

.plan-btn.primary {
  background: linear-gradient(135deg, #5b6cff, #a855f7);
  color: #fff;
}

.plan-btn.dark {
  background: #111827;
  color: #fff;
}

.plan-btn.disabled {
  background: #e5e7eb;
  color: #98a2b3;
  box-shadow: none;
}

.prompt-plan-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx;
  margin-top: 22rpx;
}

.prompt-plan-grid.final {
  grid-template-columns: 1fr;
}

.prompt-plan-field {
  padding: 18rpx;
  border-radius: 18rpx;
  background: rgba(255, 255, 255, 0.78);
  border: 1rpx solid #edf0f7;
}

.prompt-field-label {
  display: block;
  margin-bottom: 8rpx;
  color: #4f46e5;
  font-size: 23rpx;
  font-weight: 800;
}

.prompt-field-input {
  width: 100%;
  min-height: 76rpx;
  color: #1f2937;
  font-size: 24rpx;
  line-height: 1.55;
}

.prompt-plan-empty {
  display: block;
  margin-top: 20rpx;
  padding: 20rpx;
  border-radius: 18rpx;
  background: #f8fafc;
  color: #667085;
  font-size: 24rpx;
  line-height: 1.6;
}

.generate-confirm-title {
  display: block;
  margin-bottom: 18rpx;
  font-size: 28rpx;
  font-weight: 800;
  color: #111827;
}

.generate-confirm-row {
  display: flex;
  justify-content: space-between;
  gap: 16rpx;
  margin-bottom: 16rpx;
}

.generate-confirm-block {
  margin-top: 18rpx;
}

.generate-confirm-toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.generate-confirm-label {
  display: block;
  flex-shrink: 0;
  font-size: 23rpx;
  font-weight: 700;
  color: #475467;
}

.generate-confirm-value {
  flex: 1;
  text-align: right;
  font-size: 24rpx;
  color: #111827;
}

.generate-confirm-text {
  display: block;
  margin-top: 10rpx;
  padding: 16rpx;
  border-radius: 14rpx;
  background: #f9fafb;
  color: #344054;
  font-size: 23rpx;
  line-height: 1.55;
  white-space: pre-wrap;
}

.generate-confirm-toggle {
  flex-shrink: 0;
  font-size: 23rpx;
  color: #1677ff;
  font-weight: 700;
}

.upload-box {
  background: #f8fbff;
  border: 2rpx dashed #bdd7ff;
  border-radius: 22rpx;
  padding: 54rpx 20rpx;
  text-align: center;
}

.icon {
  font-size: 40rpx;
  font-weight: bold;
  color: #0099ff;
  margin-bottom: 16rpx;
}

.preview {
  position: relative;
}

.upload-preview-card {
  padding-bottom: 8rpx;
}

.img {
  width: 100%;
  height: 420rpx;
  border-radius: 20rpx;
  background: #f2f4f7;
}

.upload-preview-actions {
  position: absolute;
  bottom: 20rpx;
  right: 20rpx;
  display: flex;
  gap: 10rpx;
}

.mini-action-btn,
.retry-upload-btn {
  height: 56rpx;
  line-height: 56rpx;
  margin: 0;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.92);
  color: #1677ff;
  font-size: 22rpx;
}

.mini-action-btn.danger {
  color: #cf1322;
}

.mini-action-btn::after,
.retry-upload-btn::after {
  border: 0;
}

.upload-status {
  display: block;
  margin-top: 16rpx;
  color: #666;
  font-size: 24rpx;
  text-align: center;
}

.primary-generate-btn {
  height: 88rpx;
  line-height: 88rpx;
  margin: 0;
  border-radius: 999rpx;
  background: #1677ff;
  color: #ffffff;
  font-size: 30rpx;
  font-weight: 800;
}

.primary-generate-btn::after {
  border: 0;
}

.primary-generate-btn.is-disabled {
  background: #d0d5dd;
  color: #ffffff;
}

.primary-generate-tip {
  display: block;
  margin-top: 14rpx;
  text-align: center;
  font-size: 23rpx;
  color: #667085;
}

.upload-helper-text {
  display: block;
  margin-top: 12rpx;
  padding: 0 24rpx;
  color: #667085;
  font-size: 23rpx;
  line-height: 1.5;
  text-align: center;
}

.error-text {
  display: block;
  max-width: 100%;
  margin-top: 12rpx;
  white-space: normal;
  overflow-wrap: anywhere;
  color: #ff4d4f;
  font-size: 24rpx;
  line-height: 1.45;
  text-align: center;
}

.card {
  background: #fff;
  border-radius: 20rpx;
  padding: 30rpx;
  margin-bottom: 20rpx;
}

.card-title {
  font-size: 28rpx;
  font-weight: bold;
  margin-bottom: 20rpx;
}

.style-ref-box {
  border: 2rpx dashed #ccc;
  border-radius: 16rpx;
  padding: 40rpx;
  text-align: center;
}

.style-preview {
  text-align: center;
}

.style-image {
  width: 300rpx;
  height: 300rpx;
  border-radius: 16rpx;
  margin: 10rpx 0;
}

.grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.grid-top {
  margin-top: 20rpx;
}

.item {
  flex: 1;
  min-width: 120rpx;
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx 0;
  text-align: center;
  border: 2rpx solid #f0f0f0;
}

.item.on {
  background: #e6f7ff;
  border-color: #0099ff;
}

.btns {
  display: flex;
  gap: 20rpx;
  margin: 30rpx 0;
}

.prev {
  flex: 1;
  background: #f1f1f1;
  border-radius: 50rpx;
  height: 88rpx;
}

.next {
  flex: 1;
  background: #0099ff;
  color: #fff;
  border-radius: 50rpx;
  height: 88rpx;
}

.quick-group {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-top: 24rpx;
}

.quick-btn {
  border-radius: 50rpx;
  height: 88rpx;
}

.single {
  background: #0099ff;
  color: #fff;
}

.quick-btn.is-disabled,
.next-btn.is-disabled {
  opacity: 0.6;
}

.retry {
  background: #fff7e6;
  color: #d46b08;
  border: 2rpx solid #ffd591;
}

.generating {
  text-align: center;
  padding: 40rpx;
}

.progress {
  width: 80%;
  height: 16rpx;
  background: #eee;
  border-radius: 10rpx;
  margin: 20rpx auto;
}

.bar {
  height: 100%;
  background: #0099ff;
  border-radius: 10rpx;
}

.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-card {
  background: #fff;
  width: 80%;
  border-radius: 30rpx;
  padding: 40rpx;
  position: relative;
}

.close {
  position: absolute;
  right: 30rpx;
  top: 30rpx;
  font-size: 40rpx;
}

.modal-title {
  text-align: center;
  font-weight: bold;
  margin-bottom: 30rpx;
}

.vip-item {
  padding: 24rpx;
  background: #f7f8fa;
  border-radius: 16rpx;
  margin-bottom: 16rpx;
  text-align: center;
}

.vip-item.hot {
  background: #fff1f0;
  border: 2rpx solid #ff4d4f;
}

.pay-btn,
.share-btn {
  width: 100%;
  background: #0099ff;
  color: #fff;
  border-radius: 50rpx;
  height: 88rpx;
  margin-top: 20rpx;
}

.share-info {
  text-align: center;
  color: #666;
  margin-bottom: 20rpx;
}

/* Design system final pass */
.container {
  padding: 24rpx 32rpx 56rpx;
  background: #f7f8fc;
}

.top-bar {
  border-radius: 24rpx;
  border-color: rgba(229, 231, 235, 0.9);
  box-shadow: 0 8rpx 20rpx rgba(17, 24, 39, 0.035);
}

.upload-hero-card,
.upload-main-card,
.prompt-plan-card,
.mode-card,
.primary-generate-card,
.advanced-card,
.template-card,
.quality-tip-card,
.quality-check-card,
.confirm-card,
.ai-reference-card,
.card {
  margin-bottom: 24rpx;
  border-radius: 32rpx;
  border: 1rpx solid rgba(229, 231, 235, 0.9);
  background: #ffffff;
  box-shadow: 0 12rpx 28rpx rgba(17, 24, 39, 0.06);
}

.upload-hero-card {
  background: linear-gradient(145deg, #ffffff 0%, #f4f7ff 100%);
}

.upload-box,
.upload-preview-card,
.prompt-plan-field,
.mode-tab,
.advanced-chip,
.template-preset-item,
.template-option,
.quality-tip-card.inner,
.style-ref-box,
.item,
.vip-item {
  border-radius: 24rpx;
}

.upload-page-title {
  color: #111827;
  font-size: 36rpx;
  font-weight: 800;
}

.module-title,
.prompt-plan-title,
.advanced-title,
.template-title,
.quality-tip-title,
.card-title {
  color: #111827;
  font-size: 32rpx;
  font-weight: 800;
}

.upload-page-subtitle,
.module-desc,
.prompt-plan-desc,
.advanced-desc,
.template-desc,
.upload-helper-text,
.primary-generate-tip,
.quality-tip-line,
.quality-tip-foot,
.quality-tip-scene,
.share-info {
  color: #6b7280;
  font-size: 24rpx;
}

.btn-share,
.btn-history,
.plan-btn,
.mini-action-btn,
.retry-upload-btn,
.template-switch-btn,
.advanced-toggle,
.prompt-plan-badge {
  border-radius: 999rpx;
  color: #4f46e5;
  background: #eef2ff;
}

.btn-vip,
.primary-generate-btn,
.plan-btn.primary,
.plan-btn.dark,
.next,
.single,
.pay-btn,
.share-btn {
  background: #2563eb;
  color: #ffffff;
  box-shadow: 0 10rpx 22rpx rgba(37, 99, 235, 0.14);
}

.btn-vip.hot {
  background: #f97316;
}

.primary-generate-btn,
.next,
.prev,
.quick-btn,
.pay-btn,
.share-btn {
  border-radius: 24rpx;
}

.mode-tab.active,
.advanced-chip.active,
.template-option.active,
.item.on {
  border-color: rgba(79, 70, 229, 0.36);
  background: #eef2ff;
  color: #4f46e5;
}

.error-text {
  color: #dc2626;
}

.modal-card {
  border-radius: 32rpx;
  box-shadow: 0 20rpx 46rpx rgba(17, 24, 39, 0.12);
}

/* 图片转结构线稿专用流程 */
.quota-placeholder { color: #98a2b3; font-size: 22rpx; }
.sketch-step-page { padding-bottom: 190rpx; }
.sketch-hero-card,
.sketch-card,
.sketch-guide-card,
.sketch-draft-banner {
  margin-bottom: 24rpx;
  padding: 28rpx 30rpx;
  border: 1rpx solid #e7e9f0;
  border-radius: 32rpx;
  background: #fff;
  box-sizing: border-box;
}
.sketch-hero-card { padding-top: 26rpx; padding-bottom: 26rpx; background: #f7f8ff; }
.sketch-page-title { display: block; color: #111827; font-size: 38rpx; font-weight: 700; line-height: 1.25; }
.sketch-page-subtitle { display: block; margin-top: 12rpx; color: #667085; font-size: 25rpx; line-height: 1.55; }
.sketch-section-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18rpx; margin-bottom: 22rpx; }
.sketch-section-title { display: block; color: #111827; font-size: 30rpx; font-weight: 700; line-height: 1.35; }
.sketch-section-desc { display: block; margin-top: 7rpx; color: #667085; font-size: 23rpx; line-height: 1.5; }
.required-badge { flex: 0 0 auto; padding: 5rpx 12rpx; border-radius: 999rpx; background: #fff1f2; color: #dc2626; font-size: 20rpx; }
.sketch-upload-box { display: flex; min-height: 310rpx; align-items: center; justify-content: center; flex-direction: column; border: 2rpx dashed #aeb5d6; border-radius: 28rpx; background: #fafaff; }
.sketch-upload-icon { display: flex; width: 68rpx; height: 68rpx; align-items: center; justify-content: center; border-radius: 50%; background: #eef2ff; color: #4f46e5; font-size: 44rpx; line-height: 1; }
.sketch-upload-title { margin-top: 18rpx; color: #1f2937; font-size: 28rpx; font-weight: 700; }
.sketch-upload-desc { margin-top: 9rpx; color: #98a2b3; font-size: 22rpx; }
.sketch-upload-pending-tip { margin-top: 18rpx; color: #667085; font-size: 22rpx; line-height: 1.5; }
.sketch-image-preview { position: relative; overflow: hidden; border: 1rpx solid #e5e7eb; border-radius: 26rpx; background: #f8fafc; }
.sketch-image-preview image { display: block; width: 100%; height: 500rpx; }
.sketch-preview-actions { position: absolute; top: 16rpx; right: 16rpx; display: flex; gap: 10rpx; }
.sketch-preview-actions button { min-width: 96rpx; height: 56rpx; margin: 0; padding: 0 18rpx; border-radius: 999rpx; background: rgba(255,255,255,.94); color: #4f46e5; font-size: 22rpx; line-height: 56rpx; }
.sketch-preview-actions button::after { border: 0; }
.sketch-preview-actions button.danger { color: #dc2626; }
.sketch-file-meta { display: flex; flex-wrap: wrap; gap: 10rpx 18rpx; padding: 16rpx 20rpx; border-top: 1rpx solid #e5e7eb; background: #fff; color: #667085; font-size: 21rpx; }
.sketch-error-text { display: block; max-width: 100%; margin: 12rpx 20rpx 0; color: #dc2626; font-size: 22rpx; line-height: 1.45; white-space: normal; overflow-wrap: anywhere; }
.sketch-retry-btn { margin: 12rpx 20rpx 18rpx; color: #4f46e5; background: #eef2ff; }
.sketch-mode-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12rpx; }
.sketch-mode-item { position: relative; min-height: 142rpx; padding: 18rpx 14rpx; border: 2rpx solid #e5e7eb; border-radius: 22rpx; background: #fff; box-sizing: border-box; }
.sketch-mode-item.active { border-color: #4f46e5; background: #f3f2ff; }
.sketch-check { position: absolute; top: 10rpx; right: 12rpx; color: #4f46e5; font-size: 22rpx; font-weight: 700; }
.sketch-mode-name { display: block; color: #1f2937; font-size: 26rpx; font-weight: 700; }
.sketch-mode-desc { display: block; margin-top: 8rpx; color: #667085; font-size: 20rpx; line-height: 1.35; }
.sketch-current,.sketch-recommend-status { flex: 0 0 auto; color: #4f46e5; font-size: 21rpx; }
.sketch-warning { display: block; margin-top: 14rpx; color: #b54708; font-size: 21rpx; line-height: 1.4; }
.sketch-inline-actions { display: flex; gap: 14rpx; }
.sketch-secondary-btn { flex: 1; min-height: 80rpx; margin: 0; border: 1rpx solid #d6daea; border-radius: 20rpx; background: #fff; color: #475467; font-size: 24rpx; line-height: 80rpx; }
.sketch-secondary-btn::after { border: 0; }
.sketch-secondary-btn.accent { border-color: #c7d2fe; background: #eef2ff; color: #4f46e5; }
.sketch-recommend-summary,.sketch-quick-note { display: block; margin-top: 16rpx; padding: 16rpx 18rpx; border-radius: 18rpx; background: #f8fafc; color: #475467; font-size: 22rpx; line-height: 1.45; }
.sketch-setting-group + .sketch-setting-group { margin-top: 24rpx; }
.sketch-setting-label { display: block; margin-bottom: 12rpx; color: #344054; font-size: 25rpx; font-weight: 700; }
.sketch-option-row { display: flex; flex-wrap: wrap; gap: 12rpx; }
.sketch-option { position: relative; min-width: 150rpx; min-height: 78rpx; padding: 14rpx 18rpx; border: 2rpx solid #e5e7eb; border-radius: 20rpx; background: #fff; color: #475467; font-size: 23rpx; box-sizing: border-box; }
.sketch-option.active { border-color: #4f46e5; background: #f3f2ff; color: #4f46e5; }
.sketch-option-check { margin-right: 5rpx; font-weight: 700; }
.sketch-option-desc { display: block; margin-top: 5rpx; color: #667085; font-size: 19rpx; line-height: 1.35; }
.sketch-option.small { min-width: 126rpx; min-height: 68rpx; }
.sketch-advanced-block,.sketch-prompt-block { margin-top: 28rpx; padding-top: 24rpx; border-top: 1rpx solid #eaecf0; }
.sketch-collapsible-head { display: flex; align-items: center; justify-content: space-between; gap: 20rpx; min-height: 72rpx; color: #4f46e5; font-size: 22rpx; }
.sketch-collapsible-title { display: block; color: #1f2937; font-size: 27rpx; font-weight: 700; }
.sketch-collapsible-summary { display: block; margin-top: 6rpx; color: #667085; font-size: 21rpx; line-height: 1.4; }
.sketch-advanced-content { margin-top: 18rpx; }
.sketch-prompt-head { display: flex; align-items: center; justify-content: space-between; color: #98a2b3; font-size: 20rpx; }
.sketch-custom-prompt { width: 100%; height: 190rpx; margin-top: 12rpx; padding: 18rpx; border: 1rpx solid #d9ddea; border-radius: 20rpx; background: #fff; color: #1f2937; font-size: 24rpx; line-height: 1.5; box-sizing: border-box; }
.sketch-prompt-tip,.sketch-check-note { display: block; margin-top: 10rpx; color: #98a2b3; font-size: 20rpx; line-height: 1.45; }
.sketch-check-list view { display: flex; justify-content: space-between; gap: 20rpx; padding: 12rpx 0; border-bottom: 1rpx solid #f0f1f5; color: #475467; font-size: 23rpx; }
.success-text { color: #027a48; }
.sketch-check-state { color: #667085; font-size: 23rpx; }
.sketch-guide-list { display: grid; gap: 12rpx; margin-top: 16rpx; color: #475467; font-size: 23rpx; }
.sketch-guide-list text::before { content: '• '; color: #4f46e5; }
.sketch-draft-banner { display: flex; align-items: center; justify-content: space-between; gap: 20rpx; border-color: #c7d2fe; background: #f5f5ff; }
.sketch-draft-title { display: block; color: #3730a3; font-size: 25rpx; font-weight: 700; }
.sketch-draft-desc { display: block; margin-top: 5rpx; color: #667085; font-size: 21rpx; }
.sketch-draft-actions { display: flex; flex: 0 0 auto; gap: 16rpx; color: #4f46e5; font-size: 22rpx; }
.danger-text { color: #dc2626; }
.sketch-submit-spacer { min-height: 90rpx; padding: 16rpx 4rpx; color: #667085; font-size: 21rpx; }
.sketch-fixed-bar { position: fixed; z-index: 20; right: 0; bottom: 0; left: 0; padding: 14rpx 24rpx calc(14rpx + env(safe-area-inset-bottom)); border-top: 1rpx solid #e5e7eb; background: rgba(255,255,255,.96); box-shadow: 0 -8rpx 24rpx rgba(17,24,39,.06); }
.sketch-fixed-inner { display: flex; max-width: 750rpx; align-items: center; gap: 20rpx; margin: 0 auto; }
.sketch-fixed-copy { flex: 1; min-width: 0; }
.sketch-fixed-title { display: block; color: #1f2937; font-size: 23rpx; font-weight: 700; }
.sketch-fixed-summary { display: block; margin-top: 5rpx; color: #667085; font-size: 20rpx; line-height: 1.35; }
.sketch-submit-btn { flex: 0 0 320rpx; height: 92rpx; margin: 0; border-radius: 22rpx; background: #4f46e5; color: #fff; font-size: 27rpx; font-weight: 700; line-height: 92rpx; }
.sketch-submit-btn::after { border: 0; }
.sketch-submit-btn[disabled] { background: #d8dbe5; color: #667085; opacity: 1; }

/* AI款式起稿专用流程 */
.style-sketch-step-page { padding-bottom: 196rpx; }
.style-sketch-hero-card,
.style-sketch-card,
.style-sketch-guide-card,
.style-sketch-draft-banner {
  margin-bottom: 24rpx;
  padding: 28rpx 30rpx;
  border: 1rpx solid #e7e9f0;
  border-radius: 32rpx;
  background: #fff;
  box-sizing: border-box;
}
.style-sketch-hero-card { padding-top: 26rpx; padding-bottom: 26rpx; background: #f7f8ff; }
.style-sketch-page-title { display: block; color: #111827; font-size: 38rpx; font-weight: 700; line-height: 1.25; }
.style-sketch-page-subtitle { display: block; margin-top: 12rpx; color: #667085; font-size: 25rpx; line-height: 1.5; }
.style-sketch-section-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18rpx; margin-bottom: 22rpx; }
.style-sketch-section-title { display: block; color: #111827; font-size: 30rpx; font-weight: 700; line-height: 1.35; }
.style-sketch-section-desc { display: block; margin-top: 7rpx; color: #667085; font-size: 23rpx; line-height: 1.5; }
.style-sketch-upload-box { display: flex; min-height: 310rpx; align-items: center; justify-content: center; flex-direction: column; border: 2rpx dashed #aeb5d6; border-radius: 28rpx; background: #fafaff; }
.style-sketch-upload-icon { display: flex; width: 68rpx; height: 68rpx; align-items: center; justify-content: center; border-radius: 50%; background: #eef2ff; color: #4f46e5; font-size: 44rpx; line-height: 1; }
.style-sketch-upload-title { margin-top: 18rpx; color: #1f2937; font-size: 28rpx; font-weight: 700; }
.style-sketch-upload-desc { margin-top: 9rpx; color: #98a2b3; font-size: 22rpx; }
.style-sketch-upload-tip { display: block; margin-top: 18rpx; color: #667085; font-size: 22rpx; line-height: 1.5; }
.style-sketch-image-preview { position: relative; overflow: hidden; border: 1rpx solid #e5e7eb; border-radius: 26rpx; background: #f8fafc; }
.style-sketch-image-preview image { display: block; width: 100%; height: 500rpx; }
.style-sketch-preview-actions { position: absolute; top: 16rpx; right: 16rpx; display: flex; gap: 10rpx; }
.style-sketch-preview-actions button { min-width: 96rpx; height: 58rpx; margin: 0; padding: 0 18rpx; border-radius: 999rpx; background: rgba(255,255,255,.94); color: #4f46e5; font-size: 22rpx; line-height: 58rpx; }
.style-sketch-preview-actions button::after { border: 0; }
.style-sketch-preview-actions button.danger { color: #dc2626; }
.style-sketch-file-meta { display: flex; flex-wrap: wrap; gap: 10rpx 18rpx; padding: 16rpx 20rpx; border-top: 1rpx solid #e5e7eb; background: #fff; color: #667085; font-size: 21rpx; }
.style-sketch-error-text { display: block; max-width: 100%; margin: 12rpx 20rpx 0; color: #dc2626; font-size: 22rpx; line-height: 1.45; white-space: normal; overflow-wrap: anywhere; }
.style-sketch-retry-btn { margin: 12rpx 20rpx 18rpx; color: #4f46e5; background: #eef2ff; }
.style-sketch-mode-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12rpx; }
.style-sketch-mode-item { position: relative; min-height: 154rpx; padding: 18rpx 14rpx; border: 2rpx solid #e5e7eb; border-radius: 22rpx; background: #fff; box-sizing: border-box; }
.style-sketch-mode-item.active { border-color: #4f46e5; background: #f3f2ff; }
.style-sketch-check { position: absolute; top: 10rpx; right: 12rpx; color: #4f46e5; font-size: 22rpx; font-weight: 700; }
.style-sketch-mode-name { display: block; color: #1f2937; font-size: 26rpx; font-weight: 700; }
.style-sketch-mode-desc { display: block; margin-top: 8rpx; color: #667085; font-size: 20rpx; line-height: 1.35; }
.style-sketch-current,
.style-sketch-recommend-status { flex: 0 0 auto; color: #4f46e5; font-size: 21rpx; }
.style-sketch-warning { display: block; margin-top: 14rpx; color: #b54708; font-size: 21rpx; line-height: 1.4; }
.style-sketch-inline-actions { display: flex; gap: 14rpx; }
.style-sketch-secondary-btn { flex: 1; min-height: 84rpx; margin: 0; border: 1rpx solid #d6daea; border-radius: 20rpx; background: #fff; color: #475467; font-size: 24rpx; line-height: 84rpx; }
.style-sketch-secondary-btn::after { border: 0; }
.style-sketch-secondary-btn.accent { border-color: #c7d2fe; background: #eef2ff; color: #4f46e5; }
.style-sketch-recommend-summary,
.style-sketch-local-note { display: block; margin-top: 14rpx; padding: 15rpx 18rpx; border-radius: 18rpx; background: #f8fafc; color: #475467; font-size: 21rpx; line-height: 1.45; }
.style-sketch-local-note { color: #667085; }
.remix-recommend-block { margin-top: 26rpx; padding-top: 24rpx; border-top: 1rpx solid #eaecf0; }
.style-sketch-section-head.compact { margin-bottom: 16rpx; }
.style-sketch-setting-group + .style-sketch-setting-group { margin-top: 26rpx; }
.style-sketch-setting-label { display: block; margin-bottom: 12rpx; color: #344054; font-size: 25rpx; font-weight: 700; }
.style-sketch-option-row { display: flex; flex-wrap: wrap; gap: 12rpx; }
.style-sketch-option { display: flex; min-width: 142rpx; min-height: 88rpx; align-items: center; justify-content: center; padding: 14rpx 18rpx; border: 2rpx solid #e5e7eb; border-radius: 22rpx; background: #fff; color: #475467; font-size: 23rpx; box-sizing: border-box; }
.style-sketch-option.active { border-color: #4f46e5; background: #f3f2ff; color: #4f46e5; }
.style-sketch-option-check { min-width: 24rpx; margin-right: 4rpx; font-weight: 700; }
.style-sketch-option.small { min-width: 126rpx; min-height: 78rpx; }
.style-sketch-advanced-block,
.style-sketch-prompt-block { margin-top: 28rpx; padding-top: 24rpx; border-top: 1rpx solid #eaecf0; }
.style-sketch-collapsible-head { display: flex; min-height: 82rpx; align-items: center; justify-content: space-between; gap: 20rpx; color: #4f46e5; font-size: 22rpx; }
.style-sketch-collapsible-title { display: block; color: #1f2937; font-size: 27rpx; font-weight: 700; }
.style-sketch-collapsible-summary { display: block; margin-top: 6rpx; color: #667085; font-size: 21rpx; line-height: 1.4; }
.style-sketch-advanced-content { margin-top: 18rpx; }
.style-sketch-prompt-head { display: flex; align-items: center; justify-content: space-between; color: #98a2b3; font-size: 20rpx; }
.style-sketch-custom-prompt { width: 100%; height: 184rpx; margin-top: 12rpx; padding: 18rpx; border: 1rpx solid #d9ddea; border-radius: 20rpx; background: #fff; color: #1f2937; font-size: 24rpx; line-height: 1.5; box-sizing: border-box; }
.style-sketch-prompt-tip,
.style-sketch-check-note { display: block; margin-top: 10rpx; color: #98a2b3; font-size: 20rpx; line-height: 1.45; }
.style-sketch-check-list view { display: flex; justify-content: space-between; gap: 20rpx; padding: 12rpx 0; border-bottom: 1rpx solid #f0f1f5; color: #475467; font-size: 23rpx; }
.style-sketch-check-state { margin-top: 14rpx; color: #667085; font-size: 23rpx; }
.style-sketch-guide-list { display: grid; gap: 12rpx; margin-top: 16rpx; color: #475467; font-size: 23rpx; }
.style-sketch-guide-list text::before { content: '• '; color: #4f46e5; }
.style-sketch-draft-banner { display: flex; align-items: center; justify-content: space-between; gap: 20rpx; border-color: #c7d2fe; background: #f5f5ff; }
.style-sketch-draft-title { display: block; color: #3730a3; font-size: 25rpx; font-weight: 700; }
.style-sketch-draft-desc { display: block; margin-top: 5rpx; color: #667085; font-size: 21rpx; }
.style-sketch-draft-actions { display: flex; flex: 0 0 auto; gap: 16rpx; color: #4f46e5; font-size: 22rpx; }
.style-sketch-submit-spacer { min-height: 94rpx; padding: 16rpx 4rpx; color: #667085; font-size: 21rpx; }
.style-sketch-fixed-bar { position: fixed; z-index: 20; right: 0; bottom: 0; left: 0; padding: 14rpx 24rpx calc(14rpx + env(safe-area-inset-bottom)); border-top: 1rpx solid #e5e7eb; background: rgba(255,255,255,.97); box-shadow: 0 -8rpx 24rpx rgba(17,24,39,.06); }
.style-sketch-fixed-inner { display: flex; max-width: 750rpx; align-items: center; gap: 18rpx; margin: 0 auto; }
.style-sketch-fixed-copy { flex: 1; min-width: 0; }
.style-sketch-fixed-title { display: block; color: #1f2937; font-size: 23rpx; font-weight: 700; }
.style-sketch-fixed-summary { display: block; overflow: hidden; margin-top: 5rpx; color: #667085; font-size: 20rpx; line-height: 1.35; text-overflow: ellipsis; white-space: nowrap; }
.style-sketch-fixed-summary.error { color: #b42318; white-space: normal; }
.style-sketch-submit-btn { flex: 0 0 310rpx; height: 92rpx; margin: 0; border-radius: 22rpx; background: #4f46e5; color: #fff; font-size: 27rpx; font-weight: 700; line-height: 92rpx; }
.style-sketch-submit-btn::after { border: 0; }
.style-sketch-submit-btn[disabled] { background: #d8dbe5; color: #667085; opacity: 1; }

.batch-model-step-page { padding-bottom: 190rpx; background: #f5f6fa; }
.batch-step-rail { position: sticky; z-index: 20; top: 0; display: grid; grid-template-columns: repeat(5,minmax(0,1fr)); margin: 0 0 20rpx; padding: 16rpx 10rpx; border: 1rpx solid #e8eaf1; border-radius: 18rpx; background: rgba(255,255,255,.96); box-shadow: 0 6rpx 18rpx rgba(17,24,39,.04); }
.batch-step-item { position: relative; display: flex; min-width: 0; align-items: center; flex-direction: column; gap: 8rpx; color: #98a2b3; }
.batch-step-item:not(:last-child)::after { position: absolute; z-index: 0; top: 19rpx; left: calc(50% + 22rpx); width: calc(100% - 44rpx); height: 2rpx; background: #e4e7ec; content: ''; }
.batch-step-item.completed:not(:last-child)::after { background: #4f46e5; }
.batch-step-dot { position: relative; z-index: 1; width: 40rpx; height: 40rpx; border-radius: 50%; background: #eef0f4; color: #667085; font-size: 20rpx; font-weight: 700; line-height: 40rpx; text-align: center; }
.batch-step-item.active .batch-step-dot { background: #4f46e5; color: #fff; box-shadow: 0 0 0 7rpx rgba(79,70,229,.1); }.batch-step-item.completed .batch-step-dot { background: #e8f7ee; color: #15803d; }
.batch-step-label { overflow: hidden; max-width: 100%; color: inherit; font-size: 19rpx; text-align: center; text-overflow: ellipsis; white-space: nowrap; }.batch-step-item.active .batch-step-label { color: #4338ca; font-weight: 700; }.batch-step-item.completed .batch-step-label { color: #475467; }
.batch-step-panel { min-height: 560rpx; }
.batch-hero-card, .batch-card { margin-bottom: 20rpx; padding: 28rpx; border: 1rpx solid #e8eaf1; border-radius: 24rpx; background: #fff; box-sizing: border-box; }
.batch-hero-card { background: linear-gradient(145deg, #f4f4ff 0%, #fff 70%); border-color: #dddafe; }
.batch-page-title { display: block; color: #1f2937; font-size: 38rpx; font-weight: 800; }
.batch-page-subtitle { display: block; margin-top: 10rpx; color: #667085; font-size: 24rpx; line-height: 1.55; }
.batch-flow-line { display: flex; gap: 12rpx; margin-top: 20rpx; }
.batch-flow-line text { flex: 1; padding: 10rpx 8rpx; border-radius: 12rpx; background: rgba(79,70,229,.08); color: #4f46e5; font-size: 21rpx; text-align: center; }
.batch-section-head, .batch-collapsible-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 20rpx; }
.batch-section-title { display: block; color: #1f2937; font-size: 30rpx; font-weight: 700; }
.batch-section-desc { display: block; margin-top: 8rpx; color: #667085; font-size: 23rpx; line-height: 1.5; }
.batch-count-badge, .batch-required { flex-shrink: 0; padding: 7rpx 14rpx; border-radius: 999rpx; background: #f1efff; color: #4f46e5; font-size: 21rpx; font-weight: 700; }
.batch-upload-box { display: flex; min-height: 250rpx; align-items: center; justify-content: center; flex-direction: column; margin-top: 22rpx; border: 2rpx dashed #b8b5ee; border-radius: 20rpx; background: #fafaff; }
.batch-upload-icon, .batch-add-icon { color: #4f46e5; font-size: 54rpx; line-height: 1; }
.batch-upload-title { margin-top: 12rpx; color: #1f2937; font-size: 27rpx; font-weight: 700; }
.batch-upload-desc { margin-top: 8rpx; color: #98a2b3; font-size: 21rpx; }
.batch-image-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 16rpx; margin-top: 22rpx; }
.batch-image-item { position: relative; overflow: hidden; border: 2rpx solid #e5e7eb; border-radius: 18rpx; background: #f8fafc; }
.batch-image-item.invalid { border-color: #fda29b; background: #fff7f6; }
.batch-image-item image { width: 100%; height: 196rpx; }
.batch-image-order { position: absolute; top: 10rpx; left: 10rpx; width: 38rpx; height: 38rpx; border-radius: 50%; background: rgba(17,24,39,.72); color: #fff; font-size: 20rpx; line-height: 38rpx; text-align: center; }
.batch-upload-status { display: inline-block; margin: 10rpx 12rpx; color: #667085; font-size: 21rpx; }
.batch-upload-status.success { color: #15803d; }.batch-upload-status.failed { color: #b42318; }.batch-upload-status.uploading { color: #4f46e5; }
.batch-image-meta { display: block; overflow: hidden; padding: 0 12rpx 12rpx; color: #98a2b3; font-size: 18rpx; text-overflow: ellipsis; white-space: nowrap; }
.batch-image-error { display: block; overflow: hidden; padding: 0 12rpx 10rpx; color: #b42318; font-size: 19rpx; line-height: 1.35; text-overflow: ellipsis; white-space: nowrap; }
.batch-order-actions { display: flex; gap: 16rpx; padding: 4rpx 12rpx 12rpx; color: #667085; font-size: 20rpx; }.batch-order-actions .disabled { color: #c7cdd8; }
.batch-image-actions { display: flex; justify-content: flex-end; gap: 14rpx; padding: 0 12rpx 12rpx; color: #4f46e5; font-size: 21rpx; }
.batch-image-add { display: flex; min-height: 300rpx; align-items: center; justify-content: center; flex-direction: column; gap: 10rpx; border: 2rpx dashed #c9c7e9; border-radius: 18rpx; color: #4f46e5; font-size: 22rpx; }
.batch-check-summary { display: flex; flex-wrap: wrap; gap: 16rpx; margin-top: 18rpx; color: #667085; font-size: 22rpx; }.batch-check-summary .error { color: #b42318; }
.batch-consistency { display: flex; align-items: center; gap: 16rpx; margin-top: 20rpx; padding: 18rpx; border-radius: 16rpx; background: #f4f4ff; }
.batch-consistency-check { display: flex; width: 42rpx; height: 42rpx; align-items: center; justify-content: center; border-radius: 50%; background: #4f46e5; color: #fff; font-size: 23rpx; }
.batch-consistency-title { display: block; color: #3730a3; font-size: 24rpx; font-weight: 700; }.batch-consistency-desc { display: block; margin-top: 4rpx; color: #667085; font-size: 21rpx; }
.batch-preset-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 12rpx; }.batch-preset-item { min-height: 100rpx; padding: 16rpx; border: 2rpx solid #e4e7ec; border-radius: 16rpx; background: #fafafa; box-sizing: border-box; }.batch-preset-item.active { border-color: #4f46e5; background: #f2f1ff; }.batch-preset-name { display: block; color: #344054; font-size: 22rpx; font-weight: 700; }.batch-preset-item.active .batch-preset-name { color: #4338ca; }.batch-preset-desc { display: block; margin-top: 6rpx; color: #667085; font-size: 19rpx; line-height: 1.35; }
.batch-field { margin-top: 24rpx; }.batch-field-label { display: block; margin-bottom: 12rpx; color: #344054; font-size: 24rpx; font-weight: 700; }
.batch-model-profile-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16rpx; }.batch-model-profile-head .batch-field-label { margin-bottom: 4rpx; }.batch-model-profile-head .batch-text-btn { flex: 0 0 auto; }
.batch-model-profile-list { display: flex; gap: 14rpx; overflow-x: auto; padding: 4rpx 0 8rpx; }.batch-model-profile-card { position: relative; width: 150rpx; flex: 0 0 150rpx; overflow: hidden; border: 2rpx solid #e4e7ec; border-radius: 16rpx; background: #fff; }.batch-model-profile-card.active { border-color: #4f46e5; background: #f2f1ff; }.batch-model-profile-image { width: 150rpx; height: 150rpx; display: flex; align-items: center; justify-content: center; background: #eef2ff; color: #4f46e5; font-size: 42rpx; }.batch-model-profile-name { display: block; padding: 10rpx 8rpx; overflow: hidden; color: #344054; font-size: 21rpx; font-weight: 600; white-space: nowrap; text-overflow: ellipsis; }.batch-model-profile-check { position: absolute; top: 8rpx; right: 8rpx; width: 34rpx; height: 34rpx; border-radius: 50%; background: #4f46e5; color: #fff; font-size: 21rpx; line-height: 34rpx; text-align: center; }
.batch-field-sublabel { display: block; margin: 18rpx 0 10rpx; color: #667085; font-size: 22rpx; font-weight: 600; }
.batch-chip-grid { display: flex; flex-wrap: wrap; gap: 12rpx; }
.batch-chip { min-height: 68rpx; padding: 0 20rpx; border: 2rpx solid #e4e7ec; border-radius: 16rpx; background: #fff; color: #475467; font-size: 23rpx; line-height: 68rpx; box-sizing: border-box; }
.batch-chip.active { border-color: #4f46e5; background: #f2f1ff; color: #4338ca; font-weight: 700; }.batch-chip-check { margin-right: 8rpx; }
.batch-field-note { display: block; margin-top: 18rpx; color: #98a2b3; font-size: 21rpx; line-height: 1.5; }
.batch-char-count { display: block; margin-top: 8rpx; color: #98a2b3; font-size: 20rpx; text-align: right; }
.batch-mode-grid { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 12rpx; }
.batch-mode-item { min-height: 126rpx; padding: 16rpx 12rpx; border: 2rpx solid #e4e7ec; border-radius: 16rpx; background: #fff; box-sizing: border-box; }
.batch-mode-item.active { border-color: #4f46e5; background: #f2f1ff; }.batch-mode-name { display: block; color: #1f2937; font-size: 23rpx; font-weight: 700; }.batch-mode-item.active .batch-mode-name { color: #4338ca; }.batch-mode-desc { display: block; margin-top: 7rpx; color: #667085; font-size: 19rpx; line-height: 1.4; }
.batch-collapsible-head { align-items: center; }.batch-chevron { flex-shrink: 0; color: #667085; font-size: 32rpx; }.batch-collapsible-body { padding-top: 4rpx; }
.batch-guide-card { padding-top: 20rpx; padding-bottom: 20rpx; }.batch-guide-title { display: block; color: #344054; font-size: 24rpx; font-weight: 700; }.batch-advanced-toggle { display: flex; align-items: center; justify-content: space-between; margin-top: 22rpx; padding: 18rpx; border-radius: 16rpx; background: #f7f8fa; }
.batch-guide-list { display: grid; gap: 12rpx; margin-top: 18rpx; color: #475467; font-size: 22rpx; line-height: 1.5; }.batch-guide-list text::before { content: '• '; color: #4f46e5; }
.batch-textarea { width: 100%; min-height: 130rpx; padding: 18rpx; border: 2rpx solid #e4e7ec; border-radius: 16rpx; color: #344054; font-size: 23rpx; line-height: 1.5; box-sizing: border-box; }
.batch-suggestion-card { display: flex; align-items: center; justify-content: space-between; gap: 20rpx; }.batch-suggestion-card > view { flex: 1; }
.batch-recommendation-summary { display: block; margin-top: 10rpx; color: #4338ca; font-size: 21rpx; line-height: 1.45; }.batch-recommendation-actions { display: flex; flex: 0 0 230rpx !important; flex-direction: column; gap: 8rpx; }
.batch-platform-tip, .batch-output-count { display: flex; align-items: center; justify-content: space-between; gap: 18rpx; margin-top: 22rpx; padding: 18rpx; border-radius: 16rpx; background: #f7f8ff; color: #475467; font-size: 22rpx; }.batch-platform-tip .batch-text-btn { width: auto; color: #4f46e5; }.batch-fixed-count { flex-shrink: 0; color: #4338ca; font-size: 26rpx; font-weight: 700; }
.batch-secondary-btn { width: 100%; height: 72rpx; margin: 0; border: 2rpx solid #c7c4f4; border-radius: 16rpx; background: #f7f6ff; color: #4f46e5; font-size: 22rpx; line-height: 72rpx; }.batch-secondary-btn.primary { background: #4f46e5; color: #fff; }.batch-secondary-btn::after, .batch-text-btn::after { border: 0; }.batch-text-btn { height: 54rpx; margin: 0; background: transparent; color: #667085; font-size: 21rpx; line-height: 54rpx; }
.batch-confirm-card { background: #fafaff; }.batch-confirm-row { display: flex; justify-content: space-between; gap: 20rpx; padding: 14rpx 0; border-bottom: 1rpx solid #ececf3; color: #475467; font-size: 23rpx; }.batch-confirm-row text:last-child { color: #1f2937; text-align: right; font-weight: 600; }.batch-confirm-note { display: block; margin-top: 18rpx; color: #667085; font-size: 21rpx; line-height: 1.5; }
.batch-formula { display: block; margin-top: 18rpx; padding: 15rpx; border-radius: 12rpx; background: #eef2ff; color: #3730a3; font-size: 22rpx; line-height: 1.45; }.batch-quota-warning { margin-top: 20rpx; padding: 20rpx; border: 1rpx solid #fecaca; border-radius: 16rpx; background: #fff7f6; color: #7a271a; font-size: 22rpx; line-height: 1.5; }.batch-quota-title { display: block; margin-bottom: 6rpx; color: #b42318; font-size: 25rpx; font-weight: 700; }.batch-quota-actions { display: flex; flex-wrap: wrap; gap: 10rpx; margin-top: 16rpx; }.batch-quota-actions .batch-secondary-btn { width: auto; min-width: 180rpx; padding: 0 18rpx; }.batch-quota-actions .batch-text-btn { width: auto; }
.batch-submit-spacer { height: 100rpx; }.batch-fixed-bar { position: fixed; z-index: 30; right: 0; bottom: 0; left: 0; padding: 14rpx 24rpx calc(14rpx + env(safe-area-inset-bottom)); border-top: 1rpx solid #e5e7eb; background: rgba(255,255,255,.97); box-shadow: 0 -8rpx 24rpx rgba(17,24,39,.06); }
.batch-fixed-inner { display: flex; max-width: 750rpx; align-items: center; gap: 18rpx; margin: 0 auto; }.batch-fixed-copy { flex: 1; min-width: 0; }.batch-fixed-title { display: block; color: #1f2937; font-size: 23rpx; font-weight: 700; }.batch-fixed-desc { display: block; overflow: hidden; margin-top: 5rpx; color: #667085; font-size: 20rpx; line-height: 1.35; text-overflow: ellipsis; white-space: nowrap; }
.batch-prev-btn, .batch-next-btn, .batch-submit-btn { height: 88rpx; margin: 0; border-radius: 18rpx; font-size: 25rpx; font-weight: 700; line-height: 88rpx; box-sizing: border-box; }.batch-prev-btn::after, .batch-next-btn::after, .batch-submit-btn::after { border: 0; }.batch-prev-btn { flex: 0 0 190rpx; border: 2rpx solid #d0d5dd; background: #fff; color: #475467; }.batch-next-btn, .batch-submit-btn { flex: 1; background: #4f46e5; color: #fff; }.batch-prev-btn[disabled], .batch-next-btn[disabled], .batch-submit-btn[disabled] { background: #e4e7ec; color: #667085; opacity: 1; }
@media (max-width: 360px) { .batch-step-label { font-size: 17rpx; }.batch-card { padding: 22rpx; }.batch-preset-grid { grid-template-columns: 1fr; }.batch-prev-btn { flex-basis: 160rpx; } }

@media (max-width: 340px) {
  .sketch-mode-grid { gap: 8rpx; }
  .sketch-mode-item { min-height: 152rpx; padding: 16rpx 10rpx; }
  .sketch-mode-name { font-size: 24rpx; }
  .sketch-submit-btn { flex-basis: 280rpx; }
  .style-sketch-mode-grid { gap: 8rpx; }
  .style-sketch-mode-item { min-height: 166rpx; padding: 16rpx 10rpx; }
  .style-sketch-mode-name { font-size: 24rpx; }
  .style-sketch-submit-btn { flex-basis: 270rpx; font-size: 24rpx; }
  .batch-image-grid { gap: 10rpx; }.batch-chip { padding: 0 14rpx; }.batch-submit-btn { flex-basis: 270rpx; font-size: 23rpx; }.batch-fixed-desc { white-space: normal; }
  .batch-mode-grid { gap: 8rpx; }.batch-mode-item { min-height: 140rpx; padding: 14rpx 8rpx; }.batch-mode-desc { font-size: 18rpx; }.batch-suggestion-card { align-items: stretch; flex-direction: column; }.batch-recommendation-actions { flex-basis: auto !important; width: 100%; }
}
</style>
