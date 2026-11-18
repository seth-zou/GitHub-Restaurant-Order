# Review Summary

- 本次需求: 为沸点火锅点单 SPA 提供人民币（CNY）、美元（USD）、日元（JPY）三种货币的展示与计算能力，覆盖菜单、购物车、订单、结账与会员权益。
- 需求类型: UX / 前端展示与计算 / 前端状态 / 可访问性 / 本机预览（非后端）。
- 变更面: Functional Requirements、UX Design、Backend/Data（当前为前端数据契约）、NFR / DFX、Test Cases、Traceability；不涉及: API Design、Metrics、真实支付与汇率服务；待确认: 无阻塞项。
- 变更面判断依据: 需求澄清文档；仓库证据 `src/lib/utils.ts`（`money()` 硬编码 `¥`）、`src/data/menu.ts`（单一数值价格）、`src/components/*`（直接调用 `money()`）、`src/App.tsx`、`src/i18n.ts`；无后端定价接口，`server/` 仅健康检查。
- 差异判断: 产品形态/站点/环境/版本差异——不涉及新增差异；依据为单仓 React SPA、hash 路由、GitHub Pages 子路径部署，无原生端与多站点证据。
- 本次变更关键信息:
  - 支持 CNY / USD / JPY 三种货币；原复用分支中的 HKD 已收敛移除。
  - 币种由门店（桌台）决定，整桌统一且顾客不可切换；**不做汇率换算**，门店按本币定价直接展示与加总。
  - 金额精度按 ISO 4217 最小货币单位：CNY/USD 2 位小数，JPY 0 位小数；CNY 与 JPY 同为 `¥` 需用 ISO 代码消除歧义。
  - 优惠门槛 100 / 面额 30 为门店本币金额，按本币小计计算，优惠不超过小计。
  - 复用并收敛远端未合并分支 `feat/d0971ca8-aoye`，避免重复实现。
- Review 重点: 三币种范围是否收敛彻底（无 HKD 残留）、JPY 精度与合计是否一致、是否存在混币、页面是否出现顾客可切换币种或汇率入口、既有主题/老人模式/路由回归。

## Scope Note

- Implemented sections: Functional Requirements、UX Design、Backend/Data、NFR / DFX、Test Cases、Traceability、Open Questions。
- Not involved: API Design（无对外接口）、Metrics（无新增埋点口径）。
- Needs confirmation: 无。
- Reason: 需求澄清已关闭三项业务契约；仓库证据确认变更集中于前端展示层、金额工具与演示门店数据，无后端与外部服务依赖。

---

# 产品 Spec: 支持人民币、美元、日元的展示和计算

## 1. Context

本 PRD 基于「需求澄清」文档（同批次产物）与仓库基线 `seth-zou/GitHub-Restaurant-Order` `main` @ `58ee88a`。

Spec 阶段增量（相对澄清文档）：

- 固化「币种精度按 ISO 4217 最小货币单位」为通用规则：CNY/USD 2 位小数，JPY 0 位小数；澄清文档仅约定需消除 `¥` 歧义。
- 固化展示格式为「符号 + 千分位 + 币种精度」，并明确菜单价格补充 ISO 代码、关键金额提供 `aria-label`（如 `JPY ¥68`）。
- 固化演示门店映射与 `?currency=USD|JPY` 预览约定，供 E2E 与设计直达。
- 关闭复用决策：以 `feat/d0971ca8-aoye` @ `ed2eb1c` 为基线复用，移除 HKD 并收敛为三币种。

## 2. Goals and Non-Goals

沿用需求澄清文档的目标与非目标，并做以下 Spec 级收窄：

- Goals：把币种范围（三币种）、精度口径、整桌单一币种、不换算口径与测试口径固化为下游唯一契约。
- Non-Goals：不做汇率换算与实时汇率接入；不支持 HKD 及其他货币；不做顾客侧币种切换、多币种混排或双列参考币种；不改造后端定价与支付。

## 3. Glossary

| 术语 | 含义 |
|---|---|
| 门店币种 | 门店本币定价所使用的 ISO 4217 货币代码（CNY/USD/JPY），由桌台所属门店决定 |
| 整桌单一币种 | 同一张桌台的所有明细、小计、优惠与应付只能使用一种币种 |
| 币种精度 | 金额展示与取整所使用的小数位，等于该币种最小货币单位 |
| 本币金额 | 门店定价币种下的原值金额，不经过任何汇率换算 |

## 4. Functional Requirements

### REQ-001: 三币种金额展示

- User Story: 作为在不同货币门店就餐的顾客，我希望所有金额都按本门店的货币展示，以便准确理解价格。
- Priority: P0
- Description: 菜单卡片、菜品规格弹窗、购物车（含移动端弹层）、订单列表与合计、结账明细/小计/优惠/应付、支付成功实付、移动端购物车悬浮按钮、顶栏会员券金额，均按当前门店币种展示。

Acceptance Requirements (EARS):

- REQ-001.1: The system shall 支持 CNY、USD、JPY 三种货币；任一金额均以「符号 + 千分位 + 该币种精度」展示。
- REQ-001.2: When 当前门店币种为 CNY 或 USD，the system shall 展示 2 位小数（如 `¥68.00`、`$68.00`）。
- REQ-001.3: When 当前门店币种为 JPY，the system shall 展示 0 位小数（如 `¥68`），任何金额均不出现小数点。
- REQ-001.4: When 金额 ≥ 1000，the system shall 使用千分位分隔（如 `¥1,234.00`）。
- REQ-001.5: The system shall 不在金额展示中硬编码 `¥` 或任何单一币种符号。

Gherkin:

```gherkin
Scenario: 美元门店菜单金额展示
  Given 用户绑定 B12 桌台（美元门店）
  When 用户进入点餐页
  Then 菜品价格以 $ 开头并保留 2 位小数
  And 顶栏显示「美元 USD」
```

```gherkin
Scenario: 日元门店金额为整数
  Given 用户绑定 D03 桌台（日元门店）
  When 用户查看菜单、购物车和结账页
  Then 所有金额均以 ¥ 开头且不含小数位
```

### REQ-002: 币种由门店决定且整桌统一

- User Story: 作为门店顾客，我希望整桌价格口径一致，以便多人协同点单与结账时不产生歧义。
- Priority: P0
- Description: 币种是门店属性；绑定桌台后确定整桌币种并写入应用状态，全链路只读，顾客无法切换。

Acceptance Requirements (EARS):

- REQ-002.1: When 用户绑定桌台，the system shall 依据桌台所属门店确定整桌币种，并在菜单、购物车、订单、结账中一致使用。
- REQ-002.2: The system shall 在顶栏展示当前币种名称与代码，并在悬停提示中说明该币种来自门店本币定价。
- REQ-002.3: The system shall 不提供任何顾客可切换币种的入口（按钮、下拉、单选组）。
- REQ-002.4: If 桌台未绑定或未知，the system shall 回落人民币门店，不报错、不阻塞流程。

Gherkin:

```gherkin
Scenario: 绑定美元门店桌台
  Given 用户在首页选择 B12 桌台
  When 用户进入点餐页
  Then 顶栏显示「美元 USD」徽标
  And 菜单与购物车金额均使用 $
```

### REQ-003: 金额计算与合计

- User Story: 作为顾客，我希望小计、合计与应付可被准确验算，以便放心结算。
- Priority: P0
- Description: 明细行金额、小计、订单合计与应付按当前币种计算，并按币种最小单位取整；不允许跨币种相加。

Acceptance Requirements (EARS):

- REQ-003.1: The system shall 按「单价 × 数量」计算明细行金额，并按当前币种精度取整后展示。
- REQ-003.2: When 计算小计或订单合计，the system shall 使用同一币种逐行取整后累加，保证明细行之和与合计一致。
- REQ-003.3: When 出现半份折算等比例计算，the system shall 按当前币种最小单位四舍五入（如 JPY 24.36 → ¥24）。
- REQ-003.4: If 任一金额缺少币种上下文或与整桌币种不一致，the system shall 视为不符合本需求。

Gherkin:

```gherkin
Scenario: 日元半份取整
  Given 用户在日元门店打开「琥珀嫩牛肉」（¥42）并选择半份
  When 用户加入购物车
  Then 购物车行金额为 ¥24
  And 不出现 ¥24.36 等小数金额
```

### REQ-004: 优惠与应付计算

- User Story: 作为顾客，我希望优惠金额与应付合计按门店本币展示，以便正确理解优惠力度。
- Priority: P1
- Description: 会员菜品券活动为「本币小计满 100 减 30」，按当前币种计算，优惠不超过小计。

Acceptance Requirements (EARS):

- REQ-004.1: When 本币小计 ≥ 100，the system shall 扣减 30（本币），且应付 = 小计 − 30。
- REQ-004.2: When 本币小计 < 100，the system shall 不展示优惠金额，应付等于小计。
- REQ-004.3: The system shall 在结账页以当前币种展示优惠规则与优惠金额（如「菜品满 $100.00 减 $30.00」）。
- REQ-004.4: The system shall 不通过汇率把优惠金额换算为其他币种。

Gherkin:

```gherkin
Scenario: 美元门店满减
  Given 美元门店预置订单小计为 $130.00
  When 用户进入结账页
  Then 展示「-$30.00」
  And 应付合计为 $100.00
  And 确认支付按钮文案为「确认支付 $100.00」
```

### REQ-005: 不换算与不混币

- User Story: 作为验收人员，我希望页面上没有任何汇率换算与混币，以便确认口径单一、结果可复现。
- Priority: P0
- Description: 页面不展示汇率、不出现换算入口；同一账单只出现一种币种符号。

Acceptance Requirements (EARS):

- REQ-005.1: The system shall 不发起任何汇率查询或价格转换请求，金额完全来自门店本币定价。
- REQ-005.2: The system shall 在币种徽标或说明中明确「门店本币定价，不做汇率换算」。
- REQ-005.3: When 查看任意账单（菜单/订单/结账），the system shall 只出现当前币种金额，不出现其他币种符号或金额。

Gherkin:

```gherkin
Scenario: 美元账单不出现人民币金额
  Given 用户进入美元门店结账页
  Then 页面金额只出现 $
  And 页面不出现 ¥ 金额
```

### REQ-006: 双语、可访问性与友好展示

- User Story: 作为中文或英文顾客、以及使用读屏的用户，我希望币种与金额可被正确朗读和区分。
- Priority: P1
- Description: 新增币种相关文案中英文同步；CNY 与 JPY 同为 `¥` 时，菜单价格补充 ISO 代码，关键金额提供带 ISO 代码的辅助文本。

Acceptance Requirements (EARS):

- REQ-006.1: When 用户切换中英文，the system shall 同步切换币种相关文案，币种与金额格式保持不变。
- REQ-006.2: When 页面上 CNY 与 JPY 都可能以 `¥` 展示，the system shall 至少通过 ISO 代码或辅助文本提供区分。
- REQ-006.3: The system shall 不新增未翻译的硬编码用户可见文案。

Gherkin:

```gherkin
Scenario: 英文结账页保持币种
  Given 用户处于美元门店结账页
  When 用户切换为英文
  Then 页面标题为「Review Your Bill」
  And 金额仍为 $130.00
```

## 5. UX Design

### 体验目标与设计原则

- 沿用「暖纸沸点」设计系统：页面底色 `bg-rice-100`、主卡片 `bg-white + shadow-card + rounded-3xl`、辣红只用于动作/选择/风险/服务，琥珀只用于进度/注意。
- 币种信息是**说明性信息**，不是主操作：使用与桌台徽标同级的次级徽标（`bg-rice-200` + `text-charcoal-700`），不抢占主 CTA。
- 金额继续使用 `text-chili-500` 为主强调色，保证「价格完整可见」的设计约定。

### 页面与入口范围

| 位置 | 用户操作 | 系统反馈 | 约束 |
|---|---|---|---|
| 顶栏 | 查看桌台与币种 | 展示「桌台」徽标 + 「币种名称 + ISO 代码 + 符号」徽标；桌面宽屏额外展示「本币定价，不做汇率换算」 | 移动端不新增横向溢出，说明文本在窄屏隐藏 |
| 菜单卡片 / 规格弹窗 | 浏览价格 | 本币符号 + 千分位 + 精度，并附 ISO 代码（如 `¥68 · JPY · 起`） | 保持现有价格字号层级 |
| 购物车（侧栏/移动弹层） | 加减数量 | 行金额、小计、预估合计按本币展示 | 不出现其他币种 |
| 订单页 | 查看明细与合计 | 行金额与合计按本币展示 | 保持退菜、进度等既有交互 |
| 结账页 | 核对并支付 | 明细、小计、优惠规则、优惠金额、应付、确认支付按钮均按本币；支付成功实付按本币 | 不新增币种选择 |
| 会员弹层 | 查看权益 | 菜品券金额按本币展示 | 文案走 i18n 插值 |

### 核心体验路径

1. 顾客绑定桌台，系统确定门店与整桌币种。
2. 顾客浏览菜单：所有价格按本币展示，必要时以 ISO 代码区分 `¥`。
3. 顾客加入购物车并提交订单：购物车与订单金额使用同一币种。
4. 顾客结账：小计、优惠、应付按本币计算并展示，确认支付金额与应付一致。

### 分支路径与异常

| 场景 | 系统响应 |
|---|---|
| 未绑定/未知桌台 | 回落人民币门店，不报错 |
| 非法 `?currency=` 参数 | 忽略参数，按普通深链接进入 A08（CNY） |
| JPY 比例折算出现小数 | 按最小单位取整展示，不出现小数 |
| 小计未达优惠门槛 | 不展示优惠，应付等于小计 |
| 夜间模式 / 老人模式 | 币种徽标与金额沿用现有集中暗色映射与字号放大，不做独立实现 |

### 文案与状态说明

- 币种名称：`人民币 CNY` / `美元 USD` / `日元 JPY`（英文：`Chinese Yuan CNY` / `US Dollar USD` / `Japanese Yen JPY`）。
- 顶栏提示：`{{store}} 门店定价，整桌按该币种展示与加总，不可自行切换`。
- 不换算说明：`门店本币定价，不做汇率换算`。
- 优惠规则：`菜品满 {{threshold}} 减 {{amount}}`。
- 以上文案均位于 `src/i18n.ts` 的 `currency.*` / `common.coupon` / `checkout.discount_rule`，中英文同步维护。

## 6. Backend/Data

本需求不涉及后端服务、对外 API、权限与持久化变更；`server/` 健康检查不受影响。前端数据契约如下：

| 对象 | 契约 | 校验 / 规则 | 兼容性 |
|---|---|---|---|
| `CurrencyCode` | `'CNY' \| 'USD' \| 'JPY'` | 仅这三种；`isCurrencyCode` 用于参数校验 | 新增类型；原 `money()` 保留为 CNY 兼容别名 |
| `CURRENCIES` | 每币种 `symbol`、ISO `numeric`、`fractionDigits`、`labelKey` | CNY/USD `fractionDigits=2`，JPY `fractionDigits=0` | 新增 |
| `Store` / `tableStore` | 门店含 `id`、`nameKey`、`currency`；桌台映射到门店 | A08→CNY、B12/C06→USD、D03→JPY；未知回落首家门店 | 演示静态数据，替换数据源不影响调用方 |
| `AppState.currency` | 当前桌台整桌币种 | 由 `BIND_TABLE` 设置；初始值由桌台推断 | 新增状态字段 |
| `CartItem.currency` | 条目币种 | 加入购物车时锁定为整桌币种 | 新增字段；调用方需同步 |
| `formatMoney(value, currency)` | 符号 + 千分位 + 币种精度 | 内部按币种最小单位取整 | 统一入口，禁止手拼符号 |
| `sumLineTotals(items, currency)` | 逐行取整后累加 | 单币种输入 | 替代裸 `reduce` 求和 |
| `calcDiscount/calcPayable(subtotal, currency)` | 满 100 减 30（本币），优惠 ≤ 小计 | 门槛与面额为 `DISCOUNT_THRESHOLD`/`DISCOUNT_AMOUNT` | 新增 |
| `?currency=USD\|JPY` | 预览直达对应门店目标视图 | 非法值忽略；不支持 HKD | 仅影响演示/验收入口 |

迁移与回滚：无数据迁移；金额均为内存态，刷新即重置。回滚时删除币种层并恢复 `money()` 单币种展示即可，静态演示门店映射不构成外部契约。

## 7. NFR / DFX

| 类别 | 要求 | 验收方法 |
|---|---|---|
| 正确性 | 同一账单只出现一种币种；明细行之和等于小计（按币种精度） | E2E MC-003/004/006/007 + 人工验算 |
| 精度 | 遵循 ISO 4217 最小货币单位；取整发生在最小单位 | 单元级计算检查（E2E 覆盖 JPY 取整）+ 代码审查 |
| 兼容性 | 不改变主流程、hash 路由、深链接、GitHub Pages 子路径部署 | 全量 Playwright（43 项） |
| 可访问性 | 金额提供可读辅助文本；CNY/JPY 同符号时以 ISO 代码区分；保持 44px 触控目标与可见焦点 | E2E + 人工键盘检查 |
| 视觉一致性 | 遵循设计系统三层表面、颜色语义与字号层级；不新增 hex 或 UI 框架 | `components.html` 对照 + 人工审查 |
| 国际化 | zh/en 文案同步，无硬编码用户可见文本 | 中英文切换 E2E（MC-010）+ 代码审查 |
| 性能 | 纯前端同步计算，无网络请求，页面交互无明显延迟 | 构建体积与人工冒烟 |
| 安全与隐私 | 不新增网络请求、Cookie、埋点；无汇率密钥需求 | 代码审查 |
| 可观测性 | 不新增埋点与日志（本节点范围外） | Metrics 章节说明 |
| 主题叠加 | 夜间模式与老人模式下币种徽标与金额可读 | 现有主题 E2E 回归 + 人工检查 |

## 8. Test Cases

| ID | 覆盖 | 前置 / 步骤 | 预期 | 类型 |
|---|---|---|---|---|
| MC-001 | REQ-001 | 绑定 A08（人民币门店） | 金额为 `¥68.00`；顶栏含 CNY | E2E |
| MC-002 | REQ-001/002 | 绑定 B12（美元门店）并加入首菜 | 顶栏含 USD；购物车为 `$68.00`，无 `¥` | E2E |
| MC-003 | REQ-001 | 绑定 D03（日元门店） | 顶栏含 JPY；菜单价格为整数 | E2E |
| MC-004 | REQ-003 | 日元门店选「琥珀嫩牛肉」半份加入购物车 | 行金额 `¥24`，无小数 | E2E |
| MC-005 | REQ-004 | `?currency=USD#/checkout` | 小计 `$130.00`、优惠 `-$30.00`、应付 `$100.00` | E2E |
| MC-006 | REQ-003/004 | `?currency=JPY#/checkout` | `¥130`、`-¥30`、`¥100`，均无小数 | E2E |
| MC-007 | REQ-005 | 依次打开 USD/JPY/CNY 结账页 | 仅出现对应币种，不出现另一币种符号 | E2E |
| MC-008 | REQ-001 | 美元门店打开会员弹层 | 显示 `含 $30.00 菜品券` | E2E |
| MC-009 | REQ-002/005 | 人民币门店查找币种/汇率入口 | 无切换币种按钮、无下拉、无汇率入口 | E2E |
| MC-010 | REQ-006 | 美元结账页切换英文 | 标题 `Review Your Bill`，金额仍 `$130.00` | E2E |
| TC-REG | 全部 REQ | 全量 Playwright | 43 项全部通过 | E2E |
| TC-BUILD | NFR | `npx tsc -b --noEmit`、`npm run lint`、`npm run build` | 全部通过，零警告 | 静态检查 |
| TC-OTHER | 兼容性 | 其他货币（如 HKD）预览参数 | 不支持，回落默认人民币门店 | 人工/代码审查 |

## 9. Open Questions

| ID | 问题 | 影响 | 决议 / 建议负责人 |
|---|---|---|---|
| OQ-001 | 真实门店定价与币种映射由谁提供？ | 当前为前端静态演示数据；接入真实数据源时需改为后端下发 | 本次不阻塞；后续多门店需求由 RD/PM 另立。 |
| OQ-002 | 是否需要财务级精确金额（整数最小单位存储）？ | 当前浮点 + 最小单位取整满足展示一致；真实支付场景建议整数化 | 接入真实支付时由 RD 评估。 |
| OQ-003 | 是否会扩展其他货币（含 HKD）？ | 会影响 `CurrencyCode`、文案与测试矩阵 | 本次明确不支持；如有需要另立需求。 |

## 10. Traceability

| REQ | 设计 / 契约 | NFR | 测试 |
|---|---|---|---|
| REQ-001 | UX 页面范围；`formatMoney`/`CURRENCIES` | 正确性、精度、视觉一致性 | MC-001, MC-002, MC-003, MC-008 |
| REQ-002 | UX 顶栏徽标；`Store`/`tableStore`/`AppState.currency` | 兼容性 | MC-002, MC-009 |
| REQ-003 | `sumLineTotals`/`roundMoney`/`CartItem.currency` | 正确性、精度 | MC-003, MC-004, MC-006 |
| REQ-004 | `calcDiscount`/`calcPayable`/文案插值 | 正确性 | MC-005, MC-006 |
| REQ-005 | 不换算说明；无汇率入口 | 安全与隐私 | MC-007, MC-009 |
| REQ-006 | i18n 同步；`aria-label`/ISO 代码 | 可访问性、国际化 | MC-010, 人工键盘检查 |

## API Design

本需求不涉及对外 API、SDK、Webhook、CLI 或客户集成契约变更。

## Metrics

本需求不涉及新增或变更埋点、日志、Dashboard 或指标口径。
