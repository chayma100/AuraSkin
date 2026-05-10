import { products } from "@/data/products";
import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

export default function Trends() {
  const navigate = useNavigate();

  const trendingProducts = products.filter(
    (p) => p.dangerLevel === "Low" && p.toxicityScore <= 3
  );

  return (
    <div className="min-h-screen bg-pink-50 px-6 py-12">

      {/* Header */}
      <div className="text-center mb-12">
        <div className="flex items-center justify-center gap-2 mb-3">
          <Sparkles className="w-7 h-7 text-pink-500" />
          <h1 className="text-4xl font-bold text-gray-800">Trending Products</h1>
          <Sparkles className="w-7 h-7 text-pink-500" />
        </div>
        <p className="text-gray-500 text-lg max-w-xl mx-auto">
          The safest and cleanest products — low toxicity, low risk, all glow.
        </p>
        <div className="mt-4 inline-flex items-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded-full text-sm font-semibold">
          ✅ {trendingProducts.length} safe products found
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5 max-w-6xl mx-auto">
        {trendingProducts.map((product, i) => (
          <motion.div
            key={product.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.05 }}
            onClick={() => navigate(`/product/${product.id}`)}
            className="bg-white rounded-2xl shadow-md p-4 text-center cursor-pointer hover:shadow-pink-200 hover:shadow-lg transition-all hover:-translate-y-1"
          >
            <img
              src={product.image}
              alt={product.name.en}
              className="mx-auto h-24 object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/products/placeholder.png";
              }}
            />
            <h3 className="mt-3 font-semibold text-sm leading-tight text-gray-800">
              {product.name.en}
            </h3>
            <p className="mt-1 text-xs text-gray-400 leading-snug">
              {product.description.en}
            </p>

            <div className="mt-3 flex flex-col gap-1 items-center">
              {/* Toxicity bar */}
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="h-2 rounded-full bg-green-400"
                  style={{ width: `${product.toxicityScore * 10}%` }}
                />
              </div>
              <p className="text-xs text-gray-400">
                Toxicity: <span className="font-semibold text-green-600">{product.toxicityScore}/10</span>
              </p>

              {/* Badge */}
              <span className="mt-1 inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                {product.dangerLevel} Risk
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Empty state */}
      {trendingProducts.length === 0 && (
        <div className="text-center mt-20 text-gray-400 text-lg">
          No trending products found.
        </div>
      )}
    </div>
  );
}