Pod::Spec.new do |s|
  s.name             = 'KISVirtualBackground'
  s.version          = '1.0.0'
  s.summary          = 'Real on-device person segmentation for KIS call virtual backgrounds.'
  s.homepage         = 'https://kingdomimpactventures.org'
  s.license          = { :type => 'Proprietary' }
  s.author           = 'Kingdom Impact Social'
  s.source           = { :path => '.' }
  s.platforms        = { :ios => '15.0' }
  s.swift_version    = '5.0'

  s.source_files     = '*.{h,m,swift}'

  # VNGeneratePersonSegmentationRequest (Vision) requires iOS 15+ — this
  # app's deployment target is 15.1 already (see ios/Podfile), so no extra
  # availability shim is needed here beyond the @available guard inside
  # VirtualBackgroundProcessor.swift itself.
  s.frameworks       = 'Vision', 'CoreImage', 'CoreVideo'

  # Needs react-native-webrtc's ProcessorProvider/VideoFrameProcessorDelegate
  # headers (the native video-effect extension point this plugs into) and
  # React's bridge module macros.
  s.dependency 'react-native-webrtc'
  s.dependency 'React-Core'
end
