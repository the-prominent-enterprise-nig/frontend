export const RECEIPT_HEADER_MAX_LENGTH = 200
export const RECEIPT_FOOTER_MAX_LENGTH = 500

export const RECEIPT_FOOTER_TOKENS = [
  { token: '{{branch_name}}', label: 'Branch name' },
  { token: '{{date}}', label: 'Date' },
]

const ALLOWED_LOGO_MIME = ['image/png', 'image/jpeg', 'image/svg+xml']
const MAX_LOGO_BYTES = 2 * 1024 * 1024

export function validateReceiptLogoFile(file: File): string | null {
  if (file.size > MAX_LOGO_BYTES) return 'Logo must be under 2 MB.'
  if (!ALLOWED_LOGO_MIME.includes(file.type)) return 'Logo must be PNG, JPG, or SVG.'
  return null
}

export function resolveReceiptFooterTokens(template: string, branchName: string) {
  const today = new Date().toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })
  return template.replace(/{{\s*branch_name\s*}}/g, branchName).replace(/{{\s*date\s*}}/g, today)
}
