export async function portal<T>(body?: Record<string, unknown>): Promise<T> {
  const response = await fetch('/api/portal', body ? {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  } : undefined);
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) throw new Error(data?.error ?? 'اتصال به سامانهٔ حساب‌ها برقرار نشد.');
  return data as T;
}
