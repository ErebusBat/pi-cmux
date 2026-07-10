# install pi-cmux into an omp profile
# usage: just install [profile]
install profile='':
    #!/usr/bin/env bash
    if [ -n "{{profile}}" ]; then
        omp --profile={{profile}} plugin install {{justfile_directory()}} --force
    else
        omp plugin install {{justfile_directory()}} --force
    fi

# link pi-cmux as a local plugin in an omp profile
# usage: just link [profile]
link profile='':
    #!/usr/bin/env bash
    if [ -n "{{profile}}" ]; then
        omp --profile={{profile}} plugin install {{justfile_directory()}} -l --force
    else
        omp plugin install {{justfile_directory()}} -l --force
    fi

# remove pi-cmux from an omp profile
# usage: just uninstall [profile]
uninstall profile='':
    #!/usr/bin/env bash
    if [ -n "{{profile}}" ]; then
        omp --profile={{profile}} plugin uninstall pi-cmux
    else
        omp plugin uninstall pi-cmux
    fi

# list installed plugins in an omp profile
# usage: just list [profile]
list profile='':
    #!/usr/bin/env bash
    if [ -n "{{profile}}" ]; then
        omp --profile={{profile}} plugin list
    else
        omp plugin list
    fi

# configure the Beads Dolt origin from Git's origin
sync-dolt-remote:
    #!/usr/bin/env bash
    set -euo pipefail
    git_url="$(git remote get-url origin)"
    case "$git_url" in
        git+ssh://*)
            dolt_url="$git_url"
            ;;
        ssh://*)
            dolt_url="git+$git_url"
            ;;
        *@*:* )
            git_user="${git_url%%@*}"
            host_and_path="${git_url#*@}"
            host="${host_and_path%%:*}"
            repository_path="${host_and_path#*:}"
            dolt_url="git+ssh://${git_user}@${host}/${repository_path}"
            ;;
        http://*|https://*)
            dolt_url="$git_url"
            ;;
        *)
            echo "Unsupported Git origin URL: $git_url" >&2
            exit 1
            ;;
    esac
    bd dolt remote remove origin 2>/dev/null || true
    bd dolt remote add origin "$dolt_url"
    bd dolt remote list
