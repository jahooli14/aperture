#!/bin/bash

echo "🔨 Building Polymath for Android..."

# Build web app
echo "📦 Building web app..."
npm run build

# Sync with Capacitor
echo "🔄 Syncing Capacitor..."
npx cap sync

# Build APK
echo "🤖 Building Android APK..."
cd android && ./gradlew assembleDebug

echo ""
echo "✅ Build complete!"
echo "📍 APK location: android/app/build/outputs/apk/debug/app-debug.apk"
echo ""
echo "📱 To install on phone:"
echo "   adb install -r android/app/build/outputs/apk/debug/app-debug.apk"
