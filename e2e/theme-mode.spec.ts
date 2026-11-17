import { expect, test, type Locator, type Page } from '@playwright/test'

/**
 * 主题体验增强（白天 / 夜间 / 跟随系统）E2E 验收用例。
 *
 * 用例编号对齐 docs/需求规格书（Spec).md 第 11 章：
 * - Playwright 覆盖：TC-101 ~ TC-112、TC-114 ~ TC-117、TC-119。
 * - TC-113（npm run theme:check 命令门禁）由测试执行阶段单独运行，避免 Playwright
 *   在用例内修改 src 触发“未映射颜色类”而污染工作区。
 * - TC-118（首屏无闪烁）、TC-120（回滚后旧值兼容）为人工 / 发布核验项，不在本文件自动化。
 */

type Preference = 'system' | 'light' | 'dark'
type Resolved = 'light' | 'dark'

declare global {
  interface Window {
    /** 仅 TC-119 使用：模拟只提供 MediaQueryList.addListener 的运行环境。 */
    __setSystemDarkTheme?: (dark: boolean) => void
  }
}

const THEME_META_COLOR: Record<Resolved, string> = {
  light: '#fbf5ea',
  dark: '#12100d',
}

const DARK_ROOT_BACKGROUND = 'rgb(18, 16, 13)'
const DARK_DIALOG_BACKGROUND = 'rgb(25, 22, 18)'

const ROUTES = ['/#/home', '/#/welcome', '/#/menu', '/#/order', '/#/checkout'] as const

/** 断言 html 状态、html.dark、meta theme-color 与偏好/生效模式完全一致（TC-114 基础断言）。 */
async function expectTheme(page: Page, resolved: Resolved, preference?: Preference) {
  const root = page.locator('html')
  await expect(root).toHaveAttribute('data-theme-mode', resolved)
  if (preference) await expect(root).toHaveAttribute('data-theme-preference', preference)
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', THEME_META_COLOR[resolved])

  if (resolved === 'dark') {
    await expect(root).toHaveClass(/(?:^|\s)dark(?:\s|$)/)
  } else {
    await expect(root).not.toHaveClass(/(?:^|\s)dark(?:\s|$)/)
  }
}

/** 以整页加载方式打开深链接：hash 间跳转属于同文档导航，不会重建内存态桌台。 */
async function openRouteFresh(page: Page, route: string) {
  await page.goto('about:blank')
  await page.goto(route)
}

/** 断言当前 hash 路由，用于验证主题切换不改变路由。 */
async function expectRouteHash(page: Page, hash: string) {
  expect(await page.evaluate(() => window.location.hash)).toBe(hash)
}

/** 打开主题设置并选择指定偏好；选择后应立即生效且弹层关闭。 */
async function chooseTheme(page: Page, preference: Preference) {
  await page.getByTestId('theme-toggle').click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByTestId(`theme-option-${preference}`).click()
  await expect(page.getByRole('dialog')).toBeHidden()
}

/** 在点餐页加入一份锅底，用于验证主题切换不影响业务状态与流程。 */
async function addBrothToCart(page: Page) {
  await page.getByRole('button', { name: '锅底', exact: true }).click()
  await page.locator('article').first().locator('button').last().click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: '加入本桌购物车' }).click()
  await expect(dialog).toBeHidden()
}

/** 桌面视口（≥lg）通过右侧购物车面板提交订单。 */
async function submitOrderFromAside(page: Page) {
  await page.getByRole('button', { name: '确认并提交订单' }).click()
  await expect(page).toHaveURL(/#\/order$/)
}

/** 读取关键元素相对文档的布局信息，用于 TC-117 无布局跳动断言。 */
async function readLayout(
  page: Page,
): Promise<{ header: Box | null; article: Box | null; toggle: Box | null; scrollWidth: number; viewportWidth: number }> {
  return page.evaluate(() => {
    const box = (selector: string) => {
      const element = document.querySelector(selector)
      if (!element) return null
      const rect = element.getBoundingClientRect()
      return {
        x: Math.round(rect.x + window.scrollX),
        y: Math.round(rect.y + window.scrollY),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      }
    }
    return {
      header: box('header'),
      article: box('article'),
      toggle: box('[data-testid="theme-toggle"]'),
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }
  })
}

interface Box {
  x: number
  y: number
  width: number
  height: number
}

/** 解析浏览器 computed color，用于夜间模式关键文本的 WCAG AA 抽样断言。 */
function parseComputedColor(value: string) {
  const hexMatch = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i)
  if (hexMatch) {
    const hex = hexMatch[1]!
    const expanded = hex.length === 3 ? [...hex].map((channel) => channel + channel).join('') : hex
    const channels = Number.parseInt(expanded.slice(0, 6), 16)
    return {
      red: (channels >> 16) & 255,
      green: (channels >> 8) & 255,
      blue: channels & 255,
      alpha: expanded.length === 8 ? Number.parseInt(expanded.slice(6, 8), 16) / 255 : 1,
    }
  }

  const match = value.match(/rgba?\(([^)]+)\)/)
  if (!match) throw new Error(`无法解析颜色: ${value}`)

  const [red = 0, green = 0, blue = 0, alpha = 1] = match[1]!.split(',').map((part) => Number(part.trim()))
  if ([red, green, blue, alpha].some((channel) => Number.isNaN(channel))) {
    throw new Error(`颜色通道无效: ${value}`)
  }

  return { red, green, blue, alpha }
}

function blendColor(foreground: string, background: string) {
  const front = parseComputedColor(foreground)
  const back = parseComputedColor(background)
  const alpha = front.alpha + back.alpha * (1 - front.alpha)

  const mix = (frontChannel: number, backChannel: number) => {
    const blended = frontChannel * front.alpha + backChannel * back.alpha * (1 - front.alpha)
    return Math.round(alpha === 0 ? 0 : blended / alpha)
  }

  return {
    red: mix(front.red, back.red),
    green: mix(front.green, back.green),
    blue: mix(front.blue, back.blue),
    alpha,
  }
}

function relativeLuminance(color: { red: number; green: number; blue: number }) {
  const linearize = (channel: number) => {
    const normalized = channel / 255
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
  }

  return 0.2126 * linearize(color.red) + 0.7152 * linearize(color.green) + 0.0722 * linearize(color.blue)
}

function contrastRatio(foreground: string, background: string) {
  const foregroundColor = blendColor(foreground, background)
  const backgroundColor = blendColor(background, '#000000')
  const lighter = Math.max(relativeLuminance(foregroundColor), relativeLuminance(backgroundColor))
  const darker = Math.min(relativeLuminance(foregroundColor), relativeLuminance(backgroundColor))
  return (lighter + 0.05) / (darker + 0.05)
}

/** 获取元素的最终文字颜色，以及沿祖先节点合成后的不透明背景颜色。 */
async function readEffectiveColors(page: Page, element: Locator) {
  return element.evaluate((node) => {
    const nodeStyle = getComputedStyle(node)
    const textWithAlpha = nodeStyle.color
    const backgroundLayers: string[] = []

    let current: Element | null = node
    while (current) {
      const background = getComputedStyle(current).backgroundColor
      if (!/rgba\(\s*0,\s*0,\s*0,\s*0\s*\)/.test(background)) {
        backgroundLayers.push(background)
      }
      current = current.parentElement
    }

    let effectiveBackground = getComputedStyle(document.body).backgroundColor
    for (const layer of [...backgroundLayers].reverse()) {
      const front = layer.match(/rgba?\(([^)]+)\)/)?.[1]?.split(',').map((channel) => Number(channel.trim())) ?? []
      const back = effectiveBackground.match(/rgba?\(([^)]+)\)/)?.[1]?.split(',').map((channel) => Number(channel.trim())) ?? []
      const [fr = 0, fg = 0, fb = 0, fa = 1] = front
      const [br = 0, bg = 0, bb = 0, ba = 1] = back
      const alpha = fa + ba * (1 - fa)
      const mix = (frontChannel: number, backChannel: number) =>
        Math.round(alpha === 0 ? 0 : (frontChannel * fa + backChannel * ba * (1 - fa)) / alpha)
      effectiveBackground = `rgba(${mix(fr, br)}, ${mix(fg, bg)}, ${mix(fb, bb)}, ${alpha})`
    }

    return { text: textWithAlpha, background: effectiveBackground }
  })
}

/** 对可见文字做 WCAG AA（4.5:1）抽样检查。 */
async function expectReadableAA(page: Page, element: Locator) {
  const { text, background } = await readEffectiveColors(page, element)
  const ratio = contrastRatio(text, background)
  expect(ratio, `对比度不足（${ratio.toFixed(2)}:1）: ${await element.textContent()}`).toBeGreaterThanOrEqual(4.5)
}

test.describe('主题体验增强 - E2E 验收', () => {
  test('TC-101（REQ-103/REQ-107）: 五个视图的主题入口可聚焦，打开设置并即时切换', async ({ page }) => {
    for (const route of ROUTES) {
      await page.goto(route)
      const toggle = page.getByTestId('theme-toggle')
      await expect(toggle).toBeVisible()
      await expect(toggle).toBeEnabled()
      await expect(toggle).toHaveAttribute('aria-label', /外观模式：/)

      await toggle.focus()
      await expect(toggle).toBeFocused()
      await page.keyboard.press('Enter')

      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()
      await expect(page.getByRole('radiogroup', { name: '外观模式' })).toBeVisible()
      await expect(page.getByRole('radio')).toHaveCount(3)

      const hashBefore = await page.evaluate(() => window.location.hash)
      await page.getByTestId('theme-option-dark').click()
      await expect(dialog).toBeHidden()
      await expectTheme(page, 'dark', 'dark')
      await expect(toggle).toHaveAttribute('aria-label', '外观模式：夜间，打开设置')
      await expectRouteHash(page, hashBefore)

      await chooseTheme(page, 'light')
      await expectTheme(page, 'light', 'light')
      await expect(toggle).toHaveAttribute('aria-label', '外观模式：白天，打开设置')
      await expectRouteHash(page, hashBefore)
    }
  })

  test('TC-102（REQ-107）: 切换主题不改变路由、桌台、购物车与滚动位置', async ({ page }) => {
    await page.goto('/#/menu')
    await expect(page).toHaveURL(/#\/menu$/)
    await expect(page.getByText('A08 · 大厅', { exact: true })).toBeVisible()

    await addBrothToCart(page)
    await expect(page.getByRole('heading', { name: '本桌购物车' })).toBeVisible()
    await expect(page.getByText('共 1 份菜品')).toBeVisible()

    // 全局启用了 scroll-behavior: smooth，必须用 instant 立即定位，避免读到动画起始值 0。
    await page.evaluate(() => window.scrollTo({ top: 420, behavior: 'instant' }))
    const scrollBefore = await page.evaluate(() => window.scrollY)
    expect(scrollBefore).toBeGreaterThan(0)

    await chooseTheme(page, 'dark')
    await expectTheme(page, 'dark', 'dark')
    await expect(page).toHaveURL(/#\/menu$/)
    await expect(page.getByText('A08 · 大厅', { exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: '本桌购物车' })).toBeVisible()
    await expect(page.getByText('共 1 份菜品')).toBeVisible()

    const scrollAfter = await page.evaluate(() => window.scrollY)
    expect(Math.abs(scrollAfter - scrollBefore), '主题切换后滚动位置发生偏移').toBeLessThanOrEqual(2)
  })

  test.describe('TC-103（REQ-101/REQ-106）: 默认跟随系统偏好', () => {
    test('TC-103.1: 本地无保存值且系统偏好 dark 时首屏为夜间模式', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' })
      await page.goto('/#/home')
      await expectTheme(page, 'dark', 'system')

      await page.getByTestId('theme-toggle').click()
      await expect(page.getByTestId('theme-option-system')).toContainText('当前设备：夜间')
    })

    test('TC-103.2: 本地无保存值且系统偏好 light 时首屏为白天模式', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'light' })
      await page.goto('/#/home')
      await expectTheme(page, 'light', 'system')
    })

    test('TC-103.3: 系统偏好未声明时首屏为白天模式', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'no-preference' })
      await page.goto('/#/home')
      await expectTheme(page, 'light', 'system')
    })

    test('TC-103.4: matchMedia 不可用时回退白天模式，手动切换仍可用', async ({ page }) => {
      await page.addInitScript(() => {
        Object.defineProperty(window, 'matchMedia', { configurable: true, value: undefined })
      })
      await page.goto('/#/home')
      await expectTheme(page, 'light', 'system')

      await chooseTheme(page, 'dark')
      await expectTheme(page, 'dark', 'dark')
    })
  })

  test.describe('TC-104（REQ-101）: 保存值优先级、旧值兼容与非法值', () => {
    test('TC-104.1: 系统 dark 时已保存的 light 优先', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' })
      await page.addInitScript(() => localStorage.setItem('theme-mode', 'light'))
      await page.goto('/#/home')
      await expectTheme(page, 'light', 'light')
    })

    test('TC-104.2: 系统 light 时已保存的 dark 优先', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'light' })
      await page.addInitScript(() => localStorage.setItem('theme-mode', 'dark'))
      await page.goto('/#/home')
      await expectTheme(page, 'dark', 'dark')
    })

    test('TC-104.3: 已保存的 system 跟随系统偏好', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' })
      await page.addInitScript(() => localStorage.setItem('theme-mode', 'system'))
      await page.goto('/#/home')
      await expectTheme(page, 'dark', 'system')
    })

    test('TC-104.4: 非法保存值按未保存处理并跟随系统', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' })
      await page.addInitScript(() => localStorage.setItem('theme-mode', 'not-a-mode'))
      await page.goto('/#/home')
      await expectTheme(page, 'dark', 'system')
    })
  })

  test.describe('TC-105（REQ-102）: 跟随系统实时联动与显式偏好边界', () => {
    test('TC-105.1: 偏好为 system 时，系统偏好运行时变化立即联动', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'light' })
      await page.goto('/#/home')
      await expectTheme(page, 'light', 'system')

      await page.emulateMedia({ colorScheme: 'dark' })
      await expectTheme(page, 'dark', 'system')

      await page.emulateMedia({ colorScheme: 'light' })
      await expectTheme(page, 'light', 'system')
    })

    test('TC-105.2: 显式选择后不随系统偏好运行时变化', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'light' })
      await page.goto('/#/home')
      await chooseTheme(page, 'light')
      await expectTheme(page, 'light', 'light')

      await page.emulateMedia({ colorScheme: 'dark' })
      await expectTheme(page, 'light', 'light')
      await expect(page.getByTestId('theme-toggle')).toHaveAttribute('aria-label', '外观模式：白天，打开设置')
    })

    test('TC-105.3: 从显式偏好切回 system 后立即按当前系统渲染并继续联动', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'light' })
      await page.goto('/#/home')
      await chooseTheme(page, 'dark')
      await expectTheme(page, 'dark', 'dark')

      await page.emulateMedia({ colorScheme: 'light' })
      await expectTheme(page, 'dark', 'dark')

      await chooseTheme(page, 'system')
      await expectTheme(page, 'light', 'system')

      await page.emulateMedia({ colorScheme: 'dark' })
      await expectTheme(page, 'dark', 'system')
    })
  })

  test('TC-106（REQ-101/REQ-106）: 三态偏好在刷新与重新进入后保持', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })

    const cases: Array<{ preference: Preference; resolved: Resolved }> = [
      { preference: 'system', resolved: 'dark' },
      { preference: 'light', resolved: 'light' },
      { preference: 'dark', resolved: 'dark' },
    ]

    for (const { preference, resolved } of cases) {
      await page.goto('/#/home')
      await chooseTheme(page, preference)
      await expectTheme(page, resolved, preference)
      expect(await page.evaluate(() => localStorage.getItem('theme-mode'))).toBe(preference)

      await page.reload()
      await expectTheme(page, resolved, preference)

      // 重新进入另一个主流程视图，偏好仍应生效
      await page.goto('/#/menu')
      await expectTheme(page, resolved, preference)
      expect(await page.evaluate(() => localStorage.getItem('theme-mode'))).toBe(preference)
    }
  })

  test('TC-107（REQ-106）: localStorage 读取不可用时降级为会话内存态且点餐流程继续', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() {
          throw new DOMException('localStorage is unavailable', 'SecurityError')
        },
      })
    })

    await page.goto('/#/menu')
    await expectTheme(page, 'dark', 'system')
    await expect(page.getByRole('alert')).toHaveCount(0)

    await chooseTheme(page, 'light')
    await expectTheme(page, 'light', 'light')

    await page.goto('/#/home')
    await expect(page).toHaveURL(/#\/home$/)
    await expectTheme(page, 'light', 'light')

    await page.goto('/#/menu')
    await expect(page).toHaveURL(/#\/menu$/)
    await expectTheme(page, 'light', 'light')

    await addBrothToCart(page)
    await expect(page.getByRole('heading', { name: '本桌购物车' })).toBeVisible()
    await submitOrderFromAside(page)
    await expect(page.getByText('鎏金番茄鸳鸯锅').first()).toBeVisible()
  })

  test('TC-107.1（REQ-106）: localStorage 写入失败时会话选择优先于旧存储值', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        value: {
          getItem: (key: string) => (key === 'theme-mode' ? 'light' : null),
          setItem: () => {
            throw new DOMException('localStorage is full', 'QuotaExceededError')
          },
        },
      })
    })

    await page.goto('/#/menu')
    await expectTheme(page, 'light', 'light')

    await chooseTheme(page, 'dark')
    await expectTheme(page, 'dark', 'dark')

    await page.goto('/#/home')
    await expect(page).toHaveURL(/#\/home$/)
    await expectTheme(page, 'dark', 'dark')
    expect(await page.evaluate(() => localStorage.getItem('theme-mode'))).toBe('light')
  })

  test.describe('TC-108 ~ TC-110（REQ-104）: 夜间模式视觉覆盖与键盘可操作性', () => {
    test.use({ colorScheme: 'dark' })

    test('TC-108: 夜间模式覆盖五个视图的根背景，关键文字满足 WCAG AA', async ({ page }) => {
      for (const route of ROUTES) {
        await openRouteFresh(page, route)
        await expectTheme(page, 'dark', 'system')
        await expect(page.locator('html')).toHaveCSS('background-color', DARK_ROOT_BACKGROUND)
        await expect(page.locator('body')).toHaveCSS('background-color', DARK_ROOT_BACKGROUND)

        const heading = page.getByRole('heading').first()
        await expect(heading).toBeVisible()
        await expectReadableAA(page, heading)
      }

      await openRouteFresh(page, '/#/menu')
      await expect(page.getByRole('heading', { name: '鎏金番茄鸳鸯锅' })).toHaveCSS('color', 'rgb(247, 241, 230)')
      await expectReadableAA(page, page.getByRole('heading', { name: '鎏金番茄鸳鸯锅' }))

      const activeCategory = page.getByRole('button', { name: '推荐' })
      await expect(activeCategory).toHaveCSS('background-color', 'rgb(201, 47, 33)')
      await expectReadableAA(page, activeCategory)

      const searchInput = page.getByPlaceholder('搜索锅底、菜品或饮品')
      await expect(searchInput).toBeVisible()
      await searchInput.fill('锅底')
      await expect(searchInput).toHaveCSS('color', 'rgb(247, 241, 230)')
      await expectReadableAA(page, searchInput)
      await searchInput.fill('')

      const firstProductCard = page.locator('article').first()
      await expect(firstProductCard).toHaveCSS('background-color', 'rgb(29, 25, 21)')
      await expectReadableAA(page, firstProductCard.getByRole('heading').first())
    })

    test('TC-109: 夜间模式弹层、底部导航、Toast 与状态徽章均可读', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 })
      await page.goto('/#/menu')

      await page.getByTestId('theme-toggle').click()
      const themeDialog = page.getByRole('dialog')
      await expect(themeDialog).toBeVisible()
      await expect(themeDialog).toHaveCSS('background-color', DARK_DIALOG_BACKGROUND)
      await expectReadableAA(page, page.getByTestId('theme-option-dark'))
      await expectReadableAA(page, page.getByTestId('theme-option-system'))
      await page.keyboard.press('Escape')
      await expect(themeDialog).toBeHidden()

      await page.getByRole('button', { name: '呼叫服务' }).click()
      const serviceDialog = page.getByText('桌边服务').locator('..')
      await expect(serviceDialog).toHaveCSS('background-color', DARK_DIALOG_BACKGROUND)
      await expectReadableAA(page, page.getByText('桌边服务'))
      await page.keyboard.press('Escape')
      await expect(page.getByText('桌边服务')).not.toBeVisible()

      await page.getByRole('button', { name: '演示控制台' }).click()
      const consoleDialog = page.getByText('演示控制台').locator('..')
      await expect(consoleDialog).toHaveCSS('background-color', DARK_DIALOG_BACKGROUND)
      await expectReadableAA(page, page.getByText('演示控制台'))
      await page.keyboard.press('Escape')
      await expect(page.getByText('演示控制台')).not.toBeVisible()

      // Toast：两套主题共用深色底，需保持可读
      const toast = page.locator('div.pointer-events-none.fixed.top-24')
      await expect(toast).toHaveCSS('background-color', 'rgba(33, 31, 28, 0.9)')
      await expectReadableAA(page, toast)

      await addBrothToCart(page)
      await page.getByText(/查看购物车/).click()
      const cartDialog = page.getByRole('dialog').last()
      await expect(cartDialog).toBeVisible()
      await expect(cartDialog).toHaveCSS('background-color', DARK_DIALOG_BACKGROUND)
      // 页面内购物车面板与弹层各有一个同名标题，这里只校验已打开的弹层标题。
      await expectReadableAA(page, cartDialog.getByRole('heading', { name: '本桌购物车' }).first())

      const bottomNav = page.locator('nav.safe-bottom')
      await expect(bottomNav).toBeVisible()
      await expect(bottomNav).toHaveCSS('background-color', 'rgba(29, 25, 21, 0.95)')

      // 状态徽章：提交订单后检查订单项的履约状态
      await cartDialog.getByRole('button', { name: '提交加菜' }).click()
      await expect(page).toHaveURL(/#\/order$/)
      const itemsSection = page.locator('main section').filter({ hasText: '已点菜品' })
      const stageBadge = itemsSection.locator('span.bg-amber-100').first()
      await expect(stageBadge).toHaveText('订单已提交')
      await expect(stageBadge).toHaveCSS('background-color', 'rgb(57, 48, 29)')
      await expectReadableAA(page, stageBadge)
    })

    test('TC-110: 夜间模式下键盘焦点环、Esc 关闭与焦点回归可用', async ({ page }) => {
      await page.goto('/#/menu')
      await addBrothToCart(page)

      const toggle = page.getByTestId('theme-toggle')
      await toggle.focus()
      await expect(toggle).toBeFocused()
      await page.keyboard.press('Enter')
      await expect(page.getByRole('dialog')).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(page.getByRole('dialog')).toBeHidden()
      await expect(toggle).toBeFocused()

      await chooseTheme(page, 'light')
      await expectTheme(page, 'light', 'light')
      await expect(toggle).toBeFocused()

      await chooseTheme(page, 'dark')
      await expectTheme(page, 'dark', 'dark')
      await expect(toggle).toBeFocused()

      await page.getByRole('button', { name: '呼叫服务' }).click()
      await expect(page.getByText('桌边服务')).toBeVisible()
      await expect(page.getByRole('button', { name: '关闭' })).toBeVisible()
      await expectReadableAA(page, page.getByText('桌边服务'))

      await page.keyboard.press('Escape')
      await expect(page.getByText('桌边服务')).not.toBeVisible()
      await expect(page.getByRole('heading', { name: '鎏金番茄鸳鸯锅' })).toBeVisible()
      await expect(page.getByRole('heading', { name: '本桌购物车' })).toBeVisible()
    })

    test('TC-110.1: 主题单选组支持方向键、Home/End 与 roving tabindex', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'light' })
      await page.goto('/#/menu')
      const toggle = page.getByTestId('theme-toggle')

      await toggle.click()
      await expect(page.getByRole('dialog')).toBeVisible()
      const systemOption = page.getByTestId('theme-option-system')
      await expect(systemOption).toHaveAttribute('tabindex', '0')
      await expect(page.getByTestId('theme-option-light')).toHaveAttribute('tabindex', '-1')
      await expect(page.getByTestId('theme-option-dark')).toHaveAttribute('tabindex', '-1')

      await systemOption.focus()
      await expect(systemOption).toBeFocused()
      await page.keyboard.press('ArrowDown')
      await expect(page.getByRole('dialog')).toBeHidden()
      await expectTheme(page, 'light', 'light')
      await expect(toggle).toHaveAttribute('aria-label', '外观模式：白天，打开设置')

      await toggle.click()
      const lightOption = page.getByTestId('theme-option-light')
      await expect(lightOption).toHaveAttribute('tabindex', '0')
      await lightOption.focus()
      await page.keyboard.press('End')
      await expect(page.getByRole('dialog')).toBeHidden()
      await expectTheme(page, 'dark', 'dark')

      await toggle.click()
      const darkOption = page.getByTestId('theme-option-dark')
      await expect(darkOption).toHaveAttribute('tabindex', '0')
      await darkOption.focus()
      await page.keyboard.press('ArrowDown')
      await expect(page.getByRole('dialog')).toBeHidden()
      await expectTheme(page, 'light', 'system')
      await expect(toggle).toHaveAttribute('aria-label', '外观模式：跟随系统，打开设置')
    })
  })

  test('TC-111（REQ-103）: 中英文文案同步，主题与老人模式叠加生效', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/#/menu')

    const toggle = page.getByTestId('theme-toggle')
    await expect(toggle).toHaveAttribute('aria-label', '外观模式：跟随系统，打开设置')

    await page.getByRole('button', { name: '切换语言' }).click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(toggle).toHaveAttribute('aria-label', 'Appearance: Follow system. Open settings')

    await toggle.click()
    await expect(page.getByRole('radio')).toHaveCount(3)
    await expect(page.getByTestId('theme-option-system')).toContainText('Device currently: Dark')
    await expect(page.getByTestId('theme-option-light')).toContainText('Light')
    await expect(page.getByTestId('theme-option-dark')).toContainText('Dark')
    await expect(page.getByTestId('theme-current')).toContainText('Current interface: Dark')

    await page.getByTestId('theme-option-dark').click()
    await expect(toggle).toHaveAttribute('aria-label', 'Appearance: Dark. Open settings')

    const elderlyToggle = page.getByRole('button', { name: '切换至老人模式' })
    await expect(elderlyToggle).toBeVisible()
    await elderlyToggle.click()
    await expect(page.locator('html')).toHaveClass(/(?:^|\s)elderly(?:\s|$)/)
    await expectTheme(page, 'dark', 'dark')
    await expect(page.locator('html')).toHaveCSS('font-size', '20px')
  })

  test('TC-112（REQ-107）: 浅色与夜间模式下核心业务链路均可完成', async ({ page }) => {
    for (const preference of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: preference })
      await page.goto(`/?flow=${preference}#/home`)
      await chooseTheme(page, preference)

      await page.getByRole('button', { name: /A08 · 大厅/ }).first().click()
      await expect(page).toHaveURL(/#\/welcome$/)
      await page.getByRole('button', { name: '进入点餐' }).click()
      await expect(page).toHaveURL(/#\/menu$/)

      await addBrothToCart(page)
      await submitOrderFromAside(page)
      await expect(page.getByText('鎏金番茄鸳鸯锅').first()).toBeVisible()

      await page.getByRole('button', { name: '去结账' }).first().click()
      await expect(page).toHaveURL(/#\/checkout$/)
      await expectTheme(page, preference, preference)

      await page.goBack()
      await expect(page).toHaveURL(/#\/order$/)
      await expectTheme(page, preference, preference)
    }
  })

  test('TC-114（REQ-101/REQ-102）: html.dark、data-theme-* 与 meta theme-color 随偏好/系统同步', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/#/home')
    await expectTheme(page, 'light', 'system')

    await page.emulateMedia({ colorScheme: 'dark' })
    await expectTheme(page, 'dark', 'system')

    await chooseTheme(page, 'light')
    await page.emulateMedia({ colorScheme: 'light' })
    await expectTheme(page, 'light', 'light')

    await page.emulateMedia({ colorScheme: 'dark' })
    await expectTheme(page, 'light', 'light')
  })

  test('TC-115（REQ-107）: 主题切换无控制台错误、无业务网络请求、无数据重置', async ({ page }) => {
    const consoleErrors: string[] = []
    const pageErrors: string[] = []
    const businessRequests: string[] = []

    page.on('console', (message) => {
      if (message.type() !== 'error') return
      // 静态资源/字体加载失败属于环境噪声（仓库使用 Google Fonts @import），不计入应用控制台错误。
      if (/Failed to load resource|net::ERR_|ERR_ABORTED/i.test(message.text())) return
      consoleErrors.push(message.text())
    })
    page.on('pageerror', (error) => pageErrors.push(error.message))
    page.on('request', (request) => {
      if (['document', 'xhr', 'fetch', 'websocket', 'eventsource'].includes(request.resourceType())) {
        businessRequests.push(`${request.method()} ${request.url()}`)
      }
    })

    await page.goto('/#/menu')
    await expect(page.getByTestId('theme-toggle')).toBeVisible()
    businessRequests.length = 0

    await chooseTheme(page, 'dark')
    await chooseTheme(page, 'system')
    await addBrothToCart(page)
    await submitOrderFromAside(page)
    await chooseTheme(page, 'light')
    await expectTheme(page, 'light', 'light')

    expect(businessRequests, '主题切换或业务操作发起了新的网络请求').toEqual([])
    expect(consoleErrors, '主题流程产生控制台错误').toEqual([])
    expect(pageErrors, '主题流程产生未捕获异常').toEqual([])
  })

  test('TC-116（REQ-103）: 入口图标、可访问名称、44px 触控目标与选中态非颜色冗余', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/#/home')

    const toggle = page.getByTestId('theme-toggle')
    await expect(toggle).toHaveAttribute('aria-label', '外观模式：跟随系统，打开设置')
    await expect(toggle.locator('svg.lucide-monitor')).toBeVisible()

    const toggleBox = await toggle.boundingBox()
    expect(toggleBox).not.toBeNull()
    expect(toggleBox!.width).toBeGreaterThanOrEqual(44)
    expect(toggleBox!.height).toBeGreaterThanOrEqual(44)

    await toggle.click()
    const group = page.getByRole('radiogroup', { name: '外观模式' })
    await expect(group).toBeVisible()
    await expect(group.getByRole('radio')).toHaveCount(3)

    const systemOption = page.getByTestId('theme-option-system')
    const lightOption = page.getByTestId('theme-option-light')
    const darkOption = page.getByTestId('theme-option-dark')

    await expect(systemOption).toHaveAttribute('aria-checked', 'true')
    await expect(lightOption).toHaveAttribute('aria-checked', 'false')
    await expect(darkOption).toHaveAttribute('aria-checked', 'false')
    await expect(systemOption.locator('svg.lucide-check')).toBeVisible()
    await expect(systemOption).toHaveClass(/border-chili-500/)
    await expect(systemOption).toContainText('当前设备：白天')

    const optionBox = await systemOption.boundingBox()
    expect(optionBox).not.toBeNull()
    expect(optionBox!.height).toBeGreaterThanOrEqual(44)

    await darkOption.click()
    await expect(toggle.locator('svg.lucide-moon')).toBeVisible()
    await expect(toggle).toHaveAttribute('aria-label', '外观模式：夜间，打开设置')

    await toggle.click()
    await expect(page.getByTestId('theme-option-dark')).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByTestId('theme-option-system')).toHaveAttribute('aria-checked', 'false')
    await expect(page.getByTestId('theme-option-dark').locator('svg.lucide-check')).toBeVisible()
    await page.keyboard.press('Escape')

    // 移动端验收基线：入口仍可见且可打开
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(toggle).toBeVisible()
    await toggle.click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toBeHidden()
  })

  test('TC-117（REQ-103/REQ-107）: 主题切换不产生布局跳动，也不扩大既有横向溢出', async ({ page }) => {
    await page.goto('/#/menu')
    await addBrothToCart(page)

    const desktopBefore = await readLayout(page)
    await chooseTheme(page, 'dark')
    const desktopAfter = await readLayout(page)
    expectLayoutStable(desktopBefore, desktopAfter)

    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.getByTestId('theme-toggle')).toBeVisible()
    const mobileBefore = await readLayout(page)
    await chooseTheme(page, 'light')
    const mobileAfter = await readLayout(page)
    expectLayoutStable(mobileBefore, mobileAfter)

    function expectLayoutStable(
      before: Awaited<ReturnType<typeof readLayout>>,
      after: Awaited<ReturnType<typeof readLayout>>,
    ) {
      expect(after.scrollWidth, '主题切换改变了页面横向溢出宽度').toBe(before.scrollWidth)
      for (const key of ['header', 'article', 'toggle'] as const) {
        expect(before[key], `切换前缺少元素: ${key}`).not.toBeNull()
        expect(after[key], `切换后缺少元素: ${key}`).not.toBeNull()
        expect(Math.abs(after[key]!.x - before[key]!.x), `${key} 横向位置发生跳动`).toBeLessThanOrEqual(1)
        expect(Math.abs(after[key]!.y - before[key]!.y), `${key} 纵向位置发生跳动`).toBeLessThanOrEqual(1)
        expect(Math.abs(after[key]!.width - before[key]!.width), `${key} 宽度发生变化`).toBeLessThanOrEqual(1)
        expect(Math.abs(after[key]!.height - before[key]!.height), `${key} 高度发生变化`).toBeLessThanOrEqual(1)
      }
    }
  })

  test('TC-119（REQ-102）: 仅提供 MediaQueryList.addListener 时仍能跟随系统变化', async ({ page }) => {
    await page.addInitScript(() => {
      const listeners = new Set<(event: { matches: boolean }) => void>()
      let matches = false
      const darkQueryList = {
        media: '(prefers-color-scheme: dark)',
        get matches() {
          return matches
        },
        addListener: (listener: (event: { matches: boolean }) => void) => {
          listeners.add(listener)
        },
        removeListener: (listener: (event: { matches: boolean }) => void) => {
          listeners.delete(listener)
        },
      }

      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        value: (query: string) =>
          query === '(prefers-color-scheme: dark)'
            ? darkQueryList
            : { media: query, matches: false, addListener: () => {}, removeListener: () => {} },
      })

      window.__setSystemDarkTheme = (dark: boolean) => {
        matches = dark
        listeners.forEach((listener) => listener({ matches: dark }))
      }
    })

    await page.goto('/#/home')
    await expectTheme(page, 'light', 'system')

    await page.evaluate(() => window.__setSystemDarkTheme?.(true))
    await expectTheme(page, 'dark', 'system')

    await page.evaluate(() => window.__setSystemDarkTheme?.(false))
    await expectTheme(page, 'light', 'system')

    await chooseTheme(page, 'dark')
    await page.evaluate(() => window.__setSystemDarkTheme?.(true))
    await page.evaluate(() => window.__setSystemDarkTheme?.(false))
    await expectTheme(page, 'dark', 'dark')
  })
})
