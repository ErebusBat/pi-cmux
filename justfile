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
