const config = window.KATALOG_CONFIG;

const grid = document.getElementById("catalogGrid");
const count = document.getElementById("designCount");
const statusText = document.getElementById("statusText");
const searchInput = document.getElementById("searchInput");

let allImages = [];

async function loadCatalog() {
    try {
        const apiUrl =
            `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${config.folder}?ref=${config.branch}`;

        console.log("GitHub API:", apiUrl);

        const response = await fetch(apiUrl, {
            headers: {
                Accept: "application/vnd.github+json"
            }
        });

        if (!response.ok) {
            throw new Error(`GitHub API hatası: ${response.status}`);
        }

        const files = await response.json();

        allImages = files.filter(file =>
            file.type === "file" &&
            /\.(png|jpg|jpeg|webp|gif)$/i.test(file.name)
        );

        console.log("Bulunan görseller:", allImages);

        renderCatalog(allImages);

        if (count) {
            count.textContent = allImages.length;
        }

        if (statusText) {
            statusText.textContent = `${allImages.length} tasarım yüklendi`;
        }

    } catch (error) {
        console.error("Katalog yükleme hatası:", error);

        if (statusText) {
            statusText.textContent = "Katalog yüklenemedi";
        }

        if (grid) {
            grid.innerHTML = `
                <div style="
                    padding:20px;
                    border:1px solid #ff5555;
                    border-radius:12px;
                    color:#ff9999;
                ">
                    Katalog yüklenemedi.<br>
                    ${error.message}
                </div>
            `;
        }
    }
}

function renderCatalog(images) {

    if (!grid) {
        console.error("catalogGrid bulunamadı.");
        return;
    }

    grid.innerHTML = "";

    images.forEach(file => {

        const card = document.createElement("div");
        card.className = "catalog-card";

        const img = document.createElement("img");

        // EN ÖNEMLİ KISIM
        img.src = file.download_url;

        img.alt = file.name;
        img.loading = "lazy";

        const title = document.createElement("div");
        title.className = "catalog-title";
        title.textContent = file.name;

        card.appendChild(img);
        card.appendChild(title);

        card.addEventListener("click", () => {
            window.open(file.download_url, "_blank");
        });

        grid.appendChild(card);
    });
}

if (searchInput) {
    searchInput.addEventListener("input", function () {

        const value = this.value.toLowerCase().trim();

        const filtered = allImages.filter(file =>
            file.name.toLowerCase().includes(value)
        );

        renderCatalog(filtered);
    });
}

loadCatalog();
