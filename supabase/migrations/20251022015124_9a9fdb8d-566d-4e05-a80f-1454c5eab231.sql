-- Enable realtime for hospitals table
ALTER TABLE public.hospitals REPLICA IDENTITY FULL;

-- Verify realtime publication includes hospitals
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'hospitals'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.hospitals;
  END IF;
END $$;