// MAS Timeline - Chat-style Debug Stream
// Vanilla JS implementation with WebSocket support

class MASTimeline {
    constructor() {
        this.ws = null;
        this.activeBot = null;
        this.viewMode = 'single'; // 'single' or 'all'
        this.items = [];
        this.bots = [];
        this.filters = {
            types: new Set(['all']),
            outcomes: new Set(),
            search: ''
        };
        this.burstWindow = 800; // ms for collapsing bursts
        this.maxItems = 300; // DOM performance limit
        this.inspectorOpen = false;
        this.selectedItem = null;
        this.selectedIndex = -1;
        this.elementRefs = [];
        this.oldestTsByBot = new Map();
        this.lastPhaseByJob = new Map();
        this.lastBurstByKey = new Map();
        
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
                // Reload timeline according to view mode
                if (this.viewMode === 'all') {
                    this.loadAllTimeline();
                } else if (this.activeBot) {
                    this.loadBotTimeline(this.activeBot);
                }
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

        // Load older
        const loadOlderBtn = document.getElementById('loadOlderBtn');
        if (loadOlderBtn) {
            loadOlderBtn.addEventListener('click', () => this.loadOlder());
        }
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
            case 'skill':
                this.addSkillItem(data);
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
                this.updateTodosFromTool(data);
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
            this.bots = bots;
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
            const inv = Array.isArray(bot.inventory) ? bot.inventory.slice(0, 8) : [];
            const invHtml = inv.length ? `
                <div class="agent-list__inventory">
                    ${inv.map(it => `
                        <div class=\"agent-list__inv-item\" title=\"${it.name} x${it.count}\"> 
                            <img src=\"/api/texture/${it.name}\" alt=\"${it.name}\" onerror=\"this.style.display='none'\" />
                            <span class=\"agent-list__inv-badge\">${it.count}</span>
                        </div>`).join('')}
                    ${bot.inventory && bot.inventory.length > 8 ? '<div class=\"agent-list__inv-item\" title=\"more\">…</div>' : ''}
                </div>
            ` : '';

            const todos = Array.isArray(bot.todo) ? bot.todo.slice(0,3) : [];
            const todoHtml = todos.length ? `
                <div class=\"agent-list__todos\">
                    ${todos.map(t => {
                        const done = t.done || String(t.status||'').toLowerCase()==='completed';
                        const boxCls = done ? 'agent-list__todo-box agent-list__todo-box--done' : 'agent-list__todo-box';
                        const check = done ? '<span class=\"agent-list__todo-check\">✓</span>' : '';
                        const text = (t.content || '').toString();
                        const trimmed = text.length > 40 ? text.slice(0, 40) + '…' : text;
                        return `<div class=\"agent-list__todo\"><span class=\"${boxCls}\"></span>${check}<span>${this.escapeHtml(trimmed)}</span></div>`;
                    }).join('')}
                    ${bot.todoProgress ? `<div class=\"agent-list__todo-progress\">${bot.todoProgress.done}/${bot.todoProgress.total} done</div>` : ''}
                </div>
            ` : '';

            item.innerHTML = `
                <div class="agent-list__meta">
                    <span class="agent-list__name">${bot.name}</span>
                    <div class="agent-list__badges">
                        <span class="agent-list__badge agent-list__badge--${status}">${status}</span>
                        ${jobBadge}
                    </div>
                </div>
                ${invHtml}
                ${todoHtml}
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
            this.elementRefs = [];
            this.lastBurstByKey.clear();
            this.oldestTsByBot.set(botName, events.length ? Math.min(...events.map(e => e.ts)) : Date.now());
            
            // Process events into timeline items
            events.forEach(event => {
                this.processHistoricalEvent(event);
            });
            
            this.renderTimeline();
        } catch (error) {
            console.error('Failed to load bot timeline:', error);
        }
    }

    async loadAllTimeline() {
        try {
            if (!this.bots || this.bots.length === 0) await this.loadBots();
            this.items = [];
            this.elementRefs = [];
            this.lastBurstByKey.clear();
            const perBotLimit = Math.max(10, Math.floor(this.maxItems / Math.max(1, this.bots.length)));
            const promises = this.bots.map(async (b) => {
                const res = await fetch(`/api/bots/${b.name}/events?limit=${perBotLimit}`);
                const events = await res.json();
                if (events?.length) this.oldestTsByBot.set(b.name, Math.min(...events.map(e => e.ts)));
                events.forEach(e => this.processHistoricalEvent(e));
            });
            await Promise.all(promises);
            this.renderTimeline();
        } catch (error) {
            console.error('Failed to load all-bots timeline:', error);
        }
    }

    async loadOlder() {
        try {
            if (this.viewMode === 'single' && this.activeBot) {
                const oldest = this.items.length ? Math.min(...this.items.filter(i => i.bot_id === this.activeBot).map(i => i.ts)) : Date.now();
                const url = `/api/bots/${this.activeBot}/events?limit=100&before_ts=${oldest}`;
                const res = await fetch(url);
                const events = await res.json();
                events.forEach(e => this.processHistoricalEvent(e));
            } else {
                // all-bots: fetch per bot
                const tasks = this.bots.map(async (b) => {
                    const currentOldest = this.items.length
                        ? Math.min(...this.items.filter(i => i.bot_id === b.name).map(i => i.ts))
                        : (this.oldestTsByBot.get(b.name) || Date.now());
                    const res = await fetch(`/api/bots/${b.name}/events?limit=50&before_ts=${currentOldest}`);
                    const events = await res.json();
                    events.forEach(e => this.processHistoricalEvent(e));
                });
                await Promise.all(tasks);
            }
            this.renderTimeline();
        } catch (e) {
            console.error('Failed to load older events:', e);
        }
    }

    processHistoricalEvent(event) {
        // Convert historical events to timeline items
        // Filter out send_chat tool events (we already render the chat message itself)
        if (event.type === 'tool' && event.payload && /send_chat/i.test(String(event.payload.tool_name || ''))) {
            return; // skip
        }
        let normalizedType = event.type;
        if (event.type === 'chat' && event.payload) {
            normalizedType = event.payload.direction === 'in' ? 'chat-in' : 'chat-out';
        }
        const item = {
            id: event.id,
            ts: event.ts,
            bot_id: event.bot_id,
            type: normalizedType,
            data: event.payload,
            rendered: false
        };
        // Carry correlation fields so rendering can show proper headers/titles
        if (event.payload) {
            if (event.type === 'job' || event.type === 'plan' || event.type === 'step' || event.type === 'tool' || event.type === 'safety') {
                item.job_id = event.payload.job_id;
            }
            if (event.type === 'job') {
                item.phase = event.payload.phase;
                item.state = event.payload.state;
            }
        }

        this.items.push(item);
        // Seed phase tracker for jobs
        if (event.type === 'job' && event.payload?.job_id && event.payload?.phase) {
            this.lastPhaseByJob.set(event.payload.job_id, event.payload.phase);
        }
    }

    updateJobItem(data) {
        try {
            const job = data.job || {};
            const jobId = job.id;
            if (!jobId) return;
            const prevPhase = this.lastPhaseByJob.get(jobId);
            if (prevPhase && job.phase && prevPhase !== job.phase) {
                const phaseItem = {
                    id: `phase-${jobId}-${Date.now()}`,
                    ts: job.updated_at || Date.now(),
                    bot_id: job.bot_id,
                    job_id: jobId,
                    type: 'system',
                    phase: job.phase,
                    data: { phase_change: `${prevPhase} → ${job.phase}`, job_id: jobId },
                    rendered: false
                };
                this.addTimelineItem(phaseItem);
            }
            if (job.phase) this.lastPhaseByJob.set(jobId, job.phase);
        } catch (e) {
            console.warn('updateJobItem error', e);
        }
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
        
        this.addTimelineItem(item, false);
    }

    addToolItem(data) {
        // Filter out send_chat tool events; chat message appears as a chat card
        if (data.tool_name && /send_chat/i.test(String(data.tool_name))) {
            return;
        }
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
                input: data.input,
                output: data.output,
                duration_ms: data.duration_ms,
                error: data.error
            },
            rendered: false
        };
        
        // Check for burst collapsing (tool only)
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
                linked_job_id: data.linked_job_id,
                kind: data.kind
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

    addSkillItem(data) {
        const item = {
            id: `skill-${Date.now()}`,
            ts: data.ts || Date.now(),
            bot_id: data.bot_id,
            type: 'skill',
            data: {
                name: data.name || (data.payload && data.payload.name),
                description: data.description || (data.payload && data.payload.description)
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
        const autoScroll = this.isTimelineAtBottom();
        // Check if should be shown based on current filters
        if (this.viewMode === 'single' && item.bot_id !== this.activeBot) {
            return;
        }
        
        // Burst collapsing for tools: key by tool + params + bot + job
        if (checkBurst && item.type === 'tool') {
            const key = `${item.bot_id}|${item.job_id}|${item.data.tool_name}|${JSON.stringify(item.data.params_summary||'')}`;
            const prev = this.lastBurstByKey.get(key);
            if (prev && (item.ts - prev.ts) < this.burstWindow) {
                if (!prev.item.burst) prev.item.burst = { count: 2, last_ms: item.data.duration_ms };
                else { prev.item.burst.count++; prev.item.burst.last_ms = item.data.duration_ms; }
                prev.item.ts = item.ts;
                prev.ts = item.ts;
                this.renderTimeline();
                return;
            }
            this.lastBurstByKey.set(key, { item, ts: item.ts });
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
            if (autoScroll) this.scrollTimelineToBottom();
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
        this.elementRefs = [];
        
        let lastTs = 0;
        let currentJob = null;
        
        // Filter and sort items
        const visibleItems = this.items
            .filter(item => this.shouldShowItem(item))
            .sort((a, b) => a.ts - b.ts);
        
        visibleItems.forEach(item => {
            // Check for job thread changes
            if (item.job_id && item.job_id !== currentJob) {
                currentJob = item.job_id;
                const thread = document.createElement('div');
                thread.className = 'tl-thread-header';
                const intent = (item.data && item.data.intent_type) ? ` • Intent: ${item.data.intent_type}` : '';
                const phase = item.phase ? ` • Phase: ${item.phase}` : '';
                thread.innerHTML = `Job #${item.job_id}${phase}${intent}`;
                timelineList.appendChild(thread);
            }
            
            this.renderTimelineItem(item, timelineList);
            lastTs = item.ts;
        });
    }

    // Auto-scroll helpers
    isTimelineAtBottom() {
        const scroller = document.querySelector('.timeline');
        if (!scroller) return false;
        const threshold = 40; // px tolerance
        return scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < threshold;
    }
    scrollTimelineToBottom() {
        const scroller = document.querySelector('.timeline');
        if (scroller) scroller.scrollTop = scroller.scrollHeight;
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
        const laneTag = this.getLaneTag(item.type);
        
        switch (item.type) {
            case 'skill':
                title = item.data.name ? `Skill: ${this.escapeHtml(item.data.name)}` : 'Skill';
                body = item.data.description ? this.escapeHtml(item.data.description) : '';
                footer = '';
                break;
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
                {
                    const st = item.state || item.data?.state || '';
                    const jid = item.job_id || item.data?.job_id || '';
                    title = `Job ${jid ? '#' + jid + ' • ' : ''}${st}`.trim();
                    body = this.formatJobBody(item.data);
                    footer = this.formatJobFooter({ ...item.data, job_id: jid });
                }
                break;
                
            case 'step':
                const burstBadge = item.burst ? `<span class="tl-badge tl-badge--burst">×${item.burst.count}</span>` : '';
                title = `Step ${item.data.i}: ${item.data.op} ${burstBadge}`;
                body = this.formatStepBody(item.data);
                footer = this.formatStepFooter(item.data, item.burst);
                break;
                
            case 'tool':
                const toolBurst = item.burst ? `<span class="tl-badge tl-badge--burst">×${item.burst.count}</span>` : '';
                title = `${this.humanToolTitle(item.data.tool_name, item)} ${toolBurst}`.trim();
                body = this.formatToolBody(item.data);
                footer = this.formatToolFooter(item.data, item.burst);
                break;
                
            case 'chat-in':
            case 'chat-out':
                title = item.data.from;
                const plannerBadge = item.data && item.data.kind === 'thinking' ? `<span class="tl-badge">Planner</span>` : '';
                const contentHtml = (item.data && item.data.kind === 'thinking')
                  ? this.renderMarkdown(item.data.text || '')
                  : this.escapeHtml(item.data.text || '');
                body = `<div class="tl-item__body">${contentHtml}</div>`;
                footer = `${plannerBadge} ${item.data.linked_job_id ? `<a href=\"#\" data-job=\"${item.data.linked_job_id}\">Job #${item.data.linked_job_id}</a>` : ''}`.trim();
                break;
                
            case 'safety':
                title = 'Safety Warning';
                body = this.formatSafetyBody(item.data);
                footer = '';
                break;
                
            case 'system':
                title = 'System';
                if (item.data && item.data.phase_change) {
                    body = `<div class="tl-gap">${this.escapeHtml(item.data.phase_change)}</div>`;
                } else {
                    body = this.escapeHtml(JSON.stringify(item.data));
                }
                footer = '';
                break;
        }
        
        element.innerHTML = `
            <div class="tl-item__header">
                <div class="tl-item__title">${title}</div>
                <div class="tl-item__meta">
                    ${botChip}
                    ${jobChip}
                    ${phaseChip}
                    <span class="tl-badge">${laneTag}</span>
                    <span class="tl-time" title="${new Date(item.ts).toISOString()}">${relativeTime}</span>
                    <span class="tl-item__outcome">${item.outcome || ''}</span>
                </div>
            </div>
            ${body ? `<div class="tl-item__body">${body}</div>` : ''}
            ${footer ? `<div class="tl-item__footer">${footer}</div>` : ''}
        `;
        
        // Add click handler for inspector
        element.addEventListener('click', () => {
            this.openInspector(item);
        });
        
        // Track ref for selection navigation
        this.elementRefs.push({ id: item.id, el: element, item });
        container.appendChild(element);
    }

    formatIntentBody(data) {
        const args = data.args ? Object.entries(data.args).map(([k, v]) => `${k}: ${v}`).join(', ') : '';
        const target = data.target ? `Target: ${this.escapeHtml(JSON.stringify(data.target))}` : '';
        const constraints = data.constraints ? `Constraints: ${this.escapeHtml(JSON.stringify(data.constraints))}` : '';
        const stop = data.stop_conditions ? `Stop: ${this.escapeHtml(data.stop_conditions)}` : '';
        return [args, target, constraints, stop].filter(Boolean).join('<br>');
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
        if (data.details.path_metrics?.length) parts.push(`Path len: ${data.details.path_metrics.length}`);
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
        const name = (data.tool_name || '').toString().toLowerCase();
        let summary = data.params_summary;
        if (typeof summary === 'string') {
            try { summary = JSON.parse(summary); } catch {}
        }

        // Render TodoWrite / todo_write as checklist
        if ((/todo/i.test(data.tool_name || '')) && summary && typeof summary === 'object' && Array.isArray(summary.todos)) {
            const items = summary.todos.map((t) => {
                const content = typeof t?.content === 'string' ? t.content : JSON.stringify(t);
                const done = String(t?.status || '').toLowerCase() === 'completed' || t?.done === true;
                const boxCls = done ? 'tl-todo__box tl-todo__box--done' : 'tl-todo__box';
                const check = done ? '<span class="tl-todo__check">✓</span>' : '';
                return `<li class="tl-todo"><span class="${boxCls}">${check}</span><span class="tl-todo__content">${this.escapeHtml(content)}</span></li>`;
            }).join('');
            return `<ul class="tl-todos">${items}</ul>`;
        }
        // Prefer a useful object among summary/output/input
        let obj = summary && typeof summary === 'object' ? summary : (data.input && typeof data.input === 'object' ? data.input : (data.output && typeof data.output === 'object' ? data.output : null));

        // Specializations for clearer summaries
        if (/(dig_block|break_block)/.test(name) && obj) {
            const c = this.extractCoords(obj);
            const b = this.extractName(obj, ['block','blockName','name','id']);
            const parts = [];
            if (c) parts.push(`<span class=\"tl-kv__key\">target</span> <span class=\"tl-kv__val\">(${c.x}, ${c.y}, ${c.z})</span>`);
            if (b) parts.push(`<span class=\"tl-kv__key\">block</span> <span class=\"tl-kv__val\">${this.escapeHtml(b)}</span>`);
            return parts.length ? `<div class=\"tl-kv\">${parts.join(' • ')}</div>` : '';
        }
        if (/place_block/.test(name) && obj) {
            const c = this.extractCoords(obj);
            const b = this.extractName(obj, ['block','blockName','name','item','item_name']);
            const face = this.extractName(obj, ['face','direction']);
            const parts = [];
            if (b) parts.push(`<span class=\"tl-kv__key\">block</span> <span class=\"tl-kv__val\">${this.escapeHtml(b)}</span>`);
            if (c) parts.push(`<span class=\"tl-kv__key\">at</span> <span class=\"tl-kv__val\">(${c.x}, ${c.y}, ${c.z})</span>`);
            if (face) parts.push(`<span class=\"tl-kv__key\">face</span> <span class=\"tl-kv__val\">${this.escapeHtml(face)}</span>`);
            return parts.length ? `<div class=\"tl-kv\">${parts.join(' • ')}</div>` : '';
        }
        if (/equip_item/.test(name) && obj) {
            const item = this.extractName(obj, ['item','item_name','name']);
            const slot = this.extractName(obj, ['slot','hand']);
            const parts = [];
            if (item) parts.push(`<span class=\"tl-kv__key\">item</span> <span class=\"tl-kv__val\">${this.escapeHtml(item)}</span>`);
            if (slot) parts.push(`<span class=\"tl-kv__key\">hand</span> <span class=\"tl-kv__val\">${this.escapeHtml(slot)}</span>`);
            return parts.length ? `<div class=\"tl-kv\">${parts.join(' • ')}</div>` : '';
        }
        if (/(move_to_position|navigate|goto)/.test(name) && obj) {
            const c = this.extractCoords(obj);
            if (c) return `<div class=\"tl-kv\"><span class=\"tl-kv__key\">to</span> <span class=\"tl-kv__val\">(${c.x}, ${c.y}, ${c.z})</span></div>`;
        }
        if (/send_chat/.test(name) && obj) {
            const m = this.extractName(obj, ['message','text']);
            if (m) return `<div class=\"tl-kv\"><span class=\"tl-kv__key\">message</span> <span class=\"tl-kv__val\">${this.escapeHtml(m)}</span></div>`;
        }

        // Render output if available (title row now in card header)
        let out = '';
        const output = data.output;
        if (output !== undefined) {
            const outText = typeof output === 'string' ? output : JSON.stringify(output, null, 2);
            out = this.renderToolOutput(outText);
        }
        return out ? `<div class=\"tool-view\">${out}</div>` : '';
    }

    formatToolFooter(data, burst) {
        const badges = [];
        const ms = burst ? burst.last_ms : data.duration_ms;
        if (ms) badges.push(`<span class="tl-badge tl-badge--duration">${ms}ms</span>`);
        if (data.error) badges.push(`<span class="tl-badge tl-badge--fail">${data.error}</span>`);
        // Todo counts
        let summary = data.params_summary;
        if (typeof summary === 'string') { try { summary = JSON.parse(summary); } catch {} }
        if ((/todo/i.test(data.tool_name || '')) && summary && Array.isArray(summary.todos)) {
            const total = summary.todos.length;
            const done = summary.todos.filter((t) => String(t?.status||'').toLowerCase()==='completed' || t?.done===true).length;
            badges.push(`<span class="tl-badge">${done}/${total} done</span>`);
        }
        return badges.join(' ');
    }

    renderToolOutput(text) {
        const lines = text.split(/\r?\n/);
        const max = 12;
        if (lines.length <= max) {
            return `<pre class=\"tool-output\">${this.escapeHtml(text)}</pre>`;
        }
        const remain = lines.length - max;
        const head = lines.slice(0, max).join('\n');
        const full = this.escapeHtml(text);
        const short = this.escapeHtml(head) + `\n… +${remain} lines`;
        const id = 'toolout-' + Math.random().toString(36).slice(2, 8);
        return `
            <pre id=\"${id}\" class=\"tool-output\" data-full=\"${full}\" data-short=\"${short}\">${short}</pre>
            <div class=\"tool-more\" onclick=\"window.masTimeline && window.masTimeline.expandOutput('${id}')\">Toggle full output</div>
        `;
    }

    expandOutput(id) {
        const el = document.getElementById(id);
        if (!el) return;
        const full = el.getAttribute('data-full');
        const short = el.getAttribute('data-short');
        if (!full || !short) return;
        const showingFull = el.getAttribute('data-show') === 'full';
        if (showingFull) {
            el.textContent = '';
            el.innerHTML = short;
            el.setAttribute('data-show', 'short');
        } else {
            el.textContent = '';
            el.innerHTML = full;
            el.setAttribute('data-show', 'full');
        }
    }

    extractCoords(obj) {
        if (!obj || typeof obj !== 'object') return null;
        const cand = [obj, obj.pos, obj.position, obj.target, obj.location].find((o) => o && typeof o === 'object' && ('x' in o || 'y' in o || 'z' in o));
        if (!cand) return null;
        const x = Math.round(Number(cand.x ?? cand[0] ?? NaN));
        const y = Math.round(Number(cand.y ?? cand[1] ?? NaN));
        const z = Math.round(Number(cand.z ?? cand[2] ?? NaN));
        if ([x,y,z].some((v) => Number.isNaN(v))) return null;
        return { x, y, z };
    }

    extractName(obj, keys) {
        if (!obj || typeof obj !== 'object') return '';
        for (const k of keys) {
            if (obj[k] !== undefined && obj[k] !== null) return String(obj[k]);
        }
        return '';
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

    renderMarkdown(text) {
        try {
            if (window.marked) {
                const raw = window.marked.parse(text, { breaks: true });
                if (window.DOMPurify) return window.DOMPurify.sanitize(raw);
                return raw;
            }
        } catch (e) {
            console.warn('Markdown render failed:', e);
        }
        // Fallback: escape and preserve newlines
        return this.escapeHtml(text).replace(/\n/g, '<br>');
    }

    getLaneTag(type) {
        switch (type) {
            case 'intent': return 'Intent';
            case 'plan': return 'Plan';
            case 'job': return 'System';
            case 'step': return 'Exec';
            case 'tool': return 'Tool';
            case 'skill': return 'Skill';
            case 'safety': return 'Safety';
            case 'chat-in': return 'Chat';
            case 'chat-out': return 'Chat';
            case 'usage': return 'Usage';
            default: return type;
        }
    }

    humanToolTitle(toolName, item) {
        if (!toolName) return 'Tool';
        const n = String(toolName).toLowerCase();
        const bot = item?.bot_id || 'Bot';
        if (n.includes('todo')) return 'Update Todo';
        if (n.includes('analyze_surroundings') || n.includes('look') && n.includes('around') || n.includes('scan')) return `${bot} is looking around`;
        if (n.includes('send_chat')) return 'Send Chat';
        if (n.includes('equip_item')) return 'Equip Item';
        if (n.includes('dig_block') || n.includes('break_block')) return 'Mine Block';
        if (n.includes('place_block')) return 'Place Block';
        if (n.includes('find_block')) return 'Find Block';
        if (n.includes('find_entity')) return 'Find Entity';
        if (n.includes('build_pillar')) return 'Build Pillar';
        if (n.includes('build_stairs') || n.includes('stairs')) return 'Build Stairs';
        if (n.includes('move') || n.includes('goto') || n.includes('navigate')) return 'Navigate';
        if (n.includes('get_position')) return 'Get Position';
        // strip mcp prefix
        const stripped = toolName.replace(/^mcp__[^_]+__/, '').replace(/_/g, ' ');
        return stripped.replace(/\b\w/g, (c) => c.toUpperCase());
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
                        <pre class="inspector__json"><code class="language-yaml">${this.escapeHtml(this.toYaml(details.predicates))}</code></pre>
                    </div>
                `;
            }
            if (details.invariants) {
                html += `
                    <div class="inspector__section">
                        <div class="inspector__section-title">Invariants</div>
                        <pre class="inspector__json"><code class="language-yaml">${this.escapeHtml(this.toYaml(details.invariants))}</code></pre>
                    </div>
                `;
            }
            if (details.voxel_delta) {
                html += `
                    <div class="inspector__section">
                        <div class="inspector__section-title">Voxel Delta</div>
                        <pre class="inspector__json"><code class="language-yaml">${this.escapeHtml(this.toYaml(details.voxel_delta))}</code></pre>
                    </div>
                `;
            }
            if (details.path_metrics) {
                html += `
                    <div class="inspector__section">
                        <div class="inspector__section-title">Path Metrics</div>
                        <pre class="inspector__json"><code class="language-yaml">${this.escapeHtml(this.toYaml(details.path_metrics))}</code></pre>
                    </div>
                `;
            }
        }

        if (item.type === 'plan') {
            if (item.data.plan_summary) {
                html += `
                    <div class="inspector__section">
                        <div class="inspector__section-title">Plan Summary</div>
                        <pre class="inspector__json"><code class="language-yaml">${this.escapeHtml(this.toYaml(item.data.plan_summary))}</code></pre>
                    </div>
                `;
            }
            if (item.data.plan_mcrn) {
                html += `
                    <div class="inspector__section">
                        <div class="inspector__section-title">Plan MCRN</div>
                        <div class="inspector__json">${this.escapeHtml(item.data.plan_mcrn)}</div>
                    </div>
                `;
            }
        }

        if (item.type === 'tool') {
            html += `
                <div class="inspector__section">
                    <div class="inspector__section-title">Tool Params</div>
                    <pre class="inspector__json"><code class="language-yaml">${this.escapeHtml(this.toYaml(item.data.params_summary))}</code></pre>
                </div>
            `;
            if (item.data.error) {
                html += `
                    <div class="inspector__section">
                        <div class="inspector__section-title">Tool Error</div>
                        <div class="inspector__json">${this.escapeHtml(String(item.data.error))}</div>
                    </div>
                `;
            }
        }
        
        // Raw data
        html += `
            <div class="inspector__section">
                <div class="inspector__section-title">Raw Data</div>
                <pre class="inspector__json"><code class="language-yaml">${this.escapeHtml(this.toYaml(item.data))}</code></pre>
            </div>
        `;
        
        content.innerHTML = html;
        try { if (window.hljs) { content.querySelectorAll('code').forEach((el) => window.hljs.highlightElement(el)); } } catch {}
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
            // Refresh sidebar todos from status if available
            if (Array.isArray(bot.todo)) {
                this.renderSidebarTodos(item, bot.todo, bot.todoProgress);
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

    // Parse TodoWrite tool events → sidebar updater
    updateTodosFromTool(data) {
        try {
            const name = (data.tool_name || '').toString().toLowerCase();
            if (!/todo/.test(name)) return;
            let summary = data.output ?? data.params_summary ?? data.input;
            if (typeof summary === 'string') { try { summary = JSON.parse(summary); } catch {} }
            const todos = Array.isArray(summary?.todos) ? summary.todos : [];
            const done = todos.filter((t) => String(t?.status||'').toLowerCase()==='completed' || t?.done===true).length;
            // Update local cache
            const bot = (this.bots || []).find((b) => b.name === data.bot_id);
            if (bot) {
                bot.todo = todos;
                bot.todoProgress = { done, total: todos.length };
            }
            // Update sidebar DOM if present
            const el = document.querySelector(`[data-bot-id="${data.bot_id}"]`);
            if (el) this.renderSidebarTodos(el, todos, { done, total: todos.length });
        } catch (e) {
            console.warn('updateTodosFromTool failed:', e);
        }
    }

    renderSidebarTodos(itemEl, todos, progress) {
        try {
            const containerSel = '.agent-list__todos';
            let container = itemEl.querySelector(containerSel);
            if (!container) {
                container = document.createElement('div');
                container.className = 'agent-list__todos';
                itemEl.appendChild(container);
            }
            const html = (Array.isArray(todos) ? todos.slice(0,3) : []).map((t) => {
                const done = t.done || String(t.status||'').toLowerCase()==='completed';
                const boxCls = done ? 'agent-list__todo-box agent-list__todo-box--done' : 'agent-list__todo-box';
                const check = done ? '<span class="agent-list__todo-check">✓</span>' : '';
                const text = (t.content || '').toString();
                const trimmed = text.length > 40 ? text.slice(0, 40) + '…' : text;
                return `<div class="agent-list__todo"><span class="${boxCls}"></span>${check}<span>${this.escapeHtml(trimmed)}</span></div>`;
            }).join('');
            const footer = progress ? `<div class="agent-list__todo-progress">${progress.done}/${progress.total} done</div>` : '';
            container.innerHTML = html + footer;
        } catch {}
    }

    // Selection navigation
    navigateSelection(delta) {
        const list = this.items
            .filter(i => this.shouldShowItem(i))
            .sort((a, b) => a.ts - b.ts);
        if (!list.length) return;
        if (this.selectedIndex < 0) this.selectedIndex = delta > 0 ? 0 : list.length - 1;
        else this.selectedIndex = Math.max(0, Math.min(list.length - 1, this.selectedIndex + delta));
        const selected = list[this.selectedIndex];
        this.highlightItem(selected?.id);
    }

    highlightItem(id) {
        document.querySelectorAll('.tl-item').forEach(el => el.classList.remove('tl-item--selected'));
        const ref = this.elementRefs.find(r => r.id === id);
        if (ref?.el) {
            ref.el.classList.add('tl-item--selected');
            ref.el.scrollIntoView({ block: 'nearest' });
            this.selectedItem = ref.item;
        }
    }

    openSelectedInspector() {
        if (this.selectedItem) this.openInspector(this.selectedItem);
    }

    toYaml(obj) {
        try {
            if (window.jsyaml) {
                return window.jsyaml.dump(obj, { noRefs: true, indent: 2, lineWidth: 100 });
            }
        } catch (e) {
            console.warn('YAML dump failed:', e);
        }
        try { return JSON.stringify(obj, null, 2); } catch { return String(obj); }
    }
}

// Global functions for action buttons
function pauseJob(jobId) {
    fetch(`/api/jobs/${jobId}/pause`, { method: 'POST' })
        .then(res => res.json())
        .then(data => { console.log('Job paused:', data); window.masTimeline && window.masTimeline.addEventItem({ type: 'event', bot_id: 'system', payload: { action: 'pause', job_id: jobId } }); })
        .catch(err => console.error('Failed to pause job:', err));
}

function resumeJob(jobId) {
    fetch(`/api/jobs/${jobId}/resume`, { method: 'POST' })
        .then(res => res.json())
        .then(data => { console.log('Job resumed:', data); window.masTimeline && window.masTimeline.addEventItem({ type: 'event', bot_id: 'system', payload: { action: 'resume', job_id: jobId } }); })
        .catch(err => console.error('Failed to resume job:', err));
}

function cancelJob(jobId) {
    fetch(`/api/jobs/${jobId}/cancel`, { method: 'POST' })
        .then(res => res.json())
        .then(data => { console.log('Job cancelled:', data); window.masTimeline && window.masTimeline.addEventItem({ type: 'event', bot_id: 'system', payload: { action: 'cancel', job_id: jobId } }); })
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
