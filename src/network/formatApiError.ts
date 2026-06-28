const humanizeField = (field: string) =>
  field === 'non_field_errors'
    ? ''
    : field.replace(/_/g, ' ').replace(/^./, value => value.toUpperCase());

const collectMessages = (value: unknown, path = ''): string[] => {
  if (typeof value === 'string') return [path ? `${humanizeField(path)}: ${value}` : value];
  if (Array.isArray(value)) return value.flatMap(item => collectMessages(item, path));
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) =>
      collectMessages(item, key === 'detail' || key === 'message' ? '' : key),
    );
  }
  return [];
};

export const formatApiError = (payload: unknown, fallback: string): string => {
  const messages = collectMessages(payload);
  return messages.length ? messages.slice(0, 3).join('\n') : fallback;
};
