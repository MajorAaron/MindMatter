-- Add image-related columns to saved_articles table
ALTER TABLE saved_articles
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS stored_image_path TEXT;

-- Add comment to describe the changes
COMMENT ON COLUMN saved_articles.image_url IS 'URL of the article image';
COMMENT ON COLUMN saved_articles.stored_image_path IS 'Path to the stored image in Supabase Storage'; 