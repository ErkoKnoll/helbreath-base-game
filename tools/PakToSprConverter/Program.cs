using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;

namespace PakToSprConverter
{
    enum ConversionMode
    {
        BinaryTransparency,
        BlendedTransparency,
        NearTransparency
    }

    class Program
    {
        static int Main(string[] args)
        {
            if (args.Length == 0)
            {
                Console.WriteLine("Usage: PakToSprConverter <file-or-folder-path> [mode] [divergence]");
                Console.WriteLine("  If path is a .pak file: converts that file");
                Console.WriteLine("  If path is a folder: converts all .pak files in that folder");
                Console.WriteLine("  Mode options:");
                Console.WriteLine("    BinaryTransparency (default) - Simple color key transparency");
                Console.WriteLine("    BlendedTransparency - Distance-based alpha blending for soft edges");
                Console.WriteLine("    NearTransparency - Percentage-based transparency with configurable divergence");
                Console.WriteLine("  Divergence (for NearTransparency mode only):");
                Console.WriteLine("    Percentage value from 0-50 (default: 5)");
                Console.WriteLine("    Pixels within this percentage of color key will be made transparent");
                return 1;
            }

            string path = args[0];
            ConversionMode mode = ConversionMode.BinaryTransparency;
            int divergencePercent = 5; // Default divergence for NearTransparency

            // Parse optional mode parameter
            if (args.Length > 1)
            {
                if (Enum.TryParse<ConversionMode>(args[1], true, out ConversionMode parsedMode))
                {
                    mode = parsedMode;
                }
                else
                {
                    Console.WriteLine($"Warning: Invalid mode '{args[1]}'. Using default: BinaryTransparency");
                }
            }

            // Parse optional divergence parameter (for NearTransparency mode)
            if (args.Length > 2 && mode == ConversionMode.NearTransparency)
            {
                if (int.TryParse(args[2], out int parsedDivergence))
                {
                    if (parsedDivergence < 0 || parsedDivergence > 50)
                    {
                        Console.WriteLine($"Warning: Divergence must be between 0-50. Using default: 5");
                    }
                    else
                    {
                        divergencePercent = parsedDivergence;
                    }
                }
                else
                {
                    Console.WriteLine($"Warning: Invalid divergence value '{args[2]}'. Using default: 5");
                }
            }

            Console.WriteLine($"Conversion mode enabled: {mode}");
            if (mode == ConversionMode.NearTransparency)
            {
                Console.WriteLine($"Divergence threshold: {divergencePercent}%");
            }

            if (!Path.Exists(path))
            {
                Console.WriteLine($"Error: Path does not exist: {path}");
                return 1;
            }

            FileAttributes attr = File.GetAttributes(path);
            bool isDirectory = (attr & FileAttributes.Directory) == FileAttributes.Directory;

            if (isDirectory)
            {
                return ConvertDirectory(path, mode, divergencePercent);
            }
            else
            {
                if (!path.EndsWith(".pak", StringComparison.OrdinalIgnoreCase))
                {
                    Console.WriteLine($"Error: File must have .pak extension: {path}");
                    return 1;
                }
                return ConvertFile(path, mode, divergencePercent) ? 0 : 1;
            }
        }

        static int ConvertDirectory(string directoryPath, ConversionMode mode, int divergencePercent)
        {
            string[] pakFiles = Directory.GetFiles(directoryPath, "*.pak", SearchOption.TopDirectoryOnly);
            
            if (pakFiles.Length == 0)
            {
                Console.WriteLine($"No .pak files found in directory: {directoryPath}");
                return 1;
            }

            Console.WriteLine($"Found {pakFiles.Length} .pak file(s) to convert...");
            Console.WriteLine($"Using conversion mode: {mode}");
            if (mode == ConversionMode.NearTransparency)
            {
                Console.WriteLine($"Divergence threshold: {divergencePercent}%");
            }
            int successCount = 0;
            int failCount = 0;

            foreach (string pakFile in pakFiles)
            {
                Console.WriteLine($"Converting: {Path.GetFileName(pakFile)}");
                if (ConvertFile(pakFile, mode, divergencePercent))
                {
                    successCount++;
                }
                else
                {
                    failCount++;
                }
            }

            Console.WriteLine($"\nConversion complete: {successCount} succeeded, {failCount} failed");
            return failCount > 0 ? 1 : 0;
        }

        static bool ConvertFile(string pakFilePath, ConversionMode mode, int divergencePercent)
        {
            try
            {
                string sprFilePath = Path.ChangeExtension(pakFilePath, ".spr").ToLowerInvariant();
                
                byte[] pakData = File.ReadAllBytes(pakFilePath);
                PakFile pakFile = new PakFile(pakData);
                SprFile sprFile = SprFile.ConvertFromPak(pakFile, mode, divergencePercent);
                sprFile.Save(sprFilePath);
                
                Console.WriteLine($"  ✓ Created: {Path.GetFileName(sprFilePath)}");
                return true;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"  ✗ Error: {ex.Message}");
                return false;
            }
        }
    }

    // Represents a .pak file structure
    class PakFile
    {
        private readonly byte[] fileData;
        private readonly int spriteCount;

        public PakFile(byte[] fileData)
        {
            this.fileData = fileData;
            this.spriteCount = BitConverter.ToInt32(fileData, 20);
        }

        public int SpriteCount => spriteCount;

        public PakSprite GetSprite(int index)
        {
            if (index < 0 || index >= spriteCount)
                throw new ArgumentOutOfRangeException(nameof(index));

            int spriteStart = BitConverter.ToInt32(fileData, 24 + (index * 8));
            return new PakSprite(fileData, spriteStart, index);
        }

        public IEnumerable<PakSprite> GetAllSprites()
        {
            for (int i = 0; i < spriteCount; i++)
            {
                yield return GetSprite(i);
            }
        }
    }

    // Represents a single sprite from a .pak file
    class PakSprite
    {
        private readonly byte[] fileData;
        private readonly int spriteStart;
        private readonly int index;
        private readonly int frameCount;
        private readonly int bitmapStart;
        private readonly List<PakFrame> frames;
        private readonly int imageWidth;
        private readonly int imageHeight;
        private readonly byte[] bitmapData;
        private Image? cachedImage;

        public PakSprite(byte[] fileData, int spriteStart, int index)
        {
            this.fileData = fileData;
            this.spriteStart = spriteStart;
            this.index = index;
            this.frameCount = BitConverter.ToInt32(fileData, spriteStart + 100);
            this.bitmapStart = spriteStart + (108 + (12 * frameCount));

            // Read frame data
            frames = new List<PakFrame>(frameCount);
            for (int i = 0; i < frameCount; i++)
            {
                byte[] frameInfo = new byte[12];
                Buffer.BlockCopy(fileData, spriteStart + 104 + (i * 12), frameInfo, 0, 12);
                frames.Add(new PakFrame(frameInfo));
            }

            // Read bitmap file header to get size
            byte[] bitmapFileHeader = new byte[14];
            Buffer.BlockCopy(fileData, bitmapStart, bitmapFileHeader, 0, 14);
            int imageSize = BitConverter.ToInt32(bitmapFileHeader, 2);

            // Read full bitmap data
            bitmapData = new byte[imageSize];
            Buffer.BlockCopy(fileData, bitmapStart, bitmapData, 0, imageSize);

            // Read bitmap info header for dimensions
            imageWidth = BitConverter.ToInt32(bitmapData, 14 + 4);
            imageHeight = BitConverter.ToInt32(bitmapData, 14 + 8);
        }

        public int FrameCount => frameCount;
        public int Width => imageWidth;
        public int Height => imageHeight;
        public List<PakFrame> Frames => frames;

        public Image GetImage()
        {
            if (cachedImage == null)
            {
                using (MemoryStream stream = new MemoryStream(bitmapData))
                {
                    Bitmap temp = new Bitmap(stream);
                    cachedImage = new Bitmap(temp);
                }
            }
            return cachedImage;
        }
    }

    // Represents a frame from a .pak sprite
    struct PakFrame
    {
        public short Left;
        public short Top;
        public short Width;
        public short Height;
        public short PivotX;
        public short PivotY;

        public PakFrame(byte[] frameInfo)
        {
            Left = BitConverter.ToInt16(frameInfo, 0);
            Top = BitConverter.ToInt16(frameInfo, 2);
            Width = BitConverter.ToInt16(frameInfo, 4);
            Height = BitConverter.ToInt16(frameInfo, 6);
            PivotX = BitConverter.ToInt16(frameInfo, 8);
            PivotY = BitConverter.ToInt16(frameInfo, 10);
        }
    }

    // Represents a .spr file structure
    class SprFile
    {
        private readonly List<SprSprite> sprites;

        public SprFile()
        {
            sprites = new List<SprSprite>();
        }

        public void AddSprite(SprSprite sprite)
        {
            sprites.Add(sprite);
        }

        public static SprFile ConvertFromPak(PakFile pakFile, ConversionMode mode, int divergencePercent)
        {
            SprFile sprFile = new SprFile();
            int spriteIndex = 0;

            foreach (PakSprite pakSprite in pakFile.GetAllSprites())
            {
                SprSprite sprSprite = new SprSprite();
                
                // Copy frame data
                foreach (PakFrame pakFrame in pakSprite.Frames)
                {
                    SprFrame sprFrame = new SprFrame
                    {
                        Left = pakFrame.Left,
                        Top = pakFrame.Top,
                        Width = pakFrame.Width,
                        Height = pakFrame.Height,
                        PivotX = pakFrame.PivotX,
                        PivotY = pakFrame.PivotY
                    };
                    sprSprite.AddFrame(sprFrame);
                }

                // Set dimensions
                sprSprite.Width = pakSprite.Width;
                sprSprite.Height = pakSprite.Height;

                // Convert bitmap to PNG using selected mode
                using (Bitmap img = (Bitmap)pakSprite.GetImage())
                {
                    byte[] pngData;
                    if (mode == ConversionMode.BinaryTransparency)
                    {
                        pngData = ConvertWithBinaryTransparency(img);
                    }
                    else if (mode == ConversionMode.BlendedTransparency)
                    {
                        BlendingStats stats;
                        pngData = ConvertWithBlendedTransparency(img, out stats);
                        Console.WriteLine($"  Sprite sheet {spriteIndex}: {stats.BlendedPixels} blended pixels ({stats.BlendedPercentage:F2}%), " +
                                        $"{stats.TransparentPixels} transparent ({stats.TransparentPercentage:F2}%), " +
                                        $"{stats.OpaquePixels} opaque ({stats.OpaquePercentage:F2}%) out of {stats.TotalPixels} total pixels");
                    }
                    else // NearTransparency
                    {
                        NearTransparencyStats stats;
                        pngData = ConvertWithNearTransparency(img, divergencePercent, out stats);
                        Console.WriteLine($"  Sprite sheet {spriteIndex}: {stats.NearMatchPixels} pixels converted above 0% divergence ({stats.NearMatchPercentage:F2}%) " +
                                        $"out of {stats.TotalPixels} total pixels (divergence threshold: {divergencePercent}%)");
                    }
                    sprSprite.ImageData = pngData;
                }

                sprFile.AddSprite(sprSprite);
                spriteIndex++;
            }

            return sprFile;
        }

        private static byte[] ConvertWithBinaryTransparency(Bitmap img)
        {
            // Original method: simple color key transparency
            img.MakeTransparent(img.GetPixel(0, 0));
            using (MemoryStream stream = new MemoryStream())
            {
                img.Save(stream, ImageFormat.Png);
                return stream.ToArray();
            }
        }

        private struct BlendingStats
        {
            public int TotalPixels;
            public int TransparentPixels;
            public int OpaquePixels;
            public int BlendedPixels;
            public double TransparentPercentage => TotalPixels > 0 ? (TransparentPixels * 100.0 / TotalPixels) : 0;
            public double OpaquePercentage => TotalPixels > 0 ? (OpaquePixels * 100.0 / TotalPixels) : 0;
            public double BlendedPercentage => TotalPixels > 0 ? (BlendedPixels * 100.0 / TotalPixels) : 0;
        }

        private struct NearTransparencyStats
        {
            public int TotalPixels;
            public int NearMatchPixels; // Pixels converted above 0% divergence (not exact match)
            public double NearMatchPercentage => TotalPixels > 0 ? (NearMatchPixels * 100.0 / TotalPixels) : 0;
        }

        private static byte[] ConvertWithBlendedTransparency(Bitmap img, out BlendingStats stats)
        {
            // Get color key from top-left pixel
            Color colorKey = img.GetPixel(0, 0);
            
            // Initialize stats
            stats = new BlendingStats
            {
                TotalPixels = img.Width * img.Height
            };
            
            // Create a new bitmap with alpha channel support
            using (Bitmap result = new Bitmap(img.Width, img.Height, PixelFormat.Format32bppArgb))
            {
                // Process each pixel
                for (int y = 0; y < img.Height; y++)
                {
                    for (int x = 0; x < img.Width; x++)
                    {
                        Color pixel = img.GetPixel(x, y);
                        
                        // Calculate color distance (Euclidean distance in RGB space)
                        int rDiff = pixel.R - colorKey.R;
                        int gDiff = pixel.G - colorKey.G;
                        int bDiff = pixel.B - colorKey.B;
                        double distance = Math.Sqrt(rDiff * rDiff + gDiff * gDiff + bDiff * bDiff);
                        
                        // Maximum distance for full transparency (adjustable threshold)
                        // Using a threshold of ~30-40 pixels distance works well for soft edges
                        const double maxDistance = 35.0;
                        
                        byte alpha;
                        if (distance < 1.0)
                        {
                            // Exact match or very close - fully transparent
                            alpha = 0;
                            stats.TransparentPixels++;
                        }
                        else if (distance >= maxDistance)
                        {
                            // Far from color key - fully opaque
                            alpha = 255;
                            stats.OpaquePixels++;
                        }
                        else
                        {
                            // In between - calculate alpha based on distance
                            // Linear interpolation: closer to color key = more transparent
                            double alphaValue = 255.0 * (distance / maxDistance);
                            alpha = (byte)Math.Min(255, Math.Max(0, (int)alphaValue));
                            stats.BlendedPixels++;
                        }
                        
                        result.SetPixel(x, y, Color.FromArgb(alpha, pixel.R, pixel.G, pixel.B));
                    }
                }
                
                // Save to PNG
                using (MemoryStream stream = new MemoryStream())
                {
                    result.Save(stream, ImageFormat.Png);
                    return stream.ToArray();
                }
            }
        }

        private static byte[] ConvertWithNearTransparency(Bitmap img, int divergencePercent, out NearTransparencyStats stats)
        {
            // Get color key from top-left pixel
            Color colorKey = img.GetPixel(0, 0);
            
            // Initialize stats
            stats = new NearTransparencyStats
            {
                TotalPixels = img.Width * img.Height
            };
            
            // Create a new bitmap with alpha channel support
            using (Bitmap result = new Bitmap(img.Width, img.Height, PixelFormat.Format32bppArgb))
            {
                // Process each pixel
                for (int y = 0; y < img.Height; y++)
                {
                    for (int x = 0; x < img.Width; x++)
                    {
                        Color pixel = img.GetPixel(x, y);
                        
                        // Calculate percentage divergence for each RGB component
                        double rPercent = Math.Abs(pixel.R - colorKey.R) / 255.0 * 100.0;
                        double gPercent = Math.Abs(pixel.G - colorKey.G) / 255.0 * 100.0;
                        double bPercent = Math.Abs(pixel.B - colorKey.B) / 255.0 * 100.0;
                        
                        // Use maximum divergence across all components
                        double maxDivergence = Math.Max(Math.Max(rPercent, gPercent), bPercent);
                        
                        byte alpha;
                        if (maxDivergence <= divergencePercent)
                        {
                            // Within divergence threshold - make transparent
                            alpha = 0;
                            
                            // Track pixels that were converted above 0% divergence (not exact match)
                            if (maxDivergence > 0.0)
                            {
                                stats.NearMatchPixels++;
                            }
                        }
                        else
                        {
                            // Outside divergence threshold - keep opaque
                            alpha = 255;
                        }
                        
                        result.SetPixel(x, y, Color.FromArgb(alpha, pixel.R, pixel.G, pixel.B));
                    }
                }
                
                // Save to PNG
                using (MemoryStream stream = new MemoryStream())
                {
                    result.Save(stream, ImageFormat.Png);
                    return stream.ToArray();
                }
            }
        }

        public void Save(string fileName)
        {
            using (FileStream stream = new FileStream(fileName, FileMode.Create))
            using (BinaryWriter writer = new BinaryWriter(stream))
            {
                // Write sprite count (2 bytes)
                writer.Write((short)sprites.Count);

                // Write sprite metadata
                foreach (SprSprite sprite in sprites)
                {
                    // Frame count (2 bytes)
                    writer.Write((short)sprite.Frames.Count);
                    
                    // Image length (4 bytes)
                    writer.Write(sprite.ImageData.Length);
                    
                    // Width (4 bytes)
                    writer.Write(sprite.Width);
                    
                    // Height (4 bytes)
                    writer.Write(sprite.Height);
                    
                    // Placeholder byte (1 byte)
                    writer.Write((byte)0);

                    // Frame data (12 bytes per frame)
                    foreach (SprFrame frame in sprite.Frames)
                    {
                        writer.Write(frame.Left);
                        writer.Write(frame.Top);
                        writer.Write(frame.Width);
                        writer.Write(frame.Height);
                        writer.Write(frame.PivotX);
                        writer.Write(frame.PivotY);
                    }
                }

                // Write image data offsets and image data
                foreach (SprSprite sprite in sprites)
                {
                    // Start location (4 bytes) - current position in file
                    writer.Write((int)stream.Position);
                    
                    // Image data
                    writer.Write(sprite.ImageData);
                }
            }
        }
    }

    // Represents a sprite in a .spr file
    class SprSprite
    {
        private readonly List<SprFrame> frames;

        public SprSprite()
        {
            frames = new List<SprFrame>();
            ImageData = Array.Empty<byte>();
        }

        public void AddFrame(SprFrame frame)
        {
            frames.Add(frame);
        }

        public List<SprFrame> Frames => frames;
        public byte[] ImageData { get; set; }
        public int Width { get; set; }
        public int Height { get; set; }
    }

    // Represents a frame in a .spr file
    struct SprFrame
    {
        public short Left;
        public short Top;
        public short Width;
        public short Height;
        public short PivotX;
        public short PivotY;
    }
}
