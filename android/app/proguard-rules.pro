# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# ── React Native core ────────────────────────────────────────────────────
# The React Native gradle plugin's react-android AAR already ships its own
# consumer ProGuard rules (keeping @ReactModule/@DoNotStrip-annotated
# members, the bridge, JSI/Fabric glue, etc.), automatically merged by AGP —
# nothing below duplicates those. These rules cover this app's own native
# modules plus third-party libraries whose native side is reached only via
# reflection/JNI, which R8 can't see through on its own and would otherwise
# strip or rename, breaking them silently at runtime instead of at build time.

# This app's own native modules (device id, SIM info, home-screen shortcuts) —
# registered by class reference from MainApplication.kt's package list, so
# R8 already keeps the classes themselves via reachability; this only
# protects the native-module method names the JS side calls by string.
-keepclassmembers class com.kingdom.impact.** {
    @com.facebook.react.bridge.ReactMethod <methods>;
}
-keep class com.kingdom.impact.DeviceIdModule { *; }
-keep class com.kingdom.impact.SimInfoModule { *; }
-keep class com.kingdom.impact.ShortcutModule { *; }
-keep class com.kingdom.impact.RestoreCredentialModule { *; }

# ── androidx.credentials (Restore Credentials / Zero-Tap Sign-In) ───────
# The Credential Manager Play Services backend is resolved by class name at
# runtime, the same reflection pattern WebRTC/Firebase above need protecting
# from.
-keep class androidx.credentials.** { *; }
-keep class androidx.credentials.playservices.** { *; }
-dontwarn androidx.credentials.**

# ── react-native-webrtc ──────────────────────────────────────────────────
# The native WebRTC library resolves classes via JNI using their exact
# fully-qualified names; renaming or stripping any of them breaks calls
# (video/voice calls) with no compile-time warning.
-keep class org.webrtc.** { *; }
-dontwarn org.webrtc.**

# ── Firebase (push notifications via @react-native-firebase) ────────────
# Firebase's own AARs generally ship consumer rules, but FCM's background
# message handling crosses a JNI/reflection boundary the same way WebRTC
# does, so it's kept explicitly rather than trusted to reachability alone.
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# ── react-native-callkeep (native ConnectionService/Telecom integration) ─
-keep class io.wazo.callkeep.** { *; }
-dontwarn io.wazo.callkeep.**

# ── Socket.IO / OkHttp (transport used by socket.io-client's native side) ─
-keep class io.socket.** { *; }
-keep class okhttp3.** { *; }
-keep class okio.** { *; }
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn io.socket.**

# ── Encrypted storage (Android Keystore-backed session/token storage) ───
# Session tokens live here (see src/security/authStorage.ts) — a stripped
# method name here fails silently as "can't read token", not a crash, so
# it's worth being explicit rather than trusting reachability.
-keep class com.emeraldsanto.encryptedstorage.** { *; }
-dontwarn com.emeraldsanto.encryptedstorage.**

# ── Kotlin metadata (reflection-based libraries occasionally read this) ──
-keepattributes *Annotation*, Signature, InnerClasses, EnclosingMethod
-keep class kotlin.Metadata { *; }
-dontwarn kotlin.**

# Add any project specific keep options here:
