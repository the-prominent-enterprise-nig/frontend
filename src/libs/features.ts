// Build-time switches for UI that is built but not in use. Plain constants (no
// 'use client', no localStorage) so server pages and client components can both
// read them. libs/flags.ts is client-only, so it can't gate server pages.

// CRM reminders are hidden everywhere (nav, dashboards, schedule buttons, the
// Open reminders cards). The routes and API still work. Flip to true to bring it
// all back.
export const REMINDERS_ENABLED = false
