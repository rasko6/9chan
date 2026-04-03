(function(){
    let threads = [];
    const BOARD = window.CURRENT_BOARD || 'b';
    const API_URL = 'https://script.google.com/macros/s/AKfycbxwH31mrpRnc8fISbJjx9ofaueHKkTcjBqTce_w3xh2tsaw5p633DXY9N6tPrgjwE4H/exec';
    
    function generateCaptcha() {
        const n1 = Math.floor(Math.random() * 10) + 1;
        const n2 = Math.floor(Math.random() * 10) + 1;
        const op = ['+', '-', '*'][Math.floor(Math.random() * 3)];
        let q, a;
        if(op === '+') {
            q = `${n1} + ${n2}`;
            a = n1 + n2;
        } else if(op === '-') {
            q = `${n1} - ${n2}`;
            a = n1 - n2;
        } else {
            q = `${n1} * ${n2}`;
            a = n1 * n2;
        }
        return {question: q, answer: a.toString()};
    }
    
    let currentCaptcha = generateCaptcha();
    const captchaQ = document.getElementById('captchaQuestion');
    if(captchaQ) captchaQ.textContent = currentCaptcha.question + ' = ?';
    
    function verifyCaptcha() {
        const inputEl = document.getElementById('captchaAnswer');
        if(!inputEl) return true;
        if(inputEl.value.trim() !== currentCaptcha.answer) {
            alert('❌ Неправильный ответ!');
            currentCaptcha = generateCaptcha();
            if(captchaQ) captchaQ.textContent = currentCaptcha.question + ' = ?';
            inputEl.value = '';
            return false;
        }
        currentCaptcha = generateCaptcha();
        if(captchaQ) captchaQ.textContent = currentCaptcha.question + ' = ?';
        inputEl.value = '';
        return true;
    }
    
    document.querySelectorAll('.mascot-placeholder').forEach(e => e.remove());
    
    async function loadFromSheets() {
        try {
            const res = await fetch(`${API_URL}?board=${BOARD}`);
            const allThreads = await res.json();
            threads = allThreads.filter(t => t.board === BOARD);
            render();
            updateSyncStatus('✅ Онлайн');
        } catch(e) {
            console.error('Load error:', e);
            updateSyncStatus('⚠️ Офлайн', true);
        }
    }
    
    async function saveToSheets(data) {
        try {
            await fetch(API_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(data)
            });
            return true;
        } catch(e) {
            console.error('Save error:', e);
            return false;
        }
    }
    
    function updateSyncStatus(text, isError) {
        const el = document.getElementById('syncStatusText');
        if(el) {
            el.textContent = text;
            el.style.color = isError ? '#f44336' : '#4caf50';
        }
    }
    
    function getNextId() {
        if(threads.length === 0) return Date.now();
        return Math.max(...threads.map(t => t.id)) + 1;
    }
    
    async function addThread(subject, name, comment, fileData = null) {
        const newThread = {
            id: getNextId(),
            board: BOARD,
            subject: subject || 'Без темы',
            name: name || 'Аноним',
            comment: comment || '',
            fileData: fileData || '',
            timestamp: new Date().toISOString(),
            replies: [],
            pinned: false
        };
        
        threads.unshift(newThread);
        render();
        
        await saveToSheets(newThread);
        updateSyncStatus('✅ Тред создан', false);
        setTimeout(() => loadFromSheets(), 1000);
    }
    
    async function addReply(threadId, name, comment) {
        const thread = threads.find(t => t.id === parseInt(threadId));
        if(thread) {
            const reply = {
                name: name || 'Аноним',
                comment: comment,
                timestamp: new Date().toISOString()
            };
            thread.replies.push(reply);
            render();
            
            await saveToSheets(thread);
            updateSyncStatus('✅ Ответ отправлен', false);
        }
    }
    
    function render() {
        const c = document.getElementById('threadsContainer');
        if(!c) return;
        
        if(!threads.length) {
            c.innerHTML = '<div class="loading-message">Нет тредов. Создайте первый!</div>';
            updateStats();
            return;
        }
        
        let html = '';
        for(let t of threads) {
            html += `<div class="thread-card">
                <div class="thread-header">
                    <span class="thread-title">${escape(t.subject || 'Без темы')}</span>
                    <span class="thread-info">
                        №${t.id} ${escape(t.name || 'Аноним')} ${new Date(t.timestamp).toLocaleString()}
                    </span>
                </div>
                ${t.fileData ? `<img class="thread-image" src="${t.fileData}">` : ''}
                <div class="thread-comment">${escape(t.comment).replace(/\n/g, '<br>')}</div>
                <button class="reply-btn" data-id="${t.id}">Ответить</button>
                <div class="replies" id="replies-${t.id}">${renderReplies(t.replies)}</div>
                <div class="reply-form" id="reply-form-${t.id}" style="display:none">
                    <input type="text" id="replyName-${t.id}" placeholder="Имя" maxlength="30">
                    <textarea id="replyComment-${t.id}" rows="2" placeholder="Текст" maxlength="500"></textarea>
                    <button class="submit-reply" data-id="${t.id}">Отправить</button>
                    <button class="cancel-reply" data-id="${t.id}">Отмена</button>
                </div>
            </div>`;
        }
        c.innerHTML = html;
        attachEvents();
        updateStats();
    }
    
    function renderReplies(r) {
        if(!r || !r.length) return '<div style="color:#777;padding:5px;">💬 Нет ответов</div>';
        let html = '';
        for(let rep of r) {
            html += `<div class="reply">
                <strong>${escape(rep.name || 'Аноним')}</strong> 
                <span style="color:#888;font-size:11px;">${new Date(rep.timestamp).toLocaleString()}</span>
                <div>${escape(rep.comment)}</div>
            </div>`;
        }
        return html;
    }
    
    function attachEvents() {
        document.querySelectorAll('.reply-btn').forEach(btn => {
            btn.onclick = () => {
                const id = btn.dataset.id;
                const f = document.getElementById(`reply-form-${id}`);
                if(f) f.style.display = f.style.display === 'block' ? 'none' : 'block';
            };
        });
        
        document.querySelectorAll('.cancel-reply').forEach(btn => {
            btn.onclick = () => {
                const f = document.getElementById(`reply-form-${btn.dataset.id}`);
                if(f) f.style.display = 'none';
            };
        });
        
        document.querySelectorAll('.submit-reply').forEach(btn => {
            btn.onclick = () => {
                if(!verifyCaptcha()) return;
                const id = btn.dataset.id;
                const nameInput = document.getElementById(`replyName-${id}`);
                const commentInput = document.getElementById(`replyComment-${id}`);
                const name = nameInput ? nameInput.value.trim() : '';
                const comment = commentInput ? commentInput.value.trim() : '';
                if(!comment) {
                    alert('Введите текст ответа');
                    return;
                }
                addReply(id, name, comment);
                if(nameInput) nameInput.value = '';
                if(commentInput) commentInput.value = '';
                const f = document.getElementById(`reply-form-${id}`);
                if(f) f.style.display = 'none';
            };
        });
    }
    
    function updateStats() {
        const sc = document.getElementById('threadCount');
        if(sc) sc.innerText = threads.length;
        const rc = document.getElementById('replyCount');
        if(rc) {
            const totalReplies = threads.reduce((sum, t) => sum + (t.replies?.length || 0), 0);
            rc.innerText = totalReplies;
        }
    }
    
    function escape(s) {
        if(!s) return '';
        return s.replace(/[&<>]/g, m => m === '&' ? '&amp;' : m === '<' ? '&lt;' : '&gt;');
    }
    
    function handleImageUpload(file, callback) {
        if(!file) {
            callback(null);
            return;
        }
        const reader = new FileReader();
        reader.onload = function(e) {
            callback(e.target.result);
        };
        reader.readAsDataURL(file);
    }
    
    const form = document.getElementById('newThreadForm');
    if(form) {
        form.onsubmit = (e) => {
            e.preventDefault();
            if(!verifyCaptcha()) return;
            
            const subjectEl = document.getElementById('threadSubject');
            const nameEl = document.getElementById('threadName');
            const commentEl = document.getElementById('threadComment');
            const imageEl = document.getElementById('threadImage');
            
            const subject = subjectEl ? subjectEl.value.trim() : '';
            const name = nameEl ? nameEl.value.trim() : '';
            const comment = commentEl ? commentEl.value.trim() : '';
            
            if(!comment) {
                alert('Введите текст треда');
                return;
            }
            
            const file = imageEl && imageEl.files[0];
            if(file) {
                handleImageUpload(file, (fileData) => {
                    addThread(subject, name, comment, fileData);
                    if(subjectEl) subjectEl.value = '';
                    if(nameEl) nameEl.value = '';
                    if(commentEl) commentEl.value = '';
                    if(imageEl) imageEl.value = '';
                });
            } else {
                addThread(subject, name, comment, null);
                if(subjectEl) subjectEl.value = '';
                if(nameEl) nameEl.value = '';
                if(commentEl) commentEl.value = '';
            }
        };
    }
    
    loadFromSheets();
    setInterval(loadFromSheets, 5000);
})();
