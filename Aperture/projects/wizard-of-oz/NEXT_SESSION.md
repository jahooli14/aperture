# Next Session - Wizard of Oz

**Last Updated**: 2025-10-15
**Status**: Ready for next features

---

## 🎉 Recently Completed

### Session Summary (2025-10-15)

We made excellent progress! Here's what was shipped:

1. **Face Alignment Improvements** ✅
   - Lowered detection thresholds (0.4 → 0.3)
   - Relaxed validation constraints for challenging photos
   - 4-level fallback landmark detection system
   - Enhanced diagnostic logging
   - **Result**: Oct 10th photo (and others) now align correctly!

2. **UX Improvements** ✅
   - Removed confusing eye detection error messages
   - Hide upload buttons for dates with existing photos
   - Removed meaningless "1% confidence" display
   - Improved backdate upload UI (button toggle instead of always visible)

3. **Calendar Timezone Fix** ✅
   - Fixed off-by-one date display bug
   - Photos now show on correct dates in calendar

4. **Baby Age Display** ✅
   - Shows age when viewing a photo (tap to see)
   - Smart formatting: "2 weeks, 3 days" or "1 month, 5 days"
   - Purple card with baby icon
   - Only shows if birthdate is set

5. **Birthdate Management** ✅
   - Date picker in Privacy & Security settings
   - Saves to database (user_settings.baby_birthdate)
   - Age calculation utilities in `src/lib/ageUtils.ts`
   - Settings store created (`src/stores/useSettingsStore.ts`)

---

## 🚀 Next Features to Implement

### Priority 1: Memory Notes (Quick Win - ~30 min)

**What**: Add optional text field when uploading photos for quick notes/memories

**Implementation Plan**:

1. **Database**: Already ready! Use `photos.metadata.note` (JSONB field)
   - Migration already created: `supabase/migrations/002_add_birthdate_and_notes.sql`

2. **Upload Component** (`src/components/UploadPhoto.tsx`):
   ```tsx
   // Add state
   const [note, setNote] = useState('');

   // Add UI after date selector (unobtrusive!)
   <div className="mt-3">
     <button
       onClick={() => setShowNoteInput(!showNoteInput)}
       className="text-sm text-gray-600"
     >
       📝 Add a memory note (optional)
     </button>

     {showNoteInput && (
       <textarea
         value={note}
         onChange={(e) => setNote(e.target.value)}
         placeholder="What happened today? (optional)"
         maxLength={500}
         className="..."
       />
     )}
   </div>

   // Pass to uploadPhoto
   await uploadPhoto(fileToUpload, eyeCoords, displayDate, note);
   ```

3. **Photo Store** (`src/stores/usePhotoStore.ts`):
   ```tsx
   uploadPhoto: async (file, eyeCoords, uploadDate, note) => {
     // ...
     const photoRecord = {
       // ... existing fields
       metadata: note ? { note } : null,
     };
   }
   ```

4. **Photo Bottom Sheet** (`src/components/PhotoBottomSheet.tsx`):
   ```tsx
   {/* Memory Note - show if exists */}
   {photo.metadata?.note && (
     <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-xl">
       <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
         <MessageSquare className="w-5 h-5 text-amber-600" />
       </div>
       <div className="flex-1">
         <p className="text-sm font-semibold text-gray-700">Memory Note</p>
         <p className="text-base text-gray-900">{photo.metadata.note}</p>
       </div>
     </div>
   )}
   ```

**Design Principles**:
- ✅ Unobtrusive - behind a toggle button
- ✅ Optional - never required
- ✅ Quick - simple textarea, no fancy editor
- ✅ Visible - shows in photo bottom sheet

**Icons needed**: `MessageSquare` from lucide-react

---

### Priority 2: Comparison View Tab (~2-3 hours)

**What**: New tab with side-by-side or slider comparison of two photos

**Implementation Plan**:

1. **New Component**: `src/components/ComparisonView.tsx`
   ```tsx
   export function ComparisonView() {
     const { photos } = usePhotoStore();
     const [selectedPhoto1, setSelectedPhoto1] = useState<Photo | null>(null);
     const [selectedPhoto2, setSelectedPhoto2] = useState<Photo | null>(null);
     const [sliderPosition, setSliderPosition] = useState(50); // 0-100

     return (
       <div>
         {/* Photo Selectors */}
         <div className="grid grid-cols-2 gap-4">
           <PhotoSelector
             photos={photos}
             selected={selectedPhoto1}
             onSelect={setSelectedPhoto1}
             label="Photo 1"
           />
           <PhotoSelector
             photos={photos}
             selected={selectedPhoto2}
             onSelect={setSelectedPhoto2}
             label="Photo 2"
           />
         </div>

         {/* Comparison Display */}
         {selectedPhoto1 && selectedPhoto2 && (
           <ComparisonSlider
             photo1={selectedPhoto1}
             photo2={selectedPhoto2}
             position={sliderPosition}
             onPositionChange={setSliderPosition}
           />
         )}
       </div>
     );
   }
   ```

2. **Slider Component**: `src/components/ComparisonSlider.tsx`
   ```tsx
   interface ComparisonSliderProps {
     photo1: Photo;
     photo2: Photo;
     position: number; // 0-100
     onPositionChange: (pos: number) => void;
   }

   export function ComparisonSlider({ photo1, photo2, position, onPositionChange }) {
     const handleDrag = (e: MouseEvent | TouchEvent) => {
       // Calculate position based on drag
       // Update onPositionChange
     };

     return (
       <div className="relative aspect-[4/5] overflow-hidden">
         {/* Photo 2 (background) */}
         <img src={photo2.aligned_url || photo2.original_url} />

         {/* Photo 1 (foreground with clip-path) */}
         <img
           src={photo1.aligned_url || photo1.original_url}
           style={{
             clipPath: `inset(0 ${100 - position}% 0 0)`
           }}
         />

         {/* Slider Handle */}
         <div
           style={{ left: `${position}%` }}
           onMouseDown={handleDrag}
           onTouchStart={handleDrag}
         />
       </div>
     );
   }
   ```

3. **Add Tab to App** (`src/App.tsx`):
   ```tsx
   type ViewType = 'gallery' | 'calendar' | 'compare';

   // Add button in navigation
   <button onClick={() => setView('compare')}>
     Compare
   </button>

   // Add to view switcher
   {view === 'compare' && <ComparisonView />}
   ```

**Features**:
- Select any two photos from dropdown/grid
- Smooth slider between photos
- Show age difference between photos
- Optional: Side-by-side toggle mode
- Optional: Swap photos button

**Libraries to consider**:
- Could use existing `motion` from framer-motion for smooth animations
- Native drag events for slider

---

### Priority 3: Shareable Links (Future - ~4-6 hours)

**What**: Generate public links with comparison slider (no auth required)

**Implementation Plan** (for later):

1. **New API Route**: `api/share/[shareId].ts`
   - Generate unique share IDs
   - Store in database: `shares` table
   - Return public photo URLs

2. **Database Table**:
   ```sql
   CREATE TABLE shares (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     user_id UUID REFERENCES auth.users(id),
     photo1_id UUID REFERENCES photos(id),
     photo2_id UUID REFERENCES photos(id),
     share_token TEXT UNIQUE,
     expires_at TIMESTAMPTZ,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );
   ```

3. **Public Route**: `/share/[token]`
   - No auth required
   - Loads comparison view
   - Expires after 7 days (configurable)

**Note**: This is more complex - requires public routes, token generation, expiration logic

---

## 📋 Technical Notes

### Database Migrations Pending

You'll need to run this migration on Supabase before memory notes work:

```sql
-- File: supabase/migrations/002_add_birthdate_and_notes.sql
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS baby_birthdate DATE;

COMMENT ON COLUMN photos.metadata IS 'JSONB field for extensible metadata. Current fields: { note: string (optional memory note) }';
```

**How to apply**:
1. Go to Supabase Dashboard → SQL Editor
2. Paste the migration
3. Run it

Alternatively, if using Supabase CLI:
```bash
supabase db push
```

### Current Architecture

**Stores**:
- `usePhotoStore` - Photos, upload, delete
- `useAuthStore` - Authentication
- `useSettingsStore` - User settings (birthdate, etc.)

**Key Files**:
- `src/lib/ageUtils.ts` - Age calculation utilities
- `src/components/PhotoBottomSheet.tsx` - Photo detail view (where notes should show)
- `src/components/UploadPhoto.tsx` - Upload UI (where to add note input)

### Type Definitions

When adding to metadata, update the type:

```typescript
// src/types/database.ts
metadata: {
  note?: string; // Memory note for the photo
} | null;
```

Or keep it loose as `Record<string, unknown>` and handle at runtime.

---

## 🐛 Known Issues

None! Everything is working well.

---

## 💡 Future Ideas (Not Prioritized)

From our brainstorming session:

- **Timelapse Generator**: Auto-create video/GIF from aligned photos
- **Streak Tracker**: Show consecutive days with photos, gamification
- **Growth Visualization**: Chart showing face changes over time
- **Custom Watermarks**: Add baby's name/age to photos
- **Multiple Babies**: Support for twins/siblings
- **Smart Reminders**: Notifications if you haven't uploaded
- **Monthly Summaries**: Auto-generated "Month in Review"
- **Export Features**: PDF collages, formatted exports

---

## 🎯 Session Goals for Next Time

**Quick Win** (30 min):
1. Implement memory notes

**Main Feature** (2-3 hours):
2. Build comparison view tab

**Stretch Goals**:
3. Shareable links (if time permits)

---

## 📸 Testing Checklist

After implementing memory notes:
- [ ] Upload new photo with a note
- [ ] Upload photo without a note (should work fine)
- [ ] View photo with note in bottom sheet
- [ ] Note displays correctly formatted
- [ ] Note persists after app reload

After implementing comparison view:
- [ ] Can select two different photos
- [ ] Slider moves smoothly
- [ ] Photos align correctly (thanks to our alignment work!)
- [ ] Age difference shows correctly
- [ ] Works on mobile (touch drag)

---

## 🔗 Deployment

Current deployment: **https://aperture-bjyvlfonv-daniels-projects-ca7c7923.vercel.app**

Auto-deploys on push to `main` branch.

---

**Ready to rock! 🚀**
