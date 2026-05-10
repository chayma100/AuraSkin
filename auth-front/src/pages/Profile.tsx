import { motion, AnimatePresence } from "framer-motion";
import useAuth from "@/auth/store";
import { useState } from "react";
import "./CosmoScan.css";

const gradientText: React.CSSProperties = {
  background: "linear-gradient(90deg, #ec4899, #a855f7)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
};

function Profile() {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [activeTab, setActiveTab] = useState<"info" | "settings">("info");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const user = useAuth((state) => state.user);
  const logout = useAuth((state) => state.logout);

  const initials = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : user?.name
    ? user.name.slice(0, 2).toUpperCase()
    : "AU";

  const displayName = user?.username || user?.name || "User";

  const handleEdit = () => {
    setEditName(displayName);
    setIsEditing(true);
  };

  const handleSave = () => {
    setIsEditing(false);
  };

  return (
    <div className="cosmo-page">
      <div className="cosmo-container" style={{ maxWidth: 600 }}>

        {/* ── Header ── */}
        <header className="cosmo-header">
          <h1>My Profile</h1>
          <p>Your personal beauty space 🌸</p>
        </header>

        {/* ── Avatar Card ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          style={{
            background: "rgba(255,255,255,0.5)",
            borderRadius: "16px",
            padding: "28px 20px",
            marginBottom: "12px",
            border: "1px solid rgba(168,85,247,0.15)",
            backdropFilter: "blur(10px)",
            textAlign: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Decorative blobs */}
          <div style={{ position: "absolute", top: -20, right: -20, width: 90, height: 90, borderRadius: "50%", background: "radial-gradient(circle, rgba(236,72,153,0.1), transparent)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: -15, left: -15, width: 80, height: 80, borderRadius: "50%", background: "radial-gradient(circle, rgba(168,85,247,0.08), transparent)", pointerEvents: "none" }} />

          {/* Avatar */}
          <div style={{
            width: 90, height: 90, borderRadius: "50%",
            background: "linear-gradient(135deg, #ec4899, #a855f7, #6366f1)",
            padding: 3, margin: "0 auto 14px",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 6px 24px rgba(168,85,247,0.3)",
          }}>
            <div style={{
              width: "100%", height: "100%", borderRadius: "50%",
              background: "linear-gradient(135deg, #fce4ec, #f3e5f5)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "1.8rem", fontWeight: 800, color: "#7c3aed",
            }}>
              {initials}
            </div>
          </div>

          <h2 style={{ ...gradientText, fontWeight: 800, fontSize: "1.3rem", margin: "0 0 4px" }}>
            {displayName}
          </h2>
          <p style={{ fontSize: "0.8rem", color: "#9c6db0", margin: "0 0 20px" }}>
            {user?.email}
          </p>

          {/* Stats */}
          <div style={{ display: "flex", gap: 10 }}>
            {[
              { icon: "🧴", count: 0, label: "Scanned" },
              { icon: "⭐", count: 0, label: "Favorites" },
              { icon: "🔥", count: 0, label: "Day streak" },
            ].map((s) => (
              <div key={s.label} style={{
                flex: 1, background: "rgba(255,255,255,0.6)",
                borderRadius: "12px", padding: "12px 8px",
                border: "1px solid rgba(168,85,247,0.1)",
                textAlign: "center",
              }}>
                <div style={{ fontSize: "1.3rem", marginBottom: 3 }}>{s.icon}</div>
                <div style={{ fontWeight: 800, color: "#5d1c7e", fontSize: "1rem" }}>{s.count}</div>
                <div style={{ fontSize: "0.68rem", color: "#9c6db0", fontWeight: 600 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── Tabs ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          style={{
            display: "flex", gap: 8,
            background: "rgba(255,255,255,0.5)",
            borderRadius: "14px", padding: 5,
            border: "1px solid rgba(168,85,247,0.12)",
            marginBottom: 12,
            backdropFilter: "blur(10px)",
          }}
        >
          {(["info", "settings"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1, padding: "10px", border: "none", cursor: "pointer",
                borderRadius: "10px", fontWeight: 700, fontSize: "0.85rem",
                transition: "all 0.2s ease",
                background: activeTab === tab
                  ? "linear-gradient(90deg, #ec4899, #a855f7)"
                  : "transparent",
                color: activeTab === tab ? "white" : "#9c6db0",
                boxShadow: activeTab === tab ? "0 4px 12px rgba(168,85,247,0.25)" : "none",
              }}
            >
              {tab === "info" ? "👤 Information" : "⚙️ Settings"}
            </button>
          ))}
        </motion.div>

        {/* ── Tab Content ── */}
        <AnimatePresence mode="wait">

          {/* INFO TAB */}
          {activeTab === "info" && (
            <motion.div
              key="info"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              style={{
                background: "rgba(255,255,255,0.5)",
                borderRadius: "16px", padding: "20px",
                border: "1px solid rgba(168,85,247,0.15)",
                backdropFilter: "blur(10px)",
                marginBottom: 12,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                <p style={{ margin: 0, fontWeight: 800, color: "#7e3fa8", fontSize: "0.85rem" }}>
                  Personal Information
                </p>
                {!isEditing && (
                  <button
                    onClick={handleEdit}
                    style={{
                      background: "linear-gradient(90deg, #ec4899, #a855f7)",
                      border: "none", borderRadius: "20px",
                      padding: "5px 14px", cursor: "pointer",
                      color: "white", fontWeight: 700, fontSize: "0.75rem",
                    }}
                  >
                    ✏️ Edit
                  </button>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {[
                  { label: "Full Name", value: isEditing ? editName : displayName, readOnly: !isEditing, onChange: (e: React.ChangeEvent<HTMLInputElement>) => setEditName(e.target.value) },
                  { label: "Email Address", value: user?.email || "", readOnly: true },
                  { label: "Member Since", value: "2026", readOnly: true },
                ].map((field) => (
                  <div key={field.label}>
                    <label style={{
                      fontSize: "0.7rem", fontWeight: 700, color: "#b083d0",
                      display: "block", marginBottom: 5, textTransform: "uppercase" as const,
                      letterSpacing: "0.05em",
                    }}>
                      {field.label}
                    </label>
                    <input
                      value={field.value}
                      readOnly={field.readOnly}
                      onChange={field.onChange}
                      style={{
                        width: "100%", padding: "11px 14px", borderRadius: "10px",
                        border: "1px solid rgba(168,85,247,0.2)",
                        background: field.readOnly ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.7)",
                        color: field.readOnly ? "#9c6db0" : "#3b1f5e",
                        fontSize: "0.88rem", outline: "none",
                        boxSizing: "border-box" as const,
                        cursor: field.readOnly ? "default" : "text",
                      }}
                    />
                  </div>
                ))}
              </div>

              <AnimatePresence>
                {isEditing && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    style={{ display: "flex", gap: 10, marginTop: 18 }}
                  >
                    <button
                      onClick={() => setIsEditing(false)}
                      style={{
                        flex: 1, padding: "11px", borderRadius: "10px", border: "1px solid rgba(168,85,247,0.2)",
                        background: "rgba(255,255,255,0.6)", color: "#9c6db0",
                        fontWeight: 700, cursor: "pointer", fontSize: "0.88rem",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      style={{
                        flex: 1, padding: "11px", borderRadius: "10px", border: "none",
                        background: "linear-gradient(90deg, #ec4899, #a855f7)",
                        color: "white", fontWeight: 700, cursor: "pointer", fontSize: "0.88rem",
                        boxShadow: "0 4px 14px rgba(168,85,247,0.3)",
                      }}
                    >
                      💾 Save
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* SETTINGS TAB */}
          {activeTab === "settings" && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              style={{
                background: "rgba(255,255,255,0.5)",
                borderRadius: "16px", padding: "20px",
                border: "1px solid rgba(168,85,247,0.15)",
                backdropFilter: "blur(10px)",
                marginBottom: 12,
              }}
            >
              <p style={{ margin: "0 0 16px", fontWeight: 800, color: "#7e3fa8", fontSize: "0.85rem" }}>
                Account Settings
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

                {/* Logout */}
                <button
                  onClick={() => logout()}
                  style={{
                    width: "100%", padding: "13px 16px", borderRadius: "12px",
                    border: "1px solid rgba(168,85,247,0.2)",
                    background: "linear-gradient(90deg, rgba(236,72,153,0.08), rgba(168,85,247,0.08))",
                    color: "#5d1c7e", fontWeight: 700, fontSize: "0.88rem",
                    cursor: "pointer", textAlign: "left" as const,
                    display: "flex", alignItems: "center", gap: 10,
                  }}
                >
                  <span>🚪</span> Sign Out
                </button>

                {[
                  { icon: "🔑", label: "Change Password" },
                  { icon: "🔔", label: "Notifications" },
                  { icon: "🌍", label: "Language & Region" },
                ].map((item) => (
                  <button
                    key={item.label}
                    style={{
                      width: "100%", padding: "13px 16px", borderRadius: "12px",
                      border: "1px solid rgba(168,85,247,0.15)",
                      background: "rgba(255,255,255,0.6)",
                      color: "#5d1c7e", fontWeight: 700, fontSize: "0.88rem",
                      cursor: "pointer", textAlign: "left" as const,
                      display: "flex", alignItems: "center", gap: 10,
                    }}
                  >
                    <span>{item.icon}</span> {item.label}
                  </button>
                ))}

                <div style={{ height: 1, background: "rgba(168,85,247,0.1)", margin: "4px 0" }} />

                <AnimatePresence>
                  {!showDeleteConfirm ? (
                    <motion.button
                      onClick={() => setShowDeleteConfirm(true)}
                      style={{
                        width: "100%", padding: "13px 16px", borderRadius: "12px",
                        border: "1px solid rgba(220,38,38,0.2)",
                        background: "rgba(254,242,242,0.7)",
                        color: "#dc2626", fontWeight: 700, fontSize: "0.88rem",
                        cursor: "pointer", textAlign: "left" as const,
                        display: "flex", alignItems: "center", gap: 10,
                      }}
                    >
                      <span>🗑️</span> Delete Account
                    </motion.button>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      style={{
                        background: "rgba(254,242,242,0.8)", borderRadius: 12,
                        padding: 16, border: "1px solid rgba(220,38,38,0.2)",
                      }}
                    >
                      <p style={{ margin: "0 0 12px", color: "#dc2626", fontWeight: 700, fontSize: "0.85rem" }}>
                        ⚠️ Are you sure? This action is irreversible.
                      </p>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={() => setShowDeleteConfirm(false)}
                          style={{ flex: 1, padding: "10px", borderRadius: "10px", border: "1px solid rgba(168,85,247,0.2)", background: "rgba(255,255,255,0.8)", color: "#5d1c7e", fontWeight: 700, cursor: "pointer", fontSize: "0.85rem" }}
                        >
                          Cancel
                        </button>
                        <button
                          style={{ flex: 1, padding: "10px", borderRadius: "10px", border: "none", background: "#dc2626", color: "white", fontWeight: 700, cursor: "pointer", fontSize: "0.85rem" }}
                        >
                          Confirm Delete
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Badges ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          style={{
            background: "rgba(255,255,255,0.5)",
            borderRadius: "16px", padding: "18px 16px",
            border: "1px solid rgba(168,85,247,0.15)",
            backdropFilter: "blur(10px)",
          }}
        >
          <p style={{ margin: "0 0 14px", fontWeight: 800, color: "#7e3fa8", fontSize: "0.85rem" }}>
            🏅 My Badges
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {[
              { emoji: "🌸", label: "Member", unlocked: true },
              { emoji: "🔥", label: "7-day streak", unlocked: false },
              { emoji: "💎", label: "50 scans", unlocked: false },
              { emoji: "🌟", label: "Expert", unlocked: false },
            ].map((badge) => (
              <div
                key={badge.label}
                style={{
                  flex: "1 1 70px",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
                  padding: "12px 8px", borderRadius: 12,
                  background: badge.unlocked
                    ? "linear-gradient(135deg, rgba(236,72,153,0.08), rgba(168,85,247,0.08))"
                    : "rgba(0,0,0,0.03)",
                  border: badge.unlocked
                    ? "1px solid rgba(168,85,247,0.2)"
                    : "1px solid rgba(0,0,0,0.05)",
                  opacity: badge.unlocked ? 1 : 0.4,
                }}
              >
                <span style={{ fontSize: "1.6rem", filter: badge.unlocked ? "none" : "grayscale(1)" }}>
                  {badge.emoji}
                </span>
                <span style={{ fontSize: "0.65rem", fontWeight: 700, color: badge.unlocked ? "#5d1c7e" : "#aaa", textAlign: "center" as const }}>
                  {badge.label}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

      </div>
    </div>
  );
}

export default Profile;
