#!/usr/bin/env node

/**
 * WAV to MP3 Converter Utility
 * 
 * Converts WAV files to MP3 format using fluent-ffmpeg.
 * 
 * IMPORTANT: ffmpeg must be installed on your system before using this script.
 * Install ffmpeg: https://ffmpeg.org/download.html
 * 
 * Usage:
 *   node wav-to-mp3.js <path> [--sample-rate <Hz>] [--bitrate <kbps>] [--channels <count>]
 * 
 * Arguments:
 *   <path>              - Path to a .wav file or directory containing .wav files
 *   --sample-rate <kHz> - Sample rate in kHz (default: 44.1)
 *   --bitrate <kbps>    - Bitrate in kbps (default: 192)
 *   --channels <count>  - Number of audio channels (default: 2)
 * 
 * Examples:
 *   node wav-to-mp3.js file.wav
 *   node wav-to-mp3.js ./music --sample-rate 48 --bitrate 256
 *   node wav-to-mp3.js ./sounds --sr 44.1 --br 128 --channels 1
 * 
 * If path is a .wav file, converts that file.
 * If path is a directory, finds all .wav files recursively and converts them.
 * 
 * Output files are placed in the same location as the original files,
 * with the same name but .mp3 extension.
 */

const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');

// Run this command: ffmpeg -i ./public/assets/sounds/M91.wav -ar 22050 -ac 1 -b:a 16k ./public/assets/sounds/M91.mp3

/**
 * Converts a single WAV file to MP3
 * @param {string} wavPath - Path to the WAV file
 * @param {number} sampleRate - Sample rate in kHz
 * @param {number} bitrate - Bitrate in kbps
 * @param {number} channels - Number of audio channels
 * @returns {Promise<void>}
 */
function convertWavToMp3(wavPath, sampleRate, bitrate, channels) {
  return new Promise((resolve, reject) => {
    const mp3Path = wavPath.replace(/\.wav$/i, '.mp3');
    
    // Check if output file already exists
    if (fs.existsSync(mp3Path)) {
      console.log(`Skipping ${wavPath} - ${mp3Path} already exists`);
      resolve();
      return;
    }

    console.log(`Converting: ${wavPath} -> ${mp3Path} (${sampleRate}Hz, ${bitrate}kbps, ${channels}ch)`);

    ffmpeg(wavPath)
      .audioCodec('libmp3lame')
      .audioBitrate(bitrate)
      .audioChannels(channels)
      .audioFrequency(sampleRate)
      .format('mp3')
      .on('end', () => {
        console.log(`✓ Completed: ${mp3Path}`);
        resolve();
      })
      .on('error', (err) => {
        console.error(`✗ Error converting ${wavPath}:`, err.message);
        reject(err);
      })
      .save(mp3Path);
  });
}

/**
 * Recursively finds all WAV files in a directory
 * @param {string} dirPath - Directory path to search
 * @returns {string[]} Array of WAV file paths
 */
function findWavFiles(dirPath) {
  const wavFiles = [];
  
  function walkDir(currentPath) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      
      if (entry.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.isFile() && /\.wav$/i.test(entry.name)) {
        wavFiles.push(fullPath);
      }
    }
  }
  
  walkDir(dirPath);
  return wavFiles;
}

/**
 * Parses command line arguments
 * @returns {Object} Parsed arguments { path, sampleRate, bitrate, channels }
 */
function parseArguments() {
  const args = process.argv.slice(2);
  let inputPath = null;
  let sampleRate = 44.1; // Default: 44.1 kHz
  let bitrate = 192; // Default: 192 kbps
  let channels = 2; // Default: 2 channels (stereo)

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--sample-rate' || arg === '--sr') {
      sampleRate = parseFloat(args[++i]);
      if (isNaN(sampleRate) || sampleRate <= 0) {
        console.error(`Error: Invalid sample rate: ${args[i]}`);
        process.exit(1);
      }
    } else if (arg === '--bitrate' || arg === '--br') {
      bitrate = parseInt(args[++i], 10);
      if (isNaN(bitrate) || bitrate <= 0) {
        console.error(`Error: Invalid bitrate: ${args[i]}`);
        process.exit(1);
      }
    } else if (arg === '--channels' || arg === '--ch') {
      channels = parseInt(args[++i], 10);
      if (isNaN(channels) || channels <= 0) {
        console.error(`Error: Invalid channel count: ${args[i]}`);
        process.exit(1);
      }
    } else if (!arg.startsWith('--')) {
      inputPath = arg;
    }
  }

  return { inputPath, sampleRate, bitrate, channels };
}

/**
 * Main function
 */
async function main() {
  const { inputPath, sampleRate, bitrate, channels } = parseArguments();
  
  if (!inputPath) {
    console.error('Usage: node wav-to-mp3.js <path> [--sample-rate <kHz>] [--bitrate <kbps>] [--channels <count>]');
    console.error('  <path>              - Path to a .wav file or directory containing .wav files');
    console.error('  --sample-rate <kHz> - Sample rate in kHz (default: 44.1)');
    console.error('  --bitrate <kbps>    - Bitrate in kbps (default: 192)');
    console.error('  --channels <count>  - Number of audio channels (default: 2)');
    console.error('\nExamples:');
    console.error('  node wav-to-mp3.js file.wav');
    console.error('  node wav-to-mp3.js ./music --sample-rate 48 --bitrate 256');
    console.error('  node wav-to-mp3.js ./sounds --sr 44.1 --br 128 --channels 1');
    process.exit(1);
  }

  // Convert sample rate from kHz to Hz
  const sampleRateHz = Math.round(sampleRate * 1000);

  console.log(`\nConversion settings:`);
  console.log(`  Sample rate: ${sampleRate} kHz (${sampleRateHz} Hz)`);
  console.log(`  Bitrate: ${bitrate} kbps`);
  console.log(`  Channels: ${channels}\n`);

  // Check if path exists
  if (!fs.existsSync(inputPath)) {
    console.error(`Error: Path does not exist: ${inputPath}`);
    process.exit(1);
  }

  const stats = fs.statSync(inputPath);
  let wavFiles = [];

  if (stats.isFile()) {
    // Check if it's a WAV file
    if (!/\.wav$/i.test(inputPath)) {
      console.error(`Error: File must have .wav extension: ${inputPath}`);
      process.exit(1);
    }
    wavFiles = [inputPath];
  } else if (stats.isDirectory()) {
    // Find all WAV files in directory
    console.log(`Searching for WAV files in: ${inputPath}`);
    wavFiles = findWavFiles(inputPath);
    
    if (wavFiles.length === 0) {
      console.log('No WAV files found in the specified directory.');
      process.exit(0);
    }
    
    console.log(`Found ${wavFiles.length} WAV file(s) to convert.\n`);
  } else {
    console.error(`Error: Path is neither a file nor a directory: ${inputPath}`);
    process.exit(1);
  }

  // Convert all WAV files
  let successCount = 0;
  let errorCount = 0;

  for (const wavFile of wavFiles) {
    try {
      await convertWavToMp3(wavFile, sampleRateHz, bitrate, channels);
      successCount++;
    } catch (error) {
      errorCount++;
    }
  }

  // Summary
  console.log(`\n=== Conversion Summary ===`);
  console.log(`Successfully converted: ${successCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log(`Total files: ${wavFiles.length}`);
}

// Run the program
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
