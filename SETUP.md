# Mira Attendance — Supabase Backend Setup Guide

## What Changed in This Version

| Feature | Before | After |
|---|---|---|
| Data storage | In-memory MockStorage (lost on refresh) | **Supabase PostgreSQL** (persistent) |
| Face recognition | Gemini AI (cloud, API calls) | **face-api.js (local, offline, private)** |
| File uploads | Base64 in-memory | **Supabase Storage buckets** |
| Authentication OTP | Console.log simulation | **Supabase DB + real email (configurable)** |

---

## Step 1: Create a Supabase Project

1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Click **New Project**
3. Choose a name (e.g., `mira-attendance`), set a database password, select a region close to India (Singapore or Mumbai)
4. Wait for the project to be ready (~2 minutes)

---

## Step 2: Run the Database Schema

1. In Supabase Dashboard, go to **SQL Editor**
2. Open `supabase/schema.sql` from this project
3. Paste the entire content and click **Run**
4. This creates all tables, enums, indexes, RLS policies, and seeds the default college + super admin

---

## Step 3: Create Storage Buckets

In Supabase Dashboard → **Storage** → **New Bucket**, create these 4 buckets:

| Bucket Name | Public? | Purpose |
|---|---|---|
| `avatars` | ✅ Yes | User profile photos |
| `references` | ✅ Yes | Face recognition reference images |
| `timetables` | ✅ Yes | Timetable images |
| `documents` | ❌ No | Private student documents |

---

## Step 4: Configure Environment Variables

1. In Supabase Dashboard → **Settings** → **API**
2. Copy your **Project URL** and **anon/public key**
3. Edit `.env` in this project:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...your-anon-key...
GEMINI_API_KEY=your-gemini-key  # Keep existing key for CogniCraft AI
```

---

## Step 5: Install Dependencies & Run

```bash
npm install
npm run dev
```

---

## Step 6: First Login

- **PIN:** `bhanu99517`
- **Password:** `mira@admin2024`
- OTP will be sent to `bhanu99517@gmail.com` (configure email in Step 7)

**Important:** Change the super admin password immediately after first login via Settings.

---

## Step 7: Configure Email (Optional but Recommended)

For real OTP emails, set up a Supabase Edge Function with Resend or SendGrid:

1. Install Supabase CLI: `npm install -g supabase`
2. Create an edge function for email sending
3. Update `sendEmail()` in `services.ts` to call your edge function

For now, OTPs are logged to the browser console during development.

---

## Face Recognition — How It Works

The face models from `models.zip` are served from `/public/models/`:

- `ssd_mobilenetv1` — Face detection
- `face_landmark_68` — Facial landmark points  
- `face_recognition` — 128-float face descriptor

**Flow for marking attendance:**
1. Student PIN entered → student fetched from Supabase
2. Live photo captured from webcam
3. **face-api.js** computes a face descriptor from the live photo
4. Compared against stored descriptor in DB (or reference image URL as fallback)
5. If match confidence > 45%, attendance is marked

**First time a student is added with a reference image:**
- The system automatically computes and stores their face descriptor in the DB
- Future verifications use the stored descriptor (faster, no image re-download)

---

## Adding Students

When adding a student via **Manage Users**:
1. Fill in all student details
2. Upload a clear, front-facing photo as the **Reference Image**
3. The face descriptor is automatically computed and stored
4. Future attendance will use this for verification

---

## File Structure Changes

```
mira-attendance-supabase/
├── supabaseClient.ts      ← NEW: Supabase client + storage helpers
├── faceRecognition.ts     ← NEW: face-api.js wrapper
├── services.ts            ← REPLACED: all mock → Supabase
├── components/
│   └── MarkAttendance.tsx ← UPDATED: uses face-api.js
├── public/
│   └── models/            ← NEW: face-api.js model files
│       ├── ssd_mobilenetv1_model-*
│       ├── face_landmark_68_model-*
│       └── face_recognition_model-*
└── supabase/
    └── schema.sql         ← NEW: complete DB schema
```

---

## Security Notes

- Face recognition runs **100% in the browser** — no photos sent to servers
- Use Supabase **Row Level Security** policies for production (templates in schema.sql)
- Replace the anon key with server-side calls for sensitive operations in production
- Enable Supabase Auth for per-user JWT tokens in future versions
