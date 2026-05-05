import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

const useStore = create(
  persist(
    (set, get) => ({
      hasHydrated: false,
      files: [],
      currentFileId: null,
      autoNodeEnabled: true,
      autoCreateCounts: {},
      flowPathNodes: [],
      flowPathEdges: [],

      init: () => {
        const { files, hasHydrated } = get();
        // 仅当 localStorage 恢复完毕且确实没有文件时才创建默认文件
        if (hasHydrated && files.length === 0) {
          const newId = uuidv4();
          set({
            files: [{ id: newId, name: '未命名会话', nodes: [], createdAt: Date.now() }],
            currentFileId: newId,
          });
        }
      },

      getCurrentNodes: () => {
        const { files, currentFileId } = get();
        const file = files.find(f => f.id === currentFileId);
        return file ? file.nodes : [];
      },

      updateCurrentNodes: (nodes) => {
        const { files, currentFileId } = get();
        if (!currentFileId) return;
        const updatedFiles = files.map(file =>
          file.id === currentFileId ? { ...file, nodes, updatedAt: Date.now() } : file
        );
        set({ files: updatedFiles });
      },

      createNewFile: () => {
        const { files } = get();
        const newId = uuidv4();
        const newFile = {
          id: newId,
          name: `会话 ${new Date().toLocaleString()}`,
          nodes: [],
          createdAt: Date.now(),
        };
        set({
          files: [...files, newFile],
          currentFileId: newId,
        });
        return newId;
      },

      restoreFile: (fileId) => {
        const { files } = get();
        const file = files.find(f => f.id === fileId);
        if (file) {
          set({ currentFileId: fileId });
        }
      },

      deleteFile: (fileId) => {
        const { files, currentFileId } = get();
        if (files.length === 1) {
          alert('至少保留一个会话');
          return;
        }
        const newFiles = files.filter(f => f.id !== fileId);
        let newCurrentId = currentFileId;
        if (currentFileId === fileId) {
          newCurrentId = newFiles[0].id;
        }
        set({ files: newFiles, currentFileId: newCurrentId });
      },

      updateFileName: (fileId, newName) => {
        set((state) => ({
          files: state.files.map(f => f.id === fileId ? { ...f, name: newName } : f)
        }));
      },

      getCurrentFile: () => {
        const { files, currentFileId } = get();
        return files.find(f => f.id === currentFileId);
      },

      addNode: (node) => {
        const nodes = get().getCurrentNodes();
        get().updateCurrentNodes([...nodes, node]);
      },

      updateNode: (id, updates) => {
        const nodes = get().getCurrentNodes();
        const newNodes = nodes.map(n => n.id === id ? { ...n, ...updates } : n);
        get().updateCurrentNodes(newNodes);
      },

      deleteNode: (id) => {
        const nodes = get().getCurrentNodes();
        const node = nodes.find(n => n.id === id);
        if (!node || node.type === 'agent') return;
        const parentId = node.parentId;
        const newNodes = nodes.map(n => {
          if (n.parentId === id) return { ...n, parentId };
          return n;
        }).filter(n => n.id !== id);
        get().updateCurrentNodes(newNodes);
      },

      toggleCollapseNode: (id) => {
        const nodes = get().getCurrentNodes();
        const newNodes = nodes.map(n => 
          n.id === id ? { ...n, collapsed: !n.collapsed } : n
        );
        get().updateCurrentNodes(newNodes);
      },

      setNodes: (nodes) => get().updateCurrentNodes(nodes),

      toggleAutoNode: () => set((state) => ({ autoNodeEnabled: !state.autoNodeEnabled })),

      incrementAutoCount: (parentId) => {
        set((state) => ({
          autoCreateCounts: {
            ...state.autoCreateCounts,
            [parentId]: (state.autoCreateCounts[parentId] || 0) + 1
          }
        }));
      },

      getAutoCount: (parentId) => get().autoCreateCounts[parentId] || 0,

      resetAutoCount: (parentId) => {
        set((state) => ({
          autoCreateCounts: {
            ...state.autoCreateCounts,
            [parentId]: 0
          }
        }));
      },

      addAutoNode: (node, parentId) => {
        const nodes = get().getCurrentNodes();
        get().updateCurrentNodes([...nodes, node]);
        get().incrementAutoCount(parentId);
      },

      setFlowPath: (nodeIds, edgeIds) => set({ flowPathNodes: nodeIds, flowPathEdges: edgeIds }),
      clearFlowPath: () => set({ flowPathNodes: [], flowPathEdges: [] }),
    }),
    {
      name: 'agent-canvas-files',
      storage: createJSONStorage(() => localStorage),
      // 修复点：localStorage 恢复完毕后设置 hasHydrated
      onRehydrateStorage: () => (state) => {
        state.hasHydrated = true;
      },
    }
  )
);

export default useStore;
