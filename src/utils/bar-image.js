// Report image generator — uses sharp to render a designed card as PNG.
// Each command (/today, /week, /month, /all, /methods) sends one image
// alongside a short caption.

import sharp from "sharp";
import { inr } from "./money.js";

const W = 720;          // image width
const PAD = 32;         // outer padding
const ROW_H = 56;       // per-category row height
const BAR_H = 18;       // bar height
const BAR_LABEL_W = 120;
const BAR_RIGHT_W = 180; // right-side numbers
const GAP = 24;         // gap between rows

// Color stops for the gradient (low% → high% → over)
function gradientStops() {
  return [
    { offset: 0,    color: "#34d399" },  // emerald-400
    { offset: 0.55, color: "#10b981" },  // emerald-500
    { offset: 0.78, color: "#f59e0b" },  // amber-500
    { offset: 0.95, color: "#f97316" },  // orange-500
    { offset: 1.0,  color: "#ef4444" },  // red-500
  ];
}

// Builds an SVG of the full report card.
function buildSvg({ title, range, total, count, topLine, rows, footer }) {
  const headerH = 110;
  const footerH = footer ? 60 : 0;
  const rowsH = rows.length * (ROW_H + GAP);
  const H = headerH + rowsH + footerH + PAD * 2;

  const barX = PAD + BAR_LABEL_W;
  const barW = W - PAD * 2 - BAR_LABEL_W - BAR_RIGHT_W;

  // Build the rows
  const rowSvgs = rows.map((r, i) => {
    const y = PAD + headerH + i * (ROW_H + GAP);
    const isBudgeted = r.budget && r.budget > 0;
    const pct = isBudgeted ? r.amount / r.budget : 0;
    const fillW = isBudgeted
      ? Math.min(barW, barW * Math.min(pct, 1.0))
      : barW * (r.amount / (rows[0]?.amount || 1)) * 0.5;  // relative fill for unbudgeted
    const over = isBudgeted && r.amount > r.budget;
    const overflowW = isBudgeted && over ? barW * Math.min((pct - 1) * 0.5, 0.2) : 0;

    return `
      <!-- Row ${i}: ${r.label} -->
      <g transform="translate(0, ${y})">
        <!-- Category label -->
        <text x="${PAD}" y="${ROW_H / 2 - 6}" font-family="Inter, system-ui" font-size="14" font-weight="600" fill="#18181b">${escapeXml(r.label)}</text>
        <text x="${PAD}" y="${ROW_H / 2 + 12}" font-family="Inter, system-ui" font-size="11" fill="#71717a">${escapeXml(r.sublabel || "")}</text>

        <!-- Bar background (outline) -->
        <rect x="${barX}" y="${(ROW_H - BAR_H) / 2}" width="${barW}" height="${BAR_H}" rx="4"
              fill="none" stroke="#e4e4e7" stroke-width="1.5"/>

        <!-- Filled portion (with gradient) -->
        ${isBudgeted ? `
          <defs>
            <linearGradient id="grad-${i}" x1="0%" y1="0%" x2="100%" y2="0%">
              ${gradientStops().map((s) =>
                `<stop offset="${s.offset * 100}%" stop-color="${s.color}"/>`
              ).join("")}
            </linearGradient>
          </defs>
          <rect x="${barX}" y="${(ROW_H - BAR_H) / 2}" width="${fillW}" height="${BAR_H}" rx="4"
                fill="url(#grad-${i})"/>
          ${over ? `
            <rect x="${barX + barW - 1}" y="${(ROW_H - BAR_H) / 2}" width="${overflowW + 1}" height="${BAR_H}" rx="4"
                  fill="#ef4444" opacity="0.9"/>
          ` : ""}
        ` : `
          <rect x="${barX}" y="${(ROW_H - BAR_H) / 2}" width="${fillW}" height="${BAR_H}" rx="4"
                fill="#a1a1aa" opacity="0.7"/>
        `}

        <!-- Right-side numbers -->
        ${isBudgeted ? `
          <text x="${W - PAD}" y="${ROW_H / 2 - 6}" text-anchor="end" font-family="Inter, system-ui" font-size="13" font-weight="500" fill="${over ? '#dc2626' : '#18181b'}">${escapeXml(inr(r.amount))} / ${escapeXml(inr(r.budget))}</text>
          <text x="${W - PAD}" y="${ROW_H / 2 + 12}" text-anchor="end" font-family="Inter, system-ui" font-size="11" fill="${over ? '#dc2626' : '#71717a'}">${Math.round(pct * 100)}% used${over ? ` · over by ${escapeXml(inr(r.amount - r.budget))}` : ""}</text>
        ` : `
          <text x="${W - PAD}" y="${ROW_H / 2 + 4}" text-anchor="end" font-family="Inter, system-ui" font-size="13" font-weight="500" fill="#52525b">${escapeXml(inr(r.amount))}</text>
        `}
      </g>
    `;
  }).join("");

  // Build the header
  const headerSvg = `
    <text x="${PAD}" y="${PAD + 30}" font-family="Inter, system-ui" font-size="22" font-weight="700" fill="#09090b">${escapeXml(title)}</text>
    ${range ? `<text x="${PAD}" y="${PAD + 52}" font-family="Inter, system-ui" font-size="13" fill="#71717a">${escapeXml(range)}</text>` : ""}
    <text x="${PAD}" y="${PAD + 80}" font-family="Inter, system-ui" font-size="14" fill="#52525b">
      <tspan font-weight="500" fill="#18181b">${count}</tspan> <tspan fill="#71717a">${count === 1 ? "entry" : "entries"}</tspan>
      <tspan dx="16" fill="#a1a1aa">·</tspan>
      <tspan dx="16" font-weight="500" fill="#18181b">${escapeXml(inr(total))}</tspan> <tspan fill="#71717a">total</tspan>
    </text>
    ${topLine ? `<text x="${W - PAD}" y="${PAD + 30}" text-anchor="end" font-family="Inter, system-ui" font-size="13" fill="#52525b">${escapeXml(topLine)}</text>` : ""}
  `;

  const footerSvg = footer ? `
    <text x="${PAD}" y="${H - PAD - 12}" font-family="Inter, system-ui" font-size="11" fill="#a1a1aa">${escapeXml(footer)}</text>
  ` : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="100%" height="100%" fill="#ffffff"/>
  ${headerSvg}
  ${rowSvgs}
  ${footerSvg}
</svg>`;
}

function escapeXml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Render a category-bar report card as a PNG buffer.
 *
 * @param {object} opts
 * @param {string} opts.title           - e.g. "Today"
 * @param {string} [opts.range]         - e.g. "24 Jun 2026"
 * @param {number} opts.total
 * @param {number} opts.count
 * @param {string} [opts.topLine]       - right-side header line, e.g. "Biggest: Food ₹1500"
 * @param {Array}  opts.rows            - [{ label, sublabel, amount, budget }]
 * @param {string} [opts.footer]        - bottom note
 * @returns {Promise<Buffer>} PNG buffer
 */
export async function renderReportImage(opts) {
  const svg = buildSvg(opts);
  return await sharp(Buffer.from(svg))
    .png()
    .toBuffer();
}

/**
 * Render a simple "no data" card.
 */
export async function renderEmptyImage(message) {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="200" viewBox="0 0 ${W} 200">
  <rect width="100%" height="100%" fill="#ffffff"/>
  <text x="${W / 2}" y="100" text-anchor="middle" font-family="Inter, system-ui" font-size="14" fill="#71717a">${escapeXml(message)}</text>
</svg>`;
  return await sharp(Buffer.from(svg)).png().toBuffer();
}
