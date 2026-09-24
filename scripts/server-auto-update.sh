#!/bin/sh
set -eu

# This file is installed outside the Git checkout by install-server-auto-update.sh.
# Keep the deployment command independent of files changed by a participant PR.
repo_dir=/home/egor/itkurcommit
repo_user=egor
state_file=/var/lib/itkurcommit-update/last-success
export PROXY_NETWORK=verification_default
export GIT_TERMINAL_PROMPT=0

branch=$(runuser -u "$repo_user" -- git -C "$repo_dir" symbolic-ref --quiet --short HEAD)
if [ "$branch" != main ]; then
    echo "Expected the main branch in $repo_dir, found $branch" >&2
    exit 1
fi

if [ -n "$(runuser -u "$repo_user" -- git -C "$repo_dir" status --porcelain)" ]; then
    echo "The server checkout has local changes; refusing to overwrite them" >&2
    exit 1
fi

runuser -u "$repo_user" -- git -C "$repo_dir" fetch --quiet origin main
local_sha=$(runuser -u "$repo_user" -- git -C "$repo_dir" rev-parse HEAD)
remote_sha=$(runuser -u "$repo_user" -- git -C "$repo_dir" rev-parse FETCH_HEAD)

if [ "$local_sha" != "$remote_sha" ]; then
    if ! runuser -u "$repo_user" -- git -C "$repo_dir" merge-base --is-ancestor "$local_sha" "$remote_sha"; then
        echo "Server main has diverged from origin/main; refusing to merge" >&2
        exit 1
    fi
    runuser -u "$repo_user" -- git -C "$repo_dir" merge --ff-only "$remote_sha"
fi

if [ -r "$state_file" ] && [ "$(cat "$state_file")" = "$remote_sha" ]; then
    exit 0
fi

cd "$repo_dir"
docker compose -f compose.yaml -f compose.proxy.yaml up -d --build --wait
install -d -m 0755 /var/lib/itkurcommit-update
printf '%s\n' "$remote_sha" > "$state_file"
