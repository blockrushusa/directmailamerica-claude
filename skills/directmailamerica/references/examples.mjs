#!/usr/bin/env node
// Self-contained no-cost examples. This program cannot target a live mailing endpoint.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
const endpoint = new URL(process.env.DMA_SIMULATION_URL || "https://directmailamerica.com/api/mcp-simulation");
if (endpoint.pathname !== "/api/mcp-simulation" || endpoint.search || endpoint.username || endpoint.password ||
  !(endpoint.origin === "https://directmailamerica.com" || endpoint.protocol === "http:" && ["localhost", "127.0.0.1"].includes(endpoint.hostname))) throw new Error("Use only the simulation endpoint on DirectMailAmerica or localhost.");
const key = process.env.DMA_SIMULATION_KEY || "";
if (!/^dma_sim_[a-f0-9]{64}$/.test(key)) throw new Error("Set DMA_SIMULATION_KEY to a separate simulation key from Developers. Never use a live or staging key.");
const directory = path.resolve(process.env.DMA_SIMULATION_OUTPUT || "dma-simulation-proofs");
await mkdir(directory, { recursive: true });
let requestId = 0;
async function call(name, args = {}) {
  const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, Accept: "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++requestId, method: "tools/call", params: { name, arguments: args } }) });
  const message = await response.json(), result = message.result, body = result?.structuredContent;
  if (!response.ok || message.error || result?.isError) throw new Error(JSON.stringify(message.error || body?.operation || { status: response.status }));
  if (body?.simulation !== true || body.realFundsSpentCents !== 0 || body.realMailSubmitted !== false) throw new Error("The server did not confirm simulation isolation. Stopping.");
  return { body, content: result.content };
}
async function savePdf(result, filename) {
  const resource = result.content.find(item => item.type === "resource" && item.resource.mimeType === "application/pdf")?.resource;
  if (!resource?.blob) throw new Error("PDF preview missing");
  const bytes = Buffer.from(resource.blob, "base64");
  if (bytes.subarray(0, 5).toString() !== "%PDF-") throw new Error("Invalid PDF preview");
  await writeFile(path.join(directory, filename), bytes, { mode: 0o600 });
}
function postcardPdf() {
  const stream = "BT /F1 24 Tf 36 200 Td (Synthetic postcard - no real mail) Tj ET";
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 396] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
  let pdf = "%PDF-1.4\n", offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n => String(n).padStart(10, "0") + " 00000 n ").join("\n")}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf).toString("base64");
}
const from = { name: "Synthetic Sender", line1: "1 Example Street", city: "New Haven", state: "CT", postal: "06511" };
const to = { ...from, name: "Synthetic Recipient", line1: "2 Example Street" };
await call("get_connection_status");
const quoted = await call("quote_letter", { from, recipients: [to], body: "This is a no-cost integration test." });
await savePdf(quoted, "letter.pdf");
const q = quoted.body.quote;
const approval = { quoteId: q.quoteId, confirmed: true, approvedTotalCents: q.totalCents, idempotencyKey: randomUUID() };
// Automatic approval is ONLY for this isolated, synthetic test endpoint.
// A real integration must pause for human approval of each saved proof and total.
const letter = await call("send_letter", approval);
const replay = await call("send_letter", approval);
if (letter.body.id !== replay.body.id) throw new Error("Idempotent recovery failed");
const postcard = await call("quote_product", { productId: "pro_postcard_85x55", color: true, doubleSided: true, pdfBase64: postcardPdf(), reverseMessage: "Synthetic two-sided postcard.", from, recipients: [to] });
await savePdf(await call("preview_product_quote", { id: postcard.body.id }), "postcard-both-sides.pdf");
const card = await call("send_product_quote", { id: postcard.body.id, confirmed: true });
let email = (await call("create_simulation_email", { body: "Synthetic email for exact-version approval." })).body.message;
email = (await call("prepare_email_letter", { id: email.id, version: email.version, mailing: { from, to } })).body.message;
await savePdf(await call("download_email_letter", { id: email.id, format: "pdf" }), "email-letter.pdf");
const mailedEmail = await call("approve_email_letter", { id: email.id, version: email.version, cents: email.priceCents, confirmMail: true });
console.log(JSON.stringify({ simulation: true, realFundsSpentCents: 0, realMailSubmitted: false,
  letter: letter.body.operation, postcard: card.body.operation, email: mailedEmail.body.operation, proofs: directory }, null, 2));
