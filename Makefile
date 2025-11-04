SERVER_DIR := minecraft-server/server
JAVA_HOME := /usr/local/Cellar/openjdk/25.0.1/libexec/openjdk.jdk/Contents/Home
SERVER_JAR := paper.jar
MIN_RAM := 2G
MAX_RAM := 4G
JVM_FLAGS := -XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC -XX:+AlwaysPreTouch -XX:G1NewSizePercent=30 -XX:G1MaxNewSizePercent=40 -XX:G1HeapRegionSize=8M -XX:G1ReservePercent=20 -XX:G1HeapWastePercent=5 -XX:G1MixedGCCountTarget=4 -XX:InitiatingHeapOccupancyPercent=15 -XX:G1MixedGCLiveThresholdPercent=90 -XX:G1RSetUpdatingPauseTimePercent=5 -XX:SurvivorRatio=32 -XX:+PerfDisableSharedMem -XX:MaxTenuringThreshold=1
PID_FILE := $(SERVER_DIR)/server.pid
LOG_FILE := $(SERVER_DIR)/startup.log

AGENT_DIR := minecraft-claude-agent
AGENT_ENV := DISABLE_VIEWER=true
AGENT_PID_ROOT := $(AGENT_DIR)/logs
COLONY_PID_FILE := $(AGENT_DIR)/colony-runtime.pid
COLONY_LOG_FILE := $(AGENT_DIR)/logs/colony-runtime.log

# Dashboard port (used by colony runtime / timeline UI)
DASHBOARD_PORT ?= 4242
COLONY_CMD := env $(AGENT_ENV) DASHBOARD_PORT=$(DASHBOARD_PORT) pnpm colony

.PHONY: start-server stop-server restart-server status-server \
        start-agents stop-agents restart-agents status-agents \
        start-colony stop-colony restart-colony status-colony

start-server:
	@mkdir -p $(SERVER_DIR)
	if [ -f $(PID_FILE) ] && kill -0 $$(cat $(PID_FILE)) 2>/dev/null; then \
		echo "Server already running (PID $$(cat $(PID_FILE)))"; \
		exit 0; \
	fi
	@echo "Starting Minecraft server..."
	@cd $(SERVER_DIR) && \
	export JAVA_HOME=$(JAVA_HOME) && \
	touch startup.log && \
	nohup $$JAVA_HOME/bin/java -Xms$(MIN_RAM) -Xmx$(MAX_RAM) $(JVM_FLAGS) -jar $(SERVER_JAR) --nogui >> startup.log 2>&1 & echo $$! > server.pid
	@sleep 2
	@if [ -f $(PID_FILE) ] && kill -0 $$(cat $(PID_FILE)) 2>/dev/null; then \
		echo "Server started with PID $$(cat $(PID_FILE))"; \
	else \
		echo "Failed to start server. Check $(LOG_FILE)"; \
		rm -f $(PID_FILE); \
		exit 1; \
	fi

stop-server:
	@if [ ! -f $(PID_FILE) ]; then \
		echo "No PID file found. Server might not be running."; \
		exit 0; \
	fi
	@PID=$$(cat $(PID_FILE)); \
	if kill -0 $$PID 2>/dev/null; then \
		echo "Stopping server (PID $$PID)..."; \
		kill $$PID; \
		wait $$PID 2>/dev/null || true; \
		echo "Server stopped."; \
	else \
		echo "PID $$PID not running. Cleaning up."; \
	fi
	@rm -f $(PID_FILE)

restart-server: stop-server start-server

status-server:
	@if [ -f $(PID_FILE) ] && kill -0 $$(cat $(PID_FILE)) 2>/dev/null; then \
		echo "Server running (PID $$(cat $(PID_FILE)))"; \
	else \
		echo "Server not running."; \
	fi

start-agents:
	@echo "Starting Claude agents via colony-ctl..."
	@cd $(AGENT_DIR) && $(AGENT_ENV) pnpm colony-ctl start-all

stop-agents:
	@echo "Stopping Claude agents via colony-ctl..."
	@cd $(AGENT_DIR) && pnpm colony-ctl stop-all

restart-agents:
	@$(MAKE) stop-agents
	@$(MAKE) start-agents

status-agents:
	@cd $(AGENT_DIR) && pnpm colony-ctl status

start-colony:
	@if [ -f $(COLONY_PID_FILE) ] && kill -0 $$(cat $(COLONY_PID_FILE)) 2>/dev/null; then \
		echo "Colony runtime already running (PID $$(cat $(COLONY_PID_FILE)))"; \
		exit 0; \
	fi
	# Ensure no stale process is blocking the dashboard port
	@PORT_PIDS=$$(lsof -ti tcp:$(DASHBOARD_PORT) 2>/dev/null || true); \
	if [ -n "$$PORT_PIDS" ]; then \
		echo "Killing process(es) blocking port $(DASHBOARD_PORT): $$PORT_PIDS"; \
		kill $$PORT_PIDS 2>/dev/null || true; \
		sleep 1; \
		for p in $$PORT_PIDS; do kill -0 $$p 2>/dev/null && kill -9 $$p 2>/dev/null || true; done; \
	fi
	@echo "Starting colony runtime (bots + dashboard)..."
	@cd $(AGENT_DIR) && \
	mkdir -p logs && \
	nohup $(COLONY_CMD) >> logs/colony-runtime.log 2>&1 & echo $$! > colony-runtime.pid
	@sleep 2
	@if [ -f $(COLONY_PID_FILE) ] && kill -0 $$(cat $(COLONY_PID_FILE)) 2>/dev/null; then \
		echo "Colony runtime started (PID $$(cat $(COLONY_PID_FILE)))"; \
	else \
		echo "Failed to start colony runtime. Check $(COLONY_LOG_FILE)"; \
		rm -f $(COLONY_PID_FILE); \
		exit 1; \
	fi

stop-colony:
	@if [ ! -f $(COLONY_PID_FILE) ]; then \
		echo "No colony runtime PID file found."; \
		exit 0; \
	fi
	@PID=$$(cat $(COLONY_PID_FILE)); \
	if kill -0 $$PID 2>/dev/null; then \
		echo "Stopping colony runtime (PID $$PID)..."; \
		kill $$PID; \
		wait $$PID 2>/dev/null || true; \
	else \
		echo "PID $$PID not running. Cleaning up."; \
	fi
	@rm -f $(COLONY_PID_FILE)
	@$(MAKE) stop-agents
	# Also ensure the dashboard port is free
	@PORT_PIDS=$$(lsof -ti tcp:$(DASHBOARD_PORT) 2>/dev/null || true); \
	if [ -n "$$PORT_PIDS" ]; then \
		echo "Cleaning up processes on port $(DASHBOARD_PORT): $$PORT_PIDS"; \
		kill $$PORT_PIDS 2>/dev/null || true; \
		sleep 1; \
		for p in $$PORT_PIDS; do kill -0 $$p 2>/dev/null && kill -9 $$p 2>/dev/null || true; done; \
	fi

restart-colony:
	@$(MAKE) stop-colony
	@sleep 1
	@$(MAKE) start-colony

status-colony:
	@if [ -f $(COLONY_PID_FILE) ] && kill -0 $$(cat $(COLONY_PID_FILE)) 2>/dev/null; then \
		echo "Colony runtime running (PID $$(cat $(COLONY_PID_FILE)))"; \
	else \
		echo "Colony runtime not running."; \
	fi
