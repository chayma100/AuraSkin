import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import { Mail, Lock, CheckCircle2Icon } from "lucide-react";
import { useState, type FormEvent } from "react";
import type LoginData from "@/models/LoginData";
import toast from "react-hot-toast";
import { useNavigate } from "react-router";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import useAuth from "@/auth/store";
import OAuth2Buttons from "@/components/OAuth2Buttons";

const ADMIN_EMAIL = "onlyhawa2023@gmail.com";

function Login() {
  const [loginData, setLoginData] = useState<LoginData>({ email: "", password: "" });
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<any>(null);

  const navigate = useNavigate();
  const login    = useAuth((state) => state.login);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLoginData({ ...loginData, [e.target.name]: e.target.value });
  };

  const handleFormSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (loginData.email.trim() === "") { toast.error("Email required!"); return; }
    if (loginData.password.trim() === "") { toast.error("Password required!"); return; }

    setLoading(true);
    setError(null);

    // ── Step 1: attempt login ───────────────────────────────────────────────
    try {
      await login(loginData);
    } catch (err: any) {
      console.error("Login threw:", err);
      toast.error("Invalid credentials!");
      setError(err);
      setLoading(false);
      return; // stop — do NOT navigate
    }

    // ── Step 2: login succeeded — read store directly ───────────────────────
    const loggedInUser = useAuth.getState().user as any;

    const userEmail  = String(loggedInUser?.email ?? "").trim().toLowerCase();
    const adminEmail = ADMIN_EMAIL.trim().toLowerCase();

    console.log("=== LOGIN DEBUG ===");
    console.log("user object :", JSON.stringify(loggedInUser));
    console.log("userEmail   :", userEmail);
    console.log("adminEmail  :", adminEmail);
    console.log("isAdmin     :", userEmail === adminEmail);
    console.log("==================");

    setLoading(false);

    // ── Step 3: navigate based on role ──────────────────────────────────────
    if (userEmail === adminEmail) {
      toast.success("Welcome, Admin! 🛡️");
      navigate("/admin");
    } else {
      toast.success("Login success!");
      navigate("/profile");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10" style={{ backgroundColor: "#E1BEE7" }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="w-full max-w-lg"
      >
        <Card className="bg-pink-100/60 backdrop-blur-xl border border-pink-200 shadow-2xl rounded-3xl p-8 px-12">
          <CardContent>
            <motion.h1
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-4xl font-extrabold text-center text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400"
            >
              Welcome Back
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-center text-gray-800 mt-2"
            >
              Login to access your Cosmetic Products App
            </motion.p>

            {error && (
              <div className="mt-6">
                <Alert variant="destructive">
                  <CheckCircle2Icon />
                  <AlertTitle>
                    {error?.response ? error.response.data?.message : error?.message}
                  </AlertTitle>
                </Alert>
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="mt-8 space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-800">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-800" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    className="pl-10 text-gray-900 placeholder-gray-700 border-gray-800 focus:border-gray-900 focus:ring-gray-900"
                    name="email"
                    value={loginData.email}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-gray-800">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-800" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    className="pl-10 text-gray-900 placeholder-gray-700 border-gray-800 focus:border-gray-900 focus:ring-gray-900"
                    name="password"
                    value={loginData.password}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <Button disabled={loading} className="w-full cursor-pointer rounded-2xl text-lg">
                {loading ? <><Spinner /> Please wait...</> : "Login"}
              </Button>

              <div className="flex items-center gap-4 my-4">
                <div className="flex-1 h-[1px] bg-gray-800" />
                <span className="text-gray-800 text-sm">OR</span>
                <div className="flex-1 h-[1px] bg-gray-800" />
              </div>

              <OAuth2Buttons />
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

export default Login;
