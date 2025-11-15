import { motion } from 'framer-motion';

interface PhotoSkeletonProps {
  count?: number;
}

export function PhotoSkeleton({ count = 6 }: PhotoSkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.05 }}
          className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 shadow-md"
        >
          {/* Shimmer effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 animate-shimmer bg-[length:200%_100%]" />

          {/* Date placeholder - bottom overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-2 md:p-3">
            <div className="h-3 md:h-4 w-16 bg-gray-300/50 rounded" />
          </div>
        </motion.div>
      ))}
    </>
  );
}
