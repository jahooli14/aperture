import { useRef, useCallback, useMemo } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import { useTheme } from '../../hooks/useTheme';
import * as THREE from 'three';
import SpriteText from 'three-spritetext';

interface GraphNode {
    id: string;
    name: string;
    type: 'project' | 'thought' | 'article';
    val: number; // Size
    color?: string;
}

interface GraphLink {
    source: string;
    target: string;
    value: number; // Strength
}

interface ConnectionGraphProps {
    nodes: GraphNode[];
    links: GraphLink[];
    onNodeClick?: (node: GraphNode) => void;
}

export function ConnectionGraph({ nodes, links, onNodeClick }: ConnectionGraphProps) {
    const fgRef = useRef();

    // "Synapse" visual configuration
    const linkColor = useCallback(() => '#6366f1', []); // Indigo-500
    const nodeColor = useCallback((node: GraphNode) => {
        switch (node.type) {
            case 'project': return '#8B5CF6'; // Violet
            case 'thought': return '#EC4899'; // Pink
            case 'article': return '#10B981'; // Emerald
            default: return '#94a3b8';
        }
    }, []);

    return (
        <div className="w-full h-full bg-slate-900">
            <ForceGraph3D
                ref={fgRef}
                graphData={{ nodes, links }}
                nodeLabel="name"
                nodeColor={nodeColor}
                nodeVal="val"
                linkColor={linkColor}
                linkWidth={1}
                linkDirectionalParticles={2}
                linkDirectionalParticleSpeed={0.005}
                linkDirectionalParticleWidth={2}
                onNodeClick={onNodeClick}
                backgroundColor="#0f172a" // Slate-900
                nodeThreeObject={(node: any) => {
                    const sprite = new SpriteText(node.name);
                    sprite.color = nodeColor(node);
                    sprite.textHeight = 4;
                    return sprite;
                }}
                nodeThreeObjectExtend={true} // Draw node as well as text? Maybe just text or sphere+text
            />
        </div>
    );
}
