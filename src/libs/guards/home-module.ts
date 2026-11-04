// A role's "home page": where its people land after sign-in, which menu they
// open with, and which dashboard they see. One setting per role (Settings ›
// Roles & Access), instead of the lists of role NAMES this used to be spread
// across the landing page, the sidebar and the dashboard.
//
// Empty means automatic: the first module the person can open, the menu of the
// module they hold most of, and the standard dashboard.

export type HomeModule = 'admin' | 'pos' | 'accounting' | 'inventory' | 'crm'

export const HOME_MODULES: readonly HomeModule[] = [
  'admin',
  'pos',
  'accounting',
  'inventory',
  'crm',
]

export const HOME_MODULE_OPTIONS: { value: HomeModule; label: string; hint: string }[] = [
  {
    value: 'admin',
    label: 'Owner view',
    hint: 'The owner’s menu and dashboard, across modules.',
  },
  { value: 'pos', label: 'POS', hint: 'Lands in POS, with the POS menu.' },
  { value: 'accounting', label: 'Accounting', hint: 'Lands in Accounting, with its dashboard.' },
  { value: 'inventory', label: 'Inventory', hint: 'Lands in Inventory, with its dashboard.' },
  { value: 'crm', label: 'CRM', hint: 'Lands in CRM, with the sales dashboard.' },
]

export function isHomeModule(value: unknown): value is HomeModule {
  return typeof value === 'string' && (HOME_MODULES as readonly string[]).includes(value)
}

/** The sidebar menu a home page opens with. */
export function sidebarSegmentForHome(home: string | null | undefined): string | null {
  if (!isHomeModule(home)) return null
  return home === 'admin' ? 'Business Owner' : home
}

/** The dashboard layout a home page shows. */
export function dashboardRoleForHome(
  home: string | null | undefined
): 'admin' | 'accounting' | 'inventory' | 'sales' | 'default' {
  switch (home) {
    case 'admin':
      return 'admin'
    case 'accounting':
      return 'accounting'
    case 'inventory':
      return 'inventory'
    case 'crm':
      return 'sales'
    default:
      return 'default'
  }
}

/** The module a home page lands in, or null when it isn't one (owner view, automatic). */
export function landingModuleForHome(home: string | null | undefined): string | null {
  return isHomeModule(home) && home !== 'admin' ? home : null
}
