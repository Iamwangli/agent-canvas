import React from 'react';
import { Handle, Position } from 'reactflow';

export default function AgentNode({ data }) {
  return (
    <div className="agent-node" style={{ width: 'auto', minWidth: '120px', padding: '0 16px' }}>
      {/* 四个方向的 Handle，target 用于接收子节点连线 */}
      <Handle type="target" position={Position.Top} id="target-top" style={{ background: '#3b82f6' }} />
      <Handle type="target" position={Position.Right} id="target-right" style={{ background: '#3b82f6' }} />
      <Handle type="target" position={Position.Bottom} id="target-bottom" style={{ background: '#3b82f6' }} />
      <Handle type="target" position={Position.Left} id="target-left" style={{ background: '#3b82f6' }} />
      
      <div className="font-bold text-center whitespace-normal break-words">{data.name}</div>
      
      {/* 四个方向的 source Handle，用于连接子节点 */}
      <Handle type="source" position={Position.Top} id="source-top" style={{ background: '#3b82f6' }} />
      <Handle type="source" position={Position.Right} id="source-right" style={{ background: '#3b82f6' }} />
      <Handle type="source" position={Position.Bottom} id="source-bottom" style={{ background: '#3b82f6' }} />
      <Handle type="source" position={Position.Left} id="source-left" style={{ background: '#3b82f6' }} />
    </div>
  );
}
