import { NativeModules, Platform, Alert, Linking } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
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

async function createIOSShortcut(options: ShortcutOptions): Promise<ShortcutResult> {
  const deepLink = options.deepLink || `kis://org-app/${options.appId || options.partnerId}`;

  // Check whether the kis:// scheme is registered on this device.
  // It only registers at install time — if the app was installed before this
  // feature was added, iOS won't know about it until the app is reinstalled.
  let schemeReady = false;
  try {
    schemeReady = await Linking.canOpenURL(deepLink);
  } catch {
    schemeReady = false;
  }

  if (!schemeReady) {
    // Scheme not registered yet — the app must be reinstalled.
    Alert.alert(
      'One-time setup required',
      'To enable home screen shortcuts, the KIS app needs to be reinstalled once so iOS can register the required link.\n\nSteps:\n\n1. Delete KIS from your iPhone\n\n2. Reinstall it from the App Store (or rebuild from Xcode)\n\n3. Come back here and tap "Pin to Home Screen" again — it will work after that.',
      [{ text: 'OK', style: 'default' }],
    );
    return { state: 'error', error: 'URL scheme not registered. App reinstall required.' };
  }

  // Scheme is registered — proceed with Shortcuts app instructions.
  Clipboard.setString(deepLink);
  void registerShortcutOnServer(options, false);

  Alert.alert(
    `Add "${options.label}" to Home Screen`,
    `The link has been copied to your clipboard.\n\nSteps:\n\n1. Open the Shortcuts app (search for it — it comes with every iPhone)\n\n2. Tap + (top right) to create a new shortcut\n\n3. Tap "Add Action" → search "Open URLs" → select it\n\n4. Tap the URL field and paste — the link is already copied\n\n5. Tap the share icon at the top → "Add to Home Screen"\n\n6. Name it "${options.label}" → tap Add\n\nThe icon opens directly into this app inside KIS.`,
    [
      {
        text: 'Open Shortcuts',
        onPress: () =>
          Linking.openURL('shortcuts://').catch(() =>
            Alert.alert('Search for "Shortcuts" in your iPhone app library — it is pre-installed.'),
          ),
      },
      { text: 'Done', style: 'default' },
    ],
  );

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
