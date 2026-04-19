#!/bin/bash

# 生成包含项目所有代码的文件（排除敏感和无关文件）
# 用法：./bundle.sh

OUTPUT_FILE="agent-canvas-code.txt"

# 清空或创建输出文件
> "$OUTPUT_FILE"

# 定义需要排除的目录（相对于项目根目录）
EXCLUDE_DIRS="node_modules .git .vscode dist build"

# 定义需要排除的文件（精确匹配或路径模式）
EXCLUDE_FILES=".env .gitignore README run.sh show-tree.sh"

# 生成 find 命令的排除参数
find_exclude_dirs=""
for dir in $EXCLUDE_DIRS; do
    find_exclude_dirs="$find_exclude_dirs -name $dir -prune -o"
done

# 遍历 backend 和 frontend 目录
for root in backend frontend; do
    if [ ! -d "$root" ]; then
        echo "警告：目录 $root 不存在，跳过" >&2
        continue
    fi

    # 使用 find 列出所有文件（排除目录和排除文件）
    eval find "$root" $find_exclude_dirs -type f -print | while read -r file; do
        # 获取文件名（不含路径）
        filename=$(basename "$file")
        # 检查是否在排除文件列表中
        skip=0
        for ef in $EXCLUDE_FILES; do
            if [ "$filename" = "$ef" ]; then
                skip=1
                break
            fi
        done
        # 额外排除脚本自身（如果放在项目根目录）
        if [ "$file" = "./$0" ] || [ "$file" = "$0" ]; then
            skip=1
        fi
        [ $skip -eq 1 ] && continue

        # 输出文件路径和内容
        echo "---------------------- $file ------------------" >> "$OUTPUT_FILE"
        cat "$file" >> "$OUTPUT_FILE"
        echo "" >> "$OUTPUT_FILE"
        echo "" >> "$OUTPUT_FILE"
    done
done

echo "代码已打包到 $OUTPUT_FILE"
