import { test, expect, type Page } from '@playwright/test'

/**
 * 多币种展示与加算验收用例（对应 PRD 文档中的 MC-* 验收项）。
 * 币种由桌台所属门店决定，整桌统一；金额统一 2 位小数；优惠活动随币种展示同面额金额。
 */

/** 从首页绑定指定桌台，返回该桌台应展示的货币符号。 */
async function bindTable(page: Page, table: string) {
  await page.goto('/')
  await page.getByRole('button', { name: new RegExp(table) }).first().click()
  await page.getByRole('button', { name: /进入点餐|Enter/ }).click()
}

/** 取顶栏币种徽标文本（含币种名与符号）。 */
const currencyBadge = (page: Page) => page.getByTitle(/门店定价|store pricing/i)

test.describe('多币种展示与加算', () => {
  test('MC-001: A08 桌台（人民币门店）全部金额使用 ¥', async ({ page }) => {
    await bindTable(page, 'A08')
    await expect(page.getByText('¥68.00').first()).toBeVisible()
    await expect(page.getByText(/\$|HK\$/).first()).toBeHidden()
    await expect(currencyBadge(page)).toContainText('CNY')
  })

  test('MC-002: B12 桌台（美元门店）菜单与购物车金额全部使用 $', async ({ page }) => {
    await bindTable(page, 'B12')
    await expect(currencyBadge(page)).toContainText('USD')
    // 菜品卡右上角的 + 按钮（卡片内唯一按钮）打开规格弹窗
    await page.locator('article').filter({ hasText: '鎏金番茄鸳鸯锅' }).getByRole('button').first().click()
    await page.getByRole('button', { name: /加入本桌购物车|Add to Table Cart/ }).click()
    const cart = page.getByRole('complementary').or(page.getByRole('dialog'))
    await expect(cart.getByText('$68.00').first()).toBeVisible()
    await expect(cart.getByText(/¥/)).toHaveCount(0)
  })

  test('MC-003: C06 桌台（港币门店）使用 HK$ 且与 ¥ 可区分', async ({ page }) => {
    await bindTable(page, 'C06')
    await expect(currencyBadge(page)).toContainText('HKD')
    await expect(page.getByText('HK$68.00').first()).toBeVisible()
  })

  test('MC-004: D03 桌台（日元门店）使用 ¥ 且保留 2 位小数、币种可区分', async ({ page }) => {
    await bindTable(page, 'D03')
    await expect(currencyBadge(page)).toContainText('JPY')
    await expect(page.getByText('¥68.00').first()).toBeVisible()
  })

  test('MC-005: 美元门店结账按门店币种加算，优惠金额同面额展示', async ({ page }) => {
    await page.goto('/?currency=USD#/checkout')
    await expect(page.getByRole('heading', { name: /核对本桌账单|Review Your Bill/ })).toBeVisible()
    // 预置订单：42×2 + 28 + 18 = 130.00，满 100 减 30 → 应付 100.00（按 USD 金额计算）
    await expect(page.getByText('$130.00').first()).toBeVisible()
    await expect(page.getByText('-$30.00').first()).toBeVisible()
    await expect(page.getByText('$100.00').first()).toBeVisible()
    await expect(page.getByRole('button', { name: /确认支付 \$100\.00/ })).toBeVisible()
  })

  test('MC-006: 只有一种币种出现在同一账单，不出现混币', async ({ page }) => {
    for (const [currency, symbol] of [['USD', '$'], ['HKD', 'HK$'], ['JPY', '¥'], ['CNY', '¥']] as const) {
      await page.goto(`/?currency=${currency}#/checkout`)
      await expect(page.getByRole('heading', { name: /核对本桌账单|Review Your Bill/ })).toBeVisible()
      const body = await page.locator('body').innerText()
      if (currency === 'USD') expect(body).not.toContain('¥')
      if (currency === 'HKD') expect(body).not.toMatch(/(?<!HK)\$/)
      expect(body).toContain(symbol)
    }
  })

  test('MC-007: 会员权益中的菜品券金额随门店币种变化', async ({ page }) => {
    await bindTable(page, 'B12')
    await page.getByRole('button', { name: /会员与排号|Membership/ }).click()
    await expect(page.getByText('含 $30.00 菜品券').or(page.getByText('Includes $30.00 dish coupon'))).toBeVisible()
  })

  test('MC-008: 页面上没有顾客可切换币种的入口', async ({ page }) => {
    await bindTable(page, 'C06')
    await expect(page.getByRole('button', { name: /切换币种|Currency switcher/i })).toHaveCount(0)
    await expect(page.getByRole('combobox')).toHaveCount(0)
  })

  test('MC-009: 切换语言后币种与金额格式保持不变', async ({ page }) => {
    await page.goto('/?currency=HKD#/checkout')
    await page.getByRole('button', { name: '切换语言' }).click()
    await expect(page.getByRole('heading', { name: 'Review Your Bill' })).toBeVisible()
    await expect(page.getByText('HK$130.00').first()).toBeVisible()
  })
})
