import React, { useEffect, useState } from 'react';

export default function ContextMenu({ x, y, nodeId, onClose, onHide, onDelete, onShow, onCopy, onCreateChild, isHidden }) {
  const [showDirectionMenu, setShowDirectionMenu] = useState(false);

  useEffect(() => {
    const handleClickOutside = () => onClose();
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [onClose]);

  const handleCreateChildClick = (e) => {
    e.stopPropagation();
    setShowDirectionMenu(!showDirectionMenu);
  };

  const handleDirectionSelect = (direction) => {
    onCreateChild(direction);
    onClose();
  };

  return (
    <div
      className="fixed z-20 bg-white border rounded shadow-lg py-1 w-44"
      style={{ top: y, left: x }}
      onClick={(e) => e.stopPropagation()}
    >
      <button className="block w-full text-left px-4 py-1 hover:bg-gray-100" onClick={onCopy}>
        复制节点
      </button>

      <div className="relative">
        <button
          className="block w-full text-left px-4 py-1 hover:bg-gray-100 flex justify-between items-center"
          onClick={handleCreateChildClick}
        >
          <span>创建子节点</span>
          <span className="text-gray-400">▶</span>
        </button>
        {showDirectionMenu && (
          <div
            className="absolute left-full top-0 ml-1 bg-white border rounded shadow-lg py-1 w-24 z-30"
            onClick={(e) => e.stopPropagation()}
          >
            <button className="block w-full text-left px-3 py-1 hover:bg-gray-100" onClick={() => handleDirectionSelect('top')}>
              ⬆️ 上方
            </button>
            <button className="block w-full text-left px-3 py-1 hover:bg-gray-100" onClick={() => handleDirectionSelect('right')}>
              ➡️ 右方
            </button>
            <button className="block w-full text-left px-3 py-1 hover:bg-gray-100" onClick={() => handleDirectionSelect('bottom')}>
              ⬇️ 下方
            </button>
            <button className="block w-full text-left px-3 py-1 hover:bg-gray-100" onClick={() => handleDirectionSelect('left')}>
              ⬅️ 左方
            </button>
          </div>
        )}
      </div>

      {isHidden ? (
        <button className="block w-full text-left px-4 py-1 hover:bg-gray-100" onClick={onShow}>
          取消隐藏
        </button>
      ) : (
        <button className="block w-full text-left px-4 py-1 hover:bg-gray-100" onClick={onHide}>
          隐藏节点
        </button>
      )}

      <hr className="my-1" />
      <button className="block w-full text-left px-4 py-1 hover:bg-gray-100 text-red-600" onClick={onDelete}>
        删除节点
      </button>
    </div>
  );
}
