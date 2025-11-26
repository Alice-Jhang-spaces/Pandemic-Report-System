-- Drop the overly permissive policy that allows all authenticated users to view emergency reports
DROP POLICY IF EXISTS "Anyone authenticated can view emergency reports" ON public.emergency_reports;

-- Create a restricted policy that only allows:
-- 1. Users who created the report
-- 2. CDC admins
-- 3. Ambulance operators assigned to the emergency
CREATE POLICY "Users can view their own or assigned emergency reports"
ON public.emergency_reports
FOR SELECT
USING (
  auth.uid() = reported_by
  OR has_role(auth.uid(), 'cdc_admin'::app_role)
  OR EXISTS (
    SELECT 1
    FROM ambulances
    WHERE ambulances.id = emergency_reports.ambulance_id
    AND ambulances.operator_id = auth.uid()
  )
);