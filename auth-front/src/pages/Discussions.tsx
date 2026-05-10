import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageCircle, Heart, Plus, Send, X, Trash2, ArrowLeft, Star, Search } from "lucide-react";
import { useState, useEffect } from "react";
import apiClient from "@/config/ApiClient";
import useAuth from "@/auth/store";
import toast from "react-hot-toast";
import { products } from "@/data/products";

interface Discussion {
  id: number;
  user_id: number | null;
  author_name: string;
  title: string;
  content: string;
  category: string;
  likes: number;
  created_at: string;
  product_id?: number | null;
  rating?: number | null;
}

interface Comment {
  id: number;
  discussion_id: number;
  username: string;
  content: string;
}

type View = "list" | "products" | "product-detail";

export default function Discussions() {
  const user = useAuth((state) => state.user);

  const [view, setView] = useState<View>("list");
  const [selectedProduct, setSelectedProduct] = useState<typeof products[0] | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [productDiscussions, setProductDiscussions] = useState<Discussion[]>([]);
  const [loading, setLoading] = useState(true);
  const [productLoading, setProductLoading] = useState(false);

  const [open, setOpen] = useState(false);
  const [newPost, setNewPost] = useState({ title: "", content: "", category: "General", rating: 0 });
  const [posting, setPosting] = useState(false);
  const [hoverRating, setHoverRating] = useState(0);

  const [openComments, setOpenComments] = useState<number | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");


  // ── Filter products by search ──
  const filteredProducts = products.filter((p) =>
    p.name.en.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.name.fr.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description.en.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const fetchDiscussions = async () => {
    try {
      const res = await apiClient.get("/discussions");
      setDiscussions(res.data.filter((d: Discussion) => !d.product_id));
    } catch {
      toast.error("Failed to load discussions");
    } finally {
      setLoading(false);
    }
  };

  const fetchProductDiscussions = async (productId: number) => {
    setProductLoading(true);
    try {
      const res = await apiClient.get(`/discussions?productId=${productId}`);
      setProductDiscussions(res.data);
    } catch {
      toast.error("Failed to load product discussions");
    } finally {
      setProductLoading(false);
    }
  };

  useEffect(() => { fetchDiscussions(); }, []);

  const handleSelectProduct = (product: typeof products[0]) => {
    setSelectedProduct(product);
    setView("product-detail");
    setSearchQuery("");
    fetchProductDiscussions(product.id);
  };

  const getAverageRating = (list: Discussion[]) => {
    const rated = list.filter(d => d.rating && d.rating > 0);
    if (rated.length === 0) return null;
    const avg = rated.reduce((sum, d) => sum + (d.rating || 0), 0) / rated.length;
    return avg.toFixed(1);
  };

  // ── Highlight searched text ──
  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return <>{text}</>;
    const parts = text.split(new RegExp(`(${query})`, "gi"));
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <mark key={i} style={{
              background: "linear-gradient(90deg, rgba(236,72,153,0.25), rgba(168,85,247,0.25))",
              borderRadius: "4px", padding: "0 2px", color: "#5d1c7e",
            }}>
              {part}
            </mark>
          ) : part
        )}
      </>
    );
  };

  const handlePost = async () => {
    if (!newPost.title.trim() || !newPost.content.trim()) {
      toast.error("Title and content are required");
      return;
    }
    if (!user) { toast.error("You must be logged in to post"); return; }
    setPosting(true);
    try {
      const payload: any = {
        title: newPost.title,
        content: newPost.content,
        category: selectedProduct ? selectedProduct.name.en : newPost.category,
        author_name: user.username,
        user_id: user.id,
      };
      if (selectedProduct) {
        payload.product_id = selectedProduct.id;
        payload.rating = newPost.rating || null;
      }
      const res = await apiClient.post("/discussions", payload);
      if (selectedProduct) setProductDiscussions([res.data, ...productDiscussions]);
      else setDiscussions([res.data, ...discussions]);
      setOpen(false);
      setNewPost({ title: "", content: "", category: "General", rating: 0 });
      toast.success("Post created successfully!");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Error saving your post");
    } finally {
      setPosting(false);
    }
  };

  const handleLike = async (id: number, isProduct = false) => {
    if (!user) { toast.error("Login to like posts"); return; }
    try {
      const res = await apiClient.post(`/discussions/${id}/like`, { userId: user.id });
      const updater = (list: Discussion[]) =>
        list.map((d) => d.id === id ? { ...d, likes: res.data.likes } : d);
      if (isProduct) setProductDiscussions(updater);
      else setDiscussions(updater);
      toast.success(res.data.liked ? "Liked! ❤️" : "Like removed 🤍", { duration: 1000 });
    } catch { toast.error("Error liking"); }
  };

  const fetchComments = async (id: number) => {
    if (openComments === id) { setOpenComments(null); return; }
    try {
      const res = await apiClient.get(`/discussions/${id}/comments`);
      setComments(res.data);
      setOpenComments(id);
    } catch { toast.error("Failed to load comments"); }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !openComments) return;
    if (!user) { toast.error("Login to comment"); return; }
    try {
      const res = await apiClient.post(`/discussions/${openComments}/comments`, {
        content: newComment, username: user.username,
      });
      setComments([...comments, res.data]);
      setNewComment("");
      toast.success("Comment added!");
    } catch { toast.error("Error adding comment"); }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!user || !confirm("Delete this comment?")) return;
    try {
      await apiClient.delete(`/discussions/${openComments}/comments/${commentId}`, { data: { userId: user.id } });
      setComments(comments.filter((c) => c.id !== commentId));
      toast.success("Comment deleted");
    } catch { toast.error("Error deleting comment"); }
  };

  const handleDeleteDiscussion = async (discussionId: number, isProduct = false) => {
    if (!user || !confirm("Delete this discussion?")) return;
    try {
      await apiClient.delete(`/discussions/${discussionId}`, { data: { userId: user.id } });
      if (isProduct) setProductDiscussions((p) => p.filter((d) => d.id !== discussionId));
      else setDiscussions((p) => p.filter((d) => d.id !== discussionId));
      if (openComments === discussionId) setOpenComments(null);
      toast.success("Discussion deleted");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Error deleting");
    }
  };


  const dangerColor = (level?: string) => {
    if (level === "Low") return { bg: "#ecfdf5", text: "#059669", border: "#d1fae5" };
    if (level === "Medium") return { bg: "#fffbeb", text: "#d97706", border: "#fde68a" };
    if (level === "High") return { bg: "#fef2f2", text: "#dc2626", border: "#fee2e2" };
    return null;
  };

  const renderDiscussion = (post: Discussion, isProduct = false, index = 0) => (
    <motion.div
      key={post.id}
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
    >
      <Card className="bg-white/40 backdrop-blur-xl border border-white/40 rounded-3xl shadow-xl hover:scale-[1.01] transition duration-300">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
              {post.author_name?.[0]?.toUpperCase() || "A"}
            </div>
            <div>
              <p className="text-sm text-gray-800 font-semibold leading-none">{post.author_name}</p>
              <span className="text-[10px] text-gray-500">{new Date(post.created_at).toLocaleDateString()}</span>
            </div>
            {!isProduct && (
              <span className="ml-auto text-xs text-pink-600 font-bold bg-pink-100/80 px-3 py-1 rounded-full">
                {post.category}
              </span>
            )}
            {post.rating && post.rating > 0 && (
              <div className="ml-auto flex items-center gap-1">
                {[1,2,3,4,5].map(s => (
                  <Star key={s} className={`w-3.5 h-3.5 ${s <= post.rating! ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
                ))}
              </div>
            )}
            {user && Number(user.id) === Number(post.user_id) && (
              <button onClick={() => handleDeleteDiscussion(post.id, isProduct)} className="ml-2 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          <h2 className="text-xl font-bold mt-2 text-gray-900">{post.title}</h2>
          <p className="text-gray-700 mt-2 whitespace-pre-wrap">{post.content}</p>

          <div className="flex items-center gap-6 mt-4 text-gray-700">
            <button onClick={() => handleLike(post.id, isProduct)} className="flex items-center gap-1.5 hover:text-pink-600 transition font-medium">
              <Heart className={`w-4 h-4 ${post.likes > 0 ? "fill-pink-500 text-pink-500" : ""}`} />
              {post.likes || 0}
            </button>
            <button onClick={() => fetchComments(post.id)} className="flex items-center gap-1.5 hover:text-purple-600 transition font-medium">
              <MessageCircle className="w-4 h-4" />
              {openComments === post.id ? `${comments.length} comments` : "Comments"}
            </button>
          </div>

          {openComments === post.id && (
            <div className="mt-4 border-t border-white/40 pt-4 space-y-3">
              {comments.length === 0 && <p className="text-xs text-gray-500 italic">No comments yet.</p>}
              {comments.map((c) => (
                <div key={c.id} className="flex gap-2 items-start group">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-pink-300 to-purple-400 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                    {c.username?.[0]?.toUpperCase() || "U"}
                  </div>
                  <div className="bg-white/50 rounded-2xl px-3 py-2 flex-1">
                    <p className="text-[11px] font-bold text-gray-700">{c.username}</p>
                    <p className="text-sm text-gray-800">{c.content}</p>
                  </div>
                  {user && user.username === c.username && (
                    <button onClick={() => handleDeleteComment(c.id)} className="opacity-0 group-hover:opacity-100 transition text-gray-400 hover:text-red-500 mt-1 flex-shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
              <div className="flex gap-2 mt-2">
                <input value={newComment} onChange={(e) => setNewComment(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAddComment()} placeholder="Write a comment..." className="flex-1 border border-white/40 rounded-xl px-4 py-2 text-sm bg-white/60 outline-none focus:ring-2 ring-purple-400/50" />
                <button onClick={handleAddComment} className="bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-xl px-4 py-2 hover:opacity-90 transition">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );

  return (
    <div className="min-h-screen relative overflow-hidden text-black">
      <div className="absolute inset-0 bg-gradient-to-br from-pink-200 via-purple-200 to-indigo-200" />
      <div className="absolute top-20 left-20 w-72 h-72 bg-pink-400/30 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-20 w-72 h-72 bg-purple-400/30 rounded-full blur-3xl" />

      {/* ── ZOOM IMAGE ── */}
      <AnimatePresence>
        {zoomedImage && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
            onClick={() => setZoomedImage(null)}
          >
            <motion.div
              initial={{ scale: 0.8 }} animate={{ scale: 1 }} exit={{ scale: 0.8 }}
              className="relative max-w-lg w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <button onClick={() => setZoomedImage(null)} className="absolute -top-4 -right-4 bg-white rounded-full p-2 shadow-lg hover:bg-gray-100 transition z-10">
                <X className="w-5 h-5 text-gray-700" />
              </button>
              <img src={zoomedImage} alt="Product zoom" className="w-full rounded-3xl shadow-2xl object-contain max-h-[80vh]" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 px-6 py-16 max-w-5xl mx-auto">
        <AnimatePresence mode="wait">

          {/* ══════════════════════════════
              VIEW 1 — DISCUSSION LIST
          ══════════════════════════════ */}
          {view === "list" && (
            <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <h1 className="text-5xl md:text-7xl font-extrabold text-center text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 drop-shadow-lg">
                Discussions
              </h1>
              <p className="text-center text-gray-800 mt-4 text-lg">
                Ask, share, and discover real experiences about cosmetic products
              </p>
              <div className="flex justify-center gap-4 mt-8">
                <Button onClick={() => setView("products")} className="flex items-center gap-2 rounded-2xl px-6 bg-gradient-to-r from-pink-500 to-purple-500 text-white hover:scale-105 transition">
                  <Plus /> New Post
                </Button>
              </div>
              <div className="mt-12 space-y-6">
                {loading && <p className="text-center text-gray-600">Loading discussions...</p>}
                {!loading && discussions.length === 0 && <p className="text-center text-gray-600">Be the first to share an experience! 💬</p>}
                {discussions.map((post, i) => renderDiscussion(post, false, i))}
              </div>
            </motion.div>
          )}

          {/* ══════════════════════════════
              VIEW 2 — PRODUCT SELECTION
          ══════════════════════════════ */}
          {view === "products" && (
            <motion.div key="products" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>

              {/* Header */}
              <div className="flex items-center gap-4 mb-6">
                <button
                  onClick={() => { setView("list"); setSearchQuery(""); }}
                  className="flex items-center gap-2 text-purple-600 hover:text-pink-500 transition font-semibold"
                >
                  <ArrowLeft className="w-5 h-5" /> Back
                </button>
                <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-purple-500">
                  Choose a Product
                </h2>
              </div>

              <p className="text-gray-700 mb-6 text-center">
                Select a product to start a discussion or leave a review ✨
              </p>

              {/* ── BARRE DE RECHERCHE ── */}
              <div style={{ position: "relative", marginBottom: "28px" }}>
                <Search
                  style={{
                    position: "absolute", left: "16px", top: "50%",
                    transform: "translateY(-50%)", pointerEvents: "none",
                    width: "18px", height: "18px", color: "#a855f7",
                  }}
                />
                <input
                  type="text"
                  placeholder="Search a product by name or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                  style={{
                    width: "100%",
                    padding: "14px 44px 14px 46px",
                    borderRadius: "50px",
                    border: "1.5px solid rgba(168,85,247,0.25)",
                    background: "rgba(255,255,255,0.75)",
                    backdropFilter: "blur(12px)",
                    outline: "none",
                    fontSize: "0.95rem",
                    color: "#5d1c7e",
                    boxSizing: "border-box" as const,
                    boxShadow: "0 4px 20px rgba(168,85,247,0.1)",
                    transition: "border-color 0.2s, box-shadow 0.2s",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "rgba(168,85,247,0.6)";
                    e.target.style.boxShadow = "0 4px 20px rgba(168,85,247,0.2)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = "rgba(168,85,247,0.25)";
                    e.target.style.boxShadow = "0 4px 20px rgba(168,85,247,0.1)";
                  }}
                />
                {/* Clear button */}
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    style={{
                      position: "absolute", right: "16px", top: "50%",
                      transform: "translateY(-50%)",
                      background: "rgba(168,85,247,0.1)",
                      border: "none", cursor: "pointer",
                      color: "#a855f7", fontSize: "0.75rem",
                      width: "24px", height: "24px",
                      borderRadius: "50%",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Compteur résultats */}
              {searchQuery && (
                <p style={{
                  fontSize: "0.82rem", color: "#9c6db0",
                  marginBottom: "16px", textAlign: "center",
                }}>
                  {filteredProducts.length > 0
                    ? `${filteredProducts.length} product${filteredProducts.length > 1 ? "s" : ""} found for "${searchQuery}"`
                    : `No product found for "${searchQuery}"`
                  }
                </p>
              )}

              {/* Aucun résultat */}
              {filteredProducts.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{ textAlign: "center", padding: "60px 0", color: "#9c6db0" }}
                >
                  <div style={{ fontSize: "3.5rem", marginBottom: 16 }}>🔍</div>
                  <p style={{ fontWeight: 700, fontSize: "1.1rem", marginBottom: 8 }}>
                    No product found
                  </p>
                  <p style={{ fontSize: "0.85rem", opacity: 0.7 }}>
                    Try a different name or keyword
                  </p>
                  <button
                    onClick={() => setSearchQuery("")}
                    style={{
                      marginTop: "20px",
                      background: "linear-gradient(90deg, #ec4899, #a855f7)",
                      border: "none", borderRadius: "50px",
                      padding: "10px 24px", color: "white",
                      fontWeight: 700, cursor: "pointer", fontSize: "0.85rem",
                    }}
                  >
                    Clear search
                  </button>
                </motion.div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                  {filteredProducts.map((product, i) => {
                    const dc = dangerColor(product.dangerLevel);
                    return (
                      <motion.div
                        key={product.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="cursor-pointer group"
                      >
                        <div className="bg-white/60 backdrop-blur-xl rounded-3xl p-4 border border-white/40 shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-300 text-center">

                          {/* Image zoomable */}
                          <div
                            className="relative overflow-hidden rounded-2xl mb-3 bg-gray-50 h-36 flex items-center justify-center cursor-zoom-in"
                            onClick={(e) => { e.stopPropagation(); setZoomedImage(product.image); }}
                          >
                            <img
                              src={product.image}
                              alt={product.name.en}
                              className="h-full object-contain group-hover:scale-110 transition-transform duration-300"
                              onError={(e) => { (e.target as HTMLImageElement).src = "/products/placeholder.png"; }}
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all flex items-center justify-center">
                              <span className="opacity-0 group-hover:opacity-100 transition text-white text-2xl drop-shadow">🔍</span>
                            </div>
                          </div>

                          {/* Infos produit */}
                          <div onClick={() => handleSelectProduct(product)}>
                            <h3 className="font-bold text-gray-900 text-sm mb-1">
                              {highlightText(product.name.en, searchQuery)}
                            </h3>
                            <p className="text-xs text-gray-500 mb-2 line-clamp-2">
                              {highlightText(product.description.en, searchQuery)}
                            </p>
                            {dc && (
                              <span style={{
                                background: dc.bg, color: dc.text, border: `1px solid ${dc.border}`,
                                fontSize: "0.65rem", fontWeight: 700, padding: "2px 10px",
                                borderRadius: "50px", display: "inline-block",
                              }}>
                                {product.dangerLevel} risk
                              </span>
                            )}
                            <div className="mt-3 text-xs text-purple-500 font-semibold group-hover:text-pink-500 transition">
                              Discuss & Review →
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* ══════════════════════════════
              VIEW 3 — PRODUCT DISCUSSIONS
          ══════════════════════════════ */}
          {view === "product-detail" && selectedProduct && (
            <motion.div key="product-detail" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
              <div className="flex items-center gap-4 mb-6">
                <button
                  onClick={() => { setView("products"); setSelectedProduct(null); setProductDiscussions([]); }}
                  className="flex items-center gap-2 text-purple-600 hover:text-pink-500 transition font-semibold"
                >
                  <ArrowLeft className="w-5 h-5" /> Products
                </button>
              </div>

              {/* Card produit */}
              <div className="bg-white/50 backdrop-blur-xl rounded-3xl p-6 border border-white/40 shadow-xl mb-8 flex gap-6 items-center">
                <img
                  src={selectedProduct.image}
                  alt={selectedProduct.name.en}
                  className="w-24 h-24 object-contain rounded-2xl bg-gray-50 p-2 cursor-zoom-in hover:scale-105 transition"
                  onClick={() => setZoomedImage(selectedProduct.image)}
                  onError={(e) => { (e.target as HTMLImageElement).src = "/products/placeholder.png"; }}
                />
                <div className="flex-1">
                  <h2 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-purple-500">
                    {selectedProduct.name.en}
                  </h2>
                  <p className="text-gray-600 text-sm mt-1">{selectedProduct.description.en}</p>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    {dangerColor(selectedProduct.dangerLevel) && (
                      <span style={{
                        background: dangerColor(selectedProduct.dangerLevel)!.bg,
                        color: dangerColor(selectedProduct.dangerLevel)!.text,
                        border: `1px solid ${dangerColor(selectedProduct.dangerLevel)!.border}`,
                        fontSize: "0.72rem", fontWeight: 700, padding: "3px 12px",
                        borderRadius: "50px", display: "inline-block",
                      }}>
                        {selectedProduct.dangerLevel} risk
                      </span>
                    )}
                    {getAverageRating(productDiscussions) && (
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        <span className="text-sm font-bold text-gray-700">{getAverageRating(productDiscussions)}/5</span>
                        <span className="text-xs text-gray-500">({productDiscussions.filter(d => d.rating).length} reviews)</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-center mb-8">
                <Button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-2xl px-6 bg-gradient-to-r from-pink-500 to-purple-500 text-white hover:scale-105 transition">
                  <Plus /> Review & Discuss
                </Button>
              </div>

              <div className="space-y-6">
                {productLoading && <p className="text-center text-gray-600">Loading...</p>}
                {!productLoading && productDiscussions.length === 0 && (
                  <div className="text-center py-12">
                    <div className="text-4xl mb-3">💬</div>
                    <p className="text-gray-600">No reviews yet. Be the first!</p>
                  </div>
                )}
                {productDiscussions.map((post, i) => renderDiscussion(post, true, i))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── MODAL NOUVEAU POST ── */}
      {open && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white/90 backdrop-blur-2xl border border-white/40 p-6 rounded-[2.5rem] w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-purple-500">
                {selectedProduct ? `Review: ${selectedProduct.name.en}` : "Create New Post"}
              </h2>
              <button onClick={() => setOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              {selectedProduct && (
                <div>
                  <label className="text-xs font-bold text-gray-500 ml-2 mb-2 block">YOUR RATING</label>
                  <div className="flex gap-2 justify-center">
                    {[1,2,3,4,5].map(s => (
                      <button key={s} type="button"
                        onMouseEnter={() => setHoverRating(s)}
                        onMouseLeave={() => setHoverRating(0)}
                        onClick={() => setNewPost({ ...newPost, rating: s })}
                      >
                        <Star className={`w-8 h-8 transition-all ${s <= (hoverRating || newPost.rating) ? "fill-yellow-400 text-yellow-400 scale-110" : "text-gray-300"}`} />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {!selectedProduct && (
                <div>
                  <label className="text-xs font-bold text-gray-500 ml-2 mb-1 block">CATEGORY</label>
                  <input
                    placeholder="e.g. SVR, Skincare..."
                    className="w-full border border-pink-100 p-3 rounded-2xl text-sm bg-white outline-none focus:ring-2 ring-pink-400/50"
                    value={newPost.category}
                    onChange={(e) => setNewPost({ ...newPost, category: e.target.value })}
                  />
                </div>
              )}
              <div>
                <label className="text-xs font-bold text-gray-500 ml-2 mb-1 block">TITLE</label>
                <input
                  placeholder="Summarize your experience"
                  className="w-full border border-pink-100 p-3 rounded-2xl text-sm bg-white outline-none focus:ring-2 ring-pink-400/50"
                  value={newPost.title}
                  onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 ml-2 mb-1 block">YOUR EXPERIENCE</label>
                <textarea
                  placeholder="Describe your results, texture, etc..."
                  className="w-full border border-pink-100 p-3 rounded-2xl text-sm h-32 resize-none bg-white outline-none focus:ring-2 ring-pink-400/50"
                  value={newPost.content}
                  onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button variant="ghost" onClick={() => setOpen(false)} className="rounded-2xl px-6 text-gray-500 font-bold">Cancel</Button>
              <Button
                onClick={handlePost}
                disabled={posting}
                className="bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-2xl px-8 font-bold shadow-lg hover:scale-105 transition"
              >
                {posting ? "Posting..." : "Post Now"}
              </Button>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
}
