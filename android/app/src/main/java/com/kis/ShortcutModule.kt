package com.kis

import android.content.Intent
import android.content.pm.ShortcutInfo
import android.content.pm.ShortcutManager
import android.graphics.BitmapFactory
import android.graphics.drawable.Icon
import android.net.Uri
import android.os.Build
import androidx.annotation.RequiresApi
import com.facebook.react.bridge.*
import java.net.URL

class ShortcutModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "KISShortcutModule"

    @ReactMethod
    fun canPinShortcuts(promise: Promise) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            promise.resolve(false)
            return
        }
        val manager = reactContext.getSystemService(ShortcutManager::class.java)
        promise.resolve(manager?.isRequestPinShortcutSupported == true)
    }

    @ReactMethod
    fun pinShortcut(options: ReadableMap, promise: Promise) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            promise.reject("UNSUPPORTED", "Pinned shortcuts require Android 8+")
            return
        }
        val manager = reactContext.getSystemService(ShortcutManager::class.java)
        if (manager?.isRequestPinShortcutSupported != true) {
            promise.reject("UNSUPPORTED", "Launcher does not support pinned shortcuts")
            return
        }

        val id = options.getString("id") ?: "kis_shortcut"
        val label = options.getString("label") ?: "KIS App"
        val deepLink = options.getString("deepLink") ?: "kis://home"
        val iconUrl = options.getString("iconUrl")

        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(deepLink)).apply {
            setClassName(reactContext, "com.kis.MainActivity")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }

        val builder = ShortcutInfo.Builder(reactContext, id)
            .setShortLabel(label.take(10))
            .setLongLabel(label)
            .setIntent(intent)

        if (iconUrl != null) {
            try {
                val bitmap = URL(iconUrl).openStream().use { BitmapFactory.decodeStream(it) }
                if (bitmap != null) {
                    builder.setIcon(Icon.createWithBitmap(bitmap))
                } else {
                    builder.setIcon(Icon.createWithResource(reactContext, R.mipmap.ic_launcher))
                }
            } catch (e: Exception) {
                builder.setIcon(Icon.createWithResource(reactContext, R.mipmap.ic_launcher))
            }
        } else {
            builder.setIcon(Icon.createWithResource(reactContext, R.mipmap.ic_launcher))
        }

        val shortcutInfo = builder.build()
        manager.requestPinShortcut(shortcutInfo, null)
        promise.resolve(true)
    }

    @ReactMethod
    fun addDynamicShortcut(options: ReadableMap, promise: Promise) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N_MR1) {
            promise.reject("UNSUPPORTED", "Dynamic shortcuts require Android 7.1+")
            return
        }
        val manager = reactContext.getSystemService(ShortcutManager::class.java)
            ?: run { promise.reject("ERROR", "ShortcutManager unavailable"); return }

        val id = options.getString("id") ?: "kis_dynamic"
        val label = options.getString("label") ?: "KIS App"
        val deepLink = options.getString("deepLink") ?: "kis://home"

        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(deepLink)).apply {
            setClassName(reactContext, "com.kis.MainActivity")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }

        val shortcut = ShortcutInfo.Builder(reactContext, id)
            .setShortLabel(label.take(10))
            .setLongLabel(label)
            .setIntent(intent)
            .setIcon(Icon.createWithResource(reactContext, R.mipmap.ic_launcher))
            .build()

        val existing = manager.dynamicShortcuts.map { it.id }
        if (id in existing) {
            manager.updateShortcuts(listOf(shortcut))
        } else {
            val all = manager.dynamicShortcuts.toMutableList()
            all.add(shortcut)
            // Android caps dynamic shortcuts at 4–5; trim oldest if needed
            if (all.size > 4) manager.removeDynamicShortcuts(listOf(all.first().id))
            manager.addDynamicShortcuts(listOf(shortcut))
        }
        promise.resolve(true)
    }

    @ReactMethod
    fun removeDynamicShortcut(id: String, promise: Promise) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N_MR1) {
            promise.resolve(false)
            return
        }
        val manager = reactContext.getSystemService(ShortcutManager::class.java)
        manager?.removeDynamicShortcuts(listOf(id))
        promise.resolve(true)
    }
}
