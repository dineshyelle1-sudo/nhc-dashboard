import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

const Dashboard = dynamic(() => import("../src/NHCDashboard"), { ssr: false });

export default function Home() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/data")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return (
    <div style={{ fontFamily: "Inter, sans-serif", padding: 40 }}>
      <h2>⚠️ Could not load data</h2>
      <p style={{ color: "#5A6573" }}>{error}</p>
    </div>
  );

  if (!data) return (
    <div style={{ fontFamily: "Inter, sans-serif", padding: 40, display: "flex", alignItems: "center", gap: 14, color: "#5A6573" }}>
      <div style={{ width: 20, height: 20, borderRadius: "50%", border: "3px solid #E6E9ED",
        borderTopColor: "#0E9F8C", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      Loading dashboard data…
    </div>
  );

  return <Dashboard RAW={data} />;
}
