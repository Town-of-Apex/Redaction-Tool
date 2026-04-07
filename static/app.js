const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const uploadCard = document.getElementById('uploadCard');
const previewContainer = document.getElementById('previewContainer');
const pagesArea = document.getElementById('pagesArea');
const loading = document.getElementById('loading');
const redactBtn = document.getElementById('redactBtn');

let currentFile = null;
let currentRedactions = []; // Array of { page: i, rect: [x0, y0, x1, y1] }
let pageDimensions = {}; // { page_index: { width, height } }

// UI Interactions
dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = "var(--brand-accent)";
});

dropZone.addEventListener('dragleave', () => {
    dropZone.style.borderColor = "var(--muted-slate)";
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = "var(--muted-slate)";
    if (e.dataTransfer.files.length) {
        handleFile(e.dataTransfer.files[0]);
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) {
        handleFile(e.target.files[0]);
    }
});

function handleFile(file) {
    if (file.type !== "application/pdf") {
        alert("Please upload a PDF file.");
        return;
    }
    
    currentFile = file;
    dropZone.style.display = 'none';
    loading.style.display = 'block';
    
    const formData = new FormData();
    formData.append('file', file);
    
    fetch('/api/analyze', {
        method: 'POST',
        body: formData
    })
    .then(r => r.json())
    .then(data => {
        loading.style.display = 'none';
        uploadCard.style.display = 'none';
        previewContainer.style.display = 'block';
        
        currentRedactions = data.proposals || [];
        renderPages(data.pages);
        renderRedactions();
    })
    .catch(err => {
        alert("Error analyzing file.");
        console.error(err);
        window.location.reload();
    });
}

function renderPages(pages) {
    pagesArea.innerHTML = '';
    pages.forEach(page => {
        pageDimensions[page.page] = { width: page.width, height: page.height };
        
        const wrapper = document.createElement('div');
        wrapper.className = 'page-wrapper';
        wrapper.dataset.page = page.page;
        wrapper.style.width = "100%"; // Let it expand inside the container natively
        // Provide standard aspect ratio layout
        wrapper.style.aspectRatio = `${page.width} / ${page.height}`;
        
        const img = document.createElement('img');
        img.src = `data:image/png;base64,${page.image_base64}`;
        
        const overlay = document.createElement('div');
        overlay.className = 'overlay-layer';
        
        // Drawing logic
        let isDrawing = false;
        let startX = 0;
        let startY = 0;
        let activeBox = null;
        
        overlay.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('redaction-box')) return; // handled by box removal
            isDrawing = true;
            const rect = overlay.getBoundingClientRect();
            startX = e.clientX - rect.left;
            startY = e.clientY - rect.top;
            
            activeBox = document.createElement('div');
            activeBox.className = 'redaction-box';
            activeBox.style.left = startX + 'px';
            activeBox.style.top = startY + 'px';
            activeBox.style.width = '0px';
            activeBox.style.height = '0px';
            overlay.appendChild(activeBox);
        });
        
        overlay.addEventListener('mousemove', (e) => {
            if (!isDrawing || !activeBox) return;
            const rect = overlay.getBoundingClientRect();
            const currentX = e.clientX - rect.left;
            const currentY = e.clientY - rect.top;
            
            const left = Math.min(startX, currentX);
            const top = Math.min(startY, currentY);
            const width = Math.abs(currentX - startX);
            const height = Math.abs(currentY - startY);
            
            activeBox.style.left = left + 'px';
            activeBox.style.top = top + 'px';
            activeBox.style.width = width + 'px';
            activeBox.style.height = height + 'px';
        });
        
        overlay.addEventListener('mouseup', (e) => {
            if (!isDrawing || !activeBox) return;
            isDrawing = false;
            
            // convert DOM px to PDF points
            const domRect = overlay.getBoundingClientRect();
            const pdfWidth = pageDimensions[page.page].width;
            const pdfHeight = pageDimensions[page.page].height;
            
            const scaleX = pdfWidth / domRect.width;
            const scaleY = pdfHeight / domRect.height;
            
            let bx = parseFloat(activeBox.style.left) * scaleX;
            let by = parseFloat(activeBox.style.top) * scaleY;
            let bw = parseFloat(activeBox.style.width) * scaleX;
            let bh = parseFloat(activeBox.style.height) * scaleY;
            
            // If the box is too small, cancel it
            if (bw < 5 || bh < 5) {
                overlay.removeChild(activeBox);
            } else {
                currentRedactions.push({
                    page: page.page,
                    rect: [bx, by, bx+bw, by+bh],
                    type: 'manual',
                    reason: 'Manual Redaction'
                });
                renderRedactions(); // refresh all
            }
            activeBox = null;
        });
        
        wrapper.appendChild(img);
        wrapper.appendChild(overlay);
        pagesArea.appendChild(wrapper);
    });
}

function renderRedactions() {
    // Clear old boxes
    document.querySelectorAll('.redaction-box').forEach(el => el.remove());
    
    currentRedactions.forEach((r, idx) => {
        const wrapper = document.querySelector(`.page-wrapper[data-page="${r.page}"]`);
        if (!wrapper) return;
        
        const overlay = wrapper.querySelector('.overlay-layer');
        if (!overlay) return;
        
        const widthPts = pageDimensions[r.page].width;
        const heightPts = pageDimensions[r.page].height;
        
        const [x0, y0, x1, y1] = r.rect;
        
        const leftPct = (x0 / widthPts) * 100;
        const topPct = (y0 / heightPts) * 100;
        const widthPct = ((x1 - x0) / widthPts) * 100;
        const heightPct = ((y1 - y0) / heightPts) * 100;
        
        const box = document.createElement('div');
        box.className = 'redaction-box';
        box.style.left = `${leftPct}%`;
        box.style.top = `${topPct}%`;
        box.style.width = `${widthPct}%`;
        box.style.height = `${heightPct}%`;
        box.title = r.reason || "Manual";
        
        // Tag
        const tag = document.createElement('div');
        tag.className = 'box-tag';
        tag.innerText = r.type || "Area";
        box.appendChild(tag);
        
        // Remove on click
        box.addEventListener('click', (e) => {
            e.stopPropagation();
            currentRedactions.splice(idx, 1);
            renderRedactions(); // recursive re-render
        });
        
        overlay.appendChild(box);
    });
}

redactBtn.addEventListener('click', () => {
    redactBtn.innerText = "Processing...";
    redactBtn.disabled = true;
    
    const formData = new FormData();
    formData.append('file', currentFile);
    formData.append('redactions', JSON.stringify(currentRedactions));
    
    fetch('/api/redact', {
        method: 'POST',
        body: formData
    })
    .then(r => {
        if (!r.ok) throw new Error("Failed to redact");
        return r.blob();
    })
    .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = "redacted_" + currentFile.name;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        
        redactBtn.innerText = "Downloaded!";
        setTimeout(() => {
            redactBtn.innerText = "Confirm & Download Redacted";
            redactBtn.disabled = false;
        }, 3000);
    })
    .catch(err => {
        console.error(err);
        alert("Error generating redacted PDF.");
        redactBtn.innerText = "Confirm & Download Redacted";
        redactBtn.disabled = false;
    });
});
