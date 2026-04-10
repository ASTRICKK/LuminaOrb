"use client";

import dynamic from "next/dynamic";

const LuminaOrb = dynamic(
  () => import("./components/LuminaOrb"),
  { ssr: false }
);

export default function Home() {
  return (
    <main className="min-h-screen bg-black relative overflow-hidden">

      {/* ── Floating Lumina Orb — bottom-right corner ─────────────────────── */}
      <div
        style={{
          position: "fixed",
          bottom: "50px",
          right:  "50px",
          zIndex: 50,
        }}
      >
        <LuminaOrb
          onClick={() => alert("LuminaOrb Clicked!")}
        />
      </div>

    </main>
  );
}
