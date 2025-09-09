const iframe = document.getElementById('iframe');
const container = document.getElementById("showDataEdit");
const saveBtn = document.getElementById("saveBtn");
const downloadBtn = document.getElementById("downloadBtn");
const pageListDiv = document.getElementById("pageList");
const fileName =document.getElementById('filename');

let fileMap = {}; // path -> File
let blobToPathMap = new Map(); // blobURL -> original path
let cssBlobToPathMap = new Map(); // blobURL -> original path for CSS
let htmlContentMap = {}; // path -> preprocessed HTML content
let savedPages = new Map(); // path -> edited HTML
let currentPagePath = "";
let currentEdits = new Map(); // path -> edited HTML for unsaved changes

    const themeToggle = document.getElementById('theme-toggle');
    const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)').matches;

    const currentTheme = localStorage.getItem('theme');
    if (currentTheme) {
      document.documentElement.setAttribute('data-theme', currentTheme);
    } else if (prefersDarkScheme) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }

    themeToggle.addEventListener('click', () => {
      let theme = document.documentElement.getAttribute('data-theme');
      if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'light');
        localStorage.setItem('theme', 'light');
      } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
      }
    });




// Normalize paths for matching
function normalizePath(path) {
    return path.replace(/^\.\/|^\.\.\//, '');
}

// Replace file with blob URL and store mapping
function replaceWithBlobURL(filePath) {
    const file = fileMap[filePath];
    if (!file) return null;
    const blobURL = URL.createObjectURL(file);
    blobToPathMap.set(blobURL, filePath);
    return blobURL;
}

// Process CSS files
async function processCSS(path) {
    const file = fileMap[path];
    let text = await file.text();

    text = text.replace(/url\(["']?([^)"']+)["']?\)/g, (match, p) => {
        if (/^(https?:)?\/\//i.test(p)) return match;
        const cleanPath = normalizePath(p);
        const key = Object.keys(fileMap).find(k => normalizePath(k).endsWith(cleanPath));
        if (key) {
            const blobURL = replaceWithBlobURL(key);
            cssBlobToPathMap.set(blobURL, key);
            return `url(${blobURL})`;
        }
        return match;
    });

    fileMap[path] = new File([text], file.name, { type: "text/css" });
}

// Process HTML files
async function processHTML(path) {
    const file = fileMap[path];
    let html = await file.text();

    html = html.replace(/(src|href)=["']([^"']+)["']/gi, (match, attr, url) => {
        if (/^(https?:)?\/\//i.test(url)) return match;
        const key = Object.keys(fileMap).find(k => normalizePath(k).endsWith(normalizePath(url)));
        if (key) return `${attr}="${replaceWithBlobURL(key)}"`;
        return match;
    });

    html = html.replace(/<a\s+[^>]*href=["']([^"']+)["']/gi, (match, href) => {
        if (/^(https?:)?\/\//i.test(href)) return match;
        const key = Object.keys(fileMap).find(k => normalizePath(k).endsWith(normalizePath(href)));
        if (key) return match + ` data-relpath="${href}"`;
        return match;
    });

    htmlContentMap[path] = html;
}

// Load HTML in iframe
function loadHTML(path) {
    fileName.innerText= path.substring(path.lastIndexOf("/") + 1);

    currentPagePath = path;
    const html = currentEdits.get(path) || htmlContentMap[path];
    if (!html) return;
    iframe.srcdoc = html;

    iframe.onload = () => {
        const doc = iframe.contentDocument || iframe.contentWindow.document;
        saveBtn.click();

        // Clear old handler
        if (doc.body._clickHandler) {
            doc.body.removeEventListener('click', doc.body._clickHandler);
        }

        doc.body._clickHandler = e => {
            e.stopPropagation();
            const parent = e.target;
            const showImg = document.getElementById('showimg');
            showImg.innerHTML = "";
            container.innerHTML = "";

            // Collect images and backgrounds
            const elements = collectElements(parent, doc);

            elements.forEach(({ el, src, type }) => {
                createImageEditor(el, src, type, showImg, doc);
            });

            // Handle text editing
            getTextNodes(parent).forEach(tn => {
                const input = document.createElement('textarea');
                input.value = tn.textContent.replace(/\s+/g, ' ').trim();
                input.addEventListener('input', () => {
                    tn.textContent = input.value;
                    currentEdits.set(currentPagePath, doc.documentElement.outerHTML);
                    checkDownloadStatus();
                });
                container.appendChild(input);
            });
        };

        doc.body.addEventListener('click', doc.body._clickHandler);

        // Navigation links
        doc.querySelectorAll("a").forEach(a => {
            a.addEventListener("click", e => {
                 e.preventDefault();

                // const rel = a.getAttribute("data-relpath");
                // if (!rel) return;
                // e.preventDefault();
                // const key = Object.keys(fileMap).find(k => normalizePath(k).endsWith(normalizePath(rel)));
                // if (key) {
                //     currentEdits.set(currentPagePath, doc.documentElement.outerHTML);
                //     loadHTML(key);
                // }
            });
        });
    };

    function collectElements(parent, doc) {
        const list = [];
        const style = getComputedStyle(parent);
        if (parent.tagName.toLowerCase() === 'img') {
            list.push({ el: parent, src: parent.src, type: 'img' });
        }
        if (style.backgroundImage && style.backgroundImage !== 'none') {
            const url = style.backgroundImage.slice(4, -1).replace(/["']/g, '');
            list.push({ el: parent, src: url, type: 'background' });
        }
        if (!list.length) {
            parent.querySelectorAll('img').forEach(img => {
                list.push({ el: img, src: img.src, type: 'img' });
            });
        }
        return list;
    }

    function createImageEditor(el, src, type, container, doc) {
       

        const preview = document.createElement('img');
        preview.src = src;
        preview.style.cssText = 'max-width:100px;margin:5px;border:1px solid #272727ff;';

        preview.addEventListener('click', () => {
        input.click(); // Opens file chooser
        });

        const input = document.createElement('input');
        input.type = 'file';
        input.style.display='none';
        input.accept = 'image/*';
        input.addEventListener('change', ev => {
            const file = ev.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = event => {
                    const dataUrl = event.target.result;
                    preview.src = dataUrl;
                    if (type === 'img') el.src = dataUrl;
                    else el.style.backgroundImage = `url("${dataUrl}")`;
                    currentEdits.set(currentPagePath, doc.documentElement.outerHTML);
                    checkDownloadStatus();
                };
                reader.readAsDataURL(file);
            }
        });

        
        container.appendChild(preview);
    }

    function getTextNodes(node) {
        let nodes = [];
        node.childNodes.forEach(n => {
            if (n.nodeType === Node.TEXT_NODE && n.textContent.trim() !== "") nodes.push(n);
            else if (n.nodeType === Node.ELEMENT_NODE) nodes = nodes.concat(getTextNodes(n));
        });
        return nodes;
    }
}


function editfun(a,b,el){
    document.getElementById(b).style.display='none';
    document.getElementById(a).style.display='grid';
    document.querySelector('.text').classList.remove('active');
    document.querySelector('.img').classList.remove('active');
    el.classList.add('active');
    
    
    


}
















// Check if all edits are saved
function checkDownloadStatus() {
    const allPages = Object.keys(htmlContentMap);
    const allSaved = allPages.every(path =>
        !currentEdits.has(path) || savedPages.has(path)
    );
    
}

// Folder upload handler
document.getElementById("folderInput").addEventListener("change", async (e) => {
  
    const files = e.target.files;
    for (let file of files) fileMap[file.webkitRelativePath] = file;

    for (let path in fileMap) if (path.endsWith(".css")) await processCSS(path);
    for (let path in fileMap) if (path.endsWith(".html")) await processHTML(path);

    pageListDiv.innerHTML = "";
    Object.keys(htmlContentMap).forEach(p => {
        const btn = document.createElement('div');
        btn.textContent = p.substring(p.lastIndexOf("/") + 1);
     btn.addEventListener('click', function() {
    document.querySelectorAll('#pageList > div').forEach(d => d.classList.remove('activeFile'));
    this.classList.add('activeFile');
    loadHTML(p);
});


        pageListDiv.appendChild(btn);
    });

    const indexFile = Object.keys(fileMap).find(f => f.toLowerCase().endsWith("index.html"));
    if (indexFile) loadHTML(indexFile);
    
});

// Save button handler
saveBtn.addEventListener("click", () => {
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    const editedHTML = doc.documentElement.outerHTML;
    savedPages.set(currentPagePath, editedHTML);
    alert(currentPagePath + " saved successfully!");
    
});

// Download button handler
downloadBtn.addEventListener("click", async () => {
    saveBtn.click();
    const zip = new JSZip();
    const rootFolderName = Object.keys(fileMap)[0].split("/")[0] || "website";
    const folder = zip.folder(rootFolderName);

    for (let path in fileMap) {
        const relativePath = path.slice(rootFolderName.length + 1);
        const parts = relativePath.split("/");

        let subFolder = folder;
        for (let i = 0; i < parts.length - 1; i++) subFolder = subFolder.folder(parts[i]);

        if (savedPages.has(path)) {
            let html = savedPages.get(path);
            html = html.replace(/blob:[^'"]+/g, match => {
                const originalPath = blobToPathMap.get(match);
                if (!originalPath) return match;
                return originalPath.slice(rootFolderName.length + 1);
            });
            html = html.replace(/url\((blob:[^)]+)\)/g, (m, b) => {
                const orig = cssBlobToPathMap.get(b);
                return `url(${orig ? orig.slice(rootFolderName.length + 1) : b})`;
            });
            subFolder.file(parts[parts.length - 1], html);
        } else {
            subFolder.file(parts[parts.length - 1], fileMap[path]);
        }
    }

    const content = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(content);
    a.download = "website.zip";
    a.click();
});
