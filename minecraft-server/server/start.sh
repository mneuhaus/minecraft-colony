#!/bin/bash

# Paper 1.21.1 Server Start Script
# Requires Java 21+

JAVA_HOME="/usr/local/Cellar/openjdk/25.0.1/libexec/openjdk.jdk/Contents/Home"

# Memory allocation (adjust as needed)
MIN_RAM="2G"
MAX_RAM="4G"

# JVM flags for better performance
JVM_FLAGS="-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC -XX:+AlwaysPreTouch -XX:G1NewSizePercent=30 -XX:G1MaxNewSizePercent=40 -XX:G1HeapRegionSize=8M -XX:G1ReservePercent=20 -XX:G1HeapWastePercent=5 -XX:G1MixedGCCountTarget=4 -XX:InitiatingHeapOccupancyPercent=15 -XX:G1MixedGCLiveThresholdPercent=90 -XX:G1RSetUpdatingPauseTimePercent=5 -XX:SurvivorRatio=32 -XX:+PerfDisableSharedMem -XX:MaxTenuringThreshold=1"

"$JAVA_HOME/bin/java" -Xms$MIN_RAM -Xmx$MAX_RAM $JVM_FLAGS -jar paper.jar --nogui
