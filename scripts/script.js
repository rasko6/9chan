(function(){
    let threads = [];
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
    
    // Отображение имени файла
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
        setTimeout(() => loadFromSheets(), 1000);
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
            setTimeout(() => loadFromSheets(), 1000);
        }
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
                    
                    <!-- Прикрепление файла -->
                    <div style="margin:8px 0;">
                        <label for="replyFile-${t.id}" style="background:#eee; padding:4px 10px; border:1px solid #d9bfb7; border-radius:3px; cursor:pointer;">📎 Прикрепить файл</label>
                        <input type="file" id="replyFile-${t.id}" accept="image/*" style="display:none;">
                        <span id="replyFileName-${t.id}" style="margin-left:8px; font-size:11px;">Файл не выбран</span>
                    </div>
                    
                    <!-- Капча для ответа -->
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
        
        // Привязываем события
        attachEvents();
        
        const sc = document.getElementById('threadCount');
        if(sc) sc.innerText = threads.length;
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
        // Генерация капчи для каждой формы
        document.querySelectorAll('.reply-form').forEach(form => {
            const id = form.id.replace('reply-form-', '');
            const captchaQ = document.getElementById(`replyCaptchaQ-${id}`);
            if(captchaQ) {
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
        
        // Показ имени файла
        document.querySelectorAll('[id^="replyFile-"]').forEach(input => {
            const id = input.id.replace('replyFile-', '');
            input.addEventListener('change', function() {
                const span = document.getElementById(`replyFileName-${id}`);
                if(span) span.textContent = this.files[0] ? this.files[0].name : 'Файл не выбран';
            });
        });
        
        // Кнопки "Ответить"
        document.querySelectorAll('.reply-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.preventDefault();
                const id = btn.dataset.id;
                const form = document.getElementById(`reply-form-${id}`);
                if(form) {
                    form.style.display = form.style.display === 'none' ? 'block' : 'none';
                    // Обновляем капчу при открытии
                    const captchaQ = document.getElementById(`replyCaptchaQ-${id}`);
                    if(captchaQ && form.style.display === 'block') {
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
                        const captchaA = document.getElementById(`replyCaptchaA-${id}`);
                        if(captchaA) captchaA.value = '';
                    }
                }
            };
        });
        
        // Кнопки "Отмена"
        document.querySelectorAll('.cancel-reply').forEach(btn => {
            btn.onclick = () => {
                const form = document.getElementById(`reply-form-${btn.dataset.id}`);
                if(form) form.style.display = 'none';
            };
        });
        
        // Кнопки "Отправить"
        document.querySelectorAll('.submit-reply').forEach(btn => {
            btn.onclick = () => {
                const id = btn.dataset.id;
                
                // Проверка капчи
                const captchaQ = document.getElementById(`replyCaptchaQ-${id}`);
                const captchaA = document.getElementById(`replyCaptchaA-${id}`);
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
                btn.textContent = '⏳...';
                
                if(fileInputReply && fileInputReply.files[0]) {
                    handleImageUpload(fileInputReply.files[0], async (fileData) => {
                        await addReply(id, name, comment, fileData);
                        if(nameInput) nameInput.value = '';
                        if(commentInput) commentInput.value = '';
                        fileInputReply.value = '';
                        const span = document.getElementById(`replyFileName-${id}`);
                        if(span) span.textContent = 'Файл не выбран';
                        const form = document.getElementById(`reply-form-${id}`);
                        if(form) form.style.display = 'none';
                        btn.disabled = false;
                        btn.textContent = originalText;
                    });
                } else {
                    addReply(id, name, comment, null);
                    if(nameInput) nameInput.value = '';
                    if(commentInput) commentInput.value = '';
                    const form = document.getElementById(`reply-form-${id}`);
                    if(form) form.style.display = 'none';
                    btn.disabled = false;
                    btn.textContent = originalText;
                }
            };
        });
    }
    
    function escape(s) {
        if(!s) return '';
        return s.replace(/[&<>]/g, m => m === '&' ? '&amp;' : m === '<' ? '&lt;' : '&gt;');
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
                alert('❌ Введите текст треда!');
                return;
            }
            
            const submitBtn = form.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = '⏳...';
            
            const file = imageEl && imageEl.files[0];
            if(file) {
                handleImageUpload(file, async (fileData) => {
                    await addThread(subject, name, comment, fileData);
                    if(subjectEl) subjectEl.value = '';
                    if(nameEl) nameEl.value = '';
                    if(commentEl) commentEl.value = '';
                    if(imageEl) imageEl.value = '';
                    const fn = document.getElementById('fileChosen');
                    if(fn) fn.textContent = 'Файл не выбран';
                    submitBtn.disabled = false;
                    submitBtn.textContent = originalText;
                });
            } else {
                addThread(subject, name, comment, null);
                if(subjectEl) subjectEl.value = '';
                if(nameEl) nameEl.value = '';
                if(commentEl) commentEl.value = '';
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        };
    }
    
    initCaptcha();
    loadFromSheets();
    setInterval(loadFromSheets, 10000);
})();
