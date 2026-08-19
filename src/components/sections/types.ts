export type SectionRenderProps<T = Record<string, any>> = {
  data: T;
  palette: any;
  typography: any;
  spacing: any;
  /** When set, the section's own text fields render as editable inputs
   * directly in the visual layout instead of static <Text> — used by
   * LiveSectionPreview so typing in the preview writes straight back into
   * the same draft data the form below also edits. Omitted everywhere
   * else (saved-section cards, read-only landing previews), which keeps
   * those call sites exactly as they were. */
  onFieldChange?: (key: string, value: string) => void;
};
