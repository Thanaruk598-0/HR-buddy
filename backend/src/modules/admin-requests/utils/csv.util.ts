function escapeCsvValue(value: string): string {
  if (!/[",\r\n]/.test(value)) {
    return value;
  }

  return `"${value.replace(/"/g, '""')}"`;
}

export function toCsvCell(value: unknown): string {
  if (value === undefined || value === null) {
    return '';
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}

export function buildCsv(headers: string[], rows: unknown[][]): string {
  const headerLine = headers
    .map((value) => escapeCsvValue(toCsvCell(value)))
    .join(',');
  const rowLines = rows
    .map((row) =>
      row.map((value) => escapeCsvValue(toCsvCell(value))).join(','),
    )
    .join('\n');

  return rowLines ? `${headerLine}\n${rowLines}` : headerLine;
}
