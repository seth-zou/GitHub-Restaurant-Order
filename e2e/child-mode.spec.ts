import { expect, test, type Page } from '@playwright/test'

const STORAGE_KEY = 'child-mode'
const TOGGLE = '[data-testid="child-mode-toggle"]'

/** 直接在预览模式进入点餐页（A08 预置购物车），避免依赖桌台绑定流程；进入后默认关闭儿童模式。 */
async function gotoMenuPreview(page: Page) {
  await page.goto('/?preview=menu')
  await page.evaluate(() => localStorage.setItem('child-mode', 'false'))
  await page.goto('/?preview=menu')
  await expect(page.getByTestId('child-mode-banner')).toHaveCount(0)
}

async function expectChildMode(page: Page, enabled: boolean) {
  const root = page.locator('html')
  await expect(root).toHaveAttribute('data-child-mode', enabled ? 'on' : 'off')
  if (enabled) {
    await expect(root).toHaveClass(/(?:^|\s)child(?:\s|$)/)
  } else {
    await expect(root).not.toHaveClass(/(?:^|\s)child(?:\s|$)/)
  }
  await expect(page.getByTestId('child-mode-toggle').first()).toHaveAttribute('aria-pressed', String(enabled))
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe(String(enabled))
}

/** 在儿童模式下切换到锅底分类、展开超辣菜品并打开指定锅底规格弹窗。 */
async function openSpicyProductInChildMode(page: Page, productIndex: number) {
  await gotoMenuPreview(page)
  await page.locator(TOGGLE).first().click()
  await expectChildMode(page, true)

  // 切到锅底分类
  await page.getByRole('button', { name: '锅底' }).click()

  // 展开超辣菜品
  await page.getByTestId('child-show-spicy').click()

  // 打开指定锅底规格弹窗
  const productCards = page.locator('article')
  await productCards.nth(productIndex).locator('button[aria-label^="查看"]').click()
}

test.describe('儿童模式 - E2E 验收测试', () => {
  test('REQ-001: TopBar 与首页入口可切换儿童模式并立即生效', async ({ page }) => {
    await page.goto('/#/home')
    await expect(page.locator(TOGGLE)).toHaveCount(1)
    await page.locator(TOGGLE).click()
    await expectChildMode(page, true)

    // 儿童模式是全局显示偏好：从首页进入点餐页后仍然生效
    await page.goto('/?preview=menu')
    await expect(page.getByTestId('child-mode-banner')).toBeVisible()
    await page.locator(TOGGLE).click()
    await expectChildMode(page, false)
    await expect(page.getByTestId('child-mode-banner')).toHaveCount(0)
  })

  test('REQ-001.1: 欢迎页入口可切换儿童模式', async ({ page }) => {
    await page.goto('/#/welcome')
    await expect(page.locator(TOGGLE)).toBeVisible()

    await page.locator(TOGGLE).click()
    await expectChildMode(page, true)

    // 进入点餐页后儿童模式仍然生效
    await page.getByRole('button', { name: /进入点餐|Enter/ }).click()
    await expect(page).toHaveURL(/#\/menu$/)
    await expect(page.getByTestId('child-mode-banner')).toBeVisible()
  })

  test('REQ-001.2: 入口获得键盘焦点时可操作（Enter/Space 触发）', async ({ page }) => {
    await page.goto('/#/home')
    const toggle = page.locator(TOGGLE)
    await toggle.focus()
    await expect(toggle).toBeFocused()
    await page.keyboard.press('Enter')
    await expectChildMode(page, true)

    await toggle.focus()
    await page.keyboard.press('Space')
    await expectChildMode(page, false)
  })

  test('REQ-002: 开启后简化菜品展示、增大触控区域并默认隐藏超辣锅底', async ({ page }) => {
    await gotoMenuPreview(page)
    const addButtonsBefore = page.locator('article button[aria-label^="查看"]')
    const beforeCount = await addButtonsBefore.count()
    const beforeBox = await addButtonsBefore.first().boundingBox()

    await page.locator(TOGGLE).first().click()
    await expectChildMode(page, true)

    // 默认隐藏全部含"超级辣"辣度的锅底（p1、p2）
    const addButtonsAfter = page.locator('article button[aria-label^="查看"]')
    await expect(addButtonsAfter).toHaveCount(beforeCount - 2)
    await expect(page.getByTestId('child-mode-banner')).toContainText('已隐藏 2 道超辣菜品')

    // 触控区域增大（≥ 48px）
    const afterBox = await addButtonsAfter.first().boundingBox()
    expect(afterBox!.height).toBeGreaterThanOrEqual(48)
    expect(afterBox!.height).toBeGreaterThan(beforeBox!.height)

    // 简化展示：隐藏描述与"本桌已点"徽章
    const firstCard = page.locator('article').first()
    await expect(firstCard.getByText('鲜切嫩牛肉，涮煮约 30 秒')).toHaveCount(0)
    await expect(page.getByText('本桌已点 1')).toHaveCount(0)

    // 价格后缀为「份」
    await expect(firstCard.getByText('份')).toBeVisible()

    // 可手动展开超辣菜品
    await page.getByTestId('child-show-spicy').click()
    await expect(addButtonsAfter).toHaveCount(beforeCount)
    await expect(page.getByRole('button', { name: '牛油麻辣锅' }).first()).toBeVisible()

    // 再次收起
    await page.getByTestId('child-show-spicy').click()
    await expect(addButtonsAfter).toHaveCount(beforeCount - 2)
  })

  test('REQ-003: 儿童模式展开后辣度区可见且超级辣禁用', async ({ page }) => {
    await openSpicyProductInChildMode(page, 0)

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    // 辣度区显示：微辣、中辣、重辣、超级辣四个选项均可见
    await expect(dialog.getByText('选择辣度')).toBeVisible()
    await expect(dialog.getByRole('button', { name: '微辣' })).toBeVisible()
    await expect(dialog.getByRole('button', { name: '中辣' })).toBeVisible()
    await expect(dialog.getByRole('button', { name: '重辣' })).toBeVisible()
    await expect(dialog.getByRole('button', { name: '超级辣' })).toBeVisible()

    // 超级辣处于禁用态
    const superSpicyBtn = dialog.getByRole('button', { name: '超级辣' })
    await expect(superSpicyBtn).toBeDisabled()

    // 点击超级辣不弹出风险提示且不进入选中态
    await superSpicyBtn.click({ force: true })
    await expect(page.getByText('风险提示')).toHaveCount(0)
    await expect(superSpicyBtn).not.toHaveClass(/border-chili-500/)
  })

  test('REQ-003.1: 儿童模式下选择中辣可加入购物车且不含风险确认', async ({ page }) => {
    await openSpicyProductInChildMode(page, 0)

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    // 选择中辣
    await dialog.getByRole('button', { name: '中辣' }).click()
    const mediumBtn = dialog.getByRole('button', { name: '中辣' })
    await expect(mediumBtn).toHaveClass(/border-chili-500/)

    // 点击「就要这一份」加入购物车
    await dialog.getByRole('button', { name: '就要这一份' }).click()
    await expect(page.getByText('本桌购物车').first()).toBeVisible()

    // 购物车规格为「中辣」，不含「客户已确认风险」
    await expect(page.getByText('中辣').first()).toBeVisible()
    await expect(page.getByText('客户已确认风险')).toHaveCount(0)
  })

  test('REQ-004: 儿童模式下打开菜品弹窗为精简版并可加入购物车', async ({ page }) => {
    await gotoMenuPreview(page)
    await page.locator(TOGGLE).first().click()
    await expectChildMode(page, true)
    await page.locator('article button[aria-label^="查看"]').first().click()

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('button', { name: '就要这一份' })).toBeVisible()
    await expect(dialog.getByText('谁点了')).toHaveCount(0)
    await dialog.getByRole('button', { name: '就要这一份' }).click()
    await expect(page.getByText('本桌购物车').first()).toBeVisible()
  })

  test('REQ-004.1: 关闭儿童模式后弹窗恢复常规展示', async ({ page }) => {
    await gotoMenuPreview(page)
    await page.locator(TOGGLE).first().click()
    await expectChildMode(page, true)

    // 关闭儿童模式
    await page.locator(TOGGLE).first().click()
    await expectChildMode(page, false)

    // 打开菜品弹窗，恢复「谁点了」和「加入本桌购物车」
    await page.locator('article button[aria-label^="查看"]').first().click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('谁点了')).toBeVisible()
    await expect(dialog.getByRole('button', { name: '加入本桌购物车' })).toBeVisible()
  })

  test('REQ-005: 儿童模式偏好刷新后保持（localStorage child-mode）', async ({ page }) => {
    await gotoMenuPreview(page)
    await page.locator(TOGGLE).first().click()
    await expectChildMode(page, true)

    await page.goto('/?preview=menu')
    await expectChildMode(page, true)
    await page.reload()
    await expectChildMode(page, true)
    await expect(page.getByTestId('child-mode-banner')).toBeVisible()
  })

  test('REQ-005.1: 非法存储值按未保存处理且默认关闭', async ({ page }) => {
    // 设置非法值后刷新，应默认关闭
    await page.goto('/?preview=menu')
    await page.evaluate(() => localStorage.setItem('child-mode', 'yes'))
    await page.goto('/?preview=menu')

    const root = page.locator('html')
    await expect(root).toHaveAttribute('data-child-mode', 'off')
    await expect(root).not.toHaveClass(/(?:^|\s)child(?:\s|$)/)
    await expect(page.getByTestId('child-mode-banner')).toHaveCount(0)
  })

  test('REQ-005.2: 空串存储值按未保存处理且默认关闭', async ({ page }) => {
    await page.goto('/?preview=menu')
    await page.evaluate(() => localStorage.setItem('child-mode', ''))
    await page.goto('/?preview=menu')

    const root = page.locator('html')
    await expect(root).toHaveAttribute('data-child-mode', 'off')
    await expect(root).not.toHaveClass(/(?:^|\s)child(?:\s|$)/)
  })

  test('REQ-005.3: 儿童模式不读写 elderly-mode 与 theme-mode', async ({ page }) => {
    await page.goto('/?preview=menu')
    // 预置其他模式存储值
    await page.evaluate(() => {
      localStorage.setItem('elderly-mode', 'false')
      localStorage.setItem('theme-mode', 'light')
    })

    await page.locator(TOGGLE).first().click()
    await expectChildMode(page, true)

    // 确认其他模式的存储值未变
    const elderlyValue = await page.evaluate(() => localStorage.getItem('elderly-mode'))
    const themeValue = await page.evaluate(() => localStorage.getItem('theme-mode'))
    expect(elderlyValue).toBe('false')
    expect(themeValue).toBe('light')
  })

  test('REQ-006: 儿童模式与夜间模式、老人模式同时开启时叠加无冲突', async ({ page }) => {
    await gotoMenuPreview(page)
    await page.locator(TOGGLE).first().click()
    // 主题入口现为弹层：打开后选择夜间，弹层关闭后再操作老人模式
    await page.getByTestId('theme-toggle').click()
    await page.getByTestId('theme-option-dark').click()
    await page.getByRole('button', { name: '切换至老人模式' }).click()

    const root = page.locator('html')
    await expect(root).toHaveClass(/(?:^|\s)child(?:\s|$)/)
    await expect(root).toHaveClass(/(?:^|\s)dark(?:\s|$)/)
    await expect(root).toHaveClass(/(?:^|\s)elderly(?:\s|$)/)

    // 夜间 + 儿童：卡片仍是夜间底色
    const cardBg = await page.locator('article').first().evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(cardBg).toBe('rgb(29, 25, 21)')
    // 老人 + 儿童：字号继续放大
    const fontSize = await root.evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize))
    expect(fontSize).toBeGreaterThan(16)

    // 切回白天并关闭老人模式
    await page.getByTestId('theme-toggle').click()
    await page.getByTestId('theme-option-light').click()
    await page.getByRole('button', { name: '切换至常规模式' }).click()
    await expect(root).not.toHaveClass(/(?:^|\s)dark(?:\s|$)/)
    await expect(root).not.toHaveClass(/(?:^|\s)elderly(?:\s|$)/)
    await expect(root).toHaveClass(/(?:^|\s)child(?:\s|$)/)
  })

  test('REQ-006.1: 单独关闭夜间模式不影响儿童模式', async ({ page }) => {
    await gotoMenuPreview(page)
    await page.locator(TOGGLE).first().click()
    // 主题入口现为弹层：打开后选择夜间
    await page.getByTestId('theme-toggle').click()
    await page.getByTestId('theme-option-dark').click()

    const root = page.locator('html')
    await expect(root).toHaveClass(/(?:^|\s)child(?:\s|$)/)
    await expect(root).toHaveClass(/(?:^|\s)dark(?:\s|$)/)

    // 关闭夜间模式：重新打开弹层选择白天
    await page.getByTestId('theme-toggle').click()
    await page.getByTestId('theme-option-light').click()
    await expect(root).not.toHaveClass(/(?:^|\s)dark(?:\s|$)/)
    await expect(root).toHaveClass(/(?:^|\s)child(?:\s|$)/)
  })

  test('REQ-007: localStorage 读写失败时降级为内存态且不抛用户可见错误', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))
    await page.addInitScript(() => {
      const deny = () => { throw new DOMException('storage blocked', 'SecurityError') }
      Object.defineProperty(window, 'localStorage', { configurable: true, get: deny })
    })
    // 页面内部代码直接 try/catch 访问 localStorage，不产生未捕获异常；这里只记录 pageerror 作为最终断言
    await page.goto('/?preview=menu')
    await page.evaluate(() => { try { localStorage.getItem('x') } catch { /* expected */ } }).catch(() => undefined)
    await page.locator(TOGGLE).first().click()
    await expect(page.locator('html')).toHaveClass(/(?:^|\s)child(?:\s|$)/)
    await expect(page.getByTestId('child-mode-banner')).toBeVisible()
    await page.locator(TOGGLE).first().click()
    await expect(page.locator('html')).not.toHaveClass(/(?:^|\s)child(?:\s|$)/)
    expect(errors).toEqual([])
  })

  test('REQ-007.1: 存储不可用时跨视图切换保持儿童模式选择', async ({ page }) => {
    await page.addInitScript(() => {
      const deny = () => { throw new DOMException('storage blocked', 'SecurityError') }
      Object.defineProperty(window, 'localStorage', { configurable: true, get: deny })
    })

    await page.goto('/?preview=menu')
    await page.locator(TOGGLE).first().click()
    await expect(page.locator('html')).toHaveClass(/(?:^|\s)child(?:\s|$)/)

    // 跨路由切换：进入首页再回点餐页，儿童模式保持
    await page.goto('/#/home')
    await expect(page.locator('html')).toHaveClass(/(?:^|\s)child(?:\s|$)/)
    await page.goto('/?preview=menu')
    await expect(page.locator('html')).toHaveClass(/(?:^|\s)child(?:\s|$)/)
    await expect(page.getByTestId('child-mode-banner')).toBeVisible()
  })

  test('REQ-008: 中文环境下入口 aria-label 与说明条文案正确', async ({ page }) => {
    await page.goto('/#/home')
    const toggle = page.locator(TOGGLE)

    // 关闭态 aria-label
    await expect(toggle).toHaveAttribute('aria-label', '开启儿童模式')
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')

    // 开启态 aria-label
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-label', '关闭儿童模式')
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')

    // 说明条文案
    await page.goto('/?preview=menu')
    await expect(page.getByTestId('child-mode-banner')).toContainText('儿童模式 · 只显示温和好吃的菜')
    await expect(page.getByTestId('child-mode-banner')).toContainText('已隐藏 2 道超辣菜品')
    await expect(page.getByTestId('child-show-spicy')).toContainText('看看超辣')
  })

  test('REQ-008.1: 英文环境下入口 aria-label 与说明条文案正确', async ({ page }) => {
    await page.goto('/#/home')
    // 切换到英文
    await page.getByRole('button', { name: '切换语言' }).click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')

    const toggle = page.locator(TOGGLE)
    await expect(toggle).toHaveAttribute('aria-label', 'Enable kids mode')
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')

    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-label', 'Disable kids mode')
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')

    // 英文说明条与按钮文案
    await page.goto('/?preview=menu')
    await expect(page.getByTestId('child-mode-banner')).toContainText('Kids Mode · Only gentle favorites')
    await expect(page.getByTestId('child-mode-banner')).toContainText('2 super-hot dishes hidden')
    await expect(page.getByTestId('child-show-spicy')).toContainText('Show super hot')

    // 展开后按钮文案切换
    await page.getByTestId('child-show-spicy').click()
    await expect(page.getByTestId('child-show-spicy')).toContainText('Hide super hot')
  })

  test('REQ-008.2: 儿童模式弹窗主按钮英文文案', async ({ page }) => {
    await page.goto('/#/home')
    await page.getByRole('button', { name: '切换语言' }).click()
    await page.locator(TOGGLE).click()
    await page.goto('/?preview=menu')
    await page.locator('article button[aria-label^="View"]').first().click()

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('button', { name: 'Add this one' })).toBeVisible()
  })
})
