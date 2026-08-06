export interface AppModule {
  key: string // permission prefix/module key
  routeSegment: string // first URL segment used for navigation
  label: string
  href: string
  // Minimum to see it in sidebar. An array means "any of" — the user needs
  // just one of the listed permissions, not all.
  requiredPermission: string | string[]
  icon: string // icon name for sidebar
}

export const MODULES: AppModule[] = [
  // HR module temporarily hidden
  // {
  //   key: 'hr',
  //   routeSegment: 'human-resource',
  //   label: 'HR & Payroll',
  //   href: '/human-resource/employees',
  //   requiredPermission: 'hr:employees:read',
  //   icon: 'users',
  // },
  {
    key: 'accounting',
    routeSegment: 'accounting',
    label: 'Accounting',
    href: '/accounting',
    requiredPermission: 'accounting:*',
    icon: 'chart-bar',
  },
  {
    key: 'inventory',
    routeSegment: 'inventory',
    label: 'Inventory',
    href: '/inventory',
    requiredPermission: 'inventory:*',
    icon: 'package',
  },
  // Procurement module not yet implemented
  // {
  //   key: 'procurement',
  //   routeSegment: 'procurement',
  //   label: 'Procurement',
  //   href: '/procurement/suppliers',
  //   requiredPermission: 'procurement:*',
  //   icon: 'truck',
  // },
  {
    key: 'pos',
    routeSegment: 'pos',
    label: 'Point of Sale',
    href: '/pos',
    // Array = "any of" — Credit Applications now lives inside POS's own nav
    // (see PosNav.tsx), so a Credit Investigator (credit:* permissions,
    // zero pos:* permissions) still needs to see this top-level link to
    // reach it. See TopBar.tsx/SideBar.tsx/(dashboard)/page.tsx for the
    // "any of" consumer logic.
    requiredPermission: ['pos:sessions:open', 'credit:*'],
    icon: 'shopping-cart',
  },
  {
    key: 'crm',
    routeSegment: 'crm',
    label: 'CRM',
    href: '/crm',
    requiredPermission: 'crm:*',
    icon: 'users-round',
  },
  // {
  //   key: 'sales',
  //   routeSegment: 'sales',
  //   label: 'Sales & Orders',
  //   href: '/sales',
  //   requiredPermission: 'sales:*',
  //   icon: 'shopping-cart',
  // },
  // add more modules here — sidebar auto-updates
]
