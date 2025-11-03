// MAS Timeline - Chat-style Debug Stream
// Vanilla JS implementation with WebSocket support

class MASTimeline {
    constructor() {
        this.ws = null;
        this.activeBot = null;
        this.viewMode = 'single'; // 'single' or 'all'
        this.items = [];
        this.filters = {
            types: new Set(['all']),
            outcomes: new Set(),
            search: ''
        };
        this.burstWindow = 800; // ms for collapsing bursts
        this.maxItems = 300; // DOM performance limit
        this.inspectorOpen = false;
        this.selectedItem = null;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.connectWebSocket();
        this.loadBots();
    }

    setupEventListeners() {
        // View mode toggles
        document.querySelectorAll('[data-view]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.viewMode = e.target.dataset.view;
                document.querySelectorAll('[data-view]').forEach(b => b.classList.remove('filter-chip--active'));
                e.target.classList.add('filter-chip--active');
                this.renderTimeline();
            });
        });

        // Type filters
        document.querySelectorAll('[data-type]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const type = e.target.dataset.type;
                if (type === 'all') {
                    this.filters.types.clear();
                    this.filters.types.add('all');
                    document.querySelectorAll('[data-type]').forEach(b => b.classList.remove('filter-chip--active'));
                    e.target.classList.add('filter-chip--active');
                } else {
                    this.filters.types.delete('all');
                    e.target.classList.toggle('filter-chip--active');
                    if (e.target.classList.contains('filter-chip--active')) {
                        this.filters.types.add(type);
                    } else {
                        this.filters.types.delete(type);
                    }
                    // Update 'all' button
                    document.querySelector('[data-type="all"]').classList.remove('filter-chip--active');
                }
                this.renderTimeline();
            });
        });

        // Outcome filters
        document.querySelectorAll('[data-outcome]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const outcome = e.target.dataset.outcome;
                e.target.classList.toggle('filter-chip--active');
                if (e.target.classList.contains('filter-chip--active')) {
                    this.filters.outcomes.add(outcome);
                } else {
                    this.filters.outcomes.delete(outcome);
                }
                this.renderTimeline();
            });
        });

        // Search
        document.querySelector('.timeline__search').addEventListener('input', (e) => {
            this.filters.search = e.target.value.toLowerCase();
            this.renderTimeline();
        });

        // Bot filters
        document.querySelectorAll('[data-filter]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.target.classList.toggle('filter-chip--active');
                this.filterBots();
            });
        });
    }

    connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.hostname}:${window.location.port || 4242}/ws`;
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('WebSocket connected');
        };
        
        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleWebSocketMessage(data);
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
        
        this.ws.onclose = () => {
            console.log('WebSocket disconnected, reconnecting in 3s...');
            setTimeout(() => this.connectWebSocket(), 3000);
        };
    }

    handleWebSocketMessage(data) {
        console.log('WebSocket message received:', data.type, data);
        // Map WebSocket events to timeline items
        switch (data.type) {
            case 'bot_status':
                this.updateBotStatus(data.bot);
                break;
            case 'job_phase':
                this.addJobItem(data);
                break;
            case 'job_update':
                this.updateJobItem(data);
                break;
            case 'job_plan':
                this.addPlanItem(data);
                break;
            case 'job_step':
                this.addStepItem(data);
                break;
            case 'event':
                this.addEventItem(data);
                break;
            case 'inventory':
                // Update inventory display if needed
                break;
            case 'usage':
                this.addUsageItem(data);
                break;
            case 'chat':
                this.addChatItem(data);
                break;
            case 'tool':
                this.addToolItem(data);
                break;
            case 'safety':
                this.addSafetyItem(data);
                break;
        }
    }

    async loadBots() {
        try {
            const response = await fetch('/api/bots');
            const bots = await response.json();
            this.renderBotList(bots);
        } catch (error) {
            console.error('Failed to load bots:', error);
        }
    }

    renderBotList(bots) {
        const agentList = document.getElementById('agentList');
        agentList.innerHTML = '';
        
        // Sort bots: running first, then paused, then idle
        bots.sort((a, b) => {
            const statusOrder = { running: 0, paused: 1, idle: 2, error: 3 };
            return (statusOrder[a.status] || 3) - (statusOrder[b.status] || 3);
        });
        
        bots.forEach(bot => {
            const item = document.createElement('div');
            item.className = 'agent-list__item';
            item.dataset.botId = bot.name;
            if (bot.name === this.activeBot) {
                item.setAttribute('aria-selected', 'true');
            }
            
            const status = bot.connected ? 'running' : 'idle';
            const jobBadge = bot.activeJob ? `<span class="tl-badge tl-badge--job">Job #${bot.activeJob}</span>` : '';
            
            item.innerHTML = `
                <div class="agent-list__meta">
                    <span class="agent-list__name">${bot.name}</span>
                    <div class="agent-list__badges">
                        <span class="agent-list__badge agent-list__badge--${status}">${status}</span>
                        ${jobBadge}
                    </div>
                </div>
            `;
            
            item.addEventListener('click', () => {
                this.selectBot(bot.name);
            });
            
            agentList.appendChild(item);
        });
        
        // Auto-select first bot if none selected
        if (!this.activeBot && bots.length > 0) {
            this.selectBot(bots[0].name);
        }
    }

    selectBot(botName) {
        this.activeBot = botName;
        
        // Update UI
        document.querySelectorAll('.agent-list__item').forEach(item => {
            if (item.dataset.botId === botName) {
                item.setAttribute('aria-selected', 'true');
            } else {
                item.removeAttribute('aria-selected');
            }
        });
        
        // Load historical data for this bot
        this.loadBotTimeline(botName);
    }

    async loadBotTimeline(botName) {
        try {
            const url = `/api/bots/${botName}/events?limit=100`;
            console.log('Loading bot timeline from:', url);
            const response = await fetch(url);
            const events = await response.json();
            console.log('Received events:', events);
            
            // Clear existing items
            this.items = [];
            
            // Process events into timeline items
            events.forEach(event => {
                this.processHistoricalEvent(event);
            });
            
            this.renderTimeline();
        } catch (error) {
            console.error('Failed to load bot timeline:', error);
        }
    }

    processHistoricalEvent(event) {
        // Convert historical events to timeline items
        const item = {
            id: event.id,
            ts: event.ts,
            bot_id: event.bot_id,
            type: event.type,
            data: event.payload,
            rendered: false
        };
        
        this.items.push(item);
    }

    addJobItem(data) {
        const item = {
            id: `job-${data.job_id}-${Date.now()}`,
            ts: Date.now(),
            bot_id: data.bot_id,
            job_id: data.job_id,
            type: 'job',
            phase: data.phase,
            state: data.state,
            data: data,
            rendered: false
        };
        
        this.addTimelineItem(item);
    }

    addPlanItem(data) {
        const item = {
            id: `plan-${data.job_id}-${Date.now()}`,
            ts: Date.now(),
            bot_id: data.bot_id,
            job_id: data.job_id,
            type: 'plan',
            data: {
                plan_mcrn: data.plan_mcrn,
                plan_summary: data.plan_summary
            },
            rendered: false
        };
        
        this.addTimelineItem(item);
    }

    addStepItem(data) {
        const item = {
            id: `step-${data.job_id}-${data.i}`,
            ts: data.ts || Date.now(),
            bot_id: data.bot_id,
            job_id: data.job_id,
            type: 'step',
            outcome: data.outcome,
            data: {
                i: data.i,
                op: data.op,
                outcome: data.outcome,
                ms: data.ms,
                details: data.details
            },
            rendered: false
        };
        
        // Check for burst collapsing
        this.addTimelineItem(item, true);
    }

    addToolItem(data) {
        const item = {
            id: `tool-${Date.now()}`,
            ts: Date.now(),
            bot_id: data.bot_id,
            job_id: data.job_id,
            type: 'tool',
            outcome: data.ok ? 'ok' : 'fail',
            data: {
                tool_name: data.tool_name,
                params_summary: data.params_summary,
                duration_ms: data.duration_ms,
                error: data.error
            },
            rendered: false
        };
        
        // Check for burst collapsing
        this.addTimelineItem(item, true);
    }

    addChatItem(data) {
        const item = {
            id: `chat-${Date.now()}`,
            ts: Date.now(),
            bot_id: data.bot_id,
            type: data.direction === 'in' ? 'chat-in' : 'chat-out',
            data: {
                from: data.from,
                text: data.text,
                channel: data.channel,
                linked_job_id: data.linked_job_id
            },
            rendered: false
        };
        
        this.addTimelineItem(item);
    }

    addSafetyItem(data) {
        const item = {
            id: `safety-${Date.now()}`,
            ts: Date.now(),
            bot_id: data.bot_id,
            job_id: data.job_id,
            type: 'safety',
            data: {
                hazards: data.hazards,
                first_seen_step: data.first_seen_step
            },
            rendered: false
        };
        
        this.addTimelineItem(item);
    }

    addEventItem(data) {
        // Generic event handler
        const item = {
            id: `event-${Date.now()}`,
            ts: Date.now(),
            bot_id: data.bot_id,
            type: 'system',
            data: data.payload,
            rendered: false
        };
        
        this.addTimelineItem(item);
    }

    addUsageItem(data) {
        const item = {
            id: `usage-${Date.now()}`,
            ts: data.ts,
            bot_id: data.bot_id,
            type: 'usage',
            data: {
                usd: data.usd,
                input: data.input,
                output: data.output,
                cache_read: data.cache_read,
                cache_creation: data.cache_creation
            },
            rendered: false
        };
        
        this.addTimelineItem(item);
    }

    addTimelineItem(item, checkBurst = false) {
        // Check if should be shown based on current filters
        if (this.viewMode === 'single' && item.bot_id !== this.activeBot) {
            return;
        }
        
        // Burst collapsing for tools
        if (checkBurst && (item.type === 'tool' || item.type === 'step')) {
            const lastItem = this.items[this.items.length - 1];
            if (lastItem && 
                lastItem.type === item.type &&
                lastItem.data.tool_name === item.data.tool_name &&
                (item.ts - lastItem.ts) < this.burstWindow) {
                // Collapse into burst
                if (!lastItem.burst) {
                    lastItem.burst = { count: 2, last_ms: item.data.ms || item.data.duration_ms };
                } else {
                    lastItem.burst.count++;
                    lastItem.burst.last_ms = item.data.ms || item.data.duration_ms;
                }
                lastItem.ts = item.ts; // Update timestamp
                this.renderTimeline();
                return;
            }
        }
        
        // Add to items array
        this.items.push(item);
        
        // Limit items for performance
        if (this.items.length > this.maxItems) {
            this.items = this.items.slice(-this.maxItems);
        }
        
        // Render if not filtered out
        if (this.shouldShowItem(item)) {
            this.renderTimelineItem(item);
        }
    }

    shouldShowItem(item) {
        // Check type filter
        if (!this.filters.types.has('all') && !this.filters.types.has(item.type.replace('chat-in', 'chat').replace('chat-out', 'chat'))) {
            return false;
        }
        
        // Check outcome filter
        if (this.filters.outcomes.size > 0 && item.outcome && !this.filters.outcomes.has(item.outcome)) {
            return false;
        }
        
        // Check search filter
        if (this.filters.search) {
            const searchStr = JSON.stringify(item.data).toLowerCase();
            if (!searchStr.includes(this.filters.search)) {
                return false;
            }
        }
        
        return true;
    }

    renderTimeline() {
        const timelineList = document.getElementById('timelineList');
        timelineList.innerHTML = '';
        
        let lastTs = 0;
        let currentJob = null;
        
        // Filter and sort items
        const visibleItems = this.items
            .filter(item => this.shouldShowItem(item))
            .sort((a, b) => a.ts - b.ts);
        
        visibleItems.forEach(item => {
            // Insert gap marker if needed
            if (lastTs && (item.ts - lastTs) > 30000) {
                const gap = document.createElement('div');
                gap.className = 'tl-gap';
                gap.textContent = `No activity for ${Math.floor((item.ts - lastTs) / 1000)}s`;
                timelineList.appendChild(gap);
            }
            
            // Check for job thread changes
            if (item.job_id && item.job_id !== currentJob) {
                currentJob = item.job_id;
                const thread = document.createElement('div');
                thread.className = 'tl-thread-header';
                thread.innerHTML = `Job #${item.job_id} • ${item.phase || ''} • ${item.type}`;
                timelineList.appendChild(thread);
            }
            
            this.renderTimelineItem(item, timelineList);
            lastTs = item.ts;
        });
    }

    renderTimelineItem(item, container = null) {
        if (!container) {
            container = document.getElementById('timelineList');
        }
        
        const element = document.createElement('div');
        element.className = `tl-item tl-item--${item.type}`;
        if (item.outcome) {
            element.className += ` tl-item--${item.outcome}`;
        }
        
        // Build header
        const relativeTime = this.getRelativeTime(item.ts);
        const botChip = this.viewMode === 'all' ? `<span class="tl-badge">${item.bot_id}</span>` : '';
        const jobChip = item.job_id ? `<span class="tl-badge tl-badge--job">#${item.job_id}</span>` : '';
        const phaseChip = item.phase ? `<span class="tl-badge tl-badge--phase">${item.phase}</span>` : '';
        
        // Build content based on type
        let title = '';
        let body = '';
        let footer = '';
        
        switch (item.type) {
            case 'intent':
                title = `Intent: ${item.data.type}`;
                body = this.formatIntentBody(item.data);
                footer = this.formatIntentFooter(item.data);
                break;
                
            case 'plan':
                title = 'Plan compiled';
                body = this.formatPlanBody(item.data);
                footer = this.formatPlanFooter(item.data);
                break;
                
            case 'job':
                title = `Job ${item.state}`;
                body = this.formatJobBody(item.data);
                footer = this.formatJobFooter(item.data);
                break;
                
            case 'step':
                const burstBadge = item.burst ? `<span class="tl-badge tl-badge--burst">×${item.burst.count}</span>` : '';
                title = `Step ${item.data.i}: ${item.data.op} ${burstBadge}`;
                body = this.formatStepBody(item.data);
                footer = this.formatStepFooter(item.data, item.burst);
                break;
                
            case 'tool':
                const toolBurst = item.burst ? `<span class="tl-badge tl-badge--burst">×${item.burst.count}</span>` : '';
                title = `Tool: ${item.data.tool_name} ${toolBurst}`;
                body = this.formatToolBody(item.data);
                footer = this.formatToolFooter(item.data, item.burst);
                break;
                
            case 'chat-in':
            case 'chat-out':
                title = item.data.from;
                body = `<div class="tl-item__body">${this.escapeHtml(item.data.text)}</div>`;
                footer = item.data.linked_job_id ? `<a href="#" data-job="${item.data.linked_job_id}">Job #${item.data.linked_job_id}</a>` : '';
                break;
                
            case 'safety':
                title = 'Safety Warning';
                body = this.formatSafetyBody(item.data);
                footer = '';
                break;
                
            case 'system':
                title = 'System';
                body = JSON.stringify(item.data);
                footer = '';
                break;
        }
        
        element.innerHTML = `
            <div class="tl-item__header">
                <div class="tl-item__meta">
                    ${botChip}
                    <span class="tl-badge">${item.type}</span>
                    ${jobChip}
                    ${phaseChip}
                    <span title="${new Date(item.ts).toISOString()}">${relativeTime}</span>
                </div>
                <div class="tl-item__outcome">${item.outcome || ''}</div>
            </div>
            <div class="tl-item__title">${title}</div>
            ${body ? `<div class="tl-item__body">${body}</div>` : ''}
            ${footer ? `<div class="tl-item__footer">${footer}</div>` : ''}
        `;
        
        // Add click handler for inspector
        element.addEventListener('click', () => {
            this.openInspector(item);
        });
        
        container.appendChild(element);
    }

    formatIntentBody(data) {
        const args = data.args ? Object.entries(data.args).map(([k, v]) => `${k}: ${v}`).join(', ') : '';
        const target = data.target ? `Target: ${JSON.stringify(data.target)}` : '';
        return `${args}<br>${target}`;
    }

    formatIntentFooter(data) {
        const badges = [];
        if (data.planner_latency_ms) {
            badges.push(`<span class="tl-badge tl-badge--duration">${data.planner_latency_ms}ms</span>`);
        }
        if (data.planner_tokens) {
            badges.push(`<span class="tl-badge tl-badge--usage">${data.planner_tokens} tokens</span>`);
        }
        if (data.planner_usd) {
            badges.push(`<span class="tl-badge tl-badge--usage">$${data.planner_usd.toFixed(4)}</span>`);
        }
        return badges.join(' ');
    }

    formatPlanBody(data) {
        if (!data.plan_summary) return '';
        const summary = data.plan_summary;
        return `
            Materials: ${summary.materials || 'none'}<br>
            Risks: ${summary.risks ? summary.risks.join(', ') : 'none'}<br>
            Est. steps: ${summary.est_steps || '?'}
        `;
    }

    formatPlanFooter(data) {
        const badges = [];
        if (data.plan_summary?.tactician_latency_ms) {
            badges.push(`<span class="tl-badge tl-badge--duration">${data.plan_summary.tactician_latency_ms}ms</span>`);
        }
        if (data.plan_summary?.tactician_tokens) {
            badges.push(`<span class="tl-badge tl-badge--usage">${data.plan_summary.tactician_tokens} tokens</span>`);
        }
        return badges.join(' ');
    }

    formatJobBody(data) {
        const parts = [];
        if (data.progress) parts.push(`Progress: ${data.progress}%`);
        if (data.eta_seconds) parts.push(`ETA: ${data.eta_seconds}s`);
        if (data.lease_until) parts.push(`Lease: ${Math.floor((data.lease_until - Date.now()) / 1000)}s`);
        return parts.join(' • ');
    }

    formatJobFooter(data) {
        const actions = [];
        if (data.state === 'running') {
            actions.push('<button class="tl-action" onclick="pauseJob(this.dataset.job)" data-job="' + data.job_id + '">Pause</button>');
            actions.push('<button class="tl-action" onclick="cancelJob(this.dataset.job)" data-job="' + data.job_id + '">Cancel</button>');
        }
        if (data.state === 'paused') {
            actions.push('<button class="tl-action" onclick="resumeJob(this.dataset.job)" data-job="' + data.job_id + '">Resume</button>');
        }
        return `<div class="tl-actions">${actions.join('')}</div>`;
    }

    formatStepBody(data) {
        if (!data.details) return '';
        const parts = [];
        if (data.details.macro) parts.push(`Macro: ${data.details.macro}`);
        if (data.details.predicates) parts.push(`Predicates: ${Object.keys(data.details.predicates).length}`);
        return parts.join(' • ');
    }

    formatStepFooter(data, burst) {
        const badges = [];
        const ms = burst ? burst.last_ms : data.ms;
        if (ms) badges.push(`<span class="tl-badge tl-badge--duration">${ms}ms</span>`);
        if (burst) badges.push(`<span class="tl-badge">burst ${this.burstWindow}ms window</span>`);
        return badges.join(' ');
    }

    formatToolBody(data) {
        return data.params_summary || '';
    }

    formatToolFooter(data, burst) {
        const badges = [];
        const ms = burst ? burst.last_ms : data.duration_ms;
        if (ms) badges.push(`<span class="tl-badge tl-badge--duration">${ms}ms</span>`);
        if (data.error) badges.push(`<span class="tl-badge tl-badge--fail">${data.error}</span>`);
        return badges.join(' ');
    }

    formatSafetyBody(data) {
        if (!data.hazards) return '';
        return data.hazards.map(h => `<span class="tl-badge tl-badge--hazard">${h}</span>`).join(' ');
    }

    getRelativeTime(ts) {
        const diff = Date.now() - ts;
        if (diff < 1000) return 'now';
        if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        return `${Math.floor(diff / 3600000)}h ago`;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    openInspector(item) {
        const inspector = document.getElementById('inspector');
        const title = document.getElementById('inspectorTitle');
        const content = document.getElementById('inspectorContent');
        
        title.textContent = `${item.type} Inspector`;
        
        // Build inspector content based on item type
        let html = '';
        
        // Common fields
        html += `
            <div class="inspector__section">
                <div class="inspector__section-title">Common</div>
                <div class="inspector__json">
                    ID: ${item.id}<br>
                    Time: ${new Date(item.ts).toISOString()}<br>
                    Bot: ${item.bot_id}<br>
                    ${item.job_id ? `Job: #${item.job_id}<br>` : ''}
                    ${item.phase ? `Phase: ${item.phase}<br>` : ''}
                    ${item.outcome ? `Outcome: ${item.outcome}<br>` : ''}
                </div>
            </div>
        `;
        
        // Type-specific fields
        if (item.type === 'step' && item.data.details) {
            const details = item.data.details;
            if (details.predicates) {
                html += `
                    <div class="inspector__section">
                        <div class="inspector__section-title">Predicates</div>
                        <div class="inspector__json">${JSON.stringify(details.predicates, null, 2)}</div>
                    </div>
                `;
            }
            if (details.invariants) {
                html += `
                    <div class="inspector__section">
                        <div class="inspector__section-title">Invariants</div>
                        <div class="inspector__json">${JSON.stringify(details.invariants, null, 2)}</div>
                    </div>
                `;
            }
            if (details.voxel_delta) {
                html += `
                    <div class="inspector__section">
                        <div class="inspector__section-title">Voxel Delta</div>
                        <div class="inspector__json">${JSON.stringify(details.voxel_delta, null, 2)}</div>
                    </div>
                `;
            }
        }
        
        // Raw data
        html += `
            <div class="inspector__section">
                <div class="inspector__section-title">Raw Data</div>
                <div class="inspector__json">${JSON.stringify(item.data, null, 2)}</div>
            </div>
        `;
        
        content.innerHTML = html;
        inspector.classList.add('inspector--open');
        this.inspectorOpen = true;
        this.selectedItem = item;
    }

    updateBotStatus(bot) {
        // Update bot in sidebar
        const item = document.querySelector(`[data-bot-id="${bot.id}"]`);
        if (item) {
            const status = bot.status || 'idle';
            const badge = item.querySelector('.agent-list__badge');
            if (badge) {
                badge.className = `agent-list__badge agent-list__badge--${status}`;
                badge.textContent = status;
            }
        }
    }

    filterBots() {
        // Apply bot filters
        const activeFilters = Array.from(document.querySelectorAll('[data-filter].filter-chip--active'))
            .map(el => el.dataset.filter);
        
        // Re-render bot list with filters
        this.loadBots();
    }
}

// Global functions for action buttons
function pauseJob(jobId) {
    fetch(`/api/jobs/${jobId}/pause`, { method: 'POST' })
        .then(res => res.json())
        .then(data => console.log('Job paused:', data))
        .catch(err => console.error('Failed to pause job:', err));
}

function resumeJob(jobId) {
    fetch(`/api/jobs/${jobId}/resume`, { method: 'POST' })
        .then(res => res.json())
        .then(data => console.log('Job resumed:', data))
        .catch(err => console.error('Failed to resume job:', err));
}

function cancelJob(jobId) {
    fetch(`/api/jobs/${jobId}/cancel`, { method: 'POST' })
        .then(res => res.json())
        .then(data => console.log('Job cancelled:', data))
        .catch(err => console.error('Failed to cancel job:', err));
}

function closeInspector() {
    const inspector = document.getElementById('inspector');
    inspector.classList.remove('inspector--open');
}

// Initialize timeline on page load
document.addEventListener('DOMContentLoaded', () => {
    window.masTimeline = new MASTimeline();
});