<template>
  <view v-if="isGarmentTool" class="simple-page garment-replace-page">
    <AiFeatureHeader title="换衣服" description="上传人物图片，可分别替换上装、下装，或使用整套服装参考图。" />

    <view v-if="garmentRuntimeConfig.isTestStage" class="runtime-test-panel">
      <view class="runtime-test-head"><text class="runtime-test-badge">测试模式</text><text>{{ garmentRuntimeConfig.stage }}</text></view>
      <text class="runtime-test-notice">当前为测试模式，结果仅用于功能与模型效果验证，不作为正式交付。</text>
      <view v-if="false" class="runtime-test-modes">
        <view :class="['runtime-test-mode', { active: garmentRuntimeConfig.executionMode === 'flow_mock' }]" @click="selectTestExecutionMode('flow_mock')">流程测试</view>
        <view :class="['runtime-test-mode', { active: garmentRuntimeConfig.executionMode === 'model_experiment', disabled: !garmentRuntimeConfig.modelEffectTestEnabled }]" @click="selectTestExecutionMode('model_experiment', garmentRuntimeConfig)">模型效果测试</view>
      </view>
      <text class="runtime-test-provider">Provider：{{ garmentRuntimeConfig.provider }} · 模型：{{ garmentRuntimeConfig.model }} · {{ garmentRuntimeConfig.realProviderTest ? '真实调用，预计消耗 5 次' : '流程测试，不扣额度' }}</text>
    </view>

    <view class="garment-wizard-steps">
      <view v-for="step in garmentWizardSteps" :key="step.value" class="garment-wizard-step" :class="{ active: garmentCurrentStep === step.value, done: garmentCurrentStep > step.value }">
        <text class="garment-wizard-index">{{ garmentCurrentStep > step.value ? '✓' : step.value }}</text>
        <text class="garment-wizard-label">{{ step.label }}</text>
      </view>
    </view>

    <view v-if="garmentCurrentStep === 1" class="garment-section garment-wizard-panel">
      <view class="garment-section-head">
        <view class="garment-section-copy"><view class="garment-title-row"><text class="garment-title">选择人物</text><text class="garment-required">必填</text></view><text class="garment-desc">建议使用正面或轻微侧身，五官、身体和服装区域清晰的图片。</text></view>
      </view>
      <view class="garment-source-tabs">
        <view :class="['garment-source-tab', { active: garmentPersonSource === 'upload' }]" @tap="selectGarmentPersonSource('upload')">上传人物图片</view>
        <view :class="['garment-source-tab', { active: garmentPersonSource === 'profiles' }]" @tap="selectGarmentPersonSource('profiles')">我的常用模特</view>
      </view>
      <template v-if="garmentPersonSource === 'upload'">
        <view v-if="!garmentPersonImage" class="garment-upload large" :class="{ uploading: garmentUploadStatus.person === 'uploading' }" @click="chooseGarmentImage('person')">
          <text class="garment-upload-icon">+</text><text class="garment-upload-title">{{ garmentUploadStatus.person === 'uploading' ? '人物图片上传中...' : '上传人物图片' }}</text><text class="garment-upload-desc">支持 JPG、PNG、WEBP</text>
        </view>
        <view v-else class="garment-preview-card large"><image class="garment-preview" :src="garmentPersonImage" mode="aspectFit" /><view class="garment-preview-actions"><text @click="chooseGarmentImage('person')">更换</text><text class="danger" @click="removeGarmentImage('person')">删除</text></view></view>
      </template>
      <template v-else>
        <view v-if="modelProfilesLoading" class="garment-empty-hint">正在加载常用模特...</view>
        <view v-else-if="myModelProfiles.length" class="garment-profile-grid">
          <view v-for="profile in myModelProfiles" :key="profile.modelProfileId" :class="['garment-profile-card', { active: garmentSelectedModelProfileId === profile.modelProfileId }]" @click="selectGarmentModelProfile(profile)">
            <image class="garment-profile-cover" :src="profile.coverUrl || profile.coverFileId" mode="aspectFill" /><view class="garment-profile-footer"><text>{{ profile.name }}</text><text v-if="garmentSelectedModelProfileId === profile.modelProfileId">✓</text></view>
          </view>
        </view>
        <view v-else class="garment-empty-hint">还没有常用模特，请先添加已授权的人像。</view>
        <button class="garment-manage-button" @click="openModelProfiles">{{ myModelProfiles.length ? '管理常用模特' : '添加常用模特' }}</button>
      </template>
      <text v-if="garmentUploadErrors.person" class="garment-error">{{ garmentUploadErrors.person }}</text>
    </view>

    <view v-if="garmentCurrentStep === 2" class="garment-section garment-wizard-panel">
      <view class="garment-section-head"><view class="garment-section-copy"><text class="garment-title">选择服装</text><text class="garment-desc">选择换装方式后，仅提交当前模式需要的服装图片。</text></view></view>
      <view class="garment-mode-grid">
        <view v-for="item in garmentReplaceModes" :key="item.value" class="garment-mode-card" :class="{ active: garmentReplaceMode === item.value }" @tap="selectGarmentReplaceMode(item.value)"><text class="garment-mode-check">{{ garmentReplaceMode === item.value ? '✓' : '' }}</text><text class="garment-mode-title">{{ item.label }}</text><text class="garment-mode-desc">{{ item.desc }}</text></view>
      </view>
      <view class="garment-reference-grid" :class="{ paired: garmentReplaceMode === 'separate' }">
        <view v-if="garmentNeedsUpper" class="garment-reference-field"><view class="garment-title-row"><text class="garment-field-title">上装参考图</text><text class="garment-required">必填</text></view><view v-if="!garmentUpperImage" class="garment-upload compact" :class="{ uploading: garmentUploadStatus.upper === 'uploading' }" @click="chooseGarmentImage('upper')"><text class="garment-upload-icon small">+</text><text class="garment-upload-title">{{ garmentUploadStatus.upper === 'uploading' ? '上传中...' : '上传上装' }}</text></view><view v-else class="garment-preview-card compact"><image class="garment-preview" :src="garmentUpperImage" mode="aspectFit" /><view class="garment-preview-actions"><text @click="chooseGarmentImage('upper')">更换</text><text class="danger" @click="removeGarmentImage('upper')">删除</text></view></view><text v-if="garmentUploadErrors.upper" class="garment-error">{{ garmentUploadErrors.upper }}</text></view>
        <view v-if="garmentNeedsLower" class="garment-reference-field"><view class="garment-title-row"><text class="garment-field-title">下装参考图</text><text class="garment-required">必填</text></view><view v-if="!garmentLowerImage" class="garment-upload compact" :class="{ uploading: garmentUploadStatus.lower === 'uploading' }" @click="chooseGarmentImage('lower')"><text class="garment-upload-icon small">+</text><text class="garment-upload-title">{{ garmentUploadStatus.lower === 'uploading' ? '上传中...' : '上传下装' }}</text></view><view v-else class="garment-preview-card compact"><image class="garment-preview" :src="garmentLowerImage" mode="aspectFit" /><view class="garment-preview-actions"><text @click="chooseGarmentImage('lower')">更换</text><text class="danger" @click="removeGarmentImage('lower')">删除</text></view></view><text v-if="garmentUploadErrors.lower" class="garment-error">{{ garmentUploadErrors.lower }}</text></view>
        <view v-if="garmentNeedsOutfit" class="garment-reference-field full"><view class="garment-title-row"><text class="garment-field-title">整套服装参考图</text><text class="garment-required">必填</text></view><view v-if="!garmentOutfitImage" class="garment-upload compact" :class="{ uploading: garmentUploadStatus.outfit === 'uploading' }" @click="chooseGarmentImage('outfit')"><text class="garment-upload-icon small">+</text><text class="garment-upload-title">{{ garmentUploadStatus.outfit === 'uploading' ? '上传中...' : '上传完整服装' }}</text></view><view v-else class="garment-preview-card compact"><image class="garment-preview" :src="garmentOutfitImage" mode="aspectFit" /><view class="garment-preview-actions"><text @click="chooseGarmentImage('outfit')">更换</text><text class="danger" @click="removeGarmentImage('outfit')">删除</text></view></view><text v-if="garmentUploadErrors.outfit" class="garment-error">{{ garmentUploadErrors.outfit }}</text></view>
      </view>
    </view>

    <view v-if="garmentCurrentStep === 3" class="garment-section garment-wizard-panel">
      <view class="garment-section-head"><view class="garment-section-copy"><view class="garment-title-row"><text class="garment-title">配饰与保留</text><text class="garment-optional">配饰可选</text></view><text class="garment-desc">选择配饰后，将显示该配饰自己的参考图上传区。</text></view></view>
      <view class="garment-accessory-limit">{{ garmentAccessoryLimitText }}</view>
      <view class="garment-accessory-types">
        <view v-for="item in garmentAccessoryTypes" :key="item.value" class="garment-accessory-type" :class="{ active: garmentSelectedAccessoryTypes.includes(item.value), disabled: garmentAccessoryLimit === 0 }" @tap="toggleGarmentAccessoryType(item.value)">{{ item.label }}</view>
      </view>
      <view v-for="type in garmentSelectedAccessoryTypes" :key="type" class="garment-accessory-field">
        <view class="garment-title-row"><text class="garment-field-title">{{ getGarmentAccessoryLabel(type) }}参考图</text><text class="garment-required">必填</text></view>
        <view v-if="!getGarmentAccessoryByType(type)" class="garment-upload compact" :class="{ uploading: garmentAccessoryUploadStatus[type] === 'uploading' }" @click="chooseGarmentAccessoryImage(type)"><text class="garment-upload-icon small">+</text><text class="garment-upload-title">{{ garmentAccessoryUploadStatus[type] === 'uploading' ? '上传中...' : `上传${getGarmentAccessoryLabel(type)}参考图` }}</text></view>
        <view v-else class="garment-preview-card compact"><image class="garment-preview" :src="getGarmentAccessoryByType(type).imageUrl" mode="aspectFit" /><view class="garment-preview-actions"><text @click="chooseGarmentAccessoryImage(type)">更换</text><text class="danger" @click="clearGarmentAccessorySelection(type)">删除</text></view></view>
        <text v-if="garmentAccessoryUploadErrors[type]" class="garment-error">{{ garmentAccessoryUploadErrors[type] }}</text>
        <scroll-view v-if="getGarmentAccessoryLibraryItems(type).length" scroll-x class="garment-accessory-scroll"><view class="garment-accessory-list"><view v-for="item in getGarmentAccessoryLibraryItems(type)" :key="item.accessoryId" class="garment-accessory-card" :class="{ active: getGarmentAccessoryByType(type) && getGarmentAccessoryByType(type).accessoryId === item.accessoryId }" @click="selectGarmentAccessory(item)"><image class="garment-accessory-card-image" :src="item.imageUrl" mode="aspectFill" lazy-load /><text class="garment-accessory-card-name">{{ item.name }}</text><text class="garment-accessory-card-delete" @click.stop="deleteGarmentAccessory(item)">删除</text></view></view></scroll-view>
      </view>
      <view class="garment-preserve-summary"><view v-for="item in garmentPreserveOptions" :key="item.key" class="garment-preserve-summary-item"><text class="garment-check" :class="{ active: garmentPreserve[item.key] }">{{ garmentPreserve[item.key] ? '✓' : '' }}</text><text>{{ item.label }}</text></view></view>
      <view class="garment-advanced-toggle" @click="garmentAdvancedPreserveExpanded = !garmentAdvancedPreserveExpanded"><text>高级保留设置</text><text>{{ garmentAdvancedPreserveExpanded ? '收起' : '展开' }}</text></view>
      <view v-if="garmentAdvancedPreserveExpanded" class="garment-preserve-list"><view v-for="item in garmentPreserveOptions" :key="item.key" class="garment-preserve-row" @click="toggleGarmentPreserve(item.key)"><view><text class="garment-preserve-title">{{ item.label }}</text><text class="garment-preserve-desc">{{ item.desc }}</text></view><text class="garment-check" :class="{ active: garmentPreserve[item.key] }">{{ garmentPreserve[item.key] ? '✓' : '' }}</text></view></view>
    </view>

    <view v-if="garmentCurrentStep === 4" class="garment-section garment-wizard-panel">
      <view class="garment-section-head"><view class="garment-section-copy"><text class="garment-title">确认生成</text><text class="garment-desc">提交前确认本次换装内容。</text></view></view>
      <view class="garment-confirm-list">
        <view class="garment-confirm-row"><text>人物图片</text><text>{{ garmentPersonSource === 'profiles' ? garmentSelectedModelProfileName : '已上传' }}</text><text class="garment-edit" @click="goToGarmentStep(1)">修改</text></view>
        <view class="garment-confirm-row"><text>换装方式</text><text>{{ garmentReplaceModeLabel }}</text><text class="garment-edit" @click="goToGarmentStep(2)">修改</text></view>
        <view class="garment-confirm-row"><text>服装参考</text><text>{{ garmentReferenceSummary }}</text><text class="garment-edit" @click="goToGarmentStep(2)">修改</text></view>
        <view class="garment-confirm-row"><text>已选配饰</text><text>{{ garmentAccessorySummary }}</text><text class="garment-edit" @click="goToGarmentStep(3)">修改</text></view>
        <view class="garment-confirm-row"><text>保留要求</text><text>{{ garmentPreserveSummary }}</text><text class="garment-edit" @click="goToGarmentStep(3)">修改</text></view>
        <view class="garment-confirm-row"><text>预计生成</text><text>1 张</text></view>
        <view class="garment-confirm-row"><text>预计消耗</text><text>1 次（以实际额度规则为准）</text></view>
      </view>
    </view>

    <view v-if="garmentSubmissionError" class="garment-submit-error">{{ garmentSubmissionError }}</view>
    <view class="garment-page-safe"></view>
    <view class="garment-wizard-bar">
      <text v-if="garmentCurrentStep === 4 ? garmentGenerateDisabledReason : garmentStepDisabledReason" class="garment-wizard-reason">{{ garmentCurrentStep === 4 ? garmentGenerateDisabledReason : garmentStepDisabledReason }}</text>
      <view class="garment-wizard-actions">
        <button v-if="garmentCurrentStep > 1" class="garment-secondary-button" @click="previousGarmentStep">上一步</button>
        <button v-if="garmentCurrentStep < 4" class="garment-primary-button" :disabled="Boolean(garmentStepDisabledReason)" @click="nextGarmentStep">下一步</button>
        <button v-else class="garment-primary-button" :disabled="Boolean(garmentGenerateDisabledReason)" @tap="startGarmentReplace">{{ garmentGenerateButtonText }}</button>
      </view>
    </view>
  </view>

  <view v-else-if="isPureSceneReplace" class="simple-page scene-replace-page">
    <AiFeatureHeader
      title="换场景"
      description="保留人物和服装，只替换背景环境。"
    />

    <view class="scene-step-section">
      <view class="scene-section-heading">
        <text class="scene-step-index">1</text>
        <view>
          <text class="scene-section-title">上传服装图</text>
          <text class="scene-section-desc">支持服装图、模特图或商品展示图。</text>
        </view>
      </view>

      <view v-if="!clothImagePath" class="scene-source-missing" @click="chooseClothImage">
        <text class="scene-source-missing-title">上传待处理图片</text>
        <text class="scene-source-missing-desc">选择一张主体清晰、服装完整的图片。</text>
        <view class="scene-source-upload-button">选择图片</view>
      </view>
      <view v-else class="scene-source-preview-wrap">
        <image class="scene-large-preview" :src="clothImagePath" mode="aspectFit" />
        <view class="scene-reference-actions">
          <button class="scene-light-button" @click="chooseClothImage">重新选择</button>
          <button class="scene-light-button danger" @click="removeClothImage">删除</button>
        </view>
      </view>
    </view>

    <view class="scene-step-section scene-background-section">
      <view class="scene-section-heading">
        <text class="scene-step-index">2</text>
        <view>
          <text class="scene-section-title">选择背景</text>
          <text class="scene-section-desc">系统模板和常用场景二选一，每次只使用一个背景。</text>
        </view>
      </view>

      <view class="scene-source-tabs">
        <view
          class="scene-source-tab"
          :class="{ active: sceneBackgroundTab === 'system' }"
          @tap="selectSceneBackgroundTab('system')"
        >生活场景</view>
        <view
          class="scene-source-tab"
          :class="{ active: sceneBackgroundTab === 'user' }"
          @tap="selectSceneBackgroundTab('user')"
        >我的场景</view>
      </view>

      <view class="scene-current-selection">
        <text class="scene-current-selection-label">当前选择</text>
        <text class="scene-current-selection-value">{{ currentSceneSelectionName || '暂未选择背景' }}</text>
      </view>

      <view class="scene-mode-section">
        <text class="scene-control-title">替换模式</text>
        <view class="scene-mode-grid">
          <view :class="['scene-mode-card', { active: sceneMode === 'exact_composite' }]" @tap="selectSceneMode('exact_composite')">
            <view class="scene-mode-title-row"><text class="scene-mode-title">精确替换</text><text class="scene-mode-badge">上传场景默认</text></view>
            <text class="scene-mode-desc">直接使用目标场景像素，人物前景保持不变</text>
          </view>
          <view :class="['scene-mode-card', { active: sceneMode === 'generative_reference' }]" @tap="selectSceneMode('generative_reference')">
            <text class="scene-mode-title">风格生成</text>
            <text class="scene-mode-desc">参考场景重新生成环境，结果不会完全一致</text>
          </view>
        </view>
        <view v-if="sceneMode === 'exact_composite' && !sceneExactCompositeAvailable" class="scene-capability-warning">当前环境尚未配置可靠的人物分割与背景合成服务，精确替换暂不可提交。可切换“风格生成”，或等待精确合成能力开放。</view>
        <view v-if="sceneMode === 'generative_reference'" class="scene-generative-warning">场景图片仅作为风格参考，AI 会重新生成环境，人物细节可能变化，结果需人工确认。</view>
      </view>

      <view v-if="sceneBackgroundTab === 'system'" class="scene-library-panel">
        <view class="scene-template-grid scene-system-grid">
          <view
            v-for="item in sceneSystemTemplates"
            :key="item.value"
            class="scene-template-card"
            :class="[{ active: selectedSystemSceneId === item.value }, item.tone]"
            @tap="selectSystemScene(item)"
          >
            <view class="scene-template-visual">
              <image
                v-if="item.previewUrl && !scenePreviewFallbacks[item.value]"
                class="scene-template-image"
                :src="item.previewUrl"
                mode="aspectFill"
                lazy-load
                @error="markScenePreviewFailed(item.value)"
              />
              <view v-else class="scene-template-fallback">
                <view class="scene-template-light"></view>
                <view class="scene-template-space"></view>
                <view class="scene-template-ground"></view>
              </view>
            </view>
            <view class="scene-template-footer">
              <view class="scene-template-copy">
                <text class="scene-template-name">{{ item.label }}</text>
                <text v-if="item.description" class="scene-template-desc">{{ item.description }}</text>
              </view>
              <text v-if="selectedSystemSceneId === item.value" class="scene-template-check">✓</text>
            </view>
          </view>
        </view>
      </view>

      <view v-else class="scene-library-panel scene-my-panel">
        <text class="scene-my-tip">常用场景保存在当前设备，方便不同商品保持统一视觉风格。</text>
        <view v-if="myScenes.length" class="scene-my-grid">
          <view
            v-for="item in myScenes"
            :key="item.sceneId"
            class="scene-my-card"
            :class="{ active: selectedMySceneId === item.sceneId }"
            @click="selectMyScene(item)"
          >
            <view class="scene-my-visual">
              <image
                v-if="getMyScenePreview(item) && !scenePreviewFallbacks[item.sceneId]"
                class="scene-template-image"
                :src="getMyScenePreview(item)"
                mode="aspectFill"
                lazy-load
                @error="markScenePreviewFailed(item.sceneId)"
              />
              <view v-else class="scene-invalid-preview">
                <text>图片已失效</text>
                <text>可删除后重新上传</text>
              </view>
              <text v-if="selectedMySceneId === item.sceneId" class="scene-my-check">✓</text>
              <text class="scene-my-more" @click.stop="openMySceneActions(item)">···</text>
            </view>
            <text class="scene-my-name">{{ item.name }}</text>
          </view>

          <view class="scene-add-card" :class="{ disabled: isSceneUploading }" @click="addMySceneImage">
            <text class="scene-add-icon">＋</text>
            <text class="scene-add-title">{{ isSceneUploading ? '上传中...' : '添加场景' }}</text>
            <text class="scene-add-count">{{ myScenes.length }}/20</text>
          </view>
        </view>
        <view v-else class="scene-my-empty" @click="addMySceneImage">
          <text class="scene-my-empty-title">{{ isSceneUploading ? '场景上传中...' : '上传场景' }}</text>
          <text class="scene-my-empty-desc">保存常用门店、摄影棚、展厅、直播间或家居场景。</text>
          <view class="scene-my-empty-action">{{ isSceneUploading ? '请稍候' : '添加场景' }}</view>
          <text class="scene-my-empty-count">0/20</text>
        </view>
        <view v-if="sceneUploadError" class="scene-upload-error">
          <text>{{ sceneUploadError }}</text>
          <text @click="addMySceneImage">重新上传</text>
        </view>
      </view>

      <view v-if="sceneReferenceImagePath" class="scene-target-preview-block">
        <text class="scene-control-title">目标场景图</text>
        <image class="scene-target-preview" :src="sceneReferenceImagePath" mode="aspectFit" />
      </view>

      <view v-if="sceneMode === 'exact_composite'" class="scene-composite-controls">
        <text class="scene-control-title">场景适配</text>
        <view class="scene-fit-options">
          <view :class="['scene-fit-option', { active: sceneFit === 'cover' }]" @click="sceneFit = 'cover'">填满画面</view>
          <view :class="['scene-fit-option', { active: sceneFit === 'contain' }]" @click="sceneFit = 'contain'">完整显示</view>
        </view>
        <view class="scene-position-row"><text>人物缩放</text><slider class="scene-position-slider" :value="sceneForegroundScale" min="60" max="140" activeColor="#4f46e5" @change="sceneForegroundScale = Number($event.detail.value)" /><text>{{ sceneForegroundScale }}%</text></view>
        <view class="scene-position-row"><text>水平位置</text><slider class="scene-position-slider" :value="sceneForegroundX" min="0" max="100" activeColor="#4f46e5" @change="sceneForegroundX = Number($event.detail.value)" /><text>{{ sceneForegroundX }}%</text></view>
      </view>
    </view>

    <view class="scene-page-safe"></view>
    <GenerationActionBar
      :summary="sceneGenerationSummary"
      :reason="sceneGenerateDisabledReason"
      :button-text="sceneGenerateButtonText"
      loading-text="正在替换场景…"
      :disabled="!canStartSceneReplace"
      :loading="isGenerating"
      @generate="startGenerate"
    />
  </view>

  <view v-else-if="isDedicatedModelTool" class="simple-page model-replace-page">
    <view v-if="modelRuntimeConfig.isTestStage" class="runtime-test-panel">
      <view class="runtime-test-head"><text class="runtime-test-badge">测试模式</text><text>{{ modelRuntimeConfig.stage }}</text></view>
      <text class="runtime-test-notice">当前为测试模式，结果仅用于功能与模型效果验证，不作为正式交付。</text>
      <view v-if="false" class="runtime-test-modes">
        <view :class="['runtime-test-mode', { active: modelRuntimeConfig.executionMode === 'flow_mock' }]" @tap="selectTestExecutionMode('flow_mock')">流程测试</view>
        <view :class="['runtime-test-mode', { active: modelRuntimeConfig.executionMode === 'model_experiment', disabled: !modelRuntimeConfig.modelEffectTestEnabled }]" @tap="selectTestExecutionMode('model_experiment', modelRuntimeConfig)">模型效果测试</view>
      </view>
      <text v-if="modelRuntimeConfig.isInternalDebug" class="runtime-test-provider">Provider：{{ modelRuntimeConfig.provider }} · 模型：{{ modelRuntimeConfig.model }} · {{ modelRuntimeConfig.realProviderTest ? '真实调用，预计消耗 5 次' : '流程测试，不扣额度' }}</text>
      <text v-if="modelRuntimeConfig.isInternalDebug" class="runtime-test-provider">功能：AI模特 · taskType：{{ modelTaskType }} · 输入图片：{{ modelInputImageCount }} · canSubmit：{{ canStartModelReplace ? '是' : '否' }}</text>
      <text v-if="modelRuntimeConfig.isInternalDebug && modelGenerateDisabledReason" class="runtime-test-provider">当前限制：{{ modelGenerateDisabledReason }}</text>
      <text v-if="modelGenerationErrorSummary" class="runtime-test-error">{{ modelGenerationErrorSummary }}</text>
    </view>
    <view v-if="clothImagePath && modelEditingStep !== 1" class="model-step-summary" @tap="editModelStep(1)">
      <image class="model-step-thumb" :src="clothImagePath" mode="aspectFill" />
      <view class="model-step-summary-copy"><text class="model-step-summary-title">1 上传原图</text><text class="model-step-summary-desc">原图已准备</text></view>
      <text class="model-step-edit">修改</text>
    </view>
    <view v-else class="model-replace-section">
      <view class="model-section-head">
        <text class="model-section-index">1</text>
        <view>
          <text class="model-section-title">上传原图</text>
          <text class="model-section-desc">上传需要处理的真人展示图，建议人物与服装主体清晰完整。</text>
        </view>
      </view>
      <view v-if="!clothImagePath" class="model-large-upload" @tap="chooseClothImage">
        <text class="model-upload-icon">+</text>
        <text class="model-upload-title">上传需要处理的模特图</text>
        <text class="model-upload-desc">建议使用主体清晰、服装完整的图片</text>
      </view>
      <view v-else class="model-image-preview">
        <text class="model-preview-label">当前图片</text>
        <image class="model-preview-image" :src="clothImagePath" mode="aspectFit" />
        <view class="model-preview-actions">
          <button class="model-light-button" @tap="previewModelImage(clothImagePath)">预览</button>
          <button class="model-light-button" @tap="chooseClothImage">更换</button>
          <button class="model-light-button danger" @tap="removeClothImage">删除</button>
        </view>
      </view>
    </view>

    <view v-if="clothImagePath && hasSelectedReplaceMode && modelEditingStep !== 2" class="model-step-summary" @tap="editModelStep(2)">
      <view class="model-step-summary-icon"><view class="model-head-visual mini"><view class="model-face-area"></view></view></view>
      <view class="model-step-summary-copy"><text class="model-step-summary-title">2 选择替换方式</text><text class="model-step-summary-desc">{{ replaceModeLabel }}</text></view>
      <text class="model-step-edit">修改</text>
    </view>
    <view v-else-if="clothImagePath" class="model-replace-section">
      <view class="model-section-head">
        <text class="model-section-index">2</text>
        <view>
          <text class="model-section-title">选择替换方式</text>
          <text class="model-section-desc">只调整人物形象，保留服装与画面主体</text>
        </view>
      </view>
      <view v-if="modelIdentityAnyCapabilityAvailable" class="model-replace-mode-grid">
        <view
          v-for="item in replaceModeOptions"
          :key="item.value"
          class="model-replace-mode-card"
          :class="{ active: replaceMode === item.value }"
          @tap="selectReplaceMode(item.value)"
        >
          <view class="model-mode-visual" :class="`mode-${item.visual}`"><view class="model-head-visual"><view class="model-hair-area"></view><view class="model-face-area"></view></view></view>
          <view class="model-mode-check">{{ replaceMode === item.value ? '✓' : '' }}</view>
          <text class="model-mode-title">{{ item.label }}</text>
          <text class="model-mode-desc">{{ item.desc }}</text>
        </view>
      </view>
      <view v-if="!modelIdentityAnyCapabilityAvailable" class="model-capability-warning">
        当前正式环境未配置可用的人物替换 Provider。
      </view>
    </view>

    <view v-if="hasSelectedReplaceMode && modelTargetConfirmed && modelTargetPersonImage && modelEditingStep !== 3" class="model-step-summary" @tap="editModelStep(3)">
      <image class="model-step-thumb" :src="modelTargetPersonPreview" mode="aspectFill" />
      <view class="model-step-summary-copy"><text class="model-step-summary-title">3 {{ modelTargetSectionTitle }}</text><text class="model-step-summary-desc">{{ modelTargetPersonName }}</text></view>
      <text class="model-step-edit">修改</text>
    </view>
    <view v-else-if="hasSelectedReplaceMode" class="model-replace-section">
      <view class="model-section-head">
        <text class="model-section-index">3</text>
        <view>
          <text class="model-section-title">{{ modelTargetSectionTitle }}</text>
          <text class="model-section-desc">从已授权的常用模特或本次上传的人像中选择</text>
        </view>
      </view>

      <view class="model-portrait-tabs">
        <view
          v-for="tab in modelPortraitSourceTabs"
          :key="tab.value"
          class="model-portrait-tab"
          :class="{ active: modelPortraitSource === tab.value }"
          @tap="selectModelPortraitSource(tab.value)"
        >{{ tab.label }}</view>
      </view>

      <view v-if="modelPortraitSource === 'profiles'" class="model-profile-panel">
        <view v-if="modelProfilesLoading" class="model-system-hint">正在加载常用模特...</view>
        <view v-else-if="myModelProfiles.length" class="model-profile-grid">
          <view v-for="profile in myModelProfiles" :key="profile.modelProfileId" :class="['model-profile-card', { active: selectedModelProfileId === profile.modelProfileId }]" @tap="selectModelProfile(profile)">
            <image v-if="profile.coverUrl" class="model-system-portrait-image" :src="profile.coverUrl" mode="aspectFill" />
            <view v-else class="model-system-portrait-placeholder">模</view>
            <view class="model-system-portrait-footer"><text class="model-system-portrait-name">{{ profile.name }}</text><text v-if="selectedModelProfileId === profile.modelProfileId" class="model-system-portrait-check">✓</text></view>
          </view>
        </view>
        <view v-else class="model-system-empty"><text>还没有常用模特</text><text>上传经过授权的人像后可重复使用。</text></view>
        <button class="model-manage-button" @tap="openModelProfiles">{{ myModelProfiles.length ? '管理常用模特' : '上传并保存常用模特' }}</button>
      </view>

      <view v-else-if="modelPortraitSource === 'upload'">
        <view v-if="!referenceImagePath" class="model-target-upload" :class="{ disabled: modelPortraitUploading }" @tap="chooseModelPortraitImage">
          <text class="model-upload-icon small">+</text>
          <text class="model-upload-title">{{ modelPortraitUploading ? '人像上传中...' : '上传新的人像' }}</text>
          <text class="model-upload-desc">建议不低于 512×512，正面或轻微侧脸且五官无遮挡</text>
          <text class="model-upload-consent">上传即表示你确认拥有该人物图片的使用权</text>
        </view>
        <view v-else class="model-image-preview compact">
          <text class="model-preview-label">目标人像</text>
          <image class="model-target-preview" :src="referenceImagePath" mode="aspectFit" />
          <view class="model-preview-actions">
            <button class="model-light-button" @tap="previewModelImage(referenceImagePath)">预览</button>
            <button class="model-light-button" @tap="chooseModelPortraitImage">更换</button>
            <button class="model-light-button danger" @tap="removeModelPortraitImage">删除</button>
          </view>
          <view class="model-upload-status"><text>{{ newModelProfileName || '本次上传人物' }}</text><text>已可使用</text></view>
        </view>
        <text v-if="modelPortraitUploadError" class="model-upload-error">{{ modelPortraitUploadError }}</text>
        <view v-if="referenceImagePath" class="model-save-option">
          <view class="model-check-row" @tap="saveUploadedAsProfile = !saveUploadedAsProfile"><text :class="['model-check-box', { checked: saveUploadedAsProfile }]">{{ saveUploadedAsProfile ? '✓' : '' }}</text><text>保存为常用模特，下次直接使用</text></view>
          <view v-if="saveUploadedAsProfile" class="model-save-fields">
            <input v-model="newModelProfileName" class="model-save-input" maxlength="60" placeholder="填写模特名称" />
            <input v-model="newModelProfileNote" class="model-save-input" maxlength="300" placeholder="备注（可选）" />
            <view class="model-check-row" @tap="modelProfileQualityConfirmed = !modelProfileQualityConfirmed"><text :class="['model-check-box', { checked: modelProfileQualityConfirmed }]">{{ modelProfileQualityConfirmed ? '✓' : '' }}</text><text>我已确认图片清晰且五官无遮挡</text></view>
            <view class="model-check-row" @tap="modelProfileConsentConfirmed = !modelProfileConsentConfirmed"><text :class="['model-check-box', { checked: modelProfileConsentConfirmed }]">{{ modelProfileConsentConfirmed ? '✓' : '' }}</text><text>{{ modelProfileConsentText }}</text></view>
          </view>
        </view>
      </view>

      <view v-else-if="modelPortraitSource === 'system' && availableSystemPortraits.length" class="model-system-portrait-panel">
        <text class="model-system-hint">选择系统已提供的人像参考</text>
        <view class="model-system-portrait-grid">
          <view
            v-for="item in availableSystemPortraits"
            :key="item.value"
            class="model-system-portrait-card"
            :class="{ active: selectedSystemPortraitCategory === item.value }"
            @tap="selectSystemPortrait(item)"
          >
            <image v-if="item.imageUrl" class="model-system-portrait-image" :src="item.imageUrl" mode="aspectFill" />
            <view v-else class="model-system-portrait-placeholder">{{ item.label.slice(0, 1) }}</view>
            <view class="model-system-portrait-footer">
              <text class="model-system-portrait-name">{{ item.label }}</text>
              <text v-if="selectedSystemPortraitCategory === item.value" class="model-system-portrait-check">✓</text>
            </view>
          </view>
        </view>
      </view>
      <view v-else-if="modelPortraitSource === 'system'" class="model-system-empty">
        <text>系统测试人像尚未配置</text>
        <text>可切换到“我的常用模特”或“上传新的人像”继续调试。</text>
      </view>
    </view>

    <view v-if="hasSelectedReplaceMode && modelTargetConfirmed && modelTargetPersonImage && modelEditingStep === 4" class="model-replace-section model-summary-section">
      <view class="model-section-head summary">
        <text class="model-section-index">4</text>
        <view>
          <text class="model-section-title">确认生成</text>
          <text class="model-section-desc">核对原图、目标人物和保持内容</text>
        </view>
      </view>
      <view class="model-confirm-visuals">
        <view class="model-confirm-image-wrap"><image class="model-confirm-image" :src="clothImagePath" mode="aspectFill" /><text>原图</text></view>
        <text class="model-confirm-arrow">→</text>
        <view class="model-confirm-image-wrap"><image class="model-confirm-image" :src="modelTargetPersonPreview" mode="aspectFill" /><text>{{ modelTargetPersonName }}</text></view>
      </view>
      <view class="model-confirm-list">
        <view class="model-confirm-item"><text>替换范围</text><text class="primary">{{ replaceModeLabel }}</text></view>
        <view class="model-confirm-item"><text>✓ 保留服装</text><text>已开启</text></view>
        <view class="model-confirm-item"><text>✓ 保留身体姿态</text><text>已开启</text></view>
        <view class="model-confirm-item"><text>✓ 保留原始场景</text><text>已开启</text></view>
        <view class="model-confirm-item"><text>✓ 保留画面构图</text><text>已开启</text></view>
        <view class="model-confirm-item"><text>预计消耗</text><text>1 次生成额度</text></view>
      </view>
    </view>

    <view class="model-page-safe"></view>
    <GenerationActionBar
      :summary="hasSelectedReplaceMode ? `${replaceModeLabel} · 保留服装、姿态与场景` : 'AI模特身份替换'"
      :reason="modelGenerateDisabledReason"
      :button-text="modelReplaceButtonText"
      loading-text="正在生成新模特…"
      :disabled="!canStartModelReplace"
      :loading="isGenerating"
      @generate="startModelReplace"
    />
  </view>

  <view v-else class="simple-page" :class="{ 'style-page': isStyleTool, 'color-page': isColorTool, 'fabric-page': isFabricTool, 'pattern-page': isPatternTool, 'display-page': isDisplayTool }">
    <view v-if="genericRuntimeConfig.isTestStage" class="runtime-test-panel">
      <view class="runtime-test-head"><text class="runtime-test-badge">真实 API 测试</text><text>{{ genericRuntimeConfig.stage }}</text></view>
      <text class="runtime-test-notice">仅内部测试账号可提交；结果标记为实验结果，不得正式交付。</text>
      <text class="runtime-test-provider">Provider：{{ genericRuntimeConfig.provider }} · 模型：{{ genericRuntimeConfig.model }} · 按当前功能真实扣费，失败回滚</text>
    </view>
    <AiFeatureHeader
      :title="currentTool.title"
      :description="currentTool.description"
    />

    <view v-if="isStyleTool" class="style-wizard-steps">
      <view
        v-for="step in styleWizardSteps"
        :key="step.value"
        class="style-wizard-step"
        :class="{ active: styleWizardStep === step.value, completed: styleWizardStep > step.value }"
        @click="goToStyleWizardStep(step.value)"
      >
        <text class="style-wizard-step-index">{{ styleWizardStep > step.value ? '✓' : step.value }}</text>
        <text class="style-wizard-step-label">{{ step.label }}</text>
      </view>
    </view>

    <view v-if="isColorTool" class="color-two-step-bar">
      <view class="color-two-step-item" :class="{ active: colorCurrentStep === 1, completed: colorCurrentStep > 1 }"><text>{{ colorCurrentStep > 1 ? '✓' : '1' }}</text><text>上传服装</text></view>
      <view class="color-two-step-line"></view>
      <view class="color-two-step-item" :class="{ active: colorCurrentStep === 2 }"><text>2</text><text>选择颜色并生成</text></view>
    </view>

    <view v-if="isDisplayTool" class="display-mode-switch">
      <view class="display-mode-option" :class="{ active: !isDetailDisplayTool }" @click="switchDisplayConfigurationMode('display')">展示图</view>
      <view class="display-mode-option" :class="{ active: isDetailDisplayTool }" @click="switchDisplayConfigurationMode('detail')">细节图</view>
    </view>

    <view v-if="isDisplayTool && displayDraftAvailable" class="display-draft-banner">
      <view>
        <text class="display-draft-title">检测到未完成的{{ isDetailDisplayTool ? '细节图' : '展示图' }}配置</text>
        <text class="display-draft-desc">可继续上次编辑，或重新开始。</text>
      </view>
      <view class="display-draft-actions">
        <text @click="restoreDisplayDraft">继续编辑</text>
        <text class="muted" @click="resetDisplayDraft">重新开始</text>
      </view>
    </view>

    <view v-if="isPatternTool && patternDraftAvailable" class="pattern-draft-banner">
      <view>
        <text class="pattern-draft-title">检测到未完成的换图案配置</text>
        <text class="pattern-draft-desc">可继续上次编辑，或重新开始。</text>
      </view>
      <view class="pattern-draft-actions">
        <text @click="restorePatternDraft">继续编辑</text>
        <text class="muted" @click="resetPatternDraft">重新开始</text>
      </view>
    </view>

    <view v-if="productionContext" class="production-context-card">
      <text class="production-context-kicker">生产向导已接入</text>
      <text class="production-context-title">{{ productionContext.productionType }} · {{ productionContext.selectedAction.title }}</text>
      <text class="production-context-desc">已带入 {{ productionContext.assets.length }} 项素材，推荐功能：{{ recommendedActionNames }}</text>
    </view>

    <view v-if="(!isStyleTool || styleWizardStep === 1) && (!isColorTool || !clothImagePath)" class="work-card" :class="{ 'style-upload-card': isStyleTool, 'color-upload-card': isColorTool, 'fabric-upload-card': isFabricTool, 'pattern-upload-card': isPatternTool, 'display-upload-card': isDisplayTool }">
      <view v-if="isFabricTool" class="fabric-step-heading fabric-upload-heading">
        <text class="fabric-step-number">1</text>
        <view class="fabric-step-copy">
          <view class="fabric-title-row">
            <text class="section-title">上传服装图</text>
            <text class="style-field-badge required">必填</text>
            <text v-if="clothImagePath" class="style-completion-badge">✓ 已上传</text>
          </view>
          <text class="section-desc">支持服装图片、真人展示图</text>
        </view>
      </view>
      <view v-else class="section-head" :class="{ 'style-section-head': isStyleTool }">
        <view class="style-required-title-row">
          <text class="section-title">{{ currentTool.uploadTitle }}</text>
          <text v-if="isStyleTool || isColorTool || isPatternTool || isDisplayTool" class="style-field-badge required">必填</text>
          <text v-if="isStyleTool && clothImagePath" class="style-completion-badge">✓ 已完成</text>
          <text v-if="isColorTool && clothImagePath" class="style-completion-badge">✓ 已上传</text>
          <text v-if="isPatternTool && clothImagePath" class="style-completion-badge">✓ 已上传</text>
          <text v-if="isDisplayTool && clothImagePath" class="style-completion-badge">✓ 已上传</text>
        </view>
        <text class="section-desc">{{ currentTool.uploadDesc }}</text>
      </view>

      <view v-if="!clothImagePath" class="upload-box" :class="{ 'style-upload-box': isStyleTool, 'color-upload-box': isColorTool, 'fabric-upload-box': isFabricTool, 'pattern-upload-box': isPatternTool, 'display-upload-box': isDisplayTool }" @click="chooseClothImage">
        <text class="upload-plus">+</text>
        <text class="upload-title">{{ (isStyleTool && styleImageStatus === 'uploading') || (isColorTool && colorImageStatus === 'uploading') || (isFabricTool && fabricImageStatus === 'uploading') || (isPatternTool && patternImageStatus === 'uploading') || (isDisplayTool && displayImageStatus === 'uploading') ? '图片上传中...' : mainUploadTitle }}</text>
        <text class="upload-desc">{{ isStyleTool || isColorTool || isFabricTool || isPatternTool || isDisplayTool ? '支持 JPG、PNG、WEBP，最大 10MB，宽高至少 256px' : mainUploadDesc }}</text>
      </view>

      <view v-else class="preview-box" :class="{ 'color-preview-box': isColorTool, 'fabric-preview-box': isFabricTool, 'pattern-preview-box': isPatternTool, 'display-preview-box': isDisplayTool }" @click="handlePreviewTap">
        <view v-if="isColorTool && colorEyedropperActive" class="color-eyedropper-overlay">点击图片中的颜色位置进行取色</view>
        <image class="preview-image" :src="clothImagePath" :mode="isColorTool || isFabricTool || isPatternTool || isDisplayTool ? 'aspectFit' : 'aspectFill'" />
        <view class="preview-actions">
          <button class="light-btn" size="mini" @click.stop="chooseClothImage">更换图片</button>
          <button class="light-btn danger" size="mini" @click.stop="removeClothImage">删除</button>
        </view>
      </view>
      <text v-if="isStyleTool && styleImageStatus === 'uploading'" class="style-inline-status">正在校验并上传图片...</text>
      <text v-if="isStyleTool && styleImageError" class="style-inline-error">{{ styleImageError }}</text>
      <text v-if="isColorTool && colorImageStatus === 'uploading'" class="style-inline-status">正在校验并上传图片...</text>
      <text v-if="isColorTool && colorImageError" class="style-inline-error">{{ colorImageError }}</text>
      <text v-if="isColorTool && colorImageMeta" class="color-image-meta">{{ colorImageMeta.width }} × {{ colorImageMeta.height }} px · {{ colorImageMeta.sizeText }}</text>
      <text v-if="isFabricTool && fabricImageStatus === 'uploading'" class="style-inline-status">正在校验并上传服装图片...</text>
      <text v-if="isFabricTool && fabricImageError" class="style-inline-error">{{ fabricImageError }}</text>
      <text v-if="isFabricTool && fabricImageMeta" class="color-image-meta">{{ fabricImageMeta.width }} × {{ fabricImageMeta.height }} px · {{ fabricImageMeta.sizeText }}</text>
      <text v-if="isPatternTool && patternImageStatus === 'uploading'" class="style-inline-status">正在校验并上传服装图片...</text>
      <text v-if="isPatternTool && patternImageError" class="style-inline-error">{{ patternImageError }}</text>
      <text v-if="isPatternTool && patternImageMeta" class="color-image-meta">{{ patternImageMeta.width }} × {{ patternImageMeta.height }} px · {{ patternImageMeta.sizeText }}</text>
      <text v-if="isDisplayTool && displayImageStatus === 'uploading'" class="style-inline-status">服装图片上传中...</text>
      <text v-if="isDisplayTool && displayImageError" class="style-inline-error">{{ displayImageError }}</text>
      <text v-if="isDisplayTool && displayImageMeta" class="color-image-meta">{{ displayImageMeta.width }} × {{ displayImageMeta.height }} px · {{ displayImageMeta.sizeText }}</text>
    </view>

    <view v-if="!isColorTool || clothImagePath" class="work-card" :class="{ 'fabric-config-shell': isFabricTool, 'style-config-shell': isStyleTool, 'color-config-shell': isColorTool, 'display-config-shell': isDisplayTool }">
      <view v-if="!isFabricTool && !isStyleTool && !isColorTool && !isDisplayTool" class="section-head">
        <text class="section-title">{{ currentTool.paramTitle }}</text>
        <text class="section-desc">{{ currentTool.paramTip }}</text>
      </view>

      <view v-if="isColorTool" class="color-workflow-panel color-simple-workflow">
        <view class="color-source-strip">
          <image class="color-source-thumb" :src="clothImagePath" mode="aspectFill" />
          <view class="color-source-copy"><text>当前服装图</text><text>人物、背景和姿势保持不变</text></view>
          <text class="color-source-change" @click="chooseClothImage">更换</text>
        </view>
        <view class="color-step-card color-selection-card">
          <view class="color-step-head">
            <view>
              <text class="color-section-title">选择目标颜色</text>
              <text class="color-section-desc">选择一个明确目标色，生成换色效果。</text>
            </view>
            <text class="style-field-badge required">必填</text>
          </view>

          <view class="color-target-summary" :class="{ empty: !currentTargetColor }">
            <view v-if="currentTargetColor" class="color-target-summary-main">
              <view class="color-target-large-swatch" :style="{ background: currentTargetColor.hex }"></view>
              <view class="color-target-copy">
                <text class="color-target-kicker">当前目标颜色</text>
                <text class="color-target-name">{{ currentTargetColor.displayName }}</text>
                <text class="color-target-value">{{ currentTargetColor.hex }} · RGB({{ currentTargetColor.rgb.join(', ') }})</text>
                <text class="color-target-value">Lab({{ currentTargetColor.lab.join(', ') }}) · {{ colorSourceLabel }}</text>
              </view>
            </view>
            <text v-else class="color-target-empty">尚未选择目标颜色</text>
            <text v-if="currentTargetColor" class="color-target-clear" @click="clearTargetColors">清除</text>
          </view>
          <text class="color-risk-note">当前服务为生成式近似换色，目标色值用于明确控制方向，结果会受光线与面料影响。</text>
          <text class="color-single-note">当前版本每次支持一种目标颜色。</text>

          <view class="color-method-tabs">
            <view
              v-for="method in colorSelectionMethods"
              :key="method.value"
              class="color-method-tab"
              :class="{ active: colorSelectionMethod === method.value }"
              @click="selectColorMethod(method.value)"
            >{{ method.label }}</view>
          </view>

          <view v-if="colorSelectionMethod === 'system'" class="color-method-panel color-system-panel">
            <view class="color-system-current">
              <view class="color-current-chip">
                <view class="color-current-circle" :style="{ background: currentTargetColor ? currentTargetColor.hex : '#FFFFFF' }"></view>
                <view><text>当前颜色</text><text>{{ currentTargetColor ? currentTargetColor.hex : '#FFFFFF' }}</text></view>
              </view>
              <button class="color-custom-button" @click="openCustomColorPicker">自定义颜色</button>
            </view>
            <view class="color-matrix" aria-label="系统颜色矩阵">
              <view v-for="(row, rowIndex) in systemColorMatrix" :key="`color-row-${rowIndex}`" class="color-matrix-row">
                <view
                  v-for="color in row"
                  :key="color.colorId"
                  class="color-matrix-cell"
                  :class="{ active: selectedColorId === color.colorId, light: isLightColor(color) }"
                  :style="{ background: color.hex }"
                  @click="selectSystemColor(color)"
                  @longpress="showColorHex(color)"
                >
                  <text v-if="selectedColorId === color.colorId" class="color-matrix-check">✓</text>
                </view>
              </view>
            </view>
            <text class="color-matrix-tip">点击选择颜色，长按可查看 HEX 值</text>
          </view>

          <view v-else-if="colorSelectionMethod === 'eyedropper'" class="color-method-panel color-eyedropper-panel">
            <view class="color-eyedropper-source-tabs">
              <view
                v-for="source in colorEyedropperSources"
                :key="source.value"
                class="color-eyedropper-source-tab"
                :class="{ active: colorEyedropperSource === source.value }"
                @click="selectColorEyedropperSource(source.value)"
              >{{ source.label }}</view>
            </view>

            <view v-if="colorEyedropperSource === 'garment'">
              <text class="color-section-desc">在服装图上点击或拖动，系统读取附近 5×5 像素平均色。</text>
              <ColorPickerCanvas canvas-id="garmentColorPickerCanvas" :image-src="colorPickerLocalImagePath || clothImagePath" :extract-palette="true" @sample="handleGarmentColorSample" @palette="handleGarmentExtractedColorPalette" @error="handleColorPickerError" />
            </view>

            <view v-else class="color-card-upload-panel">
              <text class="color-section-desc">支持色卡、面料图、商品图和参考照片；上传后自动提取主要颜色。</text>
              <view v-if="!colorReferenceImagePath" class="color-card-upload" @click="chooseColorReferenceImage">
                <text class="color-card-upload-icon">+</text>
                <text class="color-card-upload-title">上传取色图片</text>
                <text class="color-card-upload-desc">图片只用于读取颜色，不会把背景或图案带入服装</text>
              </view>
              <view v-else class="color-card-preview">
                <ColorPickerCanvas canvas-id="colorCardPickerCanvas" :image-src="colorReferencePickerPath || colorReferenceImagePath" :extract-palette="true" @sample="handleColorCardSample" @palette="handleExtractedColorPalette" @error="handleColorPickerError" />
                <view class="color-card-actions">
                  <button class="light-btn" size="mini" @click="chooseColorReferenceImage">更换图片</button>
                  <button class="light-btn danger" size="mini" @click="removeColorReferenceImage">移除图片</button>
                </view>
              </view>
              <text v-if="colorReferenceImageStatus === 'uploading'" class="style-inline-status">取色图片上传中...</text>
              <text v-if="colorReferenceImageError" class="style-inline-error">{{ colorReferenceImageError }}</text>
            </view>
            <view v-if="colorExtractedPalette.length" class="color-extracted-palette">
              <text class="color-palette-title">自动提取的主要颜色</text>
              <view class="color-extracted-row">
                <view
                  v-for="color in colorExtractedPalette"
                  :key="color.colorId"
                  class="color-extracted-item"
                  :class="{ active: selectedColorId === color.colorId, light: isLightColor(color) }"
                  @click="selectDominantColor(color)"
                >
                  <view :style="{ background: color.hex }"><text v-if="selectedColorId === color.colorId" class="color-unified-check">✓</text></view><text>{{ color.hex }}</text>
                </view>
              </view>
            </view>
            <view v-if="colorPendingSample" class="color-sample-confirm">
              <view class="color-sample-swatch" :style="{ background: colorPendingSample.hex }"></view>
              <view><text>{{ colorPendingSample.hex }}</text><text>RGB({{ colorPendingSample.rgb.join(', ') }})</text></view>
              <button class="color-use-button" @click="confirmPickedColor()">使用此颜色</button>
            </view>
          </view>

          <view v-else class="color-method-panel color-recent-panel">
            <view v-if="colorHistoryOptions.length" class="color-recent-head">
              <text>最近确认使用的颜色</text>
              <text @click="clearRecentColors">清空全部</text>
            </view>
            <view v-if="colorHistoryOptions.length" class="color-recent-grid">
              <view v-for="color in colorHistoryOptions" :key="color.hex" class="color-recent-item" :class="{ active: currentTargetColor && currentTargetColor.hex === color.hex, light: isLightColor(color) }" @click="selectRecentColor(color)">
                <view class="color-recent-swatch" :style="{ background: color.hex }"><text v-if="currentTargetColor && currentTargetColor.hex === color.hex" class="color-unified-check">✓</text></view>
                <text>{{ color.hex }}</text>
                <text class="color-recent-delete" @click.stop="deleteRecentColor(color.hex)">×</text>
              </view>
            </view>
            <view v-else class="color-empty-state">
              <text>还没有最近使用的颜色</text>
              <text>确认自定义色、吸管色或提交系统色后会记录在这里</text>
            </view>
          </view>

          <CustomColorPicker
            :visible="customColorPickerVisible"
            :initial-color="currentTargetColor ? currentTargetColor.hex : '#FFFFFF'"
            @cancel="closeCustomColorPicker"
            @confirm="confirmCustomColor"
          />
        </view>

        <ColorQuickPreview
          :image-src="colorPickerLocalImagePath || clothImagePath"
          :target-color="currentTargetColor"
          :enabled="colorPreviewEnabled"
          @enable="enableColorQuickPreview"
          @status="handleColorPreviewStatus"
          @preview="handleColorPreviewReady"
          @error="handleColorPreviewError"
        />

        <view class="color-advanced-entry" @click="colorAdvancedSettingsOpen = !colorAdvancedSettingsOpen">
          <view><text>换色区域：{{ colorTargetAreaLabel }}</text><text>纹理保留：{{ textureRetentionLabel }}</text></view>
          <text>{{ colorAdvancedSettingsOpen ? '收起' : '修改 >' }}</text>
        </view>
        <view v-if="colorAdvancedSettingsOpen" class="color-step-card color-advanced-panel">
          <text class="color-section-title">高级设置</text>
          <text class="color-section-desc">区域选择依赖生成模型理解，当前不提供没有真实蒙版能力的“指定局部”。</text>
          <view class="color-target-grid">
            <view v-for="area in colorTargetAreas" :key="area.value" class="color-target-pill" :class="{ active: colorTargetArea === area.value }" @click="selectColorTargetArea(area.value)"><text v-if="colorTargetArea === area.value" class="color-option-check">✓</text>{{ area.label }}</view>
          </view>
          <text class="color-advanced-label">纹理保留</text>
          <view class="texture-row">
            <view v-for="item in textureRetentionOptions" :key="item.value" class="texture-pill" :class="{ active: textureRetention === item.value }" @click="selectTextureRetention(item.value)">
              <text class="texture-check">{{ textureRetention === item.value ? '✓' : '' }}</text><text>{{ item.label }}</text><text>{{ item.desc }}</text>
            </view>
          </view>
          <view class="color-step-head">
            <text class="color-section-title">补充要求（可选）</text>
            <text class="color-counter">{{ colorCustomPrompt.length }}/200</text>
          </view>
          <textarea
            class="redesign-textarea color-prompt-textarea"
            v-model="colorCustomPrompt"
            maxlength="200"
            :adjust-position="true"
            cursor-spacing="120"
            placeholder="例如：改为藏蓝色，保留面料纹理，颜色更适合春夏通勤。"
            @focus="setColorKeyboardActive(true)"
            @blur="setColorKeyboardActive(false)"
            @input="applySelectedColorParams"
          />
        </view>

        <view class="color-preserve-note">
          <text>默认保持</text><text>人物身份 · 姿势 · 背景 · 服装结构 · 面料纹理 · 印花图案</text>
        </view>
      </view>

      <view v-if="isFabricTool" class="redesign-workflow-panel fabric-workflow-panel">
        <view class="fabric-step-card">
          <view class="fabric-step-heading">
            <text class="fabric-step-number">2</text>
            <view class="fabric-step-copy">
              <view class="fabric-title-row">
                <text class="color-section-title">选择替换区域</text>
                <text class="style-field-badge required">必填</text>
              </view>
              <text class="color-section-desc">选择需要改变材质质感的服装部位。</text>
            </view>
          </view>
          <view class="color-target-grid">
            <view
              v-for="area in fabricTargetAreas"
              :key="area.value"
              class="color-target-pill"
              :class="{ active: fabricTargetArea === area.value }"
              @click="selectFabricTargetArea(area.value)"
            >
              <text v-if="fabricTargetArea === area.value" class="color-option-check">✓</text>{{ area.value === 'partial' ? '指定局部' : area.label }}
            </view>
          </view>
          <text v-if="fabricTargetArea === 'partial'" class="fabric-inline-tip">请在“补充要求”中描述需要替换的具体位置。</text>
        </view>

        <view class="fabric-step-card fabric-effect-card">
          <view class="fabric-step-heading">
            <text class="fabric-step-number">3</text>
            <view class="fabric-step-copy">
              <view class="fabric-title-row">
                <text class="color-section-title">选择目标面料</text>
                <text class="style-field-badge required">必填</text>
              </view>
              <text class="color-section-desc">选择一种面料质感，生成时保持原有款式结构。</text>
            </view>
          </view>
          <view class="fabric-current-summary" :class="{ empty: !hasFabricSelection }">
            <text>{{ selectedFabricSummary }}</text>
            <view v-if="hasFabricSelection" class="fabric-summary-actions">
              <text @click="promptFabricChange">更换</text>
              <text class="danger" @click="clearFabricSelection">清除</text>
            </view>
          </view>
          <view class="fabric-grid fabric-effect-grid">
            <view
              v-for="fabric in fabricReferenceOptions"
              :key="fabric.value"
              class="fabric-card fabric-effect-option"
              :class="[`fabric-tone-${fabric.value}`, { active: selectedFabricId === fabric.value }]"
              @click="selectFabricReference(fabric)"
            >
              <view class="fabric-texture-swatch" :class="`fabric-texture-${fabric.value}`"></view>
              <view class="fabric-option-copy">
                <text class="fabric-option-name">{{ fabric.label }}</text>
                <text class="fabric-option-desc">{{ fabric.desc }}</text>
              </view>
              <text v-if="selectedFabricId === fabric.value" class="fabric-option-check">✓</text>
            </view>
          </view>
        </view>

        <view class="fabric-step-card fabric-reference-section">
          <view class="fabric-collapse-head" @click="toggleFabricReferencePanel">
            <text class="fabric-step-number">4</text>
            <view class="fabric-step-copy">
              <view class="fabric-title-row">
                <text class="color-section-title">上传面料参考图</text>
                <text class="style-field-badge">可选</text>
              </view>
              <text class="color-section-desc">上传纹理特写或材质图片，帮助效果贴近目标面料。</text>
              <text class="fabric-collapse-summary">{{ fabricReferenceImagePath ? '已添加参考图' : '未添加参考图' }}</text>
            </view>
            <text class="fabric-collapse-arrow">{{ fabricReferencePanelOpen ? '⌃' : '⌄' }}</text>
          </view>
          <view v-if="fabricReferencePanelOpen" class="fabric-reference-content">
            <view v-if="!fabricReferenceImagePath" class="fabric-reference-upload" @click="chooseFabricReferenceImage">
              <text class="fabric-reference-plus">+</text>
              <view>
                <text class="fabric-reference-title">选择面料参考图</text>
                <text class="fabric-reference-desc">支持织物纹理或材质特写</text>
              </view>
            </view>
            <view v-else class="fabric-reference-preview">
              <image class="fabric-reference-image" :src="fabricReferenceImagePath" mode="aspectFill" />
              <view class="fabric-reference-copy">
                <text class="fabric-reference-title">已添加面料参考图</text>
                <text class="fabric-reference-desc">该图片将作为自定义面料参考</text>
              </view>
              <view class="fabric-reference-actions">
                <text @click="chooseFabricReferenceImage">更换</text>
                <text class="danger" @click="removeFabricReferenceImage">删除</text>
              </view>
            </view>
            <text v-if="fabricReferenceImageStatus === 'uploading'" class="style-inline-status">面料参考图上传中...</text>
            <text v-if="fabricReferenceImageError" class="style-inline-error">{{ fabricReferenceImageError }}</text>
            <view v-if="fabricReferenceImagePath" class="fabric-color-mode">
              <text class="fabric-reference-title">样布颜色</text>
              <view class="fabric-color-mode-options">
                <view class="fabric-color-mode-option" :class="{ active: fabricColorMode === 'preserve_original' }" @click="selectFabricColorMode('preserve_original')">
                  <text v-if="fabricColorMode === 'preserve_original'">✓</text>保留原服装颜色
                </view>
                <view class="fabric-color-mode-option" :class="{ active: fabricColorMode === 'adopt_reference' }" @click="selectFabricColorMode('adopt_reference')">
                  <text v-if="fabricColorMode === 'adopt_reference'">✓</text>采用样布颜色
                </view>
              </view>
            </view>
          </view>
        </view>

        <view class="fabric-capability-note">
          <text class="fabric-capability-title">面料效果参考</text>
          <text>当前服务会真实读取样布参考图，但暂不具备精确蒙版与曲面纹理迁移能力。结果将进入待检查，不用于直接商品交付。</text>
        </view>

        <view class="fabric-step-card fabric-requirement-card">
          <view class="fabric-step-heading">
            <text class="fabric-step-number">5</text>
            <view class="fabric-step-copy">
              <view class="fabric-title-row">
                <text class="color-section-title">补充要求</text>
                <text class="style-field-badge">可选</text>
              </view>
              <text class="color-section-desc">补充光泽、垂坠、纹理或指定局部等要求。</text>
            </view>
          </view>
          <textarea
            class="redesign-textarea fabric-prompt-textarea"
            v-model="fabricCustomPrompt"
            maxlength="200"
            :adjust-position="true"
            cursor-spacing="120"
            placeholder="例如：保留原版型，替换为细腻真丝材质，增强自然垂坠和柔和光泽。"
            @focus="setFabricKeyboardActive(true)"
            @blur="setFabricKeyboardActive(false)"
            @input="applyFabricParams"
          />
          <text class="fabric-character-count">{{ fabricCustomPrompt.length }}/200</text>
        </view>
        <view class="fabric-config-summary">{{ fabricConfigurationSummary }}</view>
      </view>

      <view v-if="isPatternTool" class="redesign-workflow-panel pattern-workflow-panel">
        <view class="pattern-step-card">
          <view class="pattern-step-head">
            <view>
              <view class="fabric-title-row">
                <text class="color-section-title">选择图案</text>
                <text class="style-field-badge required">必填</text>
              </view>
              <text class="color-section-desc">从图案库选择，或上传自己的图案图片。</text>
            </view>
          </view>

          <view class="pattern-current-summary" :class="{ empty: !hasPatternSelection }">
            <image v-if="isCustomPatternSelected" class="pattern-summary-image" :src="patternReferenceImagePath" mode="aspectFill" />
            <text>{{ selectedPatternSummary }}</text>
            <view v-if="hasPatternSelection" class="pattern-summary-actions">
              <text @click="promptPatternChange">更换</text>
              <text class="danger" @click="clearPatternSelection">清除</text>
            </view>
          </view>

          <view class="pattern-source-tabs">
            <view class="pattern-source-tab" :class="{ active: patternSourceTab === 'library' }" @click="selectPatternSource('library')">图案库</view>
            <view class="pattern-source-tab" :class="{ active: patternSourceTab === 'upload' }" @click="selectPatternSource('upload')">上传图案</view>
          </view>

          <view v-if="patternSourceTab === 'library'" class="pattern-library-grid">
            <view
              v-for="pattern in systemPatternOptions"
              :key="pattern.value"
              class="pattern-option-card"
              :class="{ active: selectedPatternId === pattern.value }"
              @click="selectPatternReference(pattern)"
            >
              <view class="pattern-option-copy">
                <text class="pattern-option-name">{{ pattern.label }}</text>
                <text class="pattern-option-desc">{{ pattern.desc }}</text>
              </view>
              <text v-if="selectedPatternId === pattern.value" class="pattern-option-check">✓</text>
            </view>
          </view>

          <view v-else class="pattern-upload-panel">
            <view v-if="!patternReferenceImagePath" class="pattern-upload-strip" @click="choosePatternReferenceImage">
              <text class="pattern-upload-plus">+</text>
              <view>
                <text class="pattern-upload-title">上传自定义图案</text>
                <text class="pattern-upload-desc">可上传印花、Logo、刺绣图形或连续纹样</text>
              </view>
            </view>
            <view v-else class="pattern-reference-preview">
              <image class="pattern-reference-image" :src="patternReferenceImagePath" mode="aspectFill" />
              <view class="pattern-reference-copy">
                <text class="pattern-upload-title">自定义图案已添加</text>
                <text class="pattern-upload-desc">建议使用清晰、背景简洁的图片</text>
              </view>
              <view class="pattern-reference-actions">
                <text @click="choosePatternReferenceImage">更换</text>
                <text class="danger" @click="removePatternReferenceImage">删除</text>
              </view>
            </view>
            <text v-if="patternReferenceImageStatus === 'uploading'" class="style-inline-status">图案上传中...</text>
            <text v-if="patternReferenceImageError" class="style-inline-error">{{ patternReferenceImageError }}</text>
          </view>
          <text class="pattern-risk-note">实际效果会受到服装褶皱、透视、面料纹理和图案清晰度影响。</text>
        </view>

        <view class="pattern-step-card">
          <view class="fabric-title-row">
            <text class="color-section-title">图案位置</text>
            <text class="style-field-badge required">必填</text>
          </view>
          <text class="color-section-desc">请选择一个应用位置，“整件覆盖”与局部位置互斥。</text>
          <view class="color-target-grid pattern-position-grid">
            <view
              v-for="position in patternPositionOptions"
              :key="position.value"
              class="color-target-pill"
              :class="{ active: patternPlacement === position.value }"
              @click="selectPatternPlacement(position.value)"
            >
              <text v-if="patternPlacement === position.value" class="color-option-check">✓</text>{{ position.label }}
            </view>
          </view>
        </view>

        <view class="pattern-step-card pattern-requirement-card">
          <view class="fabric-title-row">
            <text class="color-section-title">图案要求</text>
            <text class="style-field-badge">可选</text>
          </view>
          <textarea
            class="redesign-textarea pattern-prompt-textarea"
            v-model="patternCustomPrompt"
            maxlength="200"
            :adjust-position="true"
            cursor-spacing="120"
            placeholder="例如：胸口添加小型刺绣 Logo；或整件使用低饱和碎花图案。"
            @focus="setPatternKeyboardActive(true)"
            @blur="setPatternKeyboardActive(false)"
            @input="handlePatternPromptInput"
          />
          <text class="fabric-character-count">{{ patternCustomPrompt.length }}/200</text>
        </view>
        <view class="pattern-config-summary">{{ patternConfigurationSummary }}</view>
      </view>

      <view v-if="isStyleTool" class="redesign-workflow-panel style-workflow-panel">
        <view v-if="styleWizardStep === 2" class="style-section-card style-change-section">
          <view class="style-card-head compact">
            <view class="style-card-heading">
              <text class="style-card-title">你想改哪里？</text>
              <text class="style-card-desc">可多选。未选择的部位保持原样，不参与改动。</text>
            </view>
            <text class="style-field-badge required">必填</text>
          </view>
          <view class="style-change-summary" :class="{ empty: !styleChangeTargets.length }">{{ styleChangeSummary }}</view>
          <view class="style-target-grid">
            <view
              v-for="target in styleChangeTargetOptions"
              :key="target.value"
              class="style-target-card"
              :class="{ active: styleChangeTargets.includes(target.value) }"
              @click="toggleStyleChangeTarget(target)"
            >
              <text v-if="styleChangeTargets.includes(target.value)" class="style-option-check">✓</text>
              <text>{{ target.label }}</text>
            </view>
          </view>
          <view v-for="target in selectedStyleChangeDetails" :key="target.value" class="style-direction-group">
            <view class="style-subsection-head">
              <text class="style-subsection-title">{{ target.label }}改成</text>
              <text class="style-selection-rule">单选</text>
            </view>
            <view class="style-pill-row">
              <view
                v-for="direction in target.directions"
                :key="direction"
                class="style-choice-pill"
                :class="{ active: target.direction === direction }"
                @click="selectStyleTargetDirection(target.value, direction)"
              >
                <text v-if="target.direction === direction" class="style-pill-check">✓</text>
                {{ direction }}
              </view>
            </view>
          </view>
        </view>

        <view v-if="styleWizardStep === 3" class="style-section-card style-direction-section">
          <view class="style-card-heading">
            <text class="style-card-title">设计方向</text>
            <text class="style-card-desc">确定改动幅度、视觉风格和最终用途。</text>
          </view>
          <view class="style-subsection-head first"><text class="style-subsection-title">改动强度</text><text class="style-selection-rule">单选</text></view>
          <view class="style-pill-row">
            <view v-for="item in styleChangeIntensityOptions" :key="item.value" class="style-choice-pill" :class="{ active: styleChangeIntensity === item.value }" @click="selectStyleChangeIntensity(item.value)">
              <text v-if="styleChangeIntensity === item.value" class="style-pill-check">✓</text>{{ item.label }}
            </view>
          </view>
          <view class="style-subsection-head"><text class="style-subsection-title">风格方向</text><text class="style-selection-rule">可多选</text></view>
          <view class="style-tendency-grid">
            <view v-for="item in styleDesignOptions" :key="item.value" class="style-tendency-pill" :class="{ active: selectedStyles.includes(item.value) }" @click="toggleSelectedStyle(item)">
              <text v-if="selectedStyles.includes(item.value)" class="style-pill-check">✓</text>{{ item.label }}
            </view>
          </view>
          <view class="style-subsection-head"><text class="style-subsection-title">设计用途</text><text class="style-selection-rule">单选</text></view>
          <view class="style-purpose-grid">
            <view v-for="item in styleDesignPurposeOptions" :key="item.value" class="style-purpose-card" :class="{ active: styleDesignPurpose === item.value }" @click="selectStyleDesignPurpose(item.value)">
              <text v-if="styleDesignPurpose === item.value" class="style-pill-check">✓</text>{{ item.label }}
            </view>
          </view>
          <view class="style-subsection-head"><text class="style-subsection-title">保持不变</text><text class="style-selection-rule">默认开启</text></view>
          <view class="style-preserve-list">
            <view v-for="item in stylePreserveOptions" :key="item.value" class="style-preserve-row" @click="toggleStylePreserveItem(item.value)">
              <text class="style-preserve-check" :class="{ active: stylePreserveItems.includes(item.value) }">{{ stylePreserveItems.includes(item.value) ? '✓' : '' }}</text>
              <text>{{ item.label }}</text>
            </view>
          </view>
          <view class="style-subsection-head"><text class="style-subsection-title">补充具体要求</text><text class="style-selection-rule">可选</text></view>
          <textarea class="redesign-textarea style-prompt-textarea" v-model="styleCustomPrompt" maxlength="300" :cursor-spacing="140" placeholder="例如：保留裙身主体，只将圆领改成方领，袖口增加褶皱。" @input="applyStyleParams" @focus="setStyleKeyboardActive(true)" @blur="setStyleKeyboardActive(false)" />
          <text class="style-character-count">{{ styleCustomPrompt.length }}/300</text>
          <view v-if="styleConflictMessage" class="style-conflict-message">{{ styleConflictMessage }}</view>
        </view>

        <view v-if="styleWizardStep === 4" class="style-section-card style-confirm-section">
          <view class="style-card-heading">
            <text class="style-card-title">确认本次改款</text>
            <text class="style-card-desc">生成前请确认改动范围和必须保留的内容。</text>
          </view>
          <view class="style-confirm-image-row">
            <image class="style-confirm-image" :src="clothImagePath" mode="aspectFit" />
            <view class="style-confirm-image-copy"><text>原款图片</text><text @click="goToStyleWizardStep(1)">修改</text></view>
          </view>
          <view class="style-confirm-row"><text>参考设计图</text><text>{{ hasStyleReferenceSelection ? '已添加' : '未添加' }}</text><text class="style-confirm-edit" @click="goToStyleWizardStep(1)">修改</text></view>
          <view class="style-confirm-row block"><text>改动部位</text><text>{{ styleChangeSummary }}</text><text class="style-confirm-edit" @click="goToStyleWizardStep(2)">修改</text></view>
          <view class="style-confirm-row"><text>改动强度</text><text>{{ styleChangeIntensityLabel }}</text><text class="style-confirm-edit" @click="goToStyleWizardStep(3)">修改</text></view>
          <view class="style-confirm-row block"><text>风格方向</text><text>{{ selectedStyleNames.join('、') }}</text><text class="style-confirm-edit" @click="goToStyleWizardStep(3)">修改</text></view>
          <view class="style-confirm-row"><text>设计用途</text><text>{{ styleDesignPurposeLabel }}</text><text class="style-confirm-edit" @click="goToStyleWizardStep(3)">修改</text></view>
          <view class="style-confirm-row block"><text>保持不变</text><text>{{ styleSelectedPreserveLabels.join('、') || '无额外保留项' }}</text><text class="style-confirm-edit" @click="goToStyleWizardStep(3)">修改</text></view>
        </view>

        <view v-if="styleWizardStep === 1" class="style-section-card style-reference-section">
          <view class="style-card-head">
            <view class="style-card-heading">
              <text class="style-card-title">参考设计</text>
              <text class="style-card-desc">仅参考设计元素，不复制模特、背景和品牌标识。</text>
            </view>
            <view class="style-head-meta">
              <text class="style-field-badge">可选</text>
              <text v-if="hasStyleReferenceSelection" class="style-completion-badge">✓ 已选择</text>
              <text v-if="hasStyleReferenceSelection" class="style-clear-action" @click="clearStyleReferenceSelection">取消</text>
            </view>
          </view>
          <view v-if="false" class="style-reference-tabs">
            <view
              v-for="tab in styleReferenceSourceTabs"
              :key="tab.value"
              class="style-reference-tab"
              :class="{ active: styleReferenceSource === tab.value }"
              @click="selectStyleReferenceSource(tab.value)"
            >
              {{ tab.label }}
            </view>
          </view>
          <view v-if="false" class="style-system-library">
            <scroll-view class="style-reference-scroll" scroll-x enhanced :show-scrollbar="false">
              <view class="style-reference-row">
                <view
                  v-for="item in visibleStyleReferenceOptions"
                  :key="item.value"
                  class="style-reference-card"
                  :class="{ active: referenceStyle === item.value }"
                  @click="selectReferenceStyle(item)"
                >
                  <text v-if="referenceStyle === item.value" class="style-option-check">✓</text>
                  <text class="style-reference-mark">{{ item.mark || item.label.slice(0, 1) }}</text>
                  <text class="style-reference-name">{{ item.label }}</text>
                  <text class="style-reference-desc">{{ item.desc }}</text>
                </view>
              </view>
            </scroll-view>
            <view
              v-if="currentTool.referenceLibrary.length > 3"
              class="style-more-reference"
              @click="toggleStyleReferences"
            >
              {{ styleReferencesExpanded ? '收起' : '查看更多' }}
            </view>
          </view>
          <view v-else-if="false" class="style-mine-reference">
            <view v-if="styleReferenceImagePath" class="style-reference-card active">
              <text class="style-option-check">✓</text>
              <image class="style-reference-image" :src="styleReferenceImagePath" mode="aspectFill" />
              <text class="style-reference-name">我的参考图</text>
              <text class="style-reference-desc">优先参考上传图片的款式方向</text>
            </view>
            <view v-else class="style-empty-reference" @click="chooseStyleReferenceImage">
              <text>还没有我的参考图</text>
              <text>点击上传一张款式参考图</text>
            </view>
          </view>
          <view v-else class="color-reference-card compact">
            <view>
              <text class="color-section-title">上传参考图</text>
              <text class="color-section-desc">可上传款式参考图，帮助控制改款方向。</text>
            </view>
            <view v-if="!styleReferenceImagePath" class="color-reference-action" @click="chooseStyleReferenceImage">上传</view>
            <view v-else class="color-reference-preview">
              <image class="color-reference-image" :src="styleReferenceImagePath" mode="aspectFill" />
              <button class="outline-btn" size="mini" @click="removeStyleReferenceImage">移除</button>
            </view>
          </view>
          <text v-if="styleReferenceImageStatus === 'uploading'" class="style-inline-status">正在校验并上传参考图...</text>
          <text v-if="styleReferenceImageError" class="style-inline-error">{{ styleReferenceImageError }}</text>
        </view>
        <view v-if="false" class="style-section-card style-settings-section">
          <view class="style-card-head compact">
            <view class="style-card-heading">
              <view class="style-required-title-row">
                <text class="style-card-title">改款设置</text>
                <text class="style-field-badge required">必填</text>
                <text v-if="styleSettingsComplete" class="style-completion-badge">✓ 已完成</text>
              </view>
              <text class="style-card-desc">先选择款式策略，再确认版型方向。</text>
            </view>
          </view>
          <view class="style-subsection-head">
            <text class="style-subsection-title">款式策略</text>
            <text class="style-selection-rule">单选</text>
          </view>
          <view class="style-pill-row">
            <view
              v-for="mode in styleModificationModes"
              :key="mode.value"
              class="style-choice-pill"
              :class="{ active: styleModificationMode === mode.value }"
              @click="selectStyleModificationMode(mode.value)"
            >
              <text v-if="styleModificationMode === mode.value" class="style-pill-check">✓</text>
              {{ mode.label }}
            </view>
          </view>
          <view class="style-subsection-head">
            <text class="style-subsection-title">版型方向</text>
            <text class="style-selection-rule">单选</text>
          </view>
          <view class="style-pill-row">
            <view
              v-for="fit in styleFitOptions"
              :key="fit.value"
              class="style-choice-pill"
              :class="{ active: styleFitDirection === fit.value }"
              @click="selectStyleFitDirection(fit.value)"
            >
              <text v-if="styleFitDirection === fit.value" class="style-pill-check">✓</text>
              {{ fit.label }}
            </view>
          </view>
        </view>
        <view v-if="false" class="style-section-card style-ai-section">
          <view class="style-card-head compact">
            <view class="style-card-heading">
              <view class="style-required-title-row">
                <text class="style-card-title">AI 设计要求</text>
                <text class="style-field-badge required">必填</text>
                <text v-if="stylePromptComplete" class="style-completion-badge">✓ 已完成</text>
              </view>
              <text class="style-card-desc">先选快捷方向，也可以继续补充具体要求。</text>
            </view>
          </view>
          <view class="style-subsection-head first">
            <text class="style-subsection-title">设计目标</text>
            <text class="style-selection-rule">单选 · 可选</text>
          </view>
          <view class="ai-prompt-template-grid">
            <view
              v-for="plan in styleAiPlanOptions"
              :key="plan.value"
              class="ai-prompt-template"
              :class="{ active: selectedParams.aiPlanId === plan.value }"
              @click="selectStyleAiPlan(plan)"
            >
              <text v-if="selectedParams.aiPlanId === plan.value" class="style-pill-check">✓</text>
              {{ plan.label }}
            </view>
          </view>
          <textarea
            class="redesign-textarea style-prompt-textarea"
            v-model="styleCustomPrompt"
            maxlength="300"
            :cursor-spacing="140"
            placeholder="例如：保留原版型主体，优化领口和袖型，整体更年轻、更适合电商展示。"
            @input="applyStyleParams"
            @focus="setStyleKeyboardActive(true)"
            @blur="setStyleKeyboardActive(false)"
          />
          <text class="style-character-count">{{ styleCustomPrompt.length }}/300</text>
          <view class="style-subsection-head">
            <text class="style-subsection-title">风格倾向</text>
            <text class="style-selection-rule">可多选 · 至少 1 项</text>
          </view>
          <view class="style-tendency-grid">
            <view
              v-for="item in styleDesignOptions"
              :key="item.value"
              class="style-tendency-pill"
              :class="{ active: selectedStyles.includes(item.value) }"
              @click="toggleSelectedStyle(item)"
            >
              <text v-if="selectedStyles.includes(item.value)" class="style-pill-check">✓</text>
              {{ item.label }}
            </view>
          </view>
          <view v-if="styleConflictMessage" class="style-conflict-message">{{ styleConflictMessage }}</view>
        </view>
        <view v-if="styleWizardStep === 4" class="style-section-card style-count-section">
          <view class="style-card-head compact">
            <view class="style-card-heading">
              <view class="style-required-title-row">
                <text class="style-card-title">方案数量</text>
                <text class="style-field-badge required">必填</text>
                <text class="style-completion-badge">✓ {{ styleOutputCount }} 个</text>
              </view>
              <text class="style-card-desc">选择本次需要生成的设计方案数量。</text>
            </view>
          </view>
          <view class="style-count-row">
            <view
              v-for="count in styleOutputCountOptions"
              :key="count"
              class="style-count-option"
              :class="{ active: styleOutputCount === count }"
              @click="selectStyleOutputCount(count)"
            >
              <text v-if="styleOutputCount === count" class="style-pill-check">✓</text>
              {{ count }}个方案
            </view>
          </view>
          <view class="style-count-summary">
            <text>预计生成 {{ styleOutputCount }} 张</text>
            <text>预计消耗 {{ styleOutputCount }} 次</text>
            <text>当前剩余 {{ styleRemainingQuotaLabel }}</text>
          </view>
        </view>
        <view v-if="styleWizardStep === 4" class="style-section-card style-save-section">
          <view class="style-save-toggle" @click="toggleStyleSavePanel">
            <view class="style-card-heading">
              <view class="style-required-title-row">
                <text class="style-card-title">保存为设计方案</text>
                <text class="style-field-badge">可选</text>
              </view>
              <text class="style-card-desc">命名后可在作品中心继续设计。</text>
            </view>
            <text class="style-save-arrow">{{ styleSavePanelOpen ? '⌃' : '⌄' }}</text>
          </view>
          <view v-if="styleSavePanelOpen" class="style-save-content">
            <input
              class="design-plan-input"
              v-model="styleDesignPlanName"
              :cursor-spacing="120"
              placeholder="输入方案名称，例如：春夏年轻化改款"
              @input="applyStyleParams"
              @focus="setStyleKeyboardActive(true)"
              @blur="setStyleKeyboardActive(false)"
            />
            <button class="save-design-btn" @click="saveStyleDesignPlan">保存方案</button>
          </view>
        </view>
      </view>

      <view v-if="isMarketingTool" class="redesign-workflow-panel">
        <view class="detail-template-section resource-library-block">
          <view class="resource-library-header" @click="toggleResourceLibrary('marketingTemplates')">
            <view class="resource-library-copy">
              <text class="color-section-title">详情页快捷模板</text>
              <text class="color-section-desc">按需展开电商、小红书和品牌模板</text>
              <text class="resource-library-summary">{{ activeDetailTemplateName || '未选择快捷模板' }}</text>
            </view>
            <text class="resource-library-arrow">{{ isResourceLibraryExpanded('marketingTemplates') ? '⌃' : '⌄' }}</text>
          </view>
          <view v-if="isResourceLibraryExpanded('marketingTemplates')" class="detail-template-grid resource-library-content">
            <view
              v-for="template in detailQuickTemplates"
              :key="template.value"
              class="detail-template-card"
              :class="{ active: activeDetailTemplate === template.value }"
              @click="applyDetailQuickTemplate(template)"
            >
              <view class="detail-template-head">
                <text class="detail-template-name">{{ template.label }}</text>
                <text v-if="activeDetailTemplate === template.value" class="detail-template-check">✓</text>
              </view>
              <text class="detail-template-desc">{{ template.desc }}</text>
            </view>
          </view>
        </view>

        <view class="detail-module-section">
          <view class="detail-module-heading">
            <view>
              <text class="color-section-title">选择生成模块</text>
              <text class="color-section-desc">可多选，默认已选适合商品上新的推荐组合。</text>
            </view>
            <text class="detail-recommend-badge">推荐 4 项</text>
          </view>
          <view class="detail-module-grid">
            <view
              v-for="item in detailGenerationModules"
              :key="item.value"
              class="detail-module-card"
              :class="{ active: selectedDetailModules.includes(item.value) }"
              @click="toggleDetailModule(item)"
            >
              <view class="detail-module-card-head">
                <text class="detail-module-name">{{ item.label }}</text>
                <text v-if="selectedDetailModules.includes(item.value)" class="detail-module-check">✓</text>
              </view>
              <text class="detail-module-desc">{{ item.desc }}</text>
            </view>
          </view>
        </view>

        <view class="color-system-card">
          <text class="color-section-title">标准详情页模块</text>
          <text class="color-section-desc">按商品内容需要自由组合，已选模块会写入详情页生成参数。</text>
          <view class="standard-detail-grid">
            <view
              v-for="item in standardDetailModules"
              :key="item.value"
              class="standard-detail-item"
              :class="{ active: selectedStandardDetailModules.includes(item.value) }"
              @click="toggleStandardDetailModule(item)"
            >
              <text v-if="selectedStandardDetailModules.includes(item.value)" class="standard-detail-check">✓</text>
              <text>{{ item.label }}</text>
            </view>
          </view>
        </view>

        <view class="color-system-card">
          <text class="color-section-title">商品信息</text>
          <text class="color-section-desc">补充商品信息后，系统会把卖点和目标人群写入营销描述。</text>
          <view class="product-info-grid">
            <view class="product-info-field">
              <text class="product-info-label">商品名称</text>
              <input
                class="product-info-input"
                v-model="productInfo.name"
                maxlength="40"
                placeholder="例如：春夏轻薄针织开衫"
                @input="applyMarketingParams"
              />
            </view>
            <view class="product-info-field">
              <text class="product-info-label">目标用户</text>
              <input
                class="product-info-input"
                v-model="productInfo.targetAudience"
                maxlength="40"
                placeholder="例如：25-35 岁通勤女性"
                @input="applyMarketingParams"
              />
            </view>
            <view class="product-info-field full">
              <text class="product-info-label">商品风格</text>
              <input
                class="product-info-input"
                v-model="productInfo.style"
                maxlength="60"
                placeholder="例如：极简通勤、轻法式、高级商业感"
                @input="applyMarketingParams"
              />
            </view>
          </view>
        </view>

        <view class="color-system-card marketing-copy-card">
          <text class="color-section-title">AI 商品文案</text>
          <text class="color-section-desc">根据已填写的商品信息生成可编辑文案草稿，不影响图片生成流程。</text>
          <view class="marketing-copy-field">
            <view class="marketing-copy-head">
              <text class="product-info-label">商品标题生成</text>
              <button class="marketing-copy-btn" @click="generateMarketingCopy('title')">智能生成</button>
            </view>
            <input
              class="product-info-input"
              v-model="productTitle"
              maxlength="60"
              placeholder="生成后可继续编辑商品标题"
              @input="applyMarketingParams"
            />
          </view>
          <view class="marketing-copy-field">
            <view class="marketing-copy-head">
              <text class="product-info-label">卖点生成</text>
              <button class="marketing-copy-btn" @click="generateMarketingCopy('selling_points')">智能生成</button>
            </view>
            <textarea
              class="product-info-textarea"
              v-model="sellingPoints"
              maxlength="160"
              placeholder="生成后可补充真实材质、版型和使用场景"
              @input="applyMarketingParams"
            />
          </view>
          <view class="marketing-copy-field">
            <view class="marketing-copy-head">
              <text class="product-info-label">详情描述生成</text>
              <button class="marketing-copy-btn" @click="generateMarketingCopy('description')">智能生成</button>
            </view>
            <textarea
              class="product-info-textarea marketing-description-input"
              v-model="detailDescription"
              maxlength="240"
              placeholder="生成后可完善商品详情描述"
              @input="applyMarketingParams"
            />
          </view>
        </view>

        <view class="color-system-card">
          <text class="color-section-title">详情页生成顺序</text>
          <text class="color-section-desc">系统按电商浏览节奏固定排序，避免内容重复和层级混乱。</text>
          <view class="detail-order-list">
            <view v-for="(item, index) in detailOutputOrder" :key="item" class="detail-order-item">
              <text class="detail-order-index">{{ index + 1 }}</text>
              <text class="detail-order-name">{{ item }}</text>
            </view>
          </view>
        </view>

        <view class="color-system-card">
          <text class="color-section-title">自定义模块</text>
          <text class="color-section-desc">补充品牌、版式或商品信息要求。</text>
          <textarea
            class="redesign-textarea"
            v-model="customDetailPrompt"
            maxlength="160"
            placeholder="例如：增加品牌故事模块；主图突出轻薄面料；尺寸表使用简洁排版"
            @input="applyMarketingParams"
          />
        </view>

        <view class="detail-generation-preview">
          <view class="detail-preview-head">
            <view>
              <text class="detail-preview-kicker">生成前确认</text>
              <text class="detail-preview-title">本次生成模块</text>
            </view>
            <text class="detail-preview-count">预计 {{ estimatedDetailOutputCount }} 张</text>
          </view>
          <view class="detail-preview-tags">
            <text v-for="item in selectedDetailModuleNames" :key="item" class="detail-preview-tag">{{ item }}</text>
          </view>
          <view v-if="sourcePackageId" class="package-structure-preview">
            <view class="package-structure-head">
              <text>详情页结构预览</text>
              <text>{{ marketingVersionLabel }}</text>
            </view>
            <view class="package-structure-flow">
              <view v-for="(item, index) in packageDetailStructure" :key="item" class="package-structure-item">
                <text class="package-structure-index">{{ index + 1 }}</text>
                <text class="package-structure-name">{{ item }}</text>
              </view>
            </view>
          </view>
        </view>

        <view v-if="selectedMarketingTypes.includes('detail_page')" class="detail-compatibility-note">
          <text>已兼容原详情页素材参数：{{ selectedPageMaterialTypes.length }} 项</text>
        </view>
        <view v-if="selectedMarketingTypes.includes('poster')" class="color-system-card">
          <text class="color-section-title">海报类型</text>
          <view class="color-target-grid">
            <view
              v-for="item in posterTypeOptions"
              :key="item.value"
              class="color-target-pill"
              :class="{ active: posterTypes.includes(item.value) }"
              @click="togglePosterType(item)"
            >
              {{ item.label }}
            </view>
          </view>
        </view>
        <view v-if="selectedMarketingTypes.includes('series')" class="color-system-card">
          <text class="color-section-title">系列图方向</text>
          <view class="color-target-grid">
            <view
              v-for="item in seriesTypeOptions"
              :key="item.value"
              class="color-target-pill"
              :class="{ active: seriesTypes.includes(item.value) }"
              @click="toggleSeriesType(item)"
            >
              {{ item.label }}
            </view>
          </view>
        </view>
      </view>

      <view v-if="isDisplayTool && !isDetailDisplayTool" class="unified-selection-block display-selection-block">
        <view class="display-section-head">
          <view>
            <text class="unified-selection-title">选择展示方式</text>
            <text class="display-section-desc">可多选，一次生成多种商品展示方式。</text>
          </view>
          <text class="style-field-badge required">必填</text>
        </view>
        <view class="display-mode-grid">
          <view
            v-for="tab in displayModeTabs"
            :key="tab.value"
            class="unified-selection-pill display-mode-pill"
            :class="{ active: isDisplayModeSelected(tab.value) }"
            @click="selectDisplayType(tab.value)"
          >
            <text v-if="isDisplayModeSelected(tab.value)" class="unified-selection-check">✓</text>
            {{ tab.label }}
          </view>
        </view>
        <view class="display-selection-summary">
          <text>{{ displayModeSelectionSummary }}</text>
        </view>
      </view>

      <view v-if="isDetailDisplayTool" class="detail-mode-panel display-detail-card">
        <view class="display-section-head">
          <view>
            <text class="detail-count-title">选择生成方式</text>
            <text class="display-section-desc">默认忠实展示原商品，不重新设计服装细节。</text>
          </view>
          <text class="style-field-badge required">必填</text>
        </view>
        <view class="detail-mode-grid">
          <view
            v-for="mode in detailGenerationModeOptions"
            :key="mode.value"
            class="detail-mode-card"
            :class="{ active: detailGenerationMode === mode.value }"
            @click="selectDetailGenerationMode(mode.value)"
          >
            <text class="detail-mode-name">{{ mode.label }}</text>
            <text class="detail-mode-desc">{{ mode.description }}</text>
          </view>
        </view>
      </view>

      <view v-if="isDetailDisplayTool" class="detail-library-panel display-detail-card">
        <view class="display-section-head">
          <view>
            <text class="unified-selection-title detail-part-title">选择细节部位</text>
            <text class="resource-library-description">这些是生成期望，不代表已经识别到对应部位。</text>
          </view>
          <text class="style-field-badge required">必填</text>
        </view>
        <text class="detail-selection-summary">{{ detailPartSelectionSummary }}</text>
        <view class="detail-category-row">
          <view
            v-for="category in detailReferenceCategories"
            :key="category.value"
            class="detail-category-pill"
            :class="{ active: activeDetailCategory === category.value }"
            @click="selectDetailCategory(category.value)"
          >
            {{ category.label }}
          </view>
        </view>
        <view class="detail-reference-grid detail-reference-compact-grid">
            <view
              v-for="item in displayedDetailReferenceOptions"
              :key="item.value"
              class="detail-reference-card"
              :class="{ active: selectedDetailParts.includes(item.value) }"
              @click="toggleDetailReference(item)"
            >
            <view class="detail-reference-copy">
              <text class="detail-reference-name">{{ item.label }}</text>
              <text class="detail-reference-tag">{{ item.categoryName }}</text>
            </view>
            <text v-if="selectedDetailParts.includes(item.value)" class="detail-reference-check">✓</text>
          </view>
        </view>
        <text v-if="canToggleMoreDetailParts" class="detail-more-toggle" @click="toggleMoreDetailParts">{{ showAllDetailParts ? '收起更多' : '展开更多' }}</text>
        <view class="detail-count-explanation">
          <text>{{ detailCountRelationshipText }}</text>
        </view>
        <view class="detail-evidence-list">
          <view v-for="item in selectedDetailReferenceItems" :key="item.value" class="detail-evidence-card">
            <view class="detail-evidence-head">
              <view>
                <text class="detail-evidence-title">{{ item.label }}近照</text>
                <text class="detail-evidence-status" :class="{ ready: hasDetailReferenceImage(item.value) }">
                  {{ hasDetailReferenceImage(item.value) ? '已提供近照' : '需要补充近照' }}
                </text>
              </view>
              <text class="style-field-badge required">必填</text>
            </view>
            <view v-if="!hasDetailReferenceImage(item.value)" class="detail-evidence-upload" @click="chooseDetailReferenceImage(item)">
              <text class="detail-evidence-plus">+</text>
              <text class="detail-evidence-upload-title">上传{{ item.label }}近照</text>
              <text class="detail-evidence-upload-desc">仅用于{{ item.label }}子任务，不影响其他细节</text>
            </view>
            <view v-else class="detail-evidence-preview">
              <image class="detail-evidence-image" :src="detailReferenceImageUrl(item.value)" mode="aspectFit" @click="previewDetailReferenceImage(item.value)" />
              <view class="detail-evidence-actions">
                <text @click.stop="chooseDetailReferenceImage(item)">更换</text>
                <text class="danger" @click.stop="removeDetailReferenceImage(item.value)">删除</text>
              </view>
            </view>
          </view>
        </view>
        <view class="detail-custom-card compact">
          <view class="fabric-title-row">
            <text class="color-section-title">补充细节要求</text>
            <text class="style-field-badge">可选</text>
          </view>
          <textarea
            class="redesign-textarea display-detail-textarea"
            v-model="detailCustomPrompt"
            maxlength="200"
            :adjust-position="true"
            cursor-spacing="120"
            placeholder="例如：重点放大袖口车线和金属扣细节"
            @focus="setDisplayKeyboardActive(true)"
            @blur="setDisplayKeyboardActive(false)"
            @input="handleDetailPromptInput"
          />
          <text class="fabric-character-count">{{ detailCustomPrompt.length }}/200</text>
        </view>
      </view>

      <view v-if="isModelTool" class="model-mode-block">
        <view class="model-quick-plan-block resource-library-block">
          <view class="resource-library-header" @click="toggleResourceLibrary('modelQuickPlans')">
            <view class="resource-library-copy">
              <text class="model-quick-plan-title">快捷方案</text>
              <text class="resource-library-description">按需展开预设组合，不影响手动选择能力</text>
              <text class="resource-library-summary">{{ activeModelQuickPlanName || '未采用快捷方案' }}</text>
            </view>
            <text class="resource-library-arrow">{{ isResourceLibraryExpanded('modelQuickPlans') ? '⌃' : '⌄' }}</text>
          </view>
          <view v-if="isResourceLibraryExpanded('modelQuickPlans')" class="model-quick-plan-grid resource-library-content">
            <view
              v-for="plan in modelQuickPlans"
              :key="plan.value"
              class="model-quick-plan-card"
              :class="{ active: isModelQuickPlanActive(plan) }"
              @click="applyModelQuickPlan(plan)"
            >
              <text class="model-quick-plan-name">{{ plan.label }}</text>
              <text class="model-quick-plan-desc">{{ plan.desc }}</text>
            </view>
          </view>
        </view>
        <view class="unified-selection-block model-capability-selection">
          <text class="unified-selection-title">选择生成能力</text>
          <scroll-view scroll-x class="unified-selection-scroll" :show-scrollbar="false">
            <view class="unified-selection-row">
              <view
                v-for="mode in modelReplacementModes"
                :key="mode.value"
                class="unified-selection-pill"
                :class="{ active: isModelFeatureSelected(mode.value) }"
                @click="toggleModelFeature(mode)"
              >
                <text v-if="isModelFeatureSelected(mode.value)" class="unified-selection-check">✓</text>
                {{ mode.label }}
              </view>
            </view>
          </scroll-view>
          <text class="unified-selection-tip">支持多选，按已选能力显示对应配置。</text>
        </view>
        <view class="mode-summary">
          <text class="mode-summary-title">本次生成内容</text>
          <text
            v-for="line in modelGenerationSummaryLines"
            :key="line"
            class="mode-summary-desc"
          >
            {{ line }}
          </text>
        </view>
      </view>

      <view v-if="isModelTool && isModelFeatureSelected('model_display')" class="model-feature-config">
        <view class="face-upload-card">
          <view>
            <text class="face-upload-title">上传模特参考图</text>
            <text class="face-upload-desc">可选，上传后优先参考你的模特风格。</text>
          </view>
          <view v-if="!modelReferenceImagePath" class="face-upload-action" @click="chooseModelReferenceImage">
            <text>上传</text>
          </view>
          <view v-else class="face-upload-preview">
            <image class="face-upload-image" :src="modelReferenceImagePath" mode="aspectFill" />
            <button class="outline-btn" size="mini" @click="removeModelReferenceImage">移除</button>
          </view>
        </view>
        <view class="face-reference-section resource-library-block">
          <view class="resource-library-header" @click="toggleResourceLibrary('modelReferences')">
            <view class="resource-library-copy">
              <text class="face-reference-section-title">AI模特库</text>
              <text class="resource-library-description">可选不同模特形象，按需展开选择</text>
              <text class="resource-library-summary">{{ modelReferenceName ? `已选择：${modelReferenceName}` : '未选择模特' }}</text>
            </view>
            <text class="resource-library-arrow">{{ isResourceLibraryExpanded('modelReferences') ? '⌃' : '⌄' }}</text>
          </view>
          <view v-if="isResourceLibraryExpanded('modelReferences')" class="face-reference-grid resource-library-content">
            <view
              v-for="item in modelDisplayReferences"
              :key="item.value"
              class="face-reference-card"
              :class="{ active: modelReferenceStyle === item.value }"
              @click="selectModelFeatureReference('model_display', item)"
            >
              <view class="body-reference-image" :class="item.tone">
                <view class="body-figure">
                  <view class="body-head"></view>
                  <view class="body-torso"></view>
                  <view class="body-arm left"></view>
                  <view class="body-arm right"></view>
                  <view class="body-leg left"></view>
                  <view class="body-leg right"></view>
                </view>
              </view>
              <view class="face-reference-copy">
                <text class="face-reference-name">{{ item.label }}</text>
                <text class="face-reference-tag">{{ item.tag }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>

      <view v-if="isModelTool && isModelFeatureSelected('face_replace')" class="model-feature-config">
        <view class="model-submode-panel">
          <text class="model-submode-title">选择换脸方式</text>
          <view class="color-target-grid">
            <view
              v-for="item in faceReplaceTypeOptions"
              :key="item.value"
              class="color-target-pill"
              :class="{ active: selectedParams.faceReplaceType === item.value }"
              @click="selectParam('faceReplaceType', item.value)"
            >
              {{ item.label }}
            </view>
          </view>
        </view>
        <view class="face-upload-card">
          <view>
            <text class="face-upload-title">上传人脸参考图</text>
            <text class="face-upload-desc">可选，上传后优先参考你的目标人脸。</text>
          </view>
          <view v-if="!referenceImagePath" class="face-upload-action" @click="chooseReferenceImage">
            <text>上传</text>
          </view>
          <view v-else class="face-upload-preview">
            <image class="face-upload-image" :src="referenceImagePath" mode="aspectFill" />
            <button class="outline-btn" size="mini" @click="removeReferenceImage">移除</button>
          </view>
        </view>
        <view class="face-reference-section resource-library-block">
          <view class="resource-library-header" @click="toggleResourceLibrary('faceReferences')">
            <view class="resource-library-copy">
              <text class="face-reference-section-title">人脸参考库</text>
              <text class="resource-library-description">可选不同年龄与商业风格的人脸参考</text>
              <text class="resource-library-summary">{{ faceReferenceName ? `已选择：${faceReferenceName}` : '未选择人脸' }}</text>
            </view>
            <text class="resource-library-arrow">{{ isResourceLibraryExpanded('faceReferences') ? '⌃' : '⌄' }}</text>
          </view>
          <view v-if="isResourceLibraryExpanded('faceReferences')" class="face-reference-grid resource-library-content">
            <view
              v-for="item in faceReplaceReferences"
              :key="item.value"
              class="face-reference-card"
              :class="{ active: faceReferenceStyle === item.value }"
              @click="selectModelFeatureReference('face_replace', item)"
            >
              <view class="face-reference-image" :class="item.tone">
                <view class="face-shape">
                  <view class="face-hair"></view>
                  <view class="face-dot left"></view>
                  <view class="face-dot right"></view>
                  <view class="face-line"></view>
                </view>
              </view>
              <view class="face-reference-copy">
                <text class="face-reference-name">{{ item.label }}</text>
                <text class="face-reference-tag">{{ item.tag }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>

      <view v-if="false && isModelTool && modelReplacementMode === 'face_replace'" class="model-submode-panel">
        <text class="model-submode-title">选择换脸方式</text>
        <view class="color-target-grid">
          <view
            v-for="item in faceReplaceTypeOptions"
            :key="item.value"
            class="color-target-pill"
            :class="{ active: selectedParams.faceReplaceType === item.value }"
            @click="selectParam('faceReplaceType', item.value)"
          >
            {{ item.label }}
          </view>
        </view>
      </view>

      <view v-if="false && isModelTool && currentModelMode.showReferenceUpload !== false" class="face-upload-card">
        <view>
          <text class="face-upload-title">{{ currentModelMode.referenceTitle }}</text>
          <text class="face-upload-desc">{{ currentModelMode.referenceDesc }}</text>
        </view>
        <view v-if="!referenceImagePath" class="face-upload-action" @click="chooseReferenceImage">
          <text>上传</text>
        </view>
        <view v-else class="face-upload-preview">
          <image class="face-upload-image" :src="referenceImagePath" mode="aspectFill" />
          <button class="outline-btn" size="mini" @click="removeReferenceImage">移除</button>
        </view>
      </view>

      <view v-if="isModelTool && isModelFeatureSelected('pose_variation')" class="model-reference-control">
        <view class="face-upload-card">
          <view>
            <text class="face-upload-title">上传姿势参考图</text>
            <text class="face-upload-desc">可上传模特动作、杂志动作或品牌动作参考。</text>
          </view>
          <view v-if="!poseReferenceImagePath" class="face-upload-action" @click="choosePoseReferenceImage">
            <text>上传</text>
          </view>
          <view v-else class="face-upload-preview">
            <image class="face-upload-image" :src="poseReferenceImagePath" mode="aspectFill" />
            <button class="outline-btn" size="mini" @click="removePoseReferenceImage">移除</button>
          </view>
        </view>
        <view class="face-reference-section resource-library-block">
          <view class="resource-library-header" @click="toggleResourceLibrary('poseReferences')">
            <view class="resource-library-copy">
              <text class="face-reference-section-title">姿势动作库</text>
              <text class="resource-library-description">可选站姿、走姿、坐姿、转身等动作</text>
              <text class="resource-library-summary">{{ poseReferenceName ? `已选择：${poseReferenceName}` : '未选择姿势' }}</text>
            </view>
            <text class="resource-library-arrow">{{ isResourceLibraryExpanded('poseReferences') ? '⌃' : '⌄' }}</text>
          </view>
          <view v-if="isResourceLibraryExpanded('poseReferences')" class="face-reference-grid resource-library-content">
            <view
              v-for="item in poseVariationReferences"
              :key="item.value"
              class="face-reference-card"
              :class="{ active: poseReferenceStyle === item.value }"
              @click="selectModelFeatureReference('pose_variation', item)"
            >
              <view class="body-reference-image" :class="item.tone">
                <view class="pose-figure">
                  <view class="pose-head"></view>
                  <view class="pose-body"></view>
                  <view class="pose-leg left"></view>
                  <view class="pose-leg right"></view>
                </view>
              </view>
              <view class="face-reference-copy">
                <text class="face-reference-name">{{ item.label }}</text>
                <text class="face-reference-tag">{{ item.tag }}</text>
              </view>
            </view>
          </view>
        </view>
        <view class="color-system-card">
          <text class="color-section-title">生成数量</text>
          <view class="color-target-grid">
            <view
              v-for="count in poseCountOptions"
              :key="count"
              class="color-target-pill"
              :class="{ active: Number(selectedParams.poseGenerateCount || 2) === count }"
              @click="selectParam('poseGenerateCount', String(count))"
            >
              {{ count }}张
            </view>
          </view>
        </view>
        <view class="color-system-card">
          <text class="color-section-title">参考类型</text>
          <view class="color-target-grid">
            <view
              v-for="item in poseReferenceTypes"
              :key="item.value"
              class="color-target-pill"
              :class="{ active: poseReferenceType === item.value }"
              @click="selectPoseReferenceType(item.value)"
            >
              {{ item.label }}
            </view>
          </view>
        </view>
        <view class="color-system-card">
          <text class="color-section-title">姿势补充描述</text>
          <textarea
            class="redesign-textarea"
            v-model="poseCustomPrompt"
            maxlength="80"
            placeholder="例如：自然走动，手部动作更适合电商展示"
            @input="applyPoseParams"
          />
        </view>
      </view>

      <view v-if="isModelTool && isModelFeatureSelected('scene_replace')" class="model-reference-control">
        <view class="face-upload-card">
          <view>
            <text class="face-upload-title">上传场景参考图</text>
            <text class="face-upload-desc">可上传店铺、街景、棚拍或品牌空间作为场景参考。</text>
          </view>
          <view v-if="!sceneReferenceImagePath" class="face-upload-action" @click="chooseSceneReferenceImage">
            <text>上传</text>
          </view>
          <view v-else class="face-upload-preview">
            <image class="face-upload-image" :src="sceneReferenceImagePath" mode="aspectFill" />
            <button class="outline-btn" size="mini" @click="removeSceneReferenceImage">移除</button>
          </view>
        </view>
        <view class="face-reference-section resource-library-block">
          <view class="resource-library-header" @click="toggleResourceLibrary('sceneReferences')">
            <view class="resource-library-copy">
              <text class="face-reference-section-title">场景库</text>
              <text class="resource-library-description">可选街拍、棚拍、展厅、家居等背景</text>
              <text class="resource-library-summary">{{ sceneReferenceName ? `已选择：${sceneReferenceName}` : '未选择场景模板' }}</text>
            </view>
            <text class="resource-library-arrow">{{ isResourceLibraryExpanded('sceneReferences') ? '⌃' : '⌄' }}</text>
          </view>
          <view v-if="isResourceLibraryExpanded('sceneReferences')" class="face-reference-grid resource-library-content">
            <view
              v-for="item in sceneReplaceReferences"
              :key="item.value"
              class="face-reference-card"
              :class="{ active: sceneReferenceStyle === item.value }"
              @click="selectModelFeatureReference('scene_replace', item)"
            >
              <view class="scene-reference-image" :class="item.tone">
                <view class="scene-visual">
                  <view class="scene-sky"></view>
                  <view class="scene-subject"></view>
                  <view class="scene-ground"></view>
                </view>
              </view>
              <view class="face-reference-copy">
                <text class="face-reference-name">{{ item.label }}</text>
                <text class="face-reference-tag">{{ item.tag }}</text>
              </view>
            </view>
          </view>
        </view>
        <view class="color-system-card">
          <text class="color-section-title">场景补充描述</text>
          <textarea
            class="redesign-textarea"
            v-model="sceneCustomPrompt"
            maxlength="80"
            placeholder="例如：咖啡厅窗边自然光，背景干净不抢服装"
            @input="applySceneParams"
          />
        </view>
      </view>

      <view v-if="false && isModelTool && currentModelMode.referenceGroups && currentModelMode.referenceGroups.length" class="face-reference-section">
        <text class="face-reference-section-title">{{ currentModelMode.libraryTitle }}</text>
        <view v-for="group in currentModelMode.referenceGroups" :key="group.title" class="model-reference-group">
          <text class="model-reference-group-title">{{ group.title }}</text>
          <view class="face-reference-grid">
            <view
              v-for="item in group.items"
              :key="item.value"
              class="face-reference-card"
              :class="{ active: referenceStyle === item.value }"
              @click="selectReferenceStyle(item)"
            >
              <view class="body-reference-image" :class="item.tone">
                <view class="pose-figure">
                  <view class="pose-head"></view>
                  <view class="pose-body"></view>
                  <view class="pose-leg left"></view>
                  <view class="pose-leg right"></view>
                </view>
              </view>
              <view class="face-reference-copy">
                <text class="face-reference-name">{{ item.label }}</text>
                <text class="face-reference-tag">{{ item.tag }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>

      <view v-else-if="false && isModelTool && currentReferenceOptions.length" class="face-reference-section">
        <text class="face-reference-section-title">{{ currentModelMode.libraryTitle }}</text>
        <view class="face-reference-grid">
          <view
            v-for="item in currentReferenceOptions"
            :key="item.value"
            class="face-reference-card"
            :class="{ active: referenceStyle === item.value }"
            @click="selectReferenceStyle(item)"
          >
            <view v-if="currentModelMode.libraryType === 'body'" class="body-reference-image" :class="item.tone">
              <view class="body-figure">
                <view class="body-head"></view>
                <view class="body-torso"></view>
                <view class="body-arm left"></view>
                <view class="body-arm right"></view>
                <view class="body-leg left"></view>
                <view class="body-leg right"></view>
              </view>
            </view>
            <view v-else-if="currentModelMode.libraryType === 'scene'" class="scene-reference-image" :class="item.tone">
              <view class="scene-visual">
                <view class="scene-sky"></view>
                <view class="scene-subject"></view>
                <view class="scene-ground"></view>
              </view>
            </view>
            <view v-else-if="currentModelMode.libraryType === 'pose'" class="body-reference-image" :class="item.tone">
              <view class="pose-figure">
                <view class="pose-head"></view>
                <view class="pose-body"></view>
                <view class="pose-leg left"></view>
                <view class="pose-leg right"></view>
              </view>
            </view>
            <view v-else class="face-reference-image" :class="item.tone">
              <view class="face-shape">
                <view class="face-hair"></view>
                <view class="face-dot left"></view>
                <view class="face-dot right"></view>
                <view class="face-line"></view>
              </view>
            </view>
            <view class="face-reference-copy">
              <text class="face-reference-name">{{ item.label }}</text>
              <text class="face-reference-tag">{{ item.tag }}</text>
            </view>
          </view>
        </view>
      </view>

      <view v-else-if="!isRedesignTool && currentReferenceOptions.length" class="reference-style-grid">
        <view
          v-for="item in currentReferenceOptions"
          :key="item.value"
          class="reference-style-card"
          :class="{ active: referenceStyle === item.value }"
          @click="selectReferenceStyle(item)"
        >
          <view class="reference-visual" :class="item.tone">
            <text class="reference-mark">{{ item.mark }}</text>
          </view>
          <view class="reference-copy">
            <text class="reference-name">{{ item.label }}</text>
            <text class="reference-desc">{{ item.desc }}</text>
          </view>
        </view>
      </view>

      <block v-if="!isDetailDisplayTool && !isRedesignTool && !isModelTool">
        <view v-for="group in currentTool.paramGroups" :key="group.key" class="param-group" :class="{ 'display-param-group': isDisplayTool }">
          <view class="display-section-head">
            <text class="param-label">{{ group.label }}</text>
            <text v-if="isDisplayTool" class="style-field-badge required">必填</text>
          </view>
          <view class="choice-row" :class="{ 'model-quick-grid': group.layout === 'modelCards', 'display-param-grid': isDisplayTool }">
            <view
              v-for="option in group.options"
              :key="option.value"
              class="choice-pill"
              :class="[
                { active: selectedParams[group.key] === option.value },
                group.layout === 'modelCards' ? 'model-quick-card' : ''
              ]"
              @click="selectParam(group.key, option.value)"
            >
              <text v-if="isDisplayTool && selectedParams[group.key] === option.value" class="unified-selection-check">✓</text>
              <text v-if="group.layout === 'modelCards'" class="model-quick-avatar">{{ option.avatar }}</text>
              <text class="choice-label">{{ isDisplayTool ? getDisplayOptionLabel(group.key, option) : option.label }}</text>
              <text v-if="isDisplayTool && getDisplayOptionHint(group.key, option)" class="display-option-hint">{{ getDisplayOptionHint(group.key, option) }}</text>
              <text v-if="group.layout === 'modelCards'" class="model-quick-desc">{{ option.desc }}</text>
            </view>
          </view>
        </view>
      </block>
    </view>

    <view v-if="isModelTool" class="advanced-entry-card" :class="{ open: advancedSettingsOpen }">
      <view class="advanced-entry-head" @click="toggleAdvancedSettings">
        <view>
          <text class="advanced-entry-title">高级设置</text>
          <text class="advanced-entry-desc">我的模特、姿势和比例控制。</text>
        </view>
        <text class="advanced-toggle">{{ advancedSettingsOpen ? '收起' : '展开' }}</text>
      </view>

      <view v-if="advancedSettingsOpen" class="advanced-panel">
        <view class="advanced-block">
          <view class="advanced-block-head">
            <text class="advanced-title">我的模特</text>
            <button class="outline-btn" size="mini" @click="goToFullWorkspace">完整AI模特工作台</button>
          </view>
          <view v-if="personalModels.length" class="model-card-list">
            <view
              v-for="model in personalModels"
              :key="model.modelId"
              class="model-card"
              :class="{ active: selectedModelId === model.modelId }"
              @click="selectProfessionalModel(model)"
            >
              <image v-if="model.avatarUrl" class="model-avatar" :src="model.avatarUrl" mode="aspectFill" />
              <view v-else class="model-avatar placeholder">{{ model.name.slice(0, 1) }}</view>
              <view class="model-info">
                <text class="model-name">{{ model.name }}</text>
                <text class="model-meta">{{ formatModelMeta(model) }}</text>
              </view>
            </view>
          </view>
          <view v-else class="empty-model-tip">
            暂无我的模特，可进入完整工作台创建专属模特。
          </view>
        </view>

        <view class="advanced-block">
          <text class="advanced-title">姿势控制</text>
          <view class="advanced-config-group">
            <view class="choice-row">
              <view
                v-for="item in poseOptions"
                :key="item.value"
                class="choice-pill"
                :class="{ active: advancedParams.poseControl === item.value }"
                @click="selectAdvancedParam('poseControl', item.value)"
              >
                {{ item.label }}
              </view>
            </view>
          </view>
        </view>

        <view class="advanced-block">
          <text class="advanced-title">比例控制</text>
          <view class="advanced-config-group">
            <view class="choice-row">
              <view
                v-for="item in ratioOptions"
                :key="item.value"
                class="choice-pill"
                :class="{ active: advancedParams.imageRatio === item.value }"
                @click="selectAdvancedParam('imageRatio', item.value)"
              >
                {{ item.label }}
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>

    <view v-if="isModelTool" class="model-generate-summary-card">
      <text class="model-generate-summary-title">本次生成内容</text>
      <text
        v-for="line in modelGenerationSummaryLines"
        :key="line"
        class="model-generate-summary-line"
      >
        {{ line }}
      </text>
    </view>

    <view v-if="isStyleTool && styleSubmissionNotice" class="style-submission-notice" :class="styleSubmissionStatus">
      <text>{{ styleSubmissionNotice }}</text>
    </view>

    <view class="bottom-safe"></view>
    <view v-if="isStyleTool" class="style-wizard-action-bar" :class="{ 'keyboard-visible': styleKeyboardActive }">
      <text v-if="styleCurrentStepReason" class="style-wizard-action-reason">{{ styleCurrentStepReason }}</text>
      <view class="style-wizard-action-buttons">
        <button v-if="styleWizardStep > 1" class="style-wizard-secondary-btn" :disabled="isGenerating" @click="previousStyleWizardStep">上一步</button>
        <button v-if="styleWizardStep < 4" class="style-wizard-primary-btn" :class="{ full: styleWizardStep === 1 }" :disabled="!canAdvanceStyleWizard" @click="nextStyleWizardStep">
          {{ styleWizardStep === 1 ? '下一步：选择改哪里' : (styleWizardStep === 2 ? '下一步：设计方向' : '下一步：确认生成') }}
        </button>
        <button v-else class="style-wizard-primary-btn" :disabled="isGenerateDisabled" @click="startGenerate">{{ generationProgressText || '立即生成' }}</button>
      </view>
    </view>
    <view v-else-if="isColorTool" class="color-fixed-action" :class="{ 'keyboard-visible': colorKeyboardActive }">
      <view class="color-fixed-summary">
        <view class="color-fixed-swatch" :style="{ background: currentTargetColor ? currentTargetColor.hex : '#E5E7EB' }"></view>
        <view><text>{{ currentTargetColor ? `${currentTargetColor.displayName} · ${currentTargetColor.hex}` : '尚未选择颜色' }}</text><text>{{ colorTargetAreaLabel }} · 生成式近似换色</text></view>
      </view>
      <text v-if="colorGenerateDisabledReason" class="color-fixed-reason">{{ colorGenerateDisabledReason }}</text>
      <button class="color-fixed-button" :disabled="isGenerateDisabled" @click="startGenerate">{{ colorGenerateButtonText === '立即生成' ? '立即换色' : colorGenerateButtonText }}</button>
    </view>
    <GenerationActionBar v-else
      :summary="unifiedGenerationSummary"
      :reason="unifiedGenerateReason"
      :button-text="unifiedGenerateButtonText"
      loading-text="正在生成…"
      :disabled="isGenerateDisabled"
      :loading="isUnifiedSubmitting"
      :keyboard-visible="isGenerationKeyboardVisible"
      @generate="startGenerate"
    />
  </view>
</template>

<script>
import AiFeatureHeader from '../../components/ai-generation/ai-feature-header.vue'
import GenerationActionBar from '../../components/ai-generation/generation-action-bar.vue'
import ColorPickerCanvas from '../../components/color-picker/color-picker-canvas.vue'
import CustomColorPicker from '../../components/color-picker/custom-color-picker.vue'
import ColorQuickPreview from '../../components/color-picker/color-quick-preview.vue'
import { createGenerationTaskAndRun, createInternalRealGenerationTask } from '../../utils/task/generationExecution'
import { createTaskAndSimulate } from '../../utils/task/taskLayer'
import {
  getIdentityProviderCapability,
  validateExperimentalIdentityProviderCapability,
  validateIdentityProviderCapability
} from '../../utils/provider/identityProviderCapability'
import {
  validateExperimentalGarmentProviderCapability,
  validateGarmentProviderCapability
} from '../../utils/provider/garmentProviderCapability'
import {
  TEST_EXECUTION_MODES,
  buildTestTaskMetadata,
  getRuntimeGenerationConfig,
  refreshFeatureRuntimeBackendState,
  setInternalRuntimeConfig
} from '../../utils/runtime/appRuntimeConfig'
import {
  createWorkspaceGarmentDetailBatch,
  createWorkspaceOutputVariantBatch
} from '../../utils/workspace/workspaceProduction'
import {
  GARMENT_DETAIL_MODES,
  validateGarmentDetailSelection
} from '../../utils/task/garmentDetailContract'
import { getMembershipUsage } from '../../utils/member/membershipRepository'
import {
  consumeQuota,
  createQuotaAlphaTaskId,
  rollbackQuota,
  settleQuotaByTask
} from '../../utils/quota/quotaFlow'
import {
  GARMENT_REPLACE_ACTION,
  GARMENT_REPLACE_TASK_TYPE,
  GARMENT_REPLACE_MODES,
  GARMENT_PROVIDER_MAX_INPUT_IMAGES,
  validateGarmentReplaceInput
} from '../../utils/task/garmentReplaceContract'
import {
  ACCESSORY_TYPES,
  getAccessories,
  markAccessoryUsed,
  removeAccessory,
  saveAccessory
} from '../../utils/accessory/accessoryLibraryRepository'
import { uploadImage } from '../../utils/api/upload'
import { getColorGroups, getSystemColorMatrix } from '../../utils/color/colorLibrary'
import {
  clearColorHistory,
  getColorHistory,
  normalizeStandardColor,
  removeColorHistory,
  saveColorHistory
} from '../../utils/color/colorPicker'
import {
  clearRecentColorsFromCloud,
  removeRecentColorFromCloud,
  saveRecentColorToCloud,
  syncRecentColors
} from '../../utils/color/colorPreferenceRepository.js'
import { getSystemScenes } from '../../utils/scene/sceneLibrary'
import {
  MAX_MY_SCENES,
  addScene as saveMyScene,
  getLastSelectedScene,
  getMyScenes as getSavedMyScenes,
  markSceneUsed,
  removeScene as removeSavedScene,
  setLastSelectedScene,
  updateSceneName
} from '../../utils/scene/scenePreferenceRepository'
import {
  MODEL_TYPES,
  createCustomModel,
  getBrandModels,
  getPersonalModels,
  getSystemModels
} from '../../utils/model/modelLibrary'
import {
  MODEL_PROFILE_CONSENT_TEXT,
  MODEL_PROFILE_SELECTION_KEY,
  getModelProfiles,
  saveModelProfile
} from '../../utils/model/modelProfileRepository.js'

const PRODUCTION_CONTEXT_STORAGE_KEY = 'diebiandesign_production_context'
const CONTINUE_CONTEXT_STORAGE_PREFIX = 'diebiandesign_continue_context_'
const STYLE_DESIGN_PLAN_STORAGE_KEY = 'diebiandesign_style_design_plans'
const STYLE_REDESIGN_DRAFT_STORAGE_KEY = 'diebiandesign_style_redesign_draft_v1'
const STYLE_REDESIGN_DRAFT_VERSION = 1
const STYLE_REDESIGN_DRAFT_MAX_AGE = 7 * 24 * 60 * 60 * 1000
const COLOR_REDESIGN_DRAFT_STORAGE_KEY = 'diebiandesign_color_redesign_draft_v1'
const PATTERN_REDESIGN_DRAFT_STORAGE_KEY = 'diebiandesign_pattern_redesign_draft_v1'
const DISPLAY_DRAFT_STORAGE_KEYS = {
  display: 'diebiandesign_display_image_draft_v1',
  detail: 'diebiandesign_detail_image_draft_v1'
}
const COLOR_REDESIGN_DRAFT_VERSION = 1
const COLOR_REDESIGN_DRAFT_MAX_AGE = 7 * 24 * 60 * 60 * 1000
const STYLE_IMAGE_MAX_BYTES = 10 * 1024 * 1024
const STYLE_IMAGE_MIN_SIDE = 256
const STYLE_IMAGE_ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp']
const PRODUCT_PACKAGE_STORAGE_KEY = 'diebiandesign_product_packages'
const GARMENT_REPLACE_DRAFT_STORAGE_KEY = 'diebiandesign_garment_replace_draft_v1'
const MODEL_REPLACE_PREFERENCE_STORAGE_KEY = 'diebiandesign_model_replace_preference_v1'
const GARMENT_WIZARD_STEPS = Object.freeze([
  Object.freeze({ value: 1, label: '选择人物' }),
  Object.freeze({ value: 2, label: '选择服装' }),
  Object.freeze({ value: 3, label: '配饰与保留' }),
  Object.freeze({ value: 4, label: '确认生成' })
])

const GARMENT_REPLACE_MODE_OPTIONS = Object.freeze([
  Object.freeze({ label: '只换上装', value: GARMENT_REPLACE_MODES.UPPER_ONLY, desc: '保留下装，只替换上半身服装' }),
  Object.freeze({ label: '只换下装', value: GARMENT_REPLACE_MODES.LOWER_ONLY, desc: '保留上装，只替换下半身服装' }),
  Object.freeze({ label: '上下装一起换', value: GARMENT_REPLACE_MODES.SEPARATE, desc: '分别使用两张服装参考图' }),
  Object.freeze({ label: '整套/连体服', value: GARMENT_REPLACE_MODES.FULL_OUTFIT, desc: '使用一张完整服装参考图' })
])

const GARMENT_PRESERVE_OPTIONS = Object.freeze([
  Object.freeze({ key: 'preservePerson', label: '保留人物脸部与身份', desc: '保持人物身份、脸部和体型' }),
  Object.freeze({ key: 'preservePose', label: '保留体型与姿势', desc: '保持身体比例、动作和构图' }),
  Object.freeze({ key: 'preserveBackground', label: '保留原始背景和场景', desc: '保持原场景和光线环境' }),
  Object.freeze({ key: 'preserveUnchangedGarment', label: '保留未替换的服装区域', desc: '只改变当前模式选择的服装部位' })
])

function isSceneReplaceDevelopment() {
  if (typeof process !== 'undefined' && process && process.env && ['development', 'dev'].includes(process.env.NODE_ENV)) return true
  try {
    return typeof wx !== 'undefined' && wx && typeof wx.getAccountInfoSync === 'function' && wx.getAccountInfoSync().miniProgram.envVersion === 'develop'
  } catch (error) {
    return false
  }
}

function isStyleRedesignDevelopment() {
  try {
    if (typeof wx !== 'undefined' && wx && typeof wx.getAccountInfoSync === 'function') {
      const accountInfo = wx.getAccountInfoSync()
      return accountInfo && accountInfo.miniProgram && accountInfo.miniProgram.envVersion === 'develop'
    }
  } catch (error) {
    return false
  }
  return typeof process !== 'undefined'
    && process
    && process.env
    && ['development', 'dev'].includes(process.env.NODE_ENV)
}

const PRODUCT_PACKAGE_ASSET_LABELS = {
  model_image: 'AI模特图',
  flat_detail: '平铺细节图',
  detail_page: '详情页素材',
  poster: '海报',
  series: '系列图'
}

const MODEL_REPLACEMENT_MODES = []

const MODEL_REPLACE_TYPE_OPTIONS = [
  { label: '换整头', value: 'head_replace', desc: '替换脸型、五官和发型，保留服装、身体和场景。', visual: 'head' },
  { label: '只换脸', value: 'face_replace', desc: '只替换面部身份，尽量保留原发型、头型和姿态。', visual: 'face' }
]

const MODEL_PORTRAIT_SOURCE_TABS = [
  { label: '我的常用模特', value: 'profiles' },
  { label: '上传新的人像', value: 'upload' },
  { label: '系统人像', value: 'system' }
]

const MODEL_SYSTEM_PORTRAIT_CONFIGS = [
  { label: '女性', value: 'female', modelIndex: 0 },
  { label: '男性', value: 'male', modelIndex: 5 },
  { label: '商务', value: 'business', modelIndex: 1 },
  { label: '时尚', value: 'fashion', modelIndex: 9 }
]

const MODEL_WORKFLOW_MODES = [
  {
    label: '模特展示',
    value: 'model_display',
    desc: '标准上身展示图',
    focusTitle: '生成服装标准上身展示图',
    focusDesc: '适合上传服装图后快速生成全身 AI 模特展示效果。',
    taskType: 'model_replace',
    outputType: 'model_image',
    uploadTitle: '上传服装图',
    uploadDesc: '上传清晰服装图，系统会生成标准模特上身展示图。',
    showReferenceUpload: false,
    libraryTitle: '全身AI模特库',
    libraryType: 'body',
    referenceLibrary: [
      { label: '亚洲女性', value: 'asian_female_body', tag: '日常上新', tone: 'tone-indigo', prompt: '亚洲女性全身AI模特，标准站姿，适合服装上新展示' },
      { label: '亚洲男性', value: 'asian_male_body', tag: '男装展示', tone: 'tone-blue', prompt: '亚洲男性全身AI模特，标准商业展示，适合男装商品图' },
      { label: '欧美女性', value: 'western_female_body', tag: '高级时尚', tone: 'tone-purple', prompt: '欧美女性全身AI模特，高级时尚氛围，适合品牌展示' },
      { label: '职业模特', value: 'professional_body', tag: '商业棚拍', tone: 'tone-cyan', prompt: '职业商业全身模特，标准棚拍姿态，适合主图和详情页' },
      { label: '运动模特', value: 'sport_body', tag: '活力健康', tone: 'tone-orange', prompt: '运动型全身模特，健康有活力，适合运动休闲服装' },
      { label: '街拍模特', value: 'street_body', tag: '自然街拍', tone: 'tone-slate', prompt: '街拍全身模特，自然松弛，适合社媒和生活方式展示' }
    ],
    paramGroups: []
  },
  {
    label: '换脸',
    value: 'face_replace',
    desc: '头部或脸部替换',
    focusTitle: '保留人物姿态，替换头部或脸部',
    focusDesc: '适合已有模特图，只调整人物头部、五官和气质。',
    taskType: 'model_replace',
    outputType: 'model_image',
    uploadTitle: '上传人物图片',
    uploadDesc: '上传需要换脸的人物图，建议脸部清晰、无遮挡。',
    referenceTitle: '上传AI人脸参考图',
    referenceDesc: '可选；不上传也可直接选择下方 AI 人脸库。',
    libraryTitle: 'AI人脸库',
    libraryType: 'face',
    referenceLibrary: [
      { label: '亚洲脸', value: 'asian_face', tag: '自然亲和', tone: 'tone-indigo', prompt: '亚洲脸参考，自然亲和，适合大众服装展示' },
      { label: '欧美脸', value: 'western_face', tag: '立体轮廓', tone: 'tone-purple', prompt: '欧美脸参考，轮廓立体，适合时尚品牌展示' },
      { label: '年轻', value: 'young_face', tag: '清爽活力', tone: 'tone-cyan', prompt: '年轻人脸参考，清爽有活力，适合新款上新' },
      { label: '成熟', value: 'mature_face', tag: '稳重气质', tone: 'tone-blue', prompt: '成熟人脸参考，稳重优雅，适合通勤和商务服装' },
      { label: '时尚', value: 'fashion_face', tag: '高级表现', tone: 'tone-slate', prompt: '时尚人脸参考，高级克制，适合杂志感视觉' }
    ],
    paramGroups: [
      {
        key: 'faceReplaceType',
        label: '替换方式',
        options: [
          { label: '头部替换', value: 'head_replace' },
          { label: '脸部替换', value: 'face_only_replace' }
        ]
      }
    ]
  },
  {
    label: '姿势裂变',
    value: 'pose_variation',
    desc: '同款生成多姿势',
    focusTitle: '同一服装和模特生成多个不同姿势图片',
    focusDesc: '适合基于一张人物图快速扩展电商展示动作。',
    taskType: 'pose_adjust',
    outputType: 'pose_adjust_image',
    uploadTitle: '上传人物图或模特图',
    uploadDesc: '上传已有模特图，建议身体姿态和服装主体清晰。',
    referenceTitle: '上传姿势参考图',
    referenceDesc: '可选；支持模特动作、杂志动作或品牌动作参考。',
    libraryTitle: '系统姿势库',
    libraryType: 'pose',
    referenceLibrary: [
      { label: '自然站姿', value: 'natural_stand', tag: '基础展示', tone: 'tone-indigo', prompt: '自然站姿动作参考，身体舒展，服装轮廓清晰' },
      { label: '走动展示', value: 'walking_show', tag: '动态展示', tone: 'tone-blue', prompt: '自然走动展示衣服，适合电商多姿态展示' },
      { label: '电商手势', value: 'ecommerce_gesture', tag: '主图友好', tone: 'tone-cyan', prompt: '电商展示手势，动作自然，突出服装细节' },
      { label: '杂志动作', value: 'magazine_pose', tag: '高级大片', tone: 'tone-purple', prompt: '高级杂志动作，克制时尚，适合品牌视觉' }
    ],
    paramGroups: [
      {
        key: 'poseGenerateCount',
        label: '生成数量',
        options: [
          { label: '2张', value: '2' },
          { label: '4张', value: '4' },
          { label: '6张', value: '6' }
        ]
      }
    ]
  },
  {
    label: '场景替换',
    value: 'scene_replace',
    desc: '替换拍摄场景',
    focusTitle: '保留服装和人物，生成不同场景展示图',
    focusDesc: '适合把已有模特图扩展成不同渠道的场景图。',
    taskType: 'scene_replace',
    outputType: 'scene_image',
    uploadTitle: '上传服装或模特图',
    uploadDesc: '上传服装或模特图，系统会按所选场景生成展示图。',
    referenceTitle: '上传场景参考图',
    referenceDesc: '可选；也可以直接选择系统场景库。',
    libraryTitle: '系统场景库',
    libraryType: 'scene',
    referenceLibrary: [
      { label: '街拍', value: 'scene_street', tag: '城市自然', tone: 'tone-blue', prompt: '街拍场景，自然光线，适合服装种草展示' },
      { label: '棚拍', value: 'scene_studio', tag: '干净主图', tone: 'tone-indigo', prompt: '棚拍场景，柔和光线，突出服装主体' },
      { label: '办公室', value: 'scene_office', tag: '通勤商务', tone: 'tone-cyan', prompt: '办公室场景，干净通勤氛围，适合职场服装展示' },
      { label: '咖啡厅', value: 'scene_cafe', tag: '生活方式', tone: 'tone-orange', prompt: '咖啡厅场景，生活方式氛围，自然松弛' },
      { label: '户外', value: 'scene_outdoor', tag: '自然环境', tone: 'tone-emerald', prompt: '户外自然环境，光线舒展，适合休闲服装展示' },
      { label: '商业空间', value: 'scene_commercial_space', tag: '高级商业', tone: 'tone-purple', prompt: '高级商业空间，品牌感强，适合营销视觉' }
    ],
    paramGroups: []
  }
]
const POSE_REFERENCE_TYPES = [
  { label: '模特动作参考', value: 'model_action' },
  { label: '杂志动作参考', value: 'magazine_action' },
  { label: '品牌动作参考', value: 'brand_action' }
]

const SCENE_REFERENCE_LIBRARY = [
  { label: '街拍', value: 'scene_street', tag: '城市自然', tone: 'tone-blue', prompt: '街拍场景，自然光线，适合服装种草展示' },
  { label: '棚拍', value: 'scene_studio', tag: '干净主图', tone: 'tone-indigo', prompt: '棚拍场景，柔和光线，突出服装主体' },
  { label: '办公室', value: 'scene_office', tag: '通勤商务', tone: 'tone-cyan', prompt: '办公室场景，干净通勤氛围，适合职场服装展示' },
  { label: '咖啡厅', value: 'scene_cafe', tag: '生活方式', tone: 'tone-orange', prompt: '咖啡厅场景，生活方式氛围，自然松弛' },
  { label: '户外', value: 'scene_outdoor', tag: '自然环境', tone: 'tone-emerald', prompt: '户外自然环境，光线舒展，适合休闲服装展示' },
  { label: '高级空间', value: 'scene_premium_space', tag: '品牌商业', tone: 'tone-purple', prompt: '高级商业空间，品牌感强，适合营销视觉' }
]

const SCENE_QUICK_TEMPLATES = [
  { label: '街拍', value: 'scene_street', tone: 'tone-blue', prompt: '城市街拍环境，自然光线，人物与街道透视和光影一致' },
  { label: '摄影棚', value: 'scene_studio', tone: 'tone-indigo', prompt: '专业摄影棚环境，柔和布光，背景干净，突出服装主体' },
  { label: '高级展厅', value: 'scene_premium_space', tone: 'tone-purple', prompt: '高级品牌展厅环境，空间简洁，材质精致，商业光线自然' },
  { label: '自然户外', value: 'scene_outdoor', tone: 'tone-emerald', prompt: '自然户外环境，光线舒展，人物与环境比例和透视自然' },
  { label: '极简家居', value: 'scene_minimal_home', tone: 'tone-orange', prompt: '极简浅色家居环境，木地板与柔和自然光，空间干净舒适' },
  { label: '品牌店铺', value: 'scene_brand_store', tone: 'tone-cyan', prompt: '现代品牌店铺环境，陈列克制，空间具有商业展示质感' }
]

const SCENE_TEMPLATE_TONES = ['tone-indigo', 'tone-purple', 'tone-orange', 'tone-cyan', 'tone-blue', 'tone-slate', 'tone-emerald']
const existingSystemScenes = typeof getSystemScenes === 'function' ? getSystemScenes() : []
const systemSceneSeeds = existingSystemScenes.length
  ? existingSystemScenes.slice(0, 7)
  : SCENE_QUICK_TEMPLATES.slice(0, 7).map((scene) => ({
    sceneId: scene.value,
    name: scene.label,
    coverUrl: '',
    styleTags: [],
    prompt: scene.prompt
  }))
const SCENE_SYSTEM_TEMPLATES = [
  {
    label: '智能背景',
    value: 'scene_smart_auto',
    tone: 'tone-indigo',
    description: '自动匹配服装风格',
    prompt: '根据服装风格、品类和色彩自动匹配适合商品展示的商业背景，保持人物与服装主体清晰'
  },
  ...systemSceneSeeds.map((scene, index) => ({
    label: scene.name,
    value: scene.sceneId,
    tone: SCENE_TEMPLATE_TONES[index % SCENE_TEMPLATE_TONES.length],
    description: scene.styleTags.slice(0, 2).join(' · '),
    previewUrl: scene.coverUrl,
    prompt: scene.prompt
  }))
]

const MODEL_QUICK_PLANS = [
  { label: '快速换脸', value: 'quick_face', desc: '仅替换人脸', features: ['face_replace'] },
  { label: '模特升级', value: 'model_upgrade', desc: '模特展示 + 换脸', features: ['model_display', 'face_replace'] },
  { label: '商业大片', value: 'campaign_shoot', desc: '四项能力完整组合', features: ['model_display', 'face_replace', 'pose_variation', 'scene_replace'] },
  { label: '电商详情图', value: 'detail_model_set', desc: '展示 + 姿势 + 场景', features: ['model_display', 'scene_replace', 'pose_variation'] }
]

const MODEL_DISPLAY_REFERENCES = [
  { label: '亚洲女性', value: 'asian_female_body', tag: '日常上新', tone: 'tone-indigo', prompt: '亚洲女性全身AI模特，标准上身展示，适合服装上新' },
  { label: '亚洲男性', value: 'asian_male_body', tag: '男装展示', tone: 'tone-blue', prompt: '亚洲男性全身AI模特，适合男装商品图' },
  { label: '欧美女性', value: 'western_female_body', tag: '高级时尚', tone: 'tone-purple', prompt: '欧美女性全身AI模特，高级时尚氛围' },
  { label: '职业模特', value: 'professional_body', tag: '商业棚拍', tone: 'tone-cyan', prompt: '职业商业全身AI模特，适合主图和详情页' },
  { label: '潮流模特', value: 'trend_body', tag: '社媒风格', tone: 'tone-orange', prompt: '潮流全身模特，适合社媒和年轻化展示' }
]

const FACE_REPLACE_REFERENCES = [
  { label: '年轻女性', value: 'young_female_face', tag: '清爽自然', tone: 'tone-cyan', prompt: '年轻女性人脸参考，清爽自然，适合女装上新' },
  { label: '成熟女性', value: 'mature_female_face', tag: '稳重气质', tone: 'tone-purple', prompt: '成熟女性人脸参考，稳重优雅，适合通勤风格' },
  { label: '男性', value: 'male_face', tag: '利落商业', tone: 'tone-blue', prompt: '男性人脸参考，利落商业，适合男装展示' },
  { label: '商业头像', value: 'commercial_face', tag: '品牌视觉', tone: 'tone-slate', prompt: '商业头像参考，高级克制，适合品牌视觉' }
]

const POSE_VARIATION_REFERENCES = [
  { label: '站姿', value: 'natural_stand', tag: '基础展示', tone: 'tone-indigo', prompt: '自然站姿动作参考，身体舒展，服装轮廓清晰' },
  { label: '走姿', value: 'walking_show', tag: '动态展示', tone: 'tone-blue', prompt: '自然走动展示衣服，适合多姿态展示' },
  { label: '坐姿', value: 'sitting_pose', tag: '生活方式', tone: 'tone-cyan', prompt: '坐姿展示，轻松自然，适合生活方式图片' },
  { label: '转身', value: 'turning_pose', tag: '多角度', tone: 'tone-purple', prompt: '转身姿势，展示侧面和背面服装细节' },
  { label: '展示动作', value: 'display_gesture', tag: '电商友好', tone: 'tone-orange', prompt: '电商展示动作，突出服装卖点' },
  { label: '杂志动作', value: 'magazine_pose', tag: '高级大片', tone: 'tone-slate', prompt: '高级杂志动作，适合品牌视觉大片' }
]

const REDESIGN_TOOL_TYPES = ['refine', 'style', 'color', 'fabric', 'pattern', 'style_redesign']

const COLOR_SELECTION_METHODS = [
  { label: '系统颜色', value: 'system' },
  { label: '吸管取色', value: 'eyedropper' },
  { label: '最近使用', value: 'recent' }
]

const COLOR_EYEDROPPER_SOURCES = [
  { label: '当前服装图', value: 'garment' },
  { label: '上传取色图片', value: 'uploaded' }
]

const COLOR_TARGET_AREAS = [
  { label: '整件服装', value: 'whole_garment' },
  { label: '上衣', value: 'top' },
  { label: '下装', value: 'bottom' },
  { label: '袖子', value: 'sleeve' },
  { label: '领口', value: 'collar' }
]

const FABRIC_TARGET_AREAS = [
  { label: '整体服装', value: 'whole_garment' },
  { label: '上衣', value: 'top' },
  { label: '裤子', value: 'pants' },
  { label: '袖子', value: 'sleeve' },
  { label: '袖口', value: 'cuff' },
  { label: '领口', value: 'collar' },
  { label: '局部', value: 'partial' }
]

const TEXTURE_RETENTION_OPTIONS = [
  { label: '强保留', value: 'strong', desc: '最大程度保留原面料纹理' },
  { label: '标准保留', value: 'standard', desc: '平衡颜色替换与纹理表现' },
  { label: '轻微重绘', value: 'light_redraw', desc: '允许模型优化面料细节' }
]

const FABRIC_REFERENCE_OPTIONS = [
  { label: '棉', value: 'cotton', desc: '柔软自然', weave: 'fine_plain', textureScale: 'fine', roughness: 'medium', sheen: 'matte', drape: 'natural', transparency: 'opaque', elasticity: 'low', textureStrength: 'subtle', prompt: '替换成棉质面料，使用细密平纹、哑光表面和自然轻褶皱；禁止污点、做旧、斑驳和随机印花' },
  { label: '麻', value: 'linen', desc: '透气肌理', weave: 'fine_slub_plain', textureScale: 'fine', roughness: 'medium_high', sheen: 'matte', drape: 'natural_crisp', transparency: 'low', elasticity: 'low', textureStrength: 'medium', prompt: '替换成棉麻质感，使用细密平纹和轻微竹节，保持哑光与自然轻褶皱；禁止污点、做旧、斑驳和随机印花' },
  { label: '牛仔', value: 'denim', desc: '硬挺纹理', weave: 'diagonal_twill', textureScale: 'fine', roughness: 'medium', sheen: 'low', drape: 'structured', transparency: 'opaque', elasticity: 'low', textureStrength: 'medium', prompt: '替换成牛仔材质，使用清晰细密斜纹和中等硬挺质感；禁止随机破洞、做旧和污渍' },
  { label: '针织', value: 'knit', desc: '柔软弹性', weave: 'fine_knit', textureScale: 'fine', roughness: 'soft', sheen: 'low', drape: 'soft', transparency: 'opaque', elasticity: 'medium_high', textureStrength: 'medium', prompt: '替换成针织材质，使用细致针织组织并让纹理跟随曲面；禁止放大成粗糙毛线' },
  { label: '真丝', value: 'silk', desc: '光泽垂坠', weave: 'fine_satin', textureScale: 'very_fine', roughness: 'low', sheen: 'directional_soft', drape: 'fluid', transparency: 'low', elasticity: 'low', textureStrength: 'subtle', prompt: '替换成真丝质感，使用柔和方向性光泽、细腻表面和流动垂坠；禁止塑料反光' },
  { label: '雪纺', value: 'chiffon', desc: '轻盈飘逸', prompt: '替换成雪纺面料，保持原版型，呈现轻薄通透和自然垂感' },
  { label: '皮质', value: 'leather', desc: '光泽质感', prompt: '替换成皮质面料，保持原结构，增加皮革纹理和光泽' },
  { label: '羊毛', value: 'wool', desc: '高级保暖', prompt: '替换成羊毛或毛呢质感，保持原版型，增强厚度和暖感' }
]

const PATTERN_REFERENCE_OPTIONS = [
  { label: '印花', value: 'print', desc: '商业图案', prompt: '添加商业印花图案，保持位置和边缘自然' },
  { label: '条纹', value: 'stripe', desc: '线条延展', prompt: '替换为条纹图案，保持线条随服装结构自然变化' },
  { label: '格纹', value: 'check', desc: '经典格纹', prompt: '替换为格纹图案，保持服装褶皱和透视关系' },
  { label: '碎花', value: 'floral', desc: '细密花型', prompt: '替换为细密碎花图案，控制花型与服装结构自然贴合' },
  { label: '几何', value: 'geometric', desc: '现代图形', prompt: '替换为现代几何纹样，保持图形比例和服装透视自然' },
  { label: '字母', value: 'lettering', desc: '字母纹样', prompt: '添加字母纹样，保持排版清晰并随服装结构自然变化' },
  { label: 'LOGO', value: 'logo', desc: '品牌标识', prompt: '添加或替换LOGO图案，保持位置自然和边缘清晰' },
  { label: '自定义图案', value: 'custom', desc: '上传参考', prompt: '使用用户上传的自定义图案，保持服装褶皱、透视和边缘自然' }
]

const PATTERN_POSITION_OPTIONS = [
  { label: '胸口', value: 'chest' },
  { label: '袖口', value: 'cuff' },
  { label: '前片', value: 'front_panel' },
  { label: '后背', value: 'back' },
  { label: '整件覆盖', value: 'full_cover' }
]

const STYLE_FIT_OPTIONS = [
  { label: '修身', value: 'slim' },
  { label: '宽松', value: 'loose' },
  { label: '短款', value: 'cropped' },
  { label: '长款', value: 'long' }
]

const STYLE_MODIFICATION_MODES = [
  { label: '微改款', value: 'micro_change' },
  { label: '爆款衍生', value: 'hot_style_variant' },
  { label: '结构优化', value: 'structure_refine' }
]

const STYLE_OUTPUT_COUNT_OPTIONS = [1, 2, 4, 8]

const STYLE_WIZARD_STEPS = Object.freeze([
  { value: 1, label: '上传原款' },
  { value: 2, label: '选择改动' },
  { value: 3, label: '设计方向' },
  { value: 4, label: '确认生成' }
])

const STYLE_CHANGE_TARGETS = Object.freeze([
  { label: '领口', value: 'neckline', directions: ['圆领', 'V领', '方领', '翻领', '一字领'] },
  { label: '袖型', value: 'sleeve', directions: ['短袖', '长袖', '无袖', '泡泡袖', '落肩袖'] },
  { label: '肩部', value: 'shoulder', directions: ['标准肩', '落肩', '插肩', '挺括肩线'] },
  { label: '衣身版型', value: 'body_fit', directions: ['修身', '标准', '宽松', 'A型', '直筒'] },
  { label: '衣长', value: 'garment_length', directions: ['短款', '常规', '中长', '长款'] },
  { label: '门襟', value: 'placket', directions: ['无门襟', '单排扣', '双排扣', '拉链门襟', '隐藏门襟'] },
  { label: '口袋', value: 'pocket', directions: ['无口袋', '贴袋', '插袋', '翻盖袋', '立体袋'] },
  { label: '下摆', value: 'hem', directions: ['平直下摆', '圆弧下摆', '不对称下摆', '收口下摆'] },
  { label: '装饰细节', value: 'decoration', directions: ['褶皱', '荷叶边', '绑带', '拼接', '明线装饰'] },
  { label: '整体廓形', value: 'silhouette', directions: ['H型', 'A型', 'X型', 'O型', '茧型'] }
])

const STYLE_CHANGE_INTENSITIES = Object.freeze([
  { label: '微调优化', value: 'minor', legacyValue: 'micro_change' },
  { label: '明显改款', value: 'major', legacyValue: 'hot_style_variant' },
  { label: '结构重设计', value: 'structural', legacyValue: 'structure_refine' }
])

const STYLE_DESIGN_PURPOSES = Object.freeze([
  { label: '日常穿着', value: 'daily_wear' },
  { label: '电商上新', value: 'ecommerce_launch' },
  { label: '小红书展示', value: 'xiaohongshu' },
  { label: '营销主推款', value: 'campaign_focus' }
])

const STYLE_PRESERVE_OPTIONS = Object.freeze([
  { label: '保留原服装主体', value: 'garment_subject' },
  { label: '保留原颜色', value: 'color' },
  { label: '保留原面料质感', value: 'fabric' },
  { label: '保留原图案', value: 'pattern' },
  { label: '保留模特与姿势', value: 'model_pose' },
  { label: '保留背景和构图', value: 'background_composition' }
])

const STYLE_REFERENCE_SOURCE_TABS = [
  { label: '系统参考图', value: 'system' },
  { label: '我的参考图', value: 'mine' },
  { label: '上传参考图', value: 'upload' }
]

const STYLE_AI_PLAN_OPTIONS = [
  { label: '更年轻', value: 'younger', prompt: '保留原款核心结构，优化服装比例和局部细节，使整体更年轻、轻盈。' },
  { label: '更显瘦', value: 'slimmer', prompt: '保持原款识别度，优化腰线、纵向结构和廓形比例。' },
  { label: '高级感', value: 'premium', prompt: '减少多余装饰，强化廓形、面料质感和精致细节。' },
  { label: '适合电商', value: 'ecommerce', prompt: '保留服装卖点，优化版型和细节表达，适合电商主图和详情页。' },
  { label: '适合小红书', value: 'xiaohongshu', prompt: '优化服装比例、色彩和细节，增加生活方式感。' },
  { label: '增加销量感', value: 'sales_driven', prompt: '突出服装核心卖点，优化领口、袖型、腰线与细节。' }
]
const FACE_REPLACE_TYPE_OPTIONS = [
  { label: '头部替换', value: 'head_replace' },
  { label: '脸部替换', value: 'face_only_replace' }
]

const MARKETING_TYPES = [
  { label: '系列图', value: 'series', desc: '统一风格生成多张宣传图' },
  { label: '海报', value: 'poster', desc: '生成活动或上新海报视觉' },
  { label: '详情页素材', value: 'detail_page', desc: '按电商顺序生成详情页素材' }
]

const PAGE_MATERIAL_TYPES = [
  { label: '主图', value: 'main_image', desc: '第一屏商品展示' },
  { label: '卖点图', value: 'selling_point', desc: '核心卖点概览' },
  { label: '细节图', value: 'detail_image', desc: '面料工艺局部放大' },
  { label: '面料图', value: 'fabric_image', desc: '材质和触感说明' },
  { label: '尺寸图', value: 'size_chart', desc: '尺码信息展示' },
  { label: '场景图', value: 'scene_image', desc: '生活方式或商业场景' }
]

const DETAIL_GENERATION_MODULES = [
  { label: '商品主图', value: 'main_image', desc: '商品核心展示图', legacyTypes: ['main_image'] },
  { label: '穿搭场景图', value: 'outfit_scene', desc: '真人 / 场景展示', legacyTypes: ['scene_image'] },
  { label: '细节展示图', value: 'detail_image', desc: '面料、工艺、领口、袖口', legacyTypes: ['detail_image'] },
  { label: '卖点信息图', value: 'selling_point', desc: '设计亮点、材质优势', legacyTypes: ['selling_point'] },
  { label: '平铺展示图', value: 'flat_display', desc: '正反面商品展示', legacyTypes: ['flat_display'] },
  { label: '商品基础信息', value: 'basic_info', desc: '款号、颜色、面料、尺寸', legacyTypes: ['fabric_image', 'size_chart'] }
]

const STANDARD_DETAIL_MODULES = [
  { label: '商品主图', value: 'product_main', legacyTypes: ['main_image'] },
  { label: '卖点介绍', value: 'selling_intro', legacyTypes: ['selling_point'] },
  { label: '模特展示', value: 'model_display', legacyTypes: ['model_image'] },
  { label: '场景展示', value: 'scene_display', legacyTypes: ['scene_image'] },
  { label: '细节展示', value: 'detail_display', legacyTypes: ['detail_image'] },
  { label: '面料说明', value: 'fabric_info', legacyTypes: ['fabric_image'] },
  { label: '尺寸表', value: 'size_table', legacyTypes: ['size_chart'] },
  { label: '洗护说明', value: 'care_instructions', legacyTypes: ['care_instructions'] },
  { label: '品牌介绍', value: 'brand_intro', legacyTypes: ['brand_intro'] },
  { label: '搭配建议', value: 'styling_advice', legacyTypes: ['styling_advice'] }
]

const DETAIL_OUTPUT_ORDER = ['主图', '卖点', '场景', '细节', '面料', '尺寸', '洗护', '品牌']
const PACKAGE_DETAIL_STRUCTURE = ['商品主图', '卖点', '场景', '细节', '面料', '尺寸', '搭配']

const DETAIL_QUICK_TEMPLATES = [
  {
    label: '电商上新模板',
    value: 'ecommerce_launch',
    desc: '主图、卖点、场景和商品信息完整覆盖',
    detailModules: ['main_image', 'selling_point', 'outfit_scene', 'detail_image', 'flat_display', 'basic_info'],
    standardDetailModules: ['product_main', 'selling_intro', 'model_display', 'scene_display', 'detail_display', 'fabric_info', 'size_table', 'care_instructions']
  },
  {
    label: '小红书种草模板',
    value: 'social_seed',
    desc: '突出穿搭氛围、使用场景和内容卖点',
    detailModules: ['main_image', 'outfit_scene', 'detail_image', 'selling_point'],
    standardDetailModules: ['product_main', 'selling_intro', 'model_display', 'scene_display', 'detail_display', 'styling_advice']
  },
  {
    label: '品牌官网模板',
    value: 'brand_website',
    desc: '强化品牌表达、材质细节和系列质感',
    detailModules: ['main_image', 'outfit_scene', 'detail_image', 'flat_display', 'basic_info'],
    standardDetailModules: ['product_main', 'model_display', 'scene_display', 'detail_display', 'fabric_info', 'brand_intro', 'styling_advice']
  }
]

const POSTER_TYPES = [
  { label: '新品上市', value: 'new_arrival' },
  { label: '活动促销', value: 'promotion' },
  { label: '品牌宣传', value: 'brand_campaign' },
  { label: '小红书种草', value: 'xiaohongshu_seed' }
]

const SERIES_TYPES = [
  { label: '新品发布', value: 'new_launch' },
  { label: '模特大片', value: 'model_campaign' },
  { label: '电商套图', value: 'ecommerce_set' },
  { label: '品牌系列', value: 'brand_series' }
]

const SYSTEM_COLOR_GROUPS = getColorGroups()
  .map((group) => ({
    ...group,
    colors: group.colors.map((color) => normalizeStandardColor(color, 'system')).filter(Boolean)
  }))

const REDESIGN_CONFIGS = {
  style: {
    displayName: '款式',
    description: '上传原款图片，组合参考设计与改款方式，生成专业改款方案。',
    taskType: 'micro_redesign',
    outputType: 'style_refine',
    paramTitle: '专业改款设置',
    paramTip: '依次确认参考设计、改款方式、设计描述和方案数量。',
    referenceLibrary: [
      { label: '通勤风', value: 'commute', mark: '勤', desc: '简洁日常', tone: 'tone-blue', prompt: '通勤风格，简洁利落，保留原服装结构并轻微优化' },
      { label: '韩系', value: 'korean', mark: '韩', desc: '柔和清爽', tone: 'tone-cyan', prompt: '韩系轻设计风格，比例清爽，细节柔和' },
      { label: '高级感', value: 'premium', mark: '高', desc: '质感升级', tone: 'tone-purple', prompt: '高级感款式方向，版型更利落，材质和细节更精致' },
      { label: '运动风', value: 'sport', mark: '动', desc: '活力机能', tone: 'tone-orange', prompt: '运动休闲风格，增加轻机能感和舒适版型' },
      { label: '国潮', value: 'chinese_trend', mark: '潮', desc: '东方新意', tone: 'tone-red', prompt: '国潮设计方向，加入克制东方元素和现代版型' },
      { label: '小香风', value: 'tweed', mark: '香', desc: '精致短款', tone: 'tone-pink', prompt: '小香风方向，精致短款比例，边缘和面料细节更讲究' },
      { label: '极简', value: 'minimal', mark: '简', desc: '干净廓形', tone: 'tone-slate', prompt: '极简设计方向，减少多余装饰，强调干净廓形' }
    ],
    paramGroups: []
  },
  color: {
    displayName: '颜色',
    description: '上传服装图片，选择目标颜色，快速生成换色效果。',
    taskType: 'color_replace',
    outputType: 'color_variation',
    paramTitle: '选择颜色',
    paramTip: '选择一个常用颜色或自定义颜色方向。',
    referenceLibrary: [],
    paramGroups: []
  },
  fabric: {
    displayName: '面料',
    description: '上传服装图片，选择替换区域和目标面料，快速预览材质效果。',
    taskType: 'fabric_replace',
    outputType: 'fabric_variation',
    paramTitle: '选择面料',
    paramTip: '选择想尝试的材质和面料质感。',
    referenceLibrary: FABRIC_REFERENCE_OPTIONS,
    paramGroups: []
  },
  pattern: {
    displayName: '图案',
    description: '上传服装图片，选择图案和应用位置，快速预览设计效果。',
    taskType: 'pattern_replace',
    outputType: 'pattern_variation',
    paramTitle: '选择图案',
    paramTip: '选择希望尝试的图案或工艺方向。',
    referenceLibrary: PATTERN_REFERENCE_OPTIONS,
    paramGroups: []
  }
}

const DISPLAY_TABS = [
  { label: '平铺图', value: 'flat_lay' },
  { label: '3D图', value: '3d_display' },
  { label: '挂拍图', value: 'hanging_photo' },
  { label: '人台图', value: 'mannequin' },
  { label: '细节图', value: 'detail_photo' }
]

const DISPLAY_TOOL_TYPES = DISPLAY_TABS.map((item) => item.value)

const DISPLAY_MODE_PARAM_VALUES = {
  flat_lay: 'flat_lay',
  '3d_display': '3d_display',
  hanging_photo: 'hanging_photo',
  mannequin: 'mannequin',
  detail_photo: 'detail_photo'
}

const DETAIL_REFERENCE_CATEGORIES = [
  { label: '全部', value: 'all' },
  { label: '面料', value: 'fabric' },
  { label: '上衣', value: 'top' },
  { label: '下装', value: 'bottom' },
  { label: '工艺', value: 'craft' },
  { label: '装饰', value: 'decoration' }
]

const DETAIL_REFERENCE_GROUPS = [
  { category: 'fabric', categoryName: '面料', items: [
    { label: '棉', value: 'cotton', mark: '棉', tone: 'tone-blue', prompt: '棉质面料局部细节，纹理自然清晰，适合详情页展示' },
    { label: '麻', value: 'linen', mark: '麻', tone: 'tone-cyan', prompt: '麻质面料局部细节，纤维纹理清晰，质感自然' },
    { label: '丝绸', value: 'silk', mark: '丝', tone: 'tone-purple', prompt: '丝绸面料局部细节，柔和光泽和顺滑垂感清晰' },
    { label: '羊毛', value: 'wool', mark: '毛', tone: 'tone-slate', prompt: '羊毛面料局部细节，毛感和厚度清晰' },
    { label: '针织', value: 'knit', mark: '针', tone: 'tone-orange', prompt: '针织面料局部细节，针脚和纹理清晰' },
    { label: '牛仔', value: 'denim', mark: '牛', tone: 'tone-blue', prompt: '牛仔面料局部细节，斜纹和水洗纹理清晰' },
    { label: '皮革', value: 'leather', mark: '皮', tone: 'tone-slate', prompt: '皮革面料局部细节，光泽和纹理清晰' },
    { label: '蕾丝', value: 'lace', mark: '蕾', tone: 'tone-pink', prompt: '蕾丝面料局部细节，花纹和层次清晰' }
  ] },
  { category: 'top', categoryName: '上衣', items: [
    { label: '领口', value: 'collar', mark: '领', tone: 'tone-indigo', prompt: '领口局部细节，结构、车线和面料纹理清晰' },
    { label: '袖口', value: 'cuff', mark: '袖', tone: 'tone-blue', prompt: '袖口局部细节，收口结构、面料纹理和工艺清晰' },
    { label: '肩部', value: 'shoulder', mark: '肩', tone: 'tone-cyan', prompt: '肩部局部细节，肩线和结构比例清晰' },
    { label: '纽扣', value: 'button', mark: '扣', tone: 'tone-orange', prompt: '纽扣局部细节，材质、光泽和缝合位置清晰' },
    { label: '拉链', value: 'zipper', mark: '链', tone: 'tone-purple', prompt: '拉链局部细节，齿链、拉头和缝合位置清晰' }
  ] },
  { category: 'bottom', categoryName: '下装', items: [
    { label: '裤腰', value: 'waistband', mark: '腰', tone: 'tone-indigo', prompt: '裤腰局部细节，腰头结构、扣位和线迹清晰' },
    { label: '裤袋', value: 'pocket', mark: '袋', tone: 'tone-blue', prompt: '裤袋局部细节，袋口结构和车线清晰' },
    { label: '裤脚', value: 'hem', mark: '脚', tone: 'tone-slate', prompt: '裤脚局部细节，边缘、压线和面料垂感清晰' },
    { label: '裙摆', value: 'skirt_hem', mark: '摆', tone: 'tone-pink', prompt: '裙摆局部细节，摆量、边缘和面料层次清晰' }
  ] },
  { category: 'craft', categoryName: '工艺', items: [
    { label: '车线', value: 'stitching', mark: '线', tone: 'tone-indigo', prompt: '车线工艺局部细节，线迹整齐清晰' },
    { label: '包边', value: 'binding', mark: '边', tone: 'tone-blue', prompt: '包边工艺局部细节，边缘处理清晰' },
    { label: '压线', value: 'topstitch', mark: '压', tone: 'tone-cyan', prompt: '压线工艺局部细节，线迹和结构清晰' },
    { label: '锁边', value: 'overlock', mark: '锁', tone: 'tone-purple', prompt: '锁边工艺局部细节，边缘线迹清晰' },
    { label: '金属扣', value: 'metal_button', mark: '扣', tone: 'tone-orange', prompt: '金属扣局部细节，材质光泽和固定结构清晰' }
  ] },
  { category: 'decoration', categoryName: '装饰', items: [
    { label: '珠片', value: 'beading', mark: '珠', tone: 'tone-pink', prompt: '珠片装饰局部细节，立体感和固定线迹清晰' },
    { label: '蕾丝边', value: 'lace_trim', mark: '蕾', tone: 'tone-red', prompt: '蕾丝边装饰局部细节，边缘花纹和层次清晰' },
    { label: '腰带', value: 'belt', mark: '带', tone: 'tone-orange', prompt: '腰带装饰局部细节，扣件、材质和穿插结构清晰' },
    { label: 'Logo', value: 'logo_detail', mark: '标', tone: 'tone-blue', prompt: 'Logo装饰局部细节，标识边缘、材质和位置清晰' }
  ] }
]

const DETAIL_REFERENCE_OPTIONS = DETAIL_REFERENCE_GROUPS.flatMap((group) =>
  group.items.map((item) => ({ ...item, category: group.category, categoryName: group.categoryName }))
)

const COMMON_DETAIL_PART_VALUES = ['collar', 'cuff', 'button', 'zipper', 'stitching', 'pocket', 'skirt_hem', 'logo_detail']

const DISPLAY_CONFIGS = {
  flat_lay: {
    displayName: '平铺图',
    description: '上传服装图，选择背景风格和比例，生成干净商品展示图。',
    taskType: 'flat_lay_generate',
    outputType: 'flat_lay_image',
    paramTitle: '选择背景风格和比例',
    paramTip: '适合电商上架、系列款展示和基础商品图。',
    paramGroups: [
      { key: 'backgroundType', label: '背景风格', options: [
        { label: '白底', value: 'white_bg' },
        { label: '棚拍', value: 'studio' },
        { label: '杂志', value: 'magazine' },
        { label: '品牌展示', value: 'brand_display' }
      ] },
      { key: 'imageRatio', label: '图片比例', options: [
        { label: '1:1', value: '1_1' },
        { label: '3:4', value: '3_4' },
        { label: '4:5', value: '4_5' }
      ] }
    ]
  },
  '3d_display': {
    displayName: '3D图',
    description: '上传服装图，选择展示方向，生成更有体积感的服装展示图。',
    taskType: 'display_3d_generate',
    outputType: 'display_3d_image',
    paramTitle: '选择展示方式',
    paramTip: '适合展示服装正侧背和完整结构。',
    paramGroups: [
      { key: 'displayDirection', label: '展示方式', options: [
        { label: '正面', value: 'front' },
        { label: '侧面', value: 'side' },
        { label: '背面', value: 'back' },
        { label: '360', value: '360' }
      ] }
    ]
  },
  hanging_photo: {
    displayName: '挂拍图',
    description: '上传服装图，选择衣架类型和场景，生成挂拍展示素材。',
    taskType: 'hanging_photo_generate',
    outputType: 'hanging_photo_image',
    paramTitle: '选择衣架类型和场景',
    paramTip: '适合店铺陈列、上新列表和商品展示。',
    paramGroups: [
      { key: 'hangerType', label: '衣架类型', options: [
        { label: '木质衣架', value: 'wood_hanger' },
        { label: '金属衣架', value: 'metal_hanger' },
        { label: '隐形衣架', value: 'invisible_hanger' }
      ] },
      { key: 'hangingScene', label: '场景', options: [
        { label: '衣帽间', value: 'closet' },
        { label: '工作室', value: 'studio' },
        { label: '品牌墙', value: 'brand_wall' }
      ] }
    ]
  },
  mannequin: {
    displayName: '人台图',
    description: '上传服装图，选择人台类型，生成稳定的人台展示图。',
    taskType: 'mannequin_generate',
    outputType: 'mannequin_image',
    paramTitle: '选择人台类型',
    paramTip: '适合突出版型、长度和穿着轮廓。',
    paramGroups: [
      { key: 'mannequinType', label: '人台类型', options: [
        { label: '白色人台', value: 'white_mannequin' },
        { label: '透明人台', value: 'transparent_mannequin' },
        { label: '专业展示架', value: 'display_stand' }
      ] }
    ]
  },
  detail_photo: {
    displayName: '细节图',
    description: '上传服装图，选择细节区域，生成局部放大展示素材。',
    taskType: 'detail_photo_generate',
    outputType: 'detail_photo_image',
    paramTitle: '选择细节区域',
    paramTip: '适合详情页中展示面料、工艺和辅料细节。',
    paramGroups: []
  }
}

const TOOL_CONFIGS = {
  model: {
    title: 'AI模特',
    description: '上传图片，选择模特展示、人脸替换、姿势裂变或场景替换。',
    uploadTitle: '上传图片',
    uploadDesc: '根据当前模式上传服装图、人物图或模特图。',
    taskType: 'model_replace',
    outputType: 'model_image',
    paramTitle: '选择AI模特模式',
    paramTip: '选择一个模式，再选择对应参考库即可生成。',
    referenceLibrary: [],
    paramGroups: []
  },
  marketing: {
    title: '宣传详情页',
    description: '上传一件服装，生成系列图、海报和详情页素材。',
    uploadTitle: '上传服装图片',
    uploadDesc: '上传清晰服装图，系统会按所选素材类型组织生成参数。',
    taskType: 'marketing_asset',
    outputType: 'marketing_assets',
    paramTitle: '选择宣传素材',
    paramTip: '可多选系列图、海报和详情页素材，适合快速准备电商宣传内容。',
    referenceLibrary: [],
    paramGroups: []
  }
}

const createRedesignToolConfig = (redesignType = 'style') => {
  const config = REDESIGN_CONFIGS[redesignType] || REDESIGN_CONFIGS.style
  const isStyleRedesign = redesignType === 'style'
  const titleMap = {
    style: '改款式',
    color: '换颜色',
    fabric: '换面料',
    pattern: '换图案'
  }
  const descriptionMap = {
    style: '明确选择改动部位和目标方向，在保留原款关键内容的基础上生成新方案。',
    color: config.description,
    fabric: '上传服装图片，选择替换区域和目标面料，快速预览材质效果。',
    pattern: '上传服装图片，选择图案和应用位置，快速预览设计效果。'
  }
  return {
    title: titleMap[redesignType] || '改款式',
    description: descriptionMap[redesignType] || config.description,
    uploadTitle: isStyleRedesign ? '上传原款图片' : '上传服装图',
    uploadDesc: isStyleRedesign
      ? '上传一张清晰原款图片，系统会在保留主体结构的基础上生成改款方案。'
      : '支持服装图片、真人展示图。',
    taskType: config.taskType,
    outputType: config.outputType,
    paramTitle: config.paramTitle,
    paramTip: config.paramTip,
    referenceLibrary: config.referenceLibrary || [],
    paramGroups: config.paramGroups || [],
    redesignType,
    redesignTypeName: config.displayName
  }
}

const createDisplayToolConfig = (displayType = 'flat_lay') => {
  const config = DISPLAY_CONFIGS[displayType] || DISPLAY_CONFIGS.flat_lay
  const isDetail = displayType === 'detail_photo'
  return {
    title: isDetail ? '服装细节图' : '服装展示图',
    description: isDetail
      ? '上传服装图片，选择细节部位，生成面料、工艺和辅料特写。'
      : '上传服装图片，选择展示方式和背景，生成干净专业的商品展示图。',
    uploadTitle: '上传服装图',
    uploadDesc: '上传一张清晰服装图片，用来生成不同展示方式的商品图。',
    taskType: config.taskType,
    outputType: config.outputType,
    paramTitle: config.paramTitle,
    paramTip: config.paramTip,
    referenceLibrary: [],
    paramGroups: config.paramGroups || [],
    displayType,
    displayTypeName: config.displayName
  }
}
export default {
  components: {
    AiFeatureHeader,
    GenerationActionBar,
    ColorPickerCanvas,
    CustomColorPicker,
    ColorQuickPreview
  },
  data() {
    return {
      toolType: 'model',
      runtimeConfigRevision: 0,
      garmentReplaceMode: GARMENT_REPLACE_MODES.FULL_OUTFIT,
      garmentCurrentStep: 1,
      garmentPersonSource: 'upload',
      garmentUploadedPersonImage: '',
      garmentSelectedModelProfileId: '',
      garmentPersonImage: '',
      garmentUpperImage: '',
      garmentLowerImage: '',
      garmentOutfitImage: '',
      garmentUploadStatus: { person: 'empty', upper: 'empty', lower: 'empty', outfit: 'empty' },
      garmentUploadErrors: { person: '', upper: '', lower: '', outfit: '' },
      garmentAccessoryType: 'shoes',
      garmentSelectedAccessoryTypes: [],
      garmentAccessories: [],
      garmentAccessoryLibrary: [],
      garmentAccessoryUploadStatus: {},
      garmentAccessoryUploadErrors: {},
      garmentAdvancedPreserveExpanded: false,
      garmentPreserve: {
        preservePerson: true,
        preservePose: true,
        preserveBackground: true,
        preserveUnchangedGarment: true
      },
      garmentSubmissionStatus: 'idle',
      garmentSubmissionError: '',
      garmentCreatedTaskId: '',
      activeRedesignType: 'style',
      selectedRedesignTypes: ['style'],
      activeDisplayType: 'flat_lay',
      selectedDisplayModes: ['flat_lay'],
      lastDisplayModes: ['flat_lay'],
      detailGenerationMode: GARMENT_DETAIL_MODES.FAITHFUL,
      detailReferenceImages: {},
      detailReferenceUploadStatus: {},
      detailReferenceUploadErrors: {},
      activeDetailCategory: 'all',
      showAllDetailParts: false,
      displayImageStatus: 'empty',
      displayImageError: '',
      displayImageMeta: null,
      displaySubmissionStatus: 'idle',
      displaySubmissionError: '',
      displayCreatedTaskId: '',
      displayCreatedBatchId: '',
      displayCreatedHistoryId: '',
      displaySubmissionKey: '',
      displayKeyboardActive: false,
      displayDraftAvailable: false,
      displayDraftData: null,
      colorSelectionMethod: 'system',
      colorEyedropperSource: 'garment',
      customColorPickerVisible: false,
      selectedColorId: '',
      colorPreviewEnabled: false,
      colorPreviewStatus: 'idle',
      colorPreviewUrl: '',
      colorPreviewMaskSource: '',
      colorPreviewError: '',
      colorPreviewResult: null,
      colorTargetArea: 'whole_garment',
      textureRetention: 'standard',
      colorAdvancedSettingsOpen: false,
      colorReferenceImagePath: '',
      colorReferencePickerPath: '',
      colorReferenceImageStatus: 'empty',
      colorReferenceImageError: '',
      colorEyedropperActive: false,
      colorEyedropperNotice: '',
      eyedropperColor: null,
      colorPickerLocalImagePath: '',
      colorPendingSample: null,
      colorExtractedPalette: [],
      colorHistoryOptions: [],
      recentPickedColors: [],
      colorCustomPrompt: '',
      colorDraftReady: false,
      colorDraftAvailable: false,
      colorImageStatus: 'empty',
      colorImageError: '',
      colorImageMeta: null,
      colorSubmissionStatus: 'idle',
      colorSubmissionError: '',
      colorCreatedTaskId: '',
      colorKeyboardActive: false,
      selectedFabricId: '',
      fabricTargetArea: 'whole_garment',
      fabricReferenceImagePath: '',
      fabricColorMode: 'preserve_original',
      fabricCustomPrompt: '',
      fabricPositionPrompt: '',
      fabricReferencePanelOpen: false,
      fabricImageStatus: 'empty',
      fabricImageError: '',
      fabricImageMeta: null,
      fabricReferenceImageStatus: 'empty',
      fabricReferenceImageError: '',
      fabricSubmissionStatus: 'idle',
      fabricSubmissionError: '',
      fabricCreatedTaskId: '',
      fabricKeyboardActive: false,
      selectedPatternId: 'floral',
      patternPlacement: 'chest',
      patternReferenceImagePath: '',
      patternCustomPrompt: '',
      patternSourceTab: 'library',
      patternImageStatus: 'empty',
      patternImageError: '',
      patternImageMeta: null,
      patternReferenceImageStatus: 'empty',
      patternReferenceImageError: '',
      patternSubmissionStatus: 'idle',
      patternSubmissionError: '',
      patternCreatedTaskId: '',
      patternKeyboardActive: false,
      patternDraftAvailable: false,
      patternDraftData: null,
      styleWizardStep: 1,
      styleChangeTargets: [],
      styleTargetDirections: {},
      styleChangeIntensity: 'minor',
      styleDesignPurpose: 'ecommerce_launch',
      stylePreserveItems: STYLE_PRESERVE_OPTIONS.map((item) => item.value),
      styleRemainingQuota: null,
      styleFitDirection: 'slim',
      styleReferenceSource: 'upload',
      styleReferenceImagePath: '',
      modifySelectionMode: 'single',
      selectedModifyTypes: ['micro_change'],
      selectedStyles: ['commute'],
      styleModificationMode: 'micro_change',
      styleOutputCount: 2,
      styleCustomPrompt: '',
      aiGeneratedPrompt: '',
      styleDesignPlanName: '',
      styleReferencesExpanded: false,
      styleSavePanelOpen: false,
      styleDraftReady: false,
      styleDraftAvailable: false,
      styleImageStatus: 'empty',
      styleImageError: '',
      styleImageMeta: null,
      styleReferenceImageStatus: 'empty',
      styleReferenceImageError: '',
      styleReferenceImageMeta: null,
      styleSubmissionStatus: 'idle',
      styleSubmissionError: '',
      styleCreatedTaskId: '',
      styleCreatedBatchId: '',
      styleCreatedHistoryId: '',
      styleSubmissionKey: '',
      styleSubmitStartedAt: 0,
      styleKeyboardActive: false,
      savedStyleDesignPlans: [],
      sourceDesignPlanId: '',
      sourceDesignVersion: 0,
      sourceDesignBranchName: '',
      selectedDetailParts: ['collar'],
      detailCustomPrompt: '',
      selectedMarketingTypes: ['detail_page'],
      selectedPageMaterialTypes: ['main_image', 'selling_point', 'scene_image', 'detail_image'],
      selectedDetailModules: ['main_image', 'selling_point', 'outfit_scene', 'detail_image'],
      selectedStandardDetailModules: ['product_main', 'selling_intro', 'scene_display', 'detail_display'],
      activeDetailTemplate: '',
      marketingVersion: '',
      sourcePackageId: '',
      productInfo: {
        name: '',
        sellingPoints: '',
        targetAudience: '',
        style: ''
      },
      productTitle: '',
      sellingPoints: '',
      detailDescription: '',
      customDetailPrompt: '',
      posterTypes: ['new_arrival'],
      seriesTypes: ['new_launch'],
      productionContext: null,
      clothImagePath: '',
      selectedParams: {},
      resourceLibraryExpanded: {
        sceneTemplates: false,
        modelQuickPlans: false,
        modelReferences: false,
        faceReferences: false,
        poseReferences: false,
        sceneReferences: false,
        detailReferences: false,
        fabricReferences: false,
        colorReferences: false,
        patternReferences: false,
        styleReferences: false,
        marketingTemplates: false
      },
      modelReplacementMode: 'model_display',
      selectedModelFeatures: ['model_display'],
      modelReplaceOnly: true,
      replaceMode: 'head_replace',
      modelTargetConfirmed: false,
      modelEditingStep: 1,
      modelPortraitSource: 'profiles',
      myModelProfiles: [],
      modelProfilesLoading: false,
      selectedModelProfileId: '',
      modelPortraitUploading: false,
      modelPortraitUploadError: '',
      modelPortraitFileId: '',
      saveUploadedAsProfile: false,
      newModelProfileName: '',
      newModelProfileNote: '',
      modelProfileConsentConfirmed: false,
      modelProfileQualityConfirmed: false,
      modelGenerationErrorSummary: '',
      modelProfileConsentText: MODEL_PROFILE_CONSENT_TEXT,
      selectedSystemPortraitCategory: 'female',
      referenceStyle: '',
      referenceStyleName: '',
      referencePrompt: '',
      advancedSettingsOpen: false,
      modelReferenceImagePath: '',
      modelReferenceStyle: 'asian_female_body',
      modelReferenceName: '亚洲女性',
      modelReferencePrompt: '亚洲女性全身AI模特，标准上身展示，适合服装上新',
      referenceImagePath: '',
      faceReferenceStyle: 'young_female_face',
      faceReferenceName: '年轻女性',
      faceReferencePrompt: '年轻女性人脸参考，清爽自然，适合女装上新',
      sceneReferenceImagePath: '',
      sceneReferenceUploadedUrl: '',
      sceneMode: 'exact_composite',
      sceneFit: 'cover',
      sceneForegroundScale: 100,
      sceneForegroundX: 50,
      sceneExactCompositeAvailable: false,
      sceneEdgeRefine: true,
      sceneShadowBlend: true,
      sceneBackgroundTab: 'system',
      sceneSystemTemplates: SCENE_SYSTEM_TEMPLATES,
      myScenes: [],
      selectedSystemSceneId: '',
      selectedMySceneId: '',
      scenePreviewFallbacks: {},
      isSceneUploading: false,
      sceneUploadError: '',
      selectedSceneTemplateId: '',
      sceneReferenceStyle: 'scene_street',
      sceneReferenceName: '街拍',
      sceneReferencePrompt: '街拍场景，自然光线，适合服装种草展示',
      sceneCustomPrompt: '',
      poseReferenceImagePath: '',
      poseReferenceStyle: 'natural_stand',
      poseReferenceName: '站姿',
      poseReferencePrompt: '自然站姿动作参考，身体舒展，服装轮廓清晰',
      poseReferenceType: 'model_action',
      poseCustomPrompt: '',
      poseCountOptions: [2, 4, 6],
      modelLibraryType: 'system',
      selectedModelId: '',
      customModelName: '',
      customModelType: 'personal',
      professionalParams: {
        bodyType: 'standard',
        styleTag: 'studio',
        generationMode: 'single'
      },
      modelLibraryTabs: [
        { label: '系统模特', value: 'system' },
        { label: '我的模特', value: 'personal' },
        { label: '品牌模特', value: 'brand' },
        { label: '创建专属模特', value: 'create' }
      ],
      bodyOptions: [
        { label: '标准', value: 'standard' },
        { label: '高挑', value: 'tall' },
        { label: '微胖友好', value: 'curvy' },
        { label: '小个子', value: 'petite' }
      ],
      styleOptions: [
        { label: '棚拍', value: 'studio' },
        { label: '街拍', value: 'street' },
        { label: '极简白底', value: 'minimal_white' },
        { label: '生活方式', value: 'lifestyle' }
      ],
      generationModeOptions: [
        { label: '单张', value: 'single' },
        { label: '批量', value: 'batch' }
      ],
      detailGenerationModeOptions: [
        { label: '忠实细节图', value: GARMENT_DETAIL_MODES.FAITHFUL, description: '真实近照裁切增强，不修改结构' },
        { label: 'AI补全参考', value: GARMENT_DETAIL_MODES.AI_REFERENCE, description: '细节不完整时有限补全，需人工复核' }
      ],
      advancedParams: {
        poseControl: 'natural',
        imageRatio: '3_4'
      },
      poseOptions: [
        { label: '自然站姿', value: 'natural' },
        { label: '轻微侧身', value: 'side' },
        { label: '手扶腰线', value: 'waist' }
      ],
      ratioOptions: [
        { label: '3:4', value: '3_4' },
        { label: '4:5', value: '4_5' },
        { label: '1:1', value: '1_1' }
      ],
      isGenerating: false
    }
  },
  computed: {
    isGarmentTool() {
      return this.toolType === 'clothing' || this.toolType === GARMENT_REPLACE_ACTION
    },
    garmentReplaceModes() {
      return GARMENT_REPLACE_MODE_OPTIONS
    },
    garmentWizardSteps() {
      return GARMENT_WIZARD_STEPS
    },
    garmentPreserveOptions() {
      return GARMENT_PRESERVE_OPTIONS
    },
    garmentAccessoryTypes() {
      return ACCESSORY_TYPES
    },
    garmentAccessoryLimit() {
      if (this.garmentRuntimeConfig.isInternalDebug) return ACCESSORY_TYPES.length
      const garmentReferenceCount = this.garmentReplaceMode === GARMENT_REPLACE_MODES.SEPARATE ? 2 : 1
      return Math.max(0, GARMENT_PROVIDER_MAX_INPUT_IMAGES - 1 - garmentReferenceCount)
    },
    garmentAccessoryAvailable() {
      return this.garmentAccessoryLimit > 0
    },
    selectedGarmentAccessory() {
      return this.getGarmentAccessoryByType(this.garmentAccessoryType)
    },
    selectedGarmentAccessoryTypeLabel() {
      const item = ACCESSORY_TYPES.find((entry) => entry.value === this.garmentAccessoryType)
      return (item && item.label) || '配饰'
    },
    garmentAccessoryLibraryItems() {
      return this.garmentAccessoryLibrary.filter((item) => item.type === this.garmentAccessoryType)
    },
    activeGarmentAccessories() {
      return this.garmentSelectedAccessoryTypes
        .map((type) => this.getGarmentAccessoryByType(type))
        .filter(Boolean)
    },
    garmentAccessoryLimitText() {
      if (!this.garmentAccessoryLimit) return '当前模式已使用模型支持的全部 3 张输入图，不能同时加入配饰。'
      return `当前模式最多可添加 ${this.garmentAccessoryLimit} 件配饰参考图。`
    },
    garmentNeedsUpper() {
      return [GARMENT_REPLACE_MODES.UPPER_ONLY, GARMENT_REPLACE_MODES.SEPARATE].includes(this.garmentReplaceMode)
    },
    garmentNeedsLower() {
      return [GARMENT_REPLACE_MODES.LOWER_ONLY, GARMENT_REPLACE_MODES.SEPARATE].includes(this.garmentReplaceMode)
    },
    garmentNeedsOutfit() {
      return this.garmentReplaceMode === GARMENT_REPLACE_MODES.FULL_OUTFIT
    },
    garmentContractSource() {
      return {
        type: GARMENT_REPLACE_ACTION,
        input: {
          imageUrl: this.garmentPersonImage,
          assets: {
            modelImage: this.garmentPersonImage,
            personImage: this.garmentPersonImage,
            ...(this.garmentNeedsUpper ? { topGarmentImage: this.garmentUpperImage, upperGarment: this.garmentUpperImage } : {}),
            ...(this.garmentNeedsLower ? { bottomGarmentImage: this.garmentLowerImage, lowerGarment: this.garmentLowerImage } : {}),
            ...(this.garmentNeedsOutfit ? { onePieceGarmentImage: this.garmentOutfitImage, outfitGarment: this.garmentOutfitImage } : {})
          },
          params: {
            actionType: GARMENT_REPLACE_ACTION,
            garmentMode: this.garmentReplaceMode,
            replaceMode: this.garmentReplaceMode,
            accessoryImages: this.activeGarmentAccessories,
            accessoryReferences: this.activeGarmentAccessories,
            preserveFace: this.garmentPreserve.preservePerson,
            ...this.garmentPreserve
          }
        }
      }
    },
    garmentValidation() {
      return validateGarmentReplaceInput(this.garmentContractSource)
    },
    garmentUploading() {
      return Object.values(this.garmentUploadStatus || {}).includes('uploading') || Object.values(this.garmentAccessoryUploadStatus || {}).includes('uploading')
    },
    garmentStepDisabledReason() {
      if (this.garmentUploading) return '图片上传中，请稍候。'
      if (this.garmentCurrentStep === 1) return this.garmentPersonImage ? '' : '请先选择人物图片。'
      if (this.garmentCurrentStep === 2) {
        if (this.garmentNeedsUpper && !this.garmentUpperImage) return '请上传上装参考图。'
        if (this.garmentNeedsLower && !this.garmentLowerImage) return '请上传下装参考图。'
        if (this.garmentNeedsOutfit && !this.garmentOutfitImage) return '请上传完整服装参考图。'
      }
      if (this.garmentCurrentStep === 3) {
        const missing = this.garmentSelectedAccessoryTypes.find((type) => !this.getGarmentAccessoryByType(type))
        if (missing) return `请上传${this.getGarmentAccessoryLabel(missing)}参考图。`
      }
      return ''
    },
    garmentGenerateDisabledReason() {
      if (this.garmentSubmissionStatus === 'submitting') return '正在创建任务，请勿重复点击。'
      if (this.garmentUploading) return '图片上传中，请稍候。'
      if (!this.garmentValidation.ok) return this.garmentValidation.message
      if (!this.garmentRuntimeConfig.canSubmit) return this.garmentRuntimeConfig.disabledReason || '当前运行环境未开放换衣服任务。'
      return ''
    },
    garmentGenerateButtonText() {
      if (this.garmentSubmissionStatus === 'submitting') return '正在创建任务...'
      if (this.garmentSubmissionStatus === 'navigation_failed' && this.garmentCreatedTaskId) return '查看已创建任务'
      if (this.garmentRuntimeConfig.realProviderTest) return '调用真实API测试'
      if (this.garmentRuntimeConfig.isTestStage) return '测试换衣效果'
      return '生成换衣效果'
    },
    garmentGenerationSummary() {
      const option = GARMENT_REPLACE_MODE_OPTIONS.find((item) => item.value === this.garmentReplaceMode)
      return `${option ? option.label : '换衣服'}${this.activeGarmentAccessories.length ? ` · ${this.activeGarmentAccessories.length} 件配饰` : ''} · 保留人物与未替换区域`
    },
    garmentReplaceModeLabel() {
      const option = GARMENT_REPLACE_MODE_OPTIONS.find((item) => item.value === this.garmentReplaceMode)
      return option ? option.label : '换衣服'
    },
    garmentReferenceSummary() {
      if (this.garmentReplaceMode === GARMENT_REPLACE_MODES.SEPARATE) return '上装、下装各 1 张'
      if (this.garmentReplaceMode === GARMENT_REPLACE_MODES.LOWER_ONLY) return '下装 1 张'
      if (this.garmentReplaceMode === GARMENT_REPLACE_MODES.FULL_OUTFIT) return '整套服装 1 张'
      return '上装 1 张'
    },
    garmentAccessorySummary() {
      return this.activeGarmentAccessories.length
        ? this.activeGarmentAccessories.map((item) => this.getGarmentAccessoryLabel(item.type)).join('、')
        : '未添加'
    },
    garmentPreserveSummary() {
      const enabled = GARMENT_PRESERVE_OPTIONS.filter((item) => this.garmentPreserve[item.key])
      return enabled.length === GARMENT_PRESERVE_OPTIONS.length ? '人物、姿势、背景与未替换区域' : `${enabled.length} 项已开启`
    },
    garmentSelectedModelProfileName() {
      const profile = this.myModelProfiles.find((item) => item.modelProfileId === this.garmentSelectedModelProfileId)
      return profile ? profile.name : '常用模特'
    },
    isRedesignTool() {
      return REDESIGN_TOOL_TYPES.includes(this.toolType)
    },
    isColorTool() {
      return this.isRedesignTool && this.selectedRedesignTypes.includes('color')
    },
    isFabricTool() {
      return this.isRedesignTool && this.selectedRedesignTypes.includes('fabric')
    },
    isPatternTool() {
      return this.isRedesignTool && this.selectedRedesignTypes.includes('pattern')
    },
    isStyleTool() {
      return this.isRedesignTool && this.selectedRedesignTypes.includes('style')
    },
    isDisplayTool() {
      return DISPLAY_TOOL_TYPES.includes(this.toolType)
    },
    isDetailDisplayTool() {
      return this.isDisplayTool && this.selectedDisplayModes.includes('detail_photo')
    },
    isModelTool() {
      return this.toolType === 'model'
    },
    isDedicatedModelTool() {
      return this.isModelTool && this.modelReplaceOnly && !this.isPureSceneReplace
    },
    replaceModeOptions() {
      if (this.modelRuntimeConfig.isTestStage) return MODEL_REPLACE_TYPE_OPTIONS
      return MODEL_REPLACE_TYPE_OPTIONS.filter((item) => validateIdentityProviderCapability(item.value).ok)
    },
    hasSelectedReplaceMode() {
      return ['head_replace', 'face_replace'].includes(this.replaceMode)
    },
    modelTaskType() {
      return this.hasSelectedReplaceMode ? this.replaceMode : 'head_replace'
    },
    modelInputImageCount() {
      return [this.clothImagePath, this.modelTargetPersonImage].filter(Boolean).length
    },
    modelPortraitSourceTabs() {
      if (this.modelRuntimeConfig.isInternalDebug) return MODEL_PORTRAIT_SOURCE_TABS
      return MODEL_PORTRAIT_SOURCE_TABS.filter((item) => item.value !== 'system' || this.availableSystemPortraits.length > 0)
    },
    modelSystemPortraits() {
      return MODEL_SYSTEM_PORTRAIT_CONFIGS.map((item) => {
        const model = this.systemModels[item.modelIndex] || null
        return {
          ...item,
          modelId: model ? model.modelId : '',
          imageUrl: model ? (model.frontImageUrl || model.avatarUrl || '') : ''
        }
      })
    },
    availableSystemPortraits() {
      return this.modelSystemPortraits.filter((item) => /^(cloud:\/\/|https:\/\/)/i.test(String(item.imageUrl || '')))
    },
    selectedModelProfile() {
      return this.myModelProfiles.find((item) => item.modelProfileId === this.selectedModelProfileId) || null
    },
    selectedSystemPortrait() {
      return this.availableSystemPortraits.find((item) => item.value === this.selectedSystemPortraitCategory) || null
    },
    modelTargetPersonImage() {
      if (this.modelPortraitSource === 'profiles') return String(this.selectedModelProfile && (this.selectedModelProfile.coverFileId || this.selectedModelProfile.coverUrl) || '').trim()
      if (this.modelPortraitSource === 'upload') return String(this.modelPortraitFileId || this.referenceImagePath || '').trim()
      return this.selectedSystemPortrait ? String(this.selectedSystemPortrait.imageUrl || '').trim() : ''
    },
    modelTargetPersonPreview() {
      if (this.modelPortraitSource === 'profiles') return String(this.selectedModelProfile && (this.selectedModelProfile.coverUrl || this.selectedModelProfile.coverFileId) || '').trim()
      if (this.modelPortraitSource === 'upload') return String(this.referenceImagePath || this.modelPortraitFileId || '').trim()
      return this.selectedSystemPortrait ? String(this.selectedSystemPortrait.imageUrl || '').trim() : ''
    },
    modelTargetPersonName() {
      if (this.modelPortraitSource === 'profiles') return String((this.selectedModelProfile && this.selectedModelProfile.name) || '常用模特')
      if (this.modelPortraitSource === 'upload') return String(this.newModelProfileName || '本次上传人物')
      return String((this.selectedSystemPortrait && this.selectedSystemPortrait.label) || '系统人物')
    },
    modelTargetSectionTitle() {
      return this.replaceMode === 'face_replace' ? '选择目标人脸参考' : '选择目标头部参考'
    },
    replaceModeLabel() {
      const option = MODEL_REPLACE_TYPE_OPTIONS.find((item) => item.value === this.replaceMode)
      return option ? option.label : '换整头'
    },
    modelIdentityProviderCapability() {
      return getIdentityProviderCapability()
    },
    garmentRuntimeConfig() {
      this.runtimeConfigRevision
      const validation = validateGarmentProviderCapability(GARMENT_REPLACE_ACTION, this.garmentReplaceMode)
      const experimentalValidation = validateExperimentalGarmentProviderCapability(GARMENT_REPLACE_ACTION, this.garmentReplaceMode)
      const capability = validation.capability || {}
      return getRuntimeGenerationConfig({
        providerSupported: validation.ok,
        experimentalProviderSupported: experimentalValidation.ok,
        provider: capability.provider || 'wanx',
        modelName: capability.modelName || 'unknown',
        taskType: GARMENT_REPLACE_ACTION
      })
    },
    genericRuntimeConfig() {
      this.runtimeConfigRevision
      return getRuntimeGenerationConfig({
        providerSupported: false,
        experimentalProviderSupported: true,
        provider: 'wanx',
        modelName: 'qwen-image-2.0-pro',
        taskType: (this.currentToolConfig && this.currentToolConfig.taskType) || this.toolType
      })
    },
    modelRuntimeConfig() {
      this.runtimeConfigRevision
      const validation = validateIdentityProviderCapability(this.replaceMode)
      const experimentalValidation = validateExperimentalIdentityProviderCapability(this.replaceMode)
      const capability = validation.capability || this.modelIdentityProviderCapability || {}
      return getRuntimeGenerationConfig({
        providerSupported: validation.ok,
        experimentalProviderSupported: experimentalValidation.ok,
        provider: capability.provider || 'wanx',
        modelName: capability.modelName || 'unknown',
        taskType: this.modelTaskType
      })
    },
    modelIdentityCapabilityAvailable() {
      return this.modelRuntimeConfig.canSubmit
    },
    modelIdentityAnyCapabilityAvailable() {
      if (this.modelRuntimeConfig.isTestStage) return true
      return MODEL_REPLACE_TYPE_OPTIONS.some((item) => validateIdentityProviderCapability(item.value).ok)
    },
    modelReplaceTargetLabel() {
      return this.replaceMode === 'face_replace' ? '脸部特征' : '头部形象'
    },
    canStartModelReplace() {
      return Boolean(this.modelIdentityCapabilityAvailable && this.clothImagePath && this.hasSelectedReplaceMode && this.modelTargetConfirmed && this.modelTargetPersonImage && !this.isGenerating)
    },
    modelGenerateDisabledReason() {
      if (this.isGenerating) return '正在生成新模特，请勿重复操作'
      if (!this.clothImagePath) return '请先上传原图'
      if (!this.hasSelectedReplaceMode) return '请选择替换方式'
      if (!this.modelTargetPersonImage) return '请选择目标人像'
      if (!this.modelTargetConfirmed) return '请选择目标人像'
      if (!this.modelRuntimeConfig.canSubmit) return this.modelRuntimeConfig.disabledReason || '真实 API 配置尚未就绪'
      return ''
    },
    modelReplaceButtonText() {
      if (this.isGenerating) return '生成中...'
      if (this.modelRuntimeConfig.realProviderTest) return '调用真实API测试'
      if (this.modelRuntimeConfig.isTestStage) return '开始测试生成'
      return this.replaceMode === 'face_replace' ? '开始只换脸' : '开始换整头'
    },
    isMarketingTool() {
      return this.toolType === 'marketing'
    },
    colorSelectionMethods() {
      return COLOR_SELECTION_METHODS
    },
    colorEyedropperSources() {
      return COLOR_EYEDROPPER_SOURCES
    },
    systemColorMatrix() {
      return getSystemColorMatrix()
    },
    colorTargetAreas() {
      return COLOR_TARGET_AREAS
    },
    fabricTargetAreas() {
      return FABRIC_TARGET_AREAS.filter((item) => item.value !== 'partial')
    },
    textureRetentionOptions() {
      return TEXTURE_RETENTION_OPTIONS
    },
    fabricReferenceOptions() {
      return FABRIC_REFERENCE_OPTIONS
    },
    patternReferenceOptions() {
      return PATTERN_REFERENCE_OPTIONS
    },
    patternPositionOptions() {
      return PATTERN_POSITION_OPTIONS
    },
    styleFitOptions() {
      return STYLE_FIT_OPTIONS
    },
    styleModificationModes() {
      return STYLE_MODIFICATION_MODES
    },
    styleOutputCountOptions() {
      return this.genericRuntimeConfig.isInternalDebug
        ? STYLE_OUTPUT_COUNT_OPTIONS
        : STYLE_OUTPUT_COUNT_OPTIONS.filter((count) => count !== 1)
    },
    styleWizardSteps() {
      return STYLE_WIZARD_STEPS
    },
    styleChangeTargetOptions() {
      return STYLE_CHANGE_TARGETS
    },
    styleChangeIntensityOptions() {
      return STYLE_CHANGE_INTENSITIES
    },
    styleDesignPurposeOptions() {
      return STYLE_DESIGN_PURPOSES
    },
    stylePreserveOptions() {
      return STYLE_PRESERVE_OPTIONS
    },
    selectedStyleChangeDetails() {
      return STYLE_CHANGE_TARGETS
        .filter((item) => this.styleChangeTargets.includes(item.value))
        .map((item) => ({
          ...item,
          direction: this.styleTargetDirections[item.value] || ''
        }))
    },
    styleChangeSummary() {
      if (!this.selectedStyleChangeDetails.length) return '请选择至少一个需要修改的部位。'
      return `本次改动：${this.selectedStyleChangeDetails.map((item) => `${item.label} → ${item.direction || '待选择'}`).join('、')}`
    },
    styleSelectedPreserveLabels() {
      return STYLE_PRESERVE_OPTIONS
        .filter((item) => this.stylePreserveItems.includes(item.value))
        .map((item) => item.label)
    },
    styleChangeIntensityLabel() {
      const option = STYLE_CHANGE_INTENSITIES.find((item) => item.value === this.styleChangeIntensity)
      return option ? option.label : '微调优化'
    },
    styleDesignPurposeLabel() {
      const option = STYLE_DESIGN_PURPOSES.find((item) => item.value === this.styleDesignPurpose)
      return option ? option.label : '电商上新'
    },
    styleRemainingQuotaLabel() {
      return Number.isFinite(this.styleRemainingQuota) ? `${this.styleRemainingQuota} 次` : '额度同步中'
    },
    styleCurrentStepReason() {
      return this.getStyleStepValidationReason(this.styleWizardStep)
    },
    canAdvanceStyleWizard() {
      return !this.styleCurrentStepReason && !this.isGenerating
    },
    styleReferenceSourceTabs() {
      return STYLE_REFERENCE_SOURCE_TABS
    },
    styleDesignOptions() {
      return Array.isArray(this.currentTool.referenceLibrary) ? this.currentTool.referenceLibrary : []
    },
    visibleStyleReferenceOptions() {
      return this.styleReferencesExpanded ? this.styleDesignOptions : this.styleDesignOptions.slice(0, 3)
    },
    selectedStyleNames() {
      return this.styleDesignOptions
        .filter((item) => this.selectedStyles.includes(item.value))
        .map((item) => item.label)
    },
    hasStyleReferenceSelection() {
      return Boolean(this.styleReferenceImagePath)
    },
    styleSettingsComplete() {
      return this.selectedStyleChangeDetails.length > 0 && this.selectedStyleChangeDetails.every((item) => item.direction)
    },
    stylePromptComplete() {
      return Boolean(this.styleChangeIntensity && this.selectedStyles.length && this.styleDesignPurpose)
    },
    styleConflictMessage() {
      if (!this.isStyleTool) return ''
      const selected = new Set(this.selectedStyles)
      if (selected.has('sport') && selected.has('tweed')) {
        return '“运动风”和“小香风”方向差异较大，请保留其中一种。'
      }
      return ''
    },
    styleSubmissionNotice() {
      if (this.styleSubmissionStatus === 'submission_failed') {
        return this.styleSubmissionError || '任务提交失败，请检查网络后重试。'
      }
      if (this.styleSubmissionStatus === 'navigation_failed') {
        return '任务已创建，但结果页打开失败。再次点击下方按钮可继续查看，不会重复创建任务。'
      }
      return ''
    },
    styleSubmissionStatusLabel() {
      const labels = {
        idle: '未提交',
        submitting: '提交中',
        submission_failed: '提交失败',
        task_created: '任务已创建',
        navigation_failed: '任务已创建',
        navigated: '已提交'
      }
      return labels[this.styleSubmissionStatus] || '未提交'
    },
    styleGenerateDisabledReason() {
      if (!this.isStyleTool) return ''
      if (this.styleSubmissionStatus === 'navigation_failed' && this.styleCreatedTaskId) return ''
      if (this.styleImageStatus === 'uploading' || this.styleReferenceImageStatus === 'uploading') return '图片上传中，请稍候'
      if (this.styleSubmissionStatus === 'submitting') return '正在创建任务，请勿重复操作'
      if (this.styleSubmissionStatus === 'task_created') return '任务已创建，正在打开结果页'
      if (!this.clothImagePath) return '请先上传原款图片'
      if (!this.styleChangeTargets.length) return '请选择至少一个需要修改的部位'
      if (this.selectedStyleChangeDetails.some((item) => !item.direction)) return '请为每个改动部位选择目标方向'
      if (!this.styleChangeIntensity) return '请选择改动强度'
      if (!this.selectedStyles.length) return '请至少选择一种风格倾向'
      if (!this.styleDesignPurpose) return '请选择设计用途'
      if (this.styleConflictMessage) return this.styleConflictMessage
      return ''
    },
    selectedModifyTypeNames() {
      return STYLE_MODIFICATION_MODES
        .filter((item) => this.selectedModifyTypes.includes(item.value))
        .map((item) => item.label)
    },
    styleAiPlanOptions() {
      return STYLE_AI_PLAN_OPTIONS
    },
    faceReplaceTypeOptions() {
      return FACE_REPLACE_TYPE_OPTIONS
    },
    poseReferenceTypes() {
      return POSE_REFERENCE_TYPES
    },
    modelQuickPlans() {
      return MODEL_QUICK_PLANS
    },
    activeModelQuickPlanName() {
      const activePlan = MODEL_QUICK_PLANS.find((plan) => this.isModelQuickPlanActive(plan))
      return activePlan ? `已采用：${activePlan.label}` : ''
    },
    modelDisplayReferences() {
      return MODEL_DISPLAY_REFERENCES
    },
    faceReplaceReferences() {
      return FACE_REPLACE_REFERENCES
    },
    poseVariationReferences() {
      return POSE_VARIATION_REFERENCES
    },
    sceneReplaceReferences() {
      return SCENE_REFERENCE_LIBRARY
    },
    sceneQuickTemplates() {
      return SCENE_QUICK_TEMPLATES
    },
    selectedSceneTemplate() {
      return [...this.sceneSystemTemplates, ...SCENE_QUICK_TEMPLATES]
        .find((item) => item.value === this.selectedSceneTemplateId) || null
    },
    currentSceneSelectionName() {
      if (this.sceneBackgroundTab === 'system') {
        const selected = this.sceneSystemTemplates.find((item) => item.value === this.selectedSystemSceneId)
        return selected ? selected.label : ''
      }
      const selected = this.myScenes.find((item) => item.sceneId === this.selectedMySceneId)
      return selected ? selected.name : ''
    },
    selectedModelFeatureModes() {
      return MODEL_WORKFLOW_MODES.filter((item) => this.selectedModelFeatures.includes(item.value))
    },
    modelGenerationSummaryLines() {
      const features = this.selectedModelFeatures
      if (features.length === 4) {
        return ['生成完整商业模特展示图']
      }
      const lines = []
      if (features.includes('model_display')) lines.push('生成标准模特上身展示图')
      if (features.includes('face_replace')) lines.push('将替换模特人脸')
      if (features.includes('pose_variation')) lines.push('生成多种展示姿势')
      if (features.includes('scene_replace')) lines.push('替换为商业拍摄场景')
      return lines.length ? lines : ['请选择至少一种 AI 模特能力']
    },
    generateButtonText() {
      const features = this.selectedModelFeatures
      if (!this.isModelTool) {
        if (this.isColorTool) return '立即生成'
        if (this.isFabricTool) return this.hasFabricSelection ? '生成面料效果' : '请选择面料'
        if (this.isPatternTool) return '生成图案效果图'
        return '立即生成'
      }
      if (features.length > 1) {
        return '一键生成AI模特大片'
      }
      const feature = features[0]
      const buttonMap = {
        model_display: '立即生成模特展示图',
        face_replace: '立即生成换脸效果',
        pose_variation: '立即生成多姿态模特图',
        scene_replace: '开始换场景'
      }
      return buttonMap[feature] || '立即生成'
    },
    isPureSceneReplace() {
      return this.isModelTool && this.selectedModelFeatures.length === 1 && this.selectedModelFeatures[0] === 'scene_replace'
    },
    hasSceneSelection() {
      return Boolean(this.sceneReferenceImagePath || this.selectedSceneTemplateId)
    },
    canStartSceneReplace() {
      return Boolean(this.clothImagePath && this.hasSceneSelection && !this.sceneGenerateDisabledReason)
    },
    sceneGenerationSummary() {
      return this.currentSceneSelectionName
        ? `${this.currentSceneSelectionName} · ${this.sceneMode === 'exact_composite' ? '精确替换' : '风格生成'}`
        : '选择新场景后即可生成'
    },
    sceneGenerateDisabledReason() {
      if (this.isGenerating) return '正在替换场景，请勿重复操作'
      if (this.isSceneUploading) return '场景参考图上传中，请稍候'
      if (!this.clothImagePath) return '请先上传服装图'
      if (!this.hasSceneSelection) return '请选择一个新场景'
      if (this.sceneMode === 'exact_composite' && !this.sceneReferenceImagePath) return '精确替换需要上传自定义场景图'
      if (this.sceneMode === 'exact_composite' && !this.sceneExactCompositeAvailable) return '精确替换暂不可用：尚未配置人物分割与背景合成服务'
      return ''
    },
    hasFabricSelection() {
      return Boolean(this.selectedFabricId || this.fabricReferenceImagePath)
    },
    selectedFabricSummary() {
      if (this.selectedFabric) return `当前面料：${this.selectedFabric.label} · ${this.selectedFabric.desc}`
      if (this.fabricReferenceImagePath) return '当前面料：自定义面料 · 含参考图'
      return '请选择目标面料'
    },
    fabricTargetAreaLabel() {
      const option = this.fabricTargetAreas.find((item) => item.value === this.fabricTargetArea)
      if (!option) return '未选择区域'
      return option.value === 'partial' ? '指定局部' : option.label
    },
    fabricConfigurationSummary() {
      if (!this.hasFabricSelection) return this.fabricGenerateDisabledReason || '请选择目标面料'
      const fabricName = this.selectedFabric ? this.selectedFabric.label : '自定义面料'
      return [fabricName, this.fabricTargetAreaLabel, this.fabricReferenceImagePath ? '含参考图' : ''].filter(Boolean).join(' · ')
    },
    fabricGenerateDisabledReason() {
      if (!this.isFabricTool) return ''
      if (this.fabricImageStatus === 'uploading' || this.fabricReferenceImageStatus === 'uploading') return '图片上传中…'
      if (this.fabricSubmissionStatus === 'submitting') return '正在创建任务…'
      if (this.fabricSubmissionStatus === 'task_created') return '任务已创建，正在打开结果…'
      if (!this.clothImagePath) return '请先上传服装图片'
      if (!this.fabricTargetArea) return '请选择替换区域'
      if (!this.hasFabricSelection) return '请选择目标面料'
      return ''
    },
    fabricGenerateButtonText() {
      if (!this.isFabricTool) return ''
      if (this.fabricSubmissionStatus === 'navigation_failed' && this.fabricCreatedTaskId) return '查看已创建任务'
      return this.fabricGenerateDisabledReason || '立即生成'
    },
    fabricSubmissionNotice() {
      if (!this.isFabricTool) return ''
      if (this.fabricSubmissionStatus === 'navigation_failed') return '任务已创建，可前往最近任务查看。'
      if (this.fabricSubmissionStatus === 'submission_failed') return this.fabricSubmissionError || '任务提交失败，请重试。'
      return ''
    },
    systemPatternOptions() {
      return this.patternReferenceOptions.filter((item) => item.value !== 'custom')
    },
    isCustomPatternSelected() {
      return this.selectedPatternId === 'custom' && Boolean(this.patternReferenceImagePath)
    },
    hasPatternSelection() {
      if (this.selectedPatternId === 'custom') return Boolean(this.patternReferenceImagePath)
      return Boolean(this.selectedPattern)
    },
    selectedPatternSummary() {
      if (this.isCustomPatternSelected) return '当前图案：自定义图案'
      if (this.selectedPattern) return `当前图案：${this.selectedPattern.label} · ${this.selectedPattern.desc}`
      return '尚未选择图案'
    },
    patternPlacementLabel() {
      const option = this.patternPositionOptions.find((item) => item.value === this.patternPlacement)
      return option ? option.label : '未选择位置'
    },
    patternConfigurationSummary() {
      if (!this.hasPatternSelection) return this.patternGenerateDisabledReason || '请选择或上传图案'
      const patternName = this.isCustomPatternSelected ? '自定义图案' : this.selectedPattern.label
      return `${patternName} · ${this.patternPlacementLabel}`
    },
    patternGenerateDisabledReason() {
      if (!this.isPatternTool) return ''
      if (this.patternImageStatus === 'uploading') return '服装图片上传中…'
      if (!this.clothImagePath) return '请先上传服装图片'
      if (this.patternReferenceImageStatus === 'uploading') return '图案上传中…'
      if (!this.hasPatternSelection) return '请选择或上传图案'
      if (!this.patternPlacement) return '请选择图案位置'
      if (this.patternSubmissionStatus === 'submitting') return '正在创建任务…'
      if (this.patternSubmissionStatus === 'task_created') return '任务已创建，正在打开结果…'
      if (this.patternSubmissionStatus === 'submission_unknown') return '提交状态确认中…'
      return ''
    },
    patternGenerateButtonText() {
      if (!this.isPatternTool) return ''
      if (this.patternSubmissionStatus === 'navigation_failed' && this.patternCreatedTaskId) return '查看已创建任务'
      return this.patternGenerateDisabledReason || '生成图案效果图'
    },
    patternSubmissionNotice() {
      if (!this.isPatternTool) return ''
      if (this.patternSubmissionStatus === 'navigation_failed') return '任务已创建，可前往最近任务查看。'
      if (this.patternSubmissionStatus === 'submission_failed') return this.patternSubmissionError || '任务提交失败，请重试。'
      if (this.patternSubmissionStatus === 'submission_unknown') return '提交结果暂不明确，请前往最近任务确认。'
      return ''
    },
    isGenerateDisabled() {
      return Boolean(
        this.isGenerating
        || !this.clothImagePath
        || (this.isPureSceneReplace && !this.sceneReferenceImagePath)
        || (this.isFabricTool && Boolean(this.fabricGenerateDisabledReason) && this.fabricSubmissionStatus !== 'navigation_failed')
        || (this.isPatternTool && Boolean(this.patternGenerateDisabledReason) && this.patternSubmissionStatus !== 'navigation_failed')
        || (this.isColorTool && Boolean(this.colorGenerateDisabledReason))
        || (this.isStyleTool && Boolean(this.styleGenerateDisabledReason))
        || (this.isDisplayTool && Boolean(this.displayGenerateDisabledReason) && this.displaySubmissionStatus !== 'navigation_failed')
      )
    },
    colorGenerateDisabledReason() {
      if (!this.isColorTool) return ''
      if (this.colorImageStatus === 'uploading' || this.colorReferenceImageStatus === 'uploading') return '图片上传中…'
      if (this.colorSubmissionStatus === 'submitting') return '正在创建任务…'
      if (this.colorSubmissionStatus === 'task_created') return '正在打开结果…'
      if (!this.clothImagePath) return '请先上传服装图片'
      if (!this.currentTargetColor) return '请选择目标颜色'
      if (!this.colorTargetArea) return '请选择换色区域'
      return ''
    },
    colorGenerateButtonText() {
      if (!this.isColorTool) return ''
      if (this.colorSubmissionStatus === 'navigation_failed' && this.colorCreatedTaskId) return '查看生成任务'
      if (this.colorImageStatus === 'uploading' || this.colorReferenceImageStatus === 'uploading') return '图片上传中…'
      if (this.colorSubmissionStatus === 'submitting' || this.isGenerating) return '正在创建任务…'
      if (this.colorSubmissionStatus === 'task_created') return '正在打开结果…'
      return this.colorGenerateDisabledReason || '立即生成'
    },
    colorSubmissionNotice() {
      if (!this.isColorTool) return ''
      if (this.colorSubmissionStatus === 'submission_failed') return this.colorSubmissionError || '任务提交失败，请检查网络后重试。'
      if (this.colorSubmissionStatus === 'navigation_failed') return '任务已创建，可前往最近任务查看。'
      return ''
    },
    sceneGenerateButtonText() {
      if (this.isGenerating) return '正在替换场景…'
      if (!this.clothImagePath) return '请先上传服装图'
      if (!this.hasSceneSelection) return '请选择背景'
      return this.sceneMode === 'exact_composite' ? '使用此场景替换' : '生成相似场景'
    },
    unifiedGenerationSummary() {
      if (this.isStyleTool) return `${this.styleSubmissionStatusLabel} · 将生成 ${this.styleOutputCount} 个方案`
      if (this.isColorTool) return this.colorConfigurationSummary
      if (this.isFabricTool) return this.fabricConfigurationSummary
      if (this.isPatternTool) return this.patternConfigurationSummary
      if (this.isDisplayTool) return this.displayConfigurationSummary
      return this.modelGenerationSummaryLines.join(' · ')
    },
    unifiedGenerateReason() {
      if (this.isStyleTool) return this.styleGenerateDisabledReason || this.styleSubmissionNotice
      if (this.isColorTool) return this.colorGenerateDisabledReason || this.colorSubmissionNotice
      if (this.isFabricTool) return this.fabricGenerateDisabledReason || this.fabricSubmissionNotice
      if (this.isPatternTool) return this.patternGenerateDisabledReason || this.patternSubmissionNotice
      if (this.isDisplayTool) return this.displayGenerateDisabledReason || this.displaySubmissionNotice
      if (!this.clothImagePath) return '请先上传服装图片'
      return ''
    },
    unifiedGenerateButtonText() {
      return this.displayGenerateButtonText
        || this.patternGenerateButtonText
        || this.fabricGenerateButtonText
        || this.colorGenerateButtonText
        || this.generationProgressText
    },
    isUnifiedSubmitting() {
      return Boolean(
        this.isGenerating
        || this.styleSubmissionStatus === 'submitting'
        || this.colorSubmissionStatus === 'submitting'
        || this.fabricSubmissionStatus === 'submitting'
        || this.patternSubmissionStatus === 'submitting'
        || this.displaySubmissionStatus === 'submitting'
      )
    },
    isGenerationKeyboardVisible() {
      return Boolean(
        (this.isStyleTool && this.styleKeyboardActive)
        || (this.isColorTool && this.colorKeyboardActive)
        || (this.isFabricTool && this.fabricKeyboardActive)
        || (this.isPatternTool && this.patternKeyboardActive)
        || (this.isDisplayTool && this.displayKeyboardActive)
      )
    },
    generationProgressText() {
      if (this.isStyleTool && this.styleSubmissionStatus === 'navigation_failed') return '查看生成任务'
      if (this.isStyleTool && this.styleSubmissionStatus === 'submitting') return '正在创建任务...'
      if (this.isStyleTool && this.styleSubmissionStatus === 'task_created') return '正在打开结果...'
      if (!this.isGenerating) return this.generateButtonText
      return this.isPureSceneReplace ? '正在替换场景，请勿关闭页面。' : '生成中...'
    },
    marketingTypes() {
      return MARKETING_TYPES
    },
    pageMaterialTypeOptions() {
      return PAGE_MATERIAL_TYPES
    },
    detailGenerationModules() {
      return DETAIL_GENERATION_MODULES
    },
    standardDetailModules() {
      return STANDARD_DETAIL_MODULES
    },
    detailOutputOrder() {
      return DETAIL_OUTPUT_ORDER
    },
    detailQuickTemplates() {
      return DETAIL_QUICK_TEMPLATES
    },
    activeDetailTemplateName() {
      const template = DETAIL_QUICK_TEMPLATES.find((item) => item.value === this.activeDetailTemplate)
      return template ? `已选择：${template.label}` : ''
    },
    selectedDetailModuleNames() {
      return DETAIL_GENERATION_MODULES
        .filter((item) => this.selectedDetailModules.includes(item.value))
        .map((item) => item.label)
    },
    estimatedDetailOutputCount() {
      return Math.max(1, this.selectedDetailModules.length)
    },
    packageDetailStructure() {
      return PACKAGE_DETAIL_STRUCTURE
    },
    marketingVersionLabel() {
      const labels = {
        ecommerce: '电商版',
        xiaohongshu: '小红书版',
        brand: '品牌版'
      }
      return labels[this.marketingVersion] || '详情页版本'
    },
    posterTypeOptions() {
      return POSTER_TYPES
    },
    seriesTypeOptions() {
      return SERIES_TYPES
    },
    currentColorGroups() {
      return SYSTEM_COLOR_GROUPS
    },
    currentColorOptions() {
      return this.currentColorGroups.flatMap((group) => group.colors || [])
    },
    allColorOptions() {
      return [
        ...SYSTEM_COLOR_GROUPS.flatMap((group) => group.colors || []),
        ...this.colorHistoryOptions,
        ...this.colorExtractedPalette,
        ...(this.eyedropperColor ? [this.eyedropperColor] : [])
      ]
    },
    selectedColor() {
      return this.allColorOptions.find((item) => item.colorId === this.selectedColorId)
        || (this.eyedropperColor && this.eyedropperColor.colorId === this.selectedColorId ? this.eyedropperColor : null)
    },
    currentTargetColor() {
      return normalizeStandardColor(this.selectedColor || {}, this.selectedColor && this.selectedColor.sourceType)
    },
    colorCurrentStep() {
      return this.clothImagePath ? 2 : 1
    },
    colorSourceLabel() {
      const labels = {
        system_palette: '系统颜色',
        custom_picker: '自定义颜色',
        eyedropper_garment: '服装图吸管',
        eyedropper_uploaded: '上传图片吸管',
        dominant_color: '图片主要颜色',
        recent_color: '最近使用'
      }
      return labels[this.currentTargetColor && this.currentTargetColor.sourceType] || '颜色选择'
    },
    usesUploadedColorReference() {
      const source = this.currentTargetColor && this.currentTargetColor.sourceType
      return ['eyedropper_uploaded', 'dominant_color'].includes(source) && Boolean(this.colorReferenceImagePath)
    },
    colorTargetAreaLabel() {
      const area = COLOR_TARGET_AREAS.find((item) => item.value === this.colorTargetArea)
      return area ? (area.value === 'partial' ? '指定局部' : area.label) : '未选择'
    },
    textureRetentionLabel() {
      const option = TEXTURE_RETENTION_OPTIONS.find((item) => item.value === this.textureRetention)
      return option ? option.label : '未选择'
    },
    colorConfigurationSummary() {
      if (!this.currentTargetColor) return '请选择目标颜色'
      return `${this.currentTargetColor.displayName} · ${this.colorTargetAreaLabel} · ${this.textureRetentionLabel}`
    },
    selectedFabric() {
      return FABRIC_REFERENCE_OPTIONS.find((item) => item.value === this.selectedFabricId) || null
    },
    selectedPattern() {
      return PATTERN_REFERENCE_OPTIONS.find((item) => item.value === this.selectedPatternId) || null
    },
    displayTabs() {
      return DISPLAY_TABS
    },
    displayModeTabs() {
      return DISPLAY_TABS.filter((item) => item.value !== 'detail_photo')
    },
    selectedDisplayModeLabels() {
      return this.displayTabs
        .filter((tab) => this.selectedDisplayModes.includes(tab.value))
        .map((tab) => tab.label)
        .join(' / ')
    },
    selectedDisplayModeParamValues() {
      return this.selectedDisplayModes.map((type) => DISPLAY_MODE_PARAM_VALUES[type] || type)
    },
    detailReferenceCategories() {
      return DETAIL_REFERENCE_CATEGORIES
    },
    visibleDetailReferenceOptions() {
      if (this.activeDetailCategory === 'all') {
        return DETAIL_REFERENCE_OPTIONS
      }
      return DETAIL_REFERENCE_OPTIONS.filter((item) => item.category === this.activeDetailCategory)
    },
    displayedDetailReferenceOptions() {
      if (this.activeDetailCategory !== 'all' || this.showAllDetailParts) {
        return this.visibleDetailReferenceOptions
      }
      return COMMON_DETAIL_PART_VALUES
        .map((value) => DETAIL_REFERENCE_OPTIONS.find((item) => item.value === value))
        .filter(Boolean)
    },
    canToggleMoreDetailParts() {
      return this.activeDetailCategory === 'all'
        && this.visibleDetailReferenceOptions.length > this.displayedDetailReferenceOptions.length
    },
    displayModeSelectionSummary() {
      const labels = this.displayModeTabs
        .filter((item) => this.selectedDisplayModes.includes(item.value))
        .map((item) => item.label)
      if (!labels.length) return '尚未选择展示方式'
      if (labels.length === 1) return `当前展示：${labels[0]}`
      if (labels.length <= 3) return `已选：${labels.join('、')}`
      return `已选 ${labels.length} 种展示方式`
    },
    detailPartSelectionSummary() {
      const labels = DETAIL_REFERENCE_OPTIONS
        .filter((item) => this.selectedDetailParts.includes(item.value))
        .map((item) => item.label)
      if (!labels.length) return '尚未选择细节部位'
      if (labels.length <= 3) return `已选：${labels.join('、')}`
      return `已选 ${labels.length} 个细节部位`
    },
    selectedDetailReferenceItems() {
      return DETAIL_REFERENCE_OPTIONS.filter((item) => this.selectedDetailParts.includes(item.value))
    },
    detailSelectionValidation() {
      return validateGarmentDetailSelection({
        selectedDetails: this.selectedDetailReferenceItems,
        detailReferences: this.detailReferenceImages
      })
    },
    detailCountRelationshipText() {
      const count = this.selectedDetailParts.length
      return count
        ? `已选${count}个细节，将生成${count}张独立细节图，预计消耗${count}次`
        : '请选择需要生成的细节'
    },
    displayConfigurationSummary() {
      if (!this.isDisplayTool) return ''
      if (this.isDetailDisplayTool) {
        const count = this.selectedDetailParts.length
        return `${count ? `已选 ${count} 个细节` : '未选细节'} · 预计生成 ${count} 张 · 预计消耗 ${count} 次`
      }
      const modeSummary = this.selectedDisplayModes.length > 1
        ? `已选 ${this.selectedDisplayModes.length} 种展示方式`
        : this.displayModeSelectionSummary
      const groupValues = (this.currentTool.paramGroups || []).map((group) => {
        const option = (group.options || []).find((item) => item.value === this.selectedParams[group.key])
        return option ? option.label : ''
      }).filter(Boolean)
      return [modeSummary, ...groupValues].join(' · ')
    },
    displayGenerateDisabledReason() {
      if (!this.isDisplayTool) return ''
      if (this.displaySubmissionStatus === 'navigation_failed' && this.displayCreatedTaskId) return ''
      if (this.displayImageStatus === 'uploading') return '图片上传中，请稍候'
      if (this.displaySubmissionStatus === 'submitting') return '正在创建任务，请勿重复操作'
      if (this.displaySubmissionStatus === 'task_created') return '任务已创建，正在打开结果页'
      if (this.displaySubmissionStatus === 'submission_unknown') return '提交状态确认中，请前往任务记录确认'
      if (!this.clothImagePath) return '请先上传服装图片'
      if (this.isDetailDisplayTool) {
        if (!this.selectedDetailParts.length) return '请至少选择一个细节部位'
        if (!this.detailSelectionValidation.ok) return this.detailSelectionValidation.message
        return ''
      }
      if (!this.selectedDisplayModes.length) return '请至少选择一种展示方式'
      const missingGroup = (this.currentTool.paramGroups || []).find((group) => !this.selectedParams[group.key])
      if (missingGroup) return `请选择${missingGroup.label}`
      return ''
    },
    displayGenerateButtonText() {
      if (!this.isDisplayTool) return ''
      if (this.displaySubmissionStatus === 'navigation_failed' && this.displayCreatedTaskId) return '查看已创建任务'
      if (this.isGenerating || this.displaySubmissionStatus === 'submitting') return '正在创建任务…'
      return this.displayGenerateDisabledReason || (this.isDetailDisplayTool ? `生成 ${this.selectedDetailParts.length} 张细节图` : '生成服装展示图')
    },
    displaySubmissionNotice() {
      if (!this.isDisplayTool) return ''
      if (this.displaySubmissionStatus === 'navigation_failed') return '任务已创建，但结果页打开失败。再次点击不会重复创建任务。'
      if (this.displaySubmissionStatus === 'submission_unknown') return '提交结果暂不明确，请前往任务记录确认。'
      if (this.displaySubmissionStatus === 'submission_failed') return this.displaySubmissionError || '任务提交失败，请重试。'
      return ''
    },
    currentTool() {
      if (this.isRedesignTool) {
        return createRedesignToolConfig(this.activeRedesignType)
      }
      if (this.isDisplayTool) {
        return createDisplayToolConfig(this.activeDisplayType)
      }
      if (this.isModelTool) {
        const base = TOOL_CONFIGS.model
        const mode = this.currentModelMode
        const selectedFeatures = this.selectedModelFeatures || ['model_display']
        const taskType = selectedFeatures.length === 1 ? mode.taskType : 'model_replace'
        const outputType = selectedFeatures.length === 1 ? mode.outputType : 'model_image'
        return {
          ...base,
          title: 'AI模特',
          description: '上传图片，选择模特展示、换脸、姿势裂变或场景替换。',
          taskType,
          outputType,
          paramTitle: '选择AI模特模式',
          paramTip: '先选择功能，再完成当前功能对应配置。',
          paramGroups: mode.paramGroups || []
        }
      }
      return TOOL_CONFIGS[this.toolType] || TOOL_CONFIGS.model
    },
    currentReferenceOptions() {
      if (this.isModelTool && this.currentModelMode.referenceGroups && this.currentModelMode.referenceGroups.length) {
        return (this.currentModelMode.referenceGroups || []).flatMap((group) => group.items || [])
      }
      if (this.isModelTool) {
        return this.currentModelMode.referenceLibrary || []
      }
      return this.currentTool.referenceLibrary || []
    },
    modelReplacementModes() {
      return MODEL_WORKFLOW_MODES
    },
    currentModelMode() {
      const mode = MODEL_WORKFLOW_MODES.find((item) => item.value === this.modelReplacementMode) || MODEL_WORKFLOW_MODES[0]
      if (mode.value === 'scene_replace') {
        return {
          ...mode,
          libraryTitle: '系统场景库',
          libraryType: 'scene',
          referenceLibrary: SCENE_REFERENCE_LIBRARY
        }
      }
      return mode
    },
    mainUploadTitle() {
      if (this.isModelTool) return this.currentModelMode.uploadTitle
      if (this.isFabricTool) return '上传服装图'
      return '上传服装图片'
    },
    mainUploadDesc() {
      if (this.isModelTool) return this.currentModelMode.uploadDesc
      if (this.isFabricTool) return '支持服装图片、真人展示图'
      return '支持平铺图、人台图、真人图'
    },
    systemModels() {
      return getSystemModels()
    },
    personalModels() {
      return getPersonalModels()
    },
    brandModels() {
      return getBrandModels()
    },
    visibleModels() {
      if (this.modelLibraryType === 'personal') return this.personalModels
      if (this.modelLibraryType === 'brand') return this.brandModels
      if (this.modelLibraryType === 'create') return []
      return this.systemModels
    },
    selectedModel() {
      return [...this.systemModels, ...this.personalModels, ...this.brandModels]
        .find((model) => model.modelId === this.selectedModelId) || null
    },
    recommendedActionNames() {
      if (!this.productionContext || !Array.isArray(this.productionContext.recommendedActions)) {
        return ''
      }
      return this.productionContext.recommendedActions.map((item) => item.title).join(' / ')
    }
  },
  onLoad(query = {}) {
    const localDesignPlans = uni.getStorageSync(STYLE_DESIGN_PLAN_STORAGE_KEY)
    this.savedStyleDesignPlans = Array.isArray(localDesignPlans) ? localDesignPlans : []
    const incomingToolType = String(query.toolType || '').trim()
    this.modelReplaceOnly = ['', 'model', 'model_display', 'face', 'face_replace', 'head_replace'].includes(incomingToolType)
    this.replaceMode = ['face', 'face_replace'].includes(incomingToolType) ? 'face_replace' : 'head_replace'
    this.restoreModelReplacePreference(incomingToolType)
    this.modelEditingStep = 1
    const redesignTypeMap = {
      refine: 'style',
      style: 'style',
      style_redesign: 'style',
      color: 'color',
      fabric: 'fabric',
      pattern: 'pattern'
    }
    const modelModeMap = {
      model: 'model_display',
      model_display: 'model_display',
      face: 'face_replace',
      face_replace: 'face_replace',
      head_replace: 'head_replace',
      pose: 'pose_variation',
      pose_adjust: 'pose_variation',
      pose_variation: 'pose_variation',
      scene: 'scene_replace',
      scene_replace: 'scene_replace'
    }
    if (['clothing', GARMENT_REPLACE_ACTION].includes(incomingToolType)) {
      this.toolType = 'clothing'
    } else if (redesignTypeMap[incomingToolType]) {
      this.activeRedesignType = redesignTypeMap[incomingToolType]
      this.selectedRedesignTypes = [this.activeRedesignType]
      this.toolType = incomingToolType === 'style' || incomingToolType === 'style_redesign' ? 'refine' : incomingToolType
    } else if (DISPLAY_TOOL_TYPES.includes(incomingToolType)) {
      this.toolType = incomingToolType
      this.activeDisplayType = incomingToolType
      this.selectedDisplayModes = [incomingToolType]
    } else if (modelModeMap[incomingToolType]) {
      this.toolType = 'model'
      this.modelReplacementMode = modelModeMap[incomingToolType]
      this.selectedModelFeatures = [this.modelReplacementMode]
    } else {
      this.toolType = TOOL_CONFIGS[incomingToolType] ? incomingToolType : 'model'
    }
    if (this.isStyleTool && this.genericRuntimeConfig.isInternalDebug) this.styleOutputCount = 1
    if (this.isGarmentTool) {
      uni.setNavigationBarTitle({ title: 'AI换衣服' })
    } else if (this.isPureSceneReplace) {
      uni.setNavigationBarTitle({ title: '换场景' })
    } else if (this.isDedicatedModelTool) {
      uni.setNavigationBarTitle({ title: 'AI模特' })
    } else if (this.toolType === 'fabric') {
      uni.setNavigationBarTitle({ title: '换面料' })
    } else if (this.toolType === 'pattern') {
      uni.setNavigationBarTitle({ title: '换图案' })
    } else if (this.toolType === 'color') {
      uni.setNavigationBarTitle({ title: '换颜色' })
    } else if (this.isDisplayTool) {
      uni.setNavigationBarTitle({ title: this.isDetailDisplayTool ? '服装细节图' : '服装展示图' })
    }
    this.resetSelectedParams()
    this.restoreProductionContext(query.productionContextId || '')
    this.restoreContinueContext(query)
    if (this.isGarmentTool) this.initializeGarmentDraft(query)
    if (this.isPureSceneReplace) this.initializeScenePreferences()
    this.ensureSelectedModel()
    if (this.isStyleTool) {
      uni.setNavigationBarTitle({ title: '改款式' })
      this.initializeStyleDraft(query)
      this.stabilizeIncomingStyleImages()
      this.loadStyleMembershipUsage()
      this.trackStyleRedesignEvent('page_view', { status: 'ready' })
    }
    if (this.isColorTool) {
      this.reloadColorLibraries()
      this.initializeColorDraft(query)
      this.stabilizeIncomingColorImages()
    }
    if (this.isPatternTool) this.initializePatternDraft()
    if (this.isDisplayTool) {
      this.displayImageStatus = this.clothImagePath ? 'ready' : 'empty'
      this.lastDisplayModes = this.selectedDisplayModes.filter((item) => item !== 'detail_photo')
      if (!this.lastDisplayModes.length) this.lastDisplayModes = ['flat_lay']
      this.initializeDisplayDraft()
    }
  },
  onShow() {
    this.runtimeConfigRevision += 1
    refreshFeatureRuntimeBackendState().then(() => {
      this.runtimeConfigRevision += 1
    })
    if (this.isStyleTool) {
      this.styleKeyboardActive = false
      this.loadStyleMembershipUsage()
    }
    if (this.isColorTool) {
      this.colorKeyboardActive = false
      this.reloadColorLibraries()
    }
    if (this.isPatternTool) this.patternKeyboardActive = false
    if (this.isDisplayTool) this.displayKeyboardActive = false
    if (this.isDedicatedModelTool || this.isGarmentTool) this.loadModelProfiles()
  },
  onUnload() {
    if (this.isDedicatedModelTool) this.saveModelReplacePreference()
    if (this.isGarmentTool && this.garmentSubmissionStatus !== 'navigated') this.saveGarmentDraft()
    if (this.isStyleTool && this.styleSubmissionStatus !== 'navigated') this.saveStyleDraft()
    if (this.isColorTool && this.colorSubmissionStatus !== 'navigated') this.saveColorDraft()
    if (this.isPatternTool && this.patternSubmissionStatus !== 'navigated') this.savePatternDraft()
    if (this.isDisplayTool && this.displaySubmissionStatus !== 'navigated') this.saveDisplayDraft()
  },
  methods: {
    restoreModelReplacePreference(incomingToolType = '') {
      const explicitMode = ['face', 'face_replace', 'head_replace'].includes(String(incomingToolType || '').trim())
      if (explicitMode) return
      try {
        const preference = uni.getStorageSync(MODEL_REPLACE_PREFERENCE_STORAGE_KEY)
        const savedMode = preference && typeof preference === 'object' ? preference.replaceMode : preference
        if (['head_replace', 'face_replace'].includes(savedMode)) this.replaceMode = savedMode
      } catch (error) {}
    },
    saveModelReplacePreference() {
      if (!['head_replace', 'face_replace'].includes(this.replaceMode)) return
      try {
        uni.setStorageSync(MODEL_REPLACE_PREFERENCE_STORAGE_KEY, {
          replaceMode: this.replaceMode,
          updatedAt: Date.now()
        })
      } catch (error) {}
    },
    reloadColorLibraries(shouldSyncCloud = true) {
      this.colorHistoryOptions = getColorHistory().map((color) => normalizeStandardColor(color, 'recent_color')).filter(Boolean)
      if (!shouldSyncCloud) return
      syncRecentColors().then((colors) => {
        this.colorHistoryOptions = (Array.isArray(colors) ? colors : [])
          .map((color) => normalizeStandardColor(color, 'recent_color'))
          .filter(Boolean)
      }).catch(() => {})
    },
    initializeGarmentDraft(query = {}) {
      this.reloadGarmentAccessoryLibrary()
      let draft = null
      try {
        draft = uni.getStorageSync(GARMENT_REPLACE_DRAFT_STORAGE_KEY)
      } catch (error) {
        draft = null
      }
      if (draft && typeof draft === 'object') {
        this.garmentCurrentStep = Math.min(4, Math.max(1, Number(draft.currentStep) || 1))
        this.garmentPersonSource = draft.personSource === 'profiles' ? 'profiles' : 'upload'
        this.garmentUploadedPersonImage = this.isRemoteTaskImage(draft.uploadedPersonImage) ? draft.uploadedPersonImage : ''
        this.garmentSelectedModelProfileId = String(draft.selectedModelProfileId || '')
        this.garmentReplaceMode = Object.values(GARMENT_REPLACE_MODES).includes(draft.replaceMode)
          ? draft.replaceMode
          : GARMENT_REPLACE_MODES.FULL_OUTFIT
        this.garmentPersonImage = this.isRemoteTaskImage(draft.personImage) ? draft.personImage : this.garmentUploadedPersonImage
        this.garmentUpperImage = this.isRemoteTaskImage(draft.upperGarment) ? draft.upperGarment : ''
        this.garmentLowerImage = this.isRemoteTaskImage(draft.lowerGarment) ? draft.lowerGarment : ''
        this.garmentOutfitImage = this.isRemoteTaskImage(draft.outfitGarment) ? draft.outfitGarment : ''
        this.garmentAccessories = Array.isArray(draft.accessories)
          ? draft.accessories.filter((item) => item && ACCESSORY_TYPES.some((type) => type.value === item.type) && this.isRemoteTaskImage(item.imageUrl))
          : []
        this.garmentSelectedAccessoryTypes = Array.isArray(draft.selectedAccessoryTypes)
          ? draft.selectedAccessoryTypes.filter((type) => ACCESSORY_TYPES.some((item) => item.value === type)).slice(0, this.garmentAccessoryLimit)
          : this.garmentAccessories.map((item) => item.type).slice(0, this.garmentAccessoryLimit)
        this.garmentPreserve = { ...this.garmentPreserve, ...(draft.preserve || {}) }
      }
      const continuedSource = String(this.clothImagePath || query.sourceImage || query.sourceImageUrl || '').trim()
      if (this.isRemoteTaskImage(continuedSource)) {
        this.garmentPersonSource = 'upload'
        this.garmentUploadedPersonImage = continuedSource
        this.garmentPersonImage = continuedSource
      }
      this.syncGarmentUploadStatuses()
    },
    syncGarmentUploadStatuses() {
      this.garmentUploadStatus = {
        person: this.garmentPersonImage ? 'ready' : 'empty',
        upper: this.garmentUpperImage ? 'ready' : 'empty',
        lower: this.garmentLowerImage ? 'ready' : 'empty',
        outfit: this.garmentOutfitImage ? 'ready' : 'empty'
      }
      this.garmentAccessoryUploadStatus = this.garmentAccessories.reduce((status, item) => ({ ...status, [item.type]: 'ready' }), {})
    },
    saveGarmentDraft() {
      const draft = {
        version: 3,
        currentStep: this.garmentCurrentStep,
        personSource: this.garmentPersonSource,
        uploadedPersonImage: this.isRemoteTaskImage(this.garmentUploadedPersonImage) ? this.garmentUploadedPersonImage : '',
        selectedModelProfileId: this.garmentSelectedModelProfileId,
        replaceMode: this.garmentReplaceMode,
        personImage: this.isRemoteTaskImage(this.garmentPersonImage) ? this.garmentPersonImage : '',
        upperGarment: this.isRemoteTaskImage(this.garmentUpperImage) ? this.garmentUpperImage : '',
        lowerGarment: this.isRemoteTaskImage(this.garmentLowerImage) ? this.garmentLowerImage : '',
        outfitGarment: this.isRemoteTaskImage(this.garmentOutfitImage) ? this.garmentOutfitImage : '',
        selectedAccessoryTypes: this.garmentSelectedAccessoryTypes.slice(0, this.garmentAccessoryLimit),
        accessories: this.garmentAccessories.filter((item) => item && this.isRemoteTaskImage(item.imageUrl)),
        preserve: { ...this.garmentPreserve },
        updatedAt: Date.now()
      }
      if (draft.personImage || draft.upperGarment || draft.lowerGarment || draft.outfitGarment || draft.accessories.length) {
        uni.setStorageSync(GARMENT_REPLACE_DRAFT_STORAGE_KEY, draft)
      }
    },
    clearGarmentDraft() {
      try {
        uni.removeStorageSync(GARMENT_REPLACE_DRAFT_STORAGE_KEY)
      } catch (error) {
        // Storage cleanup is best-effort after the task has been created.
      }
    },
    selectGarmentReplaceMode(mode = GARMENT_REPLACE_MODES.UPPER_ONLY) {
      if (!Object.values(GARMENT_REPLACE_MODES).includes(mode)) return
      this.garmentReplaceMode = mode
      if (this.garmentSelectedAccessoryTypes.length > this.garmentAccessoryLimit) {
        this.garmentSelectedAccessoryTypes = this.garmentSelectedAccessoryTypes.slice(0, this.garmentAccessoryLimit)
        uni.showToast({ title: this.garmentAccessoryLimit ? `当前模式最多添加 ${this.garmentAccessoryLimit} 件配饰` : '当前模式暂不能添加配饰', icon: 'none' })
      }
      this.garmentSubmissionError = ''
      this.garmentSubmissionStatus = 'idle'
      this.saveGarmentDraft()
    },
    goToGarmentStep(step = 1) {
      this.garmentCurrentStep = Math.min(4, Math.max(1, Number(step) || 1))
      this.saveGarmentDraft()
      uni.pageScrollTo({ scrollTop: 0, duration: 180 })
    },
    nextGarmentStep() {
      if (this.garmentStepDisabledReason) {
        uni.showToast({ title: this.garmentStepDisabledReason, icon: 'none' })
        return
      }
      this.goToGarmentStep(this.garmentCurrentStep + 1)
    },
    previousGarmentStep() {
      this.goToGarmentStep(this.garmentCurrentStep - 1)
    },
    selectGarmentPersonSource(source = 'upload') {
      if (!['upload', 'profiles'].includes(source)) return
      this.garmentPersonSource = source
      if (source === 'upload') {
        this.garmentPersonImage = this.garmentUploadedPersonImage
      } else {
        const profile = this.myModelProfiles.find((item) => item.modelProfileId === this.garmentSelectedModelProfileId)
        this.garmentPersonImage = profile ? String(profile.coverFileId || profile.coverUrl || '') : ''
      }
      this.syncGarmentUploadStatuses()
      this.saveGarmentDraft()
    },
    selectGarmentModelProfile(profile = {}) {
      if (!profile.modelProfileId || profile.status !== 'active') return
      const image = String(profile.coverFileId || profile.coverUrl || '')
      if (!this.isRemoteTaskImage(image)) {
        uni.showToast({ title: '该常用模特图片暂不可用', icon: 'none' })
        return
      }
      this.garmentPersonSource = 'profiles'
      this.garmentSelectedModelProfileId = profile.modelProfileId
      this.garmentPersonImage = image
      this.garmentUploadStatus = { ...this.garmentUploadStatus, person: 'ready' }
      this.garmentUploadErrors = { ...this.garmentUploadErrors, person: '' }
      this.saveGarmentDraft()
    },
    reloadGarmentAccessoryLibrary() {
      this.garmentAccessoryLibrary = getAccessories()
    },
    getGarmentAccessoryLabel(type = '') {
      const item = ACCESSORY_TYPES.find((entry) => entry.value === type)
      return (item && item.label) || '配饰'
    },
    getGarmentAccessoryByType(type = '') {
      return this.garmentAccessories.find((item) => item.type === type) || null
    },
    getGarmentAccessoryLibraryItems(type = '') {
      return this.garmentAccessoryLibrary.filter((item) => item.type === type)
    },
    toggleGarmentAccessoryType(type = 'shoes') {
      if (!ACCESSORY_TYPES.some((item) => item.value === type)) return
      if (this.garmentSelectedAccessoryTypes.includes(type)) {
        this.garmentSelectedAccessoryTypes = this.garmentSelectedAccessoryTypes.filter((item) => item !== type)
      } else {
        if (this.garmentSelectedAccessoryTypes.length >= this.garmentAccessoryLimit) {
          uni.showToast({ title: this.garmentAccessoryLimit ? `当前模式最多选择 ${this.garmentAccessoryLimit} 件配饰` : '当前模式暂不能添加配饰', icon: 'none' })
          return
        }
        this.garmentSelectedAccessoryTypes = [...this.garmentSelectedAccessoryTypes, type]
      }
      this.garmentAccessoryType = type
      this.garmentSubmissionError = ''
      this.saveGarmentDraft()
    },
    selectGarmentAccessory(item = {}) {
      if (!item.imageUrl || !this.isRemoteTaskImage(item.imageUrl)) return
      const type = item.type || this.garmentAccessoryType
      if (!this.garmentSelectedAccessoryTypes.includes(type)) {
        if (this.garmentSelectedAccessoryTypes.length >= this.garmentAccessoryLimit) return
        this.garmentSelectedAccessoryTypes = [...this.garmentSelectedAccessoryTypes, type]
      }
      this.garmentAccessoryType = type
      const selected = {
        accessoryId: item.accessoryId || '',
        type,
        name: item.name || this.getGarmentAccessoryLabel(type),
        imageUrl: item.imageUrl
      }
      this.garmentAccessories = [...this.garmentAccessories.filter((entry) => entry.type !== type), selected]
      this.garmentAccessoryUploadStatus = { ...this.garmentAccessoryUploadStatus, [type]: 'ready' }
      this.garmentAccessoryUploadErrors = { ...this.garmentAccessoryUploadErrors, [type]: '' }
      this.garmentSubmissionError = ''
      this.saveGarmentDraft()
    },
    chooseGarmentAccessoryImage(type = '') {
      if (!this.garmentSelectedAccessoryTypes.includes(type)) return
      if (!this.garmentAccessoryAvailable) {
        uni.showToast({ title: '当前换装方式暂不能添加配饰', icon: 'none' })
        return
      }
      if (this.garmentAccessoryUploadStatus[type] === 'uploading') return
      this.garmentAccessoryType = type
      uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: async (response) => {
          const path = (response.tempFilePaths || [])[0] || ''
          const file = (response.tempFiles || [])[0] || { path }
          if (!path) return
          const previous = this.getGarmentAccessoryByType(type)
          this.garmentAccessoryUploadStatus = { ...this.garmentAccessoryUploadStatus, [type]: 'uploading' }
          this.garmentAccessoryUploadErrors = { ...this.garmentAccessoryUploadErrors, [type]: '' }
          try {
            const uploaded = await this.validateAndUploadStyleImage(file, path, `garment_accessory_${type}`)
            const saved = saveAccessory({
              type,
              name: this.getGarmentAccessoryLabel(type),
              imageUrl: uploaded.url
            })
            this.reloadGarmentAccessoryLibrary()
            this.selectGarmentAccessory(saved)
            uni.showToast({ title: '配饰已加入配饰库', icon: 'success' })
          } catch (error) {
            this.garmentAccessories = [...this.garmentAccessories.filter((entry) => entry.type !== type), ...(previous ? [previous] : [])]
            this.garmentAccessoryUploadStatus = { ...this.garmentAccessoryUploadStatus, [type]: previous ? 'ready' : 'error' }
            const message = error && error.message && /^配饰/.test(error.message)
              ? error.message
              : this.getStyleImageErrorMessage(error)
            this.garmentAccessoryUploadErrors = { ...this.garmentAccessoryUploadErrors, [type]: message }
            uni.showToast({ title: message, icon: 'none' })
          }
        }
      })
    },
    clearGarmentAccessorySelection(type = '') {
      this.garmentAccessories = this.garmentAccessories.filter((item) => item.type !== type)
      this.garmentAccessoryUploadStatus = { ...this.garmentAccessoryUploadStatus, [type]: 'empty' }
      this.garmentAccessoryUploadErrors = { ...this.garmentAccessoryUploadErrors, [type]: '' }
      this.garmentSubmissionStatus = 'idle'
      this.saveGarmentDraft()
    },
    deleteGarmentAccessory(item = {}) {
      if (!item.accessoryId) return
      uni.showModal({
        title: '删除配饰',
        content: '仅删除本机配饰库引用，不会删除已创建的任务和作品。',
        success: (response) => {
          if (!response.confirm) return
          removeAccessory(item.accessoryId)
          const selected = this.garmentAccessories.find((entry) => entry.accessoryId === item.accessoryId)
          if (selected) {
            this.clearGarmentAccessorySelection(selected.type)
          }
          this.reloadGarmentAccessoryLibrary()
        }
      })
    },
    toggleGarmentPreserve(key = '') {
      if (!Object.prototype.hasOwnProperty.call(this.garmentPreserve, key)) return
      this.garmentPreserve = { ...this.garmentPreserve, [key]: !this.garmentPreserve[key] }
      this.saveGarmentDraft()
    },
    getGarmentImageField(kind = '') {
      return {
        person: 'garmentPersonImage',
        upper: 'garmentUpperImage',
        lower: 'garmentLowerImage',
        outfit: 'garmentOutfitImage'
      }[kind] || ''
    },
    chooseGarmentImage(kind = '') {
      const field = this.getGarmentImageField(kind)
      if (!field || this.garmentUploadStatus[kind] === 'uploading') return
      uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: async (response) => {
          const path = (response.tempFilePaths || [])[0] || ''
          const file = (response.tempFiles || [])[0] || { path }
          if (!path) return
          const previous = this[field]
          this.garmentUploadStatus = { ...this.garmentUploadStatus, [kind]: 'uploading' }
          this.garmentUploadErrors = { ...this.garmentUploadErrors, [kind]: '' }
          try {
            const uploaded = await this.validateAndUploadStyleImage(file, path, `garment_replace_${kind}`)
            this[field] = uploaded.url
            if (kind === 'person') {
              this.garmentPersonSource = 'upload'
              this.garmentUploadedPersonImage = uploaded.url
              this.garmentSelectedModelProfileId = ''
            }
            this.garmentUploadStatus = { ...this.garmentUploadStatus, [kind]: 'ready' }
            this.garmentSubmissionStatus = 'idle'
            this.garmentSubmissionError = ''
            this.garmentCreatedTaskId = ''
            this.saveGarmentDraft()
            uni.showToast({ title: '图片已上传', icon: 'success' })
          } catch (error) {
            this[field] = previous
            const message = this.getStyleImageErrorMessage(error)
            this.garmentUploadStatus = { ...this.garmentUploadStatus, [kind]: previous ? 'ready' : 'error' }
            this.garmentUploadErrors = { ...this.garmentUploadErrors, [kind]: message }
            uni.showToast({ title: message, icon: 'none' })
          }
        }
      })
    },
    removeGarmentImage(kind = '') {
      const field = this.getGarmentImageField(kind)
      if (!field) return
      this[field] = ''
      if (kind === 'person') {
        this.garmentUploadedPersonImage = ''
        this.garmentSelectedModelProfileId = ''
      }
      this.garmentUploadStatus = { ...this.garmentUploadStatus, [kind]: 'empty' }
      this.garmentUploadErrors = { ...this.garmentUploadErrors, [kind]: '' }
      this.garmentSubmissionStatus = 'idle'
      this.garmentCreatedTaskId = ''
      this.saveGarmentDraft()
    },
    navigateToGarmentTask(taskId = '') {
      if (!taskId) return
      uni.navigateTo({
        url: `/package-ai/result/result?taskId=${encodeURIComponent(taskId)}`,
        success: () => {
          this.garmentSubmissionStatus = 'navigated'
        },
        fail: () => {
          this.garmentSubmissionStatus = 'navigation_failed'
          this.garmentSubmissionError = '任务已创建，可点击按钮继续查看结果。'
          uni.showToast({ title: '任务已创建，结果页打开失败', icon: 'none' })
        }
      })
    },
    async startGarmentReplace() {
      if (this.garmentSubmissionStatus === 'navigation_failed' && this.garmentCreatedTaskId) {
        this.navigateToGarmentTask(this.garmentCreatedTaskId)
        return
      }
      if (this.garmentSubmissionStatus === 'submitting' || this.isGenerating) return
      const validation = validateGarmentReplaceInput(this.garmentContractSource)
      if (!validation.ok) {
        this.garmentSubmissionError = validation.message
        uni.showToast({ title: validation.message, icon: 'none' })
        return
      }
      const runtime = this.garmentRuntimeConfig
      const capability = validateGarmentProviderCapability(GARMENT_REPLACE_ACTION, validation.input.replaceMode)
      const experimentalCapability = validateExperimentalGarmentProviderCapability(GARMENT_REPLACE_ACTION, validation.input.replaceMode)
      if (!runtime.canSubmit || (!runtime.usesMock && !runtime.realProviderTest && !capability.ok) || (runtime.realProviderTest && !experimentalCapability.ok)) {
        this.garmentSubmissionError = runtime.disabledReason || (runtime.realProviderTest ? experimentalCapability.message : capability.message) || '当前运行环境未开放换衣服任务。'
        uni.showToast({ title: this.garmentSubmissionError, icon: 'none' })
        return
      }

      this.garmentSubmissionStatus = 'submitting'
      this.garmentSubmissionError = ''
      this.garmentCreatedTaskId = ''
      this.isGenerating = true
      let quotaRecordId = ''
      try {
        const normalized = validation.input
        const testMetadata = buildTestTaskMetadata(runtime)
        const clientTaskId = runtime.realProviderTest ? createQuotaAlphaTaskId() : ''
        const quota = runtime.realProviderTest
          ? await consumeQuota({ taskId: clientTaskId, action: GARMENT_REPLACE_TASK_TYPE, count: 1 })
          : null
        quotaRecordId = quota ? quota.quotaRecordId : ''
        const params = {
          actionType: GARMENT_REPLACE_ACTION,
          taskType: GARMENT_REPLACE_TASK_TYPE,
          toolType: 'clothing',
          garmentMode: normalized.replaceMode,
          replaceMode: normalized.replaceMode,
          modelImage: normalized.personImage,
          personImage: normalized.personImage,
          personImageUrl: normalized.personImage,
          ...(normalized.upperGarment ? { topGarmentImage: normalized.upperGarment, upperGarment: normalized.upperGarment, upperGarmentUrl: normalized.upperGarment } : {}),
          ...(normalized.lowerGarment ? { bottomGarmentImage: normalized.lowerGarment, lowerGarment: normalized.lowerGarment, lowerGarmentUrl: normalized.lowerGarment } : {}),
          ...(normalized.outfitGarment ? { onePieceGarmentImage: normalized.outfitGarment, outfitGarment: normalized.outfitGarment, outfitGarmentUrl: normalized.outfitGarment } : {}),
          ...(normalized.accessoryReferences.length ? { accessoryImages: normalized.accessoryReferences, accessoryReferences: normalized.accessoryReferences } : {}),
          preserveFace: normalized.preservePerson,
          preserveIdentity: true,
          preserveHair: true,
          preserveBody: true,
          preservePerson: normalized.preservePerson,
          preservePose: normalized.preservePose,
          preserveBackground: normalized.preserveBackground,
          preserveScene: true,
          preserveComposition: true,
          preserveGarmentColor: true,
          preserveGarmentPattern: true,
          preserveGarmentDetails: true,
          preserveUnchangedGarment: normalized.preserveUnchangedGarment,
          costActionType: GARMENT_REPLACE_TASK_TYPE,
          planId: 'garment_replace',
          planName: 'AI换衣服',
          outputUsage: '换装效果图',
          ...(clientTaskId ? { idempotencyKey: clientTaskId } : {}),
          ...(quota ? {
            quotaRecordId: quota.quotaRecordId,
            quotaRecordStatus: quota.quotaRecordStatus,
            quotaIdempotencyKey: quota.idempotencyKey,
            estimatedCost: quota.cost
          } : {}),
          ...testMetadata
        }
        const taskOptions = {
          ...(clientTaskId ? { taskId: clientTaskId, clientTaskId } : {}),
          type: GARMENT_REPLACE_TASK_TYPE,
          taskType: GARMENT_REPLACE_TASK_TYPE,
          channel: 'simple_ai_workbench',
          provider: testMetadata.provider,
          mock: testMetadata.isMock,
          run: { fallbackToMock: false },
          input: {
            imageUrl: normalized.personImage,
            image_url: normalized.personImage,
            assets: {
              modelImage: this.buildTaskImageAsset(normalized.personImage, normalized.personImage),
              personImage: this.buildTaskImageAsset(normalized.personImage, normalized.personImage),
              ...(normalized.upperGarment ? { topGarmentImage: this.buildTaskImageAsset(normalized.upperGarment, normalized.upperGarment), upperGarment: this.buildTaskImageAsset(normalized.upperGarment, normalized.upperGarment) } : {}),
              ...(normalized.lowerGarment ? { bottomGarmentImage: this.buildTaskImageAsset(normalized.lowerGarment, normalized.lowerGarment), lowerGarment: this.buildTaskImageAsset(normalized.lowerGarment, normalized.lowerGarment) } : {}),
              ...(normalized.outfitGarment ? { onePieceGarmentImage: this.buildTaskImageAsset(normalized.outfitGarment, normalized.outfitGarment), outfitGarment: this.buildTaskImageAsset(normalized.outfitGarment, normalized.outfitGarment) } : {}),
              ...(normalized.accessoryReferences.length ? {
                accessoryImages: normalized.accessoryReferences.map((item) => ({
                  accessoryId: item.accessoryId,
                  type: item.type,
                  name: item.name,
                  ...this.buildTaskImageAsset(item.imageUrl, item.imageUrl)
                })),
                accessoryReferences: normalized.accessoryReferences.map((item) => ({
                  accessoryId: item.accessoryId,
                  type: item.type,
                  name: item.name,
                  ...this.buildTaskImageAsset(item.imageUrl, item.imageUrl)
                }))
              } : {})
            },
            params,
            options: {
              outputType: 'garment_replace_image',
              preserveIdentity: true,
              preserveFace: normalized.preservePerson,
              preserveHair: true,
              preserveBody: true,
              preservePose: normalized.preservePose,
              preserveBackground: normalized.preserveBackground,
              preserveScene: true,
              preserveComposition: true,
              preserveGarmentColor: true,
              preserveGarmentPattern: true,
              preserveGarmentDetails: true,
              preserveUnchangedGarment: normalized.preserveUnchangedGarment,
              previewOnly: false,
              reviewStatus: runtime.isTestStage ? 'needs_review' : '',
              deliveryEligible: testMetadata.deliveryEligible
            }
          },
          params
        }
        const task = runtime.usesMock
          ? createTaskAndSimulate({ ...taskOptions, simulate: { delay: 900 } })
          : createGenerationTaskAndRun(taskOptions)
        if (!task || !task.taskId) throw new Error('TASK_CREATE_INVALID')
        if (quotaRecordId) settleQuotaByTask({ taskId: task.taskId, quotaRecordId })
        this.garmentCreatedTaskId = task.taskId
        this.garmentSubmissionStatus = 'task_created'
        normalized.accessoryReferences.forEach((item) => markAccessoryUsed(item.accessoryId))
        this.clearGarmentDraft()
        if (isSceneReplaceDevelopment()) {
          console.info('[garment-replace:task]', {
            actionType: GARMENT_REPLACE_ACTION,
            replaceMode: normalized.replaceMode,
            hasPersonImage: true,
            hasUpperGarment: Boolean(normalized.upperGarment),
            hasLowerGarment: Boolean(normalized.lowerGarment),
            hasOutfitGarment: Boolean(normalized.outfitGarment),
            accessoryReferenceCount: normalized.accessoryReferences.length,
            environment: runtime.stage,
            provider: testMetadata.provider,
            capabilityStatus: runtime.capabilityStatus,
            isMock: testMetadata.isMock,
            success: true,
            errorCode: ''
          })
        }
        this.navigateToGarmentTask(task.taskId)
      } catch (error) {
        if (quotaRecordId) {
          try { await rollbackQuota(quotaRecordId, 'garment_task_create_failed') } catch (rollbackError) {}
        }
        this.garmentSubmissionStatus = 'failed'
        this.garmentSubmissionError = '换衣服任务创建失败，请保留当前图片后重试。'
        uni.showToast({ title: this.garmentSubmissionError, icon: 'none' })
      } finally {
        this.isGenerating = false
      }
    },
    initializeScenePreferences() {
      this.reloadMyScenes()
      const lastScene = getLastSelectedScene()
      this.selectedMySceneId = lastScene && lastScene.isDurable ? lastScene.sceneId : ''
      this.selectedSystemSceneId = this.selectedSceneTemplateId || ''
      this.sceneBackgroundTab = 'system'
      this.applyActiveSceneSelection()
    },
    reloadMyScenes() {
      this.myScenes = getSavedMyScenes()
    },
    selectSceneBackgroundTab(value = 'system') {
      if (!['system', 'user'].includes(value)) return
      this.sceneBackgroundTab = value
      this.applyActiveSceneSelection()
    },
    selectSceneMode(mode = 'generative_reference') {
      if (!['exact_composite', 'generative_reference'].includes(mode)) return
      if (mode === 'exact_composite' && !this.sceneReferenceImagePath) {
        uni.showToast({ title: '精确替换需要先上传自定义场景图', icon: 'none' })
        return
      }
      this.sceneMode = mode
      this.applySceneParams()
    },
    applyActiveSceneSelection() {
      if (this.sceneBackgroundTab === 'system') {
        const selected = this.sceneSystemTemplates.find((item) => item.value === this.selectedSystemSceneId)
        if (selected) {
          this.selectSystemScene(selected)
          return
        }
        this.selectedSceneTemplateId = ''
        this.sceneReferenceImagePath = ''
        this.sceneReferenceUploadedUrl = ''
        this.sceneReferenceName = ''
        this.sceneReferencePrompt = ''
        this.applySceneParams()
        return
      }

      const selected = this.myScenes.find((item) => item.sceneId === this.selectedMySceneId)
      if (selected && selected.isDurable) {
        this.selectMyScene(selected)
        return
      }
      this.selectedSceneTemplateId = ''
      this.sceneReferenceImagePath = ''
      this.sceneReferenceUploadedUrl = ''
      this.sceneReferenceName = ''
      this.sceneReferencePrompt = ''
      this.applySceneParams()
    },
    selectSystemScene(item = {}) {
      const templateId = String(item.value || '').trim()
      if (!templateId) return
      this.selectedSystemSceneId = templateId
      this.selectedSceneTemplateId = templateId
      this.sceneReferenceImagePath = ''
      this.sceneReferenceUploadedUrl = ''
      this.sceneReferenceStyle = templateId
      this.sceneReferenceName = item.label || ''
      this.sceneReferencePrompt = item.prompt || ''
      this.sceneMode = 'generative_reference'
      this.applySceneParams()
    },
    getMyScenePreview(scene = {}) {
      return scene.previewUrl || scene.cloudFileId || scene.localPath || ''
    },
    selectMyScene(scene = {}) {
      if (!scene.sceneId) return
      if (!scene.isDurable) {
        uni.showToast({ title: '该场景图片已失效，请重新上传。', icon: 'none' })
        return
      }
      const taskImage = String(scene.cloudFileId || scene.previewUrl || '').trim()
      const previewImage = String(this.getMyScenePreview(scene) || '').trim()
      if (!taskImage || !previewImage) {
        uni.showToast({ title: '该场景图片已失效，请重新上传。', icon: 'none' })
        return
      }
      this.selectedMySceneId = scene.sceneId
      this.selectedSceneTemplateId = ''
      this.sceneReferenceImagePath = previewImage
      this.sceneReferenceUploadedUrl = taskImage
      this.sceneReferenceStyle = 'user_scene'
      this.sceneReferenceName = scene.name || '我的场景'
      this.sceneReferencePrompt = scene.prompt || `参考${this.sceneReferenceName}的空间、材质、色调和光线替换背景`
      this.sceneMode = 'exact_composite'
      setLastSelectedScene(scene.sceneId)
      this.applySceneParams()
    },
    markScenePreviewFailed(sceneId = '') {
      if (!sceneId) return
      if (typeof this.$set === 'function') this.$set(this.scenePreviewFallbacks, sceneId, true)
      else this.scenePreviewFallbacks = { ...this.scenePreviewFallbacks, [sceneId]: true }
    },
    addMySceneImage() {
      if (this.isSceneUploading) return
      if (this.myScenes.length >= MAX_MY_SCENES) {
        uni.showToast({ title: '最多保存 20 个常用场景，请先删除不需要的场景。', icon: 'none' })
        return
      }
      uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: async (response) => {
          const localPath = (response.tempFilePaths || [])[0] || ''
          if (!localPath) {
            this.sceneUploadError = '场景图片上传失败，请重试。'
            return
          }
          this.isSceneUploading = true
          this.sceneUploadError = ''
          try {
            const uploaded = await uploadImage({ filePath: localPath, scene: 'scene_preference' })
            const cloudFileId = String(uploaded && (uploaded.fileId || uploaded.fileID || '') || '').trim()
            const previewUrl = String(uploaded && (uploaded.fileUrl || uploaded.imageUrl || uploaded.url || cloudFileId) || '').trim()
            if (!cloudFileId && !/^https:\/\//i.test(previewUrl)) {
              const uploadError = new Error('Scene upload did not return a durable URL')
              uploadError.code = 'SCENE_REMOTE_REQUIRED'
              throw uploadError
            }
            const saved = saveMyScene({
              name: `我的场景 ${this.myScenes.length + 1}`,
              localPath,
              cloudFileId,
              previewUrl,
              prompt: '参考上传场景的空间、材质、色调和光线替换背景，保持人物与服装主体不变'
            })
            this.reloadMyScenes()
            this.sceneBackgroundTab = 'user'
            this.selectMyScene(saved)
            uni.showToast({
              title: saved.duplicate ? '该场景已保存，已为你选中' : '场景已保存',
              icon: 'success'
            })
          } catch (error) {
            const errorCode = String((error && error.code) || '')
            if (errorCode === 'SCENE_LIMIT_REACHED') {
              this.sceneUploadError = '场景数量已达上限。'
            } else {
              this.sceneUploadError = '场景图片上传失败，请重试。'
            }
            uni.showToast({ title: this.sceneUploadError, icon: 'none' })
          } finally {
            this.isSceneUploading = false
          }
        },
        fail: () => {
          this.sceneUploadError = '场景图片上传失败，请重试。'
        }
      })
    },
    openMySceneActions(scene = {}) {
      if (!scene.sceneId) return
      uni.showActionSheet({
        itemList: ['重命名', '删除'],
        success: (result) => {
          if (result.tapIndex === 0) this.renameMyScene(scene)
          if (result.tapIndex === 1) this.confirmRemoveMyScene(scene)
        }
      })
    },
    renameMyScene(scene = {}) {
      uni.showModal({
        title: '重命名场景',
        editable: true,
        placeholderText: '输入场景名称',
        content: scene.name || '',
        success: (result) => {
          if (!result.confirm) return
          const name = String(result.content || '').trim()
          if (!name) {
            uni.showToast({ title: '请输入场景名称', icon: 'none' })
            return
          }
          updateSceneName(scene.sceneId, name)
          this.reloadMyScenes()
          if (this.selectedMySceneId === scene.sceneId) {
            const selected = this.myScenes.find((item) => item.sceneId === scene.sceneId)
            if (selected) this.selectMyScene(selected)
          }
        }
      })
    },
    confirmRemoveMyScene(scene = {}) {
      uni.showModal({
        title: '删除场景',
        content: `确定删除“${scene.name || '该场景'}”吗？已生成作品不会受影响。`,
        confirmColor: '#dc2626',
        success: (result) => {
          if (!result.confirm) return
          const removingSelected = this.selectedMySceneId === scene.sceneId
          removeSavedScene(scene.sceneId)
          this.reloadMyScenes()
          if (removingSelected) {
            this.selectedMySceneId = ''
            this.sceneReferenceImagePath = ''
            this.sceneReferenceUploadedUrl = ''
            this.sceneReferenceName = ''
            this.sceneReferencePrompt = ''
            this.applySceneParams()
          }
          uni.showToast({ title: '场景已删除', icon: 'success' })
        }
      })
    },
    selectReplaceMode(mode = 'head_replace') {
      if (!['head_replace', 'face_replace'].includes(mode)) return
      this.replaceMode = mode
      this.saveModelReplacePreference()
      this.modelGenerationErrorSummary = ''
      this.modelEditingStep = 3
      if (String(this.modelRuntimeConfig.stage || '') === 'development') {
        this.$nextTick(() => {
          console.info('[ai-model:replace-mode-selected]', {
            replaceMode: this.replaceMode,
            taskType: this.modelTaskType,
            canSubmit: this.canStartModelReplace,
            disabledReason: this.modelGenerateDisabledReason
          })
        })
      }
    },
    selectTestExecutionMode(mode = TEST_EXECUTION_MODES.FLOW_MOCK, runtime = null) {
      const activeRuntime = runtime || this.modelRuntimeConfig
      if (mode === TEST_EXECUTION_MODES.MODEL_EXPERIMENT && !activeRuntime.modelEffectTestEnabled) {
        uni.showToast({ title: '当前 Provider 未开放模型效果测试', icon: 'none' })
        return
      }
      const result = setInternalRuntimeConfig({ executionMode: mode })
      if (!result.ok) {
        uni.showToast({ title: '仅内部测试账号可切换测试方式', icon: 'none' })
        return
      }
      this.runtimeConfigRevision += 1
    },
    selectModelPortraitSource(value = 'profiles') {
      if (!['profiles', 'upload', 'system'].includes(value)) return
      if (value === 'system' && !this.availableSystemPortraits.length && !this.modelRuntimeConfig.isInternalDebug) return
      this.modelPortraitSource = value
      this.modelTargetConfirmed = false
      this.modelEditingStep = 3
    },
    async loadModelProfiles() {
      if (this.modelProfilesLoading) return
      let handoffModelProfileId = ''
      try {
        const selected = uni.getStorageSync(MODEL_PROFILE_SELECTION_KEY)
        if (selected && selected.modelProfileId) {
          handoffModelProfileId = selected.modelProfileId
          if (this.isGarmentTool) {
            this.garmentPersonSource = 'profiles'
            this.garmentSelectedModelProfileId = selected.modelProfileId
          } else {
            this.modelPortraitSource = 'profiles'
            this.selectedModelProfileId = selected.modelProfileId
            this.modelTargetConfirmed = true
            this.modelEditingStep = 4
          }
          uni.removeStorageSync(MODEL_PROFILE_SELECTION_KEY)
        }
      } catch (error) {
        // Selection handoff is best-effort; the cloud list remains authoritative.
      }
      this.modelProfilesLoading = true
      const result = await getModelProfiles({ scope: 'personal' })
      this.modelProfilesLoading = false
      if (!result.ok) return
      this.myModelProfiles = (result.data && result.data.profiles) || []
      if (this.isGarmentTool) {
        const garmentProfile = this.myModelProfiles.find((item) => item.modelProfileId === (handoffModelProfileId || this.garmentSelectedModelProfileId))
        if (garmentProfile) this.selectGarmentModelProfile(garmentProfile)
        else if (this.garmentPersonSource === 'profiles') this.garmentPersonImage = ''
      }
      if (!this.myModelProfiles.some((item) => item.modelProfileId === this.selectedModelProfileId)) {
        const preferred = this.myModelProfiles.find((item) => item.isDefault) || null
        this.selectedModelProfileId = preferred ? preferred.modelProfileId : ''
      }
    },
    selectModelProfile(profile = {}) {
      if (!profile.modelProfileId || profile.status !== 'active') return
      this.selectedModelProfileId = profile.modelProfileId
      this.modelPortraitSource = 'profiles'
      this.modelTargetConfirmed = true
      this.modelEditingStep = 4
    },
    openModelProfiles() {
      uni.navigateTo({ url: '/package-assets/model-profiles/model-profiles?select=1', fail: () => uni.showToast({ title: '常用模特暂时无法打开', icon: 'none' }) })
    },
    selectSystemPortrait(item = {}) {
      if (!item.value) return
      this.selectedSystemPortraitCategory = item.value
      this.selectedModelId = item.modelId || ''
      this.modelPortraitSource = 'system'
      this.modelTargetConfirmed = Boolean(item.imageUrl)
      if (this.modelTargetConfirmed) this.modelEditingStep = 4
    },
    editModelStep(step = 1) {
      const normalized = Math.max(1, Math.min(4, Number(step) || 1))
      if (normalized >= 2 && !this.clothImagePath) return
      if (normalized >= 3 && !this.hasSelectedReplaceMode) return
      if (normalized >= 4 && (!this.modelTargetConfirmed || !this.modelTargetPersonImage)) return
      this.modelEditingStep = normalized
    },
    previewModelImage(url = '') {
      const current = String(url || '').trim()
      if (!current) return
      uni.previewImage({ current, urls: [current] })
    },
    isResourceLibraryExpanded(key = '') {
      return Boolean(this.resourceLibraryExpanded && this.resourceLibraryExpanded[key])
    },
    toggleResourceLibrary(key = '') {
      if (!key || !Object.prototype.hasOwnProperty.call(this.resourceLibraryExpanded, key)) return
      this.resourceLibraryExpanded[key] = !this.resourceLibraryExpanded[key]
    },
    restoreContinueContext(query = {}) {
      const contextId = String(query.continueContextId || '').trim()
      if (!contextId) {
        return
      }
      const context = uni.getStorageSync(`${CONTINUE_CONTEXT_STORAGE_PREFIX}${contextId}`)
      if (!context) {
        return
      }
      const continueAction = String(query.continueAction || (context.params && context.params.continueAction) || '').trim()
      const sourceImage = context.resultImage || context.sourceImage || ''
      if (sourceImage) {
        this.clothImagePath = sourceImage
      }
      this.selectedParams = {
        ...this.selectedParams,
        ...((context && context.params) || {}),
        continueContextId: contextId,
        continueFromTaskId: context.taskId || '',
        continueAssetId: context.assetId || '',
        continueToolType: context.toolType || this.toolType,
        sourceResultImage: context.resultImage || '',
        sourceImage: context.sourceImage || sourceImage,
        continueAction
      }
      const contextParams = (context && context.params) || {}
      if (this.isDedicatedModelTool) {
        const restoredReplaceMode = String(contextParams.replaceMode || contextParams.actionType || context.taskType || '').trim()
        if (['head_replace', 'face_replace'].includes(restoredReplaceMode)) {
          this.replaceMode = restoredReplaceMode
          this.saveModelReplacePreference()
        }
      }
      const restoreToolType = context.toolType || contextParams.toolType || this.toolType
      if (restoreToolType === 'refine') {
        this.sourceDesignPlanId = contextParams.sourceDesignPlanId || context.planId || ''
        this.sourceDesignVersion = Number(contextParams.sourceDesignVersion || contextParams.version || 0)
        this.sourceDesignBranchName = contextParams.branchName || ''
        this.styleDesignPlanName = contextParams.designPlanName || this.styleDesignPlanName
        if (Array.isArray(contextParams.selectedModifyTypes) && contextParams.selectedModifyTypes.length) {
          const allowedModifyTypes = STYLE_MODIFICATION_MODES.map((item) => item.value)
          const restoredModifyType = contextParams.selectedModifyTypes.find((item) => allowedModifyTypes.includes(item))
          this.styleModificationMode = restoredModifyType || this.styleModificationMode || 'micro_change'
          this.selectedModifyTypes = [this.styleModificationMode]
        }
        if (Array.isArray(contextParams.selectedStyles) && contextParams.selectedStyles.length) {
          this.selectedStyles = [...contextParams.selectedStyles]
        }
        this.aiGeneratedPrompt = contextParams.aiGeneratedPrompt || this.aiGeneratedPrompt
        this.styleCustomPrompt = contextParams.modificationPrompt || contextParams.aiPrompt || this.styleCustomPrompt
        this.referencePrompt = contextParams.referencePrompt || this.referencePrompt
        this.referenceStyle = contextParams.referenceStyle || this.referenceStyle
        this.referenceStyleName = contextParams.referenceStyleName || this.referenceStyleName
        const restoredOutputCount = Number(contextParams.outputCount || contextParams.styleOutputCount || contextParams.count)
        this.styleOutputCount = STYLE_OUTPUT_COUNT_OPTIONS.includes(restoredOutputCount)
          ? restoredOutputCount
          : (this.genericRuntimeConfig.isInternalDebug ? 1 : 2)
        const referenceImages = Array.isArray(contextParams.referenceImages) ? contextParams.referenceImages : []
        this.styleReferenceImagePath = contextParams.styleReferenceImage || referenceImages[0] || this.styleReferenceImagePath
        this.applyStyleParams()
      }
      if (this.isMarketingTool && continueAction) {
        const actionMap = {
          detail_page: ['detail_page'],
          series: ['series'],
          poster: ['poster']
        }
        this.selectedMarketingTypes = actionMap[continueAction] || this.selectedMarketingTypes
        if (Array.isArray(contextParams.detailModules) && contextParams.detailModules.length) {
          this.selectedDetailModules = [...contextParams.detailModules]
        }
        if (Array.isArray(contextParams.standardDetailModules) && contextParams.standardDetailModules.length) {
          this.selectedStandardDetailModules = [...contextParams.standardDetailModules]
        }
        if (Array.isArray(contextParams.pageMaterialTypes) && contextParams.pageMaterialTypes.length) {
          this.selectedPageMaterialTypes = [...contextParams.pageMaterialTypes]
        }
        this.productInfo = {
          ...this.productInfo,
          ...((contextParams && contextParams.productInfo) || {})
        }
        this.productTitle = contextParams.productTitle || this.productInfo.productTitle || this.productInfo.name || ''
        this.sellingPoints = contextParams.sellingPoints || this.productInfo.sellingPoints || ''
        this.detailDescription = contextParams.detailDescription || this.productInfo.detailDescription || ''
        this.customDetailPrompt = contextParams.customDetailPrompt || this.customDetailPrompt
        this.activeDetailTemplate = contextParams.detailTemplate || this.activeDetailTemplate
        this.marketingVersion = contextParams.marketingVersion || ''
        this.sourcePackageId = contextParams.sourcePackageId || contextParams.productPackageId || ''
        if (contextParams.marketingPrompt && !this.customDetailPrompt) {
          this.customDetailPrompt = contextParams.marketingPrompt
        }
        if (this.sourcePackageId) {
          this.syncDetailModuleParams()
        } else {
          this.applyMarketingParams()
        }
        this.selectedParams = {
          ...this.selectedParams,
          continueContextId: contextId,
          continueFromTaskId: context.taskId || '',
          continueAssetId: context.assetId || '',
          sourceResultImage: context.resultImage || '',
          sourceImage: context.sourceImage || sourceImage,
          sourcePackageId: this.sourcePackageId,
          marketingVersion: this.marketingVersion,
          detailTemplate: this.activeDetailTemplate,
          continueAction
        }
      }
    },
    restoreProductionContext(contextId = '') {
      const safeContextId = String(contextId || '').trim()
      if (!safeContextId) {
        return
      }
      const context = uni.getStorageSync(`${PRODUCTION_CONTEXT_STORAGE_KEY}_${safeContextId}`)
      if (!context || !Array.isArray(context.assets)) {
        return
      }
      this.productionContext = context
      const clothAsset = context.assets.find((item) => item.key === 'cloth') || context.assets[0] || null
      const referenceAsset = context.assets.find((item) => item.key === 'styleRef' || item.key === 'designRef') || null
      if (clothAsset && clothAsset.url) {
        this.clothImagePath = clothAsset.url
      }
      if (referenceAsset && referenceAsset.url) {
        this.referenceImagePath = referenceAsset.url
      }
      if (context.selectedAction && context.selectedAction.toolType) {
        this.selectedParams = {
          ...this.selectedParams,
          productionType: context.productionTypeValue || context.productionType || '',
          productionAction: context.selectedAction.key || '',
          productionActionName: context.selectedAction.title || ''
        }
        if (this.isMarketingTool) {
          const actionMap = {
            poster: ['poster'],
            series: ['series'],
            detail_page: ['detail_page']
          }
          this.selectedMarketingTypes = actionMap[context.selectedAction.key] || this.selectedMarketingTypes
          this.applyMarketingParams()
        }
      }
    },
    resetSelectedParams() {
      const params = {}
      ;(this.currentTool.paramGroups || []).forEach((group) => {
        params[group.key] = (group.options[0] && group.options[0].value) || ''
      })
      this.selectedParams = params
      if (this.isRedesignTool) {
        this.applyRedesignSelectionParams()
        return
      }
      if (this.isDetailDisplayTool) {
        const validParts = this.selectedDetailParts.filter((value) => DETAIL_REFERENCE_OPTIONS.some((item) => item.value === value))
        this.selectedDetailParts = validParts.length ? validParts : ['collar']
        this.applyDetailParams()
        return
      }
      if (this.isMarketingTool) {
        this.applyMarketingParams()
        return
      }
      if (this.isModelTool) {
        this.applyModelFeatureParams()
        return
      }
      const firstReference = this.currentReferenceOptions[0] || null
      if (firstReference) {
        this.selectReferenceStyle(firstReference)
      } else {
        this.referenceStyle = ''
        this.referenceStyleName = ''
        this.referencePrompt = ''
      }
      if (this.isModelTool && this.isModelFeatureSelected('pose_variation')) {
        this.applyPoseParams()
      }
      if (this.isModelTool && this.isModelFeatureSelected('scene_replace')) {
        this.applySceneParams()
      }
      if (this.isDisplayTool) this.saveDisplayDraft()
    },
    selectParam(key, value) {
      this.selectedParams = {
        ...this.selectedParams,
        [key]: value
      }
      if (this.isModelTool && this.isModelFeatureSelected('pose_variation')) {
        this.applyPoseParams()
      }
      if (this.isModelTool && this.isModelFeatureSelected('scene_replace')) {
        this.applySceneParams()
      }
    },
    selectReferenceStyle(item = {}) {
      this.referenceStyle = item.value || ''
      this.referenceStyleName = item.label || ''
      this.referencePrompt = item.prompt || ''
      if (this.isStyleTool) {
        this.applyStyleParams()
      }
      if (this.isModelTool && this.modelReplacementMode === 'pose_variation') {
        this.applyPoseParams()
      }
      if (this.isModelTool && this.modelReplacementMode === 'scene_replace') {
        this.applySceneParams()
      }
    },
    isModelFeatureSelected(feature) {
      return this.selectedModelFeatures.includes(feature)
    },
    isModelQuickPlanActive(plan = {}) {
      const features = plan.features || []
      return features.length === this.selectedModelFeatures.length
        && features.every((feature) => this.selectedModelFeatures.includes(feature))
    },
    applyModelQuickPlan(plan = {}) {
      const features = plan.features && plan.features.length ? plan.features : ['model_display']
      this.selectedModelFeatures = [...features]
      this.modelReplacementMode = this.selectedModelFeatures[0] || 'model_display'
      this.applyModelFeatureParams()
    },
    toggleModelFeature(mode = {}) {
      const feature = mode.value || 'model_display'
      const exists = this.selectedModelFeatures.includes(feature)
      if (exists && this.selectedModelFeatures.length <= 1) {
        uni.showToast({
          title: '至少选择一种AI模特能力',
          icon: 'none'
        })
        return
      }
      this.selectedModelFeatures = exists
        ? this.selectedModelFeatures.filter((item) => item !== feature)
        : [...this.selectedModelFeatures, feature]
      this.modelReplacementMode = this.selectedModelFeatures[0] || 'model_display'
      this.applyModelFeatureParams()
    },
    selectModelFeatureReference(feature, item = {}) {
      if (feature === 'model_display') {
        this.modelReferenceStyle = item.value || ''
        this.modelReferenceName = item.label || ''
        this.modelReferencePrompt = item.prompt || ''
      }
      if (feature === 'face_replace') {
        this.faceReferenceStyle = item.value || ''
        this.faceReferenceName = item.label || ''
        this.faceReferencePrompt = item.prompt || ''
      }
      if (feature === 'pose_variation') {
        this.poseReferenceStyle = item.value || ''
        this.poseReferenceName = item.label || ''
        this.poseReferencePrompt = item.prompt || ''
      }
      if (feature === 'scene_replace') {
        this.sceneReferenceStyle = item.value || ''
        this.sceneReferenceName = item.label || ''
        this.sceneReferencePrompt = item.prompt || ''
      }
      this.applyModelFeatureParams()
    },
    applyModelFeatureParams() {
      if (!this.isModelTool) {
        return
      }
      if (!this.selectedModelFeatures.length) {
        this.selectedModelFeatures = ['model_display']
      }
      if (this.isModelFeatureSelected('pose_variation')) {
        this.applyPoseParams()
      }
      if (this.isModelFeatureSelected('scene_replace')) {
        this.applySceneParams()
      }
      const nextParams = {
        ...this.selectedParams,
        selectedModelFeatures: [...this.selectedModelFeatures],
        modelReferenceStyle: this.modelReferenceStyle,
        modelReferenceName: this.modelReferenceName,
        modelReferencePrompt: this.modelReferencePrompt,
        modelReferenceImage: this.modelReferenceImagePath || '',
        hasModelReferenceImage: Boolean(this.modelReferenceImagePath),
        faceReferenceStyle: this.faceReferenceStyle,
        faceReferenceName: this.faceReferenceName,
        faceReferencePrompt: this.faceReferencePrompt,
        faceReferenceImage: this.referenceImagePath || '',
        hasFaceReferenceImage: Boolean(this.referenceImagePath)
      }
      if (!this.isModelFeatureSelected('pose_variation')) {
        delete nextParams.poseType
        delete nextParams.poseReferenceType
        delete nextParams.poseReferenceImage
        delete nextParams.hasPoseReferenceImage
        delete nextParams.posePrompt
        delete nextParams.poseCount
        delete nextParams.outputCount
        delete nextParams.poseVariantCount
      }
      if (!this.isModelFeatureSelected('scene_replace')) {
        delete nextParams.sceneType
        delete nextParams.sceneReferenceImage
        delete nextParams.hasSceneReferenceImage
        delete nextParams.scenePrompt
      }
      this.selectedParams = nextParams
    },
    applyPoseParams() {
      const poseCount = Number(this.selectedParams.poseGenerateCount || this.selectedParams.poseCount || 2)
      const prompt = [this.poseReferencePrompt, this.poseCustomPrompt].filter(Boolean).join('；')
      this.selectedParams = {
        ...this.selectedParams,
        poseType: this.poseReferenceStyle || this.selectedParams.poseType || 'natural_stand',
        poseReferenceType: this.poseReferenceType,
        poseReferenceImage: this.poseReferenceImagePath || '',
        hasPoseReferenceImage: Boolean(this.poseReferenceImagePath),
        posePrompt: prompt,
        poseCount,
        outputCount: poseCount,
        poseVariantCount: poseCount
      }
    },
    applySceneParams() {
      const generative = this.sceneMode === 'generative_reference'
      const prompt = generative ? [this.sceneReferencePrompt, this.sceneCustomPrompt].filter(Boolean).join('；') : ''
      const sceneSource = this.sceneReferenceImagePath ? 'user' : 'system'
      const nextParams = { ...this.selectedParams }
      delete nextParams.backgroundType
      delete nextParams.background
      delete nextParams.randomScene
      delete nextParams.autoScene
      delete nextParams.cameraType
      delete nextParams.poseType
      delete nextParams.modelPreset
      delete nextParams.whiteBackground
      delete nextParams.studioBackground
      delete nextParams.ecommerceBackground
      delete nextParams.recompose
      delete nextParams.randomCamera
      delete nextParams.randomPose
      delete nextParams.autoModelOptimization
      this.selectedParams = {
        ...nextParams,
        sceneMode: this.sceneMode,
        sceneFit: this.sceneFit,
        sceneType: generative ? (this.sceneReferenceStyle || 'scene_reference') : '',
        sceneTemplateId: generative ? (this.selectedSceneTemplateId || '') : '',
        sceneReferenceImage: this.sceneReferenceImagePath || '',
        hasSceneReferenceImage: Boolean(this.sceneReferenceImagePath),
        sceneSource,
        scenePreferenceId: sceneSource === 'user' ? this.selectedMySceneId : '',
        scenePrompt: prompt,
        preserveFace: true,
        preserveExpression: true,
        preservePose: true,
        preserveGarment: true,
        preserveForeground: true,
        preserveScene: true,
        edgeRefine: this.sceneEdgeRefine,
        shadowBlend: this.sceneShadowBlend
      }
    },
    selectSceneQuickTemplate(item = {}) {
      const templateId = String(item.value || '').trim()
      if (!templateId) return
      this.sceneReferenceImagePath = ''
      this.sceneReferenceUploadedUrl = ''
      this.selectedSystemSceneId = templateId
      this.selectedSceneTemplateId = templateId
      this.sceneReferenceStyle = templateId
      this.sceneReferenceName = item.label || ''
      this.sceneReferencePrompt = item.prompt || ''
      this.sceneMode = 'generative_reference'
      this.applySceneParams()
    },
    selectPoseReferenceType(value) {
      this.poseReferenceType = value || 'model_action'
      this.applyPoseParams()
    },
    applyRedesignSelectionParams() {
      if (this.isStyleTool) this.applyStyleParams()
      if (this.isColorTool) this.applySelectedColorParams()
      if (this.isFabricTool) this.applyFabricParams()
      if (this.isPatternTool) this.applyPatternParams()
      this.selectedParams = {
        ...this.selectedParams,
        selectedRedesignTypes: [...this.selectedRedesignTypes]
      }
    },
    selectColorMethod(value = 'system') {
      if (!COLOR_SELECTION_METHODS.some((item) => item.value === value)) return
      if (this.colorSelectionMethod === value) return
      this.colorSelectionMethod = value
      this.colorPendingSample = null
      this.colorEyedropperActive = value === 'eyedropper'
      if (value === 'recent') this.reloadColorLibraries()
      this.applySelectedColorParams()
    },
    getColorDraftStorageKey() {
      return COLOR_REDESIGN_DRAFT_STORAGE_KEY
    },
    buildColorDraft() {
      return {
        version: COLOR_REDESIGN_DRAFT_VERSION,
        businessType: 'color_replace',
        savedAt: Date.now(),
        clothImagePath: this.isStableStyleImageUrl(this.clothImagePath) ? this.clothImagePath : '',
        colorImageMeta: this.colorImageMeta,
        colorSelectionMethod: this.colorSelectionMethod,
        colorEyedropperSource: this.colorEyedropperSource,
        selectedColorId: this.selectedColorId,
        selectedColorData: this.currentTargetColor ? { ...this.currentTargetColor } : null,
        colorReferenceImagePath: this.isStableStyleImageUrl(this.colorReferenceImagePath) ? this.colorReferenceImagePath : '',
        colorTargetArea: this.colorTargetArea,
        textureRetention: this.textureRetention,
        colorCustomPrompt: this.colorCustomPrompt || ''
      }
    },
    saveColorDraft() {
      if (!this.isColorTool || !this.colorDraftReady || this.colorSubmissionStatus === 'navigated') return
      const hasContent = this.isStableStyleImageUrl(this.clothImagePath)
      try {
        if (hasContent) uni.setStorageSync(this.getColorDraftStorageKey(), this.buildColorDraft())
        else uni.removeStorageSync(this.getColorDraftStorageKey())
      } catch (error) {
        // Draft failure must never block color generation.
      }
    },
    initializeColorDraft(query = {}) {
      this.colorDraftReady = false
      const hasIncomingContext = Boolean(query.continueContextId || query.productionContextId || this.productionContext)
      if (hasIncomingContext) {
        this.colorDraftReady = true
        this.colorImageStatus = this.clothImagePath && this.isStableStyleImageUrl(this.clothImagePath) ? 'ready' : 'empty'
        this.applySelectedColorParams()
        return
      }
      let draft = null
      try {
        draft = uni.getStorageSync(this.getColorDraftStorageKey())
      } catch (error) {
        draft = null
      }
      const validDraft = draft
        && Number(draft.version) === COLOR_REDESIGN_DRAFT_VERSION
        && draft.businessType === 'color_replace'
        && Date.now() - Number(draft.savedAt || 0) <= COLOR_REDESIGN_DRAFT_MAX_AGE
      this.colorDraftReady = true
      if (!validDraft) {
        this.applySelectedColorParams()
        return
      }
      this.colorDraftAvailable = true
      uni.showModal({
        title: '检测到未完成的换色配置',
        content: '可以继续上次编辑，或清空后重新开始。',
        confirmText: '继续编辑',
        cancelText: '重新开始',
        success: (result) => {
          if (result.confirm) this.restoreColorDraft(draft)
          else this.resetColorDraft()
        },
        fail: () => {
          this.applySelectedColorParams()
        }
      })
    },
    restoreColorDraft(draft = {}) {
      const allowedMethods = COLOR_SELECTION_METHODS.map((item) => item.value)
      const allowedAreas = COLOR_TARGET_AREAS.map((item) => item.value)
      const allowedTextures = TEXTURE_RETENTION_OPTIONS.map((item) => item.value)
      const stableSource = String(draft.clothImagePath || '').trim()
      const stableReference = String(draft.colorReferenceImagePath || '').trim()
      this.clothImagePath = this.isStableStyleImageUrl(stableSource) ? stableSource : ''
      this.colorImageMeta = this.clothImagePath && draft.colorImageMeta
        ? {
            ...draft.colorImageMeta,
            sizeText: draft.colorImageMeta.sizeText || this.formatColorImageSize(draft.colorImageMeta.size)
          }
        : null
      this.colorImageStatus = this.clothImagePath ? 'ready' : 'empty'
      this.colorPickerLocalImagePath = this.clothImagePath
      this.colorImageError = stableSource && !this.clothImagePath ? '草稿中的服装图片已失效，请重新上传。' : ''
      const legacyMethodMap = { library: 'system', upload: 'eyedropper' }
      const restoredMethod = legacyMethodMap[draft.colorSelectionMethod] || draft.colorSelectionMethod
      this.colorSelectionMethod = allowedMethods.includes(restoredMethod) ? restoredMethod : 'system'
      this.colorEyedropperSource = draft.colorEyedropperSource === 'uploaded' || draft.colorSelectionMethod === 'upload' ? 'uploaded' : 'garment'
      const restoredColor = normalizeStandardColor(draft.selectedColorData || {}, draft.selectedColorData && draft.selectedColorData.sourceType)
      if (restoredColor && !this.allColorOptions.some((item) => item.colorId === restoredColor.colorId)) {
        this.eyedropperColor = restoredColor
      }
      const legacySelectedId = draft.selectedColorId || (Array.isArray(draft.selectedColorIds) ? draft.selectedColorIds[0] : '')
      this.selectedColorId = this.allColorOptions.some((item) => item.colorId === legacySelectedId) ? legacySelectedId : (restoredColor ? restoredColor.colorId : '')
      this.colorReferenceImagePath = this.isStableStyleImageUrl(stableReference) ? stableReference : ''
      this.colorReferencePickerPath = this.colorReferenceImagePath
      this.colorReferenceImageStatus = this.colorReferenceImagePath ? 'ready' : 'empty'
      this.colorReferenceImageError = stableReference && !this.colorReferenceImagePath ? '草稿中的取色图片已失效，请重新上传。' : ''
      this.colorTargetArea = allowedAreas.includes(draft.colorTargetArea) ? draft.colorTargetArea : 'whole_garment'
      this.textureRetention = allowedTextures.includes(draft.textureRetention) ? draft.textureRetention : 'standard'
      this.colorCustomPrompt = String(draft.colorCustomPrompt || '').slice(0, 200)
      this.colorDraftAvailable = false
      this.applySelectedColorParams()
      uni.showToast({ title: '已恢复换色草稿', icon: 'success' })
    },
    resetColorDraft() {
      this.colorDraftReady = false
      this.clothImagePath = ''
      this.colorImageStatus = 'empty'
      this.colorImageError = ''
      this.colorImageMeta = null
      this.colorSelectionMethod = 'system'
      this.colorEyedropperSource = 'garment'
      this.selectedColorId = ''
      this.colorPreviewEnabled = false
      this.colorPreviewStatus = 'idle'
      this.colorPreviewUrl = ''
      this.colorPreviewMaskSource = ''
      this.colorPreviewError = ''
      this.colorPreviewResult = null
      this.colorReferenceImagePath = ''
      this.colorReferencePickerPath = ''
      this.colorReferenceImageStatus = 'empty'
      this.colorReferenceImageError = ''
      this.colorPickerLocalImagePath = ''
      this.colorPendingSample = null
      this.colorExtractedPalette = []
      this.eyedropperColor = null
      this.colorTargetArea = 'whole_garment'
      this.textureRetention = 'standard'
      this.colorCustomPrompt = ''
      this.colorSubmissionStatus = 'idle'
      this.colorSubmissionError = ''
      this.colorCreatedTaskId = ''
      this.colorDraftAvailable = false
      try {
        uni.removeStorageSync(this.getColorDraftStorageKey())
      } catch (error) {
        // Keep reset available even if storage is unavailable.
      }
      this.colorDraftReady = true
      this.applySelectedColorParams()
      uni.showToast({ title: '已重新开始', icon: 'none' })
    },
    clearColorDraftAfterNavigation() {
      this.colorDraftReady = false
      this.colorDraftAvailable = false
      try {
        uni.removeStorageSync(this.getColorDraftStorageKey())
      } catch (error) {
        // Navigation already succeeded; draft cleanup is best effort.
      }
    },
    formatColorImageSize(size = 0) {
      const bytes = Number(size || 0)
      if (!bytes) return '大小未知'
      return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
    },
    async handleColorClothImageSelection(response = {}) {
      const path = (response.tempFilePaths || [])[0] || ''
      const file = (response.tempFiles || [])[0] || { path }
      if (!path) return
      const previousImage = this.clothImagePath
      const previousPickerImage = this.colorPickerLocalImagePath
      this.colorImageStatus = 'uploading'
      this.colorImageError = ''
      this.colorPickerLocalImagePath = path
      try {
        const uploaded = await this.validateAndUploadStyleImage(file, path, 'color_replace_source')
        this.clothImagePath = uploaded.url
        this.colorImageMeta = { ...uploaded.meta, sizeText: this.formatColorImageSize(uploaded.meta.size) }
        this.colorImageStatus = 'ready'
        this.colorSubmissionStatus = 'idle'
        this.colorCreatedTaskId = ''
        this.applySelectedColorParams()
        uni.showToast({ title: '服装图片已上传', icon: 'success' })
      } catch (error) {
        this.clothImagePath = previousImage
        this.colorPickerLocalImagePath = previousPickerImage
        this.colorImageStatus = previousImage ? 'ready' : 'error'
        this.colorImageError = this.getStyleImageErrorMessage(error)
        uni.showToast({ title: this.colorImageError, icon: 'none' })
      }
    },
    async ensureColorImagesReadyForSubmit() {
      if (!this.isColorTool) return
      if (this.clothImagePath && !this.isStableStyleImageUrl(this.clothImagePath)) {
        this.colorImageStatus = 'uploading'
        const uploaded = await this.validateAndUploadStyleImage({ path: this.clothImagePath }, this.clothImagePath, 'color_replace_source')
        this.clothImagePath = uploaded.url
        this.colorImageMeta = { ...uploaded.meta, sizeText: this.formatColorImageSize(uploaded.meta.size) }
        this.colorImageStatus = 'ready'
      }
      if (this.colorEyedropperSource === 'uploaded' && this.colorReferenceImagePath && !this.isStableStyleImageUrl(this.colorReferenceImagePath)) {
        this.colorReferenceImageStatus = 'uploading'
        const uploaded = await this.validateAndUploadStyleImage({ path: this.colorReferenceImagePath }, this.colorReferenceImagePath, 'color_replace_reference')
        this.colorReferenceImagePath = uploaded.url
        this.colorReferenceImageStatus = 'ready'
      }
      this.applySelectedColorParams()
    },
    async stabilizeIncomingColorImages() {
      const hasLocalImage = (this.clothImagePath && !this.isStableStyleImageUrl(this.clothImagePath))
        || (this.colorReferenceImagePath && !this.isStableStyleImageUrl(this.colorReferenceImagePath))
      if (!hasLocalImage) return
      try {
        await this.ensureColorImagesReadyForSubmit()
      } catch (error) {
        this.colorImageStatus = this.clothImagePath && this.isStableStyleImageUrl(this.clothImagePath) ? 'ready' : 'error'
        this.colorImageError = this.getStyleImageErrorMessage(error)
      }
    },
    clearTargetColors() {
      this.selectedColorId = ''
      this.eyedropperColor = null
      this.colorPendingSample = null
      this.applySelectedColorParams()
    },
    applySelectedColorParams() {
      const color = this.currentTargetColor
      const usesUploadedColorSource = this.usesUploadedColorReference
      const colorReferenceImage = usesUploadedColorSource ? this.colorReferenceImagePath : ''
      const colorReferenceFileId = colorReferenceImage.startsWith('cloud://') ? colorReferenceImage : ''
      const targetColor = color ? {
        displayName: color.displayName,
        hex: color.hex,
        rgb: [...color.rgb],
        lab: [...color.lab],
        source: color.sourceType,
        sourceImageFileId: color.sourceImageFileId || colorReferenceFileId
      } : null
      const targetColorPrompt = color
        ? `仅将${this.colorTargetAreaLabel}调整为${color.displayName}（${color.hex}），保留原始明暗、褶皱、材质纹理和印花图案；严格保持人物身份、脸部、头发、身体、姿势、背景和服装结构不变`
        : ''
      this.selectedParams = {
        ...this.selectedParams,
        colorId: color ? color.colorId : '',
        colorName: color ? color.displayName : '',
        targetColorHex: color ? color.hex : '',
        targetColorRgb: color ? [...color.rgb] : [],
        targetColorLab: color ? [...color.lab] : [],
        targetColor,
        targetColorPrompt,
        colorSource: color ? color.sourceType : '',
        colorSourceImageFileId: color ? (color.sourceImageFileId || colorReferenceFileId) : '',
        previewOnly: false,
        customColorCard: Boolean(colorReferenceImage),
        customColorPalette: colorReferenceImage,
        colorReferenceImage,
        fabricTags: color ? (color.fabricTags || []) : [],
        colorPrompt: this.colorCustomPrompt || targetColorPrompt,
        modificationPrompt: this.colorCustomPrompt || '',
        colorTargetArea: this.colorTargetArea,
        targetRegion: this.colorTargetArea,
        textureRetention: this.textureRetention,
        preserveTexture: true,
        preservePattern: true,
        preserveBackground: true,
        preserveIdentity: true,
        preservePose: true,
        colorAccuracyMode: 'generative_approximate'
      }
      this.referenceStyle = color ? color.colorId : ''
      this.referenceStyleName = color ? color.displayName : ''
      this.referencePrompt = color ? color.prompt : ''
      this.saveColorDraft()
    },
    selectColorOption(color = {}) {
      const normalized = normalizeStandardColor(color, color.sourceType || 'system_palette')
      if (!normalized) return
      if (!this.allColorOptions.some((item) => item.colorId === normalized.colorId)) this.eyedropperColor = normalized
      this.selectedColorId = normalized.colorId
      this.applySelectedColorParams()
    },
    selectSystemColor(color = {}) {
      this.selectColorOption({ ...color, sourceType: 'system_palette' })
    },
    selectRecentColor(color = {}) {
      this.selectColorOption({ ...color, colorId: `recent_${String(color.hex || '').replace('#', '').toLowerCase()}`, sourceType: 'recent_color' })
    },
    selectDominantColor(color = {}) {
      const normalized = normalizeStandardColor({
        ...color,
        sourceImageFileId: this.colorEyedropperSource === 'uploaded' && this.colorReferenceImagePath.startsWith('cloud://') ? this.colorReferenceImagePath : ''
      }, 'dominant_color')
      if (!normalized) return
      this.colorPendingSample = normalized
      this.eyedropperColor = normalized
      this.selectColorOption(normalized)
    },
    isLightColor(color = {}) {
      const rgb = Array.isArray(color.rgb) ? color.rgb : []
      if (rgb.length !== 3) return true
      return ((rgb[0] * 299) + (rgb[1] * 587) + (rgb[2] * 114)) / 1000 > 165
    },
    showColorHex(color = {}) {
      if (color.hex) uni.showToast({ title: color.hex, icon: 'none' })
    },
    openCustomColorPicker() {
      this.customColorPickerVisible = true
    },
    closeCustomColorPicker() {
      this.customColorPickerVisible = false
    },
    confirmCustomColor(color = {}) {
      const normalized = normalizeStandardColor(color, 'custom_picker')
      if (!normalized) return
      this.customColorPickerVisible = false
      this.eyedropperColor = normalized
      this.selectColorOption(normalized)
      this.recordConfirmedColor(normalized)
      uni.showToast({ title: '已选择自定义颜色', icon: 'success' })
    },
    selectColorEyedropperSource(value = 'garment') {
      this.colorEyedropperSource = value === 'uploaded' ? 'uploaded' : 'garment'
      this.colorPendingSample = null
      this.colorExtractedPalette = []
      this.applySelectedColorParams()
    },
    recordConfirmedColor(color = this.currentTargetColor) {
      const normalized = normalizeStandardColor(color || {}, color && color.sourceType)
      if (!normalized) return
      saveColorHistory(normalized)
      this.reloadColorLibraries(false)
      saveRecentColorToCloud(normalized).then(() => syncRecentColors()).then((colors) => {
        this.colorHistoryOptions = (Array.isArray(colors) ? colors : []).map((item) => normalizeStandardColor(item, 'recent_color')).filter(Boolean)
      }).catch(() => {})
    },
    deleteRecentColor(hex = '') {
      removeColorHistory(hex)
      this.reloadColorLibraries(false)
      removeRecentColorFromCloud(hex).then(() => syncRecentColors()).then((colors) => {
        this.colorHistoryOptions = (Array.isArray(colors) ? colors : []).map((item) => normalizeStandardColor(item, 'recent_color')).filter(Boolean)
      }).catch(() => {})
    },
    clearRecentColors() {
      uni.showModal({
        title: '清空最近使用',
        content: '确定清空全部最近使用颜色吗？',
        confirmText: '清空',
        confirmColor: '#D92D20',
        success: (result) => {
          if (!result.confirm) return
          clearColorHistory()
          this.reloadColorLibraries(false)
          clearRecentColorsFromCloud().then(() => syncRecentColors()).then((colors) => {
            this.colorHistoryOptions = (Array.isArray(colors) ? colors : []).map((item) => normalizeStandardColor(item, 'recent_color')).filter(Boolean)
          }).catch(() => {})
        }
      })
    },
    selectColorTargetArea(area) {
      this.colorTargetArea = area || 'whole_garment'
      this.applySelectedColorParams()
    },
    selectTextureRetention(value) {
      this.textureRetention = value || 'standard'
      this.applySelectedColorParams()
    },
    toggleColorEyedropper() {
      if (!this.clothImagePath) {
        uni.showToast({
          title: '请先上传服装图片',
          icon: 'none'
        })
        return
      }
      this.selectColorMethod('eyedropper')
    },
    handlePreviewTap() {
      if (!this.isColorTool || !this.colorEyedropperActive) {
        return
      }
      this.colorSelectionMethod = 'eyedropper'
    },
    chooseColorReferenceImage() {
      if (this.colorReferenceImageStatus === 'uploading') return
      uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: async (res) => {
          const path = (res.tempFilePaths || [])[0] || ''
          const file = (res.tempFiles || [])[0] || { path }
          if (!path) return
          const previousImage = this.colorReferenceImagePath
          const previousPickerImage = this.colorReferencePickerPath
          this.colorReferenceImageStatus = 'uploading'
          this.colorEyedropperSource = 'uploaded'
          this.colorReferenceImageError = ''
          this.colorReferencePickerPath = path
          this.colorExtractedPalette = []
          this.colorPendingSample = null
          try {
            const uploaded = await this.validateAndUploadStyleImage(file, path, 'color_replace_reference')
            this.colorReferenceImagePath = uploaded.url
            this.colorReferenceImageStatus = 'ready'
            this.applySelectedColorParams()
            uni.showToast({ title: '取色图片已上传', icon: 'success' })
          } catch (error) {
            this.colorReferenceImagePath = previousImage
            this.colorReferencePickerPath = previousPickerImage
            this.colorReferenceImageStatus = previousImage ? 'ready' : 'error'
            this.colorReferenceImageError = this.getStyleImageErrorMessage(error)
            uni.showToast({ title: this.colorReferenceImageError, icon: 'none' })
          }
        }
      })
    },
    removeColorReferenceImage() {
      const currentSource = this.currentTargetColor && this.currentTargetColor.sourceType
      this.colorReferenceImagePath = ''
      this.colorReferencePickerPath = ''
      this.colorReferenceImageStatus = 'empty'
      this.colorReferenceImageError = ''
      this.colorExtractedPalette = []
      this.colorPendingSample = null
      if (['eyedropper_uploaded', 'dominant_color'].includes(currentSource)) {
        this.selectedColorId = ''
        this.eyedropperColor = null
      }
      this.applySelectedColorParams()
    },
    handleGarmentColorSample(color = {}) {
      this.colorPendingSample = normalizeStandardColor({ ...color, name: '服装图取色' }, 'eyedropper_garment')
      this.colorEyedropperNotice = this.colorPendingSample ? '已读取真实像素颜色，点击“使用此颜色”确认。' : ''
    },
    handleColorCardSample(color = {}) {
      this.colorPendingSample = normalizeStandardColor({
        ...color,
        name: '上传图片取色',
        sourceImageFileId: this.colorReferenceImagePath.startsWith('cloud://') ? this.colorReferenceImagePath : ''
      }, 'eyedropper_uploaded')
    },
    handleGarmentExtractedColorPalette(colors = []) {
      this.colorExtractedPalette = (Array.isArray(colors) ? colors : [])
        .map((color, index) => normalizeStandardColor({ ...color, name: `服装主色 ${index + 1}`, sourceImageFileId: '' }, 'dominant_color'))
        .filter(Boolean)
    },
    handleExtractedColorPalette(colors = []) {
      this.colorExtractedPalette = (Array.isArray(colors) ? colors : [])
        .map((color, index) => normalizeStandardColor({
          ...color,
          name: `主要颜色 ${index + 1}`,
          sourceImageFileId: this.colorReferenceImagePath.startsWith('cloud://') ? this.colorReferenceImagePath : ''
        }, 'dominant_color'))
        .filter(Boolean)
    },
    confirmPickedColor(sourceType = '') {
      const resolvedSource = sourceType || (this.colorEyedropperSource === 'uploaded' ? 'eyedropper_uploaded' : 'eyedropper_garment')
      const color = normalizeStandardColor(this.colorPendingSample || {}, resolvedSource)
      if (!color) {
        uni.showToast({ title: '尚未读取到有效颜色', icon: 'none' })
        return
      }
      this.eyedropperColor = { ...color, sourceType: resolvedSource }
      this.selectColorOption(this.eyedropperColor)
      this.recordConfirmedColor(this.eyedropperColor)
      uni.showToast({ title: '已使用此颜色', icon: 'success' })
    },
    handleColorPickerError(payload = {}) {
      const code = String(payload.errorCode || 'COLOR_PICK_FAILED')
      this.colorEyedropperNotice = code === 'PALETTE_EXTRACTION_FAILED'
        ? '主色提取失败，可在图片上手动取色。'
        : '图片取色失败，请重新选择图片后再试。'
    },
    enableColorQuickPreview() {
      this.colorPreviewEnabled = true
      this.colorPreviewStatus = 'loading'
      this.colorPreviewError = ''
    },
    handleColorPreviewStatus(payload = {}) {
      this.colorPreviewStatus = payload.status || 'loading'
      this.colorPreviewError = ''
    },
    handleColorPreviewReady(payload = {}) {
      this.colorPreviewStatus = 'ready'
      this.colorPreviewUrl = String(payload.previewUrl || '')
      this.colorPreviewMaskSource = String(payload.maskSource || '')
      this.colorPreviewError = ''
      this.colorPreviewResult = {
        previewOnly: true,
        tempFilePath: this.colorPreviewUrl,
        maskSource: this.colorPreviewMaskSource,
        createdAt: new Date().toISOString()
      }
    },
    handleColorPreviewError(payload = {}) {
      this.colorPreviewStatus = 'error'
      this.colorPreviewError = String(payload.errorCode || 'COLOR_PREVIEW_FAILED')
    },
    setColorKeyboardActive(active = false) {
      this.colorKeyboardActive = Boolean(active)
    },
    navigateToCreatedColorTask() {
      const taskId = String(this.colorCreatedTaskId || '').trim()
      if (!taskId) return
      const handleFailure = () => {
        this.colorSubmissionStatus = 'navigation_failed'
        this.colorSubmissionError = '任务已创建，但结果页打开失败。'
        uni.showToast({ title: '任务已创建，可前往最近任务查看', icon: 'none' })
      }
      try {
        uni.navigateTo({
          url: `/package-ai/result/result?taskId=${encodeURIComponent(taskId)}`,
          success: () => {
            this.colorSubmissionStatus = 'navigated'
            this.colorSubmissionError = ''
            this.clearColorDraftAfterNavigation()
          },
          fail: handleFailure
        })
      } catch (error) {
        handleFailure()
      }
    },
    applyFabricParams() {
      const fabric = this.selectedFabric
      const hasReferenceImage = Boolean(this.fabricReferenceImagePath)
      const fabricValue = fabric ? fabric.value : (hasReferenceImage ? 'custom_reference' : '')
      const fabricName = fabric ? fabric.label : (hasReferenceImage ? '自定义面料' : '')
      const basePrompt = fabric
        ? fabric.prompt
        : (hasReferenceImage ? '参考上传的面料图片替换服装材质，保持原有版型和结构' : '')
      const prompt = [this.fabricCustomPrompt || basePrompt, this.fabricPositionPrompt].filter(Boolean).join('；')
      const fabricProperties = fabric ? {
        fabricType: fabric.value,
        weave: fabric.weave || '',
        textureScale: fabric.textureScale || '',
        roughness: fabric.roughness || '',
        sheen: fabric.sheen || '',
        drape: fabric.drape || '',
        transparency: fabric.transparency || '',
        elasticity: fabric.elasticity || '',
        textureStrength: fabric.textureStrength || ''
      } : {}
      this.selectedParams = {
        ...this.selectedParams,
        actionType: 'fabric_replace',
        toolType: 'fabric',
        fabricType: fabricValue,
        fabricDirection: fabricValue,
        fabricName,
        fabricPrompt: prompt,
        referencePrompt: prompt,
        materialPosition: this.fabricTargetArea,
        modificationPrompt: prompt,
        fabricTargetArea: this.fabricTargetArea,
        hasFabricReferenceImage: hasReferenceImage,
        fabricReferenceImage: this.fabricReferenceImagePath || '',
        fabricReferenceFileId: this.fabricReferenceImagePath.startsWith('cloud://') ? this.fabricReferenceImagePath : '',
        fabricProperties,
        fabricColorMode: this.fabricColorMode,
        materialTransferMode: 'generative_reference',
        fabricCapability: 'effect_reference',
        requiresReview: true,
        deliveryEligible: false,
        preserveIdentity: true,
        preserveBody: true,
        preservePose: true,
        preserveGarmentStructure: true,
        preserveSilhouette: true,
        preserveBackground: true,
        preserveDecorations: true,
        redrawPolicy: 'low_medium_guidance',
        fabricReferencePriority: 'high_guidance'
      }
      this.referenceStyle = fabricValue
      this.referenceStyleName = fabricName
      this.referencePrompt = prompt
    },
    selectFabricReference(fabric = {}) {
      this.selectedFabricId = fabric.value || this.selectedFabricId
      this.fabricSubmissionStatus = 'idle'
      this.fabricSubmissionError = ''
      this.fabricCreatedTaskId = ''
      this.applyFabricParams()
    },
    selectFabricTargetArea(area) {
      if (area === 'partial' && !this.genericRuntimeConfig.isInternalDebug) {
        uni.showToast({ title: '精确局部换面料需要蒙版能力，当前暂不支持', icon: 'none' })
        return
      }
      this.fabricTargetArea = area || 'whole_garment'
      this.fabricSubmissionStatus = 'idle'
      this.fabricSubmissionError = ''
      this.fabricCreatedTaskId = ''
      this.applyFabricParams()
    },
    selectFabricColorMode(mode) {
      this.fabricColorMode = mode === 'adopt_reference' ? 'adopt_reference' : 'preserve_original'
      this.fabricSubmissionStatus = 'idle'
      this.fabricSubmissionError = ''
      this.fabricCreatedTaskId = ''
      this.applyFabricParams()
    },
    promptFabricChange() {
      uni.showToast({ title: '请从下方面料卡中重新选择', icon: 'none' })
    },
    clearFabricSelection() {
      this.selectedFabricId = ''
      this.fabricReferenceImagePath = ''
      this.fabricReferenceImageStatus = 'empty'
      this.fabricReferenceImageError = ''
      this.fabricSubmissionStatus = 'idle'
      this.fabricSubmissionError = ''
      this.fabricCreatedTaskId = ''
      this.applyFabricParams()
    },
    toggleFabricReferencePanel() {
      this.fabricReferencePanelOpen = !this.fabricReferencePanelOpen
    },
    chooseFabricReferenceImage() {
      if (this.fabricReferenceImageStatus === 'uploading') return
      uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: async (res) => {
          const path = (res.tempFilePaths || [])[0] || ''
          const file = (res.tempFiles || [])[0] || { path }
          if (!path) return
          const previousImage = this.fabricReferenceImagePath
          this.fabricReferenceImageStatus = 'uploading'
          this.fabricReferenceImageError = ''
          try {
            const uploaded = await this.validateAndUploadStyleImage(file, path, 'fabric_replace_reference')
            this.fabricReferenceImagePath = uploaded.url
            this.fabricReferenceImageStatus = 'ready'
            this.fabricReferencePanelOpen = true
            this.fabricSubmissionStatus = 'idle'
            this.fabricCreatedTaskId = ''
            this.applyFabricParams()
            uni.showToast({ title: '面料参考图已上传', icon: 'success' })
          } catch (error) {
            this.fabricReferenceImagePath = previousImage
            this.fabricReferenceImageStatus = previousImage ? 'ready' : 'error'
            this.fabricReferenceImageError = this.getStyleImageErrorMessage(error)
            uni.showToast({ title: this.fabricReferenceImageError, icon: 'none' })
          }
        }
      })
    },
    removeFabricReferenceImage() {
      this.fabricReferenceImagePath = ''
      this.fabricReferenceImageStatus = 'empty'
      this.fabricReferenceImageError = ''
      this.fabricSubmissionStatus = 'idle'
      this.fabricCreatedTaskId = ''
      this.applyFabricParams()
    },
    setFabricKeyboardActive(active = false) {
      this.fabricKeyboardActive = Boolean(active)
    },
    async handleFabricClothImageSelection(response = {}) {
      const path = (response.tempFilePaths || [])[0] || ''
      const file = (response.tempFiles || [])[0] || { path }
      if (!path) return
      const previousImage = this.clothImagePath
      this.fabricImageStatus = 'uploading'
      this.fabricImageError = ''
      try {
        const uploaded = await this.validateAndUploadStyleImage(file, path, 'fabric_replace_source')
        this.clothImagePath = uploaded.url
        this.fabricImageMeta = { ...uploaded.meta, sizeText: this.formatColorImageSize(uploaded.meta.size) }
        this.fabricImageStatus = 'ready'
        this.fabricSubmissionStatus = 'idle'
        this.fabricCreatedTaskId = ''
        this.applyFabricParams()
        uni.showToast({ title: '服装图片已上传', icon: 'success' })
      } catch (error) {
        this.clothImagePath = previousImage
        this.fabricImageStatus = previousImage ? 'ready' : 'error'
        this.fabricImageError = this.getStyleImageErrorMessage(error)
        uni.showToast({ title: this.fabricImageError, icon: 'none' })
      }
    },
    async ensureFabricImagesReadyForSubmit() {
      if (!this.isFabricTool) return
      if (this.clothImagePath && !this.isStableStyleImageUrl(this.clothImagePath)) {
        this.fabricImageStatus = 'uploading'
        const uploaded = await this.validateAndUploadStyleImage({ path: this.clothImagePath }, this.clothImagePath, 'fabric_replace_source')
        this.clothImagePath = uploaded.url
        this.fabricImageMeta = { ...uploaded.meta, sizeText: this.formatColorImageSize(uploaded.meta.size) }
        this.fabricImageStatus = 'ready'
      }
      if (this.fabricReferenceImagePath && !this.isStableStyleImageUrl(this.fabricReferenceImagePath)) {
        this.fabricReferenceImageStatus = 'uploading'
        const uploaded = await this.validateAndUploadStyleImage({ path: this.fabricReferenceImagePath }, this.fabricReferenceImagePath, 'fabric_replace_reference')
        this.fabricReferenceImagePath = uploaded.url
        this.fabricReferenceImageStatus = 'ready'
      }
      this.applyFabricParams()
    },
    navigateToCreatedFabricTask() {
      const taskId = String(this.fabricCreatedTaskId || '').trim()
      if (!taskId) return
      const handleFailure = () => {
        this.fabricSubmissionStatus = 'navigation_failed'
        this.fabricSubmissionError = '任务已创建，但结果页打开失败。'
        uni.showToast({ title: '任务已创建，可前往最近任务查看', icon: 'none' })
      }
      try {
        uni.navigateTo({
          url: `/package-ai/result/result?taskId=${encodeURIComponent(taskId)}`,
          success: () => {
            this.fabricSubmissionStatus = 'navigated'
            this.fabricSubmissionError = ''
          },
          fail: handleFailure
        })
      } catch (error) {
        handleFailure()
      }
    },
    applyPatternParams() {
      const pattern = this.selectedPattern
      const patternValue = pattern ? pattern.value : ''
      const patternName = pattern ? pattern.label : ''
      const prompt = [this.patternCustomPrompt || (pattern ? pattern.prompt : '')].filter(Boolean).join('；')
      this.selectedParams = {
        ...this.selectedParams,
        actionType: 'pattern_replace',
        toolType: 'pattern',
        patternType: patternValue,
        patternDirection: patternValue,
        patternName,
        patternPrompt: prompt,
        referencePrompt: prompt,
        modificationPrompt: prompt,
        patternPlacement: this.patternPlacement,
        patternPosition: this.patternPlacement,
        hasPatternReferenceImage: Boolean(this.patternReferenceImagePath)
      }
      this.referenceStyle = patternValue
      this.referenceStyleName = patternName
      this.referencePrompt = prompt
    },
    selectPatternReference(pattern = {}) {
      const value = String(pattern.value || '').trim()
      if (!value || value === 'custom') return
      this.patternSourceTab = 'library'
      this.selectedPatternId = value
      this.patternReferenceImagePath = ''
      this.patternReferenceImageStatus = 'empty'
      this.patternReferenceImageError = ''
      this.patternSubmissionStatus = 'idle'
      this.patternSubmissionError = ''
      this.patternCreatedTaskId = ''
      this.applyPatternParams()
      this.savePatternDraft()
    },
    selectPatternPlacement(position) {
      this.patternPlacement = position || ''
      this.patternSubmissionStatus = 'idle'
      this.patternCreatedTaskId = ''
      this.applyPatternParams()
      this.savePatternDraft()
    },
    selectPatternSource(source = 'library') {
      if (!['library', 'upload'].includes(source) || this.patternSourceTab === source) return
      this.patternSourceTab = source
      this.selectedPatternId = ''
      this.patternReferenceImagePath = ''
      this.patternReferenceImageStatus = 'empty'
      this.patternReferenceImageError = ''
      this.patternSubmissionStatus = 'idle'
      this.patternCreatedTaskId = ''
      this.applyPatternParams()
      this.savePatternDraft()
    },
    promptPatternChange() {
      uni.showToast({ title: this.patternSourceTab === 'upload' ? '请重新上传图案' : '请从下方重新选择图案', icon: 'none' })
    },
    clearPatternSelection() {
      this.selectedPatternId = ''
      this.patternReferenceImagePath = ''
      this.patternReferenceImageStatus = 'empty'
      this.patternReferenceImageError = ''
      this.patternSubmissionStatus = 'idle'
      this.patternCreatedTaskId = ''
      this.applyPatternParams()
      this.savePatternDraft()
    },
    choosePatternReferenceImage() {
      if (this.patternReferenceImageStatus === 'uploading') return
      uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: async (res) => {
          const path = (res.tempFilePaths || [])[0] || ''
          const file = (res.tempFiles || [])[0] || { path }
          if (!path) return
          const previousImage = this.patternReferenceImagePath
          const previousPatternId = this.selectedPatternId
          const previousSource = this.patternSourceTab
          this.patternSourceTab = 'upload'
          this.patternReferenceImageStatus = 'uploading'
          this.patternReferenceImageError = ''
          try {
            const uploaded = await this.validateAndUploadStyleImage(file, path, 'pattern_replace_reference')
            this.patternReferenceImagePath = uploaded.url
            this.selectedPatternId = 'custom'
            this.patternReferenceImageStatus = 'ready'
            this.patternSubmissionStatus = 'idle'
            this.patternCreatedTaskId = ''
            this.applyPatternParams()
            this.savePatternDraft()
            uni.showToast({ title: '自定义图案已上传', icon: 'success' })
          } catch (error) {
            this.patternReferenceImagePath = previousImage
            this.selectedPatternId = previousPatternId
            this.patternSourceTab = previousSource
            this.patternReferenceImageStatus = previousImage ? 'ready' : 'error'
            this.patternReferenceImageError = this.getStyleImageErrorMessage(error)
            this.applyPatternParams()
            uni.showToast({ title: this.patternReferenceImageError, icon: 'none' })
          }
        }
      })
    },
    removePatternReferenceImage() {
      this.patternReferenceImagePath = ''
      this.selectedPatternId = ''
      this.patternReferenceImageStatus = 'empty'
      this.patternReferenceImageError = ''
      this.patternSubmissionStatus = 'idle'
      this.patternCreatedTaskId = ''
      this.applyPatternParams()
      this.savePatternDraft()
    },
    handlePatternPromptInput() {
      this.patternSubmissionStatus = 'idle'
      this.patternCreatedTaskId = ''
      this.applyPatternParams()
      this.savePatternDraft()
    },
    setPatternKeyboardActive(active = false) {
      this.patternKeyboardActive = Boolean(active)
    },
    async handlePatternClothImageSelection(response = {}) {
      const path = (response.tempFilePaths || [])[0] || ''
      const file = (response.tempFiles || [])[0] || { path }
      if (!path) return
      const previousImage = this.clothImagePath
      this.patternImageStatus = 'uploading'
      this.patternImageError = ''
      try {
        const uploaded = await this.validateAndUploadStyleImage(file, path, 'pattern_replace_source')
        this.clothImagePath = uploaded.url
        this.patternImageMeta = { ...uploaded.meta, sizeText: this.formatColorImageSize(uploaded.meta.size) }
        this.patternImageStatus = 'ready'
        this.patternSubmissionStatus = 'idle'
        this.patternCreatedTaskId = ''
        this.applyPatternParams()
        this.savePatternDraft()
        uni.showToast({ title: '服装图片已上传', icon: 'success' })
      } catch (error) {
        this.clothImagePath = previousImage
        this.patternImageStatus = previousImage ? 'ready' : 'error'
        this.patternImageError = this.getStyleImageErrorMessage(error)
        uni.showToast({ title: this.patternImageError, icon: 'none' })
      }
    },
    async ensurePatternImagesReadyForSubmit() {
      if (!this.isPatternTool) return
      if (this.clothImagePath && !this.isStableStyleImageUrl(this.clothImagePath)) {
        this.patternImageStatus = 'uploading'
        const uploaded = await this.validateAndUploadStyleImage({ path: this.clothImagePath }, this.clothImagePath, 'pattern_replace_source')
        this.clothImagePath = uploaded.url
        this.patternImageMeta = { ...uploaded.meta, sizeText: this.formatColorImageSize(uploaded.meta.size) }
        this.patternImageStatus = 'ready'
      }
      if (this.patternReferenceImagePath && !this.isStableStyleImageUrl(this.patternReferenceImagePath)) {
        this.patternReferenceImageStatus = 'uploading'
        const uploaded = await this.validateAndUploadStyleImage({ path: this.patternReferenceImagePath }, this.patternReferenceImagePath, 'pattern_replace_reference')
        this.patternReferenceImagePath = uploaded.url
        this.patternReferenceImageStatus = 'ready'
      }
      this.applyPatternParams()
    },
    buildPatternDraft() {
      return {
        version: 1,
        savedAt: Date.now(),
        clothImagePath: this.isStableStyleImageUrl(this.clothImagePath) ? this.clothImagePath : '',
        patternSourceTab: this.patternSourceTab,
        selectedPatternId: this.selectedPatternId,
        patternReferenceImagePath: this.isStableStyleImageUrl(this.patternReferenceImagePath) ? this.patternReferenceImagePath : '',
        patternPlacement: this.patternPlacement,
        patternCustomPrompt: this.patternCustomPrompt
      }
    },
    savePatternDraft() {
      if (!this.isPatternTool || ['task_created', 'navigation_failed', 'navigated'].includes(this.patternSubmissionStatus)) return
      const draft = this.buildPatternDraft()
      const hasContent = Boolean(draft.clothImagePath || draft.patternReferenceImagePath || draft.patternCustomPrompt || draft.selectedPatternId)
      try {
        if (hasContent) uni.setStorageSync(PATTERN_REDESIGN_DRAFT_STORAGE_KEY, draft)
        else uni.removeStorageSync(PATTERN_REDESIGN_DRAFT_STORAGE_KEY)
      } catch (error) {
        // Draft persistence is best effort and must not block generation.
      }
    },
    initializePatternDraft() {
      try {
        const draft = uni.getStorageSync(PATTERN_REDESIGN_DRAFT_STORAGE_KEY)
        const isFresh = draft && Number(draft.savedAt || 0) > Date.now() - 7 * 24 * 60 * 60 * 1000
        if (!isFresh) {
          if (draft) uni.removeStorageSync(PATTERN_REDESIGN_DRAFT_STORAGE_KEY)
          return
        }
        this.patternDraftData = draft
        this.patternDraftAvailable = true
      } catch (error) {
        this.patternDraftData = null
        this.patternDraftAvailable = false
      }
    },
    restorePatternDraft() {
      const draft = this.patternDraftData || {}
      this.clothImagePath = this.isStableStyleImageUrl(draft.clothImagePath) ? draft.clothImagePath : this.clothImagePath
      this.patternSourceTab = ['library', 'upload'].includes(draft.patternSourceTab) ? draft.patternSourceTab : 'library'
      this.selectedPatternId = PATTERN_REFERENCE_OPTIONS.some((item) => item.value === draft.selectedPatternId) ? draft.selectedPatternId : ''
      this.patternReferenceImagePath = this.isStableStyleImageUrl(draft.patternReferenceImagePath) ? draft.patternReferenceImagePath : ''
      if (this.selectedPatternId === 'custom' && !this.patternReferenceImagePath) this.selectedPatternId = ''
      this.patternPlacement = PATTERN_POSITION_OPTIONS.some((item) => item.value === draft.patternPlacement) ? draft.patternPlacement : 'chest'
      this.patternCustomPrompt = String(draft.patternCustomPrompt || '').slice(0, 200)
      this.patternImageStatus = this.clothImagePath ? 'ready' : 'empty'
      this.patternReferenceImageStatus = this.patternReferenceImagePath ? 'ready' : 'empty'
      this.patternDraftAvailable = false
      this.applyPatternParams()
      uni.showToast({ title: '已恢复换图案配置', icon: 'none' })
    },
    resetPatternDraft() {
      this.clothImagePath = ''
      this.patternSourceTab = 'library'
      this.selectedPatternId = 'floral'
      this.patternReferenceImagePath = ''
      this.patternPlacement = 'chest'
      this.patternCustomPrompt = ''
      this.patternImageStatus = 'empty'
      this.patternImageError = ''
      this.patternImageMeta = null
      this.patternReferenceImageStatus = 'empty'
      this.patternReferenceImageError = ''
      this.patternDraftAvailable = false
      this.patternDraftData = null
      try { uni.removeStorageSync(PATTERN_REDESIGN_DRAFT_STORAGE_KEY) } catch (error) {}
      this.applyPatternParams()
      uni.showToast({ title: '已重新开始', icon: 'none' })
    },
    clearPatternDraft() {
      this.patternDraftAvailable = false
      this.patternDraftData = null
      try { uni.removeStorageSync(PATTERN_REDESIGN_DRAFT_STORAGE_KEY) } catch (error) {}
    },
    navigateToCreatedPatternTask() {
      const taskId = String(this.patternCreatedTaskId || '').trim()
      if (!taskId) return
      const handleFailure = () => {
        this.patternSubmissionStatus = 'navigation_failed'
        this.patternSubmissionError = '任务已创建，但结果页打开失败。'
        uni.showToast({ title: '任务已创建，可前往最近任务查看', icon: 'none' })
      }
      try {
        uni.navigateTo({
          url: `/package-ai/result/result?taskId=${encodeURIComponent(taskId)}`,
          success: () => {
            this.patternSubmissionStatus = 'navigated'
            this.patternSubmissionError = ''
          },
          fail: handleFailure
        })
      } catch (error) {
        handleFailure()
      }
    },
    trackStyleRedesignEvent(eventName = '', payload = {}) {
      if (!isStyleRedesignDevelopment()) return
      console.log('[style-redesign:event]', {
        event: String(eventName || ''),
        status: String(payload.status || ''),
        errorCode: String(payload.errorCode || ''),
        selectedStyleCount: Number(payload.selectedStyleCount || 0),
        outputCount: Number(payload.outputCount || 0),
        durationMs: Number(payload.durationMs || 0)
      })
    },
    initializeStyleDraft(query = {}) {
      this.styleDraftReady = true
      const hasIncomingContext = Boolean(query.productionContextId || query.continueContextId)
      if (hasIncomingContext) return
      let draft = null
      try {
        draft = uni.getStorageSync(STYLE_REDESIGN_DRAFT_STORAGE_KEY)
      } catch (error) {
        this.trackStyleRedesignEvent('draft_read', { status: 'failed', errorCode: 'DRAFT_READ_FAILED' })
        return
      }
      const isCurrentDraft = draft
        && draft.schemaVersion === STYLE_REDESIGN_DRAFT_VERSION
        && Number(draft.updatedAt || 0) > Date.now() - STYLE_REDESIGN_DRAFT_MAX_AGE
      if (!isCurrentDraft) {
        if (draft) {
          try {
            uni.removeStorageSync(STYLE_REDESIGN_DRAFT_STORAGE_KEY)
          } catch (error) {
            this.trackStyleRedesignEvent('draft_clear', { status: 'failed', errorCode: 'DRAFT_CLEAR_FAILED' })
          }
        }
        return
      }
      this.styleDraftAvailable = true
      this.trackStyleRedesignEvent('draft_found', { status: 'available' })
      this.$nextTick(() => {
        uni.showModal({
          title: '发现未完成的改款草稿',
          content: '可以继续上次编辑，也可以重新开始。',
          confirmText: '继续编辑',
          cancelText: '重新开始',
          success: (result) => {
            if (result.confirm) this.restoreStyleDraft(draft)
            else this.resetStyleDraft()
          }
        })
      })
    },
    buildStyleDraft() {
      return {
        schemaVersion: STYLE_REDESIGN_DRAFT_VERSION,
        updatedAt: Date.now(),
        clothImagePath: this.isStableStyleImageUrl(this.clothImagePath) ? this.clothImagePath : '',
        styleImageMeta: this.styleImageMeta || null,
        styleReferenceSource: this.styleReferenceSource,
        styleReferenceImagePath: this.isStableStyleImageUrl(this.styleReferenceImagePath) ? this.styleReferenceImagePath : '',
        styleReferenceImageMeta: this.styleReferenceImageMeta || null,
        referenceStyle: this.referenceStyle || '',
        referenceStyleName: this.referenceStyleName || '',
        referencePrompt: this.referencePrompt || '',
        styleWizardStep: this.styleWizardStep,
        styleChangeTargets: [...this.styleChangeTargets],
        styleTargetDirections: { ...this.styleTargetDirections },
        styleChangeIntensity: this.styleChangeIntensity,
        styleDesignPurpose: this.styleDesignPurpose,
        stylePreserveItems: [...this.stylePreserveItems],
        styleModificationMode: this.styleModificationMode,
        selectedModifyTypes: [...this.selectedModifyTypes],
        styleFitDirection: this.styleFitDirection,
        selectedStyles: [...this.selectedStyles],
        aiPlanId: this.selectedParams.aiPlanId || '',
        aiPlanName: this.selectedParams.aiPlanName || '',
        styleCustomPrompt: this.styleCustomPrompt || '',
        aiGeneratedPrompt: this.aiGeneratedPrompt || '',
        styleOutputCount: this.styleOutputCount,
        styleDesignPlanName: this.styleDesignPlanName || ''
      }
    },
    saveStyleDraft() {
      if (!this.isStyleTool || !this.styleDraftReady || this.styleSubmissionStatus === 'navigated') return
      const hasContent = Boolean(
        this.isStableStyleImageUrl(this.clothImagePath)
        || this.isStableStyleImageUrl(this.styleReferenceImagePath)
        || this.referenceStyle
        || (this.styleCustomPrompt || '').trim()
        || (this.styleDesignPlanName || '').trim()
      )
      if (!hasContent) {
        try {
          uni.removeStorageSync(STYLE_REDESIGN_DRAFT_STORAGE_KEY)
        } catch (error) {
          this.trackStyleRedesignEvent('draft_clear', { status: 'failed', errorCode: 'DRAFT_CLEAR_FAILED' })
        }
        return
      }
      try {
        uni.setStorageSync(STYLE_REDESIGN_DRAFT_STORAGE_KEY, this.buildStyleDraft())
      } catch (error) {
        this.trackStyleRedesignEvent('draft_write', { status: 'failed', errorCode: 'DRAFT_WRITE_FAILED' })
      }
    },
    restoreStyleDraft(draft = {}) {
      const allowedSources = STYLE_REFERENCE_SOURCE_TABS.map((item) => item.value)
      const allowedFits = STYLE_FIT_OPTIONS.map((item) => item.value)
      const allowedStyles = this.styleDesignOptions.map((item) => item.value)
      const allowedTargets = STYLE_CHANGE_TARGETS.map((item) => item.value)
      const allowedIntensities = STYLE_CHANGE_INTENSITIES.map((item) => item.value)
      const allowedPurposes = STYLE_DESIGN_PURPOSES.map((item) => item.value)
      const allowedPreserves = STYLE_PRESERVE_OPTIONS.map((item) => item.value)
      const draftSourceImage = String(draft.clothImagePath || '').trim()
      const draftReferenceImage = String(draft.styleReferenceImagePath || '').trim()
      this.clothImagePath = this.isStableStyleImageUrl(draftSourceImage) ? draftSourceImage : ''
      this.styleImageMeta = this.clothImagePath ? (draft.styleImageMeta || null) : null
      this.styleImageStatus = this.clothImagePath ? 'ready' : 'empty'
      this.styleImageError = draftSourceImage && !this.clothImagePath ? '草稿中的原款图片已失效，请重新上传。' : ''
      this.styleReferenceSource = allowedSources.includes(draft.styleReferenceSource) && draft.styleReferenceSource !== 'system'
        ? draft.styleReferenceSource
        : 'upload'
      this.styleReferenceImagePath = this.isStableStyleImageUrl(draftReferenceImage) ? draftReferenceImage : ''
      this.styleReferenceImageMeta = this.styleReferenceImagePath ? (draft.styleReferenceImageMeta || null) : null
      this.styleReferenceImageStatus = this.styleReferenceImagePath ? 'ready' : 'empty'
      this.styleReferenceImageError = draftReferenceImage && !this.styleReferenceImagePath ? '草稿中的参考图已失效，请重新上传。' : ''
      this.referenceStyle = String(draft.referenceStyle || '')
      this.referenceStyleName = String(draft.referenceStyleName || '')
      this.referencePrompt = String(draft.referencePrompt || '')
      if (this.styleReferenceSource !== 'system') {
        this.referenceStyle = ''
        this.referenceStyleName = ''
        this.referencePrompt = ''
      }
      this.styleWizardStep = Math.max(1, Math.min(4, Number(draft.styleWizardStep) || 1))
      this.styleChangeTargets = Array.isArray(draft.styleChangeTargets)
        ? draft.styleChangeTargets.filter((value) => allowedTargets.includes(value))
        : []
      this.styleTargetDirections = this.styleChangeTargets.reduce((result, value) => {
        const target = STYLE_CHANGE_TARGETS.find((item) => item.value === value)
        const direction = draft.styleTargetDirections && draft.styleTargetDirections[value]
        if (target && target.directions.includes(direction)) result[value] = direction
        return result
      }, {})
      const legacyIntensity = STYLE_CHANGE_INTENSITIES.find((item) => item.legacyValue === draft.styleModificationMode)
      this.styleChangeIntensity = allowedIntensities.includes(draft.styleChangeIntensity)
        ? draft.styleChangeIntensity
        : ((legacyIntensity && legacyIntensity.value) || 'minor')
      this.styleDesignPurpose = allowedPurposes.includes(draft.styleDesignPurpose) ? draft.styleDesignPurpose : 'ecommerce_launch'
      const restoredPreserves = Array.isArray(draft.stylePreserveItems)
        ? draft.stylePreserveItems.filter((value) => allowedPreserves.includes(value))
        : allowedPreserves
      this.stylePreserveItems = restoredPreserves
      const restoredIntensityOption = STYLE_CHANGE_INTENSITIES.find((item) => item.value === this.styleChangeIntensity) || STYLE_CHANGE_INTENSITIES[0]
      this.styleModificationMode = restoredIntensityOption.legacyValue
      this.selectedModifyTypes = [this.styleModificationMode]
      this.styleFitDirection = allowedFits.includes(draft.styleFitDirection) ? draft.styleFitDirection : 'slim'
      const restoredStyles = Array.isArray(draft.selectedStyles)
        ? draft.selectedStyles.filter((value) => allowedStyles.includes(value))
        : []
      this.selectedStyles = restoredStyles.length ? restoredStyles : ['commute']
      this.styleCustomPrompt = String(draft.styleCustomPrompt || '').slice(0, 300)
      this.aiGeneratedPrompt = String(draft.aiGeneratedPrompt || '')
      this.styleOutputCount = STYLE_OUTPUT_COUNT_OPTIONS.includes(Number(draft.styleOutputCount))
        ? Number(draft.styleOutputCount)
        : (this.genericRuntimeConfig.isInternalDebug ? 1 : 2)
      this.styleDesignPlanName = String(draft.styleDesignPlanName || '')
      this.styleSavePanelOpen = Boolean(this.styleDesignPlanName)
      this.selectedParams = {
        ...this.selectedParams,
        aiPlanId: String(draft.aiPlanId || ''),
        aiPlanName: String(draft.aiPlanName || '')
      }
      this.styleDraftAvailable = false
      this.applyStyleParams()
      this.trackStyleRedesignEvent('draft_restored', {
        status: 'success',
        selectedStyleCount: this.selectedStyles.length,
        outputCount: this.styleOutputCount
      })
      uni.showToast({ title: '已恢复上次草稿', icon: 'success' })
    },
    resetStyleDraft() {
      this.styleDraftReady = false
      this.clothImagePath = ''
      this.styleImageStatus = 'empty'
      this.styleImageError = ''
      this.styleImageMeta = null
      this.styleReferenceSource = 'upload'
      this.styleReferenceImagePath = ''
      this.styleReferenceImageStatus = 'empty'
      this.styleReferenceImageError = ''
      this.styleReferenceImageMeta = null
      this.referenceStyle = ''
      this.referenceStyleName = ''
      this.referencePrompt = ''
      this.styleWizardStep = 1
      this.styleChangeTargets = []
      this.styleTargetDirections = {}
      this.styleChangeIntensity = 'minor'
      this.styleDesignPurpose = 'ecommerce_launch'
      this.stylePreserveItems = STYLE_PRESERVE_OPTIONS.map((item) => item.value)
      this.styleModificationMode = 'micro_change'
      this.selectedModifyTypes = ['micro_change']
      this.styleFitDirection = 'slim'
      this.selectedStyles = ['commute']
      this.styleCustomPrompt = ''
      this.aiGeneratedPrompt = ''
      this.styleOutputCount = this.genericRuntimeConfig.isInternalDebug ? 1 : 2
      this.styleDesignPlanName = ''
      this.styleSavePanelOpen = false
      this.styleDraftAvailable = false
      this.styleSubmissionStatus = 'idle'
      this.styleSubmissionError = ''
      this.styleCreatedTaskId = ''
      this.styleCreatedBatchId = ''
      this.styleCreatedHistoryId = ''
      this.styleSubmissionKey = ''
      this.resetSelectedParams()
      this.styleDraftReady = true
      try {
        uni.removeStorageSync(STYLE_REDESIGN_DRAFT_STORAGE_KEY)
      } catch (error) {
        this.trackStyleRedesignEvent('draft_clear', { status: 'failed', errorCode: 'DRAFT_CLEAR_FAILED' })
      }
      this.trackStyleRedesignEvent('draft_reset', { status: 'success' })
      uni.showToast({ title: '已重新开始', icon: 'none' })
    },
    clearStyleDraftAfterNavigation() {
      this.styleDraftReady = false
      this.styleDraftAvailable = false
      try {
        uni.removeStorageSync(STYLE_REDESIGN_DRAFT_STORAGE_KEY)
      } catch (error) {
        this.trackStyleRedesignEvent('draft_clear', { status: 'failed', errorCode: 'DRAFT_CLEAR_FAILED' })
      }
    },
    getDisplayDraftMode() {
      return this.isDetailDisplayTool ? 'detail' : 'display'
    },
    getDisplayDraftStorageKey(mode = this.getDisplayDraftMode()) {
      return DISPLAY_DRAFT_STORAGE_KEYS[mode] || DISPLAY_DRAFT_STORAGE_KEYS.display
    },
    buildDisplayDraft() {
      const mode = this.getDisplayDraftMode()
      return {
        version: 1,
        savedAt: Date.now(),
        mode,
        clothImagePath: this.isStableStyleImageUrl(this.clothImagePath) ? this.clothImagePath : '',
        selectedDisplayModes: mode === 'display' ? [...this.selectedDisplayModes] : ['detail_photo'],
        activeDisplayType: this.activeDisplayType,
        selectedParams: { ...this.selectedParams },
        selectedDetailParts: [...this.selectedDetailParts],
        detailGenerationMode: this.detailGenerationMode,
        detailReferenceImages: Object.keys(this.detailReferenceImages || {}).reduce((result, key) => {
          const value = this.detailReferenceImages[key]
          if (this.isStableStyleImageUrl(value)) result[key] = value
          return result
        }, {}),
        detailCustomPrompt: this.detailCustomPrompt
      }
    },
    saveDisplayDraft() {
      if (!this.isDisplayTool || ['task_created', 'navigation_failed', 'navigated'].includes(this.displaySubmissionStatus)) return
      const draft = this.buildDisplayDraft()
      const hasNonDefaultDisplayMode = draft.mode === 'display'
        && (draft.selectedDisplayModes.length !== 1 || draft.selectedDisplayModes[0] !== 'flat_lay')
      const hasNonDefaultDetail = draft.mode === 'detail'
        && (draft.selectedDetailParts.length !== 1 || draft.selectedDetailParts[0] !== 'collar' || draft.detailGenerationMode !== GARMENT_DETAIL_MODES.FAITHFUL)
      const hasContent = Boolean(draft.clothImagePath || draft.detailCustomPrompt || Object.keys(draft.detailReferenceImages || {}).length || hasNonDefaultDisplayMode || hasNonDefaultDetail)
      try {
        if (hasContent) uni.setStorageSync(this.getDisplayDraftStorageKey(draft.mode), draft)
        else uni.removeStorageSync(this.getDisplayDraftStorageKey(draft.mode))
      } catch (error) {
        // Draft persistence is best effort and must not block generation.
      }
    },
    initializeDisplayDraft() {
      this.displayDraftAvailable = false
      this.displayDraftData = null
      try {
        const draft = uni.getStorageSync(this.getDisplayDraftStorageKey())
        const fresh = draft && Number(draft.savedAt || 0) > Date.now() - STYLE_REDESIGN_DRAFT_MAX_AGE
        if (!fresh) {
          if (draft) uni.removeStorageSync(this.getDisplayDraftStorageKey())
          return
        }
        this.displayDraftData = draft
        this.displayDraftAvailable = true
      } catch (error) {
        this.displayDraftData = null
      }
    },
    restoreDisplayDraft() {
      const draft = this.displayDraftData || {}
      const stableImage = this.isStableStyleImageUrl(draft.clothImagePath) ? draft.clothImagePath : ''
      if (stableImage) this.clothImagePath = stableImage
      this.displayImageStatus = this.clothImagePath ? 'ready' : 'empty'
      if (this.isDetailDisplayTool) {
        const validParts = (Array.isArray(draft.selectedDetailParts) ? draft.selectedDetailParts : [])
          .filter((value) => DETAIL_REFERENCE_OPTIONS.some((item) => item.value === value))
        this.selectedDetailParts = validParts.length ? validParts : ['collar']
        this.detailGenerationMode = draft.detailGenerationMode === GARMENT_DETAIL_MODES.AI_REFERENCE
          ? GARMENT_DETAIL_MODES.AI_REFERENCE
          : GARMENT_DETAIL_MODES.FAITHFUL
        this.detailReferenceImages = Object.keys(draft.detailReferenceImages || {}).reduce((result, key) => {
          const value = draft.detailReferenceImages[key]
          if (this.isStableStyleImageUrl(value)) result[key] = value
          return result
        }, {})
        this.detailCustomPrompt = String(draft.detailCustomPrompt || '').slice(0, 200)
        this.applyDetailParams()
      } else {
        const modes = (Array.isArray(draft.selectedDisplayModes) ? draft.selectedDisplayModes : [])
          .filter((value) => DISPLAY_TOOL_TYPES.includes(value) && value !== 'detail_photo')
        this.selectedDisplayModes = modes.length ? modes : ['flat_lay']
        const activeType = this.selectedDisplayModes.includes(draft.activeDisplayType)
          ? draft.activeDisplayType
          : this.selectedDisplayModes[0]
        this.toolType = activeType
        this.activeDisplayType = activeType
        this.lastDisplayModes = [...this.selectedDisplayModes]
        this.resetSelectedParams()
        const allowedKeys = (this.currentTool.paramGroups || []).map((group) => group.key)
        allowedKeys.forEach((key) => {
          const group = (this.currentTool.paramGroups || []).find((item) => item.key === key)
          const value = draft.selectedParams && draft.selectedParams[key]
          if (group && (group.options || []).some((item) => item.value === value)) this.selectedParams[key] = value
        })
      }
      this.displayDraftAvailable = false
      this.displaySubmissionStatus = 'idle'
      uni.showToast({ title: '已恢复上次配置', icon: 'none' })
    },
    resetDisplayDraft() {
      const mode = this.getDisplayDraftMode()
      this.clothImagePath = ''
      this.displayImageStatus = 'empty'
      this.displayImageError = ''
      this.displayImageMeta = null
      this.displaySubmissionStatus = 'idle'
      this.displaySubmissionError = ''
      this.displayCreatedTaskId = ''
      this.displayCreatedBatchId = ''
      this.displayCreatedHistoryId = ''
      this.displaySubmissionKey = ''
      if (mode === 'detail') {
        this.selectedDetailParts = ['collar']
        this.detailGenerationMode = GARMENT_DETAIL_MODES.FAITHFUL
        this.detailReferenceImages = {}
        this.detailReferenceUploadStatus = {}
        this.detailReferenceUploadErrors = {}
        this.detailCustomPrompt = ''
        this.activeDetailCategory = 'all'
        this.showAllDetailParts = false
      } else {
        this.selectedDisplayModes = ['flat_lay']
        this.lastDisplayModes = ['flat_lay']
        this.toolType = 'flat_lay'
        this.activeDisplayType = 'flat_lay'
      }
      this.displayDraftAvailable = false
      this.displayDraftData = null
      try { uni.removeStorageSync(this.getDisplayDraftStorageKey(mode)) } catch (error) {}
      this.resetSelectedParams()
      uni.showToast({ title: '已重新开始', icon: 'none' })
    },
    clearDisplayDraft() {
      this.displayDraftAvailable = false
      this.displayDraftData = null
      try { uni.removeStorageSync(this.getDisplayDraftStorageKey()) } catch (error) {}
    },
    async handleDisplayClothImageSelection(response = {}) {
      const path = (response.tempFilePaths || [])[0] || ''
      const file = (response.tempFiles || [])[0] || { path }
      if (!path) return
      const previousImage = this.clothImagePath
      this.displayImageStatus = 'uploading'
      this.displayImageError = ''
      try {
        const uploaded = await this.validateAndUploadStyleImage(file, path, this.isDetailDisplayTool ? 'detail_photo_source' : 'display_image_source')
        this.clothImagePath = uploaded.url
        this.displayImageMeta = { ...uploaded.meta, sizeText: this.formatColorImageSize(uploaded.meta.size) }
        this.displayImageStatus = 'ready'
        this.displaySubmissionStatus = 'idle'
        this.displayCreatedTaskId = ''
        this.saveDisplayDraft()
        uni.showToast({ title: '服装图片已上传', icon: 'success' })
      } catch (error) {
        this.clothImagePath = previousImage
        this.displayImageStatus = previousImage ? 'ready' : 'error'
        this.displayImageError = this.getStyleImageErrorMessage(error)
        uni.showToast({ title: this.displayImageError, icon: 'none' })
      }
    },
    async ensureDisplayImageReadyForSubmit() {
      if (!this.isDisplayTool) return
      if (this.clothImagePath && !this.isStableStyleImageUrl(this.clothImagePath)) {
        this.displayImageStatus = 'uploading'
        const uploaded = await this.validateAndUploadStyleImage({ path: this.clothImagePath }, this.clothImagePath, this.isDetailDisplayTool ? 'detail_photo_source' : 'display_image_source')
        this.clothImagePath = uploaded.url
        this.displayImageMeta = { ...uploaded.meta, sizeText: this.formatColorImageSize(uploaded.meta.size) }
        this.displayImageStatus = 'ready'
      }
    },
    navigateToCreatedDisplayTask() {
      const taskId = String(this.displayCreatedTaskId || '').trim()
      if (!taskId) return
      const handleFailure = () => {
        this.displaySubmissionStatus = 'navigation_failed'
        this.displaySubmissionError = '任务已创建，但结果页打开失败。'
        uni.showToast({ title: '任务已创建，可前往任务记录查看', icon: 'none' })
      }
      try {
        const query = [`taskId=${encodeURIComponent(taskId)}`]
        if (this.displayCreatedBatchId) query.push(`batchId=${encodeURIComponent(this.displayCreatedBatchId)}`)
        if (this.displayCreatedHistoryId) query.push(`historyId=${encodeURIComponent(this.displayCreatedHistoryId)}`)
        uni.navigateTo({
          url: `/package-ai/result/result?${query.join('&')}`,
          success: () => {
            this.displaySubmissionStatus = 'navigated'
            this.displaySubmissionError = ''
          },
          fail: handleFailure
        })
      } catch (error) {
        handleFailure()
      }
    },
    isStableStyleImageUrl(value = '') {
      return /^(cloud:\/\/|https:\/\/)/i.test(String(value || '').trim())
    },
    getStyleImageInfo(path = '') {
      return new Promise((resolve, reject) => {
        uni.getImageInfo({
          src: path,
          success: resolve,
          fail: () => {
            const error = new Error('无法读取图片信息')
            error.code = 'STYLE_IMAGE_INFO_FAILED'
            reject(error)
          }
        })
      })
    },
    getStyleImageErrorMessage(error = {}) {
      const errorCode = String(error.code || error.errorCode || '')
      const messages = {
        STYLE_IMAGE_FORMAT_INVALID: '仅支持 JPG、PNG 或 WEBP 图片。',
        STYLE_IMAGE_TOO_LARGE: '图片不能超过 10MB，请压缩后重试。',
        STYLE_IMAGE_TOO_SMALL: '图片尺寸过小，宽高均需至少 256px。',
        STYLE_IMAGE_INFO_FAILED: '无法读取图片，请重新选择。',
        STYLE_IMAGE_UPLOAD_FAILED: '图片上传失败，请检查网络后重试。',
        STYLE_IMAGE_STABLE_URL_REQUIRED: '图片地址暂不可用，请重新上传。'
      }
      return messages[errorCode] || '图片处理失败，请重新选择。'
    },
    async validateAndUploadStyleImage(file = {}, path = '', scene = 'style_redesign') {
      const safePath = String(path || file.path || '').trim()
      if (!safePath) {
        const error = new Error('Image path is required')
        error.code = 'STYLE_IMAGE_INFO_FAILED'
        throw error
      }
      const cleanPath = safePath.split('?')[0].split('#')[0]
      const extensionMatch = cleanPath.match(/\.([a-zA-Z0-9]+)$/)
      const extension = extensionMatch ? extensionMatch[1].toLowerCase() : ''
      if (extension && !STYLE_IMAGE_ALLOWED_EXTENSIONS.includes(extension)) {
        const error = new Error('Unsupported image format')
        error.code = 'STYLE_IMAGE_FORMAT_INVALID'
        throw error
      }
      const size = Number(file.size || 0)
      if (size > STYLE_IMAGE_MAX_BYTES) {
        const error = new Error('Image is too large')
        error.code = 'STYLE_IMAGE_TOO_LARGE'
        throw error
      }
      const imageInfo = await this.getStyleImageInfo(safePath)
      const imageType = String(imageInfo.type || extension || '').toLowerCase().replace('jpeg', 'jpg')
      if (imageType && !STYLE_IMAGE_ALLOWED_EXTENSIONS.map((item) => item.replace('jpeg', 'jpg')).includes(imageType)) {
        const error = new Error('Unsupported image format')
        error.code = 'STYLE_IMAGE_FORMAT_INVALID'
        throw error
      }
      if (Number(imageInfo.width || 0) < STYLE_IMAGE_MIN_SIDE || Number(imageInfo.height || 0) < STYLE_IMAGE_MIN_SIDE) {
        const error = new Error('Image dimensions are too small')
        error.code = 'STYLE_IMAGE_TOO_SMALL'
        throw error
      }
      let uploaded = null
      try {
        uploaded = await uploadImage({ filePath: safePath, scene })
      } catch (error) {
        const normalized = new Error('Image upload failed')
        normalized.code = 'STYLE_IMAGE_UPLOAD_FAILED'
        throw normalized
      }
      const stableUrl = String(uploaded && (uploaded.fileId || uploaded.fileID || uploaded.fileUrl || uploaded.imageUrl || uploaded.url) || '').trim()
      if (!this.isStableStyleImageUrl(stableUrl)) {
        const error = new Error('Stable image URL is required')
        error.code = 'STYLE_IMAGE_STABLE_URL_REQUIRED'
        throw error
      }
      return {
        url: stableUrl,
        meta: {
          width: Number(imageInfo.width || 0),
          height: Number(imageInfo.height || 0),
          size,
          format: imageType || extension || 'image'
        }
      }
    },
    async handleStyleClothImageSelection(response = {}) {
      const path = (response.tempFilePaths || [])[0] || ''
      const file = (response.tempFiles || [])[0] || { path }
      if (!path) return
      const previousImage = this.clothImagePath
      this.styleImageStatus = 'uploading'
      this.styleImageError = ''
      try {
        const uploaded = await this.validateAndUploadStyleImage(file, path, 'style_redesign_source')
        this.clothImagePath = uploaded.url
        this.styleImageMeta = uploaded.meta
        this.styleImageStatus = 'ready'
        this.styleSubmissionStatus = 'idle'
        this.styleCreatedTaskId = ''
        this.applyStyleParams()
        this.trackStyleRedesignEvent('source_image_uploaded', { status: 'success' })
        uni.showToast({ title: '原款图片已上传', icon: 'success' })
      } catch (error) {
        this.clothImagePath = previousImage
        this.styleImageStatus = previousImage ? 'ready' : 'error'
        this.styleImageError = this.getStyleImageErrorMessage(error)
        this.trackStyleRedesignEvent('source_image_uploaded', {
          status: 'failed',
          errorCode: String(error.code || 'STYLE_IMAGE_UPLOAD_FAILED')
        })
        uni.showToast({ title: this.styleImageError, icon: 'none' })
      }
    },
    async handleStyleReferenceImageSelection(response = {}) {
      const path = (response.tempFilePaths || [])[0] || ''
      const file = (response.tempFiles || [])[0] || { path }
      if (!path) return
      const previousImage = this.styleReferenceImagePath
      this.styleReferenceImageStatus = 'uploading'
      this.styleReferenceImageError = ''
      try {
        const uploaded = await this.validateAndUploadStyleImage(file, path, 'style_redesign_reference')
        this.styleReferenceImagePath = uploaded.url
        this.styleReferenceImageMeta = uploaded.meta
        this.styleReferenceImageStatus = 'ready'
        this.applyStyleParams()
        this.trackStyleRedesignEvent('reference_image_uploaded', { status: 'success' })
        uni.showToast({ title: '参考图已上传', icon: 'success' })
      } catch (error) {
        this.styleReferenceImagePath = previousImage
        this.styleReferenceImageStatus = previousImage ? 'ready' : 'error'
        this.styleReferenceImageError = this.getStyleImageErrorMessage(error)
        this.trackStyleRedesignEvent('reference_image_uploaded', {
          status: 'failed',
          errorCode: String(error.code || 'STYLE_IMAGE_UPLOAD_FAILED')
        })
        uni.showToast({ title: this.styleReferenceImageError, icon: 'none' })
      }
    },
    async ensureStyleImagesReadyForSubmit() {
      if (!this.isStyleTool) return
      if (this.clothImagePath && !this.isStableStyleImageUrl(this.clothImagePath)) {
        this.styleImageStatus = 'uploading'
        const uploaded = await this.validateAndUploadStyleImage({ path: this.clothImagePath }, this.clothImagePath, 'style_redesign_source')
        this.clothImagePath = uploaded.url
        this.styleImageMeta = uploaded.meta
        this.styleImageStatus = 'ready'
      }
      if (this.styleReferenceSource !== 'system' && this.styleReferenceImagePath && !this.isStableStyleImageUrl(this.styleReferenceImagePath)) {
        this.styleReferenceImageStatus = 'uploading'
        const uploaded = await this.validateAndUploadStyleImage({ path: this.styleReferenceImagePath }, this.styleReferenceImagePath, 'style_redesign_reference')
        this.styleReferenceImagePath = uploaded.url
        this.styleReferenceImageMeta = uploaded.meta
        this.styleReferenceImageStatus = 'ready'
      }
      this.applyStyleParams()
    },
    async stabilizeIncomingStyleImages() {
      const hasLocalSource = this.clothImagePath && !this.isStableStyleImageUrl(this.clothImagePath)
      const hasLocalReference = this.styleReferenceSource !== 'system'
        && this.styleReferenceImagePath
        && !this.isStableStyleImageUrl(this.styleReferenceImagePath)
      if (!hasLocalSource && !hasLocalReference) return
      try {
        await this.ensureStyleImagesReadyForSubmit()
      } catch (error) {
        const errorMessage = this.getStyleImageErrorMessage(error)
        if (hasLocalSource) {
          this.styleImageStatus = 'error'
          this.styleImageError = errorMessage
        }
        if (hasLocalReference) {
          this.styleReferenceImageStatus = 'error'
          this.styleReferenceImageError = errorMessage
        }
        this.trackStyleRedesignEvent('context_image_stabilized', {
          status: 'failed',
          errorCode: String(error.code || 'STYLE_IMAGE_UPLOAD_FAILED')
        })
      }
    },
    loadStyleMembershipUsage() {
      const result = getMembershipUsage()
      const usage = result && result.ok && result.data ? result.data : null
      this.styleRemainingQuota = usage && usage.available !== false
        ? Number(usage.remaining)
        : null
    },
    getStyleStepValidationReason(step = this.styleWizardStep) {
      if (step === 1) {
        if (this.styleImageStatus === 'uploading' || this.styleReferenceImageStatus === 'uploading') return '图片上传中，请稍候'
        if (!this.clothImagePath) return '请先上传原款图片'
      }
      if (step === 2) {
        if (!this.styleChangeTargets.length) return '请选择至少一个需要修改的部位'
        if (this.selectedStyleChangeDetails.some((item) => !item.direction)) return '请为每个改动部位选择目标方向'
      }
      if (step === 3) {
        if (!this.styleChangeIntensity) return '请选择改动强度'
        if (!this.selectedStyles.length) return '请至少选择一种风格方向'
        if (!this.styleDesignPurpose) return '请选择设计用途'
        if (this.styleConflictMessage) return this.styleConflictMessage
      }
      return ''
    },
    goToStyleWizardStep(step) {
      const requested = Math.max(1, Math.min(4, Number(step) || 1))
      const target = requested > this.styleWizardStep ? Math.min(requested, this.styleWizardStep + 1) : requested
      if (target > this.styleWizardStep) {
        const reason = this.getStyleStepValidationReason(this.styleWizardStep)
        if (reason) {
          uni.showToast({ title: reason, icon: 'none' })
          return
        }
      }
      this.styleWizardStep = target
      this.saveStyleDraft()
      uni.pageScrollTo({ scrollTop: 0, duration: 180 })
    },
    nextStyleWizardStep() {
      const reason = this.getStyleStepValidationReason(this.styleWizardStep)
      if (reason) {
        uni.showToast({ title: reason, icon: 'none' })
        return
      }
      this.goToStyleWizardStep(this.styleWizardStep + 1)
    },
    previousStyleWizardStep() {
      this.goToStyleWizardStep(this.styleWizardStep - 1)
    },
    toggleStyleChangeTarget(target = {}) {
      const value = target.value || ''
      if (!value) return
      if (this.styleChangeTargets.includes(value)) {
        this.styleChangeTargets = this.styleChangeTargets.filter((item) => item !== value)
        const nextDirections = { ...this.styleTargetDirections }
        delete nextDirections[value]
        this.styleTargetDirections = nextDirections
      } else {
        this.styleChangeTargets = [...this.styleChangeTargets, value]
      }
      this.applyStyleParams()
    },
    selectStyleTargetDirection(targetValue, direction) {
      if (!targetValue || !direction) return
      this.styleTargetDirections = {
        ...this.styleTargetDirections,
        [targetValue]: direction
      }
      this.applyStyleParams()
    },
    selectStyleChangeIntensity(value) {
      const option = STYLE_CHANGE_INTENSITIES.find((item) => item.value === value) || STYLE_CHANGE_INTENSITIES[0]
      this.styleChangeIntensity = option.value
      this.styleModificationMode = option.legacyValue
      this.selectedModifyTypes = [option.legacyValue]
      this.applyStyleParams()
    },
    selectStyleDesignPurpose(value) {
      this.styleDesignPurpose = value || 'ecommerce_launch'
      this.applyStyleParams()
    },
    toggleStylePreserveItem(value) {
      if (!value) return
      this.stylePreserveItems = this.stylePreserveItems.includes(value)
        ? this.stylePreserveItems.filter((item) => item !== value)
        : [...this.stylePreserveItems, value]
      this.applyStyleParams()
    },
    buildStructuredStylePrompt() {
      const changes = this.selectedStyleChangeDetails
        .map((item) => `${item.label}必须改为${item.direction}`)
        .join('；')
      const preserves = this.styleSelectedPreserveLabels.join('、')
      const styles = this.selectedStyleNames.join('、')
      const referenceRule = this.hasStyleReferenceSelection
        ? '参考设计图仅用于借鉴设计元素，不复制其中的模特、背景和品牌标识'
        : '不使用额外参考设计图'
      const additional = (this.styleCustomPrompt || '').trim()
      return [
        `必须修改：${changes}`,
        `改动强度：${this.styleChangeIntensityLabel}`,
        `设计方向：${styles}`,
        `设计用途：${this.styleDesignPurposeLabel}`,
        `必须保持不变：${preserves || '无额外保留项'}`,
        referenceRule,
        additional ? `补充要求：${additional}` : '',
        '除明确选中的部位外，其余服装结构保持原样；不得随机更换模特、人脸、姿势、背景或构图；不得生成白底商品图'
      ].filter(Boolean).join('。')
    },
    validateStyleSubmission() {
      if (!this.clothImagePath) return '请先上传原款图片'
      if (!this.styleChangeTargets.length) return '请选择至少一个需要修改的部位'
      if (this.selectedStyleChangeDetails.some((item) => !item.direction)) return '请为每个改动部位选择目标方向'
      if (!this.styleChangeIntensity) return '请选择改动强度'
      if (!this.selectedStyles.length) return '请至少选择一种风格倾向'
      if (!this.styleDesignPurpose) return '请选择设计用途'
      if (this.styleConflictMessage) return this.styleConflictMessage
      return ''
    },
    setStyleKeyboardActive(active = false) {
      this.styleKeyboardActive = Boolean(active)
    },
    navigateToCreatedStyleTask() {
      const taskId = String(this.styleCreatedTaskId || '').trim()
      if (!taskId) return
      const query = [`taskId=${encodeURIComponent(taskId)}`]
      if (this.styleCreatedBatchId) query.push(`batchId=${encodeURIComponent(this.styleCreatedBatchId)}`)
      if (this.styleCreatedHistoryId) query.push(`historyId=${encodeURIComponent(this.styleCreatedHistoryId)}`)
      const handleNavigationFailure = () => {
        this.styleSubmissionStatus = 'navigation_failed'
        this.styleSubmissionError = '任务已创建，但结果页打开失败。'
        this.trackStyleRedesignEvent('result_navigation', {
          status: 'failed',
          errorCode: 'RESULT_NAVIGATION_FAILED'
        })
        uni.showToast({ title: '任务已创建，请再次点击查看', icon: 'none' })
      }
      try {
        uni.navigateTo({
          url: `/package-ai/result/result?${query.join('&')}`,
          success: () => {
            this.styleSubmissionStatus = 'navigated'
            this.styleSubmissionError = ''
            this.clearStyleDraftAfterNavigation()
            this.trackStyleRedesignEvent('result_navigation', { status: 'success' })
          },
          fail: handleNavigationFailure
        })
      } catch (error) {
        handleNavigationFailure()
      }
    },
    applyStyleParams() {
      const selectedModifyTypes = this.selectedModifyTypes.length ? [...this.selectedModifyTypes] : ['micro_change']
      const selectedStyles = this.selectedStyles.length ? [...this.selectedStyles] : ['commute']
      const activeStyleReferenceImage = this.styleReferenceSource === 'system' ? '' : this.styleReferenceImagePath
      const structuredPrompt = this.buildStructuredStylePrompt()
      this.selectedParams = {
        ...this.selectedParams,
        toolType: 'refine',
        referenceStyle: this.referenceStyle,
        referenceStyleName: this.referenceStyleName,
        referencePrompt: this.referencePrompt,
        styleFitDirection: this.styleFitDirection,
        styleModificationMode: selectedModifyTypes[0] || this.styleModificationMode,
        styleReferenceSource: this.styleReferenceSource,
        modifySelectionMode: 'single',
        selectedModifyTypes,
        selectedModifyTypeNames: this.selectedModifyTypeNames,
        selectedStyles,
        selectedStyleNames: this.selectedStyleNames,
        aiGeneratedPrompt: this.aiGeneratedPrompt,
        changeTargets: [...this.styleChangeTargets],
        targetDirections: { ...this.styleTargetDirections },
        changeIntensity: this.styleChangeIntensity,
        styleDirections: selectedStyles,
        designPurpose: this.styleDesignPurpose,
        preserveItems: [...this.stylePreserveItems],
        referenceImage: activeStyleReferenceImage || '',
        additionalRequirements: this.styleCustomPrompt,
        aiPrompt: structuredPrompt,
        modificationPrompt: structuredPrompt,
        promptDraft: structuredPrompt,
        preserveGarment: this.stylePreserveItems.includes('garment_subject'),
        preserveColor: this.stylePreserveItems.includes('color'),
        preserveFabric: this.stylePreserveItems.includes('fabric'),
        preservePattern: this.stylePreserveItems.includes('pattern'),
        preserveModel: this.stylePreserveItems.includes('model_pose'),
        preservePose: this.stylePreserveItems.includes('model_pose'),
        preserveBackground: this.stylePreserveItems.includes('background_composition'),
        preserveComposition: this.stylePreserveItems.includes('background_composition'),
        backgroundType: 'original',
        sceneType: 'original',
        outputCount: this.styleOutputCount,
        styleOutputCount: this.styleOutputCount,
        count: this.styleOutputCount,
        designPlanName: this.styleDesignPlanName,
        hasStyleReferenceImage: Boolean(activeStyleReferenceImage),
        styleReferenceImage: activeStyleReferenceImage || ''
      }
      this.saveStyleDraft()
    },
    selectStyleReferenceSource(value) {
      this.styleReferenceSource = value || 'upload'
      if (this.styleReferenceSource !== 'system') {
        this.referenceStyle = ''
        this.referenceStyleName = ''
        this.referencePrompt = ''
      }
      this.applyStyleParams()
    },
    toggleStyleReferences() {
      this.styleReferencesExpanded = !this.styleReferencesExpanded
    },
    toggleStyleSavePanel() {
      this.styleSavePanelOpen = !this.styleSavePanelOpen
    },
    clearStyleReferenceSelection() {
      this.referenceStyle = ''
      this.referenceStyleName = ''
      this.referencePrompt = ''
      this.styleReferenceImagePath = ''
      this.styleReferenceImageStatus = 'empty'
      this.styleReferenceImageError = ''
      this.styleReferenceImageMeta = null
      this.applyStyleParams()
    },
    toggleSelectedStyle(item = {}) {
      const value = item.value || ''
      if (!value) return
      const selected = this.selectedStyles.includes(value)
      if (selected && this.selectedStyles.length === 1) {
        uni.showToast({ title: '至少保留一种设计风格', icon: 'none' })
        return
      }
      this.selectedStyles = selected ? this.selectedStyles.filter((style) => style !== value) : [...this.selectedStyles, value]
      this.applyStyleParams()
      if (this.styleConflictMessage) {
        uni.showToast({ title: this.styleConflictMessage, icon: 'none' })
      }
    },
    generateStyleAiPrompt() {
      const modifyText = this.selectedModifyTypeNames.length ? this.selectedModifyTypeNames.join(' / ') : 'micro change'
      const styleText = this.selectedStyleNames.length ? this.selectedStyleNames.join(' / ') : (this.referenceStyleName || 'commute')
      const imageText = this.clothImagePath ? 'Based on uploaded original garment image' : 'Based on pending original garment image'
      const referenceText = this.referencePrompt ? ' Reference ' + (this.referenceStyleName || 'current style') + ': ' + this.referencePrompt : ' Keep the main garment identity and structure.'
      const prompt = imageText + ', apply ' + modifyText + ', design style: ' + styleText + '.' + referenceText + ' Output professional redesign plans for fashion product review.'
      this.aiGeneratedPrompt = prompt
      this.styleCustomPrompt = prompt
      this.selectedParams = { ...this.selectedParams, aiPlanId: 'ai_generated_refine_plan', aiPlanName: 'AI design' }
      this.applyStyleParams()
    },
    selectStyleAiPlan(plan = {}) {
      if (!plan.value) return
      this.aiGeneratedPrompt = plan.prompt || ''
      this.styleCustomPrompt = plan.prompt || ''
      this.selectedParams = { ...this.selectedParams, aiPlanId: plan.value, aiPlanName: plan.label || '' }
      this.applyStyleParams()
    },
    selectStyleFitDirection(value) {
      this.styleFitDirection = value || 'slim'
      this.applyStyleParams()
    },
    selectStyleModificationMode(value) {
      this.styleModificationMode = value || 'micro_change'
      this.selectedModifyTypes = [this.styleModificationMode]
      this.applyStyleParams()
    },
    selectStyleOutputCount(count) {
      const normalizedCount = Number(count)
      this.styleOutputCount = STYLE_OUTPUT_COUNT_OPTIONS.includes(normalizedCount)
        ? normalizedCount
        : (this.genericRuntimeConfig.isInternalDebug ? 1 : 2)
      this.applyStyleParams()
    },
    chooseStyleReferenceImage() {
      if (this.styleReferenceImageStatus === 'uploading') return
      uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: async (res) => {
          this.styleReferenceSource = 'upload'
          await this.handleStyleReferenceImageSelection(res)
        }
      })
    },
    removeStyleReferenceImage() {
      this.styleReferenceImagePath = ''
      this.styleReferenceImageStatus = 'empty'
      this.styleReferenceImageError = ''
      this.styleReferenceImageMeta = null
      this.applyStyleParams()
    },
    saveStyleDesignPlan() {
      const planName = (this.styleDesignPlanName || '').trim() || (this.referenceStyleName || 'redesign') + ' plan'
      const sourceImage = this.clothImagePath || this.selectedParams.sourceImage || ''
      const activeStyleReferenceImage = this.styleReferenceSource === 'system' ? '' : this.styleReferenceImagePath
      const referenceImages = Array.from(new Set([
        activeStyleReferenceImage,
        this.selectedParams.styleReferenceImage,
        ...((Array.isArray(this.selectedParams.referenceImages) && this.selectedParams.referenceImages) || [])
      ].filter(Boolean)))
      const designImages = Array.from(new Set([
        ...((Array.isArray(this.selectedParams.designImages) && this.selectedParams.designImages) || []),
        sourceImage,
        ...referenceImages
      ].filter(Boolean)))
      const outputCount = Number(this.styleOutputCount || this.selectedParams.outputCount || this.selectedParams.count || 2)
      const parentDesignId = this.sourceDesignPlanId || ''
      const familyPlans = this.savedStyleDesignPlans.filter((item) => {
        return item.planId === parentDesignId || item.parentDesignId === parentDesignId
      })
      const highestFamilyVersion = familyPlans.reduce((highest, item) => {
        return Math.max(highest, Number(item.version || 1))
      }, Number(this.sourceDesignVersion || 0))
      const version = parentDesignId ? highestFamilyVersion + 1 : 1
      const branchName = parentDesignId
        ? (this.sourceDesignBranchName && this.sourceDesignBranchName !== '主方案'
            ? this.sourceDesignBranchName
            : `优化分支 V${version}`)
        : '主方案'
      const plan = {
        planId: 'style_plan_' + Date.now(),
        assetId: 'design_asset_' + Date.now(),
        assetType: 'design_plan',
        category: 'design_plan',
        title: planName,
        planName,
        status: 'draft',
        parentDesignId,
        version,
        branchName,
        sourceImage,
        referenceImages,
        designImages,
        referenceStyle: this.referenceStyle,
        referenceStyleName: this.referenceStyleName,
        referencePrompt: this.referencePrompt,
        modificationPrompt: this.styleCustomPrompt,
        aiPrompt: this.styleCustomPrompt,
        aiGeneratedPrompt: this.aiGeneratedPrompt,
        modifySelectionMode: 'single',
        selectedModifyTypes: [...this.selectedModifyTypes],
        selectedModifyTypeNames: this.selectedModifyTypeNames,
        selectedStyles: [...this.selectedStyles],
        selectedStyleNames: this.selectedStyleNames,
        outputCount,
        count: outputCount,
        toolType: 'refine',
        params: {
          ...this.selectedParams,
          status: 'draft',
          parentDesignId,
          version,
          branchName,
          sourceDesignPlanId: '',
          sourceImage,
          referenceImages,
          designImages,
          referenceStyle: this.referenceStyle,
          referenceStyleName: this.referenceStyleName,
          referencePrompt: this.referencePrompt,
          modificationPrompt: this.styleCustomPrompt,
          aiPrompt: this.styleCustomPrompt,
          aiGeneratedPrompt: this.aiGeneratedPrompt,
          modifySelectionMode: 'single',
          selectedModifyTypes: [...this.selectedModifyTypes],
          selectedModifyTypeNames: this.selectedModifyTypeNames,
          selectedStyles: [...this.selectedStyles],
          selectedStyleNames: this.selectedStyleNames,
          outputCount,
          styleOutputCount: outputCount,
          count: outputCount,
          toolType: 'refine'
        },
        createdAt: Date.now()
      }
      this.savedStyleDesignPlans = [plan, ...this.savedStyleDesignPlans].slice(0, 10)
      uni.setStorageSync(STYLE_DESIGN_PLAN_STORAGE_KEY, this.savedStyleDesignPlans)
      this.selectedParams = {
        ...this.selectedParams,
        savedDesignPlanId: plan.planId,
        designAssetId: plan.assetId,
        designPlanName: plan.planName,
        status: plan.status,
        parentDesignId: plan.parentDesignId,
        version: plan.version,
        branchName: plan.branchName,
        sourceDesignPlanId: plan.planId,
        sourceDesignVersion: plan.version,
        sourceImage: plan.sourceImage,
        referenceImages: [...plan.referenceImages],
        designImages: [...plan.designImages],
        referenceStyle: plan.referenceStyle,
        referencePrompt: plan.referencePrompt,
        modificationPrompt: plan.modificationPrompt,
        aiPrompt: plan.aiPrompt,
        aiGeneratedPrompt: plan.aiGeneratedPrompt,
        modifySelectionMode: plan.modifySelectionMode,
        selectedModifyTypes: [...plan.selectedModifyTypes],
        selectedModifyTypeNames: plan.selectedModifyTypeNames,
        selectedStyles: [...plan.selectedStyles],
        selectedStyleNames: plan.selectedStyleNames,
        outputCount: plan.outputCount,
        styleOutputCount: plan.outputCount,
        count: plan.count,
        toolType: plan.toolType
      }
      this.sourceDesignPlanId = plan.planId
      this.sourceDesignVersion = plan.version
      this.sourceDesignBranchName = plan.branchName
      uni.showToast({ title: version > 1 ? `已保存 V${version}` : '方案已保存', icon: 'success' })
    },
    toggleMarketingType(type = {}) {
      const value = type.value || ''
      if (!value) {
        return
      }
      const exists = this.selectedMarketingTypes.includes(value)
      if (exists && this.selectedMarketingTypes.length <= 1) {
        uni.showToast({
          title: '至少选择一种素材类型',
          icon: 'none'
        })
        return
      }
      this.selectedMarketingTypes = exists
        ? this.selectedMarketingTypes.filter((item) => item !== value)
        : [...this.selectedMarketingTypes, value]
      this.applyMarketingParams()
    },
    applyDetailQuickTemplate(template = {}) {
      const detailModules = Array.isArray(template.detailModules) ? template.detailModules : []
      const standardDetailModules = Array.isArray(template.standardDetailModules) ? template.standardDetailModules : []
      if (!detailModules.length || !standardDetailModules.length) {
        return
      }
      this.activeDetailTemplate = template.value || ''
      this.selectedDetailModules = [...detailModules]
      this.selectedStandardDetailModules = [...standardDetailModules]
      this.syncDetailModuleParams()
    },
    toggleDetailModule(item = {}) {
      const value = item.value || ''
      if (!value) {
        return
      }
      const exists = this.selectedDetailModules.includes(value)
      if (exists && this.selectedDetailModules.length <= 1) {
        uni.showToast({
          title: '至少选择一个生成模块',
          icon: 'none'
        })
        return
      }
      this.selectedDetailModules = exists
        ? this.selectedDetailModules.filter((type) => type !== value)
        : [...this.selectedDetailModules, value]
      this.activeDetailTemplate = ''
      this.syncDetailModuleParams()
    },
    toggleStandardDetailModule(item = {}) {
      const value = item.value || ''
      if (!value) {
        return
      }
      const exists = this.selectedStandardDetailModules.includes(value)
      if (exists && this.selectedStandardDetailModules.length <= 1) {
        uni.showToast({
          title: '至少保留一个标准模块',
          icon: 'none'
        })
        return
      }
      this.selectedStandardDetailModules = exists
        ? this.selectedStandardDetailModules.filter((type) => type !== value)
        : [...this.selectedStandardDetailModules, value]
      this.activeDetailTemplate = ''
      this.syncDetailModuleParams()
    },
    syncDetailModuleParams() {
      const selectedGenerationModules = DETAIL_GENERATION_MODULES.filter((item) => this.selectedDetailModules.includes(item.value))
      const selectedStandardModules = STANDARD_DETAIL_MODULES.filter((item) => this.selectedStandardDetailModules.includes(item.value))
      this.selectedPageMaterialTypes = Array.from(new Set([
        ...selectedGenerationModules.reduce((types, item) => types.concat(item.legacyTypes || []), []),
        ...selectedStandardModules.reduce((types, item) => types.concat(item.legacyTypes || []), [])
      ]))
      if (!this.selectedMarketingTypes.includes('detail_page')) {
        this.selectedMarketingTypes = [...this.selectedMarketingTypes, 'detail_page']
      }
      this.applyMarketingParams()
    },
    togglePageMaterialType(item = {}) {
      const value = item.value || ''
      if (!value) {
        return
      }
      const exists = this.selectedPageMaterialTypes.includes(value)
      if (exists && this.selectedPageMaterialTypes.length <= 1) {
        uni.showToast({
          title: '至少选择一个详情页素材',
          icon: 'none'
        })
        return
      }
      this.selectedPageMaterialTypes = exists
        ? this.selectedPageMaterialTypes.filter((type) => type !== value)
        : [...this.selectedPageMaterialTypes, value]
      this.applyMarketingParams()
    },
    togglePosterType(item = {}) {
      const value = item.value || ''
      if (!value) {
        return
      }
      const exists = this.posterTypes.includes(value)
      if (exists && this.posterTypes.length <= 1) {
        uni.showToast({
          title: '至少选择一种海报类型',
          icon: 'none'
        })
        return
      }
      this.posterTypes = exists
        ? this.posterTypes.filter((type) => type !== value)
        : [...this.posterTypes, value]
      this.applyMarketingParams()
    },
    toggleSeriesType(item = {}) {
      const value = item.value || ''
      if (!value) {
        return
      }
      const exists = this.seriesTypes.includes(value)
      if (exists && this.seriesTypes.length <= 1) {
        uni.showToast({
          title: '至少选择一种系列图方向',
          icon: 'none'
        })
        return
      }
      this.seriesTypes = exists
        ? this.seriesTypes.filter((type) => type !== value)
        : [...this.seriesTypes, value]
      this.applyMarketingParams()
    },
    generateMarketingCopy(copyType = '') {
      const name = String(this.productInfo.name || '').trim() || '服装新品'
      const style = String(this.productInfo.style || '').trim() || '简约'
      const audience = String(this.productInfo.targetAudience || '').trim()
      if (copyType === 'title') {
        this.productTitle = `${style}${name}`
      } else if (copyType === 'selling_points') {
        this.sellingPoints = String(this.productInfo.sellingPoints || '').trim() || [
          '突出服装版型与细节设计',
          audience ? `适合${audience}` : '适合日常与多场景穿搭',
          '商品信息清晰易读'
        ].join('；')
        this.productInfo = {
          ...this.productInfo,
          sellingPoints: this.sellingPoints
        }
      } else if (copyType === 'description') {
        this.detailDescription = `围绕${name}展示整体版型、面料质感与关键细节，结合${style}视觉呈现商品特点${audience ? `，面向${audience}` : ''}。请根据实物信息补充材质、尺码与洗护说明。`
      }
      this.applyMarketingParams()
    },
    applyMarketingParams() {
      const selectedTypes = MARKETING_TYPES.filter((item) => this.selectedMarketingTypes.includes(item.value))
      const pageMaterials = PAGE_MATERIAL_TYPES.filter((item) => this.selectedPageMaterialTypes.includes(item.value))
      const detailModules = DETAIL_GENERATION_MODULES.filter((item) => this.selectedDetailModules.includes(item.value))
      const standardModules = STANDARD_DETAIL_MODULES.filter((item) => this.selectedStandardDetailModules.includes(item.value))
      const posterItems = POSTER_TYPES.filter((item) => this.posterTypes.includes(item.value))
      const seriesItems = SERIES_TYPES.filter((item) => this.seriesTypes.includes(item.value))
      const productInfo = {
        name: String(this.productInfo.name || '').trim(),
        productTitle: String(this.productTitle || this.productInfo.productTitle || this.productInfo.name || '').trim(),
        sellingPoints: String(this.sellingPoints || this.productInfo.sellingPoints || '').trim(),
        detailDescription: String(this.detailDescription || this.productInfo.detailDescription || '').trim(),
        targetAudience: String(this.productInfo.targetAudience || '').trim(),
        style: String(this.productInfo.style || '').trim()
      }
      const productInfoPrompt = [
        productInfo.name ? '商品名称：' + productInfo.name : '',
        productInfo.productTitle ? '商品标题：' + productInfo.productTitle : '',
        productInfo.sellingPoints ? '商品卖点：' + productInfo.sellingPoints : '',
        productInfo.detailDescription ? '详情描述：' + productInfo.detailDescription : '',
        productInfo.targetAudience ? '目标用户：' + productInfo.targetAudience : '',
        productInfo.style ? '商品风格：' + productInfo.style : ''
      ].filter(Boolean).join('；')
      this.productInfo = {
        ...this.productInfo,
        ...productInfo
      }
      const prompt = [
        selectedTypes.map((item) => item.label).join(' / '),
        detailModules.length ? '生成模块：' + detailModules.map((item) => item.label).join('、') : '',
        standardModules.length ? '标准模块：' + standardModules.map((item) => item.label).join('、') : '',
        pageMaterials.length ? '兼容素材：' + pageMaterials.map((item) => item.label).join('、') : '',
        posterItems.length ? 'Poster: ' + posterItems.map((item) => item.label).join(', ') : '',
        seriesItems.length ? 'Series: ' + seriesItems.map((item) => item.label).join(', ') : '',
        productInfoPrompt,
        this.customDetailPrompt
      ].filter(Boolean).join('; ')
      this.selectedParams = {
        ...this.selectedParams,
        subMode: 'marketing_detail_page',
        generationTypes: [...this.selectedMarketingTypes],
        pageMaterialTypes: this.selectedMarketingTypes.includes('detail_page') ? [...this.selectedPageMaterialTypes] : [],
        detailModules: [...this.selectedDetailModules],
        standardDetailModules: [...this.selectedStandardDetailModules],
        detailOutputOrder: [...DETAIL_OUTPUT_ORDER],
        detailTemplate: this.activeDetailTemplate,
        marketingVersion: this.marketingVersion,
        sourcePackageId: this.sourcePackageId,
        productInfo,
        productTitle: productInfo.productTitle,
        sellingPoints: productInfo.sellingPoints,
        detailDescription: productInfo.detailDescription,
        targetAudience: productInfo.targetAudience,
        customDetailPrompt: this.customDetailPrompt,
        posterTypes: this.selectedMarketingTypes.includes('poster') ? [...this.posterTypes] : [],
        seriesTypes: this.selectedMarketingTypes.includes('series') ? [...this.seriesTypes] : [],
        outputCount: Math.max(1, this.selectedDetailModules.length, this.selectedMarketingTypes.length),
        referencePrompt: prompt,
        marketingPrompt: prompt
      }
      this.referenceStyle = 'marketing_detail_page'
      this.referenceStyleName = detailModules.map((item) => item.label).join(' / ') || selectedTypes.map((item) => item.label).join(' / ')
      this.referencePrompt = prompt
    },
    selectDisplayType(type) {
      if (!DISPLAY_TOOL_TYPES.includes(type)) return
      if (type === 'detail_photo') {
        this.switchDisplayConfigurationMode('detail')
        return
      }
      if (this.isDetailDisplayTool) this.switchDisplayConfigurationMode('display')
      const isSelected = this.selectedDisplayModes.includes(type)
      if (isSelected && this.selectedDisplayModes.length <= 1) {
        uni.showToast({
          title: '至少选择一种生成类型',
          icon: 'none'
        })
        return
      }
      this.selectedDisplayModes = isSelected
        ? this.selectedDisplayModes.filter((item) => item !== type)
        : [...this.selectedDisplayModes, type]
      this.lastDisplayModes = [...this.selectedDisplayModes]
      const nextActiveType = this.selectedDisplayModes.includes(type)
        ? type
        : this.selectedDisplayModes[0]
      this.toolType = nextActiveType
      this.activeDisplayType = nextActiveType
      this.resetSelectedParams()
      this.saveDisplayDraft()
    },
    isDisplayModeSelected(type) {
      return this.selectedDisplayModes.includes(type)
    },
    selectDetailGenerationMode(mode) {
      if (![GARMENT_DETAIL_MODES.FAITHFUL, GARMENT_DETAIL_MODES.AI_REFERENCE].includes(mode)) return
      this.detailGenerationMode = mode
      if (this.isDetailDisplayTool) {
        this.applyDetailParams()
        this.saveDisplayDraft()
      }
    },
    hasDetailReferenceImage(detailType = '') {
      return Boolean(this.detailReferenceImageUrl(detailType))
    },
    detailReferenceImageUrl(detailType = '') {
      return String((this.detailReferenceImages && this.detailReferenceImages[detailType]) || '')
    },
    chooseDetailReferenceImage(item = {}) {
      const detailType = String(item.value || '')
      if (!detailType || this.detailReferenceUploadStatus[detailType] === 'uploading') return
      uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: async (response = {}) => {
          const path = (response.tempFilePaths || [])[0] || ''
          const file = (response.tempFiles || [])[0] || { path }
          if (!path) return
          this.$set(this.detailReferenceUploadStatus, detailType, 'uploading')
          this.$set(this.detailReferenceUploadErrors, detailType, '')
          try {
            const uploaded = await this.validateAndUploadStyleImage(file, path, `garment_detail_${detailType}_reference`)
            this.$set(this.detailReferenceImages, detailType, uploaded.url)
            this.$set(this.detailReferenceUploadStatus, detailType, 'ready')
            this.applyDetailParams()
            this.saveDisplayDraft()
            uni.showToast({ title: `${item.label || '细节'}近照已添加`, icon: 'success' })
          } catch (error) {
            const message = this.getStyleImageErrorMessage(error)
            this.$set(this.detailReferenceUploadStatus, detailType, 'error')
            this.$set(this.detailReferenceUploadErrors, detailType, message)
            uni.showToast({ title: message, icon: 'none' })
          }
        }
      })
    },
    previewDetailReferenceImage(detailType = '') {
      const current = this.detailReferenceImageUrl(detailType)
      if (!current) return
      uni.previewImage({ current, urls: [current] })
    },
    removeDetailReferenceImage(detailType = '') {
      if (!detailType) return
      this.$delete(this.detailReferenceImages, detailType)
      this.$delete(this.detailReferenceUploadStatus, detailType)
      this.$delete(this.detailReferenceUploadErrors, detailType)
      this.applyDetailParams()
      this.saveDisplayDraft()
    },
    focusDisplayType(type) {
      if (!DISPLAY_TOOL_TYPES.includes(type)) return
      if (type === 'detail_photo') {
        this.switchDisplayConfigurationMode('detail')
        return
      }
      if (this.isDetailDisplayTool) this.switchDisplayConfigurationMode('display')
      this.toolType = type
      this.activeDisplayType = type
      this.resetSelectedParams()
      this.saveDisplayDraft()
    },
    selectDetailCategory(category) {
      this.activeDetailCategory = category || 'all'
      this.showAllDetailParts = this.activeDetailCategory !== 'all'
    },
    selectDetailReference(item = {}) {
      this.selectedParams = {
        ...this.selectedParams,
        detailArea: item.value || '',
        detailReference: item.value || '',
        detailStyle: item.label || '',
        detailPrompt: item.prompt || ''
      }
      this.referenceStyle = item.value || ''
      this.referenceStyleName = item.label || ''
      this.referencePrompt = item.prompt || ''
    },
    toggleDetailReference(item = {}) {
      const value = item.value || ''
      if (!value) {
        return
      }
      const exists = this.selectedDetailParts.includes(value)
      if (exists && this.selectedDetailParts.length <= 1) {
        uni.showToast({
          title: '至少选择一个细节部位',
          icon: 'none'
        })
        return
      }
      this.selectedDetailParts = exists
        ? this.selectedDetailParts.filter((part) => part !== value)
        : [...this.selectedDetailParts, value]
      this.applyDetailParams()
      this.saveDisplayDraft()
    },
    applyDetailParams() {
      const selectedItems = DETAIL_REFERENCE_OPTIONS.filter((item) => this.selectedDetailParts.includes(item.value))
      const firstItem = selectedItems[0] || DETAIL_REFERENCE_OPTIONS[0] || {}
      const prompt = [
        `将${selectedItems.map((item) => item.label).join('、')}分别生成独立细节图`,
        '每张图片只包含一个目标细节，禁止拼图和多宫格',
        this.detailCustomPrompt
      ].filter(Boolean).join('；')
      this.selectedParams = {
        ...this.selectedParams,
        detailArea: firstItem.value || '',
        detailReference: firstItem.value || '',
        detailParts: selectedItems.map((item) => item.value),
        detailPartNames: selectedItems.map((item) => item.label),
        detailStyle: selectedItems.map((item) => item.label).join(' / '),
        detailPrompt: prompt,
        detailGenerationMode: this.detailGenerationMode,
        expectedOutputCount: selectedItems.length
      }
      this.referenceStyle = firstItem.value || ''
      this.referenceStyleName = selectedItems.map((item) => item.label).join(' / ')
      this.referencePrompt = prompt
    },
    switchDisplayConfigurationMode(mode = 'display') {
      if (!this.isDisplayTool) return
      const wantsDetail = mode === 'detail'
      if (wantsDetail === this.isDetailDisplayTool) return
      this.saveDisplayDraft()
      if (wantsDetail) {
        const currentDisplayModes = this.selectedDisplayModes.filter((item) => item !== 'detail_photo')
        if (currentDisplayModes.length) this.lastDisplayModes = currentDisplayModes
        this.toolType = 'detail_photo'
        this.activeDisplayType = 'detail_photo'
        this.selectedDisplayModes = ['detail_photo']
        this.activeDetailCategory = 'all'
        this.showAllDetailParts = false
        if (!this.selectedDetailParts.length) this.selectedDetailParts = ['collar']
      } else {
        const nextModes = this.lastDisplayModes.filter((item) => DISPLAY_TOOL_TYPES.includes(item) && item !== 'detail_photo')
        this.selectedDisplayModes = nextModes.length ? nextModes : ['flat_lay']
        this.toolType = this.selectedDisplayModes[0]
        this.activeDisplayType = this.selectedDisplayModes[0]
      }
      this.displaySubmissionStatus = 'idle'
      this.displaySubmissionError = ''
      this.displayCreatedTaskId = ''
      this.resetSelectedParams()
      uni.setNavigationBarTitle({ title: wantsDetail ? '服装细节图' : '服装展示图' })
      this.initializeDisplayDraft()
    },
    toggleMoreDetailParts() {
      this.showAllDetailParts = !this.showAllDetailParts
    },
    handleDetailPromptInput() {
      this.applyDetailParams()
      this.saveDisplayDraft()
    },
    setDisplayKeyboardActive(active = false) {
      this.displayKeyboardActive = Boolean(active)
    },
    getDisplayOptionLabel(group = {}, option = {}) {
      return String(option.label || option.name || '')
    },
    getDisplayOptionHint(group = {}, option = {}) {
      const key = typeof group === 'string' ? group : String(group.key || '')
      const hints = {
        white_bg: '干净电商底图',
        studio: '专业棚拍质感',
        magazine: '杂志化表达',
        brand_display: '品牌陈列氛围',
        '1_1': '方形商品图',
        '3_4': '常用竖版比例',
        '4_5': '电商竖版比例'
      }
      return hints[option.value] || (key === 'imageRatio' ? '输出画面比例' : '')
    },
    selectModelReplacementMode(mode = {}) {
      this.modelReplacementMode = mode.value || 'model_display'
      this.selectedModelFeatures = [this.modelReplacementMode]
      this.referenceImagePath = ''
      this.modelReferenceImagePath = ''
      this.sceneReferenceImagePath = ''
      this.poseReferenceImagePath = ''
      this.sceneCustomPrompt = ''
      this.poseCustomPrompt = ''
      this.poseReferenceType = 'model_action'
      this.resetSelectedParams()
    },
    toggleAdvancedSettings() {
      this.advancedSettingsOpen = !this.advancedSettingsOpen
      if (this.advancedSettingsOpen && this.isModelTool) {
        this.modelLibraryType = 'personal'
        this.ensureSelectedModel()
      }
    },
    selectModelLibraryType(type) {
      this.modelLibraryType = type
      if (type !== 'create') {
        this.ensureSelectedModel()
      }
    },
    ensureSelectedModel() {
      if (!this.isModelTool) {
        return
      }
      const exists = this.visibleModels.some((model) => model.modelId === this.selectedModelId)
      if (!exists) {
        this.selectedModelId = (this.visibleModels[0] && this.visibleModels[0].modelId) || ''
      }
    },
    selectProfessionalModel(model = {}) {
      this.selectedModelId = model.modelId || ''
      if (model.modelType) {
        this.modelLibraryType = model.modelType
      }
    },
    selectProfessionalParam(key, value) {
      this.professionalParams = {
        ...this.professionalParams,
        [key]: value
      }
    },
    selectAdvancedParam(key, value) {
      this.advancedParams = {
        ...this.advancedParams,
        [key]: value
      }
    },
    createProfessionalModel() {
      const name = String(this.customModelName || '').trim()
      if (!name) {
        uni.showToast({
          title: '请输入模特名称',
          icon: 'none'
        })
        return
      }
      const model = createCustomModel({
        name,
        modelType: this.customModelType === 'brand' ? MODEL_TYPES.BRAND : MODEL_TYPES.PERSONAL,
        bodyType: this.professionalParams.bodyType,
        styleTags: [this.professionalParams.styleTag],
        usageScope: this.customModelType === 'brand' ? '品牌模特' : '我的模特'
      })
      this.customModelName = ''
      this.modelLibraryType = model.modelType || 'personal'
      this.selectedModelId = model.modelId
      uni.showToast({
        title: '已创建专属模特',
        icon: 'none'
      })
    },
    formatModelMeta(model = {}) {
      return [model.ageRange, model.height, model.bodyType].filter(Boolean).join(' / ') || '商业模特'
    },
    goToFullWorkspace() {
      const queryTypeMap = {
        model: 'model',
        color: 'color',
        refine: 'refine',
        pattern: 'pattern',
        scene: 'scene',
        fabric: 'fabric',
        flat_lay: 'ecommerce',
        '3d_display': 'ecommerce',
        hanging_photo: 'ecommerce',
        mannequin: 'ecommerce',
        detail_photo: 'ecommerce'
      }
      // #ifdef MP-WEIXIN
      uni.navigateTo({
        url: `/package-ai/production-guide/production-guide?target=${encodeURIComponent(queryTypeMap[this.toolType] || 'product_launch')}`
      })
      return
      // #endif
      // #ifdef H5
      uni.navigateTo({
        url: `/pages/workspace/workspace?type=${encodeURIComponent(queryTypeMap[this.toolType] || 'model')}`
      })
      // #endif
    },
    chooseClothImage() {
      if (this.isStyleTool && this.styleImageStatus === 'uploading') return
      if (this.isColorTool && this.colorImageStatus === 'uploading') return
      if (this.isFabricTool && this.fabricImageStatus === 'uploading') return
      if (this.isPatternTool && this.patternImageStatus === 'uploading') return
      if (this.isDisplayTool && this.displayImageStatus === 'uploading') return
      uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: async (res) => {
          if (this.isStyleTool) {
            await this.handleStyleClothImageSelection(res)
            return
          }
          if (this.isColorTool) {
            await this.handleColorClothImageSelection(res)
            return
          }
          if (this.isFabricTool) {
            await this.handleFabricClothImageSelection(res)
            return
          }
          if (this.isPatternTool) {
            await this.handlePatternClothImageSelection(res)
            return
          }
          if (this.isDisplayTool) {
            await this.handleDisplayClothImageSelection(res)
            return
          }
          const paths = res.tempFilePaths || []
          this.clothImagePath = paths[0] || ''
          if (this.isDedicatedModelTool && this.clothImagePath) this.modelEditingStep = 2
        }
      })
    },
    removeClothImage() {
      this.clothImagePath = ''
      if (this.isDedicatedModelTool) {
        this.modelEditingStep = 1
      }
      if (this.isStyleTool) {
        this.styleImageStatus = 'empty'
        this.styleImageError = ''
        this.styleImageMeta = null
        this.styleSubmissionStatus = 'idle'
        this.styleSubmissionError = ''
        this.styleCreatedTaskId = ''
        this.applyStyleParams()
      }
      if (this.isColorTool) {
        this.colorImageStatus = 'empty'
        this.colorImageError = ''
        this.colorImageMeta = null
        this.colorSubmissionStatus = 'idle'
        this.colorSubmissionError = ''
        this.colorCreatedTaskId = ''
        this.applySelectedColorParams()
      }
      if (this.isFabricTool) {
        this.fabricImageStatus = 'empty'
        this.fabricImageError = ''
        this.fabricImageMeta = null
        this.fabricSubmissionStatus = 'idle'
        this.fabricSubmissionError = ''
        this.fabricCreatedTaskId = ''
        this.applyFabricParams()
      }
      if (this.isPatternTool) {
        this.patternImageStatus = 'empty'
        this.patternImageError = ''
        this.patternImageMeta = null
        this.patternSubmissionStatus = 'idle'
        this.patternSubmissionError = ''
        this.patternCreatedTaskId = ''
        this.applyPatternParams()
        this.savePatternDraft()
      }
      if (this.isDisplayTool) {
        this.displayImageStatus = 'empty'
        this.displayImageError = ''
        this.displayImageMeta = null
        this.displaySubmissionStatus = 'idle'
        this.displaySubmissionError = ''
        this.displayCreatedTaskId = ''
        this.saveDisplayDraft()
      }
    },
    chooseReferenceImage() {
      uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: (res) => {
          const paths = res.tempFilePaths || []
          this.referenceImagePath = paths[0] || ''
          this.applyModelFeatureParams()
        }
      })
    },
    chooseModelPortraitImage() {
      if (this.modelPortraitUploading) return
      uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: async (res) => {
          const path = (res.tempFilePaths || [])[0] || ''
          const file = (res.tempFiles || [])[0] || { path }
          if (!path) return
          this.modelPortraitUploading = true
          this.modelPortraitUploadError = ''
          try {
            const uploaded = await this.validateAndUploadStyleImage(file, path, 'model_profile_reference')
            if (Number(uploaded.meta.width || 0) < 512 || Number(uploaded.meta.height || 0) < 512) {
              const qualityError = new Error('MODEL_PROFILE_IMAGE_TOO_SMALL')
              qualityError.code = 'MODEL_PROFILE_IMAGE_TOO_SMALL'
              throw qualityError
            }
            this.referenceImagePath = uploaded.url
            this.modelPortraitFileId = uploaded.url
            this.selectedModelProfileId = ''
            this.modelTargetConfirmed = true
            this.modelEditingStep = 4
            this.saveUploadedAsProfile = false
            this.modelProfileConsentConfirmed = false
            this.modelProfileQualityConfirmed = false
          } catch (error) {
            this.modelPortraitUploadError = error.code === 'MODEL_PROFILE_IMAGE_TOO_SMALL'
              ? '图片分辨率过低，宽高均需至少 512px。'
              : this.getStyleImageErrorMessage(error)
          } finally {
            this.modelPortraitUploading = false
          }
        }
      })
    },
    removeModelPortraitImage() {
      this.referenceImagePath = ''
      this.modelPortraitFileId = ''
      this.saveUploadedAsProfile = false
      this.newModelProfileName = ''
      this.newModelProfileNote = ''
      this.modelProfileConsentConfirmed = false
      this.modelProfileQualityConfirmed = false
      this.modelPortraitUploadError = ''
      this.modelTargetConfirmed = false
      this.modelEditingStep = 3
    },
    async saveUploadedModelProfileIfNeeded() {
      if (this.modelPortraitSource !== 'upload' || !this.saveUploadedAsProfile) return null
      if (!this.newModelProfileName.trim()) throw Object.assign(new Error('请填写模特名称'), { code: 'MODEL_PROFILE_NAME_REQUIRED' })
      if (!this.modelProfileConsentConfirmed || !this.modelProfileQualityConfirmed) throw Object.assign(new Error('请确认图片质量和使用授权'), { code: 'MODEL_PROFILE_CONSENT_REQUIRED' })
      const result = await saveModelProfile({
        name: this.newModelProfileName.trim(), note: this.newModelProfileNote.trim(), coverFileId: this.modelPortraitFileId,
        referenceFileIds: [], scope: 'personal', consentConfirmed: true, consentText: MODEL_PROFILE_CONSENT_TEXT,
        imageQualityConfirmed: true, trainingAllowed: false
      })
      if (!result.ok) throw Object.assign(new Error(result.message || '常用模特保存失败'), { code: result.errorCode })
      const profile = result.data || null
      if (profile) {
        this.myModelProfiles = [profile, ...this.myModelProfiles.filter((item) => item.modelProfileId !== profile.modelProfileId)]
        this.selectedModelProfileId = profile.modelProfileId
      }
      return profile
    },
    removeReferenceImage() {
      this.referenceImagePath = ''
      this.applyModelFeatureParams()
    },
    chooseModelReferenceImage() {
      uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: (res) => {
          const paths = res.tempFilePaths || []
          this.modelReferenceImagePath = paths[0] || ''
          this.applyModelFeatureParams()
        }
      })
    },
    removeModelReferenceImage() {
      this.modelReferenceImagePath = ''
      this.applyModelFeatureParams()
    },
    chooseSceneReferenceImage() {
      uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: (res) => {
          const paths = res.tempFilePaths || []
          this.sceneReferenceImagePath = paths[0] || ''
          this.sceneReferenceUploadedUrl = ''
          this.selectedSceneTemplateId = ''
          this.selectedSystemSceneId = ''
          this.sceneBackgroundTab = 'user'
          this.sceneMode = 'exact_composite'
          this.applySceneParams()
          if (this.sceneReferenceImagePath) {
            uni.showToast({ title: '场景参考图已添加', icon: 'success' })
          }
        },
        fail: () => {
          uni.showToast({ title: '场景参考图上传失败，请重新选择。', icon: 'none' })
        }
      })
    },
    removeSceneReferenceImage() {
      this.sceneReferenceImagePath = ''
      this.sceneReferenceUploadedUrl = ''
      this.applySceneParams()
    },
    choosePoseReferenceImage() {
      uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: (res) => {
          const paths = res.tempFilePaths || []
          this.poseReferenceImagePath = paths[0] || ''
          this.applyPoseParams()
        }
      })
    },
    removePoseReferenceImage() {
      this.poseReferenceImagePath = ''
      this.applyPoseParams()
    },
    getSelectedParamText() {
      const paramText = (this.currentTool.paramGroups || [])
        .map((group) => {
          const selectedValue = this.selectedParams[group.key]
          const option = (group.options || []).find((item) => item.value === selectedValue)
          return option ? `${group.label}：${option.label}` : ''
        })
        .filter(Boolean)
      if (this.referenceStyleName) {
        paramText.unshift(`参考方向：${this.referenceStyleName}`)
      }
      if (this.isModelTool) {
        paramText.unshift(`替换模式：${this.currentModelMode.label}`)
      }
      if (this.isRedesignTool) {
        paramText.unshift(`改款类型：${this.currentTool.redesignTypeName}`)
      }
      if (this.isDisplayTool) {
        paramText.unshift(`展示类型：${this.currentTool.displayTypeName}`)
        paramText.unshift(`已选类型：${this.selectedDisplayModeLabels}`)
        if (this.selectedDisplayModes.includes('detail_photo')) {
          paramText.unshift(`细节图：${this.selectedDetailParts.length}张独立图片`)
        }
      }
      return paramText.join('；')
    },
    buildPromptDraft() {
      if (this.isStyleTool) return this.buildStructuredStylePrompt()
      if (this.isFabricTool) {
        return [
          this.selectedParams.fabricPrompt,
          `替换区域：${this.fabricTargetAreaLabel}`,
          this.fabricColorMode === 'adopt_reference' ? '采用样布颜色' : '保留原服装颜色',
          '严格保留人物身份、身体、姿势、服装版型、轮廓、背景和构图',
          '严格保留金属链条、纽扣、拉链、蕾丝、蝴蝶结、包边、透明纱、印花、装饰带和车线',
          '仅将样布用于面料纹理、组织、光泽和垂坠参考，不复制拍摄背景、污点、边框或图案'
        ].filter(Boolean).join('；')
      }
      if (this.isColorTool && this.currentTargetColor) {
        return [
          `将${this.colorTargetAreaLabel}换为${this.currentTargetColor.displayName}（${this.currentTargetColor.hex}）`,
          `目标 RGB：${this.currentTargetColor.rgb.join(',')}`,
          `目标 Lab：${this.currentTargetColor.lab.join(',')}`,
          '保留人物身份、脸部、头发、身体、姿势和背景',
          '保留服装结构、面料纹理、明暗褶皱和印花图案',
          this.colorCustomPrompt
        ].filter(Boolean).join('；')
      }
      return [
        this.currentTool.title,
        this.currentTool.description,
        this.getSelectedParamText(),
        this.isModelTool ? this.currentModelMode.focusTitle : '',
        this.advancedSettingsOpen && this.modelLibraryType === 'personal' && this.selectedModel
          ? `我的模特：${this.selectedModel.name}`
          : '',
        this.advancedSettingsOpen && this.referenceImagePath ? '已添加参考图' : '',
        this.advancedSettingsOpen && this.isModelTool
          ? `姿势：${this.advancedParams.poseControl}；比例：${this.advancedParams.imageRatio}`
          : '',
        '保持服装主体清晰，适合电商展示。'
      ].filter(Boolean).join('；')
    },
    recordProductPackageAsset(task = {}) {
      const productPackageId = this.selectedParams.productPackageId || ''
      if (!productPackageId || !task.taskId) return
      const sourceDesignId = this.selectedParams.sourceDesignId || this.selectedParams.sourceDesignPlanId || ''
      const sourceVersion = Number(this.selectedParams.sourceVersion || this.selectedParams.version || 1)
      const assetType = this.selectedParams.selectedAction || this.selectedParams.continueAction || ''
      const storedPackages = uni.getStorageSync(PRODUCT_PACKAGE_STORAGE_KEY)
      const packages = Array.isArray(storedPackages) ? [...storedPackages] : []
      const packageIndex = packages.findIndex((item) => item.productPackageId === productPackageId)
      const currentPackage = packageIndex >= 0 ? packages[packageIndex] : {
        productPackageId,
        sourceDesignId,
        sourceVersion,
        assets: [],
        productStatus: 'draft',
        createdAt: Date.now()
      }
      const assets = Array.isArray(currentPackage.assets) ? [...currentPackage.assets] : []
      const nextAsset = {
        assetId: task.assetId || task.taskId,
        taskId: task.taskId,
        assetType,
        title: PRODUCT_PACKAGE_ASSET_LABELS[assetType] || this.currentTool.title || '商品素材',
        coverUrl: this.clothImagePath || '',
        status: 'generating',
        statusLabel: '生成中',
        createdAt: task.createdAt || Date.now()
      }
      const assetIndex = assets.findIndex((item) => item.taskId === task.taskId || item.assetId === nextAsset.assetId)
      if (assetIndex >= 0) {
        assets.splice(assetIndex, 1, { ...assets[assetIndex], ...nextAsset })
      } else {
        assets.push(nextAsset)
      }
      const nextPackage = {
        ...currentPackage,
        sourceDesignId: currentPackage.sourceDesignId || sourceDesignId,
        sourceVersion: Number(currentPackage.sourceVersion || sourceVersion),
        sourceImage: currentPackage.sourceImage || this.selectedParams.sourceImage || this.clothImagePath || '',
        designParams: {
          ...(currentPackage.designParams || {}),
          ...((this.selectedParams && this.selectedParams.designParams) || {})
        },
        productInfo: {
          ...(currentPackage.productInfo || {}),
          ...((this.selectedParams && this.selectedParams.productInfo) || {})
        },
        detailTemplate: this.selectedParams.detailTemplate || currentPackage.detailTemplate || '',
        marketingPrompt: this.selectedParams.marketingPrompt || currentPackage.marketingPrompt || '',
        productStatus: ['published', 'delivered'].includes(currentPackage.productStatus)
          ? currentPackage.productStatus
          : 'designing',
        assets,
        updatedAt: Date.now()
      }
      if (packageIndex >= 0) {
        packages.splice(packageIndex, 1, nextPackage)
      } else {
        packages.unshift(nextPackage)
      }
      uni.setStorageSync(PRODUCT_PACKAGE_STORAGE_KEY, packages)
    },
    isRemoteTaskImage(value = '') {
      return /^(https:\/\/|cloud:\/\/)/.test(String(value || '').trim())
    },
    buildTaskImageAsset(localPath = '', remoteUrl = '') {
      const safeRemoteUrl = String(remoteUrl || '').trim()
      return {
        localPath: String(localPath || '').trim(),
        fileId: /^cloud:\/\//.test(safeRemoteUrl) ? safeRemoteUrl : '',
        fileID: /^cloud:\/\//.test(safeRemoteUrl) ? safeRemoteUrl : '',
        fileUrl: /^https:\/\//.test(safeRemoteUrl) ? safeRemoteUrl : safeRemoteUrl
      }
    },
    async ensureSceneTaskImage(value = '', scene = 'scene_replace') {
      const imageValue = String(value || '').trim()
      if (!imageValue) return ''
      if (this.isRemoteTaskImage(imageValue)) return imageValue
      const uploaded = await uploadImage({ filePath: imageValue, scene })
      const remoteUrl = uploaded && (uploaded.fileId || uploaded.fileID || uploaded.fileUrl || uploaded.imageUrl || uploaded.url || '')
      if (!this.isRemoteTaskImage(remoteUrl)) {
        const error = new Error('Scene reference upload did not return an accessible image')
        error.code = 'SCENE_REFERENCE_UPLOAD_FAILED'
        throw error
      }
      return remoteUrl
    },
    async prepareSceneReplaceTaskInput() {
      const sceneTemplate = this.selectedSceneTemplate
      if (this.sceneMode === 'exact_composite' && !this.sceneExactCompositeAvailable) {
        const error = new Error('Exact scene compositing is not configured')
        error.code = 'SCENE_EXACT_COMPOSITE_NOT_AVAILABLE'
        throw error
      }
      if (this.sceneMode === 'exact_composite' && !this.sceneReferenceImagePath) {
        const error = new Error('Exact scene compositing requires an uploaded scene image')
        error.code = 'SCENE_EXACT_REFERENCE_REQUIRED'
        throw error
      }
      if (!this.sceneReferenceImagePath && !sceneTemplate) {
        const error = new Error('Scene selection is required')
        error.code = 'SCENE_SELECTION_REQUIRED'
        throw error
      }
      if (this.sceneReferenceImagePath && String(this.clothImagePath || '').trim() === String(this.sceneReferenceImagePath || '').trim()) {
        const error = new Error('Source image and scene reference must be different')
        error.code = 'SCENE_REFERENCE_MUST_DIFFER'
        throw error
      }
      let sourceImageUrl = ''
      let sceneReferenceImageUrl = ''
      try {
        sourceImageUrl = await this.ensureSceneTaskImage(this.clothImagePath, 'scene_replace_source')
        if (this.sceneReferenceImagePath) {
          sceneReferenceImageUrl = this.sceneReferenceUploadedUrl || await this.ensureSceneTaskImage(this.sceneReferenceImagePath, 'scene_replace_reference')
        }
      } catch (error) {
        const normalized = error instanceof Error ? error : new Error('Scene reference upload failed')
        normalized.code = 'SCENE_REFERENCE_UPLOAD_FAILED'
        throw normalized
      }
      if (!sourceImageUrl || (this.sceneReferenceImagePath && !sceneReferenceImageUrl)) {
        const error = new Error('Scene reference upload failed')
        error.code = 'SCENE_REFERENCE_UPLOAD_FAILED'
        throw error
      }
      if (sceneReferenceImageUrl && sourceImageUrl === sceneReferenceImageUrl) {
        const error = new Error('Source image and scene reference must be different')
        error.code = 'SCENE_REFERENCE_MUST_DIFFER'
        throw error
      }
      this.sceneReferenceUploadedUrl = sceneReferenceImageUrl
      return {
        sourceImageUrl,
        sceneReferenceImageUrl,
        sceneFileId: /^cloud:\/\//i.test(sceneReferenceImageUrl) ? sceneReferenceImageUrl : '',
        sceneMode: this.sceneMode,
        sceneFit: this.sceneFit,
        sceneTemplateId: this.sceneMode === 'generative_reference' && sceneTemplate ? sceneTemplate.value : '',
        sceneTemplateName: this.sceneMode === 'generative_reference' && sceneTemplate ? sceneTemplate.label : '',
        scenePrompt: this.sceneMode === 'generative_reference' ? (sceneTemplate ? sceneTemplate.prompt : this.sceneReferencePrompt) : '',
        sceneSource: sceneTemplate ? 'system' : 'user',
        scenePreferenceId: sceneTemplate ? '' : this.selectedMySceneId,
        foregroundScale: this.sceneForegroundScale,
        foregroundX: this.sceneForegroundX,
        preserveFace: true,
        preserveExpression: true,
        preservePose: true,
        preserveGarment: true,
        preserveForeground: true,
        preserveScene: true,
        edgeRefine: this.sceneEdgeRefine,
        shadowBlend: this.sceneShadowBlend
      }
    },
    async startModelReplace() {
      if (this.isGenerating) return
      this.modelGenerationErrorSummary = ''
      const runtime = this.modelRuntimeConfig
      const capabilityValidation = validateIdentityProviderCapability(this.replaceMode)
      const experimentalValidation = validateExperimentalIdentityProviderCapability(this.replaceMode)
      if (!runtime.canSubmit || (!runtime.usesMock && !runtime.realProviderTest && !capabilityValidation.ok) || (runtime.realProviderTest && !experimentalValidation.ok)) {
        uni.showToast({ title: runtime.disabledReason || (runtime.realProviderTest ? experimentalValidation.message : capabilityValidation.message) || '当前运行环境未开放人物替换任务', icon: 'none' })
        return
      }
      if (!this.clothImagePath) {
        uni.showToast({ title: '请先上传原图', icon: 'none' })
        return
      }
      if (!this.hasSelectedReplaceMode) {
        uni.showToast({ title: '请选择替换方式', icon: 'none' })
        return
      }
      if (!this.modelTargetConfirmed || !this.modelTargetPersonImage) {
        uni.showToast({ title: '请选择目标人像', icon: 'none' })
        return
      }

      this.isGenerating = true
      let quotaRecordId = ''
      try {
        const savedProfile = await this.saveUploadedModelProfileIfNeeded()
        const actionType = this.modelTaskType
        const sourceImage = await this.ensureSceneTaskImage(this.clothImagePath, `${actionType}_base`)
        const targetPersonImage = await this.ensureSceneTaskImage(this.modelTargetPersonImage, `${actionType}_reference`)
        if (!sourceImage || !targetPersonImage) {
          throw new Error('MODEL_REPLACE_IMAGE_UPLOAD_FAILED')
        }
        if (sourceImage === targetPersonImage) {
          const sameImageError = new Error('SOURCE_TARGET_IMAGE_MUST_DIFFER')
          sameImageError.code = 'SOURCE_TARGET_IMAGE_MUST_DIFFER'
          throw sameImageError
        }

        let sourceImageInfo = null
        try {
          sourceImageInfo = await this.getStyleImageInfo(this.clothImagePath)
        } catch (error) {
          sourceImageInfo = null
        }
        const testMetadata = buildTestTaskMetadata(runtime)
        const clientTaskId = runtime.realProviderTest ? createQuotaAlphaTaskId() : ''
        const quota = runtime.realProviderTest
          ? await consumeQuota({ taskId: clientTaskId, action: actionType, count: 1 })
          : null
        quotaRecordId = quota ? quota.quotaRecordId : ''
        const replaceParams = {
          actionType,
          taskType: actionType,
          baseImage: sourceImage,
          sourceImage,
          identityReferenceImage: targetPersonImage,
          targetPersonImage,
          ...(actionType === 'head_replace'
            ? { headReferenceImage: targetPersonImage }
            : { faceReferenceImage: targetPersonImage }),
          replaceType: actionType,
          replaceMode: actionType,
          identityMode: actionType === 'face_replace' ? 'face_only' : 'full_head',
          preserveGarment: true,
          preserveBody: true,
          preservePose: true,
          preserveComposition: true,
          preserveBackground: true,
          preserveScene: true,
          identityStrength: 'high',
          modelProfileId: savedProfile ? savedProfile.modelProfileId : (this.modelPortraitSource === 'profiles' ? this.selectedModelProfileId : ''),
          backgroundType: 'original',
          sceneType: 'original',
          sourceWidth: Number((sourceImageInfo && sourceImageInfo.width) || 0),
          sourceHeight: Number((sourceImageInfo && sourceImageInfo.height) || 0),
          ...(clientTaskId ? { idempotencyKey: clientTaskId } : {}),
          ...(quota ? {
            quotaRecordId: quota.quotaRecordId,
            quotaRecordStatus: quota.quotaRecordStatus,
            quotaIdempotencyKey: quota.idempotencyKey,
            estimatedCost: quota.cost
          } : {}),
          ...testMetadata
        }
        const taskOptions = {
          ...(clientTaskId ? { taskId: clientTaskId, clientTaskId } : {}),
          type: actionType,
          channel: 'simple_ai_workbench',
          provider: testMetadata.provider,
          mock: testMetadata.isMock,
          input: {
            imageUrl: sourceImage,
            image_url: sourceImage,
            assets: {
              baseImage: this.buildTaskImageAsset(this.clothImagePath, sourceImage),
              identityReferenceImage: this.buildTaskImageAsset(this.modelTargetPersonImage, targetPersonImage),
              ...(actionType === 'head_replace'
                ? { headReferenceImage: this.buildTaskImageAsset(this.modelTargetPersonImage, targetPersonImage) }
                : { faceReferenceImage: this.buildTaskImageAsset(this.modelTargetPersonImage, targetPersonImage) })
            },
            params: replaceParams,
            options: {
              outputType: actionType === 'head_replace' ? 'head_replace_image' : 'face_replace_image',
              reviewStatus: 'needs_review',
              deliveryEligible: testMetadata.deliveryEligible,
              previewOnly: false
            }
          },
          params: replaceParams,
          run: {
            fallbackToMock: false
          }
        }
        const task = runtime.usesMock
          ? createTaskAndSimulate({ ...taskOptions, simulate: { delay: 900 } })
          : createGenerationTaskAndRun(taskOptions)
        if (quotaRecordId) settleQuotaByTask({ taskId: task.taskId, quotaRecordId })

        if (runtime.isTestStage) {
          console.info('[model-replace:test-task]', {
            actionType,
            environment: runtime.stage,
            provider: testMetadata.provider,
            capabilityStatus: runtime.capabilityStatus,
            isMock: testMetadata.isMock,
            inputImageCount: 2,
            hasBaseImage: true,
            hasIdentityReferenceImage: true
          })
        }

        if (this.isStyleTool) {
          try {
            this.recordProductPackageAsset(task)
          } catch (error) {
            this.trackStyleRedesignEvent('asset_record', {
              status: 'failed',
              errorCode: 'ASSET_RECORD_FAILED'
            })
          }
        } else {
          this.recordProductPackageAsset(task)
        }
        uni.navigateTo({
          url: `/package-ai/result/result?taskId=${encodeURIComponent(task.taskId)}`
        })
      } catch (error) {
        if (quotaRecordId) {
          try { await rollbackQuota(quotaRecordId, 'identity_task_create_failed') } catch (rollbackError) {}
        }
        const errorCode = String((error && (error.code || error.errorCode || error.message)) || '')
        const safeErrorMessages = {
          QUOTA_CLOUD_UNAVAILABLE: 'quota_failed：额度服务暂不可用',
          QUOTA_CONSUME_FAILED: 'quota_failed：额度预扣失败',
          REAL_QUOTA_NOT_ENABLED: 'quota_failed：真实额度保护尚未开启',
          usage_init_failed: 'quota_failed：额度记录初始化失败',
          usage_permission_denied: 'quota_failed：额度记录无写入权限',
          MODEL_REPLACE_IMAGE_UPLOAD_FAILED: 'image_upload_failed：原图或目标人像上传失败'
        }
        const message = errorCode === 'SOURCE_TARGET_IMAGE_MUST_DIFFER'
          ? '原图与目标人像不能相同'
          : ['MODEL_PROFILE_NAME_REQUIRED', 'MODEL_PROFILE_CONSENT_REQUIRED'].includes(errorCode)
            ? (error && error.message) || '请完善常用模特保存信息'
          : ['HEAD_REFERENCE_NOT_SUPPORTED', 'IDENTITY_PROVIDER_NOT_SUPPORTED'].includes(errorCode)
            ? '当前模型暂不支持高一致性头部更换'
            : (safeErrorMessages[errorCode] || `${errorCode || 'request_failed'}：生成请求未创建，请检查测试配置或额度状态`)
        this.modelGenerationErrorSummary = message
        uni.showToast({ title: message, icon: 'none' })
      } finally {
        this.isGenerating = false
      }
    },
    async startGenerate() {
      if (this.isStyleTool && this.styleSubmissionStatus === 'navigation_failed' && this.styleCreatedTaskId) {
        this.navigateToCreatedStyleTask()
        return
      }
      if (this.isColorTool && this.colorSubmissionStatus === 'navigation_failed' && this.colorCreatedTaskId) {
        this.navigateToCreatedColorTask()
        return
      }
      if (this.isFabricTool && this.fabricSubmissionStatus === 'navigation_failed' && this.fabricCreatedTaskId) {
        this.navigateToCreatedFabricTask()
        return
      }
      if (this.isPatternTool && this.patternSubmissionStatus === 'navigation_failed' && this.patternCreatedTaskId) {
        this.navigateToCreatedPatternTask()
        return
      }
      if (this.isDisplayTool && this.displaySubmissionStatus === 'navigation_failed' && this.displayCreatedTaskId) {
        this.navigateToCreatedDisplayTask()
        return
      }
      if (
        this.isGenerating
        || (this.isStyleTool && ['submitting', 'task_created'].includes(this.styleSubmissionStatus))
        || (this.isColorTool && ['submitting', 'task_created'].includes(this.colorSubmissionStatus))
        || (this.isFabricTool && ['submitting', 'task_created'].includes(this.fabricSubmissionStatus))
        || (this.isPatternTool && ['submitting', 'task_created'].includes(this.patternSubmissionStatus))
        || (this.isDisplayTool && ['submitting', 'task_created', 'submission_unknown'].includes(this.displaySubmissionStatus))
      ) {
        return
      }
      const runtime = this.genericRuntimeConfig
      if (!runtime.canSubmit || !runtime.realProviderTest) {
        uni.showToast({ title: runtime.disabledReason || (runtime.canManageTesting ? '当前真实 Provider 测试配置未就绪' : '仅内部测试账号可调用真实 API'), icon: 'none' })
        return
      }
      if (!this.clothImagePath) {
        uni.showToast({
          title: this.isPureSceneReplace ? '未找到待处理图片，请重新上传。' : '请先上传服装图',
          icon: 'none'
        })
        return
      }
      if (this.isFabricTool && this.fabricGenerateDisabledReason) {
        uni.showToast({ title: this.fabricGenerateDisabledReason, icon: 'none' })
        return
      }
      if (this.isPatternTool && this.patternGenerateDisabledReason) {
        uni.showToast({ title: this.patternGenerateDisabledReason, icon: 'none' })
        return
      }
      if (this.isColorTool && this.colorGenerateDisabledReason) {
        uni.showToast({ title: this.colorGenerateDisabledReason, icon: 'none' })
        return
      }
      if (this.isDisplayTool && this.displayGenerateDisabledReason) {
        uni.showToast({ title: this.displayGenerateDisabledReason, icon: 'none' })
        return
      }
      if (this.isStyleTool) {
        const validationMessage = this.validateStyleSubmission()
        if (validationMessage) {
          this.styleSubmissionStatus = 'idle'
          this.styleSubmissionError = validationMessage
          this.trackStyleRedesignEvent('submit_blocked', {
            status: 'invalid',
            errorCode: this.styleConflictMessage ? 'STYLE_CONFLICT' : 'FORM_INCOMPLETE',
            selectedStyleCount: this.selectedStyles.length,
            outputCount: this.styleOutputCount
          })
          uni.showToast({ title: validationMessage, icon: 'none' })
          return
        }
        this.styleSubmissionStatus = 'submitting'
        this.styleSubmissionError = ''
        this.styleCreatedTaskId = ''
        this.styleCreatedBatchId = ''
        this.styleCreatedHistoryId = ''
        this.styleSubmissionKey = `style_submit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
        this.styleSubmitStartedAt = Date.now()
        this.trackStyleRedesignEvent('submit_started', {
          status: 'submitting',
          selectedStyleCount: this.selectedStyles.length,
          outputCount: this.styleOutputCount
        })
      }
      if (this.isColorTool) {
        this.colorSubmissionStatus = 'submitting'
        this.colorSubmissionError = ''
        this.colorCreatedTaskId = ''
      }
      if (this.isFabricTool) {
        this.fabricSubmissionStatus = 'submitting'
        this.fabricSubmissionError = ''
        this.fabricCreatedTaskId = ''
      }
      if (this.isPatternTool) {
        this.patternSubmissionStatus = 'submitting'
        this.patternSubmissionError = ''
        this.patternCreatedTaskId = ''
      }
      if (this.isDisplayTool) {
        this.displaySubmissionStatus = 'submitting'
        this.displaySubmissionError = ''
        this.displayCreatedTaskId = ''
        this.displayCreatedBatchId = ''
        this.displayCreatedHistoryId = ''
        this.displaySubmissionKey = `display_submit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      }

      this.isGenerating = true
      const generationStartedAt = Date.now()
      try {
        if (this.isStyleTool) await this.ensureStyleImagesReadyForSubmit()
        if (this.isColorTool) await this.ensureColorImagesReadyForSubmit()
        if (this.isFabricTool) await this.ensureFabricImagesReadyForSubmit()
        if (this.isPatternTool) await this.ensurePatternImagesReadyForSubmit()
        if (this.isDisplayTool) await this.ensureDisplayImageReadyForSubmit()
        const tool = this.currentTool
        if (this.isPureSceneReplace) this.applySceneParams()
        const sceneTaskInput = this.isPureSceneReplace ? await this.prepareSceneReplaceTaskInput() : null
        const sourceTaskImage = sceneTaskInput ? sceneTaskInput.sourceImageUrl : this.clothImagePath
        const sceneReferenceTaskImage = sceneTaskInput ? sceneTaskInput.sceneReferenceImageUrl : this.sceneReferenceImagePath
        const sceneReplaceOptions = sceneTaskInput ? {
          sceneMode: sceneTaskInput.sceneMode,
          sceneFit: sceneTaskInput.sceneFit,
          preserveFace: sceneTaskInput.preserveFace,
          preserveExpression: sceneTaskInput.preserveExpression,
          preservePose: sceneTaskInput.preservePose,
          preserveGarment: true,
          preservePerson: true,
          preserveForeground: sceneTaskInput.preserveForeground,
          preserveScene: sceneTaskInput.preserveScene,
          replaceBackground: true,
          edgeRefine: sceneTaskInput.edgeRefine,
          shadowBlend: sceneTaskInput.shadowBlend,
          foregroundScale: sceneTaskInput.foregroundScale,
          foregroundX: sceneTaskInput.foregroundX
        } : {}
        if (sceneTaskInput) {
          this.selectedParams = {
            ...this.selectedParams,
            actionType: 'scene_replace',
            sourceImageUrl: sourceTaskImage,
            sceneReferenceImage: sceneReferenceTaskImage,
            sceneReferenceUrl: sceneReferenceTaskImage,
            sceneFileId: sceneTaskInput.sceneFileId || '',
            sceneTemplateId: sceneTaskInput.sceneTemplateId || '',
            sceneTemplateName: sceneTaskInput.sceneTemplateName || '',
            scenePrompt: sceneTaskInput.scenePrompt || this.sceneReferencePrompt,
            sceneSource: sceneTaskInput.sceneSource,
            scenePreferenceId: sceneTaskInput.scenePreferenceId || '',
            hasSceneReferenceImage: Boolean(sceneReferenceTaskImage),
            ...sceneReplaceOptions
          }
          if (isSceneReplaceDevelopment()) {
            console.log('[scene-replace:task]', {
              actionType: 'scene_replace',
              sceneSource: sceneTaskInput.sceneSource,
              hasSourceImage: true,
              hasSceneReferenceImage: Boolean(sceneReferenceTaskImage),
              hasSceneTemplateId: Boolean(sceneTaskInput.sceneTemplateId),
              success: true,
              errorCode: '',
              durationMs: Date.now() - generationStartedAt
            })
          }
        }
        const taskOptions = {
          type: sceneTaskInput ? 'scene_replace' : tool.taskType,
          channel: 'simple_ai_workbench',
          run: { fallbackToMock: false },
          input: {
            ...(sceneTaskInput ? { imageUrl: sourceTaskImage, image_url: sourceTaskImage } : {}),
            assets: {
              clothImage: this.buildTaskImageAsset(this.clothImagePath, sourceTaskImage),
              ...(this.isColorTool ? {
                baseImage: this.buildTaskImageAsset(this.clothImagePath, this.clothImagePath)
              } : {}),
              ...(this.isFabricTool ? {
                baseImage: this.buildTaskImageAsset(this.clothImagePath, sourceTaskImage)
              } : {}),
              ...(sceneTaskInput ? {
                baseImage: this.buildTaskImageAsset(this.clothImagePath, sourceTaskImage),
                sceneImage: this.buildTaskImageAsset(this.sceneReferenceImagePath, sceneReferenceTaskImage)
              } : {}),
              ...((this.isModelTool || this.advancedSettingsOpen) && this.referenceImagePath ? {
                referenceImage: {
                  localPath: this.referenceImagePath,
                  fileUrl: this.referenceImagePath
                },
                faceReferenceImage: {
                  localPath: this.referenceImagePath,
                  fileUrl: this.referenceImagePath
                }
              } : {}),
              ...(this.isModelTool && this.modelReferenceImagePath ? {
                modelReferenceImage: {
                  localPath: this.modelReferenceImagePath,
                  fileUrl: this.modelReferenceImagePath
                }
              } : {}),
              ...(this.isModelTool && this.isModelFeatureSelected('scene_replace') && sceneReferenceTaskImage ? {
                sceneReferenceImage: {
                  ...this.buildTaskImageAsset(this.sceneReferenceImagePath, sceneReferenceTaskImage)
                }
              } : {}),
              ...(this.isModelTool && this.isModelFeatureSelected('pose_variation') && this.poseReferenceImagePath ? {
                poseReferenceImage: {
                  localPath: this.poseReferenceImagePath,
                  fileUrl: this.poseReferenceImagePath
                }
              } : {}),
              ...(this.isColorTool && this.usesUploadedColorReference ? {
                colorReferenceImage: {
                  localPath: this.colorReferenceImagePath,
                  fileUrl: this.colorReferenceImagePath
                }
              } : {}),
              ...(this.isFabricTool && this.fabricReferenceImagePath ? {
                fabricReferenceImage: {
                  localPath: this.fabricReferenceImagePath,
                  fileUrl: this.fabricReferenceImagePath
                }
              } : {}),
              ...(this.isPatternTool && this.patternReferenceImagePath ? {
                patternReferenceImage: {
                  localPath: this.patternReferenceImagePath,
                  fileUrl: this.patternReferenceImagePath
                }
              } : {}),
              ...(this.isStyleTool && this.styleReferenceSource !== 'system' && this.styleReferenceImagePath ? {
                styleReferenceImage: {
                  localPath: this.styleReferenceImagePath,
                  fileUrl: this.styleReferenceImagePath
                }
              } : {})
            },
            params: {
              toolType: this.toolType,
              ...(this.isModelTool ? {
                modelWorkflow: this.modelReplacementMode,
                modelWorkflowName: this.currentModelMode.label,
                subMode: this.modelReplacementMode,
                selectedModelFeatures: [...this.selectedModelFeatures],
                modelReferenceImage: this.modelReferenceImagePath || '',
                faceReferenceImage: this.referenceImagePath || '',
                ...(this.isModelFeatureSelected('pose_variation') ? {
                  outputCount: Number(this.selectedParams.poseGenerateCount || 2),
                  poseVariantCount: Number(this.selectedParams.poseGenerateCount || 2),
                  poseCount: Number(this.selectedParams.poseCount || this.selectedParams.poseGenerateCount || 2),
                  poseType: this.selectedParams.poseType || this.poseReferenceStyle || '',
                  posePrompt: this.selectedParams.posePrompt || this.poseReferencePrompt || '',
                  poseReferenceImage: this.poseReferenceImagePath || '',
                  hasPoseReferenceImage: Boolean(this.poseReferenceImagePath)
                } : {}),
                ...(this.isModelFeatureSelected('scene_replace') ? {
                  sceneType: sceneTaskInput && sceneTaskInput.sceneMode === 'exact_composite' ? '' : (this.selectedParams.sceneType || this.sceneReferenceStyle || ''),
                  sceneTemplateId: sceneTaskInput ? sceneTaskInput.sceneTemplateId : this.selectedSceneTemplateId,
                  sceneTemplateName: sceneTaskInput ? sceneTaskInput.sceneTemplateName : '',
                  scenePrompt: (sceneTaskInput && sceneTaskInput.scenePrompt) || this.selectedParams.scenePrompt || this.sceneReferencePrompt || '',
                  sceneReferenceImage: sceneReferenceTaskImage || '',
                  sceneReferenceUrl: sceneReferenceTaskImage || '',
                  sceneFileId: sceneTaskInput ? sceneTaskInput.sceneFileId : '',
                  sourceImageUrl: sourceTaskImage || '',
                  hasSceneReferenceImage: Boolean(sceneReferenceTaskImage),
                  ...sceneReplaceOptions
                } : {})
              } : {}),
              ...(this.isDisplayTool ? {
                selectedDisplayModes: this.selectedDisplayModeParamValues,
                selectedDisplayModeTypes: this.selectedDisplayModes,
                selectedDisplayModeNames: this.selectedDisplayModeLabels,
                expectedOutputCount: this.selectedDisplayModes.includes('detail_photo') ? this.selectedDetailParts.length : 1
              } : {}),
              ...(this.productionContext ? {
                productionContext: this.productionContext,
                productionType: this.productionContext.productionTypeValue || this.productionContext.productionType || '',
                selectedAction: this.productionContext.selectedAction || {},
                recommendedActions: this.productionContext.recommendedActions || []
              } : {}),
              ...(this.isColorTool ? {
                hasColorReferenceImage: this.usesUploadedColorReference
              } : {}),
              ...this.selectedParams,
              ...(sceneTaskInput ? {
                actionType: 'scene_replace',
                sceneType: sceneTaskInput.sceneMode === 'exact_composite' ? '' : (this.sceneReferenceStyle || ''),
                sceneTemplateId: sceneTaskInput.sceneTemplateId || '',
                sceneTemplateName: sceneTaskInput.sceneTemplateName || '',
                scenePrompt: sceneTaskInput.scenePrompt || '',
                sceneReferenceImage: sceneReferenceTaskImage || '',
                sceneReferenceUrl: sceneReferenceTaskImage || '',
                sceneFileId: sceneTaskInput.sceneFileId || '',
                sourceImageUrl: sourceTaskImage || '',
                hasSceneReferenceImage: Boolean(sceneReferenceTaskImage),
                ...sceneReplaceOptions
              } : {}),
              referenceStyle: this.referenceStyle,
              referenceStyleName: this.referenceStyleName,
              referencePrompt: this.referencePrompt,
              ...(this.advancedSettingsOpen && this.isModelTool ? {
                ...this.advancedParams,
                modelId: this.modelLibraryType === 'personal' ? this.selectedModelId : '',
                modelName: this.modelLibraryType === 'personal' && this.selectedModel ? this.selectedModel.name : '',
                modelPrompt: this.modelLibraryType === 'personal' && this.selectedModel ? this.selectedModel.modelPrompt : '',
                hasReferenceImage: Boolean(this.referenceImagePath)
              } : {}),
              promptDraft: this.buildPromptDraft(),
              generationMode: 'quick',
              outputUsage: tool.outputType
            },
            options: {
              outputType: tool.outputType,
              ...sceneReplaceOptions,
              ...(this.isColorTool && this.currentTargetColor ? {
                previewOnly: false,
                targetColor: {
                  displayName: this.currentTargetColor.displayName,
                  hex: this.currentTargetColor.hex,
                  rgb: [...this.currentTargetColor.rgb],
                  lab: [...this.currentTargetColor.lab],
                  source: this.currentTargetColor.sourceType,
                  sourceImageFileId: this.currentTargetColor.sourceImageFileId || (this.colorReferenceImagePath.startsWith('cloud://') ? this.colorReferenceImagePath : '')
                },
                colorSource: this.currentTargetColor.sourceType,
                targetRegion: this.colorTargetArea,
                preserveTexture: true,
                preservePattern: true,
                preserveBackground: true,
                preserveIdentity: true,
                preservePose: true,
                colorAccuracyMode: 'generative_approximate'
              } : {}),
              ...(this.isDisplayTool ? {
                selectedDisplayModes: this.selectedDisplayModeParamValues,
                selectedDisplayModeTypes: this.selectedDisplayModes,
                expectedOutputCount: this.selectedDisplayModes.includes('detail_photo') ? this.selectedDetailParts.length : 1
              } : {}),
              ...(this.isFabricTool ? {
                fabricProperties: { ...(this.selectedParams.fabricProperties || {}) },
                fabricColorMode: this.fabricColorMode,
                materialTransferMode: 'generative_reference',
                requiresReview: true,
                deliveryEligible: false,
                preserveIdentity: true,
                preserveBody: true,
                preservePose: true,
                preserveGarmentStructure: true,
                preserveSilhouette: true,
                preserveBackground: true,
                preserveDecorations: true
              } : {})
            }
          },
          params: {
            toolType: this.toolType,
            templateType: tool.taskType,
            outputType: tool.outputType,
            ...(this.isModelTool ? {
              modelWorkflow: this.modelReplacementMode,
              modelWorkflowName: this.currentModelMode.label,
              subMode: this.modelReplacementMode,
              selectedModelFeatures: [...this.selectedModelFeatures],
              modelReferenceImage: this.modelReferenceImagePath || '',
              faceReferenceImage: this.referenceImagePath || '',
              ...(this.isModelFeatureSelected('pose_variation') ? {
                outputCount: Number(this.selectedParams.poseGenerateCount || 2),
                poseVariantCount: Number(this.selectedParams.poseGenerateCount || 2),
                poseCount: Number(this.selectedParams.poseCount || this.selectedParams.poseGenerateCount || 2),
                poseType: this.selectedParams.poseType || this.poseReferenceStyle || '',
                posePrompt: this.selectedParams.posePrompt || this.poseReferencePrompt || '',
                poseReferenceImage: this.poseReferenceImagePath || '',
                hasPoseReferenceImage: Boolean(this.poseReferenceImagePath)
              } : {}),
              ...(this.isModelFeatureSelected('scene_replace') ? {
                  sceneType: sceneTaskInput && sceneTaskInput.sceneMode === 'exact_composite' ? '' : (this.selectedParams.sceneType || this.sceneReferenceStyle || ''),
                  sceneTemplateId: sceneTaskInput ? sceneTaskInput.sceneTemplateId : this.selectedSceneTemplateId,
                  sceneTemplateName: sceneTaskInput ? sceneTaskInput.sceneTemplateName : '',
                  scenePrompt: (sceneTaskInput && sceneTaskInput.scenePrompt) || this.selectedParams.scenePrompt || this.sceneReferencePrompt || '',
                sceneReferenceImage: sceneReferenceTaskImage || '',
                sceneReferenceUrl: sceneReferenceTaskImage || '',
                sceneFileId: sceneTaskInput ? sceneTaskInput.sceneFileId : '',
                sourceImageUrl: sourceTaskImage || '',
                hasSceneReferenceImage: Boolean(sceneReferenceTaskImage),
                ...sceneReplaceOptions
              } : {})
            } : {}),
            ...(this.isDisplayTool ? {
              selectedDisplayModes: this.selectedDisplayModeParamValues,
              selectedDisplayModeTypes: this.selectedDisplayModes,
              selectedDisplayModeNames: this.selectedDisplayModeLabels,
              expectedOutputCount: this.selectedDisplayModes.includes('detail_photo') ? this.selectedDetailParts.length : 1
            } : {}),
            ...(this.productionContext ? {
              productionContext: this.productionContext,
              productionType: this.productionContext.productionTypeValue || this.productionContext.productionType || '',
              selectedAction: this.productionContext.selectedAction || {},
              recommendedActions: this.productionContext.recommendedActions || []
            } : {}),
            referenceStyle: this.referenceStyle,
            referenceStyleName: this.referenceStyleName,
            referencePrompt: this.referencePrompt,
            ...this.selectedParams,
            ...(sceneTaskInput ? {
              actionType: 'scene_replace',
              sceneType: this.sceneReferenceStyle || '',
              sceneTemplateId: sceneTaskInput.sceneTemplateId || '',
              sceneTemplateName: sceneTaskInput.sceneTemplateName || '',
              scenePrompt: sceneTaskInput.scenePrompt || '',
              sceneReferenceImage: sceneReferenceTaskImage || '',
              sceneReferenceUrl: sceneReferenceTaskImage || '',
              sceneFileId: sceneTaskInput.sceneFileId || '',
              sourceImageUrl: sourceTaskImage || '',
              hasSceneReferenceImage: Boolean(sceneReferenceTaskImage),
              ...sceneReplaceOptions
            } : {}),
            generationMode: 'quick',
            outputUsage: tool.outputType
          }
        }
        let task = null
        if (this.isStyleTool && Number(this.styleOutputCount) !== 1) {
          throw Object.assign(new Error('内部真实测试每次仅允许生成一个方案'), { code: 'REAL_TEST_SINGLE_OUTPUT_REQUIRED' })
        }
        if (this.isDetailDisplayTool && this.selectedDetailReferenceItems.length !== 1) {
          throw Object.assign(new Error('内部真实测试每次仅允许选择一个细节'), { code: 'REAL_TEST_SINGLE_OUTPUT_REQUIRED' })
        }
        if (runtime.realProviderTest) {
          task = await createInternalRealGenerationTask(taskOptions, runtime)
        } else if (this.isDetailDisplayTool) {
          const production = createWorkspaceGarmentDetailBatch({
            selectedDetails: this.selectedDetailReferenceItems,
            detailReferences: this.detailReferenceImages,
            mode: this.detailGenerationMode,
            additionalRequirements: this.detailCustomPrompt,
            submissionKey: this.displaySubmissionKey,
            taskOptions
          })
          task = production.firstTask
          this.displayCreatedBatchId = production.batch.batchId
          this.displayCreatedHistoryId = production.history.historyId
        } else if (this.isStyleTool && Number(this.styleOutputCount) > 1) {
          const production = createWorkspaceOutputVariantBatch({
            planId: 'style_redesign_variants',
            planName: '改款式',
            category: '服装改款',
            itemType: 'style_redesign',
            itemDisplayName: '改款方案',
            outputType: tool.outputType || 'style_redesign_image',
            outputCount: Number(this.styleOutputCount),
            submissionKey: this.styleSubmissionKey,
            taskOptions
          })
          task = production.firstTask
          this.styleCreatedBatchId = production.batch.batchId
          this.styleCreatedHistoryId = production.history.historyId
        } else {
          task = createGenerationTaskAndRun(taskOptions)
        }

        if (!task || !task.taskId) {
          const taskError = new Error('Task creation returned no taskId')
          taskError.code = 'TASK_CREATE_INVALID'
          throw taskError
        }

        if (this.isStyleTool) {
          this.styleCreatedTaskId = task.taskId
          this.styleSubmissionStatus = 'task_created'
          this.styleSubmissionError = ''
          this.trackStyleRedesignEvent('task_created', {
            status: 'success',
            outputCount: this.styleOutputCount,
            durationMs: Date.now() - this.styleSubmitStartedAt
          })
        }
        if (this.isColorTool) {
          this.colorCreatedTaskId = task.taskId
          this.colorSubmissionStatus = 'task_created'
          this.colorSubmissionError = ''
          this.recordConfirmedColor(this.currentTargetColor)
        }
        if (this.isFabricTool) {
          this.fabricCreatedTaskId = task.taskId
          this.fabricSubmissionStatus = 'task_created'
          this.fabricSubmissionError = ''
        }
        if (this.isPatternTool) {
          this.patternCreatedTaskId = task.taskId
          this.patternSubmissionStatus = 'task_created'
          this.patternSubmissionError = ''
          this.clearPatternDraft()
        }
        if (this.isDisplayTool) {
          this.displayCreatedTaskId = task.taskId
          this.displaySubmissionStatus = 'task_created'
          this.displaySubmissionError = ''
          this.clearDisplayDraft()
        }

        this.recordProductPackageAsset(task)

        if (sceneTaskInput && sceneTaskInput.sceneSource === 'user' && sceneTaskInput.scenePreferenceId) {
          markSceneUsed(sceneTaskInput.scenePreferenceId)
          this.reloadMyScenes()
        }

        if (this.isStyleTool) {
          this.navigateToCreatedStyleTask()
        } else if (this.isColorTool) {
          this.navigateToCreatedColorTask()
        } else if (this.isFabricTool) {
          this.navigateToCreatedFabricTask()
        } else if (this.isPatternTool) {
          this.navigateToCreatedPatternTask()
        } else if (this.isDisplayTool) {
          this.navigateToCreatedDisplayTask()
        } else {
          uni.navigateTo({
            url: `/package-ai/result/result?taskId=${encodeURIComponent(task.taskId)}`
          })
        }
      } catch (error) {
        const errorCode = String((error && (error.code || error.errorCode)) || '')
        const sceneErrorMessages = {
          SCENE_REFERENCE_REQUIRED: '请先上传场景参考图',
          SCENE_SELECTION_REQUIRED: '请选择一个背景。',
          SCENE_REFERENCE_UPLOAD_FAILED: '场景参考图上传失败，请重新选择。',
          SCENE_REFERENCE_MUST_DIFFER: '场景参考图不能与当前主体图相同',
          SCENE_REFERENCE_NOT_SUPPORTED: '当前模型暂不支持参考图换场景。',
          SCENE_EXACT_REFERENCE_REQUIRED: '精确替换需要上传自定义场景图。',
          SCENE_EXACT_COMPOSITE_NOT_AVAILABLE: '当前环境尚未配置人物分割与背景合成服务，未创建任务，也不会扣除额度。'
        }
        const styleErrorMessages = {
          STYLE_IMAGE_FORMAT_INVALID: '仅支持 JPG、PNG 或 WEBP 图片。',
          STYLE_IMAGE_TOO_LARGE: '图片不能超过 10MB，请压缩后重试。',
          STYLE_IMAGE_TOO_SMALL: '图片尺寸过小，宽高均需至少 256px。',
          STYLE_IMAGE_INFO_FAILED: '无法读取图片，请重新选择。',
          STYLE_IMAGE_UPLOAD_FAILED: '图片上传失败，请检查网络后重试。',
          STYLE_IMAGE_STABLE_URL_REQUIRED: '图片地址暂不可用，请重新上传。',
          TASK_CREATE_INVALID: '任务创建失败，请重试。'
        }
        const errorMessage = this.isStyleTool || this.isColorTool || this.isFabricTool || this.isPatternTool || this.isDisplayTool
          ? (styleErrorMessages[errorCode] || '任务提交失败，请检查网络后重试。')
          : (sceneErrorMessages[errorCode] || (this.isPureSceneReplace ? '换场景失败，请重试。' : '任务创建失败'))
        if (this.isStyleTool) {
          this.styleSubmissionStatus = 'submission_failed'
          this.styleSubmissionError = errorMessage
          this.styleCreatedTaskId = ''
          this.styleCreatedBatchId = ''
          this.styleCreatedHistoryId = ''
          this.styleSubmissionKey = ''
          if (this.styleImageStatus === 'uploading') {
            this.styleImageStatus = 'error'
            this.styleImageError = errorMessage
          }
          if (this.styleReferenceImageStatus === 'uploading') {
            this.styleReferenceImageStatus = 'error'
            this.styleReferenceImageError = errorMessage
          }
          this.trackStyleRedesignEvent('submit_finished', {
            status: 'failed',
            errorCode: errorCode || 'TASK_CREATE_FAILED',
            durationMs: Date.now() - this.styleSubmitStartedAt
          })
        }
        if (this.isColorTool) {
          if (this.colorCreatedTaskId) {
            this.colorSubmissionStatus = 'navigation_failed'
            this.colorSubmissionError = '任务已创建，但结果页打开失败。'
          } else {
            this.colorSubmissionStatus = 'submission_failed'
            this.colorSubmissionError = errorMessage
          }
          if (this.colorImageStatus === 'uploading') this.colorImageStatus = 'error'
          if (this.colorReferenceImageStatus === 'uploading') this.colorReferenceImageStatus = 'error'
        }
        if (this.isFabricTool) {
          if (this.fabricCreatedTaskId) {
            this.fabricSubmissionStatus = 'navigation_failed'
            this.fabricSubmissionError = '任务已创建，但结果页打开失败。'
          } else {
            this.fabricSubmissionStatus = 'submission_failed'
            this.fabricSubmissionError = errorMessage
          }
          if (this.fabricImageStatus === 'uploading') this.fabricImageStatus = 'error'
          if (this.fabricReferenceImageStatus === 'uploading') this.fabricReferenceImageStatus = 'error'
        }
        if (this.isPatternTool) {
          if (this.patternCreatedTaskId) {
            this.patternSubmissionStatus = 'navigation_failed'
            this.patternSubmissionError = '任务已创建，但结果页打开失败。'
          } else if (!errorCode) {
            this.patternSubmissionStatus = 'submission_unknown'
            this.patternSubmissionError = '提交结果暂不明确，请前往最近任务确认。'
          } else {
            this.patternSubmissionStatus = 'submission_failed'
            this.patternSubmissionError = errorMessage
          }
          if (this.patternImageStatus === 'uploading') this.patternImageStatus = 'error'
          if (this.patternReferenceImageStatus === 'uploading') this.patternReferenceImageStatus = 'error'
        }
        if (this.isDisplayTool) {
          if (this.displayCreatedTaskId) {
            this.displaySubmissionStatus = 'navigation_failed'
            this.displaySubmissionError = '任务已创建，但结果页打开失败。'
          } else if (!errorCode) {
            this.displaySubmissionStatus = 'submission_unknown'
            this.displaySubmissionError = '提交结果暂不明确，请前往任务记录确认。'
          } else {
            this.displaySubmissionStatus = 'submission_failed'
            this.displaySubmissionError = errorMessage
          }
          if (this.displayImageStatus === 'uploading') {
            this.displayImageStatus = 'error'
            this.displayImageError = errorMessage
          }
        }
        const visibleErrorMessage = this.isPatternTool && this.patternSubmissionStatus === 'submission_unknown'
          ? this.patternSubmissionError
          : (this.isDisplayTool && this.displaySubmissionStatus === 'submission_unknown'
            ? this.displaySubmissionError
          : ((this.isColorTool && this.colorCreatedTaskId)
          || (this.isFabricTool && this.fabricCreatedTaskId)
          || (this.isPatternTool && this.patternCreatedTaskId)
          || (this.isDisplayTool && this.displayCreatedTaskId)
            ? '任务已创建，可前往最近任务查看。'
            : errorMessage))
        uni.showToast({ title: visibleErrorMessage, icon: 'none' })
      } finally {
        this.isGenerating = false
      }
    }
  }
}
</script>

<style scoped>
.runtime-test-panel {
  margin: 20rpx 24rpx 0;
  padding: 18rpx 20rpx;
  border: 1rpx solid #c7d2fe;
  border-radius: 18rpx;
  background: #eef2ff;
  color: #3730a3;
}

.runtime-test-head,
.runtime-test-modes {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.runtime-test-head { justify-content: space-between; font-size: 22rpx; }
.runtime-test-badge { padding: 6rpx 12rpx; border-radius: 999rpx; background: #4f46e5; color: #fff; font-weight: 700; }
.runtime-test-notice { display: block; margin-top: 12rpx; color: #475569; font-size: 23rpx; line-height: 1.55; }
.runtime-test-modes { margin-top: 14rpx; }
.runtime-test-mode { flex: 1; min-height: 64rpx; border: 1rpx solid #c7d2fe; border-radius: 12rpx; background: #fff; color: #4338ca; font-size: 24rpx; line-height: 64rpx; text-align: center; }
.runtime-test-mode.active { border-color: #4f46e5; background: #4f46e5; color: #fff; font-weight: 700; }
.runtime-test-mode.disabled { opacity: .48; }
.runtime-test-provider { display: block; margin-top: 12rpx; color: #64748b; font-size: 21rpx; }
.runtime-test-error { display: block; margin-top: 10rpx; color: #b42318; font-size: 22rpx; line-height: 1.5; overflow-wrap: anywhere; }
.simple-page {
  min-height: 100vh;
  padding: 24rpx 24rpx 160rpx;
  background: #f6f7fb;
  box-sizing: border-box;
}

.model-replace-page {
  padding: 20rpx 24rpx calc(220rpx + env(safe-area-inset-bottom));
  color: #111827;
}

.model-replace-header {
  padding: 8rpx 4rpx 28rpx;
}

.model-replace-title,
.model-replace-subtitle,
.model-section-title,
.model-section-desc,
.model-upload-title,
.model-upload-desc,
.model-preview-label,
.model-mode-title,
.model-mode-desc,
.model-system-hint,
.model-system-portrait-name,
.model-summary-label,
.model-summary-value {
  display: block;
}

.model-replace-title {
  color: #111827;
  font-size: 44rpx;
  font-weight: 800;
  line-height: 1.2;
}

.model-replace-subtitle {
  margin-top: 10rpx;
  color: #6b7280;
  font-size: 25rpx;
  line-height: 1.5;
}

.model-replace-section {
  margin-bottom: 18rpx;
  padding: 24rpx;
  border-radius: 20rpx;
  background: #ffffff;
  box-shadow: 0 10rpx 28rpx rgba(15, 23, 42, 0.055);
}

.model-section-head {
  display: flex;
  align-items: flex-start;
  gap: 16rpx;
  margin-bottom: 22rpx;
}

.model-section-head.summary {
  margin-bottom: 12rpx;
}

.model-section-index {
  flex: 0 0 42rpx;
  width: 42rpx;
  height: 42rpx;
  border-radius: 12rpx;
  background: #4f46e5;
  color: #ffffff;
  font-size: 22rpx;
  font-weight: 800;
  line-height: 42rpx;
  text-align: center;
}

.model-section-title {
  color: #111827;
  font-size: 30rpx;
  font-weight: 700;
  line-height: 1.3;
}

.model-section-desc {
  margin-top: 6rpx;
  color: #6b7280;
  font-size: 22rpx;
  line-height: 1.45;
}

.model-large-upload,
.model-target-upload {
  min-height: 240rpx;
  padding: 28rpx 24rpx;
  border: 3rpx dashed rgba(79, 70, 229, 0.35);
  border-radius: 20rpx;
  background: #f7f7ff;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.model-target-upload {
  min-height: 210rpx;
}

.model-upload-icon {
  width: 76rpx;
  height: 76rpx;
  border-radius: 20rpx;
  background: #4f46e5;
  color: #ffffff;
  font-size: 50rpx;
  font-weight: 300;
  line-height: 72rpx;
  text-align: center;
}

.model-upload-icon.small {
  width: 64rpx;
  height: 64rpx;
  font-size: 42rpx;
  line-height: 60rpx;
}

.model-upload-title {
  margin-top: 20rpx;
  color: #1f2937;
  font-size: 28rpx;
  font-weight: 700;
}

.model-upload-desc {
  margin-top: 8rpx;
  color: #6b7280;
  font-size: 22rpx;
  line-height: 1.45;
}

.model-image-preview {
  overflow: hidden;
  border-radius: 20rpx;
  background: #f8fafc;
}

.model-image-preview.compact {
  padding-top: 18rpx;
}

.model-preview-label {
  padding: 0 20rpx 14rpx;
  color: #4b5563;
  font-size: 22rpx;
  font-weight: 600;
}

.model-preview-image {
  width: 100%;
  height: 360rpx;
  display: block;
  background: #eef0f4;
}

.model-target-preview {
  width: 100%;
  height: 360rpx;
  display: block;
  background: #eef0f4;
}

.model-preview-actions {
  display: flex;
  gap: 12rpx;
  padding: 14rpx;
}

.model-light-button {
  flex: 1;
  height: 72rpx;
  margin: 0;
  border: 0;
  border-radius: 14rpx;
  background: #eef2ff;
  color: #4338ca;
  font-size: 24rpx;
  line-height: 72rpx;
}

.model-light-button::after {
  border: 0;
}

.model-light-button.danger {
  background: #fff1f2;
  color: #be123c;
}

.model-replace-mode-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
}

.model-replace-mode-card {
  position: relative;
  min-height: 226rpx;
  padding: 18rpx;
  border: 2rpx solid #e5e7eb;
  border-radius: 18rpx;
  background: #ffffff;
  box-sizing: border-box;
}

.model-replace-mode-card.active {
  border-color: #4f46e5;
  background: #f5f3ff;
  box-shadow: 0 8rpx 20rpx rgba(79, 70, 229, 0.1);
}

.model-mode-check {
  position: absolute;
  top: 14rpx;
  right: 16rpx;
  width: 34rpx;
  height: 34rpx;
  border-radius: 50%;
  background: #4f46e5;
  color: #ffffff;
  font-size: 21rpx;
  line-height: 34rpx;
  text-align: center;
}

.model-replace-mode-card:not(.active) .model-mode-check {
  background: #f3f4f6;
}

.model-mode-title {
  color: #111827;
  font-size: 28rpx;
  font-weight: 700;
}

.model-mode-visual {
  width: 72rpx;
  height: 72rpx;
  margin-bottom: 12rpx;
  border-radius: 18rpx;
  background: #eef2ff;
  display: flex;
  align-items: center;
  justify-content: center;
}

.model-head-visual {
  position: relative;
  width: 42rpx;
  height: 50rpx;
  border: 3rpx solid #4f46e5;
  border-radius: 48% 48% 44% 44%;
  box-sizing: border-box;
}

.model-head-visual.mini {
  width: 34rpx;
  height: 40rpx;
}

.model-hair-area {
  position: absolute;
  top: -2rpx;
  right: 2rpx;
  left: 2rpx;
  height: 17rpx;
  border-radius: 50% 50% 35% 35%;
  background: #4f46e5;
}

.model-face-area {
  position: absolute;
  top: 18rpx;
  left: 50%;
  width: 18rpx;
  height: 14rpx;
  border: 2rpx solid #818cf8;
  border-radius: 50%;
  transform: translateX(-50%);
}

.mode-face .model-head-visual {
  border-color: #a5b4fc;
}

.mode-face .model-face-area {
  border-color: #4f46e5;
  background: #c7d2fe;
}

.model-mode-desc {
  margin-top: 6rpx;
  color: #6b7280;
  font-size: 22rpx;
  line-height: 1.4;
}

.model-capability-warning {
  margin-top: 14rpx;
  padding: 16rpx 18rpx;
  border: 2rpx solid #f2d39b;
  border-radius: 14rpx;
  color: #8a5b17;
  background: #fff8e8;
  font-size: 22rpx;
  line-height: 1.5;
}

.model-step-summary {
  min-height: 104rpx;
  margin-bottom: 14rpx;
  padding: 14rpx 18rpx;
  border: 1rpx solid #e5e7eb;
  border-radius: 18rpx;
  background: #ffffff;
  display: flex;
  align-items: center;
  gap: 16rpx;
  box-sizing: border-box;
}

.model-step-thumb,
.model-step-summary-icon {
  width: 72rpx;
  height: 72rpx;
  flex: 0 0 72rpx;
  border-radius: 14rpx;
  background: #eef2ff;
}

.model-step-summary-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.model-step-summary-copy {
  min-width: 0;
  flex: 1;
}

.model-step-summary-title,
.model-step-summary-desc {
  display: block;
}

.model-step-summary-title {
  color: #1f2937;
  font-size: 25rpx;
  font-weight: 700;
}

.model-step-summary-desc {
  margin-top: 5rpx;
  overflow: hidden;
  color: #667085;
  font-size: 22rpx;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.model-step-edit {
  flex: 0 0 auto;
  color: #4f46e5;
  font-size: 23rpx;
  font-weight: 600;
}

.model-portrait-tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8rpx;
  margin-bottom: 20rpx;
  padding: 8rpx;
  border-radius: 16rpx;
  background: #f3f4f6;
}

.model-portrait-tab {
  height: 72rpx;
  border-radius: 12rpx;
  color: #6b7280;
  font-size: 22rpx;
  font-weight: 600;
  line-height: 72rpx;
  text-align: center;
}

.model-portrait-tab.active {
  background: #ffffff;
  color: #4338ca;
  box-shadow: 0 4rpx 14rpx rgba(15, 23, 42, 0.08);
}

.model-system-hint {
  margin-bottom: 14rpx;
  color: #6b7280;
  font-size: 22rpx;
}

.model-system-portrait-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
}

.model-profile-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14rpx;
}

.model-profile-card {
  overflow: hidden;
  border: 2rpx solid #e5e7eb;
  border-radius: 18rpx;
  background: #ffffff;
}

.model-profile-card.active {
  border-color: #4f46e5;
  box-shadow: 0 8rpx 20rpx rgba(79, 70, 229, 0.1);
}

.model-profile-card .model-system-portrait-image,
.model-profile-card .model-system-portrait-placeholder {
  height: 180rpx;
}

.model-system-empty {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  padding: 30rpx 22rpx;
  border-radius: 16rpx;
  background: #f9fafb;
  color: #667085;
  font-size: 23rpx;
  line-height: 1.5;
  text-align: center;
}

.model-manage-button {
  height: 72rpx;
  margin-top: 18rpx;
  color: #4338ca;
  background: #eef2ff;
  font-size: 24rpx;
  line-height: 72rpx;
}

.model-upload-error {
  display: block;
  margin-top: 12rpx;
  color: #dc2626;
  font-size: 22rpx;
}

.model-upload-consent {
  margin-top: 12rpx;
  color: #7c8290;
  font-size: 20rpx;
  line-height: 1.4;
}

.model-upload-status {
  padding: 0 18rpx 16rpx;
  display: flex;
  justify-content: space-between;
  color: #475467;
  font-size: 22rpx;
}

.model-upload-status text:last-child {
  color: #15803d;
  font-weight: 600;
}

.model-save-option {
  margin-top: 18rpx;
  padding: 20rpx;
  border-radius: 16rpx;
  background: #f9fafb;
}

.model-check-row {
  display: flex;
  align-items: flex-start;
  gap: 14rpx;
  color: #344054;
  font-size: 23rpx;
  line-height: 1.45;
}

.model-check-box {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34rpx;
  height: 34rpx;
  flex: 0 0 auto;
  border: 2rpx solid #98a2b3;
  border-radius: 8rpx;
}

.model-check-box.checked {
  border-color: #4f46e5;
  background: #4f46e5;
  color: #ffffff;
}

.model-save-fields {
  display: grid;
  gap: 16rpx;
  margin-top: 18rpx;
}

.model-save-input {
  height: 76rpx;
  padding: 0 18rpx;
  border-radius: 12rpx;
  background: #ffffff;
  font-size: 24rpx;
}

.model-system-portrait-card {
  overflow: hidden;
  border: 2rpx solid #e5e7eb;
  border-radius: 18rpx;
  background: #ffffff;
}

.model-system-portrait-card.active {
  border-color: #4f46e5;
  box-shadow: 0 8rpx 20rpx rgba(79, 70, 229, 0.1);
}

.model-system-portrait-image,
.model-system-portrait-placeholder {
  width: 100%;
  height: 210rpx;
  display: block;
  background: #eef2ff;
}

.model-system-portrait-placeholder {
  color: #6366f1;
  font-size: 48rpx;
  font-weight: 800;
  line-height: 210rpx;
  text-align: center;
}

.model-system-portrait-footer {
  min-height: 68rpx;
  padding: 0 18rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.model-system-portrait-name {
  color: #1f2937;
  font-size: 24rpx;
  font-weight: 600;
}

.model-system-portrait-check {
  color: #4f46e5;
  font-size: 24rpx;
  font-weight: 800;
}

.model-summary-section {
  background: #ffffff;
  box-shadow: none;
}

.model-confirm-visuals {
  padding: 6rpx 0 20rpx;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 42rpx minmax(0, 1fr);
  align-items: center;
  gap: 10rpx;
}

.model-confirm-image-wrap {
  min-width: 0;
  color: #475467;
  font-size: 22rpx;
  text-align: center;
}

.model-confirm-image {
  width: 100%;
  height: 220rpx;
  margin-bottom: 8rpx;
  border-radius: 16rpx;
  display: block;
  background: #eef0f4;
}

.model-confirm-arrow {
  color: #4f46e5;
  font-size: 34rpx;
  font-weight: 700;
  text-align: center;
}

.model-confirm-list {
  overflow: hidden;
  border: 1rpx solid #e5e7eb;
  border-radius: 16rpx;
}

.model-confirm-item {
  min-height: 66rpx;
  padding: 0 18rpx;
  border-bottom: 1rpx solid #eef0f3;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  color: #475467;
  font-size: 23rpx;
}

.model-confirm-item:last-child {
  border-bottom: 0;
}

.model-confirm-item text:last-child {
  color: #344054;
  font-weight: 600;
  text-align: right;
}

.model-confirm-item .primary {
  color: #4f46e5;
}

.model-summary-row {
  padding: 16rpx 0;
  border-bottom: 1rpx solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}

.model-summary-row:last-child {
  border-bottom: 0;
}

.model-summary-label {
  color: #6b7280;
  font-size: 23rpx;
}

.model-summary-value {
  color: #1f2937;
  font-size: 24rpx;
  font-weight: 600;
  text-align: right;
}

.model-summary-value.primary {
  color: #4338ca;
}

.model-page-safe {
  height: 24rpx;
}

.model-fixed-bar {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 20;
  padding: 18rpx 24rpx calc(18rpx + env(safe-area-inset-bottom));
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 -8rpx 28rpx rgba(15, 23, 42, 0.08);
}

.model-generate-button {
  width: 100%;
  height: 92rpx;
  margin: 0;
  border: 0;
  border-radius: 18rpx;
  background: #4f46e5;
  color: #ffffff;
  font-size: 29rpx;
  font-weight: 700;
  line-height: 92rpx;
}

.model-generate-button::after {
  border: 0;
}

.model-generate-button.disabled {
  background: #c7c9d9;
  color: #ffffff;
}

.scene-replace-page {
  padding: 32rpx 24rpx calc(190rpx + env(safe-area-inset-bottom));
  color: #111827;
}

.scene-replace-header {
  padding: 10rpx 4rpx 28rpx;
}

.scene-replace-title,
.scene-replace-subtitle,
.scene-section-title,
.scene-section-desc,
.scene-source-missing-title,
.scene-source-missing-desc,
.scene-upload-title,
.scene-upload-desc,
.scene-reference-label,
.scene-template-name {
  display: block;
}

.scene-replace-title {
  font-size: 44rpx;
  font-weight: 900;
}

.scene-replace-subtitle {
  margin-top: 10rpx;
  color: #6b7280;
  font-size: 25rpx;
  line-height: 1.55;
}

.scene-step-section {
  margin-bottom: 24rpx;
  padding: 26rpx;
  border-radius: 32rpx;
  background: #ffffff;
  box-shadow: 0 12rpx 30rpx rgba(15, 23, 42, 0.06);
}

.scene-upload-section {
  box-shadow: 0 16rpx 36rpx rgba(79, 70, 229, 0.09);
}

.scene-background-section {
  box-shadow: 0 16rpx 36rpx rgba(79, 70, 229, 0.08);
}

.scene-section-heading {
  display: flex;
  align-items: flex-start;
  gap: 16rpx;
  margin-bottom: 20rpx;
}

.scene-step-index {
  flex: 0 0 42rpx;
  width: 42rpx;
  height: 42rpx;
  border-radius: 12rpx;
  background: #4f46e5;
  color: #ffffff;
  text-align: center;
  font-size: 22rpx;
  font-weight: 900;
  line-height: 42rpx;
}

.scene-section-title {
  color: #111827;
  font-size: 30rpx;
  font-weight: 900;
}

.scene-section-desc {
  margin-top: 6rpx;
  color: #6b7280;
  font-size: 22rpx;
  line-height: 1.5;
}

.scene-large-preview {
  width: 100%;
  height: 520rpx;
  border-radius: 24rpx;
  background: #f3f4f6;
  display: block;
}

.scene-source-preview-wrap {
  overflow: hidden;
  border-radius: 24rpx;
  background: #f8fafc;
}

.scene-source-preview-wrap .scene-reference-actions {
  margin-top: 0;
  padding: 18rpx;
}

.scene-source-missing {
  padding: 72rpx 24rpx;
  border: 3rpx dashed rgba(79, 70, 229, 0.34);
  border-radius: 24rpx;
  background: #f8f9ff;
  text-align: center;
}

.scene-source-missing-title {
  color: #312e81;
  font-size: 27rpx;
  font-weight: 900;
}

.scene-source-missing-desc {
  margin-top: 8rpx;
  color: #64748b;
  font-size: 22rpx;
}

.scene-source-upload-button {
  width: 230rpx;
  height: 68rpx;
  margin: 22rpx auto 0;
  border-radius: 16rpx;
  background: #4f46e5;
  color: #ffffff;
  font-size: 23rpx;
  font-weight: 800;
  line-height: 68rpx;
}

.scene-upload-card {
  min-height: 390rpx;
  padding: 38rpx 26rpx;
  border: 3rpx dashed rgba(79, 70, 229, 0.36);
  border-radius: 26rpx;
  background: #f8f9ff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

.scene-upload-icon {
  width: 84rpx;
  height: 84rpx;
  border-radius: 24rpx;
  background: #eef2ff;
  color: #4f46e5;
  text-align: center;
  font-size: 52rpx;
  font-weight: 500;
  line-height: 80rpx;
}

.scene-upload-title {
  margin-top: 22rpx;
  font-size: 30rpx;
  font-weight: 900;
}

.scene-upload-desc {
  max-width: 530rpx;
  margin-top: 10rpx;
  color: #6b7280;
  text-align: center;
  font-size: 22rpx;
  line-height: 1.55;
}

.scene-upload-button {
  min-width: 220rpx;
  height: 70rpx;
  margin-top: 26rpx;
  padding: 0 28rpx;
  border-radius: 16rpx;
  background: #4f46e5;
  color: #ffffff;
  text-align: center;
  font-size: 24rpx;
  font-weight: 800;
  line-height: 70rpx;
  box-sizing: border-box;
}

.scene-reference-label {
  margin-bottom: 12rpx;
  color: #4f46e5;
  font-size: 22rpx;
  font-weight: 800;
}

.scene-reference-preview {
  height: 460rpx;
}

.scene-reference-actions {
  display: flex;
  gap: 16rpx;
  margin-top: 18rpx;
}

.scene-light-button {
  flex: 1;
  height: 72rpx;
  border: 1rpx solid #c7d2fe;
  border-radius: 16rpx;
  background: #ffffff;
  color: #4f46e5;
  font-size: 23rpx;
  font-weight: 800;
  line-height: 70rpx;
}

.scene-light-button::after {
  border: 0;
}

.scene-light-button.danger {
  border-color: #fecaca;
  color: #dc2626;
}

.scene-source-tabs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8rpx;
  padding: 8rpx;
  border-radius: 18rpx;
  background: #f1f3f7;
}

.scene-source-tab {
  height: 72rpx;
  border-radius: 14rpx;
  color: #667085;
  text-align: center;
  font-size: 25rpx;
  font-weight: 700;
  line-height: 72rpx;
}

.scene-source-tab.active {
  background: #ffffff;
  color: #4338ca;
  box-shadow: 0 5rpx 16rpx rgba(15, 23, 42, 0.08);
}

.scene-current-selection {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  margin: 18rpx 0;
  padding: 16rpx 18rpx;
  border-radius: 16rpx;
  background: #f8f9ff;
}

.scene-current-selection-label {
  color: #7b8494;
  font-size: 21rpx;
}

.scene-current-selection-value {
  min-width: 0;
  overflow: hidden;
  color: #3730a3;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 23rpx;
  font-weight: 800;
}

.scene-mode-section,
.scene-target-preview-block,
.scene-composite-controls {
  margin: 18rpx 0;
  padding: 20rpx;
  border: 1rpx solid #e5e7eb;
  border-radius: 18rpx;
  background: #fbfcfe;
}

.scene-control-title { display: block; margin-bottom: 14rpx; color: #20283a; font-size: 25rpx; font-weight: 800; }
.scene-mode-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12rpx; }
.scene-mode-card { min-height: 142rpx; padding: 18rpx; border: 2rpx solid #dfe3ec; border-radius: 16rpx; background: #fff; box-sizing: border-box; }
.scene-mode-card.active { border-color: #4f46e5; background: #f3f2ff; }
.scene-mode-title-row { display: flex; align-items: center; flex-wrap: wrap; gap: 8rpx; }
.scene-mode-title { display: block; color: #273047; font-size: 24rpx; font-weight: 800; }
.scene-mode-badge { padding: 3rpx 8rpx; border-radius: 8rpx; color: #4338ca; background: #e9e7ff; font-size: 18rpx; }
.scene-mode-desc { display: block; margin-top: 8rpx; color: #687086; font-size: 21rpx; line-height: 1.45; }
.scene-capability-warning,
.scene-generative-warning { margin-top: 14rpx; padding: 16rpx; border-radius: 14rpx; font-size: 21rpx; line-height: 1.5; }
.scene-capability-warning { color: #9a3412; background: #fff7ed; }
.scene-generative-warning { color: #475569; background: #f1f5f9; }
.scene-target-preview { display: block; width: 100%; height: 360rpx; border-radius: 14rpx; background: #eef1f6; }
.scene-fit-options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10rpx; }
.scene-fit-option { height: 72rpx; border: 2rpx solid #dfe3ec; border-radius: 14rpx; color: #4b5563; background: #fff; font-size: 23rpx; line-height: 68rpx; text-align: center; }
.scene-fit-option.active { border-color: #4f46e5; color: #4338ca; background: #f3f2ff; font-weight: 700; }
.scene-position-row { display: grid; grid-template-columns: 112rpx minmax(0, 1fr) 70rpx; gap: 10rpx; align-items: center; margin-top: 18rpx; color: #475569; font-size: 22rpx; }
.scene-position-row > text:last-child { text-align: right; }
.scene-position-slider { margin: 0; }

.scene-library-panel {
  min-width: 0;
}

.scene-template-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
}

.scene-template-card {
  position: relative;
  overflow: hidden;
  border: 3rpx solid transparent;
  border-radius: 22rpx;
  background: #f3f4f6;
  box-sizing: border-box;
}

.scene-template-card.active {
  border-color: #4f46e5;
  box-shadow: 0 10rpx 24rpx rgba(79, 70, 229, 0.14);
}

.scene-template-visual {
  position: relative;
  height: 146rpx;
  overflow: hidden;
  background: linear-gradient(150deg, #dbeafe 0%, #f8fafc 58%, #e5e7eb 100%);
}

.scene-template-image,
.scene-template-fallback {
  width: 100%;
  height: 100%;
  display: block;
}

.scene-template-fallback {
  position: relative;
}

.scene-template-card.tone-indigo .scene-template-visual { background: linear-gradient(150deg, #e0e7ff, #f8fafc 58%, #d1d5db); }
.scene-template-card.tone-purple .scene-template-visual { background: linear-gradient(150deg, #ede9fe, #fafafa 58%, #d6d3d1); }
.scene-template-card.tone-emerald .scene-template-visual { background: linear-gradient(150deg, #d1fae5, #ecfccb 58%, #a7f3d0); }
.scene-template-card.tone-orange .scene-template-visual { background: linear-gradient(150deg, #ffedd5, #fff7ed 58%, #d6d3d1); }
.scene-template-card.tone-cyan .scene-template-visual { background: linear-gradient(150deg, #cffafe, #f8fafc 58%, #cbd5e1); }
.scene-template-card.tone-blue .scene-template-visual { background: linear-gradient(150deg, #dbeafe, #f8fafc 58%, #bfdbfe); }
.scene-template-card.tone-slate .scene-template-visual { background: linear-gradient(150deg, #e2e8f0, #f8fafc 58%, #cbd5e1); }

.scene-template-light {
  position: absolute;
  top: 18rpx;
  left: 22rpx;
  width: 74rpx;
  height: 76rpx;
  border: 8rpx solid rgba(255, 255, 255, 0.8);
  border-radius: 4rpx;
}

.scene-template-space {
  position: absolute;
  right: 24rpx;
  bottom: 24rpx;
  width: 90rpx;
  height: 64rpx;
  border-radius: 8rpx 8rpx 0 0;
  background: rgba(255, 255, 255, 0.72);
}

.scene-template-ground {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 30rpx;
  background: rgba(100, 116, 139, 0.14);
}

.scene-template-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 78rpx;
  padding: 12rpx 14rpx;
  background: #ffffff;
  box-sizing: border-box;
}

.scene-template-copy {
  flex: 1;
  min-width: 0;
}

.scene-template-name {
  font-size: 23rpx;
  font-weight: 800;
}

.scene-template-desc {
  display: block;
  margin-top: 4rpx;
  overflow: hidden;
  color: #7b8494;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 19rpx;
  line-height: 1.3;
}

.scene-template-check {
  flex: 0 0 34rpx;
  width: 34rpx;
  height: 34rpx;
  border-radius: 50%;
  background: #4f46e5;
  color: #ffffff;
  text-align: center;
  font-size: 20rpx;
  font-weight: 900;
  line-height: 34rpx;
}

.scene-my-tip {
  display: block;
  margin-bottom: 16rpx;
  color: #667085;
  font-size: 21rpx;
  line-height: 1.5;
}

.scene-my-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
}

.scene-my-card,
.scene-add-card {
  min-width: 0;
  overflow: hidden;
  border: 3rpx solid transparent;
  border-radius: 22rpx;
  background: #f8fafc;
  box-sizing: border-box;
}

.scene-my-card.active {
  border-color: #4f46e5;
  box-shadow: 0 10rpx 24rpx rgba(79, 70, 229, 0.14);
}

.scene-my-visual {
  position: relative;
  height: 164rpx;
  background: #eef0f4;
}

.scene-my-name {
  display: block;
  overflow: hidden;
  padding: 14rpx 16rpx;
  color: #27314a;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 22rpx;
  font-weight: 800;
}

.scene-my-check {
  position: absolute;
  top: 12rpx;
  left: 12rpx;
  width: 36rpx;
  height: 36rpx;
  border-radius: 50%;
  background: #4f46e5;
  color: #ffffff;
  text-align: center;
  font-size: 21rpx;
  font-weight: 900;
  line-height: 36rpx;
}

.scene-my-more {
  position: absolute;
  top: 10rpx;
  right: 10rpx;
  min-width: 54rpx;
  height: 38rpx;
  border-radius: 999rpx;
  background: rgba(15, 23, 42, 0.62);
  color: #ffffff;
  text-align: center;
  font-size: 24rpx;
  font-weight: 900;
  line-height: 30rpx;
}

.scene-invalid-preview {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #8a94a6;
  text-align: center;
  font-size: 20rpx;
  line-height: 1.5;
}

.scene-add-card {
  min-height: 214rpx;
  border-color: #c7d2fe;
  border-style: dashed;
  background: #f8f9ff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.scene-add-card.disabled {
  opacity: 0.62;
}

.scene-add-icon {
  color: #4f46e5;
  font-size: 46rpx;
  font-weight: 400;
  line-height: 1;
}

.scene-add-title {
  margin-top: 12rpx;
  color: #3730a3;
  font-size: 23rpx;
  font-weight: 800;
}

.scene-add-count {
  margin-top: 7rpx;
  color: #8a94a6;
  font-size: 20rpx;
}

.scene-my-empty {
  position: relative;
  min-height: 300rpx;
  padding: 48rpx 28rpx;
  border: 3rpx dashed #c7d2fe;
  border-radius: 24rpx;
  background: #f8f9ff;
  text-align: center;
  box-sizing: border-box;
}

.scene-my-empty-title,
.scene-my-empty-desc,
.scene-my-empty-count {
  display: block;
}

.scene-my-empty-title {
  color: #312e81;
  font-size: 28rpx;
  font-weight: 900;
}

.scene-my-empty-desc {
  max-width: 510rpx;
  margin: 12rpx auto 0;
  color: #667085;
  font-size: 22rpx;
  line-height: 1.55;
}

.scene-my-empty-action {
  width: 210rpx;
  height: 68rpx;
  margin: 24rpx auto 0;
  border-radius: 16rpx;
  background: #4f46e5;
  color: #ffffff;
  font-size: 23rpx;
  font-weight: 800;
  line-height: 68rpx;
}

.scene-my-empty-count {
  position: absolute;
  top: 18rpx;
  right: 20rpx;
  color: #8a94a6;
  font-size: 20rpx;
}

.scene-upload-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-top: 16rpx;
  padding: 16rpx 18rpx;
  border-radius: 14rpx;
  background: #fff1f2;
  color: #be123c;
  font-size: 21rpx;
}

.scene-upload-error text:last-child {
  flex: 0 0 auto;
  color: #4338ca;
  font-weight: 800;
}

.scene-page-safe {
  height: 24rpx;
}

.scene-fixed-bar {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 20;
  padding: 18rpx 24rpx calc(18rpx + env(safe-area-inset-bottom));
  border-top: 1rpx solid #e5e7eb;
  background: rgba(255, 255, 255, 0.97);
}

.scene-cost-tip {
  display: block;
  margin-bottom: 10rpx;
  color: #7b8494;
  text-align: center;
  font-size: 20rpx;
}

.scene-generate-button {
  width: 100%;
  height: 88rpx;
  border-radius: 18rpx;
  background: #4f46e5;
  color: #ffffff;
  font-size: 28rpx;
  font-weight: 900;
  line-height: 88rpx;
}

.scene-generate-button::after {
  border: 0;
}

.scene-generate-button.disabled {
  background: #d1d5db;
  color: #6b7280;
}

.resource-library-block {
  overflow: hidden;
}

.resource-library-header {
  width: 100%;
  min-height: 96rpx;
  display: flex;
  align-items: center;
  gap: 16rpx;
  box-sizing: border-box;
}

.resource-library-copy {
  min-width: 0;
  flex: 1;
}

.resource-library-description,
.resource-library-summary {
  display: block;
}

.resource-library-description {
  margin-top: 7rpx;
  color: #6b7280;
  font-size: 21rpx;
  line-height: 1.45;
}

.resource-library-summary {
  margin-top: 8rpx;
  color: #4f46e5;
  font-size: 21rpx;
  font-weight: 700;
  line-height: 1.4;
}

.resource-library-arrow {
  flex: 0 0 48rpx;
  width: 48rpx;
  height: 48rpx;
  border-radius: 12rpx;
  background: #f3f4f6;
  color: #4b5563;
  text-align: center;
  font-size: 30rpx;
  font-weight: 800;
  line-height: 42rpx;
}

.resource-library-content {
  margin-top: 18rpx;
  padding-top: 18rpx;
  border-top: 1rpx solid #eef0f4;
}

.resource-library-header .detail-part-title {
  margin-bottom: 0;
}

.hero-card,
.work-card {
  margin-bottom: 24rpx;
  border-radius: 32rpx;
  background: #ffffff;
  box-shadow: 0 14rpx 34rpx rgba(15, 23, 42, 0.06);
}

.hero-card {
  padding: 30rpx;
  background: linear-gradient(145deg, #ffffff 0%, #f8faff 70%, #eef7ff 100%);
}

.eyebrow,
.page-title,
.page-subtitle,
.section-title,
.section-desc,
.upload-title,
.upload-desc,
.param-label {
  display: block;
}

.eyebrow {
  color: #4f46e5;
  font-size: 22rpx;
  font-weight: 700;
}

.page-title {
  margin-top: 10rpx;
  color: #111827;
  font-size: 42rpx;
  font-weight: 800;
}

.page-subtitle {
  margin-top: 10rpx;
  color: #6b7280;
  font-size: 24rpx;
  line-height: 1.5;
}

.production-context-card {
  margin-bottom: 24rpx;
  padding: 22rpx 24rpx;
  border: 1rpx solid rgba(79, 70, 229, 0.16);
  border-radius: 28rpx;
  background: #ffffff;
  box-shadow: 0 12rpx 28rpx rgba(15, 23, 42, 0.05);
}

.production-context-kicker,
.production-context-title,
.production-context-desc {
  display: block;
}

.production-context-kicker {
  color: #4f46e5;
  font-size: 21rpx;
  font-weight: 800;
}

.production-context-title {
  margin-top: 8rpx;
  color: #111827;
  font-size: 28rpx;
  font-weight: 900;
}

.production-context-desc {
  margin-top: 8rpx;
  color: #6b7280;
  font-size: 22rpx;
  line-height: 1.45;
}

.work-card {
  padding: 26rpx;
}

.section-head {
  margin-bottom: 18rpx;
}

.section-title {
  color: #111827;
  font-size: 30rpx;
  font-weight: 800;
}

.section-desc {
  margin-top: 6rpx;
  color: #6b7280;
  font-size: 22rpx;
  line-height: 1.45;
}

.upload-box {
  min-height: 330rpx;
  border: 2rpx dashed rgba(79, 70, 229, 0.22);
  border-radius: 28rpx;
  background: linear-gradient(145deg, #f8faff 0%, #ffffff 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.upload-plus {
  width: 76rpx;
  height: 76rpx;
  border-radius: 50%;
  background: #4f46e5;
  color: #ffffff;
  text-align: center;
  line-height: 72rpx;
  font-size: 48rpx;
  font-weight: 500;
}

.upload-title {
  margin-top: 20rpx;
  color: #111827;
  font-size: 28rpx;
  font-weight: 800;
}

.upload-desc {
  margin-top: 8rpx;
  color: #6b7280;
  font-size: 22rpx;
}

.preview-box {
  overflow: hidden;
  border-radius: 28rpx;
  background: #f8fafc;
}

.preview-image {
  width: 100%;
  height: 420rpx;
  display: block;
}

.preview-actions {
  display: flex;
  gap: 16rpx;
  padding: 18rpx;
}

.light-btn {
  flex: 1;
  height: 64rpx;
  border-radius: 999rpx;
  background: #eef2ff;
  color: #4f46e5;
  font-size: 23rpx;
}

.light-btn.danger {
  background: #fff1f2;
  color: #e11d48;
}

.light-btn::after,
.generate-btn::after {
  border: 0;
}

.unified-selection-block {
  margin-bottom: 18rpx;
}

.unified-selection-title {
  display: block;
  margin-bottom: 12rpx;
  color: #111827;
  font-size: 24rpx;
  font-weight: 900;
}

.unified-selection-scroll {
  width: 100%;
  white-space: nowrap;
}

.unified-selection-scroll.nested {
  margin-top: 14rpx;
}

.unified-selection-row {
  display: inline-flex;
  gap: 12rpx;
  min-width: 100%;
  padding: 2rpx 2rpx 8rpx;
  box-sizing: border-box;
}

.unified-selection-pill {
  flex-shrink: 0;
  min-width: 142rpx;
  height: 64rpx;
  padding: 0 20rpx;
  border: 1rpx solid #d1d5db;
  border-radius: 18rpx;
  color: #4b5563;
  background: #ffffff;
  text-align: center;
  line-height: 62rpx;
  font-size: 23rpx;
  font-weight: 800;
  box-sizing: border-box;
}

.unified-selection-pill.compact {
  min-width: 118rpx;
}

.unified-selection-pill.active {
  border-color: #4f46e5;
  color: #4f46e5;
  background: #f5f3ff;
  box-shadow: 0 8rpx 18rpx rgba(79, 70, 229, 0.08);
}

.unified-selection-check {
  margin-right: 6rpx;
  color: #4f46e5;
  font-size: 21rpx;
  font-weight: 900;
}

.unified-selection-tip {
  display: block;
  margin-top: 6rpx;
  color: #9ca3af;
  font-size: 20rpx;
  line-height: 1.4;
}

.detail-part-title {
  margin-bottom: 14rpx;
}

.model-capability-selection {
  margin-top: 18rpx;
}

.display-tab-row {
  display: flex;
  gap: 10rpx;
  margin-bottom: 20rpx;
  padding: 8rpx;
  border-radius: 24rpx;
  background: #f3f4f6;
  overflow-x: auto;
  white-space: nowrap;
}

.display-tab {
  flex-shrink: 0;
  min-width: 112rpx;
  height: 58rpx;
  padding: 0 18rpx;
  border: 1rpx solid transparent;
  border-radius: 18rpx;
  color: #6b7280;
  text-align: center;
  line-height: 58rpx;
  font-size: 23rpx;
  font-weight: 800;
  box-sizing: border-box;
}

.display-tab.active {
  background: #ffffff;
  color: #4f46e5;
  border-color: rgba(79, 70, 229, 0.28);
  box-shadow: 0 8rpx 18rpx rgba(15, 23, 42, 0.07);
}

.display-tab.focused {
  border-color: #4f46e5;
}

.display-tab-check {
  margin-right: 6rpx;
  font-size: 20rpx;
  font-weight: 900;
}

.display-selection-summary {
  margin: -8rpx 0 18rpx;
  padding: 12rpx 16rpx;
  border-radius: 18rpx;
  background: #f8faff;
  color: #4b5563;
  font-size: 22rpx;
  line-height: 1.4;
}

.redesign-module-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx;
  margin-bottom: 18rpx;
}

.redesign-module-card {
  min-height: 124rpx;
  padding: 18rpx;
  border: 1rpx solid #e5e7eb;
  border-radius: 24rpx;
  background: #ffffff;
  box-sizing: border-box;
}

.redesign-module-card.active {
  border-color: rgba(79, 70, 229, 0.42);
  background: linear-gradient(145deg, #f8faff 0%, #ffffff 100%);
  box-shadow: 0 12rpx 28rpx rgba(79, 70, 229, 0.1);
}

.redesign-module-title,
.redesign-module-desc {
  display: block;
}

.redesign-module-title {
  color: #111827;
  font-size: 27rpx;
  font-weight: 900;
}

.redesign-module-desc {
  margin-top: 8rpx;
  color: #6b7280;
  font-size: 21rpx;
  line-height: 1.35;
}

.detail-count-title {
  display: block;
  margin-bottom: 12rpx;
  color: #111827;
  font-size: 24rpx;
  font-weight: 900;
}

.color-workflow-panel {
  margin-bottom: 18rpx;
}

.redesign-workflow-panel {
  margin-bottom: 18rpx;
}

.color-reference-card,
.color-system-card {
  margin-bottom: 18rpx;
  padding: 18rpx;
  border-radius: 24rpx;
  background: #f8faff;
}

.color-reference-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
}

.color-section-title,
.color-section-desc,
.color-palette-title,
.color-swatch-name,
.color-swatch-tags,
.texture-pill text {
  display: block;
}

.color-section-title {
  color: #111827;
  font-size: 25rpx;
  font-weight: 900;
}

.color-section-desc {
  margin-top: 6rpx;
  color: #6b7280;
  font-size: 21rpx;
  line-height: 1.4;
}

.color-reference-action {
  flex-shrink: 0;
  width: 112rpx;
  height: 58rpx;
  border-radius: 999rpx;
  background: #4f46e5;
  color: #ffffff;
  text-align: center;
  line-height: 58rpx;
  font-size: 22rpx;
  font-weight: 900;
}

.color-reference-preview {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.color-reference-image {
  width: 74rpx;
  height: 74rpx;
  border-radius: 20rpx;
  background: #e5e7eb;
}

.eyedropper-row {
  display: flex;
  align-items: center;
  gap: 14rpx;
  margin-top: 16rpx;
}

.eyedropper-btn {
  flex-shrink: 0;
  min-width: 180rpx;
  height: 58rpx;
  padding: 0 20rpx;
  border-radius: 999rpx;
  background: #eef2ff;
  color: #4f46e5;
  text-align: center;
  line-height: 58rpx;
  font-size: 22rpx;
  font-weight: 900;
  box-sizing: border-box;
}

.eyedropper-btn.active {
  background: #4f46e5;
  color: #ffffff;
  box-shadow: 0 8rpx 20rpx rgba(79, 70, 229, 0.16);
}

.eyedropper-result {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12rpx;
  min-width: 0;
  padding: 10rpx 12rpx;
  border-radius: 18rpx;
  background: #ffffff;
}

.eyedropper-result text {
  display: block;
  color: #111827;
  font-size: 21rpx;
  font-weight: 800;
  line-height: 1.35;
}

.eyedropper-result text:last-child {
  color: #6b7280;
  font-size: 19rpx;
  font-weight: 700;
}

.eyedropper-swatch {
  flex-shrink: 0;
  width: 46rpx;
  height: 46rpx;
  border: 1rpx solid rgba(15, 23, 42, 0.12);
  border-radius: 14rpx;
}

.color-library-tabs,
.color-target-grid,
.texture-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 14rpx;
}

.color-library-tab,
.color-target-pill {
  padding: 12rpx 18rpx;
  border: 1rpx solid #e5e7eb;
  border-radius: 999rpx;
  background: #ffffff;
  color: #6b7280;
  font-size: 22rpx;
  font-weight: 800;
}

.color-library-tab.active,
.color-target-pill.active {
  border-color: #4f46e5;
  background: #4f46e5;
  color: #ffffff;
  box-shadow: 0 8rpx 20rpx rgba(79, 70, 229, 0.16);
}

.style-reference-tabs {
  display: flex;
  gap: 10rpx;
  margin-top: 16rpx;
  padding: 8rpx;
  border-radius: 20rpx;
  background: #f3f4f6;
}

.style-reference-tab {
  flex: 1;
  height: 56rpx;
  border-radius: 16rpx;
  color: #6b7280;
  text-align: center;
  line-height: 56rpx;
  font-size: 22rpx;
  font-weight: 800;
}

.style-reference-tab.active {
  background: #ffffff;
  color: #4f46e5;
  box-shadow: 0 8rpx 18rpx rgba(15, 23, 42, 0.07);
}

.modify-selection-mode-row {
  display: flex;
  gap: 10rpx;
  margin-top: 16rpx;
}

.modify-selection-mode {
  min-width: 120rpx;
  padding: 10rpx 18rpx;
  border: 1rpx solid #e5e7eb;
  border-radius: 999rpx;
  background: #ffffff;
  color: #6b7280;
  text-align: center;
  font-size: 21rpx;
  font-weight: 800;
  box-sizing: border-box;
}

.modify-selection-mode.active {
  border-color: #4f46e5;
  background: #eef2ff;
  color: #4f46e5;
}

.modify-type-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
  margin-top: 14rpx;
}

.modify-type-card {
  min-height: 92rpx;
  padding: 14rpx 16rpx;
  border: 1rpx solid #e5e7eb;
  border-radius: 18rpx;
  background: #ffffff;
  box-sizing: border-box;
}

.modify-type-card.active {
  border-color: rgba(79, 70, 229, 0.48);
  background: #eef2ff;
  box-shadow: 0 8rpx 20rpx rgba(79, 70, 229, 0.08);
}

.modify-type-name,
.modify-type-desc {
  display: block;
}

.modify-type-name {
  color: #111827;
  font-size: 23rpx;
  font-weight: 900;
}

.modify-type-desc {
  margin-top: 5rpx;
  color: #6b7280;
  font-size: 19rpx;
  line-height: 1.35;
}

.style-subsection-title {
  display: block;
  margin-top: 20rpx;
  color: #374151;
  font-size: 21rpx;
  font-weight: 800;
}

.ai-prompt-template-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10rpx;
  margin-top: 16rpx;
}

.ai-prompt-template {
  min-height: 58rpx;
  padding: 10rpx 8rpx;
  border: 1rpx solid #e5e7eb;
  border-radius: 16rpx;
  background: #ffffff;
  color: #4b5563;
  text-align: center;
  font-size: 20rpx;
  font-weight: 800;
  box-sizing: border-box;
}

.ai-prompt-template.active {
  border-color: #4f46e5;
  background: #4f46e5;
  color: #ffffff;
}

.style-reference-grid,
.ai-plan-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
  margin-top: 16rpx;
}

.style-reference-card,
.ai-plan-card {
  min-height: 118rpx;
  padding: 16rpx;
  border: 1rpx solid #e5e7eb;
  border-radius: 22rpx;
  background: #ffffff;
  box-sizing: border-box;
}

.style-reference-card.active,
.ai-plan-card.active {
  border-color: rgba(79, 70, 229, 0.5);
  background: linear-gradient(145deg, #eef2ff 0%, #ffffff 100%);
  box-shadow: 0 10rpx 24rpx rgba(79, 70, 229, 0.1);
}

.style-reference-mark {
  display: inline-block;
  min-width: 42rpx;
  height: 34rpx;
  padding: 0 10rpx;
  border-radius: 999rpx;
  background: #eef2ff;
  color: #4f46e5;
  text-align: center;
  line-height: 34rpx;
  font-size: 20rpx;
  font-weight: 900;
}

.style-reference-name,
.ai-plan-title {
  display: block;
  margin-top: 10rpx;
  color: #111827;
  font-size: 24rpx;
  font-weight: 900;
}

.style-reference-desc,
.ai-plan-desc {
  display: block;
  margin-top: 6rpx;
  color: #6b7280;
  font-size: 20rpx;
  line-height: 1.35;
}

.style-mine-reference {
  margin-top: 16rpx;
}

.style-empty-reference {
  padding: 22rpx;
  border: 1rpx dashed rgba(79, 70, 229, 0.28);
  border-radius: 22rpx;
  background: #f8faff;
  color: #6b7280;
  font-size: 22rpx;
}

.style-empty-reference text {
  display: block;
  line-height: 1.5;
}

.style-reference-image {
  width: 100%;
  height: 150rpx;
  border-radius: 18rpx;
  display: block;
}

.color-reference-card.compact {
  margin-top: 16rpx;
}

.save-design-card {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.design-plan-input {
  height: 76rpx;
  padding: 0 20rpx;
  border: 1rpx solid #e5e7eb;
  border-radius: 20rpx;
  background: #ffffff;
  color: #111827;
  font-size: 24rpx;
  box-sizing: border-box;
}

.save-design-btn {
  height: 72rpx;
  border-radius: 999rpx;
  background: #eef2ff;
  color: #4f46e5;
  font-size: 24rpx;
  font-weight: 900;
}

.save-design-btn::after {
  border: 0;
}

.color-palette-group {
  margin-top: 18rpx;
}

.color-palette-group:first-of-type {
  margin-top: 14rpx;
}

.color-palette-title {
  margin-bottom: 12rpx;
  color: #374151;
  font-size: 22rpx;
  font-weight: 900;
}

.color-swatch-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
}

.color-swatch-card {
  display: flex;
  align-items: center;
  gap: 12rpx;
  min-height: 96rpx;
  padding: 14rpx;
  border: 1rpx solid #e5e7eb;
  border-radius: 22rpx;
  background: #ffffff;
  box-sizing: border-box;
}

.color-swatch-card.active {
  border-color: rgba(79, 70, 229, 0.5);
  box-shadow: 0 10rpx 24rpx rgba(79, 70, 229, 0.1);
}

.color-swatch {
  flex-shrink: 0;
  width: 54rpx;
  height: 54rpx;
  border: 1rpx solid rgba(15, 23, 42, 0.12);
  border-radius: 18rpx;
}

.color-swatch-copy {
  min-width: 0;
}

.color-swatch-name {
  color: #111827;
  font-size: 24rpx;
  font-weight: 900;
}

.color-swatch-tags {
  margin-top: 5rpx;
  color: #6b7280;
  font-size: 19rpx;
}

.texture-pill {
  flex: 1 1 30%;
  min-width: 180rpx;
  padding: 14rpx;
  border: 1rpx solid #e5e7eb;
  border-radius: 20rpx;
  background: #ffffff;
  box-sizing: border-box;
}

.texture-pill.active {
  border-color: rgba(79, 70, 229, 0.5);
  background: #eef2ff;
}

.texture-pill text:first-child {
  color: #111827;
  font-size: 23rpx;
  font-weight: 900;
}

.texture-pill text:last-child {
  margin-top: 6rpx;
  color: #6b7280;
  font-size: 19rpx;
  line-height: 1.35;
}

.fabric-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
  margin-top: 14rpx;
}

.fabric-card {
  min-height: 92rpx;
  padding: 14rpx;
  border: 1rpx solid #e5e7eb;
  border-radius: 20rpx;
  background: #ffffff;
  box-sizing: border-box;
}

.fabric-card.active {
  border-color: rgba(79, 70, 229, 0.46);
  background: #eef2ff;
  box-shadow: 0 8rpx 20rpx rgba(79, 70, 229, 0.1);
}

.fabric-card text {
  display: block;
}

.fabric-card text:first-child {
  color: #111827;
  font-size: 24rpx;
  font-weight: 900;
}

.fabric-card text:last-child {
  margin-top: 6rpx;
  color: #6b7280;
  font-size: 20rpx;
  line-height: 1.35;
}

.fabric-config-shell {
  padding: 0;
  background: transparent;
  box-shadow: none;
}

.fabric-workflow-panel {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  margin-bottom: 0;
}

.fabric-step-card {
  padding: 24rpx;
  border: 1rpx solid #edf0f5;
  border-radius: 26rpx;
  background: #ffffff;
  box-shadow: 0 12rpx 28rpx rgba(15, 23, 42, 0.045);
}

.fabric-step-heading {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.fabric-upload-heading {
  margin-bottom: 18rpx;
}

.fabric-step-number {
  flex: 0 0 42rpx;
  width: 42rpx;
  height: 42rpx;
  border-radius: 14rpx;
  background: #eef2ff;
  color: #4f46e5;
  text-align: center;
  font-size: 22rpx;
  font-weight: 900;
  line-height: 42rpx;
}

.fabric-step-heading > view {
  flex: 1;
  min-width: 0;
}

.fabric-page {
  padding: 20rpx 24rpx calc(224rpx + env(safe-area-inset-bottom));
  background: #f5f6fa;
}

.fabric-hero-card,
.fabric-upload-card {
  padding: 28rpx 30rpx;
  border-radius: 24rpx;
  box-shadow: none;
}

.fabric-hero-card {
  margin-bottom: 20rpx;
}

.fabric-hero-card .page-title {
  font-size: 38rpx;
  line-height: 1.25;
}

.fabric-hero-card .page-subtitle {
  margin-top: 8rpx;
  font-size: 23rpx;
  line-height: 1.5;
}

.fabric-upload-card {
  margin-bottom: 20rpx;
}

.fabric-step-copy {
  flex: 1;
  min-width: 0;
}

.fabric-title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10rpx;
}

.fabric-upload-box {
  min-height: 300rpx;
  margin-top: 18rpx;
  border-radius: 22rpx;
  background: #fafbff;
}

.fabric-preview-box {
  min-height: 360rpx;
  margin-top: 18rpx;
  background: #f8fafc;
}

.fabric-preview-box .preview-image {
  height: 380rpx;
}

.fabric-effect-grid {
  gap: 14rpx;
  margin-top: 20rpx;
}

.fabric-effect-option {
  position: relative;
  display: flex;
  align-items: center;
  gap: 14rpx;
  min-height: 136rpx;
  padding: 16rpx;
  overflow: hidden;
  border-color: rgba(148, 163, 184, 0.22);
  background: #fbfcfe;
}

.fabric-effect-option.active {
  border-color: #6366f1;
  background: #f7f7ff;
  box-shadow: 0 8rpx 22rpx rgba(79, 70, 229, 0.11);
}

.fabric-texture-swatch {
  flex: 0 0 92rpx;
  width: 92rpx;
  height: 92rpx;
  border: 1rpx solid rgba(15, 23, 42, 0.08);
  border-radius: 14rpx;
  box-sizing: border-box;
}

.fabric-current-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  min-height: 72rpx;
  margin-top: 20rpx;
  padding: 14rpx 18rpx;
  border: 1rpx solid #d9ddff;
  border-radius: 18rpx;
  background: #f7f7ff;
  color: #3730a3;
  font-size: 22rpx;
  line-height: 1.4;
  box-sizing: border-box;
}

.fabric-current-summary.empty {
  border-color: #e5e7eb;
  background: #f8fafc;
  color: #6b7280;
}

.fabric-summary-actions,
.fabric-reference-actions {
  flex: 0 0 auto;
  display: flex;
  gap: 20rpx;
  color: #4f46e5;
  font-size: 22rpx;
  font-weight: 700;
}

.fabric-summary-actions .danger,
.fabric-reference-actions .danger {
  color: #dc2626;
}

.fabric-inline-tip {
  display: block;
  margin-top: 12rpx;
  color: #8a5a12;
  font-size: 21rpx;
  line-height: 1.45;
}

.fabric-step-card .color-target-pill {
  min-height: 80rpx;
  padding: 12rpx 20rpx;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
}

.fabric-texture-cotton {
  background: linear-gradient(135deg, #f8f3e9, #e9e1d2);
}

.fabric-texture-linen {
  background: repeating-linear-gradient(90deg, #e9dfca 0, #e9dfca 3rpx, #d9c9aa 4rpx, #d9c9aa 5rpx);
}

.fabric-texture-denim {
  background: repeating-linear-gradient(135deg, #7291b5 0, #7291b5 4rpx, #587aa2 5rpx, #587aa2 7rpx);
}

.fabric-texture-knit {
  background: repeating-linear-gradient(90deg, #d9c8bd 0, #d9c8bd 5rpx, #c7b2a5 6rpx, #c7b2a5 8rpx);
}

.fabric-texture-silk {
  background: linear-gradient(115deg, #cabcd2 0%, #f0e8f2 46%, #bfaec8 100%);
}

.fabric-texture-chiffon {
  background: linear-gradient(145deg, rgba(216, 231, 239, 0.7), rgba(244, 248, 250, 0.92));
}

.fabric-texture-leather {
  background: linear-gradient(145deg, #7a645d 0%, #b19589 48%, #67524c 100%);
}

.fabric-texture-wool {
  background: repeating-linear-gradient(45deg, #c5b8aa 0, #c5b8aa 4rpx, #b6a596 5rpx, #b6a596 7rpx);
}

.fabric-option-copy {
  flex: 1;
  min-width: 0;
}

.fabric-effect-option .fabric-option-name {
  display: block;
  margin: 0;
  color: #1f2937;
  font-size: 25rpx;
  font-weight: 800;
  line-height: 1.3;
}

.fabric-effect-option .fabric-option-desc {
  display: block;
  margin-top: 7rpx;
  color: #667085;
  font-size: 21rpx;
  font-weight: 500;
  line-height: 1.35;
}

.fabric-effect-option .fabric-option-check {
  position: absolute;
  top: 10rpx;
  right: 10rpx;
  width: 34rpx;
  height: 34rpx;
  margin: 0;
  border-radius: 50%;
  background: #4f46e5;
  color: #ffffff;
  text-align: center;
  font-size: 20rpx;
  font-weight: 900;
  line-height: 34rpx;
}

.fabric-reference-upload,
.fabric-reference-preview {
  margin-top: 16rpx;
  border: 2rpx dashed #c7d2fe;
  border-radius: 22rpx;
  background: #f8faff;
}

.fabric-reference-upload {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 22rpx;
}

.fabric-reference-plus {
  flex: 0 0 54rpx;
  width: 54rpx;
  height: 54rpx;
  border-radius: 16rpx;
  background: #e0e7ff;
  color: #4f46e5;
  text-align: center;
  font-size: 34rpx;
  font-weight: 500;
  line-height: 50rpx;
}

.fabric-reference-title,
.fabric-reference-desc {
  display: block;
}

.fabric-reference-title {
  color: #27314a;
  font-size: 24rpx;
  font-weight: 800;
}

.fabric-reference-desc {
  margin-top: 6rpx;
  color: #748096;
  font-size: 20rpx;
  line-height: 1.4;
}

.fabric-reference-preview {
  display: flex;
  align-items: center;
  gap: 14rpx;
  padding: 14rpx;
}

.fabric-color-mode {
  margin-top: 18rpx;
}

.fabric-color-mode-options {
  display: flex;
  gap: 12rpx;
  margin-top: 12rpx;
}

.fabric-color-mode-option {
  flex: 1;
  min-height: 76rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  padding: 0 14rpx;
  border: 2rpx solid #d7dce5;
  border-radius: 16rpx;
  background: #ffffff;
  color: #475467;
  font-size: 22rpx;
  font-weight: 600;
}

.fabric-color-mode-option.active {
  border-color: #4f46e5;
  background: #eef2ff;
  color: #4338ca;
}

.fabric-capability-note {
  padding: 18rpx 20rpx;
  border: 2rpx solid #f2d39b;
  border-radius: 18rpx;
  background: #fffaf0;
  color: #7a5b22;
  font-size: 21rpx;
  line-height: 1.55;
}

.fabric-capability-title {
  display: block;
  margin-bottom: 4rpx;
  color: #694d1c;
  font-size: 23rpx;
  font-weight: 700;
}

.fabric-reference-section {
  padding: 0;
  overflow: hidden;
}

.fabric-collapse-head {
  display: flex;
  align-items: center;
  gap: 16rpx;
  min-height: 132rpx;
  padding: 22rpx 24rpx;
  box-sizing: border-box;
}

.fabric-collapse-summary {
  display: block;
  margin-top: 6rpx;
  color: #4f46e5;
  font-size: 21rpx;
  line-height: 1.35;
}

.fabric-collapse-arrow {
  flex: 0 0 auto;
  color: #667085;
  font-size: 30rpx;
  line-height: 1;
}

.fabric-reference-content {
  padding: 0 24rpx 24rpx;
  border-top: 1rpx solid #edf0f5;
}

.fabric-reference-image {
  flex: 0 0 100rpx;
  width: 100rpx;
  height: 100rpx;
  border-radius: 18rpx;
  background: #eef0f4;
}

.fabric-reference-copy {
  flex: 1;
  min-width: 0;
}

.fabric-requirement-card .redesign-textarea {
  background: #f8fafc;
}

.fabric-prompt-textarea {
  min-height: 184rpx;
  max-height: 220rpx;
  padding-bottom: 46rpx;
}

.fabric-character-count {
  display: block;
  margin-top: -38rpx;
  padding-right: 16rpx;
  color: #98a2b3;
  text-align: right;
  font-size: 20rpx;
  line-height: 30rpx;
  pointer-events: none;
}

.fabric-config-summary {
  padding: 18rpx 22rpx;
  border: 1rpx solid #e5e7eb;
  border-radius: 18rpx;
  background: #ffffff;
  color: #4b5563;
  font-size: 22rpx;
  line-height: 1.4;
}

.pattern-page {
  padding: 20rpx 24rpx calc(224rpx + env(safe-area-inset-bottom));
  background: #f5f6fa;
}

.pattern-hero-card,
.pattern-upload-card {
  padding: 28rpx 30rpx;
  border-radius: 24rpx;
  box-shadow: none;
}

.pattern-hero-card,
.pattern-upload-card,
.pattern-draft-banner {
  margin-bottom: 20rpx;
}

.pattern-hero-card .page-title {
  font-size: 38rpx;
  line-height: 1.25;
}

.pattern-hero-card .page-subtitle {
  margin-top: 8rpx;
  font-size: 23rpx;
  line-height: 1.5;
}

.pattern-upload-box {
  min-height: 300rpx;
  margin-top: 18rpx;
  border-radius: 22rpx;
  background: #fafbff;
}

.pattern-preview-box {
  min-height: 360rpx;
  margin-top: 18rpx;
  background: #f8fafc;
}

.pattern-preview-box .preview-image {
  height: 380rpx;
}

.pattern-draft-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  padding: 20rpx 24rpx;
  border: 1rpx solid #ddd6fe;
  border-radius: 22rpx;
  background: #faf8ff;
}

.pattern-draft-title,
.pattern-draft-desc {
  display: block;
}

.pattern-draft-title {
  color: #312e81;
  font-size: 23rpx;
  font-weight: 700;
}

.pattern-draft-desc {
  margin-top: 4rpx;
  color: #6b7280;
  font-size: 20rpx;
}

.pattern-draft-actions {
  flex: 0 0 auto;
  display: flex;
  gap: 16rpx;
  color: #4f46e5;
  font-size: 21rpx;
  font-weight: 700;
}

.pattern-draft-actions .muted {
  color: #6b7280;
}

.pattern-workflow-panel {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.pattern-step-card {
  padding: 24rpx;
  border: 1rpx solid #edf0f5;
  border-radius: 26rpx;
  background: #ffffff;
  box-shadow: 0 8rpx 22rpx rgba(15, 23, 42, 0.035);
}

.pattern-current-summary {
  display: flex;
  align-items: center;
  gap: 14rpx;
  min-height: 76rpx;
  margin-top: 18rpx;
  padding: 12rpx 16rpx;
  border: 1rpx solid #d9ddff;
  border-radius: 18rpx;
  background: #f7f7ff;
  color: #3730a3;
  font-size: 22rpx;
  line-height: 1.4;
  box-sizing: border-box;
}

.pattern-current-summary.empty {
  border-color: #e5e7eb;
  background: #f8fafc;
  color: #6b7280;
}

.pattern-current-summary > text {
  flex: 1;
  min-width: 0;
}

.pattern-summary-image {
  flex: 0 0 64rpx;
  width: 64rpx;
  height: 64rpx;
  border: 1rpx solid #e5e7eb;
  border-radius: 14rpx;
  background: #f3f4f6;
}

.pattern-summary-actions,
.pattern-reference-actions {
  flex: 0 0 auto;
  display: flex;
  gap: 18rpx;
  color: #4f46e5;
  font-size: 21rpx;
  font-weight: 700;
}

.pattern-summary-actions .danger,
.pattern-reference-actions .danger {
  color: #dc2626;
}

.pattern-source-tabs {
  display: flex;
  gap: 8rpx;
  margin-top: 18rpx;
  padding: 6rpx;
  border-radius: 16rpx;
  background: #f2f3f7;
}

.pattern-source-tab {
  flex: 1;
  min-height: 72rpx;
  border-radius: 13rpx;
  color: #667085;
  text-align: center;
  font-size: 23rpx;
  font-weight: 700;
  line-height: 72rpx;
}

.pattern-source-tab.active {
  background: #4f46e5;
  color: #ffffff;
}

.pattern-library-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
  margin-top: 18rpx;
}

.pattern-option-card {
  position: relative;
  display: flex;
  align-items: center;
  min-width: 0;
  min-height: 108rpx;
  padding: 14rpx 42rpx 14rpx 16rpx;
  border: 2rpx solid #e5e7eb;
  border-radius: 18rpx;
  background: #fbfcfe;
  box-sizing: border-box;
}

.pattern-option-card.active {
  border-color: #4f46e5;
  background: #f3f1ff;
}

.pattern-option-copy {
  min-width: 0;
}

.pattern-option-name,
.pattern-option-desc {
  display: block;
}

.pattern-option-name {
  color: #27314a;
  font-size: 24rpx;
  font-weight: 700;
}

.pattern-option-card.active .pattern-option-name {
  color: #4f46e5;
}

.pattern-option-desc {
  margin-top: 5rpx;
  overflow: hidden;
  color: #748096;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 20rpx;
}

.pattern-option-check {
  position: absolute;
  top: 10rpx;
  right: 10rpx;
  width: 32rpx;
  height: 32rpx;
  border-radius: 50%;
  background: #4f46e5;
  color: #ffffff;
  text-align: center;
  font-size: 19rpx;
  line-height: 32rpx;
}

.pattern-upload-panel {
  margin-top: 18rpx;
}

.pattern-upload-strip,
.pattern-reference-preview {
  display: flex;
  align-items: center;
  gap: 14rpx;
  min-height: 112rpx;
  padding: 14rpx 16rpx;
  border: 2rpx dashed #c7d2fe;
  border-radius: 18rpx;
  background: #fafaff;
  box-sizing: border-box;
}

.pattern-upload-plus {
  flex: 0 0 56rpx;
  width: 56rpx;
  height: 56rpx;
  border-radius: 14rpx;
  background: #e0e7ff;
  color: #4f46e5;
  text-align: center;
  font-size: 34rpx;
  line-height: 52rpx;
}

.pattern-upload-title,
.pattern-upload-desc {
  display: block;
}

.pattern-upload-title {
  color: #27314a;
  font-size: 23rpx;
  font-weight: 700;
}

.pattern-upload-desc {
  margin-top: 5rpx;
  color: #748096;
  font-size: 20rpx;
  line-height: 1.4;
}

.pattern-reference-image {
  flex: 0 0 88rpx;
  width: 88rpx;
  height: 88rpx;
  border: 1rpx solid #e5e7eb;
  border-radius: 16rpx;
  background: #f3f4f6;
}

.pattern-reference-copy {
  flex: 1;
  min-width: 0;
}

.pattern-risk-note {
  display: block;
  margin-top: 16rpx;
  padding: 14rpx 16rpx;
  border-radius: 14rpx;
  background: #fff8e8;
  color: #8a5b17;
  font-size: 20rpx;
  line-height: 1.45;
}

.pattern-position-grid {
  margin-top: 16rpx;
}

.pattern-position-grid .color-target-pill {
  min-height: 80rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
  box-sizing: border-box;
}

.pattern-prompt-textarea {
  min-height: 184rpx;
  max-height: 220rpx;
  padding-bottom: 46rpx;
  background: #f8fafc;
}

.pattern-config-summary {
  padding: 18rpx 22rpx;
  border: 1rpx solid #e5e7eb;
  border-radius: 18rpx;
  background: #ffffff;
  color: #4b5563;
  font-size: 22rpx;
  line-height: 1.4;
}

.redesign-textarea {
  width: 100%;
  min-height: 142rpx;
  margin-top: 14rpx;
  padding: 18rpx;
  border: 1rpx solid #e5e7eb;
  border-radius: 20rpx;
  background: #ffffff;
  color: #111827;
  font-size: 23rpx;
  line-height: 1.45;
  box-sizing: border-box;
}

.detail-template-section {
  margin-bottom: 20rpx;
}

.detail-template-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12rpx;
  margin-top: 16rpx;
}

.detail-template-card {
  min-height: 142rpx;
  padding: 16rpx;
  border: 1rpx solid #d1d5db;
  border-radius: 20rpx;
  background: #ffffff;
  box-sizing: border-box;
}

.detail-template-card.active {
  border-color: #4f46e5;
  background: #f5f3ff;
  box-shadow: 0 10rpx 24rpx rgba(79, 70, 229, 0.09);
}

.detail-template-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 6rpx;
}

.detail-template-name,
.detail-template-desc {
  display: block;
}

.detail-template-name {
  color: #111827;
  font-size: 23rpx;
  font-weight: 900;
  line-height: 1.3;
}

.detail-template-check {
  flex-shrink: 0;
  color: #4f46e5;
  font-size: 21rpx;
  font-weight: 900;
}

.detail-template-desc {
  margin-top: 9rpx;
  color: #6b7280;
  font-size: 18rpx;
  line-height: 1.4;
}

.product-info-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx;
  margin-top: 16rpx;
}

.product-info-field.full {
  grid-column: 1 / -1;
}

.product-info-label {
  display: block;
  margin-bottom: 8rpx;
  color: #374151;
  font-size: 21rpx;
  font-weight: 800;
}

.product-info-input,
.product-info-textarea {
  width: 100%;
  padding: 0 16rpx;
  border: 1rpx solid #e5e7eb;
  border-radius: 16rpx;
  color: #111827;
  background: #ffffff;
  font-size: 22rpx;
  box-sizing: border-box;
}

.product-info-input {
  height: 68rpx;
}

.product-info-textarea {
  min-height: 112rpx;
  padding-top: 14rpx;
  padding-bottom: 14rpx;
  line-height: 1.45;
}

.marketing-copy-card {
  background: #ffffff;
  border: 1rpx solid #e0e7ff;
}

.marketing-copy-field {
  margin-top: 18rpx;
}

.marketing-copy-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-bottom: 8rpx;
}

.marketing-copy-head .product-info-label {
  margin-bottom: 0;
}

.marketing-copy-btn {
  height: 50rpx;
  padding: 0 18rpx;
  border: 1rpx solid #c7d2fe;
  border-radius: 999rpx;
  color: #4338ca;
  background: #eef2ff;
  font-size: 19rpx;
  font-weight: 800;
  line-height: 50rpx;
}

.marketing-copy-btn::after {
  border: 0;
}

.marketing-description-input {
  min-height: 144rpx;
}

.detail-generation-preview {
  margin-bottom: 18rpx;
  padding: 20rpx;
  border: 1rpx solid #e0e7ff;
  border-radius: 22rpx;
  background: #f8faff;
}

.detail-preview-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
}

.detail-preview-kicker,
.detail-preview-title {
  display: block;
}

.detail-preview-kicker {
  color: #6b7280;
  font-size: 19rpx;
}

.detail-preview-title {
  margin-top: 4rpx;
  color: #111827;
  font-size: 25rpx;
  font-weight: 900;
}

.detail-preview-count {
  flex-shrink: 0;
  padding: 7rpx 12rpx;
  border-radius: 999rpx;
  color: #4f46e5;
  background: #eef2ff;
  font-size: 20rpx;
  font-weight: 900;
}

.detail-preview-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 9rpx;
  margin-top: 16rpx;
}

.detail-preview-tag {
  padding: 8rpx 12rpx;
  border-radius: 12rpx;
  color: #4338ca;
  background: #ffffff;
  font-size: 20rpx;
  font-weight: 800;
}

.package-structure-preview {
  margin-top: 18rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid #e0e7ff;
}

.package-structure-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
  color: #374151;
  font-size: 21rpx;
  font-weight: 900;
}

.package-structure-head text:last-child {
  color: #4f46e5;
  font-size: 19rpx;
}

.package-structure-flow {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 9rpx;
  margin-top: 14rpx;
}

.package-structure-item {
  display: flex;
  align-items: center;
  gap: 7rpx;
  min-height: 56rpx;
  padding: 8rpx;
  border-radius: 12rpx;
  background: #ffffff;
  box-sizing: border-box;
}

.package-structure-index {
  flex-shrink: 0;
  width: 26rpx;
  height: 26rpx;
  border-radius: 50%;
  color: #ffffff;
  background: #4f46e5;
  text-align: center;
  line-height: 26rpx;
  font-size: 16rpx;
  font-weight: 900;
}

.package-structure-name {
  color: #4b5563;
  font-size: 18rpx;
  font-weight: 800;
}

.detail-module-section {
  margin-bottom: 18rpx;
}

.detail-module-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
  margin-bottom: 16rpx;
}

.detail-recommend-badge {
  flex-shrink: 0;
  padding: 7rpx 12rpx;
  border-radius: 999rpx;
  color: #4f46e5;
  background: #eef2ff;
  font-size: 19rpx;
  font-weight: 900;
}

.detail-module-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx;
}

.detail-module-card {
  min-height: 146rpx;
  padding: 18rpx;
  border: 1rpx solid #d1d5db;
  border-radius: 22rpx;
  background: #ffffff;
  box-sizing: border-box;
}

.detail-module-card.active {
  border-color: #4f46e5;
  background: #f8f7ff;
  box-shadow: 0 10rpx 24rpx rgba(79, 70, 229, 0.09);
}

.detail-module-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10rpx;
}

.detail-module-name,
.detail-module-desc {
  display: block;
}

.detail-module-name {
  color: #111827;
  font-size: 25rpx;
  font-weight: 900;
}

.detail-module-check {
  flex-shrink: 0;
  width: 34rpx;
  height: 34rpx;
  border-radius: 50%;
  color: #ffffff;
  background: #4f46e5;
  text-align: center;
  line-height: 34rpx;
  font-size: 20rpx;
  font-weight: 900;
}

.detail-module-desc {
  margin-top: 12rpx;
  color: #6b7280;
  font-size: 20rpx;
  line-height: 1.4;
}

.standard-detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10rpx;
  margin-top: 16rpx;
}

.standard-detail-item {
  display: flex;
  align-items: center;
  min-height: 62rpx;
  padding: 10rpx 14rpx;
  border: 1rpx solid #d1d5db;
  border-radius: 16rpx;
  color: #4b5563;
  background: #ffffff;
  font-size: 22rpx;
  font-weight: 800;
  box-sizing: border-box;
}

.standard-detail-item.active {
  border-color: #4f46e5;
  color: #4f46e5;
  background: #f5f3ff;
}

.standard-detail-check {
  margin-right: 8rpx;
  color: #4f46e5;
  font-size: 20rpx;
  font-weight: 900;
}

.detail-order-list {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10rpx;
  margin-top: 16rpx;
}

.detail-order-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 86rpx;
  border-radius: 16rpx;
  background: #f8fafc;
}

.detail-order-index {
  color: #4f46e5;
  font-size: 19rpx;
  font-weight: 900;
}

.detail-order-name {
  margin-top: 5rpx;
  color: #374151;
  font-size: 20rpx;
  font-weight: 800;
}

.detail-compatibility-note {
  margin-bottom: 18rpx;
  padding: 12rpx 16rpx;
  border-radius: 14rpx;
  color: #6b7280;
  background: #f8fafc;
  font-size: 20rpx;
}

.marketing-type-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12rpx;
  margin-bottom: 18rpx;
}

.marketing-type-card {
  min-height: 128rpx;
  padding: 16rpx;
  border: 1rpx solid #e5e7eb;
  border-radius: 22rpx;
  background: #ffffff;
  box-sizing: border-box;
}

.marketing-type-card.active {
  border-color: rgba(79, 70, 229, 0.46);
  background: linear-gradient(145deg, #eef2ff 0%, #ffffff 100%);
  box-shadow: 0 8rpx 22rpx rgba(79, 70, 229, 0.1);
}

.marketing-type-card text {
  display: block;
}

.marketing-type-card text:first-child {
  color: #111827;
  font-size: 24rpx;
  font-weight: 900;
}

.marketing-type-card text:last-child {
  margin-top: 6rpx;
  color: #6b7280;
  font-size: 19rpx;
  line-height: 1.35;
}

.model-submode-panel {
  margin-bottom: 18rpx;
  padding: 18rpx;
  border-radius: 22rpx;
  background: #f8faff;
}

.model-submode-title {
  display: block;
  color: #111827;
  font-size: 24rpx;
  font-weight: 900;
}

.detail-library-panel {
  margin-bottom: 18rpx;
}

.detail-category-row {
  display: flex;
  gap: 10rpx;
  padding-bottom: 14rpx;
  overflow-x: auto;
  white-space: nowrap;
}

.detail-category-pill {
  flex-shrink: 0;
  padding: 12rpx 20rpx;
  border: 1rpx solid #e5e7eb;
  border-radius: 999rpx;
  color: #6b7280;
  background: #ffffff;
  font-size: 22rpx;
  font-weight: 800;
}

.detail-category-pill.active {
  color: #ffffff;
  border-color: #4f46e5;
  background: #4f46e5;
  box-shadow: 0 8rpx 20rpx rgba(79, 70, 229, 0.16);
}

.detail-reference-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx;
}

.detail-reference-card {
  display: flex;
  align-items: center;
  gap: 14rpx;
  min-height: 112rpx;
  padding: 14rpx;
  border: 1rpx solid #e5e7eb;
  border-radius: 24rpx;
  background: #ffffff;
  box-shadow: 0 8rpx 22rpx rgba(15, 23, 42, 0.04);
  box-sizing: border-box;
}

.detail-reference-card.active {
  border-color: rgba(79, 70, 229, 0.5);
  background: linear-gradient(145deg, #ffffff 0%, #f8faff 100%);
  box-shadow: 0 12rpx 30rpx rgba(79, 70, 229, 0.1);
}

.detail-reference-visual {
  flex-shrink: 0;
  width: 72rpx;
  height: 72rpx;
  border-radius: 22rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.detail-reference-mark {
  color: rgba(255, 255, 255, 0.95);
  font-size: 26rpx;
  font-weight: 900;
}

.detail-reference-copy {
  min-width: 0;
}

.detail-reference-name,
.detail-reference-tag {
  display: block;
}

.detail-reference-name {
  color: #111827;
  font-size: 25rpx;
  font-weight: 900;
}

.detail-reference-tag {
  margin-top: 6rpx;
  color: #6b7280;
  font-size: 20rpx;
}

.model-mode-block {
  margin-bottom: 18rpx;
}

.model-quick-plan-block {
  margin-bottom: 18rpx;
}

.model-quick-plan-title {
  display: block;
  margin-bottom: 12rpx;
  color: #111827;
  font-size: 24rpx;
  font-weight: 900;
}

.model-quick-plan-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx;
}

.model-quick-plan-card {
  padding: 18rpx;
  border: 1rpx solid #e5e7eb;
  border-radius: 24rpx;
  background: #ffffff;
  box-shadow: 0 8rpx 20rpx rgba(15, 23, 42, 0.04);
  box-sizing: border-box;
}

.model-quick-plan-card.active {
  border-color: rgba(79, 70, 229, 0.42);
  background: linear-gradient(145deg, #ffffff 0%, #f5f7ff 100%);
  box-shadow: 0 12rpx 28rpx rgba(79, 70, 229, 0.09);
}

.model-quick-plan-name,
.model-quick-plan-desc {
  display: block;
}

.model-quick-plan-name {
  color: #111827;
  font-size: 24rpx;
  font-weight: 900;
}

.model-quick-plan-desc {
  margin-top: 6rpx;
  color: #6b7280;
  font-size: 20rpx;
  line-height: 1.35;
}

.mode-switch {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
}

.mode-card {
  min-height: 126rpx;
  padding: 18rpx;
  border: 1rpx solid #e5e7eb;
  border-radius: 24rpx;
  background: #ffffff;
  box-sizing: border-box;
}

.mode-card.active {
  border-color: rgba(79, 70, 229, 0.5);
  background: linear-gradient(145deg, #eef2ff 0%, #ffffff 100%);
  box-shadow: 0 10rpx 24rpx rgba(79, 70, 229, 0.1);
}

.mode-title,
.mode-desc,
.mode-summary-title,
.mode-summary-desc,
.face-upload-title,
.face-upload-desc,
.face-reference-name,
.face-reference-tag {
  display: block;
}

.mode-title {
  color: #111827;
  font-size: 27rpx;
  font-weight: 900;
}

.mode-desc {
  margin-top: 8rpx;
  color: #6b7280;
  font-size: 21rpx;
  line-height: 1.35;
}

.mode-summary {
  margin-top: 12rpx;
  padding: 16rpx 18rpx;
  border-radius: 22rpx;
  background: #f8fafc;
}

.mode-summary-title {
  color: #111827;
  font-size: 23rpx;
  font-weight: 900;
}

.mode-summary-desc {
  margin-top: 6rpx;
  color: #6b7280;
  font-size: 21rpx;
  line-height: 1.45;
}

.face-upload-card {
  margin-bottom: 18rpx;
  padding: 18rpx;
  border-radius: 24rpx;
  background: #f8faff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
}

.face-upload-title {
  color: #111827;
  font-size: 24rpx;
  font-weight: 900;
}

.face-upload-desc {
  margin-top: 6rpx;
  color: #6b7280;
  font-size: 20rpx;
  line-height: 1.35;
}

.face-upload-action {
  flex-shrink: 0;
  width: 112rpx;
  height: 58rpx;
  border-radius: 999rpx;
  background: #4f46e5;
  color: #ffffff;
  text-align: center;
  line-height: 58rpx;
  font-size: 22rpx;
  font-weight: 900;
}

.face-upload-preview {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.face-upload-image {
  width: 74rpx;
  height: 74rpx;
  border-radius: 22rpx;
  background: #e5e7eb;
}

.model-reference-control {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-bottom: 18rpx;
}

.model-feature-config {
  margin-bottom: 18rpx;
  padding: 18rpx;
  border: 1rpx solid rgba(229, 231, 235, 0.9);
  border-radius: 28rpx;
  background: #ffffff;
  box-shadow: 0 10rpx 24rpx rgba(15, 23, 42, 0.04);
}

.model-generate-summary-card {
  margin-bottom: 24rpx;
  padding: 22rpx 24rpx;
  border: 1rpx solid rgba(79, 70, 229, 0.12);
  border-radius: 28rpx;
  background: linear-gradient(145deg, #ffffff 0%, #f8faff 100%);
  box-shadow: 0 10rpx 24rpx rgba(15, 23, 42, 0.05);
}

.model-generate-summary-title,
.model-generate-summary-line {
  display: block;
}

.model-generate-summary-title {
  color: #111827;
  font-size: 25rpx;
  font-weight: 900;
}

.model-generate-summary-line {
  margin-top: 8rpx;
  color: #4b5563;
  font-size: 22rpx;
  line-height: 1.45;
}

.generate-btn-dynamic {
  display: block;
}

.face-reference-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx;
}

.face-reference-section {
  margin-top: 4rpx;
}

.face-reference-section-title {
  display: block;
  margin-bottom: 12rpx;
  color: #111827;
  font-size: 24rpx;
  font-weight: 900;
}

.model-reference-group {
  margin-top: 18rpx;
}

.model-reference-group:first-of-type {
  margin-top: 0;
}

.model-reference-group-title {
  display: block;
  margin-bottom: 12rpx;
  color: #374151;
  font-size: 22rpx;
  font-weight: 900;
}

.face-reference-card {
  padding: 14rpx;
  border: 1rpx solid #e5e7eb;
  border-radius: 26rpx;
  background: #ffffff;
  box-shadow: 0 8rpx 22rpx rgba(15, 23, 42, 0.04);
  box-sizing: border-box;
}

.face-reference-card.active {
  border-color: rgba(79, 70, 229, 0.5);
  background: linear-gradient(145deg, #ffffff 0%, #f8faff 100%);
  box-shadow: 0 12rpx 30rpx rgba(79, 70, 229, 0.1);
}

.face-reference-image {
  height: 150rpx;
  border-radius: 22rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.scene-reference-image {
  height: 150rpx;
  border-radius: 22rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.scene-visual {
  position: relative;
  width: 112rpx;
  height: 96rpx;
  border-radius: 22rpx;
  background: rgba(255, 255, 255, 0.36);
  overflow: hidden;
}

.scene-sky {
  position: absolute;
  left: 16rpx;
  top: 16rpx;
  width: 26rpx;
  height: 26rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
}

.scene-subject {
  position: absolute;
  left: 50rpx;
  bottom: 22rpx;
  width: 24rpx;
  height: 50rpx;
  border-radius: 16rpx 16rpx 10rpx 10rpx;
  background: rgba(255, 255, 255, 0.82);
}

.scene-ground {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 28rpx;
  background: rgba(255, 255, 255, 0.3);
}

.body-reference-image {
  height: 170rpx;
  border-radius: 22rpx;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  overflow: hidden;
}

.body-figure,
.pose-figure {
  position: relative;
  width: 82rpx;
  height: 146rpx;
}

.body-head,
.pose-head {
  position: absolute;
  left: 24rpx;
  top: 0;
  width: 34rpx;
  height: 34rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.92);
}

.body-torso,
.pose-body {
  position: absolute;
  left: 18rpx;
  top: 42rpx;
  width: 46rpx;
  height: 62rpx;
  border-radius: 24rpx 24rpx 18rpx 18rpx;
  background: rgba(255, 255, 255, 0.86);
  box-shadow: inset 0 -8rpx 14rpx rgba(15, 23, 42, 0.08);
}

.body-arm,
.body-leg,
.pose-leg {
  position: absolute;
  width: 12rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.78);
}

.body-arm {
  top: 50rpx;
  height: 52rpx;
}

.body-arm.left {
  left: 2rpx;
  transform: rotate(10deg);
}

.body-arm.right {
  right: 2rpx;
  transform: rotate(-10deg);
}

.body-leg,
.pose-leg {
  top: 100rpx;
  height: 44rpx;
}

.body-leg.left,
.pose-leg.left {
  left: 26rpx;
  transform: rotate(5deg);
}

.body-leg.right,
.pose-leg.right {
  right: 26rpx;
  transform: rotate(-5deg);
}

.pose-figure {
  height: 138rpx;
  transform: rotate(-4deg);
}

.pose-body {
  transform: skewX(-5deg);
}

.pose-leg.left {
  transform: rotate(18deg);
}

.pose-leg.right {
  transform: rotate(-18deg);
}

.face-shape {
  position: relative;
  width: 78rpx;
  height: 92rpx;
  border-radius: 40rpx 40rpx 34rpx 34rpx;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: inset 0 -10rpx 18rpx rgba(15, 23, 42, 0.08);
}

.face-hair {
  position: absolute;
  left: 10rpx;
  right: 10rpx;
  top: -10rpx;
  height: 34rpx;
  border-radius: 30rpx 30rpx 16rpx 16rpx;
  background: rgba(17, 24, 39, 0.28);
}

.face-dot {
  position: absolute;
  top: 42rpx;
  width: 8rpx;
  height: 8rpx;
  border-radius: 50%;
  background: rgba(17, 24, 39, 0.5);
}

.face-dot.left {
  left: 25rpx;
}

.face-dot.right {
  right: 25rpx;
}

.face-line {
  position: absolute;
  left: 27rpx;
  right: 27rpx;
  bottom: 24rpx;
  height: 4rpx;
  border-radius: 999rpx;
  background: rgba(17, 24, 39, 0.25);
}

.face-reference-copy {
  margin-top: 12rpx;
}

.face-reference-name {
  color: #111827;
  font-size: 24rpx;
  font-weight: 900;
}

.face-reference-tag {
  display: inline-block;
  margin-top: 8rpx;
  padding: 5rpx 12rpx;
  border-radius: 999rpx;
  background: #eef2ff;
  color: #4f46e5;
  font-size: 19rpx;
  font-weight: 800;
}

.reference-style-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx;
}

.reference-style-card {
  min-height: 196rpx;
  padding: 14rpx;
  border: 1rpx solid #e5e7eb;
  border-radius: 26rpx;
  background: #ffffff;
  box-sizing: border-box;
  box-shadow: 0 8rpx 22rpx rgba(15, 23, 42, 0.04);
}

.reference-style-card.active {
  border-color: rgba(79, 70, 229, 0.45);
  background: linear-gradient(145deg, #ffffff 0%, #f8faff 100%);
  box-shadow: 0 12rpx 30rpx rgba(79, 70, 229, 0.1);
}

.reference-visual {
  height: 104rpx;
  border-radius: 22rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.reference-mark {
  color: rgba(255, 255, 255, 0.96);
  font-size: 36rpx;
  font-weight: 900;
}

.reference-copy {
  margin-top: 12rpx;
}

.reference-name,
.reference-desc {
  display: block;
}

.reference-name {
  color: #111827;
  font-size: 25rpx;
  font-weight: 900;
}

.reference-desc {
  margin-top: 4rpx;
  color: #6b7280;
  font-size: 21rpx;
  line-height: 1.35;
}

.tone-indigo {
  background: linear-gradient(135deg, #6366f1 0%, #a5b4fc 100%);
}

.tone-blue {
  background: linear-gradient(135deg, #2563eb 0%, #93c5fd 100%);
}

.tone-purple {
  background: linear-gradient(135deg, #7c3aed 0%, #c4b5fd 100%);
}

.tone-cyan {
  background: linear-gradient(135deg, #0891b2 0%, #67e8f9 100%);
}

.tone-orange {
  background: linear-gradient(135deg, #f97316 0%, #fdba74 100%);
}

.tone-amber {
  background: linear-gradient(135deg, #d97706 0%, #fcd34d 100%);
}

.tone-pink {
  background: linear-gradient(135deg, #db2777 0%, #f9a8d4 100%);
}

.tone-red {
  background: linear-gradient(135deg, #dc2626 0%, #fca5a5 100%);
}

.tone-emerald {
  background: linear-gradient(135deg, #059669 0%, #86efac 100%);
}

.tone-slate {
  background: linear-gradient(135deg, #334155 0%, #cbd5e1 100%);
}

.param-group {
  margin-top: 22rpx;
}

.param-group:first-of-type {
  margin-top: 0;
}

.param-label {
  margin-bottom: 12rpx;
  color: #111827;
  font-size: 24rpx;
  font-weight: 800;
}

.choice-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.choice-pill {
  min-width: 144rpx;
  height: 68rpx;
  padding: 0 22rpx;
  border: 1rpx solid #e5e7eb;
  border-radius: 999rpx;
  background: #f9fafb;
  color: #374151;
  text-align: center;
  line-height: 68rpx;
  font-size: 24rpx;
  font-weight: 700;
  box-sizing: border-box;
}

.choice-pill.active {
  border-color: rgba(79, 70, 229, 0.45);
  background: #eef2ff;
  color: #4f46e5;
}

.model-quick-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.model-quick-card {
  min-width: 0;
  height: 132rpx;
  padding: 18rpx;
  border-radius: 24rpx;
  background: #ffffff;
  text-align: left;
  line-height: 1.2;
  box-shadow: 0 8rpx 20rpx rgba(15, 23, 42, 0.04);
}

.model-quick-card.active {
  background: linear-gradient(145deg, #eef2ff 0%, #ffffff 100%);
  box-shadow: 0 10rpx 26rpx rgba(79, 70, 229, 0.1);
}

.model-quick-avatar {
  display: inline-flex;
  width: 44rpx;
  height: 44rpx;
  margin-right: 10rpx;
  border-radius: 16rpx;
  align-items: center;
  justify-content: center;
  background: #eef2ff;
  color: #4f46e5;
  font-size: 22rpx;
  font-weight: 900;
  vertical-align: middle;
}

.choice-label {
  font-size: 24rpx;
  font-weight: 800;
  vertical-align: middle;
}

.model-quick-desc {
  display: block;
  margin-top: 12rpx;
  color: #6b7280;
  font-size: 21rpx;
  font-weight: 500;
}

.advanced-entry-card {
  margin-bottom: 24rpx;
  padding: 20rpx 22rpx;
  border: 1rpx solid rgba(226, 232, 240, 0.9);
  border-radius: 26rpx;
  background: #ffffff;
  box-shadow: 0 8rpx 20rpx rgba(15, 23, 42, 0.035);
}

.advanced-entry-card.open {
  padding: 24rpx;
  border-radius: 32rpx;
  box-shadow: 0 12rpx 30rpx rgba(15, 23, 42, 0.055);
}

.advanced-entry-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}

.advanced-toggle {
  flex-shrink: 0;
  padding: 10rpx 18rpx;
  border-radius: 999rpx;
  background: #eef2ff;
  color: #4f46e5;
  font-size: 22rpx;
  font-weight: 800;
}

.advanced-entry-title,
.advanced-entry-desc {
  display: block;
}

.advanced-entry-title {
  color: #111827;
  font-size: 25rpx;
  font-weight: 800;
}

.advanced-entry-desc {
  margin-top: 5rpx;
  color: #6b7280;
  font-size: 21rpx;
  line-height: 1.4;
}

.advanced-panel {
  margin-top: 22rpx;
  padding-top: 22rpx;
  border-top: 1rpx solid #eef2f7;
}

.advanced-block {
  margin-top: 24rpx;
}

.advanced-block:first-child {
  margin-top: 0;
}

.advanced-block-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-bottom: 16rpx;
}

.advanced-title,
.advanced-desc,
.model-name,
.model-meta {
  display: block;
}

.advanced-title {
  color: #111827;
  font-size: 26rpx;
  font-weight: 800;
}

.advanced-desc {
  margin-top: 8rpx;
  color: #6b7280;
  font-size: 22rpx;
  line-height: 1.45;
}

.outline-btn {
  height: 58rpx;
  padding: 0 20rpx;
  border-radius: 999rpx;
  background: #f8fafc;
  color: #4f46e5;
  font-size: 21rpx;
  font-weight: 800;
  line-height: 58rpx;
}

.outline-btn.full {
  width: 100%;
  margin-top: 18rpx;
  background: #eef2ff;
}

.outline-btn::after {
  border: 0;
}

.model-tabs {
  display: flex;
  gap: 10rpx;
  margin-bottom: 16rpx;
  overflow-x: auto;
  white-space: nowrap;
}

.model-tab {
  flex-shrink: 0;
  padding: 11rpx 18rpx;
  border-radius: 999rpx;
  background: #f3f4f6;
  color: #6b7280;
  font-size: 22rpx;
  font-weight: 800;
}

.model-tab.active {
  background: #111827;
  color: #ffffff;
}

.model-card-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.model-card {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 14rpx;
  border: 1rpx solid #e5e7eb;
  border-radius: 22rpx;
  background: #f9fafb;
}

.model-card.active {
  border-color: rgba(79, 70, 229, 0.45);
  background: #eef2ff;
}

.model-avatar {
  flex-shrink: 0;
  width: 76rpx;
  height: 76rpx;
  border-radius: 20rpx;
  background: #e5e7eb;
  color: #4f46e5;
  text-align: center;
  line-height: 76rpx;
  font-size: 28rpx;
  font-weight: 900;
}

.model-info {
  min-width: 0;
  flex: 1;
}

.model-name {
  color: #111827;
  font-size: 24rpx;
  font-weight: 800;
}

.model-meta {
  margin-top: 5rpx;
  color: #6b7280;
  font-size: 20rpx;
}

.custom-model-box {
  padding: 18rpx;
  border-radius: 24rpx;
  background: #f9fafb;
}

.custom-model-input {
  height: 72rpx;
  margin-bottom: 16rpx;
  padding: 0 20rpx;
  border-radius: 18rpx;
  background: #ffffff;
  color: #111827;
  font-size: 24rpx;
}

.input-placeholder {
  color: #9ca3af;
}

.choice-row.compact {
  gap: 10rpx;
}

.empty-model-tip {
  padding: 24rpx;
  border-radius: 20rpx;
  background: #f8fafc;
  color: #6b7280;
  font-size: 22rpx;
  line-height: 1.45;
}

.reference-upload {
  height: 120rpx;
  margin-top: 14rpx;
  border: 2rpx dashed rgba(79, 70, 229, 0.2);
  border-radius: 22rpx;
  background: #f8faff;
  color: #4f46e5;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 23rpx;
  font-weight: 800;
}

.reference-preview {
  margin-top: 14rpx;
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.reference-image {
  width: 150rpx;
  height: 150rpx;
  border-radius: 22rpx;
  background: #f3f4f6;
}

.advanced-config-group {
  margin-top: 18rpx;
}

.advanced-config-group:first-of-type {
  margin-top: 14rpx;
}

.style-page {
  padding: 20rpx 24rpx calc(230rpx + env(safe-area-inset-bottom));
  background: #f5f6fa;
}

.style-hero-card {
  margin-bottom: 24rpx;
  padding: 32rpx;
  border: 1rpx solid #eceef4;
  border-radius: 32rpx;
  background: #ffffff;
  box-shadow: none;
}

.style-hero-card .page-title {
  margin-top: 0;
  font-size: 36rpx;
  font-weight: 600;
  line-height: 1.25;
}

.style-hero-card .page-subtitle {
  margin-top: 12rpx;
  font-size: 24rpx;
  line-height: 1.5;
}

.style-upload-card {
  padding: 32rpx;
  border-radius: 32rpx;
  box-shadow: none;
}

.style-section-head {
  margin-bottom: 20rpx;
}

.style-required-title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12rpx;
}

.style-field-badge {
  flex-shrink: 0;
  padding: 4rpx 10rpx;
  border-radius: 999rpx;
  background: #f1f2f6;
  color: #7b8190;
  font-size: 20rpx;
  font-weight: 600;
  line-height: 1.35;
}

.style-field-badge.required {
  background: #fff1f2;
  color: #dc2626;
}

.style-completion-badge {
  flex-shrink: 0;
  padding: 4rpx 10rpx;
  border-radius: 999rpx;
  background: #ecfdf3;
  color: #15803d;
  font-size: 20rpx;
  font-weight: 600;
  line-height: 1.35;
}

.style-inline-error {
  display: block;
  margin-top: 14rpx;
  color: #dc2626;
  font-size: 22rpx;
  line-height: 1.45;
}

.style-inline-status {
  display: block;
  margin-top: 14rpx;
  color: #4f46e5;
  font-size: 22rpx;
  line-height: 1.45;
}

.style-upload-box {
  min-height: 320rpx;
  border-radius: 24rpx;
  background: #fafaff;
}

.style-upload-card .preview-box {
  position: relative;
  border-radius: 24rpx;
}

.style-upload-card .preview-image {
  height: 400rpx;
}

.style-upload-card .preview-actions {
  position: absolute;
  top: 16rpx;
  right: 16rpx;
  padding: 0;
  gap: 10rpx;
  background: transparent;
}

.style-upload-card .preview-actions .light-btn {
  min-width: 104rpx;
  height: 64rpx;
  padding: 0 16rpx;
  border-radius: 16rpx;
  background: rgba(255, 255, 255, 0.94);
  font-size: 22rpx;
  line-height: 64rpx;
  box-shadow: 0 6rpx 18rpx rgba(15, 23, 42, 0.12);
}

.style-config-shell {
  margin-bottom: 0;
  padding: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.style-workflow-panel {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  margin-bottom: 0;
}

.style-section-card {
  padding: 32rpx;
  border: 1rpx solid #eceef4;
  border-radius: 32rpx;
  background: #ffffff;
  box-sizing: border-box;
}

.style-card-head,
.style-save-toggle {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
}

.style-card-head.compact {
  margin-bottom: 2rpx;
}

.style-card-heading {
  min-width: 0;
  flex: 1;
}

.style-card-title,
.style-card-desc {
  display: block;
}

.style-card-title {
  color: #111827;
  font-size: 32rpx;
  font-weight: 600;
  line-height: 1.35;
}

.style-card-desc {
  margin-top: 8rpx;
  color: #737987;
  font-size: 24rpx;
  line-height: 1.45;
}

.style-head-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8rpx;
  max-width: 210rpx;
}

.style-selected-count,
.style-clear-action {
  font-size: 21rpx;
  line-height: 1.4;
}

.style-selected-count {
  color: #4f46e5;
  font-weight: 600;
}

.style-clear-action {
  color: #7b8190;
}

.style-reference-tabs {
  gap: 8rpx;
  margin-top: 24rpx;
  padding: 6rpx;
  border-radius: 18rpx;
  background: #f2f3f7;
}

.style-reference-tab {
  min-height: 72rpx;
  padding: 10rpx 8rpx;
  border-radius: 14rpx;
  font-size: 23rpx;
  line-height: 1.3;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
}

.style-reference-tab.active {
  background: #4f46e5;
  color: #ffffff;
  box-shadow: none;
}

.style-system-library,
.style-mine-reference,
.style-reference-section .color-reference-card.compact {
  margin-top: 20rpx;
}

.style-reference-scroll {
  width: 100%;
  white-space: nowrap;
}

.style-reference-row {
  display: inline-flex;
  gap: 16rpx;
  padding: 2rpx;
}

.style-reference-section .style-reference-card {
  position: relative;
  width: 210rpx;
  min-height: 144rpx;
  padding: 18rpx;
  border-radius: 20rpx;
  white-space: normal;
}

.style-option-check {
  position: absolute;
  top: 12rpx;
  right: 12rpx;
  z-index: 2;
  width: 34rpx;
  height: 34rpx;
  border-radius: 50%;
  background: #4f46e5;
  color: #ffffff;
  font-size: 20rpx;
  font-weight: 700;
  line-height: 34rpx;
  text-align: center;
}

.style-reference-section .style-reference-card.active {
  border-color: #4f46e5;
  background: #f3f1ff;
  box-shadow: none;
}

.style-mine-reference .style-reference-card {
  width: 100%;
}

.style-reference-section .style-reference-name {
  margin-top: 10rpx;
  font-size: 24rpx;
}

.style-reference-section .style-reference-desc {
  font-size: 21rpx;
}

.style-more-reference {
  min-height: 64rpx;
  margin-top: 12rpx;
  color: #4f46e5;
  font-size: 23rpx;
  font-weight: 600;
  line-height: 64rpx;
  text-align: center;
}

.style-reference-section .style-empty-reference {
  min-height: 120rpx;
  padding: 24rpx;
  border-radius: 20rpx;
  box-sizing: border-box;
}

.style-reference-section .color-reference-card.compact {
  min-height: 116rpx;
  margin-bottom: 0;
  padding: 22rpx;
  border-radius: 20rpx;
  background: #f8f8fb;
}

.style-reference-section .color-reference-action {
  min-width: 112rpx;
  height: 72rpx;
  line-height: 72rpx;
}

.style-subsection-title {
  margin-top: 0;
  color: #343946;
  font-size: 26rpx;
  font-weight: 600;
  line-height: 1.4;
}

.style-subsection-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-top: 24rpx;
}

.style-subsection-head.first {
  margin-top: 22rpx;
}

.style-selection-rule {
  flex-shrink: 0;
  color: #858b98;
  font-size: 21rpx;
  line-height: 1.4;
}

.style-pill-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-top: 14rpx;
}

.style-choice-pill {
  min-height: 88rpx;
  padding: 0 28rpx;
  border: 1rpx solid #dfe2e8;
  border-radius: 999rpx;
  background: #ffffff;
  color: #515766;
  font-size: 24rpx;
  font-weight: 600;
  line-height: 1.3;
  text-align: center;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
}

.style-choice-pill.active {
  border-color: #4f46e5;
  background: #4f46e5;
  color: #ffffff;
}

.style-ai-section .ai-prompt-template-grid {
  margin-top: 22rpx;
}

.style-ai-section .ai-prompt-template {
  min-height: 68rpx;
  padding: 12rpx 8rpx;
  border-radius: 16rpx;
  font-size: 22rpx;
  line-height: 1.3;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
}

.style-ai-section .ai-prompt-template.active {
  border-color: #4f46e5;
  background: #f1efff;
  color: #4f46e5;
}

.style-prompt-textarea {
  min-height: 210rpx;
  max-height: 240rpx;
  margin-top: 20rpx;
  padding: 22rpx 24rpx 48rpx;
  border: 1rpx solid #dfe2e8;
  border-radius: 20rpx;
  background: #fafbfc;
  font-size: 24rpx;
  line-height: 1.5;
}

.style-character-count {
  display: block;
  margin-top: -40rpx;
  padding-right: 18rpx;
  color: #989eaa;
  font-size: 21rpx;
  line-height: 32rpx;
  text-align: right;
  pointer-events: none;
}

.style-tendency-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12rpx;
  margin-top: 14rpx;
}

.style-tendency-pill {
  min-height: 68rpx;
  padding: 0 8rpx;
  border: 1rpx solid #dfe2e8;
  border-radius: 16rpx;
  background: #ffffff;
  color: #515766;
  font-size: 23rpx;
  font-weight: 600;
  line-height: 1.3;
  text-align: center;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
}

.style-tendency-pill.active {
  border-color: #4f46e5;
  background: #f1efff;
  color: #4f46e5;
}

.style-pill-check {
  flex-shrink: 0;
  font-size: 20rpx;
  font-weight: 800;
  line-height: 1;
}

.style-conflict-message {
  margin-top: 16rpx;
  padding: 16rpx 18rpx;
  border: 1rpx solid #fecaca;
  border-radius: 16rpx;
  background: #fff7f7;
  color: #b91c1c;
  font-size: 22rpx;
  line-height: 1.45;
}

.style-count-row {
  display: flex;
  gap: 14rpx;
  margin-top: 22rpx;
}

.style-count-option {
  flex: 1;
  min-width: 0;
  min-height: 88rpx;
  border: 1rpx solid #dfe2e8;
  border-radius: 18rpx;
  background: #ffffff;
  color: #515766;
  font-size: 24rpx;
  font-weight: 600;
  line-height: 1.3;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
}

.style-count-option.active {
  border-color: #4f46e5;
  background: #4f46e5;
  color: #ffffff;
}

.style-save-section {
  padding-top: 26rpx;
  padding-bottom: 26rpx;
}

.style-save-toggle {
  min-height: 72rpx;
  align-items: center;
}

.style-save-arrow {
  flex-shrink: 0;
  color: #727887;
  font-size: 28rpx;
}

.style-save-content {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  margin-top: 20rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid #eceef4;
}

.style-save-content .design-plan-input {
  min-height: 88rpx;
  height: 88rpx;
  border-radius: 18rpx;
  font-size: 24rpx;
}

.style-save-content .save-design-btn {
  min-height: 88rpx;
  height: 88rpx;
  border-radius: 18rpx;
  font-size: 24rpx;
  line-height: 88rpx;
}

.style-submission-notice {
  margin-top: 24rpx;
  padding: 20rpx 24rpx;
  border: 1rpx solid #fecaca;
  border-radius: 20rpx;
  background: #fff7f7;
  color: #b91c1c;
  font-size: 23rpx;
  line-height: 1.5;
}

.style-submission-notice.navigation_failed {
  border-color: #fed7aa;
  background: #fffaf0;
  color: #9a3412;
}

.bottom-safe {
  height: 20rpx;
}

.bottom-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 18rpx 24rpx calc(18rpx + env(safe-area-inset-bottom));
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 -10rpx 28rpx rgba(15, 23, 42, 0.08);
  box-sizing: border-box;
}

.generate-btn {
  height: 88rpx;
  border-radius: 999rpx;
  background: #4f46e5;
  color: #ffffff;
  font-size: 29rpx;
  font-weight: 800;
  line-height: 88rpx;
}

.generate-btn.disabled {
  background: #cbd5e1;
  color: #ffffff;
}

.style-bottom-bar {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 16rpx 24rpx calc(16rpx + env(safe-area-inset-bottom));
  border-top: 1rpx solid #e7e9ef;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 -8rpx 24rpx rgba(15, 23, 42, 0.06);
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.style-bottom-bar.keyboard-hidden {
  transform: translateY(120%);
  opacity: 0;
  pointer-events: none;
}

.style-generate-meta {
  min-width: 0;
  flex: 1;
}

.style-generate-summary,
.style-generate-reason {
  display: block;
}

.style-generate-summary {
  color: #222733;
  font-size: 23rpx;
  font-weight: 600;
  line-height: 1.35;
}

.style-generate-reason {
  margin-top: 5rpx;
  color: #dc2626;
  font-size: 20rpx;
  line-height: 1.3;
}

.style-bottom-bar .generate-btn {
  flex: 0 0 300rpx;
  width: 300rpx;
  min-height: 96rpx;
  height: auto;
  padding: 20rpx 16rpx;
  margin: 0;
  border-radius: 20rpx;
  font-size: 28rpx;
  line-height: 1.3;
  display: flex;
  align-items: center;
  justify-content: center;
}

.color-page {
  padding: 20rpx 24rpx calc(220rpx + env(safe-area-inset-bottom));
  background: #f5f6fa;
}

.color-hero-card {
  margin-bottom: 20rpx;
  padding: 28rpx 30rpx;
  border-radius: 28rpx;
  background: #ffffff;
  box-shadow: none;
}

.color-hero-card .page-title {
  margin-top: 0;
  font-size: 36rpx;
  line-height: 1.25;
}

.color-hero-card .page-subtitle {
  margin-top: 8rpx;
  font-size: 24rpx;
  line-height: 1.5;
}

.color-upload-card {
  margin-bottom: 20rpx;
  padding: 30rpx;
  border-radius: 28rpx;
  box-shadow: none;
}

.color-upload-box {
  min-height: 320rpx;
  border-radius: 24rpx;
  background: #fafaff;
}

.color-preview-box {
  position: relative;
  border: 1rpx solid #e5e7eb;
  border-radius: 24rpx;
}

.color-preview-box .preview-image {
  height: 440rpx;
  background: #f3f4f6;
}

.color-eyedropper-overlay {
  position: absolute;
  z-index: 2;
  top: 16rpx;
  left: 16rpx;
  right: 16rpx;
  padding: 10rpx 18rpx;
  border-radius: 999rpx;
  background: rgba(17, 24, 39, 0.82);
  color: #ffffff;
  font-size: 21rpx;
  line-height: 1.35;
  text-align: center;
  box-sizing: border-box;
}

.color-image-meta {
  display: block;
  margin-top: 12rpx;
  color: #6b7280;
  font-size: 22rpx;
  line-height: 1.4;
}

.color-config-shell {
  padding: 0;
  background: transparent;
  box-shadow: none;
}

.color-workflow-panel {
  margin-bottom: 0;
}

.color-two-step-bar {
  display: flex;
  align-items: center;
  margin-bottom: 20rpx;
  padding: 18rpx 24rpx;
  border: 1rpx solid #e7e9ef;
  border-radius: 22rpx;
  background: #ffffff;
}

.color-two-step-item {
  display: flex;
  align-items: center;
  gap: 10rpx;
  color: #8b93a1;
  font-size: 22rpx;
  font-weight: 600;
}

.color-two-step-item > text:first-child {
  width: 38rpx;
  height: 38rpx;
  border-radius: 50%;
  background: #eef0f4;
  line-height: 38rpx;
  text-align: center;
}

.color-two-step-item.active,
.color-two-step-item.completed {
  color: #315be8;
}

.color-two-step-item.active > text:first-child,
.color-two-step-item.completed > text:first-child {
  background: #315be8;
  color: #ffffff;
}

.color-two-step-line {
  flex: 1;
  height: 2rpx;
  margin: 0 16rpx;
  background: #e1e5ec;
}

.color-source-strip {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 20rpx;
  padding: 14rpx 18rpx;
  border: 1rpx solid #e7e9ef;
  border-radius: 20rpx;
  background: #ffffff;
}

.color-source-thumb {
  flex: 0 0 88rpx;
  width: 88rpx;
  height: 88rpx;
  border-radius: 14rpx;
  background: #f1f3f7;
}

.color-source-copy {
  flex: 1;
  min-width: 0;
}

.color-source-copy text {
  display: block;
  color: #1f2937;
  font-size: 24rpx;
  font-weight: 650;
  line-height: 1.35;
}

.color-source-copy text:last-child {
  margin-top: 5rpx;
  color: #6b7280;
  font-size: 21rpx;
  font-weight: 400;
}

.color-source-change {
  flex-shrink: 0;
  padding: 16rpx 0 16rpx 18rpx;
  color: #315be8;
  font-size: 23rpx;
  font-weight: 600;
}

.color-step-card {
  margin-bottom: 20rpx;
  padding: 30rpx;
  border: 1rpx solid #eceef3;
  border-radius: 28rpx;
  background: #ffffff;
  box-sizing: border-box;
}

.color-step-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
}

.color-step-card .color-section-title {
  font-size: 30rpx;
  font-weight: 700;
  line-height: 1.35;
}

.color-step-card .color-section-desc {
  font-size: 23rpx;
  line-height: 1.5;
}

.color-target-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  min-height: 112rpx;
  margin-top: 22rpx;
  padding: 18rpx;
  border: 1rpx solid #e5e7eb;
  border-radius: 22rpx;
  background: #f8fafc;
  box-sizing: border-box;
}

.color-target-summary.empty {
  color: #6b7280;
}

.color-target-summary-main {
  display: flex;
  align-items: center;
  gap: 18rpx;
  min-width: 0;
}

.color-target-large-swatch {
  flex: 0 0 72rpx;
  width: 72rpx;
  height: 72rpx;
  border: 1rpx solid #cbd5e1;
  border-radius: 18rpx;
  box-sizing: border-box;
}

.color-target-copy,
.color-target-kicker,
.color-target-name,
.color-target-value,
.color-target-empty,
.color-risk-note,
.color-capability-note,
.color-card-upload-title,
.color-card-upload-desc,
.color-config-summary-title,
.color-config-summary,
.color-generate-summary,
.color-generate-reason {
  display: block;
}

.color-target-kicker {
  color: #6b7280;
  font-size: 20rpx;
}

.color-target-name {
  margin-top: 3rpx;
  color: #111827;
  font-size: 27rpx;
  font-weight: 700;
}

.color-target-value {
  margin-top: 4rpx;
  color: #6b7280;
  font-size: 20rpx;
  line-height: 1.35;
}

.color-target-clear {
  flex-shrink: 0;
  padding: 14rpx 4rpx 14rpx 16rpx;
  color: #4f46e5;
  font-size: 23rpx;
  font-weight: 600;
}

.color-risk-note {
  margin-top: 12rpx;
  color: #8a5b17;
  font-size: 21rpx;
  line-height: 1.45;
}

.color-single-note {
  display: block;
  margin-top: 8rpx;
  color: #594bc5;
  font-size: 21rpx;
  line-height: 1.4;
}

.color-method-tabs {
  display: flex;
  gap: 8rpx;
  margin-top: 22rpx;
  padding: 7rpx;
  border-radius: 18rpx;
  background: #f1f3f7;
}

.color-method-tab {
  flex: 1;
  min-height: 72rpx;
  padding: 0 8rpx;
  border-radius: 14rpx;
  color: #6b7280;
  font-size: 23rpx;
  font-weight: 600;
  line-height: 72rpx;
  text-align: center;
  box-sizing: border-box;
}

.color-method-tab.active {
  background: #ffffff;
  color: #4f46e5;
  box-shadow: 0 4rpx 12rpx rgba(15, 23, 42, 0.06);
}

.color-method-panel {
  margin-top: 20rpx;
}

.color-system-current {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  padding: 14rpx 0 18rpx;
}

.color-current-chip {
  display: flex;
  align-items: center;
  gap: 14rpx;
}

.color-current-chip > view:last-child text {
  display: block;
  color: #667085;
  font-size: 21rpx;
  line-height: 1.35;
}

.color-current-chip > view:last-child text:last-child {
  color: #101828;
  font-size: 26rpx;
  font-weight: 700;
}

.color-current-circle {
  width: 58rpx;
  height: 58rpx;
  border: 1rpx solid #d0d5dd;
  border-radius: 50%;
  box-sizing: border-box;
}

.color-custom-button {
  min-height: 68rpx;
  height: 68rpx;
  margin: 0;
  padding: 0 22rpx;
  border: 1rpx solid #d8d5f4;
  border-radius: 14rpx;
  background: #f5f3ff;
  color: #5b4fc7;
  font-size: 22rpx;
  font-weight: 600;
  line-height: 66rpx;
}

.color-custom-button::after { border: 0; }

.color-matrix {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.color-matrix-row {
  display: grid;
  grid-template-columns: repeat(10, minmax(0, 1fr));
  gap: 8rpx;
}

.color-matrix-cell {
  position: relative;
  width: 100%;
  height: 48rpx;
  border: 1rpx solid rgba(17, 24, 39, 0.12);
  border-radius: 8rpx;
  box-sizing: border-box;
}

.color-matrix-cell.light { border-color: #d0d5dd; }

.color-matrix-cell.active {
  border: 4rpx solid #6657d9;
  transform: scale(1.06);
  box-shadow: 0 0 0 2rpx #ffffff inset, 0 5rpx 14rpx rgba(102, 87, 217, 0.24);
}

.color-matrix-check {
  position: absolute;
  inset: 0;
  color: #ffffff;
  font-size: 24rpx;
  font-weight: 800;
  line-height: 42rpx;
  text-align: center;
}

.color-matrix-cell.light .color-matrix-check { color: #172033; }

.color-matrix-tip {
  display: block;
  margin-top: 12rpx;
  color: #667085;
  font-size: 20rpx;
  text-align: center;
}

.color-eyedropper-source-tabs {
  display: flex;
  gap: 10rpx;
  margin-bottom: 16rpx;
}

.color-eyedropper-source-tab {
  flex: 1;
  min-height: 68rpx;
  border: 1rpx solid #e4e7ec;
  border-radius: 14rpx;
  background: #ffffff;
  color: #667085;
  font-size: 22rpx;
  font-weight: 600;
  line-height: 66rpx;
  text-align: center;
}

.color-eyedropper-source-tab.active {
  border-color: #b9b2ee;
  background: #f3f1ff;
  color: #594bc5;
}

.color-recent-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14rpx;
  color: #475467;
  font-size: 22rpx;
}

.color-recent-head text:last-child { color: #d92d20; }

.color-recent-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12rpx;
}

.color-recent-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8rpx;
  min-width: 0;
  min-height: 68rpx;
  padding: 8rpx 30rpx 8rpx 8rpx;
  border: 2rpx solid #e4e7ec;
  border-radius: 14rpx;
  background: #ffffff;
  box-sizing: border-box;
}

.color-recent-item.active { border-color: #6657d9; background: #f7f5ff; box-shadow: 0 4rpx 12rpx rgba(102, 87, 217, .16); transform: scale(1.02); }
.color-recent-swatch { position: relative; display: flex; flex: 0 0 34rpx; width: 34rpx; height: 34rpx; border: 1rpx solid #d0d5dd; border-radius: 8rpx; align-items: center; justify-content: center; }
.color-recent-item > text { overflow: hidden; color: #344054; font-size: 18rpx; text-overflow: ellipsis; white-space: nowrap; }
.color-recent-item .color-recent-delete { position: absolute; top: 0; right: 0; width: 34rpx; height: 34rpx; color: #98a2b3; font-size: 28rpx; line-height: 32rpx; text-align: center; }
.color-empty-state text { display: block; line-height: 1.5; }
.color-empty-state text + text { margin-top: 6rpx; color: #98a2b3; font-size: 20rpx; }

.color-step-card .color-library-tabs {
  display: flex;
  flex-wrap: nowrap;
  gap: 8rpx;
  margin-top: 0;
}

.color-step-card .color-library-tab {
  flex: 1;
  min-height: 68rpx;
  padding: 0 8rpx;
  border-radius: 16rpx;
  font-size: 22rpx;
  line-height: 66rpx;
  text-align: center;
  box-sizing: border-box;
}

.color-palette-list {
  margin-top: 22rpx;
}

.color-palette-group + .color-palette-group {
  margin-top: 24rpx;
}

.color-palette-title {
  margin-bottom: 12rpx;
  color: #374151;
  font-size: 23rpx;
  font-weight: 600;
}

.color-swatch-grid-compact {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12rpx;
}

.color-swatch-card-compact {
  position: relative;
  min-width: 0;
  padding: 10rpx 8rpx 12rpx;
  border: 2rpx solid #e5e7eb;
  border-radius: 18rpx;
  background: #ffffff;
  text-align: center;
  box-sizing: border-box;
}

.color-swatch-card-compact.active {
  border-color: #4f46e5;
  background: #f5f3ff;
}

.color-swatch-card-compact .color-swatch {
  width: 100%;
  height: 56rpx;
  border: 1rpx solid #cbd5e1;
  border-radius: 12rpx;
  box-sizing: border-box;
}

.color-swatch-card-compact .color-swatch-name {
  overflow: hidden;
  margin-top: 8rpx;
  color: #111827;
  font-size: 21rpx;
  font-weight: 600;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.color-swatch-hex {
  display: block;
  overflow: hidden;
  margin-top: 2rpx;
  color: #9ca3af;
  font-size: 17rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.color-selected-check {
  position: absolute;
  z-index: 1;
  top: 5rpx;
  right: 5rpx;
  width: 30rpx;
  height: 30rpx;
  border-radius: 50%;
  background: #4f46e5;
  color: #ffffff;
  font-size: 19rpx;
  line-height: 30rpx;
  text-align: center;
}

.color-empty-state {
  margin-top: 20rpx;
  padding: 30rpx 20rpx;
  border: 1rpx dashed #cbd5e1;
  border-radius: 18rpx;
  color: #6b7280;
  font-size: 23rpx;
  text-align: center;
}

.color-empty-action {
  display: block;
  margin-top: 12rpx;
  color: #4f46e5;
  font-weight: 600;
}

.color-eyedropper-panel .eyedropper-btn {
  width: 100%;
  min-height: 80rpx;
  height: auto;
  margin-top: 18rpx;
  border-radius: 18rpx;
  line-height: 80rpx;
  box-sizing: border-box;
}

.color-sample-confirm {
  display: flex;
  align-items: center;
  gap: 14rpx;
  margin-top: 16rpx;
  padding: 14rpx;
  border: 1rpx solid #e5e7eb;
  border-radius: 16rpx;
  background: #f8fafc;
}

.color-sample-swatch {
  flex: 0 0 52rpx;
  width: 52rpx;
  height: 52rpx;
  border: 1rpx solid #cbd5e1;
  border-radius: 12rpx;
}

.color-sample-confirm > view:nth-child(2) {
  flex: 1;
  min-width: 0;
}

.color-sample-confirm > view:nth-child(2) text {
  display: block;
  color: #1f2937;
  font-size: 22rpx;
  line-height: 1.35;
}

.color-sample-confirm > view:nth-child(2) text:last-child {
  color: #6b7280;
  font-size: 19rpx;
}

.color-use-button {
  flex-shrink: 0;
  min-width: 150rpx;
  height: 64rpx;
  margin: 0;
  padding: 0 18rpx;
  border-radius: 14rpx;
  background: #315be8;
  color: #ffffff;
  font-size: 22rpx;
  font-weight: 600;
  line-height: 64rpx;
}

.color-use-button::after {
  border: 0;
}

.color-capability-note {
  margin-top: 14rpx;
  padding: 14rpx 16rpx;
  border-radius: 14rpx;
  background: #fff8e8;
  color: #8a5b17;
  font-size: 21rpx;
  line-height: 1.45;
}

.recent-colors {
  margin-top: 20rpx;
}

.recent-color-row {
  display: flex;
  gap: 12rpx;
}

.recent-color-item {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 8rpx 12rpx;
  border: 1rpx solid #e5e7eb;
  border-radius: 14rpx;
  color: #4b5563;
  font-size: 19rpx;
}

.recent-color-swatch {
  width: 30rpx;
  height: 30rpx;
  border: 1rpx solid #cbd5e1;
  border-radius: 8rpx;
}

.color-card-upload {
  display: flex;
  min-height: 190rpx;
  margin-top: 18rpx;
  border: 2rpx dashed #c7c9f4;
  border-radius: 20rpx;
  background: #fafaff;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.color-card-upload-icon {
  color: #4f46e5;
  font-size: 48rpx;
  line-height: 1;
}

.color-card-upload-title {
  margin-top: 10rpx;
  color: #111827;
  font-size: 25rpx;
  font-weight: 700;
}

.color-card-upload-desc {
  margin-top: 6rpx;
  color: #6b7280;
  font-size: 21rpx;
}

.color-card-preview {
  overflow: hidden;
  margin-top: 18rpx;
  border: 1rpx solid #e5e7eb;
  border-radius: 20rpx;
  background: #f8fafc;
}

.color-card-preview-image {
  width: 100%;
  height: 260rpx;
  display: block;
}

.color-card-actions {
  display: flex;
  gap: 14rpx;
  padding: 14rpx;
}

.color-extracted-palette {
  margin-top: 18rpx;
}

.color-extracted-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.color-extracted-item {
  position: relative;
  width: calc(33.333% - 8rpx);
  padding: 9rpx;
  border: 2rpx solid #e5e7eb;
  border-radius: 14rpx;
  background: #ffffff;
  box-sizing: border-box;
}

.color-extracted-item.active {
  border-color: #6657d9;
  background: #f5f3ff;
  box-shadow: 0 5rpx 14rpx rgba(102, 87, 217, .18);
  transform: scale(1.03);
}

.color-extracted-item > view {
  position: relative;
  display: flex;
  height: 48rpx;
  border: 1rpx solid rgba(15, 23, 42, 0.12);
  border-radius: 9rpx;
  align-items: center;
  justify-content: center;
}

.color-unified-check { color: #ffffff; font-size: 22rpx; font-weight: 800; line-height: 1; text-shadow: 0 1rpx 3rpx rgba(0,0,0,.28); }
.color-extracted-item.light .color-unified-check,
.color-recent-item.light .color-unified-check { color: #172033; text-shadow: none; }

.color-extracted-item > text {
  display: block;
  margin-top: 6rpx;
  color: #4b5563;
  font-size: 18rpx;
  text-align: center;
}

.color-advanced-entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  min-height: 92rpx;
  margin-bottom: 20rpx;
  padding: 14rpx 20rpx;
  border: 1rpx solid #e7e9ef;
  border-radius: 18rpx;
  background: #ffffff;
  box-sizing: border-box;
}

.color-advanced-entry > view {
  min-width: 0;
}

.color-advanced-entry > view text {
  display: block;
  color: #374151;
  font-size: 22rpx;
  line-height: 1.45;
}

.color-advanced-entry > view text:last-child {
  color: #6b7280;
  font-size: 20rpx;
}

.color-advanced-entry > text {
  flex-shrink: 0;
  color: #315be8;
  font-size: 22rpx;
  font-weight: 600;
}

.color-advanced-label {
  display: block;
  margin-top: 24rpx;
  color: #1f2937;
  font-size: 24rpx;
  font-weight: 650;
}

.color-preserve-note {
  margin-bottom: 4rpx;
  padding: 18rpx 20rpx;
  border-radius: 18rpx;
  background: #eef4ff;
}

.color-preserve-note text {
  display: block;
  color: #315be8;
  font-size: 21rpx;
  line-height: 1.45;
}

.color-preserve-note text:first-child {
  margin-bottom: 5rpx;
  color: #1f3d99;
  font-size: 23rpx;
  font-weight: 650;
}

.color-step-card .color-target-grid {
  gap: 12rpx;
  margin-top: 18rpx;
}

.color-step-card .color-target-pill {
  min-height: 72rpx;
  padding: 0 22rpx;
  font-size: 23rpx;
  line-height: 70rpx;
  box-sizing: border-box;
}

.color-option-check {
  margin-right: 7rpx;
}

.color-step-card .texture-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12rpx;
  margin-top: 18rpx;
}

.color-step-card .texture-pill {
  position: relative;
  min-height: 160rpx;
  padding: 22rpx 14rpx 16rpx;
  border: 2rpx solid #e5e7eb;
  border-radius: 18rpx;
  background: #ffffff;
  box-sizing: border-box;
}

.color-step-card .texture-pill.active {
  border-color: #4f46e5;
  background: #f5f3ff;
  color: #4f46e5;
}

.color-step-card .texture-pill text:nth-child(2) {
  color: #111827;
  font-size: 23rpx;
  font-weight: 700;
  line-height: 1.35;
}

.color-step-card .texture-pill text:last-child {
  margin-top: 8rpx;
  color: #6b7280;
  font-size: 19rpx;
  line-height: 1.45;
}

.texture-check {
  position: absolute;
  top: 8rpx;
  right: 10rpx;
  min-height: 26rpx;
  color: #4f46e5;
  font-size: 20rpx;
  line-height: 26rpx;
}

.color-counter {
  flex-shrink: 0;
  color: #9ca3af;
  font-size: 21rpx;
}

.color-prompt-textarea {
  width: 100%;
  min-height: 190rpx;
  height: 190rpx;
  margin-top: 18rpx;
  padding: 18rpx;
  border: 1rpx solid #e5e7eb;
  border-radius: 18rpx;
  background: #f8fafc;
  font-size: 24rpx;
  line-height: 1.5;
  box-sizing: border-box;
}

.color-config-summary {
  margin-bottom: 6rpx;
  padding: 22rpx 24rpx;
  border: 1rpx solid #e5e7eb;
  border-radius: 22rpx;
  background: #ffffff;
  color: #4b5563;
  font-size: 23rpx;
  line-height: 1.45;
}

.color-config-summary-title {
  margin-bottom: 6rpx;
  color: #111827;
  font-size: 25rpx;
  font-weight: 700;
}

.color-bottom-bar {
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding: 14rpx 24rpx calc(14rpx + env(safe-area-inset-bottom));
  border-top: 1rpx solid #e7e9ef;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 -8rpx 24rpx rgba(15, 23, 42, 0.06);
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.color-bottom-bar.keyboard-hidden {
  transform: translateY(120%);
  opacity: 0;
  pointer-events: none;
}

.color-generate-meta {
  flex: 1;
  min-width: 0;
}

.color-generate-summary {
  overflow: hidden;
  color: #222733;
  font-size: 22rpx;
  font-weight: 600;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.color-generate-reason {
  margin-top: 4rpx;
  color: #dc2626;
  font-size: 20rpx;
  line-height: 1.3;
}

.color-generate-reason.notice {
  color: #9a3412;
}

.color-bottom-bar .generate-btn {
  flex: 0 0 286rpx;
  width: 286rpx;
  height: 96rpx;
  margin: 0;
  border-radius: 20rpx;
  font-size: 28rpx;
  line-height: 96rpx;
}

.color-fixed-action {
  position: fixed;
  z-index: 60;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  align-items: center;
  gap: 14rpx;
  padding: 14rpx 24rpx calc(14rpx + env(safe-area-inset-bottom));
  border-top: 1rpx solid #e5e7eb;
  background: rgba(255, 255, 255, 0.97);
  box-shadow: 0 -8rpx 24rpx rgba(15, 23, 42, 0.06);
}

.color-fixed-action.keyboard-visible {
  position: static;
  padding-bottom: 14rpx;
}

.color-fixed-summary {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 12rpx;
  min-width: 0;
}

.color-fixed-summary > view:last-child {
  min-width: 0;
}

.color-fixed-summary text {
  display: block;
  overflow: hidden;
  color: #1f2937;
  font-size: 21rpx;
  font-weight: 600;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.color-fixed-summary text:last-child {
  margin-top: 3rpx;
  color: #6b7280;
  font-size: 19rpx;
  font-weight: 400;
}

.color-fixed-swatch {
  flex: 0 0 50rpx;
  width: 50rpx;
  height: 50rpx;
  border: 1rpx solid #cbd5e1;
  border-radius: 12rpx;
}

.color-fixed-reason {
  position: absolute;
  right: 24rpx;
  bottom: calc(116rpx + env(safe-area-inset-bottom));
  left: 24rpx;
  padding: 10rpx 14rpx;
  border-radius: 12rpx;
  background: #fff7ed;
  color: #b45309;
  font-size: 20rpx;
  text-align: center;
}

.color-fixed-button {
  flex: 0 0 244rpx;
  width: 244rpx;
  height: 88rpx;
  margin: 0;
  border-radius: 16rpx;
  background: #315be8;
  color: #ffffff;
  font-size: 27rpx;
  font-weight: 650;
  line-height: 88rpx;
}

.color-fixed-button[disabled] {
  background: #aebbe9;
  color: #ffffff;
  opacity: 1;
}

.color-fixed-button::after {
  border: 0;
}

.color-page .bottom-safe {
  height: calc(190rpx + env(safe-area-inset-bottom));
}

.fabric-bottom-bar {
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding: 14rpx 24rpx calc(14rpx + env(safe-area-inset-bottom));
  border-top: 1rpx solid #e7e9ef;
  background: rgba(255, 255, 255, 0.97);
  box-shadow: 0 -8rpx 24rpx rgba(15, 23, 42, 0.06);
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.fabric-bottom-bar.keyboard-hidden {
  transform: translateY(120%);
  opacity: 0;
  pointer-events: none;
}

.fabric-generate-meta {
  flex: 1;
  min-width: 0;
}

.fabric-generate-summary,
.fabric-generate-reason {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fabric-generate-summary {
  color: #222733;
  font-size: 22rpx;
  font-weight: 600;
  line-height: 1.35;
}

.fabric-generate-reason {
  margin-top: 4rpx;
  color: #dc2626;
  font-size: 20rpx;
  line-height: 1.3;
}

.fabric-generate-reason.notice {
  color: #9a3412;
}

.fabric-bottom-bar .generate-btn {
  flex: 0 0 286rpx;
  width: 286rpx;
  height: 96rpx;
  margin: 0;
  border-radius: 20rpx;
  font-size: 28rpx;
  line-height: 96rpx;
}

.pattern-bottom-bar {
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding: 14rpx 24rpx calc(14rpx + env(safe-area-inset-bottom));
  border-top: 1rpx solid #e7e9ef;
  background: rgba(255, 255, 255, 0.97);
  box-shadow: 0 -8rpx 24rpx rgba(15, 23, 42, 0.06);
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.pattern-bottom-bar.keyboard-hidden {
  transform: translateY(120%);
  opacity: 0;
  pointer-events: none;
}

.pattern-generate-meta {
  flex: 1;
  min-width: 0;
}

.pattern-generate-summary,
.pattern-generate-reason {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pattern-generate-summary {
  color: #222733;
  font-size: 22rpx;
  font-weight: 600;
  line-height: 1.35;
}

.pattern-generate-reason {
  margin-top: 4rpx;
  color: #dc2626;
  font-size: 20rpx;
  line-height: 1.3;
}

.pattern-generate-reason.notice {
  color: #9a3412;
}

.pattern-bottom-bar .generate-btn {
  flex: 0 0 286rpx;
  width: 286rpx;
  height: 96rpx;
  margin: 0;
  border-radius: 20rpx;
  font-size: 28rpx;
  line-height: 96rpx;
}

.display-page {
  padding: 20rpx 24rpx calc(220rpx + env(safe-area-inset-bottom));
  background: #f5f6fa;
}

.display-hero-card {
  margin-bottom: 18rpx;
  padding: 26rpx 28rpx;
  border: 1rpx solid #eceef4;
  border-radius: 28rpx;
  background: #ffffff;
  box-shadow: none;
}

.display-hero-card .page-title {
  margin-top: 0;
  font-size: 36rpx;
  line-height: 1.25;
}

.display-hero-card .page-subtitle {
  margin-top: 8rpx;
  font-size: 24rpx;
  line-height: 1.5;
}

.display-mode-switch {
  display: flex;
  gap: 8rpx;
  margin-bottom: 18rpx;
  padding: 7rpx;
  border-radius: 18rpx;
  background: #e9ebf1;
}

.display-mode-option {
  flex: 1;
  min-height: 72rpx;
  border-radius: 14rpx;
  color: #686f7d;
  font-size: 25rpx;
  font-weight: 700;
  line-height: 72rpx;
  text-align: center;
}

.display-mode-option.active {
  background: #ffffff;
  color: #4f46e5;
  box-shadow: 0 4rpx 12rpx rgba(15, 23, 42, 0.06);
}

.display-draft-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  margin-bottom: 18rpx;
  padding: 20rpx 22rpx;
  border: 1rpx solid #ddd9ff;
  border-radius: 22rpx;
  background: #f8f7ff;
}

.display-draft-title,
.display-draft-desc {
  display: block;
}

.display-draft-title {
  color: #34305f;
  font-size: 23rpx;
  font-weight: 700;
}

.display-draft-desc {
  margin-top: 5rpx;
  color: #77738f;
  font-size: 21rpx;
}

.display-draft-actions {
  display: flex;
  flex-shrink: 0;
  gap: 16rpx;
  color: #4f46e5;
  font-size: 22rpx;
  font-weight: 700;
}

.display-draft-actions .muted {
  color: #7b8190;
}

.display-upload-card {
  margin-bottom: 18rpx;
  padding: 28rpx;
  border: 1rpx solid #eceef4;
  border-radius: 28rpx;
  box-shadow: none;
}

.display-config-shell {
  margin-bottom: 0;
  padding: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.display-upload-box {
  min-height: 300rpx;
  border-radius: 22rpx;
  background: #fafaff;
}

.display-preview-box {
  position: relative;
  border: 1rpx solid #e5e7eb;
  border-radius: 22rpx;
}

.display-preview-box .preview-image {
  height: 430rpx;
  background: #f3f4f6;
}

.display-section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
  margin-bottom: 18rpx;
}

.display-section-head .unified-selection-title,
.display-section-head .detail-count-title,
.display-section-head .param-label {
  margin-bottom: 0;
}

.display-section-desc {
  display: block;
  margin-top: 6rpx;
  color: #747b88;
  font-size: 22rpx;
  line-height: 1.45;
}

.display-selection-block,
.display-detail-card,
.display-param-group {
  margin-bottom: 18rpx;
  padding: 26rpx;
  border: 1rpx solid #eceef4;
  border-radius: 26rpx;
  background: #ffffff;
  box-sizing: border-box;
}

.display-mode-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10rpx;
}

.display-mode-pill {
  min-width: 0;
  height: 76rpx;
  padding: 0 6rpx;
  border-radius: 16rpx;
  font-size: 22rpx;
  line-height: 74rpx;
  white-space: nowrap;
}

.display-selection-summary,
.detail-selection-summary {
  display: block;
  margin: 14rpx 0 0;
  padding: 13rpx 16rpx;
  border-radius: 16rpx;
  background: #f7f8fb;
  color: #555d6c;
  font-size: 22rpx;
  line-height: 1.4;
}

.display-detail-card.detail-mode-panel {
  background: #ffffff;
}

.detail-mode-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
}

.detail-mode-card {
  min-width: 0;
  min-height: 112rpx;
  padding: 18rpx;
  border: 1rpx solid #dde1e8;
  border-radius: 18rpx;
  background: #fafbfc;
  box-sizing: border-box;
}

.detail-mode-card.active {
  border-color: #4f46e5;
  background: #f4f3ff;
}

.detail-mode-name,
.detail-mode-desc {
  display: block;
}

.detail-mode-name {
  color: #252938;
  font-size: 24rpx;
  font-weight: 700;
}

.detail-mode-desc {
  margin-top: 6rpx;
  color: #737988;
  font-size: 20rpx;
  line-height: 1.4;
}

.display-detail-card .detail-category-row {
  flex-wrap: wrap;
  gap: 10rpx;
  margin-top: 18rpx;
  padding-bottom: 0;
  overflow: visible;
  white-space: normal;
}

.display-detail-card .detail-category-pill {
  padding: 11rpx 18rpx;
  font-size: 21rpx;
}

.detail-reference-compact-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10rpx;
  margin-top: 18rpx;
}

.detail-reference-compact-grid .detail-reference-card {
  position: relative;
  min-width: 0;
  min-height: 88rpx;
  padding: 14rpx 30rpx 14rpx 14rpx;
  border-radius: 18rpx;
  box-shadow: none;
}

.detail-reference-compact-grid .detail-reference-name {
  overflow: hidden;
  font-size: 23rpx;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-reference-compact-grid .detail-reference-tag {
  margin-top: 3rpx;
  font-size: 19rpx;
}

.detail-reference-check {
  position: absolute;
  top: 9rpx;
  right: 9rpx;
  width: 28rpx;
  height: 28rpx;
  border-radius: 50%;
  background: #4f46e5;
  color: #ffffff;
  font-size: 18rpx;
  font-weight: 800;
  line-height: 28rpx;
  text-align: center;
}

.detail-more-toggle {
  display: block;
  min-height: 64rpx;
  margin-top: 10rpx;
  color: #4f46e5;
  font-size: 22rpx;
  font-weight: 700;
  line-height: 64rpx;
  text-align: center;
}

.detail-count-explanation {
  margin-top: 12rpx;
  padding: 14rpx 16rpx;
  border-radius: 16rpx;
  background: #f7f8fb;
  color: #636b78;
  font-size: 21rpx;
  line-height: 1.45;
}

.detail-count-explanation.warning {
  background: #fff8eb;
  color: #94621b;
}

.detail-evidence-list {
  display: grid;
  gap: 14rpx;
  margin-top: 18rpx;
}

.detail-evidence-card {
  padding: 18rpx;
  border: 1rpx solid #e5e7eb;
  border-radius: 18rpx;
  background: #fbfcfe;
}

.detail-evidence-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
}

.detail-evidence-title,
.detail-evidence-status,
.detail-evidence-upload-title,
.detail-evidence-upload-desc {
  display: block;
}

.detail-evidence-title {
  color: #202532;
  font-size: 24rpx;
  font-weight: 700;
}

.detail-evidence-status {
  margin-top: 4rpx;
  color: #b45309;
  font-size: 20rpx;
}

.detail-evidence-status.ready {
  color: #047857;
}

.detail-evidence-upload {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 150rpx;
  margin-top: 14rpx;
  border: 2rpx dashed #cbd0da;
  border-radius: 16rpx;
  background: #ffffff;
}

.detail-evidence-plus {
  color: #4f46e5;
  font-size: 40rpx;
  line-height: 1;
}

.detail-evidence-upload-title {
  margin-top: 8rpx;
  color: #303544;
  font-size: 23rpx;
  font-weight: 700;
}

.detail-evidence-upload-desc {
  margin-top: 5rpx;
  color: #7b8190;
  font-size: 19rpx;
}

.detail-evidence-preview {
  margin-top: 14rpx;
}

.detail-evidence-image {
  width: 100%;
  height: 260rpx;
  border-radius: 16rpx;
  background: #eef0f4;
}

.detail-evidence-actions {
  display: flex;
  justify-content: flex-end;
  gap: 28rpx;
  margin-top: 12rpx;
  color: #4f46e5;
  font-size: 22rpx;
  font-weight: 700;
}

.detail-evidence-actions .danger {
  color: #dc2626;
}

.detail-custom-card.compact {
  margin-top: 18rpx;
  padding-top: 18rpx;
  border-top: 1rpx solid #eceef4;
}

.display-detail-textarea {
  min-height: 170rpx;
  margin-top: 14rpx;
  padding: 18rpx 20rpx;
  border: 1rpx solid #dfe2e8;
  border-radius: 18rpx;
  background: #fafbfc;
  box-sizing: border-box;
}

.display-param-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(138rpx, 1fr));
  gap: 12rpx;
}

.display-param-grid .choice-pill {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  min-width: 0;
  height: auto;
  min-height: 88rpx;
  padding: 12rpx 10rpx;
  border-radius: 18rpx;
  line-height: 1.3;
}

.display-param-grid .choice-label,
.display-option-hint {
  display: block;
  width: 100%;
  text-align: center;
}

.display-param-grid .choice-label {
  font-size: 23rpx;
  font-weight: 700;
}

.display-option-hint {
  margin-top: 4rpx;
  color: #89909d;
  font-size: 19rpx;
  font-weight: 400;
}

.display-param-grid .choice-pill.active .display-option-hint {
  color: #6961ae;
}

.display-bottom-bar {
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding: 16rpx 24rpx calc(16rpx + env(safe-area-inset-bottom));
  border-top: 1rpx solid #e7e9ef;
  background: rgba(255, 255, 255, 0.97);
  box-shadow: 0 -8rpx 24rpx rgba(15, 23, 42, 0.06);
}

.display-bottom-bar.keyboard-hidden {
  transform: translateY(120%);
  opacity: 0;
  pointer-events: none;
}

.display-generate-meta {
  min-width: 0;
  flex: 1;
}

.display-generate-summary,
.display-generate-reason {
  display: block;
}

.display-generate-summary {
  overflow: hidden;
  color: #252a35;
  font-size: 22rpx;
  font-weight: 700;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.display-generate-reason {
  margin-top: 4rpx;
  color: #dc2626;
  font-size: 20rpx;
  line-height: 1.3;
}

.display-generate-reason.notice {
  color: #94621b;
}

.display-bottom-bar .generate-btn {
  flex: 0 0 286rpx;
  width: 286rpx;
  min-height: 92rpx;
  height: auto;
  padding: 16rpx 12rpx;
  margin: 0;
  border-radius: 20rpx;
  font-size: 27rpx;
  line-height: 1.3;
  display: flex;
  align-items: center;
  justify-content: center;
}

@media screen and (max-width: 340px) {
  .display-page {
    padding-left: 18rpx;
    padding-right: 18rpx;
  }

  .display-upload-card,
  .display-hero-card,
  .display-selection-block,
  .display-detail-card,
  .display-param-group {
    padding-left: 20rpx;
    padding-right: 20rpx;
  }

  .display-mode-grid {
    gap: 6rpx;
  }

  .display-mode-pill {
    font-size: 20rpx;
  }

  .detail-reference-compact-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .display-bottom-bar {
    gap: 10rpx;
    padding-left: 18rpx;
    padding-right: 18rpx;
  }

  .display-bottom-bar .generate-btn {
    flex-basis: 248rpx;
    width: 248rpx;
  }
}

@media screen and (max-width: 340px) {
  .color-page {
    padding-left: 18rpx;
    padding-right: 18rpx;
  }

  .color-step-card,
  .color-upload-card,
  .color-hero-card {
    padding-left: 24rpx;
    padding-right: 24rpx;
  }

  .color-swatch-grid-compact {
    gap: 8rpx;
  }

  .color-bottom-bar {
    gap: 12rpx;
    padding-left: 18rpx;
    padding-right: 18rpx;
  }

  .color-bottom-bar .generate-btn {
    flex-basis: 252rpx;
    width: 252rpx;
  }

  .fabric-page {
    padding-left: 18rpx;
    padding-right: 18rpx;
  }

  .fabric-step-card,
  .fabric-upload-card,
  .fabric-hero-card {
    padding-left: 22rpx;
    padding-right: 22rpx;
  }

  .fabric-reference-section {
    padding: 0;
  }

  .fabric-effect-option {
    gap: 10rpx;
    padding: 12rpx;
  }

  .fabric-texture-swatch {
    flex-basis: 76rpx;
    width: 76rpx;
    height: 82rpx;
  }

  .fabric-bottom-bar {
    gap: 12rpx;
    padding-left: 18rpx;
    padding-right: 18rpx;
  }

  .fabric-bottom-bar .generate-btn {
    flex-basis: 252rpx;
    width: 252rpx;
  }

  .pattern-page {
    padding-left: 18rpx;
    padding-right: 18rpx;
  }

  .pattern-step-card,
  .pattern-upload-card,
  .pattern-hero-card {
    padding-left: 22rpx;
    padding-right: 22rpx;
  }

  .pattern-option-card {
    padding-left: 12rpx;
    padding-right: 38rpx;
  }

  .pattern-bottom-bar {
    gap: 12rpx;
    padding-left: 18rpx;
    padding-right: 18rpx;
  }

  .pattern-bottom-bar .generate-btn {
    flex-basis: 252rpx;
    width: 252rpx;
  }
}

@media screen and (max-width: 340px) {
  .style-page {
    padding-left: 18rpx;
    padding-right: 18rpx;
  }

  .style-section-card,
  .style-upload-card,
  .style-hero-card {
    padding-left: 26rpx;
    padding-right: 26rpx;
  }

  .style-tendency-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8rpx;
  }

  .style-bottom-bar .generate-btn {
    flex-basis: 276rpx;
    width: 276rpx;
  }
}

.garment-replace-page {
  min-height: 100vh;
  padding: 20rpx 24rpx 0;
  background: #f5f6fa;
  box-sizing: border-box;
}

.garment-wizard-steps {
  position: sticky;
  top: 0;
  z-index: 30;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6rpx;
  margin: 18rpx 0 0;
  padding: 16rpx 12rpx;
  border: 1rpx solid #e7eaf2;
  border-radius: 20rpx;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 8rpx 24rpx rgba(15, 23, 42, 0.06);
}

.garment-wizard-step { min-width: 0; text-align: center; }
.garment-wizard-index {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40rpx;
  height: 40rpx;
  margin: 0 auto 8rpx;
  border-radius: 50%;
  color: #7b8498;
  background: #edf0f5;
  font-size: 22rpx;
  font-weight: 700;
}
.garment-wizard-label { display: block; color: #7b8498; font-size: 20rpx; line-height: 1.25; }
.garment-wizard-step.active .garment-wizard-index { color: #fff; background: #4f46e5; }
.garment-wizard-step.active .garment-wizard-label { color: #3730a3; font-weight: 700; }
.garment-wizard-step.done .garment-wizard-index { color: #fff; background: #2f9e72; }

.garment-section {
  margin-top: 24rpx;
  padding: 28rpx;
  border: 1rpx solid #e7eaf2;
  border-radius: 24rpx;
  background: #ffffff;
}

.garment-wizard-panel { min-height: 540rpx; }

.garment-section-head {
  display: flex;
  gap: 18rpx;
  margin-bottom: 22rpx;
}

.garment-step {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 44rpx;
  width: 44rpx;
  height: 44rpx;
  border-radius: 14rpx;
  color: #ffffff;
  background: #4f46e5;
  font-size: 24rpx;
  font-weight: 700;
}

.garment-section-copy,
.garment-section-copy text,
.garment-preserve-row > view {
  min-width: 0;
}

.garment-title-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.garment-title,
.garment-field-title {
  display: block;
  color: #172033;
  font-size: 30rpx;
  line-height: 1.35;
  font-weight: 650;
}

.garment-field-title {
  font-size: 26rpx;
}

.garment-desc,
.garment-upload-desc,
.garment-mode-desc,
.garment-preserve-desc {
  display: block;
  margin-top: 6rpx;
  color: #687086;
  font-size: 22rpx;
  line-height: 1.5;
}

.garment-required {
  padding: 4rpx 10rpx;
  border-radius: 8rpx;
  color: #d83b46;
  background: #fff1f2;
  font-size: 20rpx;
}

.garment-optional {
  padding: 4rpx 10rpx;
  border-radius: 8rpx;
  color: #687086;
  background: #f0f2f6;
  font-size: 20rpx;
}

.garment-upload {
  min-height: 210rpx;
  padding: 24rpx;
  border: 2rpx dashed #bac2d6;
  border-radius: 20rpx;
  background: #f8f9fc;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

.garment-upload.large {
  min-height: 260rpx;
}

.garment-upload.compact { min-height: 190rpx; }

.garment-upload.uploading {
  opacity: 0.68;
  pointer-events: none;
}

.garment-upload-icon {
  color: #4f46e5;
  font-size: 54rpx;
  line-height: 1;
  font-weight: 300;
}

.garment-upload-icon.small {
  font-size: 42rpx;
}

.garment-upload-title {
  margin-top: 14rpx;
  color: #273047;
  font-size: 25rpx;
  line-height: 1.4;
  font-weight: 600;
  text-align: center;
}

.garment-preview-card {
  overflow: hidden;
  border: 1rpx solid #e0e4ee;
  border-radius: 20rpx;
  background: #f8f9fc;
}

.garment-preview-card.large .garment-preview {
  height: 460rpx;
}

.garment-preview-card.compact .garment-preview { height: 230rpx; }

.garment-preview {
  display: block;
  width: 100%;
  height: 300rpx;
  background: #eef1f6;
}

.garment-preview-actions {
  display: flex;
  justify-content: flex-end;
  gap: 30rpx;
  padding: 18rpx 22rpx;
  color: #4f46e5;
  font-size: 23rpx;
}

.garment-preview-actions .danger,
.garment-error,
.garment-submit-error {
  color: #d83b46;
}

.garment-error {
  display: block;
  margin-top: 10rpx;
  font-size: 22rpx;
}

.garment-mode-grid,
.garment-reference-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
}

.garment-mode-card {
  position: relative;
  min-height: 152rpx;
  padding: 22rpx;
  border: 2rpx solid #e3e6ef;
  border-radius: 18rpx;
  background: #fbfcfe;
  box-sizing: border-box;
}

.garment-mode-card.active {
  border-color: #4f46e5;
  background: #f1f0ff;
}

.garment-mode-check {
  position: absolute;
  top: 14rpx;
  right: 16rpx;
  color: #4f46e5;
  font-size: 24rpx;
  font-weight: 700;
}

.garment-mode-title {
  display: block;
  padding-right: 26rpx;
  color: #20283a;
  font-size: 25rpx;
  font-weight: 650;
}

.garment-reference-field.full {
  grid-column: 1 / -1;
}

.garment-reference-field .garment-title-row {
  margin-bottom: 14rpx;
}

.garment-reference-grid { margin-top: 24rpx; }

.garment-source-tabs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8rpx;
  margin-bottom: 20rpx;
  padding: 6rpx;
  border-radius: 16rpx;
  background: #eef1f6;
}

.garment-source-tab {
  min-height: 76rpx;
  border-radius: 12rpx;
  color: #5f687d;
  font-size: 24rpx;
  line-height: 76rpx;
  text-align: center;
}

.garment-source-tab.active { color: #3730a3; background: #fff; font-weight: 700; box-shadow: 0 3rpx 10rpx rgba(15, 23, 42, 0.06); }

.garment-profile-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14rpx; }
.garment-profile-card { overflow: hidden; border: 2rpx solid #e1e5ef; border-radius: 16rpx; background: #fff; }
.garment-profile-card.active { border-color: #4f46e5; }
.garment-profile-cover { display: block; width: 100%; height: 190rpx; background: #eef1f6; }
.garment-profile-footer { display: flex; justify-content: space-between; gap: 8rpx; padding: 12rpx; color: #273047; font-size: 22rpx; }
.garment-manage-button { height: 78rpx; margin: 18rpx 0 0; border: 1rpx solid #d9deea; border-radius: 14rpx; color: #4338ca; background: #fff; font-size: 23rpx; line-height: 78rpx; }
.garment-manage-button::after { border: 0; }
.garment-empty-hint { display: block; padding: 44rpx 20rpx; border-radius: 16rpx; color: #687086; background: #f8f9fc; font-size: 23rpx; line-height: 1.5; text-align: center; }

.garment-accessory-types {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12rpx;
  margin-bottom: 18rpx;
}

.garment-accessory-type {
  min-height: 72rpx;
  padding: 16rpx 10rpx;
  border: 2rpx solid #e2e6ef;
  border-radius: 16rpx;
  color: #3c455b;
  background: #f8f9fc;
  font-size: 23rpx;
  line-height: 38rpx;
  text-align: center;
  box-sizing: border-box;
}

.garment-accessory-type.active {
  border-color: #4f46e5;
  color: #4338ca;
  background: #f1f0ff;
  font-weight: 600;
}

.garment-accessory-type.disabled { opacity: 0.5; }

.garment-accessory-field { margin-top: 18rpx; padding: 18rpx; border: 1rpx solid #e4e7ef; border-radius: 18rpx; background: #fbfcfe; }
.garment-accessory-field > .garment-title-row { margin-bottom: 14rpx; }

.garment-accessory-limit {
  padding: 20rpx;
  border-radius: 16rpx;
  color: #865b16;
  background: #fff8e8;
  font-size: 22rpx;
  line-height: 1.55;
}

.garment-accessory-upload {
  min-height: 230rpx;
}

.garment-accessory-selected {
  display: grid;
  grid-template-columns: 210rpx minmax(0, 1fr);
  gap: 20rpx;
  padding: 16rpx;
  border: 2rpx solid #d8d5ff;
  border-radius: 20rpx;
  background: #fafaff;
}

.garment-accessory-preview {
  width: 210rpx;
  height: 210rpx;
  border-radius: 14rpx;
  background: #eef1f6;
}

.garment-accessory-selected-copy {
  min-width: 0;
  align-self: center;
}

.garment-accessory-selected-copy .garment-preview-actions {
  justify-content: flex-start;
  padding: 20rpx 0 0;
}

.garment-accessory-library {
  margin-top: 24rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid #edf0f5;
}

.garment-accessory-library-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 18rpx;
  margin-bottom: 14rpx;
}

.garment-accessory-library-head .garment-desc {
  margin-top: 0;
}

.garment-accessory-scroll {
  width: 100%;
  white-space: nowrap;
}

.garment-accessory-list {
  display: inline-flex;
  gap: 14rpx;
  padding-bottom: 4rpx;
}

.garment-accessory-card {
  position: relative;
  width: 190rpx;
  overflow: hidden;
  border: 2rpx solid #e2e6ef;
  border-radius: 16rpx;
  background: #ffffff;
  box-sizing: border-box;
}

.garment-accessory-card.active {
  border-color: #4f46e5;
}

.garment-accessory-card-image {
  display: block;
  width: 100%;
  height: 150rpx;
  background: #eef1f6;
}

.garment-accessory-card-name,
.garment-accessory-card-delete {
  display: block;
  padding: 10rpx 12rpx 0;
  overflow: hidden;
  color: #273047;
  font-size: 22rpx;
  text-overflow: ellipsis;
}

.garment-accessory-card-delete {
  padding-top: 6rpx;
  padding-bottom: 12rpx;
  color: #9b3f48;
  font-size: 20rpx;
}

.garment-preserve-list {
  border-top: 1rpx solid #edf0f5;
}

.garment-preserve-summary { display: grid; gap: 12rpx; margin-top: 24rpx; padding: 20rpx; border-radius: 16rpx; background: #f3f7ff; }
.garment-preserve-summary-item { display: flex; align-items: center; gap: 14rpx; color: #334155; font-size: 23rpx; }
.garment-preserve-summary-item .garment-check { flex-basis: 34rpx; width: 34rpx; height: 34rpx; border-radius: 9rpx; font-size: 20rpx; line-height: 30rpx; }
.garment-advanced-toggle { display: flex; justify-content: space-between; padding: 22rpx 4rpx 8rpx; color: #4f46e5; font-size: 23rpx; }

.garment-confirm-list { overflow: hidden; border: 1rpx solid #e5e8f0; border-radius: 18rpx; }
.garment-confirm-row { display: grid; grid-template-columns: 150rpx minmax(0, 1fr) auto; gap: 14rpx; align-items: center; min-height: 88rpx; padding: 16rpx 20rpx; border-bottom: 1rpx solid #edf0f5; color: #273047; font-size: 23rpx; box-sizing: border-box; }
.garment-confirm-row:last-child { border-bottom: 0; }
.garment-confirm-row > text:nth-child(2) { color: #687086; text-align: right; }
.garment-edit { color: #4f46e5 !important; }

.garment-wizard-bar { position: fixed; right: 0; bottom: 0; left: 0; z-index: 80; padding: 12rpx 24rpx calc(14rpx + env(safe-area-inset-bottom)); border-top: 1rpx solid #e2e6ef; background: rgba(255,255,255,.97); box-shadow: 0 -8rpx 24rpx rgba(15,23,42,.06); }
.garment-wizard-reason { display: block; margin-bottom: 10rpx; color: #b45309; font-size: 21rpx; text-align: center; }
.garment-wizard-actions { display: flex; gap: 16rpx; max-width: 750rpx; margin: 0 auto; }
.garment-primary-button,
.garment-secondary-button { height: 92rpx; margin: 0; border-radius: 18rpx; font-size: 27rpx; font-weight: 700; line-height: 92rpx; }
.garment-primary-button { flex: 1; color: #fff; background: #4f46e5; }
.garment-primary-button[disabled] { color: #fff; background: #b8becb; }
.garment-secondary-button { flex: 0 0 210rpx; color: #3f4759; background: #eef1f6; }
.garment-primary-button::after,
.garment-secondary-button::after { border: 0; }

.garment-preserve-row {
  min-height: 96rpx;
  padding: 18rpx 0;
  border-bottom: 1rpx solid #edf0f5;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  box-sizing: border-box;
}

.garment-preserve-title {
  display: block;
  color: #273047;
  font-size: 25rpx;
  font-weight: 600;
}

.garment-check {
  flex: 0 0 42rpx;
  width: 42rpx;
  height: 42rpx;
  border: 2rpx solid #c9cfdd;
  border-radius: 12rpx;
  color: transparent;
  font-size: 25rpx;
  line-height: 38rpx;
  text-align: center;
}

.garment-check.active {
  border-color: #4f46e5;
  color: #ffffff;
  background: #4f46e5;
}

.garment-submit-error {
  margin: 18rpx 8rpx 0;
  font-size: 22rpx;
  line-height: 1.5;
}

.garment-page-safe {
  height: calc(210rpx + env(safe-area-inset-bottom));
}

@media screen and (max-width: 360px) {
  .garment-replace-page {
    padding-left: 18rpx;
    padding-right: 18rpx;
  }

  .garment-section {
    padding: 22rpx;
  }

  .garment-reference-grid {
    grid-template-columns: 1fr;
  }

  .garment-reference-field.full {
    grid-column: auto;
  }

  .garment-accessory-selected {
    grid-template-columns: 160rpx minmax(0, 1fr);
  }

  .garment-accessory-preview {
    width: 160rpx;
    height: 180rpx;
  }
}

.style-wizard-steps {
  position: sticky;
  top: 0;
  z-index: 20;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin: 0 24rpx 20rpx;
  padding: 16rpx 10rpx;
  border: 1rpx solid #e5e7eb;
  border-radius: 20rpx;
  background: rgba(255, 255, 255, 0.96);
}

.style-wizard-step {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: center;
  gap: 7rpx;
  color: #9ca3af;
}

.style-wizard-step-index {
  display: flex;
  width: 40rpx;
  height: 40rpx;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #f3f4f6;
  font-size: 22rpx;
  font-weight: 700;
}

.style-wizard-step-label {
  font-size: 20rpx;
  white-space: nowrap;
}

.style-wizard-step.active { color: #315be8; }
.style-wizard-step.active .style-wizard-step-index { color: #fff; background: #315be8; }
.style-wizard-step.completed { color: #315be8; }
.style-wizard-step.completed .style-wizard-step-index { color: #315be8; background: #eaf0ff; }

.style-change-summary {
  margin-top: 20rpx;
  padding: 20rpx;
  border-radius: 14rpx;
  color: #274690;
  background: #eef4ff;
  font-size: 24rpx;
  line-height: 1.55;
}

.style-change-summary.empty { color: #9a3412; background: #fff7ed; }

.style-target-grid,
.style-purpose-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx;
  margin-top: 20rpx;
}

.style-target-card,
.style-purpose-card {
  position: relative;
  display: flex;
  min-height: 78rpx;
  align-items: center;
  justify-content: center;
  border: 1rpx solid #dfe3eb;
  border-radius: 14rpx;
  color: #303744;
  background: #fff;
  font-size: 25rpx;
  font-weight: 600;
}

.style-target-card.active,
.style-purpose-card.active {
  border-color: #315be8;
  color: #315be8;
  background: #eef4ff;
}

.style-target-card .style-option-check {
  top: 8rpx;
  right: 10rpx;
}

.style-direction-group {
  margin-top: 28rpx;
  padding-top: 22rpx;
  border-top: 1rpx solid #eef0f4;
}

.style-preserve-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
}

.style-preserve-row {
  display: flex;
  min-height: 72rpx;
  align-items: center;
  gap: 12rpx;
  padding: 0 16rpx;
  border-radius: 13rpx;
  background: #f7f8fb;
  color: #374151;
  font-size: 23rpx;
}

.style-preserve-check {
  display: flex;
  width: 34rpx;
  height: 34rpx;
  flex: 0 0 34rpx;
  align-items: center;
  justify-content: center;
  border: 2rpx solid #cbd1dc;
  border-radius: 8rpx;
  color: #fff;
  font-size: 20rpx;
}

.style-preserve-check.active { border-color: #315be8; background: #315be8; }

.style-confirm-image-row {
  margin-top: 22rpx;
  overflow: hidden;
  border: 1rpx solid #e5e7eb;
  border-radius: 16rpx;
  background: #f8fafc;
}

.style-confirm-image {
  display: block;
  width: 100%;
  height: 300rpx;
}

.style-confirm-image-copy {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 20rpx;
  color: #374151;
  font-size: 24rpx;
}

.style-confirm-image-copy text:last-child,
.style-confirm-edit { color: #315be8; font-weight: 600; }

.style-confirm-row {
  display: grid;
  grid-template-columns: 150rpx minmax(0, 1fr) 64rpx;
  gap: 12rpx;
  align-items: start;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #eef0f4;
  color: #374151;
  font-size: 23rpx;
  line-height: 1.5;
}

.style-confirm-row > text:first-child { color: #6b7280; }

.style-count-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx 20rpx;
  margin-top: 18rpx;
  color: #4b5563;
  font-size: 22rpx;
}

.style-wizard-action-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 60;
  padding: 14rpx 24rpx calc(14rpx + env(safe-area-inset-bottom));
  border-top: 1rpx solid #e5e7eb;
  background: rgba(255, 255, 255, 0.97);
  box-shadow: 0 -8rpx 24rpx rgba(31, 41, 55, 0.06);
}

.style-wizard-action-bar.keyboard-visible { position: static; padding-bottom: 14rpx; }
.style-wizard-action-reason { display: block; margin-bottom: 10rpx; color: #a23c28; font-size: 22rpx; text-align: center; }
.style-wizard-action-buttons { display: flex; gap: 14rpx; }
.style-wizard-secondary-btn,
.style-wizard-primary-btn {
  height: 88rpx;
  line-height: 88rpx;
  margin: 0;
  border-radius: 14rpx;
  font-size: 27rpx;
  font-weight: 650;
}
.style-wizard-secondary-btn { width: 190rpx; color: #315be8; background: #eef4ff; }
.style-wizard-primary-btn { flex: 1; color: #fff; background: #315be8; }
.style-wizard-primary-btn.full { width: 100%; }
.style-wizard-primary-btn[disabled] { color: #fff; background: #aebbe9; opacity: 1; }
.style-page .bottom-safe { height: calc(180rpx + env(safe-area-inset-bottom)); }
</style>
