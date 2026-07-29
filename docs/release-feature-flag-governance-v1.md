# 版本发布、功能开关与灰度管理中心 V1

## 目标

本阶段建立统一的发布与功能开关治理层，用于控制官网、小程序、后台和 AI 能力的上线范围。

管理入口：

- `/#/admin/releases`
- `/#/admin/feature-flags`
- `/#/admin/environments`

实际 uni 页面：

- `/pages/admin-release-control/admin-release-control`

## 权限边界

仅平台管理员和授权发布人员可访问。页面与工具层复用现有 `requirePlatformAdmin()`。

本阶段未修改：

- 小程序主链路
- `taskLayer`
- `generate_wanx`
- `createTaskAndRun`
- quota
- AI provider
- 支付
- 云函数业务逻辑

## 版本记录

发布记录字段包括：

- `releaseId`
- `version`
- `gitCommit`
- `environment`
- `modules`
- `summary`
- `migrationVersion`
- `configVersion`
- `publisher`
- `publishedAt`
- `acceptanceReport`
- `rollbackVersion`
- `rollbackResult`
- `status`
- `grayScope`
- `safetyConfig`

状态：

- `draft`
- `testing`
- `staging_verified`
- `approved`
- `gray_running`
- `released`
- `rolled_back`

## 功能开关

首批受控功能：

- AI 出图功能
- AI 制版功能
- 版型库功能
- 批量任务
- 企业协作
- API 开放平台
- 训练与模型评估
- 新版页面与组件

开关状态：

- `enabled`
- `disabled`
- `gray`

关闭后页面应显示明确不可用提示，后续业务调用侧应统一读取 `evaluateFeatureFlag()` 的结果，不应继续保留隐藏可调用入口。

## 灰度范围

灰度维度：

- 环境
- 指定用户
- 指定企业
- 用户角色
- 会员套餐
- 功能类型
- 流量比例
- 开始与结束时间

默认保持最小范围，不会自动扩大灰度。

## 配置优先级

统一优先级：

1. 紧急全局关闭
2. 环境配置
3. 企业配置
4. 用户灰度
5. 默认配置

后台会展示最终生效结果和命中原因。

## 禁止组合

以下组合会阻止保存或发布：

- 真实扣费 + mock 生成
- 正式交付 + fallback 结果
- 未审核版型 + 生产可用
- 训练数据启用 + 未授权数据
- provider 真实调用 + 缺少额度幂等
- 管理后台开放 + 权限校验关闭

## 发布流程

统一流程：

1. 创建发布草稿
2. 关联代码和配置
3. 执行自动测试
4. 执行数据迁移预检
5. 预发布验证
6. 人工批准
7. 小范围灰度
8. 指标观察
9. 正式发布或回滚

## 紧急回滚

支持：

- 关闭单一功能
- 回滚页面版本
- 回滚 API 版本
- 回滚模型路由
- 暂停新任务

回滚不会删除已创建任务、额度记录或用户资产。

## 审计

所有开关修改和发布操作记录：

- 操作人
- 修改前后值
- 生效范围
- 修改原因
- 审批人
- 发布时间
- 回滚结果

## 自动验证

执行：

```powershell
npm run smoke:release-control
node --check utils/admin/releaseControlCenter.js
node --check scripts/release-control-smoke.js
git diff --check
```

## 人工验收

1. 打开 `/#/admin/releases`，确认可查看版本发布记录。
2. 打开 `/#/admin/feature-flags`，确认可查看和更新功能开关。
3. 打开 `/#/admin/environments`，确认可查看环境配置和最终生效结果。
4. 创建发布草稿，确认审计记录出现。
5. 构造高风险组合，确认被拒绝发布。
6. 紧急关闭单个功能，确认最终生效结果为不可用。
7. 确认普通用户无法访问发布管控中心。
