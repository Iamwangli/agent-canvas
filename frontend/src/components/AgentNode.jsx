import React from 'react';
import { Handle, Position } from 'reactflow';

export default function AgentNode({ data }) {
  return (
    <div className="agent-node" style={{ width: 'auto', minWidth: '120px', padding: '0 16px' }}>
      <Handle type="target" position={Position.Top} style={{ visibility: 'hidden' }} />
      <div className="font-bold text-center whitespace-normal break-words">{data.name}</div>
      <Handle type="source" position={Position.Bottom} id="source" />
    </div>
  );
}
