import { expect, type Page } from '@playwright/test'

/** 完成进入点餐页自动弹出的底料必选环节（未确认前不可关闭）。 */
export async function confirmHotpotBase(page: Page, baseName = '鎏金番茄鸳鸯锅') {
  const baseDialog = page.getByRole('dialog').filter({ hasText: '先选一锅底料' })
  await expect(baseDialog).toBeVisible()
  await baseDialog.getByRole('button', { name: new RegExp(`选择 ${baseName}|Select ${baseName}`) }).click()
  await baseDialog.getByRole('button', { name: '确认底料，开始点餐' }).click()
  await expect(baseDialog).not.toBeVisible()
}
