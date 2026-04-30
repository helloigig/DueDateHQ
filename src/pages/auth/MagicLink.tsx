import { Navigate } from "react-router-dom";

/**
 * /magic-link is deprecated. The unified passwordless flow now lives at
 * /login (sign in) and /signup (new account). This route stays in App.tsx
 * to avoid 404s from old emails or bookmarks; it just redirects.
 */
export function MagicLink() {
  return <Navigate to="/login" replace />;
}
