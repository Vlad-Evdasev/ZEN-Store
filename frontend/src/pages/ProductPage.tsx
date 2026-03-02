import { useState, useEffect } from "react";
import { addToCart, getProductReviews, addProductReview, type Product, type ProductReview } from "../api";
import { useSettings } from "../context/SettingsContext";

interface ProductPageProps {
  product: Product | undefined;
  onBack: () => void;
  onCart: () => void;
  onAddedToCart?: () => void;
  userId: string;
  userName?: string;
  inWishlist: boolean;
  onToggleWishlist: () => void;
}

function formatDate(s: string) {
  try {
    const d = new Date(s);
    return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return s;
  }
}

export function ProductPage({
  product,
  onBack,
  onCart,
  onAddedToCart,
  userId,
  userName,
  inWishlist,
  onToggleWishlist,
}: ProductPageProps) {
  const { formatPrice } = useSettings();
  const [size, setSize] = useState<string>("");
  const [adding, setAdding] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [reviewText, setReviewText] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);

  const sizes = product ? product.sizes.split(",").map((s) => s.trim()) : [];
  
  useEffect(() => {
    if (product && sizes.length) setSize(sizes[0]);
  }, [product?.id]);

  useEffect(() => {
    if (product) {
      getProductReviews(product.id).then(setReviews).catch(console.error);
    }
  }, [product?.id]);

  const handleAddReview = async () => {
    if (!product || !reviewText.trim()) return;
    setSubmittingReview(true);
    try {
      await addProductReview(product.id, userId, {
        user_name: userName || "Гость",
        rating: reviewRating,
        text: reviewText.trim(),
      });
      setReviewText("");
      setReviewRating(5);
      setShowReviewForm(false);
      const updated = await getProductReviews(product.id);
      setReviews(updated);
    } catch (e) {
      console.error(e);
    } finally {
      setSubmittingReview(false);
    }
  };

  const avgRating = reviews.length > 0
    ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
    : null;

  if (!product) {
    return (
      <div style={styles.loading}>
        <p>Загрузка...</p>
      </div>
    );
  }

  const handleAdd = async () => {
    if (!size) return;
    setAdding(true);
    setJustAdded(false);
    try {
      await addToCart(userId, product.id, size);
      onAddedToCart?.();
      setJustAdded(true);
    } catch (e) {
      console.error(e);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div style={styles.wrap}>
      <div style={styles.topBar}>
        <button onClick={onBack} style={styles.back}>
          ← Назад
        </button>
        <button
          onClick={onToggleWishlist}
          style={{ ...styles.wishlistBtn, color: inWishlist ? "var(--accent)" : "var(--muted)" }}
        >
          {inWishlist ? "♥" : "♡"}
        </button>
      </div>

      <div style={styles.imageWrap}>
        <img
          src={product.image_url || "https://via.placeholder.com/400"}
          alt={product.name}
          style={styles.image}
        />
      </div>

      <h1 style={styles.title}>{product.name}</h1>
      <p style={styles.desc}>{product.description}</p>

      <div style={styles.sizeSection}>
        <p style={styles.label}>Размер</p>
        <div style={styles.sizes}>
          {sizes.map((s) => (
            <button
              key={s}
              onClick={() => setSize(s)}
              style={{
                ...styles.sizeBtn,
                ...(size === s ? styles.sizeBtnActive : {}),
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div style={styles.footer}>
        <span style={styles.price}>{formatPrice(product.price)}</span>
        {justAdded ? (
          <button onClick={onCart} style={styles.addBtn}>
            Перейти в корзину
          </button>
        ) : (
          <button onClick={handleAdd} disabled={adding} style={styles.addBtn}>
            {adding ? "..." : "В корзину"}
          </button>
        )}
      </div>

      <div style={styles.reviewsSection}>
        <div style={styles.reviewsHeader}>
          <h3 style={styles.reviewsTitle}>
            Отзывы {reviews.length > 0 && `(${reviews.length})`}
            {avgRating != null && <span style={styles.avgRating}> ★ {avgRating}</span>}
          </h3>
          {!showReviewForm && (
            <button onClick={() => setShowReviewForm(true)} type="button" style={styles.addReviewBtn}>
              Оставить отзыв
            </button>
          )}
        </div>

        {showReviewForm && (
          <div style={styles.reviewForm}>
            <div style={styles.ratingRow}>
              <span style={styles.ratingLabel}>Оценка:</span>
              {[1, 2, 3, 4, 5].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReviewRating(r)}
                  style={{ ...styles.starBtn, color: r <= reviewRating ? "var(--accent)" : "var(--muted)" }}
                >
                  ★
                </button>
              ))}
            </div>
            <textarea
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="Напишите отзыв о товаре..."
              rows={3}
              style={styles.reviewTextarea}
            />
            <div style={styles.reviewFormActions}>
              <button type="button" onClick={handleAddReview} disabled={submittingReview} style={styles.submitReviewBtn}>
                {submittingReview ? "..." : "Отправить"}
              </button>
              <button type="button" onClick={() => { setShowReviewForm(false); setReviewText(""); }} style={styles.cancelReviewBtn}>
                Отмена
              </button>
            </div>
          </div>
        )}

        {reviews.length === 0 && !showReviewForm && (
          <p style={styles.noReviews}>Пока нет отзывов. Будьте первым!</p>
        )}

        <div style={styles.reviewsList}>
          {reviews.map((r) => (
            <div key={r.id} style={styles.reviewItem}>
              <div style={styles.reviewItemHead}>
                <span style={styles.reviewAuthor}>{r.user_name || "Гость"}</span>
                <span style={styles.reviewDate}>{formatDate(r.created_at)}</span>
              </div>
              <div style={styles.reviewStars}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <span key={s} style={{ color: s <= r.rating ? "var(--accent)" : "var(--muted)", fontSize: 12 }}>★</span>
                ))}
              </div>
              <p style={styles.reviewItemText}>{r.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: 420, margin: "0 auto", paddingBottom: 24 },
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  back: {
    background: "none",
    border: "none",
    color: "var(--muted)",
    fontFamily: "inherit",
    fontSize: 14,
    cursor: "pointer",
  },
  wishlistBtn: {
    background: "none",
    border: "none",
    fontSize: 24,
    cursor: "pointer",
  },
  imageWrap: {
    borderRadius: 12,
    overflow: "hidden",
    background: "var(--surface)",
    aspectRatio: "1",
    marginBottom: 24,
  },
  image: { width: "100%", height: "100%", objectFit: "cover" },
  title: {
    fontFamily: "Unbounded, sans-serif",
    fontSize: 22,
    fontWeight: 600,
    marginBottom: 8,
    letterSpacing: "-0.02em",
  },
  desc: {
    color: "var(--muted)",
    fontSize: 14,
    lineHeight: 1.6,
    marginBottom: 24,
  },
  sizeSection: { marginBottom: 24 },
  label: {
    fontSize: 12,
    color: "var(--muted)",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  sizes: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  sizeBtn: {
    padding: "12px 18px",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    color: "var(--text)",
    fontFamily: "inherit",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
  },
  sizeBtnActive: {
    borderColor: "var(--accent)",
    color: "var(--accent)",
    background: "rgba(196, 30, 58, 0.1)",
  },
  footer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  price: {
    fontSize: 22,
    fontWeight: 700,
    color: "var(--accent)",
  },
  addBtn: {
    flex: 1,
    padding: 16,
    background: "var(--accent)",
    border: "none",
    borderRadius: 10,
    color: "#ffffff",
    fontFamily: "inherit",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
  },
  loading: {
    textAlign: "center",
    padding: 48,
    color: "var(--muted)",
  },
  reviewsSection: {
    marginTop: 32,
    paddingTop: 24,
    borderTop: "1px solid var(--border)",
  },
  reviewsHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  reviewsTitle: {
    fontSize: 16,
    fontWeight: 600,
  },
  avgRating: {
    color: "var(--accent)",
    fontWeight: 500,
  },
  addReviewBtn: {
    padding: "8px 14px",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    color: "var(--text)",
    fontSize: 13,
    cursor: "pointer",
  },
  reviewForm: {
    marginBottom: 20,
    padding: 16,
    background: "var(--surface)",
    borderRadius: 12,
    border: "1px solid var(--border)",
  },
  ratingRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  ratingLabel: {
    fontSize: 13,
    color: "var(--muted)",
  },
  starBtn: {
    background: "none",
    border: "none",
    fontSize: 18,
    cursor: "pointer",
  },
  reviewTextarea: {
    width: "100%",
    padding: 12,
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    color: "var(--text)",
    fontSize: 14,
    fontFamily: "inherit",
    marginBottom: 12,
    resize: "vertical",
  },
  reviewFormActions: {
    display: "flex",
    gap: 8,
  },
  submitReviewBtn: {
    padding: "10px 16px",
    background: "var(--accent)",
    border: "none",
    borderRadius: 8,
    color: "#fff",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  cancelReviewBtn: {
    padding: "10px 16px",
    background: "none",
    border: "1px solid var(--border)",
    borderRadius: 8,
    color: "var(--muted)",
    fontSize: 13,
    cursor: "pointer",
  },
  noReviews: {
    textAlign: "center",
    color: "var(--muted)",
    fontSize: 14,
    padding: 24,
  },
  reviewsList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  reviewItem: {
    padding: 14,
    background: "var(--surface)",
    borderRadius: 10,
    border: "1px solid var(--border)",
  },
  reviewItemHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  reviewAuthor: {
    fontWeight: 600,
    fontSize: 13,
  },
  reviewDate: {
    fontSize: 11,
    color: "var(--muted)",
  },
  reviewStars: {
    marginBottom: 6,
  },
  reviewItemText: {
    fontSize: 13,
    lineHeight: 1.5,
    color: "var(--text)",
  },
};
