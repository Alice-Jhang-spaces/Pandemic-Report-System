-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('cdc_admin', 'hospital_staff', 'ambulance_operator');

-- Create enum for ambulance status
CREATE TYPE public.ambulance_status AS ENUM ('available', 'busy', 'offline');

-- Create enum for emergency status
CREATE TYPE public.emergency_status AS ENUM ('reported', 'dispatched', 'en_route', 'arrived', 'completed');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  organization TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- Create hospitals table
CREATE TABLE public.hospitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  phone TEXT NOT NULL,
  total_beds INTEGER NOT NULL DEFAULT 0,
  available_beds INTEGER NOT NULL DEFAULT 0,
  icu_beds INTEGER NOT NULL DEFAULT 0,
  available_icu_beds INTEGER NOT NULL DEFAULT 0,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create ambulances table
CREATE TABLE public.ambulances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_number TEXT UNIQUE NOT NULL,
  status ambulance_status DEFAULT 'available',
  current_location TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  operator_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create emergency_reports table
CREATE TABLE public.emergency_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_name TEXT NOT NULL,
  patient_age INTEGER,
  symptoms TEXT NOT NULL,
  severity TEXT NOT NULL,
  pickup_location TEXT NOT NULL,
  pickup_latitude DECIMAL(10, 8),
  pickup_longitude DECIMAL(11, 8),
  ambulance_id UUID REFERENCES public.ambulances(id),
  hospital_id UUID REFERENCES public.hospitals(id),
  status emergency_status DEFAULT 'reported',
  reported_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ambulances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_reports ENABLE ROW LEVEL SECURITY;

-- Create function to check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "CDC admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'cdc_admin'));

CREATE POLICY "CDC admins can insert roles"
  ON public.user_roles FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'cdc_admin'));

-- RLS Policies for hospitals (everyone can view, hospital staff and CDC can update)
CREATE POLICY "Anyone authenticated can view hospitals"
  ON public.hospitals FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Hospital staff can update their hospital"
  ON public.hospitals FOR UPDATE
  USING (public.has_role(auth.uid(), 'hospital_staff') OR public.has_role(auth.uid(), 'cdc_admin'));

CREATE POLICY "CDC admins can insert hospitals"
  ON public.hospitals FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'cdc_admin'));

-- RLS Policies for ambulances (everyone can view, operators and CDC can update)
CREATE POLICY "Anyone authenticated can view ambulances"
  ON public.ambulances FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Ambulance operators can update their ambulance"
  ON public.ambulances FOR UPDATE
  USING (
    auth.uid() = operator_id OR 
    public.has_role(auth.uid(), 'cdc_admin')
  );

CREATE POLICY "CDC admins can insert ambulances"
  ON public.ambulances FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'cdc_admin'));

-- RLS Policies for emergency_reports (all authenticated can view and create, assigned can update)
CREATE POLICY "Anyone authenticated can view emergency reports"
  ON public.emergency_reports FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create reports"
  ON public.emergency_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reported_by);

CREATE POLICY "Assigned users can update reports"
  ON public.emergency_reports FOR UPDATE
  USING (
    auth.uid() = reported_by OR
    public.has_role(auth.uid(), 'cdc_admin') OR
    EXISTS (
      SELECT 1 FROM public.ambulances 
      WHERE ambulances.id = emergency_reports.ambulance_id 
      AND ambulances.operator_id = auth.uid()
    )
  );

-- Create function to handle new user signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, organization)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'organization'
  );
  RETURN NEW;
END;
$$;

-- Create trigger for new user signups
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Create triggers for updated_at
CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_hospitals
  BEFORE UPDATE ON public.hospitals
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_ambulances
  BEFORE UPDATE ON public.ambulances
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_emergency_reports
  BEFORE UPDATE ON public.emergency_reports
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.hospitals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ambulances;
ALTER PUBLICATION supabase_realtime ADD TABLE public.emergency_reports;