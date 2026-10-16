// src/screens/calls/hooks/useIOSCallPiP.ts
//
// Shared iOS Picture-in-Picture lifecycle wiring, extracted from
// ActiveCallScreen's VideoOneOnOneLayout so group video calls (VideoGrid)
// and broadcasts (BroadcastLayout) get the same background/foreground PiP
// behavior - previously only a 1:1 video call ever triggered PiP on iOS,
// since react-native-webrtc's RTCPIPView/startIOSPIP/stopIOSPIP were only
// ever wired into that one layout.
//
// Callers render RTCPIPView (not plain RTCView) with `ref={pipRef}` on
// whichever single video tile should appear in the floating PiP window
// when the app backgrounds (there can only be one - iOS PiP shows exactly
// one video source at a time).
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { RTCPIPView, startIOSPIP, stopIOSPIP } from '@/services/calls/webRTCService';

export function useIOSCallPiP(active: boolean) {
  const pipRef = useRef<any>(null);

  useEffect(() => {
    const start = startIOSPIP;
    const stop = stopIOSPIP;
    if (Platform.OS !== 'ios' || !RTCPIPView || !start || !stop) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (!active) return;
      if (state === 'background') start(pipRef);
      else if (state === 'active') stop(pipRef);
    });
    return () => sub.remove();
  }, [active]);

  return pipRef;
}
