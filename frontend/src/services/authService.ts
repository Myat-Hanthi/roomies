import { supabase } from "../lib/supabase";
import type { LoginForm, RegisterForm } from "../types/user";


// Function to handle user registration
export async function registerUser(form: RegisterForm) {
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: form.email,
    password: form.password,
    // Pass additional user metadata to Supabase (optional)
    options: {
      data: {
        name: form.name,
        university: form.university,
        nationality: form.nationality,
      },
    },
  });

  if (authError) {
    throw authError;
  }

  if (!authData.user) {
    throw new Error("Signup failed.");
  }

  return authData.user;
}

// Function to handle user login
export async function loginUser(form: LoginForm) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: form.email,
    password: form.password,
  });

  if (error) {
    throw error;
  }

  if (!data.session) {
    throw new Error("Login failed.");
  }

  localStorage.setItem("access_token", data.session.access_token);
  localStorage.setItem("user", JSON.stringify(data.user));

  return data.user;
}

// Function to handle user logout
export async function logoutUser() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }

  localStorage.removeItem("access_token");
  localStorage.removeItem("user");
}

// Function to start a Supabase OAuth flow for social login
export async function loginWithSocialProvider(provider: "google" | "kakao") {
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${window.location.origin}/profile`,
    },
  });

  if (error) {
    throw error;
  }
}