#import <React/RCTBridgeModule.h>
#import "KISVirtualBackground-Swift.h"
#import <react-native-webrtc/ProcessorProvider.h>

// Companion Objective-C bridge for VirtualBackgroundModule.swift — required
// so the RN bridge can discover and invoke a Swift-defined native module
// (same pattern as the main target's TranslationModule.m / PendingCallModule.m).
@interface RCT_EXTERN_MODULE(KISVirtualBackgroundModule, NSObject)

RCT_EXTERN_METHOD(isAvailable:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(configure:(NSString *)mode
                  blurRadius:(NSNumber *)blurRadius
                  imageUri:(NSString *)imageUri
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(clear:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end

// Registers the real segmentation processor with react-native-webrtc's
// ProcessorProvider exactly once, at process load time — mirroring
// Android's VirtualBackgroundPackage, which does the equivalent
// registration at app-package-construction time. +load is an Objective-C
// runtime guarantee (called automatically when this class is loaded into
// the process, before any app code runs) that Swift classes cannot rely on
// directly, which is why this registration lives in this .m file rather
// than inside VirtualBackgroundProcessor.swift itself.
@interface KISVirtualBackgroundRegistrar : NSObject
@end

@implementation KISVirtualBackgroundRegistrar
+ (void)load {
    KISVirtualBackgroundProcessor *processor = [KISVirtualBackgroundProcessor new];
    [ProcessorProvider addProcessor:processor forName:[KISVirtualBackgroundConfig processorName]];
}
@end
