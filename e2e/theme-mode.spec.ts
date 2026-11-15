import { expect, test } from '@playwright/test'

test.describe('夜间模式', () => {
  test.use({ colorScheme: 'dark' })

  test('默认跟随系统偏好，切换后刷新保持用户选择', async ({ page }) => {
    await page.goto('/')

    await expect(page.locator('html')).toHaveAttribute('data-theme-mode', 'dark')
    const toggle = page.getByTestId('theme-toggle')
    await expect(toggle).toBeVisible()

    await toggle.click()
    await expect(page.locator('html')).toHaveAttribute('data-theme-mode', 'light')
    await expect(page.locator('html')).not.toHaveClass(/dark/)

    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme-mode', 'light')
    await expect(page.locator('html')).not.toHaveClass(/dark/)
  })
})
