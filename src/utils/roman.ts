/**
 * Converts a positive number to Roman numeral string.
 */
export function toRoman(num: number): string {
  if (num <= 0) return '';
  const romanNumerals: [number, string][] = [
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let result = '';
  let n = num;
  for (const [val, sym] of romanNumerals) {
    while (n >= val) {
      result += sym;
      n -= val;
    }
  }
  return result;
}

/**
 * Formats route names to use Roman numerals by default.
 * E.g., "Маршрут 1" -> "Маршрут I", "Route 2" -> "Route II", "Маршрут 3" -> "Маршрут III".
 * Also preserves names that already have Roman numerals or custom names.
 */
export function formatRouteRoman(name: string): string {
  if (!name) return '';
  return name.replace(/\b(Маршрут|Route)\s+(\d+)\b/gi, (_, prefix, numStr) => {
    const num = parseInt(numStr, 10);
    const roman = toRoman(num);
    return `${prefix} ${roman || numStr}`;
  });
}
