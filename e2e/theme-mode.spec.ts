import { expect, test, type Page } from '@playwright/test'

type ThemeMode = 'light' | 'dark'

const THEME_META_COLOR: Record<ThemeMode, string> = {
  light: '#fbf5ea',
  dark: '#12100d',
}

const ROUTES = ['/#/home', '/#/welcome', '/#/menu', '/#/order', '/#/checkout'] as const

/** 断言 html 状态、meta theme-color 和 DOM 主题类完全一致。 */
async function expectThemeMode(page: Page, mode: ThemeMode) {
  const root = page.locator('html')
  await expect(root).toHaveAttribute('data-theme-mode', mode)
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', THEME_META_COLOR[mode])

  if (mode === 'dark') {
    await expect(root).toHaveClass(/(?:^|\s)dark(?:\s|$)/)
  } else {
    await expect(root).not.toHaveClass(/(?:^|\s)dark(?:\s|$)/)
  }
}

/** 在点餐页添加一份锅底，用于验证主题切换不影响业务状态和流程。 */
async function addBrothToCart(page: Page) {
  await page.getByRole('button', { name: '锅底' }).click()
  await page.locator('article').first().locator('button').last().click()
  await page.getByRole('button', { name: '加入本桌购物车' }).click()
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
async function readEffectiveColors(page: Page, element: ReturnType<Page['getByRole']>) {
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
      const mix = (frontChannel: number, backChannel: number) => Math.round(alpha === 0 ? 0 : (frontChannel * fa + backChannel * ba * (1 - fa)) / alpha)
      effectiveBackground = `rgba(${mix(fr, br)}, ${mix(fg, bg)}, ${mix(fb, bb)}, ${alpha})`
    }

    return { text: textWithAlpha, background: effectiveBackground }
  })
}

/** 对可见文字做 WCAG AA（4.5:1）抽样检查。 */
async function expectReadableAA(page: Page, element: ReturnType<Page['getByRole']>) {
  const { text, background } = await readEffectiveColors(page, element)
  const ratio = contrastRatio(text, background)
  expect(ratio, `${element} 对比度不足: ${ratio}`).toBeGreaterThanOrEqual(4.5)
}

test.describe('夜间模式 - E2E 验收测试', () => {
  test('TC-001: home/welcome/menu/order/checkout 的主题入口可聚焦并立即切换', async ({ page }) => {
    for (const [index, route] of ROUTES.entries()) {
      await page.goto(`/?theme-flow=${index}${route.slice(1)}`)
      const toggle = page.getByTestId('theme-toggle')
      await expect(toggle).toBeVisible()
      await expect(toggle).toBeEnabled()
      await expect(toggle).toHaveAttribute('aria-label', '切换至夜间模式')

      await toggle.focus()
      await expect(toggle).toBeFocused()
      await page.keyboard.press('Enter')
      await expectThemeMode(page, 'dark')
      await expect(toggle).toHaveAttribute('aria-label', '切换至浅色模式')
      await expect(page).toHaveURL(new RegExp(`${route.slice(1).replace(/\//g, '\\/')}$`))

      await toggle.click()
      await expectThemeMode(page, 'light')
      await expect(toggle).toHaveAttribute('aria-label', '切换至夜间模式')
    }
  })

  test('TC-001.1: 主流程切换主题不改变路由、购物车和桌台状态', async ({ page }) => {
    await page.goto('/#/menu')
    await expect(page).toHaveURL(/#\/menu$/)
    await expect(page.getByText('A08 · 大厅')).toBeVisible()

    await addBrothToCart(page)
    await expect(page.getByRole('heading', { name: '鎏金番茄鸳鸯锅' })).toBeVisible()
    await expect(page.getByText('本桌购物车').first()).toBeVisible()

    await page.getByTestId('theme-toggle').click()
    await expectThemeMode(page, 'dark')
    await expect(page).toHaveURL(/#\/menu$/)
    await expect(page.getByText('A08 · 大厅')).toBeVisible()
    await expect(page.getByRole('heading', { name: '鎏金番茄鸳鸯锅' })).toBeVisible()
    await expect(page.getByText('本桌购物车').first()).toBeVisible()
  })

  test.describe('TC-002/TC-003: 默认主题策略', () => {
    test('TC-002: 本地无保存值且系统偏好 dark 时首屏为夜间模式', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' })
      await page.goto('/#/home')
      await expectThemeMode(page, 'dark')
    })

    test('TC-003.1: 本地无保存值且系统偏好 light 时首屏为浅色模式', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'light' })
      await page.goto('/#/home')
      await expectThemeMode(page, 'light')
    })

    test('TC-003.2: 系统偏好未声明时首屏为浅色模式', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'no-preference' })
      await page.goto('/#/home')
      await expectThemeMode(page, 'light')
    })

    test('TC-003.3: matchMedia 能力不可用时首屏为浅色模式', async ({ page }) => {
      await page.addInitScript(() => {
        Object.defineProperty(window, 'matchMedia', {
          configurable: true,
          writable: true,
          value: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
        })
      })
      await page.goto('/#/home')
      await expectThemeMode(page, 'light')
    })
  })

  test.describe('TC-004/TC-005: 保存值优先级和非法值', () => {
    test('TC-004: 系统 dark 时已保存的 light 优先', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' })
      await page.addInitScript(() => localStorage.setItem('theme-mode', 'light'))
      await page.goto('/#/home')
      await expectThemeMode(page, 'light')
      await expect(await page.evaluate(() => localStorage.getItem('theme-mode'))).toBe('light')
    })

    test('TC-005.1: 非法保存值在系统 dark 时被忽略', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' })
      await page.addInitScript(() => localStorage.setItem('theme-mode', 'not-a-mode'))
      await page.goto('/#/home')
      await expectThemeMode(page, 'dark')
      await expect(await page.evaluate(() => localStorage.getItem('theme-mode'))).toBe('not-a-mode')
    })

    test('TC-005.2: 非法保存值在系统 light 时被忽略', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'light' })
      await page.addInitScript(() => localStorage.setItem('theme-mode', 'not-a-mode'))
      await page.goto('/#/home')
      await expectThemeMode(page, 'light')
      await expect(await page.evaluate(() => localStorage.getItem('theme-mode'))).toBe('not-a-mode')
    })
  })

  test('TC-006: 显式切换 dark/light 后刷新分别保持选择', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto('/#/home')

    await page.getByTestId('theme-toggle').click()
    await expectThemeMode(page, 'dark')
    await page.reload()
    await expectThemeMode(page, 'dark')
    await expect(await page.evaluate(() => localStorage.getItem('theme-mode'))).toBe('dark')

    await page.getByTestId('theme-toggle').click()
    await expectThemeMode(page, 'light')
    await page.reload()
    await expectThemeMode(page, 'light')
    await expect(await page.evaluate(() => localStorage.getItem('theme-mode'))).toBe('light')
  })

  test('TC-007: localStorage 不可用时主题降级为内存态且点餐流程继续', async ({ page }) => {
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
    await expectThemeMode(page, 'dark')

    await page.getByTestId('theme-toggle').click()
    await expectThemeMode(page, 'light')

    await addBrothToCart(page)
    await expect(page.getByRole('heading', { name: '鎏金番茄鸳鸯锅' })).toBeVisible()
    await expect(page.getByText('本桌购物车').first()).toBeVisible()

    await page.getByRole('button', { name: '确认并提交订单' }).click()
    await expect(page).toHaveURL(/#\/order$/)
    await expect(page.getByText('鎏金番茄鸳鸯锅').first()).toBeVisible()
  })

  test.describe('TC-008: 夜间模式视觉与弹层适配', () => {
    test.use({ colorScheme: 'dark' })

    test('TC-008: 夜间模式覆盖核心视图并保持关键文字 WCAG AA', async ({ page }) => {
      for (const [index, route] of ROUTES.entries()) {
        await page.goto(`/?theme-flow=${index}${route.slice(1)}`)
        await expectThemeMode(page, 'dark')
        await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(18, 16, 13)')
      }

      await page.goto('/?theme-flow=menu#/menu')
      await expect(page.getByRole('heading', { name: '鎏金番茄鸳鸯锅' })).toBeVisible()
      await expect(page.getByRole('heading', { name: '鎏金番茄鸳鸯锅' })).toHaveCSS('color', 'rgb(247, 241, 230)')
      await expectReadableAA(page, page.getByRole('heading', { name: '鎏金番茄鸳鸯锅' }))

      const firstProductCard = page.locator('article').first()
      await expect(firstProductCard).toHaveCSS('background-color', 'rgb(29, 25, 21)')
      await expectReadableAA(page, firstProductCard.getByRole('heading').first())
    })

    test('TC-008.1: 夜间模式服务弹层、演示控制台和移动端底部导航保持暗色语义', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 })
      await page.goto('/#/menu')

      await page.getByRole('button', { name: '呼叫服务' }).click()
      const serviceDialog = page.getByText('桌边服务').locator('..')
      await expect(serviceDialog).toBeVisible()
      await expect(serviceDialog).toHaveCSS('background-color', 'rgb(25, 22, 18)')
      await page.keyboard.press('Escape')

      await page.getByRole('button', { name: '演示控制台' }).click()
      const consoleDialog = page.getByText('演示控制台').locator('..')
      await expect(consoleDialog).toBeVisible()
      await expect(consoleDialog).toHaveCSS('background-color', 'rgb(25, 22, 18)')
      await page.keyboard.press('Escape')

      await addBrothToCart(page)
      await page.getByText(/查看购物车/).click()
      const cartDialog = page.getByRole('dialog').last()
      await expect(cartDialog).toBeVisible()
      await expect(cartDialog).toHaveCSS('background-color', 'rgb(25, 22, 18)')

      await page.keyboard.press('Escape')
      const bottomNav = page.locator('nav.safe-bottom')
      await expect(bottomNav).toBeVisible()
      await expect(bottomNav).toHaveCSS('background-color', 'rgba(29, 25, 21, 0.95)')
    })
  })

  test('TC-009: 夜间模式下键盘焦点、服务弹层和购物车可继续操作', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/#/menu')
    await addBrothToCart(page)

    const toggle = page.getByTestId('theme-toggle')
    await toggle.focus()
    await expect(toggle).toBeFocused()
    await page.keyboard.press('Enter')
    await expectThemeMode(page, 'light')
    await expect(toggle).toBeFocused()

    await page.keyboard.press('Enter')
    await expectThemeMode(page, 'dark')

    await page.getByRole('button', { name: '呼叫服务' }).click()
    await expect(page.getByText('桌边服务')).toBeVisible()
    await expect(page.getByRole('button', { name: '关闭' })).toBeVisible()
    await expectReadableAA(page, page.getByText('桌边服务'))

    await page.keyboard.press('Escape')
    await expect(page.getByText('桌边服务')).not.toBeVisible()
    await expect(page.getByRole('heading', { name: '鎏金番茄鸳鸯锅' })).toBeVisible()
    await expect(page.getByText('本桌购物车').first()).toBeVisible()
  })

  test('TC-010: 夜间模式与老人模式叠加并支持中英文入口反馈', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto('/#/menu')

    const toggle = page.getByTestId('theme-toggle')
    await expect(toggle).toHaveAttribute('aria-label', '切换至浅色模式')

    await page.getByRole('button', { name: '切换语言' }).click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    const englishAriaLabel = await toggle.getAttribute('aria-label')
    expect(englishAriaLabel).toMatch(/switch to (light|night) mode/i)

    const elderlyToggle = page.getByRole('button', { name: '切换至老人模式' })
    await expect(elderlyToggle).toBeVisible()
    await elderlyToggle.click()
    await expect(page.locator('html')).toHaveClass(/(?:^|\s)elderly(?:\s|$)/)
    await expectThemeMode(page, 'dark')
    await expect(page.locator('html')).toHaveCSS('font-size', '20px')
  })
})
