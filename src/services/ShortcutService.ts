import { NativeModules, Platform, Alert } from 'react-native';
import { postRequest } from '@/network/post';
import { deleteRequest } from '@/network/delete';
import ROUTES from '@/network';

const { KISShortcutModule } = NativeModules;

export type ShortcutState = 'idle' | 'loading' | 'success' | 'already_pinned' | 'error';

export type ShortcutOptions = {
  appId?: string;
  partnerId: string;
  partnerName: string;
  label: string;
  iconUrl?: string;
  deepLink?: string;
  deviceId?: string;
};

export type ShortcutResult = {
  state: ShortcutState;
  shortcutId?: string;
  error?: string;
};

async function registerShortcutOnServer(options: ShortcutOptions, pinned: boolean): Promise<string | null> {
  try {
    const deepLink = options.deepLink || `kis://org-app/${options.appId || options.partnerId}`;
    const res: any = await postRequest(
      ROUTES.partners.appShortcuts,
      {
        partner_id: options.partnerId,
        app_id: options.appId || null,
        device_id: options.deviceId || '',
        shortcut_name: options.label,
        icon: options.iconUrl || '',
        deep_link: deepLink,
        pinned,
      },
    );
    if (res?.detail === 'already_pinned') return 'already_pinned';
    return res?.id || null;
  } catch {
    return null;
  }
}

async function createAndroidShortcut(options: ShortcutOptions): Promise<ShortcutResult> {
  if (!KISShortcutModule) {
    return { state: 'error', error: 'Native shortcut module not available.' };
  }

  const deepLink = options.deepLink || `kis://org-app/${options.appId || options.partnerId}`;
  const shortcutId = `kis_app_${options.appId || options.partnerId}`;

  try {
    const canPin: boolean = await KISShortcutModule.canPinShortcuts();
    let pinned = false;

    if (canPin) {
      await KISShortcutModule.pinShortcut({
        id: shortcutId,
        label: options.label,
        deepLink,
        iconUrl: options.iconUrl || null,
      });
      pinned = true;
    } else {
      // Fall back to dynamic shortcut (long-press app icon)
      await KISShortcutModule.addDynamicShortcut({
        id: shortcutId,
        label: options.label,
        deepLink,
      });
    }

    const serverId = await registerShortcutOnServer(options, pinned);
    if (serverId === 'already_pinned') {
      return { state: 'already_pinned', shortcutId };
    }

    return { state: 'success', shortcutId: serverId || shortcutId };
  } catch (e: any) {
    return { state: 'error', error: e?.message || 'Failed to create shortcut.' };
  }
}

function createIOSShortcut(options: ShortcutOptions): ShortcutResult {
  // iOS doesn't expose a public API for programmatic home screen shortcuts.
  // Best available: clear step-by-step instructions via Alert.
  const deepLink = options.deepLink || `kis://org-app/${options.appId || options.partnerId}`;
  Alert.alert(
    `Add "${options.label}" to Home Screen`,
    `To add this app to your iOS Home Screen:\n\n1. Open Safari\n2. Go to: ${deepLink}\n3. Tap the Share button (box with arrow)\n4. Scroll down and tap "Add to Home Screen"\n5. Tap "Add"\n\nThe shortcut will open directly inside KIS.`,
    [{ text: 'Got it', style: 'default' }],
  );
  // Register server-side for analytics even though we can't confirm device install
  void registerShortcutOnServer(options, false);
  return { state: 'success' };
}

export async function createAppShortcut(options: ShortcutOptions): Promise<ShortcutResult> {
  if (Platform.OS === 'android') {
    return createAndroidShortcut(options);
  }
  return createIOSShortcut(options);
}

export async function removeShortcutFromServer(shortcutId: string): Promise<void> {
  try {
    await deleteRequest(ROUTES.partners.appShortcutRemove(shortcutId));
  } catch {
    // best-effort
  }
}
