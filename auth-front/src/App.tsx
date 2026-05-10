import { Routes, Route } from "react-router-dom";
import bg from "./assets/background.jpg";
import Home from "./components/home/Home";
import CosmoScan from "./pages/CosmoScan";
import SkinRecommend from "./pages/SkinRecommend";

// ─── App principal ────────────────────────────────────────────────────────
function AppContent() {
  return (
    <div className="relative min-h-screen">

      {/* Background */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${bg})` }}
      />

      {/* Overlay */}
      <div className="absolute inset-0 bg-pink-900/30" />

      {/* Contenu */}
      <div className="relative z-10">
        <Routes>
          <Route path="/"     element={<Home />}          />
          <Route path="/scan" element={<CosmoScan />}     />
          <Route path="/skin" element={<SkinRecommend />} />
        </Routes>
      </div>

    </div>
  );
}

export default function App() {
  return <AppContent />;
}
