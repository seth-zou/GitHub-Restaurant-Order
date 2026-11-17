# Review Summary

- 本次需求: 在已交付的白天/夜间双主题基础上，交付「跟随系统 / 白天 / 夜间」三态主题体验，使偏好可长期保持、系统变化可实时跟随、入口可理解、暗色覆盖可自动守卫。
- 需求类型: UX / 前端主题状态 / 可访问性 / 本机偏好持久化 / 前端可维护性。
- 变更面: Functional Requirements、UX Design、Data & Storage、Implementation Constraints、NFR / DFX、Test Cases、Traceability、需求打标；不涉及: API Design、Backend/Data、Metrics；待确认: 无阻塞项。
- 变更面判断依据: 上游 `docs/需求澄清.md` v2、`docs/PRD 文档.md`、`docs/参考代码变更说明.md`；仓库 `AGENTS.md`、`src/hooks/useThemeMode.ts`、`src/components/ThemeToggle.tsx`、`src/components/TopBar.tsx`、`src/components/HomeView.tsx`、`src/components/WelcomeView.tsx`、`src/App.tsx`、`src/index.css`、`index.html`、`src/i18n.ts`、`e2e/theme-mode.spec.ts`、`scripts/check-theme-coverage.mjs`；分支 `feat/93300da1-55b2` 相对 `main` @ `58ee88a` 的变更。
- 差异判断: 产品形态 / 站点 / 环境差异——不涉及；版本差异——涉及历史 `light` / `dark` 保存值与旧版浏览器能力，按兼容策略处理。依据：单仓 React SPA、hash 路由、GitHub Pages 子路径部署，无原生端、多站点、后端业务链路或服务端偏好存储；`useThemeMode` 与 `index.html` 已对旧值与 `matchMedia` / `addListener` 能力做兜底。
- 本次变更关键信息:
  - 偏好模型由二态扩展为三态 `system | light | dark`，默认 `system`；用户显式选择优先，选择 `system` 后恢复跟随系统。
  - `system` 状态下监听 `prefers-color-scheme` 的运行时变化并即时应用；`light` / `dark` 状态下不响应系统变化。
  - 主流程顶栏、首页、欢迎页共用一个 44px 主题入口；入口图标表达当前偏好，打开「外观模式」弹层完成三态选择，选中项同时使用边框、勾选图标与文字表达。
  - 暗色模式补齐 `html` / `body` 根背景、根文字色、焦点环、`group-hover` / `focus` 颜色类映射，覆盖页面、弹层、表单、导航、按钮、提示与状态反馈。
  - 新增 `npm run theme:check` 守卫，将「新增颜色类必须有夜间映射或进入安全清单」变为可执行门禁。
  - 本机契约仍为 `localStorage.theme-mode`，新增 `system` 取值；`data-theme-mode` 表示实际生效模式，`data-theme-preference` 表示用户偏好。
- Review 重点:
  - 三态优先级、默认策略与旧值兼容。
  - 系统偏好实时联动边界，以及 `matchMedia` / `addListener` 能力降级。
  - 主题入口可访问性、弹层焦点回归、选中态非颜色冗余。
  - 暗色对比度、根背景、弹层/导航/表单/提示覆盖与 375px 既有布局限制。
  - 存储不可用时的会话兜底，以及主题切换不改变路由、购物车、订单与网络状态。
  - `theme:check` 守卫的误报/漏报边界与安全清单维护责任。

## Scope Note

- Implemented sections: Functional Requirements、UX Design、Data & Storage、Implementation Constraints、NFR / DFX、Test Cases、Traceability、需求打标。
- Not involved: 对外 API / SDK / Webhook / CLI、后端服务与数据库迁移、埋点与 Dashboard。
- Needs confirmation: 无阻塞项；非阻塞口径见 Open Questions（浏览器版本矩阵、入口是否增加可见文字标签）。
- Reason: 上游澄清文档已关闭业务契约；仓库与参考实现确认变更集中于前端主题状态、全局暗色映射、外观设置弹层、自动化校验与 E2E 验收。

## 需求提出 / 实现 / 验证关注映射

| 关注面 | 本 Spec 覆盖内容 | 对应章节 |
|---|---|---|
| 需求提出 | 背景增量、目标与非目标、用户场景、三态业务规则、范围边界 | 1、2、3、4 |
| 实现 | DOM 与存储契约、首屏初始化、系统监听、集中暗色映射、守卫、文件影响面 | 6、10 |
| 验证 | EARS 验收、UX 状态矩阵、NFR 验证方式、测试用例、追溯矩阵 | 4、5、8、11、13 |

---

# Spec: 需求规格书（Spec) — 主题体验增强（白天 / 夜间 / 跟随系统）

## 1. Context

- 上游需求澄清：`docs/需求澄清.md` v2（需求负责人确认将原「支持白天和夜间模式」升级为「主题体验增强」，整体优先级 P2）。
- 上游产品文档：`docs/PRD 文档.md`、`docs/参考代码变更说明.md`。
- 目标仓库：`seth-zou/GitHub-Restaurant-Order`；基线 `main` @ `58ee88a`；工作分支 `feat/93300da1-55b2`。
- 已交付基线：双主题、系统偏好默认、本机持久化与主题 E2E 已合入 `main`（PR #1）。

本 Spec 相对上游文档的增量：

- 将三态偏好、系统实时联动、入口弹层、暗色缺口修复与覆盖守卫固化为开发、测试、部署共同遵守的执行契约。
- 关闭澄清文档 TD-1：本次继续使用 Tailwind `darkMode: 'class'` 与 `src/index.css` 集中暗色映射，不引入 CSS 变量 / token 体系；新增颜色类由守卫命令约束。
- 关闭澄清文档 TD-2：系统偏好监听兼容 `addEventListener` 与旧版 `addListener`；能力不可用时按白天模式渲染。
- 明确原始「支持白天和夜间模式」的五条验收标准在新三态模型下的对应关系，避免下游只实现三态而遗漏双主题基线能力。

## 2. Goals and Non-Goals

### Goals

- 让「跟随系统」成为可长期保持的用户状态，并在系统偏好变化时自动跟随。
- 让用户在任一主流程视图都能找到主题入口，并在一个弹层内看清当前偏好、当前设备偏好与当前生效模式。
- 让夜间模式覆盖页面、弹层、表单、导航、按钮、提示与状态反馈，保持可读、可识别、无浅色残留。
- 用自动化守卫防止新增颜色类再次造成夜间映射缺失。
- 保证主题切换只影响视觉呈现，不改变路由、桌台、购物车、订单、服务与支付状态，不发起网络请求。

### Non-Goals

- 不做自定义主题色、品牌主题包、主题市场。
- 不做按时间 / 日出日落自动切换、按页面独立主题。
- 不做账号级同步、跨设备同步、服务端存储、埋点或第三方主题服务。
- 不改造老人模式机制，不与老人模式合并为同一开关。
- 不在本次修复顶栏在 375px 下的既有横向溢出（记录为已知问题，另立需求）。

## 3. Glossary

| 术语 | 定义 |
|---|---|
| 偏好（preference） | 用户选择并持久化的主题意愿，取值为 `system`、`light`、`dark`。 |
| 生效模式（resolved） | 当前实际渲染的界面模式，取值为 `light`、`dark`。 |
| 系统偏好 | 操作系统 / 浏览器的 `prefers-color-scheme` 查询结果。 |
| 外观模式弹层 | 点击主题入口后打开的三态选择弹层，标题为「外观模式 / Appearance」。 |
| 集中暗色映射 | `src/index.css` 中以 `.dark` 选择器集中定义的色值映射，而非在每个组件内写 `dark:` 变体。 |
| 安全清单 | `scripts/check-theme-coverage.mjs` 中显式登记、说明原因的深色底安全颜色类。 |
| 会话兜底 | `localStorage` 不可用时，本次页面会话内保存于内存的偏好。 |

## 4. Functional Requirements

### REQ-101: 三态主题偏好与默认策略

- User Story: 作为用户，我希望能选择「跟随系统 / 白天 / 夜间」，以便让界面亮度符合当下环境，而不是被固定在某一态。
- Priority: P0（交付内相对优先级；整体需求优先级 P2）
- Description: 应用维护一个用户偏好，取值为 `system`、`light`、`dark`，默认 `system`。无有效保存值时按系统偏好解析；系统偏好不可用时解析为 `light`。用户显式选择后优先使用该偏好。

Acceptance Requirements (EARS):

- REQ-101.1: When 本地无有效 `theme-mode` 且系统偏好为 dark，the system shall 以 `system` 偏好渲染夜间模式。
- REQ-101.2: When 本地无有效 `theme-mode` 且系统偏好为 light、未声明或能力不可用，the system shall 渲染白天模式。
- REQ-101.3: When 本地保存值为 `light` 或 `dark`，the system shall 优先应用该保存值并忽略系统偏好。
- REQ-101.4: When 本地保存值为 `system`，the system shall 按当前系统偏好解析生效模式。
- REQ-101.5: When `theme-mode` 为非法值，the system shall 将其视为未保存并按默认策略解析。
- REQ-101.6: When 用户显式选择任一偏好，the system shall 立即应用并写入本机存储。
- REQ-101.7: The system shall 在 `html` 上同步 `data-theme-mode`（生效模式）与 `data-theme-preference`（用户偏好），并同步 `meta[name="theme-color"]`。

Gherkin:

```gherkin
Scenario: 首次访问跟随系统
  Given 本地未保存 theme-mode
  And 系统 prefers-color-scheme 为 dark
  When 用户进入应用
  Then 生效模式为夜间
  And 用户偏好为 system

Scenario: 显式选择优先于系统
  Given 系统 prefers-color-scheme 为 dark
  And 本地 theme-mode 为 light
  When 用户进入应用
  Then 生效模式为白天
```

### REQ-102: 跟随系统实时联动

- User Story: 作为选择「跟随系统」的用户，我希望设备切换深浅色后界面自动跟随，而不必手动再选一次。
- Priority: P0
- Description: 当偏好为 `system` 时，应用监听 `prefers-color-scheme` 变化并即时更新界面；偏好为 `light` / `dark` 时不响应系统变化。切回 `system` 时立即按当前系统偏好渲染并继续监听。

Acceptance Requirements (EARS):

- REQ-102.1: While 偏好为 `system`，When 系统偏好发生变化，the system shall 立即更新生效模式、`html.dark`、`data-theme-mode` 与 `meta[name="theme-color"]`。
- REQ-102.2: While 偏好为 `light` 或 `dark`，When 系统偏好发生变化，the system shall 保持当前生效模式不变。
- REQ-102.3: When 用户从显式偏好切回 `system`，the system shall 立即按当前系统偏好渲染并继续监听后续变化。
- REQ-102.4: If 系统偏好监听能力不可用，the system shall 保持白天模式且不抛错、不阻断手动切换。
- REQ-102.5: When 运行环境仅提供旧版 `MediaQueryList.addListener`，the system shall 仍能接收系统偏好变化。

Gherkin:

```gherkin
Scenario: 跟随系统时自动切换
  Given 用户偏好为 system 且系统为 light
  When 系统切换为 dark
  Then 界面立即切换为夜间模式
  And 用户偏好仍为 system
```

### REQ-103: 主题入口与外观设置弹层

- User Story: 作为用户，我希望在主界面找到主题入口，并清楚看到当前选择，以便快速切换。
- Priority: P0
- Description: 主流程顶栏、首页与欢迎页提供同一语义的主题入口。入口为 44×44px 图标按钮，图标表示当前偏好（跟随系统 / 白天 / 夜间），可访问名称说明当前偏好与「打开设置」。点击打开「外观模式」弹层，提供三个互斥选项、当前设备偏好说明与当前生效模式说明。

Acceptance Requirements (EARS):

- REQ-103.1: The system shall 在 `#/home`、`#/welcome`、`#/menu`、`#/order`、`#/checkout` 提供可见、可聚焦、可触发的主题入口。
- REQ-103.2: When 用户打开主题入口，the system shall 展示「跟随系统 / 白天 / 夜间」三个互斥选项，并标记当前偏好。
- REQ-103.3: When 用户选择任一选项，the system shall 立即应用该偏好并关闭弹层。
- REQ-103.4: When 弹层展示「跟随系统」选项，the system shall 显示当前设备实际偏好（白天 / 夜间）。
- REQ-103.5: When 用户按 Esc 或关闭按钮，the system shall 关闭弹层并将焦点返回主题入口。
- REQ-103.6: When 当前语言为中文或英文，the system shall 使用对应语言的入口名称、选项与说明文案。
- REQ-103.7: The system shall 通过图标、勾选标记和文字共同表达选中态，不仅依赖颜色。
- REQ-103.8: When 主题切换完成，the system shall 不产生布局跳动或路由变化。
- REQ-103.9: The system shall 保证入口触控目标不小于 44×44px，并提供可见的键盘焦点环。

Gherkin:

```gherkin
Scenario: 打开外观模式并切换
  Given 用户处于点餐页且偏好为 system
  When 用户打开主题入口并选择「夜间」
  Then 界面立即渲染夜间模式
  And 弹层关闭且焦点回到主题入口
  And 用户偏好变为 dark
```

### REQ-104: 全站暗色一致性与可读性

- User Story: 作为暗光环境用户，我希望所有页面、弹层与状态在夜间模式下都清晰可读，不出现刺眼的浅色残留。
- Priority: P0
- Description: 夜间模式覆盖页面底色、卡片、弹层、Toast、底部导航、主 CTA、表单、状态徽章和图片遮罩。`html` 与 `body` 在夜间模式下都使用暗色基线；文本、价格、状态与按钮文案保持 WCAG AA；焦点可见；状态不以颜色为唯一载体。

Acceptance Requirements (EARS):

- REQ-104.1: When 夜间模式激活，the system shall 使 `html`、`body`、页面容器均使用暗色背景，短页面与滚动越界不露出浅色底。
- REQ-104.2: When 夜间模式展示正文、价格、订单状态、售罄提示、风险提示或按钮文案，the system shall 保持不低于 WCAG AA 的对比度（普通文本 ≥ 4.5:1，大字号文本 ≥ 3:1）。
- REQ-104.3: When 夜间模式使用键盘焦点，the system shall 显示可辨识的焦点环，且焦点环与背景对比可辨。
- REQ-104.4: When 夜间模式展示图片、遮罩、状态标识或辅助说明，the system shall 保证关键信息不被遮挡，且不以颜色作为唯一识别方式。
- REQ-104.5: When 夜间模式展示表单输入、占位符、禁用态、错误态或选中态，the system shall 保持文字、边框与控件可识别。
- REQ-104.6: If 任一页面或组件出现未映射的浅色块、低对比文本或不可读控件，the system shall 视为不满足本需求。

Gherkin:

```gherkin
Scenario: 夜间模式根背景与弹层
  Given 夜间模式已激活
  When 用户打开外观设置、服务、购物车或演示控制台弹层
  Then html 与 body 背景均为暗色
  And 弹层表面、文字、边框与选中态保持可读
```

### REQ-105: 主题覆盖守卫与维护契约

- User Story: 作为研发与设计协作者，我希望新增颜色类时能自动发现夜间映射缺失，避免暗色适配随迭代劣化。
- Priority: P1
- Description: 仓库提供 `npm run theme:check`，扫描 `src/**/*.{ts,tsx}` 中的自定义色板颜色工具类，校验其存在 `.dark` 映射或属于「深色底安全清单」；存在遗漏时以非零退出码失败并输出类名与文件位置。新增组件必须复用已映射语义类，或同步扩展集中映射。

Acceptance Requirements (EARS):

- REQ-105.1: When 执行 `npm run theme:check`，the system shall 在全部颜色类均有映射或安全归类时以 0 退出。
- REQ-105.2: If 存在未映射且未归类的新增颜色类，the system shall 以非零退出码失败并列出类名与文件。
- REQ-105.3: When 新增颜色类属于深色底安全语义，the system shall 要求在同一脚本的安全清单中显式登记并说明原因。
- REQ-105.4: The system shall 不在运行时引入额外网络请求或第三方依赖完成该校验。
- REQ-105.5: The system shall 保持「集中暗色映射」为唯一暗色色值来源，不在组件内新增分散的硬编码暗色值。

Gherkin:

```gherkin
Scenario: 新增未映射颜色类被拦截
  Given 组件中新增 bg-brand-300 且未在 .dark 映射
  When 执行 npm run theme:check
  Then 命令失败并输出 bg-brand-300 与所在文件
```

### REQ-106: 降级、兼容与隐私

- User Story: 作为使用受限浏览器或隐私模式的用户，我希望主题功能不可用时也不影响点餐。
- Priority: P1
- Description: 本机存储不可用时降级为当前页面会话内存态；系统偏好能力不可用时回退白天；历史 `light` / `dark` 值继续有效；主题偏好不上报、不同步。

Acceptance Requirements (EARS):

- REQ-106.1: If `localStorage` 读取或写入不可用，the system shall 在当前页面会话内继续支持三态切换，不出现用户可见错误。
- REQ-106.2: When 本机存储写入失败后用户继续切换，the system shall 优先使用本次会话选择，而不是旧存储值。
- REQ-106.3: If `matchMedia` 不可用，the system shall 以白天模式渲染并保持手动切换可用。
- REQ-106.4: The system shall 不向网络或后端发送主题偏好，不新增 Cookie 或埋点。
- REQ-106.5: When 应用加载，the system shall 在 React 挂载前完成主题判定，避免可见闪烁。
- REQ-106.6: The system shall 兼容历史 `theme-mode=light` / `dark`，不要求用户重新选择。

Gherkin:

```gherkin
Scenario: 存储不可用
  Given 浏览器禁止 localStorage
  When 用户切换到夜间模式并继续点餐
  Then 当前会话保持夜间模式
  And 页面无存储错误提示
  And 点餐与提交订单可继续完成
```

### REQ-107: 业务流程与路由不受影响

- User Story: 作为用户，我希望切换主题不会打断我正在进行的点餐。
- Priority: P0
- Description: 主题切换只改变视觉呈现，不改变路由、桌台、购物车、订单、服务请求与结账状态，不触发网络请求或数据重置。

Acceptance Requirements (EARS):

- REQ-107.1: When 用户在任一视图切换主题，the system shall 保持当前 URL、桌台与购物车内容不变。
- REQ-107.2: When 用户在订单或结账流程切换主题，the system shall 不重置订单、支付方式或履约进度。
- REQ-107.3: When 主题切换完成，the system shall 不产生控制台错误。
- REQ-107.4: When 用户在浅色与夜间模式分别完成主流程，the system shall 产生一致的业务结果。
- REQ-107.5: When 主题切换完成，the system shall 不发起新的网络请求、不改变页面滚动位置与关键元素布局尺寸。

Gherkin:

```gherkin
Scenario: 切换主题不打断点餐
  Given 用户已加入锅底并停留在点餐页
  When 用户切换到夜间模式
  Then 购物车内容与桌台信息保持不变
  And URL 仍为 #/menu
```

## 5. UX Design

### 5.1 体验目标与设计原则

- 一眼可辨：入口图标与弹层选中标记共同表达当前偏好，不让用户猜测。
- 即时反馈：选择后立即生效，无需刷新；颜色过渡沿用既有 250ms，不触发布局变化。
- 一处选择：三个互斥选项在同一弹层完成，避免多次跳转。
- 两种模式一致：页面结构、信息层级与操作路径不因主题改变。
- 可访问：键盘、读屏、触控与低对比度场景均可完成主题选择。

### 5.2 入口位置与范围

| 位置 | 形态 | 交互 | 约束 |
|---|---|---|---|
| `#/home`、`#/welcome` | 右上角浮动图标按钮 | 打开「外观模式」弹层 | 不遮挡桌台选择、欢迎页主 CTA |
| `#/menu`、`#/order`、`#/checkout` | 主流程顶栏图标按钮 | 打开「外观模式」弹层 | 与语言、老人模式、服务、演示控制台共存；保持 44×44px |
| 外观模式弹层 | 移动端贴底、桌面端居中 | 选择三态之一后立即生效并关闭 | 关闭后焦点回到入口；最大宽度 512px |

### 5.3 弹层结构

1. 标题：外观模式 / Appearance。
2. 说明：选择界面亮度；「跟随系统」会随设备设置自动切换。
3. 三个互斥选项：跟随系统 / 白天 / 夜间。
   - 跟随系统：显示「当前设备：白天 / 夜间」。
   - 当前选中项：辣红边框 + 浅辣红底 + 勾选图标 + 文字加粗。
4. 底部状态：当前界面：白天 / 夜间。

### 5.4 状态矩阵

| 用户偏好 | 系统偏好 | 生效模式 | 入口图标 | 弹层选中项 | 入口可访问名称示例 |
|---|---|---|---|---|---|
| `system` | dark | 夜间 | Monitor | 跟随系统（当前设备：夜间） | 外观模式：跟随系统，打开设置 |
| `system` | light / 不可用 | 白天 | Monitor | 跟随系统（当前设备：白天） | 外观模式：跟随系统，打开设置 |
| `light` | 任意 | 白天 | Sun | 白天 | 外观模式：白天，打开设置 |
| `dark` | 任意 | 夜间 | Moon | 夜间 | 外观模式：夜间，打开设置 |

### 5.5 文案（zh / en）

| Key | 中文 | English |
|---|---|---|
| `common.theme_title` | 外观模式 | Appearance |
| `common.theme_system` | 跟随系统 | Follow system |
| `common.theme_light` | 白天 | Light |
| `common.theme_dark` | 夜间 | Dark |
| `common.theme_entry` | 外观模式：{{mode}}，打开设置 | Appearance: {{mode}}. Open settings |
| `common.theme_system_hint` | 当前设备：{{mode}} | Device currently: {{mode}} |
| `common.theme_current` | 当前界面：{{mode}} | Current interface: {{mode}} |
| `common.theme_desc` | 选择界面亮度。“跟随系统”会随设备设置自动切换。 | Choose interface brightness. “Follow system” switches automatically with your device. |

### 5.6 交互与异常路径

- 打开：点击入口、键盘 Enter / Space；弹层出现后焦点进入弹层。
- 选择：点击选项或键盘操作；立即应用偏好、关闭弹层、焦点回到入口。
- 关闭：关闭按钮、Esc；不改变当前偏好。
- 系统偏好变化：仅 `system` 下更新界面；弹层若打开，当前设备提示与底部当前界面同步更新。
- 存储失败：仍可切换，界面不出现错误提示；会话内保持一致。
- 系统能力缺失：按白天模式渲染；手动切换仍可用。
- 首屏：在 React 挂载前完成主题判定；刷新不出现明显浅色闪烁。

### 5.7 视觉与响应式约束

- 入口与选项触控目标不小于 44×44px；焦点环使用辣红色并在两种模式下可见。
- 选中态不能只靠颜色：必须有勾选图标、`aria-checked` 与文字加粗/说明。
- 弹层、Toast、底部导航、表单控件、状态徽章在两种模式下保持同一信息层级。
- 移动端 390×844 为验收基线；375px 顶栏横向溢出为既有问题，不在本次范围。
- 主题切换仅触发颜色过渡，不改变字号、间距、定位或滚动位置。

## 6. Data & Storage

| 对象 | 契约 | 校验 / 优先级 | 兼容性 |
|---|---|---|---|
| `localStorage.theme-mode` | `system` / `light` / `dark` | 显式选择 > 系统偏好 > 白天；非法值按未保存处理 | 历史 `light` / `dark` 继续有效 |
| `html.dark` | 夜间模式唯一全局类 | 随生效模式同步 | 复用 Tailwind `darkMode: 'class'` |
| `data-theme-mode` | `light` / `dark` | 表示实际生效模式 | 既有测试与排查入口 |
| `data-theme-preference` | `system` / `light` / `dark` | 表示用户偏好 | 本次新增 |
| `meta[name="theme-color"]` | light `#fbf5ea` / dark `#12100d` | 随生效模式同步 | 浏览器地址栏配色 |
| 初始化时机 | React 挂载前 | `index.html` 内联脚本 + 模块加载时同步 | 不引入阻塞请求 |
| 会话兜底 | 模块级内存变量 | `localStorage` 读写失败时使用 | 仅当前页面会话；整页刷新后按默认策略 |

迁移与回滚：

- 不迁移历史数据；旧值直接可用。
- 回滚时遗留的 `theme-mode=system` 会被旧版本视为非法值，回退系统偏好或白天，不阻塞业务。
- 主题偏好仅存在于本设备浏览器，不构成服务端契约，不参与账号同步。

## 7. Backend / API / Metrics

### 7.1 API Design

本需求不涉及对外 API、SDK、Webhook、CLI 或客户集成契约变更。

### 7.2 Backend / Data

本需求不涉及后端行为、服务端数据结构、数据库存储、权限、状态流转或迁移变更。`localStorage.theme-mode` 属于前端本机偏好，不是服务端数据契约。

### 7.3 Metrics

本需求不涉及新增或变更埋点、日志、Dashboard 或指标口径。

## 8. NFR / DFX

| 类别 | 要求 | 验收方法 |
|---|---|---|
| 可访问性 | 正文与关键状态满足 WCAG AA；焦点可见；触控目标 44×44px；选中态不只用颜色；读屏可获知当前偏好 | E2E 对比度抽样 + 键盘/读屏人工检查 |
| 兼容性 | 现代主流浏览器；`matchMedia` 不可用回退白天；`addEventListener` 不可用时使用 `addListener`；`localStorage` 不可用降级会话内存态；hash 路由与 GitHub Pages 子路径不受影响 | Playwright 多场景 + 能力 mock + 构建配置核对 |
| 性能 | 主题判定在首屏渲染前完成；切换仅触发颜色过渡；不新增网络请求；不产生明显布局偏移 | 构建产物核对 + E2E 网络/布局断言 + 人工首屏观察 |
| 可维护性 | 单一暗色映射源（`src/index.css`）+ `npm run theme:check` 守卫；安全清单每项必须说明原因；不新增未登记颜色 | 守卫命令通过 + Code Review |
| 安全与隐私 | 不采集、不上报、不同步主题偏好；不新增 Cookie / 埋点 / 第三方 | 代码检索 + 网络请求断言 |
| 发布与回滚 | 随前端版本发布，无数据库迁移；回滚仅移除入口与三态状态逻辑；旧值兼容 | 构建 + 回滚说明复核 |

## 9. 原始验收标准映射

| 原始验收标准 | 本 Spec 对应 |
|---|---|
| 可在不同页面间切换白天/夜间模式，切换后页面渲染一致 | REQ-103、REQ-104、REQ-107；TC-101、TC-108 |
| 刷新或重新进入后，用户上次选择的主题仍生效 | REQ-101、REQ-106；TC-106 |
| 系统偏好为暗色时首次进入默认夜间；用户手动切换后以用户选择为准 | REQ-101、REQ-102；TC-103、TC-104、TC-105 |
| 关键页面、组件和交互状态在两种模式下无遮挡、重叠、低对比度或不可读 | REQ-104；TC-108、TC-109、TC-110 |
| 主题切换不产生控制台错误，核心业务流程可正常完成 | REQ-107；TC-112、TC-115 |

## 10. Implementation Constraints

> 本节只固化实现必须遵守的契约与边界，不替代任务拆分。

### 10.1 架构与依赖

- 复用现有 `useThemeMode`、`ThemeToggle`、`Dialog`、`Button`、i18n 与 Playwright 体系；不新增 UI 库、状态库或主题库。
- 主题状态为模块级单例 + `useSyncExternalStore`，保证同一页面多个入口共享同一状态；如改为 Context，必须保持外部行为与 DOM 契约不变。
- 不修改 `server/`，不新增后端 API，不引入网络请求。
- 不改造老人模式机制；主题与老人模式可叠加，互不覆盖。

### 10.2 DOM 与首屏契约

- `index.html` 内联脚本在 React 挂载前读取 `localStorage.theme-mode`，仅接受 `system` / `light` / `dark`；非法值按默认策略。
- 内联脚本同步设置 `html.dark`、`data-theme-mode`、`data-theme-preference` 与 `meta[name="theme-color"]`。
- `useThemeMode` 模块加载时再次同步 DOM，覆盖内联脚本与运行时状态不一致的情况。
- `data-theme-mode` 永远是生效模式（`light` / `dark`）；`data-theme-preference` 永远是用户偏好（`system` / `light` / `dark`），不得混用。

### 10.3 系统监听与降级

- 使用 `matchMedia('(prefers-color-scheme: dark)')`；优先 `addEventListener('change')`，不可用时回退 `addListener`。
- 系统变化只更新 `systemTheme`；仅当偏好为 `system` 时改变生效模式；显式偏好下保持生效模式不变。
- `matchMedia` 不存在或调用抛错时，系统偏好按 `light` 处理，不抛错。
- 监听器在订阅时确保注册；不重复注册同一 `MediaQueryList`。

### 10.4 存储与降级

- 读写 `localStorage` 必须 `try/catch`；读取失败按未保存处理；写入失败写入会话兜底。
- 写入成功后清空会话兜底，避免旧兜底覆盖新保存值。
- 会话兜底跨 hash 路由组件重挂载保持；整页刷新后按默认策略，符合 REQ-106。
- 不新增 Cookie、IndexedDB、服务端同步或跨设备同步。

### 10.5 样式与守卫

- 继续使用 Tailwind `darkMode: 'class'`；夜间色值集中在 `src/index.css` 的 `.dark` 映射。
- 新增颜色工具类必须满足其一：在 `.dark` 中有对应映射；或登记到 `SAFE_ON_DARK` 并说明「深色底安全」原因。
- 守卫扫描 `src/**/*.{ts,tsx}` 的自定义色板与 white/black 颜色类；失败必须非零退出并输出类名与文件。
- 不新增 `dark:` 变体作为绕过集中映射的主要手段；如需例外，必须在 Code Review 中说明。
- 暗色映射至少覆盖：根背景/文字、卡片、弹层、底部导航、Toast、输入框/占位符、按钮、徽章、状态、焦点环、hover/focus 颜色。

### 10.6 入口与可访问性

- 入口为 44×44px 图标按钮；图标映射：`system` → Monitor、`light` → Sun、`dark` → Moon。
- 可访问名称必须包含当前偏好与「打开设置」语义；中英文同步。
- 弹层使用 `role="radiogroup"` + 三个 `role="radio"`，`aria-checked` 表达选中。
- 选择后立即应用并关闭；Esc / 关闭按钮关闭；焦点回到入口。
- 选中态使用边框、勾选图标、文字加粗或说明，不能只靠颜色。

### 10.7 影响面（仓库证据）

| 模块 / 文件 | 影响 |
|---|---|
| `src/hooks/useThemeMode.ts` | 三态状态、系统监听、存储降级、DOM 同步 |
| `src/components/ThemeToggle.tsx` | 入口图标、可访问名称、外观模式弹层、三态选项 |
| `src/components/TopBar.tsx` / `HomeView.tsx` / `WelcomeView.tsx` | 入口挂载位置 |
| `src/index.css` | 集中暗色映射、根背景/文字、焦点环、hover/focus |
| `index.html` | 挂载前主题判定与 DOM 属性 |
| `src/i18n.ts` | 中英文主题文案 |
| `e2e/theme-mode.spec.ts` | 主题验收用例 |
| `scripts/check-theme-coverage.mjs` | 颜色类覆盖守卫 |
| `package.json` | `theme:check` 脚本 |
| `AGENTS.md` / `docs/*` | 仓库约定与产品文档同步 |

不受影响：`server/`、订单 reducer、路由 hook、菜单静态数据、GitHub Pages 部署流程。

## 11. Test Cases

> 用例以行为验收为目标；实现时可映射到现有 `e2e/theme-mode.spec.ts`，新增页面必须同步补充主题覆盖。

### 11.1 测试环境与数据

- 视图：`#/home`、`#/welcome`、`#/menu`、`#/order`、`#/checkout`。
- 系统偏好：`dark`、`light`、`no-preference`、`matchMedia` 不可用、仅 `addListener` 可用。
- 存储：无保存值、`light`、`dark`、`system`、非法值、读取抛错、写入抛错。
- 视口：桌面 1280×720、移动端 390×844。
- 语言：中文、英文；老人模式：开 / 关。
- 自动化基线：仓库 Playwright Chromium；其他主流浏览器按能力检测与人工抽查。

### 11.2 用例清单

| ID | 覆盖 REQ | 场景 / 步骤 | 预期结果 | 类型 |
|---|---|---|---|---|
| TC-101 | REQ-103、REQ-107 | 依次进入五个视图，定位主题入口，键盘聚焦、打开弹层并选择白天/夜间 | 入口可见、可用、可聚焦；弹层显示三个互斥选项；切换后 URL 不变 | E2E |
| TC-102 | REQ-107 | 在 `#/menu` 加入锅底并记录桌台、购物车，然后切换主题 | 桌台、购物车、URL、滚动位置保持不变 | E2E |
| TC-103 | REQ-101、REQ-106 | 无保存值，分别模拟系统 dark / light / no-preference / `matchMedia` 不可用 | 分别渲染夜间 / 白天 / 白天 / 白天；偏好为 `system` | E2E |
| TC-104 | REQ-101 | 系统 dark 时保存 `light`；保存 `dark`；保存 `system`；保存非法值 | 分别白天、夜间、跟随系统、按默认策略；非法值不报错 | E2E |
| TC-105 | REQ-102 | 偏好 `system` 时运行时切换 light ↔ dark；切换为显式 `light` 后再改系统 | 前者即时联动；后者保持显式模式；切回 `system` 后恢复联动 | E2E |
| TC-106 | REQ-101、REQ-106 | 分别选择 `system` / `light` / `dark` 后刷新页面并重新进入 | 三态偏好与生效模式均保持；`localStorage` 值正确 | E2E |
| TC-107 | REQ-106 | 模拟 `localStorage` 读取抛错；模拟写入抛错并继续切换、跨路由 | 读取失败按默认策略；写入失败会话内保持；无错误提示；点餐可继续 | E2E |
| TC-108 | REQ-104 | 夜间模式遍历五个视图，检查 `html` / `body` 背景、标题、分类、输入框、产品卡 | 根背景为暗色；关键文字对比度 ≥ 4.5:1；无浅色残留 | E2E |
| TC-109 | REQ-104 | 夜间模式打开外观弹层、服务弹层、演示控制台、购物车、底部导航、Toast、状态徽章 | 表面、文字、边框、遮罩、状态均可读；无遮挡或重叠 | E2E + 人工 |
| TC-110 | REQ-103、REQ-104 | 键盘打开/关闭弹层、Esc、焦点回归；夜间模式操作服务弹层 | 焦点可见并回到入口；弹层可操作；无键盘陷阱 | E2E |
| TC-111 | REQ-103、REQ-104 | 切换英文，检查入口与三选项文案；开启老人模式并保持夜间 | 中英文同步；字号按老人模式放大；主题保持 | E2E |
| TC-112 | REQ-107 | 分别在白天/夜间完成 首页 → 欢迎 → 点餐 → 订单 → 结账 → 后退 | 业务结果一致；主题保持；路由正确 | E2E |
| TC-113 | REQ-105 | 执行 `npm run theme:check`；临时新增未映射颜色类后再次执行 | 正常时 0 退出；缺失时非零退出并输出类名与文件 | 命令门禁 |
| TC-114 | REQ-101、REQ-102 | 检查 `html.dark`、`data-theme-mode`、`data-theme-preference`、`meta[theme-color]` | 四者与偏好/生效模式一致；系统变化时同步更新 | E2E |
| TC-115 | REQ-107 | 监听 `console.error`、`pageerror`、网络请求；切换主题并完成核心流程 | 无控制台错误、无新增网络请求、无数据重置 | E2E |
| TC-116 | REQ-103 | 检查入口图标、可访问名称、弹层选中项、勾选图标、`aria-checked` | 当前偏好可辨；选中态不只依赖颜色 | E2E + 人工 |
| TC-117 | REQ-103、REQ-107 | 切换主题前后比较关键元素 bounding box 与 `scrollWidth` | 无布局跳动；375px 既有溢出不被本次扩大（已知限制单独记录） | E2E + 人工 |
| TC-118 | REQ-106 | 刷新首屏观察主题判定；模拟慢速网络/模块加载 | React 挂载前已应用主题；无可见浅色闪烁 | 人工 + 录屏 |
| TC-119 | REQ-102 | 模拟仅有 `MediaQueryList.addListener` 的环境并切换系统偏好 | 仍能接收变化并更新界面 | E2E / 组件测试 |
| TC-120 | REQ-105、REQ-106 | 回滚验证：移除三态逻辑后读取遗留 `theme-mode=system` | 旧版本按非法值处理，回退系统偏好或白天；业务可用 | 人工 / 发布检查 |

### 11.3 通过标准

- 所有 P0 用例通过；P1 用例通过或经产品/研发确认有明确遗留项。
- `npm run theme:check` 通过；新增页面未引入未映射颜色类。
- 夜间模式关键视图与弹层无低对比、遮挡、重叠、不可读问题。
- 主题切换无控制台错误、无新增网络请求、无业务数据丢失。
- 中英文文案同步；键盘与读屏可完成主题选择。

## 12. Open Questions

| ID | 问题 | 影响 | 决议 / 建议 |
|---|---|---|---|
| OQ-101 | 是否演进为 CSS 变量 / 语义 token 体系？ | 长期维护成本；不影响本次用户可见行为 | 本次不演进；保持集中映射 + 守卫。大规模组件改造时另立技术需求。 |
| OQ-102 | 顶栏在 375px 下横向溢出（基线既有问题）是否为本次范围？ | 影响移动端入口完整可见；与主题无直接因果 | 不在本次范围；建议另立布局适配需求。 |
| OQ-103 | 是否支持按时间（日出日落）自动切换？ | 新增调度与地理信息依赖 | 本次不做；如需要另立需求并重新定义优先级。 |
| OQ-104 | 入口是否需要在图标外增加常驻可见文字标签或 tooltip？ | 影响「一眼看清当前偏好」的视觉可读性；当前以图标 + 可访问名称表达 | 默认保持现状（图标 + 可访问名称 + 弹层文字说明）；如产品要求更强可见性，追加小需求。 |
| OQ-105 | 「主流浏览器」是否需要逐版本矩阵？ | 影响兼容性验收范围 | 本次验收口径已定：Playwright Chromium 自动化 + 发布前对当前稳定版主流浏览器人工抽查；如需逐版本矩阵，另立兼容性需求。 |

## 13. Traceability

| REQ | UX / 状态 | Data / 实现契约 | NFR | 测试 |
|---|---|---|---|---|
| REQ-101 | 状态矩阵；默认策略 | `theme-mode`、`data-theme-*`、首屏脚本 | 兼容性 | TC-103, TC-104, TC-106, TC-114 |
| REQ-102 | 跟随系统联动 | 系统监听、`matchMedia` 降级 | 兼容性、性能 | TC-105, TC-114, TC-119 |
| REQ-103 | 入口位置、弹层结构、文案 | 44px、radiogroup、焦点回归 | 可访问性、性能 | TC-101, TC-110, TC-111, TC-116, TC-117 |
| REQ-104 | 暗色映射、根背景、状态 | 集中 `.dark` 映射 | 可访问性 | TC-108, TC-109, TC-110 |
| REQ-105 | 维护契约 | `theme:check`、安全清单 | 可维护性 | TC-113 |
| REQ-106 | 降级策略 | 存储 try/catch、会话兜底、旧值兼容 | 兼容性、安全隐私 | TC-103, TC-107, TC-118, TC-120 |
| REQ-107 | 业务不变 | 不触发路由/网络/状态重置 | 兼容性、性能 | TC-101, TC-102, TC-112, TC-115 |

## 14. 需求打标

按 `knowledge/template/需求打标规范.md` 的七维规则评估。

| 维度 | 结论 | 理由 |
|---|---|---|
| scope | PASS | 变更集中在 1 个前端仓库的主题状态、入口组件、全局 CSS、脚本与测试，文件数约 10 个，不超过 3 个架构层。 |
| interface | PASS | 无新增外部 API；本机存储契约与 DOM 属性明确；三态取值与优先级在本 Spec 中固定。 |
| pattern | PASS | 复用既有 `useThemeMode`、Dialog、Button、CVA、i18n、Playwright 与集中暗色映射范式。 |
| testability | PASS | 三态、联动、持久化、降级、对比度、布局与守卫均可由 Playwright、命令门禁与人工检查客观判定。 |
| dependency | PASS | 不新增依赖；仅使用仓库已有的 React、Radix Dialog、lucide-react、Playwright。 |
| safety | PASS | 仅视觉与本地偏好，不涉及支付、隐私数据、权限或不可逆数据变更；可随时回滚。 |
| closure | PASS | 单仓库闭环，无跨仓接口与发版顺序依赖。 |

- **classification: A**
- **summary**: 三态主题增强属于已有能力的延展与验证型改动，边界清晰、验证客观、风险低，适合 Agent 全自动推进后人工 Review。
- **warnSelfCheck**: 无 WARN，空数组。
- **actionPlan.ifA**: 在单仓内按本 Spec 实现三态状态管理、外观设置弹层、暗色缺口修复与守卫脚本，运行 lint / typecheck / build / theme:check / Playwright，全绿后提交并交付人工 Review。
- **blockers**: 无。
- **suggestions**: 主题 token 化、顶栏 375px 溢出、定时切换、入口可见文字标签分别按需另立需求。
