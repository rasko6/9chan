(function(){
    let threads = [];
    const BOARD = window.CURRENT_BOARD || 'b';
    const SHEET_ID = '1JOR6YunxzIlrGMFgl_iifstE5QBsd9hZ2Ih8x6AfnZ8';
    
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
    
    function formatDate(dateValue) {
        if(!dateValue) return new Date().toLocaleString();
        if(typeof dateValue === 'string') {
            if(dateValue.startsWith('Date(')) {
                const match = dateValue.match(/Date\((\d+),(\d+),(\d+),(\d+),(\d+),(\d+)\)/);
                if(match) {
                    return new Date(match[1], match[2], match[3], match[4], match[5], match[6]).toLocaleString();
                }
            }
            return dateValue;
        }
        return new Date().toLocaleString();
    }
    
    function saveToLocal() {
        localStorage.setItem(`9chan_${BOARD}`, JSON.stringify(threads));
    }
    
    async function saveToSheets() {
        try {
            const sheetData = threads.map(t => ({
                id: t.id,
                board: t.board,
                subject: t.subject,
                name: t.name,
                comment: t.comment,
                fileData: t.fileData || '',
                timestamp: t.timestamp,
                replies: JSON.stringify(t.replies)
            }));
            
            for (let data of sheetData) {
                const params = new URLSearchParams();
                params.append('id', data.id);
                params.append('board', data.board);
                params.append('subject', data.subject);
                params.append('name', data.name);
                params.append('comment', data.comment);
                params.append('fileData', data.fileData);
                params.append('timestamp', data.timestamp);
                params.append('replies', data.replies);
                
                await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent('https://script.google.com/macros/s/AKfycbxxxxx/exec')}`, {
                    method: 'POST',
                    mode: 'cors',
                    body: params
                }).catch(e => console.log('Sheet save failed, using local only'));
            }
            updateSyncStatus('✅ Сохранено');
        } catch(e) {
            console.error(e);
            updateSyncStatus('⚠️ Локально', true);
        }
    }
    
    async function loadFromSheets() {
        try {
            const saved = localStorage.getItem(`9chan_${BOARD}`);
            if(saved) {
                threads = JSON.parse(saved);
                render();
                updateSyncStatus('✅ Загружено');
            }
            
            const url = `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=threads`)}`;
            const res = await fetch(url);
            const text = await res.text();
            const json = JSON.parse(text);
            const rows = json.table.rows;
            
            const remoteThreads = [];
            for(let i = 0; i < rows.length; i++) {
                const row = rows[i].c;
                if(row && row[0] && row[0].v) {
                    remoteThreads.push({
                        id: parseInt(row[0].v),
                        board: row[1]?.v || 'b',
                        subject: row[2]?.v || '',
                        name: row[3]?.v || 'Аноним',
                        comment: row[4]?.v || '',
                        fileData: row[5]?.v || null,
                        timestamp: formatDate(row[6]?.v),
                        replies: row[7]?.v ? JSON.parse(row[7].v) : []
                    });
                }
            }
            
            if(remoteThreads.length > 0) {
                const remoteFiltered = remoteThreads.filter(t => t.board === BOARD);
                if(remoteFiltered.length > 0) {
                    threads = remoteFiltered;
                    saveToLocal();
                    render();
                    updateSyncStatus('✅ Загружено');
                }
            }
        } catch(e) {
            console.error(e);
            updateSyncStatus('⚠️ Офлайн', true);
            loadLocal();
        }
    }
    
    function loadLocal() {
        const saved = localStorage.getItem(`9chan_${BOARD}`);
        if(saved && JSON.parse(saved).length > 0) {
            threads = JSON.parse(saved);
            render();
        } else {
            threads = [{
                id: Date.now(),
                board: BOARD,
                subject: `Добро пожаловать на /${BOARD}/`,
                name: 'Admin',
                comment: 'Привет! Создавайте треды и отвечайте.',
                fileData: null,
                timestamp: new Date().toLocaleString(),
                replies: []
            }];
            saveToLocal();
            render();
        }
    }
    
    function updateSyncStatus(text, isError) {
        const el = document.getElementById('syncStatusText');
        if(el) {
            el.textContent = text;
            el.style.color = isError ? '#f44336' : '#d4af37';
        }
    }
    
    function getNextId() {
        if(threads.length === 0) return Date.now();
        return Math.max(...threads.map(t => t.id)) + 1;
    }
    
    function addThread(subject, name, comment, fileData = null) {
        const newThread = {
            id: getNextId(),
            board: BOARD,
            subject: subject || 'Без темы',
            name: name || 'Аноним',
            comment: comment || '',
            fileData: fileData,
            timestamp: new Date().toLocaleString(),
            replies: []
        };
        threads.unshift(newThread);
        saveToLocal();
        saveToSheets();
        render();
    }
    
    function addReply(threadId, name, comment) {
        const thread = threads.find(t => t.id === parseInt(threadId));
        if(thread) {
            const reply = {
                name: name || 'Аноним',
                comment: comment,
                timestamp: new Date().toLocaleString()
            };
            thread.replies.push(reply);
            saveToLocal();
            saveToSheets();
            render();
        }
    }
    
    function render() {
        const c = document.getElementById('threadsContainer');
        if(!c) return;
        if(!threads.length) {
            c.innerHTML = '<div class="loading-message">Нет тредов</div>';
            updateStats();
            return;
        }
        let html = '';
        for(let t of threads) {
            html += `<div class="thread-card"><div class="thread-header"><span class="thread-title">${escape(t.subject || 'Без темы')}</span><span class="thread-info">№${t.id} ${escape(t.name || 'Аноним')} ${t.timestamp}</span></div>${t.fileData ? `<img class="thread-image" src="${t.fileData}">` : ''}<div class="thread-comment">${escape(t.comment).replace(/\n/g, '<br>')}</div><button class="reply-btn" data-id="${t.id}">Ответить</button><div class="replies" id="replies-${t.id}">${renderReplies(t.replies)}</div><div class="reply-form" id="reply-form-${t.id}" style="display:none"><input type="text" id="replyName-${t.id}" placeholder="Имя" maxlength="30"><textarea id="replyComment-${t.id}" rows="2" placeholder="Текст" maxlength="500"></textarea><button class="submit-reply" data-id="${t.id}">Отправить</button><button class="cancel-reply" data-id="${t.id}">Отмена</button></div></div>`;
        }
        c.innerHTML = html;
        attachEvents();
        updateStats();
    }
    
    function renderReplies(r) {
        if(!r || !r.length) return '<div style="color:#777;padding:5px;">💬 Нет ответов</div>';
        let html = '';
        for(let rep of r) {
            html += `<div class="reply"><strong>${escape(rep.name || 'Аноним')}</strong> <span style="color:#888;font-size:11px;">${rep.timestamp}</span><div>${escape(rep.comment)}</div></div>`;
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
    setInterval(loadFromSheets, 60000);
})();
