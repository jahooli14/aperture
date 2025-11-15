# Polymath Android App - Capacitor Setup Status

**Date**: 2025-10-26
**Status**: Phase 1 Complete ✅ - Ready for component integration

---

## ✅ Completed Steps

### 1. Initial Setup
- [x] Installed Capacitor core (@capacitor/core, @capacitor/cli)
- [x] Initialized Capacitor project (`npx cap init`)
- [x] Configured `capacitor.config.ts` with Android settings
- [x] Added Android platform (`npx cap add android`)

### 2. Plugins Installed
- [x] @capacitor/android (platform)
- [x] @capacitor/app (app lifecycle)
- [x] @capacitor/haptics (vibration feedback)
- [x] @capacitor/keyboard (keyboard control)
- [x] @capacitor/status-bar (status bar styling)
- [x] @capacitor/splash-screen (splash screen)
- [x] @capacitor/preferences (key-value storage)
- [x] @capacitor/filesystem (file access)
- [x] @capacitor/network (network status)
- [x] capacitor-voice-recorder (voice recording)

### 3. Utility Files Created
- [x] `src/lib/platform.ts` - Platform detection utilities
  - `isNative()`, `isAndroid()`, `isIOS()`, `isWeb()`
  - `base64ToBlob()` for audio conversion

- [x] `src/hooks/useCapacitorVoice.ts` - Voice recording hook
  - Supports both web (Web Speech API) and native (Capacitor)
  - Permission handling
  - Recording state management
  - Timer functionality

---

## 🔄 Next Steps (In Order)

### Phase 2: Component Integration (2-4 hours)

**1. Update VoiceInput Component**
```bash
# File: src/components/VoiceInput.tsx
# Replace current implementation with useCapacitorVoice hook
```

**2. Add Deep Linking for Supabase OAuth**
```bash
# File: src/App.tsx
# Add App.addListener('appUrlOpen', ...) for auth redirects
```

**3. Update AndroidManifest.xml**
```bash
# File: android/app/src/main/AndroidManifest.xml
# Add intent filter for deep links
```

**4. Add Mobile UI Adjustments**
```bash
# Add safe area padding for mobile
# Adjust touch targets for mobile screens
```

### Phase 3: Build & Test (1-2 hours)

**1. Build Web App**
```bash
cd /Users/dancroome-horgan/Documents/GitHub/Aperture/projects/polymath
npm run build
```

**2. Sync Capacitor**
```bash
npx cap sync
```

**3. Open in Android Studio**
```bash
npx cap open android
```

**4. Test on Emulator/Device**
- Voice recording
- Offline mode (already implemented with IndexedDB)
- Supabase authentication
- All existing features

### Phase 4: Deployment (1-2 days)

**1. Create Keystore**
```bash
keytool -genkey -v -keystore polymath-release.keystore \
  -alias polymath -keyalg RSA -keysize 2048 -validity 10000
```

**2. Generate Signed AAB**
- Build → Generate Signed Bundle/APK in Android Studio
- Select Android App Bundle
- Upload to Play Console

**3. Play Store Setup**
- Create developer account ($25)
- App listing (screenshots, description, privacy policy)
- Internal testing
- Submit for review

---

## 📋 Offline Mode Status

**Already Implemented** ✅

Your app already has excellent offline support:
- `src/lib/db.ts` - IndexedDB wrapper
- `src/hooks/useOfflineSync.ts` - Sync pending captures
- `src/hooks/useMemoryCache.ts` - Cache memories for offline reading

**Capacitor Compatibility**: ✅ Full
- IndexedDB works identically on web and native
- No changes needed to offline functionality
- Background sync available via service workers

---

## 🎤 Voice Recording Strategy

### Web Platform
- Uses Web Speech API (existing implementation)
- Real-time transcription
- No server needed

### Native Platform (Android)
- Uses `capacitor-voice-recorder` plugin
- Records audio as base64 AAC
- Sends to transcription API (needs endpoint)

**TODO**: Create transcription API endpoint
```typescript
// api/transcribe.ts
// Accept audio file
// Send to Google Speech-to-Text or Whisper
// Return transcription
```

---

## 🔑 Environment Variables

**Web** (existing):
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

**Android** (same):
- Uses same Vite environment variables
- Loaded from `.env` file
- No additional config needed

---

## 📁 Files Modified/Created

**Created**:
- `capacitor.config.ts` - Capacitor configuration
- `android/` - Android project directory
- `src/lib/platform.ts` - Platform utilities
- `src/hooks/useCapacitorVoice.ts` - Voice recording hook

**To Modify**:
- `src/components/VoiceInput.tsx` - Use new hook
- `src/App.tsx` - Add deep linking
- `android/app/src/main/AndroidManifest.xml` - Deep link config

---

## 🛠️ Development Commands

**Web Development** (unchanged):
```bash
npm run dev
```

**Build for Android**:
```bash
npm run build
npx cap sync
npx cap open android
```

**Live Reload on Device** (development):
```bash
npx cap run android -l --external
```

---

## ⚠️ Known Tasks

1. **Voice Transcription API**: Create server endpoint for native audio transcription
2. **Deep Linking**: Configure for Supabase OAuth on mobile
3. **UI Testing**: Verify all components work on mobile screens
4. **Performance**: Test on various Android devices

---

## 🎯 Timeline

- ✅ **Phase 1**: Setup (COMPLETE - 1 hour)
- 🔄 **Phase 2**: Integration (2-4 hours)
- ⏳ **Phase 3**: Testing (1-2 hours)
- ⏳ **Phase 4**: Deployment (1-2 days)

**Estimated Total**: 2-3 weeks from start to Play Store

---

## 📚 Resources

- [Capacitor Docs](https://capacitorjs.com/docs)
- [Voice Recorder Plugin](https://github.com/tchvu3/capacitor-voice-recorder)
- [Supabase Auth with Capacitor](https://supabase.com/docs/guides/auth)
- [Android Deployment Guide](https://capacitorjs.com/docs/android/deploying-to-google-play)
