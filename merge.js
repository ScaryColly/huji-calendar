// merge-ics.ts (or .js)
import fs from "fs/promises";
import path from "path";

const IN_DIR = "./downloads"; // where your 32 files are
const OUT_DIR = "./downloads/merged"; // output folder
const OUT_FILE = "Uni_Schedule_ALL.ics";
const TZ = "Asia/Jerusalem";
const CALNAME = "Uni Schedule (merged)";

// --- helpers ---
const normalize = (s) => s.replace(/\r\n/g, "\n").replace(/\n/g, "\r\n"); // Google likes CRLF

const getEventKey = (evt) => {
  // Prefer UID if present, else hash by DTSTART/DTEND/SUMMARY/LOCATION
  const uid = evt.match(/\nUID:([^\r\n]+)/i)?.[1]?.trim();
  if (uid) return `UID:${uid}`;

  const dtstart = evt.match(/\nDTSTART[^:]*:([0-9TzZ]+)/i)?.[1]?.trim() ?? "";
  const dtend = evt.match(/\nDTEND[^:]*:([0-9TzZ]+)/i)?.[1]?.trim() ?? "";
  const summary = evt.match(/\nSUMMARY:([^\r\n]+)/i)?.[1]?.trim() ?? "";
  const location = evt.match(/\nLOCATION:([^\r\n]+)/i)?.[1]?.trim() ?? "";
  return [dtstart, dtend, summary, location].join("|");
};

const getDtStartSortable = (evt) =>
  evt.match(/\nDTSTART[^:]*:([0-9TZ]+)/i)?.[1] ?? "";

// --- main ---
(async () => {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const files = (await fs.readdir(IN_DIR)).filter((f) =>
    f.toLowerCase().endsWith(".ics")
  );

  if (files.length === 0) {
    console.error("No .ics files found in", IN_DIR);
    process.exit(1);
  }

  const eventSet = new Map(); // key -> VEVENT
  const vtimezones = []; // if any appear (your generator didn’t add them)

  for (const f of files) {
    const p = path.join(IN_DIR, f);
    const raw = await fs.readFile(p, "utf8");
    const text = normalize(raw);

    // capture optional VTIMEZONE blocks (rare in your case)
    const tzBlocks =
      text.match(/BEGIN:VTIMEZONE[\s\S]*?END:VTIMEZONE\r\n/g) || [];
    for (const tz of tzBlocks) {
      if (!vtimezones.includes(tz)) vtimezones.push(tz);
    }

    // capture VEVENT blocks
    const events = text.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT\r\n/g) || [];
    for (const evt of events) {
      const key = getEventKey(evt);
      if (!eventSet.has(key)) eventSet.set(key, evt);
    }
  }

  // Sort events by DTSTART (optional but nice)
  const sortedEvents = [...eventSet.values()].sort((a, b) => {
    const aa = getDtStartSortable(a);
    const bb = getDtStartSortable(b);
    return aa.localeCompare(bb);
  });

  const now = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const header = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "PRODID:-//Uni Page -> ICS Merge//HE",
    `X-WR-CALNAME:${CALNAME}`,
    `X-WR-TIMEZONE:${TZ}`,
  ];

  const footer = ["END:VCALENDAR"];

  const body = [
    ...vtimezones, // include if any were found (usually none in your files)
    ...sortedEvents,
  ];

  const out = normalize([...header, ...body, ...footer].join("\n")) + "\r\n";

  const outPath = path.join(OUT_DIR, OUT_FILE);
  await fs.writeFile(outPath, out, "utf8");
  console.log(
    `✅ Merged ${eventSet.size} events from ${files.length} files -> ${outPath}`
  );
})();
