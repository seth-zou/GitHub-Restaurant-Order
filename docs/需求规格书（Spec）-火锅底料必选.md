# Review Summary

- 本次需求: 在沸点火锅点单 SPA 的点餐流程中新增「火锅底料」必选环节——进入点餐即须确认 1（单锅）～2（双拼）种底料，未确认时阻断提交与结账，底料在购物车、订单详情、结账一致展示且只计一次价。
- 需求类型: UX / 点餐主流程约束 / 前端内存态数据建模 / i18n / 兼容性。
- 变更面: Functional Requirements、UX Design、Backend/Data、NFR / DFX、Test Cases、Open Questions、Traceability；不涉及: API Design、Metrics；待确认: 儿童模式与底料必选的叠加口径（非阻塞，已按保守策略收敛，见 OQ-001）。
- 变更面判断依据: 用户需求原文；上游「需求澄清Spec」「PRD 文档」「PRD 文档 HTML」「参考代码变更说明」；仓库 `repos/seth-zou_GitHub-Restaurant-Order`（工作分支 `feat/9bf31347-qolz` @ `e664341`）中的 `src/types.ts`、`src/data/menu.ts`、`src/lib/hotpot.ts`、`src/state/orderReducer.ts`、`src/App.tsx`、`src/components/HotpotBaseDialog.tsx`、`src/components/HotpotBaseSummary.tsx`、`src/components/CartPanel.tsx`、`src/components/OrderView.tsx`、`src/components/CheckoutView.tsx`、`src/components/MenuView.tsx`、`src/components/ui/dialog.tsx`、`src/i18n.ts`、`e2e/*`；仓库 `AGENTS.md`。仓库为纯前端 SPA（`server/` 仅健康检查），无后端业务接口。
- 差异判断: 产品形态 / 站点 / 环境 / 版本差异——涉及「版本差异」；依据为 `origin/main`（`1a5f184`，已合入儿童模式）新增 `useChildMode`、`isSpicyForChildren`、`MenuView` 隐藏超辣菜品，而本分支基线为 `58ee88a`，不含儿童模式。本 Spec 对「儿童模式 × 底料必选」给出保守口径并列入 Review 重点；不涉及原生端、多站点或后端版本分支（单仓 React SPA、hash 路由、GitHub Pages 子路径部署）。
- 本次变更关键信息:
  - **新增**：`HotpotBaseSelection { productId, spec }`；`AppState.hotpotBases`（本桌当前底料）与 `AppState.orderBases`（已随订单提交的底料）；`AppAction.SET_HOTPOT_BASES`；`Product.isHotpotBase?`；`src/lib/hotpot.ts` 领域工具；底料弹窗与底料汇总组件。
  - **新增约束**：存在可售底料时，未确认 1～2 种可售底料不得提交订单、不得进入结账；首次进入 `#/menu` 自动弹出且不可跳过；取消后只解除阻断来源、不清空菜品。
  - **范围决策**：底料数据与价格完全复用现有商品（`p1 ¥68`、`p2 ¥59`），不新建底料价表；底料**不写入订单行**，只存 `orderBases` 并在账单中以汇总项计入一次；全部底料售罄时显式降级为不阻塞。
  - **重要风险**：必选锁与 Dialog 关闭耦合（易残留透明遮罩吞点击）；StrictMode 下草稿被 effect 覆盖（脏数据）；底料既入订单行又入汇总（重复计价）。三者均已有对应 REQ 与 Test Case 覆盖。
  - **待确认**：儿童模式下是否过滤超辣底料（`p2 牛油麻辣锅`）以及是否仍强制选底料（OQ-001）。
- Review 重点:
  - Scope：仅约束点餐/购物车/订单/结账/菜单底料卡与 i18n，不含 `server/`、支付渠道、真实库存服务。
  - REQ：REQ-001～REQ-010 的 EARS 与 Gherkin 是否可作为开发与 E2E 的最终契约。
  - Data contract：`hotpotBases` / `orderBases` 的语义差异（本桌当前 vs 已提交）与「底料不入订单行」的计价口径。
  - 兼容：既有 `super-spicy.spec.ts`、`theme-mode.spec.ts`、`view-routing.spec.ts` 因「进入点餐需先完成底料」而必须同步适配。
  - 版本差异：儿童模式合并后的叠加口径（OQ-001）。

## Scope Note

- Implemented sections: Functional Requirements、UX Design、Backend/Data、NFR / DFX、Test Cases、Open Questions、Traceability。
- Not involved: API Design、Metrics。
- Needs confirmation: 儿童模式与底料必选的叠加口径（OQ-001，非阻塞）；全部底料售罄降级口径的真实门店是否接受（OQ-002，非阻塞）。
- Reason: 上游澄清文档与 PRD 已给出业务契约，仓库证据确认变更集中于前端组件、reducer 内存态、商品数据与 E2E，无后端、对外 API 或埋点变更。

---

# Spec: 需求规格书（Spec）— 点餐流程新增火锅底料必选环节

## 1. Context

- 上游输入：《需求澄清：点餐流程新增火锅底料必选环节》（`SPEC-HOTPOT-BASE-REQUIRED-001`）、《PRD 文档 · 点餐流程新增火锅底料必选环节》（`PRD-HOTPOT-BASE-REQUIRED-001`）、《参考代码变更说明》。背景、目标、用户场景、范围与业务规则（BR-1～BR-11）以澄清文档为准，本文只写 Spec 阶段增量与最终契约。
- 目标仓库：`seth-zou/GitHub-Restaurant-Order`（沸点火锅点单 React SPA 概念演示，业务逻辑全部在浏览器内存中运行）。基线 `main` @ `58ee88a`，工作分支 `feat/9bf31347-qolz` @ `e664341`。
- 现状证据：改前底料只是普通商品（`p1`、`p2`，分类 `menu.cat.broth`），用户可完全不选底料直接提交订单，后厨无法开锅。

本 Spec 相对澄清文档 / PRD 的增量（不重复其背景与业务规则）：

1. 把 PRD 的 9 条 REQ 收敛为可测契约，并补齐 PRD 未单独成条的边界：**空选择确认不关闭弹窗**、**已选满 2 种时的替换语义**、**取消底料后不自动重弹**、**底料校验在 reducer 层的兜底拦截**。
2. 关闭澄清文档 TD-1、TD-2：底料采用「独立字段 `hotpotBases` / `orderBases` + 商品 `isHotpotBase` 标记」方案；可见于本分支实现，与 PRD §4.4 数据契约一致，不再作为候选方向遗留。
3. **修正** PRD / 参考代码变更说明中的「驱动关系」措辞：本分支实际以 `hotpotBases` 驱动订单与结账展示（订单详情为 `bases={orderBases.length ? hotpotBases : orderBases}`，结账读 `orderBases`），因此「更换底料即同步订单详情」成立，但「取消后订单仍保留已提交底料」不成立——取消后订单详情展示未选择并提示重选。本文以仓库实际行为为契约（见 REQ-006、REQ-010）。
4. 新增 **REQ-010：提交后底料变更的账单一一致性**，明确「提交后更换底料立即反映到订单详情与结账」，填补澄清文档 BR-9 与实现之间的口径空隙。
5. 新增对本分支 **既有 E2E 用例条件变化** 的说明：底料成为进入点餐的前置条件后，`super-spicy.spec.ts`、`theme-mode.spec.ts`、`view-routing.spec.ts` 必须先完成底料必选（见 NFR-002、TC-015）。
6. 记录 **版本差异**：`origin/main` 已合入儿童模式（隐藏超辣菜品），本分支基线不含该能力；合并时需按 OQ-001 复核。

## 2. Goals and Non-Goals

沿用《需求澄清》与 PRD 的目标与非目标，Spec 级增量收窄如下：

- Goals：
  - 把「必选触发时机、可选数量、阻断入口、展示一致、取消重选、售罄联动、菜单卡入口、i18n/可访问性」固化为唯一可测契约（REQ-001～REQ-010）。
  - 明确「底料不计入订单行、账单只计一次」的计价口径与验证样例（¥42 + ¥68 − ¥30 = ¥80）。
- Non-Goals：
  - 不新增底料商品/口味数据、不做独立底料价表，不做按人拆分底料。
  - 不新增后端接口、持久化、真实库存与支付渠道改造；不改 `server/`。
  - 不做已提交订单的「服务员审核式底料变更」，不做底料与儿童模式的过滤规则实现（留待 OQ-001 决议）。

## 3. Glossary

| 术语 | 含义 |
|---|---|
| 火锅底料 / 底料 | 开锅所需的锅底商品；当前为 `p1 鎏金番茄鸳鸯锅`（¥68）与 `p2 牛油麻辣锅`（¥59），由 `Product.isHotpotBase === true` 标记 |
| 可售底料 | 未出现在 `AppState.soldOut` 中的底料商品 |
| 单锅 / 双拼 | 选择 1 种底料为单锅；选择 2 种为双拼，展示追加「双拼」标识 |
| 必选锁（required） | 首次进入点餐页的弹窗处于必选态：无关闭按钮，Esc / 遮罩 / 关闭均不放行 |
| `hotpotBases` | 本桌点餐会话当前生效的底料，驱动购物车、订单详情与提交校验 |
| `orderBases` | 最近一次提交订单时的底料快照，结账页据此展示与计价 |
| 底料汇总 | `HotpotBaseSummary` 组件在购物车 / 订单详情复用的只读展示块（`data-testid="hotpot-base-summary"`） |
| 阻断提示 | 中性引导式提示（琥珀色 + 「必选」徽标 +「请先选择火锅底料」），非辣红高风险警示 |

## 4. Functional Requirements

### REQ-001: 进入点餐页自动弹出底料必选环节

- User Story: 作为到店扫码点餐的用户，我希望进入点餐页时先确认锅底，以便后续菜品与履约都基于已确定的锅底进行。
- Priority: P0
- Description: 当存在至少一种可售底料时，用户进入 `#/menu`（含欢迎页「进入点餐」、深链接首次进入）自动打开底料选择弹窗并处于必选态。弹窗无关闭按钮，Esc、点击遮罩、关闭操作均不放行；未选择任何底料点击确认时，保持弹窗打开并展示明确提示。

Acceptance Requirements (EARS):

- REQ-001.1: When 存在至少一种可售底料且用户首次进入 `#/menu`，the system shall 自动打开底料选择弹窗并标记「必选」。
- REQ-001.2: While 弹窗处于首次必选态，the system shall 不渲染关闭按钮，且 Esc 与遮罩点击不改变弹窗可见性与当前选择。
- REQ-001.3: When 用户在未选择任何底料时点击确认，the system shall 保持弹窗打开并以可被读屏感知的提示输出「请至少选择 1 种火锅底料后再继续」。
- REQ-001.4: When 用户确认 1～2 种可售底料，the system shall 关闭弹窗、回落菜单浏览，并给出「底料已确认，可以开始点餐」反馈。
- REQ-001.5: If 自动弹出仅针对首次进入，则用户主动取消底料后再次停留在 `#/menu` 时，the system shall 不自动重复弹窗，而以阻断提示引导重新选择。

Gherkin:

```gherkin
Scenario: 进入点餐页必须完成底料选择
  Given 本桌已绑定桌台且尚未选择底料
  And 至少有一种可售底料
  When 用户从欢迎页点击"进入点餐"
  Then 自动出现底料必选弹窗且无关闭按钮
  When 用户按 Esc 或点击遮罩
  Then 弹窗保持打开且选择不变
  When 用户不选底料直接点击"确认底料，开始点餐"
  Then 弹窗保持打开并提示"请至少选择 1 种火锅底料后再继续"
  When 用户选择"鎏金番茄鸳鸯锅"并确认
  Then 弹窗关闭且可以浏览菜单
```

### REQ-002: 底料选项来源、数量规则与双拼

- User Story: 作为同桌就餐的一组用户，我希望选择一种或两种底料，以满足单锅或鸳鸯锅的需求，并清楚看到价格。
- Priority: P0
- Description: 底料列表来自现有商品数据（`hotpotBases = products.filter(p => p.isHotpotBase)`），展示图片、名称、描述、口味标签（如有）与正价。可选 1 种（单锅）或 2 种（双拼）；两种以上不允许确认；再次点击已选项即取消该选择；已选满 2 种后点击第三种时替换第 2 项（保持「最后选择生效」）。弹窗实时展示「已选 N 种底料」与合计金额。

Acceptance Requirements (EARS):

- REQ-002.1: The system shall 仅将 `isHotpotBase` 为真的商品作为可选底料，并使用其菜单价格计价。
- REQ-002.2: When 用户选择底料，the system shall 实时更新已选数量与合计（如选择 `p1` + `p2` 展示「已选 2 种底料」与「¥127.00」）。
- REQ-002.3: When 用户已选 2 种底料后点击第 3 种底料（当前数据仅 2 种底料，此规则为数据扩展后的行为契约），the system shall 以新底料替换已选中的第 2 项，并保持总数为 2，不产生 3 种并存。
- REQ-002.4: When 用户再次点击已选底料，the system shall 取消该底料选择并同步数量与合计。
- REQ-002.5: When 已确认 2 种底料，the system shall 在汇总中展示「A + B · 双拼」，单锅则不展示双拼标识。
- REQ-002.6: If 选项存在无法售出的商品，the system shall 置灰并标注售罄，不可被选择。

Gherkin:

```gherkin
Scenario: 单选与双拼
  Given 用户在底料必选弹窗中
  When 用户选择"鎏金番茄鸳鸯锅"
  Then 弹窗展示"已选 1 种底料"与"¥68.00"
  When 用户再选择"牛油麻辣锅"
  Then 弹窗展示"已选 2 种底料"与"¥127.00"
  When 用户取消"鎏金番茄鸳鸯锅"并重新选中
  Then 已选数量仍为 2
```

### REQ-003: 未选底料时阻断提交订单

- User Story: 作为门店，我要求没有底料的订单不可进入后厨，以避免无法开锅。
- Priority: P0
- Description: 存在可售底料时，「确认并提交订单」以「本桌已确认 1～2 种可售底料」为前置条件。未满足时停留 `#/menu`、保留已添加菜品、展示阻断提示，不产生订单。reducer 层对 `SUBMIT_ORDER` 做兜底拦截（无底料或无菜品时直接返回原状态）。

Acceptance Requirements (EARS):

- REQ-003.1: When 未确认底料且购物车有菜品，用户点击「确认并提交订单」，the system shall 停留 `#/menu`、保持购物车不变并展示「请先选择火锅底料」。
- REQ-003.2: When 底料被取消后用户再次尝试提交，the system shall 不清空菜品、不进入订单页，并继续展示阻断提示。
- REQ-003.3: If 渲染层校验被绕过（例如直接派发 `SUBMIT_ORDER`），then the system shall 在状态层拒绝生成订单，`view` 与 `orderItems` 保持不变。
- REQ-003.4: While 底料有效且购物车非空，the system shall 允许提交并在 `orderBases` 中记录本次底料快照。

Gherkin:

```gherkin
Scenario: 缺底料提交被阻断
  Given 用户已在购物车加入"琥珀嫩牛肉"
  When 用户通过"更换"取消底料
  Then 购物车展示"请先选择火锅底料"
  When 用户点击"确认并提交订单"
  Then 地址仍为 #/menu
  And 阻断提示可见
  And 购物车中的"琥珀嫩牛肉"仍在
```

### REQ-004: 未选底料时阻断进入结账与支付

- User Story: 作为结账用户，我不希望为一口没有锅底的锅付钱。
- Priority: P0
- Description: 「去结账」入口与「确认支付」按钮同样受底料有效性约束：底料缺失时不得进入结账；若在结账页缺失底料，支付按钮禁用并展示提示。

Acceptance Requirements (EARS):

- REQ-004.1: When 底料无效，用户触发「去结账」，the system shall 停留在当前视图并展示阻断提示。
- REQ-004.2: If 结账页检测到底料缺失，then the system shall 禁用「确认支付」并展示「请先选择火锅底料」。
- REQ-004.3: When 用户取消底料后重新选择并确认，the system shall 恢复结账与支付入口。

Gherkin:

```gherkin
Scenario: 结账页缺底料不可支付
  Given 用户处于订单详情并已取消底料
  When 用户点击"去结账"
  Then 不进入结账页并展示阻断提示
```

### REQ-005: 购物车、订单详情、结账展示一致且只计一次价

- User Story: 作为用户，我希望在任意环节都能核对锅底名称、规格与金额。
- Priority: P0
- Description: 三处展示同一份「火锅底料」信息：名称（双拼时带标识）、规格副行（口味 / 辣度 / 风险确认）、金额与更换入口；未选择时展示中性引导面板 + 「必选」徽标 + 阻断文案。账单小计 = 菜品合计 + 底料合计，底料不计入订单行。

Acceptance Requirements (EARS):

- REQ-005.1: While 底料已确认，the system shall 在购物车与订单详情的底料汇总中展示的名称、规格与金额一致。
- REQ-005.2: When 用户完成下单并进入结账，the system shall 在结账页展示底料名称，并计入小计一次（不重复生成底料明细行）。
- REQ-005.3: The system shall 使账单小计 = 菜品合计 + 底料合计；示例：琥珀嫩牛肉 ¥42 + 底料 ¥68 = 小计 ¥110，满减 ¥30，应付 ¥80。
- REQ-005.4: When 底料未选择，the system shall 在购物车与结账以中性引导面板展示「必选」徽标与「请先选择火锅底料」，不将其渲染为高风险警示色。

Gherkin:

```gherkin
Scenario: 三处展示一致且金额只计一次
  Given 用户已确认底料"鎏金番茄鸳鸯锅"(¥68)
  And 购物车中有"琥珀嫩牛肉"(¥42)
  When 用户提交订单并进入结账
  Then 订单详情展示"鎏金番茄鸳鸯锅"
  And 结账页展示"鎏金番茄鸳鸯锅"且小计为 ¥110.00
  And 应付金额为 ¥80.00
```

### REQ-006: 更换、取消与重新选择

- User Story: 作为用户，我希望在下单前后都能调整锅底，并清楚知道取消后无法提交。
- Priority: P0
- Description: 已确认底料后可通过「更换」打开编辑弹窗（可「暂不修改」关闭、可「保存底料」更新、可「取消底料」清空）。取消底料不清空菜品，订单详情与结账随即展示未选择并提示重选；重新选择并确认后恢复可提交、可结账状态。

Acceptance Requirements (EARS):

- REQ-006.1: When 用户在购物车或订单详情点击「更换」，the system shall 打开编辑弹窗并预填当前已选底料。
- REQ-006.2: When 用户在编辑弹窗选择「取消底料」，the system shall 清空本桌底料并关闭弹窗，同时保留购物车与订单中的菜品。
- REQ-006.3: When 底料被取消，the system shall 在订单详情与结账展示「未选择底料」并提供「选择底料」入口。
- REQ-006.4: When 用户在编辑弹窗点击「暂不修改」，the system shall 保持原底料不变并关闭弹窗。
- REQ-006.5: When 用户更换为另一种底料并确认，the system shall 使旧底料不再展示，订单详情与结账仅展示新底料。

Gherkin:

```gherkin
Scenario: 已提交订单取消后重选
  Given 用户已提交订单且底料为"鎏金番茄鸳鸯锅"
  When 用户在订单详情点击"更换"并选择"取消底料"
  Then 底料汇总展示"未选择底料"
  And 订单菜品仍在
  When 用户点击"选择底料"并选择"牛油麻辣锅"后确认
  Then 底料汇总仅展示"牛油麻辣锅"
```

### REQ-007: 售罄联动

- User Story: 作为门店，我希望售罄的底料不会进入订单。
- Priority: P1
- Description: 复用既有售罄开关（演示控制台）。已选底料变为售罄时自动清空该选择并提示「所选底料已售罄，请重新选择」，提交与结账保持阻断；弹窗内售罄底料置灰、标注售罄且不可选。

Acceptance Requirements (EARS):

- REQ-007.1: When 已选底料被标记为售罄，the system shall 清空本桌底料并输出「所选底料已售罄，请重新选择」。
- REQ-007.2: When 底料因售罄被清空，the system shall 保持提交与结账阻断，并展示阻断提示。
- REQ-007.3: While 底料售罄，the system shall 在弹窗中使其不可选择，并以文字标识（非仅颜色）说明售罄。
- REQ-007.4: If 全部底料均售罄，then the system shall 展示「今日底料已暂售，请呼叫服务员协助」且不因必选导致无法点餐（显式降级，不阻塞提交）。

Gherkin:

```gherkin
Scenario: 已选底料售罄
  Given 用户已确认底料"鎏金番茄鸳鸯锅"
  When 在演示控制台将其设为售罄
  Then 提示"所选底料已售罄，请重新选择"
  And 底料汇总展示"请先选择火锅底料"
  And 提交仍被阻断
```

```gherkin
Scenario: 全部底料售罄
  Given 全部底料均被标记为售罄
  When 用户进入点餐页
  Then 弹窗展示"今日底料已暂售"
  And 用户仍可提交订单
```

### REQ-008: 菜单中底料商品卡的入口语义

- User Story: 作为从"锅底"分类浏览的用户，我希望理解该商品属于必选环节，而不是普通加购菜品。
- Priority: P1
- Description: 底料卡片展示「请通过『火锅底料』环节选择」提示，按钮打开规格弹窗（口味 / 辣度 / 超级辣风险确认仍生效）；规格弹窗主按钮为「确认并去选底料」，不提供「加入本桌购物车」；确认后转入底料环节并携带所选规格。底料卡片不再直接加购。

Acceptance Requirements (EARS):

- REQ-008.1: While 展示底料商品卡，the system shall 展示「请通过『火锅底料』环节选择」提示。
- REQ-008.2: When 用户在底料规格弹窗确认，the system shall 打开底料环节并携带所选规格（含辣度与风险确认文案）。
- REQ-008.3: The system shall 不在底料规格弹窗中提供直接加入购物车的入口。
- REQ-008.4: When 底料卡片处于已选状态，the system shall 在卡片上以「更换」标识取代「选择底料」。

Gherkin:

```gherkin
Scenario: 底料卡片转入底料环节
  Given 用户已进入点餐页并完成底料确认
  When 用户在"锅底"分类点击"鎏金番茄鸳鸯锅"卡片按钮
  Then 规格弹窗展示"确认并去选底料"且无"加入本桌购物车"
  When 用户选择"超级辣"并确认
  Then 底料汇总展示"超级辣"与"客户已确认风险"
```

### REQ-009: 双语、可访问性与主题兼容

- User Story: 作为英文用户或使用读屏 / 键盘 / 老人模式 / 夜间模式的用户，我希望底料环节同样可用易读。
- Priority: P0
- Description: 所有新增可见文案在 `src/i18n.ts` 的 zh/en 同步维护；底料选项具备包含商品名的可访问名称与 `aria-pressed` 选中态；弹窗标题作为 Dialog 标题；阻断提示使用 `role="alert"`；切换语言后即时更新；夜间模式与老人模式下无不可读、不可聚焦或遮挡问题。

Acceptance Requirements (EARS):

- REQ-009.1: When 当前语言为英文，the system shall 以英文展示弹窗标题（`Choose Your Broth Base`）、必选标识（`Required`）与主按钮（`Confirm Base & Start Ordering`），无中文残留。
- REQ-009.2: The system shall 为每个底料选项提供形如「选择 {名称} / Select {name}」的可访问名称，并暴露 `aria-pressed` 选中态。
- REQ-009.3: The system shall 以 `role="alert"` 输出阻断与校验提示。
- REQ-009.4: While 夜间模式或老人模式开启，the system shall 保持底料弹窗、汇总、阻断提示可读、可聚焦且不遮挡主操作。
- REQ-009.5: When 用户切换语言，the system shall 即时更新底料名称、规格与所有提示文案。

Gherkin:

```gherkin
Scenario: 英文环境底料环节
  Given 语言设置为英文
  When 用户进入点餐页
  Then 弹窗标题为 "Choose Your Broth Base"
  And 必选标识为 "Required"
  And 主按钮为 "Confirm Base & Start Ordering"
```

### REQ-010: 提交后底料变更的账单一致性

- User Story: 作为加菜后又更换锅底的用户，我希望订单与账单反映最新的锅底，而不是旧锅底。
- Priority: P0
- Description: 一个点餐会话中，`hotpotBases` 为本桌当前底料，`orderBases` 为最近一次提交快照。已提交订单后更换底料，订单详情展示新的 `hotpotBases`；结账以 `orderBases` 计价，下一次提交时以新底料刷新 `orderBases`。

Acceptance Requirements (EARS):

- REQ-010.1: When 用户在订单详情更换底料并确认，the system shall 使订单详情展示新底料，且不再展示旧底料。
- REQ-010.2: While 用户取消底料但尚未重新选择，the system shall 使订单详情展示「未选择底料」并阻断结账，不在订单中保留旧底料。
- REQ-010.3: When 用户在已有订单基础上继续加菜并提交，the system shall 以当前 `hotpotBases` 刷新 `orderBases`，账单不出现两次底料费用。
- REQ-010.4: The system shall 保证同一会话中底料只按当前有效选择计价一次，重复提交不累加底料金额。

Gherkin:

```gherkin
Scenario: 加菜提交后底料不重复计费
  Given 用户已提交含底料"牛油麻辣锅"(¥59)的订单
  When 用户继续加菜并再次提交
  Then 结账小计中的底料仍为 ¥59.00
  And 账单只出现一条火锅底料汇总
```

## 5. UX Design

### 体验目标与设计原则

- 前置决策：把锅底选择放在进入点餐的第一步，而不是提交时才拦截，减少无效菜品挑选。
- 必不可少但不吓人：必选用「琥珀色注意 + 必选徽标 + 中性文案」表达，辣红只用于主操作与选中态，不把未选底料渲染成高风险告警。
- 一次确认、全桌共用：底料绑定本桌会话，加菜与多人点餐不重复打断。
- 信息一致：购物车、订单详情、结账使用同一汇总组件，避免名称/金额漂移。

### 页面 / 模块 / 入口范围

| 位置 | 变更 |
|---|---|
| `#/menu` 首次进入 | 自动弹出底料必选弹窗（modal，无关闭按钮） |
| 底料弹窗 | 选项卡（图片/名称/描述/口味/价格/售罄）、已选数量与合计、确认按钮、校验提示 |
| 「锅底」分类商品卡 | 展示「请通过『火锅底料』环节选择」；按钮进入规格弹窗 → 「确认并去选底料」 |
| 购物车 / 移动端购物车 Dialog | 顶部底料汇总（已选 + 更换；未选 + 选择底料 + 阻断提示） |
| 订单详情 | 底料汇总（含更换）；未选时展示「未选择底料」 |
| 结账页 | 底料名称、已计入小计金额、「取消底料」入口；缺失时禁用支付 |
| 全局 Toast | 底料确认 / 取消 / 售罄重置 / 阻断反馈 |

### 核心体验路径

1. 扫码绑定桌台 → 欢迎页「进入点餐」→ 底料必选弹窗自动打开。
2. 选择 1～2 种底料 → 「确认底料，开始点餐」→ 弹窗关闭，Toast「底料已确认，可以开始点餐」。
3. 浏览菜单、加入菜品 → 购物车顶部持续展示底料与金额。
4. 「确认并提交订单」→ 订单详情展示菜品与底料。
5. 「继续加菜」不重复弹窗；「去结账」→ 结账页展示底料与金额 → 支付。

### 分支路径 / 异常路径

| 场景 | 系统表现 |
|---|---|
| 空选择点击确认 | 弹窗保持，`role="alert"` 提示「请至少选择 1 种火锅底料后再继续」 |
| 取消底料后提交 | 停留 `#/menu`，菜品保留，展示「请先选择火锅底料」 |
| 取消底料后再次进入菜单 | 不自动重弹，通过购物车汇总的「选择底料」引导 |
| 已选底料变为售罄 | Toast 提示 + 自动清空 + 提交/结账阻断 |
| 全部底料售罄 | 弹窗展示「今日底料已暂售」，不阻塞点餐与提交 |
| 未选底料时进入结账页 | 支付按钮禁用 + 提示 |

### 交互与状态说明

- 选项卡：选中态辣红边框 + 勾选图标 + `aria-pressed="true"`；售罄态置灰 + 售罄文字。
- 必选弹窗：`hideClose`，无可用关闭路径；正常完成（确认 / 取消底料）由内部「放行关闭」标志允许关闭，避免必选锁残留透明遮罩吞掉后续点击。
- 编辑弹窗：「暂不修改」「保存底料」；已提交或有已选底料时提供「取消底料」。
- 草稿以 ref 为唯一真实来源，仅在弹窗打开瞬间从父级值初始化；编辑过程中父级 `value` 变化不覆盖用户勾选（规避 StrictMode 下计数正确但保存为空的问题）。

### 文案与可理解性

- 关键文案（`src/i18n.ts` → `hotpot_base.*`）：标题「先选一锅底料」、必选徽标「必选」、数量「已选 {{count}} 种底料」、上限「最多 2 种 · 双拼锅」、阻断「请先选择火锅底料」、售罄「所选底料已售罄，请重新选择」、无货「今日底料已暂售」。
- 提示必须同时说明「为什么」与「怎么做」：阻断提示配套「为这一锅选个底料，才能继续点餐。」

### 视觉与响应式约束

- 仅使用既有 Tailwind 色板（`rice` / `charcoal` / `chili` / `amber`），不新增 UI 库或设计 token 层。
- 弹窗在移动端（375px）与桌面端均可完整操作，无横向溢出；主要触控目标保持既有组件尺寸规范。
- 夜间模式下弹窗、汇总、阻断提示与主按钮满足可读性与 WCAG AA 对比度。

## 6. Backend/Data

本应用无后端业务接口，下列为浏览器内存态数据契约（不持久化，刷新即重置）。

### 6.1 状态与类型

| 对象 | 契约 | 说明 |
|---|---|---|
| `Product.isHotpotBase?: boolean` | 可选字段 | `true` 表示该商品只能在底料环节选择，不进入普通加购 |
| `HotpotBaseSelection` | `{ productId: string; spec: string }` | `productId` 必须对应 `isHotpotBase` 商品；`spec` 为规格文案（含口味/辣度/风险确认） |
| `AppState.hotpotBases` | `HotpotBaseSelection[]`，默认 `[]` | 本桌当前底料；驱动购物车、订单详情与提交校验 |
| `AppState.orderBases` | `HotpotBaseSelection[]`，默认 `[]` | 最近一次提交的底料快照；驱动结账展示与计价 |
| `AppAction.SET_HOTPOT_BASES` | `{ bases }` | 逐字段比较后更新；不改变菜品；清理历史 `base-*` 遗留条目 |
| 初始售罄 | `soldOut: ['p8']` | 底料售罄联动复用同一字段 |

### 6.2 派生规则（`src/lib/hotpot.ts`）

| 规则 | 定义 | 使用位置 |
|---|---|---|
| `hasSelectableBases(soldOut)` | 存在未售罄底料 | 决定是否强制必选 |
| `isBaseSelectionValid(bases, soldOut)` | `1 ≤ n ≤ 2` 且每项为可售底料 | 提交、结账、售罄联动 |
| `describeBases(bases, t)` | `A + B · 双拼`（单锅仅名称） | 购物车/订单/结账展示 |
| `basesTotal(bases)` | Σ 所选底料正价 | 账单小计 |
| `MAX_HOTPOT_BASES = 2` | 数量上限 | 弹窗选择与文案 |

### 6.3 状态流转

| 事件 | 前置 | 结果 |
|---|---|---|
| 进入 `#/menu` 且 `hotpotBases` 为空 | 有可售底料 | 必选弹窗打开（仅首次） |
| `SET_HOTPOT_BASES(bases)` 且 `bases.length > 0` | — | `hotpotBases = bases`，命中实例 |
| `SET_HOTPOT_BASES([])` | 已有底料 | 清空保护；提交/结账被阻断 |
| `SUBMIT_ORDER` | 菜品非空且 `hotpotBases` 非空 | 菜品 → `orderItems`；`orderBases = hotpotBases`；`cart = []`；`view = order` |
| `SUBMIT_ORDER` | 菜品为空或 `hotpotBases` 为空 | 返回原状态（兜底拦截） |
| 已选底料变售罄 | 任一所选底料进入 `soldOut` | 派发 `SET_HOTPOT_BASES([])` + Toast |
| `RESET` | 任意 | 回到初始态，`hotpotBases` / `orderBases` 均为 `[]` |

### 6.4 计价与兼容性

- 计价：`subtotal = 菜品合计 + basesTotal(orderBases)`，满 ¥100 减 ¥30，`payable = subtotal - 30`。底料不生成订单行，避免重复计价。
- 兼容性：`Product.isHotpotBase` 为可选字段，未标记的商品行为不变；`CartItem` / `OrderItem` 结构不变；不新增 `localStorage` 键。
- 迁移/回滚：无持久化数据需迁移；回滚只需撤销底料相关状态字段与组件，遗留内存态随刷新消失。

## 7. NFR / DFX

| 类别 | 要求 | 验收方法 |
|---|---|---|
| 可用性 / 可访问性 | 底料选项、必选弹窗、阻断提示可键盘操作与读屏感知；选中态不只依赖颜色 | Playwright aria/键盘断言 + 人工检查 |
| 兼容性 | 不改变主题、老人模式、hash 路由/深链接、加菜、服务呼叫与支付流程行为 | 既有 `theme-mode.spec.ts`、`view-routing.spec.ts`、`super-spicy.spec.ts` 全量回归 |
| 一致性 | zh/en 文案同步，无硬编码中文残留 | 英文用例 + code review |
| 性能 | 弹窗打开与切换无阻塞；不新增网络请求（纯内存态） | 人工 + E2E 时长观察 |
| 可观测 | 状态变化均有 Toast；底料汇总固定 `data-testid="hotpot-base-summary"` | E2E |
| 安全 / 隐私 | 不新增凭证、Cookie、第三方存储或埋点 | code review |
| 发布 / 回滚 | 纯前端随版本发布；回滚为撤销相关组件与状态字段，无数据迁移 | 构建产物 + Git 回滚 |

## 8. Test Cases

> 现有自动化基线：`e2e/hotpot-base.spec.ts`（REQ-001～REQ-008、NFR-001 共 10 条）。下表为面向三方的完整验收集合，其中标注「新增」的用例为本 Spec 收敛后需补充的覆盖。

### TC-001: 自动弹出且不可跳过（REQ-001）

| 项 | 内容 |
|---|---|
| 前置条件 | 绑定桌台 A08，至少一种可售底料 |
| 步骤 | 进入点餐页；检查无关闭按钮；按 Esc；点击遮罩；不选底料点击确认 |
| 预期 | 弹窗可见且始终保持；出现「请至少选择 1 种火锅底料后再继续」 |
| 类型 | Playwright E2E（`hotpot-base.spec.ts` REQ-001） |

### TC-002: 单选 / 双拼 / 取消重选（REQ-002）

| 项 | 内容 |
|---|---|
| 前置条件 | 处于必选弹窗 |
| 步骤 | 选 1 种 → 选第 2 种 → 取消 1 种 → 重选 |
| 预期 | 计数 1/2 正确；合计 ¥68.00 / ¥127.00；`aria-pressed` 正确 |
| 类型 | Playwright E2E（REQ-002） |

### TC-003: 选满 2 种后替换第 2 项（REQ-002.3）— **新增**

| 项 | 内容 |
|---|---|
| 前置条件 | 已选 `p1` + `p2`；准备第三种可售底料（数据扩展或用两选回归替换语义） |
| 步骤 | 点击第三种底料（当前仓库无第三种底料数据，需临时扩展测试数据） |
| 预期 | 总数为 2，第 2 项被替换为新底料，第 1 项不变 |
| 备注 | 现状仅 2 种底料（`p1`、`p2`），该用例在当前数据下不可直接执行，未纳入现有 E2E；数据扩展后必须补齐 |
| 类型 | 组件测试 / Playwright E2E |

### TC-004: 菜单底料卡不直接加购（REQ-008）

| 项 | 内容 |
|---|---|
| 前置条件 | 已完成底料确认 |
| 步骤 | 进入「锅底」分类，点击底料卡片按钮 |
| 预期 | 显示「请通过『火锅底料』环节选择」；无「加入本桌购物车」；出现「确认并去选底料」 |
| 类型 | Playwright E2E（REQ-002.1） |

### TC-005: 未选底料提交被阻断（REQ-003）

| 项 | 内容 |
|---|---|
| 前置条件 | 购物车有菜品，底料被取消 |
| 步骤 | 点击「确认并提交订单」 |
| 预期 | 停留 `#/menu`；提示可见；菜品保留 |
| 类型 | Playwright E2E（REQ-003） |

### TC-006: 未选底料进入结账被阻断（REQ-004）— **新增**

| 项 | 内容 |
|---|---|
| 前置条件 | 订单详情有菜品，底料被取消 |
| 步骤 | 点击「去结账」 |
| 预期 | 不进入 `#/checkout`，展示阻断提示 |
| 类型 | Playwright E2E |

### TC-007: 三处展示一致与计价（REQ-005）

| 项 | 内容 |
|---|---|
| 前置条件 | 底料 `p1`、菜品 `p3` |
| 步骤 | 购物车 → 提交 → 订单详情 → 结账 |
| 预期 | 三处均展示「鎏金番茄鸳鸯锅」；小计 ¥110.00；应付 ¥80.00；无重复底料行 |
| 类型 | Playwright E2E（REQ-004） |

### TC-008: 加菜沿用不重复弹窗（REQ-001.5、REQ-010.3）

| 项 | 内容 |
|---|---|
| 前置条件 | 已确认底料并提交订单 |
| 步骤 | 「继续加菜」进入菜单 |
| 预期 | 不出现必选弹窗；底料汇总仍展示原底料 |
| 类型 | Playwright E2E（REQ-005） |

### TC-009: 取消与重新选择（REQ-006）

| 项 | 内容 |
|---|---|
| 前置条件 | 已提交订单含底料 |
| 步骤 | 「更换」→「取消底料」→ 检查 → 「选择底料」→ 选 `p2` → 确认 |
| 预期 | 取消后展示「未选择底料」；重选后仅展示 `p2` |
| 类型 | Playwright E2E（REQ-006） |

### TC-010: 「暂不修改」保留原选择（REQ-006.4）— **新增**

| 项 | 内容 |
|---|---|
| 前置条件 | 已确认底料 `p1` |
| 步骤 | 打开编辑弹窗并修改草稿后关闭 / 点击「暂不修改」 |
| 预期 | 本桌底料仍为 `p1`，汇总不变 |
| 类型 | Playwright E2E |

### TC-011: 售罄联动（REQ-007）

| 项 | 内容 |
|---|---|
| 前置条件 | 已确认 `p1` |
| 步骤 | 演示控制台将 `p1` 设为售罄 |
| 预期 | Toast「所选底料已售罄，请重新选择」；底料清空；提交阻断 |
| 类型 | Playwright E2E（REQ-007） |

### TC-012: 全部底料售罄降级（REQ-007.4）— **新增**

| 项 | 内容 |
|---|---|
| 前置条件 | `p1`、`p2` 均设为售罄 |
| 步骤 | 进入点餐页并提交订单 |
| 预期 | 弹窗展示「今日底料已暂售」；提交不被底料阻塞 |
| 类型 | Playwright E2E |

### TC-013: 英文文案（REQ-009.1）

| 项 | 内容 |
|---|---|
| 前置条件 | `localStorage.i18nextLng = 'en'` |
| 步骤 | 进入点餐页 |
| 预期 | 「Choose Your Broth Base」「Required」「Confirm Base & Start Ordering」可见，无中文残留 |
| 类型 | Playwright E2E（REQ-008） |

### TC-014: 主题 / 菜单 / 路由不退化（REQ-009.4）

| 项 | 内容 |
|---|---|
| 前置条件 | 已完成底料确认 |
| 步骤 | 切换夜间模式 → 切回；进入「锅底」分类 |
| 预期 | 主题正常切换；底料商品卡正常展示 |
| 类型 | Playwright E2E（NFR-001） |

### TC-015: 既有用例适配（NFR-002）

| 项 | 内容 |
|---|---|
| 前置条件 | 既有 `super-spicy.spec.ts`、`theme-mode.spec.ts`、`view-routing.spec.ts` |
| 步骤 | 全量执行 |
| 预期 | 所有进入点餐的步骤先完成底料必选；底料规格弹窗断言主按钮为「确认并去选底料」；全部通过 |
| 类型 | Playwright 全量回归 |

### TC-016: 状态层兜底拦截（REQ-003.3）— **新增**

| 项 | 内容 |
|---|---|
| 前置条件 | `hotpotBases` 为空 |
| 步骤 | 直接派发 `SUBMIT_ORDER` |
| 预期 | `view` 保持 `menu`，`orderItems` 不新增 |
| 类型 | 单元测试（reducer） |

### TC-017: 重复提交不重复计费（REQ-010.3、REQ-010.4）

| 项 | 内容 |
|---|---|
| 前置条件 | 已提交含 `p2`（¥59）的订单 |
| 步骤 | 继续加菜并再次提交 → 进入结账 |
| 预期 | 底料仍为 ¥59.00，账单只有一条底料汇总 |
| 类型 | Playwright E2E / 单元测试 |

### TC-018: 键盘与读屏（REQ-009.2、REQ-009.3）

| 项 | 内容 |
|---|---|
| 前置条件 | 处于必选弹窗 |
| 步骤 | Tab 聚焦选项并用 Space 切换；触发阻断提示 |
| 预期 | 焦点可见；选项 `aria-pressed` 变化；提示为 `role="alert"` |
| 类型 | 人工键盘检查 + Playwright |

## Open Questions

| ID | 问题 | 影响 | 建议负责人 |
|---|---|---|---|
| OQ-001 | `origin/main` 已合入儿童模式（`isSpicyForChildren` 命中 `p2 牛油麻辣锅`），合并后儿童模式下底料列表是否过滤超辣底料？是否仍强制至少选 1 种底料？ | 影响 REQ-001、REQ-002 在儿童模式下的展示与必选口径 | PM（儿童模式需求负责人）；本 Spec 保守默认：不过滤底料、仍强制必选，待决议后补充 REQ |
| OQ-002 | 全部底料售罄时「不阻塞提交 + 服务员协助」的降级口径是否适用于真实门店？ | 影响 REQ-007.4 的履约规则 | PM / 门店运营；本演示按该降级实现 |
| OQ-003 | 真实门店是否需要底料变更审核流（提交后更换底料是否需服务员确认）？ | 影响 REQ-006、REQ-010 的履约语义 | PM；本次不做审核流 |

## Traceability

| REQ ID | UX / Data / Backend | NFR | QA focus |
|---|---|---|---|
| REQ-001 | UX 自动弹出/必选锁；`App` 自动弹出 effect；`HotpotBaseDialog.required` | 可访问性、稳定性 | TC-001, TC-003, TC-008 |
| REQ-002 | UX 选项卡与双拼；`lib/hotpot.ts`、`MAX_HOTPOT_BASES` | 一致性 | TC-002, TC-003 |
| REQ-003 | 提交校验；`orderReducer.SUBMIT_ORDER` 兜底 | 稳定性 | TC-005, TC-016 |
| REQ-004 | 结账入口与支付禁用；`App.goCheckout`、`CheckoutView` | 兼容性 | TC-006 |
| REQ-005 | 汇总组件与计价；`HotpotBaseSummary`、`CheckoutView` | 一致性 | TC-007 |
| REQ-006 | 编辑/取消/重选；`HotpotBaseDialog` 编辑态 | 可用性 | TC-009, TC-010 |
| REQ-007 | 售罄联动；`App` 售罄 effect、`soldOut` | 可用性 | TC-011, TC-012 |
| REQ-008 | 菜单底料卡；`MenuView` 规格转场 | 兼容性 | TC-004 |
| REQ-009 | 文案与可访问性；`src/i18n.ts`、Dialog/aria | 可访问性、兼容性、性能 | TC-013, TC-014, TC-018 |
| REQ-010 | 账单一致性；`orderBases` / `hotpotBases` 语义 | 一致性 | TC-008, TC-017 |

## API Design

本需求不涉及对外 API、SDK、Webhook、CLI 或客户集成契约变更（纯前端内存态，无后端业务接口）。

## Metrics

本需求不涉及新增或变更埋点、日志、Dashboard 或指标口径。

## 附录 A. 实现与验证证据（本节点已执行）

> 本节仅记录本次 Spec 生成时对当前工作分支的只读核验结果，供开发与 QA 对照；不构成新的产品契约。

| 检查 | 命令 / 依据 | 结果 |
|---|---|---|
| 依赖安装 | `npm ci` | 成功（281 packages） |
| 底料专项 E2E | `npx playwright test e2e/hotpot-base.spec.ts` | 10 passed |
| 全量 E2E 回归 | `npx playwright test` | 43 passed |
| 数据来源核验 | `src/data/menu.ts` | `hotpotBases` 仅含 `p1`(¥68)、`p2`(¥59)，均 `isHotpotBase: true` |
| 兜底拦截核验 | `src/state/orderReducer.ts` `SUBMIT_ORDER` | 无菜品或无底料时返回原状态 |
| 订单/结账展示核验 | `src/App.tsx` | 订单详情 `bases={orderBases.length ? hotpotBases : orderBases}`；结账读 `orderBases` |

尚未覆盖（对应新增 TC）：TC-003（第三种底料替换，缺测试数据）、TC-006（未选底料进入结账被阻断）、TC-010（「暂不修改」保留原选择）、TC-012（全部底料售罄降级）、TC-016（reducer 兜底）、TC-017（重复提交不重复计费）、TC-018（键盘与读屏断言）。建议在「开发与自测」「E2E 测试用例生成」节点补齐。
