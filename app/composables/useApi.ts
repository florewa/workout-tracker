export function useApi() {
  const initData = useState<string>('tgInitData', () => '')

  function headers(): Record<string, string> {
    if (initData.value) return { Authorization: `tma ${initData.value}` }
    return {} // dev: сервер использует AUTH_DEV_USER_ID
  }

  return {
    get: <T>(url: string, query?: Record<string, unknown>) =>
      $fetch<T>(url, { headers: headers(), query }),
    post: <T>(url: string, body?: unknown) =>
      $fetch<T>(url, { method: 'POST', headers: headers(), body }),
    patch: <T>(url: string, body?: unknown) =>
      $fetch<T>(url, { method: 'PATCH', headers: headers(), body }),
    put: <T>(url: string, body?: unknown) =>
      $fetch<T>(url, { method: 'PUT', headers: headers(), body }),
    del: <T>(url: string) =>
      $fetch<T>(url, { method: 'DELETE', headers: headers() }),
  }
}
