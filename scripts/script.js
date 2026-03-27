(function(){
let threadsData=[];
let nextThreadId=1;
let nextPostId=1;
let isSyncing=false;
let syncQueue=[];

const GIST_ID='769dce8a044d2d8dc2b21a2f60719c58';
const DECODE_TIMES=10;

function decodeToken(encoded,times){
    let result=encoded;
    for(let i=0;i<times;i++){
        result=atob(result);
    }
    return result;
}

const m='Vm0wd2QyVkhVWGhVV0d4V1YwZG9WbFl3WkRSV1ZsbDNXa1JTVjAxV2JETlhhMk0xWVVaS2MxTnNXbFpOYWtFeFdWZDRZV014WkhWalJtUk9ZV3RhU1ZkV1dsWmxSbGw1Vkd0c2FGSnRVbFJVVkVaTFZWWmtWMXBFVWxSTmF6RTFWVEowVjFadFNraFZhemxhWWxob1RGWldXbXRXTVd0NllVWlNUbFpYZHpCV2Fra3hVakZaZVZOcmJGSmlSMmhZV1d4b2IxWXhjRlpYYlVacVlraENSbFpYZUZkVWJGcFZWbXRzVjJKVVFYaFdSRVpXWlZaT2NtSkdTbWxTTW1oWlYxZDRiMVV3TUhoV1dHaFlZbFZhY1ZSV1dtRmxWbkJHVjJ4a1ZXSlZXVEpXYlhCaFZqSkZlVlJZYUZaaGExcFhXbFphUzJOV1pITmFSMnhYVWpOb1dGWnRNREZrTVZsNVZXeGthbEpXV2xSWmJGWmhZMVpTVjFkdVpFNVNia0pIVjJ0ak5WWlhTa2RqUkVKaFUwaENTRlpxU2tabFZsWnhWR3hvVjJKSVFubFdWRUpoVkRKU1YxWnVVbWhTYXpWd1ZqQmtiMWRzV1hoWGJFNVRUVmQ0V0ZaWGRHdFdiVXBJWVVoT1ZtRnJOVlJXTVZwWFkxWkdWVkZyTldsU2JrRjNWMnhXWVdFeFduSk5WbVJxVWxkU1dGUlhOVU5UUmxweFVtMUdWMDFyTlVoV1J6RkhWVEZLVjJORlZsZGlSMUV3VlZSR1lWWnJNVlpXYXpWVFVrVkZOUT09';
const g=decodeToken(m,1);

const GIST_URL=`https://api.github.com/gists/${GIST_ID}`;
const GIST_RAW_URL=`https://gist.githubusercontent.com/AlgorithmIntensity/${GIST_ID}/raw/9chan_data.json`;

const CURRENT_BOARD=typeof window.CURRENT_BOARD!=='undefined'?window.CURRENT_BOARD:'b';

function generateCaptcha(){
    const num1=Math.floor(Math.random()*10)+1;
    const num2=Math.floor(Math.random()*10)+1;
    const operators=['+','-','*'];
    const op=operators[Math.floor(Math.random()*3)];
    let question,answer;
    if(op==='+'){
        question=`${num1} + ${num2}`;
        answer=num1+num2;
    }else if(op==='-'){
        question=`${num1} - ${num2}`;
        answer=num1-num2;
    }else{
        question=`${num1} * ${num2}`;
        answer=num1*num2;
    }
    return {question,answer:answer.toString()};
}

let currentCaptcha=generateCaptcha();
const captchaQuestionEl=document.getElementById('captchaQuestion');
if(captchaQuestionEl)captchaQuestionEl.textContent=currentCaptcha.question+' = ?';

function verifyCaptcha(){
    const inputEl=document.getElementById('captchaAnswer');
    if(!inputEl)return true;
    const userAnswer=inputEl.value.trim();
    const isValid=userAnswer===currentCaptcha.answer;
    if(!isValid){
        alert('❌ Неправильный ответ капчи!');
        currentCaptcha=generateCaptcha();
        if(captchaQuestionEl)captchaQuestionEl.textContent=currentCaptcha.question+' = ?';
        if(inputEl)inputEl.value='';
        return false;
    }
    currentCaptcha=generateCaptcha();
    if(captchaQuestionEl)captchaQuestionEl.textContent=currentCaptcha.question+' = ?';
    if(inputEl)inputEl.value='';
    return true;
}

const mascotContainer=document.querySelector('.mascot-placeholder');
if(mascotContainer&&!mascotContainer.querySelector('img')){
    const img=document.createElement('img');
    img.src='hitme.png';
    img.style.width='48px';
    img.style.height='48px';
    img.style.objectFit='contain';
    img.style.borderRadius='50%';
    mascotContainer.appendChild(img);
}

function updateSyncStatus(text,isError){
    const statusEl=document.getElementById('syncStatusText');
    if(statusEl){
        statusEl.textContent=text;
        statusEl.className=isError?'sync-status error':'sync-status';
    }
}

async function loadFromGist(){
    try{
        updateSyncStatus('📥 Загрузка...');
        const response=await fetch(GIST_RAW_URL);
        if(!response.ok)throw new Error(`HTTP ${response.status}`);
        const data=await response.json();
        if(data&&data.threads){
            const allThreads=data.threads;
            threadsData=allThreads.filter(t=>t.board===CURRENT_BOARD);
            nextThreadId=data.nextThreadId||Math.max(...allThreads.map(t=>t.id),0)+1;
            nextPostId=data.nextPostId||(Math.max(...allThreads.flatMap(t=>[t.id,...t.replies.map(r=>r.id)]),0)+1);
            renderAllThreads();
            updateSyncStatus('✅ Загружено');
        }else{
            loadDemoData();
        }
    }catch(error){
        console.error(error);
        updateSyncStatus('⚠️ Офлайн',true);
        loadFromLocal();
    }
}

async function saveToGist(){
    if(isSyncing){
        syncQueue.push(saveToGist);
        return;
    }
    isSyncing=true;
    try{
        updateSyncStatus('💾 Сохранение...');
        let allThreads=[];
        const existing=await fetch(GIST_RAW_URL);
        if(existing.ok){
            const oldData=await existing.json();
            if(oldData&&oldData.threads){
                const otherBoards=oldData.threads.filter(t=>t.board!==CURRENT_BOARD);
                allThreads=[...otherBoards,...threadsData];
            }else{
                allThreads=threadsData;
            }
        }else{
            allThreads=threadsData;
        }
        const dataToSave={
            threads:allThreads,
            nextThreadId:nextThreadId,
            nextPostId:nextPostId,
            lastUpdate:new Date().toISOString()
        };
        const response=await fetch(GIST_URL,{
            method:'PATCH',
            headers:{
                'Authorization':`token ${g}`,
                'Content-Type':'application/json',
                'Accept':'application/vnd.github.v3+json'
            },
            body:JSON.stringify({
                files:{'9chan_data.json':{content:JSON.stringify(dataToSave,null,2)}}
            })
        });
        if(!response.ok)throw new Error(`HTTP ${response.status}`);
        updateSyncStatus('✅ Сохранено');
        saveToLocal();
    }catch(error){
        console.error(error);
        updateSyncStatus('⚠️ Ошибка',true);
        saveToLocal();
    }finally{
        isSyncing=false;
        if(syncQueue.length>0){
            const next=syncQueue.shift();
            next();
        }
    }
}

function saveToLocal(){
    localStorage.setItem(`9chan_threads_${CURRENT_BOARD}`,JSON.stringify(threadsData));
}

function loadFromLocal(){
    const stored=localStorage.getItem(`9chan_threads_${CURRENT_BOARD}`);
    if(stored&&stored!=='[]'){
        threadsData=JSON.parse(stored);
        renderAllThreads();
        updateSyncStatus('📱 Локально');
    }else{
        loadDemoData();
    }
}

function loadDemoData(){
    threadsData=[{
        id:1,
        board:CURRENT_BOARD,
        subject:`Добро пожаловать на /${CURRENT_BOARD}/`,
        name:'Администрация',
        comment:`🇩🇪 Willkommen auf /${CURRENT_BOARD}/! 🇩🇪\n\nЭто доска ${CURRENT_BOARD}. Создавайте треды, прикрепляйте изображения и общайтесь!\n\nДля создания треда или ответа нужно решить простую капчу.`,
        fileData:null,
        fileName:null,
        fileType:null,
        timestamp:new Date().toLocaleString(),
        replies:[{
            id:1,
            name:'Первый анон',
            comment:'Капча работает! 🔥',
            fileData:null,
            timestamp:new Date().toLocaleString()
        }]
    }];
    renderAllThreads();
    saveToGist();
}

async function syncAfterAction(action){
    await action();
    await saveToGist();
}

function updateStats(){
    const threadCountSpan=document.getElementById('threadCount');
    if(threadCountSpan)threadCountSpan.innerText=threadsData.length;
}

function renderAllThreads(){
    const container=document.getElementById('threadsContainer');
    if(!container)return;
    if(threadsData.length===0){
        container.innerHTML='<div class="loading-message">📭 Тредов нет. Создайте первый тред!</div>';
        updateStats();
        return;
    }
    let html='';
    for(let thread of threadsData){
        html+=`<div class="thread-card" data-thread-id="${thread.id}"><div class="thread-header"><span class="thread-title">${escapeHtml(thread.subject||'Без темы')}</span><span class="thread-info">№${thread.id} ${escapeHtml(thread.name||'Аноним')} ${thread.timestamp}</span></div>${thread.fileData?`<img class="thread-image" src="${thread.fileData}" loading="lazy">`:''}<div class="thread-comment">${escapeHtml(thread.comment).replace(/\n/g,'<br>')}</div><button class="reply-button" data-id="${thread.id}">💬 Ответить</button><div class="replies-container" id="replies-${thread.id}">${renderReplies(thread.replies)}</div><div class="reply-form-placeholder" id="reply-form-${thread.id}" style="display:none; margin-top:12px;"><div class="form-row" style="flex-direction:column;"><input type="text" id="replyName-${thread.id}" placeholder="Имя" maxlength="50" style="background:#232323;border:1px solid #d4af37;padding:8px;border-radius:8px;color:white;"><textarea id="replyComment-${thread.id}" rows="2" placeholder="Текст ответа..." style="background:#232323;border:1px solid #d4af37;padding:8px;border-radius:8px;color:white;"></textarea><div class="captcha-mini"><span id="captchaMini-${thread.id}"></span><input type="text" id="captchaMiniAnswer-${thread.id}" placeholder="Ответ" style="width:80px;margin-left:10px;"></div><label for="replyFile-${thread.id}" style="background:#2c2c2c;padding:6px;text-align:center;border-radius:20px;cursor:pointer;">📎 Изображение</label><input type="file" id="replyFile-${thread.id}" accept="image/*" style="display:none;"><button class="german-btn submit-reply" data-id="${thread.id}">Отправить ответ</button><button class="cancel-reply" data-id="${thread.id}">Отмена</button></div></div></div>`;
    }
    container.innerHTML=html;
    attachReplyButtons();
    attachSubmitReplies();
    attachCancelReply();
    generateMiniCaptchas();
    updateStats();
}

function renderReplies(replies){
    if(!replies.length)return '<div style="color:#777;padding:5px;">💬 Нет ответов</div>';
    let html='';
    for(let rep of replies){
        html+=`<div class="reply-item"><strong>${escapeHtml(rep.name||'Аноним')}</strong> <span style="color:#888;font-size:0.6rem;">${rep.timestamp}</span>${rep.fileData?`<div><img src="${rep.fileData}" style="max-width:120px;border-radius:8px;"></div>`:''}<div>${escapeHtml(rep.comment).replace(/\n/g,'<br>')}</div></div>`;
    }
    return html;
}

let miniCaptchas={};

function generateMiniCaptchas(){
    document.querySelectorAll('[id^="captchaMini-"]').forEach(el=>{
        const num1=Math.floor(Math.random()*5)+1;
        const num2=Math.floor(Math.random()*5)+1;
        const op=['+','-'][Math.floor(Math.random()*2)];
        let answer;
        if(op==='+')answer=num1+num2;
        else answer=num1-num2;
        const question=`${num1} ${op} ${num2} = ?`;
        el.textContent=question;
        const threadId=el.id.split('-')[1];
        miniCaptchas[threadId]=answer.toString();
    });
}

function verifyMiniCaptcha(threadId){
    const answerEl=document.getElementById(`captchaMiniAnswer-${threadId}`);
    if(!answerEl)return true;
    const userAnswer=answerEl.value.trim();
    const isValid=userAnswer===miniCaptchas[threadId];
    if(!isValid){
        alert('❌ Неправильный ответ капчи!');
        return false;
    }
    return true;
}

function attachReplyButtons(){
    document.querySelectorAll('.reply-button').forEach(btn=>{
        btn.onclick=function(e){
            const threadId=parseInt(this.getAttribute('data-id'));
            const formDiv=document.getElementById(`reply-form-${threadId}`);
            if(formDiv){
                const isVisible=formDiv.style.display==='block';
                formDiv.style.display=isVisible?'none':'block';
                if(!isVisible){
                    generateMiniCaptchas();
                }
            }
        };
    });
}

function attachCancelReply(){
    document.querySelectorAll('.cancel-reply').forEach(btn=>{
        btn.onclick=function(e){
            const threadId=parseInt(this.getAttribute('data-id'));
            const formDiv=document.getElementById(`reply-form-${threadId}`);
            if(formDiv)formDiv.style.display='none';
        };
    });
}

function attachSubmitReplies(){
    document.querySelectorAll('.submit-reply').forEach(btn=>{
        btn.onclick=async function(e){
            const threadId=parseInt(this.getAttribute('data-id'));
            if(!verifyMiniCaptcha(threadId))return;
            const nameField=document.getElementById(`replyName-${threadId}`);
            const commentField=document.getElementById(`replyComment-${threadId}`);
            const fileField=document.getElementById(`replyFile-${threadId}`);
            const name=nameField?nameField.value.trim():'';
            const comment=commentField?commentField.value.trim():'';
            if(!comment){
                alert('Введите текст ответа');
                return;
            }
            if(fileField&&fileField.files&&fileField.files[0]){
                const file=fileField.files[0];
                if(!file.type.startsWith('image/')){
                    alert('Можно прикреплять только изображения');
                    return;
                }
                const reader=new FileReader();
                reader.onload=async function(ev){
                    await syncAfterAction(async()=>{
                        const thread=threadsData.find(t=>t.id===threadId);
                        if(thread){
                            thread.replies.push({
                                id:nextPostId++,
                                name:name||'Аноним',
                                comment:comment,
                                fileData:ev.target.result,
                                timestamp:new Date().toLocaleString()
                            });
                            renderAllThreads();
                        }
                    });
                    if(fileField)fileField.value='';
                    if(nameField)nameField.value='';
                    if(commentField)commentField.value='';
                    const formDiv=document.getElementById(`reply-form-${threadId}`);
                    if(formDiv)formDiv.style.display='none';
                };
                reader.readAsDataURL(file);
            }else{
                await syncAfterAction(async()=>{
                    const thread=threadsData.find(t=>t.id===threadId);
                    if(thread){
                        thread.replies.push({
                            id:nextPostId++,
                            name:name||'Аноним',
                            comment:comment,
                            fileData:null,
                            timestamp:new Date().toLocaleString()
                        });
                        renderAllThreads();
                    }
                });
                if(nameField)nameField.value='';
                if(commentField)commentField.value='';
                const formDiv=document.getElementById(`reply-form-${threadId}`);
                if(formDiv)formDiv.style.display='none';
            }
        };
    });
}

function escapeHtml(str){
    if(!str)return '';
    return str.replace(/[&<>]/g,function(m){
        if(m==='&')return '&amp;';
        if(m==='<')return '&lt;';
        if(m==='>')return '&gt;';
        return m;
    });
}

async function createNewThread(subject,name,comment,fileData,fileName,fileType){
    const newThread={
        id:nextThreadId++,
        board:CURRENT_BOARD,
        subject:subject||'',
        name:name||'Аноним',
        comment:comment,
        fileData:fileData,
        fileName:fileName,
        fileType:fileType,
        timestamp:new Date().toLocaleString(),
        replies:[]
    };
    threadsData.unshift(newThread);
    renderAllThreads();
    await saveToGist();
}

const form=document.getElementById('newThreadForm');
const fileInput=document.getElementById('threadFile');
const fileChosenSpan=document.getElementById('fileChosen');

if(fileInput&&fileChosenSpan){
    fileInput.addEventListener('change',function(){
        if(this.files&&this.files[0]){
            fileChosenSpan.textContent=this.files[0].name;
        }else{
            fileChosenSpan.textContent='Файл не выбран';
        }
    });
}

if(form){
    form.addEventListener('submit',async function(e){
        e.preventDefault();
        if(!verifyCaptcha())return;
        const subject=document.getElementById('threadSubject').value.trim();
        const name=document.getElementById('threadName').value.trim();
        const comment=document.getElementById('threadComment').value.trim();
        if(!comment){
            alert('Комментарий обязателен');
            return;
        }
        const file=fileInput.files[0];
        if(!file){
            await createNewThread(subject,name,comment,null,null,null);
            form.reset();
            if(fileChosenSpan)fileChosenSpan.textContent='Файл не выбран';
            return;
        }
        if(!file.type.startsWith('image/')){
            alert('Разрешены только изображения');
            return;
        }
        const reader=new FileReader();
        reader.onload=async function(ev){
            await createNewThread(subject,name,comment,ev.target.result,file.name,file.type);
            form.reset();
            if(fileChosenSpan)fileChosenSpan.textContent='Файл не выбран';
        };
        reader.readAsDataURL(file);
    });
}

loadFromGist();
setInterval(()=>{
    if(!isSyncing)loadFromGist();
},30000);
})();
