// src/config/approvals.js
//
// Phase 3C.A — Approval item seed data with the full preview field contract.
// Replaces the minimal DEMO_APPROVALS array in MotesartOS.jsx.
//
// LOCK 1: state changes stay local to MotesartOS.jsx. This file is data shape
// only — no persistence logic. Phase 3D swaps this for an Airtable fetch.
// LOCK 2: no remote CDN URLs. Visual items without a local asset use
// preview_url: null and the modal renders its "no preview set" state.
//
// Field contract (becomes the shape Airtable fetch must produce in Phase 3D):
//   id               string
//   biz              "e7a" | "som" | "book" | "fm"
//   artist           string              — display tag
//   type             "Visual" | "Caption" | "Strategy" | "Build" | "Content"
//   item             string              — short title shown on card
//   preview_url      string | null       — local path or null (no remote URLs)
//   media_type       "image" | "video" | "text" | null
//   caption          string | null       — associated caption copy
//   notes            string | null       — reviewer context

export const APPROVALS = [
  {
    id: 1,
    biz: "e7a",
    artist: "Velvet Room",
    type: "Visual",
    item: "Post 1 -- Mood Visual cover frame",
    preview_url: null,                       // drop asset at /brand/approvals/vr-post-1.jpg later
    media_type: "image",
    caption: "Soft Spot — arriving soon. A record for after midnight.",
    notes: "Mood frame for IG carousel. Target drop: Thursday 2PM window.",
  },
  {
    id: 2,
    biz: "e7a",
    artist: "Velvet Room",
    type: "Caption",
    item: "Post 2 -- Primary Reel caption draft",
    preview_url: null,
    media_type: "text",
    caption: "Some songs don't need an explanation. Soft Spot — Velvet Room. Out soon.\n\n#SoftSpot #VelvetRoom #NewMusic #PreSave",
    notes: "Primary Reel caption. 220 chars. CTA is pre-save link in bio.",
  },
  {
    id: 3,
    biz: "e7a",
    artist: "Velvet Room",
    type: "Strategy",
    item: "Platform lead: Instagram confirmed?",
    preview_url: null,
    media_type: "text",
    caption: null,
    notes: "Confirm Instagram as primary launch platform for Soft Spot. TikTok + Threads secondary. Approve to lock the rollout plan.",
  },
  {
    id: 4,
    biz: "som",
    artist: "SOM",
    type: "Build",
    item: "Motesart Converter architecture review",
    preview_url: null,
    media_type: "text",
    caption: null,
    notes: "Architecture sign-off needed before next Claude Code session. See attached scope doc in SOM Drive.",
  },
  {
    id: 5,
    biz: "book",
    artist: "Book",
    type: "Content",
    item: "Chapter 4 Husband-Hood — complete missing case study",
    preview_url: null,
    media_type: "text",
    caption: null,
    notes: "Case study section is marked TBD in draft. Approve scope to commission case study write-up.",
  },
];

export default APPROVALS;
