import type { ThemeId } from './types'

export const THEME_OPTIONS: { id: ThemeId; name: string }[] = [
    { id: 'graphite', name: 'Graphite' },
    { id: 'midnight', name: 'Midnight' },
    { id: 'nord', name: 'Nord' },
    { id: 'sunset', name: 'Sunset' },
    { id: 'forest', name: 'Forest' },
    { id: 'ocean', name: 'Ocean' },
    { id: 'rose', name: 'Rose' },
    { id: 'amber', name: 'Amber' },
    { id: 'violet', name: 'Violet' },
    { id: 'terminal', name: 'Terminal' }
]

const LEGACY_THEME_MAP: Record<string, ThemeId> = {
    dark: 'midnight',
    light: 'graphite'
}

export function normalizeThemeId(theme: string): ThemeId {
    const valid = THEME_OPTIONS.find(option => option.id === theme)
    if (valid) return valid.id
    return LEGACY_THEME_MAP[theme] ?? 'graphite'
}

export function applyTheme(theme: string): ThemeId {
    const normalizedTheme = normalizeThemeId(theme)
    document.documentElement.setAttribute('data-theme', normalizedTheme)
    return normalizedTheme
}
