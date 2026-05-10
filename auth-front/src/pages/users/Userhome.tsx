import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { User, Mail, Calendar, ShieldCheck, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import useAuth from "@/auth/store";
import { useNavigate } from "react-router";

function Userhome() {
  const user = useAuth((state) => state.user);
  const logout = useAuth((state) => state.logout);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
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
        {/* Avatar */}
        <div className="flex justify-center mb-6">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5 }}
            className="w-24 h-24 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center shadow-xl"
          >
            <User className="w-12 h-12 text-white" />
          </motion.div>
        </div>

        {/* Card principale */}
        <Card className="bg-pink-100/60 backdrop-blur-xl border border-pink-200 shadow-2xl rounded-3xl p-8 px-12">
          <CardContent>
            {/* Titre */}
            <motion.h1
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-3xl font-extrabold text-center text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400 mb-2"
            >
              My Profile
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-center text-gray-500 text-sm mb-8"
            >
              Welcome to your personal space
            </motion.p>

            {/* Infos utilisateur */}
            <div className="space-y-4">
              {/* Username */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                className="flex items-center gap-4 bg-white/50 rounded-2xl px-5 py-4 border border-pink-200"
              >
                <div className="p-2 bg-pink-100 rounded-xl">
                  <User className="w-5 h-5 text-pink-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Username</p>
                  <p className="text-gray-800 font-semibold">
                    {user?.name || user?.email?.split("@")[0] || "—"}
                  </p>
                </div>
              </motion.div>

              {/* Email */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
                className="flex items-center gap-4 bg-white/50 rounded-2xl px-5 py-4 border border-pink-200"
              >
                <div className="p-2 bg-purple-100 rounded-xl">
                  <Mail className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Email</p>
                  <p className="text-gray-800 font-semibold">
                    {user?.email || "—"}
                  </p>
                </div>
              </motion.div>

              {/* Statut */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 }}
                className="flex items-center gap-4 bg-white/50 rounded-2xl px-5 py-4 border border-pink-200"
              >
                <div className="p-2 bg-green-100 rounded-xl">
                  <ShieldCheck className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Account Status</p>
                  <p className="text-green-600 font-semibold">
                    ✓ Active account
                  </p>
                </div>
              </motion.div>

              {/* Membre depuis */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 }}
                className="flex items-center gap-4 bg-white/50 rounded-2xl px-5 py-4 border border-pink-200"
              >
                <div className="p-2 bg-indigo-100 rounded-xl">
                  <Calendar className="w-5 h-5 text-indigo-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Member since</p>
                  <p className="text-gray-800 font-semibold">
                    {new Date().toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
              </motion.div>
            </div>

            {/* Bouton déconnexion */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="mt-8"
            >
              <Button
                onClick={handleLogout}
                className="w-full rounded-2xl text-lg bg-gradient-to-r from-pink-500 to-purple-500 text-white flex items-center justify-center gap-2"
              >
                <LogOut className="w-5 h-5" />
                Log Out
              </Button>
            </motion.div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

export default Userhome;