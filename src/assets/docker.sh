#!/bin/bash


# detect GPU
if [[ "$distribution" == "$max_distribution_for_gpu" ]] || [[ "$distribution" < "$max_distribution_for_gpu" ]]; then
    if [[ "`lspci | grep -i nvidia`" != "" ]]; then
        gpu="cuda"
    else
        gpu=""
    fi
    echo $gpu
else
    gpu=""
fi

all_vars=$@


export GWS_ENV_INSTALLED=1
if [[ -n "$GPU" ]]; then
    cgpu_folder="gpu"
else
    cgpu_folder="cpu"
fi


if [[ ! -d "${app_dir}/prod/lab/.sys/" ]]; then
    sudo mkdir -p "${app_dir}/prod/lab/.sys/"
    sudo mkdir -p "${app_dir}/prod/data"
    export UPDATE_GIT_BRICKS=1
fi

if [[ ! -d "${app_dir}/dev/lab/.sys/" ]]; then
    sudo mkdir -p "${app_dir}/dev/lab/.sys/"
    sudo mkdir -p "${app_dir}/dev/data"
    export UPDATE_GIT_BRICKS=1
fi
