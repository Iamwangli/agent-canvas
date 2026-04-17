import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

const useStore = create(
  persist(
    (set, get) => ({
      // 文件列表
      files: [],
      // 当前文件 ID
      currentFileId: null,
      // AI 自动节点开关
      autoNodeEnabled: true,

      // 初始化：如果没有任何文件，创建一个默认的空白文件
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

      // 获取当前文件的节点
      getCurrentNodes: () => {
        const { files, currentFileId } = get();
        const file = files.find(f => f.id === currentFileId);
        return file ? file.nodes : [];
      },

      // 更新当前文件的节点（任何修改都调用此方法，自动持久化）
      updateCurrentNodes: (nodes) => {
        const { files, currentFileId } = get();
        if (!currentFileId) return;
        const updatedFiles = files.map(file =>
          file.id === currentFileId ? { ...file, nodes: nodes, updatedAt: Date.now() } : file
        );
        set({ files: updatedFiles });
      },

      // 创建新文件（新对话时调用）
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

      // 恢复历史文件
      restoreFile: (fileId) => {
        const { files } = get();
        const file = files.find(f => f.id === fileId);
        if (file) {
          set({ currentFileId: fileId });
        }
      },

      // 删除文件
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

      // 更新文件名
      updateFileName: (fileId, newName) => {
        set((state) => ({
          files: state.files.map(f => f.id === fileId ? { ...f, name: newName } : f)
        }));
      },

      // 获取当前文件对象
      getCurrentFile: () => {
        const { files, currentFileId } = get();
        return files.find(f => f.id === currentFileId);
      },

      // 以下为原有的节点操作方法，自动更新当前文件
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
    }),
    {
      name: 'agent-canvas-files',   // localStorage 的 key
      storage: localStorage,         // 新版 API，消除弃用警告
    }
  )
);

export default useStore;
