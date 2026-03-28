(function(){
let threadsData=[];
let nextThreadId=1;
let nextPostId=1;
let isSyncing=false;
let lastLoadTime=0;
let cacheData=null;
let allThreadsCache=[];

const GIST_ID='769dce8a044d2d8dc2b21a2f60719c58';
const CACHE_TIME=5000;

function decodeToken(encoded,times){
    let result=encoded;
    for(let i=0;i<times;i++)result=atob(result);
    return result;
}

const ENCRYPTED_TOKEN='Vm0wd2QyVkhVWGhVV0d4V1YwZG9WbFl3WkRSV1ZsbDNXa1JTVjAxV2JETlhhMk0xWVVaS2MxTnNXbFpOYm1oUVdWWlZlRll4WkhGUmJVWlRWbXhzTTFadGNFZFpWMDE1Vkd0c2FsSnRVbkJXTUdSdllqRmFjbHBFVWxSTmJFcEpWbGQwVjFadFNraFZiR2hWVmtWd2RsWldXbXRXTVd0NllVWlNUbFpYZHpGV2EyUXdZekpHVjFOdVVsWmhlbXhoVm1wT2IyRkdjRmRYYlhSWVVqRktTVnBGV2s5aFZscHpZMFZ3VjJFeVVYZFpWRXBIVmpGT2RWWnNTbWxoZWxab1ZtcENiMUV4WkVkalJtUllZbFZhV0ZSV1dtRmxWbkJHVjJ4a1ZXSlZXVEpXYlhoelZqRmFObEZZYUZkU1JYQklWbXBHVDJNeFduUmlSbEpUVmxoQ2IxWnRNVEJXTVd4WVZtNU9WbUpHV2xSWmEyaERZekZhY1ZGVVJsTk5WMUo1VmpKNFQxWlhTbFpXYWxaaFUwaENTRlpxU2tabFZsWlZVV3hrYUdFeGNGaFhiRnBoVkRKU1YxWnVUbGhpVjNodldsZDRZV0l4V25STldHUlZUVlpXTkZaWGRHdFhSbVJJWlVoT1ZrMUdXak5aZWtaell6RmFWVkpzVGs1V2Exa3dWakowYjJFeVJrZFhia3BxVW0xb1lWUlZXbmRXUmxweFVtMUdWMDFyTlVoV1J6RkhWVEZLVjJORlZsZGlSMUV3VlZSR1lWWnJNVlpXYXpWVFVrVkZOUT09';
const GITHUB_TOKEN=decodeToken(ENCRYPTED_TOKEN,10);

const GIST_URL=`https://api.github.com/gists/${GIST_ID}`;
const GIST_RAW_URL=`https://gist.githubusercontent.com/AlgorithmIntensity/${GIST_ID}/raw/9chan_data.json`;
const CURRENT_BOARD=typeof window.CURRENT_BOARD!=='undefined'?window.CURRENT_BOARD:'b';
    
document.querySelectorAll('.mascot-placeholder').forEach(el => el.remove());
    
function generateCaptcha(){
    const n1=Math.floor(Math.random()*10)+1;
    const n2=Math.floor(Math.random()*10)+1;
    const op=['+','-','*'][Math.floor(Math.random()*3)];
    let q,a;
    if(op==='+'){q=`${n1} + ${n2}`;a=n1+n2;}
    else if(op==='-'){q=`${n1} - ${n2}`;a=n1-n2;}
    else{q=`${n1} * ${n2}`;a=n1*n2;}
    return {question:q,answer:a.toString()};
}

let currentCaptcha=generateCaptcha();
const captchaQ=document.getElementById('captchaQuestion');
if(captchaQ)captchaQ.textContent=currentCaptcha.question+' = ?';

function verifyCaptcha(){
    const inputEl=document.getElementById('captchaAnswer');
    if(!inputEl)return true;
    if(inputEl.value.trim()!==currentCaptcha.answer){
        alert('❌ Неправильный ответ!');
        currentCaptcha=generateCaptcha();
        if(captchaQ)captchaQ.textContent=currentCaptcha.question+' = ?';
        inputEl.value='';
        return false;
    }
    currentCaptcha=generateCaptcha();
    if(captchaQ)captchaQ.textContent=currentCaptcha.question+' = ?';
    inputEl.value='';
    return true;
}

function updateSyncStatus(text,isError){
    const el=document.getElementById('syncStatusText');
    if(el){el.textContent=text;el.className=isError?'sync-status error':'sync-status';}
}

async function loadFromGist(force=false){
    const now=Date.now();
    if(!force && cacheData && (now-lastLoadTime)<CACHE_TIME){
        if(cacheData.threads){
            allThreadsCache=cacheData.threads;
            threadsData=allThreadsCache.filter(t=>t.board===CURRENT_BOARD);
            renderAllThreads();
            updateSyncStatus('✅ Кэш');
        }
        return;
    }
    try{
        updateSyncStatus('📥 Загрузка...');
        const res=await fetch(GIST_RAW_URL,{cache:'no-store'});
        if(!res.ok)throw new Error();
        const data=await res.json();
        cacheData=data;
        allThreadsCache=data.threads||[];
        lastLoadTime=now;
        if(data&&data.threads){
            threadsData=allThreadsCache.filter(t=>t.board===CURRENT_BOARD);
            nextThreadId=data.nextThreadId||Math.max(...allThreadsCache.map(t=>t.id),0)+1;
            nextPostId=data.nextPostId||(Math.max(...allThreadsCache.flatMap(t=>[t.id,...(t.replies||[]).map(r=>r.id)]),0)+1);
            renderAllThreads();
            updateSyncStatus('✅ Загружено');
        }else{loadDemoData();}
    }catch(e){
        console.log(e);
        updateSyncStatus('⚠️ Офлайн',true);
        loadFromLocal();
    }
}

async function saveToGist(){
    if(isSyncing)return;
    isSyncing=true;
    try{
        updateSyncStatus('💾 Сохранение...');
        
        let otherBoards=[];
        try{
            const existingRes=await fetch(GIST_RAW_URL,{cache:'no-store'});
            if(existingRes.ok){
                const existingData=await existingRes.json();
                if(existingData&&existingData.threads){
                    otherBoards=existingData.threads.filter(t=>t.board!==CURRENT_BOARD);
                }
            }
        }catch(e){}
        
        const allThreads=[...otherBoards,...threadsData];
        const toSave={
            threads:allThreads,
            nextThreadId:nextThreadId,
            nextPostId:nextPostId,
            lastUpdate:new Date().toISOString()
        };
        
        const response=await fetch(GIST_URL,{
            method:'PATCH',
            headers:{
                'Authorization':`token ${GITHUB_TOKEN}`,
                'Content-Type':'application/json',
                'Accept':'application/vnd.github.v3+json'
            },
            body:JSON.stringify({
                files:{
                    '9chan_data.json':{
                        content:JSON.stringify(toSave,null,2)
                    }
                }
            })
        });
        
        if(!response.ok)throw new Error(`HTTP ${response.status}`);
        
        updateSyncStatus('✅ Сохранено');
        saveToLocal();
        cacheData=toSave;
        allThreadsCache=allThreads;
        lastLoadTime=Date.now();
        
    }catch(e){
        console.error('Save error:',e);
        updateSyncStatus('⚠️ Ошибка',true);
        saveToLocal();
    }
    finally{
        isSyncing=false;
    }
}

function saveToLocal(){
    localStorage.setItem(`9chan_${CURRENT_BOARD}`,JSON.stringify(threadsData));
    localStorage.setItem(`9chan_all_${CURRENT_BOARD}`,JSON.stringify(allThreadsCache));
}

function loadFromLocal(){
    const stored=localStorage.getItem(`9chan_${CURRENT_BOARD}`);
    if(stored&&stored!=='[]'){
        threadsData=JSON.parse(stored);
        renderAllThreads();
        updateSyncStatus('📱 Локально');
    }else{loadDemoData();}
}

function loadDemoData(){
    threadsData=[{
        id:1,
        board:CURRENT_BOARD,
        subject:`Добро пожаловать на /${CURRENT_BOARD}/`,
        name:'Admin',
        comment:`🇩🇪 Добро пожаловать! Создавайте треды и общайтесь!`,
        fileData:null,
        timestamp:new Date().toLocaleString(),
        replies:[]
    }];
    renderAllThreads();
    saveToGist();
}

async function syncAfterAction(fn){
    await fn();
    await saveToGist();
}

function renderAllThreads(){
    const c=document.getElementById('threadsContainer');
    if(!c)return;
    if(!threadsData.length){
        c.innerHTML='<div class="loading-message">📭 Нет тредов. Создайте первый!</div>';
        updateStats();
        return;
    }
    let html='';
    for(let t of threadsData){
        html+=`<div class="thread-card"><div class="thread-header"><span class="thread-title">${escapeHtml(t.subject||'Без темы')}</span><span class="thread-info">№${t.id} ${escapeHtml(t.name||'Аноним')} ${t.timestamp}</span></div>${t.fileData?`<img class="thread-image" src="${t.fileData}">`:''}<div class="thread-comment">${escapeHtml(t.comment).replace(/\n/g,'<br>')}</div><button class="reply-btn" data-id="${t.id}">💬 Ответить</button><div class="replies" id="replies-${t.id}">${renderReplies(t.replies)}</div><div class="reply-form" id="reply-form-${t.id}" style="display:none; margin-top:10px;"><input type="text" id="replyName-${t.id}" placeholder="Имя" style="width:100%;margin-bottom:5px;padding:5px;"><textarea id="replyComment-${t.id}" rows="2" placeholder="Текст" style="width:100%;margin-bottom:5px;padding:5px;"></textarea><div style="margin-bottom:5px;"><span id="captcha-mini-${t.id}"></span><input type="text" id="captcha-mini-ans-${t.id}" placeholder="Ответ" style="width:80px;margin-left:10px;"></div><button class="submit-reply" data-id="${t.id}" style="margin-right:5px;">Отправить</button><button class="cancel-reply" data-id="${t.id}">Отмена</button></div></div>`;
    }
    c.innerHTML=html;
    attachEvents();
    generateMiniCaptchas();
    updateStats();
}

function renderReplies(r){
    if(!r||!r.length)return'<div class="no-replies" style="color:#777;padding:5px;">💬 Нет ответов</div>';
    let html='';
    for(let rep of r){
        html+=`<div class="reply" style="background:#1a1a1a;margin-top:10px;padding:8px;border-radius:8px;"><strong>${escapeHtml(rep.name||'Аноним')}</strong> <span style="color:#888;font-size:11px;">${rep.timestamp}</span>${rep.fileData?`<div><img src="${rep.fileData}" style="max-width:100px;border-radius:5px;"></div>`:''}<div>${escapeHtml(rep.comment)}</div></div>`;
    }
    return html;
}

let miniCaptchas={};
function generateMiniCaptchas(){
    document.querySelectorAll('[id^="captcha-mini-"]').forEach(el=>{
        const n1=Math.floor(Math.random()*5)+1;
        const n2=Math.floor(Math.random()*5)+1;
        const op=['+','-'][Math.floor(Math.random()*2)];
        const ans=op==='+'?n1+n2:n1-n2;
        el.textContent=`${n1} ${op} ${n2} = ?`;
        const tid=el.id.split('-')[2];
        miniCaptchas[tid]=ans.toString();
    });
}

function verifyMiniCaptcha(tid){
    const ans=document.getElementById(`captcha-mini-ans-${tid}`);
    if(!ans)return true;
    if(ans.value.trim()!==miniCaptchas[tid]){
        alert('❌ Неправильный ответ!');
        return false;
    }
    return true;
}

function attachEvents(){
    document.querySelectorAll('.reply-btn').forEach(btn=>{
        btn.onclick=function(){
            const id=this.dataset.id;
            const f=document.getElementById(`reply-form-${id}`);
            if(f){
                const isVisible=f.style.display==='block';
                f.style.display=isVisible?'none':'block';
                if(!isVisible)generateMiniCaptchas();
            }
        };
    });
    
    document.querySelectorAll('.cancel-reply').forEach(btn=>{
        btn.onclick=function(){
            const id=this.dataset.id;
            const f=document.getElementById(`reply-form-${id}`);
            if(f)f.style.display='none';
        };
    });
    
    document.querySelectorAll('.submit-reply').forEach(btn=>{
        btn.onclick=async function(){
            const id=parseInt(this.dataset.id);
            if(!verifyMiniCaptcha(id))return;
            const name=document.getElementById(`replyName-${id}`)?.value.trim()||'';
            const comment=document.getElementById(`replyComment-${id}`)?.value.trim()||'';
            if(!comment){alert('Введите текст');return;}
            await syncAfterAction(async()=>{
                const t=threadsData.find(t=>t.id===id);
                if(t){
                    t.replies=t.replies||[];
                    t.replies.push({
                        id:nextPostId++,
                        name:name||'Аноним',
                        comment:comment,
                        fileData:null,
                        timestamp:new Date().toLocaleString()
                    });
                    renderAllThreads();
                }
            });
            const formDiv=document.getElementById(`reply-form-${id}`);
            if(formDiv)formDiv.style.display='none';
            const nameInput=document.getElementById(`replyName-${id}`);
            const commentInput=document.getElementById(`replyComment-${id}`);
            const captchaInput=document.getElementById(`captcha-mini-ans-${id}`);
            if(nameInput)nameInput.value='';
            if(commentInput)commentInput.value='';
            if(captchaInput)captchaInput.value='';
        };
    });
}

function escapeHtml(s){if(!s)return '';return s.replace(/[&<>]/g,m=>m==='&'?'&amp;':m==='<'?'&lt;':'&gt;');}
function updateStats(){const e=document.getElementById('threadCount');if(e)e.innerText=threadsData.length;}

async function createThread(subj,name,com,file){
    const t={
        id:nextThreadId++,
        board:CURRENT_BOARD,
        subject:subj||'',
        name:name||'Аноним',
        comment:com,
        fileData:file,
        timestamp:new Date().toLocaleString(),
        replies:[]
    };
    threadsData.unshift(t);
    renderAllThreads();
    await saveToGist();
}

const form=document.getElementById('newThreadForm');
const fileInp=document.getElementById('threadFile');
const fileSpan=document.getElementById('fileChosen');
if(fileInp)fileInp.onchange=()=>{fileSpan.textContent=fileInp.files[0]?fileInp.files[0].name:'Файл не выбран';};
if(form){
    form.onsubmit=async(e)=>{
        e.preventDefault();
        if(!verifyCaptcha())return;
        const subj=document.getElementById('threadSubject').value.trim();
        const name=document.getElementById('threadName').value.trim();
        const com=document.getElementById('threadComment').value.trim();
        if(!com){alert('Введите комментарий');return;}
        const file=fileInp.files[0];
        if(file&&!file.type.startsWith('image/')){alert('Только изображения');return;}
        if(file){
            const r=new FileReader();
            r.onload=async(ev)=>{await createThread(subj,name,com,ev.target.result);form.reset();if(fileSpan)fileSpan.textContent='Файл не выбран';};
            r.readAsDataURL(file);
        }else{await createThread(subj,name,com,null);form.reset();if(fileSpan)fileSpan.textContent='Файл не выбран';}
    };
}

loadFromGist();
setInterval(()=>{if(!isSyncing)loadFromGist(true);},15000);
})();
