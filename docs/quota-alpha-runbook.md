# quota_guard 真实额度 Alpha 运行说明

## 1. 目的

本文档用于记录蝶变 AI 当前真实额度接入边界，防止误开启、误扩大或在未验证场景下产生真实积分扣减。

## 2. 当前开启动作

Alpha 范围内仅允许：

- `model_replace`：换模特单张生成。

不得将开启范围自动扩展到其他任务类型。

## 3. 当前关闭动作

以下动作禁止进入真实额度消费链路：

- `color_replace`
- `pattern_replace`
- `scene_replace`
- `batch_generate`

上述动作只能保持现有预览或安全模式，不得调用真实 consume。

## 4. 默认环境

当前默认环境必须保持：

```text
ENABLE_REAL_QUOTA_GUARD=false
```

这是日常开发、构建、预览和回归测试的默认安全状态。

- 不得将真实额度开关写入前端代码。
- 不得在普通开发、演示或自动化过程中开启真实扣减。
- 如需执行 Alpha 实机验收，必须使用专用测试账号和受控部署环境，完成后恢复为 `false`。

## 5. Alpha 测试状态

当前 Alpha 验收边界为：

- 单账号：只使用专用 Alpha 测试账号。
- 单动作：只验证 `model_replace`。
- 单张图：每次只创建一个单图任务。

禁止执行批量、并发、多账号或其他动作的真实额度测试。

## 6. 验证流程

### 6.1 Consume

1. 使用唯一 `taskId`。
2. 使用 `taskId + action` 生成幂等 key。
3. 调用 `consumeAiPoints`。
4. 确认返回 `quotaRecordId`。
5. 确认记录状态为 `consumed`。

### 6.2 Finalize

1. 仅对真实生成成功的 `consumed` 记录操作。
2. 调用 `finalizeUsage`。
3. 确认同一 `quotaRecordId` 进入 `finalized` 终态。
4. 不得对 `finalized` 记录再执行回滚。

### 6.3 Rollback

1. 仅对生成失败、超时、mock 或 fallback 结果对应的 `consumed` 记录操作。
2. 调用 `rollbackUsage`。
3. 确认返回状态为 `rolled_back`。
4. 确认回滚记录正确指向原 `quotaRecordId`。

### 6.4 Idempotent

1. 使用相同幂等 key 连续调用两次 `consumeAiPoints`。
2. 确认两次返回相同 `quotaRecordId`。
3. 确认两次返回的消费后值一致。
4. 确认未重复扣减积分。

## 7. 停止条件

出现以下任一情况时，必须立即停止 Alpha，并确认环境已恢复为 `ENABLE_REAL_QUOTA_GUARD=false`：

- 相同幂等 key 发生重复扣减。
- 未获得 `quotaRecordId` 仍创建生成任务。
- 生成失败后无法回滚。
- mock 或 fallback 结果被 finalize。
- 关闭动作进入真实 consume。
- 普通用户或非 Alpha 账号产生真实扣减。

## 8. 验收记录

每次实机验收应记录：

- 测试账号。
- `taskId`。
- 脱敏后的 `quotaRecordId`。
- consume / finalize / rollback / idempotent 结果。
- 扣减前后积分。
- 是否命中停止条件。
- 环境是否已恢复默认安全状态。
