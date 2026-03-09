#!/bin/sh

# WAV to MP3 Converter Script
# Converts WAV files to MP3 format using ffmpeg
# Usage: ./sound-to-mp3.sh <file.wav> or <directory>

# Check if argument is provided
if [ $# -eq 0 ]; then
    echo "Usage: $0 <file.wav> or <directory>"
    exit 1
fi

INPUT="$1"

# Check if input exists
if [ ! -e "$INPUT" ]; then
    echo "Error: Path does not exist: $INPUT"
    exit 1
fi

# Function to convert a single WAV file to MP3
convert_file() {
    wav_file="$1"
    # Remove .wav extension (case-insensitive) and add .mp3
    # Use sed to remove case-insensitive .wav extension
    mp3_file=$(echo "$wav_file" | sed 's/\.wav$/.mp3/i')
    
    echo "Converting: $wav_file -> $mp3_file"
    
    # Convert using ffmpeg
    if ffmpeg -i "$wav_file" -ar 22050 -ac 1 -b:a 16k "$mp3_file" -y -loglevel error; then
        echo "✓ Successfully converted: $mp3_file"
        # Delete the original WAV file
        rm "$wav_file"
        echo "  Deleted original: $wav_file"
        return 0
    else
        echo "✗ Error converting: $wav_file"
        return 1
    fi
}

# Check if input is a file ending in .wav (case-insensitive)
if [ -f "$INPUT" ]; then
    # Convert to lowercase and check if it ends with .wav
    input_lower=$(echo "$INPUT" | tr '[:upper:]' '[:lower:]')
    case "$input_lower" in
        *.wav)
            convert_file "$INPUT"
            exit $?
            ;;
        *)
            echo "Error: File must have .wav extension: $INPUT"
            exit 1
            ;;
    esac
# Check if input is a directory
elif [ -d "$INPUT" ]; then
    # Find all .wav files in the directory (non-recursive)
    wav_files=$(find "$INPUT" -maxdepth 1 -type f -iname "*.wav")
    
    if [ -z "$wav_files" ]; then
        echo "No .wav files found in directory: $INPUT"
        exit 0
    fi
    
    file_count=$(echo "$wav_files" | grep -c . || echo "0")
    echo "Found $file_count .wav file(s) to convert."
    echo ""
    
    success_count=0
    error_count=0
    
    # Convert each WAV file (using for loop to avoid subshell issues)
    for wav_file in $wav_files; do
        if [ -n "$wav_file" ] && [ -f "$wav_file" ]; then
            if convert_file "$wav_file"; then
                success_count=$((success_count + 1))
            else
                error_count=$((error_count + 1))
            fi
            echo ""
        fi
    done
    
    # Summary
    echo "=== Conversion Summary ==="
    echo "Successfully converted: $success_count"
    echo "Errors: $error_count"
    
    exit 0
else
    echo "Error: Path is neither a file nor a directory: $INPUT"
    exit 1
fi
