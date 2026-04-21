/**
 * @format
 */
// index.js
import 'react-native-get-random-values';
import { Buffer } from 'buffer';
import QuickCrypto from 'react-native-quick-crypto';
import { AppRegistry, View } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { installLocalizationRuntime } from './src/languages/runtimePatch';

installLocalizationRuntime();

if (!global.Buffer) {
  global.Buffer = Buffer;
}
if (!global.window) {
  global.window = global;
}
if (!global.crypto || !global.crypto.subtle) {
  global.crypto = QuickCrypto;
}

function Root() {
  return (
    <View style={{ marginTop: 40, flex: 1 }}>
      <App />
    </View>
  );
}

AppRegistry.registerComponent(appName, () => Root);
