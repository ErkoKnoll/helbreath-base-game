#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Helper functions to read binary data (little-endian)
const readInt16 = (buffer, offset) => buffer.readInt16LE(offset);
const readInt32 = (buffer, offset) => buffer.readInt32LE(offset);

/**
 * Parse a .spr file and extract all sprites
 * @param {Buffer} buffer - The .spr file buffer
 * @returns {Array} Array of sprite objects with frames and imageData
 */
function parseSpr(buffer) {
    let offset = 0;

    // Read sprite count (first 2 bytes)
    const spriteCount = readInt16(buffer, offset);
    offset += 2;

    const meta = [];

    // Read metadata for each sprite
    for (let i = 0; i < spriteCount; i++) {
        const frameCount = readInt16(buffer, offset);
        offset += 2;

        const imageLength = readInt32(buffer, offset);
        offset += 4;

        const width = readInt32(buffer, offset);
        offset += 4;

        const height = readInt32(buffer, offset);
        offset += 4;

        offset += 1; // startLocation placeholder byte

        const frames = [];

        // Read frame data
        for (let f = 0; f < frameCount; f++) {
            const left = readInt16(buffer, offset);
            offset += 2;
            const top = readInt16(buffer, offset);
            offset += 2;
            const width = readInt16(buffer, offset);
            offset += 2;
            const height = readInt16(buffer, offset);
            offset += 2;
            const pivotX = readInt16(buffer, offset);
            offset += 2;
            const pivotY = readInt16(buffer, offset);
            offset += 2;

            frames.push({ left, top, width, height, pivotX, pivotY });
        }

        meta.push({ frames, imageLength, width, height });
    }

    const sprites = [];

    // Read image data for each sprite
    for (let i = 0; i < meta.length; i++) {
        offset += 4; // startLocation, not needed for sequential read
        const { imageLength, frames, width, height } = meta[i];
        const imageBuffer = buffer.slice(offset, offset + imageLength);
        offset += imageLength;

        sprites.push({
            frames,
            imageData: imageBuffer,
            width,
            height
        });
    }

    return sprites;
}

/**
 * Extract frames from a sprite and save them as PNG files
 * @param {Object} sprite - The sprite object with frames and imageData
 * @param {string} destPath - Destination directory path
 * @param {number} animationIndex - Animation index for naming files
 */
async function extractFrames(sprite, destPath, animationIndex) {
    // Ensure destination directory exists
    if (!fs.existsSync(destPath)) {
        fs.mkdirSync(destPath, { recursive: true });
    }

    // The sprite.imageData is already PNG data, so we decode it once
    // and extract frames from the decoded image to avoid multiple decode cycles
    const spriteImage = sharp(sprite.imageData);

    // Extract metadata to get the full image dimensions and format info
    const metadata = await spriteImage.metadata();

    console.log(`  Extracting ${sprite.frames.length} frames from animation ${animationIndex}...`);

    // Decode the PNG once to raw pixel data (sharp handles this efficiently internally)
    // We'll extract each frame from this decoded image
    // Since PNG is lossless, decoding and re-encoding preserves exact pixel values
    const pngOptions = {
        compressionLevel: 9, // Maximum compression (0-9) for best file size
        adaptiveFiltering: true, // Use adaptive filtering for better compression
    };

    // Use palette mode only if there's no alpha channel (preserves transparency)
    if (!metadata.hasAlpha) {
        pngOptions.palette = true;
        pngOptions.colors = 256; // Maximum colors for palette mode
        pngOptions.dither = 0; // No dithering to preserve exact colors
    }

    // Extract each frame
    for (let frameIndex = 0; frameIndex < sprite.frames.length; frameIndex++) {
        const frame = sprite.frames[frameIndex];
        
        // Extract the frame region from the sprite image
        // Note: The frame coordinates are relative to the sprite image
        const outputPath = path.join(destPath, `${frameIndex}.png`);

        try {
            // Extract frame region and save as PNG
            // Sharp will decode the original PNG once (cached) and extract the region
            // Then re-encode only the extracted region as PNG
            await spriteImage
                .clone() // Clone the pipeline to avoid mutating the original
                .extract({
                    left: frame.left,
                    top: frame.top,
                    width: frame.width,
                    height: frame.height
                })
                .png(pngOptions) // Re-encode as PNG with optimal compression
                .toFile(outputPath);

            console.log(`    Frame ${frameIndex}: ${frame.width}x${frame.height} -> ${outputPath}`);
        } catch (error) {
            console.error(`    Error extracting frame ${frameIndex}:`, error.message);
        }
    }
}

/**
 * Process a single .spr file and extract all animations
 * @param {string} sprFilePath - Path to the .spr file
 * @param {string} baseOutputPath - Base output directory (extracted folder)
 */
async function processSprFile(sprFilePath, baseOutputPath) {
    const fileName = path.basename(sprFilePath, '.spr');
    const spriteOutputPath = path.join(baseOutputPath, fileName);

    console.log(`\nProcessing: ${sprFilePath}`);
    console.log(`Output directory: ${spriteOutputPath}`);

    try {
        // Read the .spr file
        const buffer = fs.readFileSync(sprFilePath);

        // Parse the .spr file
        const sprites = parseSpr(buffer);

        console.log(`  Found ${sprites.length} animation(s) in file`);

        // Process each animation
        for (let animationIndex = 0; animationIndex < sprites.length; animationIndex++) {
            const sprite = sprites[animationIndex];
            const animationPath = path.join(spriteOutputPath, animationIndex.toString());

            // Extract frames for this animation
            await extractFrames(sprite, animationPath, animationIndex);
        }

        console.log(`  Successfully processed ${sprites.length} animation(s) from ${fileName}.spr`);
    } catch (error) {
        console.error(`  Error processing ${sprFilePath}:`, error.message);
        console.error(error.stack);
    }
}

/**
 * Main function
 */
async function main() {
    const args = process.argv.slice(2);

    if (args.length < 1) {
        console.error('Usage: node extract-all-spr.js <folder-path>');
        console.error('');
        console.error('Example: node extract-all-spr.js ./assets/sprites');
        console.error('');
        console.error('This script will:');
        console.error('  1. Find all .spr files in the specified folder');
        console.error('  2. Create an "extracted" folder in the same directory');
        console.error('  3. For each sprite file, create a subfolder with the sprite name');
        console.error('  4. Extract all animations (numbered folders) and frames (numbered PNGs)');
        process.exit(1);
    }

    const folderPath = args[0];

    // Validate input folder
    if (!fs.existsSync(folderPath)) {
        console.error(`Error: Folder not found: ${folderPath}`);
        process.exit(1);
    }

    const stats = fs.statSync(folderPath);
    if (!stats.isDirectory()) {
        console.error(`Error: Path is not a directory: ${folderPath}`);
        process.exit(1);
    }

    // Create extracted folder in the same directory as the input folder
    const extractedPath = path.join(folderPath, 'extracted');

    // Find all .spr files
    const files = fs.readdirSync(folderPath);
    const sprFiles = files.filter(file => file.toLowerCase().endsWith('.spr'));

    if (sprFiles.length === 0) {
        console.error(`Error: No .spr files found in ${folderPath}`);
        process.exit(1);
    }

    console.log(`Found ${sprFiles.length} .spr file(s) in ${folderPath}`);
    console.log(`Output will be saved to: ${extractedPath}`);

    // Process each .spr file
    for (const sprFile of sprFiles) {
        const sprFilePath = path.join(folderPath, sprFile);
        await processSprFile(sprFilePath, extractedPath);
    }

    console.log(`\n✅ Successfully extracted all sprites to ${extractedPath}`);
}

// Run the script
main();
