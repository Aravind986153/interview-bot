class InterviewApp {
    constructor() {
        this.initParticles();
        
        //this.ws = new WebSocket(WS_URL);
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

        this.restartRetries = 0;
        this.maxRestartRetries = 3;
        
        setTimeout(() => {
            this.showLoading("Connecting to server...");
            this.connectWebSocket();  // This will create the SINGLE connection
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

        if (!this.elements.connectionStatus || !this.elements.statusDot) {
            console.error("Critical UI elements missing!");
            // Create fallback elements if needed
            const statusDiv = document.createElement('div');
            statusDiv.id = 'connection-status';
            statusDiv.innerHTML = '<span class="status-dot"></span><span>Connection</span>';
            document.body.prepend(statusDiv);
            this.elements.connectionStatus = statusDiv;
            this.elements.statusDot = statusDiv.querySelector('.status-dot');
        }
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
        // Close any existing connection
        if (this.ws) {
            this.ws.close();
        }
    
        this.updateConnectionStatus('connecting');
        
        // Create new connection with debug logging
        this.ws = new WebSocket(WS_URL);
        console.log("WebSocket created, readyState:", this.ws.readyState); // Should be 0 (CONNECTING)
    
        this.ws.onopen = () => {
            console.log("WebSocket OPEN, readyState:", this.ws.readyState); // Should be 1 (OPEN)
            this.handleWsOpen();
        };
    
        this.ws.onerror = (error) => {
            console.error("WebSocket ERROR:", error);
            this.handleWsError(error);
        };
    
        this.ws.onclose = () => {
            console.log("WebSocket CLOSED");
            this.handleWsClose();
        };
    
        this.ws.onmessage = (e) => {
            console.log("WebSocket MESSAGE:", e.data);
            this.handleWsMessage(e.data);
        };
    }

    handleWsOpen() {
        console.log("Connection opened, updating UI...");
        this.updateConnectionStatus('connected');
        this.addSystemMessage("Connected to AI Interview Coach!");
        this.enableTopics();
        this.hideLoading();
        
        // Force UI redraw if needed
        this.elements.connectionStatus.style.display = 'none';
        this.elements.connectionStatus.offsetHeight; // Trigger reflow
        this.elements.connectionStatus.style.display = 'block';
    }

    handleWsMessage(data) {

        console.log("Received:", data);

        if (data === "RESTART_COMPLETE") {
            this.handleRestartComplete();
            return;
        }

        if (data.toLowerCase().includes("feedback") || 
        data.includes("Strengths:") || 
        data.includes("Improvement:") ||
        data.startsWith("1.")) {
        clearTimeout(this.feedbackTimeout);
        this.addFeedbackMessage(data);
        this.hideLoading();
        return;
    }

    if (data.includes("Error:") || data.includes("Could not generate")) {
        clearTimeout(this.feedbackTimeout);
        this.showToast(data, "error");
        this.hideLoading();
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
        // Enhanced validation
        if (!this.interviewCompleted) {
            this.showToast("Please complete an interview before requesting feedback", "warning");
            return;
        }
    
        if (!this.currentTopic) {
            this.showToast("No interview topic found for feedback", "error");
            return;
        }
    
        // Connection check with reconnect
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.showToast("Reconnecting to server...", "info");
            this.connectWebSocket();
            setTimeout(() => {
                if (this.ws?.readyState === WebSocket.OPEN) {
                    this.handleFeedback();
                } else {
                    this.showToast("Connection failed. Please try again", "error");
                }
            }, 1000);
            return;
        }
    
        console.debug("Sending feedback request...");
        this.showLoading("Generating your feedback...");
        
        try {
            // Add timeout for feedback response
            this.feedbackTimeout = setTimeout(() => {
                this.showToast("Feedback is taking longer than expected", "info");
            }, 5000);
    
            this.ws.send("feedback");
        } catch (error) {
            console.error("Failed to send feedback request:", error);
            clearTimeout(this.feedbackTimeout);
            this.showToast("Failed to send feedback request", "error");
            this.hideLoading();
        }
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
        console.error("Connection error:", error);
        this.updateConnectionStatus('error');
        this.addSystemMessage("Connection error. Please refresh.");
        setTimeout(() => this.connectWebSocket(), 3000);
    }

    sendWsMessage(message) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error("Cannot send message - WebSocket not open");
            this.showToast("Connection lost - reconnecting...", "warning");
            this.connectWebSocket();
            return false;
        }
        
        try {
            this.ws.send(message);
            return true;
        } catch (error) {
            console.error("Error sending message:", error);
            this.showToast("Message failed to send", "error");
            return false;
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
        // First reset all button states
        this.elements.topicButtons.forEach(btn => {
            btn.disabled = false;
            btn.classList.remove('disabled');
            
            // Reset all inline styles we previously modified
            btn.style.opacity = '';
            btn.style.pointerEvents = '';
            btn.style.cursor = '';
            btn.style.display = ''; // Remove any display modifications
        });
        
        // For modern browsers - trigger re-layout without flash
        requestAnimationFrame(() => {
            this.elements.topicButtons.forEach(btn => {
                btn.style.transform = 'translateZ(0)'; // Gentle GPU acceleration
            });
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
        this.interviewActive = false;
        this.interviewCompleted = true;  // Explicitly set this
        this.enableTopics();
        this.updateProgressUI();
    }

    resetInterviewState() {
        this.currentQuestionIndex = 0;
        this.score = 0;
        this.totalQuestions = 0;
        this.updateProgressUI();
    }

    updateProgressUI() {
        let progress = 0;
    if (this.totalQuestions > 0 && this.currentQuestionIndex > 0) {
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

    checkConnection() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.showToast("Connecting to server...", "warning");
            this.connectWebSocket();
            return false;
        }
        return true;
    }

    // In your InterviewApp class
    async restartInterview() {
        if (this.isRestarting) return;
        
        this.isRestarting = true;
        const originalBtnContent = this.elements.restartBtn.innerHTML;
        this.elements.restartBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Restarting';
        this.showLoading("Resetting interview...");
    
        try {
            // Reset all states
            this.currentTopic = null;
            this.currentQuestionIndex = 0;
            this.score = 0;
            this.totalQuestions = 0;
            this.interviewActive = false;
            this.interviewCompleted = false;
            this.questionsAsked = 0;
    
            // Reset chat UI
            this.elements.chatMessages.innerHTML = `
                <div class="welcome-message">
                    <div class="welcome-content">
                        <h2>Interview Reset</h2>
                        <p>Select a topic below to begin a new interview.</p>
                    </div>
                </div>`;
    
            // Enable topics BEFORE updating progress
            this.enableTopics();
            this.updateProgressUI();
    
            // Send restart command
            this.sendWsMessage("RESTART");
            
            this.showToast("Interview reset successfully", "success");
        } catch (error) {
            console.error("Restart error:", error);
            this.showToast("Restart completed", "info");
        } finally {
            this.elements.restartBtn.innerHTML = originalBtnContent;
            this.isRestarting = false;
            this.hideLoading();
        }
    }
    

    handleRestartComplete() {
        this.addSystemMessage("Ready for new interview. Select a topic to begin.");
        //this.interviewActive = false;
        //this.interviewCompleted = false;
        this.enableTopics();
        //this.updateProgressUI();
        //this.resetRestartButton();
        //this.hideLoading();
    }

    resetRestartButton() {
        const restartBtn = this.elements.restartBtn;
        restartBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Restart Interview';
        restartBtn.disabled = false;
        this.isRestarting = false;
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