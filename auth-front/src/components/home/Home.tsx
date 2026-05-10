import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { 
  Sparkles, 
  Camera, 
  ScanLine, 
  ArrowRight, 
  ChevronDown,
  Target,
  Zap,
  ShieldCheck,
  Heart,
  Droplets
} from "lucide-react";
import { NavLink, useNavigate } from "react-router";
import { products } from "@/data/products";

export default function Home() {
  const navigate = useNavigate();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { 
      opacity: 1, 
      y: 0, 
      transition: { duration: 0.7, ease: [0.21, 1.02, 0.73, 1] } 
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF9FB] text-slate-900 font-sans selection:bg-pink-200 overflow-x-hidden">
      
      {/* ✨ DÉCORATION D'ARRIÈRE-PLAN - Tons Girlie & Glowy */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div 
          animate={{ x: [0, 50, 0], y: [0, 30, 0], scale: [1, 1.1, 1] }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-[10%] -left-[10%] w-[60%] h-[60%] rounded-full bg-gradient-to-br from-pink-200/40 to-orange-100/30 blur-[120px]" 
        />
        <motion.div 
          animate={{ x: [0, -40, 0], y: [0, 50, 0], scale: [1, 1.2, 1] }}
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-gradient-to-tr from-purple-200/30 to-pink-100/40 blur-[100px]" 
        />
      </div>

      {/* ── 1. HERO SECTION - Typographie Créative ── */}
      <section className="relative min-h-[90vh] flex flex-col items-center justify-center px-6 pt-12 text-center">
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="z-10"
        >
          <motion.div variants={itemVariants} className="flex justify-center mb-8">
            <span className="px-5 py-2 text-[11px] font-bold tracking-[0.2em] text-pink-500 uppercase bg-white/80 backdrop-blur-md border border-pink-100 rounded-full shadow-sm flex items-center gap-2">
              <Heart size={12} className="fill-pink-500" /> AuraSkin IA • Sprint Release v1.0
            </span>
          </motion.div>
          
          {/* 🔽 SECTION MODIFIÉE : RÉDUCTION DE LA TAILLE DU TITRE 🔽 */}
          <motion.h1 variants={itemVariants} className="text-5xl md:text-7xl font-black tracking-tighter leading-[0.95] mb-8">
            Glow <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-rose-500 to-purple-500 animate-gradient-x">Deeply.</span><br/>
            <span className="italic font-serif font-light text-slate-800 underline decoration-pink-200/60 decoration-8 underline-offset-4">Scan Smarter.</span>
          </motion.h1>
          {/* 🔼 FIN DE LA SECTION MODIFIÉE 🔼 */}
          
          <motion.p variants={itemVariants} className="max-w-xl mx-auto text-lg md:text-xl text-slate-600/80 font-medium leading-relaxed mb-12">
            Reveal the truth behind your cosmetics. Our AI analyzes ingredients so you can choose what's best for your skin.
          </motion.p>

          {/* ── 2. ACTIONS DYNAMIQUES ── */}
          <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-6 w-full max-w-5xl px-4">
            <NavLink to="/barcode" className="group">
              <div className="h-full p-8 bg-white/60 backdrop-blur-xl rounded-[3rem] border border-white shadow-[0_20px_50px_rgba(255,182,193,0.2)] transition-all duration-500 hover:shadow-[0_30px_60px_rgba(255,182,193,0.4)] hover:-translate-y-3">
                <div className="w-14 h-14 bg-gradient-to-br from-pink-400 to-rose-400 text-white rounded-3xl flex items-center justify-center mb-6 shadow-lg shadow-pink-200 group-hover:rotate-12 transition-transform">
                  <ScanLine size={28} />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2 text-left tracking-tight">Scan Barcode</h3>
                <p className="text-slate-500 text-sm text-left leading-relaxed font-medium">Instant match with our database.</p>
              </div>
            </NavLink>

            <NavLink to="/scan" className="group">
              <div className="h-full p-8 bg-white/60 backdrop-blur-xl rounded-[3rem] border border-white shadow-[0_20px_50px_rgba(192,132,252,0.15)] transition-all duration-500 hover:shadow-[0_30px_60px_rgba(192,132,252,0.3)] hover:-translate-y-3">
                <div className="w-14 h-14 bg-gradient-to-br from-purple-400 to-pink-400 text-white rounded-3xl flex items-center justify-center mb-6 shadow-lg shadow-purple-100 group-hover:-rotate-12 transition-transform">
                  <Camera size={28} />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2 text-left tracking-tight">Analyze Photo</h3>
                <p className="text-slate-500 text-sm text-left leading-relaxed font-medium">Extract ingredients list via IA.</p>
              </div>
            </NavLink>

            <NavLink to="/skin" className="group">
              <div className="h-full p-8 bg-gradient-to-br from-pink-50 to-purple-50 backdrop-blur-xl rounded-[3rem] border border-pink-100 shadow-[0_20px_50px_rgba(236,72,153,0.15)] transition-all duration-500 hover:shadow-[0_30px_60px_rgba(236,72,153,0.3)] hover:-translate-y-3">
                <div className="w-14 h-14 bg-gradient-to-br from-pink-500 to-purple-500 text-white rounded-3xl flex items-center justify-center mb-6 shadow-lg shadow-pink-200 group-hover:scale-110 transition-transform">
                  <Droplets size={28} />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2 text-left tracking-tight">Skin Analysis</h3>
                <p className="text-slate-500 text-sm text-left leading-relaxed font-medium">Detect your skin type with AI.</p>
              </div>
            </NavLink>

            <NavLink to="/products" className="group">
              <div className="h-full p-8 bg-slate-900 rounded-[3rem] shadow-2xl transition-all duration-500 hover:-translate-y-3 hover:bg-slate-800">
                <div className="w-14 h-14 bg-white/10 text-white rounded-3xl flex items-center justify-center mb-6 backdrop-blur-lg border border-white/20 group-hover:scale-110 transition-transform">
                  <Sparkles size={28} className="text-pink-300" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2 text-left tracking-tight">Catalog</h3>
                <p className="text-slate-400 text-sm text-left leading-relaxed font-medium">Explore thousands of products.</p>
              </div>
            </NavLink>
          </motion.div>
        </motion.div>

        <motion.div animate={{ y: [0, 12, 0] }} transition={{ repeat: Infinity, duration: 2 }} className="mt-16 text-pink-300 cursor-pointer">
          <ChevronDown size={32} strokeWidth={3} />
        </motion.div>
      </section>

      {/* ── 3. TRUST SECTION ── */}
      <section className="py-24 bg-white/40">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-12">
            {[
              { label: "Ingredients", val: "15k+", icon: <Zap size={18}/> },
              { label: "Community", val: "50k+", icon: <Target size={18}/> },
              { label: "Accuracy", val: "99.9%", icon: <ShieldCheck size={18}/> },
              { label: "Safe choices", val: "8k+", icon: <Heart size={18}/> },
            ].map((stat, i) => (
              <motion.div 
                key={i} 
                whileInView={{ opacity: 1, y: 0 }}
                initial={{ opacity: 0, y: 20 }}
                className="text-center group"
              >
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-pink-50 text-pink-400 mb-4 group-hover:scale-125 transition-transform duration-500">
                  {stat.icon}
                </div>
                <h4 className="text-4xl font-black text-slate-900 tracking-tighter mb-1">{stat.val}</h4>
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 4. TRENDING ANALYSES ── */}
      <section className="py-28 overflow-hidden">
        <div className="px-6 mb-16 text-center">
            <h2 className="text-4xl font-black text-slate-900 tracking-tight mb-4">Trending <span className="font-serif italic font-light text-pink-500">Analyses</span></h2>
            <div className="w-20 h-1.5 bg-pink-200 mx-auto rounded-full"></div>
        </div>
        <div className="flex overflow-x-hidden group relative">
          <div className="animate-marquee flex whitespace-nowrap gap-8 py-4">
            {[...products, ...products].map((p, i) => (
              <div 
                key={i} 
                onClick={() => navigate(`/product/${p.id}`)}
                className="w-72 bg-white p-8 rounded-[3.5rem] shadow-[0_15px_40px_rgba(0,0,0,0.03)] border border-pink-50/50 flex flex-col items-center hover:shadow-xl transition-all cursor-pointer"
              >
                <div className="h-40 flex items-center justify-center mb-6">
                  <img src={p.image} alt="" className="h-full object-contain hover:scale-110 transition-transform duration-500" />
                </div>
                <p className="font-bold text-slate-800 truncate w-full text-center text-sm mb-4">{p.name.en}</p>
                <div className={`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest ${
                    p.toxicityScore <= 3 ? 'bg-green-50 text-green-500' : 'bg-pink-50 text-pink-500'
                }`}>
                   Score: {p.toxicityScore}/10
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. CTA SECTION ── */}
      <section className="py-20 px-6">
        <motion.div 
          whileInView={{ scale: [0.95, 1], opacity: 1 }}
          initial={{ opacity: 0 }}
          className="max-w-4xl mx-auto bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-[4rem] p-16 text-center relative overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.2)]"
        >
          <div className="absolute top-0 right-0 w-80 h-80 bg-pink-500/20 blur-[100px] -mr-40 -mt-40" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 blur-[80px] -ml-32 -mb-32" />
          
          <h2 className="text-4xl md:text-6xl font-bold text-white mb-8 tracking-tight">
            Prêt à transformer <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-300 to-rose-400 font-serif italic">votre routine ?</span>
          </h2>
          
          <p className="text-slate-400 text-lg max-w-md mx-auto mb-12 font-medium">
            Rejoignez des milliers de femmes qui choisissent la santé et l'éclat pour leur peau.
          </p>
          
          <NavLink to="/signup">
            <Button size="lg" className="bg-gradient-to-r from-pink-400 to-rose-500 text-white hover:from-pink-500 hover:to-rose-600 rounded-full px-12 h-16 text-md font-black shadow-xl shadow-pink-500/30 transition-all hover:scale-110 active:scale-95">
              Créer mon profil gratuit <ArrowRight className="ml-2" size={20} />
            </Button>
          </NavLink>
        </motion.div>
      </section>

      {/* ── 6. FOOTER ── */}
      <footer className="py-12 text-center border-t border-pink-50">
        <p className="text-pink-300 text-[11px] font-black uppercase tracking-[0.4em]">
          © {new Date().getFullYear()} AuraSkin • Glow with Confidence
        </p>
      </footer>

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 50s linear infinite;
        }
        .animate-marquee:hover {
          animation-play-state: paused;
        }
        .animate-gradient-x {
          background-size: 200% 200%;
          animation: gradient-x 15s ease infinite;
        }
        @keyframes gradient-x {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
      `}</style>
    </div>
  );
}