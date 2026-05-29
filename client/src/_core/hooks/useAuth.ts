// Re-export useAuth from the Supabase AuthContext for backward compatibility.
// All existing imports of useAuth from this path will continue to work.
export { useAuth } from "@/contexts/AuthContext";
