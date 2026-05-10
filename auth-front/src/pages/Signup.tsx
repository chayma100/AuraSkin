import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, User, Phone, ShieldCheck } from "lucide-react";
import React, { useState } from "react";
import toast from "react-hot-toast";
import type RegisterData from "@/models/RegisterData";
import { registerUser } from "@/services/AuthService";
import { useNavigate } from "react-router";
import OAuth2Buttons from "@/components/OAuth2Buttons";

const API = "http://localhost:8083";

type Step = "form" | "otp";

function Signup() {
  const [step, setStep] = useState<Step>("form");
  const [data, setData] = useState<RegisterData>({
    name: "",
    email: "",
    password: "",
    phone: "",
  });
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const navigate = useNavigate();

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setData((prev) => ({
      ...prev,
      [event.target.name]: event.target.value,
    }));
  };

  // ÉTAPE 1 — Envoie le code OTP par SMS
  const handleSendOTP = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!data.name.trim() || !data.email.trim() || !data.password.trim() || !data.phone.trim()) {
      toast.error("All fields are required!");
      return;
    }

    if (!data.phone.startsWith("+")) {
      toast.error("Phone number must start with country code (e.g. +216...)");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: data.phone }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to send OTP");

      toast.success("Code sent to your phone! 📱");
      setStep("otp");
    } catch (error: any) {
      toast.error(error.message || "Error sending OTP");
    } finally {
      setLoading(false);
    }
  };

  // Renvoie le code OTP
  const handleResendOTP = async () => {
    setResendLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: data.phone }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      toast.success("New code sent! 📱");
    } catch (error: any) {
      toast.error(error.message || "Error resending OTP");
    } finally {
      setResendLoading(false);
    }
  };

  // ÉTAPE 2 — Vérifie le code OTP et crée le compte
  const handleVerifyAndRegister = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!otpCode.trim() || otpCode.length !== 6) {
      toast.error("Please enter the 6-digit code");
      return;
    }

    setLoading(true);
    try {
      // 1. Vérifie le code OTP
      const verifyRes = await fetch(`${API}/api/v1/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: data.phone, code: otpCode }),
      });
      const verifyResult = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(verifyResult.error || "Invalid code");

      // 2. Crée le compte
      await registerUser(data);
      toast.success("Account created successfully! 🎉");
      setData({ name: "", email: "", password: "", phone: "" });
      setOtpCode("");
      setTimeout(() => navigate("/login"), 1500);

    } catch (error: any) {
      toast.error(error.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-10"
      style={{ backgroundColor: "#E1BEE7" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="w-full max-w-lg"
      >
        <Card className="bg-pink-100/60 backdrop-blur-xl border border-pink-200 shadow-2xl rounded-3xl p-8 px-12">
          <CardContent>

            <AnimatePresence mode="wait">

              {/* ── ÉTAPE 1 : Formulaire ── */}
              {step === "form" && (
                <motion.div
                  key="form"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                >
                  <h1 className="text-4xl font-extrabold text-center text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400">
                    Create Your Account
                  </h1>
                  <p className="text-center text-gray-800 mt-2">
                    Join the perfect world of safe Cosmetic Products
                  </p>

                  <form onSubmit={handleSendOTP} className="mt-8 space-y-5">

                    {/* Name */}
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-gray-800">Name</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-800" />
                        <Input
                          id="name" name="name" type="text"
                          placeholder="Chadha Ben Said"
                          className="pl-10 text-gray-900 placeholder-gray-700 border-gray-800"
                          value={data.name}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                    </div>

                    {/* Email */}
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-gray-800">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-800" />
                        <Input
                          id="email" name="email" type="email"
                          placeholder="chadha@example.com"
                          className="pl-10 text-gray-900 placeholder-gray-700 border-gray-800"
                          value={data.email}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                    </div>

                    {/* Password */}
                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-gray-800">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-800" />
                        <Input
                          id="password" name="password" type="password"
                          placeholder="••••••••"
                          className="pl-10 text-gray-900 placeholder-gray-700 border-gray-800"
                          value={data.password}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                    </div>

                    {/* Phone */}
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-gray-800">Phone Number</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-800" />
                        <Input
                          id="phone" name="phone" type="tel"
                          placeholder="+216 XX XXX XXX"
                          className="pl-10 text-gray-900 placeholder-gray-700 border-gray-800"
                          value={data.phone}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                      <p className="text-xs text-gray-500 ml-1">
                        Include country code (e.g. +216 for Tunisia)
                      </p>
                    </div>

                    <Button
                      type="submit"
                      disabled={loading}
                      className="w-full rounded-2xl text-lg bg-gradient-to-r from-pink-500 to-purple-500 text-white hover:opacity-90 transition-opacity h-12"
                    >
                      {loading ? "Sending code..." : "Send Verification Code 📱"}
                    </Button>

                    <div className="flex items-center gap-4 my-2">
                      <div className="flex-1 h-[1px] bg-gray-800"></div>
                      <span className="text-gray-800 text-sm">OR</span>
                      <div className="flex-1 h-[1px] bg-gray-800"></div>
                    </div>

                    <OAuth2Buttons />
                  </form>
                </motion.div>
              )}

              {/* ── ÉTAPE 2 : Vérification OTP ── */}
              {step === "otp" && (
                <motion.div
                  key="otp"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="text-center mb-6">
                    <div className="text-5xl mb-4">📱</div>
                    <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400">
                      Check your phone
                    </h1>
                    <p className="text-gray-700 mt-2 text-sm">
                      We sent a 6-digit code to
                    </p>
                    <p className="text-purple-600 font-bold">{data.phone}</p>
                  </div>

                  <form onSubmit={handleVerifyAndRegister} className="space-y-6">

                    {/* Champ OTP */}
                    <div className="space-y-2">
                      <Label className="text-gray-800">Verification Code</Label>
                      <div className="relative">
                        <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-800" />
                        <Input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          placeholder="• • • • • •"
                          className="pl-10 text-gray-900 text-center text-2xl tracking-[0.5em] border-gray-800 font-bold"
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                          required
                        />
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={loading || otpCode.length !== 6}
                      className="w-full rounded-2xl text-lg bg-gradient-to-r from-pink-500 to-purple-500 text-white hover:opacity-90 transition-opacity h-12"
                    >
                      {loading ? "Verifying..." : "Verify & Create Account ✨"}
                    </Button>

                    {/* Renvoyer le code */}
                    <div className="text-center space-y-2">
                      <p className="text-gray-600 text-sm">Didn't receive the code?</p>
                      <button
                        type="button"
                        onClick={handleResendOTP}
                        disabled={resendLoading}
                        className="text-purple-600 font-semibold text-sm hover:text-pink-500 transition underline"
                      >
                        {resendLoading ? "Sending..." : "Resend code"}
                      </button>
                    </div>

                    {/* Retour */}
                    <button
                      type="button"
                      onClick={() => { setStep("form"); setOtpCode(""); }}
                      className="w-full text-gray-500 text-sm hover:text-gray-700 transition"
                    >
                      ← Change phone number
                    </button>

                  </form>
                </motion.div>
              )}

            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

export default Signup;
