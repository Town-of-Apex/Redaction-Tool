import fitz  # PyMuPDF
import re
import io
import base64
from PIL import Image

# ==========================================
# CONFIGURATION
# ==========================================
# Add or modify regular expressions here to detect text to redact.
# 'pattern' is the regex string to search (case-insensitive usually).
# 'padding_x' and 'padding_y' specify how much to "expand" the found bounding box
# to ensure signatures or adjacent elements are redacted. (in points, where 1 inch = 72 points)
REDACTION_CONFIG = [
    {
        "pattern": r"(?i)P\.?E\.?\s*Signature", 
        "padding_x": 50,
        "padding_y": 30
    },
    {
        "pattern": r"(?i)Professional\s*Engineer", 
        "padding_x": 50,
        "padding_y": 30
    },
    {
        "pattern": r"(?i)Signature:", 
        "padding_x": 120,
        "padding_y": 40
    },
    {
        "pattern": r"(?i)Seal",
        "padding_x": 80,
        "padding_y": 80
    }
]

# Configure whether we should also propose redacting all embedded images (which are often logos/seals)
PROPOSE_IMAGE_REDACTION = True

def generate_previews(pdf_bytes):
    """
    Generate image previews for a PDF and return dimensions.
    Returns:
       [
         {
           "page": <int>,
           "width": <float>,
           "height": <float>,
           "image_base64": <str>
         }, ...
       ]
    """
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    pages = []
    
    for page_index in range(len(doc)):
        page = doc[page_index]
        rect = page.rect
        # Create a pixmap (image representation) of the page
        # Using a DPI of 150 for good enough preview quality, but keeping original rect dimensions for coordinate mapping
        zoom = 2.0
        mat = fitz.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=mat, alpha=False)
        
        # Convert to base64
        img_bytes = pix.tobytes("png")
        b64_str = base64.b64encode(img_bytes).decode("utf-8")
        
        pages.append({
            "page": page_index,
            "width": rect.width,
            "height": rect.height,
            "image_base64": b64_str
        })
        
    doc.close()
    return pages

def propose_redactions(pdf_bytes):
    """
    Analyzes the PDF based on REDACTION_CONFIG and PROPOSE_IMAGE_REDACTION.
    Returns a list of proposed bounding boxes.
    """
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    proposals = []
    
    for page_index in range(len(doc)):
        page = doc[page_index]
        page_rect = page.rect
        text_words = page.get_text("words")  # (x0, y0, x1, y1, "word", block_no, line_no, word_no)
        
        # Method 1: Regex matches on full page text
        page_text = page.get_text()
        
        for config in REDACTION_CONFIG:
            pattern = config["pattern"]
            pad_x = config["padding_x"]
            pad_y = config["padding_y"]
            
            for match in re.finditer(pattern, page_text):
                # Search for the matched text in the page's output bounding boxes
                # PyMuPDF makes it tricky to get exact regex match bounds, so we'll use search_for
                match_str = match.group()
                insts = page.search_for(match_str)
                for inst in insts:
                    # inst is a Rect. Add padding
                    x0 = max(0, inst.x0 - pad_x)
                    y0 = max(0, inst.y0 - pad_y)
                    x1 = min(page_rect.width, inst.x1 + pad_x)
                    y1 = min(page_rect.height, inst.y1 + pad_y)
                    
                    proposals.append({
                        "page": page_index,
                        "rect": [x0, y0, x1, y1],
                        "type": "text_anchor",
                        "reason": f"Matched '{match_str}'"
                    })
                    
        # Method 2: Identify images
        if PROPOSE_IMAGE_REDACTION:
            image_list = page.get_images(full=True)
            for img_index, img in enumerate(image_list):
                xref = img[0]
                # To get rects of where the image is on the page
                img_rects = page.get_image_rects(xref)
                for r in img_rects:
                    proposals.append({
                        "page": page_index,
                        "rect": [r.x0, r.y0, r.x1, r.y1],
                        "type": "image",
                        "reason": f"Embedded Image/Logo"
                    })
                    
    doc.close()
    
    # Deduplicate rough proposals if they are highly overlapping (optional, keeping it simple for now)
    return proposals

def apply_redactions(pdf_bytes, redactions):
    """
    Applies the actual redactions to the PDF irreversibly.
    `redactions` is a list of dicts: {"page": int, "rect": [x0, y0, x1, y1]}
    Returns the redacted PDF bytes.
    """
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    
    for r in redactions:
        page_idx = r["page"]
        rect = fitz.Rect(r["rect"])
        if page_idx < len(doc):
            page = doc[page_idx]
            # Add redaction annotation (this is the box that will be applied)
            # By default PyMuPDF fills the box with black.
            page.add_redact_annot(rect, fill=(0, 0, 0))
    
    # Actually burn the redactions into the document removing underlying layers irreversibly
    for page in doc:
        page.apply_redactions()
        
    # Metadata scrubbing
    doc.set_metadata({
        "creationDate": fitz.get_pdf_now(),
        "modDate": fitz.get_pdf_now(),
        "creator": "Local Redaction Tool",
        "producer": "Local Redaction Tool",
        "title": "Redacted Document",
        "author": "Redacted",
        "subject": "Redacted"
    })
    
    # Save to a byte stream
    # Garbage=4 is the maximum level of cleaning up unused structures
    # deflate=True compresses the streams
    out_pdf = doc.tobytes(garbage=4, deflate=True)
    doc.close()
    
    return out_pdf
