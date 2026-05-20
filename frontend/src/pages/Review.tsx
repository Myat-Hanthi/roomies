
// Users can review roommates from accepted matches


import axios from "axios";
import type { CSSProperties, FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API } from "../lib/api";
import { supabase } from "../lib/supabase";

//  Helper: Get JWT token 
const getToken = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || "";
};

// Helper: Get current user 
const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};


// TypeScript Interfaces

type CompletedMatch = {
  id: string;
  roommateName: string;
  roommateUniversity: string;
  roommatePhoto: string;
  roommateId: string;
  postTitle: string;
  roomRegion: string;
  completedAt: string;
  status: string;
};

type Review = {
  id: string;
  matchId: string;
  targetName: string;
  targetUniversity: string;
  rating: number;
  comment: string;
  createdAt: string;
};


// Main Review Component


export default function Review() {
  const navigate = useNavigate();

  //State 
  const [matches, setMatches] = useState<CompletedMatch[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string>("");
  const [rating, setRating] = useState<number>(0);
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const [comment, setComment] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    initReview();
  }, []);

  // When match changes, fetch reviews for that user 
  useEffect(() => {
    if (selectedMatchId) {
      const match = matches.find(m => m.id === selectedMatchId);
      console.log("Selected match :", match);
      console.log("Rommate ID:", match?.roommateId );
      if (match) fetchReviews(match.roommateId);
    }
  }, [selectedMatchId,matches]);

  
  // Functions
 

  // Initialize: get current user and fetch accepted matches
  const initReview = async () => {
    const user = await getCurrentUser();
    if (!user) { navigate("/login"); return; }
    setCurrentUser(user);
    await fetchMatches(user);
    setLoading(false);
  };

  // Fetch accepted matches from Express backend
  const fetchMatches = async (user: any) => {
  try {
    const token = await getToken();
    const headers = { Authorization: `Bearer ${token}` };

    const [incomingRes, outgoingRes] = await Promise.all([
      axios.get(`${API}/matches/incoming`, { headers }),
      axios.get(`${API}/matches/outgoing`, { headers }),
    ]);

    const allMatches = [...incomingRes.data, ...outgoingRes.data]
      .filter((m: any) => m.status === "accepted");

    const converted: CompletedMatch[] = allMatches.map((match: any) => {
      const isRequester = match.requester_id === user.id;
      const opponent = isRequester
        ? { id: match.owner_id }
        : match.requester;
      console.log("isRequester:", isRequester)    
      console.log("opponent object:", opponent)    
      console.log("opponent id:", opponent?.id)     
      return {
        id: match.id,
        roommateName: opponent?.name || "Roomie",
        roommateUniversity: opponent?.university || "",
        roommatePhoto: opponent?.profile_photo || "",
        roommateId: opponent?.id || "",
        postTitle: match.posts?.district
          ? `${match.posts.post_type} · ${match.posts.district}`
          : "Matched Post",
        roomRegion: match.posts?.district || "Seoul",
        completedAt: new Date(match.created_at).toLocaleDateString(),
        status: match.status,
      };
    });

    setMatches(converted);
    if (converted.length > 0) setSelectedMatchId(converted[0].id);
  } catch (err) {
    console.error("Failed to fetch matches", err);
    setError("Failed to load matches.");
  }
};
  // Fetch reviews for a specific user from Express backend
  const fetchReviews = async (userId: string) => {
  console.log(`Fetching reviews for user ${userId}...`);
  if (!userId) return;

  try {
    const { data } = await axios.get(`${API}/reviews/${userId}`);
    console.log("Fetched reviews:", data);

    const converted: Review[] = data.reviews.map((r: any) => ({
      id: r.id,
      matchId: r.match_id,
      targetName: selectedMatch?.roommateName || "Roomie",
      targetUniversity: selectedMatch?.roommateUniversity || "",
      rating: r.rating,
      comment: r.comment || "",
      createdAt: new Date(r.created_at).toLocaleDateString(),
    }));

    setReviews(converted);
  } catch (err) {
    console.error("Failed to fetch reviews", err);
  }
};

  // Submit review to Express backend
  const submitReview = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedMatch) return;

    if (rating === 0) {
      setError("Please select a rating before submitting.");
      return;
    }

    if (selectedMatchAlreadyReviewed) {
      setError("You have already submitted a review for this match.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const token = await getToken();
      await axios.post(`${API}/reviews`, {
        reviewee_id: selectedMatch.roommateId,
        match_id: selectedMatch.id,
        rating,
        comment: comment.trim() || "No written comment was added, but a star rating was submitted.",
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Refresh reviews after submit
      await fetchReviews(selectedMatch.roommateId);

      // Reset form
      setRating(0);
      setHoveredRating(0);
      setComment("");
      setSuccessMessage("Review submitted successfully.");
      setTimeout(() => setSuccessMessage(""), 2500);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to submit review.");
    } finally {
      setSubmitting(false);
    }
  };

  //  Computed values 
  const selectedMatch = matches.find(m => m.id === selectedMatchId);

  // Check if current match already has a review submitted
  const reviewedMatchIds = reviews.map(r => r.matchId);
  const selectedMatchAlreadyReviewed = selectedMatch
    ? reviewedMatchIds.includes(selectedMatch.id)
    : false;

  // Calculate average rating
  const averageRating = useMemo(() => {
    if (reviews.length === 0) return 0;
    return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  }, [reviews]);

  // Render star display (read-only)
  const renderStars = (value: number) => {
    return Array.from({ length: 5 }).map((_, index) => {
      const starValue = index + 1;
      return (
        <span key={starValue} style={{
          ...styles.starDisplay,
          color: starValue <= value ? "#1a1a1a" : "#d6d1c8",
        }}>★</span>
      );
    });
  };

  
  // Render


  if (loading) {
    return (
      <div style={{ ...styles.page, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ fontFamily: "'Georgia', serif", color: "#aaa", fontSize: 14 }}>
          Loading matches...
        </p>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.bgAccent} />

      {/* ── Navigation ── */}
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
        {/* ── Page Header ── */}
        <section style={styles.header}>
          <div>
            <p style={styles.kicker}>REVIEW</p>
            <h1 style={styles.title}>Leave a Roommate Review</h1>
            <p style={styles.description}>
              After a match is completed, you can rate your roommate and leave
              an optional comment. Reviews help students make safer roommate decisions.
            </p>
          </div>
        </section>

        {/* No matches state */}
        {matches.length === 0 ? (
          <div style={styles.emptyBox}>
            <p style={{ fontSize: 16, color: "#1a1a1a", margin: "0 0 8px" }}>No accepted matches yet</p>
            <p style={{ fontSize: 13, color: "#aaa", margin: "0 0 20px" }}>
              You need an accepted match before you can leave a review
            </p>
            <button style={styles.submitBtn} onClick={() => navigate("/browse")}
              onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
              onMouseLeave={e => (e.currentTarget.style.opacity = "1")}>
              Browse Posts
            </button>
          </div>
        ) : (
          <section style={styles.layout}>

            {/* ── Left Panel: Match List ── */}
            <aside style={styles.leftPanel}>
              <div style={styles.panelHeader}>
                <p style={styles.sectionLabel}>Accepted Matches</p>
                <h2 style={styles.panelTitle}>Review Queue</h2>
              </div>

              <div style={styles.matchList}>
                {matches.map((match) => {
                  const active = selectedMatchId === match.id;
                  const reviewed = reviewedMatchIds.includes(match.id);
                  return (
                    <button key={match.id}
                      style={{ ...styles.matchItem, ...(active ? styles.activeMatchItem : {}) }}
                      onClick={() => {
                        setSelectedMatchId(match.id);
                        setRating(0);
                        setHoveredRating(0);
                        setComment("");
                        setSuccessMessage("");
                        setError("");
                      }}>
                      {/* Avatar */}
                      <div style={styles.avatar}>
                        {match.roommatePhoto ? (
                          <img src={match.roommatePhoto} alt={match.roommateName}
                            style={styles.avatarImage} />
                        ) : (
                          <span>{match.roommateName.slice(0, 1)}</span>
                        )}
                      </div>

                      {/* Match info */}
                      <div style={styles.matchContent}>
                        <div style={styles.matchTop}>
                          <p style={styles.roommateName}>{match.roommateName}</p>
                          {reviewed ? (
                            <span style={styles.doneBadge}>Reviewed</span>
                          ) : (
                            <span style={styles.pendingBadge}>Pending</span>
                          )}
                        </div>
                        <p style={styles.matchMeta}>{match.roommateUniversity}</p>
                        <p style={styles.matchPost}>{match.postTitle}</p>
                        <p style={styles.matchDate}>Matched on {match.completedAt}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </aside>

            {/* ── Right Panel: Review Form ── */}
            <section style={styles.reviewPanel}>
              {selectedMatch ? (
                <>
                  {/* Review target header */}
                  <div style={styles.reviewHeader}>
                    <div style={styles.reviewUser}>
                      <div style={styles.largeAvatar}>
                        {selectedMatch.roommatePhoto ? (
                          <img src={selectedMatch.roommatePhoto} alt=""
                            style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                        ) : (
                          selectedMatch.roommateName.slice(0, 1)
                        )}
                      </div>
                      <div>
                        <p style={styles.sectionLabel}>Review For</p>
                        <h2 style={styles.reviewName}>{selectedMatch.roommateName}</h2>
                        <p style={styles.reviewMeta}>
                          {selectedMatch.roommateUniversity} · {selectedMatch.roomRegion}
                        </p>
                      </div>
                    </div>
                    <span style={styles.completedBadge}>Accepted Match</span>
                  </div>

                  {/* Matched post info */}
                  <div style={styles.matchedPostBox}>
                    <p style={styles.matchInfoTitle}>Matched Post</p>
                    <p style={styles.matchInfoText}>{selectedMatch.postTitle}</p>
                  </div>

                  {/* Success message */}
                  {successMessage && (
                    <div style={styles.successBox}>{successMessage}</div>
                  )}

                  {/* Error message */}
                  {error && (
                    <div style={styles.errorBox}>{error}</div>
                  )}

                  {/* Already reviewed state */}
                  {selectedMatchAlreadyReviewed ? (
                    <div style={styles.alreadyReviewedBox}>
                      <h3 style={styles.alreadyTitle}>Review already submitted</h3>
                      <p style={styles.alreadyText}>
                        You have already left a review for this match.
                        You can check it in the review list below.
                      </p>
                    </div>
                  ) : (
                    /* Review form */
                    <form style={styles.form} onSubmit={submitReview}>
                      <div style={styles.fieldGroup}>
                        <label style={styles.label}>Rating</label>
                        <div style={styles.starInputRow}>
                          {Array.from({ length: 5 }).map((_, index) => {
                            const starValue = index + 1;
                            const active = starValue <= (hoveredRating || rating);
                            return (
                              <button key={starValue} type="button"
                                style={{ ...styles.starButton, color: active ? "#1a1a1a" : "#d6d1c8" }}
                                onClick={() => setRating(starValue)}
                                onMouseEnter={() => setHoveredRating(starValue)}
                                onMouseLeave={() => setHoveredRating(0)}>
                                ★
                              </button>
                            );
                          })}
                          <span style={styles.ratingText}>
                            {rating > 0 ? `${rating} out of 5` : "Select a rating"}
                          </span>
                        </div>
                      </div>

                      <div style={styles.fieldGroup}>
                        <label style={styles.label}>Comment (Optional)</label>
                        <textarea
                          style={styles.textarea}
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                          placeholder="Write a short comment about communication, cleanliness, reliability, or roommate manners."
                        />
                      </div>

                      <button type="submit" style={styles.submitBtn} disabled={submitting}>
                        {submitting ? "Submitting..." : "Submit Review"}
                      </button>
                    </form>
                  )}

                  <div style={styles.divider} />

                  {/* Reviews list */}
                  <section style={styles.profilePreview}>
                    <div style={styles.profilePreviewHeader}>
                      <div>
                        <p style={styles.sectionLabel}>Profile Preview</p>
                        <h2 style={styles.panelTitle}>Review Summary</h2>
                      </div>
                      <div style={styles.averageBox}>
                        <p style={styles.averageScore}>{averageRating.toFixed(1)}</p>
                        <div>{renderStars(Math.round(averageRating))}</div>
                        <p style={styles.averageText}>
                          {reviews.length} review{reviews.length === 1 ? "" : "s"}
                        </p>
                      </div>
                    </div>

                    <div style={styles.reviewList}>
                      {reviews.length > 0 ? (
                        reviews.map((review) => (
                          <article key={review.id} style={styles.reviewCard}>
                            <div style={styles.reviewCardTop}>
                              <div>
                                <p style={styles.reviewTarget}>{review.targetName}</p>
                                <p style={styles.reviewUniversity}>{review.targetUniversity}</p>
                              </div>
                              <span style={styles.reviewDate}>{review.createdAt}</span>
                            </div>
                            <div style={styles.reviewStars}>{renderStars(review.rating)}</div>
                            <p style={styles.reviewComment}>{review.comment}</p>
                          </article>
                        ))
                      ) : (
                        <div style={styles.emptyBox}>
                          No reviews have been submitted yet.
                        </div>
                      )}
                    </div>
                  </section>
                </>
              ) : (
                <div style={styles.emptyBox}>No match selected.</div>
              )}
            </section>
          </section>
        )}
      </main>
    </div>
  );
}


// Styles 

const styles: Record<string, CSSProperties> = {
  page: { minHeight: "100vh", background: "#fafaf8", fontFamily: "'Georgia', serif", position: "relative", overflowX: "hidden", color: "#1a1a1a" },
  bgAccent: { position: "fixed", top: -200, right: -200, width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, #e8e4dc 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 },
  nav: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "24px 48px", borderBottom: "1px solid #ebe9e4", background: "#fafaf8", position: "relative", zIndex: 1 },
  brand: { fontSize: 13, letterSpacing: "0.25em", textTransform: "uppercase", color: "#888", margin: 0 },
  navRight: { display: "flex", gap: 24, alignItems: "center" },
  navLink: { background: "none", border: "none", fontSize: 13, color: "#888", cursor: "pointer", fontFamily: "'Georgia', serif", letterSpacing: "0.05em" },
  navLinkActive: { background: "none", border: "none", fontSize: 13, color: "#1a1a1a", cursor: "pointer", fontFamily: "'Georgia', serif", letterSpacing: "0.05em" },
  container: { maxWidth: 1120, margin: "48px auto", padding: "0 40px", position: "relative", zIndex: 1 },
  header: { background: "#ffffff", borderRadius: 2, boxShadow: "0 4px 40px rgba(0,0,0,0.06)", padding: "40px 48px", marginBottom: 28 },
  kicker: { fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "#aaa", margin: "0 0 16px" },
  title: { fontSize: 32, fontWeight: 400, color: "#1a1a1a", margin: "0 0 10px" },
  description: { fontSize: 14, color: "#888", lineHeight: 1.7, maxWidth: 720, margin: 0 },
  layout: { display: "grid", gridTemplateColumns: "340px 1fr", gap: 28, alignItems: "start" },
  leftPanel: { background: "#ffffff", borderRadius: 2, boxShadow: "0 4px 40px rgba(0,0,0,0.06)", padding: 24 },
  panelHeader: { marginBottom: 20 },
  sectionLabel: { fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "#aaa", margin: "0 0 10px" },
  panelTitle: { fontSize: 22, fontWeight: 400, margin: 0, color: "#1a1a1a" },
  matchList: { display: "flex", flexDirection: "column", gap: 12 },
  matchItem: { width: "100%", display: "grid", gridTemplateColumns: "46px 1fr", gap: 12, padding: 14, background: "#ffffff", border: "1px solid #f0ede8", textAlign: "left", cursor: "pointer", fontFamily: "'Georgia', serif" },
  activeMatchItem: { background: "#fafaf8", border: "1px solid #ddd8cf" },
  avatar: { width: 46, height: 46, borderRadius: "50%", background: "#e8e4dc", color: "#888", border: "2px solid #ebe9e4", display: "flex", justifyContent: "center", alignItems: "center", fontSize: 18, overflow: "hidden" },
  avatarImage: { width: "100%", height: "100%", objectFit: "cover" },
  matchContent: { minWidth: 0 },
  matchTop: { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" },
  roommateName: { fontSize: 15, color: "#1a1a1a", margin: 0 },
  matchMeta: { fontSize: 12, color: "#888", margin: "5px 0" },
  matchPost: { fontSize: 12, color: "#888", margin: "0 0 6px", lineHeight: 1.5 },
  matchDate: { fontSize: 11, color: "#aaa", margin: 0 },
  doneBadge: { fontSize: 10, padding: "4px 8px", borderRadius: 20, background: "#f0faf4", color: "#27ae60", border: "1px solid #a8e6c1", whiteSpace: "nowrap" },
  pendingBadge: { fontSize: 10, padding: "4px 8px", borderRadius: 20, background: "#fdfaf0", color: "#b8860b", border: "1px solid #f0dc82", whiteSpace: "nowrap" },
  reviewPanel: { background: "#ffffff", borderRadius: 2, boxShadow: "0 4px 40px rgba(0,0,0,0.06)", padding: "32px 40px" },
  reviewHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 24, marginBottom: 24 },
  reviewUser: { display: "flex", alignItems: "center", gap: 16 },
  largeAvatar: { width: 64, height: 64, borderRadius: "50%", background: "#e8e4dc", color: "#888", border: "3px solid #ebe9e4", display: "flex", justifyContent: "center", alignItems: "center", fontSize: 25, overflow: "hidden" },
  reviewName: { fontSize: 25, fontWeight: 400, margin: "0 0 6px" },
  reviewMeta: { fontSize: 13, color: "#888", margin: 0 },
  completedBadge: { fontSize: 11, padding: "6px 12px", borderRadius: 20, background: "#f0ede8", color: "#666", whiteSpace: "nowrap" },
  matchedPostBox: { padding: "16px 18px", background: "#fafaf8", border: "1px solid #f0ede8", marginBottom: 24 },
  matchInfoTitle: { fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "#aaa", margin: "0 0 7px" },
  matchInfoText: { fontSize: 13, color: "#666", margin: 0, lineHeight: 1.5 },
  successBox: { background: "#f0faf4", border: "1px solid #a8e6c1", color: "#27ae60", padding: "12px 16px", borderRadius: 2, fontSize: 13, marginBottom: 20 },
  errorBox: { background: "#fff5f5", border: "1px solid #fecaca", color: "#c0392b", padding: "12px 16px", borderRadius: 2, fontSize: 13, marginBottom: 20 },
  alreadyReviewedBox: { background: "#fafaf8", border: "1px solid #f0ede8", padding: 22, marginBottom: 24 },
  alreadyTitle: { fontSize: 18, fontWeight: 400, margin: "0 0 8px" },
  alreadyText: { fontSize: 13, color: "#888", lineHeight: 1.6, margin: 0 },
  form: { marginBottom: 24 },
  fieldGroup: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 22 },
  label: { fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "#bbb" },
  starInputRow: { display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" },
  starButton: { background: "none", border: "none", fontSize: 34, cursor: "pointer", padding: "0 3px", lineHeight: 1 },
  starDisplay: { fontSize: 15, marginRight: 2 },
  ratingText: { marginLeft: 12, fontSize: 13, color: "#888" },
  textarea: { border: "1.5px solid #ddd", padding: "14px", fontSize: 14, fontFamily: "'Georgia', serif", color: "#1a1a1a", background: "transparent", outline: "none", width: "100%", minHeight: 120, resize: "vertical", lineHeight: 1.6, boxSizing: "border-box" },
  submitBtn: { width: "100%", background: "#1a1a1a", border: "none", padding: "14px 24px", fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer", fontFamily: "'Georgia', serif", color: "#fff", borderRadius: 1 },
  divider: { height: 1, background: "#f0ede8", margin: "32px 0" },
  profilePreview: { marginTop: 6 },
  profilePreviewHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 24, marginBottom: 22 },
  averageBox: { textAlign: "right", minWidth: 120 },
  averageScore: { fontSize: 32, margin: "0 0 4px", color: "#1a1a1a" },
  averageText: { fontSize: 11, color: "#aaa", margin: "5px 0 0" },
  reviewList: { display: "flex", flexDirection: "column", gap: 14 },
  reviewCard: { border: "1px solid #f0ede8", padding: 18, background: "#ffffff" },
  reviewCardTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 10 },
  reviewTarget: { fontSize: 15, color: "#1a1a1a", margin: "0 0 4px" },
  reviewUniversity: { fontSize: 12, color: "#888", margin: 0 },
  reviewDate: { fontSize: 11, color: "#aaa", whiteSpace: "nowrap" },
  reviewStars: { marginBottom: 10 },
  reviewComment: { fontSize: 13, color: "#666", lineHeight: 1.7, margin: 0 },
  emptyBox: { background: "#fafaf8", border: "1px solid #f0ede8", padding: 32, color: "#888", fontSize: 14, textAlign: "center" },
};