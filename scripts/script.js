(function() {
    let threadsData = [];
    let nextThreadId = 1;
    let nextPostId = 1;
    let isSyncing = false;
    let syncQueue = [];

    const GIST_ID = '769dce8a044d2d8dc2b21a2f60719c58';
    
    function decryptToken(encoded) {
        let result = '';
        const key = 0x42;
        for (let i = 0; i < encoded.length; i++) {
            result += String.fromCharCode(encoded.charCodeAt(i) ^ key);
        }
        return result;
    }
    
    const ENCRYPTED_TOKEN = `%*2+( )*r5
*s0`;
    const GITHUB_TOKEN = decryptToken(ENCRYPTED_TOKEN);
    
    const GIST_URL = `https://api.github.com/gists/${GIST_ID}`;
    const GIST_RAW_URL = `https://gist.githubusercontent.com/AlgorithmIntensity/${GIST_ID}/raw/9chan_data.json`;

    function updateSyncStatus(text, isError = false) {
        const statusEl = document.getElementById('syncStatusText');
        if (statusEl) {
            statusEl.textContent = text;
            statusEl.className = isError ? 'sync-status error' : 'sync-status';
            if (!isError) {
                setTimeout(() => {
                    if (statusEl.textContent === text) {
                        statusEl.textContent = '✅ Синхронизировано';
                        setTimeout(() => {
                            if (statusEl.textContent === '✅ Синхронизировано') {
                                statusEl.textContent = '🔄 Готово';
                            }
                        }, 2000);
                    }
                }, 1500);
            }
        }
    }

    async function loadFromGist() {
        try {
            updateSyncStatus('📥 Загрузка...');
            const response = await fetch(GIST_RAW_URL);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            
            if (data && data.threads) {
                threadsData = data.threads;
                nextThreadId = data.nextThreadId || Math.max(...threadsData.map(t => t.id), 0) + 1;
                nextPostId = data.nextPostId || (Math.max(...threadsData.flatMap(t => [t.id, ...t.replies.map(r => r.id)]), 0) + 1);
                renderAllThreads();
                updateSyncStatus('✅ Загружено');
            } else {
                loadDemoData();
            }
        } catch (error) {
            console.error('Ошибка:', error);
            updateSyncStatus('⚠️ Офлайн', true);
            loadFromLocal();
        }
    }

    async function saveToGist() {
        if (isSyncing) {
            syncQueue.push(saveToGist);
            return;
        }
        
        isSyncing = true;
        try {
            updateSyncStatus('💾 Сохранение...');
            
            const dataToSave = {
                threads: threadsData,
                nextThreadId: nextThreadId,
                nextPostId: nextPostId,
                lastUpdate: new Date().toISOString()
            };
            
            const response = await fetch(GIST_URL, {
                method: 'PATCH',
                headers: {
                    'Authorization': `token ${GITHUB_TOKEN}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/vnd.github.v3+json'
                },
                body: JSON.stringify({
                    files: {
                        '9chan_data.json': {
                            content: JSON.stringify(dataToSave, null, 2)
                        }
                    }
                })
            });
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            updateSyncStatus('✅ Сохранено');
            saveToLocal();
        } catch (error) {
            console.error('Ошибка:', error);
            updateSyncStatus('⚠️ Ошибка', true);
            saveToLocal();
        } finally {
            isSyncing = false;
            if (syncQueue.length > 0) {
                const next = syncQueue.shift();
                next();
            }
        }
    }

    function saveToLocal() {
        localStorage.setItem('9chan_threads_backup', JSON.stringify(threadsData));
        localStorage.setItem('9chan_nextThreadId_backup', nextThreadId);
        localStorage.setItem('9chan_nextPostId_backup', nextPostId);
    }

    function loadFromLocal() {
        const stored = localStorage.getItem('9chan_threads_backup');
        if (stored && stored !== '[]') {
            threadsData = JSON.parse(stored);
            const storedThreadId = localStorage.getItem('9chan_nextThreadId_backup');
            const storedPostId = localStorage.getItem('9chan_nextPostId_backup');
            if (storedThreadId) nextThreadId = parseInt(storedThreadId, 10);
            if (storedPostId) nextPostId = parseInt(storedPostId, 10);
            renderAllThreads();
            updateSyncStatus('📱 Локально');
        } else {
            loadDemoData();
        }
    }

    function loadDemoData() {
        const demoThreads = [
            {
                id: 1,
                subject: 'Добро пожаловать на 9chan',
                name: 'Администрация',
                comment: '🇩🇪 Willkommen auf 9chan! 🇩🇪\n\nЭто имиджборд с немецким стилем. Все данные синхронизируются через GitHub Gist!\n\n• Создавайте треды\n• Прикрепляйте изображения\n• Отвечайте в тредах\n\nВсе изменения автоматически сохраняются на сервер.',
                fileData: null,
                fileName: null,
                fileType: null,
                timestamp: new Date().toLocaleString(),
                replies: [
                    {
                        id: 1,
                        name: 'Первый анон',
                        comment: 'Отличный борд! Синхронизация работает 🔥',
                        fileData: null,
                        fileName: null,
                        fileType: null,
                        timestamp: new Date().toLocaleString()
                    }
                ]
            }
        ];
        threadsData = demoThreads;
        nextThreadId = 2;
        nextPostId = 2;
        renderAllThreads();
        saveToGist();
    }

    async function syncAfterAction(action) {
        await action();
        await saveToGist();
    }

    function updateStats() {
        const threadCountSpan = document.getElementById('threadCount');
        const postCountSpan = document.getElementById('postCount');
        if (threadCountSpan) threadCountSpan.innerText = threadsData.length;
        if (postCountSpan) {
            let totalPosts = threadsData.length;
            for (let t of threadsData) {
                totalPosts += t.replies.length;
            }
            postCountSpan.innerText = totalPosts;
        }
    }

    function renderAllThreads() {
        const container = document.getElementById('threadsContainer');
        if (!container) return;
        
        if (threadsData.length === 0) {
            container.innerHTML = '<div class="loading-message">📭 Тредов нет. Создайте первый тред!</div>';
            updateStats();
            return;
        }
        
        let html = '';
        for (let thread of threadsData) {
            html += `
                <div class="thread-card" data-thread-id="${thread.id}">
                    <div class="thread-header">
                        <span class="thread-title">${escapeHtml(thread.subject || 'Без темы')}</span>
                        <span class="thread-info">№${thread.id}  ${escapeHtml(thread.name || 'Аноним')}  ${thread.timestamp}</span>
                    </div>
                    ${thread.fileData ? `<img class="thread-image" src="${thread.fileData}" alt="image" loading="lazy">` : ''}
                    <div class="thread-comment">${escapeHtml(thread.comment).replace(/\n/g, '<br>')}</div>
                    <button class="reply-button" data-id="${thread.id}">💬 Ответить</button>
                    <div class="replies-container" id="replies-${thread.id}">
                        ${renderReplies(thread.replies, thread.id)}
                    </div>
                    <div class="reply-form-placeholder" id="reply-form-${thread.id}" style="display:none; margin-top:12px;">
                        <div class="form-row" style="flex-direction:column;">
                            <input type="text" id="replyName-${thread.id}" placeholder="Имя (опционально)" maxlength="50" style="background:#232323;border:1px solid #d4af37;padding:8px;border-radius:8px;color:white;">
                            <textarea id="replyComment-${thread.id}" rows="2" placeholder="Текст ответа..." style="background:#232323;border:1px solid #d4af37;padding:8px;border-radius:8px;color:white;"></textarea>
                            <label for="replyFile-${thread.id}" style="background:#2c2c2c;padding:6px;text-align:center;border-radius:20px;cursor:pointer;border:1px solid #d4af37;">📎 Изображение</label>
                            <input type="file" id="replyFile-${thread.id}" accept="image/*" style="display:none;">
                            <button class="german-btn submit-reply" data-id="${thread.id}" style="margin-top:6px;">Отправить ответ</button>
                            <button class="cancel-reply" data-id="${thread.id}" style="background:#333;border:none;color:#ccc;padding:5px;border-radius:20px;">Отмена</button>
                        </div>
                    </div>
                </div>
            `;
        }
        container.innerHTML = html;
        attachReplyButtons();
        attachSubmitReplies();
        attachCancelReply();
        updateStats();
    }

    function renderReplies(replies, threadId) {
        if (!replies.length) return '<div style="color:#777; font-size:0.7rem; padding:5px;">💬 Нет ответов</div>';
        let repliesHtml = '';
        for (let rep of replies) {
            repliesHtml += `
                <div class="reply-item">
                    <strong>${escapeHtml(rep.name || 'Аноним')}</strong> <span style="color:#888; font-size:0.6rem;">${rep.timestamp}</span>
                    ${rep.fileData ? `<div><img src="${rep.fileData}" style="max-width:120px; max-height:120px; border-radius:8px; margin:6px 0;"></div>` : ''}
                    <div>${escapeHtml(rep.comment).replace(/\n/g, '<br>')}</div>
                </div>
            `;
        }
        return repliesHtml;
    }

    function attachReplyButtons() {
        document.querySelectorAll('.reply-button').forEach(btn => {
            btn.removeEventListener('click', replyClickHandler);
            btn.addEventListener('click', replyClickHandler);
        });
    }

    function replyClickHandler(e) {
        const threadId = parseInt(e.currentTarget.getAttribute('data-id'));
        const formDiv = document.getElementById(`reply-form-${threadId}`);
        if (formDiv) {
            const isVisible = formDiv.style.display === 'block';
            formDiv.style.display = isVisible ? 'none' : 'block';
            if (!isVisible) {
                const nameInput = document.getElementById(`replyName-${threadId}`);
                if (nameInput) nameInput.value = '';
                const commentArea = document.getElementById(`replyComment-${threadId}`);
                if (commentArea) commentArea.value = '';
                const fileInput = document.getElementById(`replyFile-${threadId}`);
                if (fileInput) fileInput.value = '';
            }
        }
    }

    function attachCancelReply() {
        document.querySelectorAll('.cancel-reply').forEach(btn => {
            btn.removeEventListener('click', cancelReplyHandler);
            btn.addEventListener('click', cancelReplyHandler);
        });
    }

    function cancelReplyHandler(e) {
        const threadId = parseInt(e.currentTarget.getAttribute('data-id'));
        const formDiv = document.getElementById(`reply-form-${threadId}`);
        if (formDiv) formDiv.style.display = 'none';
    }

    function attachSubmitReplies() {
        document.querySelectorAll('.submit-reply').forEach(btn => {
            btn.removeEventListener('click', submitReplyHandler);
            btn.addEventListener('click', submitReplyHandler);
        });
    }

    function submitReplyHandler(e) {
        const threadId = parseInt(e.currentTarget.getAttribute('data-id'));
        const nameField = document.getElementById(`replyName-${threadId}`);
        const commentField = document.getElementById(`replyComment-${threadId}`);
        const fileField = document.getElementById(`replyFile-${threadId}`);
        const name = nameField ? nameField.value.trim() : '';
        const comment = commentField ? commentField.value.trim() : '';
        
        if (!comment) {
            alert('Введите текст ответа');
            return;
        }
        
        if (fileField && fileField.files && fileField.files[0]) {
            const file = fileField.files[0];
            if (!file.type.startsWith('image/')) {
                alert('Можно прикреплять только изображения');
                return;
            }
            const reader = new FileReader();
            reader.onload = async function(ev) {
                await syncAfterAction(async () => {
                    addReplyToThread(threadId, name, comment, ev.target.result, file.name, file.type);
                });
                if (fileField) fileField.value = '';
                if (nameField) nameField.value = '';
                if (commentField) commentField.value = '';
                const formDiv = document.getElementById(`reply-form-${threadId}`);
                if (formDiv) formDiv.style.display = 'none';
            };
            reader.readAsDataURL(file);
        } else {
            syncAfterAction(async () => {
                addReplyToThread(threadId, name, comment, null, null, null);
            });
            if (nameField) nameField.value = '';
            if (commentField) commentField.value = '';
            const formDiv = document.getElementById(`reply-form-${threadId}`);
            if (formDiv) formDiv.style.display = 'none';
        }
    }

    function addReplyToThread(threadId, name, comment, fileData, fileName, fileType) {
        const thread = threadsData.find(t => t.id === threadId);
        if (thread) {
            const newReply = {
                id: nextPostId++,
                name: name || 'Аноним',
                comment: comment,
                fileData: fileData,
                fileName: fileName,
                fileType: fileType,
                timestamp: new Date().toLocaleString()
            };
            thread.replies.push(newReply);
            renderAllThreads();
        }
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    }

    async function createNewThread(subject, name, comment, fileData, fileName, fileType) {
        const newThread = {
            id: nextThreadId++,
            subject: subject || '',
            name: name || 'Аноним',
            comment: comment,
            fileData: fileData,
            fileName: fileName,
            fileType: fileType,
            timestamp: new Date().toLocaleString(),
            replies: []
        };
        threadsData.unshift(newThread);
        renderAllThreads();
        await saveToGist();
    }

    const form = document.getElementById('newThreadForm');
    const fileInput = document.getElementById('threadFile');
    const fileChosenSpan = document.getElementById('fileChosen');

    if (fileInput && fileChosenSpan) {
        fileInput.addEventListener('change', function() {
            if (this.files && this.files[0]) {
                fileChosenSpan.textContent = this.files[0].name;
            } else {
                fileChosenSpan.textContent = 'Файл не выбран';
            }
        });
    }

    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            const subject = document.getElementById('threadSubject').value.trim();
            const name = document.getElementById('threadName').value.trim();
            const comment = document.getElementById('threadComment').value.trim();
            
            if (!comment) {
                alert('Комментарий обязателен');
                return;
            }
            
            const file = fileInput.files[0];
            if (!file) {
                createNewThread(subject, name, comment, null, null, null);
                form.reset();
                if (fileChosenSpan) fileChosenSpan.textContent = 'Файл не выбран';
                return;
            }
            
            if (!file.type.startsWith('image/')) {
                alert('Разрешены только изображения');
                return;
            }
            
            const reader = new FileReader();
            reader.onload = async function(ev) {
                await createNewThread(subject, name, comment, ev.target.result, file.name, file.type);
                form.reset();
                if (fileChosenSpan) fileChosenSpan.textContent = 'Файл не выбран';
            };
            reader.readAsDataURL(file);
        });
    }

    loadFromGist();
    setInterval(() => {
        if (!isSyncing) {
            loadFromGist();
        }
    }, 30000);
})();
