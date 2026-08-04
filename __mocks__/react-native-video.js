// Jest manual mock for react-native-video. Renders as a plain View so
// component tests can assert on props passed to it (source, paused, style,
// etc.) and manually invoke the on* callback props to simulate playback
// events (onLoad, onReadyForDisplay, onError, ...) — it never actually
// decodes/plays anything, matching how this package's own native module
// doesn't exist under Jest anyway.
const React = require('react');
const { forwardRef, useImperativeHandle } = React;

const Video = forwardRef(function MockVideo(props, ref) {
  useImperativeHandle(ref, () => ({
    seek: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
    presentFullscreenPlayer: jest.fn(),
    dismissFullscreenPlayer: jest.fn(),
    save: jest.fn(),
  }));
  const { View } = require('react-native');
  // testID lets tests find this instance; every on* prop is exposed via
  // testID-scoped props inspection (React Testing Library's getByTestId(...).props)
  // rather than simulated native events, since there's no real player to
  // drive them from.
  return React.createElement(View, { testID: props.testID ?? 'mock-video', ...props });
});

module.exports = Video;
module.exports.default = Video;
module.exports.VideoDecoderProperties = {
  getWidevineLevel: jest.fn().mockResolvedValue(0),
  isHEVCSupported: jest.fn().mockResolvedValue(true),
  isCodecSupported: jest.fn().mockResolvedValue('supported'),
};
module.exports.SelectedVideoTrackType = { AUTO: 'auto', DISABLED: 'disabled', RESOLUTION: 'resolution', INDEX: 'index' };
module.exports.SelectedTrackType = { SYSTEM: 'system', DISABLED: 'disabled', TITLE: 'title', LANGUAGE: 'language', INDEX: 'index' };
module.exports.ViewType = { TEXTURE: 2, SURFACE: 3, SURFACE_SECURE: 4 };
module.exports.FilterType = {};
module.exports.TextTrackType = {};
