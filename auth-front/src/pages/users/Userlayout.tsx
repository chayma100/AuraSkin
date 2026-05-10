import useAuth from "@/auth/store";
import { Navigate, Outlet, NavLink, useNavigate } from "react-router";
import { Home, User, ScanLine, LogOut } from "lucide-react";
import useAuth2 from "@/auth/store";

function Userlayout() {
  const checkLogin = useAuth((state) => state.checkLogin);
  const user = useAuth2((state) => state.user);
  const logout = useAuth2((state) => state.logout);
  const navigate = useNavigate();

  if (!checkLogin()) return <Navigate to={"/login"} />;

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#E1BEE7" }}>
      {/* Page content */}
      <div className="flex-1 pb-24">
        <Outlet />
      </div>

      {/* Bottom navigation bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50">
        <div className="mx-4 mb-4 bg-white/70 backdrop-blur-xl border border-pink-200 rounded-3xl shadow-2xl px-6 py-3 flex items-center justify-around">

          {/* Home */}
          <NavLink to={"/"} className={({ isActive }) =>
            `flex flex-col items-center gap-1 transition ${isActive ? "text-pink-500" : "text-gray-400 hover:text-pink-400"}`
          }>
            <Home className="w-6 h-6" />
            <span className="text-xs font-medium">Home</span>
          </NavLink>

          {/* Scan */}
          <NavLink to={"/scan"} className={({ isActive }) =>
            `flex flex-col items-center gap-1 transition ${isActive ? "text-pink-500" : "text-gray-400 hover:text-pink-400"}`
          }>
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center shadow-lg -mt-6">
              <ScanLine className="w-7 h-7 text-white" />
            </div>
            <span className="text-xs font-medium mt-1">Scan</span>
          </NavLink>

          {/* Profile */}
          <NavLink to={"/dashboard"} className={({ isActive }) =>
            `flex flex-col items-center gap-1 transition ${isActive ? "text-pink-500" : "text-gray-400 hover:text-pink-400"}`
          }>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm shadow">
              {(user?.name || user?.email || "U")[0].toUpperCase()}
            </div>
            <span className="text-xs font-medium">Profile</span>
          </NavLink>

          {/* Logout */}
          <button
            onClick={() => { logout(); navigate("/"); }}
            className="flex flex-col items-center gap-1 text-gray-400 hover:text-red-400 transition"
          >
            <LogOut className="w-6 h-6" />
            <span className="text-xs font-medium">Logout</span>
          </button>

        </div>
      </div>
    </div>
  );
}

export default Userlayout;