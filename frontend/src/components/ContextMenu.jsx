import React, { useEffect } from 'react';

export default function ContextMenu({ x, y, nodeId, onClose, onHide, onDelete, onShow, onCopy }) {
  useEffect(() => {
    const handleClickOutside = () => onClose();
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [onClose]);

  return (
    <div
      className="fixed z-20 bg-white border rounded shadow-lg py-1 w-40"
      style={{ top: y, left: x }}
      onClick={(e) => e.stopPropagation()}
    >
      <button className="block w-full text-left px-4 py-1 hover:bg-gray-100" onClick={onCopy}>
        复制节点
      </button>
      <button className="block w-full text-left px-4 py-1 hover:bg-gray-100" onClick={onHide}>
        隐藏节点
      </button>
      <button className="block w-full text-left px-4 py-1 hover:bg-gray-100" onClick={onShow}>
        取消隐藏
      </button>
      <button className="block w-full text-left px-4 py-1 hover:bg-gray-100 text-red-600" onClick={onDelete}>
        删除节点
      </button>
    </div>
  );
}
