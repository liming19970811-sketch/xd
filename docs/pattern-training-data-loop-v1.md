# AI制版训练数据闭环 V1

## 范围

本阶段只建设数据授权、样本快照、人工修订差异、数据集快照、模型版本登记和真实评测记录。

- 不执行模型训练。
- 不自动启用模型。
- 不自动匹配工厂、询价、下单或支付。
- 不把已批准版型标记为生产级纸样。

## 标准数据

`patternInput` 使用输入类型、品类、输入资产 ID、人体/成衣尺寸、基础尺码、面料属性、结构选项和工艺要求。训练样本不接受临时路径或 HTTPS 签名地址作为输入资产 ID。

`patternOutput` 保存技术图资产 ID、纸样部件、尺码表、工艺说明、生成输出、模型版本和运行引用，并固定：

```text
humanReviewRequired=true
productionReady=false
```

## 云端集合

复用：

- `enterprise_pattern_masters`
- `enterprise_pattern_versions`
- `enterprise_pattern_parts`
- `enterprise_pattern_size_specs`
- `enterprise_pattern_reviews`

新增训练数据集合：

- `enterprise_pattern_training_consents`
- `enterprise_pattern_training_samples`
- `enterprise_pattern_revision_diffs`
- `enterprise_pattern_datasets`
- `enterprise_pattern_dataset_items`
- `enterprise_pattern_model_versions`
- `enterprise_pattern_evaluations`
- `enterprise_pattern_evaluation_results`
- `enterprise_pattern_evaluation_reviews`
- `enterprise_pattern_training_events`

## 资格规则

训练样本必须同时满足：

1. 版型版本为当前有效的 `approved` 版本。
2. 版型所有者已显式授权 `ai_pattern_training`。
3. 版本链中存在可追溯的 AI 初稿。
4. AI 初稿与批准版本不是同一版本，存在独立人工修订。
5. 正面输入拥有稳定资产引用。
6. 所有查询使用可信企业会话和企业隔离条件。

撤回授权后，新样本不可创建，未冻结用于合规数据集的候选样本标记为 `withdrawn`。历史冻结数据集的后续处置需按协议与治理流程执行，V1 不执行破坏性删除。

## 模型与评测

模型登记状态固定从 `registered_not_trained` 开始。V1 不提供训练、激活或灰度发布动作。

评测只接收外部实际运行产生的逐样本结构化结果。固定评测集按版型血缘与训练集隔离，自动指标仅计算可验证的部件和尺寸差异，结构与工艺准确性由独立打版师盲评。系统不根据样本就绪率推算准确率，也不自动部署或激活候选模型。

详细规则见 `docs/pattern-model-evaluation-v1.md`。

## 部署

云函数源码：

- `cloudfunctions/pattern_training`
- `cloudfunctions/pattern_review`

在微信开发者工具中分别选择“上传并部署：云端安装依赖”。部署前需要按现有数据库治理流程创建新增集合及索引，不能扩大现有集合权限。
