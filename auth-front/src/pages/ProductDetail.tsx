import { useParams, NavLink } from "react-router";
import { products } from "@/data/products";
import { ArrowLeft, Sparkles } from "lucide-react";
import { useState } from "react";

const questions = [
  { id: 1, question: "Do you have sensitive skin?",                    weight: 2 },
  { id: 2, question: "Are you pregnant or breastfeeding?",             weight: 3 },
  { id: 3, question: "Do you have known allergies to cosmetics?",      weight: 3 },
  { id: 4, question: "Do you plan to use this product daily?",         weight: 1 },
  { id: 5, question: "Do you have acne-prone or oily skin?",           weight: 2 },
  { id: 6, question: "Have you had reactions to similar products before?", weight: 3 },
  { id: 7, question: "Are you under 18 or over 60?",                   weight: 2 },
  { id: 8, question: "Do you use other strong skincare actives (retinol, AHA, BHA)?", weight: 2 },
];

export default function ProductDetail() {
  const { id } = useParams();
  const product = products.find((p) => p.id === Number(id));

  const [showChecker, setShowChecker]   = useState(false);
  const [answers, setAnswers]           = useState<Record<number, boolean | null>>({});
  const [currentQ, setCurrentQ]         = useState(0);
  const [result, setResult]             = useState<null | { score: number; verdict: string; color: string; advice: string }>(null);
  const [loading, setLoading]           = useState(false);

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-pink-50">
        <p className="text-xl font-semibold text-gray-500">Product not found.</p>
        <NavLink to="/" className="mt-4 text-pink-500 underline">Go back home</NavLink>
      </div>
    );
  }

  const dangerColor =
    product.dangerLevel === "Low"
      ? "text-green-600 bg-green-100"
      : product.dangerLevel === "Medium"
      ? "text-yellow-600 bg-yellow-100"
      : "text-red-600 bg-red-100";

  const scoreColor =
    product.toxicityScore <= 3
      ? "text-green-600"
      : product.toxicityScore <= 6
      ? "text-yellow-600"
      : "text-red-600";

  const handleAnswer = (answer: boolean) => {
    const updated = { ...answers, [questions[currentQ].id]: answer };
    setAnswers(updated);

    if (currentQ < questions.length - 1) {
      setCurrentQ(currentQ + 1);
    } else {
      calculateResult(updated);
    }
  };

  const calculateResult = async (finalAnswers: Record<number, boolean | null>) => {
    setLoading(true);

    // ── Formula ──────────────────────────────────────────────────────────────
    // User risk score: sum of weights for "Yes" answers
    const maxUserScore = questions.reduce((sum, q) => sum + q.weight, 0);
    const userRiskScore = questions.reduce((sum, q) => {
      return sum + (finalAnswers[q.id] === true ? q.weight : 0);
    }, 0);

    // Normalize user risk to 0–10
    const userRiskNormalized = (userRiskScore / maxUserScore) * 10;

    // Combined score = product toxicity (60%) + user risk (40%)
    const combinedScore = product.toxicityScore * 0.6 + userRiskNormalized * 0.4;

    // Build answer summary for AI
    const answerSummary = questions
      .map((q) => `- ${q.question}: ${finalAnswers[q.id] ? "Yes" : "No"}`)
      .join("\n");

    // ── AI call ───────────────────────────────────────────────────────────────
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [
            {
              role: "user",
              content: `You are a cosmetic safety expert. A user wants to know if this product is safe for them.

Product: ${product.name.en}
Product Toxicity Score: ${product.toxicityScore}/10
Danger Level: ${product.dangerLevel}

User profile based on their answers:
${answerSummary}

Combined safety score (lower is safer): ${combinedScore.toFixed(1)}/10

Give a short, friendly, personalized safety verdict in 2-3 sentences. 
- If combined score <= 4: reassure them it is safe
- If combined score <= 7: advise caution and give a specific tip
- If combined score > 7: strongly advise against using it and suggest an alternative type of product

Be warm, direct, and helpful. Do not use bullet points. Speak directly to the user as "you".`,
            },
          ],
        }),
      });

      const data = await res.json();
      const aiAdvice = data.content?.[0]?.text || "Unable to generate advice.";

      let verdict = "";
      let color = "";

      if (combinedScore <= 4) {
        verdict = "✅ Safe for you";
        color = "text-green-600 bg-green-50 border-green-200";
      } else if (combinedScore <= 7) {
        verdict = "⚠️ Use with caution";
        color = "text-yellow-600 bg-yellow-50 border-yellow-200";
      } else {
        verdict = "🚫 Not recommended for you";
        color = "text-red-600 bg-red-50 border-red-200";
      }

      setResult({ score: combinedScore, verdict, color, advice: aiAdvice });
    } catch (e) {
      setResult({
        score: combinedScore,
        verdict: combinedScore <= 4 ? "✅ Safe for you" : combinedScore <= 7 ? "⚠️ Use with caution" : "🚫 Not recommended for you",
        color: combinedScore <= 4 ? "text-green-600 bg-green-50 border-green-200" : combinedScore <= 7 ? "text-yellow-600 bg-yellow-50 border-yellow-200" : "text-red-600 bg-red-50 border-red-200",
        advice: combinedScore <= 4
          ? "Based on your profile and this product's low toxicity score, it appears safe for your use. You can incorporate it into your routine with confidence."
          : combinedScore <= 7
          ? "Given your skin profile, use this product with caution. Do a patch test first and avoid daily use until you know how your skin reacts."
          : "Based on your profile and this product's toxicity level, we strongly advise against using it. Look for gentler, fragrance-free alternatives instead.",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetChecker = () => {
    setAnswers({});
    setCurrentQ(0);
    setResult(null);
    setShowChecker(false);
  };

  return (
    <div className="min-h-screen bg-pink-50 px-6 py-12 flex flex-col items-center">
      <div className="w-full max-w-md">

        {/* Back button */}
        <NavLink to="/" className="flex items-center gap-2 text-pink-500 font-medium mb-8 hover:underline">
          <ArrowLeft className="w-4 h-4" /> Back
        </NavLink>

        {/* Product image */}
        <div className="bg-white rounded-2xl shadow-md p-8 flex justify-center">
          <img
            src={product.image}
            alt={product.name.en}
            className="h-48 object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/products/placeholder.png";
            }}
          />
        </div>

        {/* Product info */}
        <div className="bg-white rounded-2xl shadow-md p-6 mt-4 space-y-4">
          <h1 className="text-2xl font-bold text-gray-800">{product.name.en}</h1>
          <p className="text-gray-500">{product.description.en}</p>

          <hr className="border-pink-100" />

          {/* Toxicity score */}
          <div className="flex items-center justify-between">
            <span className="text-gray-600 font-medium">Toxicity Score</span>
            <span className={`text-lg font-bold ${scoreColor}`}>
              {product.toxicityScore} / 10
            </span>
          </div>

          {/* Score bar */}
          <div className="w-full bg-gray-100 rounded-full h-3">
            <div
              className="h-3 rounded-full transition-all"
              style={{
                width: `${product.toxicityScore * 10}%`,
                background:
                  product.toxicityScore <= 3 ? "#22c55e"
                  : product.toxicityScore <= 6 ? "#eab308"
                  : "#ef4444",
              }}
            />
          </div>

          {/* Danger level */}
          <div className="flex items-center justify-between">
            <span className="text-gray-600 font-medium">Danger Level</span>
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${dangerColor}`}>
              {product.dangerLevel}
            </span>
          </div>

          {/* French name */}
          <div className="flex items-center justify-between">
            <span className="text-gray-600 font-medium">French Name</span>
            <span className="text-gray-800 font-medium">{product.name.fr}</span>
          </div>

          {/* Safety verdict */}
          <div className={`rounded-xl p-4 text-center font-semibold text-lg ${
            product.toxicityScore <= 3 ? "bg-green-50 text-green-600"
            : product.toxicityScore <= 6 ? "bg-yellow-50 text-yellow-600"
            : "bg-red-50 text-red-600"
          }`}>
            {product.toxicityScore <= 3 ? "✅ Safe to use"
            : product.toxicityScore <= 6 ? "⚠️ Use with caution"
            : "🚫 High risk — avoid if sensitive"}
          </div>
        </div>

        {/* ── AI SAFETY CHECKER ── */}
        <div className="bg-white rounded-2xl shadow-md p-6 mt-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-pink-500" />
            <h2 className="text-lg font-bold text-gray-800">Is this safe for me?</h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Answer a few quick questions and our AI will tell you if this product suits your profile.
          </p>

          {/* Start button */}
          {!showChecker && !result && (
            <button
              onClick={() => setShowChecker(true)}
              className="w-full bg-gradient-to-r from-pink-500 to-purple-500 text-white py-3 rounded-xl font-semibold text-lg"
            >
              Check My Safety ✨
            </button>
          )}

          {/* Questions */}
          {showChecker && !result && !loading && (
            <div>
              {/* Progress bar */}
              <div className="w-full bg-gray-100 rounded-full h-2 mb-4">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-pink-400 to-purple-400 transition-all"
                  style={{ width: `${((currentQ) / questions.length) * 100}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 text-right mb-3">
                {currentQ + 1} / {questions.length}
              </p>

              <p className="text-gray-800 font-semibold text-center text-base mb-6">
                {questions[currentQ].question}
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => handleAnswer(true)}
                  className="flex-1 bg-pink-50 border border-pink-300 text-pink-600 py-3 rounded-xl font-semibold hover:bg-pink-100 transition-all"
                >
                  Yes
                </button>
                <button
                  onClick={() => handleAnswer(false)}
                  className="flex-1 bg-gray-50 border border-gray-200 text-gray-600 py-3 rounded-xl font-semibold hover:bg-gray-100 transition-all"
                >
                  No
                </button>
              </div>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="text-center py-6">
              <p className="text-pink-500 animate-pulse text-lg font-medium">
                ✨ Analyzing your profile...
              </p>
            </div>
          )}

          {/* Result */}
          {result && !loading && (
            <div>
              <div className={`rounded-xl border p-4 text-center mb-4 ${result.color}`}>
                <p className="text-xl font-bold mb-1">{result.verdict}</p>
                <p className="text-sm font-medium">
                  Your safety score: {result.score.toFixed(1)} / 10
                </p>
              </div>

              {/* Score bar */}
              <div className="w-full bg-gray-100 rounded-full h-3 mb-4">
                <div
                  className="h-3 rounded-full transition-all"
                  style={{
                    width: `${result.score * 10}%`,
                    background:
                      result.score <= 4 ? "#22c55e"
                      : result.score <= 7 ? "#eab308"
                      : "#ef4444",
                  }}
                />
              </div>

              {/* AI advice */}
              <div className="bg-pink-50 rounded-xl p-4 text-sm text-gray-700 leading-relaxed border border-pink-100">
                <p className="font-semibold text-pink-500 mb-1">AI Advice 🤖</p>
                <p>{result.advice}</p>
              </div>

              <button
                onClick={resetChecker}
                className="mt-4 w-full border border-pink-300 text-pink-500 py-3 rounded-xl font-semibold hover:bg-pink-50 transition-all"
              >
                Retake Quiz
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}