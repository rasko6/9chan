(function(){
    let threads = [];
    let openReplyForms = new Set();
    let replyTexts = new Map();
    let replyNames = new Map();
    let replyFiles = new Map();
    const BOARD = window.CURRENT_BOARD || 'b';
    const API_URL = 'https://script.google.com/macros/s/AKfycbxwH31mrpRnc8fISbJjx9ofaueHKkTcjBqTce_w3xh2tsaw5p633DXY9N6tPrgjwE4H/exec';
    
    // Глобальная капча для ответов
    let replyCaptcha = null;
    let replyCaptchaQuestion = null;
    let replyCaptchaAnswer = null;
    
    // Основная капча для создания тредов
    let currentCaptcha = null;
    let captchaQuestionElement = null;
    let captchaAnswerElement = null;
    
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
    
    function updateCaptchaUI() {
        if(captchaQuestionElement) {
            captchaQuestionElement.textContent = currentCaptcha.question + ' = ?';
        }
        if(captchaAnswerElement) {
            captchaAnswerElement.value = '';
        }
    }
    
    function resetCaptcha() {
        currentCaptcha = generateCaptcha();
        updateCaptchaUI();
    }
    
    function verifyCaptcha() {
        if(!captchaAnswerElement) return true;
        const userAnswer = captchaAnswerElement.value.trim();
        if(userAnswer !== currentCaptcha.answer) {
            alert('❌ Неправильный ответ! Попробуйте снова.');
            resetCaptcha();
            return false;
        }
        resetCaptcha();
        return true;
    }
    
    // Капча для ответов
    function resetReplyCaptcha() {
        replyCaptcha = generateCaptcha();
        if(replyCaptchaQuestion) {
            replyCaptchaQuestion.textContent = replyCaptcha.question + ' = ?';
        }
        if(replyCaptchaAnswer) {
            replyCaptchaAnswer.value = '';
        }
    }
    
    function verifyReplyCaptcha() {
        if(!replyCaptchaAnswer) return true;
        const userAnswer = replyCaptchaAnswer.value.trim();
        if(userAnswer !== replyCaptcha.answer) {
            alert('❌ Неправильный ответ в капче!');
            resetReplyCaptcha();
            return false;
        }
        resetReplyCaptcha();
        return true;
    }
    
    function initCaptcha() {
        captchaQuestionElement = document.getElementById('captchaQuestion');
        captchaAnswerElement = document.getElementById('captchaAnswer');
        resetCaptcha();
    }
    
    document.querySelectorAll('.mascot-placeholder').forEach(e => e.remove());
    
    // Отображение имени файла для нового треда
    const fileInput = document.getElementById('threadImage');
    if(fileInput) {
        fileInput.addEventListener('change', function() {
            const fileName = document.getElementById('fileChosen');
            if(fileName) {
                fileName.textContent = this.files[0] ? this.files[0].name : 'Файл не выбран';
            }
        });
    }
    
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
            const saveData = {
                id: data.id,
                board: data.board,
                subject: data.subject || '',
                name: data.name || 'Аноним',
                comment: data.comment || '',
                fileData: data.fileData || '',
                timestamp: data.timestamp || new Date().toISOString(),
                replies: data.replies || [],
                pinned: data.pinned || false
            };
            
            await fetch(API_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(saveData)
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
            setTimeout(() => {
                if(el.textContent === text) {
                    el.style.opacity = '0.7';
                }
            }, 2000);
        }
    }
    
    function getNextId() {
        if(threads.length === 0) return Date.now();
        return Math.max(...threads.map(t => t.id)) + 1;
    }
    
    function handleImageUpload(file, callback) {
        if(!file) {
            callback(null);
            return;
        }
        if(file.size > 5 * 1024 * 1024) {
            alert('❌ Файл слишком большой! Максимум 5MB');
            callback(null);
            return;
        }
        const reader = new FileReader();
        reader.onload = function(e) {
            callback(e.target.result);
        };
        reader.onerror = function() {
            alert('❌ Ошибка загрузки файла');
            callback(null);
        };
        reader.readAsDataURL(file);
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
        setTimeout(() => refreshWithState(), 1500);
    }
    
    async function addReply(threadId, name, comment, fileData = null) {
        const thread = threads.find(t => t.id === parseInt(threadId));
        if(thread) {
            const reply = {
                name: name || 'Аноним',
                comment: comment,
                fileData: fileData || '',
                timestamp: new Date().toISOString()
            };
            thread.replies.push(reply);
            render();
            
            await saveToSheets(thread);
            updateSyncStatus('✅ Ответ отправлен', false);
            setTimeout(() => refreshWithState(), 1500);
        }
    }
    
    function saveOpenForms() {
        openReplyForms.clear();
        replyTexts.clear();
        replyNames.clear();
        replyFiles.clear();
        
        document.querySelectorAll('.reply-form').forEach(form => {
            if(form.style.display === 'block') {
                const id = form.id.replace('reply-form-', '');
                openReplyForms.add(id);
                
                const textarea = document.getElementById(`replyComment-${id}`);
                const nameInput = document.getElementById(`replyName-${id}`);
                const fileInputReply = document.getElementById(`replyFile-${id}`);
                if(textarea) replyTexts.set(id, textarea.value);
                if(nameInput) replyNames.set(id, nameInput.value);
                if(fileInputReply && fileInputReply.files[0]) {
                    replyFiles.set(id, fileInputReply.files[0]);
                }
            }
        });
    }
    
    function restoreOpenForms() {
        openReplyForms.forEach(id => {
            const form = document.getElementById(`reply-form-${id}`);
            if(form) {
                form.style.display = 'block';
                
                const textarea = document.getElementById(`replyComment-${id}`);
                const nameInput = document.getElementById(`replyName-${id}`);
                if(textarea && replyTexts.has(id)) textarea.value = replyTexts.get(id);
                if(nameInput && replyNames.has(id)) nameInput.value = replyNames.get(id);
                
                // Восстанавливаем имя файла
                const fileSpan = document.getElementById(`replyFileChosen-${id}`);
                if(fileSpan && replyFiles.has(id)) {
                    fileSpan.textContent = replyFiles.get(id).name;
                }
            }
        });
        resetReplyCaptcha();
    }
    
    function render() {
        const c = document.getElementById('threadsContainer');
        if(!c) return;
        
        if(!threads.length) {
            c.innerHTML = '<div class="loading-message">Нет тредов. Создайте первый!</div>';
            updateStats();
            return;
        }
        
        const sortedThreads = [...threads].sort((a, b) => {
            if(a.pinned && !b.pinned) return -1;
            if(!a.pinned && b.pinned) return 1;
            return new Date(b.timestamp) - new Date(a.timestamp);
        });
        
        let html = '';
        for(let t of sortedThreads) {
            let dateStr = 'Дата неизвестна';
            try {
                if(t.timestamp) {
                    dateStr = new Date(t.timestamp).toLocaleString();
                }
            } catch(e) {
                dateStr = t.timestamp || 'Дата неизвестна';
            }
            
            const pinnedIcon = t.pinned ? '📌 ' : '';
            
            html += `<div class="thread-card" data-thread-id="${t.id}" style="${t.pinned ? 'border-left: 4px solid #ff9800;' : ''}">
                <div class="thread-header">
                    <span class="thread-title">${pinnedIcon}${escape(t.subject || 'Без темы')}</span>
                    <span class="thread-info">
                        №${t.id} ${escape(t.name || 'Аноним')} ${dateStr}
                    </span>
                </div>
                ${t.fileData ? `<div class="thread-image-container"><img class="thread-image" src="${t.fileData}" loading="lazy" style="max-width:100%; max-height:300px;"></div>` : ''}
                <div class="thread-comment">${escape(t.comment).replace(/\n/g, '<br>')}</div>
                <button class="reply-btn" data-id="${t.id}">💬 Ответить</button>
                <div class="replies" id="replies-${t.id}">
                    ${renderReplies(t.replies)}
                </div>
                <div class="reply-form" id="reply-form-${t.id}" style="display:none; margin-top:10px; padding:10px; background:#f9f9f9; border:1px solid #d9bfb7;">
                    <input type="text" id="replyName-${t.id}" placeholder="Имя (опционально)" maxlength="30" style="width:100%; margin-bottom:5px; padding:5px;">
                    <textarea id="replyComment-${t.id}" rows="2" placeholder="Текст ответа..." maxlength="500" style="width:100%; margin-bottom:5px; padding:5px;"></textarea>
                    
                    <!-- Прикрепление файла в ответе -->
                    <div style="margin:8px 0;">
                        <label for="replyFile-${t.id}" style="background:#eee; padding:4px 10px; border:1px solid #d9bfb7; border-radius:3px; cursor:pointer; font-size:12px;">📎 Прикрепить файл</label>
                        <input type="file" id="replyFile-${t.id}" accept="image/*" style="display:none;">
                        <span id="replyFileChosen-${t.id}" style="margin-left:8px; font-size:11px; color:#666;">Файл не выбран</span>
                    </div>
                    
                    <!-- Капча для ответа -->
                    <div style="margin:8px 0; display:flex; gap:8px; align-items:center;">
                        <span id="replyCaptchaQuestion-${t.id}" style="background:#eee; padding:4px 8px; font-family:monospace; font-weight:bold;">загрузка...</span>
                        <input type="text" id="replyCaptchaAnswer-${t.id}" placeholder="Ответ" style="padding:4px; width:80px;">
                    </div>
                    
                    <div style="display:flex; gap:8px; margin-top:5px;">
                        <button class="submit-reply" data-id="${t.id}" style="background:#d4af37; border:none; padding:5px 12px; cursor:pointer;">✉️ Отправить</button>
                        <button class="cancel-reply" data-id="${t.id}" style="background:#ccc; border:none; padding:5px 12px; cursor:pointer;">❌ Отмена</button>
                    </div>
                </div>
            </div>`;
        }
        c.innerHTML = html;
        attachEvents();
        updateStats();
        restoreOpenForms();
    }
    
    function renderReplies(r) {
        if(!r || !r.length) return '<div style="color:#789922; padding:8px 0;">💬 Нет ответов. Будь первым!</div>';
        let html = '<div style="margin-top:10px; border-top:1px solid #d9bfb7; padding-top:8px;">';
        for(let rep of r) {
            let dateStr = 'Дата неизвестна';
            try {
                if(rep.timestamp) {
                    dateStr = new Date(rep.timestamp).toLocaleString();
                }
            } catch(e) {
                dateStr = rep.timestamp || 'Дата неизвестна';
            }
            html += `<div class="reply" style="background:#fff8f0; margin:5px 0; padding:6px; border-left:3px solid #d9bfb7;">
                <strong style="color:#800;">${escape(rep.name || 'Аноним')}</strong> 
                <span style="color:#789922; font-size:10px;">${dateStr}</span>
                ${rep.fileData ? `<div style="margin-top:5px;"><img src="${rep.fileData}" style="max-width:150px; max-height:150px; border:1px solid #d9bfb7;"></div>` : ''}
                <div style="margin-top:4px;">${escape(rep.comment)}</div>
            </div>`;
        }
        html += '</div>';
        return html;
    }
    
    function attachEvents() {
        // Инициализация капчи для каждой формы ответа
        document.querySelectorAll('.reply-form').forEach(form => {
            const id = form.id.replace('reply-form-', '');
            const captchaQ = document.getElementById(`replyCaptchaQuestion-${id}`);
            const captchaA = document.getElementById(`replyCaptchaAnswer-${id}`);
            if(captchaQ && captchaA) {
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
                captchaQ.textContent = q + ' = ?';
                captchaQ.dataset.answer = a;
            }
        });
        
        // Отображение имени файла для ответов
        document.querySelectorAll('[id^="replyFile-"]').forEach(input => {
            const id = input.id.replace('replyFile-', '');
            input.addEventListener('change', function() {
                const span = document.getElementById(`replyFileChosen-${id}`);
                if(span) {
                    span.textContent = this.files[0] ? this.files[0].name : 'Файл не выбран';
                }
            });
        });
        
        document.querySelectorAll('.reply-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.preventDefault();
                const id = btn.dataset.id;
                const form = document.getElementById(`reply-form-${id}`);
                if(form) {
                    const isOpen = form.style.display === 'block';
                    document.querySelectorAll('.reply-form').forEach(f => {
                        if(f.style.display === 'block') {
                            const fid = f.id.replace('reply-form-', '');
                            const textarea = document.getElementById(`replyComment-${fid}`);
                            const nameInput = document.getElementById(`replyName-${fid}`);
                            const fileInputReply = document.getElementById(`replyFile-${fid}`);
                            if(textarea) replyTexts.set(fid, textarea.value);
                            if(nameInput) replyNames.set(fid, nameInput.value);
                            if(fileInputReply && fileInputReply.files[0]) {
                                replyFiles.set(fid, fileInputReply.files[0]);
                            }
                        }
                        f.style.display = 'none';
                    });
                    openReplyForms.clear();
                    
                    if(!isOpen) {
                        form.style.display = 'block';
                        openReplyForms.add(id);
                        
                        const textarea = document.getElementById(`replyComment-${id}`);
                        const nameInput = document.getElementById(`replyName-${id}`);
                        if(textarea && replyTexts.has(id)) textarea.value = replyTexts.get(id);
                        if(nameInput && replyNames.has(id)) nameInput.value = replyNames.get(id);
                        
                        // Обновляем капчу
                        const captchaQ = document.getElementById(`replyCaptchaQuestion-${id}`);
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
                        captchaQ.textContent = q + ' = ?';
                        captchaQ.dataset.answer = a;
                        const captchaA = document.getElementById(`replyCaptchaAnswer-${id}`);
                        if(captchaA) captchaA.value = '';
                    }
                }
            };
        });
        
        document.querySelectorAll('.cancel-reply').forEach(btn => {
            btn.onclick = () => {
                const form = document.getElementById(`reply-form-${btn.dataset.id}`);
                if(form) {
                    form.style.display = 'none';
                    openReplyForms.delete(btn.dataset.id);
                    replyTexts.delete(btn.dataset.id);
                    replyNames.delete(btn.dataset.id);
                    replyFiles.delete(btn.dataset.id);
                }
            };
        });
        
        document.querySelectorAll('.submit-reply').forEach(btn => {
            btn.onclick = async () => {
                const id = btn.dataset.id;
                
                // Проверка капчи ответа
                const captchaQ = document.getElementById(`replyCaptchaQuestion-${id}`);
                const captchaA = document.getElementById(`replyCaptchaAnswer-${id}`);
                if(captchaA && captchaQ) {
                    const userAnswer = captchaA.value.trim();
                    const correctAnswer = captchaQ.dataset.answer;
                    if(userAnswer !== correctAnswer) {
                        alert('❌ Неправильный ответ капчи!');
                        // Обновляем капчу
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
                        captchaQ.textContent = q + ' = ?';
                        captchaQ.dataset.answer = a;
                        captchaA.value = '';
                        return;
                    }
                }
                
                const nameInput = document.getElementById(`replyName-${id}`);
                const commentInput = document.getElementById(`replyComment-${id}`);
                const fileInputReply = document.getElementById(`replyFile-${id}`);
                const name = nameInput ? nameInput.value.trim() : '';
                const comment = commentInput ? commentInput.value.trim() : '';
                
                if(!comment) {
                    alert('❌ Введите текст ответа!');
                    return;
                }
                
                const originalText = btn.textContent;
                btn.disabled = true;
                btn.textContent = '⏳ Отправка...';
                
                if(fileInputReply && fileInputReply.files[0]) {
                    handleImageUpload(fileInputReply.files[0], async (fileData) => {
                        await addReply(id, name, comment, fileData);
                        if(nameInput) nameInput.value = '';
                        if(commentInput) commentInput.value = '';
                        if(fileInputReply) {
                            fileInputReply.value = '';
                            const span = document.getElementById(`replyFileChosen-${id}`);
                            if(span) span.textContent = 'Файл не выбран';
                        }
                        replyTexts.delete(id);
                        replyNames.delete(id);
                        replyFiles.delete(id);
                        const form = document.getElementById(`reply-form-${id}`);
                        if(form) form.style.display = 'none';
                        openReplyForms.delete(id);
                        btn.disabled = false;
                        btn.textContent = originalText;
                    });
                } else {
                    await addReply(id, name, comment, null);
                    if(nameInput) nameInput.value = '';
                    if(commentInput) commentInput.value = '';
                    replyTexts.delete(id);
                    replyNames.delete(id);
                    const form = document.getElementById(`reply-form-${id}`);
                    if(form) form.style.display = 'none';
                    openReplyForms.delete(id);
                    btn.disabled = false;
                    btn.textContent = originalText;
                }
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
    
    const form = document.getElementById('newThreadForm');
    if(form) {
        form.onsubmit = async (e) => {
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
                alert('❌ Введите текст треда!');
                return;
            }
            
            const submitBtn = form.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = '⏳ Создание...';
            
            const file = imageEl && imageEl.files[0];
            if(file) {
                handleImageUpload(file, async (fileData) => {
                    await addThread(subject, name, comment, fileData);
                    if(subjectEl) subjectEl.value = '';
                    if(nameEl) nameEl.value = '';
                    if(commentEl) commentEl.value = '';
                    if(imageEl) imageEl.value = '';
                    const fileNameSpan = document.getElementById('fileChosen');
                    if(fileNameSpan) fileNameSpan.textContent = 'Файл не выбран';
                    submitBtn.disabled = false;
                    submitBtn.textContent = originalText;
                });
            } else {
                await addThread(subject, name, comment, null);
                if(subjectEl) subjectEl.value = '';
                if(nameEl) nameEl.value = '';
                if(commentEl) commentEl.value = '';
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        };
    }
    
    async function refreshWithState() {
        saveOpenForms();
        await loadFromSheets();
    }
    
    initCaptcha();
    loadFromSheets();
    setInterval(refreshWithState, 15000);
})();
