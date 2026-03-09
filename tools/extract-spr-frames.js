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

    console.log(`Extracting ${sprite.frames.length} frames from animation ${animationIndex}...`);
    console.log(`Sprite image dimensions: ${metadata.width}x${metadata.height}`);
    console.log(`Original format: ${metadata.format}, Color space: ${metadata.space}, Has alpha: ${metadata.hasAlpha}`);

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
        const outputPath = path.join(destPath, `frame_${frameIndex.toString().padStart(3, '0')}.png`);

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

            console.log(`  Frame ${frameIndex}: ${frame.width}x${frame.height} -> ${outputPath}`);
        } catch (error) {
            console.error(`  Error extracting frame ${frameIndex}:`, error.message);
        }
    }
}

/**
 * Main function
 */
async function main() {
    const args = process.argv.slice(2);

    if (args.length < 3) {
        console.error('Usage: node extract-spr-frames.js <spr-file> <animation-number> <destination-path>');
        console.error('');
        console.error('Example: node extract-spr-frames.js assets/kennedy.spr 0 ./output');
        process.exit(1);
    }

    const sprFilePath = args[0];
    const animationNumber = parseInt(args[1], 10);
    const destPath = args[2];

    // Validate inputs
    if (!fs.existsSync(sprFilePath)) {
        console.error(`Error: File not found: ${sprFilePath}`);
        process.exit(1);
    }

    if (isNaN(animationNumber) || animationNumber < 0) {
        console.error(`Error: Invalid animation number: ${animationNumber}`);
        process.exit(1);
    }

    try {
        // Read the .spr file
        console.log(`Reading .spr file: ${sprFilePath}`);
        const buffer = fs.readFileSync(sprFilePath);

        // Parse the .spr file
        console.log('Parsing .spr file...');
        const sprites = parseSpr(buffer);

        console.log(`Found ${sprites.length} sprite(s) in file`);

        // Validate animation number
        if (animationNumber >= sprites.length) {
            console.error(`Error: Animation number ${animationNumber} is out of range. File contains ${sprites.length} sprite(s) (0-${sprites.length - 1})`);
            process.exit(1);
        }

        // Get the requested sprite
        const sprite = sprites[animationNumber];
        console.log(`Animation ${animationNumber} has ${sprite.frames.length} frame(s)`);

        // Extract frames
        await extractFrames(sprite, destPath, animationNumber);

        console.log(`\nSuccessfully extracted ${sprite.frames.length} frame(s) to ${destPath}`);
    } catch (error) {
        console.error('Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run the script
main();
