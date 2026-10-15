// src/screens/calls/components/IOSScreenSharePicker.tsx
//
// AND-098: iOS screen sharing needs ReplayKit's system broadcast picker to
// actually be shown to the user before getDisplayMedia() can ever resolve —
// see the long comment in webRTCService.ts's presentIOSScreenCapturePicker
// and callService.ts's toggleScreenShare. react-native-webrtc's trigger for
// that picker is an invisible native view (ScreenCapturePickerView) that
// must exist somewhere in the tree; this component is that mount point.
// It registers its ref into callService.ts (a plain module with no
// component tree of its own) for the whole lifetime of an active call, and
// clears the registration on unmount so a stale ref from a previous call
// screen is never dispatched into.
import React, { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { ScreenCapturePickerView } from '@/services/calls/webRTCService';
import { registerIOSScreenCapturePickerRef } from '@/services/calls/callService';

export default function IOSScreenSharePicker() {
  const ref = useRef<any>(null);

  useEffect(() => {
    if (Platform.OS !== 'ios' || !ScreenCapturePickerView) return;
    registerIOSScreenCapturePickerRef(ref);
    return () => registerIOSScreenCapturePickerRef(null);
  }, []);

  if (Platform.OS !== 'ios' || !ScreenCapturePickerView) return null;
  return <ScreenCapturePickerView ref={ref} style={{ width: 0, height: 0 }} />;
}
