# 套餐下单安全契约

## 1. 核心原则

价格的唯一真相源在服务端。

客户端永远只表达：

- 我要买哪个 packageId
- 用什么支付渠道
- 可选幂等键

客户端不能决定：

- price
- amount
- totalFee
- quota
- validity
- productName 中隐含价格

## 2. 客户端允许传什么

允许：

- packageId，必传
- packageType，可选
- payChannel，可选，默认微信
- quantity，可选，必须服务端校验
- source，可选
- idempotencyKey，可选

禁止作为可信字段传：

- price
- amount
- totalFee
- total_fee
- quota
- credits
- validDays
- product_name 中隐含价格

前端展示价格可以保留，但展示价格不能进入下单 payload。

## 3. 服务端下单必须校验

服务端必须按顺序做：

1. 身份校验

- 从微信上下文拿 openid
- 订单绑定 openid
- 不信客户端 userId/openid

2. packageId 合法性

- 从服务端套餐表查询 packageId
- 查不到则拒绝

3. 套餐可售状态

- 必须上架
- 未下线
- 未过期

4. 服务端定价

- price = 服务端套餐表 price
- 金额单位统一用整数分
- 完全无视客户端传来的任何金额字段
- 如果客户端传了 price 且与服务端不一致，只记录告警，不采用客户端金额

5. 生成订单

- 状态 created/unpaid
- 记录 openid/packageId/serverPrice/packageSnapshot/createdAt

6. 生成支付参数

- 用服务端价格调用微信统一下单
- 支付签名基于服务端金额生成

## 4. 支付回调必须校验

客户端 wxPay success 只能用于 UI 提示，不能发放权益。

权益发放只能基于服务端支付回调。

服务端回调必须校验：

1. 微信回调验签
2. 回调订单是否存在
3. 回调金额是否等于订单服务端金额
4. 订单状态是否未支付
5. 重复回调幂等处理
6. 支付成功后才发放额度/会员权益
7. 已支付订单重复回调不能重复发放权益

## 5. 幂等要求

### 下单幂等

- 同一用户短时间内重复购买同一个 packageId
- 可复用未支付订单
- 或使用 idempotencyKey
- 避免生成大量 unpaid 订单

### 回调幂等

- 已支付订单再次收到回调，直接返回成功
- 不重复发权益

## 6. 推荐接口契约

推荐接口：

POST /api/orders/package

请求体：

```json
{
  "packageId": "pkg_xxx",
  "packageType": "standard",
  "quantity": 1,
  "payChannel": "wechat",
  "source": "miniapp",
  "idempotencyKey": "optional"
}
```

不要包含 price。

推荐返回：

```json
{
  "success": true,
  "orderId": "order_xxx",
  "packageSnapshot": {
    "packageId": "pkg_xxx",
    "packageName": "基础套餐",
    "packageType": "standard",
    "price": 9900,
    "originalPrice": 12900,
    "credits": 100,
    "validDays": 30
  },
  "payParams": {}
}
```

## 7. 错误场景

- packageId 缺失
- packageId 不存在
- 套餐已下架
- 套餐已过期
- quantity 非法
- 用户未登录
- 重复下单
- 支付回调验签失败
- 支付回调金额不匹配
- 支付回调订单不存在
- 支付回调重复通知
- 已支付订单重复发权益风险

## 8. 验收清单

- 前端篡改 price 不影响服务端订单金额
- 前端传 0.01 不会生成 0.01 元订单
- 前端传 quota/credits 不影响实际发放权益
- 下架套餐不能购买
- 回调金额不一致不发放权益
- 重复回调不重复发放权益
- 客户端 wxPay success 不直接发放权益
- 服务端订单金额使用整数分
- 服务端保存 packageSnapshot
- 服务端记录异常改价告警

## 9. 当前仓库状态

- 当前仓库已修复 utils/pay.js，不再发送 price
- 当前 utils/pay.js#createOrder 只允许 packageId/packageType/quantity/source
- 当前 package-center.vue 实际调用 createPackagePurchaseOrder({ packageId, packageType })
- 当前仓库未包含真实 POST /api/orders/package 服务端实现
- 后续真实服务端必须遵守本契约
- 前端修复不能替代服务端定价和支付回调校验
