# 蝶变 AI 企业 Demo 验收清单（第一阶段）

本文档用于执行一套完整、可追踪的企业客户演示验收。验收从本地 Demo 数据初始化开始，覆盖客户、项目、AI 生产、资产、交付和经营后台闭环。

本清单仅使用现有 Demo / mock 能力。不得开启真实 provider、真实额度扣减或真实支付。

## 0. 验收信息

| 项目 | 记录值 |
| --- | --- |
| 验收环境 |  |
| 验收人 |  |
| 验收时间 |  |
| Demo ID |  |
| 总体结果 | 通过 / 不通过 |

## 1. Demo 数据初始化

初始化方式：使用现有 `createDemoEnterprise()`。

### 操作清单

- [ ] 调用 `createDemoEnterprise()`，并保留返回对象。
- [ ] 确认返回对象包含 `demoId`。
- [ ] 确认默认持久化数据写入本地 Demo 存储。
- [ ] 确认初始化过程未调用真实 provider。
- [ ] 确认初始化过程未执行真实额度扣减或真实支付。

### 初始化数据核对

| 业务对象 | 返回路径 | 实际值 | 通过 |
| --- | --- | --- | --- |
| 企业线索 | `demo.lead.leadId` |  | [ ] |
| 销售跟进 | `demo.sales.follow.followId` |  | [ ] |
| 销售漏斗 | `demo.sales.pipeline.pipelineId` |  | [ ] |
| 销售预测 | `demo.sales.forecast.forecastId` |  | [ ] |
| 企业项目 | `demo.project.projectId` |  | [ ] |
| 品牌空间 | `demo.brand.brandId` |  | [ ] |
| 工作台上下文 | `demo.workspaceContext.workspaceContextId` |  | [ ] |
| Demo 生产任务 | `demo.production.taskId` |  | [ ] |
| Demo 生成资产 | `demo.assets[].assetId` |  | [ ] |
| 交付记录 | `demo.delivery.deliveryId` |  | [ ] |
| 经营数据 | `demo.businessStats` |  | [ ] |

> `createDemoEnterprise()` 不预造 `planId`、`versionId`、`projectAssetId` 或 `assetVersionId`。这些 ID 必须在后续实际工作台和资产流程中产生并记录，不得手工虚构。

## 2. 企业客户流程

### 2.1 线索

- [ ] 后台能够找到 `leadId` 对应的演示客户。
- [ ] 客户名称、公司名称、联系方式和需求类型完整。
- [ ] 线索来源为企业 Demo，需求快照可读。

### 2.2 销售跟进

- [ ] `followId` 存在。
- [ ] 跟进记录关联正确的 `leadId` 和 `projectId`。
- [ ] 跟进动作、内容、操作人和下次跟进时间可查看。

### 2.3 销售漏斗

- [ ] `pipeline` 存在并关联正确的 `leadId`。
- [ ] 当前阶段、成交概率和预计金额可查看。
- [ ] Demo 默认阶段与概率匹配，不出现孤立漏斗记录。

### 2.4 销售预测

- [ ] `forecast` 存在并关联正确的 `leadId` 和 `projectId`。
- [ ] 预计成交金额、预计日期和风险等级可查看。
- [ ] 预测阶段与 `pipeline` 当前阶段一致。

### 客户链路记录

| `leadId` | `followId` | `pipelineId` | `forecastId` | 结果 |
| --- | --- | --- | --- | --- |
|  |  |  |  | 通过 / 不通过 |

## 3. 项目流程

- [ ] `projectId` 存在并关联原始 `leadId`。
- [ ] `brandId` 存在并关联当前企业客户。
- [ ] 项目名称、状态、截止时间和客户信息可查看。
- [ ] 工作台能够进入该项目空间。
- [ ] `workspaceContext` 记录当前 `projectId`、`brandId` 和生产参数。
- [ ] 从项目空间继续创作时，项目上下文未丢失。

### 项目链路记录

| `projectId` | `brandId` | `workspaceContextId` | 项目状态 | 结果 |
| --- | --- | --- | --- | --- |
|  |  |  |  | 通过 / 不通过 |

## 4. AI 生产流程

本阶段使用现有 Demo / mock 生产能力，不要求调用真实模型。

### 4.1 方案与版本

- [ ] 在工作台选择一个企业生产方案。
- [ ] 确认方案后生成稳定的 `planId`。
- [ ] 首次确认产生 V1，并记录 `versionId`。
- [ ] 编辑方案后可产生新版本，且 `planId` 保持不变。
- [ ] 切换或恢复版本时，目标 `versionId` 可被准确识别。

### 4.2 任务与资产

- [ ] 确认方案后进入现有生产入口。
- [ ] 生产任务生成 `taskId`。
- [ ] 成功结果形成 `assetId`。
- [ ] 任务状态和结果资产可在结果页或生产记录中读取。
- [ ] 资产来源能够追踪到 `projectId / planId / versionId`。
- [ ] 点击资产来源可恢复对应方案版本预览。
- [ ] 恢复预览不会创建新任务，也不会改变原 `planId / versionId`。

### AI 生产链路记录

| `planId` | `versionId` | `taskId` | `assetId` | 结果 |
| --- | --- | --- | --- | --- |
|  |  |  |  | 通过 / 不通过 |

## 5. 资产流程

- [ ] 项目资产中心能够看到本项目生成的作品资产。
- [ ] 每个项目资产具有 `projectAssetId`。
- [ ] 每个资产版本具有 `assetVersionId`。
- [ ] 资产类型、创建时间和当前版本可查看。
- [ ] 资产来源展示项目、方案和版本。
- [ ] 审核状态、交付状态与当前资产版本对应。
- [ ] 点击来源可返回对应方案版本预览。

### 资产链路记录

| `projectAssetId` | `assetVersionId` | `assetId` | 来源 `planId` | 来源 `versionId` | 结果 |
| --- | --- | --- | --- | --- | --- |
|  |  |  |  |  | 通过 / 不通过 |

## 6. 交付流程

- [ ] `deliveryId` 存在。
- [ ] 交付记录关联正确的 `projectId` 和 `assetId`。
- [ ] 交付标题、状态和创建时间可查看。
- [ ] 交付状态能够进入待审核流程。
- [ ] mock / fallback / 占位结果不能被直接审核通过交付。
- [ ] 正式交付记录未破坏原结果页审核红线。

### 交付链路记录

| `deliveryId` | `projectId` | `assetId` | 交付状态 | 结果 |
| --- | --- | --- | --- | --- |
|  |  |  |  | 通过 / 不通过 |

## 7. 经营后台

### 7.1 Dashboard

- [ ] `dashboard` 显示客户数量、销售阶段金额和预计成交金额。
- [ ] 项目数量和交付数量与 Demo 数据一致。
- [ ] API 使用统计不存在虚构的真实调用。

### 7.2 Report

- [ ] `report` 能展示当前周期经营摘要。
- [ ] 报告包含客户、销售、项目、交付和风险汇总。

### 7.3 Insight

- [ ] `insight` 能展示当前经营机会或风险洞察。
- [ ] 洞察内容可追溯到已有经营数据。

### 7.4 Advisor

- [ ] `advisor` 能展示下一步经营行动建议。
- [ ] 建议能够关联重点客户、项目或风险。

### 经营后台记录

| 模块 | 对象 ID / 周期 | 核心结果 | 通过 |
| --- | --- | --- | --- |
| `dashboard` |  |  | [ ] |
| `report` |  |  | [ ] |
| `insight` |  |  | [ ] |
| `advisor` |  |  | [ ] |

## 8. 全链路 ID 追踪

验收结束前，确认以下关系能够从前向后追踪：

```text
leadId
  -> followId / pipelineId / forecastId
  -> projectId
  -> brandId / workspaceContextId
  -> planId / versionId
  -> taskId / assetId
  -> projectAssetId / assetVersionId
  -> deliveryId
  -> dashboard / report / insight / advisor
```

- [ ] 所有必需 ID 均已记录。
- [ ] 同一业务对象未出现含义冲突的重复 ID。
- [ ] `planId` 在方案版本切换时保持不变。
- [ ] `versionId` 在资产来源恢复时保持不变。
- [ ] `taskId / assetId / deliveryId` 的关联关系可验证。

## 9. 最终验收门禁

| 验收项 | 结果 |
| --- | --- |
| Demo 数据初始化成功 | [ ] |
| 企业客户流程完整 | [ ] |
| 项目与品牌上下文完整 | [ ] |
| AI 生产方案、版本、任务和资产可追踪 | [ ] |
| 项目资产及资产版本可查看 | [ ] |
| 交付流程及审核红线正常 | [ ] |
| 经营后台四类视图正常 | [ ] |
| 未开启真实 provider | [ ] |
| 未开启真实额度扣减 | [ ] |
| 未连接真实支付 | [ ] |

最终结论：通过 / 有条件通过 / 不通过

问题与备注：

1.
2.
3.
