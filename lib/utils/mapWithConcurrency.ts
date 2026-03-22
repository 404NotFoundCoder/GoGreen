/**
 * 以固定併發數執行 async mapper，避免 Promise.all 一次開出過多連線阻塞 UI／瀏覽器。
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const n = items.length;
  if (n === 0) return [];
  const results = new Array<R>(n);
  let next = 0;
  const pool = Math.max(1, Math.min(Math.floor(concurrency), n));

  async function worker() {
    while (true) {
      const i = next++;
      if (i >= n) break;
      results[i] = await mapper(items[i], i);
    }
  }

  await Promise.all(Array.from({ length: pool }, () => worker()));
  return results;
}
