import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

const useStore = create(
  persist(
    (set, get) => ({
      files: [],
      currentFileId: null,
      autoNodeEnabled: true,
      // 记录每个父节点下的自动创建次数
      autoCreateCounts: {},

      init: () => {
        const { files, currentFileId } = get();
        if (files.length === 0) {
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
          file.id === currentFileId ? { ...file, nodes: nodes, updatedAt: Date.now() } : file
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
        const newNodes = [...nodes, node];
        get().updateCurrentNodes(newNodes);
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
        
        // 处理子节点：将其 parentId 改为被删除节点的 parentId
        const newNodes = nodes.map(n => {
          if (n.parentId === id) {
            return { ...n, parentId: parentId };
          }
          return n;
        }).filter(n => n.id !== id);
        
        get().updateCurrentNodes(newNodes);
      },
      
      setNodes: (nodes) => {
        get().updateCurrentNodes(nodes);
      },
      
      toggleAutoNode: () => set((state) => ({ autoNodeEnabled: !state.autoNodeEnabled })),
      
      // 自动节点计数方法
      incrementAutoCount: (parentId) => {
        set((state) => ({
          autoCreateCounts: {
            ...state.autoCreateCounts,
            [parentId]: (state.autoCreateCounts[parentId] || 0) + 1
          }
        }));
      },
      
      getAutoCount: (parentId) => {
        return get().autoCreateCounts[parentId] || 0;
      },
      
      resetAutoCount: (parentId) => {
        set((state) => ({
          autoCreateCounts: {
            ...state.autoCreateCounts,
            [parentId]: 0
          }
        }));
      },
      
      // 添加自动创建的节点（并增加计数）
      addAutoNode: (node, parentId) => {
        const nodes = get().getCurrentNodes();
        const newNodes = [...nodes, node];
        get().updateCurrentNodes(newNodes);
        get().incrementAutoCount(parentId);
      },
    }),
    {
      name: 'agent-canvas-files',
      storage: localStorage,
    }
  )
);

export default useStore;
