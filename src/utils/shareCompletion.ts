import { Share } from 'react-native';

export const wasNativeShareCompleted = (
  result: Awaited<ReturnType<typeof Share.share>> | null | undefined,
) => {
  if (!result) return false;
  return result.action !== Share.dismissedAction;
};
