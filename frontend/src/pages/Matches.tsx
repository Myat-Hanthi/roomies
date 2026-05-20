//matches page
//shows incoming and outhgoing match requests
//chat button will appear once the match request is accepted

import axios from "axios";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API } from "../lib/api";
import { supabase } from "../lib/supabase";

//Helper function to get JWT token from supabase session
const getToken = async () => {
    const { data :{ session}} = await supabase.auth.getSession();
    return session?.access_token || "";
};

//Typescript interface

interface MatchUser{
    id: string;
    name : string;
    profile_photo: string | null;
    university: string;
    nationality?: string;
    is_verified?: boolean;
    lifestyle_tags?: string[];
}

interface MatchPost{
    id: string;
    post_type: string;
    district: string;
    monthly_rent: number;
    deposit: number;
    full_address?: string;
    status: string;
}

interface Match{
    id: string;
    status: "pending" | "accepted" | "declined" | "cancelled";
    created_at: string;
    post_id: string;
    requester_id: string;
    owner_id: string;
    posts?: MatchPost;
    requester?: MatchUser;
    owner?: MatchUser;
}

//Main Matches Component

export default function Matches() {
    const navigate = useNavigate();

    //State 
    const [activeTab, setActiveTab] = useState<"incoming" | "outgoing">("incoming");
    const [incoming, setIncoming] = useState<Match[]>([]);
    const [outgoing, setOutgoing] = useState<Match[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null); // Track which match is being tracked
    const [error, setError] = useState("");

    useEffect(() => {
        fetchMatches();
    }, []);

    //Fetch both incoming and outgoing matches
    const fetchMatches = async () =>{
        setLoading(true);
        try{
            const token = await getToken();
            const headers = { Authorization: `Bearer ${token}` };

            //fetch both in parallet
            const [incomingRes, outgoingRes] = await Promise.all([
                axios.get(`${API}/matches/incoming`, { headers }),
                axios.get(`${API}/matches/outgoing`, { headers }),
            ]);

            setIncoming(incomingRes.data);
            setOutgoing(outgoingRes.data);
        }catch(err : any){
            setError("Failed to load matches. Please try again.");
            }finally{
                setLoading(false);
            }
        
        };
    //Accept a match request
    const handleAccept = async (matchId: string) => {
        setActionLoading(matchId);
        try{
            const token = await getToken();
            await axios.put(`${API}/matches/${matchId}/accept`, {}, {
                headers: { Authorization: `Bearer ${token}` },
            });
            await fetchMatches();
        }catch(err : any){
            setError("Failed to accept match. Please try again.");
        }finally{
            setActionLoading(null);
        }
    };

    //Decline a match request
    const handleDecline = async (matchId: string) => {
        setActionLoading(matchId);
        try{
            const token = await getToken();
            await axios.put(`${API}/matches/${matchId}/decline`, {}, {
                headers: { Authorization: `Bearer ${token}` },
            });
            await fetchMatches();
        }catch(err : any){
            setError("Failed to decline match. Please try again.");
        }finally{
            setActionLoading(null);
        }
    };

    //Cancel an outgoing match request
    const handleCancel = async (matchId: string) => {
        setActionLoading(matchId);
        try{
            const token = await getToken();
            await axios.put(`${API}/matches/${matchId}/cancel`, {}, {
                headers: { Authorization: `Bearer ${token}` },
            });
            await fetchMatches();
        }catch(err : any){
            setError("Failed to cancel match. Please try again.");
        }finally{
            setActionLoading(null);
        }
    };
    
    //Utility : get readabke post type label
    const getPostTypeLabel = (type: string) => {
        const labels: Record<string, string> = {
            room_available: "🏠 Room Available",
            looking_for_room: "🔍 Looking for Room",
            sublet: "⏳ Sublet",
            lease_takeover: "🔄 Lease Takeover",
    };
    return labels[type] || "📍 Post";
    };

    //Utitlity: get status badge style 
    const getStatusStyle = (status: string) : React.CSSProperties => {
        const map: Record<string, React.CSSProperties> ={
            pending: { backgroundColor: "#fdfaf0", color: "#b8860b", border: "1px solid #f0dc82"},
            accepted: { backgroundColor: "#f0faf4", color: "#27ae60", border: "1px solid #a8e6c1"},
            declined: { backgroundColor: "#fff5f5", color: "#c0392b", border: "1px solid #fecaca"},
            cancelled: { backgroundColor: "#f5f5f5", color: "#aaa", border: "1px solid #ddd"},
        };
        return map[status] || {};
    };

    //Utility: Format date
    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString([],{
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    };

    //count by status
    const pendingIncoming = incoming.filter(m => m.status === "pending").length;
    const acceptedCount = [...incoming, ...outgoing].filter(m => m.status === "accepted").length;
    if (loading) {
        return(
            <div style={styles.loadingPage}>
                <p style={styles.loadingText}>Loading Matches...</p>
            </div>
        );
    }
    return(
        <div style={styles.page}>
            <div style={styles.bgAccent}/>
            {/*Nav*/}
            <nav style={styles.nav}>
        <p style={styles.brand}>roomie</p>
        <div style={styles.navRight}>
            <button style={styles.navLink} onClick={() => navigate("/browse")}>Browse</button>
            <button style={styles.navLink} onClick={() => navigate("/matches")}>Matches</button>
            <button style={styles.navLink} onClick={() => navigate("/chat")}>Chat</button>
            <button style={styles.navLink} onClick={() => navigate("/review")}>Review</button>
            <button style={styles.navLink} onClick={() => navigate("/profile")}>Profile</button>
            </div>
            </nav>
        <div style={styles.container}>

        {/* ── Page Header ── */}
        <div style={styles.pageHeader}>
            <div>
                <p style={styles.kicker}>ROOMMATE MATCHING</p>
                <h1 style={styles.pageTitle}>My Matches</h1>
                <p style={styles.pageSub}>
                Manage your roommate requests and confirmed matches
                </p>
            </div>

          {/* Stats row */}
        <div style={styles.statsRow}>
            <div style={styles.statBox}>
                <p style={styles.statNumber}>{pendingIncoming}</p>
                <p style={styles.statLabel}>Pending</p>
            </div>
            <div style={styles.statBox}>
                <p style={styles.statNumber}>{acceptedCount}</p>
                <p style={styles.statLabel}>Matched</p>
            </div>
            <div style={styles.statBox}>
                <p style={styles.statNumber}>{outgoing.length}</p>
                <p style={styles.statLabel}>Sent</p>
            </div>
        </div>
        </div>

        {error && <div style={styles.errorBox}>{error}</div>}

        {/* ── Tabs ── */}
        <div style={styles.tabRow}>
            <button
            style={{
                ...styles.tab,
                borderBottom: activeTab === "incoming" ? "2px solid #1a1a1a" : "2px solid transparent",
                color: activeTab === "incoming" ? "#1a1a1a" : "#aaa",
            }}
            onClick={() => setActiveTab("incoming")}>
            Incoming Requests
            {pendingIncoming > 0 && (
                <span style={styles.tabBadge}>{pendingIncoming}</span>
            )}
            </button>
            <button
            style={{
                ...styles.tab,
                borderBottom: activeTab === "outgoing" ? "2px solid #1a1a1a" : "2px solid transparent",
                color: activeTab === "outgoing" ? "#1a1a1a" : "#aaa",
            }}
            onClick={() => setActiveTab("outgoing")}>
            Sent Requests
            <span style={{ ...styles.tabBadge, background: "#f0ede8", color: "#888" }}>
                {outgoing.length}
            </span>
            </button>
        </div>

        {/* ── Incoming Requests Tab ── */}
        {activeTab === "incoming" && (
            <div style={styles.matchList}>
            {incoming.length === 0 ? (
                <div style={styles.emptyState}>
                <p style={styles.emptyIcon}>📭</p>
                <p style={styles.emptyText}>No incoming requests yet</p>
                <p style={styles.emptySub}>When someone is interested in your post they'll appear here</p>
                </div>
            ) : (
                incoming.map((match) => (
                <div key={match.id} style={styles.matchCard}>

                  {/* Left — requester info */}
                    <div style={styles.userSection}>
                        {/* Avatar */}
                        <div style={styles.avatar}>
                        {match.requester?.profile_photo ? (
                            <img src={match.requester.profile_photo} alt=""
                            style={styles.avatarImg} />
                        ) : (
                            <div style={styles.avatarPlaceholder}>
                            {match.requester?.name?.[0]?.toUpperCase() || "?"}
                            </div>
                        )}
                    </div>

                    {/* User details */}
                    <div style={styles.userInfo}>
                        <div style={styles.userNameRow}>
                            <p style={styles.userName}>{match.requester?.name || "Student"}</p>
                            {match.requester?.is_verified && (
                            <span style={styles.verifiedBadge}>✓ Verified</span>
                        )}
                    </div>
                    <p style={styles.userUniversity}>{match.requester?.university}</p>
                    {match.requester?.nationality && (
                        <p style={styles.userNationality}>🌍 {match.requester.nationality}</p>
                    )}
                      {/* Lifestyle tags */}
                    {match.requester?.lifestyle_tags && match.requester.lifestyle_tags.length > 0 && (
                        <div style={styles.tagsRow}>
                            {match.requester.lifestyle_tags.slice(0, 3).map(tag => (
                            <span key={tag} style={styles.tag}>{tag}</span>
                        ))}
                        </div>
                    )}
                    </div>
                </div>

                  {/* Divider */}
                <div style={styles.cardDivider} />

                  {/* Middle — post info */}
                <div style={styles.postSection}>
                    <p style={styles.postLabel}>Interested in your post</p>
                    <p style={styles.postType}>{getPostTypeLabel(match.posts?.post_type || "")}</p>
                    <p style={styles.postDistrict}>📍 {match.posts?.district}</p>
                    <div style={styles.postPriceRow}>
                        <span style={styles.postPrice}>
                        ₩{match.posts?.monthly_rent?.toLocaleString()}/mo
                        </span>
                        <span style={styles.postDeposit}>
                        Deposit: ₩{match.posts?.deposit?.toLocaleString()}
                        </span>
                    </div>
                    <p style={styles.matchDate}>Requested {formatDate(match.created_at)}</p>
                </div>

                  {/* Right — status and actions */}
                <div style={styles.actionSection}>
                    {/* Status badge */}
                    <span style={{ ...styles.statusBadge, ...getStatusStyle(match.status) }}>
                        {match.status.charAt(0).toUpperCase() + match.status.slice(1)}
                    </span>
 
                    {/* Action buttons for pending requests */}
                    {match.status === "pending" && (
                        <div style={styles.actionBtns}>
                        <button
                            style={styles.acceptBtn}
                            disabled={actionLoading === match.id}
                            onClick={() => handleAccept(match.id)}>
                            {actionLoading === match.id ? "..." : "✓ Accept"}
                        </button>
                        <button
                            style={styles.declineBtn}
                            disabled={actionLoading === match.id}
                            onClick={() => handleDecline(match.id)}>
                            {actionLoading === match.id ? "..." : "✕ Decline"}
                        </button>
                    </div>
                    )}

                    {/* Chat button for accepted matches */}
                    {match.status === "accepted" && (
                        <button style={styles.chatBtn} onClick={() => navigate("/chat")}>
                            💬 Chat
                        </button>
                    )}
                    </div>
                </div>
                ))
            )}
            </div>
        )}

        {/* ── Outgoing Requests Tab ── */}
        {activeTab === "outgoing" && (
            <div style={styles.matchList}>
            {outgoing.length === 0 ? (
                <div style={styles.emptyState}>
                    <p style={styles.emptyIcon}>📮</p>
                    <p style={styles.emptyText}>No sent requests yet</p>
                    <p style={styles.emptySub}>Browse posts and send interest requests to connect with roommates</p>
                    <button style={styles.browseBtn} onClick={() => navigate("/browse")}>
                    Browse Posts
                    </button>
                </div>
            ) : (
                outgoing.map((match) => (
                    <div key={match.id} style={styles.matchCard}>

                  {/* Left — owner info */}
                <div style={styles.userSection}>
                    <div style={styles.avatar}>
                        {match.owner?.profile_photo ? (
                            <img src={match.owner.profile_photo} alt=""
                            style={styles.avatarImg} />
                    ) : (
                        <div style={styles.avatarPlaceholder}>
                            {match.owner?.name?.[0]?.toUpperCase() || "?"}
                        </div>
                        )}
                    </div>
                    <div style={styles.userInfo}>
                        <div style={styles.userNameRow}>
                        <p style={styles.userName}>{match.owner?.name || "Student"}</p>
                        {match.owner?.is_verified && (
                            <span style={styles.verifiedBadge}>✓ Verified</span>
                        )}
                    </div>
                    <p style={styles.userUniversity}>{match.owner?.university}</p>
                    </div>
                </div>

                <div style={styles.cardDivider} />

                  {/* Middle — post info */}
                <div style={styles.postSection}>
                    <p style={styles.postLabel}>Your request for</p>
                    <p style={styles.postType}>{getPostTypeLabel(match.posts?.post_type || "")}</p>
                    <p style={styles.postDistrict}>📍 {match.posts?.district}</p>
                    <div style={styles.postPriceRow}>
                        <span style={styles.postPrice}>
                        ₩{match.posts?.monthly_rent?.toLocaleString()}/mo
                        </span>
                        <span style={styles.postDeposit}>
                        Deposit: ₩{match.posts?.deposit?.toLocaleString()}
                        </span>
                    </div>
                    {/* Show full address only if accepted */}
                    {match.status === "accepted" && match.posts?.full_address && (
                        <p style={styles.addressRevealed}>
                        📍 {match.posts.full_address}
                        </p>
                    )}
                    <p style={styles.matchDate}>Sent {formatDate(match.created_at)}</p>
                </div>

                  {/* Right — status and actions */}
                <div style={styles.actionSection}>
                    <span style={{ ...styles.statusBadge, ...getStatusStyle(match.status) }}>
                        {match.status.charAt(0).toUpperCase() + match.status.slice(1)}
                    </span>

                    {/* Cancel button for pending requests */}
                    {match.status === "pending" && (
                        <button
                        style={styles.cancelBtn}
                        disabled={actionLoading === match.id}
                        onClick={() => handleCancel(match.id)}>
                        {actionLoading === match.id ? "..." : "Cancel Request"}
                        </button>
                    )}

                    {/* Chat button for accepted matches */}
                    {match.status === "accepted" && (
                        <button style={styles.chatBtn} onClick={() => navigate("/chat")}>
                        💬 Chat
                        </button>
                    )}

                    {/* View post button */}
                    {match.post_id && (
                        <button style={styles.viewPostBtn}
                        onClick={() => navigate(`/post-detail/${match.post_id}`)}>
                        View Post
                        </button>
                    )}
                </div>
                </div>
            ))
        )}
        </div>
        )}
        </div>
    </div>
    );
}
//styles

const styles: Record<string, React.CSSProperties> = {
    page: {
        minHeight: "100vh",
        background: "#fafaf8",
        fontFamily: "'Georgia', serif",
        position: "relative",
        overflowX: "hidden",
    },
    bgAccent: {
        position: "fixed",
        top: -200, right: -200,
        width: 600, height: 600,
        borderRadius: "50%",
        background: "radial-gradient(circle, #e8e4dc 0%, transparent 70%)",
        pointerEvents: "none",
        zIndex: 0,
    },
    loadingPage: {
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#fafaf8",
    },
    loadingText: {
        fontSize: 14, color: "#aaa",
        fontFamily: "'Georgia', serif",
    },
    nav: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "24px 48px",
        borderBottom: "1px solid #ebe9e4",
        background: "#fafaf8",
        position: "relative",
        zIndex: 1,
    },
    brand: {
        fontSize: 13,
        letterSpacing: "0.25em",
        textTransform: "uppercase",
        color: "#888", margin: 0,
    },
    navRight: { display: "flex", gap: 24, alignItems: "center" },
    navLink: {
        background: "none", border: "none",
        fontSize: 13, color: "#888",
        cursor: "pointer",
        fontFamily: "'Georgia', serif",
        letterSpacing: "0.05em",
    },
    container: {
        maxWidth: 1000,
        margin: "48px auto",
        padding: "0 40px",
        position: "relative",
        zIndex: 1,
    },
    pageHeader: {
        background: "#fff",
        borderRadius: 2,
        boxShadow: "0 4px 40px rgba(0,0,0,0.06)",
        padding: "40px 48px",
        marginBottom: 28,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 32,
    },
    kicker: {
        fontSize: 11,
        letterSpacing: "0.15em",
        textTransform: "uppercase",
        color: "#aaa", margin: "0 0 12px",
    },
    pageTitle: {
        fontSize: 32, fontWeight: 400,
        color: "#1a1a1a", margin: "0 0 8px",
    },
    pageSub: {
        fontSize: 14, color: "#888",
        lineHeight: 1.7, margin: 0,
    },
    statsRow: {
        display: "flex",
        gap: 24, flexShrink: 0,
    },
    statBox: {
        textAlign: "center",
        padding: "16px 24px",
        background: "#f5f3ef",
        borderRadius: 2,
        minWidth: 80,
    },
    statNumber: {
        fontSize: 28, fontWeight: 400,
        color: "#1a1a1a", margin: "0 0 4px",
    },
    statLabel: {
        fontSize: 11,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: "#aaa", margin: 0,
    },
    errorBox: {
        background: "#fff5f5",
        border: "1px solid #fecaca",
        color: "#c0392b",
        padding: "12px 16px",
        borderRadius: 2,
        fontSize: 13,
        marginBottom: 20,
    },
    tabRow: {
        display: "flex",
        gap: 0,
        borderBottom: "1px solid #ebe9e4",
        marginBottom: 24,
    },
    tab: {
        background: "none", border: "none",
        padding: "14px 24px",
        fontSize: 14,
        cursor: "pointer",
        fontFamily: "'Georgia', serif",
        display: "flex",
        alignItems: "center",
        gap: 8,
        transition: "color 0.2s ease",
    },
    tabBadge: {
        fontSize: 11,
        background: "#1a1a1a",
        color: "#fff",
        borderRadius: 10,
        padding: "2px 7px",
    },
    matchList: {
        display: "flex",
        flexDirection: "column",
        gap: 16,
    },
    emptyState: {
        background: "#fff",
        borderRadius: 2,
        boxShadow: "0 4px 40px rgba(0,0,0,0.04)",
        padding: "64px 48px",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
    },
    emptyIcon: { fontSize: 48, margin: 0 },
    emptyText: {
        fontSize: 18, fontWeight: 400,
        color: "#1a1a1a", margin: 0,
    },
    emptySub: {
        fontSize: 13, color: "#aaa",
        maxWidth: 340, lineHeight: 1.6, margin: 0,
    },
    browseBtn: {
        marginTop: 16,
        background: "#1a1a1a", color: "#fff",
        border: "none", padding: "12px 24px",
        fontSize: 12,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        cursor: "pointer",
        fontFamily: "'Georgia', serif",
        borderRadius: 1,
    },
    matchCard: {
        background: "#fff",
        borderRadius: 2,
        boxShadow: "0 4px 40px rgba(0,0,0,0.06)",
        padding: "28px 32px",
        display: "flex",
        alignItems: "flex-start",
        gap: 24,
    },
    userSection: {
        display: "flex",
        gap: 14,
        minWidth: 200,
        flexShrink: 0,
    },
    avatar: { flexShrink: 0 },
    avatarImg: {
        width: 52, height: 52,
        borderRadius: "50%",
        objectFit: "cover",
        border: "3px solid #ebe9e4",
    },
    avatarPlaceholder: {
        width: 52, height: 52,
        borderRadius: "50%",
        background: "#e8e4dc",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 22, color: "#888",
        border: "3px solid #ebe9e4",
        fontFamily: "'Georgia', serif",
    },
    userInfo: {
        display: "flex",
        flexDirection: "column",
        gap: 3,
    },
    userNameRow: {
        display: "flex",
        alignItems: "center",
        gap: 8, flexWrap: "wrap",
    },
    userName: {
        fontSize: 15, fontWeight: 400,
        color: "#1a1a1a", margin: 0,
    },
    verifiedBadge: {
        fontSize: 10,
        padding: "2px 8px",
        borderRadius: 10,
        background: "#f0faf4",
        color: "#27ae60",
        border: "1px solid #a8e6c1",
    },
    userUniversity: {
        fontSize: 12, color: "#888", margin: 0,
    },
    userNationality: {
        fontSize: 12, color: "#aaa", margin: 0,
    },
    tagsRow: {
        display: "flex",
        flexWrap: "wrap",
        gap: 4, marginTop: 4,
    },
    tag: {
        fontSize: 10,
        padding: "2px 8px",
        background: "#f0ede8",
        color: "#666",
        borderRadius: 10,
    },
    cardDivider: {
        width: 1,
        alignSelf: "stretch",
        background: "#f0ede8",
        flexShrink: 0,
    },
    postSection: {
        flex: 1,
        display: "flex",
        flexDirection: "column",
        gap: 4,
    },
    postLabel: {
        fontSize: 10,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: "#bbb", margin: 0,
        marginBottom: 4,
    },
    postType: {
        fontSize: 14, color: "#1a1a1a",
        margin: 0, fontWeight: 400,
    },
    postDistrict: {
        fontSize: 13, color: "#888", margin: 0,
    },
    postPriceRow: {
        display: "flex",
        gap: 12, alignItems: "center",
        marginTop: 4,
    },
    postPrice: {
        fontSize: 14, color: "#1a1a1a",
        fontWeight: 400,
    },
    postDeposit: {
        fontSize: 12, color: "#aaa",
    },
    addressRevealed: {
        fontSize: 13,
        color: "#27ae60",
        margin: "4px 0 0",
        padding: "6px 10px",
        background: "#f0faf4",
        borderRadius: 4,
    },
    matchDate: {
        fontSize: 11, color: "#bbb",
        margin: "4px 0 0",
    },
    actionSection: {
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 10,
        flexShrink: 0,
        minWidth: 140,
    },
    statusBadge: {
        fontSize: 11,
        padding: "4px 12px",
        borderRadius: 20,
        fontFamily: "'Georgia', serif",
    },
    actionBtns: {
        display: "flex",
        flexDirection: "column",
        gap: 8, width: "100%",
    },
    acceptBtn: {
        background: "#1a1a1a", color: "#fff",
        border: "none", padding: "10px 16px",
        fontSize: 12,
        letterSpacing: "0.05em",
        cursor: "pointer",
        fontFamily: "'Georgia', serif",
        borderRadius: 1,
        width: "100%",
    },
    declineBtn: {
        background: "transparent",
        color: "#c0392b",
        border: "1.5px solid #fecaca",
        padding: "10px 16px",
        fontSize: 12,
        letterSpacing: "0.05em",
        cursor: "pointer",
        fontFamily: "'Georgia', serif",
        borderRadius: 1,
        width: "100%",
    },
    cancelBtn: {
        background: "transparent",
        color: "#888",
        border: "1.5px solid #ddd",
        padding: "10px 16px",
        fontSize: 12,
        cursor: "pointer",
        fontFamily: "'Georgia', serif",
        borderRadius: 1,
        width: "100%",
    },
    chatBtn: {
        background: "#1a1a1a", color: "#fff",
        border: "none", padding: "10px 16px",
        fontSize: 12,
        letterSpacing: "0.05em",
        cursor: "pointer",
        fontFamily: "'Georgia', serif",
        borderRadius: 1,
        width: "100%",
    },
    viewPostBtn: {
        background: "transparent",
        color: "#888",
        border: "1.5px solid #ddd",
        padding: "8px 16px",
        fontSize: 11,
        cursor: "pointer",
        fontFamily: "'Georgia', serif",
        borderRadius: 1,
        width: "100%",
        letterSpacing: "0.05em",
    },
};

