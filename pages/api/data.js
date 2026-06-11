const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw9GF93juynp-ovve1qWKc6f3EW86cPCRTmjvO4SrMVBA8HrGFA3up62XaesCn6ItQz7g/exec";

export default async function handler(req, res) {
  try {
    // Google Apps Script redirects — we need to follow all redirects
    // and explicitly request JSON
    const response = await fetch(APPS_SCRIPT_URL + "?format=json", {
      method: "GET",
      headers: {
        "Accept": "application/json, text/plain, */*",
        "User-Agent": "Mozilla/5.0 (compatible; Vercel/1.0)",
      },
      redirect: "follow",
    });

    const text = await response.text();

    // Extract JSON array from response (handles any wrapping HTML)
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");

    if (start === -1 || end === -1) {
      // Return debug info so we can see what Google sent back
      return res.status(502).json({
        error: "No JSON array in response",
        preview: text.slice(0, 300),
        status: response.status,
        url: response.url,
      });
    }

    const data = JSON.parse(text.slice(start, end + 1));
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
