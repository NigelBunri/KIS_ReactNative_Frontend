import Foundation
import Vision
import CoreImage
import CoreVideo
import WebRTC
import react_native_webrtc

/// Real on-device person segmentation for virtual backgrounds — feature F.
///
/// Plugs into react-native-webrtc's VideoFrameProcessorDelegate extension
/// point (node_modules/react-native-webrtc/ios/RCTWebRTC/videoEffects),
/// which sits between the camera capturer and the RTCVideoSource — meaning
/// this runs on the OUTGOING track itself. Every remote participant (P2P
/// or via the SFU, both consume the same underlying MediaStreamTrack) sees
/// the processed frame, not just this device's own local preview.
///
/// Uses Apple's Vision framework (`VNGeneratePersonSegmentationRequest`,
/// iOS 15+) for the real segmentation mask and Core Image (GPU-accelerated
/// via Metal) for compositing — unlike the Android implementation, there is
/// no manual per-pixel downscale tradeoff here: Vision + Core Image are
/// specifically designed by Apple for real-time video use at native
/// capture resolution.
@objc(KISVirtualBackgroundProcessor)
public class VirtualBackgroundProcessor: NSObject, VideoFrameProcessorDelegate {

    private let ciContext = CIContext(options: [.useSoftwareRenderer: false])
    private let requestHandler = VNSequenceRequestHandler()
    private var pixelBufferPool: CVPixelBufferPool?
    private var pixelBufferPoolSize: CGSize = .zero

    public func capturer(_ capturer: RTCVideoCapturer, didCapture frame: RTCVideoFrame) -> RTCVideoFrame {
        guard VirtualBackgroundConfig.mode != "none" else { return frame }
        guard #available(iOS 15.0, *) else { return frame }
        guard let cvBuffer = frame.buffer as? RTCCVPixelBuffer else {
            // Non-CVPixelBuffer-backed frames (e.g. a raw I420Buffer on some
            // code paths) aren't handled by this pipeline — pass through
            // unprocessed rather than risk a crash on an unexpected type.
            return frame
        }

        let pixelBuffer = cvBuffer.pixelBuffer
        let originalImage = CIImage(cvPixelBuffer: pixelBuffer)
        let extent = originalImage.extent

        let request = VNGeneratePersonSegmentationRequest()
        request.qualityLevel = .balanced
        request.outputPixelFormat = kCVPixelFormatType_OneComponent8

        do {
            try requestHandler.perform([request], on: pixelBuffer)
        } catch {
            return frame
        }

        guard let maskBuffer = request.results?.first?.pixelBuffer else { return frame }

        var maskImage = CIImage(cvPixelBuffer: maskBuffer)
        // Vision's mask resolution does not necessarily match the input
        // frame's resolution — scale it to the real frame's extent so
        // CIBlendWithMask composites pixel-for-pixel against the original.
        let scaleX = extent.width / maskImage.extent.width
        let scaleY = extent.height / maskImage.extent.height
        maskImage = maskImage.transformed(by: CGAffineTransform(scaleX: scaleX, y: scaleY))

        let background = buildBackground(from: originalImage, extent: extent)

        guard let blendFilter = CIFilter(name: "CIBlendWithMask") else { return frame }
        blendFilter.setValue(originalImage, forKey: kCIInputImageKey)
        blendFilter.setValue(background, forKey: kCIInputBackgroundImageKey)
        blendFilter.setValue(maskImage, forKey: kCIInputMaskImageKey)
        guard let composited = blendFilter.outputImage else { return frame }

        guard let outputPixelBuffer = renderToPixelBuffer(composited, size: CGSize(width: extent.width, height: extent.height), matching: pixelBuffer) else {
            return frame
        }

        let outputRtcBuffer = RTCCVPixelBuffer(pixelBuffer: outputPixelBuffer)
        return RTCVideoFrame(buffer: outputRtcBuffer, rotation: frame.rotation, timeStampNs: frame.timeStampNs)
    }

    private func buildBackground(from original: CIImage, extent: CGRect) -> CIImage {
        switch VirtualBackgroundConfig.mode {
        case "image":
            if let bgImage = VirtualBackgroundConfig.backgroundImage, let ciBg = CIImage(image: bgImage) {
                return aspectFill(ciBg, into: extent)
            }
            return blurredBackground(original, extent: extent)
        default:
            return blurredBackground(original, extent: extent)
        }
    }

    private func blurredBackground(_ original: CIImage, extent: CGRect) -> CIImage {
        guard let blurFilter = CIFilter(name: "CIGaussianBlur") else { return original }
        blurFilter.setValue(original, forKey: kCIInputImageKey)
        blurFilter.setValue(VirtualBackgroundConfig.blurRadius, forKey: kCIInputRadiusKey)
        // Gaussian blur samples beyond the image's own extent (producing a
        // transparent/undefined edge fringe) unless clamped first.
        guard let clamped = blurFilter.outputImage?.clampedToExtent().cropped(to: extent) else {
            return original
        }
        return clamped
    }

    private func aspectFill(_ image: CIImage, into extent: CGRect) -> CIImage {
        let scale = max(extent.width / image.extent.width, extent.height / image.extent.height)
        let scaled = image.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
        let dx = (extent.width - scaled.extent.width) / 2
        let dy = (extent.height - scaled.extent.height) / 2
        return scaled.transformed(by: CGAffineTransform(translationX: dx, y: dy)).cropped(to: extent)
    }

    private func renderToPixelBuffer(_ image: CIImage, size: CGSize, matching source: CVPixelBuffer) -> CVPixelBuffer? {
        if pixelBufferPool == nil || pixelBufferPoolSize != size {
            var pool: CVPixelBufferPool?
            let attrs: [CFString: Any] = [
                kCVPixelBufferPixelFormatTypeKey: CVPixelBufferGetPixelFormatType(source),
                kCVPixelBufferWidthKey: Int(size.width),
                kCVPixelBufferHeightKey: Int(size.height),
                kCVPixelBufferIOSurfacePropertiesKey: [:],
            ]
            CVPixelBufferPoolCreate(kCFAllocatorDefault, nil, attrs as CFDictionary, &pool)
            pixelBufferPool = pool
            pixelBufferPoolSize = size
        }
        guard let pool = pixelBufferPool else { return nil }
        var outBuffer: CVPixelBuffer?
        CVPixelBufferPoolCreatePixelBuffer(kCFAllocatorDefault, pool, &outBuffer)
        guard let buffer = outBuffer else { return nil }
        ciContext.render(image, to: buffer)
        return buffer
    }
}
