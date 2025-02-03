-- Rename columns to match local schema
ALTER TABLE saved_articles
RENAME COLUMN given_url TO url;

ALTER TABLE saved_articles
RENAME COLUMN given_title TO title;

-- Update column type for time_added from int8 to timestamptz
ALTER TABLE saved_articles
ALTER COLUMN time_added TYPE timestamptz USING to_timestamp(time_added); 