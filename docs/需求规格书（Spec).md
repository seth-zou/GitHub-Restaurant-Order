# Review Summary

- 本次需求: 沸点火锅点单 SPA（`seth-zou/GitHub-Restaurant-Order`）支持多币种（CNY/USD/HKD/JPY）的展示与加算，币种由桌台所属门店决定、整桌统一、顾客不可切换。
- 需求类型: UX / 前端展示与金额计算 / 文案配置 / 兼容性 / 可访问性。
- 变更面: Functional Requirements、UX Design、Backend/Data（前端数据契约与演示数据口径）、NFR / DFX、Test Cases、Traceability、Open Questions；不涉及: API Design（无对外接口）、Metrics（无新增埋点/看板）；待确认: 无阻塞项（3 项不影响本次交付的技术待设计登记在 Open Questions）。
- 变更面判断依据: 需求文本「支持多币种的展示和加算」；仓库证据 `src/lib/currency.ts`（金额唯一出口）、`src/lib/utils.ts`（历史 `money()` 写死 ¥）、`src/data/menu.ts`（`stores`/`tableStore`，价格裸数字）、`src/components/{MenuView,CartPanel,OrderView,CheckoutView,TopBar}.tsx`（金额展示点）、`src/state/orderReducer.ts`（`BIND_TABLE` 写入 `currency`）、`src/types.ts`（`CartItem.currency`/`AppState.currency`）、`src/i18n.ts`（`currency.*`/`store.*`/`common.coupon`/`checkout.discount_rule`）、`e2e/multi-currency.spec.ts`、`AGENTS.md`「多币种约定」；上游产物 `需求澄清Spec` v1、`PRD 文档` v1、`参考代码与变更说明` v1、`多币种参考实现预览` v1。
- 差异判断: 站点差异 —— 涉及：4 类门店币种不同（A08=CNY、B12=USD、C06=HKD、D03=JPY），是本次需求的判定核心；依据 `src/data/menu.ts` 的 `stores`/`tableStore` 与 `e2e/multi-currency.spec.ts`。产品形态差异（单 React SPA，无原生端）、环境差异（无多环境配置）、版本差异（`main` @ `58ee88a` → 参考实现 `ed2eb1c`）—— 不涉及。
- 本次变更关键信息:
  - 金额收敛到唯一出口 `@/lib/currency`：`formatMoney` 负责展示，`sumLineTotals` 负责逐行四舍五入后加总，`calcDiscount`/`calcPayable` 负责优惠与应付；禁止页面内直接拼符号或各自 `reduce`。
  - 币种只有一个来源：绑定桌台时由门店写入 `state.currency`，条目加入购物车时锁定 `CartItem.currency`，全链路只读，不出现混币加算，不提供切换入口。
  - 优惠「满 100 减 30」与会员券金额按门店币种同面额展示与计算（USD → `$100.00` 减 `$30.00`），文案经 i18n 插值，不写死货币符号。
  - JPY 与 CNY 同为 `¥`，必须通过币种代码（顶栏胶囊、支付成功 aria-label）区分；`?currency=USD|HKD|JPY` 作为预览/E2E 直达入口保留。
  - 未绑定/未知桌台回落 CNY，与改造前行为一致；无持久化订单数据，不涉及数据迁移。
  - 与上游澄清稿 REQ-002.2 存在一处偏差：当前 `formatMoney` 用 `toFixed(2)`，**未实现千分位**（`1234` 输出 `$1234.00` 而非 `$1,234.00`），但代码注释与澄清稿声称有千分位。本 Spec 以仓库现状为验收基线并登记为 OQ-4，Review 需确认是否要求本轮补齐。
- Review 重点: 金额加算口径与明细一致性、优惠同面额口径、混币防护、JPY/CNY 可区分性、千分位偏差（OQ-4）、未绑定桌台回落、双语与夜间/老人模式下金额完整可见。

## Scope Note

- Implemented sections: Functional Requirements、UX Design、Backend/Data、NFR / DFX、Test Cases、Traceability、Open Questions。
- Not involved: API Design（应用无后端业务接口，`server/` 仅健康检查，币种不经接口传输）；Metrics（需求未提出新增埋点或看板）。
- Needs confirmation: 无阻塞项；OQ-1~OQ-3 为接入真实价目/支付前的技术待设计，OQ-4 为文档与实现偏差，均不影响本次前端交付。
- Reason: 上游澄清文档已关闭 5 项业务口径，仓库与参考实现确认变更集中在浏览器端 SPA 的金额格式化、加总、币种状态、门店数据映射、页面展示与 i18n 文案。

---

# Spec: 支持多币种的展示和加算

## 1. Context

输入模式：模式 A（存在上游需求澄清文档）。

- 上游文档：`需求澄清Spec`（`需求设计/需求澄清Spec/PRD 文档.md`）、`PRD 文档`（`需求设计/PRD 文档/PRD 文档.md`）、`参考代码与变更说明`（`需求设计/参考代码与变更说明/参考代码与变更说明`）、`多币种参考实现预览`（`需求设计/多币种参考实现预览/index.html`）。
- 交付上下文：仓库 `seth-zou/GitHub-Restaurant-Order`，基线 `main` @ `58ee88a`，工作分支 `feat/d0971ca8-aoye`，参考实现提交 `ed2eb1c`。背景、目标、范围与业务规则以澄清文档为准，本文只记录 Spec 阶段的增量与最终契约。

Spec 阶段增量（相对澄清文档）：

1. 固化金额展示样式为「符号前缀 + 2 位小数」，千分位按 OQ-4 处理（当前实现未实现千分位，验收以未实现为准，是否补齐待决策）。
2. 固化加算口径：小计 = Σ round(单价, 2) × 数量，最后再 round 到 2 位；明细行金额之和必须等于小计；应付 = 小计 − 优惠，下限钳制 0。
3. 固化币种来源与回落：门店 → 桌台 → `state.currency`，未知/未绑定桌台回落默认门店 CNY。
4. 固化可区分性与文案插值要求：JPY/CNY 靠币种代码区分；优惠与券文案必须通过 i18n 插值，不得写死货币符号。
5. 补充可执行测试用例口径（E2E 用例表 + 边界/异常用例），供下游开发自测与 E2E 节点复用。

## 2. Goals and Non-Goals

- Goals（增量）：所有金额展示点收敛到单一格式化与加算实现；四类门店主流程金额同一币种且合计正确；优惠与活动文案不串币；JPY 与 CNY 可区分。
- 沿用需求澄清文档的目标与非目标。
- Non-Goals（增量）：不实现汇率换算、顾客切换币种、一单多币种、支付渠道集成、后端币种配置中心、按区域独立定价的新规则。

## 3. Glossary

| 术语 | 含义 |
| --- | --- |
| 门店定价币种 | 门店属性，决定该门店所有桌台的展示与结算币种 |
| 整桌币种 | 绑定桌台后确定的唯一币种，写入 `AppState.currency`，全链路只读 |
| 条目币种 | 购物车/订单条目在加入时锁定的币种（`CartItem.currency`），用于防止混币加算 |
| 同面额活动 | 优惠门槛与面额使用门店币种的数字面额，仅替换货币符号（¥100 减 ¥30 → $100 减 $30） |
| 可区分性 | CNY 与 JPY 同为 `¥` 时，必须通过币种代码等非符号信息区分 |
| 金额唯一出口 | `src/lib/currency.ts` 中的 `formatMoney / sumLineTotals / calcDiscount / calcPayable / roundMoney` |

## 4. Functional Requirements

### REQ-001: 绑定桌台确定整桌币种

- User Story: 作为到店顾客，我希望进入点单后系统自动使用本桌门店的币种，以免误看到其他区域的价格。
- Priority: P0
- Description: 绑定桌台时依据桌台所属门店确定整桌币种并写入应用状态；此后所有金额读取该状态，页面不提供任何切换入口。演示映射：A08→星河里(CNY)、B12→海港城(USD)、C06→旺角(HKD)、D03→新宿(JPY)。

Acceptance Requirements (EARS):

- REQ-001.1: When 用户绑定任一桌台，the system shall 将整桌币种设置为该桌台所属门店的定价币种。
- REQ-001.2: The system shall 在菜单、规格弹窗、购物车、订单、结账、支付成功与顶栏中使用同一整桌币种渲染全部金额。
- REQ-001.3: If 桌台未知或未绑定，the system shall 回落到默认门店币种（CNY）且不报错、不阻断点单。
- REQ-001.4: The system shall 不提供顾客可切换币种的交互控件（按钮、下拉或等价控件）。
- REQ-001.5: When 顾客在同一桌台多次加菜，the system shall 为每个条目写入当前整桌币种，不出现混币条目。

Gherkin:

```gherkin
Scenario: 美元门店顾客绑定桌台后看到美元价格
  Given 门店"海港城店"的定价币种为 USD，且其桌台 B12 在首页可选
  When 顾客绑定桌台 B12 并进入点餐视图
  Then 菜单中每道菜的价格以 "$" 前缀展示并保留 2 位小数
  And 顶栏币种胶囊可读到 "USD"
  And 页面不存在可切换币种的控件

Scenario: 未知桌台回落到人民币
  Given 顾客进入的点单状态没有绑定桌台
  When 系统渲染菜单视图
  Then 全部金额以 "¥" 展示
  And 页面不报错，仍可加入购物车
```

### REQ-002: 全站金额统一展示格式

- User Story: 作为顾客，我希望所有金额格式一致，便于核对自己点了多少钱。
- Priority: P0
- Description: 所有金额经 `formatMoney(value, currency)` 输出「货币符号 + 2 位小数」，覆盖菜品列表价、规格弹窗价、购物车明细行/小计/预估合计、订单明细/总额、结账明细/小计/优惠/应付/确认支付按钮、支付成功实付、顶栏购物车金额、会员券金额、优惠规则说明。

Acceptance Requirements (EARS):

- REQ-002.1: The system shall 对所有币种统一保留 2 位小数，包括 JPY。
- REQ-002.2: The system shall 在 CNY/USD/HKD/JPY 下分别使用 `¥`、`$`、`HK$`、`¥` 作为前缀符号。
- REQ-002.3: If 金额为 0（如未达优惠门槛），the system shall 仍以同币种格式展示（如 `-¥0.00`），不省略货币单位。
- REQ-002.4: The system shall 不在组件内直接拼接货币符号或使用 `toFixed` 等自定义格式化。
- REQ-002.5: When 金额绝对值 ≥ 1000，the system shall 按 OQ-4 的决策输出——默认维持当前实现（无千分位，如 `$1234.00`）；若 OQ-4 决策为补齐，则输出 `$1,234.00`。

Gherkin:

```gherkin
Scenario: 港币门店金额格式
  Given 顾客在 HKD 门店点单
  When 顾客查看菜品卡价格
  Then 价格以 "HK$" 前缀展示并保留 2 位小数，如 "HK$68.00"
```

### REQ-003: 同币种加算与合计一致性

- User Story: 作为同桌就餐者，我希望购物车与订单合计准确，能看到自己实付金额。
- Priority: P0
- Description: 小计 = Σ(round(单价, 2) × 数量) 后再 round 到 2 位（`sumLineTotals`）；顶栏购物车金额、购物车小计、订单总额、结账小计使用同一函数。

Acceptance Requirements (EARS):

- REQ-003.1: The system shall 保证结账明细各行金额之和等于菜品小计，且小计与应付使用同一币种。
- REQ-003.2: The system shall 在合计时只累加与整桌币种一致的条目。
- REQ-003.3: When 某条目申请取消且已批准，the system shall 在订单总额与结账小计中排除该条目。
- REQ-003.4: The system shall 对浮点尾数做 2 位四舍五入，使同一数据在购物车、订单、结账三处合计一致。

Gherkin:

```gherkin
Scenario: USD 门店结账金额加算
  Given 顾客在 USD 门店的点单记录为 琥珀嫩牛肉 $42.00 × 2、田园蔬菜拼盘 $28.00、柠檬青桔饮 $18.00
  And 门店活动为满 $100.00 减 $30.00
  When 顾客进入结账视图
  Then 菜品小计展示 "$130.00"
  And 优惠展示 "-$30.00"
  And 应付合计展示 "$100.00"
  And 确认支付按钮文案包含 "$100.00"
```

### REQ-004: 优惠与活动文案随币种同面额

- User Story: 作为顾客，我希望看到本店真实可用的优惠金额，而不是其他币种的面额。
- Priority: P0
- Description: 「满 100 减 30」与会员「含 30 菜品券」在非人民币门店按同面额展示与计算（`DISCOUNT_THRESHOLD=100`、`DISCOUNT_AMOUNT=30`）；优惠额不超过小计。

Acceptance Requirements (EARS):

- REQ-004.1: When 门店币种为 USD，the system shall 展示「菜品满 $100.00 减 $30.00」并在会员弹窗展示「含 $30.00 菜品券」。
- REQ-004.2: When 小计低于门槛 100（同币种面额），the system shall 展示同币种 0 优惠且不扣减应付。
- REQ-004.3: If 优惠面额大于小计，the system shall 将应付下限钳制为同币种 0 值，不出现负数实付。
- REQ-004.4: The system shall 不在任何币种下展示与其不匹配的货币符号（如 USD 门店出现 `¥`）。
- REQ-004.5: The system shall 通过 i18n 插值（`common.coupon`、`checkout.discount_rule`）传入格式化金额，zh/en 两套文案同步。

### REQ-005: JPY 与 CNY 的可区分性

- User Story: 作为日本门店顾客，我希望明确知道账单是日元而非人民币。
- Priority: P1
- Description: JPY 与 CNY 共用 `¥`，必须提供非符号信息。

Acceptance Requirements (EARS):

- REQ-005.1: The system shall 在顶栏币种胶囊中同时展示币种名称与 ISO 代码（如「币种 日元 JPY · ¥」）。
- REQ-005.2: The system shall 为支付成功页实付金额提供包含币种代码的无障碍文本（如 `JPY ¥100.00`）。
- REQ-005.3: If 屏幕阅读器仅能读取金额文本，the system shall 仍能读出币种代码。
- REQ-005.4: The system shall 不只依赖颜色或符号区分币种。

### REQ-006: 双语与跨模式一致

- User Story: 作为双语用户或夜间/老人模式用户，我希望切换语言或模式后价格语义不变。
- Priority: P1
- Description: 金额与币种不随语言、主题、老人模式改变；文案插值使用同一金额格式化结果。

Acceptance Requirements (EARS):

- REQ-006.1: When 用户在中/英间切换语言，the system shall 保持整桌币种、金额数值与格式不变。
- REQ-006.2: The system shall 在浅色、深色与老人模式下保持价格与币种胶囊完整可见（不截断、不被遮挡）。
- REQ-006.3: If 语言为英文，the system shall 使用英文文案（如 `Includes $30.00 dish coupon`、`Dishes over $100.00 get $30.00 off`）并保持同一金额格式。

## 5. UX Design

### 5.1 体验目标与设计原则

- 沿用设计系统 `boiling-point-order` 的视觉语言（暖纸底、白卡、辣红用于价格等决策信息、琥珀色用于进度与提示），本次不新增设计 token、不改主题。
- 币种“只读可见”：不提供切换控件，但顶栏以低干扰方式表达币种来源，避免顾客误以为可改价。
- 不新增独立页面或弹层；所有变化落在既有卡片与列表内。

### 5.2 页面 / 模块影响面

| 模块 | 位置 | 变化 | 类型 |
| --- | --- | --- | --- |
| `HomeView` | 桌台卡片 | 展示各桌台所属门店（可推断币种），不展示具体金额 | 影响页面（文案） |
| `WelcomeView` | 进入点餐提示 | 绑定后 `lastMessage` 带桌台，币种由状态决定 | 仅说明 |
| `MenuView` | 菜品卡价格、规格弹窗价格 | 改为门店币种格式化；加购条目写入 `currency` | 影响页面 |
| `CartPanel` | 明细行、菜品小计、预估合计（桌面侧栏 + 移动端弹层） | 改用 `formatMoney` + `sumLineTotals` | 影响页面 |
| `OrderView` | 明细行金额、订单总额 | 改用统一加总与格式化 | 影响页面 |
| `CheckoutView` | 明细、小计、优惠（含规则说明）、应付、确认支付按钮、支付成功实付 | 全部币种化；实付 aria-label 含币种代码 | 影响页面 |
| `App` | 顶栏/移动端购物车按钮金额；`?currency=` 预览直达 | 币种化；预览预置 Mock 订单 | 影响页面 |
| `TopBar` | 币种胶囊；会员弹窗菜品券金额 | 只读币种说明（名称 + ISO 代码 + 符号）；券金额随币种 | 影响页面 |
| `i18n` | `common.coupon`、`checkout.discount_rule`、`currency.*`、`store.*` | 插值化，去掉写死 `¥30` | 影响页面（文案） |

### 5.3 核心体验路径与分支路径

- 主路径：首页选择桌台 → 进入点餐（顶栏出现币种胶囊）→ 菜单看价 → 加购（侧栏/弹层）→ 提交订单（订单总额）→ 结账（小计/优惠/应付）→ 确认支付 → 支付成功（实付）。
- 分支路径：
  - 未达优惠门槛：优惠行展示 `-<币种>0.00`，应付 = 小计。
  - 未知/未绑定桌台：回落 CNY，流程不中断。
  - 深链接/预览：`?currency=USD|HKD|JPY` 直接进入对应门店币种的目标视图，等价于绑定对应桌台。
  - 取消申请已批准：该条目从不计入合计。
  - 语言切换：文案切换，金额与币种不变。

### 5.4 交互与状态说明

- 币种胶囊：位于顶栏桌台信息右侧，`sm` 断点以上展示；内容为「币种 <地名称> <ISO 代码> · <符号>」；`title` 为「<门店> 门店定价，整桌按该币种展示与加总，不可自行切换」。不做可点击控件。
- 优惠行：`会员菜品券` 后追加小号次级文字规则说明「菜品满 $100.00 减 $30.00」；优惠值带 `-` 前缀。
- 金额颜色：价格与应付保持辣红强调；优惠同为强调色但带负号；辅助说明用次级文字色。禁止用颜色单独表达币种。
- 金额不换行、不被截断；长金额（≥1000）在窄屏下允许缩小字号但保持完整显示。

### 5.5 关键文案

| Key | 中文 | 英文 |
| --- | --- | --- |
| `currency.label` | 币种 | Currency |
| `currency.CNY/USD/HKD/JPY` | 人民币 CNY / 美元 USD / 港币 HKD / 日元 JPY | Chinese Yuan CNY / US Dollar USD / Hong Kong Dollar HKD / Japanese Yen JPY |
| `currency.hint_store` | {{store}} 门店定价，整桌按该币种展示与加总，不可自行切换 | Priced by {{store}}; the whole table shows and adds up in this currency and cannot be switched |
| `store.*` | 沸点 · 星河里店 / 海港城店 / 旺角店 / 新宿店 | Boiling Point · Xingheli / Harbour City / Mong Kok / Shinjuku |
| `common.coupon` | 含 {{amount}} 菜品券 | Includes {{amount}} dish coupon |
| `checkout.discount_rule` | 菜品满 {{threshold}} 减 {{amount}} | Dishes over {{threshold}} get {{amount}} off |

## 6. Backend/Data

> 本应用业务逻辑全部在浏览器内存中运行，`server/` 仅为健康检查；本节定义前端数据契约与演示数据口径，不涉及服务端存储、接口或迁移。

| 对象 | 变化 | 说明 |
| --- | --- | --- |
| `CurrencyCode` | 新增类型 | `'CNY' \| 'USD' \| 'HKD' \| 'JPY'`，从 `src/lib/currency.ts` 导出并由 `src/types.ts` 转出 |
| `CurrencyMeta` / `CURRENCIES` | 新增 | 每币种 `code / symbol / numeric / labelKey`；`numeric` 用于辅助文本 |
| `isCurrencyCode` | 新增 | 外部输入（如 URL `?currency=`）校验守卫，非法值不生效 |
| `CartItem.currency` | 新增必填 | 加入购物车时锁定整桌币种 |
| `AppState.currency` | 新增必填 | 初始值与 `BIND_TABLE` 时由门店决定，全链路只读 |
| `stores` / `tableStore` | 新增 | 桌台 → 门店 → 定价币种（A08/B12/C06/D03），演示数据 |
| `getStoreByTable` / `getCurrencyByTable` / `getStoreByCurrency` | 新增 | 未知桌台回落 `stores[0]`（CNY）；币种反查门店用于预览 |
| `DISCOUNT_THRESHOLD` / `DISCOUNT_AMOUNT` | 新增常量 | 100 / 30，同面额使用，不随币种换算 |
| `formatMoney` / `roundMoney` / `sumLineTotals` / `calcDiscount` / `calcPayable` / `describeMoney` | 新增 | 金额唯一出口 |
| `money()` | 降级为兼容别名 | 默认 CNY，转发 `formatMoney`；新代码不得使用 |
| `?currency=` 预览 | 新增行为 | `USD|HKD|JPY|CNY` 预置对应门店桌台与 Mock 订单，直达 `#/menu`、`#/order`、`#/checkout` |

数据兼容：

- 无持久化订单/购物车数据（仅内存态），不涉及历史数据迁移或回填。
- `localStorage` 仅保存 `i18nextLng`、`elderly-mode`、`theme-mode`，本次不新增键、不改变既有语义。
- 未知/未绑定桌台回落 CNY，保证既有入口与既有 E2E 行为不变。

## 7. NFR / DFX

| 类别 | 要求 | 验收方法 |
| --- | --- | --- |
| 正确性 | 明细之和 = 小计；应付 = 小计 − 优惠；优惠 ∈ [0, 小计] | E2E MC-005/MC-006 + 边界用例 MC-010/MC-011 |
| 浮点稳定 | 逐行四舍五入到 2 位后再累加，避免 `0.1+0.2` 类尾数 | E2E 金额文本精确断言；代码评审确认仅一个加总出口 |
| 兼容性 | 未绑定/未知桌台回落 CNY；既有 33 条 E2E 全部通过 | `npx playwright test` 全量通过 |
| 可访问性 | 支付成功实付金额 aria-label 含币种代码；胶囊有可读 title；对比度与焦点不降级 | E2E MC-004/MC-009 + 夜间模式既有用例 |
| 可维护性 | 金额格式化与加总只有一个出口，禁止分散 `reduce` 与硬编码符号 | `npm run lint`（`--max-warnings 0`）零警告 + 代码评审 |
| 性能 | 纯前端纯函数计算，不引入网络请求，首屏无明显影响 | `npm run build` 通过，bundle 无显著增长 |
| 国际化 | zh/en 文案同步；金额不随语言变化；i18n 不写死货币符号 | E2E MC-009 + 文案扫描 |

## 8. Test Cases

### 8.1 E2E（已实现于 `e2e/multi-currency.spec.ts`）

| 用例 | 覆盖 REQ | 场景 | 预期 |
| --- | --- | --- | --- |
| MC-001 | REQ-001、REQ-002 | 绑定 A08（CNY） | 菜单金额 `¥`，无 `$`/`HK$`；胶囊含 CNY |
| MC-002 | REQ-001、REQ-003 | 绑定 B12（USD）并加购 | 胶囊含 USD；购物车 `$68.00`；购物车无 `¥` |
| MC-003 | REQ-002 | 绑定 C06（HKD） | 胶囊含 HKD；展示 `HK$68.00` |
| MC-004 | REQ-002、REQ-005 | 绑定 D03（JPY） | 胶囊含 JPY；金额 `¥68.00`（2 位小数） |
| MC-005 | REQ-003、REQ-004 | `?currency=USD#/checkout` | 小计 `$130.00`、优惠 `-$30.00`、应付 `$100.00`；确认支付按钮含 `$100.00` |
| MC-006 | REQ-003、REQ-004 | 四币种结账页 | 单张账单只出现一种币种符号 |
| MC-007 | REQ-004 | B12 会员弹窗 | 「含 $30.00 菜品券」 |
| MC-008 | REQ-001.4 | C06 任意页面 | 无切换币种按钮 / 无 `combobox` |
| MC-009 | REQ-006 | `?currency=HKD#/checkout` 切换英文 | 标题 `Review Your Bill`，金额仍为 `HK$130.00` |

### 8.2 待补充用例（下游实现/测试节点必做）

| 用例 | 覆盖 REQ | 类型 | 场景 | 预期 |
| --- | --- | --- | --- | --- |
| MC-010 | REQ-004.2 | 边界 | `?currency=USD#/checkout` 且小计 < 100（如仅 1 项） | 优惠 `-$0.00`，应付 = 小计，支付按钮金额一致 |
| MC-011 | REQ-003.4 | 正确性 | 单价含小数的条目 × 非整数数量或多行累加 | 明细行之和与页面小计逐分一致，无浮点尾数 |
| MC-012 | REQ-001.3 | 异常 | 直接访问 `#/menu`（未绑定桌台） | 全部金额 `¥`，可正常加购，无报错 |
| MC-013 | REQ-001.3 | 异常 | 访问 `?currency=XXX#/menu`（非法币种） | 回落 CNY，不白屏、不报错 |
| MC-014 | REQ-002.5 | 边界 | 金额 ≥ 1000（如数量放大） | 按 OQ-4 决策输出；无截断、无换行错位 |
| MC-015 | REQ-006.2 | 兼容 | HKD 门店切换夜间模式 + 老人模式 | 价格、优惠、应付、币种胶囊完整可见 |
| MC-016 | REQ-005.1 | 可访问性 | JPY 结账页读取实付元素 aria-label | 文本包含 `JPY` 与金额 |
| MC-017 | REQ-001.5 | 数据一致性 | 同一桌台连续加购 3 个条目后提交订单 | 所有条目 `currency` 与 `state.currency` 一致，订单总额 = 购物车小计 |
| MC-018 | REQ-003.3 | 分支 | 订单条目取消获批准后查看结账 | 该条目不计入明细与合计 |

回归范围：`e2e/super-spicy.spec.ts`、`e2e/theme-mode.spec.ts`、`e2e/view-routing.spec.ts` 共 33 条既有用例必须全绿；合计目标 42 条（既有 + MC-001~MC-009），新增 MC-010~MC-018 后目标 ≥ 51 条。

### 8.3 非自动化检查

- 文案扫描：`src/i18n.ts` 的 zh/en 中不得出现写死的 `¥30`、`$30` 等金额字面量，只保留插值占位。
- 代码扫描：`src/` 下除 `lib/currency.ts` 与 `lib/utils.ts`（兼容别名）外，不出现 `toFixed` 或拼接货币符号。

## Open Questions

| ID | 问题 | 影响 | 建议负责人 | 是否阻塞 |
|---|---|---|---|---|
| OQ-1（TD-1） | 真实门店价目是各区域独立定价，还是同数字面额仅换符号？当前演示为后者 | 接入真实价目后金额与优惠口径 | PM | 否 |
| OQ-2（TD-2） | 生产环境「桌台 → 门店 → 币种」的权威数据来源与同步时机；当前为前端静态映射 | 币种来源正确性、新增门店效率 | RD | 否 |
| OQ-3（TD-3） | 真实支付渠道对多币种与 JPY 2 位小数的支持边界 | 支付金额传参与对账 | RD | 否 |
| OQ-4 | 千分位：澄清稿 REQ-002.2 与代码注释要求 `$1,234.00`，当前 `formatMoney` 使用 `toFixed(2)` 实际输出 `$1234.00`。是否本轮补齐？建议：本轮按现状验收、在 Spec 记为已知偏差，下一迭代统一补齐（避免与 E2E 现断言冲突） | 金额展示一致性、E2E 断言 | PM / RD | 否（影响 REQ-002.5 验收口径，需在本轮 Review 决策） |

## Traceability

| REQ | 页面/模块 | 代码 | E2E / 用例 |
| --- | --- | --- | --- |
| REQ-001 | 桌台绑定、顶栏、全链路 | `src/data/menu.ts`、`src/state/orderReducer.ts`、`src/App.tsx`、`src/components/TopBar.tsx` | MC-001、MC-002、MC-008、MC-012、MC-013、MC-017 |
| REQ-002 | 全站金额展示 | `src/lib/currency.ts`、`src/lib/utils.ts` | MC-001~MC-004、MC-014 |
| REQ-003 | 购物车、订单、结账 | `src/lib/currency.ts`、`src/components/{CartPanel,OrderView,CheckoutView}.tsx` | MC-002、MC-005、MC-006、MC-011、MC-018 |
| REQ-004 | 结账优惠、会员弹窗、文案 | `src/lib/currency.ts`、`src/components/{CheckoutView,TopBar}.tsx`、`src/i18n.ts` | MC-005、MC-006、MC-007、MC-010 |
| REQ-005 | 顶栏胶囊、支付成功 | `src/components/{TopBar,CheckoutView}.tsx` | MC-004、MC-016 |
| REQ-006 | 全部视图 | `src/i18n.ts`、`src/index.css`（主题映射） | MC-009、MC-015 |
| NFR：兼容/维护 | 构建与静态检查 | `package.json`、`playwright.config.ts` | `npm run lint`、`npm run build`、全量 `npx playwright test` |
