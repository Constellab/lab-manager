#!/bin/bash

# Fix Docker socket permissions at runtime if socket exists
if [ -S /var/run/docker.sock ]; then
    sudo chgrp docker /var/run/docker.sock || true
fi

# Execute the main command
exec "$@"
