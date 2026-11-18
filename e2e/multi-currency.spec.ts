import { test, expect, type Page } from '@playwright/test'

/**
 * 多币种展示与计算验收用例（对应 Spec 文档 MC-001 ~ MC-016）。
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

  // ─── MC-011 ~ MC-016: Spec 补齐验证关注点 ───

  test('MC-011: 未绑定/未知桌台直接深链接进入菜单，回落人民币门店（CNY）', async ({ page }) => {
    // 不经过首页绑定，直接以 hash 深链接进入 #/menu
    await page.goto('/#/menu')
    // 深链接逻辑自动绑定示例桌台 A08（人民币门店），流程不阻塞
    await expect(page.getByRole('heading', { name: /想吃什么|What shall we order/ })).toBeVisible()
    // 金额按 CNY 展示：¥68.00（2 位小数）
    await expect(page.getByText('¥68.00').first()).toBeVisible()
    // 页面不报错、不阻塞：菜单卡片正常渲染
    await expect(page.locator('article').first()).toBeVisible()
  })

  test('MC-012: 非法 ?currency=HKD 参数被忽略，按人民币门店展示', async ({ page }) => {
    await page.goto('/?currency=HKD#/checkout')
    // 结账页正常渲染（回落 A08 人民币门店）
    await expect(page.getByRole('heading', { name: /核对本桌账单|Review Your Bill/ })).toBeVisible()
    // 页面不出现港币符号（HK$ 或 HK¥）
    const body = await page.locator('main').innerText()
    expect(body).not.toMatch(/HK[$¥]/)
    // 回落 CNY：确认支付按钮金额使用 ¥
    await expect(page.getByRole('button', { name: /确认支付 ¥/ })).toBeVisible()
  })

  test('MC-013: 日元门店小计未达门槛时不扣减优惠，应付等于小计', async ({ page }) => {
    // 使用 JPY 预览菜单：购物车预置 1 份「琥珀嫩牛肉」（¥42），小计 < 100
    await page.goto('/?currency=JPY#/menu')
    const cart = page.getByRole('complementary').or(page.getByRole('dialog'))
    // 确认购物车中有 ¥42 的单品
    await expect(cart.getByText('¥42').first()).toBeVisible()
    // 提交订单 → 进入订单页
    await cart.getByRole('button', { name: /确认并提交订单|Confirm & Submit Order/ }).click()
    // 进入结账页
    await page.getByRole('button', { name: /去结账|Checkout/ }).click()
    await expect(page.getByRole('heading', { name: /核对本桌账单|Review Your Bill/ })).toBeVisible()
    // 小计为 ¥42，未达门槛 100 → 无优惠
    await expect(page.getByText('¥42').first()).toBeVisible()
    // 不出现优惠金额 -¥30
    expect(await page.locator('main').innerText()).not.toContain('-¥30')
    // 应付等于小计：确认支付按钮文案为「确认支付 ¥42」
    await expect(page.getByRole('button', { name: /确认支付 ¥42$/ })).toBeVisible()
  })

  test('MC-014: 订单含退菜申请的明细，退菜流程可触发且合计正确', async ({ page }) => {
    // 使用 USD 预览订单页：预置订单 42×2 + 28 + 18 = 130.00
    await page.goto('/?currency=USD#/order')
    await expect(page.getByRole('heading', { name: /桌台订单|TABLE ORDER/ })).toBeVisible()
    // 订单合计为 $130.00（3 项明细之和）
    await expect(page.getByText('$130.00').first()).toBeVisible()
    // 对首项明细发起退菜申请
    const firstItem = page.locator('section').filter({ hasText: /已点菜品|Ordered Dishes/ }).locator('div').filter({ hasText: /× 2/ }).first()
    await firstItem.getByRole('button', { name: /退菜|Cancel/ }).click()
    // 退菜申请提交后显示「退菜申请审核中」
    await expect(page.getByText(/退菜申请审核中|Cancel request under review/)).toBeVisible()
    // 退菜按钮消失（已有退菜申请的明细不再显示退菜按钮）
    await expect(firstItem.getByRole('button', { name: /退菜|Cancel/ })).toHaveCount(0)
    // 合计仍为 $130.00（退菜仅"申请"状态，尚未批准，仍计入合计）
    await expect(page.getByText('$130.00').first()).toBeVisible()
  })

  test('MC-015: 金额 ≥1000 时使用千分位分隔（CNY/USD/JPY 各一次）', async ({ page }) => {
    // 通过预览菜单进入各币种门店，增加购物车数量使金额 ≥1000
    // 预置购物车单品为「琥珀嫩牛肉」price=42，需 quantity ≥24 → 42×24=1008
    for (const [currency, expectedPattern] of [
      ['CNY', /¥1,008\.00/],
      ['USD', /\$1,008\.00/],
      ['JPY', /¥1,008/],
    ] as const) {
      await page.goto(`/?currency=${currency}#/menu`)
      const cart = page.getByRole('complementary').or(page.getByRole('dialog'))
      // 确认购物车已渲染（预置 1 份 ¥42 / $42）
      await expect(cart.getByText(/¥42|\$42\.00/).first()).toBeVisible()
      // 增加数量至 24（需点击 23 次）
      const increaseBtn = cart.getByRole('button', { name: /增加|Increase/ })
      for (let i = 0; i < 23; i++) {
        await increaseBtn.click()
      }
      // 购物车小计出现千分位
      await expect(cart.getByText(expectedPattern).first()).toBeVisible()
      // JPY 不含小数点
      if (currency === 'JPY') {
        const subtotalText = await cart.getByText(/¥1,008/).first().innerText()
        expect(subtotalText).not.toContain('.')
      }
    }
  })

  test('MC-016: 夜间模式 + 老人模式下结账页币种徽标与金额可读不截断', async ({ page }) => {
    await page.goto('/?currency=USD#/checkout')
    await expect(page.getByRole('heading', { name: /核对本桌账单|Review Your Bill/ })).toBeVisible()
    // 启用夜间模式
    await page.getByTestId('theme-toggle').click()
    // 确认 html.dark 已应用
    await expect(page.locator('html')).toHaveClass(/dark/)
    // 启用老人模式
    await page.getByRole('button', { name: /切换至老人模式/ }).click()
    // 确认 html.elderly 已应用
    await expect(page.locator('html')).toHaveClass(/elderly/)
    // 币种徽标仍然可见且包含 USD
    await expect(currencyBadge(page)).toBeVisible()
    await expect(currencyBadge(page)).toContainText('USD')
    // 金额文本仍然可见：小计 $130.00、应付 $100.00
    await expect(page.getByText('$130.00').first()).toBeVisible()
    await expect(page.getByText('$100.00').first()).toBeVisible()
    // 确认支付按钮可见且文案完整
    await expect(page.getByRole('button', { name: /确认支付 \$100\.00/ })).toBeVisible()
  })
})
