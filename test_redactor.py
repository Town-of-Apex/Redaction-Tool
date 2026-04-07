import redactor
import os

def test_flow():
    dummy_pdf_path = "/Users/connormckinnis/Developer/Redaction-Tool/dummy_permit.pdf"
    if not os.path.exists(dummy_pdf_path):
        print(f"Error: {dummy_pdf_path} not found.")
        return

    with open(dummy_pdf_path, "rb") as f:
        pdf_bytes = f.read()

    print("--- 1. Testing Previews ---")
    previews = redactor.generate_previews(pdf_bytes)
    print(f"Generated {len(previews)} page previews.")
    for p in previews:
        print(f"  Page {p['page']}: {p['width']}x{p['height']}, B64 length: {len(p['image_base64'])}")

    print("\n--- 2. Testing Proposals ---")
    proposals = redactor.propose_redactions(pdf_bytes)
    print(f"Found {len(proposals)} redaction proposals.")
    for prop in proposals:
        print(f"  [{prop['type']}] Page {prop['page']}, Rect: {prop['rect']}, Reason: {prop['reason']}")

    print("\n--- 3. Testing Redaction ---")
    # Apply some of the proposals
    redacted_pdf = redactor.apply_redactions(pdf_bytes, proposals)
    output_path = "/Users/connormckinnis/Developer/Redaction-Tool/redacted_test_output.pdf"
    with open(output_path, "wb") as f:
        f.write(redacted_pdf)
    
    print(f"Redacted PDF saved to {output_path}")
    print("Verification: Open the PDF and check if the boxes are blacked out.")

if __name__ == "__main__":
    test_flow()
