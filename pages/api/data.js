const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw9GF93juynp-ovve1qWKc6f3EW86cPCRTmjvO4SrMVBA8HrGFA3up62XaesCn6ItQz7g/exec";

export default async function handler(req, res) {
  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      headers: { "Accept": "application/json" },
      redirect: "follow",
    });

    const text = await response.text();
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) {
      return res.status(502).json({ error: "No JSON found in Apps Script response" });
    }

    const data = JSON.parse(match[0]);
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
