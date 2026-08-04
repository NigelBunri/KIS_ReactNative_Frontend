// Jest manual mock for react-native-audio-recorder-player — its native
// module doesn't exist under Jest. Generic stand-in for the instance API
// HoldToLockComposer.tsx uses (record/play lifecycle + listeners), plus the
// AudioSet enum values that file passes to startRecorder().
class MockAudioRecorderPlayer {
  setSubscriptionDuration = jest.fn();
  startRecorder = jest.fn().mockResolvedValue('file:///mock/recording.m4a');
  stopRecorder = jest.fn().mockResolvedValue('file:///mock/recording.m4a');
  pauseRecorder = jest.fn().mockResolvedValue(undefined);
  resumeRecorder = jest.fn().mockResolvedValue(undefined);
  addRecordBackListener = jest.fn();
  removeRecordBackListener = jest.fn();
  startPlayer = jest.fn().mockResolvedValue('file:///mock/recording.m4a');
  stopPlayer = jest.fn().mockResolvedValue(undefined);
  pausePlayer = jest.fn().mockResolvedValue(undefined);
  resumePlayer = jest.fn().mockResolvedValue(undefined);
  seekToPlayer = jest.fn().mockResolvedValue(undefined);
  setVolume = jest.fn().mockResolvedValue(undefined);
  addPlayBackListener = jest.fn();
  removePlayBackListener = jest.fn();
}

module.exports = MockAudioRecorderPlayer;
module.exports.default = MockAudioRecorderPlayer;
module.exports.AVEncodingOption = { lpcm: 'lpcm', ima4: 'ima4', aac: 'aac', MAC3: 'MAC3', MAC6: 'MAC6', ulaw: 'ulaw', alaw: 'alaw', mp1: 'mp1', mp2: 'mp2', alac: 'alac', amr: 'amr', flac: 'flac', opus: 'opus' };
module.exports.AVEncoderAudioQualityIOSType = { min: 0, low: 32, medium: 64, high: 96, max: 127 };
module.exports.AVLinearPCMBitDepthKeyIOSType = { bit8: 8, bit16: 16, bit24: 24, bit32: 32 };
module.exports.OutputFormatAndroidType = { DEFAULT: 0, THREE_GPP: 1, MPEG_4: 2, AMR_NB: 3, AMR_WB: 4, AAC_ADIF: 5, AAC_ADTS: 6, OUTPUT_FORMAT_RTP_AVP: 7, MPEG_2_TS: 8, WEBM: 9 };
module.exports.AudioEncoderAndroidType = { DEFAULT: 0, AMR_NB: 1, AMR_WB: 2, AAC: 3, HE_AAC: 4, AAC_ELD: 5, VORBIS: 6 };
module.exports.AudioSourceAndroidType = { DEFAULT: 0, MIC: 1, VOICE_UPLINK: 2, VOICE_DOWNLINK: 3, VOICE_CALL: 4, CAMCORDER: 5, VOICE_RECOGNITION: 6, VOICE_COMMUNICATION: 7, REMOTE_SUBMIX: 8, UNPROCESSED: 9, RADIO_TUNER: 1998, HOTWORD: 1999 };
