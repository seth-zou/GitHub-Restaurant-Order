import { useState } from 'react'
import { Check, Monitor, Moon, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { useThemeMode, type ThemePreference } from '@/hooks/useThemeMode'
import { cn } from '@/lib/utils'

const PREFERENCE_OPTIONS: ThemePreference[] = ['system', 'light', 'dark']

const PREFERENCE_ICON = {
  system: Monitor,
  light: Sun,
  dark: Moon,
} as const

/**
 * 主题入口：顶栏 / 首页 / 欢迎页共用。
 * 按钮展示当前偏好图标，打开「外观模式」弹层后可在跟随系统、白天、夜间之间选择。
 */
export function ThemeToggle() {
  const { t } = useTranslation()
  const { preference, resolved, system, setPreference } = useThemeMode()
  const [open, setOpen] = useState(false)
  const Icon = PREFERENCE_ICON[preference]

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label={t('common.theme_entry', { mode: t(`common.theme_${preference}`) })}
          data-testid="theme-toggle"
        >
          <Icon size={18} />
        </Button>
      </DialogTrigger>
      <DialogContent title={t('common.theme_title')}>
        <p className="mt-2 text-sm leading-6 text-charcoal-500">{t('common.theme_desc')}</p>
        <div className="mt-4 space-y-2" role="radiogroup" aria-label={t('common.theme_title')}>
          {PREFERENCE_OPTIONS.map((option) => {
            const OptionIcon = PREFERENCE_ICON[option]
            const active = preference === option
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={active}
                data-testid={`theme-option-${option}`}
                onClick={() => {
                  setPreference(option)
                  setOpen(false)
                }}
                className={cn(
                  'flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chili-500',
                  active ? 'border-chili-500 bg-chili-50' : 'border-charcoal-900/10 bg-white hover:border-chili-500/30 hover:bg-chili-50',
                )}
              >
                <span
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                    active ? 'bg-chili-500 text-white' : 'bg-rice-100 text-charcoal-700',
                  )}
                >
                  <OptionIcon size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn('block text-sm font-bold', active ? 'text-chili-600' : 'text-charcoal-900')}>
                    {t(`common.theme_${option}`)}
                  </span>
                  {option === 'system' && (
                    <span className="mt-0.5 block text-xs text-charcoal-500">
                      {t('common.theme_system_hint', { mode: t(`common.theme_${system}`) })}
                    </span>
                  )}
                </span>
                {active && <Check size={18} className="shrink-0 text-chili-500" />}
              </button>
            )
          })}
        </div>
        <p className="mt-3 text-xs text-charcoal-500" data-testid="theme-current">
          {t('common.theme_current', { mode: t(`common.theme_${resolved}`) })}
        </p>
      </DialogContent>
    </Dialog>
  )
}
