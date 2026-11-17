# Review Summary

- 本次需求: 在沸点火锅点单 SPA 中新增可与老人模式、夜间模式独立叠加的「儿童模式」，提供更大触控区域、简化菜品展示、儿童友好视觉，并默认规避超辣菜品。
- 需求类型: UX / 前端显示模式 / 可访问性 / 本机偏好持久化。
- 变更面: Functional Requirements、UX Design、Backend/Data（本机存储契约）、NFR / DFX、Test Cases、Open Questions、Traceability；不涉及: API Design、Metrics；待确认: 无阻塞项。
- 变更面判断依据: 用户需求与「需求澄清 Spec 文档」「PRD 文档」「参考代码及变更说明」；仓库 `AGENTS.md`、`src/hooks/useElderlyMode.ts`、`src/hooks/useThemeMode.ts`、`src/hooks/useChildMode.ts`、`src/components/ChildModeToggle.tsx`、`src/components/MenuView.tsx`、`src/App.tsx`、`src/components/TopBar.tsx`、`src/components/HomeView.tsx`、`src/components/WelcomeView.tsx`、`src/data/menu.ts`、`src/i18n.ts`、`src/index.css`、`index.html`、`e2e/child-mode.spec.ts`、`e2e/super-spicy.spec.ts`。仓库为纯前端 SPA（`server/` 仅健康检查），无后端业务链路。
- 差异判断: 产品形态 / 站点 / 环境 / 版本差异——不涉及；依据为单仓 React SPA、hash 路由、GitHub Pages 子路径部署，本需求仅新增一种浏览器端显示模式，无原生端、多站点或后端版本分支证据。
- 本次变更关键信息:
  - 儿童模式为第三种独立显示模式：`html.child` + `data-child-mode`，与 `html.elderly`、`html.dark` 并行，互不读写；`localStorage.child-mode` 独立持久化，默认关闭。
  - **本轮决策（用户已确认）**：儿童模式下展开超辣菜品后，规格弹窗**显示辣度区**，微辣/中辣/重辣可选，「超级辣」**置灰禁用**且不弹风险提示、不进入选中态。当前工作分支 `40887cd` 的实现为"整体不渲染辣度区"，与 PRD/澄清文档不一致，需在「开发与自测」节点补齐（见 REQ-003、Open Questions OQ-001）。
  - 超辣判定统一为「锅底辣度选项包含 `menu.option.super_spicy`」；儿童模式默认隐藏，可一键展开，售罄不计入隐藏数量。
  - 简化范围：卡片隐藏描述、徽章与「本桌已点」，价格后缀为「份」；规格弹窗去「谁点了」，主按钮「就要这一份」；主要控件命中高 ≥48px、加菜按钮 52px；根字号 112.5%。
  - 叠加优先级：夜间开启时颜色以 `.dark` 映射为准，儿童模式只保留尺寸与简化；老人 125% 与儿童 112.5% 字号叠乘。存储读写异常降级为会话内存态。
  - 常规模式（儿童关闭）下既有超级辣风险提示、购物车、订单、结账流程完全不变。
- Review 重点: 超级辣禁用契约（REQ-003）与当前实现的差异、三模式叠加的样式优先级、首帧无闪烁、存储失败降级、zh/en 文案同步、既有 `super-spicy.spec.ts` 无回归。

## Scope Note

- Implemented sections: Functional Requirements、UX Design、Backend/Data、NFR / DFX、Test Cases、Open Questions、Traceability。
- Not involved: API Design、Metrics。
- Needs confirmation: 无阻塞项；家长锁与品牌图标集作为非阻塞 Open Questions 记录。
- Reason: 澄清文档与 PRD 已给出业务契约，仓库确认变更集中于前端状态 hook、三处入口、菜单展示、集中样式映射与首帧初始化，无后端或对外契约。

---

# Spec: 需求规格书（Spec）— 支持儿童模式

## 1. Context

本 Spec 基于「需求澄清 Spec 文档」v1、「PRD 文档」v2 与「参考代码及变更说明」，目标仓库为 `seth-zou/GitHub-Restaurant-Order`（基线 `main` @ `58ee88a`，工作分支 `feat/6b83b6a0-gp2m`，当前 HEAD `40887cd`）。背景、目标、范围与业务规则以澄清文档为准，本文只记录 Spec 阶段增量、契约收敛与验收。

关联既有能力：

- 老人模式：`useElderlyMode` / `localStorage.elderly-mode` / `html.elderly`（`src/hooks/useElderlyMode.ts`）。
- 夜间模式：`useThemeMode` / `localStorage.theme-mode` / `html.dark`（`src/hooks/useThemeMode.ts`），暗色语义集中在 `src/index.css`，`tailwind.config.js` 为 `darkMode: 'class'`。
- 超级辣风险提示：`MenuView.handleSpicyChange` + `menu.super_spicy_warning_*` 文案，既有验收 `e2e/super-spicy.spec.ts`。

Spec 阶段增量：

- 关闭澄清文档 TD-1（多人点单 `orderedBy` 归属）：儿童模式移除「谁点了」后，`orderedBy` 固定为当前桌台首位就餐者 `diners[0]`，不新增只读点单人展示。
- 收敛超级辣契约：儿童模式**默认隐藏**超辣菜品，展开后辣度区**可见但超级辣禁用**（不弹风险提示、不可被选中、加入购物车时不会携带超级辣规格），与常规模式共用同一判定函数 `isSpicyForChildren`。
- 收敛叠加优先级：`.dark.child` 只重声明颜色、不声明尺寸；`.child` 尺寸与简化规则不受夜间模式影响。
- 收敛持久化：`child-mode` 仅接受 `'true'` / `'false'`；写入失败后以模块级会话 fallback 优先于不可靠的旧存储值（与 `useThemeMode` 的修复一致）。

## 2. Goals and Non-Goals

沿用需求澄清文档的目标与非目标，并做以下 Spec 级收窄：

- Goals：把「入口、持久化、简化展示、超辣禁用、视觉基调、三模式叠加、存储降级」固化为唯一可测契约。
- Non-Goals：不做后端持久化、账号级偏好、跨设备同步；不做独立路由、独立菜单数据源、新依赖；不删除常规模式的超级辣风险确认弹窗；不做家长锁、不替换全局品牌图标集；不修改 `server/`，不涉及 Halo 仓库。

## 3. Glossary

| 术语 | 含义 |
|---|---|
| 儿童模式（Kids Mode） | 全局显示偏好，通过 `html.child` + `data-child-mode` 表达，只影响展示与可选择性，不改变订单数据结构 |
| 超辣菜品 | `product.options.spicy` 含 `menu.option.super_spicy` 的菜品（当前为 `p1`、`p2` 两道锅底） |
| 模式叠加 | `html` 同时具备 `child`、`elderly`、`dark` 中的多个类，各模式只管自己的维度 |
| 常规模式 | 儿童模式关闭状态；既有老人/夜间模式与业务行为完全保持不变 |

## 4. Functional Requirements

### REQ-001: 儿童模式全局入口

- User Story: 作为儿童或代其操作的家长，我希望在首页、欢迎页和主流程顶栏找到儿童模式入口，以便随时一键开启更简洁友好的点单界面。
- Priority: P0
- Description: 在 `#/home`、`#/welcome` 与主流程视图（`#/menu`、`#/order`、`#/checkout`）顶栏提供儿童模式入口，交互范式与 `ThemeToggle` 一致：图标按钮（lucide `Baby`），开启时图标高亮，具备 `aria-label`（开启/关闭儿童模式）与 `aria-pressed`。点击后全局立即切换，无需刷新；TopBar 切换附带 toast 反馈（"已开启儿童模式" / "已关闭儿童模式"）。

Acceptance Requirements (EARS):

- REQ-001.1: The system shall 在 `#/home`、`#/welcome`、`#/menu`、`#/order`、`#/checkout` 提供可聚焦、可触发的儿童模式入口。
- REQ-001.2: When 用户触发任一入口，the system shall 立即在 `html` 上切换 `child` 类并同步 `data-child-mode` 为 `on` / `off`。
- REQ-001.3: When 儿童模式状态变化，the system shall 同步所有已挂载入口的 `aria-label` 与 `aria-pressed`，不出现入口状态不一致。
- REQ-001.4: When 入口获得键盘焦点，the system shall 显示可辨识焦点状态并支持 Enter/Space 触发。
- REQ-001.5: If 入口交互失败或后续渲染异常，the system shall 保持购物车、订单、桌台与路由状态不变。

Gherkin:

```gherkin
Scenario: 从首页开启儿童模式并进入点餐页
  Given 用户已进入 #/home 并处于常规模式
  When 用户点击右上角儿童模式入口
  Then html 元素立即带有 child 类且 data-child-mode 为 on
  And 入口 aria-pressed 为 true
  When 用户进入点餐页
  Then 儿童模式仍然生效且列表为简化展示
  And 购物车、订单与路由未因切换而改变
```

### REQ-002: 儿童模式偏好持久化

- User Story: 作为同一台设备上的用户，我希望下次打开仍是儿童友好界面，不需要每次重新设置。
- Priority: P0
- Description: 使用 `localStorage` 键 `child-mode`，值仅接受 `'true'` / `'false'`，与 `elderly-mode`、`theme-mode`、`i18nextLng` 互不影响。`index.html` 在 React 挂载前读取并设置 `html.child` 与 `data-child-mode`，避免刷新闪烁。状态由 `App` 统一持有并向下传递（TopBar 受控；HomeView / WelcomeView 可自管理），保证同期所有入口一致。

Acceptance Requirements (EARS):

- REQ-002.1: When 用户开启儿童模式后刷新或重新打开页面，the system shall 首帧即渲染儿童模式，不出现常规界面闪烁。
- REQ-002.2: When `localStorage.child-mode` 为 `'true'` / `'false'`，the system shall 按该值初始化；为其他值（含空串、`'yes'`）时按未保存处理，默认关闭。
- REQ-002.3: While 儿童模式开启，the system shall 不读写 `elderly-mode`、`theme-mode` 与 `i18nextLng`。
- REQ-002.4: When 用户从首页或欢迎页开启后进入其他视图，the system shall 保持儿童模式状态。

Gherkin:

```gherkin
Scenario: 刷新后保持儿童模式
  Given 用户已开启儿童模式
  When 用户刷新点餐页
  Then 页面首帧即为儿童模式
  And html 具有 child 类且 data-child-mode 为 on
  And localStorage.child-mode 为 true
```

```gherkin
Scenario: 非法保存值按未保存处理
  Given localStorage.child-mode 为非法值
  When 用户进入应用
  Then 儿童模式默认关闭
  And 页面不出现错误提示
```

### REQ-003: 超辣菜品默认隐藏与超级辣禁用

- User Story: 作为儿童或家长，我希望超辣锅底默认不出现，即使手动展开也无法选择超级辣，以免误点到不宜的辣度。
- Priority: P0
- Description: 以 `isSpicyForChildren(product)`（辣度选项包含 `menu.option.super_spicy`）作为唯一判定。儿童模式开启时该类菜品在列表中默认隐藏，并用说明条展示「已隐藏 N 道超辣菜品」；用户可点击「看看超辣」展开（按钮切换为「收起超辣」），再次收起。展开后打开该类菜品规格弹窗：**显示辣度区，微辣/中辣/重辣可选并即时生效，「超级辣」置灰禁用**（`disabled`、不可聚焦触发、不弹风险提示、不可进入选中态），加入购物车时规格中不含超级辣。售罄菜品不计入隐藏数量；隐藏数量为 0 时不显示展开按钮。儿童模式关闭后，既有 `e2e/super-spicy.spec.ts` 行为不变。

Acceptance Requirements (EARS):

- REQ-003.1: When 儿童模式开启且用户进入 `#/menu`，the system shall 默认不展示含超级辣辣度的菜品，并显示已隐藏数量。
- REQ-003.2: When 用户点击「看看超辣」，the system shall 显示这些菜品；再次点击「收起超辣」shall 重新隐藏。
- REQ-003.3: While 儿童模式开启且打开含辣度的菜品规格弹窗，the system shall 显示辣度区，其中「超级辣」处于禁用态，点击或键盘触发均不改变辣度且不弹出风险提示。
- REQ-003.4: When 儿童模式下用户选择微辣/中辣/重辣并加入购物车，the system shall 使用所选辣度写入规格，不出现超级辣或风险确认文案。
- REQ-003.5: When 儿童模式关闭，the system shall 恢复常规超级辣风险提示流程，既有 `super-spicy.spec.ts` 全部通过。
- REQ-003.6: If 某超辣菜品售罄，the system shall 不将其计入「已隐藏 N 道超辣菜品」数量。

Gherkin:

```gherkin
Scenario: 儿童模式默认隐藏超辣锅底
  Given 用户已开启儿童模式
  When 用户进入 #/menu
  Then 推荐列表不出现「牛油麻辣锅」
  And 页面显示「已隐藏 2 道超辣菜品」
  When 用户点击「看看超辣」
  Then 「牛油麻辣锅」重新出现
```

```gherkin
Scenario: 展开后超级辣禁用
  Given 用户已开启儿童模式并点击「看看超辣」
  When 用户打开「牛油麻辣锅」规格弹窗
  Then 辣度区显示「微辣」「中辣」「重辣」「超级辣」
  And「超级辣」处于禁用态
  When 用户点击「超级辣」
  Then 不弹出风险提示且辣度为未选中该档
  When 用户选择「中辣」并点击「就要这一份」
  Then 本桌购物车中出现该菜品且规格为「中辣」
```

### REQ-004: 菜品展示与规格弹窗简化

- User Story: 作为儿童，我希望卡片只显示菜品名和价格、弹窗只问份量和口味，以便更轻松地做选择。
- Priority: P0
- Description: 儿童模式下菜品卡片隐藏描述、人气/推荐/新品徽章、图片渐变遮罩与「本桌已点 N」，仅保留图片、菜品名与价格（价格后缀为「份」）。列表顶部显示儿童模式说明条。规格弹窗只保留图片、描述、价格、份量/口味与辣度区（按 REQ-003），移除「谁点了」，主按钮文案「就要这一份」，`orderedBy` 固定为 `diners[0]`。关闭儿童模式后信息立即恢复常规展示。

Acceptance Requirements (EARS):

- REQ-004.1: While 儿童模式开启，the system shall 在任一菜品卡片不展示描述、徽章与「本桌已点」。
- REQ-004.2: While 儿童模式开启，the system shall 以「份」作为价格后缀，并展示儿童模式说明条。
- REQ-004.3: While 儿童模式开启，the system shall 在规格弹窗不展示「谁点了」区域，主按钮为「就要这一份」。
- REQ-004.4: When 儿童模式下用户点击「就要这一份」，the system shall 将该菜品加入本桌购物车，`orderedBy` 为当前首位就餐者。
- REQ-004.5: When 儿童模式关闭，the system shall 立即恢复描述、徽章、「本桌已点」、「谁点了」与「加入本桌购物车」的常规展示。

Gherkin:

```gherkin
Scenario: 儿童模式卡片与弹窗精简
  Given 用户已开启儿童模式
  When 用户查看菜品列表
  Then 卡片只显示图片、名称和「¥金额 份」
  And 不显示描述、徽章与「本桌已点」
  When 用户打开任一菜品规格弹窗
  Then 不显示「谁点了」
  And 主按钮为「就要这一份」
```

### REQ-005: 儿童友好视觉与触控

- User Story: 作为儿童，我希望按钮更大、更好点，界面颜色更轻松，减少误触和信息干扰。
- Priority: P1
- Description: `html.child` 下根字号放大至 112.5%；主要交互控件命中高度 ≥48px，加菜按钮 52px，移动端底部导航 ≥56px；卡片图片区加高、正文内边距加大、菜品名与价格字号提升。页面底色与次级面板向奶油黄偏移（`#fdf6e4` / `#f9eccb`），背景点阵改为琥珀色，装饰性模糊光斑不透明度降低，按钮统一大圆角。辣红仍只用于价格与主操作。所有新色值只出现在 `src/index.css` 的 `.child` / `.dark.child` 区块，组件内不新增未登记十六进制色值。

Acceptance Requirements (EARS):

- REQ-005.1: While 儿童模式开启，the system shall 使加菜按钮、分类 chip、规格选项等主要控件命中高度 ≥48px，加菜按钮 ≥52px。
- REQ-005.2: While 儿童模式开启，the system shall 以儿童模式暖色底替换页面与次级面板底色，且主卡片与页面底色仍可区分。
- REQ-005.3: While 儿童模式开启，the system shall 保持价格与主操作为品牌辣红，不以颜色作为唯一状态载体。
- REQ-005.4: When 视口宽度为 375px 与桌面宽度，the system shall 无横向溢出、无控件重叠，卡片由两列变为单列时可正常阅读。

Gherkin:

```gherkin
Scenario: 儿童模式触控与配色
  Given 用户已开启儿童模式并进入点餐页
  When 用户测量菜品卡片加菜按钮
  Then 其高度不小于 52px 且明显大于常规模式
  And 页面底色为儿童模式暖色底
```

### REQ-006: 与老人模式、夜间模式叠加

- User Story: 作为同时需要大字号、暗色和儿童简化的用户，我希望三种模式可以同时开启且互不覆盖。
- Priority: P0
- Description: 儿童模式只新增 `html.child`，不读写 `html.dark` / `html.elderly`。`src/index.css` 中 `.dark.child` 只重声明颜色，不声明尺寸；颜色优先级为夜间映射 > 儿童暖色映射。老人模式 125% 与儿童模式 112.5% 字号叠乘。任一模可独立关闭且不影响另外两个。

Acceptance Requirements (EARS):

- REQ-006.1: When 三种模式同时开启，the system shall 使 `html` 同时包含 `child`、`dark`、`elderly` 三个类。
- REQ-006.2: While 夜间 + 儿童同时开启，the system shall 使用夜间色值（如菜品卡片背景 `rgb(29, 25, 21)`），儿童模式只保留尺寸与简化。
- REQ-006.3: While 老人 + 儿童同时开启，the system shall 使根字号大于默认 16px（两者叠乘）。
- REQ-006.4: When 用户单独关闭任一模式，the system shall 保持另外两个模式的状态与表现不变。

Gherkin:

```gherkin
Scenario: 三模式叠加
  Given 用户同时开启儿童模式、夜间模式与老人模式
  When 用户查看点餐页
  Then 页面为大字号、大触控目标、简化信息且为夜间配色
  When 用户关闭夜间模式
  Then 儿童模式与老人模式保持开启
  And 页面恢复儿童模式暖色底
```

### REQ-007: 存储不可用降级

- User Story: 作为使用隐私受限浏览器的用户，我希望禁用存储时仍能正常开关儿童模式，不被错误提示打断点餐。
- Priority: P0
- Description: 对 `localStorage` 的读、写全部 `try/catch`。读取失败按默认关闭处理；写入失败时以模块级会话 fallback 记忆本次选择，并在后续初始化中优先于不可靠的旧存储值，跨路由组件重挂载保持；`index.html` 初始化脚本同样包裹 `try/catch`。不弹用户可见错误。

Acceptance Requirements (EARS):

- REQ-007.1: If `localStorage` 访问抛异常，then the system shall 仍支持儿童模式开关并即时生效，页面无未捕获异常。
- REQ-007.2: If 存储写入失败，then the system shall 在当前会话跨视图切换时保持本次选择。
- REQ-007.3: If 存储读写失败，then the system shall 不阻塞桌台绑定、点菜、购物车、下单与结账流程。

Gherkin:

```gherkin
Scenario: 存储被禁用时仍可切换
  Given 浏览器访问 localStorage 抛出 SecurityError
  When 用户点击儿童模式入口
  Then html 具有 child 类且说明条出现
  When 用户再次点击入口
  Then 儿童模式关闭
  And 页面无未捕获异常与错误提示
```

### REQ-008: 双语与可访问性

- User Story: 作为中文或英文用户，我希望入口与新增文案有对应语言的可访问名称，以便理解当前状态。
- Priority: P1
- Description: 新增文案（`aria_child_on`、`aria_child_off`、`add_dish_aria`、`per_portion`、`child_banner_title`、`child_hidden`、`child_spicy_show`、`child_spicy_hide`、`child_add_to_cart`）在 `src/i18n.ts` 的 zh/en 同步维护。菜品卡片加菜按钮具备包含菜品名的 `aria-label`。

Acceptance Requirements (EARS):

- REQ-008.1: When 当前语言为中文或英文，the system shall 显示对应语言的儿童模式入口可访问名称与新增可见文案。
- REQ-008.2: While 儿童模式开启，the system shall 为菜品加菜按钮提供包含菜品名的可访问名称。
- REQ-008.3: If 新增儿童模式用户可见文案缺少 zh/en 任一侧，then the system shall 视为不符合本需求。

Gherkin:

```gherkin
Scenario: 英文环境下的儿童模式
  Given 应用语言切换为英文
  When 用户聚焦儿童模式入口
  Then 可访问名称为 "Enable kids mode"
  When 用户开启儿童模式
  Then 说明条与目标按钮显示英文文案
```

## 5. UX Design

### 体验目标与设计原则

- 儿童模式是「简化 + 放大 + 更安全」的显示层叠加，不是独立页面；不改变点单主流程与业务状态。
- 儿童可自主理解并操作：入口图标为 `Baby`，开启后高亮；说明条用一句话说清「只显示温和好吃的菜」和隐藏数量。
- 安全优先但不阻拦：超辣菜品默认不出现在视线中；用户主动展开时，超级辣仍不可选，风险不交给儿童自行确认。
- 三种模式正交：老人管字号与对比、夜间管色值、儿童管尺寸/简化/暖色（夜间开启时让位给夜间色值）。

### 页面 / 模块 / 入口范围

| 位置 | 交互 | 反馈 | 约束 |
|---|---|---|---|
| `#/home` 右上角入口组 | 点击儿童模式图标 | 全局立即切换 | 与 `ThemeToggle` 并排，不遮挡桌台选择 |
| `#/welcome` 右上角入口组 | 点击儿童模式图标 | 全局立即切换 | 与 `ThemeToggle` 并排，不遮挡进入点餐 |
| `#/menu`、`#/order`、`#/checkout` 顶栏 | 点击儿童模式图标 | 全局立即切换 + toast | 位于夜间与老人模式入口之间，与既有图标按钮同尺寸 |
| `#/menu` 列表区 | 说明条 + 「看看超辣/收起超辣」 | 隐藏/展开超辣菜品 | 隐藏数量为 0 时不显示展开按钮 |
| 菜品规格弹窗 | 份量/口味/辣度（超级辣禁用） | 选择即时生效 | 无「谁点了」；主按钮「就要这一份」 |

### 核心体验路径

1. 用户在首页/欢迎页/顶栏开启儿童模式，界面立即简化、控件变大、底色变暖。
2. 用户浏览列表，看到说明条与已隐藏数量；需要时点「看看超辣」检查。
3. 用户打开规格弹窗，只面对份量/口味和不可选的超级辣，点「就要这一份」加入本桌购物车。
4. 刷新或再次进入，首帧保持儿童模式；叠加夜间/老人模式时各自维度继续生效。

### 分支路径 / 异常路径

| 场景 | 系统响应 |
|---|---|
| 超辣菜品全部售罄 | 隐藏数量不计售罄菜品；数量为 0 时只显示说明条，不显示展开按钮 |
| 存储非法值 | 按未保存处理，默认关闭 |
| `localStorage` 不可用 | 会话内可切换；刷新后默认关闭；无错误提示 |
| 权限/网络 | 无网络依赖，不涉及 |
| 儿童模式关闭时正在展开 | 退出儿童模式后恢复常规列表，超级辣风险提示逻辑恢复 |
| 点击超级辣（儿童模式展开后） | 按钮禁用，无响应、无弹窗 |

### 交互与状态说明

- 说明条：`儿童模式 · 只显示温和好吃的菜` + `已隐藏 N 道超辣菜品`；按钮 `看看超辣` ↔ `收起超辣`，`aria-pressed` 反映展开态。
- 入口：`aria-label` 随状态在「开启儿童模式 / 关闭儿童模式」间切换，`aria-pressed` 与图标高亮同步。
- 弹窗：儿童模式与常规模式为两套渲染分支，避免残留常规模式控件。

### 文案与可理解性

- 所有新增文案 zh/en 同步；中文用短句、避免生僻词；英文使用 "Kids Mode"。
- 不依赖颜色表达状态：展开态由按钮文案与 `aria-pressed` 冗余表达，禁用态由 `disabled` 语义表达。

### 视觉与响应式约束

- 色值只写进 `src/index.css` 的 `.child` / `.dark.child`；组件只用 Tailwind 语义类或已登记的 `child-*` 辅助类。
- 375px 视口卡片单列、控件不重叠；桌面两列布局保持。
- 全局 250ms 过渡沿用，不额外引入动画。

## 6. Backend/Data

本需求不涉及后端服务、API、权限、订单数据结构或服务端存储变更；`server/` 不修改。浏览器端状态与存储契约如下：

| 对象 | 契约 | 优先级 / 校验 | 兼容性 |
|---|---|---|---|
| `localStorage.child-mode` | 仅 `'true'` / `'false'` | 会话 fallback > localStorage > 默认 `false`；非法值按未保存处理 | 新增 key，不改 `elderly-mode`、`theme-mode`、`i18nextLng` 或订单内存数据 |
| `html.child` | 儿童模式唯一全局类 | 随有效状态同步 | 与 `html.dark`、`html.elderly` 并行，不互相读写 |
| `data-child-mode` | `on` / `off` | 随有效状态同步 | 供测试与状态检查使用 |
| `index.html` 初始化 | React 挂载前读取一次 | 读取异常为关闭 | 避免首帧闪烁 |
| 会话 fallback | 模块级 `fallbackChildMode` | 写入失败后优先于旧存储值 | 跨路由保持，刷新后失效（存储不可用时） |
| 视图状态来源 | `App` 统一持有 `child` 并向下传递 | TopBar 受控；HomeView/WelcomeView 可自管理 | 不进入订单 reducer，不作为业务态 |

迁移与回滚：

- 无数据迁移；旧版本无 `child-mode` 时默认关闭。
- 回滚时遗留的 `child-mode` 仅为本机显示偏好，旧版本忽略即可，无需清理脚本。

## 7. NFR / DFX

| 类别 | 要求 | 验收方法 |
|---|---|---|
| 可访问性 | 入口有可访问名称与 `aria-pressed`，焦点可见，键盘可操作；主要控件命中 ≥48px；颜色非唯一状态载体；禁用态使用 `disabled` 语义 | Playwright E2E + 人工键盘检查 |
| 兼容性 | 仅用既有 Tailwind 3.4 `darkMode: 'class'` 与 `src/index.css` 集中映射；不新增依赖；hash 深链接、前进/后退与 GitHub Pages 子路径不受影响 | `npm run build`、`npm run lint`、路由 E2E |
| 性能 | 纯前端 class 切换，无额外网络请求；首帧初始化无闪烁，不引入大型资源 | 构建产物检查 + 首屏观察 |
| 稳定性 | `localStorage` 异常降级；不改变既有业务状态；常规模式超级辣流程无回归 | E2E + `super-spicy.spec.ts` |
| 国际化 | 新增文案 zh/en 同步 | 语言切换检查 |
| 视觉规范 | 新色值仅在 `.child` / `.dark.child` 集中映射；辣红仅用于动作与语义 | 设计系统核对 |

## 8. Test Cases

### TC-001: 三处入口可切换并即时生效（REQ-001、REQ-008）

| 项 | 内容 |
|---|---|
| 前置条件 | 儿童模式关闭，进入 `#/home` |
| 步骤 | 检查首页入口唯一且 `aria-pressed=false`；点击后断言 `html.child`、`data-child-mode=on`、`aria-pressed=true`、`localStorage['child-mode']=true`；进入 `#/menu` 后点击顶栏入口关闭；在 `#/welcome` 重复开关 |
| 预期 | 每次点击立即生效，入口状态同步，路由与购物车不变 |
| 类型 | Playwright E2E（`e2e/child-mode.spec.ts` REQ-001）+ 人工键盘检查 |

### TC-002: 列表简化、触控放大与默认隐藏超辣（REQ-003、REQ-004、REQ-005）

| 项 | 内容 |
|---|---|
| 前置条件 | `?preview=menu` 常规模式 |
| 步骤 | 记录卡片数与加菜按钮高度 → 开启儿童模式 → 比较；检查卡片无描述、无「本桌已点」；检查说明条文案与隐藏数量；点击「看看超辣」 |
| 预期 | 卡片数减少 2；加菜按钮高度 ≥48px 且大于常规；说明条显示「已隐藏 2 道超辣菜品」；展开后超辣锅底重新出现 |
| 类型 | Playwright E2E（REQ-002） |

### TC-003: 展开后辣度区可见且超级辣禁用（REQ-003）— **本轮新增**

| 项 | 内容 |
|---|---|
| 前置条件 | 儿童模式开启，点击「看看超辣」，切到锅底分类 |
| 步骤 | 打开超辣锅底规格弹窗；检查辣度区四个选项；检查「超级辣」按钮 `disabled`；点击「超级辣」；选择「中辣」；点击「就要这一份」 |
| 预期 | 辣度区显示微辣/中辣/重辣/超级辣；超级辣禁用且点击无风险弹窗、不进入选中态；购物车规格为「中辣」，不含风险确认文案 |
| 类型 | Playwright E2E（需新增用例）+ 人工点击检查 |

### TC-004: 儿童模式规格弹窗精简（REQ-004）

| 项 | 内容 |
|---|---|
| 前置条件 | 儿童模式开启 |
| 步骤 | 打开第一张菜品卡片的规格弹窗 |
| 预期 | 主按钮为「就要这一份」；不显示「谁点了」；点击后本桌购物车出现该菜品 |
| 类型 | Playwright E2E（REQ-003） |

### TC-005: 持久化与非法值（REQ-002）

| 项 | 内容 |
|---|---|
| 前置条件 | 开启儿童模式 |
| 步骤 | 重新进入 `?preview=menu` 并刷新；再设置 `child-mode='yes'` 后刷新 |
| 预期 | 刷新后 `html.child` 与说明条保持；非法值按关闭处理且无错误 |
| 类型 | Playwright E2E（REQ-004）+ 非法值补充用例 |

### TC-006: 三模式叠加与独立关闭（REQ-006）

| 项 | 内容 |
|---|---|
| 前置条件 | `?preview=menu` 常规模式 |
| 步骤 | 依次开启儿童、夜间、老人模式；检查 `html` 三个类；读卡片背景色与根字号；再依次关闭夜间与老人 |
| 预期 | 三模式共存；卡片背景为夜间 `rgb(29, 25, 21)`；根字号 >16px；单独关闭不影响儿童模式 |
| 类型 | Playwright E2E（REQ-005） |

### TC-007: 存储禁用降级（REQ-007）

| 项 | 内容 |
|---|---|
| 前置条件 | `addInitScript` 使 `window.localStorage` 访问抛 `SecurityError` |
| 步骤 | 进入 `?preview=menu`，开启再关闭儿童模式 |
| 预期 | 开关即时生效，说明条出现/消失，无 `pageerror` 与错误提示 |
| 类型 | Playwright E2E（REQ-006） |

### TC-008: 常规模式超级辣流程无回归（REQ-003.5）

| 项 | 内容 |
|---|---|
| 前置条件 | 儿童模式关闭 |
| 步骤 | 执行既有 `e2e/super-spicy.spec.ts` 全部用例 |
| 预期 | 超级辣可见、点击弹风险提示、确认后可选中；全部通过 |
| 类型 | 既有 Playwright E2E 回归 |

### TC-009: 双语与可访问名称（REQ-008）

| 项 | 内容 |
|---|---|
| 前置条件 | 儿童模式关闭 |
| 步骤 | 切换到英文；检查入口 `aria-label`；开启儿童模式后检查说明条与按钮文案；再切回中文 |
| 预期 | 英文显示 "Enable kids mode" 与英文说明条/按钮；中文与英文无缺失 key |
| 类型 | Playwright E2E + 人工检查 |

### TC-010: 响应式与视觉基线（REQ-005）

| 项 | 内容 |
|---|---|
| 前置条件 | 儿童模式开启 |
| 步骤 | 分别在 375×812 与 1280×720 截屏检查列表、说明条、规格弹窗、底部导航 |
| 预期 | 无横向溢出与控件重叠；卡片单列/两列切换正常；暖色底与主卡可区分；辣红仅用于价格与主操作 |
| 类型 | 视觉审查 + 截图对比 |

## 9. Open Questions

| ID | 问题 | 影响 | 决议 / 建议负责人 |
|---|---|---|---|
| OQ-001 | 当前分支 `40887cd` 儿童模式弹窗未渲染辣度区，与已确认契约「显示辣度区、超级辣禁用」不一致 | 影响 REQ-003 验收与 TC-003 | 已由用户确认取「显示+禁用」；由「开发与自测」节点补齐实现与 E2E，Owner：RD/QA |
| OQ-002 | 是否需要家长锁（PIN/长按）才能关闭儿童模式 | 儿童保护强度；不影响本次验收 | 本次不做，沿用单点击开关；如需家长锁另行立项（PM） |
| OQ-003 | 「儿童友好图标」是否需要品牌层替换全局图标集 | 品牌一致性 | 本次仅新增入口 `Baby` 图标；品牌图标资产走设计系统扩展（Design） |
| OQ-004 | 未来新增辣度档位/新菜品时如何确保判定不漏 | 超辣判定准确性 | 判定集中在 `isSpicyForChildren`，新增档位时同步更新并补 TC-002/TC-003（RD） |

## 10. Traceability

| REQ | UX / 状态 | NFR | 测试 |
|---|---|---|---|
| REQ-001 | 入口范围；`ChildModeToggle`、`App` 状态持有 | 可访问性、国际化 | TC-001, TC-009 |
| REQ-002 | 持久化与首帧初始化 | 稳定性、性能 | TC-005 |
| REQ-003 | 说明条、展开/收起、辣度禁用 | 可访问性、稳定性 | TC-002, TC-003, TC-008 |
| REQ-004 | 卡片与弹窗简化 | — | TC-002, TC-004 |
| REQ-005 | 视觉基调、触控尺寸 | 视觉规范、可访问性 | TC-002, TC-010 |
| REQ-006 | 三模式叠加 | 兼容性 | TC-006 |
| REQ-007 | 存储降级 | 稳定性 | TC-007 |
| REQ-008 | 文案与可访问名称 | 国际化、可访问性 | TC-001, TC-009 |

## API Design

本需求不涉及对外 API、SDK、Webhook、CLI 或客户集成契约变更。

## Metrics

本需求不涉及新增或变更埋点、日志、Dashboard 或指标口径。
