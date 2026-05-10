import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Sparkles, 
  Shield, 
  Heart, 
  Zap, 
  ShieldCheck, 
  Leaf, 
  Users, 
  FlaskConical,
  Globe,
  Award,
  ChevronDown,
  Search,
  CheckCircle2,
  Scan
} from "lucide-react";

export default function AboutUs() {
  const fadeInUp = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } }
  };

  return (
    <div className="min-h-screen relative overflow-hidden text-black font-sans selection:bg-pink-200">

      {/* 🌈 Background Initial préservé */}
      <div className="absolute inset-0 bg-gradient-to-br from-pink-200 via-purple-200 to-indigo-200 animate-pulse z-0" />

      {/* ✨ Glow Effects */}
      <div className="absolute top-20 left-20 w-72 h-72 bg-pink-400/30 rounded-full blur-3xl opacity-60"></div>
      <div className="absolute bottom-20 right-20 w-72 h-72 bg-purple-400/30 rounded-full blur-3xl opacity-60"></div>

      <div className="relative z-10 px-6 py-20">

        {/* ── 1. HERO SECTION ── */}
        <header className="text-center mb-24">
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-5xl md:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 drop-shadow-lg"
          >
            About Us
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-center max-w-2xl mx-auto mt-6 text-lg text-gray-800 font-medium leading-relaxed"
          >
            We combine beauty and technology to help you choose safer,
            smarter cosmetic products with confidence.
          </motion.p>
        </header>

        {/* ── 2. CORE VALUES ── */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-10 max-w-6xl mx-auto mb-32">
          {[
            {
              title: "Our Mission",
              desc: "Empower users to understand what they put on their skin.",
              icon: <Sparkles className="w-10 h-10" />,
              color: "text-pink-500",
            },
            {
              title: "Safety First",
              desc: "Identify harmful ingredients and promote safe beauty.",
              icon: <Shield className="w-10 h-10" />,
              color: "text-purple-500",
            },
            {
              title: "For Everyone",
              desc: "Designed for all skin types and beauty lovers.",
              icon: <Heart className="w-10 h-10" />,
              color: "text-red-400",
            },
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.2 }}
              viewport={{ once: true }}
            >
              <Card className="bg-white/40 backdrop-blur-xl border border-white/40 rounded-3xl shadow-xl hover:scale-105 transition duration-300 h-full">
                <CardContent className="p-8 text-center flex flex-col items-center">
                  <div className={`mb-4 ${item.color}`}>
                    {item.icon}
                  </div>
                  <h3 className="text-2xl font-semibold mb-3 text-slate-800">
                    {item.title}
                  </h3>
                  <p className="text-gray-700 font-medium leading-relaxed">
                    {item.desc}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </section>

        {/* ── 3. HOW IT WORKS (Nouveau contenu) ── */}
        <section className="max-w-6xl mx-auto mb-32">
          <h2 className="text-4xl font-black text-center text-slate-800 mb-16 italic font-serif">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-8 relative">
            {[
              { t: "Scan", d: "Take a photo of the ingredient list or barcode.", icon: <Scan size={30}/> },
              { t: "Analyse", d: "Our AI breaks down every chemical component.", icon: <Search size={30}/> },
              { t: "Verdict", d: "Get a clear health score and alternatives.", icon: <CheckCircle2 size={30}/> }
            ].map((step, i) => (
              <motion.div 
                key={i}
                variants={fadeInUp}
                initial="hidden"
                whileInView="visible"
                className="bg-white/20 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/30 text-center relative"
              >
                <div className="w-14 h-14 bg-white/60 rounded-full flex items-center justify-center mx-auto mb-6 text-pink-500 shadow-inner">
                  {step.icon}
                </div>
                <h4 className="text-xl font-bold mb-2 text-slate-900">{step.t}</h4>
                <p className="text-gray-700 text-sm leading-relaxed">{step.d}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ── 4. NOTRE PARCOURS (Timeline) ── */}
        <section className="max-w-4xl mx-auto mb-32">
          <h2 className="text-4xl font-black text-center text-slate-800 mb-16 italic font-serif">Our Story</h2>
          <div className="space-y-12 relative">
             <div className="absolute left-[21px] md:left-1/2 top-0 bottom-0 w-1 bg-white/30 -translate-x-1/2 hidden md:block" />
             {[
               { year: "2024", title: "The Idea", desc: "AuraSkin was born to decode the complexity of cosmetic labels." },
               { year: "2025", title: "The Algorithm", desc: "Our AI validated by toxicology experts." },
               { year: "2026", title: "Our Community", desc: "A growing community of 50,000 skincare enthusiasts." }
             ].map((step, i) => (
               <motion.div 
                key={i} 
                initial={{ opacity: 0, x: i % 2 === 0 ? -20 : 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                className={`flex flex-col md:flex-row items-center gap-8 ${i % 2 !== 0 ? 'md:flex-row-reverse' : ''}`}
               >
                 <div className="flex-1 md:text-right">
                    {i % 2 === 0 && <div className="bg-white/30 p-6 rounded-3xl border border-white/20 shadow-lg"><span className="text-pink-500 font-black">{step.year}</span><h4 className="font-bold">{step.title}</h4><p className="text-sm text-gray-700">{step.desc}</p></div>}
                 </div>
                 <div className="w-11 h-11 rounded-full bg-gradient-to-r from-pink-400 to-indigo-500 border-4 border-white shadow-xl z-10 shrink-0 hidden md:block" />
                 <div className="flex-1 text-left">
                    {i % 2 !== 0 && <div className="bg-white/30 p-6 rounded-3xl border border-white/20 shadow-lg"><span className="text-purple-500 font-black">{step.year}</span><h4 className="font-bold">{step.title}</h4><p className="text-sm text-gray-700">{step.desc}</p></div>}
                 </div>
               </motion.div>
             ))}
          </div>
        </section>

        {/* ── 5. FAQ (Frequently Asked Questions) ── */}
        <section className="max-w-3xl mx-auto mb-20 px-4">
          <h2 className="text-3xl font-bold text-center text-slate-800 mb-10">Frequently Asked Questions</h2>
          <div className="space-y-4 font-medium">
            {[
              { q: "Where does your data come from?", a: "We use international scientific databases and validated dermatological sources." },
              { q: "Is the app free?", a: "Yes, our mission is to make healthy beauty accessible to all. Basic scan features are free." }
            ].map((item, i) => (
              <details key={i} className="group bg-white/20 backdrop-blur-md border border-white/30 rounded-3xl p-6 cursor-pointer transition-all hover:bg-white/40">
                <summary className="font-bold text-slate-800 list-none flex justify-between items-center">
                  {item.q}
                  <ChevronDown className="group-open:rotate-180 transition-transform text-pink-500" size={20} />
                </summary>
                <p className="text-gray-700 text-sm leading-relaxed mt-4 border-t border-white/20 pt-4">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}