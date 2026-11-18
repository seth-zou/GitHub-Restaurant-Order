import { test, expect, type Page } from '@playwright/test'

/**
 * 多币种展示与计算验收用例（对应 PRD 文档 MC-001 ~ MC-010）。
 * 口径：支持 CNY / USD / JPY；币种由门店/桌台决定，整桌统一，顾客不可切换，不做汇率换算；
 * CNY/USD 保留 2 位小数，JPY 保留 0 位小数；优惠门槛与面额为门店本币金额。
 */

async function bindTable(page: Page, table: string) {
  await page.goto('/')
  await page.getByRole('button', { name: new RegExp(table) }).first().click()
  await page.getByRole('button', { name: /进入点餐|Enter/ }).click()
}

const currencyBadge = (page: Page) => page.getByTestId('currency-badge')

/** 打开菜单首张菜品卡（鎏金番茄鸳鸯锅）的规格弹窗并加入购物车。 */
async function addFirstDish(page: Page) {
  await page.locator('article').filter({ hasText: '鎏金番茄鸳鸯锅' }).getByRole('button').first().click()
  await page.getByRole('button', { name: /加入本桌购物车|Add to Table Cart/ }).click()
}

test.describe('多币种展示与计算', () => {
  test('MC-001: A08 桌台（人民币门店）金额使用 ¥ 且保留 2 位小数', async ({ page }) => {
    await bindTable(page, 'A08')
    await expect(page.getByText('¥68.00').first()).toBeVisible()
    await expect(currencyBadge(page)).toContainText('CNY')
  })

  test('MC-002: B12 桌台（美元门店）菜单与购物车金额使用 $', async ({ page }) => {
    await bindTable(page, 'B12')
    await expect(currencyBadge(page)).toContainText('USD')
    await addFirstDish(page)
    const cart = page.getByRole('complementary').or(page.getByRole('dialog'))
    await expect(cart.getByText('$68.00').first()).toBeVisible()
    await expect(cart.getByText(/¥/)).toHaveCount(0)
  })

  test('MC-003: D03 桌台（日元门店）金额使用 ¥ 且为整数（0 位小数）', async ({ page }) => {
    await bindTable(page, 'D03')
    await expect(currencyBadge(page)).toContainText('JPY')
    await expect(page.getByText('¥68').first()).toBeVisible()
    const prices = await page.locator('article p.text-xl').allInnerTexts()
    for (const price of prices) {
      expect(price).toMatch(/^¥\d[\d,]*( \S+ · \S+)?$/)
      expect(price).not.toContain('.')
    }
  })

  test('MC-004: 日元半份按整数取整，不出现小数', async ({ page }) => {
    await page.goto('/?currency=JPY#/menu')
    await page.locator('article').filter({ hasText: '琥珀嫩牛肉' }).getByRole('button').first().click()
    await page.getByRole('button', { name: /半份|Half Portion/ }).click()
    await page.getByRole('button', { name: /加入本桌购物车|Add to Table Cart/ }).click()
    const cart = page.getByRole('complementary').or(page.getByRole('dialog'))
    // 42 * 0.58 = 24.36 → JPY 取整为 ¥24
    await expect(cart.getByText('¥24').first()).toBeVisible()
    await expect(cart.getByText(/¥24\./)).toHaveCount(0)
  })

  test('MC-005: 美元门店结账按本币加算，优惠为门店本币金额', async ({ page }) => {
    await page.goto('/?currency=USD#/checkout')
    await expect(page.getByRole('heading', { name: /核对本桌账单|Review Your Bill/ })).toBeVisible()
    // 预置订单：42×2 + 28 + 18 = 130.00，满 100 减 30 → 应付 100.00（USD）
    await expect(page.getByText('$130.00').first()).toBeVisible()
    await expect(page.getByText('-$30.00').first()).toBeVisible()
    await expect(page.getByText('$100.00').first()).toBeVisible()
    await expect(page.getByRole('button', { name: /确认支付 \$100\.00/ })).toBeVisible()
  })

  test('MC-006: 日元门店结账金额为整数且合计正确', async ({ page }) => {
    await page.goto('/?currency=JPY#/checkout')
    await expect(page.getByRole('heading', { name: /核对本桌账单|Review Your Bill/ })).toBeVisible()
    await expect(page.getByText('¥130').first()).toBeVisible()
    await expect(page.getByText('-¥30').first()).toBeVisible()
    await expect(page.getByText('¥100').first()).toBeVisible()
  })

  test('MC-007: 同一账单只出现一种币种，不混币', async ({ page }) => {
    for (const [currency, expected, forbidden] of [
      ['USD', '$', '¥'],
      ['JPY', '¥', '$'],
      ['CNY', '¥', '$'],
    ] as const) {
      await page.goto(`/?currency=${currency}#/checkout`)
      await expect(page.getByRole('heading', { name: /核对本桌账单|Review Your Bill/ })).toBeVisible()
      const body = await page.locator('main').innerText()
      expect(body).toContain(expected)
      expect(body).not.toContain(forbidden)
    }
  })

  test('MC-008: 会员菜品券金额随门店币种展示', async ({ page }) => {
    await bindTable(page, 'B12')
    await page.getByRole('button', { name: /会员与排号|Membership/ }).click()
    await expect(page.getByText('含 $30.00 菜品券').or(page.getByText('Includes $30.00 dish coupon'))).toBeVisible()
  })

  test('MC-009: 页面没有顾客可切换币种或汇率换算的入口', async ({ page }) => {
    await bindTable(page, 'A08')
    await expect(page.getByRole('button', { name: /切换币种|Currency switcher|汇率|Exchange rate/i })).toHaveCount(0)
    await expect(page.getByRole('combobox')).toHaveCount(0)
  })

  test('MC-010: 切换语言后币种与金额格式保持不变', async ({ page }) => {
    await page.goto('/?currency=USD#/checkout')
    await page.getByRole('button', { name: '切换语言' }).click()
    await expect(page.getByRole('heading', { name: 'Review Your Bill' })).toBeVisible()
    await expect(page.getByText('$130.00').first()).toBeVisible()
  })
})
