(function() {
    let threadsData = [];
    let nextThreadId = 1;
    let nextPostId = 1;

    const mascotContainer = document.getElementById('mascotDynamic');
    if (mascotContainer) {
        const possibleMascots = ['🐻‍❄️', '🦅', '🐺', '⚙️', '🍺', '🎩'];
        mascotContainer.textContent = possibleMascots[Math.floor(Math.random() * possibleMascots.length)];
    }

    function saveToLocal() {
        localStorage.setItem('9chan_threads', JSON.stringify(threadsData));
        localStorage.setItem('9chan_nextThreadId', nextThreadId);
        localStorage.setItem('9chan_nextPostId', nextPostId);
    }

    function loadFromLocal() {
        const stored = localStorage.getItem('9chan_threads');
        if (stored) {
            threadsData = JSON.parse(stored);
            const storedThreadId = localStorage.getItem('9chan_nextThreadId');
            const storedPostId = localStorage.getItem('9chan_nextPostId');
            if (storedThreadId) nextThreadId = parseInt(storedThreadId, 10);
            if (storedPostId) nextPostId = parseInt(storedPostId, 10);
            renderAllThreads();
        } else {
            const demoThread = {
                id: nextThreadId++,
                subject: 'Добро пожаловать на 9chan',
                name: 'Админ',
                comment: 'Это тестовый тред. Загружайте изображения, создавайте треды и общайтесь в стиле классических имиджбордов. 🇩🇪',
                fileData: null,
                fileName: null,
                fileType: null,
                timestamp: new Date().toLocaleString(),
                replies: []
            };
            threadsData.push(demoThread);
            saveToLocal();
            renderAllThreads();
        }
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
            container.innerHTML = '<div class="loading-message">Тредов нет. Создайте первый!</div>';
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
                            <input type="text" id="replyName-${thread.id}" placeholder="Имя" maxlength="50" style="background:#232323;border:1px solid #d4af37;padding:8px;border-radius:8px;color:white;">
                            <textarea id="replyComment-${thread.id}" rows="2" placeholder="Текст ответа..." style="background:#232323;border:1px solid #d4af37;padding:8px;border-radius:8px;color:white;"></textarea>
                            <label for="replyFile-${thread.id}" style="background:#2c2c2c;padding:6px;text-align:center;border-radius:20px;cursor:pointer;">📎 Изображение</label>
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
        if (!replies.length) return '<div style="color:#777; font-size:0.7rem; padding:5px;">Нет ответов</div>';
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
        let fileData = null;
        let fileName = null;
        let fileType = null;
        if (fileField && fileField.files && fileField.files[0]) {
            const file = fileField.files[0];
            if (!file.type.startsWith('image/')) {
                alert('Можно прикреплять только изображения');
                return;
            }
            fileName = file.name;
            fileType = file.type;
            const reader = new FileReader();
            reader.onload = function(ev) {
                fileData = ev.target.result;
                addReplyToThread(threadId, name, comment, fileData, fileName, fileType);
                if (fileField) fileField.value = '';
                if (nameField) nameField.value = '';
                if (commentField) commentField.value = '';
                const formDiv = document.getElementById(`reply-form-${threadId}`);
                if (formDiv) formDiv.style.display = 'none';
            };
            reader.readAsDataURL(file);
        } else {
            addReplyToThread(threadId, name, comment, null, null, null);
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
            saveToLocal();
            renderAllThreads();
        } else {
            alert('Тред не найден');
        }
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        }).replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, function(c) {
            return c;
        });
    }

    function createNewThread(subject, name, comment, fileData, fileName, fileType) {
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
        saveToLocal();
        renderAllThreads();
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
            reader.onload = function(ev) {
                createNewThread(subject, name, comment, ev.target.result, file.name, file.type);
                form.reset();
                if (fileChosenSpan) fileChosenSpan.textContent = 'Файл не выбран';
            };
            reader.readAsDataURL(file);
        });
    }

    loadFromLocal();
})();
