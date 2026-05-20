import React, { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { supabase } from "./lib/supabase";
import Browse from "./pages/Browse";
import Chat from "./pages/Chat";
import Login from "./pages/Login";
import Matches from "./pages/Matches";
import PostDetail from "./pages/PostDetail";
import PostEdit from "./pages/PostEdit";
import PostForm from './pages/PostForm';
import Profile from "./pages/Profile";
import Register from "./pages/Register";
import Review from './pages/Review';

// Protected Route — redirects to login if not authenticated
function ProtectedRoute({ children }: { children: React.ReactElement }) {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
  }, []);

  if (loading) return (
    <p style={{ fontFamily: "Georgia", padding: 40, color: "#aaa" }}>
      Loading...
    </p>
  );

  return session ? children : <Navigate to="/login" />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Default route → redirect to login */}
        <Route path="/" element={<Navigate to="/login" />} />

        {/* Public routes — no auth needed */}
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />

        {/* Protected routes — must be logged in */}
        <Route path="/profile" element={
          <ProtectedRoute><Profile /></ProtectedRoute>
        } />
        <Route path="/browse" element={
          <ProtectedRoute><Browse /></ProtectedRoute>
        } />
        <Route path="/post-detail/:id" element={
          <ProtectedRoute><PostDetail /></ProtectedRoute>
        } />
        <Route path="/post-edit/:id" element={
          <ProtectedRoute><PostEdit /></ProtectedRoute>
        } />
        <Route path="/matches" element={
          <ProtectedRoute><Matches /></ProtectedRoute>
        } />
        <Route path="/chat" element={
          <ProtectedRoute><Chat /></ProtectedRoute>
        } />
        <Route path="/review" element={
          <ProtectedRoute><Review /></ProtectedRoute>
        } />
        <Route path="/post-form" element={
          <ProtectedRoute><PostForm /></ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;