<template>
  <view class="workspace-app">
    <view class="mobile-head">
      <button class="icon-btn" @click="sidebarOpen = true">菜单</button>
      <view>
        <text class="mobile-title">{{ currentMenu.label }}</text>
        <text class="mobile-sub">{{ selectedIdentityLabel }}</text>
      </view>
      <button class="primary-pill" @click="openQuickPanel">快速创建</button>
    </view>

    <view v-if="sidebarOpen" class="mobile-mask" @click="sidebarOpen = false"></view>

    <view class="workspace-shell" :class="{ collapsed: sidebarCollapsed }">
      <aside class="workspace-sidebar" :class="{ open: sidebarOpen }">
        <view class="brand-row">
          <view class="brand-mark">D</view>
          <view v-if="!sidebarCollapsed">
            <text class="brand-title">蝶变工作台</text>
            <text class="brand-sub">Fashion AI Workspace</text>
          </view>
        </view>

        <button class="collapse-btn" @click="toggleSidebar">{{ sidebarCollapsed ? '展开' : '收起' }}</button>

        <view class="nav-list">
          <view
            v-for="item in workspaceMenus"
            :key="item.module"
            class="nav-group"
            :class="{ active: currentModule === item.module }"
          >
            <view class="nav-item" @click="selectModule(item.module)">
              <text class="nav-icon">{{ item.icon }}</text>
              <text v-if="!sidebarCollapsed" class="nav-label">{{ item.label }}</text>
            </view>
            <view v-if="!sidebarCollapsed && item.children && currentModule === item.module" class="sub-nav">
              <text
                v-for="child in item.children"
                :key="child.type"
                :class="{ current: currentType === child.type }"
                @click="openFeature(child)"
              >
                {{ child.label }}
              </text>
            </view>
          </view>
        </view>
      </aside>

      <view class="workspace-main">
        <header class="topbar">
          <view class="breadcrumb-wrap">
            <text class="breadcrumb">工作台 / {{ currentMenu.label }}{{ currentFeature ? ' / ' + currentFeature.label : '' }}</text>
            <text class="page-title">{{ currentTitle }}</text>
          </view>

          <view class="topbar-tools">
            <view class="search-box" @click="openSearchPanel">
              <text>{{ searchKeyword || '搜索功能、项目、任务、作品、版型和成员' }}</text>
              <text class="kbd">Ctrl K</text>
            </view>
            <button class="primary-pill" @click="openQuickPanel">快速创建</button>
            <button class="ghost-pill" @click="openHelpDrawer()">页面帮助</button>
            <view class="notice-pill" @click="openNotificationPanel">
              <text>通知</text>
              <strong>{{ unreadNotificationCount }}</strong>
            </view>
            <view class="quota-pill">
              <text>剩余额度</text>
              <strong>{{ quotaBalance }}</strong>
            </view>
            <view class="user-menu" @click="goEnterpriseLogin">
              <text>{{ userLabel }}</text>
              <text>企业账号</text>
            </view>
          </view>
        </header>

        <view v-if="!identitySelected" class="identity-card">
          <view>
            <text class="section-kicker">首次进入工作台</text>
            <text class="section-title">请选择你的主要身份</text>
            <text class="section-desc">快捷入口会按身份调整，但项目、账号、任务、作品和版型数据仍共用同一套体系。</text>
          </view>
          <view class="identity-grid">
            <view v-for="item in identities" :key="item.value" class="identity-option" @click="selectIdentity(item)">
              <text>{{ item.label }}</text>
              <text>{{ item.desc }}</text>
            </view>
          </view>
        </view>

        <template v-else>
          <view v-if="currentModule === 'overview'" class="module-section">
            <view class="home-hero">
              <view>
                <text class="section-kicker">{{ selectedIdentityLabel }}工作区</text>
                <text class="hero-title">登录后直接进入专业生产入口</text>
                <text class="hero-desc">AI 出图、AI 制版、版型库和项目中心分区清楚；常用功能可通过左侧导航、全局搜索或快速创建进入。</text>
              </view>
              <view class="hero-actions">
                <button class="solid-action" @click="selectModule('ai-output')">新建 AI 出图任务</button>
                <button class="outline-action" @click="startPatternCreate('recognition')">新建 AI 制版任务</button>
              </view>
            </view>

            <view class="quick-grid">
              <view v-for="item in roleHomeActions" :key="item.label" class="quick-card" @click="handleHomeAction(item)">
                <text class="quick-icon">{{ item.icon }}</text>
                <text class="quick-title">{{ item.label }}</text>
                <text class="quick-desc">{{ item.desc }}</text>
                <button :class="item.primary ? 'solid-small' : 'outline-small'">{{ item.action }}</button>
              </view>
            </view>

            <view v-if="onboardingVisible" class="panel onboarding-card">
              <view class="panel-head">
                <view>
                  <text class="panel-title">首次使用引导</text>
                  <text class="section-desc">{{ onboardingProgressText }}</text>
                </view>
                <button class="text-btn" @click="skipCurrentOnboarding">跳过引导</button>
              </view>
              <view class="onboarding-list">
                <view
                  v-for="item in onboardingTasks"
                  :key="item.taskId"
                  class="onboarding-row"
                  :class="{ done: item.completed }"
                >
                  <view class="check-dot">{{ item.completed ? '✓' : '' }}</view>
                  <view>
                    <text class="row-title">{{ item.title }}</text>
                    <text class="row-meta">{{ item.desc }}</text>
                  </view>
                  <button v-if="!item.completed" class="outline-small" @click="handleOnboardingTask(item)">{{ item.action }}</button>
                  <button v-else class="text-btn" @click="handleOnboardingTask(item)">查看</button>
                </view>
              </view>
            </view>

            <view class="dashboard-grid">
              <view class="panel wide">
                <view class="panel-head">
                  <text class="panel-title">进行中的任务</text>
                  <button class="text-btn" @click="selectModule('batch')">查看全部</button>
                </view>
                <view v-if="runningTasks.length" class="task-list">
                  <view v-for="item in runningTasks" :key="item.taskId" class="task-row">
                    <view>
                      <text class="row-title">{{ getTaskName(item) }}</text>
                      <text class="row-meta">{{ getTaskTypeLabel(item.type) }} · {{ formatDate(item.createdAt) }}</text>
                    </view>
                    <view class="progress-wrap">
                      <view class="progress-track"><view class="progress-fill" :style="{ width: getTaskProgress(item) + '%' }"></view></view>
                      <text>{{ getTaskProgress(item) }}%</text>
                    </view>
                    <text class="status-tag">{{ getStatusLabel(item.status) }}</text>
                    <button class="outline-small" @click="continueTask(item)">继续处理</button>
                  </view>
                </view>
                <view v-else class="empty-state">
                  <text>暂无进行中的任务</text>
                  <button class="solid-small" @click="selectModule('ai-output')">创建第一个任务</button>
                </view>
              </view>

              <view class="panel">
                <view class="panel-head"><text class="panel-title">待处理事项</text></view>
                <view class="todo-list">
                  <view v-for="item in pendingItems" :key="item.label" class="todo-row" @click="selectModule(item.module)">
                    <text>{{ item.label }}</text>
                    <strong>{{ item.count }}</strong>
                  </view>
                </view>
              </view>

              <view class="panel">
                <view class="panel-head">
                  <text class="panel-title">最近项目</text>
                  <button class="text-btn" @click="selectModule('projects')">进入项目中心</button>
                </view>
                <view v-if="recentProjects.length" class="project-list">
                  <view v-for="item in recentProjects" :key="item.projectId || item.id" class="project-row" @click="openProject(item)">
                    <view class="project-cover">{{ getProjectInitial(item) }}</view>
                    <view>
                      <text class="row-title">{{ item.projectName || item.name || '未命名项目' }}</text>
                      <text class="row-meta">负责人：{{ item.ownerName || item.owner || '未设置' }} · {{ getProjectTaskCount(item) }} 个任务</text>
                    </view>
                    <text class="row-date">{{ formatDate(item.updatedAt || item.createdAt) }}</text>
                  </view>
                </view>
                <view v-else class="empty-state">
                  <text>暂无项目数据</text>
                  <button class="outline-small" @click="goEnterpriseLogin">进入企业项目</button>
                </view>
              </view>

              <view class="panel">
                <view class="panel-head"><text class="panel-title">最近使用</text></view>
                <view v-if="recentUsed.length" class="recent-grid">
                  <view v-for="item in recentUsed" :key="item.key" @click="handleRecentUsed(item)">
                    <text>{{ item.label }}</text>
                    <text>{{ item.type }}</text>
                  </view>
                </view>
                <view v-else class="empty-state">
                  <text>暂无最近使用记录</text>
                  <button class="outline-small" @click="openSearchPanel">搜索功能</button>
                </view>
              </view>
            </view>
          </view>

          <view v-else-if="currentModule === 'ai-output'" class="module-section">
            <view v-if="!createMode" class="ai-output-center">
              <view class="module-intro">
                <view>
                  <text class="section-kicker">AI 出图功能中心</text>
                  <text class="section-title">按业务用途选择出图能力</text>
                  <text class="section-desc">已完成能力进入统一创建流程；未完成能力标记“规划中”并禁用，避免制作假入口。</text>
                </view>
                <button class="solid-action" @click="openCreateFlow(defaultAvailableFeature)">新建出图任务</button>
              </view>

              <view class="ai-output-toolbar">
                <view class="inline-search">
                  <input v-model.trim="aiOutputKeyword" placeholder="搜索功能，例如：换衣服、跨境白底图" @input="persistAiOutputFilters" />
                </view>
                <picker :range="purposeFilterLabels" :value="purposeFilterIndex" @change="onPurposeFilterChange">
                  <view class="filter-pill">用途：{{ selectedPurposeLabel }}</view>
                </picker>
                <picker :range="materialFilterLabels" :value="materialFilterIndex" @change="onMaterialFilterChange">
                  <view class="filter-pill">素材：{{ selectedMaterialLabel }}</view>
                </picker>
              </view>

              <view class="saved-row">
                <view>
                  <text class="panel-title">最近使用</text>
                  <view v-if="recentAiOutputFeatures.length" class="saved-list">
                    <text v-for="item in recentAiOutputFeatures" :key="item.type" @click="openFeature(item)">{{ item.label }}</text>
                  </view>
                  <text v-else class="saved-empty">暂无最近使用记录</text>
                </view>
                <view>
                  <text class="panel-title">我的收藏</text>
                  <view v-if="favoriteAiOutputFeatures.length" class="saved-list">
                    <text v-for="item in favoriteAiOutputFeatures" :key="item.type" @click="openFeature(item)">{{ item.label }}</text>
                  </view>
                  <text v-else class="saved-empty">收藏常用功能后会同步到工作台首页</text>
                </view>
              </view>

              <view v-for="group in filteredAiOutputGroups" :key="group.title" class="feature-group">
                <view class="group-head">
                  <view>
                    <text class="panel-title">{{ group.title }}</text>
                    <text>{{ group.desc }}</text>
                  </view>
                  <text class="group-count">{{ group.items.length }} 个功能</text>
                </view>
                <view class="feature-grid">
                  <view
                    v-for="item in group.items"
                    :key="item.type"
                    class="feature-card"
                    :class="{ active: currentType === item.type, disabled: item.planned }"
                    @click="openFeature(item)"
                  >
                    <view class="feature-top">
                      <view class="feature-name">
                        <text class="feature-icon">{{ item.icon }}</text>
                        <text class="feature-title">{{ item.label }}</text>
                      </view>
                      <text v-if="item.planned" class="planned-badge">规划中</text>
                    </view>
                    <text class="feature-desc">{{ item.desc }}</text>
                    <view class="feature-detail">
                      <text>需要上传：{{ item.material }}</text>
                      <text>输出内容：{{ item.output }}</text>
                      <text>批量支持：{{ item.batch ? '支持' : '暂不支持' }}</text>
                    </view>
                    <view class="feature-actions">
                      <button class="outline-small" @click.stop="toggleFavoriteFeature(item)">
                        {{ isFavoriteFeature(item.type) ? '已收藏' : '收藏' }}
                      </button>
                      <button
                        :class="item.planned ? 'disabled-small' : 'solid-small'"
                        :disabled="item.planned"
                        @click.stop="openCreateFlow(item)"
                      >
                        {{ item.planned ? '规划中' : '立即创建' }}
                      </button>
                    </view>
                  </view>
                </view>
              </view>
            </view>

            <view v-else class="create-flow">
              <view class="module-intro">
                <view>
                  <text class="section-kicker">统一创建流程</text>
                  <text class="section-title">{{ createFeature.label }}</text>
                  <text class="section-desc">只展示当前功能需要的素材和参数。确认后进入现有上传/任务链路，不重复开发生成能力。</text>
                </view>
                <button class="outline-action" @click="exitCreateFlow">返回功能中心</button>
              </view>
              <view class="create-steps">
                <view v-for="step in createSteps" :key="step.key" :class="{ active: createStep === step.key }" @click="createStep = step.key">
                  <text>{{ step.index }}</text>
                  <text>{{ step.label }}</text>
                </view>
              </view>
              <view class="create-panel">
                <view v-if="createStep === 'feature'">
                  <text class="panel-title">1. 选择功能</text>
                  <text class="section-desc">{{ createFeature.desc }}</text>
                  <view class="summary-grid">
                    <view><text>需要素材</text><strong>{{ createFeature.material }}</strong></view>
                    <view><text>输出内容</text><strong>{{ createFeature.output }}</strong></view>
                    <view><text>批量支持</text><strong>{{ createFeature.batch ? '支持' : '暂不支持' }}</strong></view>
                  </view>
                </view>
                <view v-else-if="createStep === 'upload'">
                  <text class="panel-title">2. 上传素材</text>
                  <text class="section-desc">当前功能需要上传：{{ createFeature.material }}。点击确认生成时会进入现有上传页面完成素材选择。</text>
                  <view class="upload-placeholder">素材将在上传页选择，避免在工作台重复开发上传链路。</view>
                </view>
                <view v-else-if="createStep === 'params'">
                  <text class="panel-title">3. 设置生成参数</text>
                  <view class="param-grid">
                    <view v-for="param in createFeature.params" :key="param.key">
                      <text>{{ param.label }}</text>
                      <text>{{ param.value }}</text>
                    </view>
                  </view>
                </view>
                <view v-else-if="createStep === 'summary'">
                  <text class="panel-title">4. 预览任务摘要</text>
                  <view class="task-summary">
                    <text>功能：{{ createFeature.label }}</text>
                    <text>素材：{{ createFeature.material }}</text>
                    <text>产出：{{ createFeature.output }}</text>
                    <text>批量：{{ createFeature.batch ? '支持' : '暂不支持' }}</text>
                  </view>
                </view>
                <view v-else>
                  <text class="panel-title">5. 确认额度并生成</text>
                  <text class="section-desc">额度校验和任务创建继续复用现有上传/任务链路。本页不直接调用 provider，也不绕过审核。</text>
                  <button class="solid-action" @click="confirmCreateFeature">确认并进入上传</button>
                </view>
                <view class="create-nav">
                  <button class="outline-small" :disabled="createStepIndex === 0" @click="prevCreateStep">上一步</button>
                  <button v-if="createStepIndex < createSteps.length - 1" class="solid-small" @click="nextCreateStep">下一步</button>
                  <button v-else class="solid-small" @click="confirmCreateFeature">确认生成</button>
                </view>
              </view>
            </view>
          </view>

          <view v-else-if="currentModule === 'pattern-making'" class="module-section pattern-center">
            <view class="pattern-safety">
              <strong>专业安全提示</strong>
              <text>{{ patternSafetyText }}</text>
            </view>

            <view v-if="patternCreateMode" class="pattern-create">
              <view class="module-intro pattern-intro">
                <view>
                  <text class="section-kicker">新建 AI 制版任务</text>
                  <text class="section-title">{{ currentPatternCreateStep.label }}</text>
                  <text class="section-desc">采用分步页面收集制版信息，避免把全部设置堆在同一个长表单。</text>
                </view>
                <button class="outline-action" @click="exitPatternCreate">返回制版中心</button>
              </view>

              <view class="pattern-stepper">
                <view
                  v-for="step in patternCreateSteps"
                  :key="step.key"
                  :class="{ active: patternCreateStep === step.key, done: step.index < currentPatternCreateStep.index }"
                  @click="patternCreateStep = step.key"
                >
                  <text>{{ step.index }}</text>
                  <text>{{ step.label }}</text>
                </view>
              </view>

              <view class="pattern-work-panel">
                <view v-if="patternCreateStep === 'category'" class="pattern-step-panel">
                  <text class="panel-title">选择服装品类</text>
                  <text class="section-desc">先确定品类，后续识别字段和版型方向会围绕该品类组织。</text>
                  <view class="choice-grid">
                    <view v-for="item in patternCategories" :key="item" :class="{ active: patternForm.category === item }" @click="patternForm.category = item">{{ item }}</view>
                  </view>
                </view>

                <view v-else-if="patternCreateStep === 'images'" class="pattern-step-panel">
                  <text class="panel-title">上传参考图片</text>
                  <text class="section-desc">正面图为必需项；背面、侧面和细节图可提升结构识别完整度。本阶段只记录素材要求，不调用生成接口。</text>
                  <view class="upload-check-grid">
                    <label v-for="item in patternImageRequirements" :key="item.key">
                      <checkbox :checked="patternForm.images[item.key]" @click="togglePatternImage(item.key)" />
                      <view>
                        <text>{{ item.label }}</text>
                        <text>{{ item.required ? '必需' : '可选' }}</text>
                      </view>
                    </label>
                  </view>
                </view>

                <view v-else-if="patternCreateStep === 'sizes'" class="pattern-step-panel">
                  <text class="panel-title">填写基础尺寸</text>
                  <text class="section-desc">记录胸围、肩宽、衣长、袖长等基础尺寸。尺寸仍需版师最终确认。</text>
                  <view class="size-grid">
                    <view v-for="item in patternSizeFields" :key="item.key">
                      <text>{{ item.label }}</text>
                      <input v-model.trim="patternForm.sizeParams[item.key]" :placeholder="item.placeholder" />
                    </view>
                  </view>
                </view>

                <view v-else-if="patternCreateStep === 'direction'" class="pattern-step-panel">
                  <text class="panel-title">选择结构与版型方向</text>
                  <view class="direction-grid">
                    <view>
                      <text class="panel-sub">结构方向</text>
                      <view class="choice-grid compact">
                        <view v-for="item in structureDirections" :key="item" :class="{ active: patternForm.structureDirection === item }" @click="patternForm.structureDirection = item">{{ item }}</view>
                      </view>
                    </view>
                    <view>
                      <text class="panel-sub">版型方向</text>
                      <view class="choice-grid compact">
                        <view v-for="item in patternDirections" :key="item" :class="{ active: patternForm.patternDirection === item }" @click="patternForm.patternDirection = item">{{ item }}</view>
                      </view>
                    </view>
                  </view>
                </view>

                <view v-else-if="patternCreateStep === 'reference'" class="pattern-step-panel">
                  <text class="panel-title">选择参考版型</text>
                  <text class="section-desc">可从系统、个人或企业版型中选择参考。企业版型只读取当前企业本地记录。</text>
                  <view class="pattern-reference-list">
                    <view :class="{ active: !patternForm.referencePatternId }" @click="patternForm.referencePatternId = ''">
                      <text>不使用参考版型</text>
                      <text>由服装图推导参考版型</text>
                    </view>
                    <view
                      v-for="item in patternDashboard.masters"
                      :key="item.patternMasterId"
                      :class="{ active: patternForm.referencePatternId === item.patternMasterId }"
                      @click="patternForm.referencePatternId = item.patternMasterId"
                    >
                      <text>{{ item.title }}</text>
                      <text>{{ item.scope }} · {{ item.productionStatus }}</text>
                    </view>
                  </view>
                </view>

                <view v-else-if="patternCreateStep === 'summary'" class="pattern-step-panel">
                  <text class="panel-title">确认生成摘要</text>
                  <view class="task-summary">
                    <text>品类：{{ patternForm.category || '未选择' }}</text>
                    <text>图片：{{ selectedPatternImageLabels }}</text>
                    <text>结构方向：{{ patternForm.structureDirection || '未选择' }}</text>
                    <text>版型方向：{{ patternForm.patternDirection || '未选择' }}</text>
                    <text>参考版型：{{ selectedReferencePatternTitle }}</text>
                  </view>
                </view>

                <view v-else class="pattern-step-panel">
                  <text class="panel-title">生成 AI 制版草稿</text>
                  <text class="section-desc">{{ patternSafetyText }}</text>
                  <button class="solid-action" @click="submitPatternTaskDraft">生成 AI 制版草稿</button>
                </view>

                <view class="create-nav">
                  <button class="outline-small" :disabled="patternCreateStepIndex === 0" @click="prevPatternCreateStep">上一步</button>
                  <button v-if="patternCreateStepIndex < patternCreateSteps.length - 1" class="solid-small" @click="nextPatternCreateStep">下一步</button>
                  <button v-else class="solid-small" @click="submitPatternTaskDraft">生成草稿</button>
                </view>
              </view>
            </view>

            <view v-else-if="selectedPatternTask" class="pattern-detail">
              <view class="module-intro pattern-intro">
                <view>
                  <text class="section-kicker">制版任务详情</text>
                  <text class="section-title">{{ selectedPatternTask.title }}</text>
                  <text class="section-desc">当前版本：{{ selectedPatternVersion.versionNo || 'V1' }} · 审核状态：{{ getPatternReviewLabel(selectedPatternVersion.reviewStatus) }}</text>
                </view>
                <view class="detail-actions">
                  <button class="outline-action" @click="closePatternTaskDetail">返回中心</button>
                  <button class="solid-action" @click="createPatternRevision">创建新版本</button>
                </view>
              </view>

              <view class="detail-tabs">
                <text
                  v-for="tab in patternDetailTabs"
                  :key="tab.key"
                  :class="{ active: patternDetailTab === tab.key }"
                  @click="setPatternDetailTab(tab.key)"
                >
                  {{ tab.label }}
                </text>
              </view>

              <view class="pattern-work-panel">
                <view v-if="patternDetailTab === 'overview'" class="detail-grid">
                  <view class="panel stat-panel">
                    <text class="stat-label">任务状态</text>
                    <text class="stat-value small">{{ getPatternStatusLabel(selectedPatternTask.status) }}</text>
                    <text class="stat-desc">未通过专业审核前不能标记生产可用。</text>
                  </view>
                  <view class="panel stat-panel">
                    <text class="stat-label">生产可用</text>
                    <text class="stat-value small">{{ selectedPatternVersion.productionAvailable ? '审核参考可用' : '不可生产' }}</text>
                    <text class="stat-desc">投入生产前仍需版师确认尺寸。</text>
                  </view>
                  <view class="panel stat-panel">
                    <text class="stat-label">训练候选</text>
                    <text class="stat-value small">{{ selectedPatternVersion.trainingCandidate ? '已进入候选' : '未进入' }}</text>
                    <text class="stat-desc">仅授权且审核通过的数据可进入候选集。</text>
                  </view>
                </view>

                <view v-else-if="patternDetailTab === 'technical'" class="compare-panel">
                  <view>
                    <text class="panel-title">AI 原稿</text>
                    <view class="technical-preview">正面技术图 / 背面技术图 / 局部结构图</view>
                    <text class="section-desc">识别字段：{{ getRecognizedParts(selectedPatternVersion).join('、') }}</text>
                  </view>
                  <view>
                    <text class="panel-title">版师修订</text>
                    <view class="technical-preview revised">修订稿待补充</view>
                    <text class="section-desc">创建新版本后记录人工修订稿与差异数据。</text>
                  </view>
                </view>

                <view v-else-if="patternDetailTab === 'pattern'" class="pattern-step-panel">
                  <text class="panel-title">版型结构</text>
                  <view class="task-summary">
                    <text>品类：{{ selectedPatternVersion.aiDraft.category || selectedPatternTask.category }}</text>
                    <text>结构方向：{{ selectedPatternVersion.aiDraft.structureDirection || '未记录' }}</text>
                    <text>版型方向：{{ selectedPatternVersion.aiDraft.patternDirection || '未记录' }}</text>
                    <text>参考版型：{{ selectedPatternVersion.aiDraft.referencePatternId || '未使用' }}</text>
                  </view>
                </view>

                <view v-else-if="patternDetailTab === 'sizes'" class="pattern-step-panel">
                  <text class="panel-title">尺寸参数</text>
                  <view class="summary-grid">
                    <view v-for="item in patternSizeFields" :key="item.key">
                      <text>{{ item.label }}</text>
                      <strong>{{ selectedPatternVersion.sizeParams[item.key] || '待确认' }}</strong>
                    </view>
                  </view>
                </view>

                <view v-else-if="patternDetailTab === 'craft'" class="pattern-step-panel">
                  <text class="panel-title">工艺说明</text>
                  <text class="section-desc">{{ selectedPatternVersion.craftNote || '暂无工艺说明草稿' }}</text>
                </view>

                <view v-else-if="patternDetailTab === 'review'" class="pattern-step-panel">
                  <text class="panel-title">审核记录</text>
                  <view class="review-actions">
                    <button class="outline-small" @click="submitPatternReview">提交审核</button>
                    <button class="solid-small" @click="approvePatternVersion">审核通过</button>
                    <button class="outline-small danger" @click="rejectPatternVersion">退回修改</button>
                  </view>
                  <text class="section-desc">审核通过前，版本不会进入生产可用状态；退回后可继续创建新版本。</text>
                </view>

                <view v-else class="pattern-step-panel">
                  <text class="panel-title">版本历史</text>
                  <view class="version-list">
                    <view v-for="item in selectedPatternVersions" :key="item.versionId">
                      <text>{{ item.versionNo }} · {{ getPatternReviewLabel(item.reviewStatus) }}</text>
                      <text>{{ formatDate(item.updatedAt) }} · {{ item.productionAvailable ? '审核参考可用' : '不可生产' }}</text>
                    </view>
                  </view>
                </view>

                <view class="detail-footer-actions">
                  <button class="outline-small" @click="savePatternDraft">保存草稿</button>
                  <button class="outline-small" @click="createPatternRevision">创建新版本</button>
                  <button class="outline-small" @click="submitPatternReview">提交审核</button>
                  <button class="solid-small" @click="addPatternToLibrary">加入版型库</button>
                </view>
              </view>
            </view>

            <view v-else class="pattern-overview">
              <view class="module-intro pattern-intro">
                <view>
                  <text class="section-kicker">AI 制版中心</text>
                  <text class="section-title">结构识别、技术图、版型推导、审核与版型资产闭环</text>
                  <text class="section-desc">与普通 AI 出图分开管理。制版中心只处理专业参考稿、版本、审核和版型库沉淀。</text>
                </view>
                <button class="solid-action" @click="startPatternCreate('recognition')">新建制版任务</button>
              </view>

              <view class="pattern-toolbar">
                <view class="inline-search">
                  <input v-model.trim="patternSearchKeyword" placeholder="搜索任务、版型、品类或审核状态" />
                </view>
                <button class="outline-small" @click="currentType = 'review'">待审核 {{ patternDashboard.pendingReviewCount }}</button>
                <button class="outline-small" @click="currentType = 'library'">最近使用</button>
                <button class="outline-small" @click="currentType = 'training'">模型版本状态：参考模式</button>
              </view>

              <view class="pattern-grid">
                <view v-for="item in patternSections" :key="item.type" class="pattern-card" :class="{ active: currentType === item.type }" @click="openPatternAction(item)">
                  <view class="feature-top">
                    <text class="feature-title">{{ item.label }}</text>
                    <text v-if="item.planned" class="planned-badge">规划中</text>
                  </view>
                  <text class="feature-desc">{{ item.desc }}</text>
                  <view class="feature-detail">
                    <text v-for="point in item.points" :key="point">{{ point }}</text>
                  </view>
                  <button :class="item.planned ? 'outline-small' : 'solid-small'">{{ item.entry }}</button>
                </view>
              </view>

              <view class="dashboard-grid">
                <view class="panel wide">
                  <view class="panel-head">
                    <text class="panel-title">制版任务</text>
                    <button class="text-btn" @click="startPatternCreate('recognition')">新建任务</button>
                  </view>
                  <view v-if="filteredPatternTasks.length" class="task-list">
                    <view v-for="item in filteredPatternTasks" :key="item.taskId" class="task-row" @click="openPatternTask(item)">
                      <view>
                        <text class="row-title">{{ item.title }}</text>
                        <text class="row-meta">{{ item.category || '未分类' }} · {{ formatDate(item.updatedAt) }}</text>
                      </view>
                      <text class="status-tag">{{ getPatternReviewLabel(item.reviewStatus) }}</text>
                      <button class="outline-small" @click.stop="openPatternTask(item)">查看详情</button>
                    </view>
                  </view>
                  <view v-else class="empty-state">
                    <text>暂无制版任务</text>
                    <button class="solid-small" @click="startPatternCreate('recognition')">创建第一个制版任务</button>
                  </view>
                </view>

                <view class="panel">
                  <view class="panel-head"><text class="panel-title">版型库概览</text></view>
                  <view class="summary-grid single">
                    <view><text>企业版型</text><strong>{{ patternDashboard.masters.length }}</strong></view>
                    <view><text>审核通过</text><strong>{{ patternDashboard.approvedCount }}</strong></view>
                    <view><text>训练候选</text><strong>{{ patternDashboard.trainingCandidateCount }}</strong></view>
                  </view>
                </view>
              </view>
            </view>
          </view>

          <view v-else-if="currentModule === 'ai-training'" class="module-section training-center">
            <view class="module-intro">
              <view>
                <text class="section-kicker">AI 制版训练与评估中心</text>
                <text class="section-title">从 AI 初稿、版师修订到模型灰度的闭环</text>
                <text class="section-desc">仅网站专业后台开放。未审核、未授权、来源不明或企业禁止训练的数据不得进入训练集；模型密钥、训练地址和内部配置不会在前端展示。</text>
              </view>
              <button class="solid-action" @click="createTrainingDatasetDraft">创建数据集</button>
            </view>

            <view v-if="!patternTrainingCenter.canAccess" class="empty-state">
              <text>当前账号暂无 AI 制版训练与评估权限</text>
              <button class="outline-small" @click="selectModule('pattern-making')">返回 AI 制版</button>
            </view>
            <view v-else class="training-layout">
              <view class="pattern-safety">
                <strong>上线红线</strong>
                <text>新模型必须完成固定测试集评估、专业版师抽检、风险确认、管理员批准和小范围灰度，不能自动上线。</text>
              </view>
              <view class="library-tabs compact-tabs">
                <text v-for="tab in trainingTabs" :key="tab.key" :class="{ active: trainingTab === tab.key }" @click="setTrainingTab(tab.key)">{{ tab.label }}</text>
              </view>

              <view v-if="trainingTab === 'overview'" class="training-overview">
                <view class="module-grid">
                  <view v-for="item in trainingQualitySummary" :key="item.label" class="panel stat-panel">
                    <text class="stat-value">{{ item.value }}</text>
                    <text class="stat-label">{{ item.label }}</text>
                    <text class="stat-desc">{{ item.desc }}</text>
                  </view>
                </view>
                <view class="dashboard-grid">
                  <view class="panel wide">
                    <view class="panel-head">
                      <text class="panel-title">训练样本来源</text>
                      <button class="text-btn" @click="setTrainingTab('datasets')">管理数据集</button>
                    </view>
                    <view class="training-sample-list">
                      <view v-for="sample in filteredTrainingSamples.slice(0, 6)" :key="sample.sampleId" class="training-sample-card">
                        <view>
                          <text class="feature-title">{{ sample.title }}</text>
                          <text class="row-meta">{{ sample.category }} · {{ sample.authorizationStatus === 'authorized' ? '已授权' : '未授权' }}</text>
                          <text class="section-desc">AI 初稿与版师修订保留为不同字段，修订稿不会覆盖 AI 原稿。</text>
                        </view>
                        <text :class="sample.eligible ? 'status-tag' : 'status-tag danger-tag'">{{ sample.eligible ? '可入训练集' : '待处理' }}</text>
                      </view>
                    </view>
                  </view>
                  <view class="panel">
                    <view class="panel-head"><text class="panel-title">质量待处理</text></view>
                    <view v-if="patternTrainingCenter.qualityQueue.length" class="compact-list">
                      <view v-for="item in patternTrainingCenter.qualityQueue.slice(0, 5)" :key="item.sampleId" class="todo-row">
                        <view>
                          <text class="row-title">{{ item.title }}</text>
                          <text class="row-meta">{{ item.issues.join('、') }}</text>
                        </view>
                        <text class="status-tag danger-tag">{{ item.level }}</text>
                      </view>
                    </view>
                    <view v-else class="empty-state compact"><text>暂无质量问题样本</text></view>
                  </view>
                </view>
              </view>

              <view v-else-if="trainingTab === 'datasets'" class="training-datasets">
                <view class="asset-toolbar">
                  <view class="inline-search"><input v-model.trim="trainingSampleKeyword" placeholder="搜索样本、品类、版型编号或版本" /></view>
                  <picker :range="['all','train','validation','test']" :value="getTrainingSplitIndex()" @change="onTrainingSplitChange"><text class="picker-pill">数据集：{{ getTrainingSplitLabel(trainingDatasetSplit) }}</text></picker>
                  <button class="outline-small" @click="createTrainingDatasetDraft">从合规样本创建</button>
                </view>
                <view class="project-card-grid">
                  <view v-for="dataset in filteredTrainingDatasets" :key="dataset.datasetId" class="project-card">
                    <view class="project-card-head">
                      <view>
                        <text class="feature-title">{{ dataset.name }}</text>
                        <text class="row-meta">{{ getTrainingSplitLabel(dataset.split) }} · {{ dataset.version }}</text>
                      </view>
                      <text class="status-tag">{{ getDatasetStatusLabel(dataset.status) }}</text>
                    </view>
                    <view class="summary-grid single">
                      <view><text>样本数量</text><strong>{{ dataset.sampleIds.length }}</strong></view>
                      <view><text>授权策略</text><strong>{{ dataset.authorizedOnly ? '仅授权数据' : '未限制' }}</strong></view>
                      <view><text>创建人</text><strong>{{ dataset.createdBy || '当前成员' }}</strong></view>
                    </view>
                    <view class="feature-actions wrap">
                      <button class="outline-small" @click="updateTrainingDataset(dataset, 'validating')">质量校验</button>
                      <button class="outline-small" @click="updateTrainingDataset(dataset, 'ready')">标记可用</button>
                      <button class="outline-small" @click="updateTrainingDataset(dataset, 'frozen')">冻结</button>
                    </view>
                  </view>
                </view>
              </view>

              <view v-else-if="trainingTab === 'evaluations'" class="training-evaluations">
                <view class="project-card-grid">
                  <view v-for="item in patternTrainingCenter.evaluations" :key="item.evaluationId" class="project-card">
                    <view class="project-card-head">
                      <view>
                        <text class="feature-title">{{ item.modelName }}</text>
                        <text class="row-meta">固定测试集：{{ item.datasetId || '未选择' }} · 样本 {{ item.sampleCount }}</text>
                      </view>
                      <text class="status-tag">对比 {{ item.comparedWith }}</text>
                    </view>
                    <view class="summary-grid single">
                      <view><text>品类识别准确率</text><strong>{{ item.metrics.categoryAccuracy }}%</strong></view>
                      <view><text>结构识别准确率</text><strong>{{ item.metrics.structureAccuracy }}%</strong></view>
                      <view><text>尺寸误差</text><strong>{{ item.metrics.sizeError }}mm</strong></view>
                      <view><text>版片完整度</text><strong>{{ item.metrics.pieceCompleteness }}%</strong></view>
                      <view><text>版师修改量</text><strong>{{ item.metrics.revisionLoad }}%</strong></view>
                      <view><text>审核通过率</text><strong>{{ item.metrics.approvalRate }}%</strong></view>
                    </view>
                    <view v-if="item.failedCases.length" class="tag-row">
                      <text v-for="sample in item.failedCases" :key="sample.sampleId">{{ sample.title }}</text>
                    </view>
                  </view>
                </view>
              </view>

              <view v-else class="training-models">
                <view class="asset-toolbar">
                  <picker :range="['all','candidate','evaluating','approved','active','deprecated','rolled_back']" :value="getTrainingModelStatusIndex()" @change="onTrainingModelStatusChange"><text class="picker-pill">状态：{{ getModelStatusLabel(trainingModelStatus) }}</text></picker>
                  <button class="solid-small" @click="createTrainingCandidateModel">创建候选模型</button>
                </view>
                <view class="project-card-grid">
                  <view v-for="model in filteredTrainingModels" :key="model.modelId" class="project-card">
                    <view class="project-card-head">
                      <view>
                        <text class="feature-title">{{ model.name }}</text>
                        <text class="row-meta">{{ model.version }} · 数据集 {{ model.datasetId || '未关联' }}</text>
                      </view>
                      <text class="status-tag">{{ getModelStatusLabel(model.status) }}</text>
                    </view>
                    <view class="summary-grid single">
                      <view><text>固定测试集评估</text><strong>{{ model.status === 'candidate' ? '待评估' : '已记录' }}</strong></view>
                      <view><text>版师抽检</text><strong>{{ model.patternMakerChecked ? '已完成' : '待完成' }}</strong></view>
                      <view><text>风险确认</text><strong>{{ model.riskConfirmed ? '已确认' : '待确认' }}</strong></view>
                      <view><text>管理员批准</text><strong>{{ model.adminApproved ? '已批准' : '待批准' }}</strong></view>
                      <view><text>小范围灰度</text><strong>{{ model.grayReleased ? '已灰度' : '未灰度' }}</strong></view>
                    </view>
                    <view class="feature-actions wrap">
                      <button class="outline-small" @click="approveTrainingModel(model)">批准候选</button>
                      <button class="solid-small" @click="activateTrainingModel(model)">灰度启用</button>
                      <button class="outline-small danger" @click="rollbackTrainingModel(model)">回滚</button>
                    </view>
                  </view>
                </view>
              </view>
            </view>
          </view>

          <view v-else-if="currentModule === 'batch'" class="module-section batch-center">
            <view v-if="batchCreateMode" class="batch-create">
              <view class="module-intro">
                <view>
                  <text class="section-kicker">创建批量任务</text>
                  <text class="section-title">{{ currentBatchCreateStep.label }}</text>
                  <text class="section-desc">支持项目内创建、AI 出图功能创建、上传 SKU 表格创建和选择已有作品创建。本阶段记录批次草稿与幂等键，不绕过现有生成链路。</text>
                </view>
                <button class="outline-action" @click="exitBatchCreate">返回批量任务</button>
              </view>
              <view class="pattern-stepper">
                <view
                  v-for="step in batchCreateSteps"
                  :key="step.key"
                  :class="{ active: batchCreateStep === step.key, done: step.index < currentBatchCreateStep.index }"
                  @click="batchCreateStep = step.key"
                >
                  <text>{{ step.index }}</text>
                  <text>{{ step.label }}</text>
                </view>
              </view>
              <view class="pattern-work-panel">
                <view v-if="batchCreateStep === 'project'" class="pattern-step-panel">
                  <text class="panel-title">选择项目和任务类型</text>
                  <view class="size-grid">
                    <view>
                      <text>项目</text>
                      <picker :range="workspaceProjectLabels" :value="batchProjectIndex" @change="onBatchProjectChange">
                        <view class="filter-pill">{{ selectedBatchProjectLabel }}</view>
                      </picker>
                    </view>
                    <view>
                      <text>任务类型</text>
                      <picker :range="batchTaskTypes" :value="batchTaskTypeIndex" @change="onBatchTaskTypeChange">
                        <view class="filter-pill">{{ batchForm.taskType }}</view>
                      </picker>
                    </view>
                  </view>
                </view>
                <view v-else-if="batchCreateStep === 'upload'" class="pattern-step-panel">
                  <text class="panel-title">上传图片或 SKU 数据</text>
                  <view class="choice-grid">
                    <view v-for="item in batchSources" :key="item" :class="{ active: batchForm.source === item }" @click="batchForm.source = item">{{ item }}</view>
                  </view>
                  <text class="section-desc">上传仍复用现有上传/任务链路；这里仅记录批量来源，不内置真实文件。</text>
                </view>
                <view v-else-if="batchCreateStep === 'global'" class="pattern-step-panel">
                  <text class="panel-title">设置统一参数</text>
                  <view class="size-grid">
                    <view><text>统一场景</text><input v-model.trim="batchForm.globalScene" placeholder="例如：浅色电商棚拍" /></view>
                    <view><text>统一比例</text><input v-model.trim="batchForm.ratio" placeholder="例如：1:1 / 3:4" /></view>
                  </view>
                </view>
                <view v-else-if="batchCreateStep === 'diff'" class="pattern-step-panel">
                  <text class="panel-title">设置单项差异参数</text>
                  <view class="size-grid">
                    <view><text>差异字段</text><input v-model.trim="batchForm.diffFields" placeholder="例如：颜色、尺码、场景" /></view>
                    <view><text>SKU 数量</text><input v-model.trim="batchForm.skuCount" placeholder="例如：24" /></view>
                  </view>
                </view>
                <view v-else-if="batchCreateStep === 'validate'" class="pattern-step-panel">
                  <text class="panel-title">校验素材与额度</text>
                  <view class="summary-grid">
                    <view><text>素材校验</text><strong>待上传页完成</strong></view>
                    <view><text>预计额度</text><strong>{{ estimatedBatchQuota }}</strong></view>
                    <view><text>幂等键</text><strong>{{ batchForm.idempotencyKey }}</strong></view>
                  </view>
                </view>
                <view v-else class="pattern-step-panel">
                  <text class="panel-title">确认并开始生成</text>
                  <view class="task-summary">
                    <text>项目：{{ selectedBatchProjectLabel }}</text>
                    <text>任务类型：{{ batchForm.taskType }}</text>
                    <text>来源：{{ batchForm.source }}</text>
                    <text>SKU 数量：{{ batchForm.skuCount || 0 }}</text>
                  </view>
                  <button class="solid-action" @click="submitBatchDraft">创建批量任务草稿</button>
                </view>
                <view class="create-nav">
                  <button class="outline-small" :disabled="batchCreateStepIndex === 0" @click="prevBatchCreateStep">上一步</button>
                  <button v-if="batchCreateStepIndex < batchCreateSteps.length - 1" class="solid-small" @click="nextBatchCreateStep">下一步</button>
                  <button v-else class="solid-small" @click="submitBatchDraft">创建草稿</button>
                </view>
              </view>
            </view>

            <view v-else-if="selectedWorkspaceBatch" class="batch-detail">
              <view class="module-intro compact-intro">
                <view>
                  <text class="section-kicker">{{ getWorkspaceBatchStatusLabel(selectedWorkspaceBatch.status) }}</text>
                  <text class="section-title">{{ selectedWorkspaceBatch.title }}</text>
                  <text class="section-desc">项目：{{ getBatchProjectName(selectedWorkspaceBatch.projectId) }} · 预计额度：{{ selectedWorkspaceBatch.estimatedQuota }} · 实际额度：{{ selectedWorkspaceBatch.actualQuota }}</text>
                </view>
                <view class="detail-actions">
                  <button class="outline-action" @click="closeBatchDetail">返回列表</button>
                  <button class="solid-action" @click="createDeliveryFromBatch">创建交付批次</button>
                </view>
              </view>
              <view class="project-overview-strip">
                <view><text>总任务数</text><strong>{{ selectedWorkspaceBatch.totalCount }}</strong></view>
                <view><text>成功数量</text><strong>{{ selectedWorkspaceBatch.successCount }}</strong></view>
                <view><text>失败数量</text><strong>{{ selectedWorkspaceBatch.failedCount }}</strong></view>
                <view><text>生成中</text><strong>{{ selectedWorkspaceBatch.processingCount }}</strong></view>
                <view><text>待审核</text><strong>{{ selectedWorkspaceBatch.reviewCount }}</strong></view>
              </view>
              <view class="detail-tabs">
                <text v-for="tab in batchDetailTabs" :key="tab.key" :class="{ active: batchDetailTab === tab.key }" @click="setBatchDetailTab(tab.key)">{{ tab.label }}</text>
              </view>
              <view class="pattern-work-panel">
                <view v-if="batchDetailTab === 'overview'" class="project-actions-row">
                  <button class="outline-small" @click="pausePendingTasks">暂停未开始任务</button>
                  <button class="outline-small" @click="retryFailedTasks">重试失败任务</button>
                  <button class="outline-small" @click="bulkApproveTasks">批量通过</button>
                  <button class="solid-small" @click="createDeliveryFromBatch">创建交付批次</button>
                </view>
                <view v-else-if="batchDetailTab === 'tasks'" class="table-scroll">
                  <view class="batch-table">
                    <view class="table-head"><text>任务</text><text>状态</text><text>结果</text><text>操作</text></view>
                    <view v-for="task in selectedWorkspaceBatch.tasks" :key="task.taskId" class="table-row">
                      <text>{{ getTaskName(task) }}</text>
                      <text>{{ getStatusLabel(task.status) }}</text>
                      <text>{{ isTaskReviewSafe(task) ? '可审核' : '不可交付' }}</text>
                      <view>
                        <button class="outline-small" @click="approveSingleTask(task)">加入审核</button>
                        <button class="outline-small" @click="markTaskRetouch(task)">人工精修</button>
                      </view>
                    </view>
                  </view>
                </view>
                <view v-else-if="batchDetailTab === 'results'" class="library-grid">
                  <view v-for="task in selectedWorkspaceBatch.tasks" :key="task.taskId" class="library-card">
                    <view class="pattern-thumb"><text>{{ isTaskReviewSafe(task) ? '图' : '!' }}</text></view>
                    <view class="library-card-body">
                      <text class="feature-title">{{ getTaskName(task) }}</text>
                      <text class="row-meta">{{ isTaskReviewSafe(task) ? '结果可进入审核' : 'mock/fallback/空结果/未完成禁止交付' }}</text>
                      <button class="outline-small" @click="continueTask(task)">查看详情</button>
                    </view>
                  </view>
                </view>
                <view v-else-if="batchDetailTab === 'review'" class="version-list">
                  <view v-for="task in reviewableBatchTasks" :key="task.taskId">
                    <text>{{ getTaskName(task) }}</text>
                    <text>原图与结果对比 · 可填写审核意见</text>
                    <view class="project-actions-row">
                      <button class="solid-small" @click="approveSingleTask(task)">通过</button>
                      <button class="outline-small danger" @click="rejectSingleTask(task)">退回修改</button>
                      <button class="outline-small" @click="markTaskRetouch(task)">标记人工精修</button>
                    </view>
                  </view>
                  <view v-if="!reviewableBatchTasks.length" class="empty-state"><text>暂无可审核任务，异常或 mock/fallback 结果已被拦截</text></view>
                </view>
                <view v-else-if="batchDetailTab === 'failed'" class="version-list">
                  <view v-for="task in failedBatchTasks" :key="task.taskId">
                    <text>{{ getTaskName(task) }}</text>
                    <text>{{ getStatusLabel(task.status) }} · 重试只处理失败项，成功项不会重复执行或扣费</text>
                  </view>
                  <view v-if="!failedBatchTasks.length" class="empty-state"><text>暂无失败任务</text></view>
                </view>
                <view v-else-if="batchDetailTab === 'delivery'" class="version-list">
                  <view class="delivery-config">
                    <view class="form-grid">
                      <label>
                        <text>交付名称</text>
                        <input v-model.trim="deliveryForm.title" :placeholder="`${selectedWorkspaceBatch.title} 交付清单`" />
                      </label>
                      <label>
                        <text>图片用途</text>
                        <input v-model.trim="deliveryForm.usage" placeholder="例如：电商上新、跨境白底图" />
                      </label>
                      <label>
                        <text>文件格式</text>
                        <input v-model.trim="deliveryForm.fileFormat" placeholder="例如：JPG/PNG" />
                      </label>
                      <label>
                        <text>尺寸规范</text>
                        <input v-model.trim="deliveryForm.sizeSpec" placeholder="例如：1:1 2000px" />
                      </label>
                      <label>
                        <text>命名规则</text>
                        <input v-model.trim="deliveryForm.namingRule" placeholder="例如：项目-批次-SKU" />
                      </label>
                      <label>
                        <text>交付备注</text>
                        <input v-model.trim="deliveryForm.note" placeholder="交付说明或平台要求" />
                      </label>
                    </view>
                    <button class="solid-small" @click="createDeliveryFromBatch">按当前设置创建交付批次</button>
                  </view>
                  <view v-for="delivery in selectedBatchDeliveries" :key="delivery.deliveryId">
                    <text>{{ delivery.title }} · {{ delivery.versionNo }}</text>
                    <text>{{ delivery.taskIds.length }} 个任务 · {{ formatDate(delivery.deliveredAt) }}</text>
                  </view>
                  <view v-if="!selectedBatchDeliveries.length" class="empty-state"><text>暂无交付记录</text></view>
                </view>
                <view v-else class="version-list">
                  <view v-for="(item, index) in selectedWorkspaceBatch.activity" :key="index">
                    <text>{{ getBatchActivityLabel(item.action) }} · {{ item.operatorName || '系统' }}</text>
                    <text>{{ formatDate(item.createdAt) }} · 成功 {{ item.success || 0 }} / 失败 {{ item.failed || 0 }} / 跳过 {{ item.skipped || 0 }}</text>
                  </view>
                  <view v-if="!selectedWorkspaceBatch.activity.length" class="empty-state"><text>暂无操作日志</text></view>
                </view>
              </view>
            </view>

            <view v-else class="batch-list">
              <view class="module-intro">
                <view>
                  <text class="section-kicker">批量任务中心</text>
                  <text class="section-title">统一管理批量生成、审核、失败处理和交付</text>
                  <text class="section-desc">批量操作带幂等保护；重试只处理失败项，成功或已交付任务不会重复生成或重复扣费。</text>
                </view>
                <button class="solid-action" @click="startBatchCreate">创建批量任务</button>
              </view>
              <view class="library-toolbar">
                <view class="inline-search"><input v-model.trim="batchKeyword" placeholder="搜索批次、项目、任务类型" /></view>
                <button class="outline-small" @click="startBatchCreate">创建批量任务</button>
              </view>
              <view class="library-tabs">
                <text v-for="tab in batchTabs" :key="tab.key" :class="{ active: batchTab === tab.key }" @click="batchTab = tab.key">{{ tab.label }} {{ getBatchTabCount(tab.key) }}</text>
              </view>
              <view v-if="filteredWorkspaceBatches.length" class="project-card-grid">
                <view v-for="item in filteredWorkspaceBatches" :key="item.batchId" class="project-card" @click="openBatchDetail(item)">
                  <view class="project-card-head">
                    <view>
                      <text class="feature-title">{{ item.title }}</text>
                      <text class="row-meta">{{ getBatchProjectName(item.projectId) }} · {{ item.taskType }}</text>
                    </view>
                    <text class="status-tag">{{ getWorkspaceBatchStatusLabel(item.status) }}</text>
                  </view>
                  <view class="summary-grid single">
                    <view><text>成功/失败/待审</text><strong>{{ item.successCount }}/{{ item.failedCount }}/{{ item.reviewCount }}</strong></view>
                    <view><text>预计/实际额度</text><strong>{{ item.estimatedQuota }}/{{ item.actualQuota }}</strong></view>
                    <view><text>交付</text><strong>{{ item.deliveredCount }}</strong></view>
                  </view>
                  <button class="outline-small" @click.stop="openBatchDetail(item)">进入批次详情</button>
                </view>
              </view>
              <view v-else class="empty-state">
                <text>暂无批量任务</text>
                <button class="solid-small" @click="startBatchCreate">创建批量任务</button>
              </view>
            </view>
          </view>

          <view v-else-if="currentModule === 'model-operations'" class="module-section model-ops-center">
            <view class="module-intro">
              <view>
                <text class="section-kicker">AI 模型灰度发布与质量监控中心</text>
                <text class="section-title">新模型先验证、再灰度、可暂停、可回滚</text>
                <text class="section-desc">禁止上传模型后自动替换线上版本。所有监控来自现有任务记录；未记录模型追踪字段的任务会标记为“未记录”。</text>
              </view>
              <button class="solid-action" @click="createModelOpsRelease">创建灰度计划</button>
            </view>

            <view v-if="!modelOperationsCenter.canAccess" class="empty-state">
              <text>当前账号暂无模型运维权限</text>
              <button class="outline-small" @click="selectModule('ai-training')">返回训练评估</button>
            </view>
            <view v-else class="training-layout">
              <view class="pattern-safety">
                <strong>发布门禁</strong>
                <text>候选模型必须经过离线评估、版师人工抽检、风险确认、创建灰度计划、小范围启用、指标观察，才能扩大灰度或正式激活。</text>
              </view>
              <view class="library-tabs compact-tabs">
                <text v-for="tab in modelOpsTabs" :key="tab.key" :class="{ active: modelOpsTab === tab.key }" @click="setModelOpsTab(tab.key)">{{ tab.label }}</text>
              </view>

              <view v-if="modelOpsTab === 'overview'" class="training-overview">
                <view class="module-grid">
                  <view v-for="item in modelOpsSummaryCards" :key="item.label" class="panel stat-panel">
                    <text class="stat-value">{{ item.value }}</text>
                    <text class="stat-label">{{ item.label }}</text>
                    <text class="stat-desc">{{ item.desc }}</text>
                  </view>
                </view>
                <view class="dashboard-grid">
                  <view class="panel wide">
                    <view class="panel-head">
                      <text class="panel-title">当前发布状态</text>
                      <button class="text-btn" @click="setModelOpsTab('releases')">查看发布计划</button>
                    </view>
                    <view v-if="modelOpsActiveRelease" class="project-card">
                      <view class="project-card-head">
                        <view>
                          <text class="feature-title">{{ modelOpsActiveRelease.modelVersion }}</text>
                          <text class="row-meta">{{ modelOpsActiveRelease.releaseId }} · {{ getReleaseStatusLabel(modelOpsActiveRelease.status) }}</text>
                        </view>
                        <text class="status-tag">{{ modelOpsActiveRelease.scope.taskRatio }}%</text>
                      </view>
                      <view class="summary-grid single">
                        <view><text>灰度账号</text><strong>{{ modelOpsActiveRelease.scope.accountIds.length }}</strong></view>
                        <view><text>灰度企业</text><strong>{{ modelOpsActiveRelease.scope.enterpriseIds.length }}</strong></view>
                        <view><text>功能/品类</text><strong>{{ modelOpsActiveRelease.scope.functions.join('、') }} · {{ modelOpsActiveRelease.scope.categories.join('、') }}</strong></view>
                        <view><text>正式交付</text><strong>{{ modelOpsActiveRelease.scope.allowDelivery ? '允许' : '禁止' }}</strong></view>
                      </view>
                    </view>
                    <view v-else class="empty-state compact"><text>暂无运行中的灰度计划</text></view>
                  </view>
                  <view class="panel">
                    <view class="panel-head">
                      <text class="panel-title">高风险异常</text>
                      <button class="text-btn" @click="setModelOpsTab('incidents')">处理异常</button>
                    </view>
                    <view v-if="modelOperationsCenter.incidents.length" class="compact-list">
                      <view v-for="item in modelOperationsCenter.incidents.slice(0, 5)" :key="item.incidentId" class="todo-row">
                        <view>
                          <text class="row-title">{{ item.title }}</text>
                          <text class="row-meta">{{ item.description }}</text>
                        </view>
                        <text :class="item.level === 'high' ? 'status-tag danger-tag' : 'status-tag'">{{ item.level }}</text>
                      </view>
                    </view>
                    <view v-else class="empty-state compact"><text>暂无异常事件</text></view>
                  </view>
                </view>
              </view>

              <view v-else-if="modelOpsTab === 'releases'" class="training-datasets">
                <view class="asset-toolbar">
                  <view class="inline-search"><input v-model.trim="modelOpsKeyword" placeholder="搜索 releaseId、模型、功能或品类" /></view>
                  <picker :range="['all','draft','gray_planned','gray_running','paused','expanded','active','rolled_back']" :value="getModelOpsReleaseStatusIndex()" @change="onModelOpsReleaseStatusChange"><text class="picker-pill">状态：{{ getReleaseStatusLabel(modelOpsReleaseStatus) }}</text></picker>
                  <button class="solid-small" @click="createModelOpsRelease">创建灰度计划</button>
                </view>
                <view class="project-card-grid">
                  <view v-for="release in filteredModelOpsReleases" :key="release.releaseId" class="project-card">
                    <view class="project-card-head">
                      <view>
                        <text class="feature-title">{{ release.modelVersion || release.modelId }}</text>
                        <text class="row-meta">{{ release.releaseId }} · {{ getReleaseStatusLabel(release.status) }}</text>
                      </view>
                      <text class="status-tag">{{ release.scope.taskRatio }}%</text>
                    </view>
                    <view class="release-gates">
                      <text :class="{ done: release.gates.offlineEvaluation }">离线评估</text>
                      <text :class="{ done: release.gates.patternMakerCheck }">版师抽检</text>
                      <text :class="{ done: release.gates.riskConfirmed }">风险确认</text>
                      <text :class="{ done: release.gates.grayPlanCreated }">灰度计划</text>
                      <text :class="{ done: release.gates.smallScopeEnabled }">小范围启用</text>
                      <text :class="{ done: release.gates.metricsObserved }">指标观察</text>
                      <text :class="{ done: release.gates.adminActivated }">正式激活</text>
                    </view>
                    <view class="summary-grid single">
                      <view><text>范围</text><strong>{{ release.scope.accountIds.length }}账号 · {{ release.scope.enterpriseIds.length }}企业 · {{ release.scope.functions.join('、') }}</strong></view>
                      <view><text>服装品类</text><strong>{{ release.scope.categories.join('、') }}</strong></view>
                      <view><text>时间范围</text><strong>{{ formatDate(release.scope.startAt) }} - {{ release.scope.endAt ? formatDate(release.scope.endAt) : '未设置' }}</strong></view>
                      <view><text>正式交付</text><strong>{{ release.scope.allowDelivery ? '允许' : '首轮禁止' }}</strong></view>
                    </view>
                    <view class="feature-actions wrap">
                      <button class="outline-small" @click="markReleaseGate(release, 'offlineEvaluation')">评估通过</button>
                      <button class="outline-small" @click="markReleaseGate(release, 'patternMakerCheck')">版师抽检</button>
                      <button class="outline-small" @click="markReleaseGate(release, 'riskConfirmed')">风险确认</button>
                      <button class="outline-small" @click="markReleaseGate(release, 'smallScopeEnabled')">小范围启用</button>
                      <button class="outline-small" @click="markReleaseGate(release, 'metricsObserved')">指标观察</button>
                      <button class="solid-small" @click="expandModelOpsRelease(release)">扩大/激活</button>
                      <button class="outline-small danger" @click="pauseModelOpsRelease(release)">暂停</button>
                      <button class="outline-small danger" @click="rollbackModelOpsRelease(release)">回滚</button>
                    </view>
                  </view>
                </view>
                <view v-if="!filteredModelOpsReleases.length" class="empty-state"><text>暂无灰度发布计划</text><button class="solid-small" @click="createModelOpsRelease">创建计划</button></view>
              </view>

              <view v-else-if="modelOpsTab === 'monitoring'" class="training-evaluations">
                <view class="module-grid">
                  <view class="panel stat-panel"><text class="stat-value">{{ modelOperationsCenter.monitoring.successRate }}%</text><text class="stat-label">任务成功率</text><text class="stat-desc">成功/完成任务占比。</text></view>
                  <view class="panel stat-panel"><text class="stat-value">{{ modelOperationsCenter.monitoring.averageDurationMs }}ms</text><text class="stat-label">平均生成时间</text><text class="stat-desc">来自任务 duration 记录。</text></view>
                  <view class="panel stat-panel"><text class="stat-value">{{ modelOperationsCenter.monitoring.timeoutRate }}%</text><text class="stat-label">超时率</text><text class="stat-desc">超时任务占比。</text></view>
                  <view class="panel stat-panel"><text class="stat-value">{{ modelOperationsCenter.monitoring.retryRate }}%</text><text class="stat-label">重试率</text><text class="stat-desc">有 retryCount 的任务占比。</text></view>
                  <view class="panel stat-panel"><text class="stat-value">{{ modelOperationsCenter.monitoring.approvalRate }}%</text><text class="stat-label">审核通过率</text><text class="stat-desc">已批准或已交付任务占比。</text></view>
                  <view class="panel stat-panel"><text class="stat-value">{{ modelOperationsCenter.monitoring.regenerateRate }}%</text><text class="stat-label">重新生成率</text><text class="stat-desc">重试或再生成任务占比。</text></view>
                  <view class="panel stat-panel"><text class="stat-value">{{ modelOperationsCenter.monitoring.quotaAbnormal }}</text><text class="stat-label">额度异常</text><text class="stat-desc">扣费与回滚同时存在。</text></view>
                  <view class="panel stat-panel"><text class="stat-value">{{ modelOperationsCenter.monitoring.emptyResultCount }}</text><text class="stat-label">空结果</text><text class="stat-desc">完成但无结果图。</text></view>
                </view>
                <view class="panel">
                  <view class="panel-head"><text class="panel-title">任务模型追踪</text><button class="text-btn" @click="modelOpsKeyword = ''">清空筛选</button></view>
                  <view class="asset-toolbar"><view class="inline-search"><input v-model.trim="modelOpsKeyword" placeholder="搜索 taskId、modelId、releaseId、provider 或 promptVersion" /></view></view>
                  <view class="table-scroll">
                    <view class="model-trace-table">
                      <view class="model-trace-head"><text>任务</text><text>模型</text><text>发布</text><text>Provider</text><text>提示词</text><text>状态</text></view>
                      <view v-for="trace in filteredModelTaskTraces" :key="trace.taskId" class="model-trace-row">
                        <text>{{ trace.taskId }}</text>
                        <text>{{ trace.modelId }} · {{ trace.modelVersion }}</text>
                        <text>{{ trace.releaseId || '未关联' }} · {{ trace.experimentGroup }}</text>
                        <text>{{ trace.provider }}</text>
                        <text>{{ trace.promptVersion }}</text>
                        <text>{{ trace.status }}</text>
                      </view>
                    </view>
                  </view>
                </view>
              </view>

              <view v-else class="training-models">
                <view class="asset-toolbar">
                  <view class="inline-search"><input v-model.trim="modelOpsKeyword" placeholder="搜索异常类型、发布计划或模型" /></view>
                </view>
                <view class="project-card-grid">
                  <view v-for="incident in filteredModelOpsIncidents" :key="incident.incidentId" class="project-card">
                    <view class="project-card-head">
                      <view>
                        <text class="feature-title">{{ incident.title }}</text>
                        <text class="row-meta">{{ incident.type }} · {{ incident.releaseId || '全局' }}</text>
                      </view>
                      <text :class="incident.level === 'high' ? 'status-tag danger-tag' : 'status-tag'">{{ incident.level }}</text>
                    </view>
                    <text class="section-desc">{{ incident.description }}</text>
                    <view class="summary-grid single">
                      <view><text>自动保护</text><strong>{{ incident.autoPaused ? '已暂停扩大灰度' : '未自动暂停' }}</strong></view>
                      <view><text>人工确认</text><strong>{{ incident.manualRequired ? '必须人工确认' : '可自动恢复' }}</strong></view>
                      <view><text>状态</text><strong>{{ incident.status }}</strong></view>
                    </view>
                    <view class="feature-actions wrap">
                      <button class="outline-small" @click="resolveModelOpsIncident(incident)">标记已处理</button>
                      <button v-if="incident.releaseId" class="outline-small danger" @click="pauseModelOpsRelease({ releaseId: incident.releaseId })">暂停发布</button>
                    </view>
                  </view>
                </view>
                <view v-if="!filteredModelOpsIncidents.length" class="empty-state"><text>暂无异常事件</text></view>
              </view>
            </view>
          </view>

          <view v-else-if="currentModule === 'delivery'" class="module-section delivery-center">
            <view class="module-intro">
              <view>
                <text class="section-kicker">交付中心</text>
                <text class="section-title">审核通过作品的交付清单与版本记录</text>
                <text class="section-desc">只有审核通过的作品才能进入交付候选；交付记录保留项目、批次、任务、版本、审核人、交付人和交付时间。</text>
              </view>
              <button class="solid-action" @click="selectModule('batch')">从批次创建交付</button>
            </view>
            <view v-if="workspaceDeliveries.length" class="project-card-grid">
              <view v-for="item in workspaceDeliveries" :key="item.deliveryId" class="project-card">
                <view class="project-card-head">
                  <view>
                    <text class="feature-title">{{ item.title }}</text>
                    <text class="row-meta">{{ getBatchProjectName(item.projectId) }} · {{ item.versionNo }}</text>
                  </view>
                  <text class="status-tag">{{ item.status }}</text>
                </view>
                <view class="summary-grid single">
                  <view><text>用途</text><strong>{{ item.usage }}</strong></view>
                  <view><text>格式 / 尺寸</text><strong>{{ item.fileFormat }} · {{ item.sizeSpec }}</strong></view>
                  <view><text>任务 / 资产</text><strong>{{ item.taskIds.length }} / {{ item.assetIds.length }}</strong></view>
                  <view><text>审核人 / 交付人</text><strong>{{ item.reviewer }} / {{ item.deliverer }}</strong></view>
                </view>
              </view>
            </view>
            <view v-else class="empty-state">
              <text>暂无交付记录</text>
              <button class="solid-small" @click="selectModule('batch')">进入批量任务创建交付</button>
            </view>
          </view>

          <view v-else-if="currentModule === 'assets'" class="module-section asset-center">
            <view class="module-intro">
              <view>
                <text class="section-kicker">作品与数字资产中心</text>
                <text class="section-title">统一管理作品、结构图、版型文件和正式交付资产</text>
                <text class="section-desc">资产来自现有任务、批次、项目、交付和版型库，中心只建立引用和版本元数据，不重复存储相同文件。</text>
              </view>
              <view class="intro-actions">
                <button class="outline-action" @click="resetAssetFilters">重置筛选</button>
                <button class="solid-action" @click="selectModule('ai-output')">上传素材</button>
              </view>
            </view>

            <view v-if="selectedWorkspaceAsset" class="asset-detail panel">
              <view class="panel-head">
                <view>
                  <text class="panel-title">{{ selectedWorkspaceAsset.name }}</text>
                  <text class="panel-sub">{{ getAssetTypeLabel(selectedWorkspaceAsset.type) }} · {{ selectedWorkspaceAsset.assetId }}</text>
                </view>
                <button class="text-btn" @click="closeWorkspaceAsset">返回资产列表</button>
              </view>
              <view class="library-tabs compact-tabs">
                <text v-for="tab in assetDetailTabs" :key="tab.key" :class="{ active: assetDetailTab === tab.key }" @click="setAssetDetailTab(tab.key)">{{ tab.label }}</text>
              </view>
              <view v-if="assetDetailTab === 'preview'" class="asset-detail-grid">
                <view class="asset-preview-large">
                  <image v-if="selectedWorkspaceAsset.thumbnail" :src="selectedWorkspaceAsset.thumbnail" mode="aspectFill"></image>
                  <view v-else class="file-placeholder">{{ getAssetTypeLabel(selectedWorkspaceAsset.type) }}</view>
                </view>
                <view class="source-chain">
                  <text class="panel-title">完整来源链路</text>
                  <view v-for="(item, index) in selectedWorkspaceAsset.sourceChain" :key="item.label" class="chain-step">
                    <text class="chain-index">{{ index + 1 }}</text>
                    <view>
                      <strong>{{ item.label }}</strong>
                      <text>{{ item.value }}</text>
                    </view>
                  </view>
                </view>
              </view>
              <view v-else-if="assetDetailTab === 'info'" class="summary-grid">
                <view><text>资产类型</text><strong>{{ getAssetTypeLabel(selectedWorkspaceAsset.type) }}</strong></view>
                <view><text>文件格式</text><strong>{{ selectedWorkspaceAsset.fileFormat }}</strong></view>
                <view><text>尺寸</text><strong>{{ selectedWorkspaceAsset.dimensions }}</strong></view>
                <view><text>创建人</text><strong>{{ selectedWorkspaceAsset.creatorName }}</strong></view>
                <view><text>当前版本</text><strong>{{ selectedWorkspaceAsset.currentVersion }}</strong></view>
                <view><text>更新时间</text><strong>{{ formatDate(selectedWorkspaceAsset.updatedAt || selectedWorkspaceAsset.createdAt) }}</strong></view>
              </view>
              <view v-else-if="assetDetailTab === 'source'" class="summary-grid">
                <view><text>来源任务</text><strong>{{ selectedWorkspaceAsset.taskId || '未关联' }}</strong></view>
                <view><text>来源批次</text><strong>{{ selectedWorkspaceAsset.batchId || '未关联' }}</strong></view>
                <view><text>生成方式</text><strong>{{ selectedWorkspaceAsset.generationMode }}</strong></view>
                <view><text>来源项目</text><strong>{{ selectedWorkspaceAsset.projectName }}</strong></view>
              </view>
              <view v-else-if="assetDetailTab === 'project'" class="asset-action-row">
                <view>
                  <text class="panel-title">关联项目</text>
                  <text class="section-desc">{{ selectedWorkspaceAsset.projectName || '无所属项目' }}</text>
                </view>
                <button class="solid-small" @click="addAssetProject(selectedWorkspaceAsset)">加入首个项目</button>
              </view>
              <view v-else-if="assetDetailTab === 'versions'" class="timeline-list">
                <view v-for="version in selectedWorkspaceAsset.versions" :key="version.versionId" class="timeline-item">
                  <text class="timeline-dot"></text>
                  <view>
                    <text class="feature-title">{{ version.versionNo }} · {{ version.source }}</text>
                    <text class="row-meta">{{ version.status }} · {{ formatDate(version.createdAt) }}</text>
                    <text class="section-desc">已审核、已批准或已交付版本禁止覆盖；人工精修和重新生成必须创建新版本。</text>
                  </view>
                </view>
              </view>
              <view v-else-if="assetDetailTab === 'review'" class="asset-action-row">
                <view>
                  <text class="panel-title">审核状态：{{ getAssetReviewLabel(selectedWorkspaceAsset.reviewStatus) }}</text>
                  <text class="section-desc">mock、fallback、空结果和来源不明测试图不得进入正式交付审核。</text>
                </view>
                <button class="solid-small" @click="submitAssetReview(selectedWorkspaceAsset)">提交审核</button>
              </view>
              <view v-else-if="assetDetailTab === 'delivery'" class="summary-grid">
                <view><text>交付状态</text><strong>{{ getAssetDeliveryLabel(selectedWorkspaceAsset.deliveryStatus) }}</strong></view>
                <view><text>下载版本</text><strong>{{ selectedWorkspaceAsset.currentVersion }}</strong></view>
                <view><text>交付约束</text><strong>已交付资产不可被静默替换</strong></view>
              </view>
              <view v-else class="timeline-list">
                <view v-for="log in selectedWorkspaceAsset.logs" :key="log.createdAt + log.action" class="timeline-item">
                  <text class="timeline-dot"></text>
                  <view>
                    <text class="feature-title">{{ log.action }}</text>
                    <text class="row-meta">{{ log.operatorName }} · {{ formatDate(log.createdAt) }}</text>
                  </view>
                </view>
                <view v-if="!selectedWorkspaceAsset.logs.length" class="empty-state"><text>暂无操作日志</text></view>
              </view>
            </view>

            <view v-else class="asset-list-panel panel">
              <view class="asset-toolbar">
                <view class="inline-search"><input v-model.trim="assetKeyword" placeholder="搜索资产、任务、批次、项目或创建人" /></view>
                <picker :range="assetTypes" range-key="label" :value="getAssetTypeIndex()" @change="onAssetTypeChange"><text class="picker-pill">{{ getAssetTypeLabel(assetType) }}</text></picker>
                <picker :range="assetViewModes" range-key="label" :value="getAssetViewModeIndex()" @change="onAssetViewModeChange"><text class="picker-pill">{{ assetViewModes[getAssetViewModeIndex()].label }}</text></picker>
                <button class="outline-small" @click="runAssetBatchAction('download')">批量下载</button>
                <button class="outline-small" @click="runAssetBatchAction('review')">提交审核</button>
                <button class="outline-small" @click="runAssetBatchAction('delivery')">生成交付清单</button>
              </view>
              <view class="asset-filter-grid">
                <picker :range="assetProjectLabels" :value="assetProjectFilterIndex" @change="onAssetProjectFilterChange"><text>项目：{{ assetProjectLabels[assetProjectFilterIndex] }}</text></picker>
                <input v-model.trim="assetFilterTaskId" placeholder="任务 ID" />
                <input v-model.trim="assetFilterBatchId" placeholder="批次 ID" />
                <input v-model.trim="assetFilterCreator" placeholder="创建人" />
                <picker :range="assetReviewOptions" :value="assetReviewFilterIndex" @change="onAssetReviewStatusChange"><text>审核：{{ getAssetReviewLabel(assetFilterReviewStatus) }}</text></picker>
                <picker :range="assetDeliveryOptions" :value="assetDeliveryFilterIndex" @change="onAssetDeliveryStatusChange"><text>交付：{{ getAssetDeliveryLabel(assetFilterDeliveryStatus) }}</text></picker>
              </view>
              <view class="library-tabs compact-tabs">
                <text v-for="type in assetTypes" :key="type.key" :class="{ active: assetType === type.key }" @click="assetType = type.key; updateRoute()">{{ type.label }} {{ getAssetTypeCount(type.key) }}</text>
              </view>
              <view v-if="selectedAssetList.length" class="asset-batch-bar">
                <text>已选择 {{ selectedAssetList.length }} 个资产</text>
                <button class="outline-small" @click="runAssetBatchAction('project')">加入项目</button>
                <button class="outline-small" @click="runAssetBatchAction('tag')">修改标签</button>
                <button class="outline-small" @click="runAssetBatchAction('archive')">归档</button>
                <button class="text-btn" @click="clearAssetSelection">清空</button>
              </view>
              <view v-if="filteredWorkspaceAssets.length" :class="assetViewMode === 'list' ? 'asset-table' : 'asset-grid'">
                <view v-for="group in groupedWorkspaceAssets" :key="group.key" class="asset-group">
                  <text v-if="['project','batch','time'].includes(assetViewMode)" class="asset-group-title">{{ group.title }} · {{ group.items.length }}</text>
                  <view v-for="asset in group.items" :key="asset.assetId" :class="assetViewMode === 'list' ? 'asset-row' : 'asset-card'">
                    <view class="asset-select" :class="{ active: isAssetSelected(asset) }" @click.stop="toggleAssetSelection(asset)">{{ isAssetSelected(asset) ? '已选' : '选择' }}</view>
                    <view class="asset-thumb" @click="openWorkspaceAsset(asset)">
                      <image v-if="asset.thumbnail" :src="asset.thumbnail" mode="aspectFill"></image>
                      <view v-else class="file-placeholder">{{ getAssetTypeLabel(asset.type) }}</view>
                    </view>
                    <view class="asset-main" @click="openWorkspaceAsset(asset)">
                      <text class="feature-title">{{ asset.name }}</text>
                      <text class="row-meta">{{ getAssetTypeLabel(asset.type) }} · {{ asset.dimensions }} · {{ asset.fileFormat }}</text>
                      <text class="row-meta">项目：{{ asset.projectName }} · 版本：{{ asset.currentVersion }}</text>
                      <view class="asset-tags">
                        <text>{{ getAssetReviewLabel(asset.reviewStatus) }}</text>
                        <text>{{ getAssetDeliveryLabel(asset.deliveryStatus) }}</text>
                        <text>{{ formatDate(asset.createdAt || asset.updatedAt) }}</text>
                      </view>
                    </view>
                    <view class="asset-actions">
                      <button class="outline-small" @click.stop="previewAsset(asset)">预览</button>
                      <button class="outline-small" @click.stop="downloadAsset(asset)">下载</button>
                      <button class="outline-small" @click.stop="addAssetProject(asset)">加入项目</button>
                      <button class="outline-small" @click.stop="submitAssetReview(asset)">提交审核</button>
                      <button class="outline-small" @click.stop="createAssetVariant(asset)">创建变体</button>
                      <button class="outline-small" @click.stop="showAssetSource(asset)">来源</button>
                      <button class="outline-small danger" @click.stop="archiveAsset(asset)">归档</button>
                    </view>
                  </view>
                </view>
              </view>
              <view v-else class="empty-state">
                <text>当前筛选下暂无资产</text>
                <button class="solid-small" @click="resetAssetFilters">清空筛选</button>
              </view>
            </view>
          </view>

          <view v-else-if="currentModule === 'team'" class="module-section team-center">
            <view class="module-intro">
              <view>
                <text class="section-kicker">团队、角色与权限中心</text>
                <text class="section-title">{{ teamCenter.enterprise.enterpriseName || '企业协作空间' }}</text>
                <text class="section-desc">成员、角色、数据范围和审计日志统一管理。前端只做入口和反馈，云函数、API 与数据查询仍必须按 userId、enterpriseId、role、permission 和资源归属再次校验。</text>
              </view>
              <button v-if="teamPermissions.canManageMembers" class="solid-action" @click="openTeamInvite">邀请成员</button>
            </view>

            <view v-if="teamLoading" class="empty-state"><text>正在加载团队权限...</text></view>
            <view v-else-if="teamError" class="empty-state"><text>{{ teamError }}</text><button class="solid-small" @click="loadTeamCenter">重新加载</button></view>
            <view v-else-if="!canEnterTeamCenter" class="empty-state">
              <text>当前账号暂无团队中心权限</text>
              <button class="outline-small" @click="goEnterpriseLogin">切换企业账号</button>
            </view>
            <view v-else class="team-layout">
              <view class="library-tabs">
                <text v-for="tab in teamTabs" :key="tab.key" :class="{ active: teamTab === tab.key }" @click="setTeamTab(tab.key)">{{ tab.label }}</text>
              </view>

              <view v-if="teamInviteOpen" class="panel">
                <view class="panel-head">
                  <view>
                    <text class="panel-title">邀请成员</text>
                    <text class="panel-sub">邀请记录限时有效，被邀请人确认后加入当前企业。</text>
                  </view>
                  <button class="text-btn" @click="teamInviteOpen = false">关闭</button>
                </view>
                <view class="form-grid">
                  <label>
                    <text>手机号或邮箱</text>
                    <input v-model.trim="teamInviteForm.targetAccount" placeholder="请输入手机号或邮箱" />
                  </label>
                  <label>
                    <text>角色</text>
                    <picker :range="teamRoleOptions" :value="getRolePickerIndex(teamInviteForm.role)" @change="onInviteRoleChange">
                      <view class="picker-value">{{ getTeamRoleLabel(teamInviteForm.role) }}</view>
                    </picker>
                  </label>
                </view>
                <button class="solid-small" @click="submitTeamInvite">发送邀请</button>
              </view>

              <view v-if="teamTab === 'overview'" class="dashboard-grid">
                <view class="panel stat-panel">
                  <text class="stat-value">{{ teamCenter.members.length }}</text>
                  <text class="stat-label">成员数量</text>
                  <text class="stat-desc">仅显示当前企业成员。</text>
                </view>
                <view class="panel stat-panel">
                  <text class="stat-value">{{ teamCenter.invites.length }}</text>
                  <text class="stat-label">待处理邀请</text>
                  <text class="stat-desc">过期、撤销或已使用后不可重复生效。</text>
                </view>
                <view class="panel stat-panel">
                  <text class="stat-value">{{ teamCenter.roles.length }}</text>
                  <text class="stat-label">角色数量</text>
                  <text class="stat-desc">系统角色与自定义角色共用权限目录。</text>
                </view>
                <view class="panel stat-panel">
                  <text class="stat-value">{{ teamCenter.auditLogs.length }}</text>
                  <text class="stat-label">审计记录</text>
                  <text class="stat-desc">普通成员不可删除审计日志。</text>
                </view>
                <view class="panel wide">
                  <view class="panel-head">
                    <view>
                      <text class="panel-title">重要操作保护</text>
                      <text class="panel-sub">以下动作必须二次确认并写入审计日志。</text>
                    </view>
                  </view>
                  <view class="tag-row">
                    <text v-for="item in teamCenter.protectedActions" :key="item.action">{{ item.label }}</text>
                  </view>
                </view>
                <view class="panel">
                  <view class="panel-head">
                    <view>
                      <text class="panel-title">数据范围</text>
                      <text class="panel-sub">权限同时约束可访问的数据边界。</text>
                    </view>
                  </view>
                  <view class="version-list compact-list">
                    <view v-for="item in teamCenter.dataScopes" :key="item.key">
                      <text>{{ item.label }}</text>
                      <text>{{ item.desc }}</text>
                    </view>
                  </view>
                </view>
              </view>

              <view v-else-if="teamTab === 'members'" class="panel">
                <view class="panel-head">
                  <view>
                    <text class="panel-title">团队成员</text>
                    <text class="panel-sub">支持邀请、角色调整、项目分配、暂停账号、移除成员和重新发送邀请。</text>
                  </view>
                  <button v-if="teamPermissions.canManageMembers" class="solid-small" @click="openTeamInvite">邀请成员</button>
                </view>
                <view class="table-scroll">
                  <view class="team-table">
                    <view class="team-table-head"><text>成员</text><text>账号</text><text>企业</text><text>角色</text><text>项目</text><text>状态</text><text>最近登录</text><text>操作</text></view>
                    <view v-for="member in teamCenter.members" :key="member.memberId" class="team-table-row">
                      <view class="member-cell"><view class="avatar-dot">{{ member.name.slice(0, 1) }}</view><text>{{ member.name }}</text></view>
                      <text>{{ member.account || '未绑定' }}</text>
                      <text>{{ member.enterpriseName }}</text>
                      <picker :disabled="!teamPermissions.canManageMembers" :range="teamRoleOptions" :value="getRolePickerIndex(member.role)" @change="onMemberRoleChange(member, $event)">
                        <view class="picker-value">{{ getTeamRoleLabel(member.role) }}</view>
                      </picker>
                      <text>{{ member.projectCount }}</text>
                      <text>{{ getMemberStatusLabel(member.status) }}</text>
                      <text>{{ formatDate(member.lastLoginAt) || '暂无' }}</text>
                      <view>
                        <button class="outline-small" :disabled="!teamPermissions.canManageMembers" @click="assignMemberProject(member)">分配项目</button>
                        <button class="outline-small" :disabled="!teamPermissions.canManageMembers || member.status === 'disabled'" @click="confirmSuspendMember(member)">暂停</button>
                        <button class="outline-small danger" :disabled="!teamPermissions.canManageMembers" @click="confirmRemoveMember(member)">移除</button>
                      </view>
                    </view>
                  </view>
                </view>
                <view class="version-list">
                  <view v-for="invite in teamCenter.invites" :key="invite.inviteId">
                    <text>邀请：{{ invite.targetAccountMasked }} · {{ getTeamRoleLabel(invite.role) }} · {{ invite.status }}</text>
                    <text>有效期至 {{ formatDate(invite.expiresAt) }}</text>
                    <view class="project-actions-row">
                      <button class="outline-small" :disabled="invite.status !== 'pending'" @click="resendTeamInvite(invite)">重新发送邀请</button>
                      <button class="outline-small danger" :disabled="invite.status !== 'pending'" @click="cancelTeamInvite(invite)">撤销邀请</button>
                    </view>
                  </view>
                </view>
              </view>

              <view v-else-if="teamTab === 'roles'" class="roles-workspace">
                <view class="panel">
                  <view class="panel-head">
                    <view>
                      <text class="panel-title">创建自定义角色</text>
                      <text class="panel-sub">自定义角色默认无权限，需要保存权限后才会生效；企业管理员最高权限规则不可修改。</text>
                    </view>
                  </view>
                  <view class="search-input-row">
                    <input v-model.trim="teamCustomRoleName" placeholder="例如：视觉审核协作员" />
                    <button class="solid-small" :disabled="!teamPermissions.canManageRoles" @click="createCustomTeamRole">创建角色</button>
                  </view>
                </view>
                <view class="project-card-grid">
                  <view v-for="role in teamCenter.roles" :key="role.role" class="project-card" :class="{ active: selectedTeamRole.role === role.role }" @click="selectTeamRole(role)">
                    <view class="project-card-head">
                      <view>
                        <text class="feature-title">{{ role.label }}</text>
                        <text class="row-meta">{{ role.builtin ? '系统角色' : '自定义角色' }} · {{ role.locked ? '最高权限锁定' : '可配置' }}</text>
                      </view>
                      <text class="status-tag">{{ role.permissionCount }} 项</text>
                    </view>
                    <text class="row-meta">数据范围：{{ getDataScopeLabel(role.dataScope) }}</text>
                  </view>
                </view>
                <view class="panel">
                  <view class="panel-head">
                    <view>
                      <text class="panel-title">{{ selectedTeamRole.label || '角色权限' }}</text>
                      <text class="panel-sub">系统最高权限不可修改；其它角色保存后由同一权限服务生效。</text>
                    </view>
                    <button class="solid-small" :disabled="!teamPermissions.canManageRoles || selectedTeamRole.locked" @click="saveSelectedTeamRole">保存权限</button>
                  </view>
                  <view class="permission-groups">
                    <view v-for="group in teamCenter.permissionGroups" :key="group.group" class="permission-group">
                      <text class="feature-title">{{ group.group }}</text>
                      <label v-for="permission in group.permissions" :key="permission.key" class="permission-check">
                        <checkbox :disabled="selectedTeamRole.locked || !teamPermissions.canManageRoles" :checked="selectedTeamRolePermissionSet.has(permission.key)" @click="toggleTeamPermission(permission.key)" />
                        <text>{{ permission.label }}</text>
                      </label>
                    </view>
                  </view>
                </view>
              </view>

              <view v-else class="panel">
                <view class="panel-head">
                  <view>
                    <text class="panel-title">审计日志</text>
                    <text class="panel-sub">支持按成员、动作、模块、项目和时间过滤；日志不可由普通成员删除。</text>
                  </view>
                </view>
                <view class="library-toolbar audit-toolbar">
                  <view class="inline-search"><input v-model.trim="teamAuditKeyword" placeholder="搜索成员、动作、资源或项目" /></view>
                  <picker :range="teamAuditModules" :value="getTeamAuditModuleIndex(teamAuditModule)" @change="onTeamAuditModuleChange">
                    <view class="picker-value">{{ getTeamAuditModuleLabel(teamAuditModule) }}</view>
                  </picker>
                </view>
                <view class="table-scroll">
                  <view class="audit-table">
                    <view class="audit-table-head"><text>时间</text><text>操作人</text><text>动作</text><text>对象</text><text>修改摘要</text><text>IP/设备</text></view>
                    <view v-for="log in filteredTeamAuditLogs" :key="log.logId" class="audit-table-row">
                      <text>{{ formatDate(log.createdAt) }}</text>
                      <text>{{ log.operator }}</text>
                      <text>{{ log.action }}</text>
                      <text>{{ log.resourceType }} / {{ log.resourceId || '-' }}</text>
                      <text>{{ log.beforeSummary || '-' }} → {{ log.afterSummary || '-' }}</text>
                      <text>{{ log.deviceInfo }}</text>
                    </view>
                  </view>
                </view>
                <view v-if="!filteredTeamAuditLogs.length" class="empty-state compact"><text>暂无符合条件的审计日志</text></view>
              </view>
            </view>
          </view>

          <view v-else-if="currentModule === 'projects'" class="module-section project-center">
            <view v-if="projectCreateMode" class="project-create">
              <view class="module-intro">
                <view>
                  <text class="section-kicker">新建项目</text>
                  <text class="section-title">{{ currentProjectCreateStep.label }}</text>
                  <text class="section-desc">采用分步创建，把 AI 出图、AI 制版、版型资产、审核和交付组织到一个专业项目流程。</text>
                </view>
                <button class="outline-action" @click="exitProjectCreate">返回项目中心</button>
              </view>

              <view class="pattern-stepper">
                <view
                  v-for="step in projectCreateSteps"
                  :key="step.key"
                  :class="{ active: projectCreateStep === step.key, done: step.index < currentProjectCreateStep.index }"
                  @click="projectCreateStep = step.key"
                >
                  <text>{{ step.index }}</text>
                  <text>{{ step.label }}</text>
                </view>
              </view>

              <view class="pattern-work-panel">
                <view v-if="projectCreateStep === 'basic'" class="pattern-step-panel">
                  <text class="panel-title">填写项目名称和业务类型</text>
                  <view class="size-grid">
                    <view>
                      <text>项目名称</text>
                      <input v-model.trim="projectForm.projectName" placeholder="例如：春夏女装上新视觉项目" />
                    </view>
                    <view>
                      <text>业务类型</text>
                      <picker :range="projectBusinessTypes" :value="projectBusinessTypeIndex" @change="onProjectBusinessTypeChange">
                        <view class="filter-pill">{{ projectForm.businessType }}</view>
                      </picker>
                    </view>
                  </view>
                </view>

                <view v-else-if="projectCreateStep === 'customer'" class="pattern-step-panel">
                  <text class="panel-title">选择客户 / 品牌</text>
                  <view class="size-grid">
                    <view>
                      <text>客户或品牌名称</text>
                      <input v-model.trim="projectForm.customerName" placeholder="例如：蝶变女装品牌" />
                    </view>
                    <view>
                      <text>业务说明</text>
                      <input v-model.trim="projectForm.customerNote" placeholder="可填写渠道、平台或品牌备注" />
                    </view>
                  </view>
                </view>

                <view v-else-if="projectCreateStep === 'goal'" class="pattern-step-panel">
                  <text class="panel-title">选择项目目标</text>
                  <view class="choice-grid">
                    <view v-for="item in projectGoals" :key="item" :class="{ active: projectForm.projectGoal === item }" @click="projectForm.projectGoal = item">{{ item }}</view>
                  </view>
                </view>

                <view v-else-if="projectCreateStep === 'members'" class="pattern-step-panel">
                  <text class="panel-title">设置负责人和成员</text>
                  <view class="size-grid">
                    <view>
                      <text>负责人</text>
                      <input v-model.trim="projectForm.ownerName" placeholder="例如：项目负责人" />
                    </view>
                    <view>
                      <text>成员角色</text>
                      <input v-model.trim="projectForm.memberText" placeholder="设计师、版师、审核员、只读成员" />
                    </view>
                  </view>
                </view>

                <view v-else-if="projectCreateStep === 'deadline'" class="pattern-step-panel">
                  <text class="panel-title">设置计划交付时间</text>
                  <view class="size-grid">
                    <view>
                      <text>交付日期</text>
                      <input v-model.trim="projectForm.deadline" placeholder="例如：2026-08-15" />
                    </view>
                  </view>
                </view>

                <view v-else class="pattern-step-panel">
                  <text class="panel-title">选择需要的功能模块</text>
                  <view class="choice-grid">
                    <view v-for="item in projectModuleOptions" :key="item" :class="{ active: projectForm.modules.includes(item) }" @click="toggleProjectModule(item)">{{ item }}</view>
                  </view>
                  <view class="task-summary">
                    <text>项目：{{ projectForm.projectName || '未命名项目' }}</text>
                    <text>业务类型：{{ projectForm.businessType }}</text>
                    <text>客户/品牌：{{ projectForm.customerName || '未设置' }}</text>
                    <text>目标：{{ projectForm.projectGoal }}</text>
                    <text>模块：{{ projectForm.modules.join('、') || '未选择' }}</text>
                  </view>
                </view>

                <view class="create-nav">
                  <button class="outline-small" :disabled="projectCreateStepIndex === 0" @click="prevProjectCreateStep">上一步</button>
                  <button v-if="projectCreateStepIndex < projectCreateSteps.length - 1" class="solid-small" @click="nextProjectCreateStep">下一步</button>
                  <button v-else class="solid-small" @click="submitWorkspaceProject">创建项目</button>
                </view>
              </view>
            </view>

            <view v-else-if="selectedWorkspaceProject" class="project-detail">
              <view class="module-intro compact-intro">
                <view>
                  <text class="section-kicker">{{ getWorkspaceProjectStatusLabel(selectedWorkspaceProject.status) }}</text>
                  <text class="section-title">{{ selectedWorkspaceProject.name }}</text>
                  <text class="section-desc">负责人：{{ selectedWorkspaceProject.ownerName || '未设置' }} · 交付日期：{{ selectedWorkspaceProject.deadline || '未设置' }} · 业务类型：{{ selectedWorkspaceProject.businessType || '未设置' }}</text>
                </view>
                <view class="detail-actions">
                  <button class="outline-action" @click="closeWorkspaceProjectDetail">返回列表</button>
                  <button class="solid-action" @click="createProjectDeliveryBatch">创建交付批次</button>
                </view>
              </view>

              <view class="project-overview-strip">
                <view>
                  <text>项目进度</text>
                  <strong>{{ getWorkspaceProjectProgress(selectedWorkspaceProject) }}%</strong>
                </view>
                <view>
                  <text>任务总数</text>
                  <strong>{{ selectedProjectTaskList.length }}</strong>
                </view>
                <view>
                  <text>进行中任务</text>
                  <strong>{{ selectedProjectRunningTasks.length }}</strong>
                </view>
                <view>
                  <text>待审核任务</text>
                  <strong>{{ selectedProjectReviewTasks.length }}</strong>
                </view>
                <view>
                  <text>已完成作品</text>
                  <strong>{{ selectedProjectCompletedWorks.length }}</strong>
                </view>
              </view>

              <view class="detail-tabs">
                <text
                  v-for="tab in projectDetailTabs"
                  :key="tab.key"
                  :class="{ active: projectDetailTab === tab.key }"
                  @click="setProjectDetailTab(tab.key)"
                >
                  {{ tab.label }}
                </text>
              </view>

              <view class="pattern-work-panel">
                <view v-if="projectDetailTab === 'overview'" class="project-tab-panel">
                  <view class="project-actions-row">
                    <button class="solid-small" @click="createProjectAiOutputTask">新建出图任务</button>
                    <button class="outline-small" @click="createProjectPatternTask">新建制版任务</button>
                    <button class="outline-small" @click="addExistingTaskToProject">添加已有任务</button>
                    <button class="outline-small" @click="addPatternToProject">添加版型</button>
                    <button class="outline-small" @click="createProjectDeliveryBatch">创建交付批次</button>
                  </view>
                  <view class="dashboard-grid">
                    <view class="panel">
                      <view class="panel-head"><text class="panel-title">状态流转</text></view>
                      <view class="choice-grid compact">
                        <view v-for="status in workspaceProjectStatuses" :key="status.key" :class="{ active: selectedWorkspaceProject.status === status.key }" @click="changeProjectStatus(status.key)">{{ status.label }}</view>
                      </view>
                    </view>
                    <view class="panel">
                      <view class="panel-head"><text class="panel-title">最近动态</text></view>
                      <view v-if="selectedWorkspaceProject.activity.length" class="version-list">
                        <view v-for="(item, index) in selectedWorkspaceProject.activity.slice(0, 5)" :key="index">
                          <text>{{ getProjectActivityLabel(item.action) }} · {{ item.operatorName || '系统' }}</text>
                          <text>{{ formatDate(item.createdAt) }} {{ item.targetId || '' }}</text>
                        </view>
                      </view>
                      <view v-else class="empty-state compact"><text>暂无项目动态</text></view>
                    </view>
                  </view>
                </view>

                <view v-else-if="projectDetailTab === 'ai-output'" class="task-list">
                  <view v-for="item in selectedProjectAiOutputTasks" :key="item.taskId" class="task-row">
                    <view>
                      <text class="row-title">{{ getTaskName(item) }}</text>
                      <text class="row-meta">{{ getTaskTypeLabel(item.type) }} · {{ getStatusLabel(item.status) }}</text>
                    </view>
                    <button class="outline-small" @click="continueTask(item)">查看结果</button>
                  </view>
                  <view v-if="!selectedProjectAiOutputTasks.length" class="empty-state"><text>暂无 AI 出图任务</text></view>
                </view>

                <view v-else-if="projectDetailTab === 'pattern-tasks'" class="task-list">
                  <view v-for="item in selectedProjectPatternTasks" :key="item.taskId" class="task-row">
                    <view>
                      <text class="row-title">{{ item.title }}</text>
                      <text class="row-meta">{{ item.category || '制版任务' }} · {{ getPatternReviewLabel(item.reviewStatus) }}</text>
                    </view>
                    <button class="outline-small" @click="openPatternTask(item)">查看制版</button>
                  </view>
                  <view v-if="!selectedProjectPatternTasks.length" class="empty-state"><text>暂无 AI 制版任务</text></view>
                </view>

                <view v-else-if="projectDetailTab === 'patterns'" class="library-grid">
                  <view v-for="item in selectedProjectPatterns" :key="item.patternMasterId" class="library-card">
                    <view class="pattern-thumb"><text>{{ item.category ? item.category.slice(0, 1) : '版' }}</text></view>
                    <view class="library-card-body">
                      <text class="feature-title">{{ item.title }}</text>
                      <text class="row-meta">{{ item.patternCode || '未编号' }} · {{ getPatternScopeLabel(item.scope) }}</text>
                      <button class="outline-small" @click="openLibraryDetail(item)">查看版型</button>
                    </view>
                  </view>
                  <view v-if="!selectedProjectPatterns.length" class="empty-state"><text>暂无关联版型资产</text></view>
                </view>

                <view v-else-if="projectDetailTab === 'delivery'" class="version-list">
                  <view v-for="item in selectedWorkspaceProject.deliveryBatchIds" :key="item">
                    <text>{{ item }}</text>
                    <text>交付批次记录作品、尺寸、用途和版本；已交付资产不可静默替换。</text>
                  </view>
                  <view v-if="!selectedWorkspaceProject.deliveryBatchIds.length" class="empty-state"><text>暂无交付批次</text></view>
                </view>

                <view v-else-if="projectDetailTab === 'review'" class="version-list">
                  <view v-for="item in selectedProjectReviewTasks" :key="item.taskId || item.currentVersionId">
                    <text>{{ item.title || getTaskName(item) }}</text>
                    <text>待审核 · mock / fallback / 测试图禁止批准交付</text>
                  </view>
                  <view v-if="!selectedProjectReviewTasks.length" class="empty-state"><text>暂无待审核记录</text></view>
                </view>

                <view v-else-if="projectDetailTab === 'members'" class="version-list">
                  <view v-for="member in selectedWorkspaceProject.members" :key="member.memberId || member.name">
                    <text>{{ member.name || '成员' }}</text>
                    <text>{{ member.role || '只读成员' }}</text>
                  </view>
                  <view v-if="!selectedWorkspaceProject.members.length" class="empty-state"><text>暂无项目成员</text></view>
                </view>

                <view v-else class="version-list">
                  <view v-for="item in selectedProjectStatusHistory" :key="item.historyId">
                    <text>{{ item.operatorName || '系统' }}：{{ getWorkspaceProjectStatusLabel(item.fromStatus) }} → {{ getWorkspaceProjectStatusLabel(item.toStatus) }}</text>
                    <text>{{ formatDate(item.createdAt) }} · {{ item.note || '状态变更' }}</text>
                  </view>
                  <view v-if="!selectedProjectStatusHistory.length" class="empty-state"><text>暂无操作日志</text></view>
                </view>
              </view>
            </view>

            <view v-else class="project-list-view">
              <view class="module-intro">
                <view>
                  <text class="section-kicker">项目中心</text>
                  <text class="section-title">把 AI 出图、制版、审核和交付任务组织成项目流程</text>
                  <text class="section-desc">项目只保存任务、作品、版型和交付的引用关系，不复制或覆盖原任务数据；跨项目复用作品时创建引用关系。</text>
                </view>
                <button class="solid-action" @click="startProjectCreate">新建项目</button>
              </view>

              <view class="library-toolbar">
                <view class="inline-search">
                  <input v-model.trim="projectKeyword" placeholder="搜索项目名称、客户、负责人或业务类型" />
                </view>
                <button class="outline-small" @click="startProjectCreate">新建项目</button>
              </view>

              <view class="library-tabs">
                <text
                  v-for="tab in projectTabs"
                  :key="tab.key"
                  :class="{ active: projectTab === tab.key }"
                  @click="projectTab = tab.key"
                >
                  {{ tab.label }} {{ getProjectTabCount(tab.key) }}
                </text>
              </view>

              <view v-if="filteredWorkspaceProjects.length" class="project-card-grid">
                <view v-for="item in filteredWorkspaceProjects" :key="item.projectId" class="project-card" @click="openWorkspaceProject(item)">
                  <view class="project-card-head">
                    <view>
                      <text class="feature-title">{{ item.name }}</text>
                      <text class="row-meta">{{ item.customerName }} · {{ item.businessType }}</text>
                    </view>
                    <text class="status-tag">{{ getWorkspaceProjectStatusLabel(item.status) }}</text>
                  </view>
                  <view class="project-progress">
                    <view class="progress-track"><view class="progress-fill" :style="{ width: getWorkspaceProjectProgress(item) + '%' }"></view></view>
                    <text>{{ getWorkspaceProjectProgress(item) }}%</text>
                  </view>
                  <view class="summary-grid single">
                    <view><text>负责人</text><strong>{{ item.ownerName || '未设置' }}</strong></view>
                    <view><text>交付日期</text><strong>{{ item.deadline || '未设置' }}</strong></view>
                    <view><text>任务/版型/交付</text><strong>{{ getProjectLinkedCount(item) }}</strong></view>
                  </view>
                  <button class="outline-small" @click.stop="openWorkspaceProject(item)">进入项目详情</button>
                </view>
              </view>
              <view v-else class="empty-state">
                <text>暂无项目</text>
                <button class="solid-small" @click="startProjectCreate">创建第一个项目</button>
              </view>
            </view>
          </view>

          <view v-else-if="currentModule === 'library'" class="module-section pattern-library-center">
            <view class="module-intro">
              <view>
                <text class="section-kicker">版型库中心</text>
                <text class="section-title">可检索、可复用、可审核、可训练的专业版型资产库</text>
                <text class="section-desc">采用 patternMaster + patternVersion：版型主体可持续扩展，版本不可变；已审核或已批准版本禁止覆盖，任何修改都会创建新版本或派生链路。</text>
              </view>
              <view class="detail-actions">
                <button class="outline-action" @click="batchImportPatterns">批量导入</button>
                <button class="solid-action" @click="createNewLibraryPattern">新建版型</button>
              </view>
            </view>

            <view class="library-toolbar">
              <view class="inline-search">
                <input v-model.trim="libraryKeyword" placeholder="关键词搜索：版型名称、编号、标签、品类" />
              </view>
              <button class="outline-small" @click="imageSearchPattern">图片相似检索</button>
              <view class="inline-search code-search">
                <input v-model.trim="libraryCodeKeyword" placeholder="编号搜索" />
              </view>
              <button class="outline-small" @click="libraryAdvancedOpen = !libraryAdvancedOpen">高级筛选</button>
            </view>

            <view v-if="libraryAdvancedOpen" class="advanced-filter-panel">
              <view v-for="field in libraryFilterFields" :key="field.key">
                <text>{{ field.label }}</text>
                <picker :range="field.options" :value="getLibraryFilterIndex(field)" @change="onLibraryFilterChange(field, $event)">
                  <view class="filter-pill">{{ libraryFilters[field.key] || '全部' }}</view>
                </picker>
              </view>
              <button class="text-btn" @click="resetLibraryFilters">清空筛选</button>
            </view>

            <view class="library-tabs">
              <text
                v-for="tab in libraryTabs"
                :key="tab.key"
                :class="{ active: libraryTab === tab.key }"
                @click="libraryTab = tab.key"
              >
                {{ tab.label }} {{ getLibraryTabCount(tab.key) }}
              </text>
            </view>

            <view v-if="selectedLibraryPattern" class="library-detail">
              <view class="module-intro compact-intro">
                <view>
                  <text class="section-kicker">{{ selectedLibraryPattern.patternCode || '未编号' }}</text>
                  <text class="section-title">{{ selectedLibraryPattern.title }}</text>
                  <text class="section-desc">来源：{{ getLibrarySourceLabel(selectedLibraryPattern.source) }} · 权限：{{ getPatternScopeLabel(selectedLibraryPattern.scope) }} · 当前版本：{{ selectedLibraryVersion.versionNo || 'V1' }}</text>
                </view>
                <button class="outline-action" @click="closeLibraryDetail">返回列表</button>
              </view>

              <view class="detail-tabs">
                <text
                  v-for="tab in libraryDetailTabs"
                  :key="tab.key"
                  :class="{ active: libraryDetailTab === tab.key }"
                  @click="libraryDetailTab = tab.key"
                >
                  {{ tab.label }}
                </text>
              </view>

              <view class="pattern-work-panel">
                <view v-if="libraryDetailTab === 'basic'" class="detail-grid">
                  <view class="panel stat-panel"><text class="stat-label">服装品类</text><text class="stat-value small">{{ selectedLibraryPattern.category || '未记录' }}</text></view>
                  <view class="panel stat-panel"><text class="stat-label">审核状态</text><text class="stat-value small">{{ getLibraryReviewLabel(selectedLibraryPattern.reviewStatus) }}</text></view>
                  <view class="panel stat-panel"><text class="stat-label">数据权限</text><text class="stat-value small">{{ getPatternScopeLabel(selectedLibraryPattern.scope) }}</text></view>
                  <view class="panel stat-panel"><text class="stat-label">父版型</text><text class="stat-value small">{{ selectedLibraryPattern.parentPatternMasterId || '无' }}</text></view>
                  <view class="panel stat-panel"><text class="stat-label">派生数量</text><text class="stat-value small">{{ selectedLibraryPattern.derivedPatternIds.length }}</text></view>
                  <view class="panel stat-panel"><text class="stat-label">关联项目</text><text class="stat-value small">{{ selectedLibraryPattern.linkedProjectIds.length }}</text></view>
                </view>

                <view v-else-if="libraryDetailTab === 'technical'" class="technical-preview">结构缩略图 / 正背面技术结构图</view>
                <view v-else-if="libraryDetailTab === 'pieces'" class="technical-preview revised">版片结构预览：前片、后片、袖片、领片与局部结构</view>
                <view v-else-if="libraryDetailTab === 'sizes'" class="summary-grid">
                  <view v-for="field in patternSizeFields" :key="field.key">
                    <text>{{ field.label }}</text>
                    <strong>{{ selectedLibraryVersion.sizeParams[field.key] || '待确认' }}</strong>
                  </view>
                  <view><text>尺码范围</text><strong>{{ selectedLibraryPattern.sizeRange }}</strong></view>
                </view>
                <view v-else-if="libraryDetailTab === 'craft'" class="pattern-step-panel">
                  <text class="panel-title">工艺说明</text>
                  <text class="section-desc">{{ selectedLibraryVersion.craftNote || '暂无工艺说明' }}</text>
                </view>
                <view v-else-if="libraryDetailTab === 'fabric'" class="task-summary">
                  <text>面料属性：{{ selectedLibraryPattern.fabric }}</text>
                  <text>适用季节：{{ selectedLibraryPattern.season }}</text>
                  <text>松量：{{ selectedLibraryPattern.ease }}</text>
                </view>
                <view v-else-if="libraryDetailTab === 'versions'" class="version-list">
                  <view v-for="version in selectedLibraryVersions" :key="version.versionId">
                    <text>{{ version.versionNo }} · {{ getLibraryVersionStatusLabel(version.status) }} · {{ getPatternReviewLabel(version.reviewStatus) }}</text>
                    <text>{{ formatDate(version.updatedAt) }} · {{ version.productionAvailable ? '审核参考可用' : '不可生产' }}</text>
                  </view>
                </view>
                <view v-else-if="libraryDetailTab === 'review'" class="pattern-step-panel">
                  <text class="panel-title">审核记录</text>
                  <text class="section-desc">审核通过且已授权的数据才可进入 AI 训练候选集；下载、复制、审核和导出应记录审计日志。</text>
                  <button class="outline-small" @click="submitLibraryReview(selectedLibraryPattern)">提交审核</button>
                </view>
                <view v-else class="task-summary">
                  <text>父版型：{{ selectedLibraryPattern.parentPatternMasterId || '无' }}</text>
                  <text>派生版型：{{ selectedLibraryPattern.derivedPatternIds.length ? selectedLibraryPattern.derivedPatternIds.join('、') : '暂无' }}</text>
                  <text>关联项目：{{ selectedLibraryPattern.linkedProjectIds.length ? selectedLibraryPattern.linkedProjectIds.join('、') : '暂无' }}</text>
                </view>

                <view class="detail-footer-actions">
                  <button class="outline-small" @click="toggleLibraryFavorite(selectedLibraryPattern)">{{ selectedLibraryPattern.favorite ? '取消收藏' : '收藏' }}</button>
                  <button class="outline-small" @click="usePatternForMaking(selectedLibraryPattern)">引用制版</button>
                  <button class="outline-small" @click="createLibraryVariant(selectedLibraryPattern)">创建变体</button>
                  <button class="outline-small" @click="copyLibraryPattern(selectedLibraryPattern)">复制到个人库</button>
                  <button class="outline-small" @click="submitLibraryReview(selectedLibraryPattern)">提交审核</button>
                  <button class="outline-small danger" @click="archiveLibraryPattern(selectedLibraryPattern)">归档</button>
                </view>
              </view>
            </view>

            <view v-else>
              <view v-if="filteredLibraryPatterns.length" class="library-grid">
                <view v-for="item in filteredLibraryPatterns" :key="item.patternMasterId" class="library-card">
                  <view class="pattern-thumb">
                    <text>{{ item.category ? item.category.slice(0, 1) : '版' }}</text>
                  </view>
                  <view class="library-card-body">
                    <view class="feature-top">
                      <view>
                        <text class="feature-title">{{ item.title }}</text>
                        <text class="row-meta">{{ item.patternCode || '未编号' }} · {{ item.category || '未分类' }}</text>
                      </view>
                      <text class="status-tag">{{ getLibraryReviewLabel(item.reviewStatus) }}</text>
                    </view>
                    <view class="tag-row">
                      <text v-for="tag in item.tags.slice(0, 4)" :key="tag">{{ tag }}</text>
                    </view>
                    <view class="feature-detail">
                      <text>当前版本：{{ getLibraryCurrentVersion(item).versionNo || 'V1' }}</text>
                      <text>数据权限：{{ getPatternScopeLabel(item.scope) }}</text>
                      <text>最近更新：{{ formatDate(item.updatedAt) }}</text>
                    </view>
                    <view class="feature-actions wrap">
                      <button class="outline-small" @click="openLibraryDetail(item)">查看详情</button>
                      <button class="outline-small" @click="toggleLibraryFavorite(item)">{{ item.favorite ? '已收藏' : '收藏' }}</button>
                      <button class="outline-small" @click="usePatternForMaking(item)">引用制版</button>
                      <button class="outline-small" @click="createLibraryVariant(item)">创建变体</button>
                      <button class="outline-small" @click="copyLibraryPattern(item)">复制到个人库</button>
                      <button class="outline-small" @click="submitLibraryReview(item)">提交审核</button>
                    </view>
                  </view>
                </view>
              </view>
              <view v-else class="empty-state">
                <text>当前筛选下暂无版型资产</text>
                <button class="solid-small" @click="createNewLibraryPattern">新建版型</button>
              </view>
            </view>
          </view>

          <view v-else-if="currentModule === 'todos'" class="module-section todos-center">
            <view class="module-intro">
              <view>
                <text class="section-kicker">待办中心</text>
                <text class="section-title">集中处理审核、失败任务、交付和额度提醒</text>
                <text class="section-desc">所有待办都来自当前企业和当前工作台数据；无权限的数据不会显示名称、缩略图或数量。</text>
              </view>
              <button class="outline-action" @click="openSearchPanel">搜索待办</button>
            </view>
            <view v-if="workspaceTodos.length" class="todo-list">
              <view v-for="todo in workspaceTodos" :key="todo.todoId" class="todo-card">
                <view>
                  <text class="feature-title">{{ todo.title }}</text>
                  <text class="row-meta">{{ todo.typeLabel }} · 负责人：{{ todo.owner }} · 项目：{{ getTodoProjectName(todo) }}</text>
                  <text class="section-desc">截止：{{ todo.dueAt ? formatDate(todo.dueAt) : '按项目节奏处理' }}</text>
                </view>
                <button class="solid-small" @click="openTodo(todo)">处理</button>
              </view>
            </view>
            <view v-else class="empty-state">
              <text>暂无待办事项</text>
              <button class="outline-small" @click="selectModule('overview')">返回工作台</button>
            </view>
          </view>

          <view v-else-if="currentModule === 'settings'" class="module-section settings-center">
            <view class="module-intro">
              <view>
                <text class="section-kicker">设置与账号中心</text>
                <text class="section-title">个人、企业、通知、安全和生成偏好统一管理</text>
                <text class="section-desc">设置按模块独立保存。生成偏好只作为新任务默认值，不覆盖任务中手动选择的参数。</text>
              </view>
              <button class="outline-action" @click="loadSettingsCenter">刷新设置</button>
            </view>
            <view class="settings-layout">
              <view class="settings-side">
                <text v-for="tab in settingsTabs" :key="tab.key" :class="{ active: settingsTab === tab.key }" @click="setSettingsTab(tab.key)">{{ tab.label }}</text>
              </view>
              <view class="settings-main panel">
                <view v-if="settingsTab === 'profile'" class="settings-panel">
                  <view class="panel-head">
                    <view>
                      <text class="panel-title">个人资料</text>
                      <text class="panel-sub">修改手机号或邮箱需要验证码确认；当前仅保存资料草稿和验证提示。</text>
                    </view>
                    <button class="solid-small" @click="saveProfileSettings">保存个人资料</button>
                  </view>
                  <view class="form-grid">
                    <label><text>头像</text><input v-model.trim="settingsProfileForm.avatar" placeholder="头像 URL 或后续上传结果" /></label>
                    <label><text>姓名/昵称</text><input v-model.trim="settingsProfileForm.name" placeholder="请输入姓名或昵称" /></label>
                    <label><text>手机号</text><input v-model.trim="settingsProfileForm.rawPhone" placeholder="修改需验证码确认" /></label>
                    <label><text>邮箱</text><input v-model.trim="settingsProfileForm.rawEmail" placeholder="修改需验证码确认" /></label>
                    <label><text>职业身份</text><input v-model.trim="settingsProfileForm.identity" placeholder="例如：设计师、版师、商家" /></label>
                    <label>
                      <text>默认进入模块</text>
                      <picker :range="settingsDefaultModuleLabels" :value="settingsDefaultModuleIndex" @change="onSettingsDefaultModuleChange">
                        <view class="picker-value">{{ getSettingsModuleLabel(settingsProfileForm.defaultModule) }}</view>
                      </picker>
                    </label>
                    <label>
                      <text>界面语言</text>
                      <picker :range="settingLanguageOptions" :value="settingLanguageIndex" @change="onSettingLanguageChange">
                        <view class="picker-value">{{ settingsProfileForm.language }}</view>
                      </picker>
                    </label>
                  </view>
                </view>

                <view v-else-if="settingsTab === 'security'" class="settings-panel">
                  <view class="panel-head">
                    <view>
                      <text class="panel-title">账号安全</text>
                      <text class="panel-sub">敏感操作必须二次确认，不显示完整令牌、密钥或登录凭证。</text>
                    </view>
                  </view>
                  <view class="project-card-grid">
                    <view v-for="item in securityActions" :key="item.action" class="project-card">
                      <text class="feature-title">{{ item.label }}</text>
                      <text class="row-meta">{{ item.desc }}</text>
                      <button class="outline-small" @click="confirmSecurityAction(item)">执行</button>
                    </view>
                  </view>
                  <view class="version-list">
                    <view><text>最近登录记录</text><text>真实登录记录接入后在此展示；当前不展示设备令牌。</text></view>
                    <view><text>微信账号绑定</text><text>通过企业登录服务完成，不在设置页保存开放身份。</text></view>
                  </view>
                </view>

                <view v-else-if="settingsTab === 'enterprise'" class="settings-panel">
                  <view class="panel-head">
                    <view>
                      <text class="panel-title">企业资料</text>
                      <text class="panel-sub">{{ settingsCenter.canManageEnterprise ? '管理员可修改企业资料。' : '普通成员仅可查看企业资料。' }}</text>
                    </view>
                    <button class="solid-small" :disabled="!settingsCenter.canManageEnterprise" @click="saveEnterpriseSettings">保存企业资料</button>
                  </view>
                  <view class="form-grid">
                    <label><text>企业名称</text><input v-model.trim="settingsEnterpriseForm.enterpriseName" :disabled="!settingsCenter.canManageEnterprise" /></label>
                    <label><text>企业 Logo</text><input v-model.trim="settingsEnterpriseForm.logo" :disabled="!settingsCenter.canManageEnterprise" placeholder="Logo URL" /></label>
                    <label><text>联系方式</text><input v-model.trim="settingsEnterpriseForm.contact" :disabled="!settingsCenter.canManageEnterprise" /></label>
                    <label><text>行业类型</text><input v-model.trim="settingsEnterpriseForm.industry" :disabled="!settingsCenter.canManageEnterprise" /></label>
                    <label><text>默认项目规范</text><input v-model.trim="settingsEnterpriseForm.defaultProjectSpec" :disabled="!settingsCenter.canManageEnterprise" /></label>
                    <label><text>默认交付规范</text><input v-model.trim="settingsEnterpriseForm.defaultDeliverySpec" :disabled="!settingsCenter.canManageEnterprise" /></label>
                    <label><text>团队品牌色</text><input v-model.trim="settingsEnterpriseForm.brandColor" :disabled="!settingsCenter.canManageEnterprise" /></label>
                  </view>
                  <button class="outline-small" @click="goEnterpriseLogin">切换当前企业</button>
                </view>

                <view v-else-if="settingsTab === 'generation'" class="settings-panel">
                  <view class="panel-head">
                    <view>
                      <text class="panel-title">生成偏好</text>
                      <text class="panel-sub">仅作为新任务默认值；任务创建页手动选择优先级更高。</text>
                    </view>
                    <button class="solid-small" @click="saveGenerationSettings">保存生成偏好</button>
                  </view>
                  <view class="form-grid">
                    <label><text>默认图片比例</text><picker :range="generationRatioOptions" :value="getOptionIndex(generationRatioOptions, settingsGenerationForm.defaultRatio)" @change="onGenerationOptionChange('defaultRatio', generationRatioOptions, $event)"><view class="picker-value">{{ settingsGenerationForm.defaultRatio }}</view></picker></label>
                    <label><text>默认生成数量</text><input type="number" v-model.number="settingsGenerationForm.defaultCount" /></label>
                    <label><text>默认清晰度</text><picker :range="generationQualityOptions" :value="getOptionIndex(generationQualityOptions, settingsGenerationForm.defaultQuality)" @change="onGenerationOptionChange('defaultQuality', generationQualityOptions, $event)"><view class="picker-value">{{ settingsGenerationForm.defaultQuality }}</view></picker></label>
                    <label><text>默认生成模式</text><picker :range="generationModeOptions" :value="getOptionIndex(generationModeOptions, settingsGenerationForm.defaultMode)" @change="onGenerationOptionChange('defaultMode', generationModeOptions, $event)"><view class="picker-value">{{ settingsGenerationForm.defaultMode }}</view></picker></label>
                    <label><text>默认命名规则</text><input v-model.trim="settingsGenerationForm.namingRule" /></label>
                    <label><text>默认下载格式</text><input v-model.trim="settingsGenerationForm.downloadFormat" /></label>
                    <label><text>默认审核流程</text><picker :range="reviewFlowOptions" :value="getOptionIndex(reviewFlowOptions, settingsGenerationForm.reviewFlow)" @change="onGenerationOptionChange('reviewFlow', reviewFlowOptions, $event)"><view class="picker-value">{{ settingsGenerationForm.reviewFlow }}</view></picker></label>
                    <label><text>默认保存项目</text><input v-model.trim="settingsGenerationForm.defaultProjectId" placeholder="项目 ID，可留空" /></label>
                  </view>
                </view>

                <view v-else-if="settingsTab === 'notifications'" class="settings-panel">
                  <view class="panel-head">
                    <view>
                      <text class="panel-title">通知设置</text>
                      <text class="panel-sub">未接入的微信通知和邮件通知标记为暂未开通。</text>
                    </view>
                    <button class="solid-small" @click="saveNotificationSettings">保存通知设置</button>
                  </view>
                  <view class="notification-table">
                    <view class="notification-row head"><text>事件</text><text v-for="channel in settingsCenter.channels" :key="channel.key">{{ channel.label }}</text></view>
                    <view v-for="event in notificationEvents" :key="event.key" class="notification-row">
                      <text>{{ event.label }}</text>
                      <label v-for="channel in settingsCenter.channels" :key="channel.key" class="permission-check">
                        <checkbox :disabled="!channel.available" :checked="Boolean(settingsNotificationForm[event.key] && settingsNotificationForm[event.key][channel.key])" @click="toggleNotification(event.key, channel)" />
                        <text>{{ channel.available ? '开启' : '暂未开通' }}</text>
                      </label>
                    </view>
                  </view>
                </view>

                <view v-else-if="settingsTab === 'storage'" class="settings-panel">
                  <view class="panel-head">
                    <view>
                      <text class="panel-title">存储与下载</text>
                      <text class="panel-sub">不提供“无限存储”承诺，保留期限以企业策略和平台规则为准。</text>
                    </view>
                    <button class="solid-small" @click="saveStorageSettings">保存存储设置</button>
                  </view>
                  <view class="form-grid">
                    <label><text>默认下载格式</text><input v-model.trim="settingsStorageForm.downloadFormat" /></label>
                    <label><text>图片命名规则</text><input v-model.trim="settingsStorageForm.namingRule" /></label>
                    <label class="switch-line"><checkbox :checked="settingsStorageForm.keepOriginalFiles" @click="settingsStorageForm.keepOriginalFiles = !settingsStorageForm.keepOriginalFiles" /><text>保留原始文件</text></label>
                    <label class="switch-line"><checkbox :checked="settingsStorageForm.autoAddToProject" @click="settingsStorageForm.autoAddToProject = !settingsStorageForm.autoAddToProject" /><text>自动加入项目</text></label>
                    <label><text>文件保留期限说明</text><input v-model.trim="settingsStorageForm.retentionNote" /></label>
                  </view>
                  <view class="summary-grid single">
                    <view><text>企业存储统计</text><strong>待接入真实存储统计</strong></view>
                  </view>
                </view>

                <view v-else-if="settingsTab === 'billing'" class="settings-panel">
                  <view class="panel-head">
                    <view>
                      <text class="panel-title">额度与账单</text>
                      <text class="panel-sub">额度明细来自真实消费或回滚记录；无记录时不使用静态数字。</text>
                    </view>
                    <button class="outline-small" @click="goEnterpriseLogin">联系企业顾问</button>
                  </view>
                  <view class="summary-grid single">
                    <view><text>当前方案</text><strong>{{ settingsCenter.billing.planName }}</strong></view>
                    <view><text>剩余额度</text><strong>{{ settingsCenter.billing.remainingQuota || '暂无真实记录' }}</strong></view>
                    <view><text>本月已使用</text><strong>{{ settingsCenter.billing.hasRealRecords ? settingsCenter.billing.usedThisMonth : '暂无真实记录' }}</strong></view>
                    <view><text>回滚记录</text><strong>{{ settingsCenter.billing.hasRealRecords ? settingsCenter.billing.rolledBack : '暂无真实记录' }}</strong></view>
                    <view><text>到期时间</text><strong>{{ settingsCenter.billing.expiresAt || '未配置' }}</strong></view>
                  </view>
                  <view class="version-list">
                    <view v-for="record in settingsCenter.billing.records" :key="record.recordId">
                      <text>{{ record.action }} · {{ record.status }} · {{ record.cost }}</text>
                      <text>{{ formatDate(record.createdAt) }} · {{ record.taskId || '无任务关联' }}</text>
                    </view>
                    <view v-if="!settingsCenter.billing.records.length" class="empty-state compact"><text>暂无真实额度使用明细</text></view>
                  </view>
                </view>

                <view v-else class="settings-panel">
                  <view class="panel-head">
                    <view>
                      <text class="panel-title">数据与隐私</text>
                      <text class="panel-sub">AI 训练授权默认关闭；未明确授权的数据不得进入训练集。</text>
                    </view>
                    <button class="solid-small" @click="savePrivacySettings">保存隐私设置</button>
                  </view>
                  <view class="version-list">
                    <label class="switch-line"><checkbox :checked="settingsPrivacyForm.dataExportRequested" @click="settingsPrivacyForm.dataExportRequested = !settingsPrivacyForm.dataExportRequested" /><text>个人数据导出申请</text></label>
                    <view><text>作品授权范围</text><input v-model.trim="settingsPrivacyForm.workLicenseScope" /></view>
                    <view><text>版型授权范围</text><input v-model.trim="settingsPrivacyForm.patternLicenseScope" /></view>
                    <label class="switch-line"><checkbox :checked="settingsPrivacyForm.aiTrainingAuthorized" @click="settingsPrivacyForm.aiTrainingAuthorized = !settingsPrivacyForm.aiTrainingAuthorized" /><text>授权进入 AI 训练候选集</text></label>
                    <view><text>隐私政策</text><text>将跳转官网政策页面，当前保留入口。</text></view>
                    <view><text>用户协议</text><text>将跳转官网协议页面，当前保留入口。</text></view>
                    <label class="switch-line"><checkbox :checked="settingsPrivacyForm.cancellationRequested" @click="settingsPrivacyForm.cancellationRequested = !settingsPrivacyForm.cancellationRequested" /><text>申请注销账号</text></label>
                  </view>
                </view>
              </view>
            </view>
          </view>

          <view v-else-if="currentModule === 'analytics'" class="module-section analytics-center">
            <view class="module-intro">
              <view>
                <text class="section-kicker">产品数据分析</text>
                <text class="section-title">用真实事件判断功能是否被找到、任务是否顺利完成</text>
                <text class="section-desc">仅统计当前企业授权范围内的脱敏事件；开发环境、mock任务和内部自动测试不会进入正式看板。</text>
              </view>
              <button class="outline-action" @click="loadAnalyticsCenter">刷新数据</button>
            </view>

            <view v-if="!analyticsCenter.canAccess" class="panel">
              <db-empty-state title="无权限查看" message="产品数据分析仅企业管理员或授权成员可见。" />
            </view>
            <template v-else>
              <view class="module-grid">
                <view class="panel stat-panel">
                  <text class="stat-value">{{ analyticsCenter.metrics.eventCount || 0 }}</text>
                  <text class="stat-label">有效事件</text>
                  <text class="stat-desc">仅统计正式业务数据</text>
                </view>
                <view class="panel stat-panel">
                  <text class="stat-value">{{ analyticsCenter.metrics.activeUsers || 0 }}</text>
                  <text class="stat-label">活跃用户</text>
                  <text class="stat-desc">按脱敏 userId 去重</text>
                </view>
                <view class="panel stat-panel">
                  <text class="stat-value">{{ analyticsCenter.metrics.taskSuccessCount || 0 }}</text>
                  <text class="stat-label">完成生成</text>
                  <text class="stat-desc">来自真实任务成功事件</text>
                </view>
                <view class="panel stat-panel">
                  <text class="stat-value">{{ analyticsCenter.updatedAt ? formatDate(analyticsCenter.updatedAt) : '暂无' }}</text>
                  <text class="stat-label">更新时间</text>
                  <text class="stat-desc">无事件时不生成演示数字</text>
                </view>
              </view>

              <view class="panel">
                <view class="panel-head">
                  <view>
                    <text class="panel-title">核心漏斗</text>
                    <text class="panel-sub">官网、专业用户和 AI 制版三条链路统一按事件名称统计。</text>
                  </view>
                </view>
                <view v-if="analyticsCenter.funnels && analyticsCenter.funnels.length" class="module-grid compact">
                  <view v-for="funnel in analyticsCenter.funnels" :key="funnel.key" class="panel subtle-panel">
                    <text class="card-title">{{ funnel.label }}</text>
                    <view class="version-list">
                      <view v-for="step in funnel.steps" :key="step.eventName" class="version-row">
                        <view>
                          <text class="row-title">{{ step.label }}</text>
                          <text class="row-meta">{{ step.eventName }}</text>
                        </view>
                        <text class="status-pill">{{ step.count }}次 · {{ step.conversionRate }}%</text>
                      </view>
                    </view>
                  </view>
                </view>
                <db-empty-state v-else title="暂无漏斗数据" message="真实事件产生后，这里会显示每一步转化和流失。" />
              </view>

              <view class="panel">
                <view class="panel-head">
                  <view>
                    <text class="panel-title">功能使用分析</text>
                    <text class="panel-sub">按功能统计访问、创建、成功率、失败率、耗时、重试、审核和额度消耗。</text>
                  </view>
                </view>
                <view v-if="analyticsCenter.featureUsage && analyticsCenter.featureUsage.length" class="data-table scrollable">
                  <view class="table-row table-head">
                    <text>功能</text>
                    <text>访问</text>
                    <text>任务</text>
                    <text>成功率</text>
                    <text>失败率</text>
                    <text>平均耗时</text>
                    <text>平均额度</text>
                  </view>
                  <view v-for="item in analyticsCenter.featureUsage" :key="item.functionType" class="table-row">
                    <text>{{ item.functionType }}</text>
                    <text>{{ item.visitors }}</text>
                    <text>{{ item.taskCount }}</text>
                    <text>{{ item.successRate }}%</text>
                    <text>{{ item.failureRate }}%</text>
                    <text>{{ item.averageDurationMs }}ms</text>
                    <text>{{ item.averageQuotaCost }}</text>
                  </view>
                </view>
                <db-empty-state v-else title="暂无功能数据" message="创建真实任务并上报事件后，这里会显示功能表现。" />
              </view>

              <view class="module-grid">
                <view class="panel">
                  <view class="panel-head tight">
                    <text class="panel-title">导航与查找</text>
                  </view>
                  <view class="version-list">
                    <view class="version-row">
                      <text class="row-title">顶部导航点击</text>
                      <text>{{ analyticsCenter.navigation.topNavClicks || 0 }}</text>
                    </view>
                    <view class="version-row">
                      <text class="row-title">左侧菜单点击</text>
                      <text>{{ analyticsCenter.navigation.sideMenuClicks || 0 }}</text>
                    </view>
                    <view class="version-row">
                      <text class="row-title">搜索次数 / 无结果</text>
                      <text>{{ analyticsCenter.navigation.searchCount || 0 }} / {{ analyticsCenter.navigation.emptySearchCount || 0 }}</text>
                    </view>
                    <view class="version-row">
                      <text class="row-title">进入工作台到创建任务</text>
                      <text>{{ analyticsCenter.navigation.averageTimeToTaskMs || 0 }}ms</text>
                    </view>
                  </view>
                </view>
                <view class="panel">
                  <view class="panel-head tight">
                    <text class="panel-title">搜索关键词与退出页面</text>
                  </view>
                  <view class="tag-row">
                    <text v-for="item in analyticsCenter.navigation.keywords" :key="item.keyword">{{ item.keyword }} · {{ item.count }}</text>
                  </view>
                  <view class="tag-row muted">
                    <text v-for="item in analyticsCenter.navigation.exitPages" :key="item.page">{{ item.page }} · {{ item.count }}</text>
                  </view>
                  <db-empty-state v-if="!(analyticsCenter.navigation.keywords && analyticsCenter.navigation.keywords.length) && !(analyticsCenter.navigation.exitPages && analyticsCenter.navigation.exitPages.length)" title="暂无查找数据" message="全局搜索和页面退出事件产生后会显示在这里。" />
                </view>
              </view>
            </template>
          </view>

          <view v-else-if="currentModule === 'feedback'" class="module-section feedback-center">
            <view class="module-intro">
              <view>
                <text class="section-kicker">用户反馈中心</text>
                <text class="section-title">把结果、版型和工作台问题关联到具体资源并跟进闭环</text>
                <text class="section-desc">反馈记录只保存脱敏说明，不要求用户重复填写已有的任务、项目或版型信息。</text>
              </view>
            </view>
            <view v-if="!feedbackCenter.canAccess" class="panel">
              <db-empty-state title="无权限查看" message="用户反馈中心仅企业管理员或授权成员可见。" />
            </view>
            <template v-else>
              <view class="module-grid">
                <view class="panel stat-panel">
                  <text class="stat-value">{{ feedbackCenter.stats.total }}</text>
                  <text class="stat-label">全部反馈</text>
                </view>
                <view class="panel stat-panel">
                  <text class="stat-value">{{ feedbackCenter.stats.open }}</text>
                  <text class="stat-label">处理中</text>
                </view>
                <view class="panel stat-panel">
                  <text class="stat-value">{{ feedbackCenter.stats.critical }}</text>
                  <text class="stat-label">严重问题</text>
                </view>
                <view class="panel stat-panel">
                  <text class="stat-value">{{ feedbackCenter.stats.closed }}</text>
                  <text class="stat-label">已关闭</text>
                </view>
              </view>

              <view class="panel">
                <view class="panel-head">
                  <view>
                    <text class="panel-title">提交反馈</text>
                    <text class="panel-sub">可关联当前任务、项目、版型或页面，不保存私人图片 URL 和敏感字段。</text>
                  </view>
                  <button class="solid-small" @click="submitProductFeedback">提交反馈</button>
                </view>
                <view class="form-grid">
                  <view>
                    <text class="field-label">问题类型</text>
                    <view class="tag-row">
                      <text v-for="item in feedbackTypes" :key="item.key" :class="{ active: feedbackForm.type === item.key }" @click="feedbackForm.type = item.key">{{ item.label }}</text>
                    </view>
                  </view>
                  <view>
                    <text class="field-label">严重程度</text>
                    <view class="tag-row">
                      <text v-for="item in feedbackSeverities" :key="item" :class="{ active: feedbackForm.severity === item }" @click="feedbackForm.severity = item">{{ item }}</text>
                    </view>
                  </view>
                  <view>
                    <text class="field-label">关联资源类型</text>
                    <input v-model.trim="feedbackForm.resourceType" placeholder="例如：task / project / pattern" />
                  </view>
                  <view>
                    <text class="field-label">关联资源ID</text>
                    <input v-model.trim="feedbackForm.resourceId" placeholder="可选，系统会自动脱敏保存" />
                  </view>
                  <view class="form-wide">
                    <text class="field-label">反馈说明</text>
                    <textarea v-model.trim="feedbackForm.description" placeholder="请描述发生了什么、是否影响交付、希望下一步如何处理" />
                  </view>
                </view>
              </view>

              <view class="panel">
                <view class="panel-head">
                  <view>
                    <text class="panel-title">反馈列表</text>
                    <text class="panel-sub">状态包含 new / triaged / investigating / fixing / verified / closed。</text>
                  </view>
                </view>
                <view v-if="feedbackCenter.items && feedbackCenter.items.length" class="version-list">
                  <view v-for="item in feedbackCenter.items" :key="item.feedbackId" class="version-row">
                    <view>
                      <text class="row-title">{{ item.type }} · {{ item.severity }}</text>
                      <text class="row-meta">{{ item.sourcePage || 'workspace' }} · {{ item.resourceType || '未关联资源' }} · {{ formatDate(item.createdAt) }}</text>
                      <text class="row-meta">{{ item.description }}</text>
                    </view>
                    <view class="row-actions">
                      <text class="status-pill">{{ item.status }}</text>
                      <button v-for="status in feedbackCenter.statusOptions" :key="status" class="text-btn" @click="updateFeedbackStatus(item, status)">{{ status }}</button>
                    </view>
                  </view>
                </view>
                <db-empty-state v-else title="暂无反馈" message="任务结果、版型详情或工作台提交反馈后会显示在这里。" />
              </view>
            </template>
          </view>

          <view v-else-if="currentModule === 'support'" class="module-section support-center">
            <view class="module-intro">
              <view>
                <text class="section-kicker">客服与问题工单中心</text>
                <text class="section-title">把反馈、故障、扣费和企业需求进入可追踪处理流程</text>
                <text class="section-desc">系统自动关联当前用户、企业、页面和资源 ID；不会自动附带私密图片、密钥或敏感日志。</text>
              </view>
              <button class="outline-action" @click="closeSupportTicketDetail">返回工单列表</button>
            </view>

            <view v-if="!supportCenter.canAccess" class="panel">
              <db-empty-state title="无法进入工单中心" message="请先登录并加入企业后再查看或提交工单。" />
            </view>
            <template v-else>
              <view class="module-grid">
                <view class="panel stat-panel">
                  <text class="stat-value">{{ supportCenter.stats.total }}</text>
                  <text class="stat-label">全部工单</text>
                </view>
                <view class="panel stat-panel">
                  <text class="stat-value">{{ supportCenter.stats.open }}</text>
                  <text class="stat-label">处理中</text>
                </view>
                <view class="panel stat-panel">
                  <text class="stat-value">{{ supportCenter.stats.p0 }}</text>
                  <text class="stat-label">P0 严重问题</text>
                </view>
                <view class="panel stat-panel">
                  <text class="stat-value">{{ supportCenter.stats.waitingUser }}</text>
                  <text class="stat-label">等待用户补充</text>
                </view>
              </view>

              <view v-if="!supportCenter.selectedTicket" class="panel">
                <view class="panel-head">
                  <view>
                    <text class="panel-title">创建工单</text>
                    <text class="panel-sub">只需选择类型并说明问题，任务、项目、批次、资产和版型 ID 可选填。</text>
                  </view>
                  <button class="solid-small" @click="submitSupportTicket">提交工单</button>
                </view>
                <view class="form-grid">
                  <view class="form-wide">
                    <text class="field-label">问题类型</text>
                    <view class="tag-row">
                      <text v-for="item in supportTicketTypes" :key="item.key" :class="{ active: supportForm.type === item.key }" @click="supportForm.type = item.key">{{ item.label }}</text>
                    </view>
                  </view>
                  <view>
                    <text class="field-label">任务ID</text>
                    <input v-model.trim="supportForm.taskId" placeholder="可选，taskId" />
                  </view>
                  <view>
                    <text class="field-label">项目ID</text>
                    <input v-model.trim="supportForm.projectId" placeholder="可选，projectId" />
                  </view>
                  <view>
                    <text class="field-label">批次ID</text>
                    <input v-model.trim="supportForm.batchId" placeholder="可选，batchId" />
                  </view>
                  <view>
                    <text class="field-label">资产ID</text>
                    <input v-model.trim="supportForm.assetId" placeholder="可选，assetId" />
                  </view>
                  <view>
                    <text class="field-label">版型ID</text>
                    <input v-model.trim="supportForm.patternId" placeholder="可选，patternId" />
                  </view>
                  <view>
                    <text class="field-label">最近错误码</text>
                    <input v-model.trim="supportForm.recentErrorCode" placeholder="例如：WANX_EMPTY_RESULT" />
                  </view>
                  <view class="form-wide">
                    <text class="field-label">问题说明</text>
                    <textarea v-model.trim="supportForm.description" placeholder="请说明发生了什么、是否扣费、下一步需要客服协助什么" />
                  </view>
                </view>
              </view>

              <view v-if="supportCenter.selectedTicket" class="panel">
                <view class="panel-head">
                  <view>
                    <text class="panel-title">{{ supportCenter.selectedTicket.title }}</text>
                    <text class="panel-sub">{{ supportCenter.selectedTicket.ticketId }} · {{ supportCenter.selectedTicket.typeLabel }} · {{ formatDate(supportCenter.selectedTicket.createdAt) }}</text>
                  </view>
                  <view class="row-actions">
                    <text class="status-pill">{{ supportCenter.selectedTicket.priority }}</text>
                    <text class="status-pill">{{ supportCenter.selectedTicket.status }}</text>
                  </view>
                </view>
                <view class="module-grid compact">
                  <view class="panel subtle-panel">
                    <text class="row-title">关联资源</text>
                    <text class="row-meta">taskId：{{ supportCenter.selectedTicket.taskId || '未关联' }}</text>
                    <text class="row-meta">projectId：{{ supportCenter.selectedTicket.projectId || '未关联' }}</text>
                    <text class="row-meta">batchId：{{ supportCenter.selectedTicket.batchId || '未关联' }}</text>
                    <text class="row-meta">assetId：{{ supportCenter.selectedTicket.assetId || '未关联' }}</text>
                    <text class="row-meta">patternId：{{ supportCenter.selectedTicket.patternId || '未关联' }}</text>
                  </view>
                  <view class="panel subtle-panel">
                    <text class="row-title">服务时效</text>
                    <text class="row-meta">首次响应：{{ supportCenter.selectedTicket.firstResponseAt ? formatDate(supportCenter.selectedTicket.firstResponseAt) : '暂无' }}</text>
                    <text class="row-meta">最近回复：{{ supportCenter.selectedTicket.lastReplyAt ? formatDate(supportCenter.selectedTicket.lastReplyAt) : '暂无' }}</text>
                    <text class="row-meta">等待方：{{ supportCenter.selectedTicket.waitingSide || 'support' }}</text>
                    <text class="row-meta">解决时间：{{ supportCenter.selectedTicket.resolvedAt ? formatDate(supportCenter.selectedTicket.resolvedAt) : '暂无' }}</text>
                  </view>
                </view>

                <view class="panel subtle-panel">
                  <text class="row-title">问题说明</text>
                  <text class="row-meta">{{ supportCenter.selectedTicket.description }}</text>
                  <text class="row-meta">最近错误码：{{ supportCenter.selectedTicket.recentErrorCode || '无' }}</text>
                </view>

                <view v-if="supportCenter.canManage" class="panel subtle-panel">
                  <view class="panel-head tight">
                    <text class="panel-title">客服处理</text>
                  </view>
                  <view class="tag-row">
                    <text v-for="status in supportCenter.statusOptions" :key="status" :class="{ active: supportCenter.selectedTicket.status === status }" @click="updateSupportTicketStatus(supportCenter.selectedTicket, status)">{{ status }}</text>
                  </view>
                  <view class="tag-row">
                    <text v-for="priority in supportTicketPriorities" :key="priority" :class="{ active: supportCenter.selectedTicket.priority === priority }" @click="updateSupportTicketPriority(supportCenter.selectedTicket, priority)">{{ priority }}</text>
                  </view>
                  <view class="form-grid">
                    <view class="form-wide">
                      <text class="field-label">内部备注</text>
                      <textarea v-model.trim="supportInternalNote" placeholder="内部备注不会向用户展示" />
                    </view>
                    <view class="form-wide">
                      <button class="outline-small" @click="addSupportReply(true)">添加内部备注</button>
                    </view>
                  </view>
                </view>

                <view v-if="supportCenter.canManage && supportCenter.selectedTicket.type === 'quota_billing'" class="panel subtle-panel">
                  <view class="panel-head tight">
                    <text class="panel-title">额度补偿申请</text>
                  </view>
                  <view class="form-grid">
                    <view>
                      <text class="field-label">原消费记录</text>
                      <input v-model.trim="supportCompensationForm.sourceUsageRecordId" placeholder="usageRecordId" />
                    </view>
                    <view>
                      <text class="field-label">补偿数量</text>
                      <input v-model.trim="supportCompensationForm.amount" type="number" placeholder="补偿额度" />
                    </view>
                    <view>
                      <text class="field-label">审批人</text>
                      <input v-model.trim="supportCompensationForm.approver" placeholder="审批人" />
                    </view>
                    <view>
                      <text class="field-label">幂等键</text>
                      <input v-model.trim="supportCompensationForm.idempotencyKey" placeholder="避免重复补偿" />
                    </view>
                    <view class="form-wide">
                      <text class="field-label">补偿原因</text>
                      <textarea v-model.trim="supportCompensationForm.reason" placeholder="必须先核对真实消费记录，再记录补偿申请" />
                    </view>
                    <view class="form-wide">
                      <button class="outline-small" @click="submitQuotaCompensation">记录补偿申请</button>
                    </view>
                  </view>
                </view>

                <view class="panel subtle-panel">
                  <view class="panel-head tight">
                    <text class="panel-title">回复用户</text>
                  </view>
                  <textarea v-model.trim="supportReplyText" placeholder="回复内容会向用户展示，请不要包含内部备注、密钥或敏感日志" />
                  <button class="solid-small" @click="addSupportReply(false)">发送回复</button>
                </view>

                <view class="panel subtle-panel">
                  <view class="panel-head tight">
                    <text class="panel-title">处理记录</text>
                  </view>
                  <view v-if="supportCenter.selectedTicket.activities && supportCenter.selectedTicket.activities.length" class="version-list">
                    <view v-for="item in supportCenter.selectedTicket.activities" :key="item.activityId" class="version-row">
                      <view>
                        <text class="row-title">{{ item.type }} · {{ item.visibility }}</text>
                        <text class="row-meta">{{ item.operatorName }} · {{ formatDate(item.createdAt) }}</text>
                        <text class="row-meta">{{ item.visibility === 'internal' && !supportCenter.canManage ? '内部备注不可见' : item.content }}</text>
                      </view>
                    </view>
                  </view>
                  <db-empty-state v-else title="暂无处理记录" message="状态变化、用户回复、内部备注和补偿申请会显示在这里。" />
                </view>
              </view>

              <view v-if="!supportCenter.selectedTicket" class="panel">
                <view class="panel-head">
                  <view>
                    <text class="panel-title">工单列表</text>
                    <text class="panel-sub">普通用户查看自己的工单，企业管理员查看本企业工单。</text>
                  </view>
                </view>
                <view v-if="supportCenter.tickets && supportCenter.tickets.length" class="version-list">
                  <view v-for="item in supportCenter.tickets" :key="item.ticketId" class="version-row" @click="openSupportTicket(item)">
                    <view>
                      <text class="row-title">{{ item.title }}</text>
                      <text class="row-meta">{{ item.ticketId }} · {{ item.typeLabel }} · {{ formatDate(item.updatedAt) }}</text>
                      <text class="row-meta">关联：{{ item.taskId || item.projectId || item.batchId || item.assetId || item.patternId || '未关联资源' }}</text>
                    </view>
                    <view class="row-actions">
                      <text class="status-pill">{{ item.priority }}</text>
                      <text class="status-pill">{{ item.status }}</text>
                    </view>
                  </view>
                </view>
                <db-empty-state v-else title="暂无工单" message="遇到生成失败、扣费疑问或企业合作问题时，可以先创建工单。" />
              </view>
            </template>
          </view>

          <view v-else-if="currentModule === 'experiments'" class="module-section experiments-center">
            <view class="module-intro">
              <view>
                <text class="section-kicker">产品实验中心</text>
                <text class="section-title">记录真实灰度实验，观察功能查找和任务创建是否变顺</text>
                <text class="section-desc">实验只保存配置和统计口径，不伪造指标；未授权成员不可查看或创建。</text>
              </view>
            </view>
            <view v-if="!experimentsCenter.canAccess" class="panel">
              <db-empty-state title="无权限查看" message="产品实验中心仅企业管理员或授权成员可见。" />
            </view>
            <template v-else>
              <view class="module-grid">
                <view class="panel stat-panel">
                  <text class="stat-value">{{ experimentsCenter.stats.total }}</text>
                  <text class="stat-label">实验总数</text>
                </view>
                <view class="panel stat-panel">
                  <text class="stat-value">{{ experimentsCenter.stats.running }}</text>
                  <text class="stat-label">运行中</text>
                </view>
                <view class="panel stat-panel">
                  <text class="stat-value">{{ experimentsCenter.stats.paused }}</text>
                  <text class="stat-label">已暂停</text>
                </view>
                <view class="panel stat-panel">
                  <text class="stat-value">{{ experimentsCenter.stats.completed }}</text>
                  <text class="stat-label">已完成</text>
                </view>
              </view>

              <view class="panel">
                <view class="panel-head">
                  <view>
                    <text class="panel-title">创建实验草稿</text>
                    <text class="panel-sub">用于验证导航、搜索、创建流程或审核交付体验，不影响真实生成链路。</text>
                  </view>
                  <button class="solid-small" @click="createExperimentDraft">创建实验</button>
                </view>
                <view class="form-grid">
                  <view>
                    <text class="field-label">实验名称</text>
                    <input v-model.trim="experimentForm.name" placeholder="例如：优化 AI 出图入口命名" />
                  </view>
                  <view>
                    <text class="field-label">目标指标</text>
                    <input v-model.trim="experimentForm.targetMetric" placeholder="例如：用户完成第一个任务的比例" />
                  </view>
                  <view>
                    <text class="field-label">实验范围</text>
                    <input v-model.trim="experimentForm.scope" placeholder="例如：internal / invited_users / enterprise" />
                  </view>
                  <view class="form-wide">
                    <text class="field-label">实验假设</text>
                    <textarea v-model.trim="experimentForm.hypothesis" placeholder="说明要验证的问题、影响范围和预期结果" />
                  </view>
                </view>
              </view>

              <view class="panel">
                <view class="panel-head">
                  <view>
                    <text class="panel-title">实验列表</text>
                    <text class="panel-sub">只展示真实创建的实验配置，无数据时保持空状态。</text>
                  </view>
                </view>
                <view v-if="experimentsCenter.experiments && experimentsCenter.experiments.length" class="version-list">
                  <view v-for="item in experimentsCenter.experiments" :key="item.experimentId" class="version-row">
                    <view>
                      <text class="row-title">{{ item.name }}</text>
                      <text class="row-meta">{{ item.targetMetric }} · {{ item.scope }} · {{ formatDate(item.createdAt) }}</text>
                      <text class="row-meta">{{ item.hypothesis || '暂无实验假设' }}</text>
                    </view>
                    <text class="status-pill">{{ item.status }}</text>
                  </view>
                </view>
                <db-empty-state v-else title="暂无实验" message="创建实验草稿后，这里会显示实验状态和目标指标。" />
              </view>
            </template>
          </view>

          <view v-else-if="currentModule === 'help'" class="module-section help-center">
            <view class="module-intro">
              <view>
                <text class="section-kicker">帮助中心</text>
                <text class="section-title">按模块找到操作说明和下一步入口</text>
                <text class="section-desc">帮助内容使用独立页面和侧边抽屉，不挤占专业工作区；每篇文章都可以跳转到真实功能路由。</text>
              </view>
              <button class="outline-action" @click="openHelpDrawer()">打开页面帮助</button>
            </view>
            <view class="help-search-row">
              <input v-model.trim="helpKeyword" placeholder="搜索：换模特、结构图、待审核、额度、交付" />
            </view>
            <view class="help-layout">
              <view class="help-category-list">
                <text
                  v-for="item in helpCategories"
                  :key="item.key"
                  :class="{ active: helpCategory === item.key }"
                  @click="setHelpCategory(item.key)"
                >
                  {{ item.label }}
                </text>
              </view>
              <view class="help-article-list">
                <view
                  v-for="item in filteredHelpArticles"
                  :key="item.articleId"
                  class="help-article-card"
                  :class="{ active: selectedHelpArticle && selectedHelpArticle.articleId === item.articleId }"
                  @click="selectHelpArticle(item.articleId)"
                >
                  <text class="row-title">{{ item.title }}</text>
                  <text class="row-meta">{{ item.summary }}</text>
                </view>
                <view v-if="!filteredHelpArticles.length" class="empty-state compact">
                  <text>没有找到相关帮助</text>
                  <button class="outline-small" @click="clearHelpSearch">查看快速开始</button>
                </view>
              </view>
              <view v-if="selectedHelpArticle" class="help-detail panel">
                <view class="panel-head">
                  <view>
                    <text class="panel-title">{{ selectedHelpArticle.title }}</text>
                    <text class="panel-sub">{{ selectedHelpArticle.summary }}</text>
                  </view>
                  <button class="solid-small" @click="openHelpTarget(selectedHelpArticle)">{{ selectedHelpArticle.actionText || '进入功能' }}</button>
                </view>
                <view class="help-section-grid">
                  <view><text>功能用途</text><strong>{{ selectedHelpArticle.sections.purpose }}</strong></view>
                  <view><text>需要准备的素材</text><strong>{{ selectedHelpArticle.sections.materials }}</strong></view>
                  <view><text>推荐图片标准</text><strong>{{ selectedHelpArticle.sections.standard }}</strong></view>
                  <view><text>示例结果</text><strong>{{ selectedHelpArticle.sections.example }}</strong></view>
                </view>
                <view class="help-steps">
                  <text class="panel-title">操作步骤</text>
                  <text v-for="step in selectedHelpArticle.sections.steps" :key="step">{{ step }}</text>
                </view>
                <view class="help-steps warning">
                  <text class="panel-title">常见失败原因</text>
                  <text v-for="item in selectedHelpArticle.sections.failures" :key="item">{{ item }}</text>
                </view>
                <view class="empty-guidance">
                  <text>联系支持</text>
                  <strong>{{ selectedHelpArticle.sections.support }}</strong>
                </view>
              </view>
            </view>
          </view>

          <view v-else class="module-section">
            <view class="module-intro">
              <view>
                <text class="section-kicker">{{ currentMenu.label }}</text>
                <text class="section-title">{{ currentMenu.title }}</text>
                <text class="section-desc">{{ currentMenu.desc }}</text>
              </view>
              <button class="outline-action" @click="handleModulePrimaryAction">{{ currentMenu.action }}</button>
            </view>
            <view class="module-grid">
              <view v-for="item in moduleCards" :key="item.label" class="panel stat-panel">
                <text class="stat-value">{{ item.value }}</text>
                <text class="stat-label">{{ item.label }}</text>
                <text class="stat-desc">{{ item.desc }}</text>
              </view>
            </view>
            <view class="panel">
              <db-empty-state
                title="暂无内容"
                :message="currentMenu.empty"
                :action-label="currentMenu.action"
                @action="handleModulePrimaryAction"
              />
            </view>
          </view>
        </template>
      </view>
    </view>

    <view v-if="quickPanelOpen" class="overlay" @click="quickPanelOpen = false">
      <view class="command-panel" @click.stop>
        <view class="panel-head">
          <view>
            <text class="panel-title">快速创建</text>
            <text class="panel-sub">选择任务类型后进入对应上传或工作台模块。</text>
          </view>
          <button class="text-btn" @click="quickPanelOpen = false">关闭</button>
        </view>
        <view class="command-grid">
          <view v-for="item in quickCreateItems" :key="item.type" @click="handleQuickCreate(item)">
            <text>{{ item.label }}</text>
            <text>{{ item.desc }}</text>
          </view>
        </view>
      </view>
    </view>

    <view v-if="searchPanelOpen" class="overlay" @click="searchPanelOpen = false">
      <view class="command-panel" @click.stop>
        <view class="search-input-row">
          <input
            v-model.trim="searchKeyword"
            focus
            placeholder="输入功能名称，例如：换衣服、版型检索、项目"
            @input="debouncedRunSearch"
            @confirm="openSelectedSearchResult"
            @keydown.down.prevent="moveSearchSelection(1)"
            @keydown.up.prevent="moveSearchSelection(-1)"
            @keydown.enter.prevent="openSelectedSearchResult"
          />
          <button class="text-btn" @click="searchPanelOpen = false">关闭</button>
        </view>
        <view v-if="recentSearches.length && !searchKeyword" class="recent-searches">
          <view class="panel-head tight">
            <text class="panel-title">最近搜索</text>
            <button class="text-btn" @click="clearRecentSearches">清除</button>
          </view>
          <view class="tag-row">
            <text v-for="item in recentSearches" :key="item" @click="useRecentSearch(item)">{{ item }}</text>
          </view>
        </view>
        <view v-if="groupedSearchResults.length" class="result-list grouped">
          <view v-for="group in groupedSearchResults" :key="group.type" class="search-group">
            <text class="search-group-title">{{ group.type }}</text>
            <view
              v-for="item in group.items"
              :key="item.key"
              class="result-row"
              :class="{ active: flatSearchResults[searchSelectedIndex] && flatSearchResults[searchSelectedIndex].key === item.key }"
              @click="handleSearchResult(item)"
            >
              <view>
                <text class="row-title">{{ item.label }}</text>
                <text class="row-meta">{{ item.status || '可进入' }} · {{ item.projectName || '无所属项目' }} · {{ item.updatedAt ? formatDate(item.updatedAt) : '暂无更新时间' }}</text>
              </view>
              <text class="go-mark">{{ item.action || '进入' }}</text>
            </view>
          </view>
        </view>
        <view v-else-if="searchSuggestions.length" class="result-list grouped">
          <text class="search-group-title">相近功能建议</text>
          <view v-for="item in searchSuggestions" :key="item.key" class="result-row" @click="handleSearchResult(item)">
            <view>
              <text class="row-title">{{ item.label }}</text>
              <text class="row-meta">{{ item.desc }}</text>
            </view>
            <text class="go-mark">进入</text>
          </view>
        </view>
        <view v-else class="empty-state compact">
          <text>搜索功能、项目、任务、作品、版型、成员或帮助文档</text>
        </view>
      </view>
    </view>

    <view v-if="notificationPanelOpen" class="overlay" @click="notificationPanelOpen = false">
      <view class="command-panel notification-panel" @click.stop>
        <view class="panel-head">
          <view>
            <text class="panel-title">通知中心</text>
            <text class="panel-sub">未读 {{ unreadNotificationCount }} 条，通知跳转后会定位相关任务或记录。</text>
          </view>
          <view class="project-actions-row">
            <button class="outline-small" @click="markAllNotificationsRead">全部已读</button>
            <button class="text-btn" @click="notificationPanelOpen = false">关闭</button>
          </view>
        </view>
        <view class="library-tabs">
          <text v-for="type in notificationTypes" :key="type.key" :class="{ active: notificationFilter === type.key }" @click="notificationFilter = type.key">{{ type.label }}</text>
        </view>
        <view v-if="filteredNotifications.length" class="notification-list">
          <view v-for="item in filteredNotifications" :key="item.notificationId" class="notification-item" :class="{ unread: !notificationReadIds.includes(item.notificationId) }">
            <view @click="openNotification(item)">
              <text class="feature-title">{{ item.title }}</text>
              <text class="row-meta">{{ getNotificationTypeLabel(item.type) }} · {{ item.createdAt ? formatDate(item.createdAt) : '刚刚' }}</text>
              <text class="section-desc">{{ item.desc }}</text>
            </view>
            <button class="outline-small" @click="markNotificationRead(item.notificationId)">已读</button>
          </view>
        </view>
        <view v-else class="empty-state compact"><text>暂无该类型通知</text></view>
      </view>
    </view>

    <view v-if="helpDrawerOpen" class="overlay help-overlay" @click="closeHelpDrawer">
      <view class="help-drawer" @click.stop>
        <view class="panel-head">
          <view>
            <text class="panel-title">{{ drawerHelpArticle ? drawerHelpArticle.title : '页面帮助' }}</text>
            <text class="panel-sub">{{ drawerHelpArticle ? drawerHelpArticle.summary : '按当前模块展示操作说明。' }}</text>
          </view>
          <button class="text-btn" @click="closeHelpDrawer">关闭</button>
        </view>
        <view v-if="drawerHelpArticle" class="help-drawer-body">
          <view class="help-section-grid compact">
            <view><text>功能用途</text><strong>{{ drawerHelpArticle.sections.purpose }}</strong></view>
            <view><text>需要准备的素材</text><strong>{{ drawerHelpArticle.sections.materials }}</strong></view>
            <view><text>推荐图片标准</text><strong>{{ drawerHelpArticle.sections.standard }}</strong></view>
            <view><text>示例结果</text><strong>{{ drawerHelpArticle.sections.example }}</strong></view>
          </view>
          <view class="help-steps">
            <text class="panel-title">操作步骤</text>
            <text v-for="step in drawerHelpArticle.sections.steps" :key="step">{{ step }}</text>
          </view>
          <view class="help-steps warning">
            <text class="panel-title">常见失败原因</text>
            <text v-for="item in drawerHelpArticle.sections.failures" :key="item">{{ item }}</text>
          </view>
          <view class="empty-guidance">
            <text>下一步</text>
            <strong>{{ drawerHelpArticle.sections.support }}</strong>
          </view>
          <view class="project-actions-row">
            <button class="solid-small" @click="openHelpTarget(drawerHelpArticle)">{{ drawerHelpArticle.actionText || '进入功能' }}</button>
            <button class="outline-small" @click="openHelpCenter(drawerHelpArticle.category)">查看帮助中心</button>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { listTasks } from '../../utils/task/taskLayer'
import { getProjects } from '../../utils/project/projectRepository'
import { getWorkspacePlanHistories } from '../../utils/workspace/workspacePlanHistory'
import { getWorkspaceProductions } from '../../utils/workspace/workspaceProduction'
import {
  WORKSPACE_BATCH_TABS,
  approveWorkspaceBatchTasks,
  createWorkspaceBatchDraft,
  createWorkspaceDelivery,
  listWorkspaceBatches,
  listWorkspaceDeliveries,
  markWorkspaceBatchRetouch,
  pauseWorkspaceBatchPending,
  rejectWorkspaceBatchTask,
  retryWorkspaceBatchFailures
} from '../../utils/workspace/workspaceBatchDeliveryCenter'
import {
  WORKSPACE_TEAM_TABS,
  cancelWorkspaceInvite,
  inviteWorkspaceMember,
  loadWorkspaceTeamCenter,
  removeWorkspaceMember,
  saveWorkspaceRolePermissions,
  updateWorkspaceMemberRole,
  updateWorkspaceMemberStatus
} from '../../utils/workspace/workspaceTeamCenter'
import {
  NOTIFICATION_EVENTS,
  WORKSPACE_SETTINGS_TABS,
  loadWorkspaceSettingsCenter,
  recordWorkspaceSecurityAction,
  saveWorkspaceEnterpriseProfile,
  saveWorkspaceGenerationPreferences,
  saveWorkspaceNotificationSettings,
  saveWorkspacePrivacySettings,
  saveWorkspaceProfile,
  saveWorkspaceStorageSettings
} from '../../utils/workspace/workspaceSettingsCenter'
import {
  WORKSPACE_PROJECT_STATUSES,
  changeWorkspaceProjectStatus,
  createWorkspaceDeliveryBatch,
  createWorkspaceProject,
  linkPatternToWorkspaceProject,
  linkTaskToWorkspaceProject,
  listWorkspaceProjectStatusHistory,
  listWorkspaceProjects
} from '../../utils/workspace/workspaceProjectCenter'
import {
  archivePatternMaster,
  copyPatternToPersonal,
  createDerivedPattern,
  createPatternRevisionVersion,
  createPatternTaskDraft,
  getPatternDashboard,
  getPatternMaster,
  getPatternVersion,
  listPatternLibraryRecords,
  listPatternVersions,
  reviewPatternVersion,
  submitPatternVersionReview,
  togglePatternFavorite
} from '../../utils/workspace/patternMakingRepository'
import {
  ASSET_DETAIL_TABS,
  ASSET_VIEW_MODES,
  WORKSPACE_ASSET_TYPES,
  addWorkspaceAssetToProject,
  archiveWorkspaceAsset,
  batchPatchWorkspaceAssets,
  buildWorkspaceAssets,
  submitWorkspaceAssetReview
} from '../../utils/workspace/workspaceAssetCenter'
import {
  TRAINING_TABS,
  activateModel,
  approveCandidateModel,
  createCandidateModel,
  createTrainingDataset,
  loadPatternTrainingCenter,
  rollbackActiveModel,
  updateTrainingDatasetStatus
} from '../../utils/workspace/workspacePatternTrainingCenter'
import {
  MODEL_OPS_TABS,
  advanceReleaseGate,
  createGrayReleasePlan,
  expandRelease,
  loadModelOperationsCenter,
  pauseRelease,
  resolveIncident,
  rollbackRelease
} from '../../utils/workspace/workspaceModelOperationsCenter'
import {
  HELP_CATEGORIES,
  getHelpArticle,
  getModuleHelp,
  getRoleHomeEntries,
  isOnboardingSkipped,
  loadOnboardingTasks,
  markOnboardingTaskDone,
  searchHelpArticles,
  skipOnboarding
} from '../../utils/workspace/workspaceOnboardingCenter'
import { getCurrentSession } from '../../utils/auth/authSessionService'
import { loadProductAnalyticsCenter, recordProductAnalyticsEvent } from '../../utils/analytics/productAnalyticsRepository'
import { FEEDBACK_SEVERITIES, FEEDBACK_TYPES, createProductFeedback, loadProductFeedbackCenter, updateProductFeedback } from '../../utils/analytics/feedbackRepository'
import { createProductExperiment, loadProductExperimentCenter } from '../../utils/analytics/experimentRepository'
import { SUPPORT_TICKET_PRIORITIES, SUPPORT_TICKET_TYPES, addTicketReply, createSupportTicket, loadSupportCenter, requestQuotaCompensation, updateSupportTicket } from '../../utils/support/supportTicketRepository'

const LAST_ROUTE_KEY = 'diebians_workspace_last_route_v1'
const IDENTITY_KEY = 'diebians_workspace_identity'
const AI_OUTPUT_FAVORITE_KEY = 'diebians_workspace_ai_output_favorites_v1'
const AI_OUTPUT_RECENT_KEY = 'diebians_workspace_ai_output_recent_v1'
const AI_OUTPUT_FILTER_KEY = 'diebians_workspace_ai_output_filters_v1'
const SEARCH_RECENT_KEY = 'diebians_workspace_recent_searches_v1'
const NOTIFICATION_READ_KEY = 'diebians_workspace_notification_read_v1'
const COMMAND_RECENT_KEY = 'diebians_workspace_recent_commands_v1'

const PURPOSE_FILTERS = Object.freeze([
  { value: 'all', label: '全部用途' },
  { value: 'model', label: '模特与穿搭' },
  { value: 'design', label: '商品设计' },
  { value: 'display', label: '商品展示' },
  { value: 'marketing', label: '内容营销' }
])

const MATERIAL_FILTERS = Object.freeze([
  { value: 'all', label: '全部素材' },
  { value: 'cloth', label: '服装图' },
  { value: 'person', label: '人物图' },
  { value: 'person_cloth', label: '人物+服装' },
  { value: 'cloth_ref', label: '服装+参考' },
  { value: 'batch', label: 'SKU 批量' }
])

const AI_OUTPUT_GROUPS = [
  {
    title: '模特与穿搭',
    desc: '面向模特图、穿搭图和批量模特展示。',
    purpose: 'model',
    items: [
      { icon: '模', label: '换模特', module: 'ai-output', type: 'model', desc: '把服装换到不同模特身上，生成商品展示图。', material: '服装图或真人图', materialType: 'cloth', output: 'AI 模特展示图', batch: false, params: [{ key: 'modelType', label: '模特类型', value: '按商品风格选择' }, { key: 'style', label: '展示风格', value: '电商 / 社媒 / 品牌' }] },
      { icon: '衣', label: '换衣服', module: 'ai-output', type: 'clothing', desc: '人物与服装换装预览，适合搭配沟通。', material: '人物图 + 服装图', materialType: 'person_cloth', output: '换装预览图', batch: false, planned: true, params: [{ key: 'fit', label: '服装贴合', value: '规划中' }] },
      { icon: '姿', label: '换姿势', module: 'ai-output', type: 'pose', desc: '调整模特姿态，生成更多展示角度。', material: '模特图或真人图', materialType: 'person', output: '姿势变体图', batch: false, planned: true, params: [{ key: 'pose', label: '姿势方向', value: '规划中' }] },
      { icon: '批', label: '批量模特图', module: 'ai-output', type: 'batch-model', desc: '为多款多色 SKU 生成统一风格模特图。', material: 'SKU 图片包', materialType: 'batch', output: '批量模特展示图', batch: true, planned: true, params: [{ key: 'count', label: '出图数量', value: '规划中' }] }
    ]
  },
  {
    title: '商品设计',
    desc: '面向颜色、款式、面料、图案和搭配方向。',
    purpose: 'design',
    items: [
      { icon: '色', label: '换颜色', module: 'ai-output', type: 'color', desc: '保留款式与纹理，生成不同配色方案。', material: '服装图', materialType: 'cloth', output: '多色方案图', batch: false, params: [{ key: 'targetColor', label: '目标颜色', value: '按系列色选择' }, { key: 'texture', label: '保留纹理', value: '默认保留' }] },
      { icon: '改', label: '改款', module: 'ai-output', type: 'refine', desc: '轻改领型、袖型、长度、图案等款式细节。', material: '基础款或参考图', materialType: 'cloth', output: '微改款方案', batch: false, params: [{ key: 'direction', label: '改款方向', value: '领型 / 袖型 / 长度' }, { key: 'strength', label: '改动强度', value: '轻微' }] },
      { icon: '料', label: '换面料', module: 'ai-output', type: 'fabric', desc: '模拟不同面料质感，用于前期设计沟通。', material: '款式图 + 面料参考', materialType: 'cloth_ref', output: '面料替换预览', batch: false, planned: true, params: [{ key: 'fabric', label: '面料类型', value: '规划中' }] },
      { icon: '纹', label: '换图案', module: 'ai-output', type: 'pattern-print', desc: '生成印花、图案和局部装饰预览。', material: '服装图 + 图案方向', materialType: 'cloth_ref', output: '图案预览图', batch: false, planned: true, params: [{ key: 'print', label: '图案位置', value: '规划中' }] },
      { icon: '搭', label: '配饰搭配', module: 'ai-output', type: 'accessory', desc: '围绕服装生成配饰搭配参考。', material: '服装图或搭配参考', materialType: 'cloth_ref', output: '配饰搭配图', batch: false, planned: true, params: [{ key: 'accessory', label: '配饰类型', value: '规划中' }] }
    ]
  },
  {
    title: '商品展示',
    desc: '面向主图、白底图、细节图和场景展示。',
    purpose: 'display',
    items: [
      { icon: '景', label: '换场景', module: 'ai-output', type: 'scene', desc: '生成生活方式、棚拍、电商或品牌场景图。', material: '商品图或模特图', materialType: 'cloth', output: '场景化商品图', batch: false, params: [{ key: 'scene', label: '场景类型', value: '棚拍 / 街拍 / 室内' }, { key: 'background', label: '背景风格', value: '简洁商业风' }] },
      { icon: '主', label: '商品主图', module: 'ai-output', type: 'ecommerce', desc: '生成适合电商平台的清晰商品主图。', material: '单品图', materialType: 'cloth', output: '电商主图', batch: false, params: [{ key: 'layout', label: '主图风格', value: '平台商品主图' }, { key: 'bg', label: '背景颜色', value: '浅色' }] },
      { icon: '白', label: '跨境白底图', module: 'ai-output', type: 'crossborder', desc: '生成白底或浅灰底商品图，适配跨境平台。', material: '商品图', materialType: 'cloth', output: '跨境白底图', batch: true, params: [{ key: 'platform', label: '平台规格', value: '跨境通用' }, { key: 'background', label: '底色', value: '白底 / 浅灰底' }] },
      { icon: '细', label: '细节展示图', module: 'ai-output', type: 'detail', desc: '突出面料、领口、袖口、工艺等商品细节。', material: '商品图或细节图', materialType: 'cloth', output: '细节展示图', batch: false, planned: true, params: [{ key: 'detail', label: '细节类型', value: '规划中' }] }
    ]
  },
  {
    title: '内容营销',
    desc: '面向社媒、电商上新、品牌内容和批量 SKU。',
    purpose: 'marketing',
    items: [
      { icon: '种', label: '小红书种草图', module: 'ai-output', type: 'social', desc: '生成更适合社媒种草的场景和构图。', material: '商品图或模特图', materialType: 'cloth', output: '种草内容图', batch: false, params: [{ key: 'style', label: '种草风格', value: '生活方式 / 穿搭分享' }, { key: 'scene', label: '内容场景', value: '城市 / 室内 / 户外' }] },
      { icon: '新', label: '电商上新图', module: 'ai-output', type: 'new-arrival', desc: '为新品上架生成统一视觉素材。', material: '商品图或 SKU 图片包', materialType: 'batch', output: '上新视觉图', batch: true, planned: true, params: [{ key: 'platform', label: '上新平台', value: '规划中' }] },
      { icon: '品', label: '品牌场景图', module: 'ai-output', type: 'brand-scene', desc: '围绕品牌调性生成统一视觉场景。', material: '商品图 + 品牌方向', materialType: 'cloth_ref', output: '品牌场景素材', batch: false, planned: true, params: [{ key: 'brand', label: '品牌调性', value: '规划中' }] },
      { icon: 'SKU', label: '批量 SKU 出图', module: 'ai-output', type: 'batch', desc: '批量处理多款多色商品视觉资产。', material: 'SKU 图片包', materialType: 'batch', output: '批量上新图', batch: true, params: [{ key: 'count', label: '出图数量', value: '按 SKU 数量' }, { key: 'colors', label: 'SKU 颜色', value: '按上传素材识别' }] }
    ]
  }
]

const PATTERN_ACTIONS = [
  { label: 'AI 结构识别', module: 'pattern-making', type: 'recognition' },
  { label: '结构图生成', module: 'pattern-making', type: 'technical-drawing' },
  { label: '版型推导', module: 'pattern-making', type: 'derivation' },
  { label: '版型库', module: 'pattern-making', type: 'library' },
  { label: '专业审核', module: 'pattern-making', type: 'review' },
  { label: '训练与评估', module: 'pattern-making', type: 'training', planned: true }
]

const PATTERN_SECTIONS = [
  {
    label: 'AI 结构识别',
    type: 'recognition',
    desc: '上传服装正面图，可选背面、侧面、细节图，识别品类、廓形、领型、袖型、衣长、门襟和结构线。',
    entry: '新建识别任务',
    points: ['正面图必需', '背面/侧面/细节图可选', '输出结构识别字段']
  },
  {
    label: '结构图生成',
    type: 'technical-drawing',
    desc: '生成正面技术图、背面技术图、局部结构图和工艺说明草稿，支持版师修订。',
    entry: '进入结构图任务',
    points: ['正背面技术图', '局部结构图', '工艺说明草稿']
  },
  {
    label: '版型推导',
    type: 'derivation',
    desc: '从服装图推导参考版型，或从现有版型生成变体，调整领型、袖型、衣长、松量等参数。',
    entry: '选择版型方向',
    points: ['服装图推导', '现有版型变体', '保存为新版本']
  },
  {
    label: '版型库',
    type: 'library',
    desc: '搜索系统、个人、企业版型，支持收藏、引用、复制和派生，企业版型严格按企业隔离。',
    entry: '进入版型检索',
    points: ['系统版型', '个人版型', '企业版型']
  },
  {
    label: '专业审核',
    type: 'review',
    desc: '对比 AI 原稿与版师修订，记录修改意见，支持审核通过、退回修改和版本历史。',
    entry: '进入审核队列',
    points: ['AI 原稿对比', '版师修订', '版本历史']
  },
  {
    label: '训练与评估',
    type: 'training',
    desc: '仅授权且审核通过的数据可进入训练候选集，模型版本状态只做展示。',
    entry: '查看模型状态',
    planned: true,
    points: ['训练候选集', '模型评估', '仅专业权限']
  }
]

const PATTERN_CREATE_STEPS = [
  { key: 'category', label: '选择服装品类', index: 1 },
  { key: 'images', label: '上传参考图片', index: 2 },
  { key: 'sizes', label: '填写基础尺寸', index: 3 },
  { key: 'direction', label: '结构与版型方向', index: 4 },
  { key: 'reference', label: '选择参考版型', index: 5 },
  { key: 'summary', label: '确认生成摘要', index: 6 },
  { key: 'generate', label: '生成 AI 草稿', index: 7 }
]

const PATTERN_DETAIL_TABS = [
  { key: 'overview', label: '任务概览' },
  { key: 'technical', label: '技术结构图' },
  { key: 'pattern', label: '版型结构' },
  { key: 'sizes', label: '尺寸参数' },
  { key: 'craft', label: '工艺说明' },
  { key: 'review', label: '审核记录' },
  { key: 'history', label: '版本历史' }
]

const LIBRARY_TABS = [
  { key: 'system', label: '系统版型' },
  { key: 'personal', label: '我的版型' },
  { key: 'enterprise', label: '企业版型' },
  { key: 'favorite', label: '收藏版型' },
  { key: 'review', label: '待审核版型' },
  { key: 'archived', label: '已归档版型' }
]

const LIBRARY_DETAIL_TABS = [
  { key: 'basic', label: '基本信息' },
  { key: 'technical', label: '技术结构图' },
  { key: 'pieces', label: '版片结构' },
  { key: 'sizes', label: '尺寸表' },
  { key: 'craft', label: '工艺说明' },
  { key: 'fabric', label: '适用面料' },
  { key: 'versions', label: '版本历史' },
  { key: 'review', label: '审核记录' },
  { key: 'lineage', label: '派生关系' }
]

const LIBRARY_FILTER_FIELDS = [
  { key: 'category', label: '服装品类', options: ['全部', '女装上衣', '连衣裙', '半身裙', '裤装', '外套', '童装', '男装上衣'] },
  { key: 'genderAge', label: '性别与年龄段', options: ['全部', '成人女装', '成人男装', '童装', '中性'] },
  { key: 'silhouette', label: '廓形', options: ['全部', '常规', '修身', '宽松', 'A 字', '直筒'] },
  { key: 'collar', label: '领型', options: ['全部', '常规领型', '圆领', 'V 领', '翻领', '立领'] },
  { key: 'sleeve', label: '袖型', options: ['全部', '常规袖型', '短袖', '长袖', '插肩袖', '泡泡袖'] },
  { key: 'length', label: '衣长', options: ['全部', '常规衣长', '短款', '中长款', '长款'] },
  { key: 'ease', label: '松量', options: ['全部', '标准松量', '修身版型', '宽松版型'] },
  { key: 'fabric', label: '面料属性', options: ['全部', '常规面料', '针织', '梭织', '牛仔', '雪纺'] },
  { key: 'season', label: '适用季节', options: ['全部', '春夏', '秋冬', '四季'] },
  { key: 'sizeRange', label: '尺码范围', options: ['全部', 'XS-L', 'S-XL', 'M-XXL', '童装段'] },
  { key: 'reviewStatus', label: '审核状态', options: ['全部', 'draft', 'pending', 'approved', 'rejected', 'archived'] },
  { key: 'source', label: '创建来源', options: ['全部', 'ai_pattern', 'copied', 'derived', 'manual'] }
]

const PROJECT_TABS = [
  { key: 'all', label: '全部项目' },
  { key: 'active', label: '进行中' },
  { key: 'reviewing', label: '待审核' },
  { key: 'delivering', label: '待交付' },
  { key: 'completed', label: '已完成' },
  { key: 'archived', label: '已归档' }
]

const PROJECT_CREATE_STEPS = [
  { key: 'basic', label: '项目名称与业务类型', index: 1 },
  { key: 'customer', label: '客户 / 品牌', index: 2 },
  { key: 'goal', label: '项目目标', index: 3 },
  { key: 'members', label: '负责人和成员', index: 4 },
  { key: 'deadline', label: '计划交付时间', index: 5 },
  { key: 'modules', label: '功能模块', index: 6 }
]

const PROJECT_DETAIL_TABS = [
  { key: 'overview', label: '项目概览' },
  { key: 'ai-output', label: 'AI 出图任务' },
  { key: 'pattern-tasks', label: 'AI 制版任务' },
  { key: 'patterns', label: '版型资产' },
  { key: 'delivery', label: '作品与交付' },
  { key: 'review', label: '审核记录' },
  { key: 'members', label: '项目成员' },
  { key: 'logs', label: '操作日志' }
]

const PROJECT_BUSINESS_TYPES = ['电商上新', '品牌视觉', '批量 SKU', 'AI 制版', '版型整理', '企业定制']
const PROJECT_GOALS = ['完成新品视觉资产', '建立品牌视觉方案', '批量 SKU 出图', '生成制版参考稿', '整理版型资产', '完成企业定制交付']
const PROJECT_MODULE_OPTIONS = ['AI 出图任务', 'AI 制版任务', '版型资产', '审核流程', '作品交付', '项目成员']

const BATCH_CREATE_STEPS = [
  { key: 'project', label: '项目和任务类型', index: 1 },
  { key: 'upload', label: '图片或 SKU 数据', index: 2 },
  { key: 'global', label: '统一参数', index: 3 },
  { key: 'diff', label: '单项差异参数', index: 4 },
  { key: 'validate', label: '素材与额度校验', index: 5 },
  { key: 'confirm', label: '确认生成', index: 6 }
]

const BATCH_DETAIL_TABS = [
  { key: 'overview', label: '批次概览' },
  { key: 'tasks', label: '任务明细' },
  { key: 'results', label: '生成结果' },
  { key: 'review', label: '审核队列' },
  { key: 'failed', label: '失败任务' },
  { key: 'delivery', label: '交付记录' },
  { key: 'logs', label: '操作日志' }
]

const BATCH_TASK_TYPES = ['批量 SKU 出图', '批量模特图', '跨境白底图', '小红书种草图', '商品主图']
const BATCH_SOURCES = ['项目内创建', 'AI 出图功能创建', '上传 SKU 表格创建', '选择已有作品创建']

const WORKSPACE_MENUS = [
  { module: 'overview', label: '工作台', icon: '台', title: '工作台概览', desc: '查看快捷入口、进行中的任务、待处理事项和最近项目。', action: '快速创建', empty: '暂无工作台数据，建议从 AI 出图或 AI 制版开始。' },
  { module: 'ai-output', label: 'AI 出图', icon: '图', title: 'AI 出图功能中心', desc: '换模特、换衣服、换颜色、换场景、改款、换面料、换图案和批量生成。', action: '新建出图任务', children: AI_OUTPUT_GROUPS.flatMap((group) => group.items) },
  { module: 'pattern-making', label: 'AI 制版', icon: '版', title: 'AI 制版中心', desc: '结构图、版型识别、版型变体、审核、训练数据和模型评估。', action: '新建制版任务', children: PATTERN_ACTIONS },
  { module: 'ai-training', label: '训练评估', icon: '训', title: 'AI 制版训练与评估中心', desc: '管理训练样本、数据集、质量检查、模型评估和模型版本灰度。', action: '查看训练数据', empty: '暂无可用训练样本。' },
  { module: 'model-operations', label: '模型运维', icon: '模', title: 'AI 模型灰度发布与质量监控中心', desc: '模型发布门禁、灰度范围、在线监控、异常保护和快速回滚。', action: '查看发布计划', empty: '暂无模型灰度计划。' },
  { module: 'library', label: '版型库', icon: '库', title: '版型库', desc: '检索、沉淀和复用版型资产，复杂能力保留在网页端。', action: '进入版型检索', empty: '版型库会展示已沉淀资产；当前没有可展示的真实版型记录。' },
  { module: 'projects', label: '项目中心', icon: '项', title: '项目中心', desc: '管理企业项目、负责人、生产状态和交付进度。', action: '查看项目', empty: '暂无项目，企业用户可进入企业工作台创建或查看项目。' },
  { module: 'batch', label: '批量任务', icon: '批', title: '批量任务', desc: '查看批量生成、失败任务和待继续处理任务。', action: '查看任务', empty: '暂无批量任务。' },
  { module: 'delivery', label: '作品与交付', icon: '交', title: '作品与交付', desc: '查看作品资产、审核状态和交付确认事项。', action: '查看作品', empty: '暂无待交付作品。' },
  { module: 'assets', label: '数字资产', icon: '资', title: '作品与数字资产中心', desc: '统一管理生成图片、技术结构图、版型文件、原始素材、精修稿和正式交付资产。', action: '查看资产', empty: '暂无数字资产。' },
  { module: 'analytics', label: '数据分析', icon: '析', title: '产品数据分析', desc: '查看真实事件形成的漏斗、功能使用、导航查找和流失页面，不使用静态演示数字。', action: '刷新数据', empty: '暂无真实分析事件。' },
  { module: 'feedback', label: '用户反馈', icon: '馈', title: '用户反馈中心', desc: '收集任务结果、版型详情和工作台反馈，关联任务、项目或版型并跟踪处理状态。', action: '提交反馈', empty: '暂无用户反馈。' },
  { module: 'support', label: '客服工单', icon: '工', title: '客服与问题工单中心', desc: '统一处理生成故障、扣费问题、企业需求和产品建议，区分用户回复、内部备注和系统日志。', action: '创建工单', empty: '暂无工单。' },
  { module: 'experiments', label: '实验中心', icon: '验', title: '产品实验中心', desc: '管理功能查找、创建流程和审核交付体验的灰度实验，仅展示真实配置。', action: '创建实验', empty: '暂无产品实验。' },
  { module: 'todos', label: '待办中心', icon: '办', title: '待办中心', desc: '集中处理待审核、失败任务、待交付和额度提醒。', action: '查看待办', empty: '暂无待办事项。' },
  { module: 'team', label: '团队管理', icon: '团', title: '团队管理', desc: '成员、角色和权限在企业网页版统一管理。', action: '进入企业团队', empty: '团队管理需要企业账号权限。' },
  { module: 'settings', label: '设置', icon: '设', title: '设置', desc: '管理工作台偏好、身份快捷入口和账号入口。', action: '修改身份偏好', empty: '当前仅支持工作台身份偏好设置。' },
  { module: 'help', label: '帮助中心', icon: '帮', title: '专业用户帮助中心', desc: '按模块查看素材准备、操作步骤、失败原因和支持入口。', action: '搜索帮助', empty: '暂无帮助内容。' }
]

function createDefaultPatternForm() {
  return {
    category: '女装上衣',
    images: { front: true, back: false, side: false, detail: false },
    sizeParams: { bust: '', shoulder: '', length: '', sleeve: '' },
    structureDirection: '常规结构识别',
    patternDirection: '标准松量',
    referencePatternId: '',
    projectId: ''
  }
}

function createDefaultProjectForm() {
  return {
    projectName: '',
    businessType: '电商上新',
    customerName: '',
    customerNote: '',
    projectGoal: '完成新品视觉资产',
    ownerName: '',
    memberText: '设计师、版师、审核员',
    deadline: '',
    modules: ['AI 出图任务', '审核流程', '作品交付']
  }
}

function createDefaultBatchForm() {
  return {
    projectId: '',
    taskType: '批量 SKU 出图',
    source: '项目内创建',
    globalScene: '浅色电商棚拍',
    ratio: '1:1',
    diffFields: '颜色、尺码',
    skuCount: '0',
    idempotencyKey: `batch_${Date.now()}`
  }
}

function createDefaultDeliveryForm() {
  return {
    title: '',
    usage: '电商上新',
    fileFormat: 'JPG/PNG',
    sizeSpec: '平台通用尺寸',
    namingRule: '项目-批次-序号',
    note: '审核通过作品进入正式交付'
  }
}

function createDefaultTeamInviteForm() {
  return {
    targetAccount: '',
    role: 'viewer'
  }
}

function createEmptySettingsCenter() {
  return {
    user: {},
    enterprise: {},
    member: {},
    sessionStatus: '',
    canManageEnterprise: false,
    profile: {},
    enterpriseProfile: {},
    generation: {},
    notifications: {},
    channels: [],
    storage: {},
    privacy: {},
    billing: { records: [], hasRealRecords: false, usedThisMonth: 0, rolledBack: 0 }
  }
}

export default {
  data() {
    return {
      currentModule: 'overview',
      currentType: '',
      sidebarOpen: false,
      sidebarCollapsed: false,
      quickPanelOpen: false,
      searchPanelOpen: false,
      searchKeyword: '',
      searchResults: [],
      searchSelectedIndex: 0,
      recentSearches: [],
      searchDebounceTimer: null,
      notificationPanelOpen: false,
      notificationFilter: 'all',
      notificationReadIds: [],
      recentCommandKeys: [],
      aiOutputKeyword: '',
      purposeFilter: 'all',
      materialFilter: 'all',
      favoriteFeatureTypes: [],
      recentFeatureTypes: [],
      createMode: false,
      createStep: 'feature',
      createFeatureType: '',
      patternCreateMode: false,
      patternCreateStep: 'category',
      patternTaskDetailId: '',
      patternDetailTab: 'overview',
      patternSearchKeyword: '',
      trainingTab: 'overview',
      trainingSampleKeyword: '',
      trainingDatasetSplit: 'train',
      trainingModelStatus: 'all',
      modelOpsTab: 'overview',
      modelOpsReleaseStatus: 'all',
      modelOpsKeyword: '',
      patternTrainingCenter: {
        canAccess: false,
        samples: [],
        eligibleSamples: [],
        qualityQueue: [],
        datasets: [],
        evaluations: [],
        models: [],
        privacyAuthorized: false,
        stats: { sampleCount: 0, eligibleCount: 0, blockedCount: 0, datasetCount: 0, modelCount: 0 }
      },
      modelOperationsCenter: {
        canAccess: false,
        releases: [],
        monitoring: { total: 0, successRate: 0, averageDurationMs: 0, timeoutRate: 0, failureRate: 0, retryRate: 0, revisionLoad: 0, approvalRate: 0, regenerateRate: 0, quotaAbnormal: 0, emptyResultCount: 0, modelTaskCounts: [] },
        incidents: [],
        taskTraces: [],
        models: [],
        stats: { releaseCount: 0, activeReleaseCount: 0, incidentCount: 0, tracedTaskCount: 0 }
      },
      libraryTab: 'enterprise',
      libraryKeyword: '',
      libraryCodeKeyword: '',
      libraryAdvancedOpen: false,
      libraryFilters: {},
      libraryDetailId: '',
      libraryDetailTab: 'basic',
      projectTab: 'all',
      projectKeyword: '',
      projectCreateMode: false,
      projectCreateStep: 'basic',
      projectDetailId: '',
      projectDetailTab: 'overview',
      patternProjectId: '',
      workspaceProjects: [],
      batchTab: 'processing',
      batchKeyword: '',
      batchCreateMode: false,
      batchCreateStep: 'project',
      batchDetailId: '',
      batchDetailTab: 'overview',
      batchForm: createDefaultBatchForm(),
      workspaceBatches: [],
      workspaceDeliveries: [],
      workspaceAssets: [],
      assetKeyword: '',
      assetType: 'all',
      assetViewMode: 'grid',
      assetSort: 'updated_desc',
      assetDetailId: '',
      assetDetailTab: 'preview',
      assetSelectedIds: [],
      assetFilterProjectId: '',
      assetFilterTaskId: '',
      assetFilterBatchId: '',
      assetFilterCreator: '',
      assetFilterReviewStatus: 'all',
      assetFilterDeliveryStatus: 'all',
      assetFilterGenerationMode: 'all',
      assetFilterFormat: 'all',
      assetReviewOptions: ['all', 'not_submitted', 'pending', 'approved', 'rejected'],
      assetDeliveryOptions: ['all', 'not_delivered', 'delivered', 'confirmed'],
      assetTypes: WORKSPACE_ASSET_TYPES,
      assetViewModes: ASSET_VIEW_MODES,
      assetDetailTabs: ASSET_DETAIL_TABS,
      projectForm: createDefaultProjectForm(),
      patternForm: createDefaultPatternForm(),
      patternDashboard: { tasks: [], masters: [], versions: [], pendingReviewCount: 0, approvedCount: 0, draftCount: 0, trainingCandidateCount: 0 },
      selectedIdentity: '',
      tasks: [],
      projects: [],
      planHistories: [],
      productions: [],
      aiOutputGroups: AI_OUTPUT_GROUPS,
      patternActions: PATTERN_ACTIONS,
      patternSections: PATTERN_SECTIONS,
      patternCreateSteps: PATTERN_CREATE_STEPS,
      patternDetailTabs: PATTERN_DETAIL_TABS,
      trainingTabs: TRAINING_TABS,
      modelOpsTabs: MODEL_OPS_TABS,
      libraryTabs: LIBRARY_TABS,
      libraryDetailTabs: LIBRARY_DETAIL_TABS,
      libraryFilterFields: LIBRARY_FILTER_FIELDS,
      projectTabs: PROJECT_TABS,
      projectCreateSteps: PROJECT_CREATE_STEPS,
      projectDetailTabs: PROJECT_DETAIL_TABS,
      workspaceProjectStatuses: WORKSPACE_PROJECT_STATUSES,
      projectBusinessTypes: PROJECT_BUSINESS_TYPES,
      projectGoals: PROJECT_GOALS,
      projectModuleOptions: PROJECT_MODULE_OPTIONS,
      batchTabs: WORKSPACE_BATCH_TABS,
      batchCreateSteps: BATCH_CREATE_STEPS,
      batchDetailTabs: BATCH_DETAIL_TABS,
      batchTaskTypes: BATCH_TASK_TYPES,
      batchSources: BATCH_SOURCES,
      deliveryForm: createDefaultDeliveryForm(),
      teamTab: 'overview',
      teamLoading: false,
      teamError: '',
      teamInviteOpen: false,
      teamInviteForm: createDefaultTeamInviteForm(),
      teamRoleDraft: [],
      teamRoleKeyword: '',
      teamCustomRoleName: '',
      teamAuditKeyword: '',
      teamAuditModule: 'all',
      teamCenter: {
        enterprise: {},
        permissions: {},
        members: [],
        invites: [],
        roles: [],
        permissionGroups: [],
        auditLogs: [],
        dataScopes: [],
        protectedActions: []
      },
      teamTabs: WORKSPACE_TEAM_TABS,
      settingsTab: 'profile',
      settingsCenter: createEmptySettingsCenter(),
      settingsProfileForm: {},
      settingsEnterpriseForm: {},
      settingsGenerationForm: {},
      settingsNotificationForm: {},
      settingsStorageForm: {},
      settingsPrivacyForm: {},
      settingsTabs: WORKSPACE_SETTINGS_TABS,
      analyticsCenter: {
        canAccess: false,
        events: [],
        funnels: [],
        featureUsage: [],
        navigation: { keywords: [], exitPages: [] },
        metrics: {},
        updatedAt: ''
      },
      feedbackCenter: {
        canAccess: false,
        items: [],
        stats: { total: 0, open: 0, critical: 0, closed: 0 }
      },
      experimentsCenter: {
        canAccess: false,
        experiments: [],
        stats: { total: 0, running: 0, paused: 0, completed: 0 }
      },
      feedbackForm: {
        type: 'suggestion',
        severity: 'medium',
        sourcePage: 'workspace',
        resourceType: 'workspace',
        resourceId: '',
        description: ''
      },
      supportCenter: {
        canAccess: false,
        canManage: false,
        tickets: [],
        selectedTicket: null,
        stats: { total: 0, open: 0, p0: 0, waitingUser: 0, resolved: 0 },
        typeOptions: [],
        statusOptions: [],
        priorityOptions: []
      },
      supportTicketId: '',
      supportForm: {
        type: 'ai_generation_failed',
        description: '',
        sourcePage: 'workspace',
        taskId: '',
        projectId: '',
        batchId: '',
        assetId: '',
        patternId: '',
        recentErrorCode: ''
      },
      supportReplyText: '',
      supportInternalNote: '',
      supportCompensationForm: {
        sourceUsageRecordId: '',
        amount: '',
        reason: '',
        approver: '',
        idempotencyKey: ''
      },
      experimentForm: {
        name: '',
        hypothesis: '',
        targetMetric: '用户完成第一个任务的比例',
        scope: 'internal'
      },
      feedbackTypes: FEEDBACK_TYPES,
      feedbackSeverities: FEEDBACK_SEVERITIES,
      supportTicketTypes: SUPPORT_TICKET_TYPES,
      supportTicketPriorities: SUPPORT_TICKET_PRIORITIES,
      notificationEvents: NOTIFICATION_EVENTS,
      workspaceMenus: WORKSPACE_MENUS,
      onboardingTasks: [],
      onboardingSkipped: false,
      helpCategories: HELP_CATEGORIES,
      helpKeyword: '',
      helpCategory: 'quick-start',
      helpArticleId: '',
      helpDrawerOpen: false,
      drawerHelpArticleId: '',
      patternCategories: ['女装上衣', '连衣裙', '半身裙', '裤装', '外套', '童装', '男装上衣'],
      patternImageRequirements: [
        { key: 'front', label: '服装正面图', required: true },
        { key: 'back', label: '服装背面图', required: false },
        { key: 'side', label: '服装侧面图', required: false },
        { key: 'detail', label: '局部细节图', required: false }
      ],
      patternSizeFields: [
        { key: 'bust', label: '胸围', placeholder: '例如：96cm' },
        { key: 'shoulder', label: '肩宽', placeholder: '例如：39cm' },
        { key: 'length', label: '衣长', placeholder: '例如：62cm' },
        { key: 'sleeve', label: '袖长', placeholder: '例如：58cm' }
      ],
      structureDirections: ['常规结构识别', '强调结构线', '强调局部工艺', '生成工艺草稿'],
      patternDirections: ['标准松量', '修身版型', '宽松版型', '短款变体', '长款变体'],
      identities: [
        { value: 'merchant', label: '电商商家', desc: '优先显示商品上新、主图、批量 SKU 和交付。' },
        { value: 'designer', label: '服装设计师', desc: '优先显示改款、换图案、换面料和版型检索。' },
        { value: 'pattern_maker', label: '版师', desc: '优先显示结构图、版型审核和训练评估。' },
        { value: 'brand', label: '品牌团队', desc: '优先显示项目中心、品牌场景和团队协作。' },
        { value: 'factory', label: '工厂/企业', desc: '优先显示批量任务、项目交付和团队权限。' }
      ]
    }
  },
  computed: {
    identitySelected() {
      return !!this.selectedIdentity
    },
    selectedIdentityLabel() {
      const item = this.identities.find((identity) => identity.value === this.selectedIdentity)
      return item ? item.label : '专业用户'
    },
    roleHomeActions() {
      const entries = getRoleHomeEntries(this.selectedIdentity)
      return entries.map((item, index) => ({
        ...item,
        primary: index === 0
      }))
    },
    onboardingVisible() {
      return this.identitySelected && !this.onboardingSkipped && this.onboardingTasks.some((item) => !item.completed)
    },
    onboardingProgressText() {
      const done = this.onboardingTasks.filter((item) => item.completed).length
      return `已完成 ${done}/${this.onboardingTasks.length} 项，可跳过，完成后不会反复弹出。`
    },
    filteredHelpArticles() {
      return searchHelpArticles(this.helpKeyword, this.helpCategory)
    },
    selectedHelpArticle() {
      return getHelpArticle(this.helpArticleId) || this.filteredHelpArticles[0] || null
    },
    drawerHelpArticle() {
      return getHelpArticle(this.drawerHelpArticleId) || getModuleHelp(this.currentModule, this.currentType)
    },
    currentMenu() {
      return this.workspaceMenus.find((item) => item.module === this.currentModule) || this.workspaceMenus[0]
    },
    currentFeature() {
      return [...this.allAiOutputFeatures, ...this.patternActions].find((item) => item.module === this.currentModule && item.type === this.currentType) || null
    },
    allAiOutputFeatures() {
      return this.aiOutputGroups.flatMap((group) => group.items)
    },
    defaultAvailableFeature() {
      return this.allAiOutputFeatures.find((item) => !item.planned) || this.allAiOutputFeatures[0] || {}
    },
    createFeature() {
      return this.allAiOutputFeatures.find((item) => item.type === this.createFeatureType) ||
        this.allAiOutputFeatures.find((item) => item.type === this.currentType) ||
        this.defaultAvailableFeature
    },
    createSteps() {
      return [
        { key: 'feature', label: '选择功能', index: 1 },
        { key: 'upload', label: '上传素材', index: 2 },
        { key: 'params', label: '生成参数', index: 3 },
        { key: 'summary', label: '任务摘要', index: 4 },
        { key: 'quota', label: '确认生成', index: 5 }
      ]
    },
    createStepIndex() {
      return Math.max(0, this.createSteps.findIndex((item) => item.key === this.createStep))
    },
    purposeFilterLabels() {
      return PURPOSE_FILTERS.map((item) => item.label)
    },
    materialFilterLabels() {
      return MATERIAL_FILTERS.map((item) => item.label)
    },
    purposeFilterIndex() {
      return Math.max(0, PURPOSE_FILTERS.findIndex((item) => item.value === this.purposeFilter))
    },
    materialFilterIndex() {
      return Math.max(0, MATERIAL_FILTERS.findIndex((item) => item.value === this.materialFilter))
    },
    selectedPurposeLabel() {
      return PURPOSE_FILTERS[this.purposeFilterIndex].label
    },
    selectedMaterialLabel() {
      return MATERIAL_FILTERS[this.materialFilterIndex].label
    },
    filteredAiOutputGroups() {
      const keyword = String(this.aiOutputKeyword || '').trim().toLowerCase()
      return this.aiOutputGroups
        .filter((group) => this.purposeFilter === 'all' || group.purpose === this.purposeFilter)
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => {
            const matchedKeyword = !keyword || `${item.label}${item.desc}${item.material}${item.output}`.toLowerCase().includes(keyword)
            const matchedMaterial = this.materialFilter === 'all' || item.materialType === this.materialFilter
            return matchedKeyword && matchedMaterial
          })
        }))
        .filter((group) => group.items.length)
    },
    favoriteAiOutputFeatures() {
      return this.favoriteFeatureTypes.map((type) => this.allAiOutputFeatures.find((item) => item.type === type)).filter(Boolean)
    },
    recentAiOutputFeatures() {
      return this.recentFeatureTypes.map((type) => this.allAiOutputFeatures.find((item) => item.type === type)).filter(Boolean).slice(0, 6)
    },
    currentTitle() {
      return this.currentFeature ? this.currentFeature.label : this.currentMenu.title
    },
    quotaBalance() {
      return this.settingsCenter.billing && this.settingsCenter.billing.remainingQuota
        ? this.settingsCenter.billing.remainingQuota
        : (this.settingsCenter.billing && this.settingsCenter.billing.hasRealRecords ? '见明细' : '未接入')
    },
    userLabel() {
      const session = getCurrentSession()
      return session && session.currentUser ? (session.currentUser.name || '已登录用户') : '未登录'
    },
    notificationCount() {
      return this.unreadNotificationCount
    },
    unreadNotificationCount() {
      return this.workspaceNotifications.filter((item) => !this.notificationReadIds.includes(item.notificationId)).length
    },
    notificationTypes() {
      return [
        { key: 'all', label: '全部' },
        { key: 'task_completed', label: '任务完成' },
        { key: 'task_failed', label: '任务失败' },
        { key: 'review_todo', label: '审核待办' },
        { key: 'review_result', label: '审核结果' },
        { key: 'delivery', label: '交付提醒' },
        { key: 'quota', label: '额度提醒' },
        { key: 'team_invite', label: '团队邀请' },
        { key: 'support_ticket', label: '工单通知' },
        { key: 'system_security', label: '系统与安全' }
      ]
    },
    workspaceNotifications() {
      const taskDone = this.tasks
        .filter((item) => ['success', 'completed'].includes(String(item.status || '').toLowerCase()))
        .slice(0, 6)
        .map((item) => this.createNotification('task_completed', `任务已完成：${this.getTaskName(item)}`, '可查看结果或加入项目资产。', item.taskId, { module: 'batch', task: item, createdAt: item.updatedAt || item.createdAt }))
      const taskFailed = this.failedTasks
        .slice(0, 8)
        .map((item) => this.createNotification('task_failed', `任务失败：${this.getTaskName(item)}`, '可进入批量任务或结果页处理。', item.taskId, { module: 'batch', task: item, createdAt: item.updatedAt || item.createdAt }))
      const patternReview = this.patternDashboard.tasks
        .filter((item) => ['under_review', 'pending'].includes(String(item.reviewStatus || '').toLowerCase()))
        .slice(0, 6)
        .map((item) => this.createNotification('review_todo', `待审核版型：${item.title || item.taskName || '制版任务'}`, '进入 AI 制版审核记录处理。', item.taskId, { module: 'pattern-making', patternTask: item, createdAt: item.updatedAt || item.createdAt }))
      const delivery = this.workspaceBatches
        .filter((item) => item.status === 'delivering' || item.reviewCount > 0)
        .slice(0, 6)
        .map((item) => this.createNotification('delivery', `待交付批次：${item.title}`, '审核通过作品可创建交付清单。', item.batchId, { module: 'batch', batch: item, createdAt: item.updatedAt || item.createdAt }))
      const invites = this.teamCenter.invites
        .filter((item) => item.status === 'pending')
        .slice(0, 5)
        .map((item) => this.createNotification('team_invite', `团队邀请待处理：${item.targetAccountMasked || '成员'}`, '可进入团队成员页查看邀请状态。', item.inviteId, { module: 'team', teamTab: 'members', createdAt: item.createdAt }))
      const supportTickets = this.supportCenter.tickets
        .filter((item) => ['assigned', 'waiting_user', 'resolved', 'closed', 'reopened'].includes(item.status))
        .slice(0, 8)
        .map((item) => this.createNotification('support_ticket', `工单状态更新：${item.title}`, `当前状态：${item.status}`, item.ticketId, { module: 'support', supportTicket: item, createdAt: item.updatedAt || item.createdAt }))
      const quota = this.settingsCenter.billing && !this.settingsCenter.billing.hasRealRecords
        ? [this.createNotification('quota', '额度记录尚未接入真实明细', '额度与账单页只展示真实记录，不填静态数字。', 'quota_empty', { module: 'settings', settingsTab: 'billing' })]
        : []
      const security = this.settingsCenter.privacy && this.settingsCenter.privacy.aiTrainingAuthorized
        ? [this.createNotification('system_security', 'AI 训练授权已开启', '请确认作品与版型授权范围。', 'training_auth', { module: 'settings', settingsTab: 'privacy' })]
        : []
      return [...taskFailed, ...patternReview, ...delivery, ...taskDone, ...invites, ...supportTickets, ...quota, ...security]
        .sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')))
    },
    filteredNotifications() {
      return this.workspaceNotifications.filter((item) => this.notificationFilter === 'all' || item.type === this.notificationFilter)
    },
    workspaceTodos() {
      const imageReviews = this.tasks
        .filter((item) => ['pending_review', 'review'].includes(String(item.reviewStatus || item.deliveryStatus || '').toLowerCase()))
        .map((item) => this.createTodo('review_image', '待审核图片', this.getTaskName(item), item.taskId, { module: 'delivery', task: item, owner: item.ownerName || '审核员', projectId: item.projectId }))
      const patternReviews = this.patternDashboard.tasks
        .filter((item) => ['under_review', 'pending'].includes(String(item.reviewStatus || '').toLowerCase()))
        .map((item) => this.createTodo('review_pattern', '待审核版型', item.title || item.taskName || '制版任务', item.taskId, { module: 'pattern-making', patternTask: item, owner: item.ownerName || '版师' }))
      const failed = this.failedTasks.map((item) => this.createTodo('failed_task', '失败任务', this.getTaskName(item), item.taskId, { module: 'batch', task: item, owner: item.ownerName || '任务负责人', projectId: item.projectId }))
      const delivery = this.workspaceBatches
        .filter((item) => item.status === 'delivering' || item.reviewCount > 0)
        .map((item) => this.createTodo('delivery_batch', '待交付批次', item.title, item.batchId, { module: 'batch', batch: item, owner: '交付专员', projectId: item.projectId }))
      const expiringProjects = this.workspaceProjects
        .filter((item) => this.isProjectExpiringSoon(item))
        .map((item) => this.createTodo('project_expiring', '即将到期项目', item.name, item.projectId, { module: 'projects', project: item, owner: item.ownerName || '项目负责人', projectId: item.projectId, dueAt: item.deadline }))
      const quota = this.settingsCenter.billing && !this.settingsCenter.billing.hasRealRecords
        ? [this.createTodo('quota', '额度不足提醒', '暂无真实额度记录，请联系企业顾问确认额度', 'quota_empty', { module: 'settings', settingsTab: 'billing', owner: '企业管理员' })]
        : []
      return [...imageReviews, ...patternReviews, ...failed, ...delivery, ...expiringProjects, ...quota]
    },
    },
    runningTasks() {
      return this.tasks.filter((item) => ['pending', 'processing'].includes(String(item.status || '').toLowerCase())).slice(0, 5)
    },
    failedTasks() {
      return this.tasks.filter((item) => String(item.status || '').toLowerCase() === 'failed')
    },
    reviewImageCount() {
      return this.tasks.filter((item) => ['pending_review', 'review'].includes(String(item.reviewStatus || item.deliveryStatus || '').toLowerCase())).length
    },
    pendingDeliveryCount() {
      return this.tasks.filter((item) => ['pending_delivery', 'waiting_confirm', 'pending'].includes(String(item.deliveryStatus || '').toLowerCase())).length
    },
    pendingItems() {
      return [
        { label: '待审核图片', count: this.reviewImageCount, module: 'delivery' },
        { label: '待审核版型', count: this.patternDashboard.pendingReviewCount, module: 'pattern-making' },
        { label: '失败任务', count: this.failedTasks.length, module: 'batch' },
        { label: '待确认交付', count: this.pendingDeliveryCount, module: 'delivery' }
      ]
    },
    recentProjects() {
      return this.projects.slice(0, 4)
    },
    recentUsed() {
      const favoriteItems = this.favoriteAiOutputFeatures.slice(0, 4).map((item) => ({
        key: `favorite-${item.type}`,
        label: item.label,
        type: '收藏功能',
        module: item.module,
        item
      }))
      const patternItems = this.patternDashboard.masters.slice(0, 3).map((item) => ({
        key: item.patternMasterId,
        label: item.title,
        type: '最近版型',
        module: 'pattern-making'
      }))
      const historyItems = this.planHistories.slice(0, 4).map((item, index) => ({
        key: item.historyId || `history-${index}`,
        label: item.planName || item.name || item.type || '生成方案',
        type: '方案记录',
        module: 'ai-output'
      }))
      return [...favoriteItems, ...patternItems, ...historyItems].slice(0, 6)
    },
    homeActions() {
      return [
        { label: '新建 AI 出图任务', icon: '图', desc: '换模特、换衣服、换场景和批量 SKU。', action: '开始出图', primary: true, module: 'ai-output', type: 'model' },
        { label: '新建 AI 制版任务', icon: '版', desc: '结构图、版型识别和审核入口。', action: '进入制版', module: 'pattern-making', type: 'recognition', patternCreate: true },
        { label: '上传服装图开始', icon: '传', desc: '直接进入现有上传链路创建任务。', action: '上传图片', upload: true, type: 'model' },
        { label: '进入版型库', icon: '库', desc: '查找和复用已沉淀的版型资产。', action: '查看版型', module: 'library' }
      ]
    },
    quickCreateItems() {
      const commands = [
        { key: 'ai-output', label: '新建 AI 出图任务', type: 'model', desc: '进入 AI 出图功能中心。', module: 'ai-output' },
        { key: 'pattern-create', label: '新建 AI 制版任务', type: 'recognition', desc: '进入 AI 制版分步流程。', module: 'pattern-making', patternCreate: true },
        { key: 'project-create', label: '新建项目', desc: '创建项目并组织任务、版型和交付。', module: 'projects', projectCreate: true },
        { key: 'batch-create', label: '创建批次', desc: '创建批量生成和审核批次。', module: 'batch', batchCreate: true },
        { key: 'upload-pattern', label: '上传版型', desc: '进入版型库新建或导入。', module: 'library', patternUpload: true },
        { key: 'ai-training', label: 'AI 制版训练评估', desc: '查看训练样本、数据集、评估和模型版本。', module: 'ai-training' },
        { key: 'model-operations', label: '模型灰度与监控', desc: '查看模型发布、监控、异常和回滚。', module: 'model-operations' },
        { key: 'review', label: '查看待审核', desc: '进入待办中心处理审核事项。', module: 'todos', todoType: 'review' },
        { key: 'failed', label: '查看失败任务', desc: '集中处理失败任务。', module: 'todos', todoType: 'failed_task' },
        { key: 'switch-enterprise', label: '切换企业', desc: '进入企业账号选择。', enterprise: true },
        { key: 'settings', label: '进入设置', desc: '管理账号、安全和生成偏好。', module: 'settings' }
      ]
      const recentSet = new Set(this.recentCommandKeys)
      return [...commands].sort((left, right) => Number(recentSet.has(right.key)) - Number(recentSet.has(left.key)))
    },
    moduleCards() {
      return [
        { label: '项目数量', value: this.projects.length, desc: '来自当前项目数据。' },
        { label: '任务数量', value: this.tasks.length, desc: '来自当前任务列表。' },
        { label: '生产记录', value: this.productions.length, desc: '来自工作台生产记录。' },
        { label: '方案历史', value: this.planHistories.length, desc: '来自方案历史记录。' }
      ]
    },
    teamPermissions() {
      return this.teamCenter.permissions || {}
    },
    canEnterTeamCenter() {
      return Boolean(this.teamPermissions.canViewMembers || this.teamPermissions.canViewRoles || this.teamPermissions.canViewAudit)
    },
    teamRoleOptions() {
      return this.teamCenter.roles.map((item) => item.role)
    },
    selectedTeamRole() {
      const role = this.teamRoleKeyword || (this.teamCenter.roles[0] && this.teamCenter.roles[0].role) || ''
      return this.teamCenter.roles.find((item) => item.role === role) || this.teamCenter.roles[0] || {}
    },
    selectedTeamRolePermissionSet() {
      return new Set(this.teamRoleDraft)
    },
    filteredTeamAuditLogs() {
      const keyword = String(this.teamAuditKeyword || '').trim().toLowerCase()
      return this.teamCenter.auditLogs
        .filter((item) => this.teamAuditModule === 'all' || item.module === this.teamAuditModule || item.resourceType === this.teamAuditModule)
        .filter((item) => !keyword || `${item.operator}${item.action}${item.resourceType}${item.resourceId}${item.projectId}`.toLowerCase().includes(keyword))
    },
    teamAuditModules() {
      const modules = [...new Set(this.teamCenter.auditLogs.map((item) => item.module || item.resourceType).filter(Boolean))]
      return ['all', ...modules]
    },
    settingsDefaultModuleOptions() {
      return this.workspaceMenus.map((item) => item.module)
    },
    settingsDefaultModuleLabels() {
      return this.workspaceMenus.map((item) => item.label)
    },
    settingsDefaultModuleIndex() {
      return Math.max(0, this.settingsDefaultModuleOptions.findIndex((item) => item === this.settingsProfileForm.defaultModule))
    },
    settingLanguageOptions() {
      return ['简体中文', 'English']
    },
    settingLanguageIndex() {
      return Math.max(0, this.settingLanguageOptions.findIndex((item) => item === this.settingsProfileForm.language))
    },
    generationRatioOptions() {
      return ['1:1', '3:4', '4:5', '9:16', '16:9']
    },
    generationQualityOptions() {
      return ['标准', '高清', '超清']
    },
    generationModeOptions() {
      return ['商品视觉', '社媒营销', '跨境白底', 'AI 制版参考']
    },
    reviewFlowOptions() {
      return ['生成后人工审核', '项目负责人审核', '企业管理员审核']
    },
    securityActions() {
      return [
        { action: 'change_password', label: '登录密码修改', desc: '需要重新验证身份后修改。' },
        { action: 'devices', label: '登录设备管理', desc: '展示和管理已登录设备。' },
        { action: 'bind_wechat', label: '微信账号绑定', desc: '通过企业登录服务完成绑定。' },
        { action: 'security_alert', label: '异常登录提醒', desc: '开启后通过可用渠道提醒。' },
        { action: 'logout_all', label: '退出全部设备', desc: '清理其它设备登录态。' },
        { action: 'cancel_account', label: '账号注销入口', desc: '需二次确认和身份验证。' }
      ]
    },
    groupedSearchResults() {
      const groups = []
      this.searchResults.forEach((item) => {
        let group = groups.find((entry) => entry.type === item.type)
        if (!group) {
          group = { type: item.type, items: [] }
          groups.push(group)
        }
        group.items.push(item)
      })
      return groups
    },
    flatSearchResults() {
      return this.groupedSearchResults.flatMap((group) => group.items)
    },
    searchSuggestions() {
      if (this.searchResults.length || !this.searchKeyword) return []
      return this.smartFeatureEntries.slice(0, 5)
    },
    smartFeatureEntries() {
      return [
        { phrase: '给衣服换模特', label: '换模特', module: 'ai-output', featureType: 'model', searchType: '功能', desc: '上传服装图生成模特展示图。' },
        { phrase: '生成服装结构图', label: 'AI 结构识别', module: 'pattern-making', featureType: 'recognition', searchType: '功能', desc: '进入 AI 制版结构识别。', patternCreate: true },
        { phrase: '查看制版训练数据', label: '训练与评估', module: 'ai-training', searchType: '功能', desc: '进入 AI 制版训练与评估中心。' },
        { phrase: '查看模型灰度发布', label: '模型灰度与监控', module: 'model-operations', searchType: '功能', desc: '进入模型运维中心。' },
        { phrase: '查看待审核版型', label: '待审核版型', module: 'todos', searchType: '待办', desc: '进入待办中心处理版型审核。' },
        { phrase: '找上周失败的任务', label: '失败任务', module: 'todos', searchType: '待办', desc: '进入待办中心查看失败任务。' },
        { phrase: '进入企业交付项目', label: '作品与交付', module: 'delivery', searchType: '功能', desc: '进入交付中心。' }
      ].map((item) => ({
        key: `smart-${item.phrase}`,
        type: item.searchType,
        featureType: item.featureType,
        status: '真实入口',
        projectName: '',
        updatedAt: '',
        action: '进入',
        ...item
      }))
    },
    patternSafetyText() {
      return '本结果为 AI 制版参考，不可直接用于裁剪和生产。投入生产前必须由专业版师审核、修正并确认尺寸。'
    },
    patternCreateStepIndex() {
      return Math.max(0, this.patternCreateSteps.findIndex((item) => item.key === this.patternCreateStep))
    },
    currentPatternCreateStep() {
      return this.patternCreateSteps[this.patternCreateStepIndex] || this.patternCreateSteps[0]
    },
    selectedPatternImageLabels() {
      const labels = this.patternImageRequirements
        .filter((item) => this.patternForm.images[item.key])
        .map((item) => item.label)
      return labels.length ? labels.join('、') : '未选择'
    },
    selectedReferencePatternTitle() {
      const item = this.patternDashboard.masters.find((master) => master.patternMasterId === this.patternForm.referencePatternId)
      return item ? item.title : '不使用参考版型'
    },
    filteredPatternTasks() {
      const keyword = String(this.patternSearchKeyword || '').trim().toLowerCase()
      return this.patternDashboard.tasks.filter((item) => {
        if (!keyword) return true
        return `${item.title}${item.category}${item.status}${item.reviewStatus}`.toLowerCase().includes(keyword)
      })
    },
    selectedPatternTask() {
      if (!this.patternTaskDetailId) return null
      return this.patternDashboard.tasks.find((item) => item.taskId === this.patternTaskDetailId) || null
    },
    selectedPatternVersion() {
      const fallback = { aiDraft: {}, sizeParams: {}, reviewStatus: 'not_submitted', productionAvailable: false, trainingCandidate: false }
      if (!this.selectedPatternTask) return fallback
      return getPatternVersion(this.selectedPatternTask.currentVersionId) || fallback
    },
    selectedPatternVersions() {
      if (!this.selectedPatternTask) return []
      return listPatternVersions(this.selectedPatternTask.patternMasterId)
    },
    filteredTrainingSamples() {
      const keyword = String(this.trainingSampleKeyword || '').trim().toLowerCase()
      return this.patternTrainingCenter.samples.filter((sample) => {
        if (!keyword) return true
        return `${sample.title}${sample.category}${sample.patternMasterId}${sample.versionId}${sample.tags.join(' ')}`.toLowerCase().includes(keyword)
      })
    },
    filteredTrainingDatasets() {
      return this.patternTrainingCenter.datasets.filter((dataset) => this.trainingDatasetSplit === 'all' || dataset.split === this.trainingDatasetSplit)
    },
    filteredTrainingModels() {
      return this.patternTrainingCenter.models.filter((model) => this.trainingModelStatus === 'all' || model.status === this.trainingModelStatus)
    },
    trainingQualitySummary() {
      const total = this.patternTrainingCenter.samples.length
      const ready = this.patternTrainingCenter.eligibleSamples.length
      return [
        { label: '训练样本', value: total, desc: '来自 AI 初稿、版师修订和审核通过版本。' },
        { label: '可入库', value: ready, desc: '已审核、已授权且质量检查通过。' },
        { label: '待处理', value: this.patternTrainingCenter.qualityQueue.length, desc: '未授权、标签缺失或差异不完整。' },
        { label: '模型版本', value: this.patternTrainingCenter.models.length, desc: '候选、评估、批准、启用和回滚。' }
      ]
    },
    modelOpsSummaryCards() {
      const metrics = this.modelOperationsCenter.monitoring || {}
      return [
        { label: '追踪任务', value: this.modelOperationsCenter.stats.tracedTaskCount, desc: '来自现有真实任务列表。' },
        { label: '成功率', value: `${metrics.successRate || 0}%`, desc: '成功或完成任务占比。' },
        { label: '失败率', value: `${metrics.failureRate || 0}%`, desc: '失败和超时任务占比。' },
        { label: '异常事件', value: this.modelOperationsCenter.stats.incidentCount, desc: '高风险需要人工确认恢复。' }
      ]
    },
    filteredModelOpsReleases() {
      const keyword = String(this.modelOpsKeyword || '').trim().toLowerCase()
      return this.modelOperationsCenter.releases
        .filter((item) => this.modelOpsReleaseStatus === 'all' || item.status === this.modelOpsReleaseStatus)
        .filter((item) => !keyword || `${item.releaseId}${item.modelId}${item.modelVersion}${item.status}${item.scope.functions.join(' ')}${item.scope.categories.join(' ')}`.toLowerCase().includes(keyword))
    },
    filteredModelOpsIncidents() {
      const keyword = String(this.modelOpsKeyword || '').trim().toLowerCase()
      return this.modelOperationsCenter.incidents
        .filter((item) => !keyword || `${item.title}${item.description}${item.type}${item.level}${item.releaseId}${item.modelId}`.toLowerCase().includes(keyword))
    },
    filteredModelTaskTraces() {
      const keyword = String(this.modelOpsKeyword || '').trim().toLowerCase()
      return this.modelOperationsCenter.taskTraces
        .filter((item) => !keyword || `${item.taskId}${item.modelId}${item.modelVersion}${item.provider}${item.releaseId}${item.functionType}${item.category}${item.promptVersion}`.toLowerCase().includes(keyword))
        .slice(0, 30)
    },
    modelOpsActiveRelease() {
      return this.modelOperationsCenter.releases.find((item) => ['gray_running', 'expanded', 'active'].includes(item.status)) || null
    },
    filteredLibraryPatterns() {
      const keyword = [this.libraryKeyword, this.libraryCodeKeyword].filter(Boolean).join(' ')
      return listPatternLibraryRecords({
        tab: this.libraryTab,
        keyword,
        filters: this.normalizedLibraryFilters
      })
    },
    normalizedLibraryFilters() {
      return Object.keys(this.libraryFilters || {}).reduce((result, key) => {
        const value = this.libraryFilters[key]
        if (value && value !== '全部') result[key] = value
        return result
      }, {})
    },
    selectedLibraryPattern() {
      if (!this.libraryDetailId) return null
      return getPatternMaster(this.libraryDetailId)
    },
    selectedLibraryVersion() {
      if (!this.selectedLibraryPattern) return {}
      return getPatternVersion(this.selectedLibraryPattern.currentVersionId) || { sizeParams: {}, reviewStatus: 'not_submitted', status: 'draft' }
    },
    selectedLibraryVersions() {
      if (!this.selectedLibraryPattern) return []
      return listPatternVersions(this.selectedLibraryPattern.patternMasterId)
    },
    projectBusinessTypeIndex() {
      return Math.max(0, this.projectBusinessTypes.findIndex((item) => item === this.projectForm.businessType))
    },
    projectCreateStepIndex() {
      return Math.max(0, this.projectCreateSteps.findIndex((item) => item.key === this.projectCreateStep))
    },
    currentProjectCreateStep() {
      return this.projectCreateSteps[this.projectCreateStepIndex] || this.projectCreateSteps[0]
    },
    filteredWorkspaceProjects() {
      const keyword = String(this.projectKeyword || '').trim().toLowerCase()
      return this.workspaceProjects.filter((project) => {
        if (this.projectTab !== 'all' && project.status !== this.projectTab) return false
        if (!keyword) return true
        return `${project.name}${project.customerName}${project.ownerName}${project.businessType}`.toLowerCase().includes(keyword)
      })
    },
    selectedWorkspaceProject() {
      if (!this.projectDetailId) return null
      return this.workspaceProjects.find((item) => item.projectId === this.projectDetailId) || null
    },
    selectedProjectTaskList() {
      if (!this.selectedWorkspaceProject) return []
      const linkedIds = new Set([...(this.selectedWorkspaceProject.taskIds || []), ...(this.selectedWorkspaceProject.linkedTaskIds || [])])
      return this.tasks.filter((task) => linkedIds.has(task.taskId))
    },
    selectedProjectAiOutputTasks() {
      return this.selectedProjectTaskList.filter((task) => !['recognition', 'technical-drawing', 'derivation'].includes(task.type))
    },
    selectedProjectPatternTasks() {
      if (!this.selectedWorkspaceProject) return []
      const linkedIds = new Set(this.selectedWorkspaceProject.linkedPatternIds || [])
      return this.patternDashboard.tasks.filter((task) => linkedIds.has(task.patternMasterId))
    },
    selectedProjectPatterns() {
      if (!this.selectedWorkspaceProject) return []
      const linkedIds = new Set(this.selectedWorkspaceProject.linkedPatternIds || [])
      return this.patternDashboard.masters.filter((pattern) => linkedIds.has(pattern.patternMasterId))
    },
    selectedProjectRunningTasks() {
      return this.selectedProjectTaskList.filter((task) => ['pending', 'processing'].includes(String(task.status || '').toLowerCase()))
    },
    selectedProjectReviewTasks() {
      const outputReview = this.selectedProjectTaskList.filter((task) => ['pending_review', 'review'].includes(String(task.reviewStatus || task.deliveryStatus || '').toLowerCase()))
      const patternReview = this.selectedProjectPatternTasks.filter((task) => ['pending', 'review'].includes(String(task.reviewStatus || '').toLowerCase()))
      return [...outputReview, ...patternReview]
    },
    selectedProjectCompletedWorks() {
      return this.selectedProjectTaskList.filter((task) => ['success', 'completed'].includes(String(task.status || '').toLowerCase()))
    },
    selectedProjectStatusHistory() {
      if (!this.selectedWorkspaceProject) return []
      return listWorkspaceProjectStatusHistory(this.selectedWorkspaceProject.projectId)
    },
    batchCreateStepIndex() {
      return Math.max(0, this.batchCreateSteps.findIndex((item) => item.key === this.batchCreateStep))
    },
    currentBatchCreateStep() {
      return this.batchCreateSteps[this.batchCreateStepIndex] || this.batchCreateSteps[0]
    },
    workspaceProjectLabels() {
      return ['不关联项目', ...this.workspaceProjects.map((project) => project.name)]
    },
    batchProjectIndex() {
      const index = this.workspaceProjects.findIndex((project) => project.projectId === this.batchForm.projectId)
      return index >= 0 ? index + 1 : 0
    },
    selectedBatchProjectLabel() {
      return this.workspaceProjectLabels[this.batchProjectIndex] || '不关联项目'
    },
    batchTaskTypeIndex() {
      return Math.max(0, this.batchTaskTypes.findIndex((item) => item === this.batchForm.taskType))
    },
    estimatedBatchQuota() {
      return Math.max(0, Number(this.batchForm.skuCount || 0))
    },
    filteredWorkspaceBatches() {
      const keyword = String(this.batchKeyword || '').trim().toLowerCase()
      return this.workspaceBatches.filter((batch) => {
        if (this.batchTab && batch.status !== this.batchTab) return false
        if (!keyword) return true
        return `${batch.title}${batch.taskType}${this.getBatchProjectName(batch.projectId)}${batch.batchId}`.toLowerCase().includes(keyword)
      })
    },
    selectedWorkspaceBatch() {
      if (!this.batchDetailId) return null
      return this.workspaceBatches.find((batch) => batch.batchId === this.batchDetailId) || null
    },
    reviewableBatchTasks() {
      if (!this.selectedWorkspaceBatch) return []
      return this.selectedWorkspaceBatch.tasks.filter((task) => this.isTaskReviewSafe(task) && !this.selectedWorkspaceBatch.approvedTaskIds.includes(task.taskId))
    },
    failedBatchTasks() {
      if (!this.selectedWorkspaceBatch) return []
      return this.selectedWorkspaceBatch.tasks.filter((task) => ['failed', 'timeout'].includes(String(task.status || '').toLowerCase()))
    },
    selectedBatchDeliveries() {
      if (!this.selectedWorkspaceBatch) return []
      return this.workspaceDeliveries.filter((delivery) => delivery.batchId === this.selectedWorkspaceBatch.batchId)
    },
    selectedWorkspaceAsset() {
      if (!this.assetDetailId) return null
      return this.workspaceAssets.find((asset) => asset.assetId === this.assetDetailId) || null
    },
    filteredWorkspaceAssets() {
      const keyword = String(this.assetKeyword || '').trim().toLowerCase()
      return this.workspaceAssets
        .filter((asset) => this.assetType === 'all' || asset.type === this.assetType || (this.assetType === 'archived' && asset.type === 'archived'))
        .filter((asset) => !this.assetFilterProjectId || asset.projectId === this.assetFilterProjectId)
        .filter((asset) => !this.assetFilterTaskId || String(asset.taskId || '').includes(this.assetFilterTaskId))
        .filter((asset) => !this.assetFilterBatchId || String(asset.batchId || '').includes(this.assetFilterBatchId))
        .filter((asset) => !this.assetFilterCreator || String(asset.creatorName || '').includes(this.assetFilterCreator))
        .filter((asset) => this.assetFilterReviewStatus === 'all' || asset.reviewStatus === this.assetFilterReviewStatus)
        .filter((asset) => this.assetFilterDeliveryStatus === 'all' || asset.deliveryStatus === this.assetFilterDeliveryStatus)
        .filter((asset) => this.assetFilterGenerationMode === 'all' || asset.generationMode === this.assetFilterGenerationMode)
        .filter((asset) => this.assetFilterFormat === 'all' || asset.fileFormat === this.assetFilterFormat)
        .filter((asset) => !keyword || `${asset.name}${asset.assetId}${asset.type}${asset.projectName}${asset.taskId}${asset.batchId}${asset.creatorName}${asset.fileFormat}`.toLowerCase().includes(keyword))
        .sort((left, right) => {
          if (this.assetSort === 'created_asc') return String(left.createdAt || '').localeCompare(String(right.createdAt || ''))
          if (this.assetSort === 'name_asc') return String(left.name || '').localeCompare(String(right.name || ''))
          return String(right.updatedAt || right.createdAt || '').localeCompare(String(left.updatedAt || left.createdAt || ''))
        })
    },
    groupedWorkspaceAssets() {
      if (!['project', 'batch', 'time'].includes(this.assetViewMode)) {
        return [{ key: 'all', title: '全部资产', items: this.filteredWorkspaceAssets }]
      }
      const groups = []
      this.filteredWorkspaceAssets.forEach((asset) => {
        const key = this.assetViewMode === 'project'
          ? (asset.projectId || 'none')
          : this.assetViewMode === 'batch'
            ? (asset.batchId || 'none')
            : this.formatDate(asset.createdAt || asset.updatedAt || '').slice(0, 10) || '未记录时间'
        let group = groups.find((item) => item.key === key)
        if (!group) {
          group = { key, title: this.getAssetGroupTitle(key), items: [] }
          groups.push(group)
        }
        group.items.push(asset)
      })
      return groups
    },
    selectedAssetList() {
      const selected = new Set(this.assetSelectedIds)
      return this.filteredWorkspaceAssets.filter((asset) => selected.has(asset.assetId))
    },
    assetProjectLabels() {
      return ['不关联项目', ...this.workspaceProjects.map((project) => project.name)]
    },
    assetProjectIds() {
      return ['', ...this.workspaceProjects.map((project) => project.projectId)]
    },
    assetProjectFilterIndex() {
      return Math.max(0, this.assetProjectIds.findIndex((item) => item === this.assetFilterProjectId))
    },
    assetReviewFilterIndex() {
      return Math.max(0, this.assetReviewOptions.findIndex((item) => item === this.assetFilterReviewStatus))
    },
    assetDeliveryFilterIndex() {
      return Math.max(0, this.assetDeliveryOptions.findIndex((item) => item === this.assetFilterDeliveryStatus))
    }
  },
  onLoad(options = {}) {
    this.restoreIdentity()
    this.restoreAiOutputState()
    this.restoreActionCenterState()
    this.restoreRoute(options)
    this.loadWorkspaceData()
  },
  mounted() {
    // #ifdef H5
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.handleKeydown)
    }
    // #endif
  },
  beforeDestroy() {
    this.detachHotkeys()
  },
  beforeUnmount() {
    this.detachHotkeys()
  },
  methods: {
    detachHotkeys() {
      if (this.searchDebounceTimer) {
        clearTimeout(this.searchDebounceTimer)
        this.searchDebounceTimer = null
      }
      // #ifdef H5
      if (typeof window !== 'undefined') {
        window.removeEventListener('keydown', this.handleKeydown)
      }
      // #endif
    },
    restoreIdentity() {
      try {
        this.selectedIdentity = uni.getStorageSync(IDENTITY_KEY) || ''
      } catch (error) {
        this.selectedIdentity = ''
      }
    },
    restoreActionCenterState() {
      try {
        this.recentSearches = uni.getStorageSync(SEARCH_RECENT_KEY) || []
        this.notificationReadIds = uni.getStorageSync(NOTIFICATION_READ_KEY) || []
        this.recentCommandKeys = uni.getStorageSync(COMMAND_RECENT_KEY) || []
      } catch (error) {
        this.recentSearches = []
        this.notificationReadIds = []
        this.recentCommandKeys = []
      }
    },
    restoreAiOutputState() {
      try {
        this.favoriteFeatureTypes = uni.getStorageSync(AI_OUTPUT_FAVORITE_KEY) || []
        this.recentFeatureTypes = uni.getStorageSync(AI_OUTPUT_RECENT_KEY) || []
        const filters = uni.getStorageSync(AI_OUTPUT_FILTER_KEY) || {}
        this.aiOutputKeyword = filters.keyword || ''
        this.purposeFilter = filters.purpose || 'all'
        this.materialFilter = filters.material || 'all'
      } catch (error) {
        this.favoriteFeatureTypes = []
        this.recentFeatureTypes = []
      }
    },
    persistAiOutputFilters() {
      try {
        uni.setStorageSync(AI_OUTPUT_FILTER_KEY, {
          keyword: this.aiOutputKeyword,
          purpose: this.purposeFilter,
          material: this.materialFilter
        })
      } catch (error) {}
    },
    persistAiOutputFavorites() {
      try {
        uni.setStorageSync(AI_OUTPUT_FAVORITE_KEY, this.favoriteFeatureTypes)
      } catch (error) {}
    },
    persistAiOutputRecent() {
      try {
        uni.setStorageSync(AI_OUTPUT_RECENT_KEY, this.recentFeatureTypes)
      } catch (error) {}
    },
    restoreRoute(options = {}) {
      let next = { module: options.module || '', type: options.type || '' }
      if (!next.module) {
        try {
          next = uni.getStorageSync(LAST_ROUTE_KEY) || next
        } catch (error) {
          next = { module: '', type: '' }
        }
      }
      this.currentModule = this.normalizeModule(next.module || 'overview')
      this.currentType = next.type || ''
      this.createMode = options.mode === 'create' && this.currentModule === 'ai-output'
      this.createFeatureType = this.createMode ? (this.currentType || 'model') : ''
      this.createStep = 'feature'
      this.patternCreateMode = options.mode === 'pattern-create' && this.currentModule === 'pattern-making'
      this.patternTaskDetailId = options.taskId || ''
      this.patternDetailTab = options.tab || 'overview'
      this.trainingTab = options.trainingTab || this.trainingTab
      this.modelOpsTab = options.modelOpsTab || this.modelOpsTab
      this.libraryTab = options.libraryTab || this.libraryTab
      this.libraryDetailId = options.patternId || ''
      this.libraryDetailTab = options.libraryDetailTab || 'basic'
      this.projectTab = options.projectTab || this.projectTab
      this.projectDetailId = options.projectId || ''
      this.projectDetailTab = options.projectDetailTab || 'overview'
      this.projectCreateMode = options.mode === 'project-create' && this.currentModule === 'projects'
      this.batchTab = options.batchTab || this.batchTab
      this.batchDetailId = options.batchId || ''
      this.batchDetailTab = options.batchDetailTab || 'overview'
      this.batchCreateMode = options.mode === 'batch-create' && this.currentModule === 'batch'
      this.assetDetailId = options.assetId || ''
      this.assetDetailTab = options.assetDetailTab || 'preview'
      this.assetType = options.assetType || this.assetType
      this.assetViewMode = options.assetView || this.assetViewMode
      this.teamTab = options.teamTab || this.teamTab
      this.settingsTab = options.settingsTab || this.settingsTab
      this.supportTicketId = options.ticketId || ''
      this.helpCategory = options.helpCategory || this.helpCategory
      this.helpArticleId = options.helpArticleId || this.helpArticleId
      this.persistRoute()
    },
    normalizeModule(module) {
      const map = {
        pattern: 'pattern-making',
        training: 'ai-training',
        'ai-training': 'ai-training',
        modelOps: 'model-operations',
        'model-operations': 'model-operations',
        output: 'ai-output',
        patternLibrary: 'library',
        'pattern-library': 'library',
        project: 'projects',
        batches: 'batch',
        deliveries: 'delivery',
        support: 'support',
        asset: 'assets',
        assets: 'assets',
        members: 'team',
        roles: 'team',
        'audit-logs': 'team',
        todo: 'todos',
        works: 'delivery',
        help: 'help'
      }
      const normalized = map[module] || module
      return WORKSPACE_MENUS.some((item) => item.module === normalized) ? normalized : 'overview'
    },
    persistRoute() {
      try {
        uni.setStorageSync(LAST_ROUTE_KEY, {
          module: this.currentModule,
          type: this.currentType
        })
      } catch (error) {}
    },
    updateRoute() {
      const query = [`module=${encodeURIComponent(this.currentModule)}`]
      if (this.currentType) query.push(`type=${encodeURIComponent(this.currentType)}`)
      if (this.currentModule === 'ai-output' && this.createMode) query.push('mode=create')
      if (this.currentModule === 'pattern-making' && this.patternCreateMode) query.push('mode=pattern-create')
      if (this.currentModule === 'pattern-making' && this.patternTaskDetailId) {
        query.push(`taskId=${encodeURIComponent(this.patternTaskDetailId)}`)
        query.push(`tab=${encodeURIComponent(this.patternDetailTab)}`)
      }
      if (this.currentModule === 'library') {
        if (this.libraryTab) query.push(`libraryTab=${encodeURIComponent(this.libraryTab)}`)
        if (this.libraryDetailId) {
          query.push(`patternId=${encodeURIComponent(this.libraryDetailId)}`)
          query.push(`libraryDetailTab=${encodeURIComponent(this.libraryDetailTab)}`)
        }
      }
      if (this.currentModule === 'ai-training' && this.trainingTab) {
        query.push(`trainingTab=${encodeURIComponent(this.trainingTab)}`)
      }
      if (this.currentModule === 'model-operations' && this.modelOpsTab) {
        query.push(`modelOpsTab=${encodeURIComponent(this.modelOpsTab)}`)
      }
      if (this.currentModule === 'projects') {
        if (this.projectTab) query.push(`projectTab=${encodeURIComponent(this.projectTab)}`)
        if (this.projectCreateMode) query.push('mode=project-create')
        if (this.projectDetailId) {
          query.push(`projectId=${encodeURIComponent(this.projectDetailId)}`)
          query.push(`projectDetailTab=${encodeURIComponent(this.projectDetailTab)}`)
        }
      }
      if (this.currentModule === 'batch') {
        if (this.batchTab) query.push(`batchTab=${encodeURIComponent(this.batchTab)}`)
        if (this.batchCreateMode) query.push('mode=batch-create')
        if (this.batchDetailId) {
          query.push(`batchId=${encodeURIComponent(this.batchDetailId)}`)
          query.push(`batchDetailTab=${encodeURIComponent(this.batchDetailTab)}`)
        }
      }
      if (this.currentModule === 'assets') {
        if (this.assetType) query.push(`assetType=${encodeURIComponent(this.assetType)}`)
        if (this.assetViewMode) query.push(`assetView=${encodeURIComponent(this.assetViewMode)}`)
        if (this.assetDetailId) {
          query.push(`assetId=${encodeURIComponent(this.assetDetailId)}`)
          query.push(`assetDetailTab=${encodeURIComponent(this.assetDetailTab)}`)
        }
      }
      if (this.currentModule === 'team' && this.teamTab) {
        query.push(`teamTab=${encodeURIComponent(this.teamTab)}`)
      }
      if (this.currentModule === 'settings' && this.settingsTab) {
        query.push(`settingsTab=${encodeURIComponent(this.settingsTab)}`)
      }
      if (this.currentModule === 'support' && this.supportTicketId) {
        query.push(`ticketId=${encodeURIComponent(this.supportTicketId)}`)
      }
      if (this.currentModule === 'help') {
        if (this.helpCategory) query.push(`helpCategory=${encodeURIComponent(this.helpCategory)}`)
        if (this.helpArticleId) query.push(`helpArticleId=${encodeURIComponent(this.helpArticleId)}`)
      }
      uni.redirectTo({ url: `/pages/workspace/workspace?${query.join('&')}` })
    },
    selectIdentity(item = {}) {
      this.selectedIdentity = item.value
      uni.setStorageSync(IDENTITY_KEY, item.value)
      this.refreshOnboardingState()
    },
    async loadWorkspaceData() {
      this.tasks = this.safeArray(listTasks())
      this.projects = this.safeArray(getProjects())
      this.planHistories = this.safeArray(getWorkspacePlanHistories())
      this.productions = this.safeArray(getWorkspaceProductions())
      this.patternDashboard = getPatternDashboard()
      this.workspaceProjects = listWorkspaceProjects()
      this.workspaceBatches = listWorkspaceBatches()
      this.workspaceDeliveries = listWorkspaceDeliveries()
      this.loadSettingsCenter()
      await this.ensureWorkspaceModuleData(this.currentModule)
      this.refreshOnboardingState()
    },
    loadPatternTrainingCenter() {
      this.patternTrainingCenter = loadPatternTrainingCenter(this.patternDashboard, this.settingsCenter.privacy || {})
    },
    loadModelOperationsCenter() {
      this.modelOperationsCenter = loadModelOperationsCenter({
        tasks: this.tasks,
        trainingCenter: this.patternTrainingCenter
      })
    },
    loadAssetCenter() {
      this.workspaceAssets = buildWorkspaceAssets({
        tasks: this.tasks,
        projects: this.workspaceProjects,
        batches: this.workspaceBatches,
        deliveries: this.workspaceDeliveries,
        patternDashboard: this.patternDashboard
      })
    },
    loadSettingsCenter() {
      this.settingsCenter = loadWorkspaceSettingsCenter()
      this.settingsProfileForm = { ...this.settingsCenter.profile }
      this.settingsEnterpriseForm = { ...this.settingsCenter.enterpriseProfile }
      this.settingsGenerationForm = { ...this.settingsCenter.generation }
      this.settingsNotificationForm = JSON.parse(JSON.stringify(this.settingsCenter.notifications || {}))
      this.settingsStorageForm = { ...this.settingsCenter.storage }
      this.settingsPrivacyForm = { ...this.settingsCenter.privacy }
    },
    loadAnalyticsCenter() {
      this.analyticsCenter = loadProductAnalyticsCenter({
        tasks: this.tasks,
        projects: this.workspaceProjects,
        batches: this.workspaceBatches,
        deliveries: this.workspaceDeliveries
      })
    },
    loadFeedbackCenter() {
      this.feedbackCenter = loadProductFeedbackCenter()
    },
    loadSupportCenter() {
      this.supportCenter = loadSupportCenter(this.supportTicketId)
      if (this.supportTicketId && !this.supportCenter.selectedTicket) {
        this.supportTicketId = ''
      }
    },
    loadExperimentCenter() {
      this.experimentsCenter = loadProductExperimentCenter()
    },
    submitProductFeedback() {
      const description = String(this.feedbackForm.description || '').trim()
      if (!description) {
        uni.showToast({ title: '请填写反馈说明', icon: 'none' })
        return
      }
      const result = createProductFeedback(this.feedbackForm)
      if (!result.success) {
        uni.showToast({ title: result.errorCode || '反馈提交失败', icon: 'none' })
        return
      }
      this.feedbackForm.description = ''
      this.loadFeedbackCenter()
      uni.showToast({ title: '反馈已提交', icon: 'none' })
    },
    updateFeedbackStatus(feedback = {}, status = '') {
      if (!feedback.feedbackId || !status) return
      const result = updateProductFeedback(feedback.feedbackId, { status })
      if (!result.success) {
        uni.showToast({ title: result.errorCode || '状态更新失败', icon: 'none' })
        return
      }
      this.loadFeedbackCenter()
    },
    submitSupportTicket() {
      const description = String(this.supportForm.description || '').trim()
      if (!description) {
        uni.showToast({ title: '请填写问题说明', icon: 'none' })
        return
      }
      const result = createSupportTicket(this.supportForm)
      if (!result.success) {
        uni.showToast({ title: result.errorCode || '工单创建失败', icon: 'none' })
        return
      }
      this.supportForm.description = ''
      this.supportForm.recentErrorCode = ''
      this.supportTicketId = result.ticket.ticketId
      this.loadSupportCenter()
      this.updateRoute()
      uni.showToast({ title: '工单已创建', icon: 'none' })
    },
    openSupportTicket(ticket = {}) {
      if (!ticket.ticketId) return
      this.supportTicketId = ticket.ticketId
      this.loadSupportCenter()
      this.updateRoute()
    },
    closeSupportTicketDetail() {
      this.supportTicketId = ''
      this.loadSupportCenter()
      this.updateRoute()
    },
    updateSupportTicketStatus(ticket = {}, status = '') {
      if (!ticket.ticketId || !status) return
      const result = updateSupportTicket(ticket.ticketId, { status })
      if (!result.success) {
        uni.showToast({ title: result.errorCode || '工单状态更新失败', icon: 'none' })
        return
      }
      this.loadSupportCenter()
    },
    updateSupportTicketPriority(ticket = {}, priority = '') {
      if (!ticket.ticketId || !priority) return
      const result = updateSupportTicket(ticket.ticketId, { priority })
      if (!result.success) {
        uni.showToast({ title: result.errorCode || '优先级更新失败', icon: 'none' })
        return
      }
      this.loadSupportCenter()
    },
    addSupportReply(internal = false) {
      const ticket = this.supportCenter.selectedTicket || {}
      const content = String(internal ? this.supportInternalNote : this.supportReplyText || '').trim()
      if (!ticket.ticketId || !content) {
        uni.showToast({ title: '请填写回复内容', icon: 'none' })
        return
      }
      const result = addTicketReply(ticket.ticketId, content, internal)
      if (!result.success) {
        uni.showToast({ title: result.errorCode || '回复失败', icon: 'none' })
        return
      }
      if (internal) this.supportInternalNote = ''
      else this.supportReplyText = ''
      this.loadSupportCenter()
    },
    submitQuotaCompensation() {
      const ticket = this.supportCenter.selectedTicket || {}
      const result = requestQuotaCompensation(ticket.ticketId, this.supportCompensationForm)
      if (!result.success) {
        uni.showToast({ title: result.errorCode || '补偿记录创建失败', icon: 'none' })
        return
      }
      this.supportCompensationForm = {
        sourceUsageRecordId: '',
        amount: '',
        reason: '',
        approver: '',
        idempotencyKey: ''
      }
      this.loadSupportCenter()
      uni.showToast({ title: '已记录补偿申请', icon: 'none' })
    },
    createExperimentDraft() {
      const name = String(this.experimentForm.name || '').trim()
      if (!name) {
        uni.showToast({ title: '请填写实验名称', icon: 'none' })
        return
      }
      const result = createProductExperiment({
        ...this.experimentForm,
        variants: [
          { key: 'control', name: '原流程', traffic: 50 },
          { key: 'variant', name: '优化流程', traffic: 50 }
        ]
      })
      if (!result.success) {
        uni.showToast({ title: result.errorCode || '实验创建失败', icon: 'none' })
        return
      }
      this.experimentForm.name = ''
      this.experimentForm.hypothesis = ''
      this.loadExperimentCenter()
      uni.showToast({ title: '实验已创建', icon: 'none' })
    },
    async loadTeamCenter() {
      this.teamLoading = true
      this.teamError = ''
      try {
        this.teamCenter = await loadWorkspaceTeamCenter()
        if (!this.teamRoleKeyword && this.teamCenter.roles.length) {
          this.teamRoleKeyword = this.teamCenter.roles[0].role
          this.teamRoleDraft = [...this.teamCenter.roles[0].permissions]
        }
      } catch (error) {
        this.teamError = error && (error.message || error.errorCode) ? (error.message || error.errorCode) : '团队中心加载失败'
      } finally {
        this.teamLoading = false
      }
    },
    async ensureWorkspaceModuleData(module = '') {
      const current = this.normalizeModule(module || this.currentModule)
      if (current === 'assets') {
        this.loadAssetCenter()
      }
      if (current === 'ai-training') {
        this.loadPatternTrainingCenter()
      }
      if (current === 'model-operations') {
        if (!this.patternTrainingCenter.canAccess && !this.patternTrainingCenter.samples.length) {
          this.loadPatternTrainingCenter()
        }
        this.loadModelOperationsCenter()
      }
      if (current === 'team') {
        await this.loadTeamCenter()
      }
      if (current === 'analytics') {
        this.loadAnalyticsCenter()
      }
      if (current === 'feedback') {
        this.loadFeedbackCenter()
      }
      if (current === 'support') {
        this.loadSupportCenter()
      }
      if (current === 'experiments') {
        this.loadExperimentCenter()
      }
    },
    refreshOnboardingState() {
      this.onboardingSkipped = isOnboardingSkipped(this.selectedIdentity)
      this.onboardingTasks = loadOnboardingTasks(this.selectedIdentity, {
        tasks: this.tasks,
        projects: this.workspaceProjects,
        assets: this.workspaceAssets,
        deliveries: this.workspaceDeliveries,
        profile: this.settingsCenter.profile || {}
      })
    },
    safeArray(value) {
      return Array.isArray(value) ? value : []
    },
    toggleSidebar() {
      this.sidebarCollapsed = !this.sidebarCollapsed
    },
    selectModule(module) {
      this.sidebarOpen = false
      this.currentModule = this.normalizeModule(module)
      this.currentType = ''
      this.createMode = false
      this.patternCreateMode = false
      this.patternTaskDetailId = ''
      if (this.currentModule !== 'ai-training') this.trainingTab = 'overview'
      if (this.currentModule !== 'model-operations') this.modelOpsTab = 'overview'
      this.libraryDetailId = ''
      this.projectDetailId = ''
      this.projectCreateMode = false
      this.batchDetailId = ''
      this.batchCreateMode = false
      this.assetDetailId = ''
      this.assetSelectedIds = []
      this.supportTicketId = ''
      recordProductAnalyticsEvent({
        eventName: 'side_menu_click',
        page: 'workspace',
        resourceType: 'module',
        resourceId: this.currentModule
      })
      this.persistRoute()
      this.ensureWorkspaceModuleData(this.currentModule)
      this.updateRoute()
    },
    openFeature(item = {}) {
      this.sidebarOpen = false
      this.currentModule = this.normalizeModule(item.module || this.currentModule)
      this.currentType = item.type || ''
      this.createMode = false
      this.patternCreateMode = false
      this.patternTaskDetailId = ''
      if (this.currentModule !== 'library') this.libraryDetailId = ''
      if (this.currentModule !== 'projects') this.projectDetailId = ''
      if (this.currentModule !== 'batch') this.batchDetailId = ''
      this.persistRoute()
      this.ensureWorkspaceModuleData(this.currentModule)
      this.updateRoute()
    },
    handleHomeAction(item = {}) {
      if (item.upload) {
        this.startGeneration(item)
        return
      }
      if (item.patternCreate) {
        this.startPatternCreate(item.type)
        return
      }
      if (item.libraryTab) this.libraryTab = item.libraryTab
      if (item.settingsTab) this.settingsTab = item.settingsTab
      if (item.teamTab) this.teamTab = item.teamTab
      this.openFeature(item)
    },
    handleOnboardingTask(item = {}) {
      if (item.upload) {
        this.startGeneration(item)
        return
      }
      if (item.mode === 'project-create') {
        this.currentModule = 'projects'
        this.projectCreateMode = true
        this.projectCreateStep = 'basic'
        this.updateRoute()
        return
      }
      if (item.settingsTab) this.settingsTab = item.settingsTab
      this.openFeature(item)
    },
    markGuideTaskDone(item = {}) {
      markOnboardingTaskDone(this.selectedIdentity, item.taskId)
      this.refreshOnboardingState()
    },
    skipCurrentOnboarding() {
      skipOnboarding(this.selectedIdentity)
      this.onboardingSkipped = true
    },
    openHelpDrawer(articleId = '') {
      this.drawerHelpArticleId = articleId || ''
      this.helpDrawerOpen = true
    },
    closeHelpDrawer() {
      this.helpDrawerOpen = false
    },
    openHelpCenter(category = 'quick-start') {
      this.helpDrawerOpen = false
      this.currentModule = 'help'
      this.helpCategory = category || 'quick-start'
      this.helpArticleId = ''
      this.updateRoute()
    },
    setHelpCategory(category = 'quick-start') {
      this.helpCategory = category || 'quick-start'
      this.helpArticleId = ''
      this.updateRoute()
    },
    selectHelpArticle(articleId = '') {
      this.helpArticleId = articleId
      this.updateRoute()
    },
    clearHelpSearch() {
      this.helpKeyword = ''
      this.helpCategory = 'quick-start'
      this.helpArticleId = ''
    },
    openHelpTarget(article = {}) {
      this.helpDrawerOpen = false
      if (article.targetType) {
        this.currentType = article.targetType
      }
      this.openFeature({
        module: article.targetModule || 'overview',
        type: article.targetType || ''
      })
    },
    openQuickPanel() {
      this.quickPanelOpen = true
    },
    openSearchPanel() {
      this.searchPanelOpen = true
      this.searchKeyword = ''
      this.searchResults = []
      this.searchSelectedIndex = 0
    },
    handleQuickCreate(item = {}) {
      this.quickPanelOpen = false
      this.rememberCommand(item.key || item.type || item.module || item.label)
      if (item.enterprise) {
        this.goEnterpriseLogin()
        return
      }
      if (item.projectCreate) {
        this.startProjectCreate()
        return
      }
      if (item.batchCreate) {
        this.startBatchCreate()
        return
      }
      if (item.patternUpload) {
        this.createNewLibraryPattern()
        return
      }
      if (item.module === 'todos') {
        this.selectModule('todos')
        return
      }
      if (item.patternCreate) {
        this.startPatternCreate(item.type)
        return
      }
      if (item.module === 'pattern-making' || item.module === 'library') {
        this.openFeature(item)
        return
      }
      this.openCreateFlow(item)
    },
    rememberCommand(key = '') {
      if (!key) return
      this.recentCommandKeys = [key, ...this.recentCommandKeys.filter((item) => item !== key)].slice(0, 10)
      try {
        uni.setStorageSync(COMMAND_RECENT_KEY, this.recentCommandKeys)
      } catch (error) {}
    },
    onPurposeFilterChange(event = {}) {
      const index = Number(event.detail && event.detail.value)
      this.purposeFilter = PURPOSE_FILTERS[index] ? PURPOSE_FILTERS[index].value : 'all'
      this.persistAiOutputFilters()
    },
    onMaterialFilterChange(event = {}) {
      const index = Number(event.detail && event.detail.value)
      this.materialFilter = MATERIAL_FILTERS[index] ? MATERIAL_FILTERS[index].value : 'all'
      this.persistAiOutputFilters()
    },
    isFavoriteFeature(type = '') {
      return this.favoriteFeatureTypes.includes(type)
    },
    toggleFavoriteFeature(item = {}) {
      if (!item.type) return
      this.favoriteFeatureTypes = this.isFavoriteFeature(item.type)
        ? this.favoriteFeatureTypes.filter((type) => type !== item.type)
        : [item.type, ...this.favoriteFeatureTypes].slice(0, 12)
      this.persistAiOutputFavorites()
      uni.showToast({ title: this.isFavoriteFeature(item.type) ? '已收藏' : '已取消收藏', icon: 'none' })
    },
    rememberRecentFeature(item = {}) {
      if (!item.type) return
      this.recentFeatureTypes = [item.type, ...this.recentFeatureTypes.filter((type) => type !== item.type)].slice(0, 12)
      this.persistAiOutputRecent()
    },
    openCreateFlow(item = {}) {
      if (!item || item.planned) {
        uni.showToast({ title: '该能力规划中，暂不开放创建', icon: 'none' })
        return
      }
      const feature = this.allAiOutputFeatures.find((target) => target.type === item.type) || this.defaultAvailableFeature
      this.currentModule = 'ai-output'
      this.currentType = feature.type
      this.createFeatureType = feature.type
      this.createMode = true
      this.patternCreateMode = false
      this.patternTaskDetailId = ''
      this.createStep = 'feature'
      this.rememberRecentFeature(feature)
      this.persistRoute()
      this.updateRoute()
    },
    exitCreateFlow() {
      this.createMode = false
      this.createStep = 'feature'
      this.persistRoute()
      this.updateRoute()
    },
    nextCreateStep() {
      const next = Math.min(this.createSteps.length - 1, this.createStepIndex + 1)
      this.createStep = this.createSteps[next].key
    },
    prevCreateStep() {
      const prev = Math.max(0, this.createStepIndex - 1)
      this.createStep = this.createSteps[prev].key
    },
    confirmCreateFeature() {
      this.startGeneration(this.createFeature)
    },
    startGeneration(item = {}) {
      if (item.planned) {
        uni.showToast({ title: '该能力规划中，暂不创建真实任务', icon: 'none' })
        return
      }
      this.rememberRecentFeature(item)
      const type = item.type || this.currentType || 'model'
      uni.navigateTo({ url: `/package-ai/upload/upload?entryScene=workspace&type=${encodeURIComponent(type)}` })
    },
    openPatternAction(item = {}) {
      if (item.type === 'training') {
        this.currentModule = 'ai-training'
        this.trainingTab = 'overview'
        this.currentType = ''
        this.updateRoute()
        return
      }
      this.currentModule = 'pattern-making'
      this.currentType = item.type || 'recognition'
      this.patternTaskDetailId = ''
      if (item.planned) {
        uni.showToast({ title: '训练与评估仅作为专业能力规划展示', icon: 'none' })
        this.updateRoute()
        return
      }
      if (['recognition', 'technical-drawing', 'derivation'].includes(item.type)) {
        this.startPatternCreate(item.type)
        return
      }
      this.patternCreateMode = false
      this.persistRoute()
      this.updateRoute()
    },
    startPatternCreate(type = 'recognition') {
      this.currentModule = 'pattern-making'
      this.currentType = type
      this.createMode = false
      this.patternCreateMode = true
      this.patternTaskDetailId = ''
      this.patternDetailTab = 'overview'
      this.patternCreateStep = 'category'
      this.patternForm = createDefaultPatternForm()
      this.persistRoute()
      this.updateRoute()
    },
    exitPatternCreate() {
      this.patternCreateMode = false
      this.patternCreateStep = 'category'
      this.persistRoute()
      this.updateRoute()
    },
    nextPatternCreateStep() {
      const next = Math.min(this.patternCreateSteps.length - 1, this.patternCreateStepIndex + 1)
      this.patternCreateStep = this.patternCreateSteps[next].key
    },
    prevPatternCreateStep() {
      const prev = Math.max(0, this.patternCreateStepIndex - 1)
      this.patternCreateStep = this.patternCreateSteps[prev].key
    },
    togglePatternImage(key = '') {
      if (key === 'front') {
        this.patternForm.images.front = true
        return
      }
      this.patternForm.images[key] = !this.patternForm.images[key]
    },
    submitPatternTaskDraft() {
      if (!this.patternForm.category) {
        uni.showToast({ title: '请选择服装品类', icon: 'none' })
        this.patternCreateStep = 'category'
        return
      }
      if (!this.patternForm.images.front) {
        uni.showToast({ title: '请至少上传或确认服装正面图', icon: 'none' })
        this.patternCreateStep = 'images'
        return
      }
      const result = createPatternTaskDraft(this.patternForm)
      if (this.patternProjectId) {
        linkPatternToWorkspaceProject(this.patternProjectId, result.master.patternMasterId)
        this.patternProjectId = ''
      }
      this.loadWorkspaceData()
      this.patternCreateMode = false
      this.patternTaskDetailId = result.task.taskId
      this.patternDetailTab = 'overview'
      uni.showToast({ title: '已生成 AI 制版草稿', icon: 'none' })
      this.updateRoute()
    },
    openPatternTask(item = {}) {
      if (!item.taskId) return
      this.currentModule = 'pattern-making'
      this.currentType = 'detail'
      this.patternCreateMode = false
      this.patternTaskDetailId = item.taskId
      this.patternDetailTab = 'overview'
      this.updateRoute()
    },
    closePatternTaskDetail() {
      this.patternTaskDetailId = ''
      this.patternDetailTab = 'overview'
      this.updateRoute()
    },
    setPatternDetailTab(tab = 'overview') {
      this.patternDetailTab = tab
      this.updateRoute()
    },
    createPatternRevision() {
      if (!this.selectedPatternTask) return
      const result = createPatternRevisionVersion(this.selectedPatternTask.patternMasterId)
      if (!result.ok) {
        uni.showToast({ title: '创建新版本失败', icon: 'none' })
        return
      }
      this.loadWorkspaceData()
      this.patternDetailTab = 'history'
      uni.showToast({ title: '已创建新版本，未覆盖已审核版本', icon: 'none' })
      this.updateRoute()
    },
    submitPatternReview() {
      if (!this.selectedPatternTask || !this.selectedPatternTask.currentVersionId) return
      const result = submitPatternVersionReview(this.selectedPatternTask.currentVersionId)
      if (!result.ok) {
        uni.showToast({ title: '提交审核失败', icon: 'none' })
        return
      }
      this.loadWorkspaceData()
      uni.showToast({ title: '已提交专业审核', icon: 'none' })
    },
    approvePatternVersion() {
      if (!this.selectedPatternTask || !this.selectedPatternTask.currentVersionId) return
      const result = reviewPatternVersion(this.selectedPatternTask.currentVersionId, 'approved', '版师审核通过')
      if (!result.ok) {
        uni.showToast({ title: '审核失败', icon: 'none' })
        return
      }
      this.loadWorkspaceData()
      uni.showToast({ title: '审核通过，可作为审核参考', icon: 'none' })
    },
    rejectPatternVersion() {
      if (!this.selectedPatternTask || !this.selectedPatternTask.currentVersionId) return
      const result = reviewPatternVersion(this.selectedPatternTask.currentVersionId, 'rejected', '退回修改')
      if (!result.ok) {
        uni.showToast({ title: '退回失败', icon: 'none' })
        return
      }
      this.loadWorkspaceData()
      uni.showToast({ title: '已退回修改', icon: 'none' })
    },
    savePatternDraft() {
      uni.showToast({ title: '草稿已保留在当前版本记录', icon: 'none' })
    },
    addPatternToLibrary() {
      if (!this.selectedPatternVersion.productionAvailable) {
        uni.showToast({ title: '未审核通过的版型不能加入生产可用资产', icon: 'none' })
        return
      }
      this.currentModule = 'library'
      this.libraryTab = 'enterprise'
      this.libraryDetailId = this.selectedPatternTask.patternMasterId
      this.libraryDetailTab = 'basic'
      uni.showToast({ title: '已进入企业版型库', icon: 'none' })
      this.updateRoute()
    },
    getLibraryFilterIndex(field = {}) {
      const value = this.libraryFilters[field.key] || '全部'
      return Math.max(0, (field.options || []).findIndex((item) => item === value))
    },
    onLibraryFilterChange(field = {}, event = {}) {
      const index = Number(event.detail && event.detail.value)
      const value = field.options[index] || '全部'
      this.libraryFilters = {
        ...this.libraryFilters,
        [field.key]: value
      }
    },
    resetLibraryFilters() {
      this.libraryFilters = {}
      this.libraryKeyword = ''
      this.libraryCodeKeyword = ''
    },
    getLibraryTabCount(tab = '') {
      return listPatternLibraryRecords({ tab }).length
    },
    openLibraryDetail(item = {}) {
      if (!item.patternMasterId) return
      this.libraryDetailId = item.patternMasterId
      this.libraryDetailTab = 'basic'
      this.updateRoute()
    },
    closeLibraryDetail() {
      this.libraryDetailId = ''
      this.libraryDetailTab = 'basic'
      this.updateRoute()
    },
    getLibraryCurrentVersion(item = {}) {
      return getPatternVersion(item.currentVersionId) || {}
    },
    toggleLibraryFavorite(item = {}) {
      const result = togglePatternFavorite(item.patternMasterId)
      if (!result.ok) {
        uni.showToast({ title: '收藏操作失败', icon: 'none' })
        return
      }
      this.loadWorkspaceData()
      uni.showToast({ title: item.favorite ? '已取消收藏' : '已收藏', icon: 'none' })
    },
    usePatternForMaking(item = {}) {
      this.currentModule = 'pattern-making'
      this.currentType = 'derivation'
      this.patternCreateMode = true
      this.patternTaskDetailId = ''
      this.patternDetailTab = 'overview'
      this.patternCreateStep = 'reference'
      this.patternForm = {
        ...createDefaultPatternForm(),
        category: item.category || '女装上衣',
        referencePatternId: item.patternMasterId,
        patternDirection: item.ease || '标准松量'
      }
      uni.showToast({ title: '已引用版型进入制版任务', icon: 'none' })
      this.updateRoute()
    },
    copyLibraryPattern(item = {}) {
      const result = copyPatternToPersonal(item.patternMasterId)
      if (!result.ok) {
        uni.showToast({ title: '复制失败', icon: 'none' })
        return
      }
      this.loadWorkspaceData()
      this.libraryTab = 'personal'
      this.libraryDetailId = result.master.patternMasterId
      uni.showToast({ title: '已复制到个人库', icon: 'none' })
      this.updateRoute()
    },
    createLibraryVariant(item = {}) {
      const result = createDerivedPattern(item.patternMasterId, {
        title: `${item.title || '版型'} 派生变体`,
        ease: item.ease === '宽松版型' ? '标准松量' : '宽松版型',
        length: item.length === '短款' ? '常规衣长' : '短款'
      })
      if (!result.ok) {
        uni.showToast({ title: '创建变体失败', icon: 'none' })
        return
      }
      this.loadWorkspaceData()
      this.libraryTab = result.master.scope || 'enterprise'
      this.libraryDetailId = result.master.patternMasterId
      this.libraryDetailTab = 'lineage'
      uni.showToast({ title: '已创建派生版型', icon: 'none' })
      this.updateRoute()
    },
    submitLibraryReview(item = {}) {
      const version = getPatternVersion(item.currentVersionId)
      if (!version || !version.versionId) {
        uni.showToast({ title: '当前版型缺少版本记录', icon: 'none' })
        return
      }
      const result = submitPatternVersionReview(version.versionId)
      if (!result.ok) {
        uni.showToast({ title: '提交审核失败', icon: 'none' })
        return
      }
      this.loadWorkspaceData()
      uni.showToast({ title: '已提交版型审核', icon: 'none' })
    },
    archiveLibraryPattern(item = {}) {
      const result = archivePatternMaster(item.patternMasterId)
      if (!result.ok) {
        uni.showToast({ title: '归档失败', icon: 'none' })
        return
      }
      this.loadWorkspaceData()
      this.libraryDetailId = ''
      this.libraryTab = 'archived'
      uni.showToast({ title: '已归档', icon: 'none' })
      this.updateRoute()
    },
    createNewLibraryPattern() {
      this.startPatternCreate('recognition')
    },
    batchImportPatterns() {
      uni.showToast({ title: '批量导入规划中：不会伪造导入结果', icon: 'none' })
    },
    imageSearchPattern() {
      uni.showToast({ title: '图片相似检索规划中：当前可用关键词和编号搜索', icon: 'none' })
    },
    onProjectBusinessTypeChange(event = {}) {
      const index = Number(event.detail && event.detail.value)
      this.projectForm.businessType = this.projectBusinessTypes[index] || this.projectBusinessTypes[0]
    },
    toggleProjectModule(moduleName = '') {
      this.projectForm.modules = this.projectForm.modules.includes(moduleName)
        ? this.projectForm.modules.filter((item) => item !== moduleName)
        : [...this.projectForm.modules, moduleName]
    },
    startProjectCreate() {
      this.currentModule = 'projects'
      this.projectCreateMode = true
      this.projectCreateStep = 'basic'
      this.projectDetailId = ''
      this.projectDetailTab = 'overview'
      this.projectForm = createDefaultProjectForm()
      this.updateRoute()
    },
    exitProjectCreate() {
      this.projectCreateMode = false
      this.projectCreateStep = 'basic'
      this.updateRoute()
    },
    nextProjectCreateStep() {
      const next = Math.min(this.projectCreateSteps.length - 1, this.projectCreateStepIndex + 1)
      this.projectCreateStep = this.projectCreateSteps[next].key
    },
    prevProjectCreateStep() {
      const prev = Math.max(0, this.projectCreateStepIndex - 1)
      this.projectCreateStep = this.projectCreateSteps[prev].key
    },
    submitWorkspaceProject() {
      if (!this.projectForm.projectName || this.projectForm.projectName.length < 2) {
        uni.showToast({ title: '请填写至少 2 个字符的项目名称', icon: 'none' })
        this.projectCreateStep = 'basic'
        return
      }
      const members = String(this.projectForm.memberText || '')
        .split(/[、,，]/)
        .map((role, index) => ({ memberId: `project_member_${index}`, name: role.trim() || '成员', role: role.trim() || '只读成员' }))
        .filter((item) => item.role)
      const project = createWorkspaceProject({
        ...this.projectForm,
        members
      })
      this.loadWorkspaceData()
      this.projectCreateMode = false
      this.projectDetailId = project.projectId
      this.projectDetailTab = 'overview'
      uni.showToast({ title: '项目已创建', icon: 'none' })
      this.updateRoute()
    },
    openWorkspaceProject(item = {}) {
      if (!item.projectId) return
      this.currentModule = 'projects'
      this.projectCreateMode = false
      this.projectDetailId = item.projectId
      this.projectDetailTab = 'overview'
      this.updateRoute()
    },
    closeWorkspaceProjectDetail() {
      this.projectDetailId = ''
      this.projectDetailTab = 'overview'
      this.updateRoute()
    },
    setProjectDetailTab(tab = 'overview') {
      this.projectDetailTab = tab
      this.updateRoute()
    },
    getProjectTabCount(tab = 'all') {
      if (tab === 'all') return this.workspaceProjects.length
      return this.workspaceProjects.filter((project) => project.status === tab).length
    },
    getWorkspaceProjectStatusLabel(status = '') {
      const item = this.workspaceProjectStatuses.find((option) => option.key === status)
      return item ? item.label : '草稿'
    },
    getWorkspaceProjectProgress(project = {}) {
      const map = { draft: 10, active: 42, reviewing: 65, delivering: 82, completed: 100, archived: 100 }
      return map[project.status] || 10
    },
    getProjectLinkedCount(project = {}) {
      const taskCount = new Set([...(project.taskIds || []), ...(project.linkedTaskIds || [])]).size
      const patternCount = (project.linkedPatternIds || []).length
      const deliveryCount = (project.deliveryBatchIds || []).length
      return `${taskCount}/${patternCount}/${deliveryCount}`
    },
    getProjectActivityLabel(action = '') {
      const map = {
        status_change: '状态变更',
        link_task: '关联任务',
        link_pattern: '关联版型',
        create_delivery_batch: '创建交付批次'
      }
      return map[action] || '项目操作'
    },
    changeProjectStatus(status = '') {
      if (!this.selectedWorkspaceProject) return
      const result = changeWorkspaceProjectStatus(this.selectedWorkspaceProject.projectId, status, '工作台项目状态调整')
      if (!result.ok) {
        uni.showToast({ title: '状态变更失败', icon: 'none' })
        return
      }
      this.loadWorkspaceData()
      uni.showToast({ title: '项目状态已更新', icon: 'none' })
    },
    createProjectAiOutputTask() {
      if (!this.selectedWorkspaceProject) return
      uni.navigateTo({ url: `/package-ai/upload/upload?entryScene=workspace&type=model&projectId=${encodeURIComponent(this.selectedWorkspaceProject.projectId)}` })
    },
    createProjectPatternTask() {
      if (!this.selectedWorkspaceProject) return
      this.currentModule = 'pattern-making'
      this.currentType = 'recognition'
      this.patternCreateMode = true
      this.patternTaskDetailId = ''
      this.patternCreateStep = 'category'
      this.patternForm = createDefaultPatternForm()
      this.patternProjectId = this.selectedWorkspaceProject.projectId
      this.patternForm.projectId = this.selectedWorkspaceProject.projectId
      this.updateRoute()
    },
    addExistingTaskToProject() {
      if (!this.selectedWorkspaceProject) return
      const availableTask = this.tasks.find((task) => task.taskId && !this.selectedWorkspaceProject.linkedTaskIds.includes(task.taskId))
      if (!availableTask) {
        uni.showToast({ title: '暂无可关联的已有任务', icon: 'none' })
        return
      }
      const result = linkTaskToWorkspaceProject(this.selectedWorkspaceProject.projectId, availableTask)
      if (!result.ok) {
        uni.showToast({ title: '关联任务失败', icon: 'none' })
        return
      }
      this.loadWorkspaceData()
      uni.showToast({ title: '已关联已有任务', icon: 'none' })
    },
    addPatternToProject() {
      if (!this.selectedWorkspaceProject) return
      const availablePattern = this.patternDashboard.masters.find((pattern) => !this.selectedWorkspaceProject.linkedPatternIds.includes(pattern.patternMasterId))
      if (!availablePattern) {
        uni.showToast({ title: '暂无可关联的版型', icon: 'none' })
        return
      }
      const result = linkPatternToWorkspaceProject(this.selectedWorkspaceProject.projectId, availablePattern.patternMasterId)
      if (!result.ok) {
        uni.showToast({ title: '关联版型失败', icon: 'none' })
        return
      }
      this.loadWorkspaceData()
      uni.showToast({ title: '已添加版型资产', icon: 'none' })
    },
    createProjectDeliveryBatch() {
      if (!this.selectedWorkspaceProject) return
      const result = createWorkspaceDeliveryBatch(this.selectedWorkspaceProject.projectId)
      if (!result.ok) {
        uni.showToast({ title: '创建交付批次失败', icon: 'none' })
        return
      }
      this.loadWorkspaceData()
      this.projectDetailTab = 'delivery'
      uni.showToast({ title: '已创建交付批次', icon: 'none' })
      this.updateRoute()
    },
    startBatchCreate(projectId = '') {
      this.currentModule = 'batch'
      this.batchCreateMode = true
      this.batchCreateStep = 'project'
      this.batchDetailId = ''
      this.batchDetailTab = 'overview'
      this.batchForm = {
        ...createDefaultBatchForm(),
        projectId: typeof projectId === 'string' ? projectId : ''
      }
      this.updateRoute()
    },
    exitBatchCreate() {
      this.batchCreateMode = false
      this.batchCreateStep = 'project'
      this.updateRoute()
    },
    nextBatchCreateStep() {
      const next = Math.min(this.batchCreateSteps.length - 1, this.batchCreateStepIndex + 1)
      this.batchCreateStep = this.batchCreateSteps[next].key
    },
    prevBatchCreateStep() {
      const prev = Math.max(0, this.batchCreateStepIndex - 1)
      this.batchCreateStep = this.batchCreateSteps[prev].key
    },
    onBatchProjectChange(event = {}) {
      const index = Number(event.detail && event.detail.value)
      this.batchForm.projectId = index > 0 && this.workspaceProjects[index - 1] ? this.workspaceProjects[index - 1].projectId : ''
    },
    onBatchTaskTypeChange(event = {}) {
      const index = Number(event.detail && event.detail.value)
      this.batchForm.taskType = this.batchTaskTypes[index] || this.batchTaskTypes[0]
    },
    submitBatchDraft() {
      const result = createWorkspaceBatchDraft({
        ...this.batchForm,
        estimatedQuota: this.estimatedBatchQuota,
        title: `${this.batchForm.taskType} · ${this.selectedBatchProjectLabel}`,
        idempotencyKey: this.batchForm.idempotencyKey
      })
      if (!result.ok) {
        uni.showToast({ title: '创建批量任务失败', icon: 'none' })
        return
      }
      this.loadWorkspaceData()
      this.batchCreateMode = false
      this.batchDetailId = result.batch.batchId
      this.batchDetailTab = 'overview'
      uni.showToast({ title: result.idempotent ? '已恢复同一幂等批次' : '已创建批量任务草稿', icon: 'none' })
      this.updateRoute()
    },
    openBatchDetail(item = {}) {
      if (!item.batchId) return
      this.currentModule = 'batch'
      this.batchCreateMode = false
      this.batchDetailId = item.batchId
      this.batchDetailTab = 'overview'
      this.updateRoute()
    },
    closeBatchDetail() {
      this.batchDetailId = ''
      this.batchDetailTab = 'overview'
      this.updateRoute()
    },
    setBatchDetailTab(tab = 'overview') {
      this.batchDetailTab = tab
      this.updateRoute()
    },
    getBatchTabCount(tab = '') {
      return this.workspaceBatches.filter((batch) => batch.status === tab).length
    },
    getWorkspaceBatchStatusLabel(status = '') {
      const item = this.batchTabs.find((tab) => tab.key === status)
      return item ? item.label : '草稿批次'
    },
    getBatchProjectName(projectId = '') {
      if (!projectId) return '未关联项目'
      const project = this.workspaceProjects.find((item) => item.projectId === projectId)
      return project ? project.name : '项目不存在'
    },
    isTaskReviewSafe(task = {}) {
      const status = String(task.status || '').toLowerCase()
      const provider = String(task.provider || task.resultProvider || (task.result && task.result.provider) || '').toLowerCase()
      const source = String(task.source || (task.result && task.result.source) || '').toLowerCase()
      const hasResult = !!(task.resultImageUrl || (task.result && (task.result.image || task.result.imageUrl)) || ((task.result && task.result.items && task.result.items[0]) || ''))
      if (!['success', 'completed'].includes(status)) return false
      if (!hasResult) return false
      if (provider.includes('mock') || provider.includes('fallback')) return false
      if (source.includes('mock') || source.includes('fallback') || source.includes('test')) return false
      return true
    },
    pausePendingTasks() {
      if (!this.selectedWorkspaceBatch) return
      const result = pauseWorkspaceBatchPending(this.selectedWorkspaceBatch.batchId)
      this.loadWorkspaceData()
      uni.showToast({ title: `已暂停 ${result.success || 0} 个未开始任务`, icon: 'none' })
    },
    retryFailedTasks() {
      if (!this.selectedWorkspaceBatch) return
      const result = retryWorkspaceBatchFailures(this.selectedWorkspaceBatch.batchId)
      this.loadWorkspaceData()
      uni.showToast({ title: `重试成功 ${result.success || 0}，跳过 ${result.skipped || 0}`, icon: 'none' })
    },
    approveSingleTask(task = {}) {
      if (!this.selectedWorkspaceBatch) return
      const result = approveWorkspaceBatchTasks(this.selectedWorkspaceBatch.batchId, [task.taskId])
      this.loadWorkspaceData()
      uni.showToast({ title: `通过 ${result.success || 0}，失败 ${result.failed || 0}，跳过 ${result.skipped || 0}`, icon: 'none' })
    },
    bulkApproveTasks() {
      if (!this.selectedWorkspaceBatch) return
      const result = approveWorkspaceBatchTasks(this.selectedWorkspaceBatch.batchId, this.reviewableBatchTasks.map((task) => task.taskId), { bulk: true })
      this.loadWorkspaceData()
      uni.showToast({ title: `批量通过 ${result.success || 0}，失败 ${result.failed || 0}，跳过 ${result.skipped || 0}`, icon: 'none' })
    },
    rejectSingleTask(task = {}) {
      if (!this.selectedWorkspaceBatch) return
      rejectWorkspaceBatchTask(this.selectedWorkspaceBatch.batchId, task.taskId, '退回修改')
      this.loadWorkspaceData()
      uni.showToast({ title: '已退回修改', icon: 'none' })
    },
    markTaskRetouch(task = {}) {
      if (!this.selectedWorkspaceBatch) return
      markWorkspaceBatchRetouch(this.selectedWorkspaceBatch.batchId, task.taskId, '标记人工精修')
      this.loadWorkspaceData()
      uni.showToast({ title: '已标记人工精修', icon: 'none' })
    },
    createDeliveryFromBatch() {
      if (!this.selectedWorkspaceBatch) return
      const deliveryForm = this.deliveryForm || createDefaultDeliveryForm()
      const result = createWorkspaceDelivery({
        batchId: this.selectedWorkspaceBatch.batchId,
        projectId: this.selectedWorkspaceBatch.projectId,
        title: deliveryForm.title || `${this.selectedWorkspaceBatch.title} 交付清单`,
        usage: deliveryForm.usage || '电商上新',
        fileFormat: deliveryForm.fileFormat || 'JPG/PNG',
        sizeSpec: deliveryForm.sizeSpec || '平台通用尺寸',
        namingRule: deliveryForm.namingRule || '项目-批次-序号',
        note: deliveryForm.note || '审核通过作品进入正式交付'
      })
      if (!result.ok) {
        uni.showToast({ title: '请先通过至少一个可交付任务', icon: 'none' })
        return
      }
      this.loadWorkspaceData()
      this.deliveryForm = createDefaultDeliveryForm()
      this.batchDetailTab = 'delivery'
      uni.showToast({ title: '已创建交付清单', icon: 'none' })
      this.updateRoute()
    },
    getBatchActivityLabel(action = '') {
      const map = {
        create_draft: '创建草稿',
        approve: '审核通过',
        bulk_approve: '批量通过',
        reject: '退回修改',
        mark_retouch: '人工精修',
        retry_failed: '重试失败项',
        pause_pending: '暂停未开始',
        create_delivery: '创建交付'
      }
      return map[action] || '批量操作'
    },
    setTrainingTab(tab = 'overview') {
      this.trainingTab = tab
      this.updateRoute()
    },
    getTrainingSplitIndex() {
      return Math.max(0, ['all', 'train', 'validation', 'test'].findIndex((item) => item === this.trainingDatasetSplit))
    },
    onTrainingSplitChange(event = {}) {
      const options = ['all', 'train', 'validation', 'test']
      this.trainingDatasetSplit = options[Number(event.detail && event.detail.value)] || 'all'
    },
    getTrainingSplitLabel(split = '') {
      const map = { all: '全部', train: '训练集', validation: '验证集', test: '测试集' }
      return map[split] || '训练集'
    },
    getDatasetStatusLabel(status = '') {
      const map = { draft: '草稿', validating: '校验中', ready: '可训练', frozen: '已冻结', archived: '已归档' }
      return map[status] || '草稿'
    },
    getTrainingModelStatusIndex() {
      return Math.max(0, ['all', 'candidate', 'evaluating', 'approved', 'active', 'deprecated', 'rolled_back'].findIndex((item) => item === this.trainingModelStatus))
    },
    onTrainingModelStatusChange(event = {}) {
      const options = ['all', 'candidate', 'evaluating', 'approved', 'active', 'deprecated', 'rolled_back']
      this.trainingModelStatus = options[Number(event.detail && event.detail.value)] || 'all'
    },
    getModelStatusLabel(status = '') {
      const map = {
        all: '全部',
        candidate: '候选',
        evaluating: '评估中',
        approved: '已批准',
        active: '启用中',
        deprecated: '已废弃',
        rolled_back: '已回滚'
      }
      return map[status] || '候选'
    },
    refreshTrainingCenter() {
      this.patternTrainingCenter = loadPatternTrainingCenter(this.patternDashboard, this.settingsCenter.privacy || {})
    },
    createTrainingDatasetDraft() {
      const result = createTrainingDataset({
        name: this.trainingDatasetSplit === 'test' ? '固定测试集' : 'AI 制版训练数据集',
        split: this.trainingDatasetSplit === 'all' ? 'train' : this.trainingDatasetSplit,
        version: 'V1'
      }, this.patternDashboard, this.settingsCenter.privacy || {})
      if (!result.success) {
        uni.showToast({ title: result.errorCode === 'forbidden' ? '暂无训练数据集权限' : '创建数据集失败', icon: 'none' })
        return
      }
      this.refreshTrainingCenter()
      uni.showToast({ title: `已创建，样本 ${result.dataset.sampleIds.length}`, icon: 'none' })
    },
    updateTrainingDataset(dataset = {}, status = 'validating') {
      if (dataset.status === 'frozen' && status !== 'archived') {
        uni.showToast({ title: '测试集或冻结集不可随意修改', icon: 'none' })
        return
      }
      const result = updateTrainingDatasetStatus(dataset.datasetId, status)
      if (!result.success) {
        uni.showToast({ title: '数据集状态更新失败', icon: 'none' })
        return
      }
      this.refreshTrainingCenter()
      uni.showToast({ title: `已更新为${this.getDatasetStatusLabel(status)}`, icon: 'none' })
    },
    createTrainingCandidateModel() {
      const dataset = this.patternTrainingCenter.datasets.find((item) => ['ready', 'frozen'].includes(item.status)) || this.patternTrainingCenter.datasets[0]
      const result = createCandidateModel(dataset && dataset.datasetId)
      if (!result.success) {
        uni.showToast({ title: result.errorCode === 'forbidden' ? '暂无模型权限' : '请先创建数据集', icon: 'none' })
        return
      }
      this.refreshTrainingCenter()
      uni.showToast({ title: '已创建候选模型', icon: 'none' })
    },
    approveTrainingModel(model = {}) {
      const result = approveCandidateModel(model.modelId)
      if (!result.success) {
        uni.showToast({ title: '候选模型批准失败', icon: 'none' })
        return
      }
      this.refreshTrainingCenter()
      uni.showToast({ title: '已记录版师抽检、风险确认和管理员批准', icon: 'none' })
    },
    activateTrainingModel(model = {}) {
      const result = activateModel(model.modelId)
      if (!result.success) {
        uni.showToast({ title: '模型未批准，不能灰度启用', icon: 'none' })
        return
      }
      this.refreshTrainingCenter()
      uni.showToast({ title: '已灰度启用新模型', icon: 'none' })
    },
    rollbackTrainingModel(model = {}) {
      uni.showModal({
        title: '确认回滚模型',
        content: '回滚会记录审计日志，不会删除历史评估和训练记录。是否继续？',
        success: (res) => {
          if (!res.confirm) return
          const result = rollbackActiveModel(model.modelId)
          if (!result.success) {
            uni.showToast({ title: '回滚失败', icon: 'none' })
            return
          }
          this.refreshTrainingCenter()
          uni.showToast({ title: '已回滚模型版本', icon: 'none' })
        }
      })
    },
    setModelOpsTab(tab = 'overview') {
      this.modelOpsTab = tab
      this.updateRoute()
    },
    getModelOpsReleaseStatusIndex() {
      return Math.max(0, ['all', 'draft', 'gray_planned', 'gray_running', 'paused', 'expanded', 'active', 'rolled_back'].findIndex((item) => item === this.modelOpsReleaseStatus))
    },
    onModelOpsReleaseStatusChange(event = {}) {
      const options = ['all', 'draft', 'gray_planned', 'gray_running', 'paused', 'expanded', 'active', 'rolled_back']
      this.modelOpsReleaseStatus = options[Number(event.detail && event.detail.value)] || 'all'
    },
    getReleaseStatusLabel(status = '') {
      const map = {
        all: '全部',
        draft: '草稿',
        offline_evaluated: '已离线评估',
        checked: '已抽检',
        risk_confirmed: '风险已确认',
        gray_planned: '灰度计划',
        gray_running: '灰度中',
        paused: '已暂停',
        expanded: '扩大灰度',
        active: '正式激活',
        rolled_back: '已回滚'
      }
      return map[status] || '草稿'
    },
    refreshModelOperationsCenter() {
      this.modelOperationsCenter = loadModelOperationsCenter({
        tasks: this.tasks,
        trainingCenter: this.patternTrainingCenter
      })
    },
    createModelOpsRelease() {
      const model = this.patternTrainingCenter.models.find((item) => ['approved', 'active', 'evaluating', 'candidate'].includes(item.status))
      if (!model) {
        uni.showToast({ title: '请先在训练评估中心创建模型版本', icon: 'none' })
        return
      }
      const result = createGrayReleasePlan(model)
      if (!result.success) {
        uni.showToast({ title: result.errorCode === 'forbidden' ? '暂无模型运维权限' : '创建灰度计划失败', icon: 'none' })
        return
      }
      this.refreshModelOperationsCenter()
      this.modelOpsTab = 'releases'
      uni.showToast({ title: '已创建首轮小范围灰度计划', icon: 'none' })
      this.updateRoute()
    },
    markReleaseGate(release = {}, gate = '') {
      const result = advanceReleaseGate(release.releaseId, gate)
      if (!result.success) {
        uni.showToast({ title: '发布门禁更新失败', icon: 'none' })
        return
      }
      this.refreshModelOperationsCenter()
      uni.showToast({ title: '门禁已记录', icon: 'none' })
    },
    expandModelOpsRelease(release = {}) {
      const result = expandRelease(release.releaseId)
      if (!result.success) {
        uni.showToast({ title: result.errorCode === 'release_gates_incomplete' ? '门禁未完成，不能扩大灰度' : '扩大灰度失败', icon: 'none' })
        return
      }
      this.refreshModelOperationsCenter()
      uni.showToast({ title: '灰度范围已更新', icon: 'none' })
    },
    pauseModelOpsRelease(release = {}) {
      const result = pauseRelease(release.releaseId)
      if (!result.success) {
        uni.showToast({ title: '暂停灰度失败', icon: 'none' })
        return
      }
      this.refreshModelOperationsCenter()
      uni.showToast({ title: '已暂停扩大灰度并记录异常', icon: 'none' })
    },
    rollbackModelOpsRelease(release = {}) {
      uni.showModal({
        title: '确认回滚模型发布',
        content: '回滚不会删除新模型任务和历史评估数据，会记录原因、操作人、原模型、目标模型、影响范围和时间。',
        success: (res) => {
          if (!res.confirm) return
          const result = rollbackRelease(release.releaseId)
          if (!result.success) {
            uni.showToast({ title: '回滚失败', icon: 'none' })
            return
          }
          this.refreshModelOperationsCenter()
          uni.showToast({ title: '已回滚模型发布', icon: 'none' })
        }
      })
    },
    resolveModelOpsIncident(incident = {}) {
      const result = resolveIncident(incident.incidentId)
      if (!result.success) {
        uni.showToast({ title: '异常处理失败', icon: 'none' })
        return
      }
      this.refreshModelOperationsCenter()
      uni.showToast({ title: '异常已标记处理', icon: 'none' })
    },
    openWorkspaceAsset(asset = {}) {
      if (!asset.assetId) return
      this.currentModule = 'assets'
      this.assetDetailId = asset.assetId
      this.assetDetailTab = 'preview'
      this.assetSelectedIds = []
      this.updateRoute()
    },
    closeWorkspaceAsset() {
      this.assetDetailId = ''
      this.assetDetailTab = 'preview'
      this.updateRoute()
    },
    setAssetDetailTab(tab = 'preview') {
      this.assetDetailTab = tab
      this.updateRoute()
    },
    onAssetTypeChange(event = {}) {
      const index = Number(event.detail && event.detail.value)
      this.assetType = this.assetTypes[index] ? this.assetTypes[index].key : 'all'
      this.assetDetailId = ''
      this.updateRoute()
    },
    onAssetViewModeChange(event = {}) {
      const index = Number(event.detail && event.detail.value)
      this.assetViewMode = this.assetViewModes[index] ? this.assetViewModes[index].key : 'grid'
      this.updateRoute()
    },
    onAssetProjectFilterChange(event = {}) {
      const index = Number(event.detail && event.detail.value)
      this.assetFilterProjectId = this.assetProjectIds[index] || ''
    },
    onAssetReviewStatusChange(event = {}) {
      const index = Number(event.detail && event.detail.value)
      this.assetFilterReviewStatus = this.assetReviewOptions[index] || 'all'
    },
    onAssetDeliveryStatusChange(event = {}) {
      const index = Number(event.detail && event.detail.value)
      this.assetFilterDeliveryStatus = this.assetDeliveryOptions[index] || 'all'
    },
    getAssetTypeIndex() {
      return Math.max(0, this.assetTypes.findIndex((item) => item.key === this.assetType))
    },
    getAssetViewModeIndex() {
      return Math.max(0, this.assetViewModes.findIndex((item) => item.key === this.assetViewMode))
    },
    getAssetTypeLabel(type = '') {
      const target = this.assetTypes.find((item) => item.key === type)
      return target ? target.label : '数字资产'
    },
    getAssetTypeCount(type = 'all') {
      return this.workspaceAssets.filter((asset) => type === 'all' || asset.type === type).length
    },
    getAssetReviewLabel(status = '') {
      const map = {
        not_submitted: '未提交',
        pending: '待审核',
        under_review: '审核中',
        approved: '已批准',
        reviewed: '已复核',
        rejected: '已退回',
        draft: '草稿'
      }
      return map[status] || '未提交'
    },
    getAssetDeliveryLabel(status = '') {
      const map = {
        not_delivered: '未交付',
        pending_delivery: '待交付',
        delivered: '已交付',
        confirmed: '已确认',
        draft: '交付草稿',
        preparing: '准备中'
      }
      return map[status] || '未交付'
    },
    getAssetGroupTitle(key = '') {
      if (this.assetViewMode === 'project') return key === 'none' ? '未关联项目' : this.getBatchProjectName(key)
      if (this.assetViewMode === 'batch') return key === 'none' ? '未关联批次' : `批次 ${key}`
      return key || '未记录时间'
    },
    isAssetSelected(asset = {}) {
      return this.assetSelectedIds.includes(asset.assetId)
    },
    toggleAssetSelection(asset = {}) {
      if (!asset.assetId) return
      const selected = new Set(this.assetSelectedIds)
      if (selected.has(asset.assetId)) selected.delete(asset.assetId)
      else selected.add(asset.assetId)
      this.assetSelectedIds = [...selected]
    },
    clearAssetSelection() {
      this.assetSelectedIds = []
    },
    resetAssetFilters() {
      this.assetKeyword = ''
      this.assetType = 'all'
      this.assetFilterProjectId = ''
      this.assetFilterTaskId = ''
      this.assetFilterBatchId = ''
      this.assetFilterCreator = ''
      this.assetFilterReviewStatus = 'all'
      this.assetFilterDeliveryStatus = 'all'
      this.assetFilterGenerationMode = 'all'
      this.assetFilterFormat = 'all'
      this.assetSelectedIds = []
      this.updateRoute()
    },
    previewAsset(asset = {}) {
      this.openWorkspaceAsset(asset)
    },
    downloadAsset(asset = {}) {
      if (!asset.assetId) return
      uni.showToast({ title: '下载需在详情中选择明确版本', icon: 'none' })
    },
    addAssetProject(asset = {}) {
      const project = this.workspaceProjects[0]
      if (!project) {
        uni.showToast({ title: '暂无可加入的项目', icon: 'none' })
        return
      }
      const result = addWorkspaceAssetToProject(asset, project.projectId)
      if (!result.success) {
        uni.showToast({ title: '加入项目失败', icon: 'none' })
        return
      }
      this.loadWorkspaceData()
      uni.showToast({ title: `已加入 ${project.name}`, icon: 'none' })
    },
    submitAssetReview(asset = {}) {
      const result = submitWorkspaceAssetReview(asset)
      if (!result.success) {
        uni.showToast({ title: '提交审核失败', icon: 'none' })
        return
      }
      this.loadWorkspaceData()
      uni.showToast({ title: '已提交审核', icon: 'none' })
    },
    createAssetVariant(asset = {}) {
      if (asset.type === 'pattern_file') {
        const patternId = String(asset.assetId || '').replace('pattern_asset_', '')
        const pattern = this.patternDashboard.masters.find((item) => item.patternMasterId === patternId)
        if (pattern) {
          this.openLibraryDetail(pattern)
          return
        }
      }
      this.currentModule = 'ai-output'
      this.createMode = true
      this.createFeatureType = 'refine'
      this.currentType = 'refine'
      this.createStep = 'upload'
      this.updateRoute()
    },
    showAssetSource(asset = {}) {
      this.openWorkspaceAsset(asset)
      this.assetDetailTab = 'source'
      this.updateRoute()
    },
    archiveAsset(asset = {}) {
      uni.showModal({
        title: '确认归档资产',
        content: '归档不会删除历史交付记录。已交付资产不能被静默覆盖，后续修改需形成新版本。',
        success: (res) => {
          if (!res.confirm) return
          const result = archiveWorkspaceAsset(asset)
          if (!result.success) {
            uni.showToast({ title: result.errorCode === 'forbidden' ? '当前账号无权归档' : '归档失败', icon: 'none' })
            return
          }
          this.loadWorkspaceData()
          uni.showToast({ title: '已归档资产', icon: 'none' })
        }
      })
    },
    runAssetBatchAction(action = '') {
      if (!this.selectedAssetList.length) {
        uni.showToast({ title: '请先选择资产', icon: 'none' })
        return
      }
      if (action === 'download') {
        uni.showToast({ title: `已选择 ${this.selectedAssetList.length} 个资产，下载会按所选版本生成清单`, icon: 'none' })
        return
      }
      if (action === 'delivery') {
        uni.showToast({ title: '交付清单将复用交付中心创建流程', icon: 'none' })
        this.selectModule('delivery')
        return
      }
      const actionMap = {
        review: { label: '批量提交审核', patch: { reviewStatus: 'pending' } },
        archive: { label: '批量归档', patch: { archived: true } },
        tag: { label: '批量修改标签', patch: { tags: ['批量标记'] } },
        project: { label: '批量加入项目', patch: { projectId: this.workspaceProjects[0] ? this.workspaceProjects[0].projectId : '' } }
      }
      const config = actionMap[action]
      if (!config) return
      if (action === 'project' && !config.patch.projectId) {
        uni.showToast({ title: '暂无可加入的项目', icon: 'none' })
        return
      }
      const result = batchPatchWorkspaceAssets(this.selectedAssetList, config.label, config.patch)
      this.loadWorkspaceData()
      this.assetSelectedIds = []
      uni.showToast({ title: `成功 ${result.successCount}，失败 ${result.failedCount}，跳过 ${result.skippedCount}`, icon: 'none' })
    },
    setTeamTab(tab = 'overview') {
      this.teamTab = tab
      this.updateRoute()
    },
    openTeamInvite() {
      this.teamInviteOpen = true
      this.teamInviteForm = createDefaultTeamInviteForm()
      if (this.teamRoleOptions.length && !this.teamRoleOptions.includes(this.teamInviteForm.role)) {
        this.teamInviteForm.role = this.teamRoleOptions[0]
      }
    },
    getRolePickerIndex(role = '') {
      return Math.max(0, this.teamRoleOptions.findIndex((item) => item === role))
    },
    onInviteRoleChange(event) {
      const index = Number(event.detail.value || 0)
      this.teamInviteForm.role = this.teamRoleOptions[index] || 'viewer'
    },
    async submitTeamInvite() {
      if (!this.teamInviteForm.targetAccount) {
        uni.showToast({ title: '请填写手机号或邮箱', icon: 'none' })
        return
      }
      const result = await inviteWorkspaceMember(this.teamInviteForm)
      if (!result || !result.success) {
        uni.showToast({ title: this.getTeamErrorLabel(result && result.errorCode) || '邀请失败', icon: 'none' })
        return
      }
      this.teamInviteOpen = false
      await this.loadTeamCenter()
      uni.showToast({ title: '已创建邀请', icon: 'none' })
    },
    async cancelTeamInvite(invite = {}) {
      const result = await cancelWorkspaceInvite(invite.inviteId)
      if (!result || !result.success) {
        uni.showToast({ title: this.getTeamErrorLabel(result && result.errorCode) || '撤销失败', icon: 'none' })
        return
      }
      await this.loadTeamCenter()
      uni.showToast({ title: '已撤销邀请', icon: 'none' })
    },
    resendTeamInvite(invite = {}) {
      this.teamInviteOpen = true
      this.teamInviteForm = {
        targetAccount: invite.targetAccount || '',
        role: invite.role || 'viewer'
      }
      uni.showToast({ title: '已填入原邀请信息，请确认后重新发送', icon: 'none' })
    },
    async onMemberRoleChange(member = {}, event) {
      const index = Number(event.detail.value || 0)
      const nextRole = this.teamRoleOptions[index] || member.role
      if (nextRole === member.role) return
      uni.showModal({
        title: '确认修改角色',
        content: `确认将 ${member.name} 从 ${this.getTeamRoleLabel(member.role)} 调整为 ${this.getTeamRoleLabel(nextRole)}？`,
        success: async (res) => {
          if (!res.confirm) return
          const result = await updateWorkspaceMemberRole(member, nextRole)
          if (!result || !result.success) {
            uni.showToast({ title: this.getTeamErrorLabel(result && result.errorCode) || '角色修改失败', icon: 'none' })
            return
          }
          await this.loadTeamCenter()
          uni.showToast({ title: '角色已更新', icon: 'none' })
        }
      })
    },
    assignMemberProject(member = {}) {
      uni.showToast({ title: `${member.name || '成员'} 的项目分配将复用项目成员服务`, icon: 'none' })
    },
    confirmSuspendMember(member = {}) {
      uni.showModal({
        title: '确认暂停账号',
        content: `暂停后 ${member.name} 将立即失去当前企业访问权限，是否继续？`,
        success: async (res) => {
          if (!res.confirm) return
          const result = await updateWorkspaceMemberStatus(member, 'disabled')
          if (!result || !result.success) {
            uni.showToast({ title: this.getTeamErrorLabel(result && result.errorCode) || '暂停失败', icon: 'none' })
            return
          }
          await this.loadTeamCenter()
          uni.showToast({ title: '账号已暂停', icon: 'none' })
        }
      })
    },
    confirmRemoveMember(member = {}) {
      uni.showModal({
        title: '确认移除成员',
        content: `移除成员会记录审计日志，且不会删除企业业务数据。确认移除 ${member.name}？`,
        success: async (res) => {
          if (!res.confirm) return
          const result = await removeWorkspaceMember(member)
          if (!result || !result.success) {
            uni.showToast({ title: this.getTeamErrorLabel(result && result.errorCode) || '移除失败', icon: 'none' })
            return
          }
          await this.loadTeamCenter()
          uni.showToast({ title: result.fallback === 'disabled' ? '已停用成员' : '已移除成员', icon: 'none' })
        }
      })
    },
    selectTeamRole(role = {}) {
      this.teamRoleKeyword = role.role
      this.teamRoleDraft = [...(role.permissions || [])]
    },
    toggleTeamPermission(permission = '') {
      if (this.selectedTeamRole.locked || !this.teamPermissions.canManageRoles) return
      const set = new Set(this.teamRoleDraft)
      if (set.has(permission)) set.delete(permission)
      else set.add(permission)
      this.teamRoleDraft = [...set]
    },
    async saveSelectedTeamRole() {
      if (!this.selectedTeamRole.role) return
      const result = await saveWorkspaceRolePermissions(this.selectedTeamRole.role, this.teamRoleDraft)
      if (!result || !result.success) {
        uni.showToast({ title: this.getTeamErrorLabel(result && result.errorCode) || '权限保存失败', icon: 'none' })
        return
      }
      await this.loadTeamCenter()
      uni.showToast({ title: '权限已保存', icon: 'none' })
    },
    async createCustomTeamRole() {
      const name = String(this.teamCustomRoleName || '').trim()
      if (!name) {
        uni.showToast({ title: '请填写自定义角色名称', icon: 'none' })
        return
      }
      const role = `custom_${name.replace(/[^\w\u4e00-\u9fa5]/g, '_').slice(0, 24)}`
      const result = await saveWorkspaceRolePermissions(role, [])
      if (!result || !result.success) {
        uni.showToast({ title: this.getTeamErrorLabel(result && result.errorCode) || '角色创建失败', icon: 'none' })
        return
      }
      this.teamCustomRoleName = ''
      await this.loadTeamCenter()
      const created = this.teamCenter.roles.find((item) => item.role === role)
      if (created) this.selectTeamRole(created)
      uni.showToast({ title: '已创建自定义角色', icon: 'none' })
    },
    getTeamRoleLabel(role = '') {
      const target = this.teamCenter.roles.find((item) => item.role === role)
      return target ? target.label : (role || '未设置')
    },
    getDataScopeLabel(scope = '') {
      const target = this.teamCenter.dataScopes.find((item) => item.key === scope)
      return target ? target.label : '所属项目'
    },
    getMemberStatusLabel(status = '') {
      const map = { active: '正常', pending: '待确认', disabled: '已停用' }
      return map[status] || '待确认'
    },
    getTeamAuditModuleIndex(module = 'all') {
      return Math.max(0, this.teamAuditModules.findIndex((item) => item === module))
    },
    onTeamAuditModuleChange(event) {
      const index = Number(event.detail.value || 0)
      this.teamAuditModule = this.teamAuditModules[index] || 'all'
    },
    getTeamAuditModuleLabel(module = 'all') {
      return module === 'all' ? '全部模块' : module
    },
    getTeamErrorLabel(errorCode = '') {
      const map = {
        forbidden: '当前账号无权限',
        target_account_required: '请填写手机号或邮箱',
        target_account_invalid: '手机号或邮箱格式不正确',
        member_inactive: '当前成员不可操作',
        tenant_denied: '跨企业操作已拒绝',
        invite_not_pending: '邀请已失效',
        admin_role_locked: '企业管理员权限不可修改',
        role_required: '请选择角色'
      }
      return map[errorCode] || errorCode
    },
    setSettingsTab(tab = 'profile') {
      this.settingsTab = tab
      this.updateRoute()
    },
    onSettingsDefaultModuleChange(event) {
      const index = Number(event.detail.value || 0)
      this.settingsProfileForm.defaultModule = this.settingsDefaultModuleOptions[index] || 'overview'
    },
    onSettingLanguageChange(event) {
      const index = Number(event.detail.value || 0)
      this.settingsProfileForm.language = this.settingLanguageOptions[index] || '简体中文'
    },
    getSettingsModuleLabel(module = '') {
      const target = this.workspaceMenus.find((item) => item.module === module)
      return target ? target.label : '工作台'
    },
    getOptionIndex(options = [], value = '') {
      return Math.max(0, options.findIndex((item) => item === value))
    },
    onGenerationOptionChange(key = '', options = [], event) {
      const index = Number(event.detail.value || 0)
      this.settingsGenerationForm[key] = options[index] || options[0]
    },
    refreshSettingsAfterSave(message = '已保存') {
      this.loadSettingsCenter()
      this.refreshOnboardingState()
      uni.showToast({ title: message, icon: 'none' })
    },
    saveProfileSettings() {
      const changedPhone = this.settingsProfileForm.rawPhone && this.settingsProfileForm.rawPhone !== this.settingsCenter.profile.rawPhone
      const changedEmail = this.settingsProfileForm.rawEmail && this.settingsProfileForm.rawEmail !== this.settingsCenter.profile.rawEmail
      if (changedPhone || changedEmail) {
        uni.showModal({
          title: '需要验证码确认',
          content: '修改手机号或邮箱必须先完成验证码确认。本阶段已保留验证入口，不会直接改绑。',
          showCancel: false
        })
        return
      }
      saveWorkspaceProfile(this.settingsProfileForm)
      this.refreshSettingsAfterSave('个人资料已保存')
    },
    saveEnterpriseSettings() {
      const result = saveWorkspaceEnterpriseProfile(this.settingsEnterpriseForm)
      if (!result.success) {
        uni.showToast({ title: '普通成员无权修改企业资料', icon: 'none' })
        return
      }
      this.refreshSettingsAfterSave('企业资料已保存')
    },
    saveGenerationSettings() {
      saveWorkspaceGenerationPreferences({
        ...this.settingsGenerationForm,
        defaultCount: Math.max(1, Number(this.settingsGenerationForm.defaultCount || 1))
      })
      this.refreshSettingsAfterSave('生成偏好已保存')
    },
    toggleNotification(eventKey = '', channel = {}) {
      if (!channel.available) return
      const current = this.settingsNotificationForm[eventKey] || {}
      this.$set
        ? this.$set(this.settingsNotificationForm, eventKey, { ...current, [channel.key]: !current[channel.key] })
        : (this.settingsNotificationForm[eventKey] = { ...current, [channel.key]: !current[channel.key] })
    },
    saveNotificationSettings() {
      saveWorkspaceNotificationSettings(this.settingsNotificationForm)
      this.refreshSettingsAfterSave('通知设置已保存')
    },
    saveStorageSettings() {
      saveWorkspaceStorageSettings(this.settingsStorageForm)
      this.refreshSettingsAfterSave('存储设置已保存')
    },
    savePrivacySettings() {
      if (this.settingsPrivacyForm.cancellationRequested) {
        uni.showModal({
          title: '确认申请注销',
          content: '注销账号属于敏感操作，提交后会记录审计并需要再次身份验证。确认继续？',
          success: (res) => {
            if (!res.confirm) return
            saveWorkspacePrivacySettings(this.settingsPrivacyForm)
            this.refreshSettingsAfterSave('隐私设置已保存')
          }
        })
        return
      }
      saveWorkspacePrivacySettings(this.settingsPrivacyForm)
      this.refreshSettingsAfterSave('隐私设置已保存')
    },
    confirmSecurityAction(item = {}) {
      uni.showModal({
        title: '确认敏感操作',
        content: `${item.label} 需要重新验证身份，且不会在前端显示完整令牌或密钥。是否继续？`,
        success: (res) => {
          if (!res.confirm) return
          recordWorkspaceSecurityAction(item.label)
          uni.showToast({ title: '已记录安全操作申请', icon: 'none' })
        }
      })
    },
    createNotification(type = '', title = '', desc = '', id = '', extra = {}) {
      return {
        notificationId: `${type}_${id || title}`,
        type,
        title,
        desc,
        createdAt: extra.createdAt || new Date().toISOString(),
        ...extra
      }
    },
    openNotificationPanel() {
      this.notificationPanelOpen = true
    },
    getNotificationTypeLabel(type = '') {
      const target = this.notificationTypes.find((item) => item.key === type)
      return target ? target.label : '通知'
    },
    markNotificationRead(id = '') {
      if (!id || this.notificationReadIds.includes(id)) return
      this.notificationReadIds = [id, ...this.notificationReadIds].slice(0, 300)
      try {
        uni.setStorageSync(NOTIFICATION_READ_KEY, this.notificationReadIds)
      } catch (error) {}
    },
    markAllNotificationsRead() {
      this.notificationReadIds = [...new Set([...this.notificationReadIds, ...this.workspaceNotifications.map((item) => item.notificationId)])].slice(0, 300)
      try {
        uni.setStorageSync(NOTIFICATION_READ_KEY, this.notificationReadIds)
      } catch (error) {}
    },
    openNotification(item = {}) {
      this.markNotificationRead(item.notificationId)
      this.notificationPanelOpen = false
      this.openSearchTarget(item)
    },
    createTodo(type = '', typeLabel = '', title = '', id = '', extra = {}) {
      return {
        todoId: `${type}_${id || title}`,
        type,
        typeLabel,
        title,
        owner: extra.owner || '当前负责人',
        dueAt: extra.dueAt || '',
        projectId: extra.projectId || '',
        ...extra
      }
    },
    isProjectExpiringSoon(project = {}) {
      if (!project.deadline || ['completed', 'archived'].includes(String(project.status || ''))) return false
      const due = new Date(project.deadline).getTime()
      if (Number.isNaN(due)) return false
      const diff = due - Date.now()
      return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000
    },
    getTodoProjectName(todo = {}) {
      if (todo.project && todo.project.name) return todo.project.name
      if (!todo.projectId) return '无所属项目'
      return this.getBatchProjectName(todo.projectId)
    },
    openTodo(todo = {}) {
      if (todo.task) {
        this.continueTask(todo.task)
        return
      }
      if (todo.patternTask) {
        this.currentModule = 'pattern-making'
        this.patternTaskDetailId = todo.patternTask.taskId
        this.patternDetailTab = 'review'
        this.updateRoute()
        return
      }
      if (todo.batch) {
        this.openBatchDetail(todo.batch)
        return
      }
      if (todo.project) {
        this.openWorkspaceProject(todo.project)
        return
      }
      if (todo.settingsTab) {
        this.currentModule = 'settings'
        this.settingsTab = todo.settingsTab
        this.updateRoute()
        return
      }
      if (todo.module) this.selectModule(todo.module)
    },
    getPatternScopeLabel(scope = '') {
      const map = { system: '系统版型', personal: '个人版型', enterprise: '企业版型' }
      return map[scope] || '企业版型'
    },
    getLibrarySourceLabel(source = '') {
      const map = { ai_pattern: 'AI 制版任务', copied: '复制', derived: '派生', manual: '手动创建' }
      return map[source] || 'AI 制版任务'
    },
    getLibraryReviewLabel(status = '') {
      const map = {
        draft: '草稿',
        not_submitted: '未提交',
        pending: '待审核',
        under_review: '审核中',
        changes_requested: '需修改',
        reviewed: '已复核',
        approved: '已批准',
        rejected: '已退回',
        archived: '已归档'
      }
      return map[status] || '草稿'
    },
    getLibraryVersionStatusLabel(status = '') {
      const map = {
        draft: '草稿',
        ai_generated: 'AI 生成',
        under_review: '审核中',
        changes_requested: '需修改',
        reviewed: '已复核',
        approved: '已批准',
        archived: '已归档'
      }
      return map[status] || '草稿'
    },
    handleModulePrimaryAction() {
      if (this.currentModule === 'team') {
        this.setTeamTab('members')
        return
      }
      if (this.currentModule === 'projects') {
        this.startProjectCreate()
        return
      }
      if (this.currentModule === 'batch') {
        this.startBatchCreate()
        return
      }
      if (this.currentModule === 'delivery') {
        this.selectModule('batch')
        return
      }
      if (this.currentModule === 'assets') {
        this.assetDetailId = ''
        this.assetViewMode = 'grid'
        this.updateRoute()
        return
      }
      if (this.currentModule === 'ai-training') {
        this.setTrainingTab('datasets')
        return
      }
      if (this.currentModule === 'model-operations') {
        this.setModelOpsTab('releases')
        return
      }
      if (this.currentModule === 'settings') {
        this.setSettingsTab('profile')
        return
      }
      if (this.currentModule === 'analytics') {
        this.loadAnalyticsCenter()
        return
      }
      if (this.currentModule === 'feedback') {
        this.feedbackForm.sourcePage = 'workspace'
        return
      }
      if (this.currentModule === 'support') {
        this.supportTicketId = ''
        this.loadSupportCenter()
        return
      }
      if (this.currentModule === 'experiments') {
        this.loadExperimentCenter()
        return
      }
      if (this.currentModule === 'help') {
        this.helpKeyword = ''
        this.helpCategory = 'quick-start'
        this.helpArticleId = ''
        return
      }
      if (this.currentModule === 'library') {
        this.createNewLibraryPattern()
        return
      }
      this.openQuickPanel()
    },
    handleKeydown(event) {
      if ((event.ctrlKey || event.metaKey) && String(event.key || '').toLowerCase() === 'k') {
        event.preventDefault()
        this.openSearchPanel()
      }
    },
    debouncedRunSearch() {
      if (this.searchDebounceTimer) clearTimeout(this.searchDebounceTimer)
      this.searchDebounceTimer = setTimeout(() => this.runSearch(), 180)
    },
    runSearch() {
      const keyword = String(this.searchKeyword || '').trim().toLowerCase()
      if (!keyword) {
        this.searchResults = []
        return
      }
      const smart = this.smartFeatureEntries
        .filter((item) => `${item.phrase}${item.label}${item.desc}`.toLowerCase().includes(keyword) || keyword.includes(item.label.toLowerCase()))
      const features = [...this.allAiOutputFeatures, ...this.patternActions, ...this.workspaceMenus]
        .filter((item) => `${item.label || ''}${item.title || ''}${item.desc || ''}`.toLowerCase().includes(keyword))
        .map((item, index) => this.createSearchItem('功能', item.label || item.title, `feature-${item.module}-${item.type || index}`, {
          module: item.module,
          featureType: item.type,
          status: item.planned ? '规划中' : '可进入',
          updatedAt: '',
          action: item.planned ? '查看' : '进入'
        }))
      const projects = this.workspaceProjects
        .filter((item) => `${item.name || ''}${item.customerName || ''}${item.status || ''}`.toLowerCase().includes(keyword))
        .map((item) => this.createSearchItem('项目', item.name || '未命名项目', `project-${item.projectId}`, {
          module: 'projects',
          project: item,
          status: this.getWorkspaceProjectStatusLabel(item.status),
          projectName: item.name,
          updatedAt: item.updatedAt || item.createdAt,
          action: '进入详情'
        }))
      const tasks = this.tasks
        .filter((item) => `${this.getTaskName(item)}${item.taskId || ''}${item.type || ''}${item.status || ''}`.toLowerCase().includes(keyword))
        .map((item) => this.createSearchItem('AI任务', this.getTaskName(item), `task-${item.taskId}`, {
          module: 'batch',
          task: item,
          status: this.getStatusLabel(item.status),
          projectName: this.getBatchProjectName(item.projectId),
          updatedAt: item.updatedAt || item.createdAt,
          action: '查看任务'
        }))
      const batches = this.workspaceBatches
        .filter((item) => `${item.title}${item.taskType}${item.status}`.toLowerCase().includes(keyword))
        .map((item) => this.createSearchItem('批次', item.title, `batch-${item.batchId}`, {
          module: 'batch',
          batch: item,
          status: this.getWorkspaceBatchStatusLabel(item.status),
          projectName: this.getBatchProjectName(item.projectId),
          updatedAt: item.updatedAt || item.createdAt,
          action: '进入批次'
        }))
      const deliveries = this.workspaceDeliveries
        .filter((item) => `${item.title}${item.usage}${item.status}`.toLowerCase().includes(keyword))
        .map((item) => this.createSearchItem('作品', item.title, `delivery-${item.deliveryId}`, {
          module: 'delivery',
          delivery: item,
          status: item.status,
          projectName: this.getBatchProjectName(item.projectId),
          updatedAt: item.deliveredAt || item.createdAt,
          action: '查看交付'
        }))
      const assets = this.workspaceAssets
        .filter((item) => `${item.name}${item.assetId}${item.type}${item.projectName}${item.taskId}${item.batchId}`.toLowerCase().includes(keyword))
        .map((item) => this.createSearchItem('数字资产', item.name, `asset-${item.assetId}`, {
          module: 'assets',
          asset: item,
          status: `${this.getAssetTypeLabel(item.type)} · ${this.getAssetReviewLabel(item.reviewStatus)}`,
          projectName: item.projectName,
          updatedAt: item.updatedAt || item.createdAt,
          action: '查看资产'
        }))
      const patterns = this.patternDashboard.masters
        .filter((item) => `${item.title}${item.category}${item.scope}${item.patternCode}`.toLowerCase().includes(keyword))
        .map((item) => this.createSearchItem('版型', item.title, `pattern-${item.patternMasterId}`, {
          module: 'library',
          pattern: item,
          status: this.getLibraryReviewLabel(item.reviewStatus),
          updatedAt: item.updatedAt || item.createdAt,
          action: '查看版型'
        }))
      const training = this.patternTrainingCenter.canAccess
        ? [
          ...this.patternTrainingCenter.samples
            .filter((item) => `${item.title}${item.category}${item.versionId}${item.tags.join(' ')}`.toLowerCase().includes(keyword))
            .map((item) => this.createSearchItem('训练样本', item.title, `training-sample-${item.sampleId}`, {
              module: 'ai-training',
              trainingTab: 'datasets',
              status: item.eligible ? '可入训练集' : '待处理',
              updatedAt: item.updatedAt,
              action: '查看样本'
            })),
          ...this.patternTrainingCenter.models
            .filter((item) => `${item.name}${item.version}${item.status}`.toLowerCase().includes(keyword))
            .map((item) => this.createSearchItem('模型版本', `${item.name} ${item.version}`, `training-model-${item.modelId}`, {
              module: 'ai-training',
              trainingTab: 'models',
              status: this.getModelStatusLabel(item.status),
              updatedAt: item.updatedAt,
              action: '查看模型'
            }))
        ]
        : []
      const modelOps = this.modelOperationsCenter.canAccess
        ? [
          ...this.modelOperationsCenter.releases
            .filter((item) => `${item.releaseId}${item.modelId}${item.modelVersion}${item.status}`.toLowerCase().includes(keyword))
            .map((item) => this.createSearchItem('模型发布', item.modelVersion || item.releaseId, `model-release-${item.releaseId}`, {
              module: 'model-operations',
              modelOpsTab: 'releases',
              status: this.getReleaseStatusLabel(item.status),
              updatedAt: item.updatedAt,
              action: '查看发布'
            })),
          ...this.modelOperationsCenter.incidents
            .filter((item) => `${item.title}${item.description}${item.type}${item.level}`.toLowerCase().includes(keyword))
            .map((item) => this.createSearchItem('模型异常', item.title, `model-incident-${item.incidentId}`, {
              module: 'model-operations',
              modelOpsTab: 'incidents',
              status: item.level,
              updatedAt: item.updatedAt || item.createdAt,
              action: '处理异常'
            })),
          ...this.modelOperationsCenter.taskTraces
            .filter((item) => `${item.taskId}${item.modelId}${item.modelVersion}${item.releaseId}${item.promptVersion}`.toLowerCase().includes(keyword))
            .slice(0, 8)
            .map((item) => this.createSearchItem('模型追踪任务', item.taskId, `model-trace-${item.taskId}`, {
              module: 'model-operations',
              modelOpsTab: 'monitoring',
              status: item.status,
              updatedAt: item.completedAt || item.createdAt,
              action: '查看追踪'
            }))
        ]
        : []
      const members = this.teamPermissions.canViewMembers
        ? this.teamCenter.members
          .filter((item) => `${item.name}${item.roleLabel}${item.status}`.toLowerCase().includes(keyword))
          .map((item) => this.createSearchItem('团队成员', item.name, `member-${item.memberId}`, {
            module: 'team',
            teamTab: 'members',
            member: item,
            status: this.getMemberStatusLabel(item.status),
            projectName: this.teamCenter.enterprise.enterpriseName || '',
            updatedAt: item.lastLoginAt || item.createdAt,
            action: '查看成员'
          }))
        : []
      const supportTickets = this.supportCenter.tickets
        .filter((item) => `${item.ticketId}${item.title}${item.typeLabel}${item.status}${item.priority}${item.taskId}${item.projectId}`.toLowerCase().includes(keyword))
        .map((item) => this.createSearchItem('客服工单', item.title, `support-${item.ticketId}`, {
          module: 'support',
          supportTicket: item,
          status: `${item.priority} · ${item.status}`,
          updatedAt: item.updatedAt || item.createdAt,
          action: '查看工单'
        }))
      const docs = searchHelpArticles(keyword, 'all')
        .map((article) => this.createSearchItem('帮助文档', article.title, `doc-${article.articleId}`, {
          module: 'help',
          helpArticleId: article.articleId,
          helpCategory: article.category,
          status: article.summary,
          action: '查看帮助'
        }))
      this.searchResults = [...smart, ...features, ...projects, ...tasks, ...batches, ...deliveries, ...assets, ...patterns, ...training, ...modelOps, ...members, ...supportTickets, ...docs].slice(0, 30)
      recordProductAnalyticsEvent({
        eventName: this.searchResults.length ? 'search' : 'search_empty',
        page: 'workspace',
        searchKeyword: keyword,
        noResult: !this.searchResults.length
      })
      this.searchSelectedIndex = 0
    },
    handleSearchResult(item = {}) {
      this.rememberSearch(this.searchKeyword || item.label)
      this.searchPanelOpen = false
      this.searchResults = []
      this.searchKeyword = ''
      this.openSearchTarget(item)
    },
    createSearchItem(type = '', label = '', key = '', extra = {}) {
      return {
        type,
        label,
        key,
        status: '',
        projectName: '',
        updatedAt: '',
        action: '进入',
        ...extra
      }
    },
    openSelectedSearchResult() {
      const item = this.flatSearchResults[this.searchSelectedIndex] || this.searchSuggestions[0]
      if (item) this.handleSearchResult(item)
    },
    moveSearchSelection(delta = 1) {
      const total = this.flatSearchResults.length
      if (!total) return
      this.searchSelectedIndex = (this.searchSelectedIndex + delta + total) % total
    },
    rememberSearch(keyword = '') {
      const value = String(keyword || '').trim()
      if (!value) return
      this.recentSearches = [value, ...this.recentSearches.filter((item) => item !== value)].slice(0, 8)
      try {
        uni.setStorageSync(SEARCH_RECENT_KEY, this.recentSearches)
      } catch (error) {}
    },
    useRecentSearch(keyword = '') {
      this.searchKeyword = keyword
      this.runSearch()
    },
    clearRecentSearches() {
      this.recentSearches = []
      try {
        uni.setStorageSync(SEARCH_RECENT_KEY, [])
      } catch (error) {}
    },
    openSearchTarget(item = {}) {
      if (item.helpArticleId) {
        this.currentModule = 'help'
        this.helpCategory = item.helpCategory || 'quick-start'
        this.helpArticleId = item.helpArticleId
        this.updateRoute()
        return
      }
      if (item.project) {
        this.openWorkspaceProject(item.project)
        return
      }
      if (item.batch) {
        this.openBatchDetail(item.batch)
        return
      }
      if (item.asset) {
        this.openWorkspaceAsset(item.asset)
        return
      }
      if (item.pattern) {
        this.openLibraryDetail(item.pattern)
        return
      }
      if (item.task) {
        this.continueTask(item.task)
        return
      }
      if (item.supportTicket) {
        this.currentModule = 'support'
        this.supportTicketId = item.supportTicket.ticketId
        this.loadSupportCenter()
        this.updateRoute()
        return
      }
      if (item.patternCreate) {
        this.startPatternCreate(item.featureType || item.type)
        return
      }
      if (item.featureType) item = { ...item, type: item.featureType }
      if (item.teamTab) this.teamTab = item.teamTab
      if (item.settingsTab) this.settingsTab = item.settingsTab
      if (item.trainingTab) this.trainingTab = item.trainingTab
      if (item.modelOpsTab) this.modelOpsTab = item.modelOpsTab
      if (item.module) this.openFeature(item)
    },
    handleRecentUsed(item = {}) {
      if (item.item) {
        this.openFeature(item.item)
        return
      }
      if (item.module) this.selectModule(item.module)
    },
    continueTask(item = {}) {
      if (item.taskId) {
        uni.navigateTo({ url: `/pages/result/result?taskId=${encodeURIComponent(item.taskId)}` })
        return
      }
      this.selectModule('batch')
    },
    openProject(item = {}) {
      if (item.projectId) {
        uni.navigateTo({ url: `/pages/enterprise-web/project-detail?projectId=${encodeURIComponent(item.projectId)}` })
        return
      }
      this.selectModule('projects')
    },
    goEnterpriseLogin() {
      uni.navigateTo({ url: '/pages/enterprise-web/login' })
    },
    getTaskName(item = {}) {
      return item.name || item.taskName || this.getTaskTypeLabel(item.type) || item.taskId || '未命名任务'
    },
    getTaskTypeLabel(type) {
      const feature = [...this.allAiOutputFeatures, ...this.patternActions].find((item) => item.type === type)
      return feature ? feature.label : (type || '通用任务')
    },
    getTaskProgress(item = {}) {
      if (item.progress || item.progress === 0) return Math.max(0, Math.min(100, Number(item.progress) || 0))
      return String(item.status || '').toLowerCase() === 'processing' ? 62 : 18
    },
    getStatusLabel(status) {
      const map = { pending: '待处理', processing: '生成中', success: '已完成', failed: '失败' }
      return map[String(status || '').toLowerCase()] || '进行中'
    },
    getPatternStatusLabel(status) {
      const map = { draft: '草稿', review: '审核中', approved: '已审核', completed: '已完成' }
      return map[String(status || '')] || '草稿'
    },
    getPatternReviewLabel(status) {
      const map = { not_submitted: '未提交', pending: '待审核', approved: '审核通过', rejected: '退回修改' }
      return map[String(status || '')] || '未提交'
    },
    getRecognizedParts(version = {}) {
      const parts = version.aiDraft && Array.isArray(version.aiDraft.recognizedParts) ? version.aiDraft.recognizedParts : []
      return parts.length ? parts : ['品类', '廓形', '领型', '袖型', '衣长', '门襟', '结构线']
    },
    getProjectInitial(item = {}) {
      const name = item.projectName || item.name || '项'
      return String(name).slice(0, 1)
    },
    getProjectTaskCount(item = {}) {
      if (Array.isArray(item.taskIds)) return item.taskIds.length
      if (Array.isArray(item.tasks)) return item.tasks.length
      return this.tasks.filter((task) => task.projectId && task.projectId === item.projectId).length
    },
    formatDate(value) {
      if (!value) return '未记录'
      const date = new Date(value)
      if (Number.isNaN(date.getTime())) return String(value).slice(0, 10)
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
  }
}
</script>

<style scoped>
.workspace-app { min-height: 100vh; background: var(--db-color-page); color: var(--db-color-text); }
.workspace-shell { display: grid; grid-template-columns: 248px minmax(0, 1fr); min-height: 100vh; }
.workspace-shell.collapsed { grid-template-columns: 82px minmax(0, 1fr); }
.workspace-sidebar { position: sticky; top: 0; height: 100vh; padding: 18px 14px; background: var(--db-color-sidebar); box-sizing: border-box; color: var(--db-color-border); }
.brand-row { display: flex; align-items: center; gap: 10px; min-height: 46px; }
.brand-mark { display: flex; align-items: center; justify-content: center; width: 42px; height: 42px; border-radius: var(--db-radius-md); background: var(--db-color-primary); color: #fff; font-weight: 950; }
.brand-title, .brand-sub, .mobile-title, .mobile-sub, .breadcrumb, .page-title, .section-kicker, .section-title, .section-desc, .hero-title, .hero-desc, .quick-title, .quick-desc, .panel-title, .panel-sub, .row-title, .row-meta, .feature-title, .feature-desc, .stat-value, .stat-label, .stat-desc { display: block; }
.brand-title { color: #fff; font-size: 18px; font-weight: 950; }
.brand-sub { margin-top: 2px; color: var(--db-color-text-faint); font-size: var(--db-font-size-xs); }
.collapse-btn { width: 100%; height: 32px; line-height: 32px; margin: 14px 0 10px; border-radius: var(--db-radius-pill); background: rgba(255,255,255,.08); color: var(--db-color-border-strong); font-size: var(--db-font-size-sm); }
.nav-list { display: grid; gap: 5px; }
.nav-group { border-radius: var(--db-radius-md); }
.nav-item { display: flex; align-items: center; gap: 10px; min-height: 42px; padding: 0 10px; border-radius: var(--db-radius-md); cursor: pointer; box-sizing: border-box; }
.nav-icon { display: flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 9px; background: rgba(255,255,255,.08); color: #c7d2fe; font-size: 12px; font-weight: 900; }
.nav-label { flex: 1; color: var(--db-color-border-strong); font-size: var(--db-font-size-md); font-weight: 850; }
.planned-badge { padding: 3px 7px; border-radius: var(--db-radius-pill); background: var(--db-color-warning-soft); color: #c2410c; font-size: 10px; font-weight: 900; }
.nav-group.active .nav-item { background: var(--db-color-primary-soft); }
.nav-group.active .nav-icon { background: var(--db-color-primary); color: #fff; }
.nav-group.active .nav-label { color: #3730a3; }
.sub-nav { display: grid; gap: 3px; padding: 4px 6px 9px 48px; }
.sub-nav text { padding: 7px 9px; border-radius: var(--db-radius-sm); color: var(--db-color-text-faint); font-size: var(--db-font-size-sm); cursor: pointer; }
.sub-nav text.current { background: rgba(99,102,241,.18); color: #c7d2fe; }
.workspace-main { min-width: 0; padding: 22px; box-sizing: border-box; }
.topbar { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; margin-bottom: 18px; }
.breadcrumb { color: var(--db-color-text-muted); font-size: var(--db-font-size-sm); }
.page-title { margin-top: 5px; color: var(--db-color-text); font-size: var(--db-font-size-title); line-height: 1.15; font-weight: 950; }
.topbar-tools { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 10px; }
.search-box { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 290px; min-height: var(--db-control-height); padding: 0 12px; border: 1px solid var(--db-color-border); border-radius: var(--db-radius-pill); background: var(--db-color-surface); color: var(--db-color-text-faint); font-size: var(--db-font-size-sm); box-sizing: border-box; cursor: pointer; }
.kbd { padding: 3px 7px; border-radius: 7px; background: #f1f5f9; color: var(--db-color-text-muted); font-size: var(--db-font-size-xs); }
.primary-pill, .ghost-pill, .notice-pill, .quota-pill, .user-menu, .icon-btn { min-height: var(--db-control-height); border-radius: var(--db-radius-pill); box-sizing: border-box; }
.primary-pill { margin: 0; padding: 0 16px; background: var(--db-color-primary); color: #fff; font-size: 13px; font-weight: 900; line-height: var(--db-control-height); }
.ghost-pill { margin: 0; padding: 0 14px; border: 1px solid #c7d2fe; background: var(--db-color-surface); color: var(--db-color-primary-strong); font-size: 13px; font-weight: 900; line-height: 36px; }
.notice-pill, .quota-pill, .user-menu { display: flex; align-items: center; gap: 7px; padding: 0 12px; border: 1px solid var(--db-color-border); background: var(--db-color-surface); color: #475569; font-size: var(--db-font-size-sm); }
.notice-pill strong, .quota-pill strong { color: var(--db-color-primary); }
.user-menu { flex-direction: column; align-items: flex-start; justify-content: center; min-width: 88px; border-radius: var(--db-radius-md); line-height: 1.15; cursor: pointer; }
.user-menu text:first-child { color: var(--db-color-text); font-weight: 900; }
.user-menu text:last-child { color: var(--db-color-text-muted); font-size: var(--db-font-size-xs); }
.identity-card, .home-hero, .module-intro, .panel, .quick-card, .feature-card, .pattern-card, .command-panel, .pattern-work-panel, .pattern-safety { border: 1px solid rgba(15,23,42,.08); border-radius: var(--db-radius-lg); background: var(--db-color-surface); box-shadow: var(--db-shadow-card); box-sizing: border-box; }
.identity-card { padding: 24px; }
.section-kicker { color: var(--db-color-primary); font-size: 13px; font-weight: 900; }
.section-title { margin-top: 6px; color: var(--db-color-text); font-size: 25px; font-weight: 950; line-height: var(--db-line-tight); }
.section-desc { margin-top: 8px; color: var(--db-color-text-muted); font-size: var(--db-font-size-md); line-height: var(--db-line-relaxed); }
.identity-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; margin-top: 18px; }
.identity-option { padding: 16px; border-radius: 15px; background: var(--db-color-surface-muted); cursor: pointer; }
.identity-option text:first-child { display: block; color: var(--db-color-text); font-weight: 920; }
.identity-option text:last-child { display: block; margin-top: 8px; color: var(--db-color-text-muted); font-size: var(--db-font-size-sm); line-height: 1.45; }
.module-section { display: grid; gap: 16px; }
.home-hero, .module-intro { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 22px; }
.home-hero { background: #111827; color: #fff; }
.home-hero .section-kicker { color: #c7d2fe; }
.hero-title { margin-top: 7px; color: #fff; font-size: 31px; line-height: 1.14; font-weight: 950; }
.hero-desc { max-width: 720px; margin-top: 9px; color: var(--db-color-border-strong); font-size: var(--db-font-size-md); line-height: var(--db-line-relaxed); }
.hero-actions { display: flex; flex-direction: column; gap: 10px; min-width: 170px; }
.solid-action, .outline-action { min-width: 152px; height: 42px; line-height: 42px; margin: 0; border-radius: var(--db-radius-pill); font-size: var(--db-font-size-md); font-weight: 920; }
.solid-action { background: var(--db-color-primary); color: #fff; }
.outline-action { border: 1px solid #c7d2fe; background: var(--db-color-surface); color: var(--db-color-primary-strong); }
.quick-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
.quick-card { padding: 17px; cursor: pointer; }
.quick-icon { display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 12px; background: var(--db-color-primary-soft); color: var(--db-color-primary); font-weight: 950; }
.quick-title { margin-top: 12px; color: var(--db-color-text); font-size: var(--db-font-size-lg); font-weight: 950; }
.quick-desc { min-height: 40px; margin-top: 7px; color: var(--db-color-text-muted); font-size: var(--db-font-size-sm); line-height: var(--db-line-normal); }
.onboarding-card { display: grid; gap: 12px; }
.onboarding-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.onboarding-row { display: grid; grid-template-columns: 28px minmax(0, 1fr) auto; align-items: center; gap: 10px; padding: 12px; border: 1px solid var(--db-color-border); border-radius: var(--db-radius-md); background: var(--db-color-surface-muted); }
.onboarding-row.done { background: var(--db-color-success-soft); border-color: #bbf7d0; }
.check-dot { display: flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: var(--db-radius-pill); background: #e0e7ff; color: var(--db-color-primary-strong); font-weight: 950; }
.onboarding-row.done .check-dot { background: var(--db-color-success); color: #fff; }
.solid-small, .outline-small, .disabled-small, .text-btn { min-height: 32px; line-height: 32px; margin: 0; padding: 0 12px; border-radius: var(--db-radius-pill); font-size: var(--db-font-size-sm); font-weight: 850; }
.solid-small { background: var(--db-color-primary); color: #fff; }
.outline-small { border: 1px solid var(--db-color-border-strong); background: var(--db-color-surface); color: var(--db-color-text-secondary); }
.disabled-small { background: var(--db-color-border); color: var(--db-color-text-faint); }
.text-btn { background: transparent; color: var(--db-color-primary); }
.primary-pill[disabled], .ghost-pill[disabled], .solid-action[disabled], .outline-action[disabled], .solid-small[disabled], .outline-small[disabled], .text-btn[disabled] { opacity: .56; cursor: not-allowed; }
.primary-pill:focus, .ghost-pill:focus, .solid-action:focus, .outline-action:focus, .solid-small:focus, .outline-small:focus, .text-btn:focus, .search-box:focus { outline: none; box-shadow: var(--db-focus-ring); }
.primary-pill:active, .ghost-pill:active, .solid-action:active, .outline-action:active, .solid-small:active, .outline-small:active { transform: translateY(1px); }
@media (hover: hover) {
  .quick-card:hover, .feature-card:hover, .pattern-card:hover, .help-article-card:hover, .project-card:hover, .asset-card:hover { border-color: #c7d2fe; box-shadow: var(--db-shadow-float); transform: translateY(-1px); }
  .primary-pill:hover, .ghost-pill:hover, .solid-action:hover, .outline-action:hover, .solid-small:hover, .outline-small:hover { box-shadow: var(--db-focus-ring); }
}
.danger { border-color: #fecaca; color: #b91c1c; }
.dashboard-grid { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(280px, .75fr); gap: 14px; }
.wide { grid-row: span 2; }
.panel { padding: 17px; }
.panel-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 12px; }
.panel-title { color: #0f172a; font-size: 16px; font-weight: 950; }
.panel-sub { margin-top: 4px; color: #64748b; font-size: 12px; }
.task-list, .project-list, .todo-list, .version-list { display: grid; gap: 10px; }
.task-row, .project-row, .todo-row, .result-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px; border-radius: 14px; background: #f8fafc; cursor: pointer; }
.row-title { color: #0f172a; font-size: 14px; font-weight: 900; }
.row-meta, .row-date { margin-top: 4px; color: #64748b; font-size: 12px; }
.progress-wrap { display: flex; align-items: center; gap: 8px; min-width: 130px; color: #64748b; font-size: 12px; }
.progress-track { width: 92px; height: 7px; border-radius: 999px; overflow: hidden; background: #e2e8f0; }
.progress-fill { height: 100%; border-radius: inherit; background: #4f46e5; }
.status-tag { padding: 4px 9px; border-radius: var(--db-radius-pill); background: var(--db-color-primary-soft); color: var(--db-color-primary-strong); font-size: var(--db-font-size-sm); font-weight: 900; }
.danger-tag { background: var(--db-color-danger-soft); color: #b91c1c; }
.empty-state { display: grid; justify-items: start; gap: 10px; padding: 18px; border: 1px dashed var(--db-color-border-strong); border-radius: var(--db-radius-md); background: var(--db-color-surface-muted); color: var(--db-color-text-muted); font-size: 13px; box-sizing: border-box; }
.empty-state.compact { padding: 14px; }
.project-cover { display: flex; align-items: center; justify-content: center; width: 42px; height: 42px; border-radius: 13px; background: #e0e7ff; color: #4338ca; font-weight: 950; }
.recent-grid, .saved-list { display: flex; flex-wrap: wrap; gap: 8px; }
.recent-grid view, .saved-list text { padding: 9px 10px; border-radius: 12px; background: #f1f5f9; color: #334155; font-size: 12px; cursor: pointer; }
.recent-grid text { display: block; }
.recent-grid text:first-child { font-weight: 900; color: #0f172a; }
.recent-grid text:last-child { margin-top: 3px; color: #64748b; }
.ai-output-toolbar, .pattern-toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 14px; border-radius: 16px; background: #fff; border: 1px solid #e2e8f0; }
.inline-search { flex: 1; min-width: 240px; }
.inline-search input, .search-input-row input, .size-grid input { width: 100%; height: 38px; padding: 0 12px; border: 1px solid #e2e8f0; border-radius: 12px; box-sizing: border-box; background: #fff; font-size: 13px; }
.filter-pill { height: 38px; line-height: 38px; padding: 0 12px; border: 1px solid #e2e8f0; border-radius: 999px; background: #fff; color: #334155; font-size: 12px; }
.saved-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.saved-row > view { padding: 15px; border-radius: 16px; background: #fff; border: 1px solid #e2e8f0; }
.saved-empty { display: block; margin-top: 10px; color: #94a3b8; font-size: 12px; }
.feature-group { display: grid; gap: 12px; }
.group-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; }
.group-head text:last-child, .group-count { color: #64748b; font-size: 12px; }
.feature-grid, .pattern-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
.feature-card, .pattern-card { padding: 16px; cursor: pointer; }
.feature-card.active, .pattern-card.active { border-color: #818cf8; box-shadow: 0 14px 36px rgba(79,70,229,.12); }
.feature-card.disabled { opacity: .72; cursor: default; }
.feature-top, .feature-name { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.feature-name { justify-content: flex-start; }
.feature-icon { display: flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: 10px; background: #eef2ff; color: #4f46e5; font-weight: 950; }
.feature-title { color: #0f172a; font-size: 16px; font-weight: 950; }
.feature-desc { min-height: 44px; margin-top: 10px; color: #64748b; font-size: 13px; line-height: 1.55; }
.feature-detail { display: grid; gap: 5px; margin-top: 10px; color: #475569; font-size: 12px; line-height: 1.4; }
.feature-actions { display: flex; justify-content: space-between; gap: 8px; margin-top: 14px; }
.create-flow, .pattern-create, .pattern-detail, .pattern-overview { display: grid; gap: 14px; }
.create-steps, .pattern-stepper, .detail-tabs { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 2px; }
.create-steps view, .pattern-stepper view, .detail-tabs text { display: flex; align-items: center; gap: 7px; padding: 10px 12px; border-radius: 999px; background: #fff; border: 1px solid #e2e8f0; color: #64748b; font-size: 12px; white-space: nowrap; cursor: pointer; }
.create-steps view.active, .pattern-stepper view.active, .detail-tabs text.active { border-color: #818cf8; background: #eef2ff; color: #3730a3; font-weight: 900; }
.pattern-stepper view.done { background: #ecfdf5; color: #047857; border-color: #bbf7d0; }
.create-panel, .pattern-work-panel { padding: 18px; }
.summary-grid, .param-grid, .size-grid, .detail-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 14px; }
.summary-grid.single { grid-template-columns: 1fr; }
.summary-grid view, .param-grid view, .size-grid view { display: grid; gap: 6px; padding: 13px; border-radius: 14px; background: #f8fafc; color: #64748b; font-size: 12px; }
.summary-grid strong, .param-grid text:last-child { color: #0f172a; font-size: 14px; font-weight: 900; }
.upload-placeholder, .technical-preview { margin-top: 14px; min-height: 150px; border: 1px dashed #cbd5e1; border-radius: 16px; background: linear-gradient(135deg, #f8fafc, #eef2ff); display: flex; align-items: center; justify-content: center; color: #64748b; font-size: 13px; text-align: center; }
.technical-preview.revised { background: linear-gradient(135deg, #fff7ed, #f8fafc); }
.task-summary { display: grid; gap: 8px; margin-top: 12px; padding: 14px; border-radius: 14px; background: #f8fafc; color: #334155; font-size: 13px; }
.create-nav, .detail-footer-actions, .review-actions, .detail-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 16px; }
.pattern-safety { display: flex; align-items: flex-start; gap: 12px; padding: 14px 16px; border-color: #fed7aa; background: #fff7ed; color: #9a3412; box-shadow: none; }
.pattern-safety strong { min-width: 88px; font-size: 13px; }
.pattern-safety text { font-size: 13px; line-height: 1.55; }
.choice-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-top: 14px; }
.choice-grid.compact { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.choice-grid view, .pattern-reference-list view { padding: 12px; border-radius: 14px; background: #f8fafc; border: 1px solid #e2e8f0; color: #334155; font-size: 13px; cursor: pointer; }
.choice-grid view.active, .pattern-reference-list view.active { border-color: #818cf8; background: #eef2ff; color: #3730a3; font-weight: 900; }
.upload-check-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-top: 14px; }
.upload-check-grid label { display: flex; gap: 9px; align-items: center; padding: 13px; border-radius: 14px; background: #f8fafc; }
.upload-check-grid text { display: block; }
.upload-check-grid text:last-child { margin-top: 3px; color: #64748b; font-size: 12px; }
.direction-grid, .compare-panel { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.pattern-reference-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 14px; }
.pattern-reference-list text { display: block; }
.pattern-reference-list text:last-child { margin-top: 5px; color: #64748b; font-size: 12px; }
.stat-panel .small { font-size: 22px; }
.library-toolbar { display: grid; grid-template-columns: minmax(260px, 1fr) auto minmax(160px, 220px) auto; gap: 10px; padding: 14px; border-radius: 16px; background: #fff; border: 1px solid #e2e8f0; align-items: center; }
.code-search { min-width: 160px; }
.advanced-filter-panel { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; padding: 15px; border-radius: 16px; background: #fff; border: 1px solid #e2e8f0; }
.advanced-filter-panel > view { display: grid; gap: 7px; }
.advanced-filter-panel text { color: #475569; font-size: 12px; font-weight: 850; }
.library-tabs { display: flex; gap: 8px; overflow-x: auto; }
.library-tabs text { padding: 10px 13px; border: 1px solid #e2e8f0; border-radius: 999px; background: #fff; color: #64748b; font-size: 12px; font-weight: 850; white-space: nowrap; cursor: pointer; }
.library-tabs text.active { border-color: #818cf8; background: #eef2ff; color: #3730a3; }
.library-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.library-card { display: grid; grid-template-columns: 118px minmax(0, 1fr); gap: 14px; padding: 14px; border: 1px solid rgba(15,23,42,.08); border-radius: 18px; background: #fff; box-shadow: 0 12px 34px rgba(15,23,42,.05); }
.pattern-thumb { display: flex; align-items: center; justify-content: center; min-height: 142px; border-radius: 16px; background: linear-gradient(135deg, #eef2ff, #f8fafc); border: 1px dashed #c7d2fe; color: #4f46e5; font-size: 28px; font-weight: 950; }
.library-card-body { min-width: 0; }
.tag-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.tag-row text { padding: 4px 8px; border-radius: 999px; background: #f1f5f9; color: #475569; font-size: 11px; font-weight: 850; }
.feature-actions.wrap { justify-content: flex-start; flex-wrap: wrap; }
.library-detail { display: grid; gap: 14px; }
.compact-intro { padding: 18px; }
.project-card-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
.project-card { display: grid; gap: 13px; padding: 16px; border: 1px solid rgba(15,23,42,.08); border-radius: 18px; background: #fff; box-shadow: 0 12px 34px rgba(15,23,42,.05); cursor: pointer; }
.project-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
.project-progress { display: flex; align-items: center; gap: 10px; color: #64748b; font-size: 12px; }
.project-progress .progress-track { flex: 1; width: auto; }
.project-overview-strip { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; }
.project-overview-strip view { padding: 14px; border: 1px solid rgba(15,23,42,.08); border-radius: 16px; background: #fff; box-shadow: 0 10px 28px rgba(15,23,42,.04); }
.project-overview-strip text { display: block; color: #64748b; font-size: 12px; }
.project-overview-strip strong { display: block; margin-top: 6px; color: #0f172a; font-size: 24px; font-weight: 950; }
.project-actions-row { display: flex; flex-wrap: wrap; gap: 9px; margin-bottom: 14px; }
.project-tab-panel { display: grid; gap: 14px; }
.table-scroll { overflow-x: auto; }
.batch-table { min-width: 760px; display: grid; gap: 8px; }
.table-head, .table-row { display: grid; grid-template-columns: 1.4fr .7fr .8fr 1.4fr; gap: 10px; align-items: center; padding: 11px 12px; border-radius: 12px; }
.table-head { background: #eef2ff; color: #3730a3; font-size: 12px; font-weight: 950; }
.table-row { background: var(--db-color-surface-muted); color: var(--db-color-text-secondary); font-size: var(--db-font-size-sm); }
.table-row view { display: flex; flex-wrap: wrap; gap: 7px; }
.delivery-config { display: flex; flex-direction: column; gap: 14px; padding: 14px; border: 1px solid rgba(105,81,255,.12); border-radius: 16px; background: #f8f7ff; }
.team-layout { display: grid; gap: 16px; }
.team-table, .audit-table { min-width: 980px; display: grid; gap: 8px; }
.team-table-head, .team-table-row { display: grid; grid-template-columns: 1.2fr 1fr 1fr .9fr .5fr .65fr .8fr 1.5fr; gap: 10px; align-items: center; padding: 11px 12px; border-radius: 12px; }
.audit-table-head, .audit-table-row { display: grid; grid-template-columns: .9fr .8fr 1fr 1.2fr 1.5fr 1fr; gap: 10px; align-items: center; padding: 11px 12px; border-radius: 12px; }
.team-table-head, .audit-table-head { background: #eef2ff; color: #3730a3; font-size: 12px; font-weight: 950; }
.team-table-row, .audit-table-row { background: #f8fafc; color: #334155; font-size: 12px; }
.team-table-row > view:last-child { display: flex; flex-wrap: wrap; gap: 7px; }
.member-cell { display: flex; align-items: center; gap: 8px; min-width: 0; }
.avatar-dot { display: flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: 999px; background: #e0e7ff; color: #3730a3; font-weight: 950; }
.roles-workspace { display: grid; gap: 16px; }
.project-card.active { border-color: #818cf8; background: #f8f7ff; }
.permission-groups { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
.permission-group { display: grid; gap: 9px; padding: 14px; border-radius: 16px; background: #f8fafc; border: 1px solid #e2e8f0; }
.permission-check { display: flex; align-items: center; gap: 8px; color: #334155; font-size: 12px; }
.compact-list { gap: 8px; }
.audit-toolbar { grid-template-columns: minmax(260px, 1fr) minmax(160px, 220px); }
.settings-layout { display: grid; grid-template-columns: 210px minmax(0, 1fr); gap: 16px; align-items: start; }
.settings-side { position: sticky; top: 82px; display: grid; gap: 8px; padding: 12px; border: 1px solid #e2e8f0; border-radius: 18px; background: #fff; }
.settings-side text { padding: 10px 12px; border-radius: 12px; color: #64748b; font-size: 13px; font-weight: 850; cursor: pointer; }
.settings-side text.active { background: #eef2ff; color: #3730a3; }
.settings-main { min-width: 0; }
.settings-panel { display: grid; gap: 16px; }
.switch-line { display: flex; align-items: center; gap: 9px; padding: 12px; border-radius: 14px; background: #f8fafc; color: #334155; }
.notification-table { display: grid; gap: 8px; overflow-x: auto; }
.notification-row { min-width: 720px; display: grid; grid-template-columns: 1.2fr repeat(3, 1fr); gap: 10px; align-items: center; padding: 11px 12px; border-radius: 12px; background: #f8fafc; color: #334155; font-size: 12px; }
.notification-row.head { background: #eef2ff; color: #3730a3; font-weight: 950; }
.overlay { position: fixed; inset: 0; z-index: 20; display: flex; align-items: flex-start; justify-content: center; padding: 90px 18px 18px; background: rgba(15,23,42,.34); box-sizing: border-box; }
.command-panel { width: min(760px, 100%); padding: 18px; }
.command-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.command-grid view { padding: 14px; border-radius: 14px; background: #f8fafc; cursor: pointer; }
.command-grid text { display: block; }
.command-grid text:first-child { color: #0f172a; font-weight: 900; }
.command-grid text:last-child { margin-top: 6px; color: #64748b; font-size: 12px; }
.search-input-row { display: flex; gap: 10px; margin-bottom: 12px; }
.result-list { display: grid; gap: 9px; }
.result-list.grouped { gap: 14px; }
.search-group { display: grid; gap: 8px; }
.search-group-title { color: #475569; font-size: 12px; font-weight: 950; }
.result-row.active { outline: 2px solid #818cf8; background: var(--db-color-primary-soft); }
.recent-searches { display: grid; gap: 8px; margin-bottom: 12px; }
.panel-head.tight { margin-bottom: 0; }
.go-mark { color: #4f46e5; font-size: 12px; font-weight: 900; }
.notification-panel { max-height: 82vh; overflow: auto; }
.notification-list, .todo-list { display: grid; gap: 10px; }
.notification-item, .todo-card { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 14px; border: 1px solid #e2e8f0; border-radius: 16px; background: #fff; }
.notification-item.unread { border-color: #818cf8; background: #f8f7ff; }
.notification-item > view, .todo-card > view { min-width: 0; display: grid; gap: 5px; }
.help-center { min-width: 0; }
.help-search-row input { width: 100%; height: 42px; padding: 0 14px; border: 1px solid var(--db-color-border); border-radius: var(--db-radius-md); background: var(--db-color-surface); box-sizing: border-box; }
.help-layout { display: grid; grid-template-columns: 190px 280px minmax(0, 1fr); gap: 14px; align-items: start; }
.help-category-list, .help-article-list { display: grid; gap: 8px; }
.help-category-list text { padding: 11px 12px; border-radius: 12px; background: #fff; color: #475569; font-size: 13px; font-weight: 850; cursor: pointer; }
.help-category-list text.active { background: #eef2ff; color: #4338ca; }
.help-article-card { display: grid; gap: 6px; padding: 13px; border: 1px solid #e2e8f0; border-radius: 14px; background: #fff; cursor: pointer; }
.help-article-card.active { border-color: #818cf8; background: #f8f7ff; }
.help-detail, .help-drawer-body { display: grid; gap: 14px; }
.help-section-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.help-section-grid view, .empty-guidance { display: grid; gap: 6px; padding: 12px; border-radius: 14px; background: #f8fafc; }
.help-section-grid text, .empty-guidance text { color: #64748b; font-size: 12px; font-weight: 850; }
.help-section-grid strong, .empty-guidance strong { color: #0f172a; font-size: 13px; line-height: 1.55; }
.help-steps { display: grid; gap: 8px; padding: 13px; border-radius: 14px; background: #f8fafc; }
.help-steps text:not(.panel-title) { color: #475569; font-size: 13px; line-height: 1.55; }
.help-steps.warning { background: #fff7ed; }
.help-overlay { justify-content: flex-end; padding: 0; }
.help-drawer { width: min(520px, 100%); min-height: 100vh; max-height: 100vh; overflow: auto; padding: 20px; border-radius: 18px 0 0 18px; background: #fff; box-shadow: -18px 0 40px rgba(15,23,42,.14); box-sizing: border-box; }
.help-section-grid.compact { grid-template-columns: 1fr; }
.intro-actions { display: flex; gap: 10px; flex-wrap: wrap; justify-content: flex-end; }
.asset-list-panel, .asset-detail { display: grid; gap: 14px; }
.asset-toolbar { display: grid; grid-template-columns: minmax(260px, 1fr) auto auto auto auto auto; gap: 10px; align-items: center; }
.picker-pill { display: inline-flex; align-items: center; min-height: 32px; padding: 0 12px; border: 1px solid #cbd5e1; border-radius: 999px; color: #334155; font-size: 12px; font-weight: 850; background: #fff; }
.asset-filter-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 10px; }
.asset-filter-grid input, .asset-filter-grid picker { min-height: 36px; padding: 0 11px; border: 1px solid #e2e8f0; border-radius: 12px; background: #f8fafc; color: #475569; font-size: 12px; box-sizing: border-box; }
.compact-tabs { flex-wrap: nowrap; }
.asset-batch-bar { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; padding: 10px 12px; border-radius: 14px; background: #eef2ff; color: #3730a3; font-size: 12px; font-weight: 900; }
.asset-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
.asset-table { display: grid; gap: 10px; overflow-x: auto; }
.asset-group { display: contents; }
.asset-group-title { grid-column: 1 / -1; color: #475569; font-size: 13px; font-weight: 950; }
.asset-card, .asset-row { position: relative; display: grid; gap: 12px; padding: 13px; border: 1px solid rgba(15,23,42,.08); border-radius: 18px; background: #fff; box-shadow: 0 10px 28px rgba(15,23,42,.045); box-sizing: border-box; }
.asset-row { min-width: 880px; grid-template-columns: 104px minmax(0, 1fr) auto; align-items: center; }
.asset-select { position: absolute; top: 10px; right: 10px; z-index: 2; padding: 4px 8px; border-radius: 999px; background: rgba(255,255,255,.92); border: 1px solid #e2e8f0; color: #64748b; font-size: 11px; font-weight: 900; cursor: pointer; }
.asset-select.active { background: #4f46e5; border-color: #4f46e5; color: #fff; }
.asset-thumb { min-height: 150px; border-radius: 15px; overflow: hidden; background: #f1f5f9; cursor: pointer; }
.asset-row .asset-thumb { min-height: 88px; }
.asset-thumb image, .asset-preview-large image { width: 100%; height: 100%; display: block; }
.file-placeholder { display: flex; align-items: center; justify-content: center; width: 100%; min-height: inherit; padding: 16px; border: 1px dashed #c7d2fe; border-radius: inherit; background: linear-gradient(135deg, #f8fafc, #eef2ff); color: #4f46e5; font-size: 14px; font-weight: 950; text-align: center; box-sizing: border-box; }
.asset-main { min-width: 0; display: grid; gap: 5px; cursor: pointer; }
.asset-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.asset-tags text { padding: 4px 8px; border-radius: 999px; background: #f1f5f9; color: #475569; font-size: 11px; font-weight: 850; }
.asset-actions { display: flex; gap: 7px; flex-wrap: wrap; align-items: center; }
.asset-row .asset-actions { justify-content: flex-end; max-width: 300px; }
.asset-detail-grid { display: grid; grid-template-columns: minmax(280px, .95fr) minmax(280px, 1.05fr); gap: 16px; align-items: stretch; }
.asset-preview-large { min-height: 360px; overflow: hidden; border-radius: 18px; background: #f1f5f9; }
.source-chain, .timeline-list { display: grid; gap: 10px; }
.chain-step, .timeline-item { display: flex; gap: 10px; padding: 12px; border-radius: 14px; background: #f8fafc; }
.chain-index, .timeline-dot { flex: 0 0 auto; display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 999px; background: #eef2ff; color: #4338ca; font-size: 12px; font-weight: 950; }
.chain-step strong, .chain-step text { display: block; }
.chain-step strong { color: #0f172a; font-size: 13px; }
.chain-step text { margin-top: 4px; color: #64748b; font-size: 12px; }
.asset-action-row { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 14px; border-radius: 16px; background: #f8fafc; }
.training-layout, .training-overview, .training-datasets, .training-evaluations, .training-models { display: grid; gap: 16px; }
.training-sample-list { display: grid; gap: 10px; }
.training-sample-card { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 13px; border-radius: 15px; background: #f8fafc; }
.training-sample-card > view { min-width: 0; display: grid; gap: 4px; }
.release-gates { display: flex; flex-wrap: wrap; gap: 7px; }
.release-gates text { padding: 5px 8px; border-radius: 999px; background: #f1f5f9; color: #64748b; font-size: 11px; font-weight: 850; }
.release-gates text.done { background: #ecfdf5; color: #047857; }
.model-trace-table { min-width: 980px; display: grid; gap: 8px; margin-top: 12px; }
.model-trace-head, .model-trace-row { display: grid; grid-template-columns: 1fr 1.2fr 1.1fr .8fr 1fr .7fr; gap: 10px; align-items: center; padding: 11px 12px; border-radius: 12px; }
.model-trace-head { background: #eef2ff; color: #3730a3; font-size: 12px; font-weight: 950; }
.model-trace-row { background: #f8fafc; color: #334155; font-size: 12px; }
.module-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
.stat-value { color: #0f172a; font-size: 32px; font-weight: 950; }
.stat-label { margin-top: 4px; color: #334155; font-weight: 900; }
.stat-desc { margin-top: 6px; color: #64748b; font-size: 12px; line-height: 1.45; }
.mobile-head { display: none; }

@media (max-width: 1100px) {
  .workspace-shell { grid-template-columns: 220px minmax(0, 1fr); }
  .feature-grid, .pattern-grid, .quick-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .onboarding-list { grid-template-columns: 1fr; }
  .help-layout { grid-template-columns: 160px minmax(220px, .8fr) minmax(0, 1fr); }
  .project-card-grid, .project-overview-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .identity-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .dashboard-grid { grid-template-columns: 1fr; }
  .wide { grid-row: auto; }
}

@media (max-width: 900px) {
  .mobile-head { position: sticky; top: 0; z-index: 12; display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 12px; background: #fff; border-bottom: 1px solid #e2e8f0; }
  .workspace-shell, .workspace-shell.collapsed { display: block; min-height: auto; }
  .workspace-sidebar { position: fixed; z-index: 21; left: -280px; width: 260px; transition: left .2s ease; }
  .workspace-sidebar.open { left: 0; }
  .mobile-mask { position: fixed; inset: 0; z-index: 20; background: rgba(15,23,42,.35); }
  .workspace-main { padding: 14px; }
  .topbar { display: block; }
  .topbar-tools { justify-content: flex-start; margin-top: 12px; }
  .search-box { width: 100%; }
  .home-hero, .module-intro { display: grid; }
  .hero-actions { min-width: 0; }
  .quick-grid, .feature-grid, .pattern-grid, .saved-row, .summary-grid, .param-grid, .size-grid, .detail-grid, .direction-grid, .compare-panel, .pattern-reference-list, .upload-check-grid, .module-grid, .permission-groups, .settings-layout, .help-layout, .help-section-grid { grid-template-columns: 1fr; }
  .help-category-list { display: flex; overflow-x: auto; }
  .help-category-list text { white-space: nowrap; }
  .help-drawer { width: 100%; border-radius: 18px 18px 0 0; }
  .settings-side { position: static; display: flex; overflow-x: auto; }
  .settings-side text { white-space: nowrap; }
  .library-toolbar, .advanced-filter-panel, .library-grid, .library-card, .asset-toolbar, .asset-filter-grid, .asset-grid, .asset-detail-grid { grid-template-columns: 1fr; }
  .asset-row { min-width: 0; grid-template-columns: 1fr; }
  .asset-row .asset-actions { justify-content: flex-start; max-width: none; }
  .asset-action-row { align-items: flex-start; flex-direction: column; }
  .project-card-grid, .project-overview-strip { grid-template-columns: 1fr; }
  .choice-grid, .choice-grid.compact { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .task-row, .project-row { align-items: flex-start; flex-direction: column; }
  .progress-wrap { width: 100%; }
}
</style>
