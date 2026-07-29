# Cloud Provider Alpha 真实环境验收 Runbook

本 Runbook 仅验收 `Enterprise`、`Member`、`Project` 三类数据。`ProductPackage`、`Quote`、`Order`、`Delivery`、`Audit`、AI 任务、额度和支付均不在 Alpha 范围内。

## A. 本地安全基线

1. 保持 `DATA_SOURCE_MODE=local`，或不设置该变量。默认值必须是 `local`。
2. 在微信开发者工具打开现有企业、成员和项目页面，确认旧 local storage 数据正常显示。
3. 在云开发控制台确认此时没有 `enterprise_data` 调用日志。
4. 执行本地离线验收：

   ```powershell
   node scripts/cloud-provider-alpha-smoke.js
   ```

5. `cloud` 调用失败时不会读取、写入或回退到 local，也不会返回伪造成功结果。

## B. 云集合准备

在目标云开发环境手工创建以下独立集合：

- `enterprises`
- `enterprise_members`
- `enterprise_projects`

建议索引：

| 集合 | 索引字段 | 建议 |
| --- | --- | --- |
| `enterprises` | `enterpriseId` | 唯一索引 |
| `enterprise_members` | `enterpriseId + openId` | 联合唯一索引 |
| `enterprise_members` | `enterpriseId + memberId` | 联合唯一索引 |
| `enterprise_members` | `openId` | 普通索引，用于首次建企保护 |
| `enterprise_projects` | `enterpriseId + projectId` | 联合唯一索引 |
| `enterprise_projects` | `enterpriseId + updatedAt` | 普通索引，用于租户内列表 |

不要开放客户端直接读写权限。三类集合统一通过 `enterprise_data` 云函数访问，由服务端强制校验 `OPENID`、成员状态和 `enterpriseId`。

## C. 云函数部署

1. 在项目根目录确认以下文件存在：

   - `cloudfunctions/enterprise_data/index.js`
   - `cloudfunctions/enterprise_data/package.json`

2. 将整个 `cloudfunctions/enterprise_data` 目录复制到：

   `unpackage/dist/dev/mp-weixin/cloudfunctions/enterprise_data`

3. 打开微信开发者工具，确认当前云环境正确。
4. 在云函数目录右键 `enterprise_data`，选择“上传并部署：云端安装依赖”。
5. 在云开发控制台确认函数状态为部署成功，并检查依赖安装无报错。
6. 进行一次合法调用，确认日志只包含：`action`、`collection`、`enterpriseIdPresent`、`recordIdPresent`、`success`。日志中不得出现 `OPENID`、完整请求、完整响应、环境变量或凭证。

## D. 单账号首次企业创建

1. 使用账号 A，显式设置 `DATA_SOURCE_MODE=cloud`。
2. 调用 `set` 创建企业 A，必须携带 `enterpriseId`。
3. 在 `enterprises` 确认只创建一条企业记录。
4. 在 `enterprise_members` 确认自动创建当前账号的管理员成员：

   - `role = admin`
   - `status = active`
   - `enterpriseId` 与企业一致

5. 使用相同账号、相同 `enterpriseId` 重复提交，必须返回已有企业和成员关系，不得新增重复记录。
6. 模拟管理员 Member 写入失败，确认事务回滚后企业和成员均不存在，不允许半完成状态。
7. 已属于其他企业的账号不得通过首次创建流程加入一个已存在的第三方企业。

## E. 项目 CRUD

在账号 A 的有效 `active` 成员上下文中依次验收：

1. 创建项目，检查 `projectId` 和服务端写入的 `enterpriseId`。
2. 按 `projectId` 查询项目。
3. 查询项目列表，确认结果仅包含企业 A 数据。
4. 更新项目，确认 `enterpriseId` 未被前端覆盖。
5. 删除项目，再次读取应返回 `not_found`。
6. 对不存在或属于其他企业的 `projectId`，不得返回项目内容。

## F. 双账号租户隔离

1. 账号 A 创建企业 A 和项目 A。
2. 账号 B 创建企业 B 和项目 B。
3. 账号 A 尝试读取、更新、删除项目 B，应返回 `tenant_mismatch` 或 `not_found`，且不得包含项目 B 内容。
4. 账号 B 对项目 A 执行同样检查。
5. 分别执行项目 `query`，确认服务端始终强制附加当前 `enterpriseId`。
6. 检查成员和企业读取也不能跨企业。

## G. 成员状态

1. `active` 成员可以访问当前企业允许的 Enterprise、Member、Project 操作。
2. `pending` 成员访问返回 `member_inactive`。
3. `disabled` 成员访问返回 `member_inactive`。
4. 无成员关系返回 `member_not_found`。
5. 普通成员不得创建管理员、提升自己为管理员或管理成员。
6. 删除、禁用或降级最后一个有效管理员必须被拒绝。

## H. 回退

1. 将 `DATA_SOURCE_MODE` 设置为 `local`，或删除该显式配置。
2. 重新编译小程序，确认旧 local storage 数据恢复显示。
3. 检查不再调用 `enterprise_data`。
4. 不删除云端数据。
5. 不执行 local/cloud 自动双写，也不运行自动迁移。

## 验收错误码

Alpha 客户端统一返回 `{ ok, status, data, errorCode, message }`。重点检查：

- `invalid_params`
- `unauthorized`
- `member_not_found`
- `member_inactive`
- `tenant_mismatch`
- `not_found`
- `duplicate_record`
- `cloud_call_failed`
- `cloud_response_invalid`
- `not_implemented`

开发环境可附加安全 `debug`，只包含 provider 模式、动作、资源类型、是否有企业 ID、是否有记录 ID、云函数名和耗时；正式环境不返回 `debug`。
