// iOS WebView (в т.ч. Telegram) игнорирует user-scalable=no для жеста «щипок» —
// гасим масштабирование руками. Двойной тап уже отключён через touch-action.
export default defineNuxtPlugin(() => {
  const prevent = (e: Event) => e.preventDefault()

  // Safari/WKWebView-специфичные жесты масштабирования
  document.addEventListener('gesturestart', prevent, { passive: false })
  document.addEventListener('gesturechange', prevent, { passive: false })
  document.addEventListener('gestureend', prevent, { passive: false })

  // Пинч двумя пальцами
  document.addEventListener(
    'touchmove',
    (e) => { if (e.touches.length > 1) e.preventDefault() },
    { passive: false },
  )
})
