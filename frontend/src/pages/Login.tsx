import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loginUser, loginWithSocialProvider } from "../services/authService";

export default function Login() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<"google" | "kakao" | null>(
    null
  );
  const [error, setError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError("");
  };

  const validateLogin = () => {
    if (!form.email.trim()) return "Please enter your Email.";
    if (!form.password) return "Please enter your Password.";
    return "";
  };

  const handleLogin = async () => {
    const err = validateLogin();
    if (err) {
      setError(err);
      return;
    }

    setLoading(true);
    setError("");

    try {
      await loginUser(form);
      navigate("/profile");
    } catch (err: any) {
      setError(err.response?.data?.message || "Email or password is incorrect.");
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: "google" | "kakao") => {
    setError("");
    setSocialLoading(provider);

    try {
      await loginWithSocialProvider(provider);
    } catch (err: any) {
      setError(
        err.message ||
          `Unable to start ${provider} login right now. Please try again.`
      );
      setSocialLoading(null);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.bgAccent}></div>

      <div style={styles.container}>
        <div style={styles.leftPanel}>
          <div>
            <p style={styles.brand}>roomies</p>
            <h1 style={styles.tagline}>Welcome Back.</h1>
            <p style={styles.subTagline}>
              Sign in with Google, Kakao, or your email and continue finding your perfect space in Korea.
            </p>
          </div>

          <div style={styles.stepIndicatorWrap}>
            <div style={styles.stepRow}>
              <div style={styles.activeDot}></div>
              <span style={styles.stepLabel}>Login</span>
            </div>
          </div>
        </div>

        <div style={styles.rightPanel}>
          <div style={styles.formCard}>
            <h2 style={styles.formTitle}>Sign in to your account</h2>
            <p style={styles.formSub}>
              Pick the easiest way to continue your Roomies journey.
            </p>

            {error && <div style={styles.errorBox}>{error}</div>}

            <div style={styles.dividerRow}>
              <div style={styles.dividerLine} />
              <span style={styles.dividerText}>sign in with email</span>
              <div style={styles.dividerLine} />
            </div>

            <div style={styles.fields}>
              <Field
                label="Email Address"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@university.ac.kr"
              />

              <Field
                label="Password"
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                placeholder="Enter your password"
              />

              <div style={styles.forgotWrap}>
                <Link to="/forgot-password" style={styles.loginLink}>
                  Forgot password?
                </Link>
              </div>

              <button
                style={styles.btn}
                onClick={handleLogin}
                disabled={loading || socialLoading !== null}
              >
                {loading ? "Signing in..." : "Login →"}
              </button>
            </div>

            <p style={styles.loginPrompt}>
              Don&apos;t have an account yet?{" "}
              <Link to="/register" style={styles.loginLink}>
                Create one with email
              </Link>
            </p>

            <div style={styles.socialSection}>
              <div style={styles.dividerRowBottom}>
                <div style={styles.dividerLine} />
                <span style={styles.dividerText}>or continue with</span>
                <div style={styles.dividerLine} />
              </div>

              <div style={styles.socialStack}>
                <SocialButton
                  label="Continue with Google"
                  providerLabel="G"
                  providerColor="#ffffff"
                  providerTextColor="#1a1a1a"
                  onClick={() => handleSocialLogin("google")}
                  disabled={loading || socialLoading !== null}
                  loading={socialLoading === "google"}
                />

                <SocialButton
                  label="Continue with Kakao"
                  providerLabel="K"
                  providerColor="#FEE500"
                  providerTextColor="#191600"
                  onClick={() => handleSocialLogin("kakao")}
                  disabled={loading || socialLoading !== null}
                  loading={socialLoading === "kakao"}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SocialButton({
  label,
  providerLabel,
  providerColor,
  providerTextColor,
  onClick,
  disabled,
  loading,
}: {
  label: string;
  providerLabel: string;
  providerColor: string;
  providerTextColor: string;
  onClick: () => void;
  disabled: boolean;
  loading: boolean;
}) {
  return (
    <button
      type="button"
      style={{
        ...styles.socialButton,
        opacity: disabled ? 0.7 : 1,
        cursor: disabled ? "default" : "pointer",
      }}
      onClick={onClick}
      disabled={disabled}
    >
      <span
        style={{
          ...styles.socialBadge,
          background: providerColor,
          color: providerTextColor,
        }}
      >
        {providerLabel}
      </span>

      <span style={styles.socialButtonText}>
        {loading ? "Redirecting..." : label}
      </span>
    </button>
  );
}

function Field({
  label,
  name,
  type,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  name: string;
  type: string;
  value: string;
  onChange: any;
  placeholder: string;
}) {
  return (
    <div style={styles.fieldGroup}>
      <label style={styles.label}>{label}</label>
      <input
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={styles.input}
      />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#fafaf8",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Georgia', serif",
    position: "relative",
    overflow: "hidden",
    padding: "40px 20px",
  },
  bgAccent: {
    position: "absolute",
    top: -200,
    right: -200,
    width: 600,
    height: 600,
    borderRadius: "50%",
    background: "radial-gradient(circle, #e8e4dc 0%, transparent 70%)",
    pointerEvents: "none",
  },
  container: {
    display: "flex",
    width: "100%",
    maxWidth: 960,
    minHeight: 580,
    background: "#ffffff",
    borderRadius: 2,
    boxShadow: "0 4px 40px rgba(0,0,0,0.08)",
    overflow: "hidden",
  },
  leftPanel: {
    width: 320,
    background: "#f5f3ef",
    padding: "56px 40px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    borderRight: "1px solid #ebe9e4",
    flexShrink: 0,
  },
  brand: {
    fontSize: 13,
    letterSpacing: "0.25em",
    textTransform: "uppercase",
    color: "#888",
    marginBottom: 32,
    fontFamily: "'Georgia', serif",
  },
  tagline: {
    fontSize: 28,
    fontWeight: 400,
    color: "#1a1a1a",
    lineHeight: 1.35,
    marginBottom: 16,
    fontFamily: "'Georgia', serif",
  },
  subTagline: {
    fontSize: 14,
    color: "#888",
    lineHeight: 1.7,
    fontFamily: "'Georgia', serif",
  },
  stepIndicatorWrap: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  stepRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  activeDot: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    background: "#1a1a1a",
    flexShrink: 0,
  },
  stepLabel: {
    fontSize: 13,
    letterSpacing: "0.02em",
    fontFamily: "'Georgia', serif",
    color: "#1a1a1a",
  },
  rightPanel: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "48px 40px",
  },
  formCard: {
    width: "100%",
    maxWidth: 420,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: 400,
    color: "#1a1a1a",
    marginBottom: 12,
    letterSpacing: "0.05em",
  },
  formSub: {
    fontSize: 13,
    color: "#aaa",
    marginBottom: 32,
    fontFamily: "'Georgia', serif",
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
  socialStack: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  socialButton: {
    width: "100%",
    border: "1px solid #e6e1d8",
    background: "#fbfaf7",
    color: "#1a1a1a",
    padding: "14px 16px",
    display: "flex",
    alignItems: "center",
    gap: 12,
    fontSize: 14,
    fontFamily: "'Georgia', serif",
    borderRadius: 2,
    transition: "background 0.2s ease",
  },
  socialBadge: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    fontWeight: 700,
    border: "1px solid rgba(0,0,0,0.08)",
    flexShrink: 0,
  },
  socialButtonText: {
    letterSpacing: "0.01em",
  },
  dividerRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 24,
  },
  dividerRowBottom: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    background: "#ebe6dd",
  },
  dividerText: {
    fontSize: 11,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: "#aaa",
    whiteSpace: "nowrap",
  },
  fields: {
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },
  fieldGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  label: {
    fontSize: 12,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "#888",
    fontFamily: "'Georgia', serif",
  },
  input: {
    border: "none",
    borderBottom: "1.5px solid #ddd",
    padding: "10px 0",
    fontSize: 15,
    fontFamily: "'Georgia', serif",
    color: "#1a1a1a",
    background: "transparent",
    outline: "none",
    width: "100%",
  },
  forgotWrap: {
    textAlign: "right",
    marginTop: -8,
  },
  btn: {
    background: "#1a1a1a",
    color: "#fff",
    border: "none",
    padding: "14px 24px",
    fontSize: 13,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    cursor: "pointer",
    fontFamily: "'Georgia', serif",
    borderRadius: 1,
  },
  loginPrompt: {
    marginTop: 28,
    fontSize: 13,
    color: "#aaa",
    fontFamily: "'Georgia', serif",
    textAlign: "center",
  },
  socialSection: {
    marginTop: 30,
  },
  loginLink: {
    color: "#1a1a1a",
    textDecoration: "underline",
    textUnderlineOffset: 3,
  },
};