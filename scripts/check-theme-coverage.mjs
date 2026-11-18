#!/usr/bin/env node
/**
 * 主题覆盖守卫：确保组件里使用的颜色工具类都有对应的夜间映射，或落在明确的安全清单里。
 * 目的：避免新增页面/组件时出现夜间模式残留的浅色块，也避免颜色类继续无声扩散。
 *
 * 用法：npm run theme:check
 * 失败时输出缺失映射的类名及所在文件，便于直接修复。
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SRC_DIR = join(ROOT, 'src')
const CSS_FILE = join(ROOT, 'src/index.css')

/** 颜色工具类：只覆盖项目自定义色板与 white/black，避免把第三方类当成违规。 */
const COLOR_UTILITY = /\b((?:[a-z-]+:)*(?:bg|text|border|ring|from|via|to|fill|stroke)-(?:rice|charcoal|chili|amber|emerald|white|black)(?:-\d{2,3})?(?:\/\d{1,3})?)\b/g

/**
 * 安全清单：这些类本身就用于深色表面（图片遮罩、深色横幅、主按钮），
 * 两套主题下都保持同一色值，不需要也不应该被 .dark 覆盖。
 */
const SAFE_ON_DARK = new Map([
  ['text-white', '深色横幅 / 图片遮罩 / 主按钮白色文字'],
  ['bg-chili-500', '辣红主按钮与选中态，两套主题共用'],
  ['bg-chili-600', '辣红主按钮 hover，两套主题共用'],
  ['bg-amber-400', '进度徽章底色，两套主题共用'],
  ['border-white', '服务红点描边，叠在深色横幅上'],
  ['text-amber-400', '深色 hero / 订单进度上的注意色'],
  ['bg-chili-500/30', '深色 hero 的辣红氛围光晕'],
  ['bg-white/15', '深色订单进度条未完成段'],
  ['bg-white/20', '深色图片遮罩上的半透明标签'],
  ['bg-white/10', '深色会员卡与进度节点背景'],
  ['bg-charcoal-900/90', 'Toast 深色底，两套主题共用'],
  ['bg-charcoal-900/40', '弹层遮罩，两套主题共用（.dark 下另有更深的映射，见 CSS）'],
  ['from-charcoal-900', '图片渐变遮罩起始色'],
  ['from-charcoal-900/45', '图片渐变遮罩起始色'],
  ['from-charcoal-900/70', '图片渐变遮罩起始色'],
  ['from-charcoal-900/80', '图片渐变遮罩起始色'],
  ['to-charcoal-700', '会员卡渐变终点'],
  ['via-charcoal-900/20', '图片渐变遮罩过渡色'],
])

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

const css = readFileSync(CSS_FILE, 'utf8')
/** 提取所有以 .dark 开头的选择器；支持 .dark .group:hover .group-hover\:x 这类带伪类的写法。 */
const darkSelectors = css
  .split('\n')
  .filter((line) => line.trimStart().startsWith('.dark'))
  .map((line) => line.slice(0, line.indexOf('{')).trim())
const files = walk(SRC_DIR).filter((file) => /\.(ts|tsx)$/.test(file))
const missing = []

for (const file of files) {
  const source = readFileSync(file, 'utf8')
  const classes = new Set(source.match(COLOR_UTILITY) ?? [])
  for (const utility of classes) {
    if (SAFE_ON_DARK.has(utility)) continue
    // CSS 中的选择器会把 : 和 / 转义，例如 .dark .hover\:bg-chili-50:hover
    const escaped = utility.replace(/[:/]/g, (token) => `\\${token}`)
    if (darkSelectors.some((selector) => selector.includes(escaped))) continue
    missing.push({ utility, file: relative(ROOT, file) })
  }
}

if (missing.length > 0) {
  console.error('✗ 发现未适配夜间模式的颜色工具类：')
  for (const { utility, file } of missing) {
    console.error(`  - ${utility}  (${file})`)
  }
  console.error('\n处理方式：在 src/index.css 的 .dark 映射中补充对应色值，或说明它属于深色底安全类并加入 SAFE_ON_DARK。')
  process.exit(1)
}

console.log(`✓ 主题覆盖检查通过：${files.length} 个源文件中的颜色类均有夜间映射或属于安全清单。`)
