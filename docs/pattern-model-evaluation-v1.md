# AI制版模型评测与迭代 V1

## 当前真实能力

- 已有已批准版型、AI 初稿、打版师修订版本、结构化修订差异和显式训练授权。
- 已有模型版本元数据登记，但项目内没有模型训练执行器。
- 已有 Provider 生成链路，但没有可供本评测工作台自动批量执行的制版模型接口。
- V1 只编排固定评测、保存外部真实结果、计算确定性指标、收集盲评并选择候选版本。
- 候选版本保持 `candidate_not_active`，不会自动部署、激活或替换线上模型。

## 固定评测集

固定评测集只接受同时满足以下条件的样本：

1. 当前有效批准版型。
2. 所有者训练与评测授权为 `granted`。
3. AI 初稿、人工修订稿和批准版型可追溯。
4. 输入资产为稳定资产 ID。
5. T恤、衬衫、连衣裙、半身裙、裤装和外套六类均有覆盖。

数据集使用 `datasetVersionId`、`splitRuleVersion=pattern-lineage-split-v1` 和 `frozenAt` 固定。`lineageRootId` 用于阻止同一版型或派生版型跨训练集和评测集。已冻结快照不提供更新或删除动作。

## 评测运行

每次运行固定绑定：

```text
datasetVersionId
modelVersionId
promptVersion
parserVersion
externalRunReference
```

创建运行只生成 `awaiting_external_results` 记录。外部真实执行必须通过 `record_evaluation_result` 逐样本回写结构化输出；缺少真实结果时不能完成运行。

## 指标

自动确定性指标：

- 纸样部件 precision、recall、F1。
- 尺寸字段平均绝对误差。
- 1cm 容差内尺寸比例。
- 输出完整率。

打版师盲评指标（1-5分）：

- 结构准确性。
- 尺寸准确性。
- 部件准确性。
- 工艺准确性。

盲评队列不返回模型、Provider、提示词或解析器版本。评测创建人不能评审自己创建的运行。

## 候选门槛

V1 固定门槛：

- 六个品类覆盖完整。
- 逐样本结果覆盖率为 100%。
- 每个样本至少一份独立盲评。
- 结构化输出完整率为 100%。
- 部件 F1 不低于 0.85。
- 尺寸 1cm 容差内比例不低于 0.90。
- 四项盲评均分均不低于 4.0。

达到门槛后仅允许标记为候选版本，不自动部署。

评测集创建、运行登记、结果回写、运行完成和候选选择要求企业 `settings.manage` 权限；盲评要求 `pattern_making.approve` 或 `settings.manage` 权限。评测创建人不能盲评自己的运行。

历史样本若没有 `lineageRootId`，V1 只能以 `patternMasterId` 作为保守回退。不会自动迁移或改写历史版型血缘；需要在后续数据治理中人工核对派生关系。

## 云端集合

继续复用：

- `enterprise_pattern_training_samples`
- `enterprise_pattern_datasets`
- `enterprise_pattern_dataset_items`
- `enterprise_pattern_model_versions`
- `enterprise_pattern_evaluations`

新增：

- `enterprise_pattern_evaluation_results`
- `enterprise_pattern_evaluation_reviews`

集合需要按现有数据库治理流程在云端创建并配置索引。不得扩大客户端数据库权限，所有写入继续通过 `pattern_training` 云函数和可信企业会话执行。

## 部署与运行边界

云函数需要在微信开发者工具中执行“上传并部署：云端安装依赖”。V1 没有自动训练、自动推理、自动激活、自动回滚或模型灰度发布能力。
