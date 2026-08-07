(() => {
  const cfg = window.KATALOG_CONFIG || {};
  const gallery = document.getElementById('gallery');
  const statusBox = document.getElementById('statusBox');
  const emptyState = document.getElementById('emptyState');
  const searchInput = document.getElementById('searchInput');
  const resultText = document.getElementById('resultText');
  const designCount = document.getElementById('designCount');
  const refreshBtn = document.getElementById('refreshBtn');
  const githubBtn = document.getElementById('githubBtn');
  const logoImage = document.getElementById('logoImage');

  const modal = document.getElementById('previewModal');
  const modalImage = document.getElementById('modalImage');
  const modalTitle = document.getElementById('modalTitle');
  const openOriginal = document.getElementById('openOriginal');
  const closeModal = document.getElementById('closeModal');
  const copyName = document.getElementById('copyName');

  let allItems = [];
  const imageExt = /\.(png|jpe?g|webp|gif|avif)$/i;

  logoImage.src = cfg.logo || 'assets/logo-placeholder.svg';
  githubBtn.href = `https://github.com/${cfg.owner}/${cfg.repo}/tree/${cfg.branch}/${cfg.folder}`;

  const prettify = (name) => name
    .replace(/\.[^/.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const kindOf = (name) => {
    const n = name.toLocaleLowerCase('tr-TR');
    if (n.includes('ön') || n.includes('on')) return 'Ön yüz';
    if (n.includes('arka')) return 'Arka yüz';
    return 'Kart tasarımı';
  };

  function showStatus(text, isError = false) {
    statusBox.textContent = text;
    statusBox.classList.toggle('error', isError);
    statusBox.classList.remove('hidden');
  }

  function hideStatus() {
    statusBox.classList.add('hidden');
  }

  function render(items) {
    gallery.innerHTML = '';
    emptyState.classList.toggle('hidden', items.length !== 0);
    resultText.textContent = `${items.length} tasarım gösteriliyor`;

    const frag = document.createDocumentFragment();
    items.forEach((item, i) => {
      const card = document.createElement('article');
      card.className = 'design-card';
      card.style.setProperty('--delay', `${Math.min(i * 35, 350)}ms`);
      card.innerHTML = `
        <button class="image-button" type="button" aria-label="${item.name} tasarımını büyüt">
          <div class="image-frame">
            <img src="${item.download_url}" alt="${item.name}" loading="lazy" decoding="async" />
            <div class="image-overlay"><span>Büyüt</span></div>
          </div>
        </button>
        <div class="card-meta">
          <div>
            <span class="tag">${kindOf(item.name)}</span>
            <h3>${prettify(item.name)}</h3>
          </div>
          <span class="file-ext">${item.name.split('.').pop().toUpperCase()}</span>
        </div>`;
      card.querySelector('.image-button').addEventListener('click', () => openPreview(item));
      frag.appendChild(card);
    });
    gallery.appendChild(frag);
  }

  function applySearch() {
    const q = searchInput.value.trim().toLocaleLowerCase('tr-TR');
    const filtered = !q ? allItems : allItems.filter(x => x.name.toLocaleLowerCase('tr-TR').includes(q));
    render(filtered);
  }

  function openPreview(item) {
    modalImage.src = item.download_url;
    modalTitle.textContent = prettify(item.name);
    openOriginal.href = item.download_url;
    copyName.dataset.name = item.name;
    modal.showModal();
  }

 async function loadCatalog() {
  try {
    const config = window.KATALOG_CONFIG;

    const apiUrl =
      `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${config.folder}?ref=${config.branch}`;

    const response = await fetch(apiUrl, {
      headers: {
        Accept: "application/vnd.github+json"
      }
    });

    if (!response.ok) {
      throw new Error(`GitHub API hatası: ${response.status}`);
    }

    const files = await response.json();

    const images = files.filter(file =>
      file.type === "file" &&
      /\.(png|jpg|jpeg|webp|gif)$/i.test(file.name)
    );

    console.log("Bulunan görseller:", images);

    renderCatalog(images);

  } catch (error) {
    console.error("Katalog yükleme hatası:", error);
  }
}

  searchInput.addEventListener('input', applySearch);
  refreshBtn.addEventListener('click', loadCatalog);
  closeModal.addEventListener('click', () => modal.close());
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.close(); });
  copyName.addEventListener('click', async () => {
    const name = copyName.dataset.name || '';
    try {
      await navigator.clipboard.writeText(name);
      const old = copyName.textContent;
      copyName.textContent = 'Kopyalandı ✓';
      setTimeout(() => copyName.textContent = old, 1300);
    } catch (_) {}
  });

  loadCatalog();
})();
