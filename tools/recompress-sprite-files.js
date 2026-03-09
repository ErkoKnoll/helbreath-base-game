const fs = require('fs');
const path = require('path');

/**
 * Re-compresses PNG data in SPR files using @jsquash/oxipng.
 * Usage: node recompress-sprite-files.js <compression-level> <file-or-folder-path>
 * 
 * Compression levels: 1-6 (higher = better compression, slower)
 * - Level 1: Fast, 1 trial
 * - Level 2: Fast (4 fast trials, 1 main trial) - default
 * - Level 3: 4 trials
 * - Level 4: 4 trials
 * - Level 5: 8 trials
 * - Level 6: 10 trials
 */

// Helper functions to read/write binary data
const readInt16 = (view, offset) => view.getInt16(offset, true);
const readInt32 = (view, offset) => view.getInt32(offset, true);
const writeInt16 = (view, offset, value) => view.setInt16(offset, value, true);
const writeInt32 = (view, offset, value) => view.setInt32(offset, value, true);

// PNG file signature: 89 50 4E 47 0D 0A 1A 0A
const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
// PNG IEND chunk: 00 00 00 00 49 45 4E 44 AE 42 60 82
const PNG_IEND_MARKER = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82]);

const verifyPngSignature = (buffer, offset) => {
    if (offset + PNG_SIGNATURE.length > buffer.length) return false;
    for (let i = 0; i < PNG_SIGNATURE.length; i++) {
        if (buffer[offset + i] !== PNG_SIGNATURE[i]) {
            return false;
        }
    }
    return true;
};

const findPngEnd = (buffer, startOffset, maxLength) => {
    // Search for the IEND marker within the specified range
    const searchEnd = Math.min(startOffset + maxLength, buffer.length - PNG_IEND_MARKER.length);
    
    for (let i = startOffset; i <= searchEnd; i++) {
        let match = true;
        for (let j = 0; j < PNG_IEND_MARKER.length; j++) {
            if (buffer[i + j] !== PNG_IEND_MARKER[j]) {
                match = false;
                break;
            }
        }
        if (match) {
            // Return the position after the IEND marker
            return i + PNG_IEND_MARKER.length;
        }
    }
    
    // If we didn't find IEND, return the max length (fallback)
    return startOffset + maxLength;
};

/**
 * Parse SPR file and extract metadata and image data
 * Based on HBSprite.ts parseSprite method
 */
const parseSpr = (buffer) => {
    const view = new DataView(buffer);
    let offset = 0;

    const spriteCount = readInt16(view, offset);
    offset += 2;

    const sprites = [];

    // First pass: read all sprite metadata
    for (let i = 0; i < spriteCount; i++) {
        const frameCount = readInt16(view, offset);
        offset += 2;

        const imageLength = readInt32(view, offset);
        offset += 4;

        const width = readInt32(view, offset);
        offset += 4;

        const height = readInt32(view, offset);
        offset += 4;

        offset += 1; // startLocation placeholder byte

        const frames = [];

        for (let f = 0; f < frameCount; f++) {
            const left = readInt16(view, offset);
            offset += 2;
            const top = readInt16(view, offset);
            offset += 2;
            const width = readInt16(view, offset);
            offset += 2;
            const height = readInt16(view, offset);
            offset += 2;
            const pivotX = readInt16(view, offset);
            offset += 2;
            const pivotY = readInt16(view, offset);
            offset += 2;

            frames.push({ left, top, width, height, pivotX, pivotY });
        }

        sprites.push({
            frameCount,
            imageLength,
            width,
            height,
            frames
        });
    }

    // Second pass: extract PNG image data
    const fullBuffer = new Uint8Array(buffer);
    
    for (let i = 0; i < sprites.length; i++) {
        const sprite = sprites[i];
        
        offset += 4; // startLocation, not needed for sequential read
        const { imageLength } = sprite;
        
        // Verify PNG signature
        if (!verifyPngSignature(fullBuffer, offset)) {
            throw new Error(`Sprite ${i}: Invalid PNG signature at offset ${offset}`);
        }
        
        // Find the actual end of the PNG data
        const actualPngEnd = findPngEnd(fullBuffer, offset, imageLength);
        const actualLength = actualPngEnd - offset;
        
        // Extract the actual PNG data
        sprite.imageData = fullBuffer.slice(offset, actualPngEnd);
        offset += imageLength; // Still advance by metadata length
    }

    return { spriteCount, sprites };
};

/**
 * Re-compress a single PNG using @jsquash/oxipng
 */
const recompressPng = async (pngData, compressionLevel, optimise) => {
    try {
        // Convert Uint8Array to ArrayBuffer for oxipng
        const arrayBuffer = pngData.buffer.slice(
            pngData.byteOffset,
            pngData.byteOffset + pngData.byteLength
        );
        
        // Optimize PNG with specified compression level
        const optimisedBuffer = await optimise(arrayBuffer, { 
            level: compressionLevel 
        });
        
        return new Uint8Array(optimisedBuffer);
    } catch (error) {
        console.error('Error re-compressing PNG:', error);
        throw error;
    }
};

/**
 * Build a new SPR file with re-compressed PNG data
 */
const buildSpr = (spriteCount, sprites, recompressedImages) => {
    // Calculate total size needed
    let totalSize = 2; // sprite count header
    
    // Calculate metadata size
    for (let i = 0; i < sprites.length; i++) {
        const sprite = sprites[i];
        totalSize += 2; // frame count
        totalSize += 4; // image length
        totalSize += 4; // width
        totalSize += 4; // height
        totalSize += 1; // startLocation placeholder
        totalSize += sprite.frames.length * 12; // frame data
    }
    
    // Add image data size
    for (let i = 0; i < recompressedImages.length; i++) {
        totalSize += 4; // startLocation
        totalSize += recompressedImages[i].length; // image data
    }
    
    // Create output buffer
    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);
    const fullBuffer = new Uint8Array(buffer);
    let offset = 0;
    
    // Write sprite count
    writeInt16(view, offset, spriteCount);
    offset += 2;
    
    // Write sprite metadata
    for (let i = 0; i < sprites.length; i++) {
        const sprite = sprites[i];
        const recompressedImage = recompressedImages[i];
        
        // Write frame count
        writeInt16(view, offset, sprite.frameCount);
        offset += 2;
        
        // Write NEW image length (re-compressed size)
        writeInt32(view, offset, recompressedImage.length);
        offset += 4;
        
        // Write width and height
        writeInt32(view, offset, sprite.width);
        offset += 4;
        writeInt32(view, offset, sprite.height);
        offset += 4;
        
        // Write startLocation placeholder
        fullBuffer[offset] = 0;
        offset += 1;
        
        // Write frame data
        for (let f = 0; f < sprite.frames.length; f++) {
            const frame = sprite.frames[f];
            writeInt16(view, offset, frame.left);
            offset += 2;
            writeInt16(view, offset, frame.top);
            offset += 2;
            writeInt16(view, offset, frame.width);
            offset += 2;
            writeInt16(view, offset, frame.height);
            offset += 2;
            writeInt16(view, offset, frame.pivotX);
            offset += 2;
            writeInt16(view, offset, frame.pivotY);
            offset += 2;
        }
    }
    
    // Write image data
    for (let i = 0; i < recompressedImages.length; i++) {
        const recompressedImage = recompressedImages[i];
        
        // Write startLocation (0 for now)
        writeInt32(view, offset, 0);
        offset += 4;
        
        // Write re-compressed PNG data
        fullBuffer.set(recompressedImage, offset);
        offset += recompressedImage.length;
    }
    
    return buffer;
};

/**
 * Process a single sprite file
 */
const processSpriteFile = async (filePath, compressionLevel, optimise) => {
    const fileName = path.basename(filePath);
    console.log(`\nProcessing: ${fileName}`);
    console.log(`  Path: ${filePath}`);
    
    // Read source file
    if (!fs.existsSync(filePath)) {
        throw new Error(`Source file not found: ${filePath}`);
    }
    
    const sourceBuffer = fs.readFileSync(filePath).buffer;
    const originalSize = sourceBuffer.byteLength;
    console.log(`  Original size: ${originalSize} bytes`);
    
    // Parse SPR file
    const { spriteCount, sprites } = parseSpr(sourceBuffer);
    console.log(`  Found ${spriteCount} sprite(s)`);
    
    // Re-compress each PNG
    console.log(`  Re-compressing PNG images with level ${compressionLevel}...`);
    const recompressedImages = [];
    
    for (let i = 0; i < sprites.length; i++) {
        const sprite = sprites[i];
        const originalSize = sprite.imageData.length;
        
        const recompressed = await recompressPng(sprite.imageData, compressionLevel, optimise);
        recompressedImages.push(recompressed);
        
        const newSize = recompressed.length;
        const diff = newSize - originalSize;
        const pct = ((diff / originalSize) * 100).toFixed(2);
        
        console.log(`    Sprite ${i}: ${originalSize} -> ${newSize} bytes (${diff >= 0 ? '+' : ''}${diff} bytes, ${pct}%)`);
    }
    
    // Build new SPR file
    const newBuffer = buildSpr(spriteCount, sprites, recompressedImages);
    
    // Create compressed directory if it doesn't exist
    const compressedDir = path.join(process.cwd(), 'compressed');
    if (!fs.existsSync(compressedDir)) {
        fs.mkdirSync(compressedDir, { recursive: true });
    }
    
    // Write to compressed directory
    const outputPath = path.join(compressedDir, fileName);
    fs.writeFileSync(outputPath, Buffer.from(newBuffer));
    
    const finalSize = newBuffer.byteLength;
    const totalDiff = finalSize - originalSize;
    const totalPct = ((totalDiff / originalSize) * 100).toFixed(2);
    
    console.log(`  Output: ${outputPath}`);
    console.log(`  New size: ${finalSize} bytes`);
    console.log(`  Difference: ${totalDiff >= 0 ? '+' : ''}${totalDiff} bytes (${totalPct}%)`);
    
    return { fileName, originalSize, finalSize };
};

/**
 * Find all .spr files in a directory recursively
 */
const findSpriteFiles = (dirPath) => {
    const spriteFiles = [];
    
    const scanDirectory = (currentPath) => {
        const entries = fs.readdirSync(currentPath, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(currentPath, entry.name);
            
            if (entry.isDirectory()) {
                scanDirectory(fullPath);
            } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.spr')) {
                spriteFiles.push(fullPath);
            }
        }
    };
    
    scanDirectory(dirPath);
    return spriteFiles;
};

/**
 * Main function
 */
const main = async () => {
    const args = process.argv.slice(2);
    
    if (args.length !== 2) {
        console.error('Usage: node recompress-sprite-files.js <compression-level> <file-or-folder-path>');
        console.error('');
        console.error('Compression levels: 1-6 (higher = better compression, slower)');
        console.error('  Level 1: Fast, 1 trial');
        console.error('  Level 2: Fast (4 fast trials, 1 main trial) - default');
        console.error('  Level 3: 4 trials');
        console.error('  Level 4: 4 trials');
        console.error('  Level 5: 8 trials');
        console.error('  Level 6: 10 trials');
        process.exit(1);
    }
    
    const [compressionLevelStr, inputPath] = args;
    const compressionLevel = parseInt(compressionLevelStr, 10);
    
    // Validate compression level
    if (isNaN(compressionLevel) || compressionLevel < 1 || compressionLevel > 6) {
        console.error(`Error: Compression level must be between 1 and 6, got: ${compressionLevelStr}`);
        process.exit(1);
    }
    
    // Check if input path exists
    if (!fs.existsSync(inputPath)) {
        console.error(`Error: Path not found: ${inputPath}`);
        process.exit(1);
    }
    
    const stats = fs.statSync(inputPath);
    let spriteFiles = [];
    
    // Determine if it's a file or folder
    if (stats.isFile()) {
        if (!inputPath.toLowerCase().endsWith('.spr')) {
            console.error(`Error: File must have .spr extension: ${inputPath}`);
            process.exit(1);
        }
        spriteFiles = [inputPath];
    } else if (stats.isDirectory()) {
        console.log(`Scanning directory for .spr files: ${inputPath}`);
        spriteFiles = findSpriteFiles(inputPath);
        
        if (spriteFiles.length === 0) {
            console.log('No .spr files found in directory');
            process.exit(0);
        }
        
        console.log(`Found ${spriteFiles.length} .spr file(s)`);
    } else {
        console.error(`Error: Path is neither a file nor a directory: ${inputPath}`);
        process.exit(1);
    }
    
    console.log(`\nRe-compressing ${spriteFiles.length} sprite file(s) with compression level ${compressionLevel}`);
    console.log('='.repeat(60));
    
    // Import oxipng module (ES Module)
    console.log('Loading oxipng module...');
    const { optimise } = await import('@jsquash/oxipng');
    const { init } = await import('@jsquash/oxipng/optimise.js');
    
    // Initialize WASM module by reading the WASM file directly
    // This avoids fetch() issues in Node.js
    const oxipngPath = require.resolve('@jsquash/oxipng');
    const oxipngDir = path.dirname(oxipngPath);
    const wasmPath = path.join(oxipngDir, 'codec', 'pkg', 'squoosh_oxipng_bg.wasm');
    
    console.log('Initializing WASM module...');
    // Read WASM file and compile it, then pass the module to init
    const wasmBuffer = fs.readFileSync(wasmPath);
    const wasmArrayBuffer = wasmBuffer.buffer.slice(
        wasmBuffer.byteOffset,
        wasmBuffer.byteOffset + wasmBuffer.byteLength
    );
    
    // Compile WASM module and initialize
    const wasmModule = await WebAssembly.compile(wasmArrayBuffer);
    await init(wasmModule);
    console.log('WASM module initialized');
    
    const results = [];
    
    // Process each sprite file
    for (let i = 0; i < spriteFiles.length; i++) {
        try {
            const result = await processSpriteFile(spriteFiles[i], compressionLevel, optimise);
            results.push(result);
        } catch (error) {
            console.error(`\nError processing ${spriteFiles[i]}:`, error.message);
            // Continue with other files
        }
    }
    
    // Summary
    if (results.length > 0) {
        console.log('\n' + '='.repeat(60));
        console.log('Summary:');
        
        let totalOriginal = 0;
        let totalFinal = 0;
        
        for (const result of results) {
            totalOriginal += result.originalSize;
            totalFinal += result.finalSize;
        }
        
        const totalDiff = totalFinal - totalOriginal;
        const totalPct = ((totalDiff / totalOriginal) * 100).toFixed(2);
        
        console.log(`  Files processed: ${results.length}`);
        console.log(`  Total original size: ${totalOriginal.toLocaleString()} bytes`);
        console.log(`  Total new size: ${totalFinal.toLocaleString()} bytes`);
        console.log(`  Total difference: ${totalDiff >= 0 ? '+' : ''}${totalDiff.toLocaleString()} bytes (${totalPct}%)`);
        console.log(`  Output directory: ${path.join(process.cwd(), 'compressed')}`);
    }
    
    console.log('\nDone!');
};

// Run the script
main().catch(error => {
    console.error('\nFatal error:', error);
    process.exit(1);
});
