from pathlib import Path

import fitz


ROOT = Path("attached_assets")
OUTPUT = Path(".agents/outputs/pdf-inspection")
OUTPUT.mkdir(parents=True, exist_ok=True)

pdfs = sorted(ROOT.glob("*.pdf"))
for pdf_path in pdfs:
    document = fitz.open(pdf_path)
    stem = pdf_path.stem
    text_path = OUTPUT / f"{stem}.txt"
    with text_path.open("w", encoding="utf-8") as text_file:
        text_file.write(f"Arquivo: {pdf_path.name}\n")
        text_file.write(f"Páginas: {document.page_count}\n\n")
        for index, page in enumerate(document):
            text_file.write(f"\n===== PÁGINA {index + 1} =====\n")
            text_file.write(page.get_text("text"))
            if index in (0, document.page_count - 1):
                pixmap = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
                pixmap.save(OUTPUT / f"{stem}-page-{index + 1}.png")
    print(f"{pdf_path.name}: {document.page_count} páginas -> {text_path}")