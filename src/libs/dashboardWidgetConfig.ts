// Widget registry — defines all possible dashboard widgets and their metadata.
// Role-specific defaults control which widgets are shown on first load / after reset.

export type WidgetDef = {
  id: string
  label: string
  emoji: string
  description: string
}

export type DashboardRole = 'admin' | 'hr' | 'accounting' | 'inventory' | 'default'

export const widgetRegistry: Record<string, WidgetDef> = {
  stats: {
    id: 'stats',
    label: 'Overview',
    emoji: '📊',
    description: 'Key metrics at a glance',
  },
  modules: {
    id: 'modules',
    label: 'Modules',
    emoji: '🗂️',
    description: 'Module overview cards',
  },
  alerts: {
    id: 'alerts',
    label: 'Alerts',
    emoji: '⚠️',
    description: 'System and operational alerts',
  },
  'quick-actions': {
    id: 'quick-actions',
    label: 'Quick Actions',
    emoji: '⚡',
    description: 'Frequent shortcuts',
  },
  'quick-links': {
    id: 'quick-links',
    label: 'Quick Links',
    emoji: '🔗',
    description: 'Navigation shortcuts',
  },
  'recent-activity': {
    id: 'recent-activity',
    label: 'Recent Activity',
    emoji: '🕐',
    description: 'Latest updates and changes',
  },
  'pending-leave': {
    id: 'pending-leave',
    label: 'Pending Requests',
    emoji: '⏳',
    description: 'Leave requests awaiting approval',
  },
  'payroll-table': {
    id: 'payroll-table',
    label: 'Payroll Periods',
    emoji: '💰',
    description: 'Recent payroll periods overview',
  },
}

// All widget IDs available per role — shown in the component selector.
export const allWidgetsByRole: Record<DashboardRole, string[]> = {
  admin: ['stats', 'modules', 'recent-activity'],
  hr: ['stats', 'alerts', 'quick-actions', 'recent-activity', 'pending-leave'],
  accounting: ['stats', 'quick-actions', 'recent-activity', 'payroll-table'],
  inventory: ['stats', 'alerts', 'recent-activity'],
  default: [],
}

// Default visible widgets per role — the target state when "Reset Layout" is clicked.
export const defaultWidgetsByRole: Record<DashboardRole, string[]> = {
  admin: ['stats', 'modules', 'recent-activity'],
  hr: ['stats', 'alerts', 'quick-actions', 'recent-activity', 'pending-leave'],
  accounting: ['stats', 'quick-actions', 'recent-activity', 'payroll-table'],
  inventory: ['stats', 'alerts', 'recent-activity'],
  default: [],
}
