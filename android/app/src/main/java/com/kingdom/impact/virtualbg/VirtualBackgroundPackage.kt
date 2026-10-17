package com.kingdom.impact.virtualbg

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager
import com.oney.WebRTCModule.videoEffects.ProcessorProvider

class VirtualBackgroundPackage : ReactPackage {
    override fun createNativeModules(ctx: ReactApplicationContext): List<NativeModule> {
        // Registered here (package construction happens once, at app start,
        // well before any call screen could call _setVideoEffect) rather than
        // inside the module itself, so the processor is available even if
        // KISVirtualBackgroundModule.configure() is never called before the
        // JS side activates the effect (it reads VirtualBackgroundConfig's
        // defaults — mode 'none' — until configure() is called).
        ProcessorProvider.addProcessor(VirtualBackgroundConfig.PROCESSOR_NAME) {
            VirtualBackgroundProcessor()
        }
        return listOf(VirtualBackgroundModule(ctx))
    }

    override fun createViewManagers(ctx: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
