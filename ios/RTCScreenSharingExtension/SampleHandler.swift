// SampleHandler.swift
//
// Part of the RTCScreenSharingExtension Broadcast Upload Extension target.
//
// Wire protocol notes (reverse-engineered from the react-native-webrtc pod
// actually vendored in this repo — node_modules/react-native-webrtc/ios/
// RCTWebRTC/{ScreenCapturer,ScreenCaptureController,SocketConnection}.m —
// so this matches the exact receiver this app already ships, not a generic
// ReplayKit example found online):
//
//   * The HOST APP listens on a Unix domain socket at
//     "<AppGroupContainer>/rtc_SSFD" (ScreenCaptureController.m,
//     kRTCScreensharingSocketFD) and only starts listening once
//     getDisplayMedia() is called — so this extension's connect attempt
//     should tolerate "no listener yet" and retry briefly.
//   * Each frame is sent as an HTTP-style framed message parsed by
//     CFHTTPMessage on the host side (ScreenCapturer.m Message class):
//       headers: "Buffer-Width", "Buffer-Height", "Buffer-Orientation",
//                "Content-Length"
//       body:    an image the host decodes via `CIImage(data:)` — i.e. a
//                compressed image format (JPEG here), NOT raw pixel bytes.
//   * "Buffer-Orientation" uses CGImagePropertyOrientation raw values; the
//     host only special-cases Left(8)=90°, Down(3)=180°, Right(6)=270°,
//     defaulting to 0° otherwise. Screen-capture buffers are already
//     upright in their own coordinate space, so this always sends Up (1).
//
// ⚠️ Needs on-device verification (Broadcast Extensions run under a strict
// ~50MB memory ceiling — the JPEG compression quality/frame rate below may
// need tuning on a real device before this is production-ready).

import ReplayKit

class SampleHandler: RPBroadcastSampleHandler {
    // Must match the App Group configured on BOTH this extension target and
    // the main app target's entitlements/Info.plist (RTCAppGroupIdentifier).
    private let appGroupIdentifier = "group.com.kis.broadcast"

    private var outputStream: OutputStream?
    private let ciContext = CIContext()

    override func broadcastStarted(withSetupInfo setupInfo: [String: NSObject]?) {
        connectSocket()
    }

    override func broadcastFinished() {
        outputStream?.close()
        outputStream = nil
    }

    override func processSampleBuffer(_ sampleBuffer: CMSampleBuffer, with sampleBufferType: RPSampleBufferType) {
        guard sampleBufferType == .video, let stream = outputStream, stream.hasSpaceAvailable else { return }
        guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }

        let width = CVPixelBufferGetWidth(pixelBuffer)
        let height = CVPixelBufferGetHeight(pixelBuffer)
        let ciImage = CIImage(cvPixelBuffer: pixelBuffer)

        // JPEG keeps each frame small enough for the socket + the
        // extension's tight memory ceiling; quality/format can be tuned
        // once verified on-device.
        guard let colorSpace = CGColorSpace(name: CGColorSpace.sRGB),
              let jpegData = ciContext.jpegRepresentation(
                of: ciImage,
                colorSpace: colorSpace,
                options: [kCGImageDestinationLossyCompressionQuality as CIImageRepresentationOption: 0.5]
              ) else { return }

        let orientation = 1 // kCGImagePropertyOrientationUp — see header note above
        let head = "Buffer-Width: \(width)\r\n"
            + "Buffer-Height: \(height)\r\n"
            + "Buffer-Orientation: \(orientation)\r\n"
            + "Content-Length: \(jpegData.count)\r\n"
            + "\r\n"

        guard let headData = head.data(using: .utf8) else { return }
        var payload = headData
        payload.append(jpegData)

        payload.withUnsafeBytes { (rawBuffer: UnsafeRawBufferPointer) in
            guard let base = rawBuffer.bindMemory(to: UInt8.self).baseAddress else { return }
            _ = stream.write(base, maxLength: payload.count)
        }
    }

    // MARK: - Socket connection (client side — the host app is the server)

    private func connectSocket() {
        guard let containerURL = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: appGroupIdentifier
        ) else {
            finishBroadcastWithError(
                NSError(domain: "SampleHandler", code: 1, userInfo: [
                    NSLocalizedDescriptionKey: "App Group container not found — check appGroupIdentifier matches the main app's RTCAppGroupIdentifier.",
                ])
            )
            return
        }
        let socketPath = containerURL.appendingPathComponent("rtc_SSFD").path

        var readStream: Unmanaged<CFReadStream>?
        var writeStream: Unmanaged<CFWriteStream>?
        let socketFD = socket(AF_UNIX, SOCK_STREAM, 0)
        guard socketFD >= 0 else { return }

        var addr = sockaddr_un()
        addr.sun_family = sa_family_t(AF_UNIX)
        socketPath.withCString { ptr in
            withUnsafeMutablePointer(to: &addr.sun_path.0) { dest in
                _ = strcpy(dest, ptr)
            }
        }

        let connectResult = withUnsafePointer(to: &addr) { rawPtr -> Int32 in
            rawPtr.withMemoryRebound(to: sockaddr.self, capacity: 1) { sockaddrPtr in
                connect(socketFD, sockaddrPtr, socklen_t(MemoryLayout<sockaddr_un>.size))
            }
        }
        guard connectResult == 0 else {
            close(socketFD)
            return
        }

        CFStreamCreatePairWithSocket(kCFAllocatorDefault, socketFD, &readStream, &writeStream)
        guard let cfWriteStream = writeStream?.takeRetainedValue() else {
            close(socketFD)
            return
        }
        _ = readStream?.takeRetainedValue() // discard — extension only writes

        let out = cfWriteStream as OutputStream
        out.setProperty(kCFBooleanTrue, forKey: Stream.PropertyKey(kCFStreamPropertyShouldCloseNativeSocket as String))
        out.schedule(in: .current, forMode: .default)
        out.open()
        self.outputStream = out
    }
}
