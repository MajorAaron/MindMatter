-- Create saved_articles table
CREATE TABLE saved_articles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    url TEXT NOT NULL,
    title TEXT,
    time_added TIMESTAMP WITH TIME ZONE,
    excerpt TEXT,
    source TEXT,
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    image_url TEXT,
    stored_image_path TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX saved_articles_time_added_idx ON saved_articles USING btree (time_added);
CREATE INDEX saved_articles_tags_idx ON saved_articles USING gin (tags);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER handle_updated_at
    BEFORE UPDATE ON saved_articles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Set up Row Level Security (RLS)
ALTER TABLE saved_articles ENABLE ROW LEVEL SECURITY;

-- Create policies that allow all operations for both authenticated and anonymous users
CREATE POLICY "Enable insert for anonymous users"
ON saved_articles
FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Enable select for anonymous users"
ON saved_articles
FOR SELECT
TO anon
USING (true);

-- Create storage bucket for article images
INSERT INTO storage.buckets (id, name, public)
VALUES ('article-images', 'article-images', true);

-- Allow public access to article images bucket
CREATE POLICY "Give public access to article-images bucket"
ON storage.objects
FOR SELECT
TO anon
USING (bucket_id = 'article-images');

-- Allow anonymous users to upload to article-images bucket
CREATE POLICY "Allow anonymous users to upload images"
ON storage.objects
FOR INSERT
TO anon
WITH CHECK (bucket_id = 'article-images');

-- Add comment to describe the table
COMMENT ON TABLE saved_articles IS 'Stores saved articles and their metadata'; 