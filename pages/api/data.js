export default async function handler(req, res) {
  try {
    // Fetch data.json directly from GitHub (no auth needed for public repos)
    const response = await fetch(
      "https://raw.githubusercontent.com/dineshyelle1-sudo/nhc-dashboard/main/public/data.json",
      { headers: { "Cache-Control": "no-cache" } }
    );

    if (!response.ok) throw new Error("data.json not found — run pushDataToGitHub() first");
    const data = await response.json();
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
