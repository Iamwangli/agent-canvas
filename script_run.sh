#!/bin/bash

# 清理可能占用端口的旧进程（保持原逻辑）
lsof -ti:3001 | xargs kill -9 2>/dev/null
lsof -ti:5173 | xargs kill -9 2>/dev/null

echo "Input http://localhost:5173/ in website"

# 启动后端和前端，并记录进程 PID
(cd backend && npm start) &
backend_pid=$!
(cd frontend && npm run dev) &
frontend_pid=$!

# 退出时清理两个子进程
cleanup() {
    echo "Cleaning up processes..."
    kill $backend_pid $frontend_pid 2>/dev/null
    exit
}

# 捕获 Ctrl+C 等中断信号
trap cleanup SIGINT SIGTERM

# 等待任意一个子进程退出（Bash 4.3+ 支持 wait -n）
if wait -n 2>/dev/null; then
    # 其中一个正常退出，杀掉另一个
    kill $backend_pid $frontend_pid 2>/dev/null
else
    # 降级方案：每隔一秒检查两个进程是否都还在
    while kill -0 $backend_pid 2>/dev/null && kill -0 $frontend_pid 2>/dev/null; do
        sleep 1
    done
    kill $backend_pid $frontend_pid 2>/dev/null
fi

exit
