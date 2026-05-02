import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Storage bucket names
export const STORAGE_BUCKETS = {
  AVATARS: 'avatars',
  REFERENCES: 'references',
  TIMETABLES: 'timetables',
  DOCUMENTS: 'documents',
} as const;

/**
 * Upload a file (blob or file) to a Supabase storage bucket.
 * Returns the public URL.
 */
export const uploadFile = async (
  bucket: string,
  path: string,
  file: Blob | File,
  contentType?: string
): Promise<string> => {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      contentType: contentType || 'image/jpeg',
      upsert: true,
    });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
  return urlData.publicUrl;
};

/**
 * Delete a file from a Supabase storage bucket.
 */
export const deleteFile = async (bucket: string, path: string): Promise<void> => {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw new Error(`Delete failed: ${error.message}`);
};
