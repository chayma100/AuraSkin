import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { BrowserRouter, Routes, Route } from "react-router";
import Login from "./pages/Login.tsx";
import About from "./pages/About.tsx";
import Services from "./pages/Services.tsx";
import Signup from "./pages/Signup.tsx";
import RootLayout from "./pages/RootLayout.tsx";
import Userlayout from "./pages/users/Userlayout.tsx";
import Userhome from "./pages/users/Userhome.tsx";
import Userprofile from "./pages/users/Userprofile.tsx";
import OAuthSuccess from "./pages/OAuthSuccess.tsx";
import AboutUs from "./pages/AboutUs.tsx";
import Products from "./pages/Products.tsx";
import Discussions from "./pages/Discussions.tsx";
import CosmoScan from "./pages/CosmoScan.tsx"; // ← AJOUTE CETTE LIGNE
import ScanBarcode from "./pages/ScanBarcode.tsx";
import Profile from "./pages/Profile.tsx";
import AdminDashboard from "./pages/AdminDashboard.tsx";
import ProductDetail from "./pages/ProductDetail";
import Trends from "./pages/Trends";
import History from "./pages/History.tsx";
import Favorites from "./pages/Favorites.tsx";
import Routine from "./pages/Routine.tsx";




createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<RootLayout />}>
        <Route index element={<App />} /> 
        <Route path="/history" element={<History />} />
        <Route path="/favorites" element={<Favorites />} />
        <Route path="/Routine" element={<Routine />} />
        
          {/* Route SANS RootLayout — CosmoScan standalone */}
        <Route path="/scan" element={<CosmoScan />} />
        <Route path="/barcode" element={<ScanBarcode />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/about" element={<AboutUs />} />
        <Route path="/services" element={<Services />} />
        <Route path="/about" element={<About />} />
        <Route path="/products" element={<Products />} />
        <Route path="/product/:id" element={<ProductDetail />} />
        <Route path="/trends" element={<Trends />} />
        <Route path="/discussions" element={<Discussions />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/dashboard" element={<Userlayout />}>
          <Route index element={<Userhome />} />
          <Route path="profile" element={<Userprofile />} />
        </Route>

        
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="oauth/success" element={<OAuthSuccess />} />
        <Route path="oauth/failure" element={<OAuthSuccess />} />
      </Route>
    </Routes>
  </BrowserRouter>
);