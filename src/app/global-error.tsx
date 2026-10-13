"use client";

/**
 * Last-resort error boundary.
 *
 * This replaces the entire document when the root layout itself fails, so it
 * must render its own <html> and <body> and cannot rely on any app styling or
 * font. The inline styles are intentional — no stylesheet is guaranteed to be
 * available at this point.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "2rem",
          background: "#0a0a0c",
          color: "#f4f2ee",
          fontFamily: "system-ui, -apple-system, sans-serif",
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600, margin: 0 }}>The site failed to load</h1>
        <p style={{ margin: 0, color: "#a9a6a1", maxWidth: "32rem" }}>
          Something went wrong before the page could be displayed. The problem has been logged.
        </p>
        {error.digest ? (
          <p style={{ margin: 0, fontSize: "0.75rem", color: "#7d7a76" }}>
            Reference: {error.digest}
          </p>
        ) : null}
        <button
          onClick={reset}
          style={{
            marginTop: "0.5rem",
            padding: "0.625rem 1.25rem",
            borderRadius: "999px",
            border: "none",
            background: "#e3a34e",
            color: "#1a1206",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
