import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Brain, Calendar, Edit, Trash2, Copy, Share2, Link2, Plus } from 'lucide-react'
import { format } from 'date-fns'
import type { Memory, BridgeWithMemories } from '../../types'
import { useMemoryStore } from '../../stores/useMemoryStore'
import { useToast } from '../ui/toast'
import { useConfirmDialog } from '../ui/confirm-dialog'
import { haptic } from '../../utils/haptics'
import { MemoryLinks } from '../MemoryLinks'
import { ConnectionsList } from '../connections/ConnectionsList'
import { EditMemoryDialog } from './EditMemoryDialog'
import { GlassCard } from '../ui/GlassCard'
import { SmartActionDot } from '../SmartActionDot'

interface MemoryDetailModalProps {
  memory: Memory | null
  isOpen: boolean
  onClose: () => void
}

export const MemoryDetailModal: React.FC<MemoryDetailModalProps> = ({ memory, isOpen, onClose }) => {
  const { addToast } = useToast()
  const { confirm, dialog: confirmDialog } = useConfirmDialog()
  const deleteMemory = useMemoryStore((state) => state.deleteMemory)
  const fetchBridgesForMemory = useMemoryStore((state) => state.fetchBridgesForMemory)

  const [bridges, setBridges] = useState<BridgeWithMemories[]>([])
  const [bridgesFetched, setBridgesFetched] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)

  // Module-level cache to prevent refetching bridges
  const bridgesCache = useMemo(() => new Map<string, { bridges: BridgeWithMemories[]; timestamp: number }>(), []);
  const BRIDGE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  useEffect(() => {
    if (!memory || !isOpen) return

    const loadBridges = async () => {
      if (memory.id.startsWith('temp_')) {
        setBridges([])
        setBridgesFetched(true)
        return
      }

      const cached = bridgesCache.get(memory.id)
      const now = Date.now()

      if (cached && (now - cached.timestamp) < BRIDGE_CACHE_TTL) {
        setBridges(cached.bridges)
        setBridgesFetched(true)
        return
      }

      const fetchedBridges = await fetchBridgesForMemory(memory.id)
      bridgesCache.set(memory.id, { bridges: fetchedBridges, timestamp: now })
      setBridges(fetchedBridges)
      setBridgesFetched(true)
    }

    loadBridges()
  }, [memory, isOpen, fetchBridgesForMemory, bridgesCache])

  const loadMemoryBridges = useCallback(async () => {
    if (!memory) return;
    bridgesCache.delete(memory.id); // Invalidate cache
    const fetchedBridges = await fetchBridgesForMemory(memory.id);
    bridgesCache.set(memory.id, { bridges: fetchedBridges, timestamp: Date.now() });
    setBridges(fetchedBridges);
    setBridgesFetched(true);
  }, [memory, fetchBridgesForMemory, bridgesCache]);

  const handleDelete = async () => {
    if (!memory) return;

    const confirmed = await confirm({
      title: `Delete "${memory.title}"?`,
      description: 'This action cannot be undone. The thought will be permanently removed.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'destructive',
    });

    if (confirmed) {
      try {
        await deleteMemory(memory.id);
        addToast({
          title: 'Thought deleted',
          description: `"${memory.title}" has been removed.`, 
          variant: 'success',
        });
        onClose(); // Close modal after deletion
      } catch (error) {
        addToast({
          title: 'Failed to delete thought',
          description: error instanceof Error ? error.message : 'An error occurred',
          variant: 'destructive',
        });
      }
    }
  };

  const handleCopyText = useCallback(() => {
    if (!memory) return;
    const textToCopy = `${memory.title}\n\n${memory.body}`;
    navigator.clipboard.writeText(textToCopy).then(() => {
      haptic.success();
      addToast({
        title: 'Copied!',
        description: 'Thought text copied to clipboard',
        variant: 'success',
      });
    });
  }, [memory, addToast]);

  const handleShare = useCallback(async () => {
    if (!memory) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: memory.title,
          text: memory.body,
        });
        haptic.success();
      } catch (error) {
        console.warn('Share cancelled or failed:', error);
      }
    } else {
      handleCopyText();
    }
  }, [memory, handleCopyText]);


  if (!isOpen) return null;
  if (!memory) {
    onClose(); // Should not happen if isOpen is true, but just in case
    return null;
  }

  const memoryContent = useMemo(() => `${memory.title}\n\n${memory.body}`, [memory.title, memory.body]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 50, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 50, opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="relative w-full max-w-2xl max-h-[90vh] rounded-2xl p-6 shadow-2xl overflow-y-auto"
            style={{ background: 'var(--premium-bg-2)' }}
            onClick={(e) => e.stopPropagation()} // Prevent modal from closing when clicking inside
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition-colors"
              style={{ color: 'var(--premium-text-tertiary)' }}
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center justify-between gap-4 mb-6 pr-10">
              <h2 className="text-2xl font-bold premium-text-platinum leading-tight">
                {memory.title}
              </h2>
              <div className="flex items-center gap-2">
                <SmartActionDot color="var(--premium-indigo)" title="Analyze Memory" />
                <button
                  onClick={() => setEditDialogOpen(true)}
                  className="p-2 rounded-full hover:bg-white/10 transition-colors"
                  style={{ color: 'var(--premium-text-tertiary)' }}
                  title="Edit Memory"
                >
                  <Edit className="h-5 w-5" />
                </button>
                <button
                  onClick={handleDelete}
                  className="p-2 rounded-full hover:bg-red-500/10 transition-colors"
                  style={{ color: '#ef4444' }}
                  title="Delete Memory"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="prose prose-invert prose-sm max-w-none mb-6">
              <p className="leading-relaxed text-base" style={{ color: 'var(--premium-text-primary)' }}>
                {memory.body}
              </p>
            </div>

            {memory.tags && memory.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {memory.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 text-xs font-medium rounded-full"
                    style={{
                      backgroundColor: 'rgba(99, 102, 241, 0.1)',
                      color: 'var(--premium-indigo)'
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            
            {/* Connections Section */}
            <div className="mt-8 pt-6 border-t border-white/10">
              <h3 className="text-lg font-bold premium-text-platinum mb-4">
                Connections
              </h3>
              {bridgesFetched && bridges.length === 0 ? (
                <div className="text-sm text-gray-400">
                  No connections found yet.
                </div>
              ) : (
                <MemoryLinks currentMemoryId={memory.id} bridges={bridges} />
              )}
              <ConnectionsList
                itemType="thought"
                itemId={memory.id}
                content={memoryContent}
                onConnectionCreated={loadMemoryBridges}
                onConnectionDeleted={loadMemoryBridges}
              />
            </div>

            {/* Timestamp */}
            <div className="flex items-center gap-2 text-xs pt-6 mt-6 border-t border-white/10" style={{ color: 'var(--premium-text-tertiary)' }}>
              <Calendar className="h-3 w-3" />
              <span>{format(new Date(memory.created_at), 'PPPp')}</span>
            </div>
          </motion.div>
          {confirmDialog}
        </motion.div>
      )}
       <EditMemoryDialog
        memory={memory}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onMemoryUpdated={() => loadMemoryBridges()} // Reload bridges if memory content changes
      />
    </AnimatePresence>
  );
};
