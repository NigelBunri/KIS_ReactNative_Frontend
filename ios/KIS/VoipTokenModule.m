#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

// Companion Objective-C bridge for VoipTokenModule.swift — required so the
// RN bridge can discover and invoke a Swift-defined native module.
@interface RCT_EXTERN_MODULE(VoipTokenModule, RCTEventEmitter)

RCT_EXTERN_METHOD(getVoipToken:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
