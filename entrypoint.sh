#!/bin/bash
set -e

# ---------------------------------------------------------------------------
# 1. Align labuser UID/GID with the owner of the /app mount.
#
# On desktop (named volumes), Docker initializes /app as root:root → we skip
# and keep the default 1000:1000. On servers where /app is a host bind-mount,
# stat returns the host owner's UID/GID → we remap labuser so files written
# by the container match the host user's ownership (and vice-versa).
# Never chown the mount itself: that would rewrite host permissions.
# ---------------------------------------------------------------------------
if [ -d /app ]; then
    TARGET_UID=$(stat -c '%u' /app)
    TARGET_GID=$(stat -c '%g' /app)

    CURRENT_UID=$(id -u labuser)
    CURRENT_GID=$(id -g labuser)

    if [ "$TARGET_UID" != "0" ] && \
       { [ "$TARGET_UID" != "$CURRENT_UID" ] || [ "$TARGET_GID" != "$CURRENT_GID" ]; }; then
        sudo groupmod -g "$TARGET_GID" labuser 2>/dev/null || \
            sudo groupadd -g "$TARGET_GID" labuser_host
        sudo usermod -u "$TARGET_UID" -g "$TARGET_GID" labuser
        sudo chown -R "$TARGET_UID:$TARGET_GID" /home/labuser /lab-manager
    fi
fi

# ---------------------------------------------------------------------------
# 2. Align an in-container group with the docker socket's GID and add labuser.
# ---------------------------------------------------------------------------
if [ -S /var/run/docker.sock ]; then
    SOCK_GID=$(stat -c '%g' /var/run/docker.sock)
    EXISTING_GROUP=$(getent group "$SOCK_GID" | cut -d: -f1 || true)

    if [ -z "$EXISTING_GROUP" ]; then
        sudo groupadd -g "$SOCK_GID" docker_sock
        EXISTING_GROUP=docker_sock
    fi

    sudo usermod -aG "$EXISTING_GROUP" labuser
fi

# ---------------------------------------------------------------------------
# 3. Export resolved UID/GID so sub-composes (glab, codelab, front) can
#    inherit them via ${HOST_UID}:${HOST_GID} in their `user:` field.
# ---------------------------------------------------------------------------
export HOST_UID=$(id -u labuser)
export HOST_GID=$(id -g labuser)

exec sudo -u labuser -E -H "$@"
