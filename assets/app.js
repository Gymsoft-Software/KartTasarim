const config = window.KATALOG_CONFIG;

const gallery = document.getElementById("gallery");
const statusBox = document.getElementById("statusBox");
const resultText = document.getElementById("resultText");
const searchInput = document.getElementById("searchInput");
const refreshBtn = document.getElementById("refreshBtn");
const githubBtn = document.getElementById("githubBtn");
const emptyState = document.getElementById("emptyState");
const designCount = document.getElementById("designCount");

let allImages = [];


/* =========================
   GITHUB KLASÖRÜNÜ YÜKLE
========================= */

async function loadCatalog() {

    if (statusBox) {
        statusBox.classList.remove("hidden");
        statusBox.textContent = "GitHub klasörü kontrol ediliyor…";
    }

    if (resultText) {
        resultText.textContent = "Tasarımlar yükleniyor…";
    }

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
            /\.(png|jpg|jpeg|webp|gif|avif)$/i.test(file.name)
        );

        console.log("Bulunan görseller:", allImages);

        renderCatalog(allImages);

        if (designCount) {
            designCount.textContent = allImages.length;
        }

        if (resultText) {
            resultText.textContent =
                `${allImages.length} tasarım gösteriliyor`;
        }

        if (statusBox) {
            statusBox.classList.add("hidden");
        }

    } catch (error) {

        console.error("Katalog yükleme hatası:", error);

        if (resultText) {
            resultText.textContent = "Katalog yüklenemedi";
        }

        if (statusBox) {
            statusBox.classList.remove("hidden");
            statusBox.innerHTML = `
                <strong>Katalog yüklenemedi.</strong><br>
                ${error.message}
            `;
        }
    }
}


/* =========================
   KARTLARI OLUŞTUR
========================= */

function renderCatalog(images) {

    if (!gallery) {
        console.error("#gallery bulunamadı.");
        return;
    }

    gallery.innerHTML = "";

    if (images.length === 0) {

        if (emptyState) {
            emptyState.classList.remove("hidden");
        }

        return;
    }

    if (emptyState) {
        emptyState.classList.add("hidden");
    }

    images.forEach((file, index) => {

        const card = document.createElement("article");
        card.className = "card";

        const imageWrap = document.createElement("div");
        imageWrap.className = "card-image";

        const img = document.createElement("img");

        /*
         * ÖNEMLİ:
         * URL'yi kendimiz oluşturmuyoruz.
         * GitHub'ın verdiği download_url kullanılıyor.
         */
        img.src = file.download_url;

        img.alt = file.name;
        img.loading = "lazy";
        img.decoding = "async";

        img.addEventListener("error", () => {
            console.error("Görsel yüklenemedi:", file.download_url);
        });

        imageWrap.appendChild(img);


        /* DOSYA BİLGİSİ */

        const body = document.createElement("div");
        body.className = "card-body";

        const number = document.createElement("span");
        number.className = "card-number";
        number.textContent =
            String(index + 1).padStart(2, "0");

        const title = document.createElement("h3");
        title.className = "card-title";
        title.textContent =
            file.name.replace(/\.[^/.]+$/, "");

        const filename = document.createElement("div");
        filename.className = "card-filename";
        filename.textContent = file.name;

        body.appendChild(number);
        body.appendChild(title);
        body.appendChild(filename);


        /* KARTA TIKLANDIĞINDA */

        card.addEventListener("click", () => {
            window.open(file.download_url, "_blank");
        });


        card.appendChild(imageWrap);
        card.appendChild(body);

        gallery.appendChild(card);
    });
}


/* =========================
   ARAMA
========================= */

if (searchInput) {

    searchInput.addEventListener("input", function () {

        const search =
            this.value
                .toLocaleLowerCase("tr-TR")
                .trim();

        const filteredImages =
            allImages.filter(file =>
                file.name
                    .toLocaleLowerCase("tr-TR")
                    .includes(search)
            );

        renderCatalog(filteredImages);

        if (resultText) {

            if (search === "") {

                resultText.textContent =
                    `${allImages.length} tasarım gösteriliyor`;

            } else {

                resultText.textContent =
                    `${filteredImages.length} sonuç bulundu`;
            }
        }
    });
}


/* =========================
   YENİLE BUTONU
========================= */

if (refreshBtn) {

    refreshBtn.addEventListener("click", () => {

        refreshBtn.disabled = true;

        refreshBtn.innerHTML =
            `<span class="icon">↻</span> Yükleniyor`;

        loadCatalog().finally(() => {

            refreshBtn.disabled = false;

            refreshBtn.innerHTML =
                `<span class="icon">↻</span> Yenile`;
        });
    });
}


/* =========================
   GITHUB KLASÖR BUTONU
========================= */

if (githubBtn) {

    githubBtn.href =
        `https://github.com/${config.owner}/${config.repo}/tree/${config.branch}/${config.folder}`;
}


/* =========================
   LOGO
========================= */

const logoImage =
    document.querySelector("[data-site-logo]");

if (logoImage && config.logo) {
    logoImage.src = config.logo;
}


/* =========================
   SAYFA AÇILINCA
========================= */

loadCatalog();
