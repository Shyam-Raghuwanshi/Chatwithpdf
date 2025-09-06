#!/bin/bash

# Enhanced PDF OCR Setup Script
# This script downloads the required Tesseract training data files

echo "🚀 Setting up Enhanced PDF OCR..."

# Create tessdata directory
TESSDATA_DIR="android/app/src/main/assets/tessdata"
mkdir -p "$TESSDATA_DIR"

echo "📁 Created tessdata directory: $TESSDATA_DIR"

# Base URL for training data
BASE_URL="https://github.com/tesseract-ocr/tessdata/raw/main"

# Essential language files
declare -A LANGUAGES=(
    ["eng"]="English (Required)"
    ["spa"]="Spanish"
    ["fra"]="French" 
    ["deu"]="German"
    ["ita"]="Italian"
    ["por"]="Portuguese"
    ["rus"]="Russian"
    ["ara"]="Arabic"
    ["hin"]="Hindi"
    ["chi_sim"]="Chinese Simplified"
    ["chi_tra"]="Chinese Traditional"
    ["jpn"]="Japanese"
    ["kor"]="Korean"
)

download_language() {
    local lang_code=$1
    local lang_name=$2
    local file_name="${lang_code}.traineddata"
    local file_path="${TESSDATA_DIR}/${file_name}"
    
    if [ -f "$file_path" ]; then
        echo "✅ $lang_name ($lang_code) already exists"
        return 0
    fi
    
    echo "⬇️  Downloading $lang_name ($lang_code)..."
    
    if command -v curl >/dev/null 2>&1; then
        if curl -L -o "$file_path" "${BASE_URL}/${file_name}"; then
            echo "✅ Downloaded $lang_name"
            return 0
        else
            echo "❌ Failed to download $lang_name"
            rm -f "$file_path"
            return 1
        fi
    elif command -v wget >/dev/null 2>&1; then
        if wget -O "$file_path" "${BASE_URL}/${file_name}"; then
            echo "✅ Downloaded $lang_name"
            return 0
        else
            echo "❌ Failed to download $lang_name"
            rm -f "$file_path"
            return 1
        fi
    else
        echo "❌ Neither curl nor wget found. Please install one of them."
        return 1
    fi
}

# Show available languages
echo ""
echo "📋 Available languages:"
for lang_code in "${!LANGUAGES[@]}"; do
    echo "  $lang_code - ${LANGUAGES[$lang_code]}"
done
echo ""

# Download English (required)
echo "🔤 Downloading required language files..."
download_language "eng" "${LANGUAGES[eng]}"

# Ask user which additional languages to download
if [ "$1" = "--interactive" ] || [ "$1" = "-i" ]; then
    echo ""
    echo "💬 Which additional languages would you like to download?"
    echo "   (Enter language codes separated by spaces, or 'all' for all languages, or 'none' to skip)"
    echo "   Example: spa fra deu"
    read -r user_input
    
    if [ "$user_input" = "all" ]; then
        echo "⬇️  Downloading all languages..."
        for lang_code in "${!LANGUAGES[@]}"; do
            if [ "$lang_code" != "eng" ]; then
                download_language "$lang_code" "${LANGUAGES[$lang_code]}"
            fi
        done
    elif [ "$user_input" != "none" ] && [ -n "$user_input" ]; then
        for lang_code in $user_input; do
            if [ -n "${LANGUAGES[$lang_code]}" ]; then
                download_language "$lang_code" "${LANGUAGES[$lang_code]}"
            else
                echo "⚠️  Unknown language code: $lang_code"
            fi
        done
    else
        echo "⏭️  Skipping additional languages"
    fi
elif [ "$1" = "--all" ] || [ "$1" = "-a" ]; then
    echo "⬇️  Downloading all languages..."
    for lang_code in "${!LANGUAGES[@]}"; do
        if [ "$lang_code" != "eng" ]; then
            download_language "$lang_code" "${LANGUAGES[$lang_code]}"
        fi
    done
else
    # Default: download common languages
    echo "⬇️  Downloading common languages (spa, fra, deu)..."
    download_language "spa" "${LANGUAGES[spa]}"
    download_language "fra" "${LANGUAGES[fra]}"
    download_language "deu" "${LANGUAGES[deu]}"
fi

# Show summary
echo ""
echo "📊 Summary:"
total_files=$(find "$TESSDATA_DIR" -name "*.traineddata" | wc -l)
total_size=$(du -sh "$TESSDATA_DIR" 2>/dev/null | cut -f1 || echo "Unknown")

echo "   📁 Directory: $TESSDATA_DIR"
echo "   📄 Files downloaded: $total_files"
echo "   💾 Total size: $total_size"
echo ""

if [ $total_files -gt 0 ]; then
    echo "✅ OCR setup completed successfully!"
    echo ""
    echo "📝 Next steps:"
    echo "   1. Run: npm install"
    echo "   2. Run: cd android && ./gradlew clean"
    echo "   3. Run: npx react-native run-android"
    echo ""
    echo "🧪 To test the OCR functionality:"
    echo "   - Use the PdfOCRTestScreen component"
    echo "   - Or call EnhancedPdfTextExtractor directly"
else
    echo "⚠️  No training data files were downloaded."
    echo "   The basic PDF extraction will still work, but OCR will be unavailable."
fi

# Optional: show file list
if [ "$1" = "--verbose" ] || [ "$1" = "-v" ]; then
    echo ""
    echo "📋 Downloaded files:"
    ls -la "$TESSDATA_DIR"/*.traineddata 2>/dev/null || echo "   No .traineddata files found"
fi
