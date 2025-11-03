import fs from 'fs';
import path from 'path';

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  context?: {
    position?: { x: number; y: number; z: number };
    health?: number;
    food?: number;
    inventory?: string;
  };
}

export interface BotMemory {
  botName: string;
  createdAt: string;
  lastUpdated: string;
  lastActiveSessionId?: string;
  sessions: {
    sessionId: string;
    startTime: string;
    endTime?: string;
    messages: ConversationMessage[];
    activities: {
      timestamp: string;
      type: string;
      description: string;
      data?: any;
    }[];
    accomplishments: {
      timestamp: string;
      description: string;
      location?: { x: number; y: number; z: number };
    }[];
  }[];
  preferences: {
    [key: string]: any;
  };
  relationships: {
    [playerName: string]: {
      trustLevel: number;
      lastInteraction: string;
      notes: string[];
    };
  };
  learnedFacts: {
    timestamp: string;
    fact: string;
    context?: string;
  }[];
}

export class MemoryStore {
  private memoryPath: string;
  private memory: BotMemory;

  constructor(botName: string) {
    this.memoryPath = path.resolve('logs/memories', `${botName}.json`);
    this.memory = this.loadMemory(botName);
  }

  private loadMemory(botName: string): BotMemory {
    try {
      const dir = path.dirname(this.memoryPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (fs.existsSync(this.memoryPath)) {
        const data = fs.readFileSync(this.memoryPath, 'utf-8');
        const memory = JSON.parse(data);
        console.log(`[MemoryStore] Loaded memory for ${botName} with ${memory.sessions.length} sessions`);
        return memory;
      }
    } catch (error) {
      console.error(`[MemoryStore] Failed to load memory for ${botName}:`, error);
    }

    // Create new memory if none exists
    const newMemory: BotMemory = {
      botName,
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      sessions: [],
      preferences: {},
      relationships: {},
      learnedFacts: []
    };

    console.log(`[MemoryStore] Created new memory for ${botName}`);
    return newMemory;
  }

  private saveMemory(): void {
    try {
      this.memory.lastUpdated = new Date().toISOString();
      const tempPath = `${this.memoryPath}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(this.memory, null, 2));
      fs.renameSync(tempPath, this.memoryPath);
    } catch (error) {
      console.error(`[MemoryStore] Failed to save memory:`, error);
    }
  }

  public createSession(sessionId: string): void {
    const session = {
      sessionId,
      startTime: new Date().toISOString(),
      messages: [],
      activities: [],
      accomplishments: []
    };

    this.memory.sessions.push(session);
    
    // Update last active session
    this.memory.lastActiveSessionId = sessionId;
    
    // Keep only last 10 sessions to prevent memory bloat
    if (this.memory.sessions.length > 10) {
      this.memory.sessions = this.memory.sessions.slice(-10);
    }

    this.saveMemory();
  }

  public addMessage(sessionId: string, role: 'user' | 'assistant' | 'system', content: string, context?: any): void {
    const session = this.memory.sessions.find(s => s.sessionId === sessionId);
    if (!session) {
      console.warn(`[MemoryStore] Session ${sessionId} not found`);
      return;
    }

    const message: ConversationMessage = {
      role,
      content,
      timestamp: new Date().toISOString(),
      context
    };

    session.messages.push(message);
    this.saveMemory();
  }

  public addActivity(sessionId: string, type: string, description: string, data?: any): void {
    const session = this.memory.sessions.find(s => s.sessionId === sessionId);
    if (!session) {
      return;
    }

    session.activities.push({
      timestamp: new Date().toISOString(),
      type,
      description,
      data
    });

    this.saveMemory();
  }

  public addAccomplishment(sessionId: string, description: string, location?: { x: number; y: number; z: number }): void {
    const session = this.memory.sessions.find(s => s.sessionId === sessionId);
    if (!session) {
      return;
    }

    session.accomplishments.push({
      timestamp: new Date().toISOString(),
      description,
      location
    });

    this.saveMemory();
  }

  public learnFact(fact: string, context?: string): void {
    this.memory.learnedFacts.push({
      timestamp: new Date().toISOString(),
      fact,
      context
    });

    // Keep only last 100 learned facts
    if (this.memory.learnedFacts.length > 100) {
      this.memory.learnedFacts = this.memory.learnedFacts.slice(-100);
    }

    this.saveMemory();
  }

  public updateRelationship(playerName: string, trustDelta: number, note?: string): void {
    if (!this.memory.relationships[playerName]) {
      this.memory.relationships[playerName] = {
        trustLevel: 50, // Neutral starting point
        lastInteraction: new Date().toISOString(),
        notes: []
      };
    }

    this.memory.relationships[playerName].trustLevel += trustDelta;
    this.memory.relationships[playerName].trustLevel = Math.max(0, Math.min(100, this.memory.relationships[playerName].trustLevel));
    this.memory.relationships[playerName].lastInteraction = new Date().toISOString();

    if (note) {
      this.memory.relationships[playerName].notes.push(note);
      // Keep only last 10 notes per player
      if (this.memory.relationships[playerName].notes.length > 10) {
        this.memory.relationships[playerName].notes = this.memory.relationships[playerName].notes.slice(-10);
      }
    }

    this.saveMemory();
  }

  public getContextualPrompt(sessionId: string): string {
    const currentSession = this.memory.sessions.find(s => s.sessionId === sessionId);
    
    let prompt = '';
    
    // Add bot personality and backstory
    prompt += `You are ${this.memory.botName}, an autonomous Minecraft bot. `;
    prompt += `You have existed since ${new Date(this.memory.createdAt).toLocaleDateString()}. `;
    
    // Add recent accomplishments (last 5)
    const allAccomplishments = this.memory.sessions.flatMap(s => s.accomplishments);
    const recentAccomplishments = allAccomplishments.slice(-5);
    if (recentAccomplishments.length > 0) {
      prompt += `Recent accomplishments:\n`;
      recentAccomplishments.forEach(acc => {
        prompt += `- ${acc.description} (${new Date(acc.timestamp).toLocaleDateString()})\n`;
      });
      prompt += '\n';
    }

    // Add learned facts (last 10 relevant ones)
    if (this.memory.learnedFacts.length > 0) {
      prompt += `Important facts you've learned:\n`;
      this.memory.learnedFacts.slice(-10).forEach(fact => {
        prompt += `- ${fact.fact}\n`;
      });
      prompt += '\n';
    }

    // Add relationships with current session participants
    if (currentSession) {
      const participants = new Set<string>();
      currentSession.messages
        .filter(msg => msg.role === 'user')
        .forEach(msg => {
          const match = msg.content.match(/^(\w+):/);
          if (match) participants.add(match[1]);
        });
      
      if (participants.size > 0) {
        prompt += `Your relationships:\n`;
        participants.forEach(player => {
          const rel = this.memory.relationships[player];
          if (rel) {
            const trust = rel.trustLevel > 70 ? 'highly trusts' : 
                         rel.trustLevel > 30 ? 'neutral with' : 'is wary of';
            prompt += `- You ${trust} ${player}\n`;
          }
        });
        prompt += '\n';
      }
    }

    // Add recent conversation context (last 10 messages across all sessions)
    const recentMessages: ConversationMessage[] = [];
    this.memory.sessions.forEach(session => {
      recentMessages.push(...session.messages.slice(-5));
    });
    const sortedMessages = recentMessages
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 20);

    if (sortedMessages.length > 0) {
      prompt += `Recent conversation history:\n`;
      sortedMessages.slice(-10).forEach(msg => {
        const time = new Date(msg.timestamp).toLocaleTimeString();
        const role = msg.role === 'user' ? 'Player' : msg.role === 'assistant' ? 'You' : 'System';
        prompt += `[${time}] ${role}: ${msg.content}\n`;
      });
      prompt += '\n';
    }

    return prompt;
  }

  public getMemory(): BotMemory {
    return { ...this.memory };
  }

  public getLastActiveSessionId(): string | undefined {
    return this.memory.lastActiveSessionId;
  }

  public getFullConversationHistory(): ConversationMessage[] {
    return this.memory.sessions.flatMap(s => s.messages);
  }
}
