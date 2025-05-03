class InterviewApp {
    constructor() {
        this.initParticles();
        
        this.ws = new WebSocket(WS_URL);
        this.currentTopic = null;
        this.currentQuestionIndex = 0;
        this.totalQuestions = 0;
        this.score = 0;
        this.theme = localStorage.getItem('theme') || 'light';
        this.toastTimeout = null;
        this.isRestarting = false;
        this.interviewActive = false;
        this.questionCount = 0; // Track total questions asked
        this.interviewCompleted = false;
        this.questionsAsked = 0; // Track questions asked in the current interview
        

        this.loadingOverlay = document.getElementById('loadingOverlay');
        this.loadingStatus = document.getElementById('loadingStatus');
        this.showLoading("Initializing application...");
    
        this.initElements();
        this.initTheme();
        this.initContactModal();
        this.initEventListeners();
        this.initAutoResize();
        
        setTimeout(() => {
            this.showLoading("Connecting to server...");
            this.connectWebSocket();
        }, 500);
    }

    initParticles() {
        if (typeof particlesJS !== 'undefined') {
            particlesJS('particles-js', {
                "particles": {
                    "number": {
                        "value": 60,
                        "density": {
                            "enable": true,
                            "value_area": 800
                        }
                    },
                    "color": {
                        "value": "#ffffff"
                    },
                    "shape": {
                        "type": "circle",
                        "stroke": {
                            "width": 0,
                            "color": "#000000"
                        }
                    },
                    "opacity": {
                        "value": 0.5,
                        "random": true,
                        "anim": {
                            "enable": false,
                            "speed": 1,
                            "opacity_min": 0.1,
                            "sync": false
                        }
                    },
                    "size": {
                        "value": 3,
                        "random": true,
                        "anim": {
                            "enable": false,
                            "speed": 40,
                            "size_min": 0.1,
                            "sync": false
                        }
                    },
                    "line_linked": {
                        "enable": true,
                        "distance": 150,
                        "color": "#ffffff",
                        "opacity": 0.4,
                        "width": 1
                    },
                    "move": {
                        "enable": true,
                        "speed": 2,
                        "direction": "none",
                        "random": false,
                        "straight": false,
                        "out_mode": "out",
                        "bounce": false,
                        "attract": {
                            "enable": false,
                            "rotateX": 600,
                            "rotateY": 1200
                        }
                    }
                },
                "interactivity": {
                    "detect_on": "window",
                    "events": {
                        "onhover": {
                            "enable": true,
                            "mode": "grab"
                        },
                        "onclick": {
                            "enable": true,
                            "mode": "push"
                        },
                        "resize": true
                    },
                    "modes": {
                        "grab": {
                            "distance": 140,
                            "line_linked": {
                                "opacity": 1
                            }
                        },
                        "push": {
                            "particles_nb": 4
                        }
                    }
                },
                "retina_detect": true
            });
        }
    }

    initElements() {
        this.elements = {
            chatMessages: document.getElementById('chat-messages'),
            userInput: document.getElementById('user-input'),
            sendBtn: document.getElementById('send-btn'),
            connectionStatus: document.getElementById('connection-status'),
            statusDot: document.querySelector('.status-dot'),
            topicButtons: document.querySelectorAll('.topic-btn'),
            progressFill: document.getElementById('progress-fill'),
            progressPercent: document.getElementById('progress-percent'),
            scoreDisplay: document.getElementById('score'),
            contactModal: document.getElementById('contactModal'),
            themeToggle: document.getElementById('themeToggle'),
            toast: document.getElementById('toast'),
            restartBtn: document.getElementById('restart-btn'),
            feedbackBtn: document.getElementById('feedback-btn'),
            totalQuestionsDisplay: document.getElementById('total-questions'),
            questionsCountDisplay: document.getElementById('questions-count')
        };
    }

    initEventListeners() {
        // Message sending
        this.elements.sendBtn.addEventListener('click', () => this.sendMessage());
        this.elements.userInput.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        this.elements.feedbackBtn.addEventListener('click', () => this.handleFeedback());

        // Topic selection
        this.elements.topicButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                if (this.interviewActive || btn.disabled) return;
                
                this.currentTopic = btn.dataset.topic;
                this.showLoading(`Starting ${this.formatTopicName(this.currentTopic)} interview...`);
                
                // Send the raw topic name to backend
                this.sendWsMessage(this.currentTopic);
                
                this.interviewActive = true;
                this.disableTopics();
                this.resetInterviewState();
            });
        });

        // Theme switching
        this.elements.themeToggle.addEventListener('click', () => this.toggleTheme());

        // Restart button
        this.elements.restartBtn.addEventListener('click', () => {
            if (this.isRestarting) {
                this.showToast("Restart in progress...", "warning");
                return;
            }
            this.restartInterview();
        });

        // Contact modal
        document.getElementById('contactDeveloperBtn').addEventListener('click', () => {
            this.elements.contactModal.classList.add('active');
        });

        document.getElementById('closeModal').addEventListener('click', () => {
            this.elements.contactModal.classList.remove('active');
        });
    }

    initTheme() {
        document.documentElement.setAttribute('data-theme', this.theme);
        localStorage.setItem('theme', this.theme);
        this.updateThemeButton();
    }

    updateThemeButton() {
        const moonIcon = this.elements.themeToggle.querySelector('.fa-moon');
        const sunIcon = this.elements.themeToggle.querySelector('.fa-sun');
        
        if (this.theme === 'dark') {
            moonIcon.style.display = 'none';
            sunIcon.style.display = 'block';
        } else {
            moonIcon.style.display = 'block';
            sunIcon.style.display = 'none';
        }
    }

    toggleTheme() {
        this.theme = this.theme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', this.theme);
        localStorage.setItem('theme', this.theme);
        this.updateThemeButton();
        this.showToast(`${this.theme.charAt(0).toUpperCase() + this.theme.slice(1)} mode activated`);
    }

    initContactModal() {
        this.contactModal = document.getElementById('contactModal');
        this.closeModalBtn = document.getElementById('closeModal');
    
        this.closeModalBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.toggleModal(false);
        });
    
        this.contactModal.addEventListener('click', (e) => {
            if (e.target === this.contactModal) {
                this.toggleModal(false);
            }
        });
    }

    toggleModal(show) {
        if (show) {
            this.contactModal.classList.add('active');
            document.body.style.overflow = 'hidden';
        } else {
            this.contactModal.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    showLoading(message) {
        if (this.loadingStatus) {
            this.loadingStatus.textContent = message;
        }
    }

    hideLoading() {
        document.body.classList.add('loaded');
        setTimeout(() => {
            if (this.loadingOverlay) {
                this.loadingOverlay.remove();
            }
        }, 500);
    }

    updateConnectionStatus(status) {
        const statusMap = {
            'connecting': { text: 'Connecting...', color: '#FFA500', animation: '' },
            'connected': { text: 'Connected', color: '#4ADE80', animation: 'pulse 1.5s infinite' },
            'disconnected': { text: 'Disconnected', color: '#6C757D', animation: '' },
            'error': { text: 'Connection Error', color: '#EF4444', animation: 'blink 1s infinite' }
        };
        
        const statusInfo = statusMap[status] || statusMap['error'];
        this.elements.statusDot.style.backgroundColor = statusInfo.color;
        this.elements.statusDot.style.animation = statusInfo.animation;
        this.elements.connectionStatus.querySelector('span:last-child').textContent = statusInfo.text;
    }

    connectWebSocket() {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${window.location.host}/ws`;
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => this.handleWsOpen();
        this.ws.onmessage = (e) => this.handleWsMessage(e.data);
        this.ws.onclose = () => this.handleWsClose();
        this.ws.onerror = (e) => this.handleWsError(e);
    }

    handleWsOpen() {
        this.showLoading("Connection successful!");
        setTimeout(() => this.hideLoading(), 1000);
        this.updateConnectionStatus('connected');
        this.addSystemMessage("Connected to AI Interview Coach!");
        this.enableTopics();
    }

    handleWsMessage(data) {
        if (data === "RESTART_COMPLETE") {
            this.handleRestartComplete();
            return;
        }

        if (data.startsWith("**Feedback**") || data.includes("Strengths:") || data.includes("Areas for Improvement:")) {
            this.addFeedbackMessage(data);
            return;
        }

        if (data.startsWith("Error:") || data.startsWith("Could not generate feedback")) {
            this.showToast(data, "error");
            return;
        }

        if (data.startsWith("TOTAL_QUESTIONS:")) {
            this.totalQuestions = parseInt(data.split(":")[1]);
            this.elements.totalQuestionsDisplay.textContent = this.totalQuestions;
        }
        else if (data.includes("Final score:")) {
            this.handleScoreUpdate(data);
            this.interviewActive = false;
            this.interviewCompleted = true;
            this.enableTopics();
        } 
        else if (data.includes("Interview complete!")) {
            this.handleInterviewComplete(data);
        } 
        else {
            this.addBotMessage(data);
            this.currentQuestionIndex++;
            this.updateProgressUI();
        }
        
        this.hideLoading();
    }

    addFeedbackMessage(message) {
        const feedbackElement = document.createElement('div');
        feedbackElement.className = 'feedback-message';
        feedbackElement.innerHTML = `
            <div class="feedback-header">
                <i class="fas fa-chart-line"></i> Interview Feedback
            </div>
            <div class="feedback-content">${message}</div>
        `;
        this.elements.chatMessages.appendChild(feedbackElement);
        this.scrollToBottom();
    }

    handleFeedback() {
        if (!this.interviewCompleted) {
            this.showToast("Please complete an interview first", "warning");
            return;
        }

        this.showLoading("Generating feedback...");
        this.sendWsMessage("feedback");
    }

    updateQuestionDisplay() {
        this.elements.questionsCountDisplay.textContent = `${this.questionsAsked}/${this.totalQuestions}`;
        this.elements.totalQuestionsDisplay.textContent = this.totalQuestions;
    }

    handleWsClose() {
        this.showLoading("Connection lost. Reconnecting...");
        this.updateConnectionStatus('disconnected');
        this.addSystemMessage("Disconnected. Attempting to reconnect...");
        setTimeout(() => this.connectWebSocket(), 3000);
    }

    handleWsError(error) {
        this.showLoading("Connection failed. Retrying...");
        this.updateConnectionStatus('error');
        this.addSystemMessage("Connection error. Please refresh.");
        console.error("WebSocket error:", error);
        setTimeout(() => this.connectWebSocket(), 3000);
    }

    sendWsMessage(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(message);
        } else {
            console.error("WebSocket not connected");
            this.showToast("Connection error. Please try again.", "error");
        }
    }

    addSystemMessage(message) {
        this.addMessage(message, 'system');
    }
    
    addBotMessage(message) {
        this.addMessage(message, 'bot');
    }
    
    addUserMessage(message) {
        this.addMessage(message, 'user');
    }

    addMessage(message, type) {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${type}-message`;
        
        const messageTime = new Date();
        const formattedTime = messageTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
        messageElement.innerHTML = `
            <div class="message-content">${message}</div>
            <div class="message-meta">
                <span class="message-time">${formattedTime} ${type === 'user' ? '<i class="fas fa-check-double"></i>' : ''}</span>
            </div>
        `;
        
        this.elements.chatMessages.appendChild(messageElement);
        this.scrollToBottom();
    }

    scrollToBottom() {
        this.elements.chatMessages.scrollTo({
            top: this.elements.chatMessages.scrollHeight,
            behavior: 'smooth'
        });
    }

    sendMessage() {
        const message = this.elements.userInput.value.trim();
        if (message) {
            this.showLoading("Sending your answer...");
            this.addUserMessage(message);
            this.sendWsMessage(message);
            this.elements.userInput.value = '';
        }
    }

    disableTopics() {
        this.elements.topicButtons.forEach(btn => {
            btn.disabled = true;
            btn.classList.add('disabled');
            btn.style.opacity = '0.6';
            btn.style.pointerEvents = 'none';
        });
    }

    enableTopics() {
        this.elements.topicButtons.forEach(btn => {
            btn.disabled = false;
            btn.classList.remove('disabled');
            btn.style.opacity = '1';
            btn.style.pointerEvents = 'auto';
        });
    }

    handleScoreUpdate(message) {
        const scoreMatch = message.match(/Final score: (\d+)\/(\d+)/);
        if (scoreMatch) {
            this.score = parseInt(scoreMatch[1]);
            this.totalQuestions = parseInt(scoreMatch[2]);
            this.elements.scoreDisplay.textContent = this.score;
        }
        this.addBotMessage(message);
    }

    handleInterviewComplete(message) {
        this.addBotMessage(message);
        this.enableTopics();
    }

    resetInterviewState() {
        this.currentQuestionIndex = 0;
        this.score = 0;
        this.totalQuestions = 0;
        this.updateProgressUI();
    }

    updateProgressUI() {
        let progress = 0;
        if (this.totalQuestions > 0) {
            progress = Math.min(
                (this.currentQuestionIndex / this.totalQuestions) * 100, 
                100
            );
        }
        this.elements.progressFill.style.width = `${progress}%`;
        this.elements.progressPercent.textContent = `${Math.round(progress)}%`;
        this.elements.scoreDisplay.textContent = `${this.score}/${this.totalQuestions}`;
        this.elements.totalQuestionsDisplay.textContent = this.totalQuestions;
        this.elements.questionsCountDisplay.textContent = `${this.currentQuestionIndex}/${this.totalQuestions}`;
        this.elements.restartBtn.style.display = this.interviewActive ? 'none' : 'block';
        this.elements.feedbackBtn.style.display = this.interviewCompleted ? 'block' : 'none';
        this.elements.restartBtn.style.pointerEvents = this.interviewActive ? 'none' : 'auto';
        this.elements.restartBtn.style.opacity = this.interviewActive ? '0.6' : '1';
        this.elements.feedbackBtn.style.pointerEvents = this.interviewCompleted ? 'auto' : 'none';
        this.elements.feedbackBtn.style.opacity = this.interviewCompleted ? '1' : '0.6';
    }

    restartInterview() {
        this.isRestarting = true;
        const restartBtn = this.elements.restartBtn;
        
        const originalHTML = restartBtn.innerHTML;
        restartBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Restarting...';
        restartBtn.disabled = true;

        this.resetInterviewState();
        this.interviewActive = false;
        this.interviewCompleted = false;
        this.elements.chatMessages.innerHTML = `
            <div class="welcome-message">
                <div class="welcome-content">
                    <h2>Welcome to AI Interview Coach!</h2>
                    <p>Select a topic below to begin your mock interview.</p>
                </div>
            </div>`;

        this.sendWsMessage('RESTART');
        this.showLoading("Resetting interview session...");

        setTimeout(() => {
            if (this.isRestarting) {
                this.resetRestartButton();
                this.showToast("Restart completed", "success");
            }
        }, 5000);
    }

    handleRestartComplete() {
        this.addSystemMessage("Ready for new interview");
        this.interviewActive = false;
        this.enableTopics();
        this.resetRestartButton();
        this.hideLoading();
    }

    resetRestartButton() {
        this.isRestarting = false;
        const restartBtn = this.elements.restartBtn;
        restartBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Restart Interview';
        restartBtn.disabled = false;
    }

    showToast(message, type = 'info') {
        const toast = this.elements.toast;
        toast.textContent = message;
        toast.className = `toast ${type}`;
        
        clearTimeout(this.toastTimeout);
        toast.classList.add('show');
        
        this.toastTimeout = setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    formatTopicName(topic) {
        return topic.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    initAutoResize() {
        this.elements.userInput.addEventListener('input', () => {
            this.elements.userInput.style.height = 'auto';
            this.elements.userInput.style.height = `${this.elements.userInput.scrollHeight}px`;
        });
    }
}

// Handle window resize for particles
window.addEventListener('resize', () => {
    if (typeof particlesJS !== 'undefined' && window.pJSDom?.[0]) {
        window.pJSDom[0].pJS.fn.vendors.destroypJS();
        window.pJSDom[0].pJS.fn.vendors.init();
    }
});

// Initialize application
document.addEventListener('DOMContentLoaded', () => new InterviewApp());

const API_URL = "https://interview-backend-6zq9.onrender.com";
const WS_URL = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") 
    ? "ws://localhost:8000/ws" 
    : "wss://interview-backend-6zq9.onrender.com/ws";