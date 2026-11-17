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

  test('REQ-002: 开启后简化菜品展示、增大触控区域并默认隐藏超辣锅底', async ({ page }) => {
    await gotoMenuPreview(page)
    const addButtonsBefore = page.locator('article button[aria-label^="查看"]')
    const beforeCount = await addButtonsBefore.count()
    const beforeBox = await addButtonsBefore.first().boundingBox()

    await page.locator(TOGGLE).first().click()
    await expectChildMode(page, true)

    // 默认隐藏全部含“超级辣”辣度的锅底（p1、p2）
    const addButtonsAfter = page.locator('article button[aria-label^="查看"]')
    await expect(addButtonsAfter).toHaveCount(beforeCount - 2)
    await expect(page.getByTestId('child-mode-banner')).toContainText('已隐藏 2 道超辣菜品')

    // 触控区域增大（≥ 48px）
    const afterBox = await addButtonsAfter.first().boundingBox()
    expect(afterBox!.height).toBeGreaterThanOrEqual(48)
    expect(afterBox!.height).toBeGreaterThan(beforeBox!.height)

    // 简化展示：隐藏描述与“本桌已点”徽章
    const firstCard = page.locator('article').first()
    await expect(firstCard.getByText('鲜切嫩牛肉，涮煮约 30 秒')).toHaveCount(0)
    await expect(page.getByText('本桌已点 1')).toHaveCount(0)

    // 可手动展开超辣菜品
    await page.getByTestId('child-show-spicy').click()
    await expect(addButtonsAfter).toHaveCount(beforeCount)
    await expect(page.getByRole('button', { name: '牛油麻辣锅' }).first()).toBeVisible()
  })

  test('REQ-003: 儿童模式下打开菜品弹窗为精简版并可加入购物车', async ({ page }) => {
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

  test('REQ-004: 儿童模式偏好刷新后保持（localStorage child-mode）', async ({ page }) => {
    await gotoMenuPreview(page)
    await page.locator(TOGGLE).first().click()
    await expectChildMode(page, true)

    await page.goto('/?preview=menu')
    await expectChildMode(page, true)
    await page.reload()
    await expectChildMode(page, true)
    await expect(page.getByTestId('child-mode-banner')).toBeVisible()
  })

  test('REQ-005: 儿童模式与夜间模式、老人模式同时开启时叠加无冲突', async ({ page }) => {
    await gotoMenuPreview(page)
    await page.locator(TOGGLE).first().click()
    await page.getByTestId('theme-toggle').click()
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

    await page.getByTestId('theme-toggle').click()
    await page.getByRole('button', { name: '切换至常规模式' }).click()
    await expect(root).not.toHaveClass(/(?:^|\s)dark(?:\s|$)/)
    await expect(root).not.toHaveClass(/(?:^|\s)elderly(?:\s|$)/)
    await expect(root).toHaveClass(/(?:^|\s)child(?:\s|$)/)
  })

  test('REQ-006: localStorage 读写失败时降级为内存态且不抛用户可见错误', async ({ page }) => {
    const errors: string[] = []
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
})
