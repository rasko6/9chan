(function(){
let threads=[],nextId=1,nextReply=1,syncing=false;

const GIST_ID='769dce8a044d2d8dc2b21a2f60719c58';
const URL=`https://api.github.com/gists/${GIST_ID}`;
const RAW=`https://gist.githubusercontent.com/AlgorithmIntensity/${GIST_ID}/raw/9chan_data.json`;
const BOARD=window.CURRENT_BOARD||'b';

function decodeToken(enc){return atob(enc);}
const ENC_TOKEN='V2pKb2QxZ3dhRkJUVlVVMFkxUlNjbFpyV25kbGExcFlZek5rUTJOcVFsbE9ia1l3V2pGS2IyTlVSbmRsYWtKWlkzcE9jbEZSUFQwPQ==';
const TOKEN=decodeToken(ENC_TOKEN);

document.querySelectorAll('.mascot-placeholder').forEach(e=>e.remove());

async function load(){
    try{
        let r=await fetch(RAW);
        if(!r.ok)throw new Error();
        let d=await r.json();
        let all=d.threads||[];
        threads=all.filter(t=>t.board===BOARD);
        nextId=d.nextThreadId||Math.max(...all.map(t=>t.id),0)+1;
        nextReply=d.nextPostId||Math.max(...all.flatMap(t=>[t.id,...(t.replies||[]).map(r=>r.id)]),0)+1;
        render();
    }catch(e){
        let s=localStorage.getItem(`9chan_${BOARD}`);
        if(s)threads=JSON.parse(s);
        else threads=[{id:1,board:BOARD,subject:`Добро пожаловать на /${BOARD}/`,name:'Admin',comment:'Привет!',timestamp:new Date().toLocaleString(),replies:[]}];
        render();
    }
}

async function save(){
    if(syncing)return;
    syncing=true;
    try{
        let other=[];
        try{
            let r=await fetch(RAW);
            if(r.ok){
                let d=await r.json();
                if(d.threads)other=d.threads.filter(t=>t.board!==BOARD);
            }
        }catch(e){}
        let all=[...other,...threads];
        await fetch(URL,{
            method:'PATCH',
            headers:{'Authorization':`token ${TOKEN}`,'Content-Type':'application/json'},
            body:JSON.stringify({files:{'9chan_data.json':{content:JSON.stringify({threads:all,nextThreadId:nextId,nextPostId:nextReply,lastUpdate:new Date().toISOString()})}}})
        });
        localStorage.setItem(`9chan_${BOARD}`,JSON.stringify(threads));
    }catch(e){console.log(e);}
    finally{syncing=false;}
}

function render(){
    let c=document.getElementById('threadsContainer');
    if(!c)return;
    if(!threads.length){c.innerHTML='<div class="loading-message">Нет тредов</div>';return;}
    let h='';
    for(let t of threads){
        h+=`<div class="thread-card"><div class="thread-header"><span class="thread-title">${escape(t.subject||'Без темы')}</span><span class="thread-info">№${t.id} ${escape(t.name||'Аноним')} ${t.timestamp}</span></div>${t.fileData?`<img class="thread-image" src="${t.fileData}">`:''}<div class="thread-comment">${escape(t.comment).replace(/\n/g,'<br>')}</div><button class="reply-btn" data-id="${t.id}">Ответить</button><div class="replies" id="replies-${t.id}">${renderReplies(t.replies)}</div><div class="reply-form" id="reply-form-${t.id}" style="display:none"><input type="text" id="replyName-${t.id}" placeholder="Имя"><textarea id="replyComment-${t.id}" rows="2" placeholder="Текст"></textarea><button class="submit-reply" data-id="${t.id}">Отправить</button><button class="cancel-reply" data-id="${t.id}">Отмена</button></div></div>`;
    }
    c.innerHTML=h;
    attachEvents();
    let sc=document.getElementById('threadCount');
    if(sc)sc.innerText=threads.length;
}

function renderReplies(r){
    if(!r||!r.length)return'<div>Нет ответов</div>';
    let h='';
    for(let rep of r){
        h+=`<div class="reply"><strong>${escape(rep.name||'Аноним')}</strong> ${rep.timestamp}<div>${escape(rep.comment)}</div></div>`;
    }
    return h;
}

function attachEvents(){
    document.querySelectorAll('.reply-btn').forEach(btn=>{
        btn.onclick=()=>{
            let id=btn.dataset.id;
            let f=document.getElementById(`reply-form-${id}`);
            if(f)f.style.display=f.style.display==='block'?'none':'block';
        };
    });
    document.querySelectorAll('.cancel-reply').forEach(btn=>{
        btn.onclick=()=>{
            let f=document.getElementById(`reply-form-${btn.dataset.id}`);
            if(f)f.style.display='none';
        };
    });
    document.querySelectorAll('.submit-reply').forEach(btn=>{
        btn.onclick=async()=>{
            let id=parseInt(btn.dataset.id);
            let name=document.getElementById(`replyName-${id}`)?.value||'';
            let comment=document.getElementById(`replyComment-${id}`)?.value||'';
            if(!comment)return;
            let t=threads.find(t=>t.id===id);
            if(t){
                t.replies=t.replies||[];
                t.replies.push({id:nextReply++,name:name||'Аноним',comment:comment,timestamp:new Date().toLocaleString()});
                render();
                await save();
            }
            document.getElementById(`reply-form-${id}`).style.display='none';
            document.getElementById(`replyName-${id}`).value='';
            document.getElementById(`replyComment-${id}`).value='';
        };
    });
}

function escape(s){if(!s)return '';return s.replace(/[&<>]/g,m=>m==='&'?'&amp;':m==='<'?'&lt;':'&gt;');}

let form=document.getElementById('newThreadForm');
let fileInp=document.getElementById('threadFile');
if(form){
    form.onsubmit=async(e)=>{
        e.preventDefault();
        let subj=document.getElementById('threadSubject').value.trim();
        let name=document.getElementById('threadName').value.trim();
        let com=document.getElementById('threadComment').value.trim();
        if(!com)return;
        let file=fileInp?.files[0];
        let fileData=null;
        if(file){
            if(!file.type.startsWith('image/')){alert('Только изображения');return;}
            fileData=await new Promise(res=>{let r=new FileReader();r.onload=ev=>res(ev.target.result);r.readAsDataURL(file);});
        }
        threads.unshift({id:nextId++,board:BOARD,subject:subj,name:name||'Аноним',comment:com,fileData:fileData,timestamp:new Date().toLocaleString(),replies:[]});
        render();
        await save();
        form.reset();
        if(fileInp&&document.getElementById('fileChosen'))document.getElementById('fileChosen').textContent='Файл не выбран';
    };
}

load();
setInterval(()=>{if(!syncing)load();},30000);
})();
