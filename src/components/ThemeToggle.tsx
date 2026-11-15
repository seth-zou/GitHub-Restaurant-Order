import { Moon, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { useThemeMode } from '@/hooks/useThemeMode'

export function ThemeToggle() {
  const { t } = useTranslation()
  const { mode, toggle } = useThemeMode()
  const isDark = mode === 'dark'

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={toggle}
      aria-label={isDark ? t('common.aria_theme_light') : t('common.aria_theme_dark')}
      data-testid="theme-toggle"
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </Button>
  )
}
