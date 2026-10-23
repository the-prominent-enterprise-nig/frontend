import { toast } from 'sonner'

export type ToastStatus = 'success' | 'warning' | 'error' | 'info' | 'loading'

export type ToastPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'

export interface AppToastOptions {
  title: string
  description?: string
  status?: ToastStatus
  position?: ToastPosition
  /** A button on the toast, e.g. "View transfer". */
  action?: { label: string; onClick: () => void }
}

export function showToast({
  title,
  description,
  status = 'info',
  position = 'top-right',
  action,
}: AppToastOptions) {
  switch (status) {
    case 'success':
      return toast.success(title, { description, position, action })
    case 'warning':
      return toast.warning(title, { description, position, action })
    case 'error':
      return toast.error(title, { description, position, action })
    case 'loading':
      return toast.loading(title, { description, position, action })
    case 'info':
    default:
      return toast.info(title, { description, position, action })
  }
}

export function dismissToast(toastId?: string | number) {
  return toast.dismiss(toastId)
}
