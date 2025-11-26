-- Allow public (unauthenticated) users to view ambulances
CREATE POLICY "Public can view ambulances"
ON ambulances
FOR SELECT
TO anon
USING (true);