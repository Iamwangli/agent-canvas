#!/bin/bash

# 显示项目树，忽略 node_modules、.git、dist、build 等目录
if ! command -v tree &> /dev/null; then
    echo "错误：tree 命令未安装。请先安装 tree（例如：sudo apt install tree）"
    exit 1
fi

tree -a --dirsfirst -I "node_modules|.git|dist|build" --prune
