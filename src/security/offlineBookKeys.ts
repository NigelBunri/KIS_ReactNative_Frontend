// Secure (Keychain/Keystore-backed) storage for offline book
// decryption keys — mirrors src/security/authStorage.ts's EncryptedStorage
// pattern exactly (same library, same "never fall through to writing a
// secret in plain AsyncStorage" posture), applied to book DEKs instead
// of auth tokens. The raw base64 DEK is the one secret a client ever
// needs for offline reading; it never gets written to disk anywhere
// else (see src/storage/offlineBookStorage.ts, which only ever holds
// AES-GCM ciphertext).
import EncryptedStorage from 'react-native-encrypted-storage';

const keyFor = (bookId: string) => `kis.offline_book_dek.v1.${bookId}`;

export async function storeOfflineBookDek(bookId: string, dekBase64: string): Promise<void> {
  await EncryptedStorage.setItem(keyFor(bookId), dekBase64);
}

export async function getOfflineBookDek(bookId: string): Promise<string | null> {
  try {
    return await EncryptedStorage.getItem(keyFor(bookId));
  } catch {
    return null;
  }
}

export async function removeOfflineBookDek(bookId: string): Promise<void> {
  await EncryptedStorage.removeItem(keyFor(bookId)).catch(() => {});
}

/** Called on sign-out / account switch — a DEK issued to account A must
 * never remain usable (or even present) once a different account signs
 * in on the same device. The encrypted package files on disk are left
 * for removeAllOfflineBooks (storage cleanup) to also clear; this only
 * handles the key half, since that's the half that actually gates
 * readability. */
export async function clearAllOfflineBookKeys(bookIds: string[]): Promise<void> {
  await Promise.all(bookIds.map((id) => removeOfflineBookDek(id)));
}
