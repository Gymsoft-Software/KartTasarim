import { client, configured, isAdmin } from '../../Destek/src/repository.js';

const $ = id => document.getElementById(id);
let loaded = false;
let revision = 0;
function lock(message = '') {
  window.GYMSOFT_MANAGER_AUTHENTICATED = false;
  document.body.classList.add('manager-locked');
  $('managerLoginGate').classList.remove('hidden');
  $('managerLoginStatus').textContent = message;
}
async function acceptSession(session) {
  const current = ++revision;
  lock(session ? 'Yönetici yetkisi kontrol ediliyor…' : '');
  if (!session) return;
  try {
    const { error } = await client.auth.getUser();
    if (error) throw error;
    const allowed = await isAdmin();
    if (current !== revision) return;
    if (!allowed) { lock('Bu hesap için yönetici yetkisi bulunmuyor. Yardım Merkezi yönetici hesabınızı kullanın.'); return; }
    window.GYMSOFT_MANAGER_AUTHENTICATED = true;
    if (!loaded) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = './app.js';
        script.onload = resolve;
        script.onerror = () => { script.remove(); reject(new Error('Panel yüklenemedi. Sayfayı yenileyin.')); };
        document.body.appendChild(script);
      });
      loaded = true;
    }
    if (current !== revision) return;
    document.body.classList.remove('manager-locked');
    $('managerLoginGate').classList.add('hidden');
    $('managerPassword').value = '';
  } catch {
    if (current === revision) lock('Oturum veya yönetici yetkisi doğrulanamadı. Bağlantınızı kontrol edip tekrar giriş yapın.');
  }
}

$('managerLoginForm').addEventListener('submit', async event => {
  event.preventDefault();
  $('managerLoginBtn').disabled = true;
  lock('Giriş yapılıyor…');
  try {
    const { data, error } = await client.auth.signInWithPassword({
      email: $('managerEmail').value.trim(), password: $('managerPassword').value,
    });
    if (error) throw error;
    await acceptSession(data.session);
  } catch {
    lock('Giriş yapılamadı. E-posta, parola ve internet bağlantınızı kontrol edin.');
  } finally { $('managerLoginBtn').disabled = false; }
});
$('managerLogoutBtn').addEventListener('click', async () => {
  ++revision;
  lock('Oturum kapatılıyor…');
  const { error } = await client.auth.signOut({ scope: 'local' });
  if (error) { lock('Oturum kapatılamadı. Sayfayı yenileyip tekrar deneyin.'); return; }
  location.reload();
});

if (!configured) {
  lock('Giriş yapılandırması eksik. Yardım Merkezi Supabase ayarlarını kontrol edin.');
} else {
  client.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') { ++revision; lock(); if (loaded) location.reload(); }
    if (event === 'TOKEN_REFRESHED') setTimeout(() => acceptSession(session), 0);
  });
  try {
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    await acceptSession(data.session);
  } catch { lock('Oturum okunamadı. Tekrar giriş yapın.'); }
  $('managerLoginBtn').disabled = false;
}
