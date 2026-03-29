// src/screens/chat/components/AddContactForm.tsx

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
} from 'react-native';
import CountryPicker, {
  Country,
  CountryCode,
} from 'react-native-country-picker-modal';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { KISIcon } from '@/constants/kisIcons';
import { KIS_TOKENS } from '../../../theme/constants';
import { addContactsStyles as styles } from '../addContactsStyles';
import ROUTES from '@/network';
import { getRequest } from '@/network/get';

const CONTACTS_STORAGE_KEY = 'KIS_CONTACTS_V1';
const CHATS_STORAGE_KEY = 'KIS_CHATS_V1';

type AddContactFormProps = {
  palette: any;
  onSubmit?: (payload: {
    name: string;
    phone: string;      // normalized phone (e.g. +2376...)
    countryCode: string; // dial code (e.g. +237)
  }) => Promise<void> | void;
};

type StoredContact = {
  id: string;
  name: string;
  label: string;
  rawPhone: string;    // whatever the user typed
  dialCode: string;    // e.g. "+237"
  fullPhone: string;   // normalized, e.g. "+237612345678"
  createdAt: string;
};

type RegistrationResult = {
  registered: boolean;
  chatId?: string | null;
  userId?: string | number;
};

const saveContactToDevice = async (contact: StoredContact) => {
  try {
    const existingRaw = await AsyncStorage.getItem(CONTACTS_STORAGE_KEY);
    const existing: StoredContact[] = existingRaw ? JSON.parse(existingRaw) : [];

    // Check if contact already exists by fullPhone
    const idx = existing.findIndex(
      (c) => c.fullPhone === contact.fullPhone,
    );

    if (idx >= 0) {
      existing[idx] = { ...existing[idx], ...contact };
    } else {
      existing.push(contact);
    }

    await AsyncStorage.setItem(
      CONTACTS_STORAGE_KEY,
      JSON.stringify(existing),
    );
  } catch (err) {
    console.warn('Failed to persist contact locally', err);
    throw err;
  }
};

const checkContactRegistration = async (
  fullPhone: string,
): Promise<RegistrationResult> => {
  try {
    // Send phone as a query param on the GET request
    const url = `${ROUTES.auth.checkContact}?phone=${encodeURIComponent(fullPhone)}`;

    const res = await getRequest(url);
    console.log('checkContactRegistration: response =', res);

    // getRequest returns { success, data, message, status? }
    if (!res.success) {
      console.warn(
        'Registration check failed',
        res.status,
        res.message,
      );
      return { registered: false };
    }

    const data = res.data as any;
    console.log('checkContactRegistration: data =', data);

    // Backend expected response:
    // { registered: boolean, userId?: number, chatId?: string | null }
    return {
      registered: !!data?.registered,
      chatId: data?.chatId ?? null,
      userId: data?.userId,
    };
  } catch (err) {
    console.warn('Error while checking registration', err);
    return { registered: false };
  }
};

const addContactChatIfNeeded = async (
  contact: StoredContact,
  registration: RegistrationResult,
) => {
  if (!registration.registered) return;

  try {
    const chatsRaw = await AsyncStorage.getItem(CHATS_STORAGE_KEY);
    const chats: any[] = chatsRaw ? JSON.parse(chatsRaw) : [];

    // Avoid duplicates
    const exists = chats.some(
      (c) =>
        c.contactPhone === contact.fullPhone ||
        c.contactUserId === registration.userId,
    );
    if (exists) return;

    const newChat: any = {
      // Align this with your real Chat type
      id: registration.chatId ?? contact.fullPhone,
      title: contact.name,
      contactPhone: contact.fullPhone,
      contactUserId: registration.userId ?? null,
      createdAt: new Date().toISOString(),
      unreadCount: 0,
      lastMessage: null,
      isContactChat: true,
    };

    chats.push(newChat);
    await AsyncStorage.setItem(CHATS_STORAGE_KEY, JSON.stringify(chats));
  } catch (err) {
    console.warn('Failed to add chat for contact', err);
    // We don't throw here to avoid blocking contact save flow
  }
};

export const AddContactForm: React.FC<AddContactFormProps> = ({
  palette,
  onSubmit,
}) => {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [label, setLabel] = useState<'Mobile' | 'Work' | 'Home'>('Mobile');

  // Country picker state
  const [countryCode, setCountryCode] = useState<CountryCode>('CM'); // Cameroon by default
  const [dialCode, setDialCode] = useState('+237'); // displayed dial code
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSave =
    fullName.trim().length > 0 &&
    phone.trim().length > 0 &&
    !submitting;

  const normalizePhone = () => {
    // Remove non-digits from the phone and leading zeros
    const digits = phone.replace(/\D/g, '');
    const withoutLeadingZero = digits.replace(/^0+/, '');
    return `${dialCode}${withoutLeadingZero}`;
  };

  const handleCountrySelect = (country: Country) => {
    setCountryCode(country.cca2 as CountryCode);

    // CountryPicker gives callingCode as array of strings without '+'
    const firstCallingCode = country.callingCode?.[0];
    if (firstCallingCode) {
      setDialCode(`+${firstCallingCode}`);
    }

    setCountryPickerVisible(false);
  };

  const handleSave = async () => {
    if (!fullName.trim()) {
      setError('Please enter a name');
      return;
    }
    if (!phone.trim()) {
      setError('Please enter a phone number');
      return;
    }
    setError(null);

    const normalizedPhone = normalizePhone();
    const contact: StoredContact = {
      id: `${Date.now()}-${normalizedPhone}`,
      name: fullName.trim(),
      label,
      rawPhone: phone.trim(),
      dialCode,
      fullPhone: normalizedPhone,
      createdAt: new Date().toISOString(),
    };

    setSubmitting(true);
    try {
      // 1) Save contact to device (local store)
      await saveContactToDevice(contact);

      // 2) Check backend if this phone is registered
      const registration = await checkContactRegistration(
        contact.fullPhone,
      );

      // 3) If registered, add to current user's chats list in local store
      await addContactChatIfNeeded(contact, registration);

      if (registration.registered) {
        Alert.alert(
          'Contact saved',
          `This contact is on KIS.\nA chat has been added for:\n\nName: ${fullName}\nPhone: ${normalizedPhone}\nLabel: ${label}`,
        );
      } else {
        Alert.alert(
          'Contact saved',
          `Contact saved locally.\nThey are not yet registered on KIS.\n\nName: ${fullName}\nPhone: ${normalizedPhone}\nLabel: ${label}`,
        );
      }

      // 4) Optional callback for parent components
      if (onSubmit) {
        await onSubmit({
          name: fullName.trim(),
          phone: normalizedPhone,
          countryCode: dialCode,
        });
      }

      // Reset form
      setFullName('');
      setPhone('');
      setLabel('Mobile');
    } catch (e) {
      console.warn('Save contact error', e);
      setError('Could not save contact.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View>
      <Text
        style={{
          color: palette.subtext,
          fontSize: 13,
          marginBottom: 16,
        }}
      >
        Add a new contact. It will be saved to your device and cached in KIS.
      </Text>

      {/* Name */}
      <View style={styles.fieldGroup}>
        <Text style={[styles.label, { color: palette.subtext }]}>
          Name
        </Text>
        <View
          style={[
            styles.inputWrapper,
            {
              backgroundColor: palette.card,
              borderColor: palette.inputBorder,
            },
          ]}
        >
          <TextInput
            value={fullName}
            onChangeText={setFullName}
            placeholder="Full name"
            placeholderTextColor={palette.subtext}
            style={[styles.input, { color: palette.text }]}
          />
        </View>
      </View>

      {/* Phone */}
      <View style={styles.fieldGroup}>
        <Text style={[styles.label, { color: palette.subtext }]}>
          Phone
        </Text>
        <View style={styles.phoneRow}>
          {/* Country / dial code picker */}
          <Pressable
            onPress={() => setCountryPickerVisible(true)}
            style={[
              styles.countryPicker,
              {
                backgroundColor: palette.card,
                borderColor: palette.inputBorder,
              },
            ]}
          >
            <Text style={{ color: palette.text, fontSize: 15 }}>
              {dialCode}
            </Text>
            <KISIcon
              name="chevron-down"
              size={14}
              color={palette.subtext}
              style={{ marginLeft: 4 }}
            />
          </Pressable>

          {/* Actual modal */}
          <CountryPicker
            visible={countryPickerVisible}
            countryCode={countryCode}
            withFilter
            withCallingCode
            withFlag
            withEmoji
            withCountryNameButton={false}
            onSelect={handleCountrySelect}
            onClose={() => setCountryPickerVisible(false)}
          />

          {/* Phone input */}
          <View
            style={[
              styles.phoneInputWrapper,
              {
                backgroundColor: palette.card,
                borderColor: palette.inputBorder,
              },
            ]}
          >
            <TextInput
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="Phone number"
              placeholderTextColor={palette.subtext}
              style={[styles.input, { color: palette.text }]}
            />
          </View>
        </View>

        {/* Label */}
        <View style={styles.labelRow}>
          <Text
            style={[styles.labelSmall, { color: palette.subtext }]}
          >
            Label
          </Text>
          <Pressable
            onPress={() => {
              setLabel((prev) => {
                if (prev === 'Mobile') return 'Work';
                if (prev === 'Work') return 'Home';
                return 'Mobile';
              });
            }}
            style={[
              styles.labelPill,
              {
                backgroundColor: palette.surface,
                borderColor: palette.inputBorder,
              },
            ]}
          >
            <Text style={{ color: palette.text, fontSize: 13 }}>
              {label}
            </Text>
            <KISIcon
              name="menu"
              size={14}
              color={palette.subtext}
              style={{ marginLeft: 4 }}
            />
          </Pressable>
        </View>
      </View>

      {error ? (
        <Text
          style={[
            styles.errorText,
            { color: palette.error ?? '#e53935' },
          ]}
        >
          {error}
        </Text>
      ) : null}

      <Pressable
        onPress={handleSave}
        disabled={!canSave}
        style={({ pressed }) => [
          styles.saveButton,
          {
            backgroundColor: canSave
              ? palette.primary
              : palette.disabled ?? palette.surface,
            opacity:
              pressed && canSave
                ? KIS_TOKENS.opacity.pressed
                : 1,
          },
        ]}
      >
        <Text
          style={[
            styles.saveButtonText,
            {
              color: canSave
                ? palette.onPrimary ?? '#fff'
                : palette.subtext,
            },
          ]}
        >
          {submitting ? 'Saving…' : 'Save'}
        </Text>
      </Pressable>
    </View>
  );
};
