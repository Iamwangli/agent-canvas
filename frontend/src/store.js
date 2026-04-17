import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

const useStore = create(
  persist(
    (set, get) => ({
      // 当前画布的节点（兼容原有）
      nodes: [],
      autoNodeEnabled: true,
      
      // 历史会话列表：每个元素为 { id, name, nodes, createdAt }
      history: [],
      
      // 添加当前画布到历史（自动去重）
      saveCurrentToHistory: (customName = null) => {
        const { nodes, history } = get();
        // 避免保存空的或只有根节点的画布（可选）
        const hasConversation = nodes.some(n => n.type === 'conversation');
        if (!hasConversation) return;
        
        const name = customName || `会话 ${new Date().toLocaleString()}`;
        const newHistoryItem = {
          id: uuidv4(),
          name: name,
          nodes: JSON.parse(JSON.stringify(nodes)), // 深拷贝
          createdAt: Date.now(),
        };
        set({ history: [newHistoryItem, ...history] });
      },
      
      // 从历史恢复画布
      restoreFromHistory: (historyId) => {
        const { history } = get();
        const item = history.find(h => h.id === historyId);
        if (item) {
          set({ nodes: item.nodes });
          // 可选：从历史中移除（或保留）
        }
      },
      
      // 删除历史条目
      deleteHistoryItem: (historyId) => {
        set((state) => ({
          history: state.history.filter(h => h.id !== historyId)
        }));
      },
      
      // 清空所有历史
      clearHistory: () => set({ history: [] }),
      
      // 原有方法
      addNode: (node) => set((state) => ({ nodes: [...state.nodes, node] })),
      updateNode: (id, updates) => set((state) => ({
        nodes: state.nodes.map((n) => n.id === id ? { ...n, ...updates } : n)
      })),
      deleteNode: (id) => set((state) => {
        const node = state.nodes.find(n => n.id === id);
        if (!node || node.type === 'agent') return state;
        const parentId = node.parentId;
        const updatedNodes = state.nodes.map(n => {
          if (n.parentId === id) {
            return { ...n, parentId: parentId };
          }
          return n;
        }).filter(n => n.id !== id);
        return { nodes: updatedNodes };
      }),
      setNodes: (nodes) => set({ nodes }),
      toggleAutoNode: () => set((state) => ({ autoNodeEnabled: !state.autoNodeEnabled })),
      getNode: (id) => get().nodes.find(n => n.id === id),
      getChildren: (id) => get().nodes.filter(n => n.parentId === id),
    }),
    {
      name: 'agent-canvas-storage',
      getStorage: () => localStorage,
    }
  )
);

export default useStore;
