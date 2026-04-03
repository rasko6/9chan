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
            const dateMatch = dateValue.match(/Date\((\d+),(\d+),(\d+),(\d+),(\d+),(\d+)\)/);
            if(dateMatch) {
                return new Date(
                    parseInt(dateMatch[1]),
                    parseInt(dateMatch[2]),
                    parseInt(dateMatch[3]),
                    parseInt(dateMatch[4]),
                    parseInt(dateMatch[5]),
                    parseInt(dateMatch[6])
                ).toLocaleString();
            }
            if(dateValue.match(/\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}:\d{2}/)) {
                return dateValue;
            }
        }
        return new Date().toLocaleString();
    }
    
    function saveToLocal() {
        try {
            localStorage.setItem(`9chan_${BOARD}`, JSON.stringify(threads));
        } catch(e) {
            console.log('localStorage not available');
        }
    }
    
    async function saveToSheets() {
        alert('⚠️ Сохранение в Google Sheets требует Google Apps Script. Данные сохранены локально.');
        updateSyncStatus('📱 Локально', true);
    }
    
    async function loadFromSheets() {
        try {
            const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=threads`;
            const res = await fetch(url);
            const text = await res.text();
            
            // Method 1: Remove the Google wrapper
            let jsonText = text;
            
            // Remove /*O_o*/ 
            jsonText = jsonText.replace(/\/\*O_o\*\//g, '');
            
            // Remove google.visualization.Query.setResponse(
            jsonText = jsonText.replace(/^google\.visualization\.Query\.setResponse\(/, '');
            
            // Remove trailing );
            jsonText = jsonText.replace(/\);$/, '');
            
            // Now parse as JSON
            const json = JSON.parse(jsonText);
            const rows = json.table.rows;
            
            const remoteThreads = [];
            for(let i = 0; i < rows.length; i++) {
                const row = rows[i].c;
                if(row && row[0] && row[0].v !== null && row[0].v !== undefined) {
                    let timestamp = new Date().toLocaleString();
                    if(row[6] && row[6].v) {
                        const dateMatch = row[6].v.toString().match(/Date\((\d+),(\d+),(\d+),(\d+),(\d+),(\d+)\)/);
                        if(dateMatch) {
                            const date = new Date(
                                parseInt(dateMatch[1]),
                                parseInt(dateMatch[2]),
                                parseInt(dateMatch[3]),
                                parseInt(dateMatch[4]),
                                parseInt(dateMatch[5]),
                                parseInt(dateMatch[6])
                            );
                            timestamp = date.toLocaleString();
                        } else {
                            timestamp = row[6].v.toString();
                        }
                    }
                    
                    let replies = [];
                    if(row[7] && row[7].v) {
                        try {
                            replies = JSON.parse(row[7].v);
                        } catch(e) {
                            replies = [];
                        }
                    }
                    
                    remoteThreads.push({
                        id: parseInt(row[0].v),
                        board: row[1]?.v || 'b',
                        subject: row[2]?.v || '',
                        name: row[3]?.v || 'Аноним',
                        comment: row[4]?.v || '',
                        fileData: row[5]?.v || null,
                        timestamp: timestamp,
                        replies: replies
                    });
                }
            }
            
            const remoteFiltered = remoteThreads.filter(t => t.board === BOARD);
            if(remoteFiltered.length > 0) {
                threads = remoteFiltered;
                saveToLocal();
                render();
                updateSyncStatus('✅ Синхронизировано');
            } else {
                loadLocal();
            }
        } catch(e) {
            console.error('Sync error:', e);
            console.log('Raw response:', text.substring(0, 200));
            updateSyncStatus('⚠️ Офлайн', true);
            loadLocal();
        }
    }
    
    function loadLocal() {
        try {
            const saved = localStorage.getItem(`9chan_${BOARD}`);
            if(saved && JSON.parse(saved).length > 0) {
                threads = JSON.parse(saved);
                render();
            } else {
                threads = [{
                    id: 1,
                    board: BOARD,
                    subject: 'Добро пожаловать на 9chan',
                    name: 'Admin',
                    comment: 'Привет! Это тестовый тред через новый БД :D',
                    fileData: null,
                    timestamp: '03.04.2026 14:12:17',
                    replies: []
                }];
                saveToLocal();
                render();
            }
        } catch(e) {
            threads = [{
                id: 1,
                board: BOARD,
                subject: 'Добро пожаловать на 9chan',
                name: 'Admin',
                comment: 'Привет! Это тестовый тред через новый БД :D',
                fileData: null,
                timestamp: '03.04.2026 14:12:17',
                replies: []
            }];
            render();
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
        render();
        updateSyncStatus('💾 Сохранено локально', true);
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
            render();
            updateSyncStatus('💾 Ответ сохранен', true);
            setTimeout(() => {
                if(document.getElementById('syncStatusText')?.textContent === '💾 Ответ сохранен') {
                    updateSyncStatus('📱 Локально', true);
                }
            }, 2000);
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
    setInterval(loadFromSheets, 60000);
})();
