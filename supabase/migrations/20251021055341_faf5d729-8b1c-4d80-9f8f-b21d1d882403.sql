-- Allow users to insert their own roles during signup
DROP POLICY IF EXISTS "CDC admins can insert roles" ON public.user_roles;

CREATE POLICY "Users can insert their own roles"
ON public.user_roles
FOR INSERT
WITH CHECK (
  auth.uid() = user_id OR has_role(auth.uid(), 'cdc_admin'::app_role)
);

-- Also allow users to view their own roles (this already exists but let's ensure it's correct)
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (
  auth.uid() = user_id OR has_role(auth.uid(), 'cdc_admin'::app_role)
);