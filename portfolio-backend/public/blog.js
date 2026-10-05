const content = document.querySelector('#content');
const message = document.querySelector('#message');
let token = sessionStorage.getItem('blogToken');
let currentPost;
const fields = [
  ['title','Titel','Een concrete titel die vertelt wat de lezer leert.'],
  ['summary','Samenvatting','Vat je inzicht samen in één zin.'],
  ['context','Waar sta ik?','Drie à vier zinnen: opdracht, weekdoel en centrale vraag.'],
  ['process','Wat heb ik gedaan?','Schetsen, testshoots, iteraties en mislukte pogingen. Voeg hieronder voor- en na-afbeeldingen toe.'],
  ['learning','Wat kan een ander hiervan leren?','Werk één bruikbaar inzicht uit met stappen die een medestudent kan toepassen.'],
  ['reflection','Feedback en reflectie','Welke feedback kreeg je? Wat neem je mee en wat leg je bewust naast je neer?'],
  ['aiContribution','Wat deed AI?','Beschrijf de bijdrage van de machine als je AI hebt gebruikt.'],
  ['humanContribution','Wat deed jij?','Beschrijf je eigen keuzes, uitvoering en bewerking.'],
  ['planning','Planning (optioneel)','Eén of twee concrete acties voor volgende week.'],
  ['sources','Bronnen en credits','Links, referenties, gebruikte tools en AI-modellen.']
];
const roles = {before:'Voor',after:'Na',process:'Proces',failed:'Mislukte poging',reference:'Referentie'};
function el(tag,text,parent=content,cls='') { const node=document.createElement(tag); if(text!==undefined) node.textContent=text; if(cls) node.className=cls; parent.append(node); return node; }
function button(text,action,parent=content) { const b=el('button',text,parent); b.type='button'; b.onclick=()=>run(action); return b; }
async function run(action) { message.textContent=''; try { await action(); } catch(error) { message.textContent=error.message; } }
async function api(path='',options={}) {
  const headers={...options.headers};
  if(token) headers.Authorization=`Bearer ${token}`;
  if(options.body && !(options.body instanceof FormData)) {headers['Content-Type']='application/json';options.body=JSON.stringify(options.body);}
  const response=await fetch(`/api/blog${path}`,{...options,headers});
  const data=await response.json();
  if(!response.ok) throw new Error(data.message || 'Aanvraag mislukt.');
  return data;
}
function gallery(post,parent,editable=false) {
  const grid=el('div',undefined,parent,'gallery');
  for(const media of post.media) {
    const fig=el('figure',undefined,grid);
    const image=el(media.type==='video'?'video':'img',undefined,fig);
    image.src=media.url;
    if(media.type==='video') {image.controls=true;image.preload='metadata';} else {image.alt=media.caption || roles[media.role];image.loading='lazy';}
    el('figcaption',`${roles[media.role]}${media.caption ? ' — '+media.caption : ''}${media.credit ? '\nCredit: '+media.credit : ''}`,fig);
    if(editable) button('Verwijderen',async()=>{if(!confirm('Dit bestand verwijderen?'))return; currentPost=await api(`/${post._id}/media/${media._id}`,{method:'DELETE'});fig.remove();},fig);
  }
}
async function listing(page=1) {
  const data=await api(`?page=${page}`); content.replaceChildren();
  el('h1','Van experiment naar inzicht'); el('p','Fotografie, ontwerp en alles wat ik onderweg leer.',content,'summary');
  if(!data.posts.length) el('p','Er zijn nog geen gepubliceerde berichten.');
  for(const post of data.posts) {const card=el('article',undefined,content,'card');const a=el('a',post.title,el('h2',undefined,card));a.href=`#post/${post.slug}`;el('p',post.summary,card);el('small',new Date(post.publishedAt).toLocaleDateString('nl-BE'),card);}
  const actions=el('div',undefined,content,'actions');
  if(page>1) button('Vorige',()=>listing(page-1),actions);
  if(page<data.pages) button('Volgende',()=>listing(page+1),actions);
}
async function read(slug) {
  const post=await api(`/${encodeURIComponent(slug)}`); content.replaceChildren();
  el('a','← Alle berichten').href='#';el('h1',post.title);el('p',post.summary,content,'summary');
  for(const [key,title] of fields.slice(2)) {
    if(!post[key] || (['aiContribution','humanContribution'].includes(key)&&!post.aiUsed))continue;
    const section=el('section',undefined,content,key==='learning'?'learning':'');el('h2',title,section);
    const p=el('p',undefined,section,'body-text');
    // Render plain text safely; only HTTP(S) source links become clickable.
    if(key==='sources') {
      for(const part of post[key].split(/(https?:\/\/[^\s]+)/g)) {if(/^https?:\/\//.test(part)){const a=el('a',part,p);a.href=part;a.target='_blank';a.rel='noopener noreferrer';}else p.append(document.createTextNode(part));}
    }else p.textContent=post[key];
    if(key==='process') gallery(post,section);
  }
}
function login() {
  content.replaceChildren();el('h1','Blog beheren');const form=el('form');
  const emailLabel=el('label','E-mailadres',form);const email=el('input',undefined,emailLabel);email.type='email';email.required=true;email.autocomplete='username';
  const passLabel=el('label','Wachtwoord',form);const password=el('input',undefined,passLabel);password.type='password';password.required=true;password.autocomplete='current-password';
  const submit=el('button','Inloggen',form);submit.type='submit';
  form.onsubmit=event=>{event.preventDefault();run(async()=>{const response=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email.value,password:password.value})});const data=await response.json();if(!response.ok)throw new Error(data.message);token=data.token;sessionStorage.setItem('blogToken',token);await admin();});};
}
async function admin() {
  if(!token)return login(); const posts=await api('/admin');content.replaceChildren();el('h1','Je blogberichten');
  const actions=el('div',undefined,content,'actions');button('Nieuw bericht',async()=>{const title=prompt('Wat is de titel van je bericht?');if(!title?.trim())return;await edit(await api('',{method:'POST',body:{title}}));},actions);
  button('Uitloggen',()=>{token=null;sessionStorage.removeItem('blogToken');login();},actions);
  for(const post of posts){const card=el('article');el('h2',post.title,card);el('small',post.status==='draft'?'Concept':'Gepubliceerd',card);button('Bewerken',async()=>edit(await api(`/admin/${post._id}`)),card);}
}
async function edit(post) {
  currentPost=post;content.replaceChildren();button('← Mijn berichten',()=>{if(confirm('Teruggaan? Niet opgeslagen tekst gaat verloren.'))return admin();});el('h1','Bericht bewerken');
  const form=el('form');const inputs={};
  for(const [key,title,hint] of fields) {const label=el('label',title,form);el('small',hint,label);const input=el(['title','summary'].includes(key)?'input':'textarea',undefined,label);input.value=post[key]||'';inputs[key]=input;}
  const aiLabel=el('label',undefined,form);const ai=el('input',undefined,aiLabel);ai.type='checkbox';ai.checked=post.aiUsed;aiLabel.append(' Ik heb AI gebruikt');
  const actions=el('div',undefined,form,'actions');
  async function save(status) {const body=Object.fromEntries(Object.entries(inputs).map(([key,input])=>[key,input.value]));body.aiUsed=ai.checked;body.status=status;currentPost=await api(`/${post._id}`,{method:'PUT',body});message.textContent=status==='published'?'Bericht gepubliceerd.':'Concept opgeslagen.';}
  button('Concept opslaan',()=>save('draft'),actions);button('Publiceren',()=>save('published'),actions);
  button('Bericht verwijderen',async()=>{if(!confirm('Bericht en alle media definitief verwijderen?'))return;await api(`/${post._id}`,{method:'DELETE'});await admin();},actions).className='danger';
  form.onsubmit=e=>e.preventDefault();
  el('h2','Foto’s en video’s');el('p','Geen limiet op het aantal bestanden per bericht. Uploads gebeuren één voor één; maximaal 100 MB per bestand en binnen je Cloudinary-abonnement. Minstens één voor- en één na-afbeelding zijn verplicht voor publicatie.');
  const mediaBox=el('div');gallery(post,mediaBox,true);
  const roleLabel=el('label','Rol van deze media');const role=el('select',undefined,roleLabel);for(const [value,title] of Object.entries(roles)){const option=el('option',title,role);option.value=value;}
  const captionLabel=el('label','Bijschrift');const caption=el('input',undefined,captionLabel);
  const creditLabel=el('label','Credit / maker');const credit=el('input',undefined,creditLabel);
  const fileLabel=el('label','Bestanden selecteren');const files=el('input',undefined,fileLabel);files.type='file';files.multiple=true;files.accept='image/jpeg,image/png,image/webp,image/gif,image/avif,video/mp4,video/webm,video/quicktime';
  const uploadButton=button('Upload geselecteerde bestanden',async()=>{
    const selected=[...files.files];if(!selected.length)throw new Error('Selecteer eerst bestanden.');uploadButton.disabled=true;
    try {for(let i=0;i<selected.length;i++){const file=selected[i];if(file.size>100*1024*1024)throw new Error(`${file.name} is groter dan 100 MB.`);message.textContent=`Upload ${i+1}/${selected.length}: ${file.name}`;const body=new FormData();body.append('file',file);body.append('role',role.value);body.append('caption',caption.value);body.append('credit',credit.value);currentPost=await api(`/${post._id}/media`,{method:'POST',body});mediaBox.replaceChildren();gallery(currentPost,mediaBox,true);}files.value='';message.textContent='Media opgeslagen. Je tekst kun je hierboven opslaan of publiceren.';}finally{uploadButton.disabled=false;}
  });
}
async function route(){const hash=location.hash.slice(1);if(hash==='admin')return admin();if(hash.startsWith('post/'))return read(hash.slice(5));return listing();}
document.querySelector('#admin').onclick=()=>{if(location.hash==='#admin')run(admin);else location.hash='admin';};
window.addEventListener('hashchange',()=>run(route));run(route);
