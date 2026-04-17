#!/bin/bash

# 清理可能占用端口的旧进程
lsof -ti:3001 | xargs kill -9 2>/dev/null
lsof -ti:5173 | xargs kill -9 2>/dev/null

echo "Input http://localhost:5173/ in website" 
# 启动前后端
concurrently --kill-others --names "backend,frontend" \
  "cd backend && npm start" \
  "cd frontend && npm run dev"
