#!/bin/bash
export XDG_RUNTIME_DIR=/run/user/0

COUNT=0
TOTAL=$(docker ps --format '{{.Names}}' | grep -v installer | grep -v fivem | wc -l)
echo "=== SWITCHING NON-CRITICAL SERVERS TO CRUN (Total: $TOTAL) ==="

for name in $(docker ps --format '{{.Names}}' | grep -v installer | grep -v fivem); do
    if [ -f "/var/lib/votion/containers/$name/config.json" ]; then
        COUNT=$((COUNT + 1))
        echo "[$COUNT/$TOTAL] Switching $name to crun..."
        docker stop "$name" >/dev/null 2>&1
        crun run -d -b "/var/lib/votion/containers/$name" "$name"
        sleep 1
    fi
done

echo ""
echo "=== ACTIVE CRUN CONTAINERS ==="
crun list
