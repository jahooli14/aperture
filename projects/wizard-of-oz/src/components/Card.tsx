import { motion, HTMLMotionProps } from 'framer-motion';
import { forwardRef } from 'react';

interface CardProps extends HTMLMotionProps<'div'> {
  interactive?: boolean;
  children: React.ReactNode;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ interactive = false, children, className = '', ...props }, ref) => {
    const interactionProps = interactive
      ? {
          whileHover: { scale: 1.02, y: -2 },
          whileTap: { scale: 0.98 },
          transition: { type: 'spring' as const, stiffness: 400, damping: 17 },
        }
      : {};

    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`
          bg-white rounded-lg shadow-lg
          ${interactive ? 'cursor-pointer hover:shadow-xl transition-shadow' : ''}
          ${className}
        `}
        {...interactionProps}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);

Card.displayName = 'Card';
