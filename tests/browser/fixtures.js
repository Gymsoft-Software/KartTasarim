const uid = '11111111-1111-4111-8111-111111111111';
const categoryId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
export const publicId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const mockOrigin = 'https://support-test.supabase.co';
const imagePath = `${publicId}/dddddddd-dddd-4ddd-8ddd-dddddddddddd.png`;
export const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8GQAAAAASUVORK5CYII=', 'base64');
export async function mockBackend(page, { admin = true, fail = false } = {}) {
  const state = {
    categories: [{id:categoryId,name:'Hesap & Kullanıcı',description:'Hesap ayarları'},{id:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',name:'Kurulum & Başlangıç',description:''}],
    articles: [
      {id:publicId,title:'Kullanıcı adı ve şifre nasıl değiştirilir?',slug:'kullanici-adi-ve-sifre',summary:'Hesap bilgilerinizi adım adım güncelleyin.',category_id:categoryId,tags:['şifre','kullanıcı'],status:'published',pinned:true,youtube_url:'https://youtu.be/abcdefghijk',content_text:'Hesap ayarlarını açın. Bilgilerinizi kaydedin.',content_delta:{ops:[{insert:'Hesap ayarlarını açın.\n'}]},content_html:`<h2>1. Hesap ayarlarını açın</h2><p><strong>Kullanıcı</strong> sayfasını açın.</p><img src="${mockOrigin}/storage/v1/object/authenticated/support-media/${imagePath}" alt="Hesap ayarları"><h2>2. Değişiklikleri kaydedin</h2><p>Ayarlarınızı kontrol edin.</p>`,revision:1,created_at:'2026-09-01T12:00:00Z',updated_at:'2026-09-10T12:00:00Z',published_at:'2026-09-10T12:00:00Z'},
      {id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',title:'Kart okuyucu kurulumu',slug:'kart-okuyucu',summary:'Cihazınızı kullanmaya başlayın.',category_id:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',tags:['kart'],status:'published',pinned:false,youtube_url:'',content_text:'Kurulum adımları.',content_delta:{ops:[{insert:'Kurulum adımları.\n'}]},content_html:'<h2>Kurulum</h2><p>Adımları takip edin.</p>',revision:1,created_at:'2026-09-01T12:00:00Z',updated_at:'2026-09-11T12:00:00Z',published_at:'2026-09-11T12:00:00Z'},
      {id:'ffffffff-ffff-4fff-8fff-ffffffffffff',title:'Gizli taslak',slug:'gizli-taslak',summary:'Yalnızca yönetici',category_id:categoryId,tags:[],status:'draft',pinned:false,youtube_url:'',content_text:'Taslak metin.',content_delta:{ops:[{insert:'Taslak metin.\n'}]},content_html:'<p>Taslak metin.</p>',revision:1,created_at:'2026-09-01T12:00:00Z',updated_at:'2026-09-11T12:00:00Z',published_at:null},
    ], uploaded:[],
  };
  await page.route('**/Destek/config.js', route => route.fulfill({contentType:'text/javascript',body:`window.SUPPORT_CONFIG={supabaseUrl:'${mockOrigin}',supabasePublishableKey:'sb_publishable_test'};`}));
  await page.route('https://www.youtube-nocookie.com/**', route => route.fulfill({contentType:'text/html',body:'<!doctype html><html><body style="background:#111;color:#fff;font-family:Arial;text-align:center;padding:20px">Video anlatım</body></html>'}));
  await page.route(`${mockOrigin}/**`, async route => {
    const req = route.request(), url = new URL(req.url()), method = req.method();
    const reply = (body, status = 200) => route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
    if (fail) return reply({message:'Unavailable'},503);
    if (url.pathname.includes('/auth/v1/token')) {
      const user = {id:uid,email:'owner@example.com',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
      const payload = Buffer.from(JSON.stringify({sub:uid,role:'authenticated',aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');
      return reply({access_token:`eyJhbGciOiJIUzI1NiJ9.${payload}.test`,refresh_token:'test-refresh',token_type:'bearer',expires_in:3600,user});
    }
    if (url.pathname.includes('/auth/v1/logout')) return reply({});
    if (url.pathname.includes('/auth/v1/user')) return reply({id:uid,email:'owner@example.com'});
    if (url.pathname.includes('/rpc/support_is_admin')) return reply(admin);
    if (method === 'POST' && url.pathname.includes('/storage/v1/object/sign/support-media')) {
      const body = req.postDataJSON();
      return reply(body.paths.map(path => ({path,signedURL:`/object/sign/support-media/${path}?token=test`})));
    }
    if (url.pathname.includes('/storage/v1/object/list/')) return reply([]);
    if (url.pathname.includes('/storage/v1/object/')) {
      if (method === 'GET') return route.fulfill({contentType:'image/png',body:tinyPng});
      if (method === 'POST') state.uploaded.push(url.pathname);
      return reply({Key:url.pathname.split('/object/')[1],Id:'test-image'});
    }
    const table = url.pathname.endsWith('/support_categories') ? 'categories' : url.pathname.endsWith('/support_articles') ? 'articles' : null;
    if (!table) return reply({message:`Unexpected ${method} ${url.pathname}`},404);
    const matches = item => [...url.searchParams].every(([key, value]) => !value.startsWith('eq.') || String(item[key]) === value.slice(3));
    if (method === 'GET') {
      const rows = state[table].filter(matches);
      return reply(req.headers().accept?.includes('vnd.pgrst.object') ? rows[0] : rows);
    }
    if (method === 'POST') {
      const body = req.postDataJSON();
      const item = {...body,id:body.id || crypto.randomUUID(),revision:1,created_at:new Date().toISOString(),updated_at:new Date().toISOString(),published_at:body.status==='published'?new Date().toISOString():null};
      state[table].push(item); return reply(item,201);
    }
    if (method === 'PATCH') {
      const item = state[table].find(matches);
      if (!item) return reply(null);
      Object.assign(item,req.postDataJSON(),{revision:item.revision+1,updated_at:new Date().toISOString()}); return reply(item);
    }
    if (method === 'DELETE') {
      const removed = state[table].filter(matches); state[table] = state[table].filter(x => !matches(x)); return reply(removed);
    }
    return reply({});
  });
  return state;
}
export async function login(page) {
  await page.goto('/Destek/admin.html');
  await page.getByLabel('E-posta', {exact:true}).fill('owner@example.com');
  await page.getByLabel('Parola', {exact:true}).fill('test-password-for-fixture');
  await page.getByRole('button',{name:'Giriş yap →',exact:true}).click();
}
