-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Enable insert for anonymous users" ON saved_articles;
DROP POLICY IF EXISTS "Enable select for anonymous users" ON saved_articles;

-- Recreate all necessary policies
CREATE POLICY "Enable insert for anonymous users"
ON saved_articles FOR INSERT TO anon
WITH CHECK (true);

CREATE POLICY "Enable select for anonymous users"
ON saved_articles FOR SELECT TO anon
USING (true);

CREATE POLICY "Enable update for anonymous users"
ON saved_articles FOR UPDATE TO anon
USING (true)
WITH CHECK (true);

CREATE POLICY "Enable delete for anonymous users"
ON saved_articles FOR DELETE TO anon
USING (true); 