import React, { useState, useEffect } from "react";
import type { Step, ShelfProduct, SkinLog } from "../lib/routine";
import {
  morningDefault, nightDefault, toggleStep, saveSteps, loadSteps, getProgress,
  getUserId, loadStepsFromAPI, addStepToAPI, deleteStepFromAPI, toggleStepInAPI,
  saveSkinLog, getSkinLogs, loadShelfFromAPI, checkProductStatus, skinAdvice,
  skinOptions, getStreak, updateStreak,
} from "../lib/routine";
import "./CosmoScan.css";

type Texture = "light" | "medium" | "heavy";

const Routine: React.FC = () => {
  const userId = getUserId();
  const isLoggedIn = !!userId;

  const [morningSteps, setMorningSteps] = useState<Step[]>([]);
  const [nightSteps, setNightSteps] = useState<Step[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newStepName, setNewStepName] = useState("");
  const [newStepTime, setNewStepTime] = useState<"morning" | "night">("morning");
  const [popBadgeId, setPopBadgeId] = useState<number | null>(null);
  const [waitingStepId, setWaitingStepId] = useState<number | null>(null);
  const [skinStatus, setSkinStatus] = useState<string | null>(null);
  const [shelf, setShelf] = useState<ShelfProduct[]>([]);
  const [skinLogs, setSkinLogs] = useState<SkinLog[]>([]);
  const [streak, setStreak] = useState(0);
  const [showChart, setShowChart] = useState(false);

  // ── Initial loading ──
  useEffect(() => {
    async function init() {
      setStreak(getStreak());
      if (isLoggedIn) {
        const [morning, night, shelfData, logs] = await Promise.all([
          loadStepsFromAPI("morning"),
          loadStepsFromAPI("night"),
          loadShelfFromAPI(),
          getSkinLogs(),
        ]);
        setMorningSteps(morning.length > 0 ? morning : morningDefault);
        setNightSteps(night.length > 0 ? night : nightDefault);
        setShelf(shelfData);
        setSkinLogs(logs);
      } else {
        setMorningSteps(loadSteps("morning_routine_guest", morningDefault));
        setNightSteps(loadSteps("night_routine_guest", nightDefault));
      }
      setLoading(false);
    }
    init();
  }, [isLoggedIn]);

  // Auto-save for guest users
  useEffect(() => {
    if (!isLoggedIn && !loading) {
      saveSteps("morning_routine_guest", morningSteps);
    }
  }, [morningSteps, isLoggedIn, loading]);

  useEffect(() => {
    if (!isLoggedIn && !loading) {
      saveSteps("night_routine_guest", nightSteps);
    }
  }, [nightSteps, isLoggedIn, loading]);

  useEffect(() => {
    if (popBadgeId) {
      const timer = setTimeout(() => setPopBadgeId(null), 300);
      return () => clearTimeout(timer);
    }
  }, [popBadgeId]);

  // ── Skin Status handler ──
  const handleSkinStatus = async (val: string) => {
    setSkinStatus(val);
    if (isLoggedIn) {
      const allDone = [...morningSteps, ...nightSteps].every((s) => s.done);
      await saveSkinLog(val, allDone);
      const logs = await getSkinLogs();
      setSkinLogs(logs);
    }
  };

  // ── Check if routine complete → update streak ──
  const checkAndUpdateStreak = () => {
    const allDone = [...morningSteps, ...nightSteps].every((s) => s.done);
    if (allDone) {
      const newStreak = updateStreak();
      setStreak(newStreak);
    }
  };

  const sortByTexture = (steps: Step[]): Step[] => {
    const order: Record<Texture, number> = { light: 1, medium: 2, heavy: 3 };
    return [...steps].sort((a, b) => (order[a.texture as Texture] || 2) - (order[b.texture as Texture] || 2));
  };

  const deleteStep = async (id: number, type: "morning" | "night") => {
    if (isLoggedIn) await deleteStepFromAPI(id);
    if (type === "morning") setMorningSteps((s) => s.filter((step) => step.id !== id));
    else setNightSteps((s) => s.filter((step) => step.id !== id));
  };

  // ── Add product ──
  const handleAddProduct = async () => {
    // 1. Basic validation: do nothing if name is empty
    if (!newStepName.trim()) {
      alert("Please enter a product name");
      return;
    }

    const stepData = {
      name: newStepName.trim(),
      done: false,
      texture: "medium" as Texture,
      waitTime: newStepName.toLowerCase().includes("vitamine c") ? 30 : undefined,
    };

    if (isLoggedIn) {
      // --- LOGGED IN MODE ---
      const savedStep = await addStepToAPI(stepData, newStepTime);
      if (savedStep) {
        if (newStepTime === "morning") {
          setMorningSteps((s) => sortByTexture([...s, savedStep]));
        } else {
          setNightSteps((s) => sortByTexture([...s, savedStep]));
        }
        setPopBadgeId(savedStep.id);
      }
    } else {
      // --- GUEST MODE ---
      const newStep: Step = {
        id: Date.now(), // Unique temporary ID
        ...stepData,
        position: 0,
      };

      if (newStepTime === "morning") {
        const updated = sortByTexture([...morningSteps, newStep]);
        setMorningSteps(updated);
        saveSteps("morning_routine_guest", updated);
      } else {
        const updated = sortByTexture([...nightSteps, newStep]);
        setNightSteps(updated);
        saveSteps("night_routine_guest", updated);
      }
      setPopBadgeId(newStep.id);
    }

    // 3. Reset form and close modal
    setNewStepName("");
    setShowForm(false);
  };

  const handleStepDone = async (
    step: Step,
    steps: Step[],
    setSteps: React.Dispatch<React.SetStateAction<Step[]>>
  ) => {
    setSteps(toggleStep(steps, step.id));
    if (isLoggedIn) await toggleStepInAPI(step.id, !step.done);
    if (!step.done && step.waitTime) {
      setWaitingStepId(step.id);
      setTimeout(() => setWaitingStepId(null), step.waitTime * 1000);
    }
    setTimeout(() => checkAndUpdateStreak(), 100);
  };

  // ── Monthly chart ──
  const renderChart = () => {
    const last30 = Array.from({ length: 30 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (29 - i));
      return d.toISOString().split("T")[0];
    });

    const emojiMap: Record<string, string> = {
      dry: "🌵", irritated: "🔴", radiant: "✨", oily: "💧"
    };

    const colorMap: Record<string, string> = {
      dry: "#f59e0b", irritated: "#ef4444", radiant: "#10b981", oily: "#3b82f6"
    };

    return (
      <div style={{
        background: "rgba(255,255,255,0.6)", borderRadius: "20px",
        padding: "20px", marginBottom: "25px",
        border: "1px solid rgba(168,85,247,0.15)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, color: "#5d1c7e", fontWeight: 800, fontSize: "1rem" }}>
            📊 Your skin evolution (last 30 days)
          </h3>
          <button
            onClick={() => setShowChart(false)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#9c6db0", fontSize: "1.2rem" }}
          >
            ✕
          </button>
        </div>

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: 16 }}>
          {skinOptions.map(opt => (
            <span key={opt.value} style={{ fontSize: "0.75rem", color: "#6b7280" }}>
              {opt.emoji} {opt.label}
            </span>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: "6px" }}>
          {last30.map((date) => {
            const log = skinLogs.find((l) => l.date?.startsWith(date));
            const color = log ? colorMap[log.status] : "rgba(168,85,247,0.08)";
            const emoji = log ? emojiMap[log.status] : "";
            return (
              <div
                key={date}
                title={`${date}${log ? ` — ${log.status}${log.routine_completed ? " ✓" : ""}` : " — no data"}`}
                style={{
                  width: "100%", aspectRatio: "1",
                  background: color,
                  borderRadius: "8px",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.9rem",
                  border: log?.routine_completed ? "2px solid #a855f7" : "1px solid rgba(168,85,247,0.1)",
                  cursor: "default",
                }}
              >
                {emoji}
              </div>
            );
          })}
        </div>

        <p style={{ fontSize: "0.72rem", color: "#9c6db0", marginTop: 12, textAlign: "center" }}>
          Purple border = routine completed that day
        </p>

        {skinLogs.length > 0 && (
          <div style={{ display: "flex", gap: "10px", marginTop: 16, flexWrap: "wrap" }}>
            {skinOptions.map(opt => {
              const count = skinLogs.filter(l => l.status === opt.value).length;
              if (count === 0) return null;
              return (
                <div key={opt.value} style={{
                  background: "rgba(255,255,255,0.7)", borderRadius: "12px",
                  padding: "8px 14px", textAlign: "center", flex: 1, minWidth: "70px",
                }}>
                  <div style={{ fontSize: "1.2rem" }}>{opt.emoji}</div>
                  <div style={{ fontSize: "0.7rem", color: "#5d1c7e", fontWeight: 700 }}>{count}x</div>
                  <div style={{ fontSize: "0.65rem", color: "#9c6db0" }}>{opt.label}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const gradientTextStyle: React.CSSProperties = {
    background: "linear-gradient(90deg, #ec4899, #a855f7)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    fontWeight: 800,
  };

  const renderSteps = (
    steps: Step[],
    setSteps: React.Dispatch<React.SetStateAction<Step[]>>,
    type: "morning" | "night"
  ) =>
    steps.map((step, index) => (
      <div key={step.id} style={{
        display: "flex", alignItems: "center",
        background: step.done ? "rgba(168, 85, 247, 0.08)" : "rgba(255,255,255,0.4)",
        borderRadius: "16px", padding: "12px 18px", marginBottom: "10px",
        border: step.done ? "1px solid rgba(168, 85, 247, 0.3)" : "1px solid rgba(168, 85, 247, 0.15)",
        backdropFilter: "blur(10px)", transition: "all 0.3s ease",
      }}>
        <div className={`badge ${popBadgeId === step.id ? "pop" : ""}`} style={{
          width: "28px", height: "28px", borderRadius: "50%",
          background: "linear-gradient(135deg, #ec4899, #a855f7)",
          color: "white", display: "flex", alignItems: "center", justifyContent: "center",
          fontWeight: "bold", marginRight: "12px", flexShrink: 0, fontSize: "0.8rem",
        }}>
          {index + 1}
        </div>

        <div style={{ flex: 1, cursor: "pointer" }} onClick={() => handleStepDone(step, steps, setSteps)}>
          <span style={{
            textDecoration: step.done ? "line-through" : "none",
            fontWeight: 700, fontSize: "0.95rem",
            color: step.done ? "#9c6db0" : "#5d1c7e",
            opacity: step.done ? 0.7 : 1,
          }}>
            {step.name}
          </span>
          {step.waitTime && waitingStepId === step.id && (
            <div style={{ fontSize: "0.75rem", fontStyle: "italic", color: "#a855f7", marginTop: 4 }}>
              ⏳ Absorbing...
            </div>
          )}
        </div>

        <div onClick={() => handleStepDone(step, steps, setSteps)} style={{
          width: "28px", height: "28px", borderRadius: "50px", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          background: step.done ? "linear-gradient(135deg, #a855f7, #6366f1)" : "rgba(168, 85, 247, 0.1)",
          border: step.done ? "none" : "2px solid rgba(168, 85, 247, 0.2)",
          color: "white", fontSize: "0.8rem",
          boxShadow: step.done ? "0 3px 8px rgba(168, 85, 247, 0.3)" : "none",
        }}>
          {step.done ? "✓" : ""}
        </div>

        {isLoggedIn && (
          <button onClick={(e) => { e.stopPropagation(); deleteStep(step.id, type); }} style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: "1.1rem", marginLeft: "12px", opacity: 0.4, transition: "opacity 0.2s",
          }}>
            🗑️
          </button>
        )}
      </div>
    ));

  const renderCard = (
    title: string, steps: Step[],
    setSteps: React.Dispatch<React.SetStateAction<Step[]>>,
    baseColor: string, Icon: string, type: "morning" | "night"
  ) => {
    const progressPercent = steps.length > 0
      ? (steps.filter((s) => s.done).length / steps.length) * 100 : 0;
    return (
      <div style={{
        background: "rgba(255,255,255,0.45)", backdropFilter: "blur(15px)",
        borderRadius: "24px", padding: "25px", marginBottom: "25px",
        border: "1px solid rgba(168,85,247,0.15)",
        boxShadow: "0 8px 32px rgba(168, 85, 247, 0.05)",
      }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 15 }}>
          <div style={{ fontSize: "1.5rem", marginRight: 12 }}>{Icon}</div>
          <div>
            <h2 style={{ ...gradientTextStyle, fontSize: "1.2rem", margin: 0 }}>{title}</h2>
            <p style={{ fontSize: "0.8rem", color: "#9c6db0", margin: 0 }}>{getProgress(steps)} completed</p>
          </div>
        </div>
        <div style={{
          height: "6px", background: "rgba(168, 85, 247, 0.1)",
          borderRadius: "50px", overflow: "hidden", marginBottom: "20px",
        }}>
          <div style={{
            width: `${progressPercent}%`, height: "100%",
            background: `linear-gradient(90deg, ${baseColor}, #ec4899)`,
            transition: "width 0.5s ease",
          }} />
        </div>
        <div>{renderSteps(steps, setSteps, type)}</div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="cosmo-page">
        <div className="cosmo-container" style={{ maxWidth: 650, textAlign: "center", paddingTop: 60 }}>
          <p style={{ color: "#9c6db0" }}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="cosmo-page" style={{ position: "relative", minHeight: "100vh" }}>
      <div className="cosmo-container" style={{
        maxWidth: 650,
        filter: showForm ? "blur(8px) brightness(0.9)" : "none",
        transition: "all 0.4s ease", padding: "20px",
      }}>

        <header className="cosmo-header" style={{ textAlign: "center", marginBottom: "20px" }}>
          <h1 style={{ ...gradientTextStyle, fontSize: "2.2rem" }}>🌸 My Routine</h1>
          <p style={{ color: "#9c6db0", opacity: 0.8 }}>
            {isLoggedIn ? "Your personalized routine" : "Suggested routine — log in to customize"}
          </p>
        </header>

        <div style={{
          background: streak > 0
            ? "linear-gradient(135deg, rgba(236,72,153,0.12), rgba(168,85,247,0.12))"
            : "rgba(255,255,255,0.4)",
          borderRadius: "20px", padding: "16px 20px", marginBottom: "20px",
          border: streak > 0 ? "1px solid rgba(236,72,153,0.3)" : "1px solid rgba(168,85,247,0.1)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "2rem" }}>{streak > 0 ? "🔥" : "💤"}</span>
            <div>
              <p style={{ margin: 0, fontWeight: 800, color: "#5d1c7e", fontSize: "1.1rem" }}>
                {streak > 0 ? `${streak} day${streak > 1 ? "s" : ""} in a row!` : "Start your streak!"}
              </p>
              <p style={{ margin: 0, fontSize: "0.75rem", color: "#9c6db0" }}>
                {streak > 0
                  ? streak >= 7 ? "🏆 Impressive streak!" : "Keep it up ✨"
                  : "Complete your routine today to start"}
              </p>
            </div>
          </div>
          {isLoggedIn && skinLogs.length > 0 && (
            <button
              onClick={() => setShowChart(!showChart)}
              style={{
                background: "linear-gradient(90deg, #ec4899, #a855f7)",
                border: "none", borderRadius: "12px", padding: "8px 14px",
                color: "white", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer",
              }}
            >
              {showChart ? "Hide" : "📊 View chart"}
            </button>
          )}
        </div>

        {showChart && isLoggedIn && renderChart()}

        <div style={{
          background: "rgba(255,255,255,0.6)", padding: "20px", borderRadius: "24px",
          marginBottom: "25px", textAlign: "center",
          border: "1px solid rgba(168,85,247,0.15)",
          boxShadow: "0 4px 15px rgba(168, 85, 247, 0.05)",
        }}>
          <p style={{ fontWeight: 800, color: "#5d1c7e", marginBottom: "15px", fontSize: "0.95rem" }}>
            🌿 How is your skin today?
          </p>
          <div style={{ display: "flex", justifyContent: "space-around" }}>
            {skinOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleSkinStatus(opt.value)}
                style={{
                  background: skinStatus === opt.value ? "white" : "transparent",
                  border: skinStatus === opt.value ? "2px solid #a855f7" : "1px solid transparent",
                  borderRadius: "18px", padding: "12px 8px",
                  cursor: "pointer", transition: "all 0.3s ease",
                  flex: 1, margin: "0 4px",
                  boxShadow: skinStatus === opt.value ? "0 4px 12px rgba(168, 85, 247, 0.2)" : "none",
                }}
              >
                <span style={{
                  fontSize: "1.6rem", display: "block",
                  transform: skinStatus === opt.value ? "scale(1.15)" : "scale(1)",
                  transition: "transform 0.2s",
                }}>{opt.emoji}</span>
                <span style={{
                  fontSize: "0.65rem",
                  color: skinStatus === opt.value ? "#5d1c7e" : "#9c6db0",
                  fontWeight: skinStatus === opt.value ? 800 : 500,
                }}>{opt.label}</span>
              </button>
            ))}
          </div>

          {skinStatus && skinAdvice[skinStatus] && (
            <div style={{
              marginTop: "15px", padding: "16px", borderRadius: "16px",
              background: "rgba(255,255,255,0.5)", border: "1px solid rgba(168,85,247,0.2)",
              textAlign: "left", fontSize: "0.85rem", animation: "fadeIn 0.5s ease",
            }}>
              <p style={{ margin: "0 0 10px 0", fontWeight: 700, color: "#5d1c7e", fontSize: "0.9rem" }}>
                💡 Analyse pour peau {skinOptions.find(o => o.value === skinStatus)?.label}
              </p>
              <p style={{ margin: "0 0 12px 0", color: "#6b7280", lineHeight: "1.4" }}>
                {skinAdvice[skinStatus].tips}
              </p>
              <div style={{ marginBottom: "10px" }}>
                <span style={{ fontSize: "0.7rem", fontWeight: 800, color: "#10b981", display: "block", marginBottom: "5px" }}>
                  ✅ Recommended
                </span>
                {skinAdvice[skinStatus].Recommended.map(ing => (
                  <span key={ing} style={{
                    display: "inline-block", background: "#ecfdf5", padding: "3px 10px",
                    borderRadius: "20px", fontSize: "0.75rem", marginRight: "6px", marginBottom: "4px",
                    color: "#059669", border: "1px solid #d1fae5",
                  }}>{ing}</span>
                ))}
              </div>
              <div>
                <span style={{ fontSize: "0.7rem", fontWeight: 800, color: "#ef4444", display: "block", marginBottom: "5px" }}>
                  ❌ To avoid
                </span>
                {skinAdvice[skinStatus].avoid.map(ing => (
                  <span key={ing} style={{
                    display: "inline-block", background: "#fef2f2", padding: "3px 10px",
                    borderRadius: "20px", fontSize: "0.75rem", marginRight: "6px", marginBottom: "4px",
                    color: "#dc2626", border: "1px solid #fee2e2",
                  }}>{ing}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {!isLoggedIn && (
          <div style={{
            background: "rgba(236,72,153,0.08)", borderRadius: "16px",
            padding: "14px 18px", marginBottom: "20px",
            border: "1px solid rgba(236,72,153,0.2)", textAlign: "center",
          }}>
            <p style={{ margin: 0, fontSize: "0.88rem", color: "#9c6db0" }}>
              🔒 <strong>Log in</strong> to customize your routine and track your skin
            </p>
          </div>
        )}

        <main>
          {renderCard("Morning Routine", morningSteps, setMorningSteps, "#a855f7", "🌅", "morning")}
          {renderCard("Night Routine", nightSteps, setNightSteps, "#6366f1", "🌙", "night")}
        </main>

        {isLoggedIn && !showForm && (
          <div style={{ textAlign: "center", marginTop: "20px", marginBottom: "40px" }}>
            <button onClick={() => setShowForm(true)} style={{
              padding: "14px 28px", borderRadius: "16px", border: "none",
              background: "linear-gradient(90deg, #ec4899, #a855f7)", color: "white",
              fontWeight: 800, cursor: "pointer",
              boxShadow: "0 10px 20px rgba(236, 72, 153, 0.3)",
            }}>
              + Add a product
            </button>
          </div>
        )}
      </div>

      {/* FORM MODAL */}
      {showForm && (
        <div
          onClick={() => setShowForm(false)}
          style={{
            position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh",
            background: "rgba(168, 85, 247, 0.15)", backdropFilter: "blur(8px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000, animation: "fadeIn 0.3s ease",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "rgba(255, 255, 255, 0.8)", backdropFilter: "blur(25px)",
              padding: "30px", borderRadius: "28px", width: "90%", maxWidth: "400px",
              border: "1px solid rgba(255, 255, 255, 0.4)",
              boxShadow: "0 25px 50px rgba(0, 0, 0, 0.15)",
              display: "flex", flexDirection: "column", gap: "20px",
              animation: "zoomIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
            }}
          >
            <h3 style={{ ...gradientTextStyle, textAlign: "center", fontSize: "1.4rem", margin: 0 }}>
              New Product
            </h3>
            
            <div>
              <label style={{ fontSize: "0.7rem", fontWeight: 800, color: "#9c6db0", marginBottom: "8px", display: "block" }}>
                Choose from my shelf:
              </label>
              <select 
                onChange={(e) => {
                  const prod = shelf.find(p => p.id === Number(e.target.value));
                  if (prod) setNewStepName(`${prod.brand} - ${prod.product_name}`);
                }}
                style={{
                  width: "100%", padding: "12px", borderRadius: "14px",
                  border: "1px solid rgba(168, 85, 247, 0.2)",
                  background: "rgba(255, 255, 255, 0.5)",
                  outline: "none", color: "#5d1c7e", cursor: "pointer",
                }}
              >
                <option value=""> Select a product -</option>
                <option value=""> Gentle Cleanser </option>
                <option value=""> Vitamin C Serum </option>
                <option value=""> Eye Contour Cream </option>
                <option value=""> Aqueous Cleanser </option>
                <option value=""> Exfoliating Toner </option>
                <option value=""> Retinol Serum </option>
                <option value=""> Night Mask </option>
                {shelf.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.brand} - {p.product_name} {checkProductStatus(p) === 'expired' ? '⚠️ EXPIRED' : ''}
                  </option>
                ))}
              </select>
            </div>

            <p style={{ margin: "0", textAlign: "center", fontSize: "0.75rem", color: "#9c6db0", fontWeight: 600 }}>OU</p>

            <div>
              <label style={{ fontSize: "0.7rem", fontWeight: 800, color: "#9c6db0", marginBottom: "8px", display: "block" }}>
                Product name
              </label>
              <input
                type="text"
                placeholder="e.g. Vitamin C Serum"
                value={newStepName}
                onChange={(e) => setNewStepName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddProduct()}
                autoFocus
                style={{
                  width: "100%", padding: "14px", borderRadius: "14px",
                  border: "1px solid rgba(168, 85, 247, 0.2)",
                  background: "rgba(255, 255, 255, 0.5)",
                  outline: "none", color: "#5d1c7e", boxSizing: "border-box",
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: "0.7rem", fontWeight: 800, color: "#9c6db0", marginBottom: "8px", display: "block" }}>
                Routine
              </label>
              <select
                value={newStepTime}
                onChange={(e) => setNewStepTime(e.target.value as "morning" | "night")}
                style={{
                  width: "100%", padding: "14px", borderRadius: "14px",
                  border: "1px solid rgba(168,85,247,0.2)",
                  background: "rgba(255,255,255,0.5)",
                  outline: "none", color: "#5d1c7e", cursor: "pointer",
                }}
              >
                <option value="morning">🌅 Morning</option>
                <option value="night">🌙 Night</option>
              </select>
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              <button onClick={handleAddProduct} style={{
                flex: 2, padding: "14px", borderRadius: "14px", border: "none",
                background: "linear-gradient(90deg, #ec4899, #a855f7)",
                color: "white", fontWeight: 800, cursor: "pointer",
              }}>Add</button>
              <button onClick={() => setShowForm(false)} style={{
                flex: 1, padding: "14px", borderRadius: "14px",
                border: "1px solid rgba(168,85,247,0.2)",
                background: "rgba(255,255,255,0.5)",
                color: "#9c6db0", fontWeight: 600, cursor: "pointer",
              }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes zoomIn { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .badge.pop { animation: popBadge 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
        @keyframes popBadge { 0% { transform: scale(0.6); } 50% { transform: scale(1.3); } 100% { transform: scale(1); } }
      `}</style>
    </div>
  );
};

export default Routine;