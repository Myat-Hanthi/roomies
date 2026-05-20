import axios from "axios";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { API } from "../lib/api";
import { supabase } from "../lib/supabase";

type DbPost = {
  id: string;
  user_id?: string;
  full_address?: string;
  post_type: string;
  district: string;
  room_type?: string | null;
  monthly_rent: number;
  deposit: number;
  available_from: string;
  available_until?: string | null;
  gender_preference: string;
  lifestyle_tags: string[];
  description_en: string;
  description_ko: string;
  photos: string[];
  status: "active" | "closed";
  created_at: string;
  users?: {
    name?: string;
    university?: string;
    is_verified?: boolean;
    profile_photo?: string | null;
  };
};

const postTypeLabels: Record<string, string> = {
  room_available: "Room Available",
  looking_for_room: "Looking for Room",
  sublet: "Short-term Rental",
  lease_takeover: "Contract Transfer",
};

const roomTypeLabels: Record<string, string> = {
  studio: "Studio",
  one_room: "One Room",
  officetel: "Officetel",
  apartment: "Apartment",
  shared_house: "Shared House",
};

function formatDate(value?: string | null) {
  if (!value) return "-";

  return new Date(value).toLocaleDateString("en-CA");
}

function normalizePhotos(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }

  if (typeof value !== "string" || !value.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
    }
  } catch {
    // Fall back to treating the value as one URL or a comma-separated list.
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getRequestErrorMessage(err: any, fallback: string): string {
  if (err?.response?.data?.message) return err.response.data.message;
  if (err?.code === "ERR_NETWORK") return `Cannot connect to backend at ${API}. Please start the backend server.`;
  return err?.message || fallback;
}

async function getToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || "";
}

export default function PostDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [post, setPost] = useState<DbPost | null>(null);
  const [currentUserId, setCurrentUserId] = useState("");
  const [selectedPhoto, setSelectedPhoto] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  const loadPost = useCallback(async () => {
    if (!id) return;

    setLoading(true);
    setError("");

    try {
      const token = await getToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

      const [{ data: postRes }, { data: userRes }] = await Promise.all([
        axios.get(`${API}/posts/${id}`, headers ? { headers } : undefined),
        supabase.auth.getUser(),
      ]);

      const photos = normalizePhotos(postRes.photos);
      setPost({ ...postRes, photos });
      setCurrentUserId(userRes.user?.id || "");
      setSelectedPhoto(photos[0] || "");
    } catch (err: any) {
      setError(getRequestErrorMessage(err, "Failed to load post."));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadPost();
  }, [loadPost]);

  const handleInterest = async () => {
    if (!post) return;

    setActionLoading(true);
    setError("");

    try {
      const token = await getToken();
      await axios.post(
        `${API}/matches/request`,
        { post_id: post.id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert("Interest request has been sent.");
    } catch (err: any) {
      setError(getRequestErrorMessage(err, "Failed to send interest request."));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!post) return;
    if (!window.confirm("Delete this post? This action cannot be undone.")) return;

    setActionLoading(true);
    setError("");

    try {
      const token = await getToken();
      await axios.delete(`${API}/posts/${post.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      navigate("/browse");
    } catch (err: any) {
      setError(getRequestErrorMessage(err, "Failed to delete post."));
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <div style={styles.loadingPage}>Loading post...</div>;
  }

  if (!post) {
    return (
      <div style={styles.page}>
        <main style={styles.notFoundBox}>
          <h1 style={styles.notFoundTitle}>Post Not Found</h1>
          <p style={styles.notFoundText}>{error || "This post may have been removed."}</p>
          <button style={styles.mainBtn} onClick={() => navigate("/browse")}>
            Back to Browse
          </button>
        </main>
      </div>
    );
  }

  const isOwner = post.user_id === currentUserId;
  const writerName = post.users?.name || "Student";

  return (
    <div style={styles.page}>
      <div style={styles.bgAccent} />

      <nav style={styles.nav}>
        <p style={styles.brand}>roomies</p>
        <div style={styles.navRight}>
          <button style={styles.navLink} onClick={() => navigate("/browse")}>Browse</button>
          <button style={styles.navLink} onClick={() => navigate("/matches")}>Matches</button>
          <button style={styles.navLink} onClick={() => navigate("/chat")}>Chat</button>
          <button style={styles.navLink} onClick={() => navigate("/review")}>Review</button>
          <button style={styles.navLink} onClick={() => navigate("/profile")}>Profile</button>
        </div>
      </nav>

      <main style={styles.container}>
        <button style={styles.backBtn} onClick={() => navigate("/browse")}>
          Back to Browse
        </button>

        {error && <div style={styles.errorBox}>{error}</div>}

        <section style={styles.photoPanel}>
          <div style={styles.mainPhotoBox}>
            {selectedPhoto ? (
              <img src={selectedPhoto} alt="Room" style={styles.mainPhoto} />
            ) : (
              <div style={styles.emptyPhoto}>roomies</div>
            )}
          </div>

          {(post.photos || []).length > 1 && (
            <div style={styles.thumbnailRow}>
              {post.photos.map((photo, index) => (
                <button key={photo} style={styles.thumbnailBtn} onClick={() => setSelectedPhoto(photo)}>
                  <img src={photo} alt={`Room ${index + 1}`} style={styles.thumbnail} />
                </button>
              ))}
            </div>
          )}
        </section>

        <section style={styles.header}>
          <div style={styles.topLine}>
            <span style={styles.typeBadge}>{postTypeLabels[post.post_type] || "Room Post"}</span>
            <span style={styles.date}>{new Date(post.created_at).toLocaleDateString()}</span>
          </div>

          <h1 style={styles.title}>{post.description_en?.slice(0, 80) || "Room Post"}</h1>

          <div style={styles.profileBox}>
            <div style={styles.avatar}>{writerName.slice(0, 1).toUpperCase()}</div>
            <div>
              <p style={styles.writerName}>{writerName}</p>
              <p style={styles.university}>
                {post.users?.university || ""}
                {post.users?.is_verified && <span style={styles.verified}>Verified Student</span>}
              </p>
            </div>
          </div>
        </section>

        <section style={styles.infoPanel}>
          <p style={styles.sectionLabel}>Room Information</p>
          <div style={styles.infoGrid}>
            <Info label="Region" value={post.district} />
            <Info
              label="Room Type"
              value={
                post.room_type
                  ? roomTypeLabels[post.room_type] || post.room_type
                  : "No Preference"
              }
            />
            <Info label="Monthly Rent" value={`${post.monthly_rent}0,000 KRW`} />
            <Info label="Deposit" value={`${post.deposit || 0}0,000 KRW`} />
            <Info label="Move-in Date" value={formatDate(post.available_from)} />
            <Info
              label="Move-out Date"
              value={formatDate(post.available_until)}
            />
            <Info label="Gender Preference" value={post.gender_preference || "No Preference"} />
            <div style={styles.infoItem}>
              <p style={styles.infoLabel}>Full Address</p>
              <p style={post.full_address ? styles.infoValue : styles.privateAddress}>
                {post.full_address || "Visible after matching"}
              </p>
            </div>
          </div>
        </section>

        <section style={styles.contentPanel}>
          <p style={styles.sectionLabel}>Description</p>
          <p style={styles.descriptionText}>{post.description_en || "No description."}</p>
        </section>

        <section style={styles.contentPanel}>
          <p style={styles.sectionLabel}>Lifestyle Tags</p>
          <div style={styles.tagsGrid}>
            {(post.lifestyle_tags || []).length > 0 ? (
              post.lifestyle_tags.map((tag) => <span key={tag} style={styles.tag}>{tag}</span>)
            ) : (
              <span style={styles.emptyTag}>No selected tags.</span>
            )}
          </div>
        </section>

        <section style={styles.actionPanel}>
          {isOwner ? (
            <>
              <div>
                <h2 style={styles.actionTitle}>Manage your post</h2>
                <p style={styles.actionText}>Only you can edit or delete this post.</p>
              </div>
              <div style={styles.actionBtns}>
                <button style={styles.mainBtn} onClick={() => navigate(`/post-edit/${post.id}`)}>
                  Edit Post
                </button>
                <button style={styles.deleteBtn} onClick={handleDelete} disabled={actionLoading}>
                  Delete
                </button>
              </div>
            </>
          ) : (
            <>
              <div>
                <h2 style={styles.actionTitle}>Interested in this post?</h2>
                <p style={styles.actionText}>Send an interest request to start matching with the writer.</p>
              </div>
              <button style={styles.mainBtn} onClick={handleInterest} disabled={actionLoading}>
                {actionLoading ? "Sending..." : "I'm Interested"}
              </button>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={styles.infoItem}>
      <p style={styles.infoLabel}>{label}</p>
      <p style={styles.infoValue}>{value}</p>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: { minHeight: "100vh", background: "#fafaf8", fontFamily: "'Georgia', serif", position: "relative", overflowX: "hidden", color: "#1a1a1a" },
  bgAccent: { position: "fixed", top: -200, right: -200, width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, #e8e4dc 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 },
  loadingPage: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#fafaf8", color: "#aaa", fontFamily: "'Georgia', serif" },
  nav: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "24px 48px", borderBottom: "1px solid #ebe9e4", background: "#fafaf8", position: "relative", zIndex: 1 },
  brand: { fontSize: 13, letterSpacing: "0.25em", textTransform: "uppercase", color: "#888", margin: 0 },
  navRight: { display: "flex", gap: 24, alignItems: "center" },
  navLink: { background: "none", border: "none", fontSize: 13, color: "#888", cursor: "pointer", fontFamily: "'Georgia', serif", letterSpacing: "0.05em" },
  container: { maxWidth: 980, margin: "48px auto", padding: "0 40px", position: "relative", zIndex: 1 },
  backBtn: { background: "none", border: "none", color: "#888", fontSize: 13, cursor: "pointer", fontFamily: "'Georgia', serif", marginBottom: 18 },
  errorBox: { background: "#fff5f5", border: "1px solid #fecaca", color: "#c0392b", padding: "12px 16px", borderRadius: 2, fontSize: 13, marginBottom: 20 },
  photoPanel: { background: "#ffffff", borderRadius: 2, boxShadow: "0 4px 40px rgba(0,0,0,0.06)", padding: 24, marginBottom: 28 },
  mainPhotoBox: { height: 380, background: "#f0ede8", borderRadius: 2, overflow: "hidden" },
  mainPhoto: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
  emptyPhoto: { height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#aaa", letterSpacing: "0.25em", textTransform: "uppercase", fontSize: 13 },
  thumbnailRow: { display: "flex", gap: 10, marginTop: 12 },
  thumbnailBtn: { border: "1px solid #ebe9e4", background: "#fff", padding: 0, width: 90, height: 66, cursor: "pointer" },
  thumbnail: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
  header: { background: "#ffffff", borderRadius: 2, boxShadow: "0 4px 40px rgba(0,0,0,0.06)", padding: "40px 48px", marginBottom: 28 },
  topLine: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  typeBadge: { fontSize: 11, padding: "4px 12px", borderRadius: 20, background: "#f0ede8", color: "#666" },
  date: { fontSize: 12, color: "#aaa" },
  title: { fontSize: 32, fontWeight: 400, lineHeight: 1.35, color: "#1a1a1a", margin: "0 0 24px" },
  profileBox: { display: "flex", alignItems: "center", gap: 14 },
  avatar: { width: 48, height: 48, borderRadius: "50%", background: "#e8e4dc", color: "#888", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, border: "3px solid #ebe9e4" },
  writerName: { fontSize: 16, color: "#1a1a1a", margin: "0 0 5px" },
  university: { fontSize: 13, color: "#888", margin: 0 },
  verified: { marginLeft: 8, fontSize: 11, padding: "4px 10px", borderRadius: 20, background: "#f0faf4", color: "#27ae60", border: "1px solid #a8e6c1" },
  infoPanel: { background: "#ffffff", borderRadius: 2, boxShadow: "0 4px 40px rgba(0,0,0,0.06)", padding: "40px 48px", marginBottom: 28 },
  sectionLabel: { fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "#aaa", margin: "0 0 18px" },
  infoGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 },
  infoItem: { borderBottom: "1.5px solid #f0ede8", paddingBottom: 12 },
  infoLabel: { fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "#bbb", margin: "0 0 8px" },
  infoValue: { fontSize: 15, color: "#1a1a1a", margin: 0 },
  privateAddress: { fontSize: 15, color: "#b8860b", margin: 0 },
  contentPanel: { background: "#ffffff", borderRadius: 2, boxShadow: "0 4px 40px rgba(0,0,0,0.06)", padding: "40px 48px", marginBottom: 28 },
  descriptionText: { fontSize: 15, color: "#666", lineHeight: 1.8, margin: 0, whiteSpace: "pre-wrap" },
  tagsGrid: { display: "flex", flexWrap: "wrap", gap: 8 },
  tag: { fontSize: 12, padding: "6px 14px", background: "#1a1a1a", color: "#fff", borderRadius: 20, letterSpacing: "0.03em" },
  emptyTag: { fontSize: 13, color: "#aaa" },
  actionPanel: { background: "#ffffff", borderRadius: 2, boxShadow: "0 4px 40px rgba(0,0,0,0.06)", padding: "32px 48px", marginBottom: 28, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 },
  actionTitle: { fontSize: 22, fontWeight: 400, color: "#1a1a1a", margin: "0 0 8px" },
  actionText: { fontSize: 13, color: "#888", margin: 0, lineHeight: 1.6 },
  actionBtns: { display: "flex", gap: 12, alignItems: "center" },
  mainBtn: { background: "#1a1a1a", border: "none", padding: "12px 26px", fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer", fontFamily: "'Georgia', serif", color: "#fff", borderRadius: 1, whiteSpace: "nowrap" },
  deleteBtn: { background: "transparent", border: "1.5px solid #fecaca", padding: "12px 22px", fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer", fontFamily: "'Georgia', serif", color: "#c0392b", borderRadius: 1 },
  notFoundBox: { maxWidth: 560, margin: "140px auto 0", background: "#ffffff", boxShadow: "0 4px 40px rgba(0,0,0,0.06)", padding: "48px", textAlign: "center", position: "relative", zIndex: 1 },
  notFoundTitle: { fontSize: 28, fontWeight: 400, margin: "0 0 12px" },
  notFoundText: { fontSize: 14, color: "#888", lineHeight: 1.6, margin: "0 0 24px" },
};