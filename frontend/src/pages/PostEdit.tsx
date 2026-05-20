import axios from "axios";
import type { ChangeEvent, CSSProperties, FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { API } from "../lib/api";
import { supabase } from "../lib/supabase";

function getRequestErrorMessage(err: any, fallback: string): string {
    if (err?.response?.data?.message) return err.response.data.message;
    if (err?.code === "ERR_NETWORK") return `Cannot connect to backend at ${API}. Please start the backend server.`;
    return err?.message || fallback;
}

const tagGroups = [
    {
        title: "Lifestyle",
        tags: ["Non-smoker", "Smoking allowed", "Early bird", "Night owl", "Regular routine", "Irregular schedule"],
    },
    {
        title: "Cleanliness",
        tags: ["Very clean", "Moderate cleanliness", "Shared cleaning", "Does dishes quickly", "Keeps common areas clean"],
    },
    {
        title: "Noise & Social",
        tags: ["Quiet lifestyle", "Social lifestyle", "Guest-friendly", "Few guests preferred", "Sleeps early", "Studies at home"],
    },
    {
        title: "Housing Preference",
        tags: ["Pets allowed", "No pets", "Short-term available", "Long-term preferred", "Furnished room", "Near public transit"],
    },
    {
        title: "Personal Habits",
        tags: ["Cooks often", "Eats out often", "No alcohol at home", "Comfortable with shared items"],
    },
];

const postTypeMap: Record<string, string> = {
    "Room Available": "room_available",
    "Looking for Room": "looking_for_room",
    "Short-term Rental": "sublet",
    "Contract Transfer": "lease_takeover",
};

const postTypeLabels: Record<string, string> = {
    room_available: "Room Available",
    looking_for_room: "Looking for Room",
    sublet: "Short-term Rental",
    lease_takeover: "Contract Transfer",
};

const roomTypeOptions = [
    { label: "No Preference", value: "" },
    { label: "Studio", value: "studio" },
    { label: "One Room", value: "one_room" },
    { label: "Officetel", value: "officetel" },
    { label: "Apartment", value: "apartment" },
    { label: "Shared House", value: "shared_house" },
];

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

async function getToken() {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || "";
}

async function getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}

export default function PostEdit() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [form, setForm] = useState({
        postType: "Room Available",
        region: "",
        address: "",
        nearUniversity: "",
        roomType: "",
        rent: "",
        deposit: "",
        moveInDate: "",
        moveOutDate: "",
        genderPreference: "No Preference",
        descriptionEn: "",
        descriptionKo: "",
    });
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [existingPhotos, setExistingPhotos] = useState<string[]>([]);
    const [photoFiles, setPhotoFiles] = useState<File[]>([]);
    const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const loadPost = useCallback(async () => {
        if (!id) return;

        setLoading(true);
        setError("");

        try {
            const token = await getToken();
            const { data } = await axios.get(`${API}/posts/${id}/edit`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            setForm({
                postType: postTypeLabels[data.post_type] || "Room Available",
                region: data.district || "",
                address: data.full_address || "",
                nearUniversity: data.near_university || "",
                roomType: data.room_type || "",
                rent: String(data.monthly_rent || ""),
                deposit: String(data.deposit || ""),
                moveInDate: data.available_from || "",
                moveOutDate: data.available_until || "",
                genderPreference: data.gender_preference || "No Preference",
                descriptionEn: data.description_en || "",
                descriptionKo: data.description_ko || "",
            });
            const photos = normalizePhotos(data.photos);
            setSelectedTags(data.lifestyle_tags || []);
            setExistingPhotos(photos);
            setPhotoPreviews(photos);
        } catch (err: any) {
            setError(getRequestErrorMessage(err, "You are not allowed to edit this post."));
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        loadPost();
    }, [loadPost]);

    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
        setError("");
    };

    const toggleTag = (tag: string) => {
        setSelectedTags((prev) =>
            prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]
        );
    };

    const handlePhotoChange = (e: ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []).slice(0, 3);
        if (files.length === 0) return;

        setPhotoFiles(files);
        Promise.all(
            files.map((file) => new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result));
                reader.readAsDataURL(file);
            }))
        ).then((previews) => setPhotoPreviews(previews));
    };

    const uploadPhotos = async (): Promise<string[]> => {
        const user = await getCurrentUser();
        if (!user) throw new Error("Please login again.");

        const urls: string[] = [];
        for (const file of photoFiles) {
            const fileExt = file.name.split(".").pop();
            const fileName = `${user.id}/${Date.now()}.${fileExt}`;
            const { error: uploadError } = await supabase.storage
                .from("room-photos")
                .upload(fileName, file, { upsert: true });

            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage
                .from("room-photos")
                .getPublicUrl(fileName);
            urls.push(urlData.publicUrl);
        }
        return urls;
    };

    const submitPost = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!id) return;

        if (!form.region.trim() || !form.rent.trim() || !form.moveInDate.trim() || !form.descriptionEn.trim()) {
            setError("Please fill in all required fields.");
            return;
        }

        setSaving(true);
        setError("");

        try {
            const token = await getToken();
            const nextPhotos = photoFiles.length > 0 ? await uploadPhotos() : existingPhotos;

            await axios.put(`${API}/posts/${id}`, {
                post_type: postTypeMap[form.postType],
                district: form.region,
                full_address: form.address,
                near_university: form.nearUniversity,
                room_type: form.roomType || null,
                monthly_rent: Number(form.rent),
                deposit: Number(form.deposit || 0),
                available_from: form.moveInDate,
                available_until: form.moveOutDate || null,
                gender_preference: form.genderPreference,
                lifestyle_tags: selectedTags,
                description_en: form.descriptionEn,
                description_ko: form.descriptionKo,
                photos: nextPhotos,
            }, {
                headers: { Authorization: `Bearer ${token}` },
            });

            navigate(`/post-detail/${id}`);
        } catch (err: any) {
            setError(getRequestErrorMessage(err, "Failed to update post."));
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div style={styles.loadingPage}>Loading post...</div>;
    }

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
                <button style={styles.backBtn} onClick={() => navigate(`/post-detail/${id}`)}>
                    Back to Post
                </button>

                <section style={styles.header}>
                    <p style={styles.kicker}>EDIT POST</p>
                    <h1 style={styles.title}>Update Room Post</h1>
                    <p style={styles.description}>
                        Edit room details, budget, move-in date, lifestyle tags, and photos.
                    </p>
                </section>

                <form style={styles.formPanel} onSubmit={submitPost}>
                    {error && <div style={styles.errorBox}>{error}</div>}

                    <div style={styles.section}>
                        <p style={styles.sectionLabel}>Basic Information</p>
                        <div style={styles.grid2}>
                            <Field label="Post Type">
                                <select aria-label="Post Type" name="postType" value={form.postType} onChange={handleChange} style={styles.select}>
                                    <option value="Room Available">Room Available</option>
                                    <option value="Looking for Room">Looking for Room</option>
                                    <option value="Short-term Rental">Short-term Rental</option>
                                    <option value="Contract Transfer">Contract Transfer</option>
                                </select>
                            </Field>
                            <Field label="Region / District">
                                <input aria-label="Region / District" name="region" value={form.region} onChange={handleChange} style={styles.input} />
                            </Field>
                        </div>

                        <div style={styles.grid2}>
                            <Field label="Full Address">
                                <input aria-label="Full Address" name="address" value={form.address} onChange={handleChange} style={styles.input} />
                            </Field>
                            <Field label="Near University">
                                <input aria-label="Near University" name="nearUniversity" value={form.nearUniversity} onChange={handleChange} style={styles.input} />
                            </Field>
                        </div>

                        <div style={styles.grid2}>
                            <Field label="Room Type">
                                <select
                                    aria-label="Room Type"
                                    name="roomType"
                                    value={form.roomType}
                                    onChange={handleChange}
                                    style={styles.select}
                                >
                                    {roomTypeOptions.map((option) => (
                                        <option key={option.value || "empty"} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </Field>
                        </div>
                    </div>

                    <div style={styles.divider} />

                    <div style={styles.section}>
                        <p style={styles.sectionLabel}>Budget & Dates</p>
                        <div style={styles.grid4}>
                            <Field label="Monthly Rent (10,000 KRW)">
                                <input aria-label="Monthly Rent" name="rent" type="number" min="0" value={form.rent} onChange={handleChange} style={styles.input} />
                            </Field>
                            <Field label="Deposit (10,000 KRW)">
                                <input aria-label="Deposit" name="deposit" type="number" min="0" value={form.deposit} onChange={handleChange} style={styles.input} />
                            </Field>
                            <Field label="Move-in Date">
                                <input aria-label="Move-in Date" name="moveInDate" type="date" value={form.moveInDate} onChange={handleChange} style={styles.input} />
                            </Field>
                            <Field label="Move-out Date">
                                <input aria-label="Move-out Date" name="moveOutDate" type="date" value={form.moveOutDate} onChange={handleChange} style={styles.input} />
                            </Field>
                        </div>
                    </div>

                    <div style={styles.divider} />

                    <div style={styles.section}>
                        <p style={styles.sectionLabel}>Preferences</p>
                        <div style={styles.grid2}>
                            <Field label="Gender Preference">
                                <select aria-label="Gender Preference" name="genderPreference" value={form.genderPreference} onChange={handleChange} style={styles.select}>
                                    <option value="No Preference">No Preference</option>
                                    <option value="Female Preferred">Female Preferred</option>
                                    <option value="Male Preferred">Male Preferred</option>
                                </select>
                            </Field>
                        </div>

                        <div style={styles.tagGroupWrap}>
                            {tagGroups.map((group) => (
                                <div key={group.title} style={styles.tagGroup}>
                                    <p style={styles.tagGroupTitle}>{group.title}</p>
                                    <div style={styles.tagsGrid}>
                                        {group.tags.map((tag) => {
                                            const active = selectedTags.includes(tag);
                                            return (
                                                <button
                                                    key={tag}
                                                    type="button"
                                                    onClick={() => toggleTag(tag)}
                                                    style={{
                                                        ...styles.tagBtn,
                                                        background: active ? "#1a1a1a" : "transparent",
                                                        color: active ? "#fff" : "#888",
                                                        border: active ? "1.5px solid #1a1a1a" : "1.5px solid #ddd",
                                                    }}
                                                >
                                                    {tag}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div style={styles.divider} />

                    <div style={styles.section}>
                        <p style={styles.sectionLabel}>Room Photos</p>
                        <label style={styles.uploadBox}>
                            <input aria-label="Room Photos" type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handlePhotoChange} />
                            <span style={styles.uploadText}>
                                {photoFiles.length > 0 ? `${photoFiles.length} new photo(s) selected` : "Replace photos"}
                            </span>
                        </label>
                        <div style={styles.previewGrid}>
                            {photoPreviews.length > 0 ? (
                                photoPreviews.map((photo, index) => (
                                    <img key={`${photo}-${index}`} src={photo} alt={`Room ${index + 1}`} style={styles.previewImage} />
                                ))
                            ) : (
                                <p style={styles.hint}>No photos selected.</p>
                            )}
                        </div>
                    </div>

                    <div style={styles.divider} />

                    <div style={styles.section}>
                        <p style={styles.sectionLabel}>Description</p>
                        <Field label="English Description">
                            <textarea aria-label="English Description" name="descriptionEn" value={form.descriptionEn} onChange={handleChange} style={styles.textarea} />
                        </Field>
                    </div>

                    <button type="submit" style={styles.submitBtn} disabled={saving}>
                        {saving ? "Saving..." : "Save Changes"}
                    </button>
                </form>
            </main>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div style={styles.fieldGroup}>
            <label style={styles.label}>{label}</label>
            {children}
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
    header: { background: "#ffffff", borderRadius: 2, boxShadow: "0 4px 40px rgba(0,0,0,0.06)", padding: "40px 48px", marginBottom: 28 },
    kicker: { fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "#aaa", margin: "0 0 16px" },
    title: { fontSize: 32, fontWeight: 400, color: "#1a1a1a", margin: "0 0 10px" },
    description: { fontSize: 14, color: "#888", lineHeight: 1.7, maxWidth: 680, margin: 0 },
    formPanel: { background: "#ffffff", borderRadius: 2, boxShadow: "0 4px 40px rgba(0,0,0,0.06)", padding: "40px 48px" },
    errorBox: { background: "#fff5f5", border: "1px solid #fecaca", color: "#c0392b", padding: "12px 16px", borderRadius: 2, fontSize: 13, marginBottom: 24 },
    section: { marginBottom: 8 },
    sectionLabel: { fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "#aaa", marginBottom: 18 },
    grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 18 },
    grid3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24 },
    grid4: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 24 },
    fieldGroup: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 18 },
    label: { fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "#bbb" },
    input: { border: "none", borderBottom: "1.5px solid #ddd", padding: "8px 0", fontSize: 14, fontFamily: "'Georgia', serif", color: "#1a1a1a", background: "transparent", outline: "none", width: "100%" },
    select: { border: "none", borderBottom: "1.5px solid #ddd", padding: "8px 0", fontSize: 14, fontFamily: "'Georgia', serif", color: "#1a1a1a", background: "transparent", outline: "none", width: "100%", cursor: "pointer" },
    textarea: { border: "1.5px solid #ddd", padding: "14px", fontSize: 14, fontFamily: "'Georgia', serif", color: "#1a1a1a", background: "transparent", outline: "none", width: "100%", minHeight: 120, resize: "vertical", lineHeight: 1.6, boxSizing: "border-box" },
    divider: { height: 1, background: "#f0ede8", margin: "28px 0" },
    tagGroupWrap: { display: "flex", flexDirection: "column", gap: 22, marginTop: 10 },
    tagGroup: { paddingBottom: 4 },
    tagGroupTitle: { fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#aaa", margin: "0 0 10px" },
    tagsGrid: { display: "flex", flexWrap: "wrap", gap: 8 },
    tagBtn: { padding: "6px 14px", fontSize: 12, fontFamily: "'Georgia', serif", borderRadius: 20, transition: "all 0.2s ease", letterSpacing: "0.03em", cursor: "pointer" },
    uploadBox: { display: "flex", alignItems: "center", justifyContent: "center", border: "1.5px dashed #ddd", padding: "20px", cursor: "pointer", borderRadius: 2, marginTop: 8 },
    uploadText: { fontSize: 13, color: "#888" },
    previewGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginTop: 16 },
    previewImage: { width: "100%", height: 130, objectFit: "cover", borderRadius: 2, border: "1px solid #ebe9e4" },
    hint: { fontSize: 11, color: "#bbb", marginTop: 8, lineHeight: 1.6 },
    submitBtn: { width: "100%", background: "#1a1a1a", border: "none", padding: "14px 24px", fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer", fontFamily: "'Georgia', serif", color: "#fff", borderRadius: 1, marginTop: 16 },
};