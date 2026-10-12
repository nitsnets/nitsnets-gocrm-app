import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

// Resize the generated artwork without changing its design. Use an explicit
// opaque RGB context: a three-channel AppKit bitmap can silently render black.
let source = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
    .appendingPathComponent("../../../assets/brand/gocrm-ios-liquid-glass-connected-g.png").standardizedFileURL
let side = 1024
let imageSource = CGImageSourceCreateWithURL(source as CFURL, nil)!
let artwork = CGImageSourceCreateImageAtIndex(imageSource, 0, nil)!
let context = CGContext(data: nil, width: side, height: side, bitsPerComponent: 8,
                        bytesPerRow: side * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!,
                        bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
context.interpolationQuality = .high
context.draw(artwork, in: CGRect(x: 0, y: 0, width: side, height: side))
let destination = CGImageDestinationCreateWithURL(URL(fileURLWithPath: CommandLine.arguments[1]) as CFURL,
                                                 UTType.png.identifier as CFString, 1, nil)!
CGImageDestinationAddImage(destination, context.makeImage()!, nil)
guard CGImageDestinationFinalize(destination) else { fatalError("No se pudo exportar el icono") }
