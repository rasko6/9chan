(function(){
    let threads = [];
    let openReplyForms = new Set();
    let replyTexts = new Map();
    let replyNames = new Map();
    let replyFileData = new Map(); // Храним base64 файлов
    let replyCaptchaAnswers = new Map(); // Храним правильные ответы капчи
    const BOARD = window.CURRENT_BOARD || 'b';
    const API_URL = 'https://script.google.com/macros/s/AKfycbxwH31mrpRnc8fISbJjx9ofaueHKkTcjBqTce_w3xh2tsaw5p633DXY9N6tPrgjwE4H/exec';
    
    // Капча для создания треда
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
            alert('❌ Неправильный ответ!');
            resetCaptcha();
            return false;
        }
        resetCaptcha();
        return true;
    }
    
    function initCaptcha() {
        captchaQuestionElement = document.getElementById('captchaQuestion');
        captchaAnswerElement = document.getElementById('captchaAnswer');
        resetCaptcha();
    }
    
    // Функция для генерации капчи ответа
    function generateReplyCaptcha() {
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
    
    async function loadFromSheets() {
        try {
            const res = await fetch(`${API_URL}?board=${BOARD}`);
            const allThreads = await res.json();
            threads = allThreads.filter(t => t.board === BOARD);
            render();
            const statusEl = document.getElementById('syncStatusText');
            if(statusEl) statusEl.textContent = '✅ Онлайн';
        } catch(e) {
            console.error('Load error:', e);
            const statusEl = document.getElementById('syncStatusText');
            if(statusEl) statusEl.textContent = '⚠️ Офлайн';
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
    
    function getNextId() {
        if(threads.length === 0) return Date.now();
        return Math.max(...threads.map(t => t.id)) + 1;
    }
    
    function fileToBase64(file) {
        return new Promise((resolve) => {
            if(!file) {
                resolve(null);
                return;
            }
            if(file.size > 5 * 1024 * 1024) {
                alert('❌ Файл слишком большой! Максимум 5MB');
                resolve(null);
                return;
            }
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => {
                alert('❌ Ошибка чтения файла');
                resolve(null);
            };
            reader.readAsDataURL(file);
        });
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
        setTimeout(() => loadFromSheets(), 1500);
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
            setTimeout(() => loadFromSheets(), 1500);
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
    
    // Сохраняем состояние всех форм
    function saveAllFormStates() {
        openReplyForms.clear();
        replyTexts.clear();
        replyNames.clear();
        replyFileData.clear();
        replyCaptchaAnswers.clear();
        
        document.querySelectorAll('.reply-form').forEach(form => {
            if(form.style.display === 'block') {
                const id = form.id.replace('reply-form-', '');
                openReplyForms.add(id);
                
                const textarea = document.getElementById(`replyComment-${id}`);
                const nameInput = document.getElementById(`replyName-${id}`);
                const fileInput = document.getElementById(`replyFile-${id}`);
                const captchaQ = document.getElementById(`replyCaptchaQ-${id}`);
                
                if(textarea) replyTexts.set(id, textarea.value);
                if(nameInput) replyNames.set(id, nameInput.value);
                if(fileInput && fileInput.files && fileInput.files[0]) {
                    // Сохраняем файл как base64
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        replyFileData.set(id, e.target.result);
                    };
                    reader.readAsDataURL(fileInput.files[0]);
                }
                if(captchaQ && captchaQ.dataset.answer) {
                    replyCaptchaAnswers.set(id, {
                        question: captchaQ.textContent,
                        answer: captchaQ.dataset.answer
                    });
                }
            }
        });
    }
    
    // Восстанавливаем состояние форм
    function restoreAllFormStates() {
        openReplyForms.forEach(id => {
            const form = document.getElementById(`reply-form-${id}`);
            if(form) {
                form.style.display = 'block';
                
                const textarea = document.getElementById(`replyComment-${id}`);
                const nameInput = document.getElementById(`replyName-${id}`);
                const fileSpan = document.getElementById(`replyFileName-${id}`);
                const captchaQ = document.getElementById(`replyCaptchaQ-${id}`);
                const captchaA = document.getElementById(`replyCaptchaA-${id}`);
                
                if(textarea && replyTexts.has(id)) textarea.value = replyTexts.get(id);
                if(nameInput && replyNames.has(id)) nameInput.value = replyNames.get(id);
                
                // Восстанавливаем капчу
                if(captchaQ && replyCaptchaAnswers.has(id)) {
                    const saved = replyCaptchaAnswers.get(id);
                    captchaQ.textContent = saved.question;
                    captchaQ.dataset.answer = saved.answer;
                    if(captchaA) captchaA.value = '';
                } else if(captchaQ) {
                    const newCaptcha = generateReplyCaptcha();
                    captchaQ.textContent = newCaptcha.question + ' = ?';
                    captchaQ.dataset.answer = newCaptcha.answer;
                    if(captchaA) captchaA.value = '';
                }
                
                // Восстанавливаем имя файла если есть
                if(fileSpan && replyFileData.has(id)) {
                    fileSpan.textContent = 'Файл выбран';
                } else if(fileSpan) {
                    fileSpan.textContent = 'Файл не выбран';
                }
            }
        });
    }
    
    function render() {
        const c = document.getElementById('threadsContainer');
        if(!c) return;
        
        if(!threads.length) {
            c.innerHTML = '<div class="loading-message">Нет тредов. Создайте первый!</div>';
            const sc = document.getElementById('threadCount');
            if(sc) sc.innerText = '0';
            return;
        }
        
        let html = '';
        for(let t of threads) {
            let dateStr = 'Дата неизвестна';
            try {
                if(t.timestamp) dateStr = new Date(t.timestamp).toLocaleString();
            } catch(e) { dateStr = t.timestamp || 'Дата неизвестна'; }
            
            html += `<div class="thread-card" style="margin-bottom:15px; border:1px solid #d9bfb7; padding:10px; background:#faf0e6;">
                <div style="display:flex; justify-content:space-between; border-bottom:1px solid #d9bfb7; padding-bottom:5px; margin-bottom:10px;">
                    <span style="font-weight:bold; color:#800;">${escape(t.subject || 'Без темы')}</span>
                    <span style="color:#789922; font-size:11px;">№${t.id} ${escape(t.name || 'Аноним')} ${dateStr}</span>
                </div>
                ${t.fileData ? `<div style="margin:10px 0;"><img src="${t.fileData}" style="max-width:100%; max-height:300px; border:1px solid #d9bfb7;"></div>` : ''}
                <div style="background:#fff; padding:10px; border:1px solid #d9bfb7; white-space:pre-wrap;">${escape(t.comment).replace(/\n/g, '<br>')}</div>
                <button class="reply-btn" data-id="${t.id}" style="margin-top:10px; background:#eee; border:1px solid #d9bfb7; padding:3px 10px; cursor:pointer;">💬 Ответить</button>
                <div class="replies" id="replies-${t.id}" style="margin-top:10px; padding-left:15px; border-left:2px solid #d9bfb7;">
                    ${renderReplies(t.replies)}
                </div>
                <div class="reply-form" id="reply-form-${t.id}" style="display:none; margin-top:10px; padding:10px; background:#f9f9f9; border:1px solid #d9bfb7;">
                    <input type="text" id="replyName-${t.id}" placeholder="Имя (опционально)" style="width:100%; margin-bottom:5px; padding:5px;">
                    <textarea id="replyComment-${t.id}" rows="2" placeholder="Текст ответа..." style="width:100%; margin-bottom:5px; padding:5px;"></textarea>
                    
                    <div style="margin:8px 0;">
                        <label for="replyFile-${t.id}" style="background:#eee; padding:4px 10px; border:1px solid #d9bfb7; border-radius:3px; cursor:pointer;">📎 Прикрепить файл</label>
                        <input type="file" id="replyFile-${t.id}" accept="image/*" style="display:none;">
                        <span id="replyFileName-${t.id}" style="margin-left:8px; font-size:11px;">Файл не выбран</span>
                    </div>
                    
                    <div style="margin:8px 0; display:flex; gap:8px; align-items:center;">
                        <span id="replyCaptchaQ-${t.id}" style="background:#eee; padding:4px 8px;">загрузка...</span>
                        <input type="text" id="replyCaptchaA-${t.id}" placeholder="Ответ" style="padding:4px; width:80px;">
                    </div>
                    
                    <div style="display:flex; gap:8px;">
                        <button class="submit-reply" data-id="${t.id}" style="background:#d4af37; border:none; padding:5px 12px; cursor:pointer;">✉️ Отправить</button>
                        <button class="cancel-reply" data-id="${t.id}" style="background:#ccc; border:none; padding:5px 12px; cursor:pointer;">❌ Отмена</button>
                    </div>
                </div>
            </div>`;
        }
        c.innerHTML = html;
        
        attachEvents();
        
        const sc = document.getElementById('threadCount');
        if(sc) sc.innerText = threads.length;
        
        // Восстанавливаем открытые формы после рендера
        setTimeout(() => restoreAllFormStates(), 50);
    }
    
    function renderReplies(r) {
        if(!r || !r.length) return '<div style="color:#789922; padding:5px 0;">💬 Нет ответов</div>';
        let html = '';
        for(let rep of r) {
            let dateStr = 'Дата неизвестна';
            try {
                if(rep.timestamp) dateStr = new Date(rep.timestamp).toLocaleString();
            } catch(e) { dateStr = rep.timestamp || 'Дата неизвестна'; }
            html += `<div style="background:#fff8f0; margin:5px 0; padding:6px; border-left:3px solid #d9bfb7;">
                <strong style="color:#800;">${escape(rep.name || 'Аноним')}</strong> 
                <span style="color:#789922; font-size:10px;">${dateStr}</span>
                ${rep.fileData ? `<div style="margin-top:5px;"><img src="${rep.fileData}" style="max-width:100px; max-height:100px;"></div>` : ''}
                <div style="margin-top:4px;">${escape(rep.comment)}</div>
            </div>`;
        }
        return html;
    }
    
    function attachEvents() {
        // Обработчики для файлов в ответах
        document.querySelectorAll('[id^="replyFile-"]').forEach(input => {
            const id = input.id.replace('replyFile-', '');
            const newInput = input.cloneNode(true);
            input.parentNode.replaceChild(newInput, input);
            
            newInput.addEventListener('change', function(e) {
                const span = document.getElementById(`replyFileName-${id}`);
                if(span && this.files && this.files[0]) {
                    span.textContent = this.files[0].name;
                } else if(span) {
                    span.textContent = 'Файл не выбран';
                }
            });
        });
        
        // Инициализация капчи для форм ответа
        document.querySelectorAll('.reply-form').forEach(form => {
            const id = form.id.replace('reply-form-', '');
            const captchaQ = document.getElementById(`replyCaptchaQ-${id}`);
            if(captchaQ && !captchaQ.dataset.answer) {
                const newCaptcha = generateReplyCaptcha();
                captchaQ.textContent = newCaptcha.question + ' = ?';
                captchaQ.dataset.answer = newCaptcha.answer;
            }
        });
        
        // Кнопки "Ответить"
        document.querySelectorAll('.reply-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.preventDefault();
                const id = btn.dataset.id;
                const form = document.getElementById(`reply-form-${id}`);
                if(form) {
                    const isVisible = form.style.display === 'block';
                    document.querySelectorAll('.reply-form').forEach(f => f.style.display = 'none');
                    form.style.display = isVisible ? 'none' : 'block';
                    
                    if(!isVisible) {
                        openReplyForms.add(id);
                        const captchaQ = document.getElementById(`replyCaptchaQ-${id}`);
                        if(captchaQ) {
                            const newCaptcha = generateReplyCaptcha();
                            captchaQ.textContent = newCaptcha.question + ' = ?';
                            captchaQ.dataset.answer = newCaptcha.answer;
                            const captchaA = document.getElementById(`replyCaptchaA-${id}`);
                            if(captchaA) captchaA.value = '';
                        }
                    } else {
                        openReplyForms.delete(id);
                    }
                }
            };
        });
        
        // Кнопки "Отмена"
        document.querySelectorAll('.cancel-reply').forEach(btn => {
            btn.onclick = () => {
                const form = document.getElementById(`reply-form-${btn.dataset.id}`);
                if(form) {
                    form.style.display = 'none';
                    openReplyForms.delete(btn.dataset.id);
                }
            };
        });
        
        // Кнопки "Отправить ответ"
        document.querySelectorAll('.submit-reply').forEach(btn => {
            btn.onclick = async () => {
                const id = btn.dataset.id;
                
                const captchaQ = document.getElementById(`replyCaptchaQ-${id}`);
                const captchaA = document.getElementById(`replyCaptchaA-${id}`);
                if(captchaA && captchaQ) {
                    const userAnswer = captchaA.value.trim();
                    const correctAnswer = captchaQ.dataset.answer;
                    if(userAnswer !== correctAnswer) {
                        alert('❌ Неправильный ответ капчи!');
                        const newCaptcha = generateReplyCaptcha();
                        captchaQ.textContent = newCaptcha.question + ' = ?';
                        captchaQ.dataset.answer = newCaptcha.answer;
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
                
                btn.disabled = true;
                btn.textContent = '⏳...';
                
                let fileData = null;
                if(fileInputReply && fileInputReply.files && fileInputReply.files[0]) {
                    fileData = await fileToBase64(fileInputReply.files[0]);
                }
                
                await addReply(id, name, comment, fileData);
                
                if(nameInput) nameInput.value = '';
                if(commentInput) commentInput.value = '';
                if(fileInputReply) {
                    fileInputReply.value = '';
                    const span = document.getElementById(`replyFileName-${id}`);
                    if(span) span.textContent = 'Файл не выбран';
                }
                
                const form = document.getElementById(`reply-form-${id}`);
                if(form) form.style.display = 'none';
                openReplyForms.delete(id);
                
                btn.disabled = false;
                btn.textContent = '✉️ Отправить';
            };
        });
    }
    
    function escape(s) {
        if(!s) return '';
        return s.replace(/[&<>]/g, m => m === '&' ? '&amp;' : m === '<' ? '&lt;' : '&gt;');
    }
    
    // Обработчик для файла при создании треда
    const threadFileInput = document.getElementById('threadImage');
    if(threadFileInput) {
        const newFileInput = threadFileInput.cloneNode(true);
        threadFileInput.parentNode.replaceChild(newFileInput, threadFileInput);
        
        newFileInput.addEventListener('change', function() {
            const fileNameSpan = document.getElementById('fileChosen');
            if(fileNameSpan && this.files && this.files[0]) {
                fileNameSpan.textContent = this.files[0].name;
            } else if(fileNameSpan) {
                fileNameSpan.textContent = 'Файл не выбран';
            }
        });
    }
    
    // Обработчик создания треда
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
            submitBtn.textContent = '⏳...';
            
            let fileData = null;
            if(imageEl && imageEl.files && imageEl.files[0]) {
                fileData = await fileToBase64(imageEl.files[0]);
            }
            
            await addThread(subject, name, comment, fileData);
            
            if(subjectEl) subjectEl.value = '';
            if(nameEl) nameEl.value = '';
            if(commentEl) commentEl.value = '';
            if(imageEl) {
                imageEl.value = '';
                const fn = document.getElementById('fileChosen');
                if(fn) fn.textContent = 'Файл не выбран';
            }
            
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        };
    }
    
    // Обновление с сохранением состояния
    async function refreshWithState() {
        saveAllFormStates();
        await loadFromSheets();
    }
    
    initCaptcha();
    loadFromSheets();
    setInterval(refreshWithState, 10000);
})();
