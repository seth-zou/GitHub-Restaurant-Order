import { test, expect, type Page } from '@playwright/test'
import { confirmHotpotBase } from './helpers/hotpot-base'

/** 从首页进入点餐页，停留在自动弹出的底料必选弹窗。 */
async function goToMenuWithBaseDialog(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: /A08/ }).first().click()
  await page.getByRole('button', { name: /进入点餐|Enter/ }).click()
  const dialog = page.getByRole('dialog').filter({ hasText: '先选一锅底料' })
  await expect(dialog).toBeVisible()
  return dialog
}

test.describe('火锅底料必选环节 - E2E 验收测试', () => {
  test('REQ-001: 进入点餐页自动弹出底料环节且不可跳过', async ({ page }) => {
    const dialog = await goToMenuWithBaseDialog(page)
    await expect(dialog.getByText('必选')).toBeVisible()
    await expect(dialog.getByRole('button', { name: '选择 鎏金番茄鸳鸯锅' })).toBeVisible()
    await expect(dialog.getByRole('button', { name: '选择 牛油麻辣锅' })).toBeVisible()
    // 无关闭按钮；Esc 与遮罩点击都不能关闭
    await expect(dialog.getByRole('button', { name: '关闭' })).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(dialog).toBeVisible()
    const overlay = page.locator('[data-state="open"][aria-hidden="true"]').last()
    await overlay.click({ force: true, position: { x: 5, y: 5 } })
    await expect(dialog).toBeVisible()
    // 未选择直接确认：给出明确提示并保持弹窗，无法空选通过
    await dialog.getByRole('button', { name: '确认底料，开始点餐' }).click()
    await expect(dialog.getByRole('alert')).toContainText('请至少选择 1 种火锅底料后再继续')
    await expect(dialog).toBeVisible()
  })

  test('REQ-002: 支持单选与最多两种双拼，取消后可重选', async ({ page }) => {
    const dialog = await goToMenuWithBaseDialog(page)
    const tomato = dialog.getByRole('button', { name: '选择 鎏金番茄鸳鸯锅' })
    const spicy = dialog.getByRole('button', { name: '选择 牛油麻辣锅' })
    await tomato.click()
    await expect(tomato).toHaveAttribute('aria-pressed', 'true')
    await expect(dialog.getByText('已选 1 种底料')).toBeVisible()
    await spicy.click()
    await expect(dialog.getByText('已选 2 种底料')).toBeVisible()
    await expect(dialog.getByText('¥127.00')).toBeVisible()
    // 再次点击已选底料即取消；取消后仍可重新选择
    await tomato.click()
    await expect(dialog.getByText('已选 1 种底料')).toBeVisible()
    await tomato.click()
    await expect(dialog.getByText('已选 2 种底料')).toBeVisible()
  })

  test('REQ-002.1: 底料卡片不进入普通选购弹窗，而是打开底料环节', async ({ page }) => {
    await goToMenuWithBaseDialog(page)
    await confirmHotpotBase(page)
    await page.getByRole('button', { name: '锅底' }).click()
    const card = page.locator('article').first()
    await expect(card.getByText('请通过「火锅底料」环节选择')).toBeVisible()
    await card.locator('button').last().click()
    // 底料商品卡进入规格弹窗，确认后转到底料环节；不能像普通菜品一样直接加购
    await expect(page.getByRole('heading', { name: '鎏金番茄鸳鸯锅' })).toBeVisible()
    await expect(page.getByRole('button', { name: '确认并去选底料' })).toBeVisible()
    await expect(page.getByRole('button', { name: '加入本桌购物车' })).toHaveCount(0)
    await page.getByRole('button', { name: '确认并去选底料' }).click()
    const editDialog = page.getByRole('dialog').filter({ hasText: '先选一锅底料' })
    await expect(editDialog).toBeVisible()
  })

  test('REQ-003: 未选择底料时阻止提交订单并给出明确提示', async ({ page }) => {
    await goToMenuWithBaseDialog(page)
    await confirmHotpotBase(page)
    // 先正常加菜，再通过购物车“更换”回收底料，验证提交被阻断
    await page.getByRole('button', { name: '牛羊肉' }).click()
    await page.locator('article').first().locator('button').last().click()
    await page.getByRole('button', { name: '加入本桌购物车' }).click()
    const baseSummary = page.getByTestId('hotpot-base-summary').first()
    await baseSummary.getByRole('button', { name: '更换' }).click()
    await page.getByRole('button', { name: '取消底料' }).click()
    await expect(page.getByRole('button', { name: '确认底料，开始点餐' })).toHaveCount(0)
    const submit = page.getByRole('button', { name: '确认并提交订单' })
    await submit.click()
    await expect(page).toHaveURL(/#\/menu$/)
    await expect(page.locator('p[role="alert"]').filter({ hasText: '请先选择火锅底料' }).first()).toBeVisible()
    await expect(page).toHaveURL(/#\/menu$/)
  })

  test('REQ-004: 底料在购物车、订单详情和结账中正确展示且计入金额', async ({ page }) => {
    await goToMenuWithBaseDialog(page)
    await confirmHotpotBase(page)
    await page.getByRole('button', { name: '牛羊肉' }).click()
    await page.locator('article').first().locator('button').last().click()
    await page.getByRole('button', { name: '加入本桌购物车' }).click()
    const summary = page.getByTestId('hotpot-base-summary').first()
    await expect(summary).toContainText('鎏金番茄鸳鸯锅')
    await expect(summary).toContainText('¥68.00')
    // 菜品 42 + 底料 68 = 110，会员券 30 → 应付 80
    await page.getByRole('button', { name: '确认并提交订单' }).click()
    await expect(page).toHaveURL(/#\/order$/)
    await expect(page.getByTestId('hotpot-base-summary').first()).toContainText('鎏金番茄鸳鸯锅')
    await expect(page.getByText('火锅底料').first()).toBeVisible()
    await page.getByRole('button', { name: '去结账' }).click()
    await expect(page).toHaveURL(/#\/checkout$/)
    await expect(page.getByText('鎏金番茄鸳鸯锅').first()).toBeVisible()
    await expect(page.getByText('¥80.00', { exact: true }).first()).toBeVisible({ timeout: 15000 })
  })

  test('REQ-005: 加菜沿用已确认底料，不重复弹出必选环节', async ({ page }) => {
    await goToMenuWithBaseDialog(page)
    await confirmHotpotBase(page, '牛油麻辣锅')
    await page.getByRole('button', { name: '牛羊肉' }).click()
    await page.locator('article').first().locator('button').last().click()
    await page.getByRole('button', { name: '加入本桌购物车' }).click()
    await page.getByRole('button', { name: '确认并提交订单' }).click()
    await expect(page).toHaveURL(/#\/order$/)
    await page.getByRole('button', { name: '继续加菜' }).click()
    await expect(page).toHaveURL(/#\/menu$/)
    await expect(page.getByRole('dialog').filter({ hasText: '先选一锅底料' })).toHaveCount(0)
    await expect(page.getByTestId('hotpot-base-summary').first()).toContainText('牛油麻辣锅')
  })

  test('REQ-006: 已提交订单后可更换底料并同步到订单详情', async ({ page }) => {
    await goToMenuWithBaseDialog(page)
    await confirmHotpotBase(page)
    await page.getByRole('button', { name: '牛羊肉' }).click()
    await page.locator('article').first().locator('button').last().click()
    await page.getByRole('button', { name: '加入本桌购物车' }).click()
    await page.getByRole('button', { name: '确认并提交订单' }).click()
    await page.getByTestId('hotpot-base-summary').first().getByRole('button', { name: '更换' }).click()
    const editDialog = page.getByRole('dialog').filter({ hasText: '先选一锅底料' })
    // 更换为另一种底料：选择新底料后再取消旧底料，最终订单只保留新的底料
    await editDialog.getByRole('button', { name: '取消底料' }).click()
    await expect(page.getByTestId('hotpot-base-summary').first()).toContainText('未选择底料')
    // 取消后本桌底料为空，订单详情提示必须重新选择才能继续
    await page.getByTestId('hotpot-base-summary').first().getByRole('button', { name: '选择底料' }).click()
    const reSelectDialog = page.getByRole('dialog').filter({ hasText: '先选一锅底料' })
    await reSelectDialog.getByRole('button', { name: '选择 牛油麻辣锅' }).click()
    await reSelectDialog.getByRole('button', { name: '确认底料，开始点餐' }).click()
    await expect(page.getByTestId('hotpot-base-summary').first()).toContainText('牛油麻辣锅')
    await expect(page.getByTestId('hotpot-base-summary').first()).not.toContainText('鎏金番茄鸳鸯锅')
  })

  test('REQ-007: 底料售罄后需重新选择才能继续', async ({ page }) => {
    await goToMenuWithBaseDialog(page)
    await confirmHotpotBase(page)
    await page.getByRole('button', { name: '演示控制台' }).click()
    const consoleDialog = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: '演示控制台' }) })
    await expect(consoleDialog).toBeVisible()
    await expect(consoleDialog.getByRole('heading', { name: '菜品售罄开关' })).toBeVisible()
    await consoleDialog.getByRole('button', { name: '鎏金番茄鸳鸯锅' }).click()
    await consoleDialog.getByRole('button', { name: '完成设置' }).click()
    await expect(page.getByText('所选底料已售罄，请重新选择').first()).toBeVisible()
    await expect(page.getByRole('heading', { name: '先选一锅底料' })).toHaveCount(0)
    await expect(page.getByTestId('hotpot-base-summary').first()).toContainText('请先选择火锅底料')
    await expect(page.getByText('请先选择火锅底料').first()).toBeVisible()
  })

  test('REQ-008: 英文环境下底料环节与提示同步翻译', async ({ page }) => {
    // 应用从英文环境进入，底料数据与 UI 文案均走 i18n
    await page.addInitScript(() => localStorage.setItem('i18nextLng', 'en'))
    await page.goto('/')
    await page.getByRole('button', { name: /A08/ }).first().click()
    await page.getByRole('button', { name: /Start Ordering|进入点餐/ }).click()
    const dialog = page.getByRole('dialog').filter({ hasText: 'Choose Your Broth Base' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Required', { exact: true })).toBeVisible()
    await expect(dialog.getByRole('button', { name: /Golden Tomato Dual-Flavor Pot/ })).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Confirm Base & Start Ordering' })).toBeVisible()
  })

  test('NFR-001: 底料环节不改变菜单、主题、老人模式与路由基础能力', async ({ page }) => {
    await goToMenuWithBaseDialog(page)
    await confirmHotpotBase(page)
    await expect(page).toHaveURL(/#\/menu$/)
    await page.getByTestId('theme-toggle').click()
    await expect(page.locator('html')).toHaveClass(/dark/)
    await page.getByTestId('theme-toggle').click()
    await page.getByRole('button', { name: '锅底' }).click()
    await expect(page.getByRole('heading', { name: '鎏金番茄鸳鸯锅' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '牛油麻辣锅' })).toBeVisible()
  })

  test('REQ-004.2: 未选底料时进入结账被阻断（REQ-004 / TC-006）', async ({ page }) => {
    await goToMenuWithBaseDialog(page)
    await confirmHotpotBase(page)
    // 加菜并提交订单，进入订单详情
    await page.getByRole('button', { name: '牛羊肉' }).click()
    await page.locator('article').first().locator('button').last().click()
    await page.getByRole('button', { name: '加入本桌购物车' }).click()
    await page.getByRole('button', { name: '确认并提交订单' }).click()
    await expect(page).toHaveURL(/#\/order$/)
    // 在订单详情取消底料
    await page.getByTestId('hotpot-base-summary').first().getByRole('button', { name: '更换' }).click()
    await page.getByRole('button', { name: '取消底料' }).click()
    await expect(page.getByTestId('hotpot-base-summary').first()).toContainText('未选择底料')
    // 尝试去结账：应被阻断，停留在订单页
    await page.getByRole('button', { name: '去结账' }).click()
    await expect(page).toHaveURL(/#\/order$/)
    await expect(page.getByTestId('hotpot-base-summary').first()).toContainText('请先选择火锅底料')
  })

  test('REQ-006.4: 编辑弹窗「暂不修改」保留原选择（TC-010）', async ({ page }) => {
    await goToMenuWithBaseDialog(page)
    await confirmHotpotBase(page)
    // 打开编辑弹窗
    await page.getByTestId('hotpot-base-summary').first().getByRole('button', { name: '更换' }).click()
    const editDialog = page.getByRole('dialog').filter({ hasText: '先选一锅底料' })
    await expect(editDialog).toBeVisible()
    // 在草稿中修改选择（添加第二种底料），但不保存
    await editDialog.getByRole('button', { name: '选择 牛油麻辣锅' }).click()
    await expect(editDialog.getByText('已选 2 种底料')).toBeVisible()
    // 关闭弹窗（点击遮罩或 Esc）——编辑模式下允许关闭，等同于"暂不修改"
    await page.keyboard.press('Escape')
    await expect(editDialog).toHaveCount(0)
    // 底料汇总仍展示原选择，未被草稿修改影响
    await expect(page.getByTestId('hotpot-base-summary').first()).toContainText('鎏金番茄鸳鸯锅')
    await expect(page.getByTestId('hotpot-base-summary').first()).not.toContainText('牛油麻辣锅')
  })

  test('REQ-007.4: 全部底料售罄时降级不阻塞提交（TC-012）', async ({ page }) => {
    await goToMenuWithBaseDialog(page)
    await confirmHotpotBase(page)
    // 加菜
    await page.getByRole('button', { name: '牛羊肉' }).click()
    await page.locator('article').first().locator('button').last().click()
    await page.getByRole('button', { name: '加入本桌购物车' }).click()
    // 通过演示控制台将两种底料全部设为售罄
    await page.getByRole('button', { name: '演示控制台' }).click()
    const consoleDialog = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: '演示控制台' }) })
    await expect(consoleDialog).toBeVisible()
    await consoleDialog.getByRole('button', { name: '鎏金番茄鸳鸯锅' }).click()
    await consoleDialog.getByRole('button', { name: '牛油麻辣锅' }).click()
    await consoleDialog.getByRole('button', { name: '完成设置' }).click()
    // 已选底料被售罄联动清空，全部售罄为降级场景（baseRequired=false），
    // 汇总展示「未选择底料」而非阻断提示「请先选择火锅底料」
    await expect(page.getByTestId('hotpot-base-summary').first()).toContainText('未选择底料')
    // 通过汇总区「选择底料」打开弹窗验证降级提示（page.goto 会重置内存态 soldOut，
    // 无法保持全部售罄状态，因此用 SPA 内交互打开弹窗）
    await page.getByTestId('hotpot-base-summary').first().getByRole('button', { name: '选择底料' }).click()
    const dialog = page.getByRole('dialog').filter({ hasText: '今日底料已暂售' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('今日底料已暂售')).toBeVisible()
    // 关闭弹窗（编辑模式下 Esc 可关闭）
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    // 全部售罄时不阻塞提交：加菜后提交订单应成功
    await page.getByRole('button', { name: '牛羊肉' }).click()
    await page.locator('article').first().locator('button').last().click()
    await page.getByRole('button', { name: '加入本桌购物车' }).click()
    await page.getByRole('button', { name: '确认并提交订单' }).click()
    await expect(page).toHaveURL(/#\/order$/)
  })

  test('REQ-010.3: 加菜再次提交不重复计费底料（TC-017）', async ({ page }) => {
    await goToMenuWithBaseDialog(page)
    await confirmHotpotBase(page, '牛油麻辣锅')
    // 第一次提交含底料的订单
    await page.getByRole('button', { name: '牛羊肉' }).click()
    await page.locator('article').first().locator('button').last().click()
    await page.getByRole('button', { name: '加入本桌购物车' }).click()
    await page.getByRole('button', { name: '确认并提交订单' }).click()
    await expect(page).toHaveURL(/#\/order$/)
    // 继续加菜并再次提交
    await page.getByRole('button', { name: '继续加菜' }).click()
    await expect(page).toHaveURL(/#\/menu$/)
    await page.getByRole('button', { name: '牛羊肉' }).click()
    await page.locator('article').first().locator('button').last().click()
    await page.getByRole('button', { name: '加入本桌购物车' }).click()
    await page.getByRole('button', { name: '确认并提交订单' }).click()
    await expect(page).toHaveURL(/#\/order$/)
    // 进入结账，验证底料只计一次（¥59）
    await page.getByRole('button', { name: '去结账' }).click()
    await expect(page).toHaveURL(/#\/checkout$/)
    await expect(page.getByText('牛油麻辣锅').first()).toBeVisible()
    // 底料 ¥59 + 两份琥珀嫩牛肉 ¥42×2 = ¥143，满100减30 → 应付 ¥113
    await expect(page.getByText('¥113.00', { exact: true }).first()).toBeVisible({ timeout: 15000 })
  })

  test('REQ-009.2/009.3: 底料选项键盘可操作与 aria 断言（TC-018）', async ({ page }) => {
    const dialog = await goToMenuWithBaseDialog(page)
    // 底料选项按钮具备 aria-pressed 选中态（默认 false）
    const tomato = dialog.getByRole('button', { name: '选择 鎏金番茄鸳鸯锅' })
    await expect(tomato).toHaveAttribute('aria-pressed', 'false')
    // 键盘 Tab 聚焦到第一个底料选项并 Space 切换选中
    await tomato.focus()
    await expect(tomato).toBeFocused()
    await page.keyboard.press('Space')
    await expect(tomato).toHaveAttribute('aria-pressed', 'true')
    await expect(dialog.getByText('已选 1 种底料')).toBeVisible()
    // 空选点击确认时提示为 role="alert"
    await tomato.focus()
    await page.keyboard.press('Space')
    await expect(tomato).toHaveAttribute('aria-pressed', 'false')
    await dialog.getByRole('button', { name: '确认底料，开始点餐' }).click()
    const alertMsg = dialog.getByRole('alert')
    await expect(alertMsg).toContainText('请至少选择 1 种火锅底料后再继续')
  })
})
