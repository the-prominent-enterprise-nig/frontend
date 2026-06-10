export interface AppModule {
  key: string // permission prefix/module key
  routeSegment: string // first URL segment used for navigation
  label: string
  href: string
  requiredPermission: string // minimum to see it in sidebar
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
  {
    key: 'procurement',
    routeSegment: 'procurement',
    label: 'Procurement',
    href: '/procurement/suppliers',
    requiredPermission: 'procurement:*',
    icon: 'truck',
  },
  {
    key: 'pos',
    routeSegment: 'pos',
    label: 'Point of Sale',
    href: '/pos',
    requiredPermission: 'pos:sessions:open',
    icon: 'shopping-cart',
  },
  {
    key: 'queue',
    routeSegment: 'queue-management',
    label: 'Queue',
    href: '/queue-management',
    requiredPermission: 'queue:*',
    icon: 'bell',
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
