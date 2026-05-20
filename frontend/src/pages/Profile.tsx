import type { ChangeEvent, CSSProperties } from "react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { LANGUAGES, LIFESTYLE_TAGS } from "../lib/profileOptions";
import { NATIONALITIES, UNIVERSITIES } from "../lib/registerOptions";
import { logoutUser } from "../services/authService";
import {
    getCurrentUserProfile,
    getEmptyProfile,
    updateUserProfile,
    uploadProfilePhoto,
    uploadStudentIdCard,
} from "../services/profileService";
import type { UserProfile } from "../types/user";

export default function Profile() {
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editing, setEditing] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [studentIdFile, setStudentIdFile] = useState<File | null>(null);

    const [profile, setProfile] = useState<UserProfile>(getEmptyProfile());

    useEffect(() => {
        fetchProfile();
    }, []);

    // Fetch the current user's profile from the backend
    const fetchProfile = async () => {
        setLoading(true);

        try {
            const data = await getCurrentUserProfile();

            if (!data) {
                navigate("/login");
                return;
            }

            setProfile(data);
        } catch (err: any) {
            console.error("FETCH PROFILE ERROR:", err);
            setError(err.message || "Failed to load profile.");
        } finally {
            setLoading(false);
        }
    };

    // Handle profile photo change
    const handlePhotoChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];

        if (!file) return;

        if (!file.type.startsWith("image/")) {
            setError("Please select a valid image file.");
            return;
        }

        if (file.size > 2 * 1024 * 1024) { //2MB limit
            setError("Please select an image file smaller than 2MB.");
            return;
        }

        setPhotoFile(file);
        setPhotoPreview(URL.createObjectURL(file));
        setError("");
    };

    // Handle student ID document change
    const handleStudentIdChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];

        if (!file) return;

        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp",
            "application/pdf",
        ];

        if (!allowedTypes.includes(file.type)) {
            setError("Student ID must be an image or PDF file.");
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            setError("Student ID file must be less than 2MB.");
            return;
        }

        setStudentIdFile(file);
        setError("");
    };


    // toggle lifestyle tags and language tags
    const toggleTag = (
        tag: string,
        field: "lifestyle_tags" | "language_spoken"
    ) => {
        setProfile((prev) => {
            const current = prev[field] || [];
            const updated = current.includes(tag)
                ? current.filter((t) => t !== tag)
                : [...current, tag];

            return { ...prev, [field]: updated };
        });
    };


    /** Handle saving profile changes:
     * push button Save Changes
     * select new profile photo -> upload to bucket profile-photos, get new URL -> update profile_photo in users table with new photo URL
     * update other profile details
     * show success message or error message 
     */
    const handleSave = async () => {
        setSaving(true);
        setError("");
        setSuccess("");

        try {
            if (!profile.id) {
                throw new Error("Profile ID is missing. Please login again.");
            }
            let photoUrl = profile.profile_photo;
            let studentIdUrl = profile.student_id_doc;
            let nextVerifiedStatus = profile.is_verified;

            if (photoFile) {
                photoUrl = await uploadProfilePhoto(profile.id, photoFile);
            }
            if (studentIdFile) {
                studentIdUrl = await uploadStudentIdCard(profile.id, studentIdFile);
                nextVerifiedStatus = true; // successfully upload student ID -> verified student
            }

            // Update user profile with new details
            await updateUserProfile({
                id: profile.id,
                name: profile.name,
                university: profile.university,
                nationality: profile.nationality,
                budget_min: profile.budget_min,
                budget_max: profile.budget_max,
                lifestyle_tags: profile.lifestyle_tags,
                language_spoken: profile.language_spoken,
                profile_photo: photoUrl,
                student_id_doc: studentIdUrl,
                is_verified: nextVerifiedStatus
            });

            setProfile((prev) => ({
                ...prev,
                profile_photo: photoUrl,
                student_id_doc: studentIdUrl,
                is_verified: nextVerifiedStatus,
            }));

            setSuccess("Profile updated successfully.");
            setEditing(false);
            setPhotoFile(null);
            setPhotoPreview(null);
            setStudentIdFile(null);
        } catch (err: any) {
            console.error("SAVE PROFILE ERROR:", err);
            setError(err.message || "Failed to save profile. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    // Handle user logout
    const handleLogout = async () => {
        try {
            await logoutUser();
            navigate("/login");
        } catch (err: any) {
            setError("Failed to sign out. Please try again.");
        }
    };

    if (loading) {
        return (
            <div style={styles.loadingPage}>
                <p style={styles.loadingText}>Loading your profile...</p>
            </div>
        );
    }

    const avatarSrc = photoPreview || profile.profile_photo;

    return (
        <div style={styles.page}>
            <div style={styles.bgAccent} />
            {/* Top Navigation */}
            <nav style={styles.nav}>
                <p style={styles.brand}>roomies</p>
                <div style={styles.navRight}>
                    <button style={styles.navLink} onClick={() => navigate("/browse")}>Browse</button>
                    <button style={styles.navLink} onClick={() => navigate("/matches")}>Matches</button>
                    <button style={styles.navLink} onClick={() => navigate("/chat")}>Chat</button>
                    <button style={styles.navLink} onClick={() => navigate("/review")}>Review</button>
                    <button style={styles.navLink} onClick={handleLogout}>Sign out</button>
                </div>
            </nav>
            <div style={styles.container}>
                {/*Left -avatar + identity*/}
                <div style={styles.leftPanel}>
                    <div style={styles.avatarWrap}>
                        {avatarSrc ? (
                            <img src={avatarSrc} alt="Profile" style={styles.avatar} />
                        ) : (
                            <div style={styles.avatarPlaceholder}>
                                {profile.name ? profile.name[0].toUpperCase() : "?"}
                            </div>
                        )}
                        {editing && (
                            <label style={styles.photoUploadBtn}>
                                <input type="file" accept="image/*"
                                    style={{ display: "none" }} onChange={handlePhotoChange} />
                                Change photo
                            </label>
                        )}
                    </div>
                    <h2 style={styles.profileName}>{profile.name || "Your Name"}</h2>
                    <p style={styles.profileEmail}>{profile.email}</p>

                    <div style={styles.verifiedBadge}>
                        {profile.is_verified ? (
                            <span style={{ ...styles.badge, background: "#f0faf4", color: "#27ae60", border: "1px solid #a8e6c1" }}>
                                ✓ Verified Student
                            </span>
                        ) : (
                            <span style={{ ...styles.badge, background: "#fdfaf0", color: "#b8860b", border: "1px solid #f0dc82" }}>
                                ⏳ Pending Verification
                            </span>
                        )}
                    </div>

                    {profile.lifestyle_tags?.length > 0 && (
                        <div style={styles.tagsWrap}>
                            {profile.lifestyle_tags.map((tag) => (
                                <span key={tag} style={styles.tag}>{tag}</span>
                            ))}
                        </div>
                    )}
                </div>

                {/* Right — editable details */}
                <div style={styles.rightPanel}>
                    <div style={styles.headerRow}>
                        <div>
                            <h2 style={styles.sectionTitle}>My Profile</h2>
                            <p style={styles.sectionSub}>Manage your roommate preferences</p>
                        </div>
                        {!editing ? (
                            <button style={styles.editBtn} onClick={() => setEditing(true)}>
                                Edit Profile
                            </button>
                        ) : (
                            <div style={styles.btnRow}>
                                <button style={styles.cancelBtn} onClick={() => {
                                    setEditing(false);
                                    setError("");
                                    setSuccess("");
                                    setPhotoFile(null);
                                    setPhotoPreview(null);
                                    setStudentIdFile(null);
                                }}>
                                    Cancel
                                </button>
                                <button style={styles.saveBtn} onClick={handleSave} disabled={saving}>
                                    {saving ? "Saving..." : "Save Changes"}
                                </button>
                            </div>
                        )}
                    </div>

                    {error && <div style={styles.errorBox}>{error}</div>}
                    {success && <div style={styles.successBox}>{success}</div>}

                    {/* Basic Info */}
                    <div style={styles.section}>
                        <p style={styles.sectionLabel}>Basic Information</p>
                        <div style={styles.grid2}>
                            <div style={styles.fieldGroup}>
                                <label style={styles.label}>Full Name</label>
                                {editing ? (
                                    <input style={styles.input} value={profile.name}
                                        onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
                                ) : (
                                    <p style={styles.value}>{profile.name || "—"}</p>
                                )}
                            </div>

                            <div style={styles.fieldGroup}>
                                <label style={styles.label}>University</label>
                                {editing ? (
                                    <select style={styles.select} value={profile.university}
                                        onChange={(e) => setProfile({ ...profile, university: e.target.value })}>
                                        <option value="">Select university</option>
                                        {UNIVERSITIES.map(u => <option key={u} value={u}>{u}</option>)}
                                    </select>
                                ) : (
                                    <p style={styles.value}>{profile.university || "—"}</p>
                                )}
                            </div>

                            <div style={styles.fieldGroup}>
                                <label style={styles.label}>Nationality</label>
                                {editing ? (
                                    <select style={styles.select} value={profile.nationality}
                                        onChange={(e) => setProfile({ ...profile, nationality: e.target.value })}>
                                        <option value="">Select nationality</option>
                                        {NATIONALITIES.map(n => <option key={n} value={n}>{n}</option>)}
                                    </select>
                                ) : (
                                    <p style={styles.value}>{profile.nationality || "—"}</p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div style={styles.divider} />

                    {/* Budget */}
                    <div style={styles.section}>
                        <p style={styles.sectionLabel}>Monthly Budget (KRW)</p>
                        <div style={styles.grid2}>
                            <div style={styles.fieldGroup}>
                                <label style={styles.label}>Minimum</label>
                                {editing ? (
                                    <input style={styles.input} type="number" placeholder="e.g. 300000"
                                        value={profile.budget_min || ""}
                                        onChange={(e) => setProfile({ ...profile, budget_min: Number(e.target.value) })} />
                                ) : (
                                    <p style={styles.value}>
                                        {profile.budget_min ? `₩${profile.budget_min.toLocaleString()}` : "—"}
                                    </p>
                                )}
                            </div>

                            <div style={styles.fieldGroup}>
                                <label style={styles.label}>Maximum</label>
                                {editing ? (
                                    <input style={styles.input} type="number" placeholder="e.g. 700000"
                                        value={profile.budget_max || ""}
                                        onChange={(e) => setProfile({ ...profile, budget_max: Number(e.target.value) })} />
                                ) : (
                                    <p style={styles.value}>
                                        {profile.budget_max ? `₩${profile.budget_max.toLocaleString()}` : "—"}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Student ID Upload */}
                    <div style={styles.divider} />

                    <div style={styles.section}>
                        <p style={styles.sectionLabel}>Student Verification</p>

                        {profile.is_verified ? (
                            <div style={styles.verifiedInfoBox}>
                                <p style={styles.verifiedText}>
                                    ✓ Student ID uploaded. Verified Student.
                                </p>
                            </div>
                        ) : (
                            <div style={styles.fieldGroup}>
                                <p style={styles.verificationDescription}>
                                    Upload your student ID card or enrollment certificate to verify your student status.
                                </p>

                                {profile.student_id_doc && (
                                    <p style={styles.hint}>
                                        Student ID file has already been uploaded and is waiting for verification.
                                    </p>
                                )}

                                {editing ? (
                                    <>
                                        <label style={styles.uploadBox}>
                                            <input
                                                type="file"
                                                accept="image/jpeg,image/png,image/webp,application/pdf"
                                                style={{ display: "none" }}
                                                onChange={handleStudentIdChange}
                                            />

                                            <span style={styles.uploadText}>
                                                {studentIdFile
                                                    ? studentIdFile.name
                                                    : "Upload student ID card or enrollment certificate"}
                                            </span>
                                        </label>

                                        <p style={styles.hint}>
                                            JPG, PNG, WEBP, or PDF. Max 5MB. Kept private.
                                        </p>
                                    </>
                                ) : (
                                    <p style={styles.hint}>
                                        Click Edit Profile to upload your student ID card.
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    <div style={styles.divider} />
                    {/* Lifestyle Tags */}
                    <div style={styles.section}>
                        <p style={styles.sectionLabel}>Lifestyle</p>
                        <div style={styles.tagsGrid}>
                            {LIFESTYLE_TAGS.map((tag) => {
                                const active = profile.lifestyle_tags?.includes(tag);
                                return (
                                    <button key={tag} disabled={!editing}
                                        onClick={() => toggleTag(tag, "lifestyle_tags")}
                                        style={{
                                            ...styles.tagBtn,
                                            background: active ? "#1a1a1a" : "transparent",
                                            color: active ? "#fff" : "#888",
                                            border: active ? "1.5px solid #1a1a1a" : "1.5px solid #ddd",
                                            cursor: editing ? "pointer" : "default",
                                        }}>
                                        {tag}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div style={styles.divider} />

                    {/* Languages */}
                    <div style={styles.section}>
                        <p style={styles.sectionLabel}>Languages Spoken</p>
                        <div style={styles.tagsGrid}>
                            {LANGUAGES.map((lang) => {
                                const active = profile.language_spoken?.includes(lang);
                                return (
                                    <button key={lang} disabled={!editing}
                                        onClick={() => toggleTag(lang, "language_spoken")}
                                        style={{
                                            ...styles.tagBtn,
                                            background: active ? "#1a1a1a" : "transparent",
                                            color: active ? "#fff" : "#888",
                                            border: active ? "1.5px solid #1a1a1a" : "1.5px solid #ddd",
                                            cursor: editing ? "pointer" : "default",
                                        }}>
                                        {lang}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
const styles: Record<string, CSSProperties> = {
    page: {
        minHeight: "100vh",
        background: "#fafaf8",
        fontFamily: "'Georgia', serif",
        position: "relative",
        overflowX: "hidden",
        overflowY: "auto",
    },
    bgAccent: {
        position: "fixed",
        top: -200,
        right: -200,
        width: 600,
        height: 600,
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
        fontFamily: "'Georgia', serif",
        fontSize: 15,
        color: "#aaa",
        letterSpacing: "0.05em",
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
        textTransform: "uppercase" as const,
        color: "#888",
        fontFamily: "'Georgia', serif",
    },
    navRight: {
        display: "flex",
        gap: 24,
        alignItems: "center",
    },
    navLink: {
        background: "none",
        border: "none",
        fontSize: 13,
        color: "#888",
        cursor: "pointer",
        fontFamily: "'Georgia', serif",
        letterSpacing: "0.05em",
    },
    container: {
        display: "flex",
        maxWidth: 1100,
        margin: "48px auto",
        gap: 40,
        padding: "0 40px",
        position: "relative",
        zIndex: 1,
    },
    leftPanel: {
        width: 260,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
    },
    avatarWrap: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: "50%",
        objectFit: "cover" as const,
        border: "3px solid #ebe9e4",
    },
    avatarPlaceholder: {
        width: 100,
        height: 100,
        borderRadius: "50%",
        background: "#e8e4dc",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 36,
        color: "#888",
        fontFamily: "'Georgia', serif",
        border: "3px solid #ebe9e4",
    },
    photoUploadBtn: {
        fontSize: 12,
        color: "#888",
        textDecoration: "underline",
        cursor: "pointer",
        fontFamily: "'Georgia', serif",
        letterSpacing: "0.05em",
    },
    profileName: {
        fontSize: 20,
        fontWeight: 400,
        color: "#1a1a1a",
        textAlign: "center" as const,
        fontFamily: "'Georgia', serif",
        marginTop: 4,
    },
    profileEmail: {
        fontSize: 12,
        color: "#aaa",
        textAlign: "center" as const,
        fontFamily: "'Georgia', serif",
    },
    verifiedBadge: {
        marginTop: 4,
    },
    badge: {
        fontSize: 11,
        padding: "4px 12px",
        borderRadius: 20,
        fontFamily: "'Georgia', serif",
        letterSpacing: "0.03em",
    },

    uploadBox: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "1.5px dashed #ddd",
        padding: "16px 20px",
        cursor: "pointer",
        transition: "border-color 0.2s ease",
        borderRadius: 2,
        marginTop: 8,
    },
    verificationDescription: {
        fontSize: 14,
        color: "#666",
        fontFamily: "'Georgia', serif",
        lineHeight: 1.6,
        marginBottom: 8,
    },

    uploadText: {
        fontSize: 13,
        color: "#888",
        fontFamily: "'Georgia', serif",
    },

    hint: {
        fontSize: 11,
        color: "#bbb",
        fontFamily: "'Georgia', serif",
        marginTop: 6,
    },

    verifiedInfoBox: {
        background: "#f0faf4",
        border: "1px solid #a8e6c1",
        padding: "12px 16px",
        borderRadius: 2,
    },

    verifiedText: {
        fontSize: 13,
        color: "#27ae60",
        fontFamily: "'Georgia', serif",
    },

    tagsWrap: {
        display: "flex",
        flexWrap: "wrap" as const,
        gap: 6,
        justifyContent: "center",
        marginTop: 8,
    },
    tag: {
        fontSize: 11,
        padding: "4px 10px",
        background: "#f0ede8",
        color: "#666",
        borderRadius: 20,
        fontFamily: "'Georgia', serif",
    },
    rightPanel: {
        flex: 1,
        background: "#ffffff",
        borderRadius: 2,
        boxShadow: "0 4px 40px rgba(0,0,0,0.06)",
        padding: "40px 48px",
    },
    headerRow: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 32,
    },
    sectionTitle: {
        fontSize: 24,
        fontWeight: 400,
        color: "#1a1a1a",
        fontFamily: "'Georgia', serif",
        marginBottom: 4,
    },
    sectionSub: {
        fontSize: 13,
        color: "#aaa",
        fontFamily: "'Georgia', serif",
    },
    editBtn: {
        background: "transparent",
        border: "1.5px solid #1a1a1a",
        padding: "10px 24px",
        fontSize: 12,
        letterSpacing: "0.1em",
        textTransform: "uppercase" as const,
        cursor: "pointer",
        fontFamily: "'Georgia', serif",
        color: "#1a1a1a",
        borderRadius: 1,
    },
    btnRow: {
        display: "flex",
        gap: 10,
    },
    cancelBtn: {
        background: "transparent",
        border: "1.5px solid #ddd",
        padding: "10px 20px",
        fontSize: 12,
        cursor: "pointer",
        fontFamily: "'Georgia', serif",
        color: "#888",
        borderRadius: 1,
    },
    saveBtn: {
        background: "#1a1a1a",
        border: "none",
        padding: "10px 24px",
        fontSize: 12,
        letterSpacing: "0.1em",
        textTransform: "uppercase" as const,
        cursor: "pointer",
        fontFamily: "'Georgia', serif",
        color: "#fff",
        borderRadius: 1,
    },
    errorBox: {
        background: "#fff5f5",
        border: "1px solid #fecaca",
        color: "#c0392b",
        padding: "12px 16px",
        borderRadius: 2,
        fontSize: 13,
        marginBottom: 20,
        fontFamily: "'Georgia', serif",
    },
    successBox: {
        background: "#f0faf4",
        border: "1px solid #a8e6c1",
        color: "#27ae60",
        padding: "12px 16px",
        borderRadius: 2,
        fontSize: 13,
        marginBottom: 20,
        fontFamily: "'Georgia', serif",
    },
    section: {
        marginBottom: 8,
    },
    sectionLabel: {
        fontSize: 11,
        letterSpacing: "0.15em",
        textTransform: "uppercase" as const,
        color: "#aaa",
        marginBottom: 16,
        fontFamily: "'Georgia', serif",
    },
    grid2: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 24,
    },
    fieldGroup: {
        display: "flex",
        flexDirection: "column",
        gap: 6,
    },
    label: {
        fontSize: 11,
        letterSpacing: "0.08em",
        textTransform: "uppercase" as const,
        color: "#bbb",
        fontFamily: "'Georgia', serif",
    },
    input: {
        border: "none",
        borderBottom: "1.5px solid #ddd",
        padding: "8px 0",
        fontSize: 14,
        fontFamily: "'Georgia', serif",
        color: "#1a1a1a",
        background: "transparent",
        outline: "none",
        width: "100%",
    },
    select: {
        border: "none",
        borderBottom: "1.5px solid #ddd",
        padding: "8px 0",
        fontSize: 14,
        fontFamily: "'Georgia', serif",
        color: "#1a1a1a",
        background: "transparent",
        outline: "none",
        width: "100%",
        appearance: "none" as const,
        cursor: "pointer",
    },
    value: {
        fontSize: 15,
        color: "#1a1a1a",
        fontFamily: "'Georgia', serif",
        padding: "8px 0",
        borderBottom: "1.5px solid transparent",
    },
    divider: {
        height: 1,
        background: "#f0ede8",
        margin: "24px 0",
    },
    tagsGrid: {
        display: "flex",
        flexWrap: "wrap" as const,
        gap: 8,
    },
    tagBtn: {
        padding: "6px 14px",
        fontSize: 12,
        fontFamily: "'Georgia', serif",
        borderRadius: 20,
        transition: "all 0.2s ease",
        letterSpacing: "0.03em",
    },
};