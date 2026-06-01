let widget, header, resizeHandle;
let isDragging = false, isResizing = false;
let dragStartX, dragStartY, startLeft, startTop;
let resizeStartX, resizeStartY, startWidth, startHeight;

document.addEventListener('DOMContentLoaded', () => {
    initChatbot();
});

function initChatbot() {
    const trigger = document.getElementById('chatbot-trigger');
    widget = document.getElementById('chatbot-widget');
    const minimize = document.getElementById('chatbot-minimize');
    const sendBtn = document.getElementById('chatbot-send');
    const input = document.getElementById('chatbot-input');
    const iconOpen = document.getElementById('chatbot-icon-open');
    const iconClose = document.getElementById('chatbot-icon-close');
    
    if (!trigger || !widget) return;
    
    trigger.addEventListener('click', () => {
        if (widget.style.display === 'none' || widget.style.display === '') {
            widget.style.display = 'flex';
            iconOpen.style.display = 'none';
            iconClose.style.display = 'inline';
            if (input) input.focus();
            attachDragAndResize();
            const messages = document.getElementById('chatbot-messages');
            if (messages) messages.scrollTop = messages.scrollHeight;
        } else {
            widget.style.display = 'none';
            iconOpen.style.display = 'inline';
            iconClose.style.display = 'none';
        }
    });
    
    if (minimize) {
        minimize.addEventListener('click', (e) => {
            e.stopPropagation();
            widget.style.display = 'none';
            iconOpen.style.display = 'inline';
            iconClose.style.display = 'none';
        });
    }
    
    if (sendBtn) sendBtn.addEventListener('click', sendMessage);
    if (input) {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                sendMessage();
            }
        });
    }
    
    const messagesDiv = document.getElementById('chatbot-messages');
    if (messagesDiv && window.ResizeObserver) {
        const observer = new ResizeObserver(() => {
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        });
        observer.observe(messagesDiv);
    }
    
    initTopicClicks();
}

function initTopicClicks() {
    const topics = document.querySelectorAll('.topic-click');
    topics.forEach(topic => {
        topic.removeEventListener('click', topicClickHandler);
        topic.addEventListener('click', topicClickHandler);
    });
}

function topicClickHandler(e) {
    let topicText = this.getAttribute('data-topic');
    if (!topicText) {
        const span = this.querySelector('span:last-child');
        topicText = span ? span.innerText.trim() : this.innerText.trim();
    }
    if (topicText) {
        sendPredefinedMessage(topicText);
    }
}

function sendPredefinedMessage(message) {
    addMessage(message, 'user');
    sendMessageToBot(message);
}

async function sendMessageToBot(message) {
    showTypingIndicator();
    try {
        const token = localStorage.getItem('access_token');
        const headers = {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
        };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        
        const response = await fetch('/api/chatbot/', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ message: message })
        });
        const data = await response.json();
        removeTypingIndicator();
        addMessage(data.response, 'bot');
    } catch(error) {
        console.error(error);
        removeTypingIndicator();
        addMessage('Désolé, une erreur technique est survenue. Veuillez réessayer.', 'bot');
    }
}

async function sendMessage() {
    const input = document.getElementById('chatbot-input');
    const message = input.value.trim();
    if (!message) return;
    
    addMessage(message, 'user');
    input.value = '';
    input.disabled = true;
    await sendMessageToBot(message);
    input.disabled = false;
    input.focus();
}

function addMessage(text, sender) {
    const container = document.getElementById('chatbot-messages');
    if (!container) return;
    const div = document.createElement('div');
    div.className = `message ${sender}`;
    const content = document.createElement('div');
    content.className = 'message-content';
    content.innerHTML = text.replace(/\n/g, '<br>');
    div.appendChild(content);
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function showTypingIndicator() {
    const container = document.getElementById('chatbot-messages');
    if (!container) return;
    const typing = document.createElement('div');
    typing.className = 'message bot typing-indicator';
    typing.id = 'typing-indicator';
    const content = document.createElement('div');
    content.className = 'message-content';
    content.innerHTML = '<span></span><span></span><span></span>';
    typing.appendChild(content);
    container.appendChild(typing);
    container.scrollTop = container.scrollHeight;
}

function removeTypingIndicator() {
    const el = document.getElementById('typing-indicator');
    if (el) el.remove();
}

function getCookie(name) {
    let value = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            cookie = cookie.trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                value = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return value;
}

function attachDragAndResize() {
    header = widget.querySelector('.chatbot-header');
    if (!header) return;
    
    if (!document.getElementById('chatbot-resize-handle')) {
        resizeHandle = document.createElement('div');
        resizeHandle.id = 'chatbot-resize-handle';
        resizeHandle.className = 'chatbot-resize-handle';
        widget.appendChild(resizeHandle);
    } else {
        resizeHandle = document.getElementById('chatbot-resize-handle');
    }
    
    header.removeEventListener('mousedown', onDragStart);
    header.addEventListener('mousedown', onDragStart);
    resizeHandle.removeEventListener('mousedown', onResizeStart);
    resizeHandle.addEventListener('mousedown', onResizeStart);
    
    window.removeEventListener('mousemove', onDragMove);
    window.removeEventListener('mouseup', onDragEnd);
    window.removeEventListener('mousemove', onResizeMove);
    window.removeEventListener('mouseup', onResizeEnd);
    
    window.addEventListener('mousemove', onDragMove);
    window.addEventListener('mouseup', onDragEnd);
    window.addEventListener('mousemove', onResizeMove);
    window.addEventListener('mouseup', onResizeEnd);
}

function onDragStart(e) {
    if (e.target.closest('.chatbot-minimize') || window.innerWidth <= 480) return;
    isDragging = true;
    document.body.classList.add('dragging');
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    const rect = widget.getBoundingClientRect();
    startLeft = rect.left;
    startTop = rect.top;
    widget.style.left = startLeft + 'px';
    widget.style.top = startTop + 'px';
    widget.style.right = 'auto';
    widget.style.bottom = 'auto';
    e.preventDefault();
}

function onDragMove(e) {
    if (!isDragging) return;
    let newLeft = startLeft + (e.clientX - dragStartX);
    let newTop = startTop + (e.clientY - dragStartY);
    const maxX = window.innerWidth - widget.offsetWidth;
    const maxY = window.innerHeight - widget.offsetHeight;
    newLeft = Math.min(Math.max(0, newLeft), maxX);
    newTop = Math.min(Math.max(0, newTop), maxY);
    widget.style.left = newLeft + 'px';
    widget.style.top = newTop + 'px';
}

function onDragEnd() {
    isDragging = false;
    document.body.classList.remove('dragging');
}

function onResizeStart(e) {
    if (window.innerWidth <= 480) return;
    e.stopPropagation();
    isResizing = true;
    document.body.classList.add('resizing');
    resizeStartX = e.clientX;
    resizeStartY = e.clientY;
    startWidth = widget.offsetWidth;
    startHeight = widget.offsetHeight;
    const rect = widget.getBoundingClientRect();
    widget.style.left = rect.left + 'px';
    widget.style.top = rect.top + 'px';
    widget.style.right = 'auto';
    widget.style.bottom = 'auto';
    e.preventDefault();
}

function onResizeMove(e) {
    if (!isResizing) return;
    let newWidth = startWidth + (e.clientX - resizeStartX);
    let newHeight = startHeight + (e.clientY - resizeStartY);
    newWidth = Math.min(Math.max(320, newWidth), 750);
    newHeight = Math.min(Math.max(460, newHeight), 850);
    widget.style.width = newWidth + 'px';
    widget.style.height = newHeight + 'px';
    const rect = widget.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
        widget.style.left = (window.innerWidth - rect.width) + 'px';
    }
    if (rect.bottom > window.innerHeight) {
        widget.style.top = (window.innerHeight - rect.height) + 'px';
    }
}

function onResizeEnd() {
    isResizing = false;
    document.body.classList.remove('resizing');
}