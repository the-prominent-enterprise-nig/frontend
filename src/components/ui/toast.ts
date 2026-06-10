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
}

export function showToast({
  title,
  description,
  status = 'info',
  position = 'top-right',
}: AppToastOptions) {
  switch (status) {
    case 'success':
      return toast.success(title, { description, position })
    case 'warning':
      return toast.warning(title, { description, position })
    case 'error':
      return toast.error(title, { description, position })
    case 'loading':
      return toast.loading(title, { description, position })
    case 'info':
    default:
      return toast.info(title, { description, position })
  }
}

export function dismissToast(toastId?: string | number) {
  return toast.dismiss(toastId)
}
