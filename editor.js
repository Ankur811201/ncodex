const iframe = document.getElementById('iframe');
const container = document.getElementById("showDataEdit");
const saveBtn = document.getElementById("saveBtn");
const downloadBtn = document.getElementById("downloadBtn");
const pageListDiv = document.getElementById("pageList");
const fileName = document.getElementById('filename');
const Elementtarget = document.querySelector('.element-target');
const EditFunDiv = document.querySelector('.edit-funtion');
const loader = document.querySelector('.iframeload');
const progress = document.getElementById('progress');
const steps = document.querySelectorAll('.step');
const afterUpload = document.querySelector('.after-upload');
const beforeUpload =document.querySelector('.before-upload');
const errorUpload =document.querySelector('.error-container');



let fileMap = {}; // path -> File
let blobToPathMap = new Map(); // blobURL -> original path
let cssBlobToPathMap = new Map(); // blobURL -> original path for CSS
let cssBlobToOriginalRefMap = new Map(); // blobURL -> original CSS url(...) reference
let htmlContentMap = {}; // path -> preprocessed HTML content
let savedPages = new Map(); // path -> edited HTML
let currentPagePath = "";
let currentEdits = new Map(); // path -> edited HTML for unsaved changes
let currentTextSelection = null;
let oldTextSelection = null;
let tag = null; // currently selected element for editing


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

//drag and drop function 






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
            cssBlobToOriginalRefMap.set(blobURL, p); // Store the original CSS reference
            return `url(${blobURL})`;
        }
        return match;
    });

    fileMap[path] = new File([text], file.name, {
        type: "text/css"
    });
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
    fileName.innerText = path.substring(path.lastIndexOf("/") + 1);

    currentPagePath = path;
    const html = currentEdits.get(path) || htmlContentMap[path];
    if (!html) return;
    iframe.srcdoc = html;

    iframe.onload = () => {
        const doc = iframe.contentDocument || iframe.contentWindow.document;


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
            Elementtarget.innerHTML = parent.tagName.toLowerCase() + ' | ' + (parent.className || 'no-class') + ' | ' + (parent.id || 'no-id');
           
            // Collect images and backgrounds
            const elements = collectElements(parent, doc);
            let textNodes = getTextNodes(parent);



            if (textNodes.length === 0 && elements.length != 0) {

                EditFunDiv.querySelector('.img').click();

            } else if(textNodes.length != 0 && elements.length === 0) {
                EditFunDiv.querySelector('.text').click();


            }

            elements.forEach(({
                el,
                src,
                type
            }) => {
                createImageEditor(el, src, type, showImg, doc);
            });

            // Handle text editing
            getTextNodes(parent).forEach((tn, index) => {
                const div = document.createElement('div');
                div.className = 'textarea-box';
                const checkbox = document.createElement('input');
                checkbox.type = 'radio';
                checkbox.name = 'edit-type';
                checkbox.style= 'display:none';
                checkDownloadStatus();


                checkbox.addEventListener('change', () => {

                  tag = tn.parentNode; // target element

                    if (checkbox.checked) {
                        // Restore previous selection if any
                        if (currentTextSelection && oldTextSelection !== null) {
                            currentTextSelection.style.outline = oldTextSelection;
                        }
                        sendElement(tag);

                        // Store current selection and its old style
                        currentTextSelection = tag;
                        oldTextSelection = tag.style.outline;

                        // Apply new style
                        tag.style.outline = '2px solid blue';
                        
                       
                        


                    } else {
                        // When deselected, restore old style
                        if (currentTextSelection === tag && oldTextSelection !== null) {
                            tag.style.outline = oldTextSelection;
                            console.log('Radio unchecked, style restored.');
                        }
                    }




                });




                const input = document.createElement('textarea');
                input.value = tn.textContent.replace(/\s+/g, ' ').trim();
                input.addEventListener('input', () => {
                    tn.textContent = input.value;
                    currentEdits.set(currentPagePath, doc.documentElement.outerHTML);
                    checkDownloadStatus();
                });
               input.addEventListener('focus', () => {
                if( !checkbox.checked){
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));
                }
});


                if (textNodes.length === 1) {
                    
                    checkbox.dispatchEvent(new Event('change'));
                    setTimeout(() => input.focus(), 0);
                }


                div.appendChild(input);
                div.appendChild(checkbox);
                container.appendChild(div);
            });
        };

        doc.body.addEventListener('click', doc.body._clickHandler);

        // Navigation links
        doc.querySelectorAll("a").forEach(a => {
            a.addEventListener("click", e => {
                e.preventDefault();

                
            });
        });
    };

    function collectElements(parent, doc) {
        const list = [];
        const style = getComputedStyle(parent);
        if (parent.tagName.toLowerCase() === 'img') {
            list.push({
                el: parent,
                src: parent.src,
                type: 'img'
            });
        }
        if (style.backgroundImage && style.backgroundImage !== 'none') {
            const url = style.backgroundImage.slice(4, -1).replace(/["']/g, '');
            list.push({
                el: parent,
                src: url,
                type: 'background'
            });
        }
        if (!list.length) {
            parent.querySelectorAll('img').forEach(img => {
                list.push({
                    el: img,
                    src: img.src,
                    type: 'img'
                });
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
        input.style.display = 'none';
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









// Check if all edits are saved
function checkDownloadStatus() {
    const allPages = Object.keys(htmlContentMap);
    const allSaved = allPages.every(path =>
        !currentEdits.has(path) || savedPages.has(path)
    );

}
function upload() {
    document.getElementById('folderInput').click();
}

// Folder upload handler
document.getElementById("folderInput").addEventListener("change", async (e) => {
    afterUpload.style.display = 'block';
    beforeUpload.style.display = "none"
    loader.style.display = 'flex';
     errorUpload.style.display = "none";
     iframe.srcdoc = '';

     downloadBtn.style.display= 'flex-inline';
     




    progress.style.width = '0%';
    steps.forEach(s => s.classList.remove('active'));
    let index = 0;
    steps[index].classList.add('active');

    let progressValue = 100;
    const interval = setInterval(() => {
        // Update progress bar

        if (progressValue > 100) progressValue = 100;
        progress.style.width = progressValue + '%';

        // Update steps
        steps[index].classList.remove('active');
        index++;
        if (index < steps.length) {
            steps[index].classList.add('active');
        } else {
            clearInterval(interval);
            

        }
    }, 1000);

    const files = e.target.files;
    for (let file of files) fileMap[file.webkitRelativePath] = file;

    for (let path in fileMap)
        if (path.endsWith(".css")) await processCSS(path);
    for (let path in fileMap)
        if (path.endsWith(".html")) await processHTML(path);
    const htmlFiles = Object.keys(htmlContentMap);
   
       
    pageListDiv.innerHTML = "";
    Object.keys(htmlContentMap).forEach(p => {
        const btn = document.createElement('div');
        btn.textContent = p.substring(p.lastIndexOf("/") + 1);
        btn.addEventListener('click', function() {
            saveBtn.click();
            document.querySelectorAll('#pageList > div').forEach(d => d.classList.remove('activeFile'));
            this.classList.add('activeFile');
            loadHTML(p);
            




        });


        pageListDiv.appendChild(btn);
    });

    const indexFile = Object.keys(fileMap).find(f => f.toLowerCase().endsWith("index.html"));
    if (indexFile) loadHTML(indexFile);

     if (htmlFiles.length === 0) {
         
    setTimeout(() => {
         afterUpload.style.display = 'none';
    errorUpload.style.display = "block";
    
}, 1000);


    }

});

iframe.addEventListener('load', () => {
    setTimeout(() => {
        loader.style.display = 'none';
    }, 4000); 
});

// Save button handler
saveBtn.addEventListener("click", () => {
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    const editedHTML = doc.documentElement.outerHTML;
    savedPages.set(currentPagePath, editedHTML);
    console.log(currentPagePath + " saved successfully!");
    checkDownloadStatus();

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
            html = html.replace(/url\((['"]?)(blob:[^)'" ]+)\1\)/g, (match, quote, blobUrl) => {
                const orig = cssBlobToPathMap.get(blobUrl);
                const newUrl = orig ? orig.slice(rootFolderName.length + 1) : blobUrl;
                return `url(${newUrl})`;
            });
            subFolder.file(parts[parts.length - 1], html);
        } else if (path.endsWith('.css')) {
            let text = await fileMap[path].text();
            text = text.replace(/url\((['"]?)(blob:[^)'" ]+)\1\)/g, (match, quote, blobUrl) => {
                // Use the original CSS reference if available
                const origRef = cssBlobToOriginalRefMap.get(blobUrl);
                return origRef ? `url(${origRef})` : match;
            });
            subFolder.file(parts[parts.length - 1], text);
        } else {
            subFolder.file(parts[parts.length - 1], fileMap[path]);
        }
    }

    const content = await zip.generateAsync({
        type: "blob"
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(content);
    a.download = "website.zip";
    a.click();

        let btn = document.getElementById('downloadBtn');
            let btnText = document.getElementById('btnText');
            let progressBar = document.getElementById('progressBar');

            // Add downloading state
            btn.classList.add('downloading');
            btnText.textContent = 'Downloading...';

            // Simulate download progress
            let progress = 0;
            const interval = setInterval(() => {
                progress += Math.random() * 15;
                if (progress > 100) progress = 100;
                
                progressBar.style.width = progress + '%';

                if (progress >= 100) {
                    clearInterval(interval);
                    
                    // Show completion state
                    btnText.textContent = 'Downloaded!';
                    
                    setTimeout(() => {
                        // Reset button
                        btn.classList.remove('downloading');
                        btnText.textContent = 'Download ZIP';
                        progressBar.style.width = '0%';
                    }, 2000);
                }
            }, 100);
});