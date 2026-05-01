const parseRichTextCandidate = (candidate: any) => {
  if (!candidate) return null;
  if (
    typeof candidate === 'object' &&
    !Array.isArray(candidate) &&
    candidate.type === 'doc'
  ) {
    return candidate;
  }
  if (typeof candidate !== 'string') return null;
  const trimmed = candidate.trim();
  if (!trimmed.startsWith('{')) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (
      parsed &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      parsed.type === 'doc'
    ) {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
};

export const getFeedRichTextValue = (item: any) => {
  const candidates = [
    item?.text_doc,
    item?.textDoc,
    item?.text,
    item?.styled_text,
    item?.styledText,
    item?.styled_text?.doc,
    item?.styledText?.doc,
    item?.metadata?.text_doc,
    item?.metadata?.textDoc,
    item?.metadata?.text,
    item?.metadata?.styled_text,
    item?.metadata?.styledText,
    item?.metadata?.styled_text?.doc,
    item?.metadata?.styledText?.doc,
  ];
  for (const candidate of candidates) {
    const parsed = parseRichTextCandidate(candidate);
    if (parsed) return parsed;
  }
  return null;
};

export const getFeedPlainText = (item: any) =>
  String(
    item?.text_plain ??
      item?.textPlain ??
      (typeof item?.text === 'string' ? item.text : '') ??
      item?.styled_text?.text ??
      item?.styledText?.text ??
      item?.body ??
      item?.metadata?.text_plain ??
      item?.metadata?.textPlain ??
      (typeof item?.metadata?.text === 'string' ? item.metadata.text : '') ??
      item?.metadata?.styled_text?.text ??
      item?.metadata?.styledText?.text ??
      '',
  ).trim();

export const hasFeedRichText = (item: any) =>
  Boolean(getFeedRichTextValue(item));
