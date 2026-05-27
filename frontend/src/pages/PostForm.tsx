// Photos uploaded to Supabase Storage directly


import axios from "axios";
import type { ChangeEvent, CSSProperties, FormEvent } from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API } from "../lib/api";
import { supabase } from "../lib/supabase";


// Helper: Get JWT token 
const getToken = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || "";
};

//  Helper: Get current user 
const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};


// Tag Groups for Lifestyle Selection


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

// Map post type from UI label to DB enum
const postTypeMap: Record<string, string> = {
  "Room Available": "room_available",
  "Looking for Room": "looking_for_room",
  "Short-term Rental": "sublet",
  "Contract Transfer": "lease_takeover",
};
const roomTypeOptions = [
  { label: "No Preference", value: "" },
  { label: "Studio", value: "studio" },
  { label: "One Room", value: "one_room" },
  { label: "Officetel", value: "officetel" },
  { label: "Apartment", value: "apartment" },
  { label: "Shared House", value: "shared_house" },
];
const SEOUL_DISTRICTS = [
  { name: "Gangnam-gu", lat: 37.5172, lng: 127.0473 },
  { name: "Gangdong-gu", lat: 37.5301, lng: 127.1238 },
  { name: "Gangbuk-gu", lat: 37.6396, lng: 127.0253 },
  { name: "Gangseo-gu", lat: 37.5509, lng: 126.8495 },
  { name: "Gwanak-gu", lat: 37.4784, lng: 126.9516 },
  { name: "Gwangjin-gu", lat: 37.5384, lng: 127.0822 },
  { name: "Guro-gu", lat: 37.4954, lng: 126.8874 },
  { name: "Geumcheon-gu", lat: 37.4600, lng: 126.9002 },
  { name: "Nowon-gu", lat: 37.6542, lng: 127.0568 },
  { name: "Dobong-gu", lat: 37.6688, lng: 127.0471 },
  { name: "Dongdaemun-gu", lat: 37.5744, lng: 127.0396 },
  { name: "Dongjak-gu", lat: 37.5124, lng: 126.9393 },
  { name: "Mapo-gu", lat: 37.5663, lng: 126.9014 },
  { name: "Seodaemun-gu", lat: 37.5791, lng: 126.9368 },
  { name: "Seocho-gu", lat: 37.4836, lng: 127.0327 },
  { name: "Seongdong-gu", lat: 37.5633, lng: 127.0369 },
  { name: "Seongbuk-gu", lat: 37.5894, lng: 127.0167 },
  { name: "Songpa-gu", lat: 37.5145, lng: 127.1059 },
  { name: "Yangcheon-gu", lat: 37.5270, lng: 126.8561 },
  { name: "Yeongdeungpo-gu", lat: 37.5263, lng: 126.8963 },
  { name: "Yongsan-gu", lat: 37.5326, lng: 126.9905 },
  { name: "Eunpyeong-gu", lat: 37.6027, lng: 126.9291 },
  { name: "Jongno-gu", lat: 37.5735, lng: 126.9790 },
  { name: "Jung-gu", lat: 37.5640, lng: 126.9975 },
  { name: "Jungnang-gu", lat: 37.6063, lng: 127.0928 },
];
// Form State 
const initialForm = {
  postType: "Room Available",
  title: "",
  region: "",
  address: "",
  nearUniversity: "",
  roomType: "",
  rent: "",
  deposit: "",
  moveInDate: "",
  moveOutDate: "",
  genderPreference: "No Preference",
  descriptionKo: "",
  descriptionEn: "",
  latitude: null as number | null,
  longitude: null as number | null,
};

// Main PostForm Component


export default function PostForm() {
  const navigate = useNavigate();

  // Form State 
  const [form, setForm] = useState(initialForm);

  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  //  Handle input changes 
  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    setError("");
    setSuccess("");
  };
  const handleDistrictChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedName = e.target.value;
    const district = SEOUL_DISTRICTS.find(d => d.name === selectedName);

    setForm(prev => ({
      ...prev,
      region: selectedName,
      latitude: district?.lat || null,
      longitude: district?.lng || null,
    }));
  };

  //  Toggle lifestyle tag 
  const toggleTag = (tag: string) => {
    setSuccess("");
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  // Handle photo selection — show previews 
  const handlePhotoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 3);
    if (files.length === 0) return;

    setPhotoFiles(files);
    setSuccess("");

    // Generate preview URLs
    Promise.all(
      files.map(file => new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.readAsDataURL(file);
      }))
    ).then(previews => setPhotoPreviews(previews));
  };

  // Upload photos to Supabase Storage
  // File uploads go directly to Supabase Storage (agreed approach)
  const uploadPhotos = async (userId: string): Promise<string[]> => {
    const urls: string[] = [];
    for (const file of photoFiles) {
      const fileExt = file.name.split(".").pop();
      const fileName = `${userId}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("room-photos")
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        throw uploadError;
      }

      const { data: urlData } = supabase.storage
        .from("room-photos")
        .getPublicUrl(fileName);
      urls.push(urlData.publicUrl);
    }
    return urls;
  };

  

  // Submit post to Express backend
  const submitPost = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    // Validate required fields
    if (!form.region.trim() || !form.rent.trim() || !form.moveInDate.trim() || !form.descriptionEn.trim()) {
      setError("Please fill in all required fields.");
      return;
    }

    setSubmitting(true);

    try {
      const user = await getCurrentUser();
      if (!user) { navigate("/login"); return; }

      const token = await getToken();
      console.log("Token:", token); // Debug: Check if token is retrieved

      // Upload photos to Supabase Storage first
      const photoUrls = await uploadPhotos(user.id);

      
      

      // Send post data to Express backend with coordinates
      await axios.post(`${API}/posts`, {
        post_type: postTypeMap[form.postType],    // Convert to DB enum
        district: form.region,
        full_address: form.address,               // Hidden until match
        near_university: form.nearUniversity,
        room_type: form.roomType || null,
        monthly_rent: Number(form.rent),
        deposit: Number(form.deposit),
        available_from: form.moveInDate,
        available_until: form.moveOutDate || null,
        gender_preference: form.genderPreference,
        lifestyle_tags: selectedTags,
        description_en: form.descriptionEn,
        description_ko: form.descriptionKo || form.descriptionEn,       // Same for now
        photos: photoUrls,
        status: "active",
        latitude: form.latitude, //add coordinates
        longitude: form.longitude, //add coordinates
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setForm(initialForm);
      setSelectedTags([]);
      setPhotoFiles([]);
      setPhotoPreviews([]);
      setSuccess("Post created successfully.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to create post. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  //Render

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
        <button style={styles.backBtn} onClick={() => navigate("/browse")}>
          ← Back to Browse
        </button>

        {/* ── Page Header ── */}
        <section style={styles.header}>
          <p style={styles.kicker}>CREATE POST</p>
          <h1 style={styles.title}>Write a Room Post</h1>
          <p style={styles.description}>
            Add room details, budget, move-in date, lifestyle tags, and
            description for roommate matching.
          </p>
        </section>

        {/* ── Post Form ── */}
        {error && <div style={styles.errorBox}>{error}</div>}
        {success && <div style={styles.successBox}>{success}</div>}

        <form style={styles.formPanel} onSubmit={submitPost}>

          {/* Error message */}

          {/* ── Basic Information ── */}
          <div style={styles.section}>
            <p style={styles.sectionLabel}>Basic Information</p>

            <div style={styles.grid2}>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Post Type</label>
                <select name="postType" value={form.postType}
                  onChange={handleChange} style={styles.select}>
                  <option value="Room Available">Room Available</option>
                  <option value="Looking for Room">Looking for Room</option>
                  <option value="Short-term Rental">Short-term Rental</option>
                  <option value="Contract Transfer">Contract Transfer</option>
                </select>
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>Region / District</label>
                <select
                  value={form.region}
                  onChange={handleDistrictChange}
                  style={styles.select}>
                  <option value="">Select a district</option>
                  {SEOUL_DISTRICTS.map(d => (
                    <option key={d.name} value={d.name}>{d.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={styles.grid2}>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Full Address</label>
                <input name="address" value={form.address}
                  onChange={handleChange} style={styles.input}
                  placeholder="Hidden until match is accepted" />
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>Near University</label>
                <input name="nearUniversity" value={form.nearUniversity}
                  onChange={handleChange} style={styles.input}
                  placeholder="e.g. 10 min walk to Myongji" />
              </div>
            </div>

            <div style={styles.grid2}>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Room Type</label>
                <select
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
              </div>
            </div>
          </div>

          <div style={styles.divider} />

          {/* ── Budget & Dates ── */}
          <div style={styles.section}>
            <p style={styles.sectionLabel}>Budget & Dates</p>

            <div style={styles.grid4}>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Monthly Rent (10,000 KRW)</label>
                <input name="rent" type="number" min="0"
                  value={form.rent} onChange={handleChange}
                  style={styles.input} placeholder="e.g. 45" />
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>Deposit (10,000 KRW)</label>
                <input name="deposit" type="number" min="0"
                  value={form.deposit} onChange={handleChange}
                  style={styles.input} placeholder="e.g. 500" />
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>Move-in Date</label>
                <input name="moveInDate" type="date"
                  value={form.moveInDate} onChange={handleChange}
                  style={styles.input} />
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>Move-out Date</label>
                <input
                  name="moveOutDate"
                  type="date"
                  value={form.moveOutDate}
                  onChange={handleChange}
                  style={styles.input}
                />
              </div>
            </div>
            <p style={styles.hint}>Enter rent and deposit in units of 10,000 KRW.</p>
          </div>

          <div style={styles.divider} />

          {/* ── Preferences & Tags ── */}
          <div style={styles.section}>
            <p style={styles.sectionLabel}>Preferences</p>

            <div style={styles.grid2}>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Gender Preference</label>
                <select name="genderPreference" value={form.genderPreference}
                  onChange={handleChange} style={styles.select}>
                  <option value="No Preference">No Preference</option>
                  <option value="Female Preferred">Female Preferred</option>
                  <option value="Male Preferred">Male Preferred</option>
                </select>
              </div>
            </div>

            {/* Lifestyle tag groups */}
            <div style={styles.tagGroupWrap}>
              {tagGroups.map((group) => (
                <div key={group.title} style={styles.tagGroup}>
                  <p style={styles.tagGroupTitle}>{group.title}</p>
                  <div style={styles.tagsGrid}>
                    {group.tags.map((tag) => {
                      const active = selectedTags.includes(tag);
                      return (
                        <button key={tag} type="button"
                          onClick={() => toggleTag(tag)}
                          style={{
                            ...styles.tagBtn,
                            background: active ? "#1a1a1a" : "transparent",
                            color: active ? "#fff" : "#888",
                            border: active ? "1.5px solid #1a1a1a" : "1.5px solid #ddd",
                          }}>
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

          {/* ── Room Photos ── */}
          {/* Photos go directly to Supabase Storage (agreed approach) */}
          <div style={styles.section}>
            <p style={styles.sectionLabel}>Room Photos</p>
            <label style={styles.uploadBox}>
              <input type="file" accept="image/*" multiple
                style={{ display: "none" }}
                onChange={handlePhotoChange} />
              <span style={styles.uploadText}>
                {photoFiles.length > 0
                  ? `${photoFiles.length} photo(s) selected`
                  : "Upload up to 3 room photos"}
              </span>
            </label>
            <div style={styles.previewGrid}>
              {photoPreviews.length > 0 ? (
                photoPreviews.map((photo, index) => (
                  <img key={index} src={photo}
                    alt={`room-${index + 1}`} style={styles.previewImage} />
                ))
              ) : (
                <p style={styles.hint}>No photos selected.</p>
              )}
            </div>
          </div>

          <div style={styles.divider} />

          {/* ── Description ── */}
          <div style={styles.section}>
            <p style={styles.sectionLabel}>Description</p>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>English Description</label>
              <textarea name="descriptionEn" value={form.descriptionEn}
                onChange={handleChange} style={styles.textarea}
                placeholder="Please describe the room, lifestyle, and roommate preferences." />
            </div>
          </div>

          {/* ── Submit ── */}
          <button type="submit" style={{
            ...styles.submitBtn,
            opacity: submitting ? 0.7 : 1,
            cursor: submitting ? "not-allowed" : "pointer",
          }} disabled={submitting}>
            {submitting ? "Creating Post..." : "Create Post"}
          </button>
        </form>
      </main>
    </div>
  );
}

//styles
const styles: Record<string, CSSProperties> = {
  page: { minHeight: "100vh", background: "#fafaf8", fontFamily: "'Georgia', serif", position: "relative", overflowX: "hidden", color: "#1a1a1a" },
  bgAccent: { position: "fixed", top: -200, right: -200, width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, #e8e4dc 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 },
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
  successBox: { background: "#f0faf4", border: "1px solid #a8e6c1", color: "#1f8a4c", padding: "12px 16px", borderRadius: 2, fontSize: 13, marginBottom: 24 },
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