export interface Point { x: number; y: number }
export interface InterpolationTerm { coefficient: number; offsets: number[]; value: number }

export function isInterpolationInput(points: Point[], target: number) {
  return points.length >= 2 && points.length <= 30 && Number.isFinite(target) &&
    points.every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y)) &&
    new Set(points.map(({ x }) => x)).size === points.length;
}

export function interpolate(points: Point[], target: number) {
  if (!isInterpolationInput(points, target)) throw new Error('بین ۲ تا ۳۰ نقطه با x متفاوت و عددی وارد کنید.');

  const differences = points.map(({ y }) => y);
  for (let order = 1; order < points.length; order++) {
    for (let index = points.length - 1; index >= order; index--) {
      differences[index] = (differences[index] - differences[index - 1]) / (points[index].x - points[index - order].x);
    }
  }
  const terms: InterpolationTerm[] = differences.map((coefficient, index) => {
    const offsets = points.slice(0, index).map(({ x }) => target - x);
    return { coefficient, offsets, value: offsets.reduce((product, offset) => product * offset, coefficient) };
  });
  const value = terms.reduce((sum, term) => sum + term.value, 0);
  if (!Number.isFinite(value) || differences.some((difference) => !Number.isFinite(difference))) {
    throw new Error('بزرگی داده‌ها از دامنهٔ محاسبه فراتر رفت.');
  }
  const xs = points.map(({ x }) => x);
  return { terms, value, outside: target < Math.min(...xs) || target > Math.max(...xs) };
}
