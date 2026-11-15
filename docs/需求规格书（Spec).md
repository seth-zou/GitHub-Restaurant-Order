# Review Summary

- 本次需求: 为沸点火锅点单 SPA 提供可发现的浅色/深色主题入口，保证夜间模式可读性、对比度、交互一致性，并持久化用户选择。
- 需求类型: UX / 前端主题状态 / 可访问性 / 本机状态持久化。
- 变更面: Functional Requirements、UX Design、Backend/Data、NFR / DFX、Open Questions、Traceability、Test Cases；不涉及: API Design、Metrics；待确认: 无阻塞项。
- 变更面判断依据: 澄清文档与 PRD 明确全局主题入口、默认策略和本机持久化；仓库 `AGENTS.md`、`src/hooks/useThemeMode.ts`、`src/components/ThemeToggle.tsx`、`src/index.css`、`index.html` 与 `e2e/theme-mode.spec.ts` 确认这是浏览器端 SPA 的全局展示与状态能力，无后端接口。
- 差异判断: 产品形态 / 站点 / 环境 / 版本差异——不涉及新增差异；依据为单仓 React SPA、hash 路由、GitHub Pages 子路径部署，无原生端、多站点或后端业务链路证据。
- 本次变更关键信息:
  - Spec 采纳用户选择 > 系统 `prefers-color-scheme` > 浅色的优先级；无保存值时只在初始化读取一次系统偏好，不监听运行时变化。
  - Spec 采纳 `html.dark` + 集中暗色语义映射作为当前主题维护方式，新增组件必须复用已映射语义类或同步扩展集中映射，不引入第二套暗色实现。
  - 本机契约固定为 `localStorage.theme-mode=light|dark`、`html.dark`、`data-theme-mode` 与 `meta[name="theme-color"]`；非法值按未保存处理。
  - 明确 `localStorage` 不可用时降级为会话内存态，不阻塞点餐；不迁移既有数据、不做跨设备同步。
  - 新增可执行功能与非功能测试用例，覆盖入口、默认值、优先级、持久化、降级、视觉、老人模式、双语和业务回归。
- Review 重点: 默认与持久化优先级、集中暗色映射维护约束、对比度与焦点、存储失败降级、老人模式叠加、React 挂载前初始化、业务流程不受影响。

## Scope Note

- Implemented sections: Functional Requirements, UX Design, Backend/Data, NFR / DFX, Test Cases, Traceability, Open Questions。
- Not involved: API Design, Metrics。
- Needs confirmation: 无。
- Reason: 上游澄清文档已关闭业务契约，仓库与参考实现确认变更集中于前端主题状态、全局视觉映射和浏览器本机偏好存储。

---

# Spec: 支持夜间模式

## 1. Context

本 Spec 基于「需求澄清文档」v1 与「PRD 文档」v2，目标仓库为 `seth-zou/GitHub-Restaurant-Order`，基线 `main` @ `27ffc339`，工作分支 `feat/c4d40c0e-c18o`。

Spec 阶段增量：

- 关闭 TD-1：采用 `tailwind.config.js` 的 `darkMode: 'class'` 与 `src/index.css` 的集中暗色语义映射；暂不重构为逐组件 `dark:` 变体，也不新增组件内联夜间色值。
- 关闭 TD-2：无用户选择时只在应用初始化读取一次 `prefers-color-scheme`；系统偏好的运行时变化不自动联动，本次不做。
- 参考 commit `8577edb` 已验证入口、状态、持久化、集中映射和 E2E 的最小可行实现；本 Spec 将其收敛为下游实现、测试与评审契约。

背景、目标、范围与业务规则以「需求澄清文档」为准；本文只记录 Spec 增量、产品契约与验收。

## 2. Goals and Non-Goals

沿用需求澄清文档的目标与非目标，并做以下 Spec 级收窄：

- Goals：把暗色 token 维护方式、系统偏好读取时机、本机契约和测试口径固化为下游唯一契约。
- Non-Goals：不做系统偏好运行时持续监听；不做语义 token 大规模重构；不做跨设备同步、后端持久化、多主题皮肤或埋点扩展。

## 3. Functional Requirements

### REQ-001: 全局主题入口

- User Story: 作为就餐用户，我希望在首页、欢迎页和主流程顶栏找到主题入口，以便暗光环境下一键切换到可读的夜间模式。
- Priority: P0
- Description: 应用在 `#/home`、`#/welcome` 与主流程视图的顶栏提供同一语义的浅色/深色切换入口。点击后全局主题立即切换，无需刷新页面。

Acceptance Requirements (EARS):

- REQ-001.1: The system shall 在 `#/home`、`#/welcome` 和 `#/menu`、`#/order`、`#/checkout` 任一视图提供可聚焦、可触发的主题入口。
- REQ-001.2: When 用户触发主题入口，the system shall 立即切换浅色/深色并同步所有可见界面。
- REQ-001.3: If 入口交互失败或后续渲染异常，the system shall 保持当前主题、路由与既有业务状态，不产生订单、购物车或桌台数据变更。
- REQ-001.4: When 入口获得焦点，the system shall 显示可辨识的焦点状态并保持触控目标符合现有组件规范。

Gherkin:

```gherkin
Scenario: 从主流程顶栏切换主题
  Given 用户已进入 #/menu 并处于浅色模式
  When 用户通过键盘触发主题入口
  Then 全局界面立即切换为夜间模式，且无需刷新页面
  And 购物车、订单、桌台和路由保持不变
```

### REQ-002: 默认主题策略

- User Story: 作为首次访问用户，我希望默认主题贴近系统偏好，以便减少暗光环境下的手动调整。
- Priority: P0
- Description: 无有效保存选择时，应用在初始化读取一次浏览器 `prefers-color-scheme`。系统偏好为 dark 时首屏使用夜间模式；系统偏好为 light、未声明或能力不可用时使用浅色。保存的用户选择始终优先于系统偏好。

Acceptance Requirements (EARS):

- REQ-002.1: When 本地无 `theme-mode` 且 `prefers-color-scheme` 为 dark，the system shall 在首屏渲染夜间模式。
- REQ-002.2: When 本地无 `theme-mode` 且系统偏好为 light、未声明或读取能力不可用，the system shall 在首屏渲染浅色模式。
- REQ-002.3: When 本地保存值为 `light` 或 `dark`，the system shall 优先应用该保存值并忽略本次系统偏好。
- REQ-002.4: When `localStorage.theme-mode` 为非法值，the system shall 将其视为未保存并按默认策略推断。
- REQ-002.5: While 应用运行期间系统 `prefers-color-scheme` 发生变化，the system shall 不自动切换；后续访问按已有优先级重新初始化。

Gherkin:

```gherkin
Scenario: 首次访问跟随系统偏好
  Given 本地未保存 theme-mode
  And 系统 prefers-color-scheme 为 dark
  When 用户进入应用
  Then 首屏渲染夜间模式
  And data-theme-mode 为 dark
```

```gherkin
Scenario: 用户选择优先于系统偏好
  Given 系统 prefers-color-scheme 为 dark
  And 本地 theme-mode 已保存为 light
  When 用户进入应用
  Then 首屏渲染浅色模式
```

### REQ-003: 主题状态与本机持久化

- User Story: 作为返回用户，我希望应用记住我上次选择的亮度模式，以便刷新或再次进入时继续使用熟悉的界面。
- Priority: P0
- Description: 用户显式切换后，应用在本设备浏览器保存 `theme-mode=light|dark`，并同步 `html.dark`、`data-theme-mode` 和 `meta[name="theme-color"]`。后续同浏览器访问优先应用保存值；存储不可用时降级为当次内存态。

Acceptance Requirements (EARS):

- REQ-003.1: When 用户显式切换到 dark 或 light，the system shall 更新 `html.dark`、`data-theme-mode` 与 `meta[name="theme-color"]`。
- REQ-003.2: When 用户显式选择后刷新或再次进入同一浏览器，the system shall 渲染该保存值对应的模式。
- REQ-003.3: When 应用加载，the system shall 在 React 挂载前应用主题，避免用户可见的主题闪烁。
- REQ-003.4: If `localStorage` 读取或写入不可用，the system shall 在当次页面会话内继续支持主题切换，不抛出用户可见错误，不阻塞点餐主流程。
- REQ-003.5: When 本机持久化不可用且用户切换主题，the system shall 不向网络或后端上报主题数据；下次进入按默认策略推断。

Gherkin:

```gherkin
Scenario: 显式切换后保持偏好
  Given 用户处于浅色模式
  When 用户切换到夜间模式并刷新页面
  Then 页面仍渲染夜间模式
  And localStorage.theme-mode 为 dark
  And html 具有 dark 类与 data-theme-mode=dark
```

```gherkin
Scenario: 存储不可用时降级
  Given 浏览器禁用或限制 localStorage
  When 用户在当前会话切换主题
  Then 主题在当前会话内立即生效
  And 页面不出现存储失败错误
  And 点餐、订单与结账流程可继续使用
```

### REQ-004: 夜间模式视觉与交互一致性

- User Story: 作为暗光环境用户，我希望夜间模式覆盖完整界面并保持品牌识别与操作层级，以便清晰查看菜品、价格、订单和结账信息。
- Priority: P0
- Description: 夜间模式覆盖首页、欢迎页、点餐、订单、结账、服务弹层、购物车、演示控制台、风险提示、Toast、主 CTA 和移动端底部导航。暗色界面保持品牌暖色识别、卡片层级、图标语义、状态冗余、焦点可见性和既有触控目标。

Acceptance Requirements (EARS):

- REQ-004.1: When 夜间模式激活，the system shall 对核心页面、弹层、Toast、底部导航和主 CTA 应用一致暗色语义。
- REQ-004.2: When 夜间模式展示正文、价格、订单状态、售罄提示、风险提示或按钮文案，the system shall 保持不低于 WCAG AA 的对比度。
- REQ-004.3: When 用户在夜间模式使用键盘、Dialog、Toast、老人模式或既有交互，the system shall 保持可辨识焦点、正确层级和可操作触控范围。
- REQ-004.4: When 夜间模式包含图片、遮罩、状态标识或辅助说明，the system shall 保持关键信息不被遮挡且不以颜色作为唯一识别方式。
- REQ-004.5: If 任一新增或既有浅色类缺少集中暗色映射并造成界面残留不可读浅色块，the system shall 视为不符合本需求。

Gherkin:

```gherkin
Scenario: 夜间模式覆盖弹层与导航
  Given 夜间模式已激活
  When 用户打开购物车弹层或服务弹层
  Then 弹层表面、文字、边框、按钮和遮罩使用暗色语义
  And 移动端底部导航保持可读且状态可辨识
```

### REQ-005: 双语与状态反馈

- User Story: 作为中文或英文用户，我希望主题入口有对应语言的可访问名称，以便理解当前操作目标而不依赖颜色判断。
- Priority: P1
- Description: 主题入口的可访问名称与任何新增用户可见文案走 i18n，中文和英文同步维护。主题状态至少通过图标变化、`aria-label` 或界面模式提供非颜色唯一反馈。

Acceptance Requirements (EARS):

- REQ-005.1: When 当前语言为中文或英文，the system shall 显示对应语言的主题入口可访问名称。
- REQ-005.2: When 主题状态变化，the system shall 至少通过图标变化、`aria-label` 或界面模式提供非颜色唯一感知。
- REQ-005.3: If 新增主题相关用户可见文案，the system shall 同步提供 zh/en 文案，不使用未翻译硬编码文本。

Gherkin:

```gherkin
Scenario: 英文环境下理解切换目标
  Given 应用语言为英文且当前为浅色模式
  When 用户聚焦主题入口
  Then 可访问名称为英文的“切换至夜间模式”语义
  And 图标与界面模式提供非颜色冗余反馈
```

## 4. UX Design

### 体验目标与设计原则

- 夜间模式是全局主题，不是局部反色；页面、卡片、面板、弹层、导航和反馈在同一模式下保持统一层级。
- 保持「暖纸沸点」的品牌识别：暗色底与暖色前景保留温度，辣红继续用于动作、选择、风险或服务语义，琥珀用于进度或注意语义。
- 颜色不是唯一状态载体；售罄、风险、选中、等待和焦点仍依赖文字、图标、数值或形状冗余。
- 老人模式与夜间模式独立叠加：字号增强由 `html.elderly` 控制，暗色配色由 `html.dark` 控制。

### 页面与入口范围

| 位置 | 交互 | 预期反馈 | 约束 |
|---|---|---|---|
| `#/home` | 右上主题入口 | 全局立即切换 | 不遮挡桌台选择或主要操作 |
| `#/welcome` | 右上主题入口 | 全局立即切换 | 不遮挡欢迎信息与进入点餐入口 |
| `#/menu`、`#/order`、`#/checkout` | 主流程顶栏主题入口 | 全局立即切换 | 与语言、老人模式、服务、演示控制台共存 |
| Dialog / Toast / 购物车 / 演示控制台 | 跟随全局状态 | 无独立主题入口 | 不出现弹层与页面主题冲突 |
| 移动端底部导航 | 跟随全局状态 | 背景、图标、文字和激活态可读 | 保留 safe area 与既有触控目标 |

### 核心体验路径

1. 用户进入应用，系统按保存值或系统偏好渲染首屏。
2. 用户通过主题入口切换，界面即时响应，入口目标与可访问名称同步变化。
3. 用户刷新或再次进入，应用优先使用显式保存值。
4. 用户在开启老人模式或切换语言后继续使用主题，字号、文案与暗色语义同时生效。

### 分支路径与异常

| 场景 | 系统响应 |
|---|---|
| 首次访问、无保存值 | 初始化读取一次系统偏好；无匹配或不可用为浅色 |
| 非法保存值 | 视为未保存，按默认策略推断 |
| `localStorage` 不可用 | 当次内存态切换可用；无用户可见错误；下次进入按默认策略 |
| 入口异常或渲染异常 | 保持当前主题与业务状态；不改变订单、购物车、桌台或路由 |
| 系统偏好运行时变化 | 本次不自动联动；用户仍可手动切换 |

### 文案与状态说明

- 当前浅色模式入口使用“切换至夜间模式”语义；当前夜间模式入口使用“切换至浅色模式”语义。
- zh/en 文案保存在 `src/i18n.ts` 的 `common.*` 分组并同步维护。
- 图标使用 Moon / Sun 的语义变化；界面模式本身是辅助状态反馈，不要求新增 Toast。

## 5. Backend/Data

本需求不涉及后端服务、API、权限、订单数据结构或服务端存储变更。

浏览器端状态与存储契约如下：

| 对象 | 契约 | 优先级 / 校验 | 兼容性 |
|---|---|---|---|
| `localStorage.theme-mode` | 仅保存 `light` 或 `dark` | 用户显式选择 > 系统偏好 > `light`；非法值按未保存处理 | 新增 key，不改 `i18nextLng`、`elderly-mode` 或购物车/订单内存数据 |
| `html.dark` | dark 为唯一全局主题类 | 随有效主题同步 | 复用 Tailwind `darkMode: 'class'` |
| `data-theme-mode` | 值为 `light` 或 `dark` | 随有效主题同步 | 供测试与状态检查使用 |
| `meta[name="theme-color"]` | light 状态使用浅色基线，dark 状态使用暗色基线 | 随有效主题同步 | 不作为业务判断依据 |
| 初始化读取 | 在 React 挂载前读取一次 | 本地有效保存值优先，否则读取 `prefers-color-scheme`，失败为浅色 | 不引入阻塞网络请求 |

迁移与回滚：

- 不迁移既有数据；旧版本没有 `theme-mode` 时按默认策略推断。
- 存储失败不产生数据损坏；回滚实现时遗留的 `theme-mode` 仅是本机偏好数据，不作为服务端契约，可安全忽略。

## 6. NFR / DFX

### 可访问性与视觉

- 正文、价格、关键状态、风险提示、按钮文案和必要 UI 边界满足 WCAG AA。
- 焦点可见、键盘可操作，交互目标保持现有组件规范。
- 状态反馈不得只依赖颜色；暗色适配必须覆盖弹层、Toast、底部导航和主 CTA。

### 兼容性

- 仅作用浏览器端 React SPA；不改变健康检查 Express 服务。
- 支持现代浏览器环境；`localStorage` 不可用时按会话内存态降级。
- 老人模式可叠加；hash 深链接、浏览器前进/后退和 GitHub Pages 子路径部署不受影响。

### 性能

- 主题初始化在 React 挂载前完成，不引入阻塞式网络或后端请求。
- 主题切换遵循既有 250ms 颜色过渡，无明显卡顿或可见主题闪烁。

### 安全与隐私

- 主题偏好仅保存在本设备浏览器，不上报、不同步、不关联用户身份。
- 不新增 Cookie、埋点或第三方存储。

### 发布与回滚

- 功能可随前端版本直接发布；无数据库迁移和服务端灰度。
- 回滚仅移除入口与主题状态逻辑即可；本机遗留 `theme-mode` 不阻塞旧版本，也不需要清理脚本。

## 7. Test Cases

### TC-001: 三类入口可达并即时切换（REQ-001）

| 项 | 内容 |
|---|---|
| 前置条件 | 应用可访问，初始为浅色模式 |
| 步骤 | 分别进入 `#/home`、`#/welcome`、`#/menu`、`#/order`、`#/checkout`；检查入口可见、可聚焦；触发切换 |
| 预期 | 每个入口可操作；切换立即生效；路由和业务状态不变 |
| 类型 | Playwright E2E + 人工键盘检查 |

### TC-002: 系统深色偏好默认夜间模式（REQ-002）

| 项 | 内容 |
|---|---|
| 前置条件 | 清空本站 `localStorage`，浏览器 `colorScheme=dark` |
| 步骤 | 首次进入应用 |
| 预期 | `html` 含 `dark`；`data-theme-mode=dark`；首屏无浅色闪烁 |
| 类型 | Playwright E2E |

### TC-003: 无声明或系统浅色默认浅色（REQ-002）

| 项 | 内容 |
|---|---|
| 前置条件 | 清空本站 `localStorage`；系统偏好为 light、未声明或模拟不可用 |
| 步骤 | 首次进入应用 |
| 预期 | `html` 不含 `dark`；`data-theme-mode=light`；界面为浅色 |
| 类型 | Playwright E2E / 单元或组件测试 |

### TC-004: 用户选择优先于系统偏好（REQ-002、REQ-003）

| 项 | 内容 |
|---|---|
| 前置条件 | `colorScheme=dark`，`localStorage.theme-mode=light` |
| 步骤 | 进入应用并刷新 |
| 预期 | 应用浅色模式，不因系统深色偏好切换 |
| 类型 | Playwright E2E |

### TC-005: 非法保存值按默认策略（REQ-002、REQ-003）

| 项 | 内容 |
|---|---|
| 前置条件 | `localStorage.theme-mode` 设置为非法值；分别模拟系统 dark / light |
| 步骤 | 进入应用 |
| 预期 | 非法值被忽略；按系统偏好或浅色兜底推断 |
| 类型 | 单元测试 / Playwright E2E |

### TC-006: 刷新与再次进入保持选择（REQ-003）

| 项 | 内容 |
|---|---|
| 前置条件 | 用户已显式切换到 dark |
| 步骤 | 刷新页面后再次切换到 light，并再次刷新 |
| 预期 | 每次进入保持对应选择；`html.dark`、`data-theme-mode`、`localStorage.theme-mode` 一致 |
| 类型 | Playwright E2E |

### TC-007: 存储失败降级为内存态（REQ-003）

| 项 | 内容 |
|---|---|
| 前置条件 | 模拟读取或写入 `localStorage` 抛错 |
| 步骤 | 初始化应用、切换主题、继续点餐操作 |
| 预期 | 当次主题切换可用；无用户可见错误；业务流程继续；刷新后按默认策略 |
| 类型 | 单元测试 / 组件测试 + 人工回归 |

### TC-008: 夜间模式全量界面与对比度（REQ-004）

| 项 | 内容 |
|---|---|
| 前置条件 | 夜间模式激活 |
| 步骤 | 巡检首页、欢迎页、点餐、订单、结账、服务弹层、购物车、演示控制台、风险提示、Toast、主 CTA 和移动端底部导航；检查正文、价格、状态、边框、图片与遮罩 |
| 预期 | 无不可读浅色残留；WCAG AA 对比度通过；层级、品牌识别和状态冗余保持 |
| 类型 | 视觉审查 + 对比度检查 + Playwright E2E |

### TC-009: 键盘焦点与弹层交互（REQ-001、REQ-004）

| 项 | 内容 |
|---|---|
| 前置条件 | 夜间模式激活 |
| 步骤 | 用键盘聚焦主题入口；打开并关闭 Dialog、Toast、购物车或服务弹层 |
| 预期 | 焦点可辨识；层级正确；弹层文字、按钮和关闭操作可读可用 |
| 类型 | 人工键盘检查 + Playwright E2E |

### TC-010: 老人模式与双语叠加（REQ-004、REQ-005）

| 项 | 内容 |
|---|---|
| 前置条件 | 开启老人模式，夜间模式激活 |
| 步骤 | 分别切换 zh/en；检查字号、半透明文字、按钮触控目标、焦点、主题入口可访问名称 |
| 预期 | 字号增强与暗色配色叠加生效；对比度不劣化；zh/en 可访问名称同步 |
| 类型 | 人工检查 + Playwright E2E |

### TC-011: 业务与路由回归（全部 REQ）

| 项 | 内容 |
|---|---|
| 前置条件 | 浅色与夜间模式分别激活 |
| 步骤 | 覆盖桌台绑定、菜单选择、购物车、提交订单、服务、订单取消/进度、结账、演示控制台、hash 深链接与前进/后退 |
| 预期 | 业务规则、路由和内存态不因主题切换改变；`npm run lint`、`npm run build`、全量 Playwright 通过 |
| 类型 | 既有回归 + Playwright E2E + 构建/静态检查 |

## 8. Open Questions

| ID | 问题 | 影响 | 决议 / 建议负责人 |
|---|---|---|---|
| OQ-001 | 是否演进为语义 token 体系？ | 长期维护成本；不影响本次用户可见行为 | 本次不演进；新增颜色类时同步集中映射。后续大规模组件改造时由 RD/Design 另立需求。 |
| OQ-002 | 是否持续监听系统偏好运行时变化？ | 可选增强；会影响状态优先级语义 | 本次不做。如需增强，由 PM 另立需求并重新定义用户选择、系统偏好和会话状态的优先级。 |

## 9. Traceability

| REQ | 关联设计/状态 | NFR | 测试 |
|---|---|---|---|
| REQ-001 | UX 页面与入口范围；`ThemeToggle` 语义入口 | 可访问性 | TC-001, TC-009, TC-011 |
| REQ-002 | Backend/Data 初始化读取与优先级 | 兼容性 | TC-002, TC-003, TC-004, TC-005 |
| REQ-003 | Backend/Data 本机存储契约与迁移回滚 | 性能、兼容性、隐私、发布回滚 | TC-004, TC-005, TC-006, TC-007 |
| REQ-004 | UX 一致性、视觉语义；集中暗色映射 | 可访问性、视觉、性能 | TC-008, TC-009, TC-010, TC-011 |
| REQ-005 | UX 文案与状态反馈 | 可访问性、兼容性 | TC-010, TC-011 |

## API Design

本需求不涉及对外 API、SDK、Webhook、CLI 或客户集成契约变更。

## Metrics

本需求不涉及新增或变更埋点、日志、Dashboard 或指标口径。
