import React from "react";
import { Button } from "./ui/button";
import { NavLink } from "react-router";
import useAuth from "@/auth/store";

const ADMIN_EMAIL = "onlyhawa2023@gmail.com";

function Navbar() {
  const checkLogin = useAuth((state) => state.checkLogin);
  const user = useAuth((state) => state.user);
  const logout = useAuth((state) => state.logout);

  const isAdmin = user?.email?.trim().toLowerCase() === ADMIN_EMAIL.trim().toLowerCase();

  return (
    <nav
      className="relative flex md:flex-row flex-col gap-4 md:gap-0 justify-around items-center py-6 md:py-4 h-20 bg-cover bg-center border-b border-gray-700"
      style={{ backgroundImage: "url('/bg.png')" }}
    >
      <div className="absolute inset-0 bg-black/30 pointer-events-none"></div>

      {/* brand */}
      <div className="relative z-10 font-semibold items-center flex gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-gradient-to-r from-pink-500 to-purple-500 text-white font-bold shadow-lg">
            A
          </div>
          <span className="text-2xl font-extrabold bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent">
            AuraSkin
          </span>
        </div>
      </div>

      <div className="relative z-10 flex gap-4 items-center">

        <NavLink to={"/"}>
          <Button size="sm" variant="outline" className="cursor-pointer bg-transparent border-white/40 text-black border-black/40 hover:bg-black/10">
            Home
          </Button>
        </NavLink>

        <NavLink to="/about">
          <Button size="sm" variant="outline" className="cursor-pointer bg-transparent border-white/40 text-black border-black/40 hover:bg-black/10">
            AboutUS
          </Button>
        </NavLink>

        <NavLink to={"/favorites"}>
          <Button size="sm" variant="outline" className="cursor-pointer bg-transparent border-white/40 text-black border-black/40 hover:bg-black/10">
            Favorites
          </Button>
        </NavLink>

        <NavLink to={"/discussions"}>
          <Button size="sm" variant="outline" className="cursor-pointer bg-transparent border-white/40 text-black border-black/40 hover:bg-black/10">
            Discussions
          </Button>
        </NavLink>

        <NavLink to={"/routine"}>
          <Button size="sm" variant="outline" className="cursor-pointer bg-transparent border-white/40 text-black border-black/40 hover:bg-black/10">
            Routine
          </Button>
        </NavLink>

        <NavLink to={"/Trends"}>
          <Button size="sm" variant="outline" className="cursor-pointer bg-transparent border-white/40 text-black border-black/40 hover:bg-black/10">
            Trends
          </Button>
        </NavLink>

        <NavLink to={"/history"}>
          <Button size="sm" variant="outline" className="cursor-pointer bg-transparent border-white/40 text-black border-black/40 hover:bg-black/10">
            History
          </Button>
        </NavLink>

        {checkLogin() ? (
          <>
            {/* Avatar → Profile */}
            <NavLink to={"/profile"}>
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm shadow-md cursor-pointer hover:opacity-90 transition">
                {(user?.name || user?.email || "U")[0].toUpperCase()}
              </div>
            </NavLink>

            {/* Admin button — only visible for the admin email */}
            {isAdmin && (
              <NavLink to="/admin">
                <Button
                  size="sm"
                  className="cursor-pointer bg-gradient-to-r from-pink-500 to-purple-500 text-white border-none text-xs font-bold px-4 hover:scale-105 hover:shadow-lg transition-all duration-200"
                >
                  🛡️ Admin
                </Button>
              </NavLink>
            )}

            {/* Logout */}
            <Button
              size="sm"
              variant="outline"
              className="cursor-pointer bg-transparent border-black/40 text-black hover:bg-black/10"
              onClick={() => logout()}
            >
              Logout
            </Button>
          </>
        ) : (
          <>
            <NavLink to={"/login"}>
              <Button size={"sm"} className="cursor-pointer" variant={"outline"}>
                Login
              </Button>
            </NavLink>
            <NavLink to={"/signup"}>
              <Button size={"sm"} className="cursor-pointer" variant={"outline"}>
                Signup
              </Button>
            </NavLink>
          </>
        )}

      </div>
    </nav>
  );
}

export default Navbar;
