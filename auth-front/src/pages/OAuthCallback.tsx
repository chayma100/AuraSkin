import { useEffect } from "react";
import { useNavigate } from "react-router";
import useAuth from "@/auth/store";

export default function OAuthCallback() {
  const navigate = useNavigate();
  const { changeLocalLoginData } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("userId");
    const username = params.get("username");
    const email    = params.get("email");

    if (id && username && email) {
      changeLocalLoginData("fake-jwt", { id: Number(id), username, email }, true);
      navigate("/");
    } else {
      navigate("/login");
    }
  }, []);

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
      <p style={{ color: "#a855f7", fontWeight: 700 }}>🌸 Connexion en cours...</p>
    </div>
  );
}