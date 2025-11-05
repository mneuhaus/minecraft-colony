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
SHOW_FAIL_LOG ?= 0

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
	@printf "Starting agents... "
	@cd $(AGENT_DIR) && $(AGENT_ENV) pnpm -s colony-ctl start-all >/dev/null 2>&1 || true
	@echo "done"

stop-agents:
	@printf "Stopping agents... "
	@cd $(AGENT_DIR) && pnpm -s colony-ctl stop-all >/dev/null 2>&1 || true
	@echo "done"

restart-agents:
	@$(MAKE) stop-agents
	@$(MAKE) start-agents

status-agents:
	@cd $(AGENT_DIR) && pnpm colony-ctl status

start-colony:
	@if [ -f $(COLONY_PID_FILE) ] && kill -0 $$(cat $(COLONY_PID_FILE)) 2>/dev/null; then \
		echo "Colony already running (PID $$(cat $(COLONY_PID_FILE))) – http://localhost:$(DASHBOARD_PORT)"; \
		exit 0; \
	fi
	@PORT_PIDS=$$(lsof -ti tcp:$(DASHBOARD_PORT) 2>/dev/null || true); \
	if [ -n "$$PORT_PIDS" ]; then \
		echo "Freeing port $(DASHBOARD_PORT)..."; \
		kill $$PORT_PIDS 2>/dev/null || true; \
		sleep 1; \
		for p in $$PORT_PIDS; do kill -0 $$p 2>/dev/null && kill -9 $$p 2>/dev/null || true; done; \
	fi
	@printf "Starting colony runtime... "
	@cd $(AGENT_DIR) && \
	mkdir -p logs && \
	nohup $(COLONY_CMD) >> logs/colony-runtime.log 2>&1 &
	# Wait for runtime to write its own PID file
	@i=0; \
	while [ $$i -lt 10 ]; do \
	  if [ -f $(COLONY_PID_FILE) ] && kill -0 $$(cat $(COLONY_PID_FILE)) 2>/dev/null; then break; fi; \
	  sleep 1; i=$$((i+1)); \
	done; \

	@if [ -f $(COLONY_PID_FILE) ] && kill -0 $$(cat $(COLONY_PID_FILE)) 2>/dev/null; then \
		echo "OK (PID $$(cat $(COLONY_PID_FILE))) – http://localhost:$(DASHBOARD_PORT)"; \
	else \
		echo "FAILED (see $(COLONY_LOG_FILE))"; \
		if [ "$(SHOW_FAIL_LOG)" = "1" ] && [ -f $(COLONY_LOG_FILE) ]; then echo "--- Last 20 lines ---"; tail -n 20 $(COLONY_LOG_FILE); echo "---------------------"; fi; \
		rm -f $(COLONY_PID_FILE); \
		exit 1; \
	fi

stop-colony:
	@printf "Stopping colony runtime... "
	@if [ ! -f $(COLONY_PID_FILE) ]; then \
		echo "not running"; \
	else \
		PID=$$(cat $(COLONY_PID_FILE)); \
		if kill -0 $$PID 2>/dev/null; then \
			kill $$PID; \
			wait $$PID 2>/dev/null || true; \
		fi; \
		rm -f $(COLONY_PID_FILE); \
		echo "done"; \
	fi
	@$(MAKE) --no-print-directory stop-agents > /dev/null 2>&1 || true
	@PORT_PIDS=$$(lsof -ti tcp:$(DASHBOARD_PORT) 2>/dev/null || true); \
	if [ -n "$$PORT_PIDS" ]; then \
		echo "Freeing port $(DASHBOARD_PORT)..."; \
		kill $$PORT_PIDS 2>/dev/null || true; \
		sleep 1; \
		for p in $$PORT_PIDS; do kill -0 $$p 2>/dev/null && kill -9 $$p 2>/dev/null || true; done; \
	fi
	@true

restart-colony:
	@echo "Restarting colony runtime"
	@$(MAKE) --no-print-directory stop-colony >/dev/null 2>&1 || true
	@sleep 1
	@$(MAKE) --no-print-directory start-colony

status-colony:
	@if [ -f $(COLONY_PID_FILE) ] && kill -0 $$(cat $(COLONY_PID_FILE)) 2>/dev/null; then \
		echo "Colony runtime running (PID $$(cat $(COLONY_PID_FILE)))"; \
		echo "Dashboard: http://localhost:$(DASHBOARD_PORT)"; \
	else \
		echo "Colony runtime not running."; \
	fi
