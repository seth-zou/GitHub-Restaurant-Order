# Review Summary

- 本次需求: 将已交付的白天/夜间双主题升级为「跟随系统 / 白天 / 夜间」三态主题体验，补齐跟随系统实时联动、可读的入口与暗色一致性守卫。
- 需求类型: UX / 前端主题状态 / 可访问性 / 本机偏好持久化 / 前端可维护性。
- 变更面: Functional Requirements、UX Design、Data & Storage、NFR / DFX、Test Cases、Traceability、需求打标；不涉及: API Design、Metrics、后端服务；待确认: 无阻塞项。
- 变更面判断依据: 需求澄清文档 v2；仓库 `AGENTS.md`、`src/hooks/useThemeMode.ts`、`src/components/ThemeToggle.tsx`、`src/index.css`、`index.html`、`e2e/theme-mode.spec.ts`；空间任务 `task-yezk3b78xsyl5rhlestd` 已交付双主题基线。
- 差异判断: 产品形态 / 站点 / 环境 / 版本差异——不涉及新增差异。依据：单仓 React SPA、hash 路由、GitHub Pages 子路径部署，无原生端、多站点或后端业务链路。
- 本次变更关键信息:
  - 偏好模型由二态扩展为三态 `system | light | dark`，默认 `system`；用户显式选择始终优先，选择 `system` 后恢复跟随。
  - `system` 状态下运行时监听 `prefers-color-scheme` 并即时应用；`light` / `dark` 下不响应系统变化。
  - 主题入口保持 44px 图标按钮，点击打开「外观模式」弹层完成三态选择；选中项同时使用边框、勾选图标与文字提示，不只依赖颜色。
  - 修复暗色下 `html` 根背景与根文字色仍为浅色基线的问题，补齐焦点环与 `group-hover` / `focus` 颜色类映射。
  - 新增 `npm run theme:check` 主题覆盖守卫，将「新增颜色类必须有夜间映射或进入安全清单」变成可执行门禁。
  - 本机契约仍为 `localStorage.theme-mode`，新增 `system` 取值；`data-theme-mode` 表示实际生效模式，新增 `data-theme-preference` 表示用户偏好。
- Review 重点: 三态优先级与持久化、系统联动边界、弹层可访问性、暗色对比度与根背景、旧值兼容、存储失败降级、业务流程回归。

## Scope Note

- Implemented sections: Functional Requirements、UX Design、Data & Storage、NFR / DFX、Test Cases、Traceability、需求打标。
- Not involved: API Design、Metrics、后端与数据迁移。
- Needs confirmation: 无。
- Reason: 上游澄清文档已关闭业务契约；仓库与参考实现确认变更集中于前端主题状态、全局暗色映射、外观设置弹层与自动化校验。

---

# PRD 文档：主题体验增强（白天 / 夜间 / 跟随系统）

## 1. Context

本 PRD 基于「需求澄清文档 v2」，目标仓库为 `seth-zou/GitHub-Restaurant-Order`，基线 `main` @ `58ee88a`，工作分支 `feat/93300da1-55b2`。

Spec 阶段增量：

- 关闭澄清文档的 TD-1：本次继续使用 `tailwind.config.js` 的 `darkMode: 'class'` 与 `src/index.css` 的集中暗色映射，不引入 CSS 变量 / token 体系；以守卫命令约束新增颜色类。
- 关闭 TD-2：系统偏好监听同时兼容 `addEventListener` 与旧版 `addListener`，能力不可用时回退白天模式。
- 原双主题能力已在基线中交付；本文只描述本次增强的行为契约、验收与打标，不重复历史实现说明。

## 2. Goals and Non-Goals

- Goals：
  - 让「跟随系统」成为可长期保持的用户状态，并在系统偏好变化时自动跟随。
  - 让主题入口与设置弹层清晰表达「当前偏好」和「当前生效模式」。
  - 用自动化守卫防止暗色映射随新增页面/组件再次失配。
- Non-Goals：
  - 不做自定义主题色、品牌主题包、主题市场。
  - 不做定时切换、日出日落切换、按页面独立主题。
  - 不做账号级 / 跨设备同步、服务端存储、埋点。
  - 不改造老人模式机制；不与老人模式合并为同一开关。
  - 不在本次修复顶栏 375px 横向溢出的既有布局问题（见 OQ-102）。

## 3. Functional Requirements

### REQ-101: 三态主题偏好与默认策略

- User Story: 作为用户，我希望能选择「跟随系统 / 白天 / 夜间」，以便让界面亮度符合当下环境，而不是被固定在某一态。
- Priority: P0
- Description: 应用维护一个用户偏好，取值为 `system`、`light`、`dark`，默认 `system`。无有效保存值时按系统偏好解析；系统偏好不可用时解析为 `light`。用户显式选择后优先使用该偏好。

Acceptance Requirements (EARS):

- REQ-101.1: When 本地无有效 `theme-mode` 且系统偏好为 dark，the system shall 以 `system` 偏好渲染夜间模式。
- REQ-101.2: When 本地无有效 `theme-mode` 且系统偏好为 light、未声明或能力不可用，the system shall 渲染白天模式。
- REQ-101.3: When 本地保存值为 `light` 或 `dark`，the system shall 优先应用该保存值并忽略系统偏好。
- REQ-101.4: When 本地保存值为 `system`，the system shall 按当前系统偏好解析生效模式。
- REQ-101.5: When `theme-mode` 为非法值，the system shall 将其视为未保存并按默认策略解析。
- REQ-101.6: When 用户显式选择任一偏好，the system shall 立即应用并写入本机存储。

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
- Description: 当偏好为 `system` 时，应用监听 `prefers-color-scheme` 变化并即时更新界面；偏好为 `light` / `dark` 时不响应系统变化。

Acceptance Requirements (EARS):

- REQ-102.1: While 偏好为 `system`，When 系统偏好发生变化，the system shall 立即更新生效模式、`html.dark`、`data-theme-mode` 与 `meta[name="theme-color"]`。
- REQ-102.2: While 偏好为 `light` 或 `dark`，When 系统偏好发生变化，the system shall 保持当前生效模式不变。
- REQ-102.3: When 用户从显式偏好切回 `system`，the system shall 立即按当前系统偏好渲染并继续监听后续变化。
- REQ-102.4: If 系统偏好监听能力不可用，the system shall 保持白天模式且不抛错。

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
- Description: 主流程顶栏、首页与欢迎页提供同一语义的主题入口。入口为 44px 图标按钮，图标表示当前偏好（跟随系统 / 白天 / 夜间），可访问名称说明当前偏好与「打开设置」。点击打开「外观模式」弹层，提供三个互斥选项、当前设备偏好说明与当前生效模式说明。

Acceptance Requirements (EARS):

- REQ-103.1: The system shall 在 `#/home`、`#/welcome`、`#/menu`、`#/order`、`#/checkout` 提供可见、可聚焦、可触发的主题入口。
- REQ-103.2: When 用户打开主题入口，the system shall 展示「跟随系统 / 白天 / 夜间」三个互斥选项，并标记当前偏好。
- REQ-103.3: When 用户选择任一选项，the system shall 立即应用该偏好并关闭弹层。
- REQ-103.4: When 弹层展示「跟随系统」选项，the system shall 显示当前设备实际偏好（白天 / 夜间）。
- REQ-103.5: When 用户按 Esc 或关闭按钮，the system shall 关闭弹层并将焦点返回主题入口。
- REQ-103.6: When 当前语言为中文或英文，the system shall 使用对应语言的入口名称、选项与说明文案。
- REQ-103.7: The system shall 通过图标、勾选标记和文字共同表达选中态，不仅依赖颜色。
- REQ-103.8: When 主题切换完成，the system shall 不产生布局跳动或路由变化。

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
- REQ-104.2: When 夜间模式展示正文、价格、订单状态、售罄提示、风险提示或按钮文案，the system shall 保持不低于 WCAG AA（4.5:1）的对比度。
- REQ-104.3: When 夜间模式使用键盘焦点，the system shall 显示可辨识的焦点环，且焦点环与背景对比可辨。
- REQ-104.4: When 夜间模式展示图片、遮罩、状态标识或辅助说明，the system shall 保证关键信息不被遮挡，且不以颜色作为唯一识别方式。
- REQ-104.5: If 任一页面或组件出现未映射的浅色块、低对比文本或不可读控件，the system shall 视为不满足本需求。

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

Gherkin:

```gherkin
Scenario: 切换主题不打断点餐
  Given 用户已加入锅底并停留在点餐页
  When 用户切换到夜间模式
  Then 购物车内容与桌台信息保持不变
  And URL 仍为 #/menu
```

## 4. UX Design

### 入口位置

| 位置 | 形态 | 交互 | 约束 |
|---|---|---|---|
| `#/home`、`#/welcome` | 右上角浮动图标按钮 | 打开外观设置弹层 | 不遮挡桌台选择与进入点餐 |
| `#/menu`、`#/order`、`#/checkout` | 主流程顶栏图标按钮 | 打开外观设置弹层 | 与语言、老人模式、服务、演示控制台共存，保持 44×44px |
| 外观设置弹层 | 移动端贴底、桌面端居中 | 选择三态之一后立即生效 | 关闭后焦点回到入口 |

### 弹层结构

1. 标题：外观模式。
2. 说明：选择界面亮度；“跟随系统”会随设备设置自动切换。
3. 三个互斥选项：跟随系统 / 白天 / 夜间。
   - 跟随系统：显示「当前设备：白天 / 夜间」。
   - 当前选中项：辣红边框 + 浅辣红底 + 勾选图标 + 文字加粗。
4. 底部状态：当前界面：白天 / 夜间。

### 状态矩阵

| 用户偏好 | 系统偏好 | 生效模式 | 入口图标 | 弹层选中项 |
|---|---|---|---|---|
| `system` | dark | 夜间 | Monitor | 跟随系统（当前设备：夜间） |
| `system` | light / 不可用 | 白天 | Monitor | 跟随系统（当前设备：白天） |
| `light` | 任意 | 白天 | Sun | 白天 |
| `dark` | 任意 | 夜间 | Moon | 夜间 |

### 文案（zh / en）

| Key | 中文 | English |
|---|---|---|
| `common.theme_title` | 外观模式 | Appearance |
| `common.theme_system` | 跟随系统 | Follow system |
| `common.theme_light` | 白天 | Light |
| `common.theme_dark` | 夜间 | Dark |
| `common.theme_entry` | 外观模式：{{mode}}，打开设置 | Appearance: {{mode}}. Open settings |
| `common.theme_system_hint` | 当前设备：{{mode}} | Device currently: {{mode}} |
| `common.theme_current` | 当前界面：{{mode}} | Current interface: {{mode}} |

### 交互细节

- 主题切换遵循既有 250ms 颜色过渡，不触发布局变化。
- 弹层关闭方式：关闭按钮、Esc、选择任一选项。
- 弹层使用既有 Dialog 组件，移动端贴底、桌面端居中，最大宽度 512px。
- 图标按钮保持既有 outline 变体与 focus-visible 辣红焦点环。

## 5. Data & Storage

| 对象 | 契约 | 校验 / 优先级 | 兼容性 |
|---|---|---|---|
| `localStorage.theme-mode` | `system` / `light` / `dark` | 显式选择 > 系统偏好 > 白天；非法值按未保存处理 | 历史 `light` / `dark` 继续有效 |
| `html.dark` | 夜间模式唯一全局类 | 随生效模式同步 | 复用 Tailwind `darkMode: 'class'` |
| `data-theme-mode` | `light` / `dark` | 表示实际生效模式 | 既有测试与排查入口 |
| `data-theme-preference` | `system` / `light` / `dark` | 表示用户偏好 | 本次新增 |
| `meta[name="theme-color"]` | light `#fbf5ea` / dark `#12100d` | 随生效模式同步 | 浏览器地址栏配色 |
| 初始化时机 | React 挂载前 | `index.html` 内联脚本 + 模块加载时同步 | 不引入阻塞请求 |

迁移与回滚：

- 不迁移历史数据；旧值直接可用。
- 回滚时遗留的 `theme-mode=system` 会被旧版本视为非法值，回退系统偏好或白天，不阻塞业务。
- 主题偏好仅存在于本设备浏览器，不构成服务端契约。

## 6. NFR / DFX

| 类别 | 要求 | 验收方法 |
|---|---|---|
| 可访问性 | 正文与关键状态满足 WCAG AA（4.5:1）；焦点可见；触控目标 44×44px；选中态不只用颜色 | E2E 对比度抽样 + 人工键盘检查 |
| 兼容性 | 现代主流浏览器；`matchMedia` 不可用回退白天；`localStorage` 不可用降级会话内存态；hash 路由与 GitHub Pages 子路径不受影响 | Playwright 多场景 + 构建部署配置核对 |
| 性能 | 主题判定在首屏渲染前完成；切换仅触发颜色过渡；不新增网络请求 | 构建产物核对 + 人工观察 |
| 可维护性 | 单一暗色映射源（`src/index.css`）+ `npm run theme:check` 守卫；不新增未登记颜色 | 守卫命令通过 |
| 安全与隐私 | 不采集、不上报、不同步主题偏好；不新增 Cookie / 埋点 / 第三方 | 代码检索 |
| 发布与回滚 | 随前端版本发布，无数据库迁移；回滚仅移除入口与状态逻辑 | 构建 + 回滚说明 |

## 7. Test Cases

| ID | 覆盖 REQ | 场景 | 预期 | 类型 |
|---|---|---|---|---|
| TC-101 | REQ-103 | 五个视图打开入口、可聚焦、三选项可见 | 入口可达、弹层出现 | Playwright E2E |
| TC-102 | REQ-103 / REQ-107 | 切换主题后路由、桌台、购物车不变 | URL 与业务状态保持 | Playwright E2E |
| TC-103 | REQ-101 | 无保存值 + 系统 dark / light / no-preference / 能力不可用 | 分别渲染夜间 / 白天 / 白天 / 白天 | Playwright E2E |
| TC-104 | REQ-101 | 系统 dark + 保存 light；保存 system；非法值 | 分别白天、跟随系统、按默认策略 | Playwright E2E |
| TC-105 | REQ-102 | 跟随系统时运行时切换 light ↔ dark；显式选择后切换系统 | 前者联动、后者不联动 | Playwright E2E |
| TC-106 | REQ-101 / REQ-106 | 三态选择后刷新 | 偏好与生效模式保持 | Playwright E2E |
| TC-107 | REQ-106 | localStorage 读取失败、写入失败 | 会话内可切换、无错误、旧值不覆盖会话选择 | Playwright E2E |
| TC-108 | REQ-104 | 夜间模式五个视图、卡片、分类、输入、产品卡 | 暗色背景与 WCAG AA 抽样通过 | Playwright E2E |
| TC-109 | REQ-104 | 夜间模式外观弹层、服务、演示控制台、购物车、底部导航 | 弹层与导航保持暗色语义 | Playwright E2E |
| TC-110 | REQ-103 / REQ-104 | 键盘打开/关闭弹层、焦点回归、服务弹层操作 | 焦点可见、可操作 | Playwright E2E |
| TC-111 | REQ-103 | 英文环境入口与三选项文案、老人模式叠加 | 文案同步、字号 20px、夜间保持 | Playwright E2E |
| TC-112 | REQ-107 | 浅色与夜间分别完成点餐 → 订单 → 结账 → 后退 | 业务结果一致、主题保持 | Playwright E2E |
| TC-113 | REQ-105 | 执行 `npm run theme:check` | 通过；新增未映射类时失败 | 脚本门禁 |

## 8. Open Questions

| ID | 问题 | 影响 | 决议 / 建议 |
|---|---|---|---|
| OQ-101 | 是否演进为 CSS 变量 / 语义 token 体系？ | 长期维护成本；不影响本次用户可见行为 | 本次不演进；保持集中映射 + 守卫。大规模组件改造时另立技术需求。 |
| OQ-102 | 顶栏在 375px 下横向溢出（scrollWidth 530）是否为本次范围？ | 影响移动端入口完整可见；与主题无直接因果 | 不在本次范围；建议另立布局适配需求。 |
| OQ-103 | 是否支持按时间（日出日落）自动切换？ | 新增调度与地理信息依赖 | 本次不做；如需要另立需求并重新定义优先级。 |

## 9. Traceability

| REQ | UX / 状态 | NFR | 测试 |
|---|---|---|---|
| REQ-101 | 状态矩阵；存储契约 | 兼容性 | TC-103, TC-104, TC-106 |
| REQ-102 | 跟随系统联动 | 兼容性、性能 | TC-105 |
| REQ-103 | 入口位置、弹层结构、文案 | 可访问性、性能 | TC-101, TC-110, TC-111 |
| REQ-104 | 暗色映射、根背景 | 可访问性 | TC-108, TC-109 |
| REQ-105 | 维护契约 | 可维护性 | TC-113 |
| REQ-106 | 降级策略 | 兼容性、安全隐私 | TC-103, TC-107 |
| REQ-107 | 业务不变 | 兼容性、性能 | TC-102, TC-112 |

## 10. 需求打标

按 `knowledge/template/需求打标规范.md` 的七维规则评估。

| 维度 | 结论 | 理由 |
|---|---|---|
| scope | PASS | 变更集中在 1 个前端仓库的主题状态、入口组件、全局 CSS 与测试，文件数约 10 个，不超过 3 个架构层。 |
| interface | PASS | 无新增外部 API；本机存储契约与 DOM 属性明确；三态取值与优先级在 PRD 中固定。 |
| pattern | PASS | 复用既有 `useThemeMode`、Dialog、Button、CVA、i18n、Playwright 与集中暗色映射范式。 |
| testability | PASS | 三态、联动、持久化、降级、对比度均可由 Playwright 与守卫脚本客观判定。 |
| dependency | PASS | 不新增依赖；仅使用仓库已有的 React、Radix Dialog、lucide-react、Playwright。 |
| safety | PASS | 仅视觉与本地偏好，不涉及支付、隐私数据、权限或不可逆数据变更；可随时回滚。 |
| closure | PASS | 单仓库闭环，无跨仓接口与发版顺序依赖。 |

- **classification: A**
- **summary**: 三态主题增强属于已有能力的延展与验证型改动，边界清晰、验证客观、风险低，适合 Agent 全自动推进后人工 Review。
- **warnSelfCheck**: 无 WARN，空数组。
- **actionPlan.ifA**: 在单仓内按 PRD 实现三态状态管理、外观设置弹层、暗色缺口修复与守卫脚本，运行 lint / typecheck / build / theme:check / Playwright，全绿后提交并交付人工 Review。
- **blockers**: 无。
- **suggestions**: 主题 token 化、顶栏 375px 溢出、定时切换分别另立需求。

## API Design

本需求不涉及对外 API、SDK、Webhook、CLI 或客户集成契约变更。

## Metrics

本需求不涉及新增或变更埋点、日志、Dashboard 或指标口径。
