# Upplyx — Icon Readiness Analyzer

A deterministic (no AI) web app that analyzes mobile app icons for technical quality and visual effectiveness.

## Tech Stack

- **Backend:** Python 3 / Flask
- **Image processing:** Pillow + NumPy
- **PDF generation:** ReportLab
- **Frontend:** Vanilla HTML/CSS/JS — no frameworks, no build step

## Project Structure

```
upplyx/
├── app.py              Flask server — routes: /, /upload, /upload-competitor, /generate-pdf
├── audit_engine.py     All image analysis logic (no AI, fully deterministic)
├── requirements.txt    flask, pillow, numpy, reportlab
├── templates/
│   └── index.html      Single-page 5-step UI
└── static/
    ├── css/style.css
    ├/js/main.js
    └── uploads/        Runtime storage for uploaded icons (gitignored)
```

## Running

```bash
pip3 install -r requirements.txt
python3 app.py
# → http://127.0.0.1:5001
```

Port 5000 is reserved by macOS AirPlay Receiver, so the app runs on **5001**.

## User Flow

1. **Upload icon** — PNG/JPG/WebP, max 20 MB
2. **Analysis results** — Technical Readiness score + Visibility score shown with animated SVG rings
3. **Add competitors** — up to 16 competitor icons
4. **Context preview** — CSS phone mockup showing all icons in a home-screen grid (user's icon highlighted)
5. **Recommendations + PDF** — template-based text, downloadable ReportLab PDF report

## Analysis Engine (`audit_engine.py`)

All scoring is deterministic — no external APIs, no ML.

### Technical Readiness score (0–100)
| Check | Weight |
|---|---|
| Square format (w == h) | 30 pts |
| Resolution (≥1024 = 100, ≥512 = 75, ≥256 = 50, <256 = 25) | ×0.3 of size score |
| Transparency / alpha channel | 20 pts |
| Recommended format (PNG or WebP) | 10 pts |
| File size ≤300 KB | 10 pts (5 pts if ≤1000 KB) |

### Visibility score (0–100)
- **Contrast** (`contrast_score`): std dev of grayscale pixel values, normalized to 0–100
- **Simplicity** (`simplicity_score`): weighted combination of
  - Edge density via `ImageFilter.FIND_EDGES` (60%)
  - Downscale loss via `small_size_score` — structural diff after 16×16 resize (40%)
- Visibility score = average of contrast + simplicity

### Overall score
`overall = technical_score × 0.4 + visibility_score × 0.6`

## Design System

| Token | Value |
|---|---|
| Background | `#E8E6DF` (beige/off-white) |
| Primary text + buttons | `#2D2B4E` (dark navy) |
| Font | Inter (Google Fonts) |
| Border radius — cards | 18px |
| Border radius — buttons | 10px |

Score rings use SVG `stroke-dashoffset` animation. Metric bars use CSS `width` transition. No external JS libraries.

## Key Implementation Notes

- Uploaded files are saved to `static/uploads/` with UUID filenames; competitor icons are prefixed `comp_`
- The `/generate-pdf` route imports ReportLab lazily and returns a helpful error if it's not installed
- PNG images are converted to RGBA before passing to ReportLab to avoid mode compatibility issues
- Score ring colors: green (`#2D2B4E`) ≥70, amber (`#92670d`) 40–69, red (`#b91c1c`) <40

Visibility Section — Card Texts & Summary Logic
Contrast card (max score: 100)
RangeBorderText67–100none, green ✓Strong tonal range. / Icon stands out on any background.34–66orangeFlat contrast. / May blend into the background.0–33redToo low. / Icon will disappear on most backgrounds.
Simplicity card (max score: 100)
RangeBorderText67–100none, green ✓Clean and focused. / The main shape reads instantly.34–66orangeSome complexity. / Fine details may get lost.0–33redToo complex. / The icon loses its shape when scaled.
Summary logic (9 combinations)
green  + green  → Your icon is highly visible. Strong contrast and clean composition work together.
green  + orange → Good contrast, but some details may get lost. Simplify the composition.
green  + red    → Strong contrast, but the icon is too complex. Strip it down.
orange + green  → Clean shape, but contrast needs improvement. The icon may blend into backgrounds.
orange + orange → Visibility needs work. Both contrast and complexity could be improved.
orange + red    → Two issues at once — limited contrast and too much detail. Both need attention.
red    + green  → Simple and clean, but critically low contrast. The icon will disappear on most backgrounds.
red    + orange → Contrast is the main problem here. Fix it first — the icon is barely visible.
red    + red    → High risk. The icon is hard to read — low contrast and too much detail combined.
(first = Contrast state, second = Simplicity state)