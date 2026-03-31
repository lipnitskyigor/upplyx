import os
import numpy as np
from PIL import Image, ImageFilter


def _rgb_to_lab_L(image):
    """Convert image to CIE L* (perceptual lightness) channel as float array."""
    rgb = np.array(image.convert('RGB'), dtype=float) / 255.0
    # Linearise sRGB
    linear = np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)
    # sRGB → XYZ (D65)
    r, g, b = linear[:, :, 0], linear[:, :, 1], linear[:, :, 2]
    Y = 0.2126 * r + 0.7152 * g + 0.0722 * b  # only Y needed for L*
    # XYZ → L*
    epsilon = 0.008856
    t = np.where(Y > epsilon, np.cbrt(Y), 7.787 * Y + 16 / 116)
    L = np.where(Y > epsilon, 116 * np.cbrt(Y) - 16, 903.3 * Y)
    return L  # 0–100


def contrast_score(image):
    """Std dev of perceptual lightness (CIE L*) → 0–100. Higher = more contrast."""
    L = _rgb_to_lab_L(image)
    std = np.std(L)
    # Practical max std for real icons ≈ 30 (well-contrasted icon)
    return round(min(100.0, (std / 30.0) * 100))


def small_size_score(image):
    """Structural retention after aggressive downscale. Higher = simpler/cleaner."""
    original = image.convert('RGBA').convert('L')
    small = image.convert('RGBA').resize((16, 16), Image.LANCZOS)
    reconstructed = small.resize(image.size, Image.NEAREST).convert('L')
    orig_arr = np.array(original, dtype=float)
    recon_arr = np.array(reconstructed, dtype=float)
    loss = np.mean(np.abs(orig_arr - recon_arr)) / 255.0
    return round(max(0, min(100, 100 - loss * 400)))


def simplicity_score(image):
    """Low edge density + low downscale loss → high score (0–100)."""
    gray = image.convert('L')
    edges = gray.filter(ImageFilter.FIND_EDGES)
    edge_arr = np.array(edges, dtype=float)
    edge_density = np.mean(edge_arr) / 255.0
    edge_component = max(0.0, 100.0 - edge_density * 300.0)
    downscale_component = small_size_score(image)
    return round(min(100, max(0, edge_component * 0.6 + downscale_component * 0.4)))


def has_alpha_channel(image):
    if image.mode in ('RGBA', 'LA'):
        alpha = np.array(image.getchannel('A'))
        return bool((alpha < 255).any())
    if image.mode == 'P' and 'transparency' in image.info:
        return True
    return False


def analyze_technical(image, file_path, file_size_bytes):
    w, h = image.size
    is_square = (w == h)
    min_dim = min(w, h)

    if min_dim >= 1024:
        size_score, size_label = 100, 'Excellent'
    elif min_dim >= 512:
        size_score, size_label = 75, 'Good'
    elif min_dim >= 256:
        size_score, size_label = 50, 'Acceptable'
    else:
        size_score, size_label = 25, 'Poor'

    has_alpha = has_alpha_channel(image)
    ext = os.path.splitext(file_path)[1].lower().lstrip('.')
    is_recommended_format = ext in ('png', 'webp')
    file_size_kb = round(file_size_bytes / 1024, 1)

    # File size display string
    if file_size_kb >= 1024:
        file_size_display = f"{file_size_kb / 1024:.1f} MB"
    else:
        file_size_display = f"{file_size_kb:.0f} KB"

    # File size status for scoring (legacy)
    if file_size_kb <= 300:
        file_size_status = 'good'
    elif file_size_kb <= 1000:
        file_size_status = 'acceptable'
    else:
        file_size_status = 'large'

    # Issues array (for UI cards and summary)
    issues = []
    if not is_square:
        issues.append('shape')
    if min_dim < 1024:
        issues.append('resolution')
    if ext != 'png':
        issues.append('format')
    if has_alpha:
        issues.append('background')
    if file_size_kb > 5 * 1024:
        issues.append('file_size_large')
    elif file_size_kb < 100:
        issues.append('file_size_small')

    score = 0.0
    if is_square:
        score += 30
    score += size_score * 0.3
    if not has_alpha:
        score += 20
    if is_recommended_format:
        score += 10
    if file_size_status == 'good':
        score += 10
    elif file_size_status == 'acceptable':
        score += 5

    return {
        'is_square': is_square,
        'dimensions': [w, h],
        'size_score': size_score,
        'size_label': size_label,
        'has_alpha': has_alpha,
        'format': ext,
        'is_recommended_format': is_recommended_format,
        'file_size_kb': file_size_kb,
        'file_size_display': file_size_display,
        'file_size_status': file_size_status,
        'issues': issues,
        'technical_score': round(min(100, score)),
    }


def analyze_visibility(image):
    c = contrast_score(image)
    s = simplicity_score(image)
    return {
        'contrast': c,
        'simplicity': s,
        'visibility_score': round((c + s) / 2),
    }


def generate_recommendations(technical, visibility):
    recs = []

    if not technical['is_square']:
        recs.append(
            "Icon is not square — app stores require equal width and height. "
            "Export at 1024×1024px."
        )
    if technical['size_score'] < 75:
        w, h = technical['dimensions']
        recs.append(
            f"Resolution ({w}×{h}px) is below recommended. "
            "Export at 1024×1024px for best quality across all platforms."
        )
    if technical['has_alpha']:
        recs.append(
            "Transparency detected. App stores (especially iOS) reject icons with "
            "an alpha channel. Use a fully opaque icon."
        )
    if not technical['is_recommended_format']:
        recs.append(
            "Use PNG or WebP format for best compatibility and lossless quality "
            "across platforms."
        )
    if technical['file_size_status'] == 'large':
        recs.append(
            f"File size ({technical['file_size_kb']}KB) is high — compress to "
            "under 300KB for faster delivery and store review."
        )
    if visibility['contrast'] < 40:
        recs.append(
            "Low contrast detected. Increase the difference between foreground "
            "and background — icons need to be legible at 29×29px."
        )
    if visibility['simplicity'] < 40:
        recs.append(
            "Design is visually complex. Simplify to 1–2 core shapes — icons "
            "with fewer details are more recognizable at small sizes."
        )
    if not recs:
        recs.append(
            "Your icon meets all technical requirements and scores well on "
            "visibility. Great work!"
        )
    return recs


def generate_summary(technical, visibility, overall):
    """Generate verdict, insight, and structured recommendations for Summary section."""
    contrast   = visibility['contrast']
    simplicity = visibility['simplicity']

    # ── Verdict ──
    if overall >= 70:
        verdict       = "Your Icon Performs Strongly"
        verdict_level = "strong"
    elif overall >= 40:
        verdict       = "Your Icon Needs Some Work"
        verdict_level = "medium"
    else:
        verdict       = "Your Icon Needs Significant Improvements"
        verdict_level = "weak"

    # ── Insight ──
    if contrast >= 67:
        contrast_part = "strong contrast and clear color separation"
        contrast_fix  = None
    elif contrast >= 34:
        contrast_part = "moderate contrast"
        contrast_fix  = "strengthening color differentiation would improve visibility on varied backgrounds"
    else:
        contrast_part = "low contrast"
        contrast_fix  = "the icon risks blending into backgrounds — bolder color separation is needed"

    if simplicity >= 67:
        simplicity_part = "a clean, focused composition"
        simplicity_fix  = None
    elif simplicity >= 34:
        simplicity_part = "moderate visual complexity"
        simplicity_fix  = "some fine details may be lost at smaller sizes"
    else:
        simplicity_part = "high visual complexity"
        simplicity_fix  = "the icon loses definition when scaled down — simplifying to 1–2 core shapes would help"

    if contrast >= 67 and simplicity >= 67:
        insight = (f"Your icon benefits from {contrast_part} and {simplicity_part}. "
                   "It should hold up well across all standard sizes and backgrounds.")
    elif contrast >= 67:
        insight = (f"Your icon has {contrast_part}, which helps it stand out. "
                   f"However, {simplicity_fix}. Reducing visual noise will improve small-size performance.")
    elif simplicity >= 67:
        insight = (f"The composition is {simplicity_part}, which is a solid foundation. "
                   f"However, {contrast_fix}. A more defined palette will strengthen recognition.")
    else:
        insight = (f"The icon has {contrast_part} and {simplicity_part}. "
                   f"{contrast_fix.capitalize()}. {simplicity_fix.capitalize()}.")

    if technical['size_score'] >= 75:
        insight += " The resolution is solid for all store requirements."
    elif technical['size_score'] < 50:
        insight += " The resolution is below store standards and should be addressed."

    # ── Structured recommendations ──
    recs = []
    if not technical['is_square']:
        recs.append({'title': 'Square Format Required',
                     'description': 'App stores require equal width and height. Export your icon at 1024×1024px.'})
    if technical['size_score'] < 75:
        w, h = technical['dimensions']
        recs.append({'title': 'Increase Resolution',
                     'description': f'Current resolution ({w}×{h}px) is below recommended. Export at 1024×1024px for best quality across all platforms.'})
    if technical['has_alpha']:
        recs.append({'title': 'Remove Transparency',
                     'description': 'App stores (especially iOS) reject icons with an alpha channel. Use a fully opaque icon — the OS applies rounded corners automatically.'})
    if not technical['is_recommended_format']:
        recs.append({'title': 'Use PNG or WebP',
                     'description': 'These formats offer the best compatibility and lossless quality across platforms.'})
    if technical['file_size_status'] == 'large':
        recs.append({'title': 'Reduce File Size',
                     'description': f"File size ({technical['file_size_kb']} KB) is high. Compress to under 300 KB for faster delivery and store review."})
    if contrast < 67:
        if contrast < 40:
            recs.append({'title': 'Improve Color Contrast',
                         'description': 'Low contrast detected. Increase the difference between foreground and background — icons need to be legible at 29×29px.'})
        else:
            recs.append({'title': 'Preserve Color Contrast',
                         'description': 'Contrast is moderate. Strengthening color differentiation will improve visibility on varied backgrounds.'})
    if simplicity < 67:
        if simplicity < 40:
            recs.append({'title': 'Simplify the Design',
                         'description': 'The icon is visually complex. Reduce to 1–2 core shapes — simpler icons are more recognizable at small sizes.'})
        else:
            recs.append({'title': 'Small-Size Clarity',
                         'description': 'Fine details may get lost at smaller sizes. Simplifying secondary elements will help the main shape stay readable.'})
    if not recs:
        recs.append({'title': 'All Clear',
                     'description': 'Your icon meets all technical requirements and scores well on visibility. Great work!'})

    return {'verdict': verdict, 'verdict_level': verdict_level,
            'insight': insight, 'recommendations': recs}


def analyze_icon(image_path, file_size_bytes):
    image = Image.open(image_path)
    technical = analyze_technical(image, image_path, file_size_bytes)
    visibility = analyze_visibility(image)
    recommendations = generate_recommendations(technical, visibility)
    overall = round(technical['technical_score'] * 0.4 + visibility['visibility_score'] * 0.6)
    summary = generate_summary(technical, visibility, overall)
    return {
        'technical': technical,
        'visibility': visibility,
        'recommendations': recommendations,
        'summary': summary,
        'overall_score': overall,
    }
