# Android SDK Setup - Simple Method

You're getting the SDK error because the command-line setup is complex. Here's the easiest way:

## ✅ Method 1: Use Android Studio (Recommended - 10 minutes)

1. **Download Android Studio**: https://developer.android.com/studio

2. **Install it** (just drag to Applications folder)

3. **Run Android Studio**:
   - It will download and install the Android SDK automatically
   - Just click "Next" through the setup wizard
   - Wait for it to finish downloading SDK components (~5-10 min)

4. **Find your SDK location**:
   - After setup completes, open Android Studio
   - Go to: **Android Studio → Settings → Appearance & Behavior → System Settings → Android SDK**
   - You'll see "Android SDK Location" at the top (usually `/Users/dancroome-horgan/Library/Android/sdk`)
   - Copy that path

5. **Update the local.properties file**:
   ```bash
   echo "sdk.dir=/Users/dancroome-horgan/Library/Android/sdk" > /Users/dancroome-horgan/Documents/GitHub/Aperture/projects/polymath/android/local.properties
   ```
   *(Replace the path with your actual SDK location from step 4)*

6. **Run the build**:
   ```bash
   cd /Users/dancroome-horgan/Documents/GitHub/Aperture/projects/polymath
   ./build-android.sh
   ```

Done! This is by far the easiest method.

---

## 🔧 Method 2: Use Android Studio's GUI (Even Easier)

After installing Android Studio:

1. **Open the Android project**:
   ```bash
   cd /Users/dancroome-horgan/Documents/GitHub/Aperture/projects/polymath
   npx cap open android
   ```

2. **Android Studio will open** with your project

3. **Wait for Gradle sync** to complete (bottom status bar)

4. **Build the APK**:
   - Click: **Build → Build Bundle(s) / APK(s) → Build APK(s)**
   - Wait for build to finish (~2-5 minutes)
   - Click "locate" in the notification when done
   - Your APK is there!

5. **Transfer to phone** and install

This method is fully GUI - no command line needed!

---

## 📌 Current Status

- ✅ Java is installed
- ✅ Polymath code is ready
- ✅ Build scripts are ready
- ⏳ Just need Android SDK

**Recommendation**: Use Android Studio (Method 1 or 2). It's designed for this and handles everything automatically.

---

## ⚡ Quick Commands (After Android Studio is installed)

```bash
# Using build script:
cd /Users/dancroome-horgan/Documents/GitHub/Aperture/projects/polymath
./build-android.sh

# Or using Android Studio GUI:
npx cap open android
# Then: Build → Build APK
```

---

## 🎯 Why Android Studio?

- Automatically installs correct SDK versions
- Handles all configurations
- Has GUI for building APKs
- Much simpler than command-line setup
- Official Google tool

**Download**: https://developer.android.com/studio
