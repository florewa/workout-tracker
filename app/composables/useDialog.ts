type ToastKind = 'success' | 'error' | 'info'

interface Toast { id: number; message: string; kind: ToastKind }

interface ConfirmOptions {
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
}

// Модульное состояние — общее для хост-компонента и всех вызовов
const toasts = ref<Toast[]>([])
let seq = 0

const confirmState = reactive({
  open: false,
  title: undefined as string | undefined,
  message: '',
  confirmText: 'Ок',
  cancelText: 'Отмена',
  danger: false,
  resolve: null as ((value: boolean) => void) | null,
})

export function useDialog() {
  function toast(message: string, kind: ToastKind = 'info') {
    const id = ++seq
    toasts.value = [...toasts.value, { id, message, kind }]
    setTimeout(() => { toasts.value = toasts.value.filter(t => t.id !== id) }, 3200)
  }

  function confirm(options: ConfirmOptions): Promise<boolean> {
    confirmState.title = options.title
    confirmState.message = options.message
    confirmState.confirmText = options.confirmText ?? 'Ок'
    confirmState.cancelText = options.cancelText ?? 'Отмена'
    confirmState.danger = options.danger ?? false
    confirmState.open = true
    return new Promise<boolean>((resolve) => { confirmState.resolve = resolve })
  }

  function settleConfirm(value: boolean) {
    if (!confirmState.open) return
    confirmState.open = false
    const resolve = confirmState.resolve
    confirmState.resolve = null
    resolve?.(value)
  }

  return { toast, confirm, toasts, confirmState, settleConfirm }
}
