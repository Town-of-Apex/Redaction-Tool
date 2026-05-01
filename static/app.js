// Tab Switching
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active-tab'));
        tabContents.forEach(c => c.classList.remove('active-tab'));
        btn.classList.add('active-tab');
        document.getElementById(btn.dataset.target).classList.add('active-tab');
    });
});

// Profile Management
let profiles = [];
async function loadProfiles() {
    const res = await fetch('/api/profiles');
    profiles = await res.json();
    
    // Update Selects
    const selects = [document.getElementById('profileSelect'), document.getElementById('profileSelectInitial')];
    selects.forEach(select => {
        select.innerHTML = '<option value="">-- No Profile --</option>';
        profiles.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.innerText = p.name;
            select.appendChild(opt);
        });
    });
    
    // Update List
    const list = document.getElementById('existingProfilesList');
    list.innerHTML = '';
    profiles.forEach(p => {
        const li = document.createElement('li');
        li.style.display = 'flex';
        li.style.justifyContent = 'space-between';
        li.style.padding = '0.5rem';
        li.style.borderBottom = '1px solid var(--border-line)';
        li.style.alignItems = 'center';
        
        const span = document.createElement('span');
        span.innerText = p.name;
        span.style.color = 'var(--text-main)';
        
        const delBtn = document.createElement('button');
        delBtn.innerText = 'Delete';
        delBtn.className = 'btn btn-danger';
        delBtn.style.padding = '0.2rem 0.5rem';
        delBtn.onclick = async () => {
            await fetch(`/api/profiles/${p.id}`, { method: 'DELETE' });
            loadProfiles();
        };
        
        li.appendChild(span);
        li.appendChild(delBtn);
        list.appendChild(li);
    });
}
loadProfiles();


// Sync Profile Selects
const profileInit = document.getElementById('profileSelectInitial');
const profileFinal = document.getElementById('profileSelect');
profileInit.addEventListener('change', () => profileFinal.value = profileInit.value);

// Sync Main Image Redaction Toggles
const imageToggleInit = document.getElementById('mainImageRedactionToggle');
const imageToggleEditor = document.getElementById('mainImageRedactionToggleEditor');
imageToggleInit.addEventListener('change', (e) => imageToggleEditor.checked = e.target.checked);
imageToggleEditor.addEventListener('change', async (e) => {
    imageToggleInit.checked = e.target.checked;
    if (filesData.length > 0) {
        document.getElementById('loadingText').innerText = "Updating analysis...";
        loading.classList.remove('hidden');
        await applySelectedProfile();
        loading.classList.add('hidden');
        showFile(currentFileIdx);
    }
});

// Shared State & Utils
let currentZoom = 100;
const zoomRange = document.getElementById('zoomRange');
const zoomValue = document.getElementById('zoomValue');

zoomRange.addEventListener('input', (e) => {
    currentZoom = parseInt(e.target.value);
    zoomValue.innerText = `${currentZoom}%`;
    updatePageScales();
});

function updatePageScales() {
    document.querySelectorAll('.page-wrapper').forEach(wrapper => {
        const pageIdx = wrapper.dataset.page;
        // Need to know context (main or profile)
        const dims = wrapper.closest('#pagesArea') ? activeFileDimensions[pageIdx] : profileDimensions[pageIdx];
        if (dims) {
            const baseWidth = 800;
            const scaledWidth = baseWidth * (currentZoom / 100);
            wrapper.style.width = `${scaledWidth}px`;
        }
    });
}

function getScale(wrapper, dims) {
    const domRect = wrapper.querySelector('.overlay-layer').getBoundingClientRect();
    const pdfWidth = dims.width;
    const pdfHeight = dims.height;
    return { scaleX: pdfWidth / domRect.width, scaleY: pdfHeight / domRect.height };
}

// ----- PROFILE CREATION -----
let profileFile = null;
let profileRedactions = [];
let profileDimensions = {};

const profileDropZone = document.getElementById('profileDropZone');
const profileFileInput = document.getElementById('profileFileInput');
const profileUploadCard = document.getElementById('profileUploadCard');
const profilePreviewContainer = document.getElementById('profilePreviewContainer');
const profilePagesArea = document.getElementById('profilePagesArea');
const profileLoading = document.getElementById('profileLoading');

profileDropZone.addEventListener('click', () => profileFileInput.click());
profileDropZone.addEventListener('dragover', (e) => { e.preventDefault(); profileDropZone.style.borderColor = "var(--brand-accent)"; });
profileDropZone.addEventListener('dragleave', () => { profileDropZone.style.borderColor = "var(--muted-slate)"; });
profileDropZone.addEventListener('drop', (e) => { e.preventDefault(); profileDropZone.style.borderColor = "var(--muted-slate)"; if (e.dataTransfer.files.length) handleProfileFile(e.dataTransfer.files[0]); });
profileFileInput.addEventListener('change', (e) => { if (e.target.files.length) handleProfileFile(e.target.files[0]); });

function handleProfileFile(file) {
    if (file.type !== "application/pdf") { alert("Please upload a PDF file."); return; }
    
    profileFile = file;
    profileLoading.classList.remove('hidden');
    profileDropZone.classList.add('hidden');
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('image_redaction', document.getElementById('profileImageRedactionToggle').checked ? 'true' : 'false');
    
    fetch('/api/analyze', { method: 'POST', body: formData })
    .then(r => r.json())
    .then(data => {
        profileLoading.classList.add('hidden');
        profilePreviewContainer.classList.remove('hidden');
        
        profileRedactions = []; // Start empty, updateTemplateRegexPreview will fill regex matches
        profileDimensions = {};
        renderPages(data.pages, profilePagesArea, profileDimensions, profileRedactions, () => renderRedactions(profilePagesArea, profileDimensions, profileRedactions));
        updateTemplateRegexPreview();
    })
    .catch(err => { alert("Error analyzing file."); console.error(err); profileLoading.classList.add('hidden'); profileDropZone.classList.remove('hidden'); });
}

async function updateTemplateRegexPreview() {
    if (!profileFile || profilePreviewContainer.classList.contains('hidden')) return;
    
    profileRedactions = profileRedactions.filter(r => r.type === 'manual');
    
    const validRegexes = profileRegexes.filter(r => r.pattern.trim() !== "");
    const imageRedact = document.getElementById('profileImageRedactionToggle').checked ? 'true' : 'false';
    
    if (validRegexes.length > 0 || imageRedact === 'true') {
        const formData = new FormData();
        formData.append('file', profileFile);
        formData.append('regexes', JSON.stringify(validRegexes));
        formData.append('image_redaction', imageRedact);
        try {
            const r = await fetch('/api/analyze', { method: 'POST', body: formData });
            const res = await r.json();
            res.proposals.forEach(p => {
                p.type = 'regex_preview';
                profileRedactions.push(p);
            });
        } catch(e) {}
    }
    
    renderRedactions(profilePagesArea, profileDimensions, profileRedactions);
}

let profileRegexes = [];

document.getElementById('addRegexBtn').addEventListener('click', () => {
    profileRegexes.push({ pattern: "", padding_x: 50, padding_y: 30 });
    renderRegexes();
});

function renderRegexes() {
    const list = document.getElementById('regexList');
    list.innerHTML = '';
    profileRegexes.forEach((r, i) => {
        const row = document.createElement('div');
        row.className = 'flex-row';
        row.style.background = 'var(--bg-inner)';
        row.style.padding = '10px';
        row.style.borderRadius = 'var(--radius-sm)';
        
        row.innerHTML = `
            <div style="flex: 1;">
                <label class="metadata">Pattern (Regex)</label>
                <input type="text" value="${r.pattern}" onchange="profileRegexes[${i}].pattern=this.value; updateTemplateRegexPreview()" placeholder="e.g. (?i)Signature:" style="width: 100%; margin-top: 4px; padding: 0.5rem; border: 1px solid var(--border-line); border-radius: var(--radius-sm);">
            </div>
            <div style="width: 80px;">
                <label class="metadata">Pad X</label>
                <input type="number" value="${r.padding_x}" onchange="profileRegexes[${i}].padding_x=parseInt(this.value); updateTemplateRegexPreview()" style="width: 100%; margin-top: 4px; padding: 0.5rem; border: 1px solid var(--border-line); border-radius: var(--radius-sm);">
            </div>
            <div style="width: 80px;">
                <label class="metadata">Pad Y</label>
                <input type="number" value="${r.padding_y}" onchange="profileRegexes[${i}].padding_y=parseInt(this.value); updateTemplateRegexPreview()" style="width: 100%; margin-top: 4px; padding: 0.5rem; border: 1px solid var(--border-line); border-radius: var(--radius-sm);">
            </div>
            <button class="btn btn-danger" onclick="profileRegexes.splice(${i}, 1); renderRegexes(); updateTemplateRegexPreview()" style="margin-top: 22px;">X</button>
        `;
        list.appendChild(row);
    });
}

function saveCurrentProfile() {
    const name = document.getElementById('newProfileName').value;
    if (!name) { alert("Please enter a profile name before saving."); return; }
    
    const validRegexes = profileRegexes.filter(r => r.pattern.trim() !== "");
    
    fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            name: name, 
            data: { 
                boxes: profileRedactions.filter(r => r.type === 'manual'), 
                regexes: validRegexes,
                redact_images: document.getElementById('profileImageRedactionToggle').checked
            } 
        })
    }).then(() => {
        alert("Profile saved!");
        document.getElementById('newProfileName').value = '';
        profileRegexes = [];
        renderRegexes();
        profileRedactions = [];
        profileFile = null;
        document.getElementById('profileFileInput').value = '';
        profilePreviewContainer.classList.add('hidden');
        profileDropZone.classList.remove('hidden');
        loadProfiles();
    });
}

document.getElementById('saveProfileBtn').addEventListener('click', saveCurrentProfile);
document.getElementById('cancelProfileBtn').addEventListener('click', () => {
    profilePreviewContainer.classList.add('hidden');
    profileDropZone.classList.remove('hidden');
    profileRedactions = [];
    profileFile = null;
    document.getElementById('profileFileInput').value = '';
});

// ----- MAIN APP: REDACT DOCUMENTS -----
let filesData = []; // Array of { file, pages, redactions, dimensions, filename }
let currentFileIdx = 0;
let activeFileDimensions = {};

const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const uploadCard = document.getElementById('uploadCard');
const previewContainer = document.getElementById('previewContainer');
const pagesArea = document.getElementById('pagesArea');
const loading = document.getElementById('loading');

dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.borderColor = "var(--brand-accent)"; });
dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = "var(--muted-slate)"; });
dropZone.addEventListener('drop', (e) => { e.preventDefault(); dropZone.style.borderColor = "var(--muted-slate)"; if (e.dataTransfer.files.length) handleMainFiles(e.dataTransfer.files); });
fileInput.addEventListener('change', (e) => { if (e.target.files.length) handleMainFiles(e.target.files); });

async function handleMainFiles(files) {
    loading.classList.remove('hidden');
    const loadingText = document.getElementById('loadingText');
    
    filesData = [];
    for (let i = 0; i < files.length; i++) {
        loadingText.innerText = `Processing document ${i + 1} of ${files.length}...`;
        const file = files[i];
        if (file.type !== "application/pdf") continue;
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('image_redaction', document.getElementById('mainImageRedactionToggle').checked ? 'true' : 'false');
        
        try {
            const r = await fetch('/api/analyze', { method: 'POST', body: formData });
            const data = await r.json();
            
            let dims = {};
            data.pages.forEach(pg => dims[pg.page] = { width: pg.width, height: pg.height });
            
            filesData.push({
                file: file,
                filename: file.name,
                pages: data.pages,
                proposals: data.proposals, // save original proposals
                redactions: [...data.proposals], // current working set
                dimensions: dims
            });
        } catch(e) { console.error("Error analyzing", file.name); }
    }
    
    loading.classList.add('hidden');
    loadingText.innerText = "Processing documents, identifying sensitive fields...";
    
    if (filesData.length > 0) {
        uploadCard.classList.add('hidden');
        previewContainer.classList.remove('hidden');
        
        const carouselControls = document.querySelector('.carousel-controls');
        const redactAllBtn = document.getElementById('redactAllBtn');
        if (filesData.length === 1) {
            carouselControls.style.display = 'none';
            redactAllBtn.style.display = 'none';
        } else {
            carouselControls.style.display = 'flex';
            redactAllBtn.style.display = 'inline-flex';
        }
        
        await applySelectedProfile();
        currentFileIdx = 0;
        showFile(0);
    }
}

document.getElementById('profileSelect').addEventListener('change', async () => {
    if (filesData.length > 0) {
        document.getElementById('loadingText').innerText = "Applying profile...";
        loading.classList.remove('hidden');
        
        const selectedProfileId = document.getElementById('profileSelect').value;
        if (selectedProfileId) {
            const p = profiles.find(pr => pr.id == selectedProfileId);
            if (p && p.data && p.data.redact_images !== undefined) {
                document.getElementById('mainImageRedactionToggleEditor').checked = p.data.redact_images;
                document.getElementById('mainImageRedactionToggle').checked = p.data.redact_images;
            }
        }
        
        await applySelectedProfile();
        loading.classList.add('hidden');
        showFile(currentFileIdx);
    }
});

async function applySelectedProfile() {
    const selectedProfileId = document.getElementById('profileSelect').value;
    const imageRedact = document.getElementById('mainImageRedactionToggleEditor').checked;
    let autoData = null;
    if (selectedProfileId) {
        const p = profiles.find(pr => pr.id == selectedProfileId);
        if (p) autoData = p.data;
    }
    
    for (let i = 0; i < filesData.length; i++) {
        let data = filesData[i];
        const formData = new FormData();
        formData.append('file', data.file);
        formData.append('image_redaction', imageRedact ? 'true' : 'false');
        
        if (autoData) {
            let newRedactions = JSON.parse(JSON.stringify(autoData.boxes || []));
            if (autoData.regexes && autoData.regexes.length > 0) {
                formData.append('regexes', JSON.stringify(autoData.regexes));
            } else {
                formData.append('regexes', '[]');
            }
            try {
                const r = await fetch('/api/analyze', { method: 'POST', body: formData });
                const res = await r.json();
                newRedactions.push(...res.proposals);
            } catch(e) { console.error(e); }
            data.redactions = newRedactions;
        } else {
            try {
                const r = await fetch('/api/analyze', { method: 'POST', body: formData });
                const res = await r.json();
                data.redactions = res.proposals;
                data.proposals = res.proposals;
            } catch(e) { console.error(e); }
        }
    }
}

function showFile(idx) {
    if (idx < 0 || idx >= filesData.length) return;
    currentFileIdx = idx;
    const data = filesData[idx];
    
    document.getElementById('currentFileLabel').innerText = `File ${idx + 1} of ${filesData.length}`;
    document.getElementById('fileNameDisplay').innerText = data.filename;
    document.getElementById('prevFileBtn').disabled = idx === 0;
    document.getElementById('nextFileBtn').disabled = idx === filesData.length - 1;
    
    activeFileDimensions = data.dimensions;
    renderPages(data.pages, pagesArea, data.dimensions, data.redactions, () => renderRedactions(pagesArea, data.dimensions, data.redactions));
    renderRedactions(pagesArea, data.dimensions, data.redactions);
}

document.getElementById('prevFileBtn').addEventListener('click', () => showFile(currentFileIdx - 1));
document.getElementById('nextFileBtn').addEventListener('click', () => showFile(currentFileIdx + 1));

// ----- GENERIC RENDERING LOGIC -----
function renderPages(pages, container, dimensionsObj, redactionsArr, onRedactionsChanged) {
    container.innerHTML = '';
    pages.forEach(page => {
        dimensionsObj[page.page] = { width: page.width, height: page.height };
        
        const wrapper = document.createElement('div');
        wrapper.className = 'page-wrapper';
        wrapper.dataset.page = page.page;
        
        const baseWidth = 800;
        const scaledWidth = baseWidth * (currentZoom / 100);
        wrapper.style.width = `${scaledWidth}px`;
        wrapper.style.aspectRatio = `${page.width} / ${page.height}`;
        wrapper.style.position = 'relative';
        
        const img = document.createElement('img');
        img.src = `data:image/png;base64,${page.image_base64}`;
        img.style.width = "100%";
        img.style.display = "block";
        
        const overlay = document.createElement('div');
        overlay.className = 'overlay-layer';
        
        // Drawing logic
        let isDrawing = false;
        let startX = 0, startY = 0;
        let activeBox = null;
        
        overlay.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('redaction-box') || e.target.closest('.redaction-box')) {
                return; 
            }
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
            const rect = overlay.getBoundingClientRect();
            const currentX = e.clientX - rect.left;
            const currentY = e.clientY - rect.top;

            if (isDrawing && activeBox) {
                const left = Math.min(startX, currentX);
                const top = Math.min(startY, currentY);
                const width = Math.abs(currentX - startX);
                const height = Math.abs(currentY - startY);
                
                activeBox.style.left = left + 'px';
                activeBox.style.top = top + 'px';
                activeBox.style.width = width + 'px';
                activeBox.style.height = height + 'px';
            }
        });
        
        overlay.addEventListener('mouseup', (e) => {
            const s = getScale(wrapper, dimensionsObj[page.page]);
            if (isDrawing && activeBox) {
                isDrawing = false;
                
                let bx = parseFloat(activeBox.style.left) * s.scaleX;
                let by = parseFloat(activeBox.style.top) * s.scaleY;
                let bw = parseFloat(activeBox.style.width) * s.scaleX;
                let bh = parseFloat(activeBox.style.height) * s.scaleY;
                
                if (bw < 5 || bh < 5) {
                    overlay.removeChild(activeBox);
                } else {
                    redactionsArr.push({
                        page: page.page,
                        rect: [bx, by, bx+bw, by+bh],
                        type: 'manual',
                        reason: 'Manual Redaction'
                    });
                    onRedactionsChanged();
                }
                activeBox = null;
            }
        });
        
        wrapper.appendChild(img);
        wrapper.appendChild(overlay);
        container.appendChild(wrapper);
    });
}

function renderRedactions(container, dimensionsObj, redactionsArr) {
    container.querySelectorAll('.redaction-box').forEach(el => el.remove());
    
    redactionsArr.forEach((r, idx) => {
        const wrapper = container.querySelector(`.page-wrapper[data-page="${r.page}"]`);
        if (!wrapper) return;
        
        const overlay = wrapper.querySelector('.overlay-layer');
        if (!overlay) return;
        
        const widthPts = dimensionsObj[r.page].width;
        const heightPts = dimensionsObj[r.page].height;
        
        const [x0, y0, x1, y1] = r.rect;
        
        const leftPct = (x0 / widthPts) * 100;
        const topPct = (y0 / heightPts) * 100;
        const widthPct = ((x1 - x0) / widthPts) * 100;
        const heightPct = ((y1 - y0) / heightPts) * 100;
        
        const box = document.createElement('div');
        box.className = 'redaction-box';
        box.dataset.idx = idx;
        box.style.left = `${leftPct}%`;
        box.style.top = `${topPct}%`;
        box.style.width = `${widthPct}%`;
        box.style.height = `${heightPct}%`;
        box.title = r.reason || "Manual";
        
        const tag = document.createElement('div');
        tag.className = 'box-tag';
        tag.innerText = r.type || "Area";
        box.appendChild(tag);
        
        let isDragging = false;
        let startX, startY, startLeft, startTop;
        
        box.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            
            const rect = box.getBoundingClientRect();
            const parentRect = overlay.getBoundingClientRect();
            startLeft = rect.left - parentRect.left;
            startTop = rect.top - parentRect.top;
            
            box.style.width = rect.width + 'px';
            box.style.height = rect.height + 'px';
            box.style.left = startLeft + 'px';
            box.style.top = startTop + 'px';
            
            const mousemove = (ev) => {
                if (!isDragging) return;
                const dx = ev.clientX - startX;
                const dy = ev.clientY - startY;
                box.style.left = (startLeft + dx) + 'px';
                box.style.top = (startTop + dy) + 'px';
            };
            
            const mouseup = (ev) => {
                if (!isDragging) return;
                isDragging = false;
                document.removeEventListener('mousemove', mousemove);
                document.removeEventListener('mouseup', mouseup);
                
                const s = getScale(wrapper, dimensionsObj[r.page]);
                const left = parseFloat(box.style.left);
                const top = parseFloat(box.style.top);
                const width = parseFloat(box.style.width);
                const height = parseFloat(box.style.height);

                const nx0 = left * s.scaleX;
                const ny0 = top * s.scaleY;
                const nx1 = (left + width) * s.scaleX;
                const ny1 = (top + height) * s.scaleY;

                redactionsArr[idx].rect = [nx0, ny0, nx1, ny1];
                renderRedactions(container, dimensionsObj, redactionsArr);
            };
            
            document.addEventListener('mousemove', mousemove);
            document.addEventListener('mouseup', mouseup);
        });

        box.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            redactionsArr.splice(idx, 1);
            renderRedactions(container, dimensionsObj, redactionsArr);
        });
        
        overlay.appendChild(box);
    });
}

async function doRedactFile(data) {
    const formData = new FormData();
    formData.append('file', data.file);
    formData.append('redactions', JSON.stringify(data.redactions));
    
    const r = await fetch('/api/redact', { method: 'POST', body: formData });
    if (!r.ok) throw new Error("Failed");
    const blob = await r.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = "redacted_" + data.filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
}

document.getElementById('redactBtn').addEventListener('click', async () => {
    const btn = document.getElementById('redactBtn');
    btn.innerText = "Processing...";
    btn.disabled = true;
    try {
        await doRedactFile(filesData[currentFileIdx]);
        btn.innerText = "Downloaded!";
    } catch(e) {
        alert("Error downloading file.");
    }
    setTimeout(() => { btn.innerText = "Confirm & Download Current"; btn.disabled = false; }, 2000);
});

document.getElementById('redactAllBtn').addEventListener('click', async () => {
    const btn = document.getElementById('redactAllBtn');
    btn.innerText = "Processing All...";
    btn.disabled = true;
    try {
        for (const data of filesData) {
            await doRedactFile(data);
        }
        btn.innerText = "All Downloaded!";
    } catch(e) {
        alert("Error downloading files.");
    }
    setTimeout(() => { btn.innerText = "Confirm & Download All"; btn.disabled = false; }, 2000);
});
