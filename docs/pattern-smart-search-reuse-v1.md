# 版型智能检索与复用 V1

## 真实数据基础

V1 复用 `enterprise_pattern_masters`、`enterprise_pattern_versions`、`enterprise_pattern_parts` 和 `enterprise_pattern_size_specs`，不新增版型集合。检索与派生通过 `pattern_review` 云函数执行，页面不直接查询云数据库。

## 检索规则

- 请求支持品类、人群、季节、风格、版型、领型、袖型、衣长、基础尺码、面料类型、弹性、厚度、使用场景、状态和标签。
- 云端忽略客户端 `enterpriseId`，始终使用可信企业会话中的 `enterpriseId`。
- 云数据库先按企业、范围、质量状态和品类查询，候选窗口最多 60 条；结构、尺寸、面料和风格评分在云函数内完成。
- `approved` 为高质量候选；`reviewed` 只作为明确标记的次级候选。AI 待复核、草稿、需修改和归档版型不进入推荐池。
- V1 不使用向量数据库，也不把视觉美观当成制版相似度。

## 匹配解释

匹配结果返回 `matchScore`、`matchReasons` 和 `differences`。评分权重优先考虑服装品类、版型、基础尺码、领型和袖型，再考虑人群、风格、季节、面料及使用场景。

## 派生规则

- 只能从当前 `approvedVersionId` 对应的批准版本派生。
- 新款建立独立 `patternMasterId` 和 V1 草稿，不更新基础版型版本内容。
- 保存 `parentPatternMasterId`、`derivedFrom.patternMasterId`、`derivedFrom.versionId`、`lineageRootId` 和部件/尺寸来源 ID。
- 幂等键阻止连续点击创建重复派生记录。
- 派生版型保持 `productionAvailable=false`，仍需正常复核和样衣验证。

## 权限

- 检索要求 `pattern_library.view`。
- 派生要求 `pattern_library.create`。
- 个人范围仅查询当前成员或当前用户拥有的版型。
- 企业范围只允许当前企业有权限的成员访问，不支持通过路由或请求体切换企业。
- V1 没有公共跨企业版型池，未经授权的私有版型不会进入候选。

## 云数据库索引

建议为 `enterprise_pattern_masters` 配置以下复合索引：

```text
enterpriseId + scope + reviewStatus + updatedAt(desc)
enterpriseId + scope + reviewStatus + category + updatedAt(desc)
enterpriseId + scope + ownerMemberId + reviewStatus + updatedAt(desc)
enterpriseId + scope + ownerUserId + reviewStatus + updatedAt(desc)
```

版本、部件和尺码沿用现有索引：

```text
enterpriseId + patternMasterId + versionId
```

缺少复合索引时云函数返回 `PATTERN_SEARCH_INDEX_REQUIRED`，不会退回前端全量过滤。

## 当前限制

- CloudBase 文档数据库没有原生全文搜索；关键词只在云端有界候选窗口内匹配名称、编号和标签。
- 候选窗口达到 60 条时会返回限制标记，需通过更多结构条件缩小范围。
- V1 是结构化规则匹配，不包含向量相似度、图片相似度或自动修改基础版型。
