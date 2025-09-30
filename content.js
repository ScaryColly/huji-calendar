(() => {
  "use strict";

  const TABLE_SEL = "#ContentPlaceHolder1_gvData";
  const BTN_ID = "__uni_ics_export_btn";

  const toISO = (d) => {
    const m = (d || "").match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!m) return null;
    let [, dd, mm, yyyy] = m;
    dd = dd.padStart(2, "0");
    mm = mm.padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const toICSDateTime = (dateISO, timeHHMM) =>
    dateISO.replace(/-/g, "") +
    "T" +
    (timeHHMM || "00:00").replace(":", "") +
    "00";

  const escICS = (s) =>
    (s || "").replace(
      /[\\,;\n]/g,
      (m) => ({ "\\": "\\\\", ",": "\\,", ";": "\\;", "\n": "\\n" }[m])
    );

  const nowStamp = () =>
    new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const collectEventsFromPage = () => {
    const rows = document.querySelectorAll(`${TABLE_SEL} tr.GridRow`);
    const events = [];
    rows.forEach((tr) => {
      const t = tr.children;
      if (!t || t.length < 7) return;

      const dateISO = toISO((t[0].innerText || "").trim());
      const start = (t[2].innerText || "").trim();
      const end = (t[3].innerText || "").trim();
      const name = (t[4].innerText || "").trim();
      const teachers = (t[5].innerText || "").trim();
      const room = (t[6].innerText || "").trim();

      if (!dateISO || !start || !end || !name) return;

      events.push({
        summary: name,
        location: room,
        desc: teachers ? `מרצים: ${teachers}` : "",
        dtstart: toICSDateTime(dateISO, start),
        dtend: toICSDateTime(dateISO, end),
      });
    });
    return events;
  };

  const buildICSAndDownload = (events) => {
    if (!events.length) {
      alert("לא נמצאו אירועים בדף הנוכחי.");
      return;
    }

    const now = nowStamp();
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Uni Page -> ICS//HE",
      "X-WR-CALNAME:Uni Schedule - current page",
      "X-WR-TIMEZONE:Asia/Jerusalem",
    ];

    const seen = new Set();
    for (const ev of events) {
      const key = [ev.summary, ev.location, ev.dtstart, ev.dtend].join("|");
      if (seen.has(key)) continue;
      seen.add(key);

      const uid = Math.random().toString(36).slice(2) + "@uni-page";
      lines.push(
        "BEGIN:VEVENT",
        `UID:${uid}`,
        `DTSTAMP:${now}`,
        `DTSTART:${ev.dtstart}`,
        `DTEND:${ev.dtend}`,
        `SUMMARY:${escICS(ev.summary)}`
      );
      if (ev.location) lines.push(`LOCATION:${escICS(ev.location)}`);
      if (ev.desc) lines.push(`DESCRIPTION:${escICS(ev.desc)}`);
      lines.push("END:VEVENT");
    }

    lines.push("END:VCALENDAR");

    const blob = new Blob([lines.join("\r\n")], {
      type: "text/calendar;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);

    let firstDate = "schedule";
    const firstRow = document.querySelector(
      `${TABLE_SEL} tr.GridRow td:first-child`
    );
    if (firstRow) {
      const iso = toISO(firstRow.textContent.trim());
      if (iso) firstDate = iso;
    }

    const a = document.createElement("a");
    a.href = url;
    a.download = `Uni_Schedule_${firstDate}.ics`;
    document.documentElement.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const ensureButton = () => {
    if (document.getElementById(BTN_ID)) return;

    const btn = document.createElement("button");
    btn.id = BTN_ID;
    btn.type = "button";
    btn.textContent = "Export ICS (this page)";
    Object.assign(btn.style, {
      position: "fixed",
      left: "16px",
      bottom: "80px", // a bit higher
      zIndex: "2147483647",
      padding: "10px 14px",
      border: "0",
      borderRadius: "8px",
      background: "#1a73e8",
      color: "#fff",
      font: "14px/1.2 system-ui,Arial,sans-serif",
      cursor: "pointer",
      boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
    });
    btn.addEventListener("click", () => {
      const events = collectEventsFromPage();
      buildICSAndDownload(events);
    });

    document.documentElement.appendChild(btn);
  };

  const start = () => {
    ensureButton();
    // Re-ensure after ASP.NET partial postbacks
    if (
      window.Sys &&
      window.Sys.WebForms &&
      window.Sys.WebForms.PageRequestManager
    ) {
      const prm = window.Sys.WebForms.PageRequestManager.getInstance();
      prm.add_endRequest(() => setTimeout(ensureButton, 30));
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
