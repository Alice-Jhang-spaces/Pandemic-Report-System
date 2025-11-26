import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Activity, ArrowLeft } from "lucide-react";
import { useEffect } from "react";

const Auth = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [signUpData, setSignUpData] = useState({
    email: "",
    password: "",
    fullName: "",
    organization: "",
    hospitalCode: "",
  });
  const [signInData, setSignInData] = useState({
    email: "",
    password: "",
  });

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard");
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        navigate("/dashboard");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Validate hospital code for medical staff
      let hospitalId = null;
      if (signUpData.organization === "Medical Staff") {
        if (signUpData.hospitalCode === "A1") {
          const { data: hospitals } = await supabase
            .from("hospitals")
            .select("id")
            .eq("name", "Hospital A")
            .single();
          hospitalId = hospitals?.id;
        } else if (signUpData.hospitalCode === "A2") {
          const { data: hospitals } = await supabase
            .from("hospitals")
            .select("id")
            .eq("name", "Hospital B")
            .single();
          hospitalId = hospitals?.id;
        } else {
          toast.error("Invalid hospital code. Please use A1 for Hospital A or A2 for Hospital B.");
          setIsLoading(false);
          return;
        }

        if (!hospitalId) {
          toast.error("Hospital not found. Please contact administrator.");
          setIsLoading(false);
          return;
        }
      }

      const { data, error } = await supabase.auth.signUp({
        email: signUpData.email,
        password: signUpData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: {
            full_name: signUpData.fullName,
            organization: signUpData.organization,
          },
        },
      });

      if (error) throw error;

      // Link medical staff to their hospital
      if (hospitalId && data.user) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ hospital_id: hospitalId })
          .eq("id", data.user.id);

        if (profileError) {
          console.error("Failed to link hospital:", profileError);
          toast.error("Account created but failed to link hospital. Please contact administrator.");
        }
      }

      // Security: Role assignment now requires admin approval
      if (signUpData.organization === "Report Center Staff") {
        toast.success("Account created! Please contact an administrator to activate your report center access.");
      } else {
        toast.success("Account created successfully! You can now sign in.");
      }
      setSignUpData({ email: "", password: "", fullName: "", organization: "", hospitalCode: "" });
    } catch (error: any) {
      toast.error(error.message || "Failed to sign up");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: signInData.email,
        password: signInData.password,
      });

      if (error) throw error;

      toast.success("Signed in successfully!");
      navigate("/dashboard");
    } catch (error: any) {
      toast.error(error.message || "Failed to sign in");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <Button
          variant="ghost"
          className="mb-4"
          onClick={() => navigate("/")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Button>
        
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Activity className="h-10 w-10 text-primary" />
            <h1 className="text-3xl font-bold">PREMS</h1>
          </div>
          <p className="text-muted-foreground">Pandemic Reporting & Emergency Management</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Welcome</CardTitle>
            <CardDescription>Sign in to your account or create a new one</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="you@example.com"
                      value={signInData.email}
                      onChange={(e) => setSignInData({ ...signInData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Password</Label>
                    <Input
                      id="signin-password"
                      type="password"
                      value={signInData.password}
                      onChange={(e) => setSignInData({ ...signInData, password: e.target.value })}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Signing in..." : "Sign In"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Full Name</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="John Doe"
                      value={signUpData.fullName}
                      onChange={(e) => setSignUpData({ ...signUpData, fullName: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="you@example.com"
                      value={signUpData.email}
                      onChange={(e) => setSignUpData({ ...signUpData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-org">Organization Type</Label>
                    <Select
                      value={signUpData.organization}
                      onValueChange={(value) => setSignUpData({ ...signUpData, organization: value, hospitalCode: "" })}
                      required
                    >
                      <SelectTrigger id="signup-org">
                        <SelectValue placeholder="Select organization type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Report Center Staff">Report Center Staff</SelectItem>
                        <SelectItem value="Medical Staff">Medical Staff</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {signUpData.organization === "Medical Staff" && (
                    <div className="space-y-2">
                      <Label htmlFor="hospital-code">Hospital Code</Label>
                      <Input
                        id="hospital-code"
                        type="text"
                        placeholder="Enter your hospital code"
                        value={signUpData.hospitalCode}
                        onChange={(e) => setSignUpData({ ...signUpData, hospitalCode: e.target.value.toUpperCase() })}
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        Enter the code provided by your hospital
                      </p>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      value={signUpData.password}
                      onChange={(e) => setSignUpData({ ...signUpData, password: e.target.value })}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Creating account..." : "Create Account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
