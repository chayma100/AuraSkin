import { products } from "@/data/products";

export default function Products() {
  return (
    <div className="min-h-screen bg-pink-50 px-6 py-16">
      <h1 className="text-4xl font-bold text-center text-pink-500 mb-12">
        Explore Products
      </h1>

      <div className="flex flex-wrap justify-center gap-6">
        {products.map((product) => (
          <div
            key={product.id}
            className="bg-white p-4 rounded-xl shadow-md w-56 text-center hover:scale-105 transition"
          >
            <img
              src={product.image}
              className="mx-auto h-32 object-contain"
            />

            <h3 className="mt-2 font-semibold text-gray-900">
              {product.name.en}
            </h3>

            <p className="text-sm text-gray-700">
              {product.description.en}
            </p>

            <p className="mt-2 text-sm text-gray-800">
                Toxicity:{" "}
                <span className="font-bold text-pink-600">
                    {product.toxicityScore}/10
                </span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}