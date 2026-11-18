import { Baby } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { useChildMode } from '@/hooks/useChildMode'

interface ChildModeToggleProps {
  /** 由上层统一持有的儿童模式状态；未传时组件自行管理，便于首页/欢迎页独立挂载。 */
  enabled?: boolean
  onToggle?: () => void
}

export function ChildModeToggle({ enabled: controlled, onToggle }: ChildModeToggleProps) {
  const { t } = useTranslation()
  const { enabled: local, toggle } = useChildMode()
  const enabled = controlled ?? local
  const handleToggle = onToggle ?? toggle

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={handleToggle}
      aria-label={enabled ? t('common.aria_child_off') : t('common.aria_child_on')}
      aria-pressed={enabled}
      data-testid="child-mode-toggle"
    >
      <Baby size={18} className={enabled ? 'text-amber-500' : ''} />
    </Button>
  )
}
