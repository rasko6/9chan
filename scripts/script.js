(function(){
let threads=[];
const BOARD=window.CURRENT_BOARD||'b';
const SHEET_ID='1JOR6YunxzIlrGMFgl_iifstE5QBsd9hZ2Ih8x6AfnZ8';

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

document.querySelectorAll('.mascot-placeholder').forEach(e=>e.remove());

function updateSyncStatus(text,isError){
    const el=document.getElementById('syncStatusText');
    if(el){
        el.textContent=text;
        el.style.color=isError?'#f44336':'#d4af37';
    }
}

async function loadFromSheets(){
    updateSyncStatus('📥 Загрузка...');
    try{
        const url=`https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=threads`;
        console.log('Загрузка:',url);
        const res=await fetch(url);
        if(!res.ok)throw new Error(`HTTP ${res.status}`);
        const text=await res.text();
        console.log('Ответ:',text.substring(0,200));
        
        const jsonStart=text.indexOf('{');
        const jsonEnd=text.lastIndexOf('}');
        const jsonText=text.substring(jsonStart,jsonEnd+1);
        const json=JSON.parse(jsonText);
        
        const rows=json.table.rows;
        threads=[];
        
        for(let i=1;i<rows.length;i++){
            const row=rows[i].c;
            if(row && row[0] && row[0].v){
                threads.push({
                    id:parseInt(row[0].v),
                    board:row[1]?.v||'b',
                    subject:row[2]?.v||'',
                    name:row[3]?.v||'Аноним',
                    comment:row[4]?.v||'',
                    fileData:row[5]?.v||null,
                    timestamp:row[6]?.v||new Date().toLocaleString(),
                    replies:row[7]?.v?JSON.parse(row[7].v):[]
                });
            }
        }
        threads=threads.filter(t=>t.board===BOARD);
        render();
        updateSyncStatus('✅ Загружено');
    }catch(e){
        console.error('Ошибка:',e);
        updateSyncStatus('⚠️ Ошибка загрузки',true);
        loadDemoData();
    }
}

function loadDemoData(){
    threads=[{id:1,board:BOARD,subject:`Добро пожаловать на /${BOARD}/`,name:'Admin',comment:'Привет! Это демо-режим. Google Sheets не отвечает.',timestamp:new Date().toLocaleString(),replies:[]}];
    render();
}

function render(){
    const c=document.getElementById('threadsContainer');
    if(!c)return;
    if(!threads.length){
        c.innerHTML='<div class="loading-message">Нет тредов</div>';
        updateStats();
        return;
    }
    let html='';
    for(let t of threads){
        html+=`<div class="thread-card"><div class="thread-header"><span class="thread-title">${escape(t.subject||'Без темы')}</span><span class="thread-info">№${t.id} ${escape(t.name||'Аноним')} ${t.timestamp}</span></div>${t.fileData?`<img class="thread-image" src="${t.fileData}">`:''}<div class="thread-comment">${escape(t.comment).replace(/\n/g,'<br>')}</div><button class="reply-btn" data-id="${t.id}">Ответить</button><div class="replies" id="replies-${t.id}">${renderReplies(t.replies)}</div><div class="reply-form" id="reply-form-${t.id}" style="display:none"><input type="text" id="replyName-${t.id}" placeholder="Имя"><textarea id="replyComment-${t.id}" rows="2" placeholder="Текст"></textarea><button class="submit-reply" data-id="${t.id}">Отправить</button><button class="cancel-reply" data-id="${t.id}">Отмена</button></div></div>`;
    }
    c.innerHTML=html;
    attachEvents();
    updateStats();
}

function renderReplies(r){
    if(!r||!r.length)return'<div style="color:#777;padding:5px;">💬 Нет ответов</div>';
    let html='';
    for(let rep of r){
        html+=`<div class="reply"><strong>${escape(rep.name||'Аноним')}</strong> <span style="color:#888;font-size:11px;">${rep.timestamp}</span><div>${escape(rep.comment)}</div></div>`;
    }
    return html;
}

function attachEvents(){
    document.querySelectorAll('.reply-btn').forEach(btn=>{
        btn.onclick=()=>{
            const id=btn.dataset.id;
            const f=document.getElementById(`reply-form-${id}`);
            if(f)f.style.display=f.style.display==='block'?'none':'block';
        };
    });
    document.querySelectorAll('.cancel-reply').forEach(btn=>{
        btn.onclick=()=>{
            const f=document.getElementById(`reply-form-${btn.dataset.id}`);
            if(f)f.style.display='none';
        };
    });
    document.querySelectorAll('.submit-reply').forEach(btn=>{
        btn.onclick=()=>{
            if(!verifyCaptcha())return;
            alert('⚠️ Сохранение временно отключено. Редактируйте Google Sheets вручную.');
        };
    });
}

function updateStats(){
    const sc=document.getElementById('threadCount');
    if(sc)sc.innerText=threads.length;
}

function escape(s){
    if(!s)return '';
    return s.replace(/[&<>]/g,m=>m==='&'?'&amp;':m==='<'?'&lt;':'&gt;');
}

let form=document.getElementById('newThreadForm');
if(form){
    form.onsubmit=(e)=>{
        e.preventDefault();
        if(!verifyCaptcha())return;
        alert('⚠️ Создание тредов временно отключено. Редактируйте Google Sheets вручную.\n\nСсылка: https://docs.google.com/spreadsheets/d/'+SHEET_ID);
    };
}

loadFromSheets();
setInterval(loadFromSheets,30000);
})();
