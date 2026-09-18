#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

// Companion Objective-C bridge for PendingCallModule.swift — required so the
// RN bridge can discover and invoke a Swift-defined native module.
@interface RCT_EXTERN_MODULE(PendingCallModule, RCTEventEmitter)

RCT_EXTERN_METHOD(getPendingCall:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(clearPendingCall:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
