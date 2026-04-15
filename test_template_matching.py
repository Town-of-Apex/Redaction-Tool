import cv2
import numpy as np
from pdf2image import convert_from_path
from PIL import Image

# -----------------------------
# CONFIG
# -----------------------------
INPUT_PDF = "test_document.pdf"
OUTPUT_PDF = "test_output.pdf"

DPI = 200

# Heuristic thresholds (tune these if needed)
MIN_AREA = 1000
CIRCULARITY_MIN = 0.3
CIRCULARITY_MAX = 1.3
DENSITY_THRESHOLD = 0.1

EDGE_MARGIN_RATIO = 0.25  # only scan outer 25%


# -----------------------------
# HELPERS
# -----------------------------
def pil_to_cv(image):
    return cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)


def get_edge_mask(h, w, margin_ratio):
    mask = np.zeros((h, w), dtype=np.uint8)

    mh = int(h * margin_ratio)
    mw = int(w * margin_ratio)

    # top, bottom, left, right regions
    mask[0:mh, :] = 1
    mask[h-mh:h, :] = 1
    mask[:, 0:mw] = 1
    mask[:, w-mw:w] = 1

    return mask


# -----------------------------
# MAIN PROCESS
# -----------------------------
pages = convert_from_path(INPUT_PDF, dpi=DPI)

output_images = []

for page_index, page in enumerate(pages):
    print(f"Processing page {page_index+1}...")

    image = pil_to_cv(page)
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    h, w = gray.shape

    # Edge mask (focus on margins only)
    edge_mask = get_edge_mask(h, w, EDGE_MARGIN_RATIO)

    # Preprocessing
    blur = cv2.GaussianBlur(gray, (5, 5), 0)

    thresh = cv2.adaptiveThreshold(
        blur,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        11,
        2
    )

    # Apply edge mask
    thresh = thresh * edge_mask

    # Find contours
    contours, _ = cv2.findContours(
        thresh,
        cv2.RETR_EXTERNAL,
        cv2.CHAIN_APPROX_SIMPLE
    )

    debug_img = image.copy()
    cv2.drawContours(debug_img, contours, -1, (0,255,0), 2)
    cv2.imwrite(f"debug_contours_page_{page_index}.png", debug_img)

    detected_boxes = []

    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < MIN_AREA:
            continue

        perimeter = cv2.arcLength(cnt, True)
        if perimeter == 0:
            continue

        circularity = 4 * np.pi * area / (perimeter * perimeter)

        if not (CIRCULARITY_MIN < circularity < CIRCULARITY_MAX):
            continue

        x, y, cw, ch = cv2.boundingRect(cnt)

        # Density check
        roi = thresh[y:y+ch, x:x+cw]
        density = np.sum(roi) / (255 * cw * ch)

        if density < DENSITY_THRESHOLD:
            continue

        # Expand box slightly (capture full seal)
        pad = 10
        x1 = max(x - pad, 0)
        y1 = max(y - pad, 0)
        x2 = min(x + cw + pad, w)
        y2 = min(y + ch + pad, h)

        detected_boxes.append((x1, y1, x2, y2))

    print(f"Detected {len(detected_boxes)} candidate seals")

    # Redact detected regions
    for (x1, y1, x2, y2) in detected_boxes:
        cv2.rectangle(image, (x1, y1), (x2, y2), (0, 0, 0), -1)

    # Convert back to PIL
    output_images.append(Image.fromarray(cv2.cvtColor(image, cv2.COLOR_BGR2RGB)))

# Save as PDF
if output_images:
    output_images[0].save(
        OUTPUT_PDF,
        save_all=True,
        append_images=output_images[1:]
    )

print(f"Saved redacted PDF to {OUTPUT_PDF}")