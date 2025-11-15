# Polymath Android App - Sideloading Instructions

## ✅ Setup Complete!

Your Polymath app is now ready to build for Android. All code changes are complete.

---

## 📱 Option 1: Build APK Locally (Recommended)

### Prerequisites

1. **Install Java Development Kit (JDK)**

   ```bash
   # Option A: Install via Homebrew (easiest)
   brew install openjdk@17

   # Add to your PATH (add to ~/.zshrc or ~/.bash_profile)
   export PATH="/opt/homebrew/opt/openjdk@17/bin:$PATH"

   # Reload shell
   source ~/.zshrc

   # Verify installation
   java -version
   ```

   **OR**

   Download and install from: https://adoptium.net/temurin/releases/

2. **Install Android Studio** (for Android SDK)
   - Download from: https://developer.android.com/studio
   - During installation, make sure to install Android SDK
   - Open Android Studio once to complete setup

### Build the APK

```bash
# Navigate to project
cd /Users/dancroome-horgan/Documents/GitHub/Aperture/projects/polymath

# Build debug APK
cd android
./gradlew assembleDebug

# APK will be created at:
# android/app/build/outputs/apk/debug/app-debug.apk
```

### Install on Your Phone

**Method 1: ADB (Android Debug Bridge)**
```bash
# Enable USB debugging on your phone:
# Settings → About Phone → Tap "Build Number" 7 times → Enable Developer Options → Enable USB Debugging

# Connect phone via USB

# Install APK
adb install android/app/build/outputs/apk/debug/app-debug.apk

# Or if multiple devices connected:
adb -s <device-id> install android/app/build/outputs/apk/debug/app-debug.apk
```

**Method 2: Direct Transfer**
1. Copy `app-debug.apk` to your phone (via USB, email, cloud storage, etc.)
2. On your phone, go to Settings → Security → Enable "Install unknown apps" for your file manager
3. Open the APK file on your phone
4. Tap "Install"

---

## 📱 Option 2: Open in Android Studio (GUI Method)

If you prefer a graphical interface:

```bash
# Open Android project in Android Studio
npx cap open android
```

Then in Android Studio:
1. Wait for Gradle sync to complete
2. Click **Build → Build Bundle(s) / APK(s) → Build APK(s)**
3. Once built, click "locate" in the notification
4. Transfer APK to your phone and install

---

## 🔄 Updating the App

Whenever you make changes:

```bash
# 1. Build web app
npm run build

# 2. Sync with Android
npx cap sync

# 3. Rebuild APK
cd android && ./gradlew assembleDebug

# 4. Reinstall on phone
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

**Note**: The `-r` flag reinstalls and keeps app data

---

## 🎯 Quick Build Script

Save this as `build-android.sh` in the polymath directory:

```bash
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

echo "✅ Build complete!"
echo "📍 APK location: android/app/build/outputs/apk/debug/app-debug.apk"
echo ""
echo "📱 To install on phone:"
echo "   adb install -r android/app/build/outputs/apk/debug/app-debug.apk"
```

Make it executable:
```bash
chmod +x build-android.sh
```

Run it:
```bash
./build-android.sh
```

---

## 🔧 Troubleshooting

### "Unable to locate a Java Runtime"
- Install JDK 17 (see Prerequisites above)
- Make sure Java is in your PATH

### "SDK location not found"
1. Open Android Studio
2. Go to Preferences → Appearance & Behavior → System Settings → Android SDK
3. Note the SDK location (e.g., `/Users/yourname/Library/Android/sdk`)
4. Create `android/local.properties`:
   ```
   sdk.dir=/Users/yourname/Library/Android/sdk
   ```

### "Permission denied" when installing APK
- Enable "Install unknown apps" for your file manager in Android settings
- Or use ADB (doesn't require this permission)

### App crashes on startup
- Check logs: `adb logcat | grep Capacitor`
- Make sure you ran `npm run build && npx cap sync` before building APK

---

## 🌐 Environment Variables

Your `.env` file should contain:
```
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

**Important**: The app will use these at build time. If you change them, rebuild:
```bash
npm run build && npx cap sync && cd android && ./gradlew assembleDebug
```

---

## 🎤 Voice Recording Note

On Android, the voice recording feature will:
- Request microphone permission on first use
- Record audio natively using Capacitor Voice Recorder
- Currently shows "[Audio recorded - transcription requires server endpoint]"

**To enable transcription**: You'll need to create a transcription API endpoint (see CAPACITOR_SETUP.md for details)

---

## 📊 What Works

✅ **Fully Functional**:
- All UI components
- Navigation
- Offline mode (IndexedDB)
- Memory caching
- Supabase authentication (via deep linking)
- Voice recording (native)

⚠️ **Needs Server Endpoint**:
- Voice transcription (currently placeholder)

---

## 🚀 Next Steps

1. Install Java JDK
2. Run `./build-android.sh`
3. Install APK on your phone
4. Enjoy Polymath on Android!

---

## 📞 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Run `adb logcat` to see Android logs
3. Check `CAPACITOR_SETUP.md` for more technical details

---

**Built with**: Capacitor, React, TypeScript, Vite, Supabase
**Build date**: 2025-10-26
