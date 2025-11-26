-- Add busy_until column to track when ambulance should become available again
ALTER TABLE public.ambulances ADD COLUMN IF NOT EXISTS busy_until TIMESTAMP WITH TIME ZONE;

-- Create function to automatically update ambulance status based on busy_until
CREATE OR REPLACE FUNCTION public.update_ambulance_status()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update ambulances that have passed their busy_until time
  UPDATE public.ambulances
  SET status = 'available',
      busy_until = NULL
  WHERE status = 'busy' 
    AND busy_until IS NOT NULL 
    AND busy_until <= NOW();
END;
$$;

-- Enable pg_cron extension for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the function to run every minute
SELECT cron.schedule(
  'update-ambulance-status',
  '* * * * *',
  $$SELECT public.update_ambulance_status();$$
);