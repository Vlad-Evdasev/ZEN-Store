import { useState, useEffect, useCallback } from "react";
import {
  getPosts,
  togglePostLike,
  type Post,
} from "../api";
import { useSettings, type Lang } from "../context/SettingsContext";
import { t } from "../i18n";

interface NewArrivalsPageProps {
  userId: string;
  onBack: () => void;
}

function HeartIcon({ filled }: { filled: boolean }) {
  if (filled) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="#ef4444" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function formatPostDate(dateStr: string, lang: Lang): string {
  const months: Record<string, string[]> = {
    ru: ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"],
    en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  };
  const d = new Date(dateStr);
  const day = d.getDate();
  const monthArr = months[lang] ?? months.ru;
  return `${day} ${monthArr[d.getMonth()]}`;
}

interface PostCardProps {
  post: Post;
  userId: string;
  lang: Lang;
  onPreview: (src: string) => void;
  onLikeToggle: (postId: number, newLiked: boolean, newCount: number) => void;
}

function PostCard({
  post,
  userId,
  lang,
  onPreview,
  onLikeToggle,
}: PostCardProps) {
  const imageSrc = post.image_data || post.image_url;

  const handleLike = async () => {
    const wasLiked = post.user_liked;
    const prevCount = post.likes_count;
    onLikeToggle(post.id, !wasLiked, wasLiked ? prevCount - 1 : prevCount + 1);
    try {
      const result = await togglePostLike(post.id, userId);
      onLikeToggle(post.id, result.liked, result.likes_count);
    } catch {
      onLikeToggle(post.id, wasLiked, prevCount);
    }
  };

  return (
    <div style={cardStyles.card}>
      {imageSrc && (
        <div
          style={cardStyles.imageWrap}
          onClick={() => onPreview(imageSrc)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter") onPreview(imageSrc); }}
          aria-label="Открыть фото"
        >
          <img src={imageSrc} alt="" style={cardStyles.image} />
        </div>
      )}

      <div style={cardStyles.body}>
        {post.caption && <p style={cardStyles.caption}>{post.caption}</p>}
        <div style={cardStyles.metaRow}>
          <div style={cardStyles.actions}>
            <button
              type="button"
              onClick={handleLike}
              style={cardStyles.actionBtn}
              aria-label={post.user_liked ? "Unlike" : "Like"}
            >
              <HeartIcon filled={post.user_liked} />
              {post.likes_count > 0 && (
                <span style={cardStyles.actionCount}>{post.likes_count}</span>
              )}
            </button>
          </div>
          <span style={cardStyles.date}>{formatPostDate(post.created_at, lang)}</span>
        </div>
      </div>
    </div>
  );
}

function PostImageLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0, 0, 0, 0.92)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16, cursor: "zoom-out",
      }}
    >
      <img
        src={src}
        alt=""
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 12 }}
      />
      <button
        type="button"
        onClick={onClose}
        aria-label="Закрыть"
        style={{
          position: "absolute", top: 14, right: 14,
          width: 40, height: 40, borderRadius: "50%",
          background: "rgba(255,255,255,0.14)", color: "#fff",
          border: "none", cursor: "pointer", fontSize: 22, lineHeight: 1,
          backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
        }}
      >×</button>
    </div>
  );
}

const SKELETON_HEIGHTS = [140, 100, 120, 90] as const;

function SkeletonCard({ index = 0 }: { index?: number }) {
  const h = SKELETON_HEIGHTS[index % SKELETON_HEIGHTS.length];
  return (
    <div style={pageStyles.masonryItem}>
      <div style={cardStyles.card}>
        <div style={{ ...skeletonStyles.image, height: h }} />
        <div style={cardStyles.body}>
          <div style={skeletonStyles.line1} />
          <div style={skeletonStyles.line2} />
        </div>
      </div>
    </div>
  );
}

export function NewArrivalsPage({
  userId,
}: Omit<NewArrivalsPageProps, "onBack"> & { onBack?: NewArrivalsPageProps["onBack"] }) {
  const { settings } = useSettings();
  const lang = settings.lang;
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getPosts(userId)
      .then((data) => {
        if (!cancelled) setPosts(data);
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [userId]);

  const handleLikeToggle = useCallback(
    (postId: number, newLiked: boolean, newCount: number) => {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, user_liked: newLiked, likes_count: newCount }
            : p
        )
      );
    },
    []
  );

  return (
    <div style={pageStyles.wrap}>
      <div style={pageStyles.headerArea}>
        <div style={pageStyles.bubbleRow}>
          <div style={pageStyles.avatar}>R</div>
          <div style={pageStyles.bubbleMain}>
            <div style={pageStyles.bubbleTitle}>{t(lang, "postsInspireTitle")}</div>
            <div style={pageStyles.bubbleSubtitle}>{t(lang, "postsInspireSubtitle")}</div>
          </div>
        </div>
        {!loading && posts.length > 0 && (
          <div style={pageStyles.bubbleSmall}>{t(lang, "postsInspireScrollHint")}</div>
        )}
      </div>

      {loading && (
        <div style={pageStyles.feedMasonry}>
          <SkeletonCard index={0} />
          <SkeletonCard index={1} />
          <SkeletonCard index={2} />
          <SkeletonCard index={3} />
        </div>
      )}

      {!loading && posts.length === 0 && (
        <div style={pageStyles.empty}>
          <span style={pageStyles.emptyText}>{t(lang, "postsEmpty")}</span>
        </div>
      )}

      {!loading && posts.length > 0 && (
        <div style={pageStyles.feedMasonry}>
          {posts.map((post) => (
            <div key={post.id} style={pageStyles.masonryItem}>
              <PostCard
                post={post}
                userId={userId}
                lang={lang}
                onPreview={setPreviewImage}
                onLikeToggle={handleLikeToggle}
              />
            </div>
          ))}
        </div>
      )}

      {previewImage && <PostImageLightbox src={previewImage} onClose={() => setPreviewImage(null)} />}
    </div>
  );
}

const pageStyles: Record<string, React.CSSProperties> = {
  wrap: {
    maxWidth: 480,
    margin: "0 auto",
    padding: "8px 0 calc(96px + env(safe-area-inset-bottom, 0px))",
  },
  headerArea: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
    marginBottom: 16,
  },
  bubbleRow: {
    display: "flex",
    alignItems: "flex-end",
    gap: 8,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: "50%",
    background: "var(--accent)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: "0.06em",
    flexShrink: 0,
    marginBottom: 0,
  },
  bubbleMain: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "16px 16px 16px 4px",
    padding: "10px 13px",
    maxWidth: "86%",
    boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
  },
  bubbleTitle: {
    fontSize: 15,
    fontWeight: 600,
    lineHeight: 1.2,
    letterSpacing: "-0.01em",
    color: "var(--text)",
  },
  bubbleSubtitle: {
    fontSize: 12.5,
    color: "var(--muted)",
    marginTop: 4,
    lineHeight: 1.4,
  },
  bubbleSmall: {
    alignSelf: "flex-start",
    marginLeft: 38,
    marginTop: 2,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 14,
    padding: "6px 12px",
    fontSize: 12,
    color: "var(--text)",
    maxWidth: "75%",
  },
  feedMasonry: {
    columnCount: 2,
    columnGap: 10,
  },
  masonryItem: {
    breakInside: "avoid",
    pageBreakInside: "avoid",
    marginBottom: 10,
    display: "block",
  },
  empty: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 200,
  },
  emptyText: {
    fontSize: 15,
    color: "var(--muted)",
    fontWeight: 500,
  },
};

const cardStyles: Record<string, React.CSSProperties> = {
  card: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 14,
    overflow: "hidden",
  },
  imageWrap: {
    position: "relative" as const,
    width: "100%",
    cursor: "pointer",
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "auto",
    objectFit: "cover" as const,
    display: "block",
  },
  shopOverlay: {
    position: "absolute" as const,
    bottom: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: "50%",
    background: "rgba(0,0,0,0.5)",
    backdropFilter: "blur(6px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    padding: "8px 10px 10px",
  },
  metaRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  actions: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  actionBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    background: "none",
    border: "none",
    padding: 0,
    color: "var(--text)",
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: 12,
    fontWeight: 500,
  },
  actionCount: {
    fontSize: 12,
    fontWeight: 600,
    color: "var(--text)",
  },
  date: {
    fontSize: 11,
    color: "var(--muted)",
    fontWeight: 400,
  },
  caption: {
    fontSize: 12.5,
    color: "var(--text)",
    lineHeight: 1.4,
    margin: 0,
    whiteSpace: "pre-wrap" as const,
    overflow: "hidden",
    display: "-webkit-box",
    WebkitLineClamp: 3,
    WebkitBoxOrient: "vertical" as const,
  },
  commentsSection: {
    marginTop: 12,
    borderTop: "1px solid var(--border)",
    paddingTop: 10,
  },
  commentsLoading: {
    fontSize: 13,
    color: "var(--muted)",
    padding: "4px 0",
  },
  commentsList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
    marginBottom: 10,
  },
  commentItem: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 1,
  },
  commentAuthor: {
    fontWeight: 700,
    fontSize: 13,
    color: "var(--text)",
  },
  commentText: {
    fontSize: 13,
    color: "var(--text)",
    fontWeight: 400,
  },
  commentDate: {
    fontSize: 11,
    color: "var(--muted)",
  },
  commentInputRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  commentInput: {
    flex: 1,
    padding: "8px 12px",
    fontSize: 13,
    fontFamily: "inherit",
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    color: "var(--text)",
    outline: "none",
  },
  commentSendBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 34,
    height: 34,
    flexShrink: 0,
    borderRadius: "50%",
    background: "var(--accent)",
    border: "none",
    color: "#fff",
    cursor: "pointer",
    transition: "opacity 0.15s",
  },
};

const skeletonBg = "var(--border)";

const skeletonStyles: Record<string, React.CSSProperties> = {
  image: {
    width: "100%",
    background: skeletonBg,
    borderRadius: 0,
  },
  line1: {
    width: "60%",
    height: 14,
    borderRadius: 6,
    background: skeletonBg,
    marginBottom: 8,
  },
  line2: {
    width: "40%",
    height: 12,
    borderRadius: 6,
    background: skeletonBg,
  },
};
