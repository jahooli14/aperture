# Storage Bucket Setup Instructions

## Create the 'originals' Bucket

1. Go to Supabase Dashboard: https://zaruvcwdqkqmyscwvxci.supabase.co
2. Click **Storage** in the left sidebar
3. Click **New bucket**
4. Name: `originals`
5. **Make it PUBLIC** (check the "Public bucket" checkbox)
   - This allows authenticated users to upload and view photos
6. Click **Create bucket**

## Alternative: Manual Policies (if not making public)

If you prefer fine-grained control instead of making it public:

### 1. Upload Policy
- **Name**: Allow authenticated users to upload
- **Policy**: INSERT
- **Target roles**: authenticated
- **WITH CHECK expression**:
```sql
(bucket_id = 'originals'::text) AND (auth.role() = 'authenticated'::text)
```

### 2. View Policy
- **Name**: Allow authenticated users to view
- **Policy**: SELECT
- **Target roles**: authenticated
- **USING expression**:
```sql
(bucket_id = 'originals'::text) AND (auth.role() = 'authenticated'::text)
```

### 3. Update Policy
- **Name**: Allow users to update their own files
- **Policy**: UPDATE
- **Target roles**: authenticated
- **USING expression**:
```sql
(bucket_id = 'originals'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)
```

### 4. Delete Policy
- **Name**: Allow users to delete their own files
- **Policy**: DELETE
- **Target roles**: authenticated
- **USING expression**:
```sql
(bucket_id = 'originals'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)
```

## Create the 'aligned' Bucket (for processed photos)

Repeat the same process for the `aligned` bucket:

1. Go to Supabase Dashboard → **Storage**
2. Click **New bucket**
3. Name: `aligned`
4. **Make it PUBLIC** (check the "Public bucket" checkbox)
5. Click **Create bucket**

This bucket stores the eye-aligned versions of uploaded photos after AI processing.

## Verify Setup

After creating both buckets ('originals' and 'aligned'), the app should work and automatically process photos through the alignment pipeline.
