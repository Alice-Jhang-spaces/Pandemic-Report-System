import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { emergencyReportSchema } from "@/lib/validation";
import { Ambulance, AlertCircle, Hospital, MapPin, User, Plus, Phone } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

interface AmbulanceData {
  id: string;
  vehicle_number: string;
  status: string;
  current_location: string | null;
}

interface EmergencyReport {
  id: string;
  patient_name: string;
  patient_age: number | null;
  patient_phone: string | null;
  patient_address: string | null;
  symptoms: string;
  severity: string;
  pickup_location: string;
  status: string;
  ambulance_id: string | null;
  hospital_id: string | null;
  created_at: string;
}

interface HospitalData {
  id: string;
  name: string;
  address: string;
  available_beds: number;
  available_icu_beds: number;
}

export const ReportCenterDashboard = () => {
  const [ambulances, setAmbulances] = useState<AmbulanceData[]>([]);
  const [emergencyReports, setEmergencyReports] = useState<EmergencyReport[]>([]);
  const [hospitals, setHospitals] = useState<HospitalData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<EmergencyReport | null>(null);
  const [assignmentData, setAssignmentData] = useState({
    ambulance_id: "",
    hospital_id: "",
  });
  const [showAmbulanceDialog, setShowAmbulanceDialog] = useState(false);
  const [showEmergencyDialog, setShowEmergencyDialog] = useState(false);
  const [ambulanceForm, setAmbulanceForm] = useState({
    vehicle_number: "",
    status: "available",
    current_location: "",
  });
  const [emergencyForm, setEmergencyForm] = useState({
    patient_name: "",
    patient_age: "",
    patient_phone: "",
    patient_address: "",
    symptoms: "",
    severity: "medium",
    pickup_location: "",
  });

  useEffect(() => {
    fetchData();
    
    // Subscribe to real-time updates
    const ambulancesChannel = supabase
      .channel("ambulances-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "ambulances" }, () => {
        fetchData();
      })
      .subscribe();

    const reportsChannel = supabase
      .channel("reports-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "emergency_reports" }, () => {
        fetchData();
      })
      .subscribe();

    const hospitalsChannel = supabase
      .channel("hospitals-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "hospitals" }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ambulancesChannel);
      supabase.removeChannel(reportsChannel);
      supabase.removeChannel(hospitalsChannel);
    };
  }, []);

  const fetchData = async () => {
    try {
      // Fetch ambulances
      const { data: ambulancesData, error: ambulancesError } = await supabase
        .from("ambulances")
        .select("*")
        .order("vehicle_number");

      if (ambulancesError) throw ambulancesError;

      // Fetch emergency reports
      const { data: reportsData, error: reportsError } = await supabase
        .from("emergency_reports")
        .select("*")
        .order("created_at", { ascending: false });

      if (reportsError) throw reportsError;

      // Fetch hospitals
      const { data: hospitalsData, error: hospitalsError } = await supabase
        .from("hospitals")
        .select("id, name, address, available_beds, available_icu_beds")
        .order("name");

      if (hospitalsError) throw hospitalsError;

      setAmbulances(ambulancesData || []);
      setEmergencyReports(reportsData || []);
      setHospitals(hospitalsData || []);
    } catch (error: any) {
      toast.error("Failed to load dashboard data");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignAmbulance = async () => {
    if (!selectedReport || !assignmentData.ambulance_id || !assignmentData.hospital_id) {
      toast.error("Please select both ambulance and hospital");
      return;
    }

    try {
      // Get the selected hospital to check available beds
      const selectedHospital = hospitals.find(h => h.id === assignmentData.hospital_id);
      console.log("Selected hospital before update:", selectedHospital);
      
      if (!selectedHospital || selectedHospital.available_beds <= 0) {
        toast.error("Selected hospital has no available beds");
        return;
      }

      // Update emergency report with ambulance and hospital assignment
      const { error: reportError } = await supabase
        .from("emergency_reports")
        .update({
          ambulance_id: assignmentData.ambulance_id,
          hospital_id: assignmentData.hospital_id,
          status: "en_route",
        })
        .eq("id", selectedReport.id);

      if (reportError) throw reportError;

      // Update ambulance status to busy with 30-minute timer and assign to hospital
      const busyUntil = new Date();
      busyUntil.setMinutes(busyUntil.getMinutes() + 30);
      
      const { error: ambulanceError } = await supabase
        .from("ambulances")
        .update({ 
          status: "busy",
          busy_until: busyUntil.toISOString(),
          hospital_id: assignmentData.hospital_id
        })
        .eq("id", assignmentData.ambulance_id);

      if (ambulanceError) throw ambulanceError;

      // Decrement hospital available beds by 1
      const newBedCount = selectedHospital.available_beds - 1;
      console.log("Updating hospital beds from", selectedHospital.available_beds, "to", newBedCount);
      
      const { error: hospitalError } = await supabase
        .from("hospitals")
        .update({ available_beds: newBedCount })
        .eq("id", assignmentData.hospital_id);

      if (hospitalError) {
        console.error("Hospital update error:", hospitalError);
        throw hospitalError;
      }

      console.log("Hospital beds updated successfully");
      toast.success("Ambulance assigned successfully");
      setSelectedReport(null);
      setAssignmentData({ ambulance_id: "", hospital_id: "" });
      await fetchData();
    } catch (error: any) {
      console.error("Assignment error:", error);
      toast.error(error.message || "Failed to assign ambulance");
    }
  };

  const handleAddAmbulance = async () => {
    if (!ambulanceForm.vehicle_number || !ambulanceForm.current_location) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Validate input lengths
    if (ambulanceForm.vehicle_number.length > 50) {
      toast.error("Vehicle number must be less than 50 characters");
      return;
    }
    if (ambulanceForm.current_location.length > 200) {
      toast.error("Location must be less than 200 characters");
      return;
    }

    try {
      const { error } = await supabase
        .from("ambulances")
        .insert([{
          vehicle_number: ambulanceForm.vehicle_number,
          status: ambulanceForm.status as "available" | "busy" | "maintenance",
          current_location: ambulanceForm.current_location,
        }]);

      if (error) throw error;

      toast.success("Ambulance added successfully");
      setShowAmbulanceDialog(false);
      setAmbulanceForm({ vehicle_number: "", status: "available", current_location: "" });
      await fetchData();
    } catch (error: any) {
      toast.error(error.message || "Failed to add ambulance");
    }
  };

  const handleCreateEmergency = async () => {
    if (!emergencyForm.patient_name || !emergencyForm.symptoms || !emergencyForm.pickup_location) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Validate input using zod schema
    try {
      emergencyReportSchema.parse({
        patient_name: emergencyForm.patient_name,
        patient_age: emergencyForm.patient_age ? parseInt(emergencyForm.patient_age) : 0,
        patient_phone: emergencyForm.patient_phone || "",
        symptoms: emergencyForm.symptoms,
        severity: emergencyForm.severity as 'critical' | 'high' | 'medium' | 'low',
        patient_address: emergencyForm.patient_address || "",
        pickup_location: emergencyForm.pickup_location,
      });
    } catch (error: any) {
      const firstError = error.errors?.[0];
      toast.error(firstError?.message || "Please check your input");
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("You must be logged in");
        return;
      }

      const { error } = await supabase
        .from("emergency_reports")
        .insert({
          patient_name: emergencyForm.patient_name.trim(),
          patient_age: emergencyForm.patient_age ? parseInt(emergencyForm.patient_age) : null,
          patient_phone: emergencyForm.patient_phone?.trim() || null,
          patient_address: emergencyForm.patient_address?.trim() || null,
          symptoms: emergencyForm.symptoms.trim(),
          severity: emergencyForm.severity,
          pickup_location: emergencyForm.pickup_location,
          reported_by: session.user.id,
          status: "reported",
        });

      if (error) throw error;

      toast.success("Emergency report created successfully");
      setShowEmergencyDialog(false);
      setEmergencyForm({
        patient_name: "",
        patient_age: "",
        patient_phone: "",
        patient_address: "",
        symptoms: "",
        severity: "medium",
        pickup_location: "",
      });
      await fetchData();
    } catch (error: any) {
      toast.error(error.message || "Failed to create emergency report");
    }
  };

  const availableAmbulances = ambulances.filter(a => a.status === "available");
  const availableHospitals = hospitals.filter(h => h.available_beds > 0);
  const pendingReports = emergencyReports.filter(r => r.status === "reported");
  const activeReports = emergencyReports.filter(r => r.status === "en_route");

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-center text-muted-foreground">Loading report center data...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-4xl font-bold">Report Center Dashboard</h1>
          <div className="flex gap-2">
            <Dialog open={showEmergencyDialog} onOpenChange={setShowEmergencyDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  New Emergency
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create Emergency Report</DialogTitle>
                  <DialogDescription>Report a new emergency case</DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="patient_name">Patient Name *</Label>
                    <Input
                      id="patient_name"
                      value={emergencyForm.patient_name}
                      onChange={(e) => setEmergencyForm({ ...emergencyForm, patient_name: e.target.value })}
                      placeholder="Enter patient name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="patient_age">Age</Label>
                    <Input
                      id="patient_age"
                      type="number"
                      value={emergencyForm.patient_age}
                      onChange={(e) => setEmergencyForm({ ...emergencyForm, patient_age: e.target.value })}
                      placeholder="Patient age"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="patient_phone">Phone</Label>
                    <Input
                      id="patient_phone"
                      value={emergencyForm.patient_phone}
                      onChange={(e) => setEmergencyForm({ ...emergencyForm, patient_phone: e.target.value })}
                      placeholder="Contact number"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="severity">Severity *</Label>
                    <Select
                      value={emergencyForm.severity}
                      onValueChange={(value) => setEmergencyForm({ ...emergencyForm, severity: value })}
                    >
                      <SelectTrigger id="severity">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="critical">Critical</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="patient_address">Address</Label>
                    <Input
                      id="patient_address"
                      value={emergencyForm.patient_address}
                      onChange={(e) => setEmergencyForm({ ...emergencyForm, patient_address: e.target.value })}
                      placeholder="Patient address"
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="pickup_location">Pickup Location *</Label>
                    <Input
                      id="pickup_location"
                      value={emergencyForm.pickup_location}
                      onChange={(e) => setEmergencyForm({ ...emergencyForm, pickup_location: e.target.value })}
                      placeholder="Where to pick up the patient"
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="symptoms">Symptoms *</Label>
                    <Input
                      id="symptoms"
                      value={emergencyForm.symptoms}
                      onChange={(e) => setEmergencyForm({ ...emergencyForm, symptoms: e.target.value })}
                      placeholder="Describe symptoms"
                    />
                  </div>
                  <Button onClick={handleCreateEmergency} className="col-span-2">
                    Create Emergency Report
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={showAmbulanceDialog} onOpenChange={setShowAmbulanceDialog}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Ambulance
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Ambulance</DialogTitle>
                  <DialogDescription>Register a new ambulance in the fleet</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="vehicle_number">Vehicle Number *</Label>
                    <Input
                      id="vehicle_number"
                      value={ambulanceForm.vehicle_number}
                      onChange={(e) => setAmbulanceForm({ ...ambulanceForm, vehicle_number: e.target.value })}
                      placeholder="e.g., AMB-051"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={ambulanceForm.status}
                      onValueChange={(value) => setAmbulanceForm({ ...ambulanceForm, status: value })}
                    >
                      <SelectTrigger id="status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="available">Available</SelectItem>
                        <SelectItem value="busy">Busy</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="current_location">Current Location *</Label>
                    <Input
                      id="current_location"
                      value={ambulanceForm.current_location}
                      onChange={(e) => setAmbulanceForm({ ...ambulanceForm, current_location: e.target.value })}
                      placeholder="Station or location"
                    />
                  </div>
                  <Button onClick={handleAddAmbulance} className="w-full">
                    Add Ambulance
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        <p className="text-muted-foreground">Manage emergency responses and ambulance assignments</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Ambulance className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Available</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{availableAmbulances.length}</div>
            <p className="text-sm text-muted-foreground">of {ambulances.length} ambulances</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              <CardTitle className="text-lg">Pending</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{pendingReports.length}</div>
            <p className="text-sm text-muted-foreground">emergency reports</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-blue-500" />
              <CardTitle className="text-lg">Active</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{activeReports.length}</div>
            <p className="text-sm text-muted-foreground">ambulances en route</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Hospital className="h-5 w-5 text-green-500" />
              <CardTitle className="text-lg">Hospitals</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{hospitals.length}</div>
            <p className="text-sm text-muted-foreground">active facilities</p>
          </CardContent>
        </Card>
      </div>

      {/* Pending Emergency Reports */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Pending Emergency Reports</CardTitle>
          <CardDescription>Assign ambulances to emergency cases</CardDescription>
        </CardHeader>
        <CardContent>
          {pendingReports.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No pending emergency reports</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Report ID</th>
                    <th className="text-left py-3 px-4">Patient</th>
                    <th className="text-left py-3 px-4">Contact</th>
                    <th className="text-left py-3 px-4">Severity</th>
                    <th className="text-left py-3 px-4">Symptoms</th>
                    <th className="text-left py-3 px-4">Location</th>
                    <th className="text-left py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingReports.map((report) => (
                    <tr key={report.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4">
                        <div className="font-mono text-sm font-medium">{report.id.slice(0, 8)}</div>
                        <div className="text-xs text-muted-foreground">{new Date(report.created_at).toLocaleString()}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium">{report.patient_name}</div>
                        {report.patient_age && (
                          <div className="text-sm text-muted-foreground">Age: {report.patient_age}</div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {report.patient_phone && (
                          <div className="text-sm flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {report.patient_phone}
                          </div>
                        )}
                        {report.patient_address && (
                          <div className="text-sm text-muted-foreground">{report.patient_address}</div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={report.severity === "critical" ? "destructive" : "default"}>
                          {report.severity}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-sm">{report.symptoms}</td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">{report.pickup_location}</td>
                      <td className="py-3 px-4">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              size="sm"
                              onClick={() => setSelectedReport(report)}
                            >
                              Assign
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Assign Ambulance & Hospital</DialogTitle>
                              <DialogDescription>
                                Assign an ambulance and select destination hospital for {report.patient_name}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              <div className="space-y-2">
                                <Label>Select Ambulance</Label>
                                <Select
                                  value={assignmentData.ambulance_id}
                                  onValueChange={(value) => setAssignmentData({ ...assignmentData, ambulance_id: value })}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Choose ambulance" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {availableAmbulances.map((amb) => (
                                      <SelectItem key={amb.id} value={amb.id}>
                                        {amb.vehicle_number} - {amb.current_location || "Unknown location"}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label>Select Hospital</Label>
                                <Select
                                  value={assignmentData.hospital_id}
                                  onValueChange={(value) => setAssignmentData({ ...assignmentData, hospital_id: value })}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Choose hospital" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {availableHospitals.length === 0 ? (
                                      <div className="p-2 text-sm text-muted-foreground">No hospitals with available beds</div>
                                    ) : (
                                      availableHospitals.map((hospital) => (
                                        <SelectItem key={hospital.id} value={hospital.id}>
                                          {hospital.name} - {hospital.available_beds} beds available
                                        </SelectItem>
                                      ))
                                    )}
                                  </SelectContent>
                                </Select>
                              </div>
                              <Button 
                                onClick={handleAssignAmbulance}
                                className="w-full"
                                disabled={!assignmentData.ambulance_id || !assignmentData.hospital_id}
                              >
                                Assign & Dispatch
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ambulance Fleet Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Ambulance className="h-5 w-5 text-primary" />
            <CardTitle>Ambulance Fleet Status</CardTitle>
          </div>
          <CardDescription>Real-time status of all ambulance units</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Vehicle Number</th>
                  <th className="text-left py-3 px-4">Status</th>
                  <th className="text-left py-3 px-4">Current Location</th>
                </tr>
              </thead>
              <tbody>
                {ambulances.map((ambulance) => (
                  <tr key={ambulance.id} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-4 font-medium">{ambulance.vehicle_number}</td>
                    <td className="py-3 px-4">
                      <StatusBadge status={ambulance.status} type="ambulance" />
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {ambulance.current_location || "Not reported"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
