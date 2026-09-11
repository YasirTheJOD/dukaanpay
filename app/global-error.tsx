"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "Arial, Helvetica, sans-serif", margin: 0, background: "#f9fafb" }}>
        <div
          style={{
            maxWidth: 420,
            margin: "18vh auto",
            background: "#fff",
            borderRadius: 16,
            padding: 24,
            boxShadow: "0 10px 30px rgba(0,0,0,.08)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 40 }}>😕</div>
          <h1 style={{ fontSize: 18, margin: "8px 0" }}>DukaanPay ran into a problem</h1>
          <p style={{ color: "#555", fontSize: 14 }}>
            Please try again. If it keeps happening, reload the app.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 12,
              background: "#0ea75f",
              color: "#fff",
              border: "none",
              borderRadius: 12,
              padding: "10px 18px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            ↻ Reload
          </button>
        </div>
      </body>
    </html>
  );
}
