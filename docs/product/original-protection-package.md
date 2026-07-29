# 企业版原创保护材料包

## 1. 材料包目标

原创保护材料包面向企业尊享会员，用于整理原创备案、版权登记辅助材料、维权举证和内部交付审计。它记录一次服装出图项目从客户需求到最终交付的关键证据链，帮助客户形成可追溯的项目资料。

## 2. 免责声明

平台不承诺所有 AI 自动生成图片天然可登记版权。材料包的定位是证据整理和流程留痕，不等同于版权登记结果，也不替代律师、版权机构或主管部门的专业判断。

当前阶段不接真实版权登记接口，不生成真实 ZIP 下载文件。

## 3. 材料包包含内容

- 基础任务信息：projectId、batchId、taskId、clientTaskId、entryScene、templateType、创建和完成时间。
- 客户需求：原始需求文本、参考描述、目标平台、目标用途、期望风格、期望场景、特殊备注。
- 原始素材：服装图、参考图、补充文件。
- 生成参数：风格、场景、身材、版型、输出规格等参数快照。
- AI 初稿记录：provider、requestedProvider、fallback、fallbackReason、resultImageUrl 摘要。
- 设计师精修记录：人工参与人、修图说明、版本记录。
- 样衣打版记录：打版时间、样衣说明、版型调整说明。
- 模特实拍记录：拍摄时间、场景、模特信息、成片记录。
- 最终交付图：审核通过后的最终交付图。
- 版权协助信息：原创声明、登记建议、客户确认信息。
- auditTrail：任务创建、AI 生成、人工精修、交付确认、材料包生成等审计事件。
- 文件 hash / packageSha256：后续 ZIP 能力完成后写入。

## 4. original_protection_packages 集合字段表

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| packageId | string | 材料包 ID |
| packageType | string | 固定为 original_protection_package |
| version | string | 材料包版本 |
| status | string | draft / generated / delivered / archived |
| customer | object | 客户、公司、会员、合同信息 |
| project | object | 项目、批次、任务、入口模板信息 |
| customerDemand | object | 客户需求和目标用途 |
| sourceMaterials | object | 原始服装图、参考图、补充文件 |
| generationParams | object | 出图参数快照 |
| aiGenerationRecords | array | AI 生成记录 |
| designerWorkRecords | array | 设计师精修记录 |
| sampleMakingRecords | array | 样衣打版记录 |
| photoshootRecords | array | 模特实拍记录 |
| finalDeliverables | array | 最终交付图 |
| copyrightSupport | object | 版权协助信息 |
| auditTrail | array | 审计轨迹 |
| integrity | object | 文件 hash、packageSha256、时间戳 |
| createdAt | string | 创建时间 |
| updatedAt | string | 更新时间 |

## 5. 可生成条件

- task 存在。
- task 不是 mock / fallback 结果。
- provider 不是 mock。
- `deliveryStatus === 'approved'`。
- 存在最终交付图 resultImageUrl。

## 6. 不可生成原因

- `missing_task`：任务不存在。
- `mock_result`：占位/mock 结果不可生成原创保护材料包。
- `fallback_result`：fallback 结果不可生成原创保护材料包。
- `mock_provider`：mock provider 结果不可生成原创保护材料包。
- `not_approved`：任务尚未审核通过。
- `missing_result_image`：缺少最终交付图。

mock/fallback 结果不能生成正式原创保护材料包。未审核通过不能生成正式材料包。没有最终交付图不能生成正式材料包。

## 7. 后台按钮说明

后台项目详情页的任务区域显示“生成原创保护材料包”占位按钮。

- 可生成时：生成材料包草稿，并提示“原创保护材料包草稿已生成”。
- 不可生成时：展示具体不可生成原因。
- 当前阶段只生成草稿对象，不做真实 ZIP 下载。

## 8. ZIP 目录结构建议

```text
original-protection-package/
  00_package-manifest.json
  01_customer-demand/
    requirement.md
    references/
  02_source-materials/
    cloth-image/
    style-image/
    additional-files/
  03_generation-records/
    params.json
    ai-records.json
  04_designer-work/
    retouch-records.json
  05_sample-making/
    sample-records.json
  06_photoshoot/
    photoshoot-records.json
  07_final-deliverables/
    final-images/
  08_copyright-support/
    original-statement.md
  09_audit/
    audit-trail.json
    hashes.json
```

## 9. 原创声明模板

```text
原创保护材料包声明

本材料包由客户需求、原始素材、AI 生成记录、人工精修记录、样衣/实拍记录、最终交付确认和审计轨迹组成。

本材料包仅作为原创过程、交付过程和内部审计的证据整理材料，不承诺任何图片必然获得版权登记或司法认可。

客户应根据实际用途，结合版权机构、法律顾问或主管部门要求补充证明材料。
```
