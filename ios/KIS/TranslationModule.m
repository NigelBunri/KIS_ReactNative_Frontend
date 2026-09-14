#import <React/RCTBridgeModule.h>

// Companion Objective-C bridge for TranslationModule.swift — required so the
// RN bridge can discover and invoke a Swift-defined native module.
@interface RCT_EXTERN_MODULE(TranslationModule, NSObject)

RCT_EXTERN_METHOD(identifyLanguage:(NSString *)text
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(isAvailable:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getModelStatus:(NSString *)sourceLanguageCode
                  targetLanguageCode:(NSString *)targetLanguageCode
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(downloadModel:(NSString *)sourceLanguageCode
                  targetLanguageCode:(NSString *)targetLanguageCode
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(deleteModel:(NSString *)sourceLanguageCode
                  targetLanguageCode:(NSString *)targetLanguageCode
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getDownloadedModels:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(translate:(NSString *)text
                  sourceLanguageCode:(NSString *)sourceLanguageCode
                  targetLanguageCode:(NSString *)targetLanguageCode
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
