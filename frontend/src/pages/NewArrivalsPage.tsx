import { useState, useEffect, useCallback, useRef } from "react";
import {
  getPosts,
  togglePostLike,
  getPostComments,
  addPostComment,
  type Post,
  type PostComment,
} from "../api";
import { useSettings, type Lang } from "../context/SettingsContext";
import { t } from "../i18n";

interface NewArrivalsPageProps {
  userId: string;
  userName: string | null;
  firstName: string;
  onBack: () => void;
  onProductClick: (id: number) => void;
}

function HeartIcon({ filled }: { filled: boolean }) {
  if (filled) {
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="#ef4444" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    );
  }
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function CommentBubbleIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function ShopBagIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="rgba(255,255,255,0.9)" stroke="rgba(255,255,255,0.9)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
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
  userName: string | null;
  firstName: string;
  lang: Lang;
  onProductClick: (id: number) => void;
  onLikeToggle: (postId: number, newLiked: boolean, newCount: number) => void;
  onCommentsCountChange: (postId: number, newCount: number) => void;
}

function PostCard({
  post,
  userId,
  userName,
  firstName,
  lang,
  onProductClick,
  onLikeToggle,
  onCommentsCountChange,
}: PostCardProps) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const commentInputRef = useRef<HTMLInputElement>(null);

  const imageSrc = post.image_data || post.image_url;
  const isTappable = post.product_id != null || post.product_url != null;

  const handleImageTap = () => {
    if (post.product_id != null) {
      onProductClick(post.product_id);
    } else if (post.product_url) {
      window.open(post.product_url, "_blank", "noopener");
    }
  };

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

  const handleToggleComments = async () => {
    const opening = !commentsOpen;
    setCommentsOpen(opening);
    if (opening && !commentsLoaded) {
      setLoadingComments(true);
      try {
        const data = await getPostComments(post.id);
        setComments(data);
        setCommentsLoaded(true);
      } catch {
        /* silently fail */
      } finally {
        setLoadingComments(false);
      }
    }
    if (opening) {
      setTimeout(() => commentInputRef.current?.focus(), 100);
    }
  };

  const handleSendComment = async () => {
    const text = commentText.trim();
    if (!text || sendingComment) return;
    setSendingComment(true);
    try {
      const newComment = await addPostComment(post.id, userId, userName || firstName, text);
      setComments((prev) => [...prev, newComment]);
      setCommentText("");
      onCommentsCountChange(post.id, comments.length + 1);
    } catch {
      /* silently fail */
    } finally {
      setSendingComment(false);
    }
  };

  return (
    <div style={cardStyles.card}>
      {imageSrc && (
        <div
          style={cardStyles.imageWrap}
          onClick={isTappable ? handleImageTap : undefined}
          role={isTappable ? "button" : undefined}
          tabIndex={isTappable ? 0 : undefined}
          onKeyDown={isTappable ? (e) => { if (e.key === "Enter") handleImageTap(); } : undefined}
          aria-label={isTappable ? "Open product" : undefined}
        >
          <img src={imageSrc} alt="" style={cardStyles.image} />
          {isTappable && (
            <div style={cardStyles.shopOverlay}>
              <ShopBagIcon />
            </div>
          )}
        </div>
      )}

      <div style={cardStyles.body}>
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
            <button
              type="button"
              onClick={handleToggleComments}
              style={cardStyles.actionBtn}
              aria-label={t(lang, "postShowComments")}
            >
              <CommentBubbleIcon />
              {post.comments_count > 0 && (
                <span style={cardStyles.actionCount}>{post.comments_count}</span>
              )}
            </button>
          </div>
          <span style={cardStyles.date}>{formatPostDate(post.created_at, lang)}</span>
        </div>

        {post.caption && <p style={cardStyles.caption}>{post.caption}</p>}

        {commentsOpen && (
          <div style={cardStyles.commentsSection}>
            {loadingComments && (
              <div style={cardStyles.commentsLoading}>...</div>
            )}
            {!loadingComments && comments.length > 0 && (
              <div style={cardStyles.commentsList}>
                {comments.map((c) => (
                  <div key={c.id} style={cardStyles.commentItem}>
                    <div>
                      <span style={cardStyles.commentAuthor}>{c.user_name || "—"}</span>{" "}
                      <span style={cardStyles.commentText}>{c.text}</span>
                    </div>
                    <span style={cardStyles.commentDate}>{formatPostDate(c.created_at, lang)}</span>
                  </div>
                ))}
              </div>
            )}
            <div style={cardStyles.commentInputRow}>
              <input
                ref={commentInputRef}
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSendComment(); }}
                placeholder={t(lang, "postCommentPlaceholder")}
                style={cardStyles.commentInput}
                disabled={sendingComment}
              />
              <button
                type="button"
                onClick={handleSendComment}
                disabled={sendingComment || !commentText.trim()}
                style={{
                  ...cardStyles.commentSendBtn,
                  opacity: sendingComment || !commentText.trim() ? 0.4 : 1,
                }}
                aria-label={t(lang, "postCommentSend")}
              >
                <SendIcon />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div style={cardStyles.card}>
      <div style={skeletonStyles.image} />
      <div style={cardStyles.body}>
        <div style={skeletonStyles.line1} />
        <div style={skeletonStyles.line2} />
      </div>
    </div>
  );
}

export function NewArrivalsPage({
  userId,
  userName,
  firstName,
  onBack,
  onProductClick,
}: NewArrivalsPageProps) {
  const { settings } = useSettings();
  const lang = settings.lang;
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

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

  const handleCommentsCountChange = useCallback(
    (postId: number, newCount: number) => {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, comments_count: newCount } : p
        )
      );
    },
    []
  );

  return (
    <div style={pageStyles.wrap}>
      <div style={pageStyles.headerArea}>
        <button
          type="button"
          onClick={onBack}
          style={pageStyles.backBtn}
        >
          ← {t(lang, "backToMain")}
        </button>
        <h1 style={pageStyles.title}>{t(lang, "postsFeedTitle")}</h1>
        <div style={pageStyles.divider} />
      </div>

      {loading && (
        <div style={pageStyles.feed}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {!loading && posts.length === 0 && (
        <div style={pageStyles.empty}>
          <span style={pageStyles.emptyText}>{t(lang, "postsEmpty")}</span>
        </div>
      )}

      {!loading && posts.length > 0 && (
        <div style={pageStyles.feed}>
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              userId={userId}
              userName={userName}
              firstName={firstName}
              lang={lang}
              onProductClick={onProductClick}
              onLikeToggle={handleLikeToggle}
              onCommentsCountChange={handleCommentsCountChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const pageStyles: Record<string, React.CSSProperties> = {
  wrap: {
    maxWidth: 480,
    margin: "0 auto",
    paddingBottom: 32,
  },
  headerArea: {
    marginBottom: 20,
  },
  backBtn: {
    display: "block",
    marginLeft: "auto",
    background: "none",
    border: "none",
    color: "var(--muted)",
    fontFamily: "inherit",
    fontSize: 14,
    cursor: "pointer",
    padding: 0,
    marginBottom: 16,
    textAlign: "right" as const,
  },
  title: {
    fontSize: 22,
    fontWeight: 800,
    color: "var(--text)",
    margin: 0,
    lineHeight: 1.25,
    letterSpacing: "-0.02em",
  },
  divider: {
    height: 1,
    background: "var(--border)",
    marginTop: 12,
    opacity: 0.5,
  },
  feed: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 24,
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
    borderRadius: "var(--radius-lg)",
    overflow: "hidden",
  },
  imageWrap: {
    position: "relative" as const,
    width: "100%",
    aspectRatio: "1 / 1",
    cursor: "pointer",
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
    objectFit: "cover" as const,
    display: "block",
  },
  shopOverlay: {
    position: "absolute" as const,
    bottom: 10,
    right: 10,
    width: 34,
    height: 34,
    borderRadius: "50%",
    background: "rgba(0,0,0,0.5)",
    backdropFilter: "blur(6px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    padding: "12px 14px 14px",
  },
  metaRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  actions: {
    display: "flex",
    alignItems: "center",
    gap: 14,
  },
  actionBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    background: "none",
    border: "none",
    padding: 0,
    color: "var(--text)",
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: 13,
    fontWeight: 500,
  },
  actionCount: {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--text)",
  },
  date: {
    fontSize: 12,
    color: "var(--muted)",
    fontWeight: 400,
  },
  caption: {
    fontSize: 14,
    color: "var(--text)",
    lineHeight: 1.5,
    margin: 0,
    whiteSpace: "pre-wrap" as const,
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
    aspectRatio: "1 / 1",
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
